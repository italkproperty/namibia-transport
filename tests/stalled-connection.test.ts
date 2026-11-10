/**
 * One connection that goes silent must not take the instance down with it.
 *
 * This is the production failure, reproduced: Supabase's pooler accepts a
 * connection and then never answers a query on it. The read deadline fires —
 * but nothing cancels the query, the one socket this instance is allowed stays
 * busy, and every later query queues behind it. The reads die at their own
 * deadlines, the writes hang until the platform kills the function, and the
 * instance stays like that for the socket's half-hour lifetime. The Vercel
 * error log for /admin/bookings — seven "did not answer within 6000ms" lines
 * in the same second — is that, seen from outside.
 *
 * The fix is that a deadline retires the pool, so the next query opens a fresh
 * socket. This test puts a proxy in front of the real database, silences the
 * connection mid-flight, and checks that the query *after* the stall answers.
 *
 * Needs a real Postgres (DATABASE_URL); skips without one. The proxy listens
 * on the loopback interface only.
 */
import net from "node:net";

import { sql } from "drizzle-orm";

import { getDb, isDatabaseConfigured, retireDb } from "@/db";
import { DeadlineExceeded, withDeadline } from "@/lib/deadline";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  if (!isDatabaseConfigured()) {
    console.log("DATABASE_URL is not set — skipping the stalled-connection test");
    process.exit(0);
  }

  /* ----------------------------------------------------------- the proxy */

  const original = process.env.DATABASE_URL as string;
  const target = new URL(original);
  const targetPort = Number(target.port || 5432);
  const targetHost = target.hostname;

  let silenced = false;
  let connections = 0;

  const proxy = net.createServer((client) => {
    connections += 1;
    const up = net.connect(targetPort, targetHost);
    client.on("data", (chunk) => up.write(chunk));
    up.on("data", (chunk) => {
      // The stall: bytes keep flowing up, nothing comes back down. The
      // client sees a healthy socket that never replies.
      if (silenced) return;
      client.write(chunk);
    });
    const kill = () => {
      client.destroy();
      up.destroy();
    };
    client.on("error", kill);
    up.on("error", kill);
    client.on("close", kill);
    up.on("close", kill);
  });

  await new Promise<void>((resolve) => proxy.listen(0, "127.0.0.1", resolve));
  const proxied = new URL(original);
  proxied.hostname = "127.0.0.1";
  proxied.port = String((proxy.address() as net.AddressInfo).port);
  process.env.DATABASE_URL = proxied.toString();

  // Whatever pool an earlier import may have built pointed at the real host.
  retireDb("pointing the test at the proxy");

  const select = (n: number, label: string, ms: number) =>
    withDeadline(label, ms, async () => {
      const rows = await getDb().execute(sql`select ${n}::int as n`);
      return Number((rows as unknown as { n: number }[])[0]?.n);
    });

  /* ---------------------------------------------------------- the proof */

  try {
    console.log("a healthy connection through the proxy");
    let baseline: number | null = null;
    try {
      baseline = await select(1, "baseline", 6_000);
    } catch (error) {
      console.log(
        `  skip — this DATABASE_URL cannot be proxied here (${error instanceof Error ? error.message : String(error)})`,
      );
      process.exit(0);
    }
    check("answers", baseline === 1);
    const before = connections;

    console.log("\nthe connection goes silent mid-flight");
    silenced = true;
    let stalled: unknown;
    const t0 = Date.now();
    try {
      await select(2, "stalled read", 1_500);
    } catch (error) {
      stalled = error;
    }
    check(
      "the read dies at its deadline, not the function's",
      stalled instanceof DeadlineExceeded,
      stalled instanceof Error ? stalled.message : String(stalled),
    );
    check("promptly", Date.now() - t0 < 4_000, `${Date.now() - t0}ms`);

    console.log("\nthe query after the stall — the one an operator actually hits");
    silenced = false;
    const t1 = Date.now();
    let next: number | null = null;
    let nextError: unknown;
    try {
      next = await select(3, "after the stall", 5_000);
    } catch (error) {
      nextError = error;
    }
    check(
      "answers instead of queueing behind the dead socket",
      next === 3,
      nextError instanceof Error ? nextError.message : "",
    );
    check("in well under a read deadline", Date.now() - t1 < 3_000, `${Date.now() - t1}ms`);
    check(
      "because the pool was retired and a fresh socket opened",
      connections > before,
      `${connections - before} new connection(s)`,
    );

    console.log("\na write whose transaction stalls — the quote save");
    silenced = true;
    let stalledWrite: unknown;
    const t2 = Date.now();
    try {
      await withDeadline("stalled write", 1_500, () =>
        getDb().transaction(async (tx) => {
          await tx.execute(sql`select 4`);
          return 4;
        }),
      );
    } catch (error) {
      stalledWrite = error;
    }
    check(
      "the write dies at its deadline instead of hanging the function",
      stalledWrite instanceof DeadlineExceeded,
      stalledWrite instanceof Error ? stalledWrite.message : String(stalledWrite),
    );
    check("promptly", Date.now() - t2 < 4_000, `${Date.now() - t2}ms`);

    silenced = false;
    let afterWrite: number | null = null;
    try {
      afterWrite = await select(5, "after the stalled write", 5_000);
    } catch {
      // reported below
    }
    check("and the instance is usable again straight after", afterWrite === 5);
  } finally {
    retireDb("test teardown");
    process.env.DATABASE_URL = original;
    // The silenced upstream socket is destroyed by retireDb's end(); give it
    // a moment so the proxy's close handlers run before the server stops.
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    proxy.close();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

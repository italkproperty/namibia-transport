/**
 * The PayToday header probe.
 *
 * Background: `initialize()` has returned 403 since 27 August against
 * credentials PayToday's support says are correct on their side. Both can be
 * true at once. Their API is browser-shaped, an earlier session guessed the
 * 403 was a missing `Origin` and started inventing one, and an Origin is
 * precisely what makes a server call look like a cross-origin browser call —
 * which can switch on a domain check a plain server request never triggers.
 * Announcing a domain they do not hold on file is how a recognised merchant
 * gets refused anyway, and the refusal echoes our shop handle straight back.
 *
 * So the headers became a variant and the diagnostic tries each one. The
 * failure mode that would make that worthless is subtle: the SDK's fetch is
 * baked into a sandbox that used to be cached globally, so a careless probe
 * would test one set of headers five times and report a confident wrong
 * answer. These run the real code against a local server that records what
 * actually reached the wire.
 *
 * Nothing here talks to PayToday. `initialize()` creates nothing even in
 * production, but the rule stands: no real payment intent ever goes in a test.
 */
import { createServer, type Server } from "node:http";

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

type Seen = { origin?: string; referer?: string; ua?: string };

/**
 * A fresh port per scenario. Closing a server and reopening one on the same
 * port inside a single process leaves pooled keep-alive sockets pointing at
 * the dead listener, and the next request fails at the transport — which used
 * to be reported as "PayToday refused this variant". Finding that is what
 * added `reached` to ProbeResult.
 */
let nextPort = 39917;

/**
 * Stands in for PayToday: serves a script the same shape as their SDK, and
 * answers the auth endpoint according to `accept`.
 */
function startFake(accept: (h: Seen) => boolean): {
  server: Server;
  seen: Seen[];
  port: number;
} {
  const seen: Seen[] = [];
  const PORT = nextPort++;

  const server = createServer((req, res) => {
    if (req.url?.includes("sdk.js")) {
      res.writeHead(200, { "content-type": "application/javascript" });
      res.end(`
        class PayToday {
          constructor(o) { this.o = o; }
          async initialize() {
            const r = await fetch("http://127.0.0.1:${PORT}/web/configuration/intent/", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ handle: this.o.shopHandle }),
            });
            return r.ok;
          }
          async queryPaymentIntent() { return {}; }
          async createPaymentIntent() { return {}; }
        }
        globalThis.PayToday = PayToday;
      `);
      return;
    }

    const headers: Seen = {
      origin: req.headers.origin as string | undefined,
      referer: req.headers.referer as string | undefined,
      ua: req.headers["user-agent"] as string | undefined,
    };
    seen.push(headers);

    if (accept(headers)) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // The real refusal: a signed JWT whose payload is the only place the
    // reason lives. Mirrored here so the decode path is exercised too.
    res.writeHead(403, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        token:
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
          "eyJkYXRhIjp7ImhhbmRsZSI6IjU0NDA6OmI5Y2M2NDk0NzgzMSIsInN0YXR1cyI6InVuYXV0aG9yaXplZCIsImVycm9yIjoiQXV0aG9yaXphdGlvbiBlcnJvcjoifX0." +
          "c2ln",
      }),
    );
  });

  return { server, seen, port: PORT };
}

function configure(port: number) {
  process.env.PAYTODAY_SHOP_KEY = "probe-key";
  process.env.PAYTODAY_SHOP_HANDLE = "probe-handle";
  process.env.PAYTODAY_PRIVATE_KEY = "probe-private";
  process.env.PAYTODAY_SDK_URL = `http://127.0.0.1:${port}/sdk.js`;
  delete process.env.PAYTODAY_HEADER_VARIANT;
}

async function main() {
  const { decodeJwtPayload } = await import("@/lib/payments/paytoday/jwt");
  const { headerVariants, activeVariant, applyVariant } = await import(
    "@/lib/payments/paytoday/headers"
  );

  /* ------------------------------------------------------- the variants */

  console.log("the variants");

  process.env.NEXT_PUBLIC_SITE_URL = "https://namibiatransport.com";
  const variants = headerVariants();

  check("there is more than one to try", variants.length > 1, `${variants.length}`);
  check(
    "the first sends nothing we were not asked for",
    variants[0].id === "none" &&
      variants[0].origin === null &&
      variants[0].referer === null,
  );
  check(
    "and that is the default the payment path uses",
    activeVariant().id === "none",
  );
  check(
    "every variant explains what it is testing",
    variants.every((v) => v.rationale.length > 20),
  );
  check(
    "no two variants send the same thing",
    new Set(
      variants.map((v) => `${v.origin ?? ""}|${v.referer ?? ""}|${v.userAgent ?? ""}`),
    ).size === variants.length,
  );

  // The www/apex pair collapses when the site URL already carries one form,
  // and a duplicate costs a real failed authentication to learn nothing.
  const onWww = headerVariants("https://www.namibiatransport.com");
  check(
    "a www site URL does not produce a duplicate of itself",
    new Set(
      onWww.map((v) => `${v.origin ?? ""}|${v.referer ?? ""}|${v.userAgent ?? ""}`),
    ).size === onWww.length,
    onWww.map((v) => v.origin ?? "(none)").join(" / "),
  );
  check(
    "and the apex form is still offered alongside it",
    onWww.some((v) => v.origin === "https://namibiatransport.com"),
  );

  check(
    "an unknown PAYTODAY_HEADER_VARIANT falls back rather than throwing",
    (() => {
      process.env.PAYTODAY_HEADER_VARIANT = "nonsense";
      const chosen = activeVariant().id;
      delete process.env.PAYTODAY_HEADER_VARIANT;
      return chosen === "none";
    })(),
  );

  check(
    "applying a variant never overwrites a header the SDK set itself",
    (() => {
      const headers = new Headers({ Origin: "https://sdk-set-this.example" });
      applyVariant(headers, {
        id: "x",
        label: "x",
        rationale: "x",
        origin: "https://ours.example",
        referer: "https://ours.example/",
        userAgent: null,
      });
      return headers.get("origin") === "https://sdk-set-this.example";
    })(),
  );

  /* ------------------------------------------- what reaches the wire */

  /**
   * The failure this exists to catch: the SDK's fetch is baked into a sandbox,
   * so a probe that reuses a cached constructor tests one set of headers over
   * and over and reports a confident wrong answer.
   */
  console.log("\neach variant really reaches the wire differently");

  const refuseAll = startFake(() => false);
  configure(refuseAll.port);
  await new Promise<void>((r) =>
    refuseAll.server.listen(refuseAll.port, "127.0.0.1", r),
  );

  const { probeHeaderVariants } = await import(
    "@/lib/payments/paytoday/diagnose"
  );
  const all = await probeHeaderVariants();
  refuseAll.server.close();

  check("it ran", all.ran, all.reason);
  check(
    "every variant was tried, because none worked",
    all.results.length === variants.length,
    `${all.results.length} of ${variants.length}`,
  );
  check(
    "THE RULE: each attempt sent different headers",
    new Set(
      refuseAll.seen.map((h) => `${h.origin ?? ""}|${h.referer ?? ""}|${h.ua ?? ""}`),
    ).size === refuseAll.seen.length,
    refuseAll.seen.map((h) => h.origin ?? "(none)").join(" / "),
  );
  check(
    "the 'none' attempt really sent no Origin",
    refuseAll.seen[0]?.origin === undefined,
    String(refuseAll.seen[0]?.origin),
  );
  check(
    "a later attempt really did send one",
    refuseAll.seen.some((h) => h.origin !== undefined),
  );
  check("nothing authenticated, so there is no winner", all.winner === null);
  check(
    "each refusal is captured with its status",
    all.results.every((r) => r.failure?.status === 403),
  );
  check(
    "and the reason is decoded out of the JWT, where it hides",
    (decodeJwtPayload(all.results[0].failure?.body ?? "") ?? "").includes(
      "Authorization error",
    ),
  );

  /* ------------------------------------------------------- the winner */

  console.log("\nwhen one variant is accepted");

  const acceptBare = startFake((h) => h.origin === undefined);
  configure(acceptBare.port);
  await new Promise<void>((r) =>
    acceptBare.server.listen(acceptBare.port, "127.0.0.1", r),
  );

  // No re-import: probeHeaderVariants() clears the cached SDK source when it
  // finishes, so a second call fetches the new server's script. If it did not,
  // this run would silently replay the previous server and prove nothing —
  // which is exactly why the winner is asserted below rather than assumed.
  const won = await probeHeaderVariants();
  acceptBare.server.close();

  check("it finds the winner", won.winner?.variant.id === "none", String(won.winner?.variant.id));
  check(
    "THE RULE: it stops there rather than burning more authentications",
    won.results.length === 1,
    `${won.results.length} attempts`,
  );
  check("and reports it as authenticated", won.results[0].ok);

  /* ------------------------------------ a request that never landed */

  /**
   * The distinction that made this worth adding. A dead host is not a refusal,
   * and reporting it as one sends an operator to argue with a support desk
   * about a dropped socket. Found for real: closing a fake server and reopening
   * one on the same port left a pooled keep-alive socket, and the attempt that
   * used it was reported as "PayToday refused these headers".
   */
  console.log("\na request that never lands is not a refusal");

  configure(39990); // nothing is listening here
  const dead = await probeHeaderVariants();

  check("it still runs", dead.ran);
  check("nothing authenticated", dead.winner === null);
  check(
    "THE RULE: no attempt is marked as having reached PayToday",
    dead.results.every((r) => !r.reached),
  );
  check(
    "and the run says so rather than showing refusals",
    !dead.anyReached,
  );
  check(
    "each one says the request never landed",
    dead.results.every((r) => /never reached|never answered/.test(r.detail)),
    dead.results[0]?.detail,
  );
  check(
    "with no failure body to misread as a verdict",
    dead.results.every((r) => r.failure === null),
  );

  /* ----------------------------------------------- refusing to guess */

  console.log("\nwithout credentials it says so rather than probing");

  delete process.env.PAYTODAY_SHOP_KEY;
  const none = await probeHeaderVariants();
  check("it does not run", !none.ran);
  check("and says why", none.reason.includes("not configured"));
  check("with no results to misread", none.results.length === 0);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

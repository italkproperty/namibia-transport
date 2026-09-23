import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/shell";
import { Badge } from "@/components/ui/badge";
import {
  diagnosePayToday,
  probeHeaderVariants,
} from "@/lib/payments/paytoday/diagnose";
import { decodeJwtPayload } from "@/lib/payments/paytoday/jwt";

export const metadata: Metadata = {
  title: "PayToday",
  robots: { index: false, follow: false },
};

// Runs the probe on each load rather than serving a cached verdict about a
// gateway whose state changes on their side, not ours.
export const dynamic = "force-dynamic";

export default async function AdminPayTodayPage() {
  // Sequential: the matrix authenticates repeatedly, and running it alongside
  // the single diagnosis would have two probes fighting over the same caches.
  const d = await diagnosePayToday();
  const matrix = d.outcome === "ok" ? null : await probeHeaderVariants();

  const verdict =
    d.outcome === "ok"
      ? { tone: "ok", line: "PayToday answered an authenticated call." }
      : d.outcome === "not-configured"
        ? { tone: "warn", line: "Not configured on this deployment." }
        : { tone: "bad", line: "The authenticated call failed." };

  return (
    <AdminShell active="/admin/paytoday">
      <div className="space-y-6">
        <div>
          <h1 className="text-xl">PayToday</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm text-pretty">
            A read-only check of the live gateway, so a support conversation can
            be about evidence rather than &ldquo;it returns 403&rdquo;. It
            authenticates and looks up a payment intent that cannot exist —
            nothing is created and nothing is charged, which matters because
            PayToday has no sandbox and every intent is real money.
          </p>
        </div>

        <section className="bg-card rounded-xl border p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={verdict.tone === "ok" ? "default" : "secondary"}
              className={
                verdict.tone === "bad"
                  ? "bg-destructive/10 text-destructive"
                  : verdict.tone === "warn"
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                    : undefined
              }
            >
              {verdict.tone === "ok"
                ? "Working"
                : verdict.tone === "warn"
                  ? "Not configured"
                  : "Failing"}
            </Badge>
            <p className="text-sm font-medium">{verdict.line}</p>
          </div>

          <p className="text-muted-foreground mt-3 text-sm leading-relaxed break-words whitespace-pre-wrap">
            {d.detail}
          </p>
        </section>

        {d.failure && (
          <section className="bg-card rounded-xl border p-4">
            <h2 className="text-sm font-semibold">
              What PayToday actually returned
            </h2>
            <p className="text-muted-foreground mt-1 text-xs text-pretty">
              Copy this into a support ticket. It is their endpoint and their
              own response — not our description of it.
            </p>
            <dl className="mt-3 grid gap-2 text-sm">
              <Row label="Status">
                {d.failure.status} {d.failure.statusText}
              </Row>
              <Row label="Endpoint">{d.failure.url}</Row>
              <Row label="Seen at">{d.failure.at}</Row>
            </dl>
            {decodeJwtPayload(d.failure.body) && (
              <pre className="bg-muted mt-3 overflow-x-auto rounded-lg p-3 font-mono text-xs">
                {decodeJwtPayload(d.failure.body)}
              </pre>
            )}
            <details className="mt-3">
              <summary className="text-muted-foreground cursor-pointer text-xs">
                Raw response body
              </summary>
              <pre className="bg-muted mt-2 overflow-x-auto rounded-lg p-3 font-mono text-[0.7rem] break-all whitespace-pre-wrap">
                {d.failure.body || "(empty)"}
              </pre>
            </details>
          </section>
        )}

        <section className="bg-card rounded-xl border p-4">
          <h2 className="text-sm font-semibold">What this deployment sends</h2>
          <dl className="mt-3 grid gap-2 text-sm">
            <Row label="Adapter in use">
              {d.provider}
              {d.provider === "stub" && (
                <span className="text-muted-foreground">
                  {" "}
                  — set PAYMENT_PROVIDER=paytoday to go live
                </span>
              )}
            </Row>
            <Row label="Headers sent">{d.variant.label}</Row>
            <Row label="Shop key">{d.keys.shopKey ? "present" : "missing"}</Row>
            <Row label="Shop handle">
              {d.keys.shopHandle ? "present" : "missing"}
            </Row>
            <Row label="Private key">
              {d.keys.privateKey ? "present" : "missing"}
            </Row>
            <Row label="SDK loaded">{d.sdkLoaded ? "yes" : "no"}</Row>
          </dl>
          <p className="text-muted-foreground mt-3 text-xs text-pretty">
            Set <code>PAYTODAY_HEADER_VARIANT</code> to whichever variant the
            probe below shows working, then redeploy.
          </p>
        </section>

        {/* ------------------------------------------------ the probe matrix */}
        {matrix && (
          <section className="bg-card rounded-xl border p-4">
            <h2 className="text-sm font-semibold">
              Which headers does PayToday accept?
            </h2>
            <p className="text-muted-foreground mt-1 max-w-2xl text-sm text-pretty">
              We invented the <code>Origin</code> header this integration has
              been sending — nothing in PayToday&rsquo;s guide asks for one. An
              Origin is also what makes a server call look like a cross-origin
              browser call, which can switch on a domain check that a plain
              server request never triggers. If PayToday say their side is
              correct, both can be true at once: the account is fine and the
              request is announcing a domain their edge does not recognise.
            </p>
            <p className="text-muted-foreground mt-2 max-w-2xl text-sm text-pretty">
              Each row is one authentication attempt. Nothing is created and
              nothing is charged. It stops at the first variant that works.
            </p>

            {!matrix.ran ? (
              <p className="text-muted-foreground mt-4 text-sm">
                {matrix.reason}
              </p>
            ) : (
              <>
                <ul className="mt-4 grid gap-2">
                  {matrix.results.map((r) => (
                    <li
                      key={r.variant.id}
                      className={`rounded-lg border p-3 ${
                        r.ok ? "border-success/50 bg-success/5" : ""
                      }`}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <p className="text-sm font-medium">
                          {r.ok ? "✓ " : "✕ "}
                          {r.variant.label}
                        </p>
                        <p className="text-muted-foreground font-mono text-xs">
                          {r.ok
                            ? "authenticated"
                            : r.failure
                              ? `${r.failure.status} ${r.failure.statusText}`
                              : "never landed"}
                          {" · "}
                          {r.ms}ms
                          {" · "}
                          <code>{r.variant.id}</code>
                        </p>
                      </div>
                      <p className="text-muted-foreground mt-1 text-xs leading-snug text-pretty">
                        {r.variant.rationale}
                      </p>
                      {r.failure && decodeJwtPayload(r.failure.body) && (
                        <pre className="bg-muted mt-2 overflow-x-auto rounded-md p-2 font-mono text-[0.7rem] leading-snug">
                          {decodeJwtPayload(r.failure.body)}
                        </pre>
                      )}
                    </li>
                  ))}
                </ul>

                {!matrix.anyReached ? (
                  <p className="border-warning/40 bg-warning/10 mt-4 rounded-lg border p-3 text-sm leading-relaxed text-pretty">
                    Not one attempt reached PayToday, so this run says nothing
                    about the headers — the requests did not land at all.
                    Check that this deployment has outbound access to their
                    host before reading anything into the rows above.
                  </p>
                ) : matrix.winner ? (
                  <p className="border-success/40 bg-success/10 mt-4 rounded-lg border p-3 text-sm text-pretty">
                    <span className="font-medium">
                      {matrix.winner.variant.label} authenticated.
                    </span>{" "}
                    Set <code>PAYTODAY_HEADER_VARIANT={matrix.winner.variant.id}</code>{" "}
                    in Vercel and redeploy. Payments should work from that
                    point.
                  </p>
                ) : (
                  <p className="border-border mt-4 rounded-lg border border-dashed p-3 text-sm leading-relaxed text-pretty">
                    Every variant was refused, which rules out the headers and
                    leaves the account side. Send PayToday the decoded bodies
                    above: they echo our shop handle back, so they know who we
                    are and are refusing anyway — that is a question only they
                    can answer, and it is the specific thing to ask.
                  </p>
                )}
              </>
            )}
          </section>
        )}
      </div>
    </AdminShell>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b pb-2 last:border-b-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium break-all">{children}</dd>
    </div>
  );
}

import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/shell";
import { Badge } from "@/components/ui/badge";
import { diagnosePayToday } from "@/lib/payments/paytoday/diagnose";

export const metadata: Metadata = {
  title: "PayToday",
  robots: { index: false, follow: false },
};

// Runs the probe on each load rather than serving a cached verdict about a
// gateway whose state changes on their side, not ours.
export const dynamic = "force-dynamic";

export default async function AdminPayTodayPage() {
  const d = await diagnosePayToday();

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
            <Row label="Origin / Referer">{d.origin}</Row>
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
            The Origin above is the exact string PayToday sees. Their API is
            built for browser callers, so a server request has to present one —
            if the domain they hold on file differs from this by so much as a{" "}
            <code>www.</code>, an origin check would reject it. That is the
            first thing worth confirming with them.
          </p>
        </section>
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

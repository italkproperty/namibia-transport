import Link from "next/link";

import { Logo } from "@/components/brand/logo";

import { AdminSignInForm } from "@/components/admin/sign-in-form";
import { Button } from "@/components/ui/button";
import { adminSignOut } from "@/lib/admin/actions";
import { getAdminGateState } from "@/lib/admin/auth";

const TABS = [
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/enquiries", label: "Corporate enquiries" },
] as const;

/**
 * Chrome and gate for every internal page, so a new tab cannot accidentally
 * ship without the password check in front of it.
 */
export async function AdminShell({
  active,
  children,
}: {
  active: (typeof TABS)[number]["href"];
  children: React.ReactNode;
}) {
  const gate = await getAdminGateState();

  if (gate.state !== "signed-in") {
    return (
      <Frame>
        <div className="mx-auto max-w-sm">
          {gate.state === "unconfigured" ? (
            <div className="rounded-xl border border-dashed p-6">
              <h1 className="text-lg font-semibold">Admin is not configured</h1>
              <p className="text-muted-foreground mt-2 text-sm leading-snug">
                Set <code className="text-foreground">ADMIN_PASSWORD</code> in
                your environment to open this view. It stays closed until you
                do.
              </p>
            </div>
          ) : (
            <div className="bg-card rounded-xl border p-6">
              <h1 className="text-lg font-semibold">Dispatch</h1>
              <p className="text-muted-foreground mt-1 mb-5 text-sm">
                Internal view. Sign in to continue.
              </p>
              <AdminSignInForm />
            </div>
          )}
        </div>
      </Frame>
    );
  }

  return (
    <Frame
      action={
        <form action={adminSignOut}>
          <Button type="submit" variant="ghost" size="sm" className="press">
            Sign out
          </Button>
        </form>
      }
      tabs={
        <nav aria-label="Sections" className="flex gap-1">
          {TABS.map((tab) => {
            const isActive = tab.href === active;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={[
                  "press rounded-md px-3 py-1.5 text-sm",
                  isActive
                    ? "bg-card shadow-card font-medium"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      }
    >
      {children}
    </Frame>
  );
}

function Frame({
  children,
  action,
  tabs,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  tabs?: React.ReactNode;
}) {
  return (
    <div className="min-h-svh">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-[110rem] items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" aria-label="Namibia Transport">
            <Logo markSize={26} />
          </Link>
          {tabs}
          <div className="ml-auto">{action}</div>
        </div>
      </header>
      <main className="mx-auto max-w-[110rem] px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}

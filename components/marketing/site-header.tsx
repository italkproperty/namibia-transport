import Link from "next/link";

import { SITE } from "@/lib/site";

export function SiteHeader() {
  return (
    <header className="bg-background/90 sticky top-0 z-40 border-b backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-6 px-4 sm:px-6">
        <Link
          href="/"
          className="focus-visible:ring-ring rounded-sm text-[0.95rem] font-semibold tracking-tight focus-visible:ring-[3px] focus-visible:outline-none"
        >
          {SITE.name}
        </Link>

        <nav
          aria-label="Main"
          className="text-muted-foreground ml-auto flex items-center gap-5 text-sm"
        >
          <Link href="/corporate" className="hover:text-foreground transition">
            Corporate
          </Link>
        </nav>
      </div>
    </header>
  );
}

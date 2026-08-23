import Link from "next/link";

import { Button } from "@/components/ui/button";
import { SITE } from "@/lib/site";

export function SiteHeader() {
  return (
    <header className="border-border/60 bg-background/85 sticky top-0 z-40 border-b backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5 sm:px-8">
        <Link
          href="/"
          className="focus-visible:ring-ring rounded-sm text-[0.95rem] font-semibold tracking-tight focus-visible:ring-[3px] focus-visible:outline-none"
        >
          {SITE.name}
        </Link>

        <nav
          aria-label="Main"
          className="text-muted-foreground hidden items-center gap-8 text-sm md:flex"
        >
          <Link href="/#routes" className="hover:text-foreground transition">
            Routes
          </Link>
          <Link href="/#how" className="hover:text-foreground transition">
            How it works
          </Link>
        </nav>

        <Button asChild size="sm">
          <Link href="/book">Book a transfer</Link>
        </Button>
      </div>
    </header>
  );
}

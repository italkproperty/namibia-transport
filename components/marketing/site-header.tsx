import Link from "next/link";

import { Logo } from "@/components/brand/logo";

import { SITE } from "@/lib/site";

export function SiteHeader() {
  return (
    <header className="bg-background/90 sticky top-0 z-40 border-b backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-6 px-4 sm:px-6">
        <Link
          href="/"
          aria-label={SITE.name}
          className="focus-visible:ring-ring rounded-sm focus-visible:ring-[3px] focus-visible:outline-none"
        >
          <Logo />
        </Link>

        <nav
          aria-label="Main"
          className="text-muted-foreground ml-auto flex items-center gap-4 text-sm sm:gap-6"
        >
          <Link
            href="/corporate"
            className="hover:text-foreground transition"
          >
            Corporate
          </Link>
          <Link
            href="/about"
            className="hover:text-foreground hidden transition sm:inline"
          >
            About
          </Link>
          <Link href="/contact" className="hover:text-foreground transition">
            Contact
          </Link>
        </nav>
      </div>
    </header>
  );
}

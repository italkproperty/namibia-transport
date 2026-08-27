"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * A header link that knows whether you are on it.
 *
 * The old nav gave no indication of where you were — every item looked
 * identical on every page. `aria-current` carries that to screen readers as
 * well as showing it.
 */
export function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={[
        "focus-visible:ring-ring relative rounded-sm text-sm transition-colors focus-visible:ring-[3px] focus-visible:outline-none",
        // The underline grows from the centre rather than appearing, which is
        // the difference between a link that responds and one that blinks.
        "after:bg-brand after:absolute after:-bottom-1.5 after:left-1/2 after:h-px after:w-0 after:-translate-x-1/2 after:transition-all after:duration-200",
        "hover:after:left-0 hover:after:w-full hover:after:translate-x-0",
        active
          ? "text-foreground after:left-0 after:w-full after:translate-x-0"
          : "text-muted-foreground hover:text-foreground",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

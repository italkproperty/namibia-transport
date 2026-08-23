import Link from "next/link";

import { Button } from "@/components/ui/button";
import { SITE } from "@/lib/site";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col justify-center gap-6 px-6 py-16">
      <p className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
        {SITE.name}
      </p>
      <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
        Private airport transfers in Namibia.
      </h1>
      <p className="text-muted-foreground max-w-prose text-lg text-pretty">
        {SITE.description}
      </p>
      <div>
        <Button asChild size="lg">
          <Link href="/book">Book a transfer</Link>
        </Button>
      </div>
    </main>
  );
}

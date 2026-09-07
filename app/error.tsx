"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";

/**
 * What a visitor sees instead of Next's bare "Application error" screen.
 *
 * The common cause here is not a bug in the page at all: every deployment
 * gives Server Actions new content-hashed ids, so a tab opened before a
 * deploy submits a form whose action no longer exists in the build now
 * serving it. Next reports that as a client-side exception and, without a
 * boundary, the operator gets a white page and a console message.
 *
 * That case is worth naming, because the fix — reload, and the page works —
 * is one the reader can act on immediately and would otherwise never guess.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isStaleDeployment =
    /server action|failed to find server action|was not found on the server/i.test(
      error.message,
    );

  React.useEffect(() => {
    console.error("[app] unhandled error", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-4 py-16">
      <div className="bg-card rounded-xl border p-6">
        <h1 className="text-lg font-semibold">
          {isStaleDeployment ? "This page is out of date" : "Something broke"}
        </h1>

        <p className="text-muted-foreground mt-2 text-sm leading-relaxed text-pretty">
          {isStaleDeployment
            ? "The site was updated while this tab was open, so the form it submitted no longer matches what the server is running. Reloading fixes it — nothing you entered was saved."
            : "That is our fault, not yours. Reloading usually clears it. If it keeps happening, tell us what you were doing and we will look."}
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            className="press bg-brand text-brand-foreground hover:bg-brand-hover"
            // A full reload, not reset(): the running build is the stale
            // thing, so re-rendering it would fail exactly the same way.
            onClick={() => window.location.reload()}
          >
            Reload the page
          </Button>
          {!isStaleDeployment && (
            <Button variant="outline" className="press" onClick={reset}>
              Try again
            </Button>
          )}
        </div>

        {error.digest && (
          <p className="text-muted-foreground mt-4 font-mono text-xs">
            Reference {error.digest}
          </p>
        )}
      </div>
    </main>
  );
}

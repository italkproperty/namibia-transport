"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";

import { adminSignIn, type AdminSignInResult } from "@/lib/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AdminSignInForm() {
  const router = useRouter();
  const [result, formAction, isPending] = React.useActionState<
    AdminSignInResult | null,
    FormData
  >(adminSignIn, null);

  React.useEffect(() => {
    if (result?.ok) router.refresh();
  }, [result, router]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="admin-password">Password</Label>
        <Input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={result?.ok === false}
          aria-describedby={result?.message ? "admin-password-error" : undefined}
        />
        {result?.message && (
          <p id="admin-password-error" className="text-destructive text-sm">
            {result.message}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending && <Loader2Icon className="size-4 animate-spin" aria-hidden />}
        {isPending ? "Checking…" : "Sign in"}
      </Button>
    </form>
  );
}

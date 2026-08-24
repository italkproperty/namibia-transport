"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createReview,
  setReviewPublished,
  type ReviewActionResult,
} from "@/lib/reviews-admin";

/** Publish toggle — the only thing that puts a review on the public site. */
export function PublishToggle({
  id,
  isPublished,
}: {
  id: string;
  isPublished: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  return (
    <Button
      size="sm"
      variant={isPublished ? "secondary" : "default"}
      disabled={isPending}
      className="press h-8"
      onClick={() =>
        startTransition(async () => {
          const result = await setReviewPublished(id, !isPublished);
          if (result.ok) router.refresh();
          else toast.error("Could not update the review");
        })
      }
    >
      {isPending && <Loader2Icon className="size-3 animate-spin" aria-hidden />}
      {isPublished ? "Unpublish" : "Publish"}
    </Button>
  );
}

export function AddReviewForm() {
  const router = useRouter();
  const [result, formAction, isPending] = React.useActionState<
    ReviewActionResult | null,
    FormData
  >(createReview, null);

  React.useEffect(() => {
    if (result?.ok) router.refresh();
  }, [result, router]);

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <div className="grid gap-1.5">
        <Label htmlFor="r-name">Reviewer name</Label>
        <Input id="r-name" name="authorName" required className="h-10" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="r-context">Context (optional)</Label>
        <Input
          id="r-context"
          name="authorContext"
          placeholder="e.g. Germany · WDH to Windhoek"
          className="h-10"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="r-rating">Rating</Label>
        <Select name="rating" defaultValue="5">
          <SelectTrigger id="r-rating" className="h-10 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[5, 4, 3, 2, 1].map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n} star{n === 1 ? "" : "s"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="r-source">Source</Label>
        <Select name="source" defaultValue="whatsapp">
          <SelectTrigger id="r-source" className="h-10 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["whatsapp", "google", "email", "direct"].map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor="r-body">Review</Label>
        <textarea
          id="r-body"
          name="body"
          rows={3}
          required
          placeholder="Transcribe exactly what the traveller wrote."
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
        />
      </div>

      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={isPending} className="press">
          {isPending && <Loader2Icon className="size-4 animate-spin" aria-hidden />}
          Save review
        </Button>
        {result?.message && (
          <p className="text-destructive text-sm">{result.message}</p>
        )}
        {result?.ok && (
          <p className="text-success text-sm">Saved — publish it below.</p>
        )}
      </div>
    </form>
  );
}

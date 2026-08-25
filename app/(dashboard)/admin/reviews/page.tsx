import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/shell";
import {
  AddReviewForm,
  PublishToggle,
} from "@/components/admin/review-controls";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { listAllReviews } from "@/lib/reviews-admin";

export const metadata: Metadata = {
  title: "Reviews",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const MIN_TO_DISPLAY = 3;

export default async function AdminReviewsPage() {
  const reviews = await listAllReviews();
  const published = reviews.filter((r) => r.isPublished);
  const average =
    published.length > 0
      ? published.reduce((sum, r) => sum + r.rating, 0) / published.length
      : 0;

  return (
    <AdminShell active="/admin/reviews">
      <div className="space-y-6">
        <div>
          <h1 className="text-xl">Reviews</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Transcribe real messages and reviews here, then publish them. There
            is no public submission form — unattended intake is how fabricated
            social proof gets in.
          </p>
        </div>

        <div className="bg-card rounded-xl border p-4">
          <p className="text-sm font-medium">
            {published.length} published
            {published.length > 0 && ` · ${average.toFixed(1)}/5 average`}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {published.length >= MIN_TO_DISPLAY
              ? "The rating and review section are live on the public site."
              : `The public site shows nothing until ${MIN_TO_DISPLAY} reviews are published — a rating from one or two reads as manufactured.`}
          </p>
        </div>

        <section aria-labelledby="add-heading" className="bg-card rounded-xl border p-4">
          <h2 id="add-heading" className="mb-3 text-sm font-semibold">
            Add a review
          </h2>
          <AddReviewForm />
        </section>

        {reviews.length > 0 && (
          <ul className="space-y-3">
            {reviews.map((review) => (
              <li key={review.id} className="bg-card rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {review.authorName}
                      {review.authorContext && (
                        <span className="text-muted-foreground font-normal">
                          {" · "}
                          {review.authorContext}
                        </span>
                      )}
                    </p>
                    <p className="text-brand mt-0.5 text-sm">
                      {"★".repeat(review.rating)}
                      <span className="text-border">
                        {"★".repeat(5 - review.rating)}
                      </span>
                      <span className="text-muted-foreground ml-2 text-xs">
                        {review.source} · {formatDate(review.createdAt)}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={review.isPublished ? "success" : "secondary"}>
                      {review.isPublished ? "Published" : "Draft"}
                    </Badge>
                    <PublishToggle
                      id={review.id}
                      isPublished={review.isPublished}
                    />
                  </div>
                </div>
                <p className="mt-2 text-sm leading-snug text-pretty">
                  {review.body}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}

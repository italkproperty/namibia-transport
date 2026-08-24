import "server-only";

import { avg, count, desc, eq } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/db";
import { reviews, type Review } from "@/db/schema";

/**
 * Only explicitly published rows ever reach a page. There is no fallback and
 * no sample data: until real reviews exist, every review surface is absent
 * rather than showing an invented rating.
 */
export async function getPublishedReviews(): Promise<Review[]> {
  if (!isDatabaseConfigured()) return [];

  try {
    return await getDb()
      .select()
      .from(reviews)
      .where(eq(reviews.isPublished, true))
      .orderBy(desc(reviews.createdAt))
      .limit(12);
  } catch {
    return [];
  }
}

export type ReviewSummary = { average: number; count: number };

/**
 * Aggregate rating. Returns null below a minimum sample — "5.0 from 1
 * traveller" reads as manufactured, and would be.
 */
const MIN_REVIEWS_TO_DISPLAY = 3;

export async function getReviewSummary(): Promise<ReviewSummary | null> {
  if (!isDatabaseConfigured()) return null;

  try {
    const [row] = await getDb()
      .select({
        average: avg(reviews.rating),
        total: count(),
      })
      .from(reviews)
      .where(eq(reviews.isPublished, true));

    const total = Number(row?.total ?? 0);
    const average = Number(row?.average ?? 0);
    if (total < MIN_REVIEWS_TO_DISPLAY || !Number.isFinite(average)) return null;

    return { average, count: total };
  } catch {
    return null;
  }
}

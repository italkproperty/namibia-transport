"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getDb, isDatabaseConfigured } from "@/db";
import { reviews } from "@/db/schema";
import { getAdminGateState } from "@/lib/admin/auth";

/**
 * Review capture is deliberately manual: a founder transcribes a real message
 * or Google review and publishes it. There is no public submission endpoint,
 * because unattended review intake is how fake social proof gets in.
 */
const reviewSchema = z.object({
  authorName: z.string().trim().min(2, "Enter the reviewer's name").max(120),
  authorContext: z.string().trim().max(120).optional().or(z.literal("")),
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().trim().min(10, "The review is too short").max(1000),
  source: z.enum(["google", "whatsapp", "email", "direct"]),
  bookingRef: z.string().trim().max(20).optional().or(z.literal("")),
});

export type ReviewActionResult = { ok: boolean; message?: string };

export async function createReview(
  _prev: ReviewActionResult | null,
  formData: FormData
): Promise<ReviewActionResult> {
  const gate = await getAdminGateState();
  if (gate.state !== "signed-in") return { ok: false, message: "Not signed in." };
  if (!isDatabaseConfigured()) {
    return { ok: false, message: "No database connected." };
  }

  const parsed = reviewSchema.safeParse({
    authorName: formData.get("authorName"),
    authorContext: formData.get("authorContext"),
    rating: formData.get("rating"),
    body: formData.get("body"),
    source: formData.get("source"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the form.",
    };
  }

  try {
    await getDb()
      .insert(reviews)
      .values({
        authorName: parsed.data.authorName,
        authorContext: parsed.data.authorContext || null,
        rating: parsed.data.rating,
        body: parsed.data.body,
        source: parsed.data.source,
        // Published deliberately, in a second step — never on capture.
        isPublished: false,
      });

    revalidatePath("/admin/reviews");
    return { ok: true };
  } catch (error) {
    console.error("[reviews] create failed", error);
    return { ok: false, message: "Could not save the review." };
  }
}

export async function setReviewPublished(
  id: string,
  isPublished: boolean
): Promise<{ ok: boolean }> {
  const gate = await getAdminGateState();
  if (gate.state !== "signed-in") return { ok: false };
  if (!isDatabaseConfigured()) return { ok: false };

  try {
    await getDb()
      .update(reviews)
      .set({ isPublished, updatedAt: new Date() })
      .where(eq(reviews.id, id));
    revalidatePath("/admin/reviews");
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    console.error("[reviews] publish toggle failed", error);
    return { ok: false };
  }
}

export async function listAllReviews() {
  if (!isDatabaseConfigured()) return [];
  try {
    return await getDb()
      .select()
      .from(reviews)
      .orderBy(desc(reviews.createdAt))
      .limit(200);
  } catch {
    return [];
  }
}

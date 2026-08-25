"use server";

import { getDb, isDatabaseConfigured } from "@/db";
import { corporateEnquiries } from "@/db/schema";
import { getMessenger } from "@/lib/messaging";

import {
  corporateEnquirySchema,
  NEED_LABELS,
  type CorporateEnquiryResult,
} from "./schema";

/** Untrusted browser text that ends up in an admin table. */
function sanitise(value: string | undefined, max = 200): string | null {
  if (!value) return null;
  const cleaned = Array.from(value)
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code >= 0x20 && code !== 0x7f;
    })
    .join("")
    .trim();
  return cleaned.length > 0 ? cleaned.slice(0, max) : null;
}

/**
 * Records a corporate or group lead. These are quoted by hand, so this only
 * has to capture enough to call the company back — no pricing happens here.
 */
export async function submitCorporateEnquiry(
  input: unknown
): Promise<CorporateEnquiryResult> {
  const parsed = corporateEnquirySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ??
        "Please check the form and try again.",
    };
  }
  const values = parsed.data;

  if (!isDatabaseConfigured()) {
    return {
      ok: false,
      message:
        "We cannot record enquiries yet — the database is not connected. Please contact us on WhatsApp.",
    };
  }

  try {
    const [enquiry] = await getDb()
      .insert(corporateEnquiries)
      .values({
        companyName: values.companyName,
        contactName: values.contactName,
        whatsapp: sanitise(values.whatsapp, 24),
        email: sanitise(values.email, 160),
        needType: values.needType,
        approxPassengers: values.approxPassengers ?? null,
        datesNote: sanitise(values.datesNote),
        notes: sanitise(values.notes, 1000),
        acquisitionSource: sanitise(values.acquisitionSource),
      })
      .returning();

    // Stubbed for now: logs the message it would send to our own team.
    await getMessenger().send({
      to: {
        fullName: values.contactName,
        whatsapp: enquiry.whatsapp,
        email: enquiry.email,
      },
      channel: enquiry.whatsapp ? "whatsapp" : "email",
      template: "corporate_enquiry_received",
      subject: `Corporate enquiry — ${values.companyName}`,
      variables: {
        company: values.companyName,
        need: NEED_LABELS[values.needType],
        passengers: String(values.approxPassengers ?? "unspecified"),
      },
      body:
        `Thanks ${values.contactName} — we have your enquiry for ${values.companyName} ` +
        `(${NEED_LABELS[values.needType]}). We will respond with a quotation within 24 hours.`,
    });

    return { ok: true };
  } catch (error) {
    console.error("[corporate] failed to record enquiry", error);
    return {
      ok: false,
      message: "Something went wrong saving your enquiry. Please try again.",
    };
  }
}

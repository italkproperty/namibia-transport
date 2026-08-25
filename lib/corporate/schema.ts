import { z } from "zod";

/** Shared by the form and re-run inside the Server Action. */
export const corporateEnquirySchema = z
  .object({
    companyName: z
      .string()
      .trim()
      .min(2, "Enter your company name")
      .max(160, "That name is too long"),
    contactName: z
      .string()
      .trim()
      .min(2, "Enter a contact name")
      .max(120, "That name is too long"),
    whatsapp: z
      .string()
      .trim()
      .max(24, "That number looks too long")
      .optional()
      .or(z.literal("")),
    email: z
      .string()
      .trim()
      .email("Enter a valid email address")
      .max(160)
      .optional()
      .or(z.literal("")),
    needType: z.enum([
      "airport_transfers",
      "conference_event",
      "employee_site_transport",
      "other",
    ]),
    approxPassengers: z.coerce
      .number()
      .int()
      .min(1, "At least one passenger")
      .max(5000)
      .optional(),
    datesNote: z.string().trim().max(200).optional().or(z.literal("")),
    notes: z
      .string()
      .trim()
      .max(1000, "Please keep notes under 1000 characters")
      .optional()
      .or(z.literal("")),
    acquisitionSource: z.string().max(200).optional().or(z.literal("")),
  })
  // We must be able to reply, and WhatsApp is the primary channel.
  .refine((value) => Boolean(value.whatsapp || value.email), {
    message: "Give us a WhatsApp number or an email so we can send the quote",
    path: ["whatsapp"],
  });

export type CorporateEnquiryValues = z.infer<typeof corporateEnquirySchema>;

export type CorporateEnquiryResult =
  | { ok: true }
  | { ok: false; message: string };

export const NEED_LABELS: Record<CorporateEnquiryValues["needType"], string> = {
  airport_transfers: "Airport transfers",
  conference_event: "Conference or event",
  employee_site_transport: "Employee or site transport",
  other: "Something else",
};

import { z } from "zod";

import {
  QUOTE_FREQUENCIES,
  QUOTE_SERVICES,
  type QuoteService,
} from "./quote-pricing";

/** Shared by the quotation form and re-run inside the Server Action. */
export const corporateQuoteSchema = z
  .object({
    companyName: z
      .string()
      .trim()
      .min(2, "Enter your company name")
      .max(160),
    contactName: z
      .string()
      .trim()
      .min(2, "Enter a contact name")
      .max(120),
    contactPosition: z.string().trim().max(120).optional().or(z.literal("")),
    email: z
      .string()
      .trim()
      .email("Enter a valid email address")
      .max(160)
      .optional()
      .or(z.literal("")),
    whatsapp: z
      .string()
      .trim()
      .max(24, "That number looks too long")
      .optional()
      .or(z.literal("")),
    industry: z.string().trim().max(80).optional().or(z.literal("")),
    companyRegistration: z.string().trim().max(80).optional().or(z.literal("")),
    billingAddress: z.string().trim().max(300).optional().or(z.literal("")),

    services: z
      .array(z.enum(Object.keys(QUOTE_SERVICES) as [QuoteService, ...QuoteService[]]))
      .min(1, "Choose at least one service"),
    routeSlug: z.string().trim().optional().or(z.literal("")),
    vehicleClassId: z.string().trim().optional().or(z.literal("")),
    passengers: z.coerce.number().int().min(1, "At least one passenger").max(5000),
    vehicles: z.coerce.number().int().min(1).max(100),
    frequency: z.enum(
      Object.keys(QUOTE_FREQUENCIES) as ["once", "daily", "weekly"]
    ),
    periodCount: z.coerce.number().int().min(1).max(365),
    includeReturn: z.boolean(),
    extraWaitingHours: z.coerce.number().int().min(0).max(200),
    extraStops: z.coerce.number().int().min(0).max(50),
    datesNote: z.string().trim().max(200).optional().or(z.literal("")),
    notes: z.string().trim().max(1000).optional().or(z.literal("")),
    acquisitionSource: z.string().max(200).optional().or(z.literal("")),
  })
  // We must be able to send the quotation somewhere.
  .refine((value) => Boolean(value.whatsapp || value.email), {
    message: "Give us a WhatsApp number or an email for the quotation",
    path: ["whatsapp"],
  });

export type CorporateQuoteValues = z.infer<typeof corporateQuoteSchema>;

export type CorporateQuoteResult =
  | { ok: true; quoteNumber: string }
  | { ok: false; message: string };

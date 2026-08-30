import { z } from "zod";

import { NAMIBIA_BOUNDS } from "@/lib/maps/bounds";

/**
 * One schema, used by the form and re-run inside the Server Action. The action
 * never trusts what arrives: it re-validates here, then re-derives the price
 * from the database regardless of what the client believed it to be.
 */

/** Loose on purpose — Namibian and international numbers, any spacing. */
const whatsapp = z
  .string()
  .trim()
  .min(7, "Enter your WhatsApp number, including the country code")
  .max(24, "That number looks too long")
  .regex(
    /^\+?[\d\s()-]+$/,
    "Use digits only, optionally starting with + and a country code",
  );

/** One dropped pin, or nothing. Null and undefined both mean "no pin". */
const pinPoint = z
  .object({
    lat: z.coerce
      .number()
      .min(NAMIBIA_BOUNDS.minLat)
      .max(NAMIBIA_BOUNDS.maxLat),
    lng: z.coerce
      .number()
      .min(NAMIBIA_BOUNDS.minLng)
      .max(NAMIBIA_BOUNDS.maxLng),
  })
  .nullish();

export const bookingFormSchema = z.object({
  routeSlug: z.string().min(1, "Choose a route"),
  vehicleClassId: z.string().uuid("Choose a vehicle"),

  /** ISO date, yyyy-mm-dd, in Namibian local time. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a pickup date"),
  /** 24-hour HH:mm, in Namibian local time. */
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a pickup time"),

  passengers: z.coerce.number().int().min(1, "At least one passenger").max(12),
  luggageCount: z.coerce.number().int().min(0).max(20),

  flightNumber: z
    .string()
    .trim()
    .max(12, "That flight number looks too long")
    .optional()
    .or(z.literal("")),

  fullName: z
    .string()
    .trim()
    .min(2, "Enter the lead traveller's name")
    .max(120, "That name is too long"),
  whatsapp,
  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .max(160)
    .optional()
    .or(z.literal("")),

  customerType: z.enum(["tourist", "corporate"]),

  pickupLabel: z.string().min(1, "Choose a pickup point"),
  dropoffLabel: z.string().min(1, "Choose a destination"),

  /**
   * Optional dropped pins. Free-form input arrives wrong sooner or later — a
   * mis-drag, a stale marker, or someone poking this endpoint directly — and a
   * coordinate in the Atlantic is not a precision upgrade over the pick-list,
   * it is a driver sent nowhere. Anything outside Namibia is refused here
   * rather than stored, and `pinPoint` is reused so both ends get the same
   * treatment.
   */
  pickupPin: pinPoint,
  dropoffPin: pinPoint,

  notes: z
    .string()
    .trim()
    .max(600, "Please keep notes under 600 characters")
    .optional()
    .or(z.literal("")),
  isReturn: z.boolean(),

  /** Attribution, filled in by the browser. Sanitised server-side. */
  acquisitionSource: z.string().max(200).optional().or(z.literal("")),
});

export type BookingFormValues = z.infer<typeof bookingFormSchema>;

export type BookingActionResult =
  | {
      ok: true;
      ref: string;
      /**
       * Hosted gateway page to send the traveller to. Null when payment is
       * stubbed, or when the gateway could not be reached — the booking is
       * saved either way and the confirmation page offers to pay there.
       */
      checkoutUrl?: string | null;
    }
  | {
      ok: false;
      message: string;
      fieldErrors?: Partial<Record<keyof BookingFormValues, string>>;
    };

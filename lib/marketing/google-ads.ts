/** 
 * Google Ads measurement configuration.
 *
 * The Google tag ID identifies the site-wide Google tag (for example,
 * AW-18418844449). Conversion actions are separate Google Ads resources and
 * therefore have their own ID + label. Keeping those concerns separate avoids
 * accidentally sending a conversion to the tag/account ID rather than to the
 * intended conversion action.
 *
 * Direct gtag.js is used deliberately instead of a Tag Manager container.
 * Booking/payment conversions originate from application state and server
 * results, so the application remains the source of truth for the money path.
 */

export type ConversionKind = "booking_submitted" | "booking_paid";

const ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim() || null;

type ConversionConfig = {
  id: string | null;
  label: string | null;
};

/**
 * New configuration:
 *   NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID_BOOKING
 *   NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL_BOOKING
 *   NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID_PAID
 *   NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL_PAID
 *
 * The old label variables remain as a compatibility fallback so an existing
 * deployment does not silently stop reporting while Vercel is being migrated.
 * The fallback uses the site tag ID as the conversion ID only for legacy
 * configuration. New deployments should always set the explicit conversion ID.
 */
const CONVERSIONS: Record<ConversionKind, ConversionConfig> = {
  booking_submitted: {
    id:
      process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID_BOOKING?.trim() ||
      ADS_ID,
    label:
      process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL_BOOKING?.trim() ||
      process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL_BOOKING?.trim() ||
      null,
  },
  booking_paid: {
    id:
      process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID_PAID?.trim() || ADS_ID,
    label:
      process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL_PAID?.trim() ||
      process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL_PAID?.trim() ||
      null,
  },
};

/** The site-wide Google tag, e.g. `AW-18418844449`. */
export function adsId(): string | null {
  return ADS_ID;
}

export function isAdsConfigured(): boolean {
  return ADS_ID !== null;
}

/**
 * Return the exact Google Ads conversion destination:
 * `AW-XXXXXXXXXXX/LABEL`.
 *
 * Null means the conversion action is not fully configured, so the application
 * intentionally sends nothing rather than guessing or counting against the
 * wrong conversion action.
 */
export function sendTo(kind: ConversionKind): string | null {
  const { id, label } = CONVERSIONS[kind];
  return id && label ? `${id}/${label}` : null;
}

/** Which conversion actions cannot be reported yet. */
export function missingLabels(): ConversionKind[] {
  return (Object.keys(CONVERSIONS) as ConversionKind[]).filter(
    (kind) => CONVERSIONS[kind].id === null || CONVERSIONS[kind].label === null,
  );
}

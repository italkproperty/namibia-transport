/**
 * Which click paid for this booking, carried from the landing page to the form.
 *
 * The site used to read `utm_source` and friends on `/book` and nowhere else,
 * which meant attribution only survived when an ad pointed straight at the
 * booking form. It never does: an ad points at a route page, the visitor uses
 * the quote widget, and `bookingHref()` rebuilt the URL from the trip alone.
 * The tag was dropped between the two pages, `channelOf()` then saw a
 * same-host referrer and filed the booking under "Direct or typed in" — so we
 * would have paid Google for a click and recorded it as free traffic.
 *
 * Two carriers, because neither is sufficient alone:
 *
 *   The trip query string, so a link built anywhere keeps the tag and a copied
 *   URL still carries it. This is the one that works with no JavaScript and no
 *   storage.
 *
 *   Session storage, so a visitor who wanders — route page, a destination
 *   guide, the pricing methodology, then back to book — still arrives tagged.
 *   Per tab, cleared when the tab closes, never read by anything but the form.
 *
 * ## Why the whole value is replaced rather than merged
 *
 * The tempting version fills each field from whichever source has it, so a
 * fresh `gclid` with no UTM tags keeps the UTM tags from a visit last week.
 * That silently credits a new click to an old campaign, which is worse than
 * no attribution at all: it is attribution that is confidently wrong, and it
 * is the number a bidding strategy would learn from. So a URL carrying *any*
 * attribution parameter replaces the stored value entirely.
 */

/**
 * The three identifiers Google can put on an ad landing URL.
 *
 * `gclid` is the ordinary one. `wbraid` and `gbraid` appear instead when the
 * click comes from an iOS app context with limited ad tracking, and Google's
 * offline-conversion upload has a separate column for each — so which one we
 * were given is stored rather than guessed back out of the value later.
 */
export const CLICK_KINDS = ["gclid", "wbraid", "gbraid"] as const;
export type ClickKind = (typeof CLICK_KINDS)[number];

export const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

/** Every parameter this module carries, for callers appending to a link. */
export const ATTRIBUTION_KEYS: readonly string[] = [...UTM_KEYS, ...CLICK_KINDS];

export type Attribution = {
  /** The UTM tags as stored, e.g. `utm_source=google&utm_medium=cpc`. */
  source: string | null;
  clickId: string | null;
  clickKind: ClickKind | null;
};

export const NO_ATTRIBUTION: Attribution = {
  source: null,
  clickId: null,
  clickKind: null,
};

export function hasAttribution(value: Attribution): boolean {
  return value.source !== null || value.clickId !== null;
}

/**
 * Anything with a `get`: `URLSearchParams`, or a shim over Next's resolved
 * `searchParams` record.
 */
export type ParamReader = { get(key: string): string | null };

export function paramReader(
  params: Record<string, string | string[] | undefined>,
): ParamReader {
  return {
    get(key) {
      const value = params[key];
      const single = Array.isArray(value) ? value[0] : value;
      return single ?? null;
    },
  };
}

/**
 * Is this plausibly a click identifier, rather than something a stranger typed?
 *
 * `createBooking` is a public endpoint and this value ends up in a file
 * uploaded to Google, so it is validated rather than trusted. Google's click
 * identifiers are base64url with the occasional dot; the bound is generous
 * because their length is not documented and has grown before, but it is a
 * bound. Anything else is dropped — we would rather have no attribution than
 * a row Google rejects, or a column carrying whatever someone pasted.
 */
export function isClickId(value: string): boolean {
  return /^[A-Za-z0-9._-]{8,512}$/.test(value);
}

/** One UTM value, as it arrived in the URL. */
function isUtmValue(value: string): boolean {
  return value.length > 0 && value.length <= 120 && !/[\u0000-\u001f\u007f]/.test(value);
}

/**
 * A stored `utm_a=x&utm_b=y` string, read back out of session storage.
 *
 * Deliberately *not* `isUtmValue` applied to the whole thing: that bound is
 * per value, and five tagged parameters exceed it easily, so reusing it here
 * silently dropped the attribution of exactly the well-tagged campaigns this
 * is for. Checked against the shape we write instead.
 */
function isStoredSource(value: string): boolean {
  return (
    value.length <= 640 &&
    /^utm_[a-z]+=[^&=]*(?:&utm_[a-z]+=[^&=]*)*$/.test(value)
  );
}

/** Reads attribution out of a URL's parameters. */
export function readAttribution(params: ParamReader): Attribution {
  const utm = UTM_KEYS.map((key) => {
    const value = params.get(key)?.trim();
    return value && isUtmValue(value) ? `${key}=${encodeURIComponent(value)}` : null;
  })
    .filter((part): part is string => part !== null)
    .join("&");

  let clickId: string | null = null;
  let clickKind: ClickKind | null = null;
  for (const kind of CLICK_KINDS) {
    const value = params.get(kind)?.trim();
    if (value && isClickId(value)) {
      clickId = value;
      clickKind = kind;
      break;
    }
  }

  return { source: utm || null, clickId, clickKind };
}

/**
 * What to store in `bookings.acquisition_source`.
 *
 * A click identifier with no UTM tags is what Google's auto-tagging alone
 * produces, and it still means exactly one thing: a paid Google click. Left
 * as null it would be filed as "Not recorded"; described here it folds into
 * "Google (campaign)" like any other tagged visit, so paid and organic search
 * never share a row on the admin page.
 */
export function acquisitionSourceFor(value: Attribution): string | null {
  if (value.source) return value.source;
  if (value.clickId) return "utm_source=google&utm_medium=cpc";
  return null;
}

/** The parameters to append to an internal link so the tag survives it. */
export function attributionQuery(value: Attribution): string {
  const parts: string[] = [];
  if (value.source) parts.push(value.source);
  if (value.clickId && value.clickKind) {
    parts.push(`${value.clickKind}=${encodeURIComponent(value.clickId)}`);
  }
  return parts.join("&");
}

/**
 * The visit's attribution, given what is in the URL now and what was stored
 * earlier in this tab.
 *
 * All-or-nothing, for the reason in the header comment: a fresh click must
 * never be described by an older campaign's tags.
 */
export function mergeAttribution(
  fromUrl: Attribution,
  stored: Attribution,
): Attribution {
  return hasAttribution(fromUrl) ? fromUrl : stored;
}

/** Round-trips through session storage, which only holds strings. */
export function serialiseAttribution(value: Attribution): string {
  return JSON.stringify(value);
}

export function parseAttribution(raw: string | null): Attribution {
  if (!raw) return NO_ATTRIBUTION;
  try {
    const parsed = JSON.parse(raw) as Partial<Attribution>;
    const clickId =
      typeof parsed.clickId === "string" && isClickId(parsed.clickId)
        ? parsed.clickId
        : null;
    const clickKind =
      clickId && CLICK_KINDS.includes(parsed.clickKind as ClickKind)
        ? (parsed.clickKind as ClickKind)
        : null;
    return {
      source:
        typeof parsed.source === "string" && isStoredSource(parsed.source)
          ? parsed.source
          : null,
      clickId: clickKind ? clickId : null,
      clickKind,
    };
  } catch {
    // Storage is shared with anything else on the origin and survives a
    // deploy that changed this shape. Unreadable means unattributed, not a
    // crash on the booking form.
    return NO_ATTRIBUTION;
  }
}

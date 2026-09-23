import "server-only";

import { SITE } from "@/lib/site";

/**
 * Which request headers we present to PayToday, and why that is a question at
 * all.
 *
 * Their API is built for browser callers, so a request from a page normally
 * carries an Origin and a Referer. Driving the SDK from a server sends
 * neither, and an earlier session guessed that the 403 at `initialize()` was
 * the missing Origin and started inventing one.
 *
 * That guess is undocumented — nothing in PayToday's guide describes an origin
 * or domain check — and it may well be the cause rather than the cure. An
 * Origin header is what makes a server call *look* like a cross-origin browser
 * call: it can switch on a CORS or domain check that a plain server-to-server
 * request never triggers. If the domain we announce is not registered with
 * them, and the domain registration is still outstanding, announcing it is
 * exactly how a recognised merchant gets a 403 that says "Authorization error"
 * with no reason after the colon.
 *
 * Worse, the value is not even reliably our own domain: `SITE.url` falls back
 * to the deployment's `*.vercel.app` host when `NEXT_PUBLIC_SITE_URL` is
 * unset, and that host could never be registered anywhere.
 *
 * So the headers are a named variant rather than a hard-coded guess, the
 * default is to send nothing we were not asked for, and the diagnostic tries
 * every variant in one run so the answer comes from evidence.
 */

export type HeaderVariant = {
  id: string;
  label: string;
  /** What the variant is testing, shown beside its result. */
  rationale: string;
  origin: string | null;
  referer: string | null;
  userAgent: string | null;
};

/**
 * The site's own origin. Injectable so the variants can be built for a given
 * host without reloading the module — `SITE.url` is frozen at import, and a
 * test that had to re-import to change it was testing the module loader.
 */
function siteOrigin(override?: string): string {
  return (override ?? SITE.url).replace(/\/+$/, "");
}

/** The apex form of the site origin: www.example.com -> example.com. */
function apexOrigin(override?: string): string {
  return siteOrigin(override).replace("://www.", "://");
}

/** The www form, which is what a merchant portal often has on file. */
function wwwOrigin(override?: string): string {
  const origin = siteOrigin(override);
  return origin.includes("://www.") ? origin : origin.replace("://", "://www.");
}

/**
 * A real browser's User-Agent. Some edges reject an unrecognised one outright,
 * and ours announces itself as a script.
 */
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

export function headerVariants(origin?: string): HeaderVariant[] {
  // Deduplicated on what actually reaches the wire. When the site URL already
  // carries www, the "site" and "www" variants are the same request, and
  // trying it twice spends a second failed authentication against a live
  // merchant account to learn nothing.
  const seen = new Set<string>();
  return allVariants(origin).filter((v) => {
    const key = `${v.origin ?? ""}|${v.referer ?? ""}|${v.userAgent ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function allVariants(origin?: string): HeaderVariant[] {
  return [
    {
      id: "none",
      label: "Nothing extra",
      rationale:
        "A plain server-to-server call. If this is the one that works, the " +
        "Origin we invented was the cause rather than the cure.",
      origin: null,
      referer: null,
      userAgent: null,
    },
    {
      id: "site",
      label: `Origin: ${siteOrigin(origin)}`,
      rationale:
        "What the site has been sending since the guess was made. Note that " +
        "this is SITE.url, which is a vercel.app host unless " +
        "NEXT_PUBLIC_SITE_URL is set.",
      origin: siteOrigin(origin),
      referer: `${siteOrigin(origin)}/`,
      userAgent: null,
    },
    {
      id: "apex",
      label: `Origin: ${apexOrigin(origin)}`,
      rationale:
        "The apex form. A portal holding the bare domain would reject the " +
        "www one, and the other way round.",
      origin: apexOrigin(origin),
      referer: `${apexOrigin(origin)}/`,
      userAgent: null,
    },
    {
      id: "www",
      label: `Origin: ${wwwOrigin(origin)}`,
      rationale: "The www form, for the same reason in reverse.",
      origin: wwwOrigin(origin),
      referer: `${wwwOrigin(origin)}/`,
      userAgent: null,
    },
    {
      id: "browser",
      label: "Browser User-Agent, no Origin",
      rationale:
        "Tests whether the edge is refusing the caller rather than the " +
        "domain — our User-Agent announces itself as a script.",
      origin: null,
      referer: null,
      userAgent: BROWSER_UA,
    },
  ];
}

/**
 * The variant the live payment path uses.
 *
 * Defaults to sending nothing, because that is what their guide actually
 * describes and because the invented Origin is the leading suspect. Set
 * PAYTODAY_HEADER_VARIANT to whichever the probe shows works.
 */
export function activeVariant(): HeaderVariant {
  const wanted = process.env.PAYTODAY_HEADER_VARIANT?.trim().toLowerCase();
  const variants = headerVariants();
  return variants.find((v) => v.id === wanted) ?? variants[0];
}

/** Applies a variant to an outgoing request, without overwriting the SDK's own. */
export function applyVariant(headers: Headers, variant: HeaderVariant): void {
  if (variant.origin && !headers.has("origin")) {
    headers.set("Origin", variant.origin);
  }
  if (variant.referer && !headers.has("referer")) {
    headers.set("Referer", variant.referer);
  }
  if (variant.userAgent) {
    headers.set("User-Agent", variant.userAgent);
  }
}

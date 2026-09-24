/**
 * What `acquisition_source` actually means, folded into channels an operator
 * can act on.
 *
 * The column has been filled since the first booking, and it is the only
 * answer we have ever had to "where did this customer come from". But it
 * stores whatever the browser gave us, so the raw values look like this:
 *
 *   direct
 *   referrer:www.google.com
 *   referrer:com.google.android.gm
 *   utm_source=facebook&utm_medium=cpc&utm_campaign=arrivals
 *   admin-quote
 *   (null, for a row written before the field existed)
 *
 * Counting those verbatim gives a list where Google appears four times under
 * four hostnames and nothing adds up. So the folding happens here, in one
 * tested function, rather than in a SQL CASE nobody can exercise or in the
 * page that draws the bars.
 *
 * Two decisions worth keeping:
 *
 * A UTM tag always wins over the referrer. If a campaign was tagged, the
 * campaign is the answer, and the referrer is just whichever host the ad
 * happened to render on.
 *
 * An unrecognised referrer keeps its host instead of being swept into
 * "Other". The whole point is to discover channels we did not know about —
 * a lodge that started linking to us, a forum thread — and a bucket labelled
 * Other is where that discovery goes to die.
 */

export type Channel = {
  /** Stable id, used as a React key and in tests. */
  id: string;
  /** What an operator reads. */
  label: string;
  /**
   * The rough family, so the page can group without re-parsing. `unknown` is
   * kept apart from `direct` deliberately: "we have no idea" and "they typed
   * the domain in" are different facts, and merging them flatters us.
   */
  kind: "search" | "social" | "referral" | "direct" | "internal" | "unknown";
};

const UNKNOWN: Channel = { id: "unknown", label: "Not recorded", kind: "unknown" };
const DIRECT: Channel = { id: "direct", label: "Direct or typed in", kind: "direct" };

/**
 * Does `host` belong to `name` as its registrable domain?
 *
 * One search engine reaches us under many hostnames — google.com,
 * www.google.com, google.com.na, google.co.za — so equality is useless. But
 * the obvious loosening is worse: a pattern of `(^|\.)google\.` also matches
 * `google.namibiasafaris.com`, which is a subdomain on a host somebody else
 * controls, and would credit them to Google. The test suite caught exactly
 * that, which is why this is a function rather than a regex per entry.
 *
 * So: find the label, and require everything after it to look like a public
 * suffix. Approximated as "every remaining label is short", which separates
 * `com.na` and `co.za` from `namibiasafaris.com`. A real public-suffix list
 * is a dependency an admin chart does not earn.
 */
function registrableIs(host: string, name: string): boolean {
  const labels = host.split(".");
  const index = labels.lastIndexOf(name);
  if (index === -1) return false;

  const suffix = labels.slice(index + 1);
  return suffix.length > 0 && suffix.every((label) => label.length <= 3);
}

/** Hosts we recognise, matched on the registrable domain. */
const KNOWN: { test: (host: string) => boolean; channel: Channel }[] = [
  {
    // The Gmail Android client reports a package name, not a hostname.
    test: (h) => registrableIs(h, "google") || h === "com.google.android.gm",
    channel: { id: "google", label: "Google", kind: "search" },
  },
  {
    test: (h) => registrableIs(h, "bing"),
    channel: { id: "bing", label: "Bing", kind: "search" },
  },
  {
    test: (h) => registrableIs(h, "duckduckgo"),
    channel: { id: "duckduckgo", label: "DuckDuckGo", kind: "search" },
  },
  {
    // l.facebook.com and m.facebook.com are the link shim and the mobile web
    // app; both are Facebook.
    test: (h) => registrableIs(h, "facebook") || h === "fb.me",
    channel: { id: "facebook", label: "Facebook", kind: "social" },
  },
  {
    test: (h) => registrableIs(h, "instagram"),
    channel: { id: "instagram", label: "Instagram", kind: "social" },
  },
  {
    // The channel the business actually runs on, and the one most likely to
    // be undercounted: WhatsApp strips the referrer on many clients, so these
    // rows are a floor rather than a count.
    test: (h) => registrableIs(h, "whatsapp"),
    channel: { id: "whatsapp", label: "WhatsApp", kind: "social" },
  },
  {
    test: (h) =>
      registrableIs(h, "x") || registrableIs(h, "twitter") || h === "t.co",
    channel: { id: "x", label: "X", kind: "social" },
  },
  {
    test: (h) => registrableIs(h, "linkedin") || h === "lnkd.in",
    channel: { id: "linkedin", label: "LinkedIn", kind: "social" },
  },
  {
    test: (h) => registrableIs(h, "tripadvisor"),
    channel: { id: "tripadvisor", label: "Tripadvisor", kind: "referral" },
  },
];

/** A UTM source we recognise gets the same label as its referrer would. */
function fromUtmSource(source: string): Channel {
  const normalised = source.trim().toLowerCase();
  const known = KNOWN.find((entry) => entry.channel.id === normalised);
  if (known) {
    // Distinct id AND distinct label. Keeping the id separate stops paid and
    // organic sharing a row; keeping the label the same put "Facebook 1" above
    // "Facebook 1" on the admin page, which is worse than merging them — the
    // operator sees a duplicate rather than a distinction. Found by looking at
    // the rendered page, not by a test.
    return {
      ...known.channel,
      id: `utm:${known.channel.id}`,
      label: `${known.channel.label} (campaign)`,
    };
  }

  return {
    id: `utm:${normalised}`,
    // Named as a campaign rather than merged into the organic channel of the
    // same name: money spent and traffic earned must never share a row.
    label: `Campaign: ${source.trim()}`,
    kind: "referral",
  };
}

/** Folds one stored `acquisition_source` into the channel it belongs to. */
export function channelOf(raw: string | null | undefined): Channel {
  const value = raw?.trim();
  if (!value) return UNKNOWN;

  // A tagged campaign is the answer whatever host it arrived from.
  const utm = /(?:^|&)utm_source=([^&]+)/i.exec(value);
  if (utm) {
    try {
      return fromUtmSource(decodeURIComponent(utm[1].replace(/\+/g, " ")));
    } catch {
      return fromUtmSource(utm[1]);
    }
  }

  if (value.startsWith("admin-")) {
    return {
      id: value,
      // Not a marketing channel at all: we made the quote. Counting these as
      // acquisition would make the site look like it is working when the
      // work was a phone call.
      label: value === "admin-itinerary" ? "Quoted by us (itinerary)" : "Quoted by us",
      kind: "internal",
    };
  }

  if (value.toLowerCase() === "direct") return DIRECT;

  if (value.startsWith("referrer:")) {
    const host = value.slice("referrer:".length).trim().toLowerCase();
    if (!host) return UNKNOWN;

    const known = KNOWN.find((entry) => entry.test(host));
    if (known) return known.channel;

    // Kept as itself — see the note at the top about why there is no "Other".
    return {
      id: `referrer:${host}`,
      label: host.replace(/^www\./, ""),
      kind: "referral",
    };
  }

  // Anything else was written by an older version of the form or by hand.
  return { id: `raw:${value}`, label: value, kind: "referral" };
}

export type ChannelTotal = {
  channel: Channel;
  bookings: number;
  /** Decimal string, summed in Postgres. */
  revenue: string;
};

/**
 * Folds raw per-source rows into per-channel totals, biggest first.
 *
 * Takes rows already aggregated by Postgres rather than a list of bookings:
 * the distinct-source cardinality is tiny even with thousands of bookings, so
 * this collapses a handful of rows rather than scanning a truncated page.
 */
export function foldChannels(
  rows: { source: string | null; bookings: number; revenue: string }[],
): ChannelTotal[] {
  const totals = new Map<string, ChannelTotal>();

  for (const row of rows) {
    const channel = channelOf(row.source);
    const existing = totals.get(channel.id);
    if (existing) {
      existing.bookings += row.bookings;
      existing.revenue = (
        Number(existing.revenue) + Number(row.revenue)
      ).toFixed(2);
      continue;
    }
    totals.set(channel.id, {
      channel,
      bookings: row.bookings,
      revenue: Number(row.revenue).toFixed(2),
    });
  }

  return [...totals.values()].sort(
    (a, b) => b.bookings - a.bookings || a.channel.label.localeCompare(b.channel.label),
  );
}

/**
 * How much of this we can actually believe.
 *
 * Referrers go missing for ordinary reasons — a link opened from WhatsApp or
 * an email client, a browser stripping it, a privacy extension — and those
 * land in "Not recorded" or get flattered into "Direct". An operator reading
 * a chart needs to know what share of it is a guess before they make a
 * decision with it, so the page states this rather than drawing a clean pie
 * and letting it look authoritative.
 */
export function attributionConfidence(totals: ChannelTotal[]): {
  attributed: number;
  /** Bookings that could have come from the site — internal quotes excluded. */
  total: number;
  /** Quotes we made ourselves, reported separately rather than hidden. */
  internal: number;
  /** Share of site bookings whose channel is genuinely known, 0–100. */
  percent: number;
} {
  const count = (predicate: (t: ChannelTotal) => boolean) =>
    totals.filter(predicate).reduce((sum, t) => sum + t.bookings, 0);

  // A quote we typed in the admin panel never travelled through the website,
  // so it belongs in neither half of this fraction. Counting it as
  // unattributed would invent a measurement problem that does not exist;
  // counting it as attributed — which this did until the tests caught it —
  // would credit the site with work that was a phone call.
  const internal = count((t) => t.channel.kind === "internal");
  const total = count((t) => t.channel.kind !== "internal");
  const attributed = count(
    (t) =>
      t.channel.kind !== "internal" &&
      t.channel.kind !== "unknown" &&
      t.channel.kind !== "direct",
  );

  return {
    attributed,
    total,
    internal,
    percent: total > 0 ? (attributed / total) * 100 : 0,
  };
}

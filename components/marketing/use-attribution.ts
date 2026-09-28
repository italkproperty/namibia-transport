"use client";

import * as React from "react";

import {
  mergeAttribution,
  NO_ATTRIBUTION,
  parseAttribution,
  readAttribution,
  serialiseAttribution,
  hasAttribution,
  type Attribution,
} from "@/lib/marketing/attribution";

const KEY = "nt.attribution";

/**
 * The campaign this visit belongs to, for however long the tab is open.
 *
 * Reads the current URL first, falls back to what an earlier page in this tab
 * stored, and writes back whenever the URL has something new. Session storage
 * rather than a cookie: it is first-party, it is per tab, it dies when the tab
 * does, and it is never sent anywhere except as a field on a booking the
 * traveller chose to submit — so it is not the kind of storage a consent
 * banner exists for.
 *
 * Every access is wrapped. Safari in private mode throws on `sessionStorage`
 * rather than returning null, and a booking form that crashes because storage
 * is disabled would cost far more than the attribution is worth.
 */
export function useAttribution(): Attribution {
  const [value, setValue] = React.useState<Attribution>(NO_ATTRIBUTION);

  React.useEffect(() => {
    const fromUrl = readAttribution(new URLSearchParams(window.location.search));

    let stored = NO_ATTRIBUTION;
    try {
      stored = parseAttribution(window.sessionStorage.getItem(KEY));
    } catch {
      // Storage unavailable. The URL is still authoritative for this page.
    }

    const resolved = mergeAttribution(fromUrl, stored);
    setValue(resolved);

    if (hasAttribution(fromUrl)) {
      try {
        window.sessionStorage.setItem(KEY, serialiseAttribution(fromUrl));
      } catch {
        // Nothing to do — the tag still reaches the form on this page, it
        // just will not survive the visitor wandering off it.
      }
    }
  }, []);

  return value;
}

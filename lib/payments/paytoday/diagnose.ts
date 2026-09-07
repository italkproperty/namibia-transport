import "server-only";

import { SITE } from "@/lib/site";

import { getPayTodayConfig, selectedPaymentProvider } from "./config";
import { getPayTodaySdk, resetPayTodaySdk } from "./sdk";

/**
 * A read-only probe of the PayToday integration, for when their support desk
 * asks "what exactly is failing?" and "it returns 403" is not an answer.
 *
 * It creates nothing and charges nothing. The SDK authenticates before it will
 * answer any call, so querying a payment intent that cannot exist reaches the
 * authentication step — the one that has been returning 403 — and stops there.
 * A real intent is never created, which matters because PayToday has no
 * sandbox and every intent is live money.
 *
 * Nothing here returns a key. The point is to hand the operator a status code,
 * a response body and the exact Origin we present, so the conversation with
 * the gateway can be about evidence.
 */

/** Cannot match a real intent: PayToday tokens are opaque and far longer. */
const IMPOSSIBLE_TOKEN = "namibia-transport-connectivity-probe";

export type PayTodayDiagnosis = {
  /** Which adapter the site is actually using right now. */
  provider: "paytoday" | "stub";
  configured: boolean;
  /** Which credentials are present. Never their values. */
  keys: { shopKey: boolean; shopHandle: boolean; privateKey: boolean };
  /** The Origin and Referer the server presents to PayToday. */
  origin: string;
  sdkUrl: string;
  /** Did the SDK source load and evaluate at all? */
  sdkLoaded: boolean;
  /** What came back from the authenticated call. */
  outcome: "ok" | "failed" | "not-configured";
  detail: string;
};

export async function diagnosePayToday(): Promise<PayTodayDiagnosis> {
  const config = getPayTodayConfig();
  const base: Omit<PayTodayDiagnosis, "outcome" | "detail" | "sdkLoaded"> = {
    provider: selectedPaymentProvider(),
    configured: config !== null,
    keys: {
      shopKey: Boolean(process.env.PAYTODAY_SHOP_KEY?.trim()),
      shopHandle: Boolean(process.env.PAYTODAY_SHOP_HANDLE?.trim()),
      privateKey: Boolean(process.env.PAYTODAY_PRIVATE_KEY?.trim()),
    },
    origin: SITE.url.replace(/\/+$/, ""),
    sdkUrl: config?.sdkUrl ?? "",
  };

  if (!config) {
    return {
      ...base,
      sdkLoaded: false,
      outcome: "not-configured",
      detail:
        "PAYTODAY_SHOP_KEY, PAYTODAY_SHOP_HANDLE and PAYTODAY_PRIVATE_KEY must all be set on this deployment. The guide is explicit that the private key alone is not functional.",
    };
  }

  // A stale cached instance would report yesterday's outcome.
  resetPayTodaySdk();

  let sdkLoaded = false;
  try {
    const sdk = await getPayTodaySdk();
    sdkLoaded = true;

    await sdk.queryPaymentIntent(IMPOSSIBLE_TOKEN);

    // An answer at all means authentication succeeded — whatever it says about
    // a token that was never real.
    return {
      ...base,
      sdkLoaded,
      outcome: "ok",
      detail:
        "Authenticated successfully and the query was answered. The 403 is not reproducing: payments should work.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // A rejection naming the probe token is authentication working correctly
    // and the lookup failing, which is the expected healthy answer.
    const looksLikeNotFound =
      /not\s*found|invalid\s*token|no\s*(such|record)|does\s*not\s*exist/i.test(
        message,
      );

    return {
      ...base,
      sdkLoaded,
      outcome: looksLikeNotFound ? "ok" : "failed",
      detail: looksLikeNotFound
        ? `Authenticated. PayToday rejected the deliberately invalid probe token, which is the correct answer: "${message}"`
        : message,
    };
  }
}

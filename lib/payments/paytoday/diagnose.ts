import "server-only";

import { getPayTodayConfig, selectedPaymentProvider } from "./config";
import { activeVariant, headerVariants } from "./headers";
import {
  getPayTodaySdk,
  lastPayTodayFailure,
  loadPayTodayConstructor,
  probeVariant,
  resetPayTodaySdk,
  type PayTodayFailure,
  type ProbeResult,
} from "./sdk";

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
  /** The header variant the live payment path is using. */
  variant: { id: string; label: string };
  sdkUrl: string;
  /** Did the SDK source load and evaluate at all? */
  sdkLoaded: boolean;
  /** What came back from the authenticated call. */
  outcome: "ok" | "failed" | "not-configured";
  detail: string;
  /**
   * The raw refusal, when there was one — the status, endpoint and body that
   * a support conversation actually needs. The SDK reports a failed
   * initialise() as a bare `false`, so this is the only place the real
   * response survives.
   */
  failure: PayTodayFailure | null;
};

export async function diagnosePayToday(): Promise<PayTodayDiagnosis> {
  const config = getPayTodayConfig();
  const base: Omit<
    PayTodayDiagnosis,
    "outcome" | "detail" | "sdkLoaded" | "failure"
  > = {
    provider: selectedPaymentProvider(),
    configured: config !== null,
    keys: {
      shopKey: Boolean(process.env.PAYTODAY_SHOP_KEY?.trim()),
      shopHandle: Boolean(process.env.PAYTODAY_SHOP_HANDLE?.trim()),
      privateKey: Boolean(process.env.PAYTODAY_PRIVATE_KEY?.trim()),
    },
    variant: { id: activeVariant().id, label: activeVariant().label },
    sdkUrl: config?.sdkUrl ?? "",
  };

  if (!config) {
    return {
      ...base,
      sdkLoaded: false,
      failure: null,
      outcome: "not-configured",
      detail:
        "PAYTODAY_SHOP_KEY, PAYTODAY_SHOP_HANDLE and PAYTODAY_PRIVATE_KEY must all be set on this deployment. The guide is explicit that the private key alone is not functional.",
    };
  }

  // A stale cached instance would report yesterday's outcome.
  resetPayTodaySdk();

  // Answered before authentication is attempted, because those are separate
  // failures and only one of them is PayToday's script. `getPayTodaySdk()`
  // throws on a refused initialize(), so setting this after it returned meant
  // a 403 was reported as "SDK loaded: no" — about an SDK that had loaded and
  // made the very request that came back 403.
  let sdkLoaded = false;
  try {
    await loadPayTodayConstructor();
    sdkLoaded = true;
  } catch {
    // Left false, and the real message comes out of the attempt below.
  }

  try {
    const sdk = await getPayTodaySdk();

    await sdk.queryPaymentIntent(IMPOSSIBLE_TOKEN);

    // An answer at all means authentication succeeded — whatever it says about
    // a token that was never real.
    return {
      ...base,
      sdkLoaded,
      failure: null,
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
      failure: looksLikeNotFound ? null : lastPayTodayFailure(),
      outcome: looksLikeNotFound ? "ok" : "failed",
      detail: looksLikeNotFound
        ? `Authenticated. PayToday rejected the deliberately invalid probe token, which is the correct answer: "${message}"`
        : message,
    };
  }
}

/**
 * Every header variant, tried once, so the answer comes from evidence rather
 * than from another guess.
 *
 * The 403 has stood for a month against credentials PayToday's own support
 * says are correct on their side. Both things can be true: the merchant
 * account is fine *and* the request is being refused, if the request announces
 * a domain their edge does not recognise. We invented that Origin header —
 * nothing in their guide asks for it — so the first thing worth knowing is
 * whether sending nothing at all is what works.
 *
 * Sequential rather than parallel. Five simultaneous failed authentications
 * from one IP is what rate limiting is for, and a throttled probe would answer
 * a different question from the one asked.
 *
 * Creates nothing and charges nothing: `initialize()` only authenticates.
 */
export type PayTodayProbeMatrix = {
  ran: boolean;
  reason: string;
  results: ProbeResult[];
  /** The first variant that authenticated, if any. */
  winner: ProbeResult | null;
  /**
   * True when at least one attempt actually reached PayToday. If nothing did,
   * the run says nothing about headers and the operator should be told that
   * rather than shown five apparent refusals.
   */
  anyReached: boolean;
  active: string;
};

export async function probeHeaderVariants(): Promise<PayTodayProbeMatrix> {
  const config = getPayTodayConfig();
  if (!config) {
    return {
      ran: false,
      reason:
        "PayToday is not configured on this deployment, so there is nothing to probe.",
      results: [],
      winner: null,
      anyReached: false,
      active: activeVariant().id,
    };
  }

  const results: ProbeResult[] = [];
  for (const variant of headerVariants()) {
    results.push(await probeVariant(variant));
    // A winning variant answers the question; the rest would only add failed
    // authentications against a live merchant account.
    if (results[results.length - 1].ok) break;
  }

  // Whatever the probes did to the module-level caches, the payment path must
  // start clean afterwards.
  resetPayTodaySdk();

  return {
    ran: true,
    reason: "",
    results,
    winner: results.find((r) => r.ok) ?? null,
    anyReached: results.some((r) => r.reached),
    active: activeVariant().id,
  };
}

import "server-only";

/**
 * PayToday credentials and knobs, read once from the environment.
 *
 * The three keys are secrets and stay on the server. PayToday's own guide is
 * self-contradictory here: its React sample puts the private key in a
 * `REACT_APP_*` variable (i.e. in the browser bundle), while §3.3 of the same
 * document says "Keys should never be exposed in client-side code" and the
 * Payment Intent Query guide repeats "These credentials should NEVER be
 * hardcoded in frontend code". We follow the disclaimer, not the sample: the
 * SDK is loaded and driven server-side, and no PayToday key is ever sent to a
 * browser. Note the deliberate absence of a NEXT_PUBLIC_ prefix below — that
 * is what enforces it.
 */
export type PayTodayConfig = {
  shopKey: string;
  shopHandle: string;
  privateKey: string;
  environment: string;
  /** Where to load the browser SDK from, or a vendored copy on disk. */
  sdkUrl: string;
  sdkPath: string | null;
  /** Optional hex SHA-256 of the SDK source, pinned by the operator. */
  sdkSha256: string | null;
};

export const PAYTODAY_SDK_URL =
  "https://nedbankstorage.blob.core.windows.net/nedbankclouddatadisk/staticazure/web/sdk/paytoday-sdk.js";

/** Payment intents are valid for 30 minutes (Developer Guide §2.3). */
export const INTENT_TTL_MS = 30 * 60 * 1000;

function read(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function getPayTodayConfig(): PayTodayConfig | null {
  const shopKey = read("PAYTODAY_SHOP_KEY");
  const shopHandle = read("PAYTODAY_SHOP_HANDLE");
  const privateKey = read("PAYTODAY_PRIVATE_KEY");

  // All three or none: the guide is explicit that the private key alone is not
  // functional and only works alongside the shop key and handle.
  if (!shopKey || !shopHandle || !privateKey) return null;

  return {
    shopKey,
    shopHandle,
    privateKey,
    environment: read("PAYTODAY_ENVIRONMENT") ?? "production",
    sdkUrl: read("PAYTODAY_SDK_URL") ?? PAYTODAY_SDK_URL,
    sdkPath: read("PAYTODAY_SDK_PATH"),
    sdkSha256: read("PAYTODAY_SDK_SHA256")?.toLowerCase() ?? null,
  };
}

export function isPayTodayConfigured(): boolean {
  return getPayTodayConfig() !== null;
}

/**
 * Which adapter the app should use. Defaults to the stub so a missing key
 * never silently downgrades a live site into taking bookings it cannot
 * charge — set PAYMENT_PROVIDER=paytoday deliberately.
 */
export function selectedPaymentProvider(): "paytoday" | "stub" {
  return read("PAYMENT_PROVIDER")?.toLowerCase() === "paytoday"
    ? "paytoday"
    : "stub";
}

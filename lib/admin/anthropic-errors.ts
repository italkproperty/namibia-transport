import "server-only";

/**
 * What to tell an operator when Anthropic answers 401.
 *
 * The first version of this message said "check ANTHROPIC_API_KEY_TRANSPORT in
 * Vercel", and it sent the operator to confirm a variable that was present all
 * along. A 401 with "invalid x-api-key" means the value reached Anthropic and
 * was refused — the key was deleted or disabled in the Console, or saved with
 * stray characters — so the fix is a new key, not a check for presence. Say
 * Anthropic's own reason and the fix, and carry the request id so support can
 * find it.
 */
export function anthropicKeyRefusedMessage(reason: string, requestId: string | null): string {
  return (
    `Anthropic refused the API key (${reason}). ANTHROPIC_API_KEY_TRANSPORT is set in Vercel, so the value itself is no longer accepted: ` +
    "the key was deleted or disabled in the Anthropic Console, or saved with stray characters. " +
    "Create a new key at console.anthropic.com, replace the Production value in Vercel, and redeploy." +
    (requestId ? ` Reference ${requestId}.` : "")
  );
}

/** Anthropic's own reason from an error body — a string or parsed JSON — or a fallback. */
export function anthropicErrorReason(body: unknown, fallback = "HTTP 401"): string {
  let parsed: unknown = body;
  if (typeof body === "string") {
    try {
      parsed = JSON.parse(body);
    } catch {
      return body.trim() ? body.slice(0, 120) : fallback;
    }
  }
  if (typeof parsed === "object" && parsed !== null && "error" in parsed) {
    const error = (parsed as { error?: { message?: unknown } }).error;
    if (typeof error?.message === "string") return error.message;
  }
  return fallback;
}

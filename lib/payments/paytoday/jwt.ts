/**
 * PayToday answers with a signed JWT even when it is refusing, so the reason
 * a payment failed is base64 inside the token rather than anywhere a reader
 * can see it. A 403 body reads as `{"token": "eyJhbGci..."}` and the useful
 * part — `status: unauthorized`, and whatever they put in `error` — is two
 * layers in.
 *
 * The signature is deliberately not verified: this is decoded to show an
 * operator what the gateway said, never to decide anything. Treat the result
 * as a message from a third party, which is what it is.
 */
export function decodeJwtPayload(body: string): string | null {
  const match = body.match(/[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]*/);
  if (!match) return null;

  try {
    const segment = match[1];
    const padded = segment + "=".repeat((4 - (segment.length % 4)) % 4);
    const json = Buffer.from(padded, "base64url").toString("utf8");
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return null;
  }
}

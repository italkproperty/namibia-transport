import { randomInt } from "node:crypto";

/**
 * Reference codes are read aloud over WhatsApp and copied by hand, so the
 * alphabet drops every character that can be misheard or mistyped: no O/0,
 * no I/1, no S/5.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRTUVWXY2346789";

export function generateBookingRef(): string {
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return `NT-${code}`;
}

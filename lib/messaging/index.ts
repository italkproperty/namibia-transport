import { readSmtpConfig, SmtpMessenger } from "./smtp";
import { StubMessenger } from "./stub";
import type { Messenger } from "./types";

export * from "./types";
export * from "./templates";
export { StubMessenger } from "./stub";

let messenger: Messenger | undefined;

/**
 * Single entry point for outbound customer comms.
 *
 * The stub stays the default and is chosen by silence, not by accident: SMTP
 * is selected explicitly with MESSENGER_PROVIDER=smtp, and even then only if
 * the credentials are actually present. A half-configured environment logs
 * loudly and keeps stubbing rather than throwing inside a booking — nobody
 * should lose a trip because a mail password is missing.
 *
 * WhatsApp (Meta Cloud API) lands behind this same interface, and becomes the
 * primary channel when it does. Email is the backup.
 */
export function getMessenger(): Messenger {
  if (messenger) return messenger;

  if (process.env.MESSENGER_PROVIDER?.trim() === "smtp") {
    const config = readSmtpConfig();
    if (config) {
      messenger = new SmtpMessenger(config);
      return messenger;
    }
    console.warn(
      "[messaging] MESSENGER_PROVIDER=smtp but SMTP_HOST, SMTP_USER, SMTP_PASSWORD or MAIL_FROM is missing — falling back to the stub.",
    );
  }

  messenger = new StubMessenger();
  return messenger;
}

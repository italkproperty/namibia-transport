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

  const provider = process.env.MESSENGER_PROVIDER?.trim();
  const config = readSmtpConfig();

  // Prefer real email whenever SMTP credentials are configured. Requiring a
  // separate provider flag made a fully configured mailbox silently use the
  // logging-only stub when that one flag was missing.
  if ((provider === "smtp" || !provider) && config) {
    messenger = new SmtpMessenger(config);
    return messenger;
  }

  if (provider === "smtp" && !config) {
    console.error(
      "[messaging] MESSENGER_PROVIDER=smtp but SMTP_HOST, SMTP_USER, SMTP_PASSWORD or MAIL_FROM is missing — email is disabled.",
    );
  } else if (!provider && !config) {
    console.error(
      "[messaging] No SMTP credentials are configured; booking emails will not be sent. Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD and MAIL_FROM in Vercel.",
    );
  }

  messenger = new StubMessenger();
  return messenger;
}

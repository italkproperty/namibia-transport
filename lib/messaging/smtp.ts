import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

import type { Messenger, SendMessageInput, SendMessageResult } from "./types";

/**
 * Email over SMTP.
 *
 * SMTP rather than a transactional API because the mailbox already exists:
 * bookings@namibiatransport.com is on Spacemail with SPF and DKIM already
 * published for the domain, so this needs credentials and nothing else — no
 * new vendor, no second domain verification, no waiting on DNS. A Resend or
 * Postmark implementation slots in behind the same `Messenger` interface the
 * day the volume justifies one.
 *
 * The transporter is created once and reused: on a warm serverless instance
 * that keeps the TCP and TLS handshake out of the request.
 */

export type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  /** Envelope and header From, e.g. "Namibia Transport <bookings@…>". */
  from: string;
  /** Where a traveller's reply lands, if different from `from`. */
  replyTo?: string;
};

/**
 * Makes a From header out of whatever was put in the environment variable.
 *
 * Production rejected every confirmation email for weeks with
 * `553 Sender address rejected: not owned by user` against an address of
 * `<Namibia Transport  bookings@namibiatransport.com>` — the display name and
 * the address run together inside one pair of brackets. That is what
 * nodemailer does with `Namibia Transport bookings@…`: with no angle brackets
 * to tell it where the name stops, it treats the whole string as the address.
 * Somebody pasted the value into a hosting dashboard without them, which is an
 * easy thing to do and an invisible thing to have done — the booking still
 * saves, the traveller just never hears from us, and the only evidence is a
 * line in a log nobody reads.
 *
 * So the address is found by pattern and the header rebuilt around it. An
 * already-correct value comes back unchanged.
 */
export function normaliseFrom(raw: string, fallback: string): string {
  const value = raw.trim();

  // Already well formed: a display name, then the address in angle brackets.
  if (/<[^<>@\s]+@[^<>@\s]+>\s*$/.test(value)) return value;

  const match = value.match(/[^<>@\s,;:"]+@[^<>@\s,;:"]+\.[^<>@\s,;:"]+/);
  if (!match) {
    console.error(
      `[messaging] MAIL_FROM does not contain an email address (${value || "empty"}) — falling back to ${fallback}.`,
    );
    return fallback;
  }

  const address = match[0];
  const name = value.slice(0, match.index).replace(/[<>"]/g, "").trim();

  // A bare address is fine and needs no comment. A display name sitting loose
  // beside one is the misconfiguration that silently stopped the mail.
  if (name) {
    console.warn(
      `[messaging] MAIL_FROM was missing its angle brackets and has been rewritten as "${name}" <${address}>. ` +
        `Set it in the environment as: ${name} <${address}>`,
    );
    return `"${name}" <${address}>`;
  }

  return address;
}

export function readSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD?.trim();
  const raw = process.env.MAIL_FROM?.trim() || user;

  if (!host || !user || !password || !raw) return null;

  return {
    host,
    port: Number(process.env.SMTP_PORT?.trim() || 587),
    user,
    password,
    from: normaliseFrom(raw, user),
    replyTo: process.env.MAIL_REPLY_TO?.trim() || undefined,
  };
}

export class SmtpMessenger implements Messenger {
  readonly name = "smtp";
  private transporter: Transporter | undefined;

  constructor(private readonly config: SmtpConfig) {}

  private get transport(): Transporter {
    this.transporter ??= nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      // 465 is implicit TLS; 587 negotiates STARTTLS. Never plaintext.
      secure: this.config.port === 465,
      requireTLS: this.config.port !== 465,
      auth: { user: this.config.user, pass: this.config.password },
    });
    return this.transporter;
  }

  async send(input: SendMessageInput): Promise<SendMessageResult> {
    // WhatsApp is not this adapter's job. Saying so in the log beats silently
    // dropping the message and beats pretending it was delivered.
    if (input.channel !== "email") {
      console.info(
        `[messaging:smtp] ignoring a ${input.channel} message — this adapter sends email only`,
      );
      return {
        provider: this.name,
        channel: input.channel,
        messageId: `smtp_skipped_${Date.now().toString(36)}`,
        delivered: false,
      };
    }

    const to = input.to.email?.trim();
    if (!to) {
      return {
        provider: this.name,
        channel: "email",
        messageId: `smtp_noaddress_${Date.now().toString(36)}`,
        delivered: false,
      };
    }

    const info = await this.transport.sendMail({
      from: this.config.from,
      to: input.to.fullName ? `${input.to.fullName} <${to}>` : to,
      replyTo: this.config.replyTo,
      subject: input.subject ?? "Your booking",
      text: input.body,
      html: input.html,
    });

    return {
      provider: this.name,
      channel: "email",
      messageId: info.messageId,
      delivered: true,
    };
  }
}

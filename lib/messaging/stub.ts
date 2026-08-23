import type { Messenger, SendMessageInput, SendMessageResult } from "./types";

/**
 * Logs what would be sent. Replaced by WhatsApp (Meta Cloud API) and Resend
 * once those accounts exist — WhatsApp is the primary channel, email backup.
 */
export class StubMessenger implements Messenger {
  readonly name = "stub";

  async send(input: SendMessageInput): Promise<SendMessageResult> {
    const address =
      input.channel === "whatsapp" ? input.to.whatsapp : input.to.email;

    console.info(
      [
        `[messaging:stub] would send via ${input.channel} to ${address ?? "(no address)"}`,
        input.template ? `template=${input.template}` : null,
        input.subject ? `subject=${input.subject}` : null,
        `body=${input.body}`,
      ]
        .filter(Boolean)
        .join(" | ")
    );

    return {
      provider: this.name,
      channel: input.channel,
      messageId: `stub_${Date.now().toString(36)}`,
      delivered: false,
    };
  }
}

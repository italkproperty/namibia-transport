export type MessageChannel = "whatsapp" | "email";

export type MessageRecipient = {
  fullName?: string | null;
  /** E.164, e.g. +264811234567. */
  whatsapp?: string | null;
  email?: string | null;
};

export type SendMessageInput = {
  to: MessageRecipient;
  /** Preferred channel; adapters may fall back if the address is missing. */
  channel: MessageChannel;
  /** Meta-approved template name, once WhatsApp is live. */
  template?: string;
  /** Values the template interpolates. */
  variables?: Record<string, string>;
  /** Plain-text body, used by email and as the WhatsApp fallback. */
  body: string;
  subject?: string;
};

export type SendMessageResult = {
  provider: string;
  channel: MessageChannel;
  /** Provider-side message id, or a synthetic one while stubbed. */
  messageId: string;
  delivered: boolean;
};

export interface Messenger {
  readonly name: string;
  send(input: SendMessageInput): Promise<SendMessageResult>;
}

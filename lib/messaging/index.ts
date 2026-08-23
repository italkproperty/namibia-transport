import { StubMessenger } from "./stub";
import type { Messenger } from "./types";

export * from "./types";
export { StubMessenger } from "./stub";

let messenger: Messenger | undefined;

/**
 * Single entry point for outbound customer comms. Swap the implementation
 * here when the WhatsApp Cloud API and Resend are connected.
 */
export function getMessenger(): Messenger {
  messenger ??= new StubMessenger();
  return messenger;
}

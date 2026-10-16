"use server";

import { getAdminGateState } from "@/lib/admin/auth";

export type CharterConversationIntake = {
  customerName: string | null;
  organisation: string | null;
  email: string | null;
  whatsapp: string | null;
  passengers: number | null;
  vehiclePreference: string | null;
  requestedStartDate: string | null;
  requestedEndDate: string | null;
  itineraryStartDate: string | null;
  itinerary: { dayOrDate: string | null; from: string | null; to: string | null; details: string | null; nights: number | null }[];
  inclusionsRequested: string[];
  exclusionsOrAssumptions: string[];
  preferences: string[];
  unresolvedQuestions: string[];
  dateConflicts: string[];
  customerBudget: string | null;
  priceAgreed: string | null;
  summary: string;
};

export type CharterConversationIntakeState =
  | { ok: true; intake: CharterConversationIntake }
  | { ok: false; message: string }
  | null;

export async function analyseCharterConversationAction(
  _previous: CharterConversationIntakeState,
  form: FormData,
): Promise<CharterConversationIntakeState> {
  const gate = await getAdminGateState();
  if (gate.state !== "signed-in") return { ok: false, message: "Sign in to use AI charter intake." };

  const conversation = String(form.get("conversation") ?? "").trim();
  if (conversation.length < 30) return { ok: false, message: "Paste the customer conversation (at least 30 characters)." };
  if (conversation.length > 40000) return { ok: false, message: "The pasted conversation is too long. Keep it under 40,000 characters." };

  const apiKey = process.env.ANTHROPIC_API_KEY_TRANSPORT?.trim();
  if (!apiKey) return { ok: false, message: "Claude is not configured on this deployment. Add ANTHROPIC_API_KEY_TRANSPORT in Vercel and redeploy." };

  const schema = `{
    "customerName": string|null,
    "organisation": string|null,
    "email": string|null,
    "whatsapp": string|null,
    "passengers": number|null,
    "vehiclePreference": string|null,
    "requestedStartDate": "YYYY-MM-DD"|null,
    "requestedEndDate": "YYYY-MM-DD"|null,
    "itineraryStartDate": "YYYY-MM-DD"|null,
    "itinerary": [{"dayOrDate": string|null, "from": string|null, "to": string|null, "details": string|null, "nights": number|null}],
    "inclusionsRequested": string[],
    "exclusionsOrAssumptions": string[],
    "preferences": string[],
    "unresolvedQuestions": string[],
    "dateConflicts": string[],
    "customerBudget": string|null,
    "priceAgreed": string|null,
    "summary": string
  }`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL_TRANSPORT?.trim() || "claude-sonnet-5-5",
        max_tokens: 7000,
        system: "You are an assistant for a Namibia-based bespoke safari charter operator. Extract facts from customer WhatsApp/email text into the requested JSON schema. Do not invent or silently reconcile information. Use null for missing facts. Preserve exact place names and dates. Separate the customer's requested travel dates from dates stated in an attached/lodge itinerary. List discrepancies explicitly in dateConflicts and unresolvedQuestions. Do not calculate or invent road distances, prices, availability, bookings, or confirmed inclusions. A budget is not an agreed price. Only set priceAgreed if the customer and operator clearly accepted a specific amount. Keep output valid JSON only.",
        messages: [{ role: "user", content: "Extract this conversation into this JSON schema: " + schema + "\n\nCUSTOMER CONVERSATION:\n" + conversation }],
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("[charter-ai-intake] Anthropic error", response.status, detail.slice(0, 500));
      return { ok: false, message: response.status === 401 ? "Claude rejected the API key. Check ANTHROPIC_API_KEY_TRANSPORT in Vercel." : "AI could not analyse the conversation right now. Please try again." };
    }
    const rawBody = await response.text();
    let payload: { stop_reason?: string; content?: { type?: string; text?: string }[]; error?: { type?: string; message?: string } };
    try {
      payload = JSON.parse(rawBody) as typeof payload;
    } catch {
      console.error("[charter-ai-intake] Anthropic returned non-JSON success response", {
        contentType: response.headers.get("content-type"),
        bodyLength: rawBody.length,
        bodyStart: rawBody.slice(0, 160),
      });
      return { ok: false, message: "Claude returned an unexpected response. Please retry; if it continues, check the Vercel function logs for [charter-ai-intake]." };
    }
    const text = payload.content?.filter((part) => part.type === "text").map((part) => part.text ?? "").join("\n").trim() ?? "";
    if (payload.stop_reason === "max_tokens") {
      console.error("[charter-ai-intake] Claude response reached max_tokens", { textLength: text.length });
      return { ok: false, message: "The AI response was cut off. Please paste only the relevant customer conversation and try again." };
    }
    // Accept plain JSON or JSON wrapped in a Markdown code fence; tolerate a short preamble.
    const unfenced = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const firstBrace = unfenced.indexOf("{");
    const lastBrace = unfenced.lastIndexOf("}");
    const jsonText = firstBrace >= 0 && lastBrace > firstBrace ? unfenced.slice(firstBrace, lastBrace + 1) : unfenced;
    let parsed: CharterConversationIntake;
    try {
      parsed = JSON.parse(jsonText) as CharterConversationIntake;
    } catch {
      console.error("[charter-ai-intake] Could not parse Claude JSON", { stopReason: payload.stop_reason, responseLength: text.length, startsWith: text.slice(0, 80), endsWith: text.slice(-80) });
      return { ok: false, message: "Claude returned an incomplete or unreadable response. Try again with only the relevant customer messages." };
    }
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.itinerary) || typeof parsed.summary !== "string") {
      return { ok: false, message: "The AI response was incomplete. Please try again or shorten the pasted conversation." };
    }
    return { ok: true, intake: parsed };
  } catch (error) {
    console.error("[charter-ai-intake] analysis failed", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[charter-ai-intake] analysis failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: errorMessage.slice(0, 240),
    });
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      return { ok: false, message: "AI analysis timed out. Try a shorter conversation." };
    }
    return { ok: false, message: "The AI request failed before its response could be processed. Retry once; if it continues, check the Vercel function logs for [charter-ai-intake]." };
  }
}

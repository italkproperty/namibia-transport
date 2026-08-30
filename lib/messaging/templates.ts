import { SUPPORT, whatsappLink } from "@/lib/company";
import { formatDateTime } from "@/lib/format";
import { mapsLink } from "@/lib/maps/bounds";
import { formatNad } from "@/lib/money";
import { SITE } from "@/lib/site";

/**
 * The booking confirmation, written once and rendered for both channels.
 *
 * WhatsApp is the primary channel and email the backup, so the text version is
 * the source of truth and the HTML is a dressed-up copy of it — never the
 * other way round. Anything that only exists in the HTML is invisible to the
 * traveller reading it on a phone in an airport with images turned off.
 *
 * Nothing in here claims a capability we do not have: no delivery estimate we
 * cannot meet, no "24/7", and the driver line says when details arrive rather
 * than implying they are attached already.
 */

export type ConfirmationDetails = {
  ref: string;
  fullName: string;
  routeLabel: string;
  scheduledAt: Date;
  vehicleClassName: string;
  passengers: number;
  total: string;
  currency?: string;
  pickupLabel: string;
  dropoffLabel: string;
  pickupPin?: { lat: number; lng: number } | null;
  dropoffPin?: { lat: number; lng: number } | null;
  flightNumber?: string | null;
  notes?: string | null;
  /** Present when a gateway page was opened; absent when paying later. */
  checkoutUrl?: string | null;
  supportWhatsapp?: string | null;
};

const esc = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function confirmationSubject(details: ConfirmationDetails): string {
  return `${details.ref} — your transfer is booked (${details.routeLabel})`;
}

export function confirmationText(details: ConfirmationDetails): string {
  const lines: string[] = [
    `Hi ${details.fullName},`,
    "",
    `Your transfer is booked. Your reference is ${details.ref} — quote it any time you message us.`,
    "",
    `Trip:      ${details.routeLabel}`,
    `Pickup:    ${formatDateTime(details.scheduledAt)}`,
    `From:      ${details.pickupLabel}`,
    `To:        ${details.dropoffLabel}`,
    `Vehicle:   ${details.vehicleClassName}`,
    `Party:     ${details.passengers} ${details.passengers === 1 ? "passenger" : "passengers"}`,
    `Total:     ${formatNad(details.total)}`,
  ];

  if (details.flightNumber) lines.push(`Flight:    ${details.flightNumber}`);
  if (details.notes) lines.push(`Notes:     ${details.notes}`);

  const pinCount = (details.pickupPin ? 1 : 0) + (details.dropoffPin ? 1 : 0);
  if (pinCount > 0) {
    lines.push(
      "",
      pinCount === 1
        ? "The spot you pinned — worth checking it is right:"
        : "The spots you pinned — worth checking these are right:",
    );
    if (details.pickupPin) {
      lines.push(`  Pickup:   ${mapsLink(details.pickupPin)}`);
    }
    if (details.dropoffPin) {
      lines.push(`  Drop-off: ${mapsLink(details.dropoffPin)}`);
    }
    lines.push(
      pinCount === 1
        ? "If it is wrong, reply to this email or message us — it is a one-minute fix now and a problem on the day."
        : "If either is wrong, reply to this email or message us — it is a one-minute fix now and a problem on the day.",
    );
  }

  lines.push(
    "",
    "What happens next",
    "  1. We confirm your booking and put a partner driver on your trip.",
    "  2. You get the driver's name, the vehicle and its registration before pickup.",
    details.flightNumber
      ? "  3. We watch your flight and move the pickup if it slips. A delay costs you nothing."
      : "  3. We are reachable throughout your journey if anything changes.",
    "",
    details.checkoutUrl
      ? `Payment: ${details.checkoutUrl}`
      : "Payment: nothing has been charged. You can pay by card from your booking page, or settle on the day.",
    "",
    `Your booking page: ${SITE.url}/booking/${details.ref}`,
    "",
  );

  if (details.supportWhatsapp) {
    lines.push(
      `Questions: WhatsApp ${details.supportWhatsapp} — quote ${details.ref} and we can see your whole trip.`,
    );
  }
  lines.push(`Coordination ${SUPPORT.officeHours}.`, "", SITE.name);

  return lines.join("\n");
}

export function confirmationHtml(details: ConfirmationDetails): string {
  const row = (label: string, value: string) =>
    `<tr>
      <td style="padding:6px 16px 6px 0;color:#6a635e;font-size:14px;white-space:nowrap;vertical-align:top">${esc(label)}</td>
      <td style="padding:6px 0;color:#1a1614;font-size:14px;font-weight:500">${esc(value)}</td>
    </tr>`;

  const pinRow = (label: string, point: { lat: number; lng: number }) =>
    `<tr>
      <td style="padding:6px 16px 6px 0;color:#6a635e;font-size:14px;white-space:nowrap;vertical-align:top">${esc(label)}</td>
      <td style="padding:6px 0;font-size:14px">
        <a href="${esc(mapsLink(point))}" style="color:#bc4b00;font-weight:500">Check the pinned spot</a>
      </td>
    </tr>`;

  const rows = [
    row("Trip", details.routeLabel),
    row("Pickup", formatDateTime(details.scheduledAt)),
    row("From", details.pickupLabel),
    row("To", details.dropoffLabel),
    row("Vehicle", details.vehicleClassName),
    row(
      "Party",
      `${details.passengers} ${details.passengers === 1 ? "passenger" : "passengers"}`,
    ),
    details.flightNumber ? row("Flight", details.flightNumber) : "",
    details.notes ? row("Notes", details.notes) : "",
    details.pickupPin ? pinRow("Pickup pin", details.pickupPin) : "",
    details.dropoffPin ? pinRow("Drop-off pin", details.dropoffPin) : "",
  ].join("");

  const pins = (details.pickupPin ? 1 : 0) + (details.dropoffPin ? 1 : 0);
  const pinNote =
    pins > 0
      ? `<p style="margin:0 0 18px;color:#6a635e;font-size:14px;line-height:1.5">
           Worth opening ${pins === 1 ? "that link" : "those links"} to check the spot is right. It is a
           one-minute fix now and a problem on the day.
         </p>`
      : "";

  const steps = [
    "We confirm your booking and put a partner driver on your trip.",
    "You get the driver&rsquo;s name, the vehicle and its registration before pickup.",
    details.flightNumber
      ? "We watch your flight and move the pickup if it slips. A delay costs you nothing."
      : "We are reachable throughout your journey if anything changes.",
  ]
    .map(
      (step) =>
        `<li style="margin:0 0 6px;color:#1a1614;font-size:14px;line-height:1.5">${step}</li>`,
    )
    .join("");

  const payLine = details.checkoutUrl
    ? `<a href="${esc(details.checkoutUrl)}" style="display:inline-block;background:#bc4b00;color:#fcfaf7;text-decoration:none;padding:11px 20px;border-radius:6px;font-size:14px;font-weight:600">Pay now</a>`
    : `<p style="margin:0;color:#6a635e;font-size:14px;line-height:1.5">Nothing has been charged. You can pay by card from your booking page, or settle on the day.</p>`;

  const support = details.supportWhatsapp
    ? `<p style="margin:0 0 6px;color:#6a635e;font-size:13px;line-height:1.5">
         Questions? <a href="${esc(whatsappLink(details.supportWhatsapp, `Hi — about booking ${details.ref}.`))}" style="color:#1a1614">WhatsApp us</a>
         and quote ${esc(details.ref)} — we can see your whole trip.
       </p>`
    : "";

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${esc(confirmationSubject(details))}</title></head>
<body style="margin:0;padding:0;background:#fcfaf7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">Reference ${esc(details.ref)} — ${esc(details.routeLabel)}, ${esc(formatDateTime(details.scheduledAt))}.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fcfaf7">
    <tr><td align="center" style="padding:28px 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e2dfdb;border-radius:14px">
        <tr><td style="padding:28px">

          <p style="margin:0 0 4px;letter-spacing:0.14em;text-transform:uppercase;font-size:11px;font-weight:600;color:#bc4b00">${esc(SITE.name)}</p>
          <h1 style="margin:0 0 6px;font-size:22px;line-height:1.25;color:#1a1614">Your transfer is booked</h1>
          <p style="margin:0 0 18px;color:#6a635e;font-size:14px;line-height:1.5">Hi ${esc(details.fullName)} — here is everything on file. Quote your reference any time you message us.</p>

          <div style="background:#fcfaf7;border:1px solid #e2dfdb;border-radius:10px;padding:14px 16px;margin:0 0 18px">
            <p style="margin:0 0 2px;color:#6a635e;font-size:12px">Your reference</p>
            <p style="margin:0;color:#1a1614;font-size:22px;font-weight:700;letter-spacing:0.06em">${esc(details.ref)}</p>
          </div>

          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #e2dfdb;margin:0 0 16px">${rows}</table>
          ${pinNote}

          <p style="margin:0 0 4px;color:#1a1614;font-size:14px;font-weight:600">Total, all in</p>
          <p style="margin:0 0 18px;color:#bc4b00;font-size:26px;font-weight:700">${esc(formatNad(details.total))}</p>
          ${payLine}

          <p style="margin:22px 0 6px;color:#1a1614;font-size:14px;font-weight:600">What happens next</p>
          <ol style="margin:0 0 18px;padding-left:20px">${steps}</ol>

          <p style="margin:0 0 18px;font-size:14px">
            <a href="${esc(`${SITE.url}/booking/${details.ref}`)}" style="color:#bc4b00;font-weight:500">View your booking page</a>
          </p>

          <div style="border-top:1px solid #e2dfdb;padding-top:14px">
            ${support}
            <p style="margin:0;color:#6a635e;font-size:13px">Coordination ${esc(SUPPORT.officeHours)}.</p>
          </div>

        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

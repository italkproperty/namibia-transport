"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2Icon, CopyIcon, ExternalLinkIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createCustomQuote,
  type QuoteFormState,
} from "@/lib/admin/quote-actions";
import { whatsappLink } from "@/lib/company";

/**
 * The form an operator fills in while still on the phone.
 *
 * Field order follows the order an enquiry actually arrives in — who they are,
 * where they are going, when, what it costs — rather than the order the
 * database stores it in. The fare is last because it is the thing being
 * negotiated, and it is the only number on this screen the model does not
 * produce.
 */
export function QuoteForm({
  vehicleClasses,
}: {
  vehicleClasses: { id: string; name: string }[];
}) {
  const [state, action, pending] = React.useActionState<
    QuoteFormState,
    FormData
  >(createCustomQuote, null);

  const [copied, setCopied] = React.useState(false);
  const [whatsapp, setWhatsapp] = React.useState("");

  if (state?.ok) {
    const message = `Hi — here is your quote from Namibia Transport. You can see the full details, confirm, and pay by bank transfer here: ${state.url}`;
    return (
      <div className="bg-card rounded-xl border p-6">
        <p className="text-success flex items-center gap-2 font-medium">
          <CheckCircle2Icon className="size-5" aria-hidden />
          Quote {state.ref} created
        </p>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          This is a live booking page. The traveller sees the trip, the fare and
          the bank details, and can tell you when they have paid.
        </p>

        <div className="bg-muted mt-4 flex items-center gap-2 rounded-lg p-3">
          <code className="min-w-0 flex-1 truncate font-mono text-xs">
            {state.url}
          </code>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(state.url).then(
                () => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1600);
                },
                () => undefined,
              );
            }}
            className="press focus-ring text-muted-foreground hover:text-foreground shrink-0 rounded p-1.5"
            aria-label="Copy the link"
          >
            {copied ? (
              <CheckCircle2Icon className="text-success size-4" aria-hidden />
            ) : (
              <CopyIcon className="size-4" aria-hidden />
            )}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {whatsapp && (
            <Button asChild className="press">
              <a
                href={whatsappLink(whatsapp, message)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Send it on WhatsApp
              </a>
            </Button>
          )}
          <Button asChild variant="outline" className="press">
            <a href={state.url} target="_blank" rel="noopener noreferrer">
              Open the page
              <ExternalLinkIcon className="size-4" aria-hidden />
            </a>
          </Button>
          <Button asChild variant="ghost" className="press">
            <Link href="/admin/quotes/new">Write another</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-6">
      <fieldset>
        <legend className="mb-3 text-sm font-semibold">
          Who is travelling
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" name="fullName" required />
          <Field
            label="WhatsApp number"
            name="whatsapp"
            required
            placeholder="+264 81 123 4567"
            hint="With the country code. This is how the quote reaches them."
            value={whatsapp}
            onChange={setWhatsapp}
          />
          <Field
            label="Email"
            name="email"
            type="email"
            className="sm:col-span-2"
            hint="Optional."
          />
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 text-sm font-semibold">The trip</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Picking up from"
            name="pickupLabel"
            required
            placeholder="Etango Ranch Guest Farm"
          />
          <Field
            label="Going to"
            name="dropoffLabel"
            required
            placeholder="Namib Desert Lodge"
          />
          <Field
            label="Pickup date and time"
            name="scheduledAt"
            type="datetime-local"
            required
          />
          <Field
            label="Returning on"
            name="returnAt"
            type="date"
            hint="Leave blank for a one-way. A return is quoted as one fare."
          />
          <Field
            label="Passengers"
            name="passengers"
            type="number"
            defaultValue="2"
          />
          <Field
            label="Large cases"
            name="luggageCount"
            type="number"
            defaultValue="0"
          />
          {vehicleClasses.length > 0 && (
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="vehicleClassId">Vehicle</Label>
              <select
                id="vehicleClassId"
                name="vehicleClassId"
                className="border-input bg-background focus-ring h-10 rounded-md border px-3 text-sm"
                defaultValue=""
              >
                <option value="">Decide later</option>
                {vehicleClasses.map((vc) => (
                  <option key={vc.id} value={vc.id}>
                    {vc.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 text-sm font-semibold">The money</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Fare (N$)"
            name="price"
            required
            inputMode="decimal"
            placeholder="6000"
            hint="The whole vehicle, and the whole trip including any return."
          />
          <Field
            label="Driver payout (N$)"
            name="payout"
            inputMode="decimal"
            hint="Leave blank to use the usual split."
          />
          <Field
            label="Note on the quote"
            name="notes"
            className="sm:col-span-2"
            hint="The traveller sees this on their page — what is included, the return date, anything agreed on the call."
          />
        </div>
      </fieldset>

      {state && !state.ok && (
        <p className="text-destructive text-sm">{state.message}</p>
      )}

      <div>
        <Button type="submit" disabled={pending} className="press h-11">
          {pending ? "Creating…" : "Create the quote and get a link"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  hint,
  className,
  value,
  onChange,
  ...props
}: {
  label: string;
  name: string;
  hint?: string;
  className?: string;
  value?: string;
  onChange?: (value: string) => void;
} & Omit<React.ComponentProps<typeof Input>, "onChange" | "value">) {
  return (
    <div className={`grid gap-1.5 ${className ?? ""}`}>
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        {...(onChange
          ? { value, onChange: (e) => onChange(e.target.value) }
          : {})}
        {...props}
      />
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}

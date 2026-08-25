"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  Loader2Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { createCorporateQuote } from "@/lib/corporate/quote-actions";
import {
  computeQuote,
  QUOTE_SERVICES,
  type QuoteService,
} from "@/lib/corporate/quote-pricing";
import {
  corporateQuoteSchema,
  type CorporateQuoteValues,
} from "@/lib/corporate/quote-schema";
import type { RouteView, VehicleClassView } from "@/lib/maps";
import { formatNad } from "@/lib/money";
import { routeTitle } from "@/lib/route-content";

const INDUSTRIES = [
  "Mining & resources",
  "Tourism & hospitality",
  "Finance & professional services",
  "Government & NGO",
  "Logistics & construction",
  "Other",
];

const STEPS = ["Company", "Requirement", "Quotation"] as const;
type Step = 1 | 2 | 3;

const STEP_ONE_FIELDS = ["companyName", "contactName", "email", "whatsapp"] as const;
const STEP_TWO_FIELDS = ["services", "passengers", "vehicles", "periodCount"] as const;

type Props = {
  routes: RouteView[];
  vehicleClasses: VehicleClassView[];
  vatRate: number;
};

/**
 * The quoting engine's front end, as a three-step procurement flow.
 *
 * The quotation is a *result*, not a live sidebar: showing a price before the
 * requirement exists reads as a guess, so pricing is withheld until step 3 and
 * the panel shows captured details until then. The numbers are still only a
 * preview — the Server Action re-prices from the database before saving.
 */
export function CorporateQuoteForm({ routes, vehicleClasses, vatRate }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [step, setStep] = React.useState<Step>(1);

  const form = useForm<CorporateQuoteValues>({
    resolver: zodResolver(corporateQuoteSchema),
    mode: "onBlur",
    defaultValues: {
      companyName: "",
      contactName: "",
      contactPosition: "",
      email: "",
      whatsapp: "",
      industry: "",
      companyRegistration: "",
      billingAddress: "",
      services: [],
      routeSlug: routes[0]?.slug ?? "",
      vehicleClassId: vehicleClasses[0]?.id ?? "",
      passengers: 4,
      vehicles: 1,
      frequency: "once",
      periodCount: 1,
      includeReturn: false,
      extraWaitingHours: 0,
      extraStops: 0,
      datesNote: "",
      notes: "",
      acquisitionSource: "",
    },
  });

  React.useEffect(() => {
    const referrer = typeof document !== "undefined" ? document.referrer : "";
    try {
      const host = referrer ? new URL(referrer).host : "";
      form.setValue(
        "acquisitionSource",
        !host || host === window.location.host ? "direct" : `referrer:${host}`
      );
    } catch {
      form.setValue("acquisitionSource", "direct");
    }
  }, [form]);

  const watched = form.watch();

  const quote = React.useMemo(
    () =>
      computeQuote(
        {
          services: watched.services ?? [],
          routeSlug: watched.routeSlug || null,
          vehicleClassId: watched.vehicleClassId || null,
          passengers: Number(watched.passengers) || 1,
          vehicles: Number(watched.vehicles) || 1,
          frequency: watched.frequency ?? "once",
          periodCount: Number(watched.periodCount) || 1,
          includeReturn: Boolean(watched.includeReturn),
          extraWaitingHours: Number(watched.extraWaitingHours) || 0,
          extraStops: Number(watched.extraStops) || 0,
        },
        routes,
        vehicleClasses,
        vatRate
      ),
    [watched, routes, vehicleClasses, vatRate]
  );

  const selectedRoute = routes.find((r) => r.slug === watched.routeSlug);
  const selectedClass = vehicleClasses.find((c) => c.id === watched.vehicleClassId);
  const perPerson = selectedRoute?.pricingUnit === "per_person";

  async function advance(from: Step) {
    const fields = from === 1 ? STEP_ONE_FIELDS : STEP_TWO_FIELDS;
    const valid = await form.trigger(
      fields as unknown as (keyof CorporateQuoteValues)[]
    );
    if (valid) setStep((from + 1) as Step);
  }

  function onSubmit(values: CorporateQuoteValues) {
    startTransition(async () => {
      const result = await createCorporateQuote(values);
      if (result.ok) {
        router.push(`/corporate/quotes/${result.quoteNumber}`);
      } else {
        toast.error("We could not create your quotation", {
          description: result.message,
        });
      }
    });
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid gap-5 lg:grid-cols-[1fr_20rem] lg:items-start"
        noValidate
      >
        <div className="bg-card rounded-xl border p-4 sm:p-6">
          <StepRail current={step} />

          {/* ------------------------------------------------------ step 1 */}
          <fieldset className={step === 1 ? "space-y-4" : "hidden"} disabled={isPending}>
            <legend className="sr-only">Company details</legend>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField form={form} name="companyName" label="Company" placeholder="Company name" autoComplete="organization" />
              <TextField form={form} name="contactName" label="Contact person" placeholder="Full name" autoComplete="name" />
              <TextField form={form} name="contactPosition" label="Position (optional)" placeholder="e.g. Travel coordinator" autoComplete="organization-title" />
              <FormField
                control={form.control}
                name="industry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Industry (optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-11 w-full">
                          <SelectValue placeholder="Choose" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {INDUSTRIES.map((industry) => (
                          <SelectItem key={industry} value={industry}>
                            {industry}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <TextField form={form} name="email" label="Email" placeholder="you@company.com" type="email" autoComplete="email" />
              <TextField form={form} name="whatsapp" label="WhatsApp" placeholder="+264 81 123 4567" type="tel" autoComplete="tel" description="WhatsApp or email — either is enough." />
              <TextField form={form} name="companyRegistration" label="Company registration (optional)" placeholder="e.g. CC/2020/01234" />
              <TextField form={form} name="billingAddress" label="Billing address (optional)" placeholder="For the formal quotation" autoComplete="street-address" />
            </div>

            <Button
              type="button"
              onClick={() => advance(1)}
              size="lg"
              className="press bg-brand text-brand-foreground hover:bg-brand-hover h-12 w-full sm:w-auto"
            >
              Continue
              <ArrowRightIcon className="size-4" aria-hidden />
            </Button>
          </fieldset>

          {/* ------------------------------------------------------ step 2 */}
          <fieldset className={step === 2 ? "space-y-5" : "hidden"} disabled={isPending}>
            <legend className="sr-only">Transport requirement</legend>

            <FormField
              control={form.control}
              name="services"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What do you need?</FormLabel>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(Object.entries(QUOTE_SERVICES) as [QuoteService, string][]).map(
                      ([value, label]) => {
                        const checked = field.value?.includes(value);
                        return (
                          <label
                            key={value}
                            className={[
                              "press flex cursor-pointer items-center gap-2.5 rounded-lg border p-3 text-sm",
                              checked
                                ? "border-brand bg-brand-subtle/60 font-medium"
                                : "hover:border-foreground/25",
                            ].join(" ")}
                          >
                            <input
                              type="checkbox"
                              className="accent-brand size-4"
                              checked={checked}
                              onChange={(event) => {
                                const next = event.target.checked
                                  ? [...(field.value ?? []), value]
                                  : (field.value ?? []).filter((v) => v !== value);
                                field.onChange(next);
                              }}
                            />
                            {label}
                          </label>
                        );
                      }
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <FormField
              control={form.control}
              name="routeSlug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary route</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-11 w-full">
                        <SelectValue placeholder="Choose a route" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {routes.map((route) => (
                        <SelectItem key={route.slug} value={route.slug}>
                          {routeTitle(route)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Additional routes and site runs are scoped in your final
                    quotation — describe them in the notes.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Vehicle as comparable cards, not a bare dropdown. */}
            <FormField
              control={form.control}
              name="vehicleClassId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vehicle</FormLabel>
                  <div role="radiogroup" aria-label="Vehicle" className="grid gap-2 sm:grid-cols-2">
                    {vehicleClasses.map((vehicleClass) => {
                      const isSelected = vehicleClass.id === field.value;
                      return (
                        <button
                          key={vehicleClass.id}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          onClick={() => field.onChange(vehicleClass.id)}
                          className={[
                            "press rounded-lg border p-3 text-left",
                            isSelected
                              ? "border-brand bg-brand-subtle/60"
                              : "hover:border-foreground/25",
                          ].join(" ")}
                        >
                          <span className="block text-sm font-semibold">
                            {vehicleClass.name}
                          </span>
                          <span className="text-muted-foreground mt-0.5 block text-xs">
                            Up to {vehicleClass.capacity} passengers ·{" "}
                            {vehicleClass.luggageCapacity} large bags
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField form={form} name="passengers" label="Passengers" min={1} />
              {!perPerson && (
                <NumberField form={form} name="vehicles" label="Vehicles" min={1} />
              )}

              <FormField
                control={form.control}
                name="frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frequency</FormLabel>
                    <div
                      role="radiogroup"
                      aria-label="Frequency"
                      className="bg-muted grid grid-cols-3 gap-1 rounded-md p-1"
                    >
                      {(
                        [
                          ["once", "Once"],
                          ["daily", "Daily"],
                          ["weekly", "Weekly"],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          role="radio"
                          aria-checked={field.value === value}
                          onClick={() => field.onChange(value)}
                          className={[
                            "press rounded px-2 py-2 text-sm",
                            field.value === value
                              ? "bg-card shadow-card font-medium"
                              : "hover:bg-card/60",
                          ].join(" ")}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <NumberField
                form={form}
                name="periodCount"
                label={watched.frequency === "weekly" ? "Number of weeks" : "Number of days"}
                min={1}
              />

              <TextField form={form} name="datesNote" label="Dates" placeholder="e.g. 15–19 September" />
              <NumberField form={form} name="extraWaitingHours" label="Extra waiting hours" min={0} />
              <NumberField form={form} name="extraStops" label="Additional stops" min={0} />
            </div>

            <FormField
              control={form.control}
              name="includeReturn"
              render={({ field }) => (
                <FormItem>
                  <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={(event) => field.onChange(event.target.checked)}
                        className="accent-brand size-4"
                      />
                    </FormControl>
                    Include return journeys
                  </label>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Special requirements (optional)</FormLabel>
                  <FormControl>
                    <textarea
                      rows={3}
                      placeholder="Additional routes, site locations, executive requirements, billing needs."
                      className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs outline-none focus-visible:ring-[3px] md:text-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(1)} className="press h-12">
                <ArrowLeftIcon className="size-4" aria-hidden />
                Back
              </Button>
              <Button
                type="button"
                onClick={() => advance(2)}
                size="lg"
                className="press bg-brand text-brand-foreground hover:bg-brand-hover h-12 flex-1 sm:flex-none sm:px-8"
              >
                Calculate quotation
                <ArrowRightIcon className="size-4" aria-hidden />
              </Button>
            </div>
          </fieldset>

          {/* ------------------------------------------------------ step 3 */}
          <fieldset className={step === 3 ? "space-y-5" : "hidden"} disabled={isPending}>
            <legend className="sr-only">Your quotation</legend>

            <div>
              <p className="text-brand text-xs font-semibold tracking-[0.14em] uppercase">
                {quote.isFormal ? "Fixed quotation" : "Estimate"}
              </p>
              <h3 className="mt-1 text-lg font-semibold">
                {watched.companyName || "Your quotation"}
              </h3>
              <p className="text-muted-foreground mt-1 text-sm">
                {quote.tripsCount} trip{quote.tripsCount === 1 ? "" : "s"}
                {watched.datesNote ? ` · ${watched.datesNote}` : ""}
                {selectedClass ? ` · ${selectedClass.name}` : ""}
              </p>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left text-xs tracking-wider uppercase">
                  <th className="py-2 font-medium">Item</th>
                  <th className="tabular py-2 text-right font-medium">Qty</th>
                  <th className="tabular py-2 text-right font-medium">Unit</th>
                  <th className="tabular py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {quote.lines.map((line) => (
                  <tr key={line.description} className="border-b last:border-0">
                    <td className="max-w-sm py-2.5 pr-4 leading-snug text-pretty">
                      {line.description}
                    </td>
                    <td className="tabular py-2.5 text-right align-top">
                      {line.unitPrice === null ? "—" : line.quantity}
                    </td>
                    <td className="tabular py-2.5 text-right align-top">
                      {line.unitPrice === null ? "—" : formatNad(line.unitPrice)}
                    </td>
                    <td className="tabular py-2.5 text-right align-top font-medium">
                      {line.lineTotal === null ? "TBC" : formatNad(line.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="ml-auto max-w-xs space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular font-medium">{formatNad(quote.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {vatRate > 0 ? `VAT (${Math.round(vatRate * 100)}%)` : "VAT"}
                </span>
                <span className="tabular font-medium">
                  {vatRate > 0 ? formatNad(quote.vatAmount) : "Not applicable"}
                </span>
              </div>
              <div className="flex items-baseline justify-between border-t pt-2">
                <span className="font-semibold">Total</span>
                <span className="tabular text-brand text-2xl font-semibold tracking-tight">
                  {formatNad(quote.total)}
                </span>
              </div>
            </div>

            {!quote.isFormal && (
              <p className="bg-warning-subtle text-foreground rounded-lg p-3 text-sm leading-snug">
                Items marked TBC need scoping by our team. We confirm them — and
                the final total — within 24 hours of receiving this.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(2)} className="press h-12">
                <ArrowLeftIcon className="size-4" aria-hidden />
                Adjust
              </Button>
              <Button
                type="submit"
                size="lg"
                disabled={isPending}
                className="press bg-brand text-brand-foreground hover:bg-brand-hover h-12 flex-1 text-base sm:flex-none sm:px-8"
              >
                {isPending ? (
                  <Loader2Icon className="size-4 animate-spin" aria-hidden />
                ) : (
                  <CheckIcon className="size-4" aria-hidden />
                )}
                {isPending ? "Creating…" : "Issue quotation"}
              </Button>
            </div>
          </fieldset>
        </div>

        {/* ----------------------------------------------- progressive panel */}
        <aside className="bg-card rounded-xl border p-4 lg:sticky lg:top-20">
          <h2 className="text-sm font-semibold">Your request</h2>

          <dl className="mt-3 space-y-2 text-sm">
            <PanelRow label="Company" value={watched.companyName} />
            <PanelRow label="Contact" value={watched.contactName} />
            <PanelRow
              label="Services"
              value={
                watched.services?.length
                  ? watched.services.map((s) => QUOTE_SERVICES[s]).join(", ")
                  : ""
              }
            />
            {step >= 2 && (
              <>
                <PanelRow
                  label="Route"
                  value={selectedRoute ? routeTitle(selectedRoute) : ""}
                />
                <PanelRow label="Passengers" value={String(watched.passengers ?? "")} />
                <PanelRow label="Dates" value={watched.datesNote} />
              </>
            )}
          </dl>

          <Separator className="my-4" />

          {step < 3 ? (
            <div>
              <p className="text-muted-foreground text-xs font-medium">Total</p>
              <p className="text-muted-foreground mt-1 text-sm leading-snug">
                Your itemised quotation is calculated once we know your
                requirement.
              </p>
            </div>
          ) : (
            <div>
              <p className="text-muted-foreground text-xs font-medium">
                {quote.isFormal ? "Fixed total" : "Estimated total"}
              </p>
              <p className="tabular price-slot text-brand mt-1 text-3xl leading-none font-semibold tracking-tight">
                {formatNad(quote.total)}
              </p>
              <p className="text-muted-foreground mt-1.5 text-xs leading-snug">
                Valid 7 days from issue. Nothing is charged — this is a
                quotation, not a booking.
              </p>
            </div>
          )}
        </aside>
      </form>
    </Form>
  );
}

/* ------------------------------------------------------------- step rail */

function StepRail({ current }: { current: Step }) {
  return (
    <ol className="mb-6 flex items-center gap-2 text-xs font-medium">
      {STEPS.map((label, index) => {
        const number = (index + 1) as Step;
        const done = number < current;
        const active = number === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              aria-current={active ? "step" : undefined}
              className={[
                "flex size-6 shrink-0 items-center justify-center rounded-full text-[0.7rem]",
                done
                  ? "bg-brand text-brand-foreground"
                  : active
                    ? "border-brand text-brand border-2"
                    : "border-border text-muted-foreground border",
              ].join(" ")}
            >
              {done ? <CheckIcon className="size-3" aria-hidden /> : number}
            </span>
            <span className={active ? "text-foreground" : "text-muted-foreground"}>
              {label}
            </span>
            {index < STEPS.length - 1 && (
              <span className="bg-border ml-1 hidden h-px flex-1 sm:block" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function PanelRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd
        className={[
          "min-w-0 truncate text-right",
          value ? "font-medium" : "text-muted-foreground/60",
        ].join(" ")}
      >
        {value || "—"}
      </dd>
    </div>
  );
}

/* ---------------------------------------------------------- field helpers */

type AnyForm = ReturnType<typeof useForm<CorporateQuoteValues>>;

function TextField({
  form,
  name,
  label,
  placeholder,
  type = "text",
  autoComplete,
  description,
}: {
  form: AnyForm;
  name: keyof CorporateQuoteValues;
  label: string;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
  description?: string;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              className="h-11"
              type={type}
              placeholder={placeholder}
              autoComplete={autoComplete}
              {...field}
              value={String(field.value ?? "")}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function NumberField({
  form,
  name,
  label,
  min,
}: {
  form: AnyForm;
  name: keyof CorporateQuoteValues;
  label: string;
  min: number;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              className="h-11"
              type="number"
              inputMode="numeric"
              min={min}
              value={String(field.value ?? min)}
              onChange={(event) =>
                field.onChange(
                  event.target.value === "" ? min : Number(event.target.value)
                )
              }
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

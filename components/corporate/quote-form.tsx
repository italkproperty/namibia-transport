"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ArrowLeftIcon, ArrowRightIcon, Loader2Icon } from "lucide-react";

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

const STEP_ONE_FIELDS = [
  "companyName",
  "contactName",
  "email",
  "whatsapp",
] as const;

type Props = {
  routes: RouteView[];
  vehicleClasses: VehicleClassView[];
  vatRate: number;
};

/**
 * The corporate quoting engine's front end: company details, then the
 * requirement, with an itemised estimate updating live beside the form. The
 * numbers shown are a preview — the Server Action re-prices everything from
 * the database before anything is saved.
 */
export function CorporateQuoteForm({ routes, vehicleClasses, vatRate }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [step, setStep] = React.useState<1 | 2>(1);

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
      services: ["airport_transfers"],
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

  const preview = React.useMemo(
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
  const perPerson = selectedRoute?.pricingUnit === "per_person";

  async function toStepTwo() {
    const valid = await form.trigger(STEP_ONE_FIELDS as unknown as (keyof CorporateQuoteValues)[]);
    if (valid) setStep(2);
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
        className="grid gap-5 lg:grid-cols-[1fr_21rem] lg:items-start"
        noValidate
      >
        <div className="bg-card rounded-xl border p-4 sm:p-5">
          {/* ------------------------------------------------- step header */}
          <ol className="text-muted-foreground mb-5 flex items-center gap-2 text-xs font-medium">
            {["Company details", "Transport requirement"].map((label, index) => {
              const active = step === index + 1;
              return (
                <li key={label} className="flex items-center gap-2">
                  {index > 0 && <span aria-hidden>→</span>}
                  <span
                    aria-current={active ? "step" : undefined}
                    className={active ? "text-foreground" : ""}
                  >
                    {index + 1}. {label}
                  </span>
                </li>
              );
            })}
          </ol>

          {/* ------------------------------------------------------ step 1 */}
          <fieldset
            className={step === 1 ? "space-y-4" : "hidden"}
            disabled={isPending}
          >
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
              <TextField
                form={form}
                name="whatsapp"
                label="WhatsApp"
                placeholder="+264 81 123 4567"
                type="tel"
                autoComplete="tel"
                description="WhatsApp or email — either is enough."
              />
              <TextField form={form} name="companyRegistration" label="Company registration (optional)" placeholder="e.g. CC/2020/01234" />
              <TextField form={form} name="billingAddress" label="Billing address (optional)" placeholder="For the formal quotation" autoComplete="street-address" />
            </div>

            <Button
              type="button"
              onClick={toStepTwo}
              size="lg"
              className="press bg-brand text-brand-foreground hover:bg-brand-hover h-12 w-full sm:w-auto"
            >
              Continue to requirement
              <ArrowRightIcon className="size-4" aria-hidden />
            </Button>
          </fieldset>

          {/* ------------------------------------------------------ step 2 */}
          <fieldset
            className={step === 2 ? "space-y-4" : "hidden"}
            disabled={isPending}
          >
            <legend className="sr-only">Transport requirement</legend>

            <FormField
              control={form.control}
              name="services"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What do you need?</FormLabel>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(
                      Object.entries(QUOTE_SERVICES) as [QuoteService, string][]
                    ).map(([value, label]) => {
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
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="routeSlug"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
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
                      Other routes and site runs are scoped in the final
                      quotation — describe them in the notes.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="vehicleClassId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vehicle type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-11 w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {vehicleClasses.map((vehicleClass) => (
                          <SelectItem key={vehicleClass.id} value={vehicleClass.id}>
                            {vehicleClass.name} · up to {vehicleClass.capacity} pax
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

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

              <TextField form={form} name="datesNote" label="Dates" placeholder="e.g. 15–18 September" />
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
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                className="press h-12"
              >
                <ArrowLeftIcon className="size-4" aria-hidden />
                Back
              </Button>
              <Button
                type="submit"
                size="lg"
                disabled={isPending}
                className="press bg-brand text-brand-foreground hover:bg-brand-hover h-12 flex-1 text-base sm:flex-none sm:px-8"
              >
                {isPending && (
                  <Loader2Icon className="size-4 animate-spin" aria-hidden />
                )}
                {isPending ? "Creating…" : "Create quotation"}
              </Button>
            </div>
          </fieldset>
        </div>

        {/* --------------------------------------------------- live estimate */}
        <aside className="bg-card rounded-xl border p-4 lg:sticky lg:top-20">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">
              {preview.isFormal ? "Your quotation" : "Your estimate"}
            </h2>
            <span
              className={[
                "rounded-md px-2 py-0.5 text-xs font-medium",
                preview.isFormal
                  ? "bg-success-subtle text-success"
                  : "bg-warning-subtle text-warning",
              ].join(" ")}
            >
              {preview.isFormal ? "Fixed pricing" : "Estimate"}
            </span>
          </div>

          <ul className="mt-3 space-y-2 text-sm">
            {preview.lines.length === 0 && (
              <li className="text-muted-foreground">
                Choose a route or service to see pricing.
              </li>
            )}
            {preview.lines.map((line) => (
              <li
                key={line.description}
                className="flex items-baseline justify-between gap-3"
              >
                <span className="text-muted-foreground min-w-0 leading-snug">
                  {line.description}
                  {line.unitPrice !== null && (
                    <span className="tabular block text-xs">
                      {line.quantity} × {formatNad(line.unitPrice)}
                    </span>
                  )}
                </span>
                <span className="tabular shrink-0 font-medium">
                  {line.lineTotal === null ? "TBC" : formatNad(line.lineTotal)}
                </span>
              </li>
            ))}
          </ul>

          <Separator className="my-3" />

          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="tabular font-medium">{formatNad(preview.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">
                {vatRate > 0 ? `VAT (${Math.round(vatRate * 100)}%)` : "VAT"}
              </dt>
              <dd className="tabular font-medium">
                {vatRate > 0 ? formatNad(preview.vatAmount) : "Not applicable"}
              </dd>
            </div>
          </dl>

          <div className="mt-3 border-t pt-3">
            <p className="text-muted-foreground text-xs font-medium">Total</p>
            <p className="tabular text-brand price-slot text-3xl leading-none font-semibold tracking-tight">
              {formatNad(preview.total)}
            </p>
            {!preview.isFormal && (
              <p className="text-muted-foreground mt-1.5 text-xs leading-snug">
                Items marked TBC are scoped by our team and added to the final
                quotation within 24 hours.
              </p>
            )}
          </div>
        </aside>
      </form>
    </Form>
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

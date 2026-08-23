"use client";

import * as React from "react";
import { CheckIcon, Loader2Icon } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

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
import { submitCorporateEnquiry } from "@/lib/corporate/actions";
import {
  corporateEnquirySchema,
  NEED_LABELS,
  type CorporateEnquiryValues,
} from "@/lib/corporate/schema";

export function CorporateEnquiryForm() {
  const [isPending, startTransition] = React.useTransition();
  const [sent, setSent] = React.useState(false);

  const form = useForm<CorporateEnquiryValues>({
    resolver: zodResolver(corporateEnquirySchema),
    mode: "onBlur",
    defaultValues: {
      companyName: "",
      contactName: "",
      whatsapp: "",
      email: "",
      needType: "airport_transfers",
      datesNote: "",
      notes: "",
      acquisitionSource: "",
    },
  });

  React.useEffect(() => {
    const referrer = typeof document !== "undefined" ? document.referrer : "";
    if (!referrer) {
      form.setValue("acquisitionSource", "direct");
      return;
    }
    try {
      const { host } = new URL(referrer);
      form.setValue(
        "acquisitionSource",
        host === window.location.host ? "direct" : `referrer:${host}`
      );
    } catch {
      form.setValue("acquisitionSource", "direct");
    }
  }, [form]);

  function onSubmit(values: CorporateEnquiryValues) {
    startTransition(async () => {
      const result = await submitCorporateEnquiry(values);
      if (result.ok) {
        setSent(true);
      } else {
        toast.error("We could not send your enquiry", {
          description: result.message,
        });
      }
    });
  }

  if (sent) {
    return (
      <div
        className="bg-success-subtle border-success/30 rounded-xl border p-6"
        role="status"
      >
        <span className="bg-success text-background inline-flex size-8 items-center justify-center rounded-full">
          <CheckIcon className="size-4" aria-hidden />
        </span>
        <h2 className="mt-3 text-lg font-semibold">Enquiry received</h2>
        <p className="mt-1.5 text-sm leading-snug">
          We&rsquo;ll respond with a quotation within 24 hours on
          WhatsApp/email.
        </p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <fieldset className="space-y-4" disabled={isPending}>
          <legend className="sr-only">Corporate enquiry</legend>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="companyName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company</FormLabel>
                  <FormControl>
                    <Input
                      className="h-11"
                      autoComplete="organization"
                      placeholder="Company name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contactName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact name</FormLabel>
                  <FormControl>
                    <Input
                      className="h-11"
                      autoComplete="name"
                      placeholder="Who should we speak to?"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="whatsapp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>WhatsApp</FormLabel>
                  <FormControl>
                    <Input
                      className="h-11"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="+264 81 123 4567"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      className="h-11"
                      type="email"
                      autoComplete="email"
                      placeholder="you@company.com"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    WhatsApp or email — either is enough.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="needType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What do you need?</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-11 w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(NEED_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="approxPassengers"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Approximate passengers</FormLabel>
                  <FormControl>
                    <Input
                      className="h-11"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      placeholder="e.g. 12"
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value)
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
          </div>

          <FormField
            control={form.control}
            name="datesNote"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dates</FormLabel>
                <FormControl>
                  <Input
                    className="h-11"
                    placeholder="e.g. 14-18 March, or ongoing from June"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Anything else (optional)</FormLabel>
                <FormControl>
                  <textarea
                    rows={3}
                    placeholder="Routes, frequency, billing requirements."
                    className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs outline-none focus-visible:ring-[3px] md:text-sm"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </fieldset>

        <Button
          type="submit"
          size="lg"
          disabled={isPending}
          className="press bg-brand text-brand-foreground hover:bg-brand-hover h-12 w-full text-base sm:w-auto"
        >
          {isPending && <Loader2Icon className="size-4 animate-spin" aria-hidden />}
          {isPending ? "Sending…" : "Request a quotation"}
        </Button>

        <p className="text-muted-foreground text-xs">
          We respond with a quotation within 24 hours on WhatsApp or email.
        </p>
      </form>
    </Form>
  );
}

import type { RouteView, VehicleClassView } from "@/lib/maps/types";
import { toMoneyString } from "@/lib/money";
import { pricingUnitLabel, unitFare } from "@/lib/pricing";

/**
 * Corporate quotation maths — pure and client-safe, so the on-page estimate
 * and the server action price identically. The server re-derives everything
 * from the database on submit; the browser's numbers are never trusted.
 *
 * Anything we cannot price from the routes table (site transport, waiting
 * time, extra stops) becomes an explicit unpriced line and downgrades the
 * result from a formal quotation to an estimate — the document always says
 * which it is.
 */

export const QUOTE_SERVICES = {
  airport_transfers: "Airport transfers",
  intercity: "Intercity transfers",
  executive: "Executive transport",
  employee_site: "Employee / site transport",
  conference_event: "Conference or event transport",
  group: "Group transport",
} as const;

export type QuoteService = keyof typeof QUOTE_SERVICES;

export const QUOTE_FREQUENCIES = {
  once: { label: "Once-off", multiplier: (days: number) => Math.max(1, days) },
  daily: { label: "Daily", multiplier: (days: number) => Math.max(1, days) },
  weekly: {
    label: "Weekly",
    multiplier: (weeks: number) => Math.max(1, weeks),
  },
} as const;

export type QuoteFrequency = keyof typeof QUOTE_FREQUENCIES;

export type QuoteRequirement = {
  services: QuoteService[];
  routeSlug: string | null;
  vehicleClassId: string | null;
  passengers: number;
  vehicles: number;
  frequency: QuoteFrequency;
  /** Days for once/daily, weeks for weekly. */
  periodCount: number;
  includeReturn: boolean;
  extraWaitingHours: number;
  extraStops: number;
};

export type QuoteLine = {
  description: string;
  quantity: number;
  /** Whole rand; null when the line needs manual pricing. */
  unitPrice: number | null;
  lineTotal: number | null;
};

export type QuoteComputation = {
  lines: QuoteLine[];
  /** Trips across the whole engagement (legs × frequency × return). */
  tripsCount: number;
  subtotal: number;
  vatAmount: number;
  total: number;
  /** False only when every line auto-priced from the routes table. */
  isFormal: boolean;
};

export function computeQuote(
  requirement: QuoteRequirement,
  routes: RouteView[],
  vehicleClasses: VehicleClassView[],
  vatRate: number
): QuoteComputation {
  const lines: QuoteLine[] = [];

  const route =
    routes.find((r) => r.slug === requirement.routeSlug) ?? null;
  const vehicleClass =
    vehicleClasses.find((c) => c.id === requirement.vehicleClassId) ??
    vehicleClasses[0] ??
    null;

  const legsPerTrip = requirement.includeReturn ? 2 : 1;
  const trips =
    QUOTE_FREQUENCIES[requirement.frequency].multiplier(
      requirement.periodCount
    ) * legsPerTrip;

  if (route && vehicleClass) {
    const unit = unitFare(route, vehicleClass);
    const perPerson = route.pricingUnit === "per_person";
    const quantity = perPerson
      ? Math.max(1, requirement.passengers) * trips
      : Math.max(1, requirement.vehicles) * trips;

    const legLabel = requirement.includeReturn ? " (incl. return legs)" : "";
    lines.push({
      description: perPerson
        ? `${route.originLabel} → ${route.destinationLabel} · ${vehicleClass.name}, ${pricingUnitLabel(route)}${legLabel}`
        : `${route.originLabel} → ${route.destinationLabel} · ${vehicleClass.name}, ${pricingUnitLabel(route)} × ${requirement.vehicles} vehicle${requirement.vehicles === 1 ? "" : "s"}${legLabel}`,
      quantity,
      unitPrice: unit,
      lineTotal: unit * quantity,
    });
  }

  // Services beyond the priced route become explicit to-be-quoted lines.
  const manualServices = requirement.services.filter(
    (service) => service !== "airport_transfers" && service !== "intercity"
  );
  for (const service of manualServices) {
    lines.push({
      description: `${QUOTE_SERVICES[service]} — scoped and priced with your final quotation`,
      quantity: 1,
      unitPrice: null,
      lineTotal: null,
    });
  }

  if (requirement.extraWaitingHours > 0) {
    lines.push({
      description: `Additional waiting time (${requirement.extraWaitingHours}h) — confirmed with your final quotation`,
      quantity: requirement.extraWaitingHours,
      unitPrice: null,
      lineTotal: null,
    });
  }

  if (requirement.extraStops > 0) {
    lines.push({
      description: `Additional stops (${requirement.extraStops}) — confirmed with your final quotation`,
      quantity: requirement.extraStops,
      unitPrice: null,
      lineTotal: null,
    });
  }

  const subtotal = lines.reduce((sum, line) => sum + (line.lineTotal ?? 0), 0);
  const vatAmount = Math.round(subtotal * vatRate * 100) / 100;
  const isFormal =
    lines.length > 0 && lines.every((line) => line.lineTotal !== null);

  return {
    lines,
    tripsCount: trips,
    subtotal,
    vatAmount,
    total: subtotal + vatAmount,
    isFormal,
  };
}

/** Decimal strings for persistence. */
export function quoteMoney(computation: QuoteComputation) {
  return {
    subtotal: toMoneyString(computation.subtotal),
    vatAmount: toMoneyString(computation.vatAmount),
    total: toMoneyString(computation.total),
  };
}

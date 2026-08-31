"use client";

import * as React from "react";
import { ArrowUpDownIcon } from "lucide-react";

import { QuoteWidget } from "@/components/booking/quote-widget";
import { useTrip } from "@/components/booking/use-trip";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDuration } from "@/lib/format";
import type { RouteView, VehicleClassView } from "@/lib/maps";
import { formatNad } from "@/lib/money";
import {
  journeyTitle,
  modelJourney,
  nodePairForRoute,
  withCuratedCeiling,
  type Journey,
} from "@/lib/network/journey";
import { nodeLabel, nodesByRegion, REGION_LABELS } from "@/lib/network/nodes";
import { describeRoads, describeVia } from "@/lib/network/roads";

/**
 * Quote any two places in Namibia.
 *
 * The road network and the fare model are ordinary modules with no server
 * imports, so the whole thing runs here: change the destination and the price
 * changes in the same frame, with no request and nothing to wait for. The
 * Server Action re-derives the fare from the same functions before it writes
 * anything, exactly as it does for a curated route — this is a preview, not a
 * price the browser gets to decide.
 */
export function JourneyPlanner({
  routes,
  vehicleClasses,
  initialFrom,
  initialTo,
}: {
  /** Curated routes. Where one covers the pair, its price wins. */
  routes: RouteView[];
  vehicleClasses: VehicleClassView[];
  initialFrom: string;
  initialTo: string;
}) {
  const [from, setFrom] = React.useState(initialFrom);
  const [to, setTo] = React.useState(initialTo);

  const groups = React.useMemo(() => nodesByRegion(), []);

  /**
   * A curated route for this pair beats the model every time. A price we have
   * published is a promise, and a quote page that undercut or overshot the
   * route page for the same drive would be worse than having no quote page.
   */
  const curatedByPair = React.useMemo(() => {
    const map = new Map<string, RouteView>();
    for (const route of routes) {
      const pair = nodePairForRoute(route);
      if (pair) map.set(`${pair.origin.slug}>${pair.destination.slug}`, route);
    }
    return map;
  }, [routes]);

  const journey: Journey | null = React.useMemo(() => {
    const modelled = modelJourney(from, to);
    return modelled ? withCuratedCeiling(modelled, routes) : null;
  }, [from, to, routes]);

  const curated = curatedByPair.get(`${from}>${to}`) ?? null;
  const route = curated ?? journey?.route ?? null;

  /** The same drive in the other direction, for the note below the quote. */
  const reverse = React.useMemo(() => {
    const curatedBack = curatedByPair.get(`${to}>${from}`);
    const modelledBack = modelJourney(to, from);
    if (!modelledBack) return null;
    return {
      route: curatedBack ?? withCuratedCeiling(modelledBack, routes).route,
      title: journeyTitle(modelledBack.road),
    };
  }, [curatedByPair, from, to, routes]);

  const trip = useTrip(route ? [route] : [], vehicleClasses);

  // from/to are the real state; the trip hook holds a slug of its own and has
  // to be told when the journey underneath it changes.
  const activeSlug = route?.slug;
  const setRouteSlug = trip?.setRouteSlug;
  React.useEffect(() => {
    if (activeSlug && setRouteSlug) setRouteSlug(activeSlug);
  }, [activeSlug, setRouteSlug]);

  function swap() {
    setFrom(to);
    setTo(from);
  }

  return (
    <div className="grid gap-4">
      {/* ------------------------------------------------------- the pair */}
      <div className="bg-card rounded-xl border p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          <PlacePicker
            id="journey-from"
            label="From"
            value={from}
            onChange={setFrom}
            groups={groups}
          />

          <button
            type="button"
            onClick={swap}
            aria-label="Swap origin and destination"
            className="border-input hover:bg-muted press focus-visible:ring-ring mb-0.5 hidden size-11 shrink-0 items-center justify-center rounded-md border focus-visible:ring-[3px] focus-visible:outline-none sm:inline-flex"
          >
            <ArrowUpDownIcon className="size-4 rotate-90" aria-hidden />
          </button>

          <PlacePicker
            id="journey-to"
            label="To"
            value={to}
            onChange={setTo}
            groups={groups}
          />
        </div>

        <button
          type="button"
          onClick={swap}
          className="text-muted-foreground hover:text-foreground press mt-3 inline-flex items-center gap-1.5 text-xs underline underline-offset-2 sm:hidden"
        >
          <ArrowUpDownIcon className="size-3" aria-hidden />
          Swap
        </button>

        {journey && <RoadDetail journey={journey} />}
      </div>

      {/* ------------------------------------------------------ the quote */}
      {trip && route ? (
        <>
          <QuoteWidget
            trip={trip}
            routes={[route]}
            lockRoute
            cta="Continue to booking"
          />

          {curated && (
            <p className="text-muted-foreground text-xs">
              This is one of our published routes, so you are seeing its
              published fare rather than a computed one.
            </p>
          )}

          {reverse && (
            <ReverseNote
              route={route}
              reverse={reverse.route}
              title={reverse.title}
            />
          )}
        </>
      ) : (
        <p className="text-muted-foreground bg-card rounded-xl border p-4 text-sm">
          Choose two different places to see a price.
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- the drive */

function RoadDetail({ journey }: { journey: Journey }) {
  const { road, overnights, hasGravel } = journey;
  const duration = formatDuration(road.minutes);
  const via = describeVia(road);

  return (
    <div className="mt-4 border-t pt-3">
      <p className="text-sm">
        <span className="tabular font-medium">{Math.round(road.km)} km</span>
        {duration && (
          <>
            {" · "}
            <span className="font-medium">about {duration}</span>
          </>
        )}{" "}
        <span className="text-muted-foreground">
          on {describeRoads(road)}
          {via ? `, ${via}` : ""}.
        </span>
      </p>

      {/* Both of these change what the day is actually like, so they are said
          before the price rather than discovered on the road. */}
      {hasGravel && (
        <p className="text-muted-foreground mt-1.5 text-xs">
          <span className="tabular text-foreground font-medium">
            {Math.round(road.gravelKm)} km
          </span>{" "}
          of this is gravel. It is slower than tar and it is why the drive takes
          longer than the distance suggests.
        </p>
      )}

      {overnights > 0 && (
        <p className="text-muted-foreground mt-1.5 text-xs">
          Too far to drive there and back in a day, so the driver stays over
          {overnights > 1 ? ` ${overnights} nights` : ""}. That is already in
          the price — there is nothing further to pay.
        </p>
      )}
    </div>
  );
}

/**
 * The asymmetry, said out loud.
 *
 * The same road costs different money in each direction, because a car
 * dropping someone at Sesriem drives back empty and a car bringing them to
 * Windhoek drives back into the market. That is not a discount we are being
 * generous with, it is what the drive costs — and a traveller planning a loop
 * can use it, so we say it instead of quietly keeping the difference.
 */
function ReverseNote({
  route,
  reverse,
  title,
}: {
  route: RouteView;
  reverse: RouteView;
  title: string;
}) {
  const here = Number(route.fixedPrice);
  const back = Number(reverse.fixedPrice);
  if (route.pricingUnit === "per_person" || reverse.pricingUnit === "per_person") {
    return null;
  }
  if (!(back < here * 0.9)) return null;

  return (
    <p className="bg-brand-subtle/45 text-muted-foreground rounded-xl border p-4 text-xs">
      The same drive the other way —{" "}
      <span className="text-foreground font-medium">{title}</span>{" "}
      — is{" "}
      <span className="tabular text-foreground font-medium">
        {formatNad(back)}
      </span>
      . Not a special offer: on the way out the car comes back empty, and on the
      way back it comes home to where the next booking is.
    </p>
  );
}

/* ------------------------------------------------------------- the picker */

function PlacePicker({
  id,
  label,
  value,
  onChange,
  groups,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (slug: string) => void;
  groups: ReturnType<typeof nodesByRegion>;
}) {
  return (
    <div className="grid gap-1.5">
      <label
        htmlFor={id}
        className="text-muted-foreground text-xs font-medium"
      >
        {label}
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="h-11 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-[22rem]">
          {groups.map((group) => (
            <SelectGroup key={group.region}>
              <SelectLabel>{REGION_LABELS[group.region]}</SelectLabel>
              {group.nodes.map((node) => (
                <SelectItem key={node.slug} value={node.slug}>
                  {nodeLabel(node)}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

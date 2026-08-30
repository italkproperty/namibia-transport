import { CheckIcon, PlaneIcon } from "lucide-react";

import { VehicleArt } from "@/components/vehicles/vehicle-art";
import { defaultTripDate } from "@/lib/booking/trip-params";
import { shortPlace } from "@/lib/format";
import type { RouteView } from "@/lib/maps";
import { formatNad } from "@/lib/money";

/**
 * How the booking actually goes, shown as the screens rather than as icons.
 *
 * "Three easy steps" with a tick, a pin and an envelope tells a traveller
 * nothing they did not assume. Miniatures of the real screens tell them how
 * long it takes and what they will be asked for — which is the actual question
 * behind hesitating on an unfamiliar site in a country they have not landed in.
 *
 * The figures come from the route passed in, never from a literal, so the
 * example price can never drift away from the live one.
 */
export function HowToBook({
  route,
  headingId = "how-to-book-heading",
}: {
  route: RouteView;
  headingId?: string;
}) {
  const perPerson = route.pricingUnit === "per_person";
  const price = formatNad(route.fixedPrice);

  // The same date the real widget opens on, so the miniature can never go
  // stale the way a hard-coded "Fri 12 Sep" would. Namibia is UTC+02:00 all
  // year, so the offset is stated rather than inferred from the runtime.
  const exampleDate = new Date(
    `${defaultTripDate()}T12:00:00+02:00`,
  ).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Africa/Windhoek",
  });

  return (
    <section aria-labelledby={headingId}>
      <p className="text-brand text-xs font-semibold tracking-[0.14em] uppercase">
        Booking
      </p>
      <h2 id={headingId} className="mt-1.5 text-xl sm:text-2xl">
        Three screens, about two minutes
      </h2>
      <p className="text-muted-foreground mt-1.5 max-w-2xl text-sm text-pretty">
        No account, no callback, no &ldquo;we will confirm availability and get
        back to you&rdquo;. You see the price before you type anything, and you
        leave with a reference.
      </p>

      <ol className="mt-6 grid gap-4 lg:grid-cols-3">
        <Step
          index={1}
          title="See the price"
          body="Pick the route, the date and the vehicle. The total updates as you choose — nothing is hidden until checkout."
        >
          <Mock>
            <MockField label="Route">
              {shortPlace(route.originLabel)} → {route.destinationLabel}
            </MockField>
            <div className="grid grid-cols-2 gap-1.5">
              <MockField label="Date">{exampleDate}</MockField>
              <MockField label="Time">14:30</MockField>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="bg-card rounded border px-1.5 py-1">
                <VehicleArt kind="sedan" className="opacity-90" />
              </div>
              <div className="rounded border border-dashed px-1.5 py-1 opacity-45">
                <VehicleArt kind="suv" />
              </div>
            </div>
            <div className="flex items-end justify-between border-t pt-2">
              <div>
                <p className="text-muted-foreground text-[0.55rem]">
                  Total, all in
                </p>
                <p className="tabular text-brand text-base leading-none font-semibold">
                  {price}
                </p>
              </div>
              <span className="bg-brand text-brand-foreground rounded px-2 py-1 text-[0.6rem] font-medium">
                Continue
              </span>
            </div>
          </Mock>
        </Step>

        <Step
          index={2}
          title="Say where, exactly"
          body="Choose your hotel or lodge from the list — no street-address guessing — and add a landmark if the driver will need one."
        >
          <Mock>
            <MockField label="Pick-up">
              {perPerson ? "Arrivals hall" : shortPlace(route.originLabel)}
            </MockField>
            <MockField label="Drop-off">Windhoek Country Club Resort</MockField>
            <MockField label="Flight number" icon>
              SA 074
            </MockField>
            <div className="bg-muted/60 text-muted-foreground rounded border px-2 py-1.5 text-[0.6rem] leading-snug">
              Landmark or gate note — optional, and worth more to a Namibian
              driver than a street name.
            </div>
          </Mock>
        </Step>

        <Step
          index={3}
          title="Confirm, and pay when you like"
          body="You get a reference straight away. Paying by card is optional — settling on the day is a supported choice, not a fallback."
        >
          <Mock>
            <div className="bg-success-subtle text-success flex items-center gap-1.5 rounded px-2 py-1.5 text-[0.62rem] font-medium">
              <CheckIcon className="size-3" aria-hidden />
              Booking confirmed
            </div>
            <div className="bg-card rounded border px-2 py-1.5">
              <p className="text-muted-foreground text-[0.55rem]">
                Your reference
              </p>
              <p className="tabular text-sm font-semibold tracking-wider">
                NT-4KQ8ZP
              </p>
            </div>
            <MockRow label="Driver &amp; registration">Before pickup</MockRow>
            <MockRow label="Flight monitoring">On</MockRow>
            <div className="grid grid-cols-2 gap-1.5">
              <span className="bg-brand text-brand-foreground rounded px-2 py-1 text-center text-[0.6rem] font-medium">
                Pay now
              </span>
              <span className="text-muted-foreground rounded border px-2 py-1 text-center text-[0.6rem] font-medium">
                Pay later
              </span>
            </div>
          </Mock>
        </Step>
      </ol>
    </section>
  );
}

function Step({
  index,
  title,
  body,
  children,
}: {
  index: number;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <li className="bg-card flex flex-col overflow-hidden rounded-2xl border">
      {/* The miniature is decorative: every word in it is repeated in the
          caption below, so a screen reader loses nothing by skipping it. */}
      {/* min-h keeps the three captions on one baseline: the miniatures are
          different heights, and staggered headings read as a layout bug. */}
      <div
        className="bg-brand-subtle/45 flex min-h-[17.5rem] items-center border-b p-4"
        aria-hidden
      >
        <div className="w-full">{children}</div>
      </div>
      <div className="flex-1 p-5">
        <div className="flex items-center gap-2">
          <span className="bg-brand text-brand-foreground tabular flex size-5 items-center justify-center rounded-full text-[0.62rem] font-semibold">
            {index}
          </span>
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <p className="text-muted-foreground mt-1.5 text-sm leading-snug text-pretty">
          {body}
        </p>
      </div>
    </li>
  );
}

/** The phone-sized frame every miniature sits in. */
function Mock({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background shadow-card mx-auto grid max-w-[15rem] gap-1.5 rounded-lg border p-2.5">
      {children}
    </div>
  );
}

function MockField({
  label,
  icon = false,
  children,
}: {
  label: string;
  icon?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-0.5">
      <p className="text-muted-foreground text-[0.55rem] font-medium">
        {label}
      </p>
      <p className="bg-card flex items-center gap-1 truncate rounded border px-1.5 py-1 text-[0.62rem]">
        {icon && (
          <PlaneIcon className="text-muted-foreground size-2.5 shrink-0" />
        )}
        {children}
      </p>
    </div>
  );
}

function MockRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <p className="flex items-center justify-between text-[0.6rem]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{children}</span>
    </p>
  );
}

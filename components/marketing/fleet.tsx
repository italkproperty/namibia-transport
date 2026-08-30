import Link from "next/link";
import { BriefcaseIcon, MessageCircleIcon, UsersIcon } from "lucide-react";

import { VehicleImage } from "@/components/vehicles/vehicle-image";
import { getCompanyInfo, whatsappLink } from "@/lib/company";
import type { VehicleClassView } from "@/lib/maps";
import { ENQUIRY_ONLY_VEHICLES, specFor } from "@/lib/vehicles";

/**
 * The vehicles, shown rather than described in a dropdown.
 *
 * A traveller choosing between "Private Car" and "SUV / 4x4" in a select box
 * is choosing between two strings. Seeing the shapes side by side — one low
 * and long, one tall on big wheels — makes the N$260 difference obvious
 * without reading a word, and makes the booking feel like it is attached to a
 * real vehicle rather than a database row.
 *
 * The honesty line is not decoration. We are a booking and dispatch layer, not
 * a fleet owner, so the section says what class you are buying and who tells
 * you which car it turned out to be.
 */
export function FleetSection({
  vehicleClasses,
  headingId = "fleet-heading",
}: {
  vehicleClasses: VehicleClassView[];
  headingId?: string;
}) {
  const company = getCompanyInfo();
  // Built with flatMap rather than filter so `spec` narrows to defined: a
  // class in the database with no spec here simply does not get a card.
  const bookable = vehicleClasses.flatMap((vehicleClass) => {
    const spec = specFor(vehicleClass.slug);
    return spec ? [{ vehicleClass, spec }] : [];
  });

  if (bookable.length === 0) return null;

  return (
    <section aria-labelledby={headingId}>
      <p className="text-brand text-xs font-semibold tracking-[0.14em] uppercase">
        The vehicles
      </p>
      <h2 id={headingId} className="mt-1.5 text-xl sm:text-2xl">
        What you are booking
      </h2>
      <p className="text-muted-foreground mt-1.5 max-w-2xl text-sm text-pretty">
        You book a class, not a number plate. Which car in that class is on your
        trip is confirmed to you &mdash; make, model and registration &mdash;
        before pickup, so you know what to look for.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {bookable.map(({ vehicleClass, spec }) => (
          <article
            key={vehicleClass.id}
            className="bg-card flex flex-col overflow-hidden rounded-2xl border"
          >
            {/* A drawing sits on the brand-tinted panel. Photographs get a
                soft neutral instead: stock vehicle shots do not agree on a
                background — one cut out on white, one on a grey studio sweep,
                one transparent — and a mid neutral is the one panel none of
                them reads as a pasted-on box against. */}
            <div
              className={`border-b px-5 py-4 ${
                spec.photo ? "bg-muted/50" : "bg-brand-subtle/45"
              }`}
            >
              <VehicleImage
                spec={spec}
                alt={`${vehicleClass.name} — side view`}
                className="mx-auto max-w-[22rem]"
              />
            </div>

            <div className="flex flex-1 flex-col p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h3 className="text-base font-semibold">{vehicleClass.name}</h3>
                <p className="text-muted-foreground flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1">
                    <UsersIcon className="size-3.5" aria-hidden />
                    up to {vehicleClass.capacity}
                  </span>
                  <span className="flex items-center gap-1">
                    <BriefcaseIcon className="size-3.5" aria-hidden />
                    {vehicleClass.luggageCapacity} bags
                  </span>
                </p>
              </div>

              <p className="text-muted-foreground mt-1.5 text-sm leading-snug text-pretty">
                {spec.bestFor}
              </p>

              <p className="mt-3 text-sm">
                <span className="text-muted-foreground">Typically a </span>
                <span className="font-medium">{spec.typicalModels}</span>
              </p>

              <ul className="mt-3 space-y-1.5 border-t pt-3">
                {spec.points.map((point) => (
                  <li
                    key={point}
                    className="text-muted-foreground flex gap-2 text-sm leading-snug"
                  >
                    <span
                      className="bg-brand mt-[0.45rem] size-1 shrink-0 rounded-full"
                      aria-hidden
                    />
                    <span className="text-pretty">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>

      {/* Groups. Shown honestly as an enquiry, because we have not priced it. */}
      {ENQUIRY_ONLY_VEHICLES.map((spec) => (
        <div
          key={spec.slug}
          className="mt-4 grid items-center gap-5 rounded-2xl border border-dashed p-5 sm:grid-cols-[minmax(0,15rem)_1fr]"
        >
          <VehicleImage spec={spec} alt={`${spec.name} — side view`} />

          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="text-base font-semibold">{spec.name}</h3>
              <p className="text-muted-foreground text-xs">{spec.capacity}</p>
              <p className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[0.65rem] font-medium tracking-wide uppercase">
                Not bookable online yet
              </p>
            </div>

            <p className="text-muted-foreground mt-1.5 text-sm leading-snug text-pretty">
              {spec.bestFor} Typically a{" "}
              <span className="text-foreground font-medium">
                {spec.typicalModels}
              </span>
              . We have not set an online price for this class, so we quote it
              by hand &mdash; send us the trip and the group size and we come
              back with a figure.
            </p>

            {company.whatsapp ? (
              <a
                href={whatsappLink(
                  company.whatsapp,
                  "Hi — I need a transfer for a group. ",
                )}
                className="press bg-brand text-brand-foreground hover:bg-brand-hover mt-3.5 inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-medium"
              >
                <MessageCircleIcon className="size-4" aria-hidden />
                Ask for a group price
              </a>
            ) : (
              <Link
                href="/corporate"
                className="press mt-3.5 inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium"
              >
                Request a quotation
              </Link>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}

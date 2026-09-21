import { MessageCircleIcon, PhoneIcon } from "lucide-react";

import { whatsappLink } from "@/lib/company";

/**
 * Who is meeting you, with a face where we have one.
 *
 * The homepage promises you will know who is meeting you before you land, and
 * until now this page delivered that as a name in bold. A name is not
 * recognition — in an arrivals hall at 23:00 a photograph is the difference
 * between scanning a crowd and walking straight over.
 *
 * The photograph must be of the driver who is actually coming. There is no
 * stock fallback and there will not be one: a generic portrait attached to a
 * real person's name is a lie told to someone about to get into a car with a
 * stranger, and it is worth more to us that the initials are honest. So when
 * there is no photograph on file the traveller sees a monogram, which says
 * plainly that we have not got one rather than pretending otherwise.
 */
export function DriverCard({
  name,
  photoUrl,
  phone,
  whatsapp,
  vehicle,
  registration,
}: {
  name: string;
  photoUrl: string | null;
  phone: string | null;
  whatsapp: string | null;
  vehicle: string | null;
  registration: string | null;
}) {
  const number = phone ?? whatsapp;

  return (
    <section
      aria-labelledby="driver-heading"
      className="bg-success-subtle mt-5 rounded-xl border p-4"
    >
      <p
        id="driver-heading"
        className="text-success text-xs font-semibold tracking-[0.14em] uppercase"
      >
        Your driver
      </p>

      <div className="mt-2.5 flex items-center gap-3.5">
        <Avatar name={name} photoUrl={photoUrl} />

        <div className="min-w-0">
          <p className="text-lg leading-tight font-semibold">{name}</p>
          {vehicle && (
            <p className="mt-1 text-sm">
              <span className="text-muted-foreground">Look for </span>
              <span className="font-medium">{vehicle}</span>
              {registration && (
                <span className="tabular ml-2 rounded bg-white/70 px-1.5 py-0.5 text-xs font-semibold tracking-wider">
                  {registration}
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {number && (
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={`tel:${number.replace(/\s/g, "")}`}
            className="press focus-ring bg-card inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium"
          >
            <PhoneIcon className="size-3.5" aria-hidden />
            {number}
          </a>
          {whatsapp && (
            <a
              href={whatsappLink(whatsapp, "Hi — I am your passenger today.")}
              target="_blank"
              rel="noopener noreferrer"
              className="press focus-ring bg-card inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium"
            >
              <MessageCircleIcon className="size-3.5" aria-hidden />
              WhatsApp
            </a>
          )}
        </div>
      )}
    </section>
  );
}

/** Initials when there is no photograph, because inventing one is not an option. */
function Avatar({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  if (photoUrl) {
    return (
      // A plain <img>: driver photographs are uploaded by operations to a host
      // next/image is not configured for, and a broken optimiser on this
      // element would take the whole page down with it.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={`${name}, your driver`}
        width={56}
        height={56}
        className="size-14 shrink-0 rounded-full border-2 border-white object-cover shadow-sm"
      />
    );
  }

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span
      aria-hidden
      className="bg-brand text-brand-foreground flex size-14 shrink-0 items-center justify-center rounded-full border-2 border-white text-lg font-semibold shadow-sm"
    >
      {initials}
    </span>
  );
}

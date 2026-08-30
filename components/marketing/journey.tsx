import {
  CarFrontIcon,
  CheckCircle2Icon,
  MapPinIcon,
  MessageCircleIcon,
  PlaneIcon,
  UserCheckIcon,
} from "lucide-react";

/**
 * The journey, as a diagram rather than documentation.
 *
 * Six paragraphs of reassurance read as a terms page; six connected stages
 * read as an operation. The horizontal rail on desktop and the vertical spine
 * on mobile carry the same six steps — the visual line is the point, because
 * it shows the trip is handled end to end rather than listing promises.
 */

const STAGES = [
  {
    key: "BOOKED",
    icon: CheckCircle2Icon,
    title: "Booked",
    body: "A unique reference, the moment you confirm.",
  },
  {
    key: "MONITORED",
    icon: PlaneIcon,
    title: "Monitored",
    body: "We track your flight and move the pickup if it slips.",
  },
  {
    key: "ASSIGNED",
    icon: UserCheckIcon,
    title: "Assigned",
    body: "One of our transport partners is put on your journey.",
  },
  {
    key: "CONFIRMED",
    icon: MessageCircleIcon,
    title: "Confirmed",
    body: "Driver name, vehicle and registration sent to you.",
  },
  {
    key: "MET",
    icon: MapPinIcon,
    title: "Met",
    body: "Your driver waits at arrivals with your name.",
  },
  {
    key: "ARRIVED",
    icon: CarFrontIcon,
    title: "Arrived",
    body: "Direct to your destination. No meter, no detours.",
  },
] as const;

export function JourneyTimeline({
  headingId = "journey-heading",
}: {
  headingId?: string;
}) {
  return (
    <section aria-labelledby={headingId}>
      <p className="text-brand text-xs font-semibold tracking-[0.14em] uppercase">
        Your journey
      </p>
      <h2 id={headingId} className="mt-1.5 text-xl sm:text-2xl">
        Managed from booking to arrival
      </h2>
      <p className="text-muted-foreground mt-1.5 max-w-xl text-sm text-pretty">
        Every stage is somebody&rsquo;s job here, not yours. This is what runs
        between the moment you book and the moment you arrive.
      </p>

      <ol className="mt-7 grid gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
        {STAGES.map((stage, index) => (
          <li key={stage.key} className="relative">
            {/* The rail: drawn between markers, never past the last one. */}
            {index < STAGES.length - 1 && (
              <span
                aria-hidden
                className="bg-border absolute top-5 left-[calc(50%+1.75rem)] hidden h-px w-[calc(100%-3.5rem)] lg:block"
              />
            )}

            <div className="flex flex-col items-start lg:items-center lg:text-center">
              <span className="bg-brand-subtle text-brand relative z-10 flex size-10 items-center justify-center rounded-full">
                <stage.icon
                  className="size-[18px]"
                  strokeWidth={1.9}
                  aria-hidden
                />
              </span>

              <p className="text-muted-foreground tabular mt-3 text-[0.65rem] font-semibold tracking-[0.12em]">
                {String(index + 1).padStart(2, "0")}
              </p>
              <p className="mt-0.5 text-sm font-semibold">{stage.title}</p>
              <p className="text-muted-foreground mt-1 max-w-[22ch] text-sm leading-snug text-pretty">
                {stage.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

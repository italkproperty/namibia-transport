import Image from "next/image";
import { ArrowRightIcon, CheckCircle2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";

export function RealTripProof() {
  return (
    <section
      aria-labelledby="real-trip-heading"
      className="mx-auto mt-14 max-w-5xl px-4 sm:mt-20 sm:px-6"
    >
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="grid lg:grid-cols-[1.08fr_0.92fr]">
          <div className="relative min-h-[360px] bg-muted lg:min-h-[470px]">
            <Image
              src="/proof/ping-tomo-vehicle.webp"
              alt="Namibia Transport vehicle on a Namibian mountain road during a customer journey"
              fill
              sizes="(max-width: 1024px) 100vw, 54vw"
              className="object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent p-6 pt-24 text-white">
              <p className="font-mono text-[0.68rem] tracking-[0.16em] uppercase">
                Real trip · October 2026
              </p>
              <p className="mt-2 text-lg font-semibold">
                Etango Ranch Guest Farm → Namib Desert Lodge
              </p>
            </div>
          </div>

          <div className="flex flex-col justify-center p-6 sm:p-8">
            <p className="text-brand font-mono text-[0.68rem] tracking-[0.16em] uppercase">
              Real customers. Real journeys.
            </p>

            <h2
              id="real-trip-heading"
              className="mt-2 max-w-md text-2xl font-semibold tracking-tight sm:text-3xl"
            >
              See what a Namibia Transport journey actually looks like.
            </h2>

            <blockquote className="mt-6 border-l-2 border-brand pl-4 text-lg leading-relaxed text-pretty sm:text-xl">
              “Our driver was there, communication was easy, and the whole trip
              was seamless.”
            </blockquote>

            <p className="mt-3 text-sm font-medium">
              — Ping &amp; Tomo, USA
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Etango Ranch Guest Farm → Namib Desert Lodge
            </p>

            <div className="mt-6 grid gap-2 text-sm">
              {[
                "Real Namibia Transport customer",
                "Private vehicle and local driver",
                "Customer conversation shown with identifying details redacted",
              ].map((item) => (
                <p key={item} className="flex items-start gap-2">
                  <CheckCircle2Icon
                    className="text-brand mt-0.5 size-4 shrink-0"
                    aria-hidden
                  />
                  <span>{item}</span>
                </p>
              ))}
            </div>

            <Button asChild className="press mt-7 h-11 w-full sm:w-fit">
              <a href="#quote">
                Price your own journey
                <ArrowRightIcon className="size-4" aria-hidden />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

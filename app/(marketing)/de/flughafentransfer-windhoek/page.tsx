import type { Metadata } from "next";
import Link from "next/link";

import { BrandMark } from "@/components/brand/logo";
import { Fare } from "@/components/currency/fare";
import { getRouteBySlug } from "@/lib/maps";
import { getCompanyInfo, whatsappLink } from "@/lib/company";
import { SITE } from "@/lib/site";

/**
 * A German-language ad landing page for the airport transfer.
 *
 * Germany is the largest overseas source market for Namibia tourism, and the
 * English pages reach none of it — German travellers search in German. This is
 * a standalone landing page, not a translation of the whole site: the booking
 * flow it links to is still English, which is an accepted first-version limit.
 *
 * The price is read from the same route record the English pages use, never
 * typed here, so a pricing change can never leave this page quoting a stale
 * figure. Every claim is one the site can stand behind at 03:00 — no "24/7",
 * no "lizenzierte" drivers, nothing invented.
 *
 * The copy is careful German, but it is machine-authored: have a native
 * speaker read it once before spending on traffic to it.
 */

const ROUTE_SLUG = "hosea-kutako-to-windhoek";
const EN_URL = `${SITE.url}/transfers/${ROUTE_SLUG}`;
const DE_URL = `${SITE.url}/de/flughafentransfer-windhoek`;
const BOOK_HREF = `/transfers/${ROUTE_SLUG}`;

export const metadata: Metadata = {
  title: "Flughafentransfer Windhoek — Privater Fahrer, Festpreis",
  description:
    "Privater Transfer vom Flughafen Hosea Kutako nach Windhoek. Fester Preis pro Fahrzeug, Empfang in der Ankunftshalle, online buchbar. Zahlung per Karte oder Überweisung.",
  alternates: {
    canonical: DE_URL,
    languages: { "en": EN_URL, "de": DE_URL, "x-default": EN_URL },
  },
  openGraph: {
    type: "website",
    url: DE_URL,
    title: "Flughafentransfer Windhoek — Privater Fahrer, Festpreis",
    description:
      "Privater Transfer vom Flughafen Hosea Kutako nach Windhoek. Fester Preis pro Fahrzeug, Empfang in der Ankunftshalle.",
    siteName: SITE.name,
    locale: "de_DE",
  },
};

export const revalidate = 3600;

export default async function Page() {
  const route = await getRouteBySlug(ROUTE_SLUG);
  const company = getCompanyInfo();
  const price = route?.fixedPrice ?? null;

  return (
    <div lang="de" className="bg-background text-foreground flex min-h-svh flex-col">
      {/* Minimal header — an ad landing page keeps exits few. */}
      <header className="flex items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/de/flughafentransfer-windhoek" className="flex items-center gap-2" aria-label="Namibia Transport">
          <BrandMark size={34} />
          <span className="font-semibold tracking-tight">Namibia Transport</span>
        </Link>
        <Link
          href={BOOK_HREF}
          className="press bg-brand text-brand-foreground hover:bg-brand-hover rounded-md px-4 py-2 text-sm font-medium"
        >
          Preis ansehen
        </Link>
      </header>

      <main className="flex-1">
        {/* ------------------------------------------------------------ hero */}
        <section className="bg-foreground text-background relative overflow-hidden">
          <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
            <p className="text-background/55 font-mono text-[0.7rem] tracking-[0.16em] uppercase">
              Flughafentransfer · Windhoek
            </p>
            <h1 className="mt-4 max-w-3xl text-3xl leading-[1.08] font-semibold tracking-[-0.02em] sm:text-5xl">
              Privattransfer vom Flughafen Hosea Kutako nach Windhoek
            </h1>
            <p className="text-background/70 mt-5 max-w-xl text-base leading-relaxed sm:text-lg">
              Fester Preis für das ganze Fahrzeug. Ihr Fahrer erwartet Sie in der Ankunftshalle
              mit Namensschild und hilft mit dem Gepäck. Preis vorab, online buchbar.
            </p>

            {price && (
              <div className="mt-7 inline-flex flex-col rounded-xl border border-white/15 bg-white/5 px-5 py-4">
                <span className="text-background/60 text-xs">Ab</span>
                <span className="text-2xl font-semibold">
                  <Fare nad={price} /> <span className="text-background/60 text-base font-normal">pro Fahrzeug</span>
                </span>
                <span className="text-background/60 mt-1 text-xs">
                  Limousine. Größere Fahrzeuge für mehr Personen und Gepäck verfügbar.
                </span>
              </div>
            )}

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href={BOOK_HREF}
                className="press bg-brand text-brand-foreground hover:bg-brand-hover inline-flex h-12 items-center rounded-md px-6 text-sm font-medium"
              >
                Preis ansehen & buchen
              </Link>
              <a
                href={company.whatsapp ? whatsappLink(company.whatsapp, "Hallo Namibia Transport, ich interessiere mich für einen Flughafentransfer nach Windhoek.") : "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="text-background/80 hover:text-background inline-flex h-12 items-center rounded-md border border-white/20 px-6 text-sm font-medium"
              >
                Auf WhatsApp fragen
              </a>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------- vertrauen */}
        <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
          <ul className="grid gap-4 sm:grid-cols-2">
            {[
              ["Fester Preis, kein Taxameter", "Sie sehen den vollständigen Preis, bevor Sie buchen. Keine Überraschungen bei der Ankunft."],
              ["Privat, kein Sammeltaxi", "Das ganze Fahrzeug gehört Ihnen und Ihrer Gruppe. Direkt zu Ihrer Unterkunft."],
              ["Empfang in der Ankunftshalle", "Ihr Fahrer wartet mit einem Namensschild und hilft Ihnen mit dem Gepäck."],
              ["Wir kennen Ihre Flugnummer", "Eine Verspätung erreicht uns direkt, und Ihr Fahrer passt die Abholung an."],
            ].map(([title, body]) => (
              <li key={title} className="bg-card rounded-xl border p-5">
                <p className="font-medium">{title}</p>
                <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{body}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ------------------------------------------------------------ ablauf */}
        <section className="bg-muted/40 border-y">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
            <h2 className="text-xl font-semibold sm:text-2xl">So funktioniert es</h2>
            <ol className="mt-6 grid gap-5 sm:grid-cols-3">
              {[
                ["1", "Preis erhalten & buchen", "Geben Sie Ihre Fahrt online ein, sehen Sie den Festpreis und buchen Sie in wenigen Minuten."],
                ["2", "Bezahlen", "Zahlen Sie per Karte oder Banküberweisung. Die Zahlung bestätigt Ihr Fahrzeug."],
                ["3", "Empfangen werden", "Ihr Fahrer empfängt Sie am Flughafen und bringt Sie zu Ihrer Adresse in Windhoek."],
              ].map(([n, title, body]) => (
                <li key={n} className="bg-card rounded-xl border p-5">
                  <span className="bg-brand text-brand-foreground inline-flex size-7 items-center justify-center rounded-full text-sm font-semibold">
                    {n}
                  </span>
                  <p className="mt-3 font-medium">{title}</p>
                  <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{body}</p>
                </li>
              ))}
            </ol>
            <p className="text-muted-foreground mt-6 text-sm">
              Zahlung per Karte oder Banküberweisung. Erreichbar täglich 06:00–22:00 (Namibia, UTC+2).
            </p>
          </div>
        </section>

        {/* --------------------------------------------------------------- faq */}
        <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
          <h2 className="text-xl font-semibold sm:text-2xl">Häufige Fragen</h2>
          <dl className="mt-6 space-y-6">
            {[
              [
                "Wie viel kostet der Transfer?",
                "Ein fester Preis für das ganze Fahrzeug, vorab angezeigt — nicht pro Person. Die Anzahl der Personen und des Gepäcks bestimmt nur die Fahrzeugklasse, nicht den Grundpreis.",
              ],
              [
                "Was passiert, wenn mein Flug Verspätung hat?",
                "Wir hinterlegen Ihre Flugnummer. Ihr Fahrer verfolgt die Ankunft und passt die Abholzeit an, ohne zusätzliche Absprache.",
              ],
              [
                "Wie bezahle ich?",
                "Per Karte online oder per Banküberweisung in namibischen Dollar. Ihre Buchung ist bestätigt, sobald die Zahlung eingegangen ist — eine Buchung allein hält nur den Preis.",
              ],
              [
                "Ist das ein geteilter Shuttle?",
                "Nein. Es ist ein privates Fahrzeug für Sie und Ihre Gruppe, direkt zu Ihrer Unterkunft, ohne Zwischenstopps für andere Fahrgäste.",
              ],
            ].map(([q, a]) => (
              <div key={q}>
                <dt className="font-medium">{q}</dt>
                <dd className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{a}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link
              href={BOOK_HREF}
              className="press bg-brand text-brand-foreground hover:bg-brand-hover inline-flex h-12 items-center rounded-md px-6 text-sm font-medium"
            >
              Preis ansehen & buchen
            </Link>
            <span className="text-muted-foreground text-sm">Die Buchung erfolgt auf Englisch.</span>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="text-muted-foreground mx-auto max-w-5xl px-4 py-8 text-xs leading-relaxed sm:px-6">
          <p className="text-foreground font-medium">Namibia Transport</p>
          <p className="mt-1">
            Ein Handelsname der Chrimson Investments CC
            {company.registration ? ` · Reg. ${company.registration}` : ""}
            {company.location ? ` · ${company.location}` : ""}
          </p>
          <p className="mt-1">
            {[company.whatsapp && `WhatsApp ${company.whatsapp}`, company.email].filter(Boolean).join(" · ")}
          </p>
        </div>
      </footer>
    </div>
  );
}

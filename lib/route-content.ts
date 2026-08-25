import { formatDuration, shortPlace } from "@/lib/format";
import { formatNad } from "@/lib/money";
import type { RouteView } from "@/lib/maps";

/** Human title for a route, used in H1s, meta and the booking summary. */
export function routeTitle(route: RouteView): string {
  return `${shortPlace(route.originLabel)} to ${route.destinationLabel}`;
}

export type Faq = { question: string; answer: string };

/**
 * FAQs are derived from the route's own data rather than hand-written per
 * page, so a new route in the database arrives with a complete page. Answers
 * quote real figures — never invent a detail we cannot honour.
 */
export function routeFaqs(route: RouteView): Faq[] {
  const duration = formatDuration(route.durationMin);
  const price = formatNad(route.fixedPrice);
  const isAirport = route.category === "airport";

  const perPerson = route.pricingUnit === "per_person";

  const faqs: Faq[] = [
    {
      question: `How much is a transfer from ${shortPlace(route.originLabel)} to ${route.destinationLabel}?`,
      answer: perPerson
        ? `${price} per person in a private sedan. The price is fixed when you book — there is no meter, no surge pricing and no airport surcharge. A larger SUV or 4x4 is available at a higher fixed rate.`
        : `${price} for the whole vehicle in a private sedan. The price is fixed when you book — there is no meter, no surge pricing and no airport surcharge. A larger SUV or 4x4 is available at a higher fixed rate.`,
    },
    {
      question: "Is the price per person or per vehicle?",
      answer: perPerson
        ? "This route is priced per person, so your total is simply the rate multiplied by your party size — shown in full before you book."
        : "Per vehicle. Two people and three people pay the same, so the fare works out well for couples, families and small groups.",
    },
  ];

  if (duration) {
    faqs.push({
      question: "How long does the drive take?",
      answer: `About ${duration} in normal conditions, direct and without other passengers. Your driver will build in comfort stops on the longer routes.`,
    });
  }

  if (isAirport) {
    faqs.push(
      {
        question: "What happens if my flight is delayed?",
        answer:
          "We monitor your inbound flight and move the pickup to match the actual landing time. There is no waiting charge for a delay outside your control — that is why we ask for your flight number.",
      },
      {
        question: "Where will I meet my driver?",
        answer:
          "Inside the arrivals hall, holding a name board, after you clear immigration and collect your bags. If anything goes wrong you will have a WhatsApp number to reach us on directly.",
      }
    );
  } else {
    faqs.push({
      question: "Where does the driver pick me up?",
      answer:
        "Anywhere you choose in the pickup town — hotel, guesthouse, office or private address. Tell us the landmark when you book and your driver will confirm on WhatsApp.",
    });
  }

  faqs.push({
    question: "How and when do I pay?",
    answer:
      "You book now and confirm payment afterwards. We will send payment details and your confirmation on WhatsApp; your fare is locked in the moment you book.",
  });

  return faqs;
}

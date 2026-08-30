/**
 * Arrival-logistics guides.
 *
 * Not a blog. A blog would compete for "things to do in Namibia" against
 * guidebooks and every tour operator in the country, and that traffic does not
 * convert. These answer the narrow, boring, high-intent questions someone asks
 * once their flight is already booked — and each one ends at a route they can
 * price and book.
 *
 * Every factual claim here must be one we can stand behind. No invented
 * opening hours, no promised capabilities, no numbers we have not checked.
 */

export type GuideSection = { heading: string; body: string[] };

export type Guide = {
  slug: string;
  /** The question as someone would actually type it. */
  title: string;
  metaTitle: string;
  metaDescription: string;
  /** One-line answer, shown first — most readers need only this. */
  answer: string;
  sections: GuideSection[];
  /** Route slugs this guide should send the reader to. */
  routes: string[];
  updated: string;
};

export const GUIDES: Guide[] = [
  {
    slug: "getting-from-hosea-kutako-airport-to-windhoek",
    title: "Getting from Hosea Kutako Airport to Windhoek",
    metaTitle:
      "How to Get from Hosea Kutako Airport to Windhoek — Options and Costs",
    metaDescription:
      "There is no train or scheduled shuttle from Hosea Kutako International Airport to Windhoek. What your options actually are, what each costs, and how long the 45 km drive takes.",
    answer:
      "There is no train and no reliable scheduled bus. It is roughly 45 kilometres and about 45 minutes on the B6, and the realistic choices are a pre-booked private transfer, an airport taxi, or a hire car.",
    sections: [
      {
        heading: "What is actually available",
        body: [
          "Hosea Kutako International Airport sits about 45 kilometres east of Windhoek. Nothing runs on rails, and there is no dependable scheduled shuttle timed to flights, so every option is a road transfer of one kind or another.",
          "A pre-booked private transfer means a named driver waiting in arrivals with a board, at a price agreed before you fly. An airport taxi means negotiating at the rank on arrival, usually in cash, at a price that varies. A hire car means paperwork at the desk and then a night drive on an unfamiliar road if you land late.",
        ],
      },
      {
        heading: "How long the drive takes",
        body: [
          "About 45 minutes in normal conditions. The B6 is tarred the whole way and generally quiet. Allow longer in the late afternoon heading into the city.",
          "Most international arrivals land in the early afternoon, which puts you into Windhoek comfortably before dark.",
        ],
      },
      {
        heading: "If your flight is delayed",
        body: [
          "This is the main argument for booking ahead rather than arranging something on landing. We ask for your flight number and track the inbound aircraft, so the pickup moves with the actual landing time and a delay outside your control carries no waiting charge.",
          "Arriving at 02:00 to find the taxi rank thin is a different experience from walking out to someone holding your name.",
        ],
      },
      {
        heading: "What it costs",
        body: [
          "Our fixed price for the airport to Windhoek CBD is quoted per person and shown in full before you book — no meter, no surge and no airport surcharge. A larger SUV or 4x4 is available at a higher fixed rate.",
        ],
      },
    ],
    routes: ["hosea-kutako-to-windhoek"],
    updated: "2026-08-27",
  },
  {
    slug: "windhoek-to-swakopmund-by-road",
    title: "Windhoek to Swakopmund by road",
    metaTitle:
      "Windhoek to Swakopmund by Road — Distance, Drive Time and Options",
    metaDescription:
      "About 360 km and four hours on the B2 through Karibib and Usakos. What the drive is like, whether to self-drive, and what a private transfer costs.",
    answer:
      "It is about 360 kilometres and roughly four hours on the B2, tarred the whole way, through Okahandja, Karibib and Usakos before the coastal fog takes over near the sea.",
    sections: [
      {
        heading: "The road itself",
        body: [
          "The B2 is a main tarred route and one of the easier long drives in the country. You climb out of the Windhoek highlands, cross open country past the Erongo mountains, and then descend into the cool fog that sits over the last stretch to the coast for much of the year.",
          "Fuel and food stops exist at Okahandja, Karibib and Usakos. Distances between them are long by European standards, so fill up when you can rather than when you must.",
        ],
      },
      {
        heading: "Self-drive or be driven",
        body: [
          "Plenty of people self-drive this route and enjoy it. It is worth being driven if you are arriving on a long-haul flight the same day, if you would rather look out of the window than at the road, or if you want to arrive without having to find parking and hand back a car.",
          "Our fare covers the whole vehicle rather than each seat, so it works out the same for one traveller or four.",
        ],
      },
      {
        heading: "Timing",
        body: [
          "Leaving Windhoek mid-morning puts you in Swakopmund comfortably for lunch. We collect you from your hotel or guesthouse at a time you choose, and comfort stops are built into the drive.",
        ],
      },
    ],
    routes: ["windhoek-to-swakopmund", "hosea-kutako-to-swakopmund"],
    updated: "2026-08-27",
  },
  {
    slug: "getting-to-sossusvlei",
    title: "Getting to Sossusvlei from Windhoek or the airport",
    metaTitle: "How to Get to Sossusvlei — Drive Time, Roads and Transfers",
    metaDescription:
      "Sossusvlei is around 380 km from Hosea Kutako but takes about five and a half hours, because the second half is gravel. What the passes are like and how to plan the day.",
    answer:
      "Around 380 kilometres from the airport, but plan five and a half hours: the second half is gravel, over the Spreetshoogte or Remhoogte pass and down onto the Namib plain.",
    sections: [
      {
        heading: "Why the distance misleads",
        body: [
          "The kilometre count suggests four hours; the roads do not. Once you turn off the tar, the district roads are corrugated in places and the passes are steep and winding. Averaging 60 to 70 km/h on that surface is normal and sensible.",
          "This is why the route runs in an SUV or 4x4 rather than a small car.",
        ],
      },
      {
        heading: "Arrive in daylight",
        body: [
          "Plan to be off the gravel before dark. The final section is not a road to meet for the first time at night, and wildlife on unfenced verges is a real hazard at dusk.",
          "If your flight lands late in the day, an overnight in Windhoek and an early start the next morning is usually the better plan. We will say so rather than sell you a drive that finishes in the dark.",
        ],
      },
      {
        heading: "Where you are actually going",
        body: [
          "Most lodges sit near the Sesriem gate rather than at the dunes themselves, and they are spread over a wide area. Give us the lodge name when you book and the driver takes you to reception, not to a junction with a signpost.",
        ],
      },
    ],
    routes: ["hosea-kutako-to-sossusvlei"],
    updated: "2026-08-27",
  },
  {
    slug: "getting-to-etosha",
    title: "Getting to Etosha: which gate you need",
    metaTitle:
      "How to Get to Etosha National Park — Gates, Drive Time, Transfers",
    metaDescription:
      "Etosha is about 450 km north of Hosea Kutako. Andersson Gate serves Okaukuejo, Von Lindequist serves Namutoni, and they are hours apart. How to plan around gate closing time.",
    answer:
      "About 450 kilometres north of the airport, five and a half hours on the B1. Which gate matters: Andersson in the south serves Okaukuejo, Von Lindequist in the east serves Namutoni, and they are hours apart.",
    sections: [
      {
        heading: "Pick the gate before you book anything",
        body: [
          "This is the single most common planning mistake on this route. Etosha is large, and arriving at the wrong gate is not a small detour — it can be a half-day.",
          "Tell us the camp or lodge you are booked into and we route to the correct gate. If you are not sure, the booking confirmation from your lodge will name it.",
        ],
      },
      {
        heading: "Gate closing times drive the whole plan",
        body: [
          "Park gates close at sunset and are strict about it. We plan the departure backwards from gate closing rather than forwards from your landing time.",
          "If the arithmetic does not work, an overnight in Windhoek or Otjiwarongo and a morning run is the honest answer, and we would rather tell you that before you book.",
        ],
      },
      {
        heading: "The drive north",
        body: [
          "The B1 through Okahandja and Otjiwarongo is tarred and straightforward. Fuel and food are available at both. It is a long sit, so comfort stops are built in.",
        ],
      },
    ],
    routes: ["hosea-kutako-to-etosha"],
    updated: "2026-08-27",
  },
];

export const GUIDES_BY_SLUG = new Map(GUIDES.map((g) => [g.slug, g]));

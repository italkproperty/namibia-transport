/**
 * Guides: arrival logistics and self-drive decisions.
 *
 * Still not a blog. Destination content — "things to do in Namibia" — would
 * compete against guidebooks and every tour operator in the country, and that
 * traffic does not convert; the ban on it stands. What earns a place here is
 * a narrow, high-intent question with a checkable answer: arrival guides for
 * someone whose flight is booked, and decision guides for someone months
 * earlier choosing between a hire car and being driven. The test for any new
 * guide: does it contain at least one number only our road model can produce?
 * If not, it is a page that could be copied, and it does not get written.
 *
 * Every factual claim here must be one we can stand behind. No invented
 * opening hours, no promised capabilities, no numbers we have not checked.
 * Route figures are never typed into guides — sections carry journey slugs
 * and the page computes distance, surface and time from the network model.
 */

/**
 * A table of journeys whose figures are computed from the road network at
 * render time. The spec carries only slugs — distance, surface split and
 * driving time cannot be typed here, so they cannot drift from the model.
 */
export type RouteTableSpec = {
  caption: string;
  /** `a-to-b` journey slugs; each becomes one computed row. */
  journeys: string[];
  /** Where the numbers come from, shown under the table. */
  note?: string;
};

export type GuideSection = {
  heading: string;
  body: string[];
  routeTable?: RouteTableSpec;
};

export type Guide = {
  slug: string;
  /**
   * Arrival guides answer "how do I get from A to B once I've landed".
   * Decision guides answer the questions someone asks months earlier, while
   * choosing between a hire car and being driven. Both end at something
   * bookable; they differ in framing and in schema.
   */
  kind: "arrival" | "decision";
  /** The question as someone would actually type it. */
  title: string;
  metaTitle: string;
  metaDescription: string;
  /** One-line answer, shown first — most readers need only this. */
  answer: string;
  sections: GuideSection[];
  /**
   * The honest segmentation for decision guides: who should self-drive and
   * who should not. Advisory, not sales — the reader self-selects, and the
   * trust that tone earns is the conversion mechanism.
   */
  decision?: {
    selfDriveIf: string[];
    drivenIf: string[];
  };
  /** Route slugs this guide should send the reader to. */
  routes: string[];
  /** `a-to-b` journey slugs to price on /journey, for pairs with no curated page. */
  journeys?: string[];
  /**
   * External figures quoted in the guide, each dated — rental excesses and
   * fuel prices move, and an undated number is a future lie.
   */
  sources?: { label: string; detail: string }[];
  updated: string;
};

export const GUIDES: Guide[] = [
  {
    slug: "getting-from-hosea-kutako-airport-to-windhoek",
    kind: "arrival",
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
    kind: "arrival",
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
    kind: "arrival",
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
    kind: "arrival",
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
  {
    slug: "do-you-need-a-4x4-in-namibia",
    kind: "decision",
    title: "Do you need a 4x4 in Namibia?",
    metaTitle: "Do You Need a 4x4 in Namibia? A Route-by-Route Answer",
    metaDescription:
      "Not on the tar between the main towns — but the classic circuit runs mostly on gravel, where clearance and tyres matter more than four-wheel drive. The tar/gravel split of every major route, computed from the real road network.",
    answer:
      "On the tar between the main towns, no — an ordinary car is fine. But the classic circuit through Sossusvlei and Damaraland runs mostly on gravel, where ground clearance and tyre strength matter far more than four-wheel drive. The honest answer depends on which roads your own itinerary uses, so here it is route by route.",
    sections: [
      {
        heading: "The question underneath the question",
        body: [
          "When people ask whether they need a 4x4, they are usually asking three different questions at once. Do I need four driven wheels? Almost never in the dry season — the gravel C-roads are graded and a two-wheel-drive car does not lack grip on them. Do I need ground clearance? On any serious gravel, yes: the crown of the road, the drainage dips and the loose stone shoulders punish a low sill long before traction becomes a problem. Do I need stronger tyres? This is the question that actually decides trips, because sharp stone works on sidewalls all day, and a low-profile road tyre is the most likely thing on the whole vehicle to fail.",
          "Genuine four-wheel drive earns its keep in three places: deep sand (the final stretch into Sossusvlei itself, or the Sandwich Harbour dunes), unbridged riverbeds in Damaraland and Kaokoland, and mud in the January-to-March rains. If your itinerary avoids those, what you are really shopping for is clearance and tyres, whatever the badge on the tailgate says.",
        ],
      },
      {
        heading: "What the classic circuit actually drives on",
        body: [
          "Namibia's main B-roads are tarred and genuinely good. Nearly everything else is gravel. That single fact splits the country's routes into two different kinds of driving, and the table below shows which kind each leg of a typical trip is. The pattern surprises people: the run to Etosha is tar the whole way, while the legs everyone pictures — the dunes, the coast road north, Damaraland — are two-thirds gravel or more.",
        ],
        routeTable: {
          caption: "The tar/gravel split, leg by leg",
          journeys: [
            "hosea-kutako-to-windhoek",
            "windhoek-to-swakopmund",
            "windhoek-to-etosha-okaukuejo",
            "windhoek-to-sossusvlei",
            "sossusvlei-to-swakopmund",
            "swakopmund-to-spitzkoppe",
            "swakopmund-to-twyfelfontein",
            "twyfelfontein-to-etosha-okaukuejo",
          ],
        },
      },
      {
        heading: "What gravel does to a car — and to you",
        body: [
          "Corrugation is the surface's signature: ripples that hammer the suspension and shake trim loose at the wrong speed. Loose stone cuts tyres — slow punctures from a single sharp rock are the standard failure, and they land on the traveller's bill under most hire agreements. The German Federal Foreign Office's own driving guidance for Namibia advises carrying two spare wheels on gravel because tyre damage is that common, and warns that 90 km/h on gravel is already too fast.",
          "The driver wears too. Gravel demands constant small corrections and full attention; there is no cruise-control daydreaming. One gravel day is an adventure. By the third in a row, most people are tired in a way tar never makes them, and tiredness on a remote road is its own risk.",
        ],
      },
      {
        heading: "Where an ordinary car genuinely is enough",
        body: [
          "If your trip is Windhoek, the coast at Swakopmund and Etosha through its southern gate, you can do the whole thing on tar, and a normal sedan is a perfectly rational choice — cheaper to hire, cheaper on fuel, and nothing in the itinerary needs more. The moment Sossusvlei or Damaraland joins the plan, the arithmetic changes, because the gravel kilometres arrive in blocks of two and three hundred at a time.",
          "Be honest about the worst leg, not the average one. A vehicle choice that is right for nine-tenths of the trip and wrong for one long gravel day is wrong.",
        ],
      },
      {
        heading: "Why our driving times are slower than the map app's",
        body: [
          "The times in the table come from our own road network model, which plans tar at 100 km/h and gravel at 65 km/h and includes a rest stop — speeds a careful driver actually sustains, checked against published driving times for these routes. Consumer map apps routinely assume gravel speeds nobody should attempt, which is how travellers end up finishing a 'four-hour' drive at dusk with wildlife on the verges. How we compute every figure on this site is written up on our methodology page.",
        ],
      },
      {
        heading: "The option the rental counter never mentions",
        body: [
          "There is a third answer to the 4x4 question: do not drive the hard legs at all. Every route in the table can be driven for you in a vehicle that suits its surface, by a driver who does this road for a living — priced as a fixed fare for the whole car before you commit to anything. For some trips that costs more than a hire car, for some less; our self-drive comparison page puts the two side by side with real numbers rather than a sales pitch.",
        ],
      },
    ],
    decision: {
      selfDriveIf: [
        "You are comfortable driving long, empty gravel roads and the idea excites rather than worries you.",
        "There are two drivers to share the wheel, and your itinerary keeps most days under about four hours of driving.",
        "You have ten days or more, so the distances spread out and no single day is brutal.",
        "You have read your hire agreement's tyre, windscreen and underbody clauses and are comfortable with what they leave on your side.",
      ],
      drivenIf: [
        "This is your first time on gravel and the forums have you nervous — that instinct is information.",
        "Your trip is short. On six to eight days, the driving fatigue eats a real share of the holiday you flew here for.",
        "You are travelling with young children, or anyone for whom a roadside wheel change in the heat is not a reasonable plan.",
        "You would rather spend the drive looking at the country than at the next corrugation.",
        "You land after a long-haul flight and the first drive would otherwise happen jet-lagged, on the left, on an unfamiliar surface.",
      ],
    },
    routes: [],
    journeys: [
      "windhoek-to-sossusvlei",
      "sossusvlei-to-swakopmund",
      "swakopmund-to-twyfelfontein",
      "twyfelfontein-to-etosha-okaukuejo",
      "etosha-okaukuejo-to-windhoek",
    ],
    sources: [
      {
        label: "German Federal Foreign Office, Namibia driving guidance",
        detail:
          "Advises carrying two spare wheels on gravel because tyre damage is frequent, and warns that 90 km/h on gravel is already too fast. Checked September 2026.",
      },
    ],
    updated: "2026-09-06",
  },
];

export const GUIDES_BY_SLUG = new Map(GUIDES.map((g) => [g.slug, g]));

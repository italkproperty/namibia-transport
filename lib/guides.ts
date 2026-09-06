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
  /**
   * Renders the driven-vs-self-drive cost table for a preset itinerary,
   * computed from the same model as the /self-drive planner.
   */
  circuitCompare?: { presetId: string };
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
          "Our fixed price for the airport to Windhoek CBD buys the whole vehicle — the same fare for one traveller or three — and is shown in full before you book, with no meter, no surge and no airport surcharge. A larger SUV or 4x4 is available at a higher fixed rate.",
        ],
      },
    ],
    routes: ["hosea-kutako-to-windhoek"],
    updated: "2026-09-06",
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
      {
        heading: "Park fees at the gate",
        body: [
          "Namibia raised its national park fees sharply on 1 April 2026: a foreign adult now pays N$280 per person per day at Etosha, with lower rates for SADC nationals and children, and children of eight and under free. Fees are paid at the gate and card machines there are not always reliable, so carry enough cash. These are the park's fees, not ours — they are the same however you arrive — but budget for them, because older guidebooks and blogs still quote roughly half these amounts.",
        ],
      },
    ],
    routes: ["hosea-kutako-to-etosha"],
    sources: [
      {
        label: "Namibia national park fee increase, 1 April 2026",
        detail:
          "Foreign adult N$280 per person per day at Etosha, up from N$150, per the gazetted schedule as reported by namibian.org, New Era and EtoshaNationalPark.com.na. Sub-rates for vehicles and other categories vary by source — confirm at the gate. Checked September 2026.",
      },
    ],
    updated: "2026-09-06",
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
  {
    slug: "namibia-car-hire-excess-and-gravel-damage",
    kind: "decision",
    title: "What does gravel damage really cost on a Namibian hire car?",
    metaTitle:
      "Namibia Car Hire Excess: What Gravel Damage Actually Costs You",
    metaDescription:
      "Standard excess with a major Namibian operator is N$40,000, and even reduced-excess cover commonly excludes tyres, windows, the underbody and single-vehicle accidents — the classic gravel failures. What the contracts say, and how to measure your real exposure in gravel kilometres.",
    answer:
      "More than the day rate suggests. The standard excess with a major Windhoek operator is N$40,000, and even paid reduced-excess options commonly leave tyres, windows, the underbody and single-vehicle accidents — which is to say, the classic gravel failures — on your side of the contract. Your real exposure is not a percentage on a brochure; it is the number of gravel kilometres your route drives.",
    sections: [
      {
        heading: "What an excess actually is",
        body: [
          "The excess is the amount of any damage you pay before insurance pays anything — and in Namibia it is not a token figure. Asco Car Hire's published 2026 rates put the standard excess at N$40,000 across all vehicle groups; other operators are in the same territory. Reducing it costs a daily fee, in tiers, and taking it to zero costs a further daily fee on top of the hire.",
          "Multiply any of those daily fees by a two-week trip before deciding they are small. Cover that looks cheap per day is a meaningful share of the whole hire by the time you hand the keys back.",
        ],
      },
      {
        heading: "The exclusions that survive even reduced excess",
        body: [
          "This is the part most travellers discover at the counter, or after the trip. Across the Namibian hire agreements we checked, the reduced-excess tiers commonly exclude damage to tyres, windows, rims and the underbody — and damage from single-vehicle accidents, defined as any incident with no other party involved: rolling the car, sliding off a corrugated bend, reversing into a rock. Some operators sell a separate tyre-and-glass waiver on top; without it, a gravel puncture is billed whole.",
          "Read that list against what gravel actually does to a car. Sharp stone cuts sidewalls. Corrugation shakes trim and hammers the suspension. Loose surfaces cause single-vehicle slides. The exclusions are not arbitrary — they are a precise map of gravel's failure modes, priced onto your side of the contract because they are the damage most likely to happen.",
        ],
      },
      {
        heading: "Your exposure is measured in gravel kilometres",
        body: [
          "Two itineraries of the same length can carry wildly different risk. Windhoek, the coast and Etosha's southern gate is tar the whole way — the exclusions above barely touch it. Add Sossusvlei and Damaraland and you take on hundreds of gravel kilometres at a stretch, every one of them working on your tyres. The table shows the exposure leg by leg; sum the legs your own route uses.",
        ],
        routeTable: {
          caption: "Gravel exposure of the common legs",
          journeys: [
            "windhoek-to-swakopmund",
            "windhoek-to-etosha-okaukuejo",
            "windhoek-to-sossusvlei",
            "sossusvlei-to-swakopmund",
            "swakopmund-to-twyfelfontein",
            "twyfelfontein-to-etosha-okaukuejo",
            "windhoek-to-fish-river-canyon",
          ],
        },
      },
      {
        heading: "How to read a hire agreement in five minutes",
        body: [
          "Ask four questions before you sign anything. What is my excess with the cover I have actually chosen — not the best tier on the brochure? Are tyres, glass, rims and the underbody covered, and by which add-on? What happens in a single-vehicle accident — is a rollover on gravel covered at all, at any tier? And how many spare wheels does the car carry — the German Federal Foreign Office's driving guidance for Namibia advises two on gravel, because tyre damage is that common.",
          "Get the answers in writing, in the quote. An operator with clear answers to these four questions is telling you something good about itself; one that waves them off is telling you something too.",
        ],
      },
      {
        heading: "What changes when someone else drives",
        body: [
          "A driven transfer inverts the whole structure. The vehicle, its tyres, and whatever the road does to them are the operator's concern, not yours — your price is the fixed fare you agreed before the trip, and there is no excess because there is nothing of ours you are liable for. Whether that trade is worth it depends on your route's gravel, your appetite for roadside wheel changes, and the arithmetic — our self-drive comparison page computes both columns for your actual itinerary.",
        ],
      },
    ],
    decision: {
      selfDriveIf: [
        "Your route is mostly tar — check the table — and your exposure is a fraction of the headline gravel horror stories.",
        "You have priced the cover honestly: reduced excess plus tyre-and-glass waiver for every day of the trip, not the bare day rate.",
        "You are comfortable that a rollover on gravel may not be covered at any tier, and have read your agreement's answer.",
      ],
      drivenIf: [
        "Your itinerary is gravel-heavy and the excess you would carry is money you cannot comfortably lose.",
        "You do not want to spend a holiday supervising a contract — one fixed fare, no excess, no exclusions to memorise.",
        "The quotes you are comparing get within a few thousand rand of each other once real cover is included — at that point you are paying almost the same money to carry the risk yourself.",
      ],
    },
    routes: [],
    journeys: [
      "windhoek-to-sossusvlei",
      "sossusvlei-to-swakopmund",
      "swakopmund-to-twyfelfontein",
    ],
    sources: [
      {
        label: "Asco Car Hire, published 2026 rates and insurance terms",
        detail:
          "Standard excess N$40,000 for all vehicle groups; reduced and zero-excess cover sold per day. Checked September 2026.",
      },
      {
        label: "Savanna Car Hire, rental conditions",
        detail:
          "Reduced-excess options exclude damage to tyres and windows and damage from single-vehicle accidents, including overturning, defined as incidents with no other party involved. The same pattern appears across the Windhoek operators we checked. Checked September 2026.",
      },
      {
        label: "German Federal Foreign Office, Namibia driving guidance",
        detail:
          "Advises carrying two spare wheels on gravel because tyre damage is frequent. Checked September 2026.",
      },
    ],
    updated: "2026-09-06",
  },
  {
    slug: "how-far-can-you-drive-in-a-day-in-namibia",
    kind: "decision",
    title: "How far can you really drive in a day in Namibia?",
    metaTitle:
      "How Far Can You Drive in a Day in Namibia? Honest Times, Not Map-App Times",
    metaDescription:
      "Plan moving days around five hours of driving and be off the road before dark. Honest driving times for Namibia's long legs, computed at speeds a careful driver actually sustains — not the times a map app promises.",
    answer:
      "Plan your moving days around five hours behind the wheel, and treat anything over six as the whole day. On tar that is a long way; on gravel it is much less than the map suggests — and the one rule that outranks distance entirely is to be off the road before dark.",
    sections: [
      {
        heading: "Why the map app is wrong here",
        body: [
          "Consumer map apps estimate Namibian gravel at speeds nobody should attempt — which is how travellers end up finishing a supposedly four-hour drive at dusk, tired, with wildlife moving onto the verges. Our times are computed differently: tar at 100 km/h and gravel at 65 km/h, with a rest stop included. Those are the averages a careful driver actually sustains over a whole leg, and before settling on them we tested faster gravel assumptions against published driving times and rejected them — they predict arrivals that do not happen. The full working is on our methodology page.",
        ],
      },
      {
        heading: "The long legs, honestly timed",
        body: [
          "These are the legs that decide itineraries. Some read as plausible day drives on a map and are not; one is two honest days however you cut it. Every figure is computed from our road network at the speeds above.",
        ],
        routeTable: {
          caption: "Honest driving times for the long legs",
          journeys: [
            "windhoek-to-sossusvlei",
            "sossusvlei-to-swakopmund",
            "windhoek-to-etosha-namutoni",
            "swakopmund-to-etosha-okaukuejo",
            "windhoek-to-fish-river-canyon",
            "windhoek-to-luderitz",
            "windhoek-to-katima-mulilo",
          ],
        },
      },
      {
        heading: "The five-hour rule",
        body: [
          "Five hours of Namibian driving is not five hours of motorway. Gravel demands constant small corrections; there is no cruise control and no daydreaming, and the concentration is what tires you rather than the distance. A five-hour day leaves you arriving with enough left to enjoy where you are. Back-to-back six-and-seven-hour days are how a driving holiday quietly becomes a driving job.",
          "Sunset is the hard deadline. Kudu and warthog move at dawn and dusk, and a large animal through a windscreen at speed is the accident Namibians actually fear — it is why locals plan to be parked by nightfall, and in midwinter the sun is down not long after six. Whatever the map says, a leg that cannot finish in daylight is a leg that needs an overnight stop added.",
        ],
      },
      {
        heading: "Plan nights, not distances",
        body: [
          "The good itinerary question is not how far can we drive each day but where do we sleep, and does each hop between beds fit inside the five-hour rule with daylight to spare. Namibia's classic trips are loops of five to seven sleeps with one moving morning between each — the distances then take care of themselves. Our self-drive planner builds an itinerary this way, computes every leg at honest speeds, and prices what the same loop costs driven for you.",
          "And if one leg of an otherwise comfortable loop breaks the rule — the long haul south, or a repositioning day you dread — that single leg is exactly the kind of thing you can hand to a driver who does it for a living, and fly or rest instead.",
        ],
      },
    ],
    routes: [],
    journeys: [
      "windhoek-to-luderitz",
      "windhoek-to-fish-river-canyon",
      "swakopmund-to-etosha-okaukuejo",
    ],
    updated: "2026-09-06",
  },
  {
    slug: "self-drive-namibia-or-be-driven",
    kind: "decision",
    title: "Should you self-drive Namibia, or be driven?",
    metaTitle:
      "Self-Drive Namibia or Hire a Driver? The Honest Cost Comparison",
    metaDescription:
      "For the classic nine-day circuit, a driven trip costs less than a high-season 4x4 camper and more than a budget hire car — computed leg by leg from a real road model, with fuel, waivers and the excess you carry included. Who should choose which, honestly.",
    answer:
      "Neither is simply cheaper. Priced honestly — vehicle, fuel, tyre-and-glass waiver, and the excess you carry — a driven nine-day circuit lands below a high-season 4x4 camper and above a budget hire car, and the table below computes it. So the money rarely decides. What decides is risk, fatigue, and what you want the holiday to actually be.",
    sections: [
      {
        heading: "What the usual comparison misses",
        body: [
          "The comparison most people make is the hire car's day rate against a driven fare, and it is wrong on both sides. The hire car also needs fuel over the whole distance — transfer legs plus all the local running at each stop — insurance cover priced per day, and your acceptance of the excess that survives that cover. The driven fare, meanwhile, contains things no brochure itemises: the driver's nights away, and the cost of bringing the car home when no return fare exists — part of every transport price in a country this empty, whether it appears on the invoice or not.",
          "So the honest comparison is total against total, for one specific itinerary, with the risk column shown. That is what the table below does.",
        ],
      },
      {
        heading: "The classic circuit, both ways, in real money",
        body: [
          "Nine days: the airport, two nights at Sossusvlei, two in Swakopmund, one in Damaraland, three in Etosha, and back. Every figure is computed from our road and fare model for this exact loop — change the loop on our planner and every number recomputes.",
        ],
        circuitCompare: { presetId: "classic" },
      },
      {
        heading: "The costs that are not money",
        body: [
          "Self-driving buys independence: leave when you like, stop where you like, change the plan over breakfast. It costs concentration — the classic circuit is the better part of a working week behind the wheel, half of it on gravel that allows no daydreaming — and it costs the risk you carry, which our guides to daily driving distances and hire-car excess spell out in detail.",
          "Being driven buys the window seat: the Namib going past while someone who drives this road for a living deals with the corrugation, and nobody in your party arrives tired or spends an afternoon changing a wheel in the sun. It costs some spontaneity — the day's shape is agreed rather than improvised.",
          "Neither of those trades is wrong. They are different holidays, and the mistake is only pretending one of them is free.",
        ],
      },
      {
        heading: "What being driven actually gets you",
        body: [
          "So that you are comparing real things rather than a brochure word: a driven trip with us means a fixed fare for the whole vehicle, agreed before you commit; a driver we selected and briefed, in a vehicle matched to the route's surface; your flight watched on airport pickups, so a delay costs you nothing; and no excess, because nothing of ours is your liability. What it does not mean: we are not a guiding company — your driver drives, well, and knows the road rather than the birdlife.",
        ],
      },
    ],
    decision: {
      selfDriveIf: [
        "The independence is the holiday — you want to change plans over breakfast, and a fixed day shape would chafe.",
        "You have ten days or more, two drivers to share the wheel, and the five-hour daily rule fits your loop comfortably.",
        "Your route lets a cheaper vehicle work — mostly tar, or gravel you have honestly matched the car to.",
        "You have priced the full column: fuel, cover for every day, and an excess you could pay without wrecking the budget.",
      ],
      drivenIf: [
        "Your trip is six to nine days — on short trips the driving fatigue eats the largest share of the holiday you flew here for.",
        "You are travelling with young children or anyone for whom a breakdown two hours from help is not an acceptable plan.",
        "This is your first time on gravel and you would spend the drive tense — the window seat is what you are actually buying.",
        "You are a photographer: the person driving sees the least of Namibia.",
        "The totals above land close together for your dates — at that point self-driving means paying nearly the same money to carry the risk and do the work yourself.",
      ],
    },
    routes: [],
    journeys: [
      "windhoek-to-sossusvlei",
      "sossusvlei-to-swakopmund",
      "twyfelfontein-to-etosha-okaukuejo",
      "etosha-okaukuejo-to-windhoek",
    ],
    sources: [
      {
        label: "Hire rates in the comparison",
        detail:
          "Day rates, the tyre-and-glass waiver and the carried excess are from our survey of published Windhoek operator rates, September 2026, converted where quoted in foreign currency. They are defaults — the planner accepts the quote you were actually given.",
      },
    ],
    updated: "2026-09-06",
  },
];

export const GUIDES_BY_SLUG = new Map(GUIDES.map((g) => [g.slug, g]));

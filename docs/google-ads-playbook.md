# Google Ads playbook — Namibia Transport

Built from the first campaign's data (29 Sep – 14 Nov 2026): 928 impressions, 86 clicks,
9.27% CTR, ZAR 789 spent, 0 conversions, now paused. Reach was Namibia 73%, South
Africa 24%, everywhere else ~3%.

What the first campaign got wrong, and this fixes:
1. The most-shown ad's path was `transfers/namibia`, which is a 404. Verify the real Final URL.
2. 78% of spend went to generic broad terms ("booking transportation", "shuttle services").
3. Half the clicks were wrong intent: taxi apps (Yango, Open taxi), buses (Intercape), competitors (Carlos, Roots).
4. No conversion tracking, so nothing reported which clicks became bookings.
5. Budget was ZAR 400/day but only ~ZAR 17/day spent — the searches do not exist in that volume. Do not try to out-bid a market this small.

Card payments are live through the gateway and will self-report to Ads once the two
conversion labels are set. Bank transfers will not report from the browser; that needs a
separate export, not built yet.

---

## Step 0 — fix the dead landing page (do first)

Google Ads → Campaigns → Ads → open the ad → check **Final URL** (not the display path).
If it points at `/transfers/namibia` or anything that 404s, change it. Real, fast, mobile-ready pages:

- Airport: `https://www.namibiatransport.com/transfers/hosea-kutako-to-windhoek`
- Coast: `https://www.namibiatransport.com/transfers/windhoek-to-swakopmund`
- Sossusvlei: `https://www.namibiatransport.com/destinations/sossusvlei`
- Any route, with a price box: `https://www.namibiatransport.com/journey`

Click each once in a browser before launch. A dead landing page destroys quality score and wastes every click.

## Step 1 — conversion tracking (do before spending)

Without this the next campaign is as blind as the first.

1. Goals → Conversions → **+ New conversion action** → Website → enter `namibiatransport.com` → **Add manually**.
2. Action one: category **Purchase**, name `Booking paid`, value **Use different values**, default `0`, currency **NAD**, count **One**. Save.
3. On the tag screen choose **Install the tag yourself**. Copy the **Conversion label** (short string after the `/`). You do NOT install anything — the site already has the tag.
4. Action two: category **Submit lead form**, name `Booking submitted`, **Don't use a value**, count **One**. Copy its label.
5. Vercel → namibia-transport → Settings → Environment Variables, add for **Production**:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID_PAID` | your `AW-…` tag id |
   | `NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL_PAID` | label from step 3 |
   | `NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID_BOOKING` | the same `AW-…` id |
   | `NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL_BOOKING` | label from step 4 |

6. **Redeploy** (Deployments tab). Values are baked in at build time.
7. Test: make a booking on the site without paying. Within a few hours `Booking submitted` shows "Recording conversions". Do not test-pay by card — it charges real money.

## Step 2 — campaign settings

Create a **new** Search campaign (do not reuse the paused one; its low quality score history follows it).

- Type **Search**, goal **Sales**. Primary conversion: Booking paid. Secondary: Booking submitted.
- Networks: **Search only**. Untick Search partners and the Display Network.
- Locations: Namibia, South Africa, United Kingdom, United States, Ireland, Australia, Canada. Location options → **Presence or interest**. (Germany, Netherlands, Switzerland need German-language ads; park that for now.)
- Language: English.
- Bidding: **Maximize clicks**, max CPC limit **ZAR 12**. After ~20 conversions are recorded, switch to Maximize conversions.
- Budget: **ZAR 60/day**. You were only spending ~ZAR 17/day; 60 is ample headroom.
- Turn **off** any "automatically created assets" or "AI Max" toggle.

## Step 3 — three ad groups

Phrase match (type the keyword inside quotes) unless noted. Each group has its own landing page.

### Ad group 1 — Airport Windhoek
Landing: `/transfers/hosea-kutako-to-windhoek`

Keywords: "windhoek airport transfer", "windhoek airport shuttle", "hosea kutako airport transfer", "hosea kutako transfer", "airport transfer windhoek", "namibia airport transfer", "transfer from windhoek airport", "windhoek airport to city", "windhoek airport pickup"

### Ad group 2 — Windhoek to the coast
Landing: `/transfers/windhoek-to-swakopmund`

Keywords: "windhoek to swakopmund transfer", "windhoek to swakopmund shuttle", "windhoek swakopmund transport", "swakopmund to windhoek transfer", "transfer windhoek swakopmund", "shuttle windhoek swakopmund", "windhoek to walvis bay transfer", "windhoek to swakopmund private transfer"

### Ad group 3 — Sossusvlei, lodges and private driver
Landing: `/destinations/sossusvlei`

Keywords: "windhoek to sossusvlei transfer", "sossusvlei transfer", "transfer to sossusvlei", "sossusvlei private driver", "windhoek to sossusvlei driver", "namib desert lodge transfer", "sossusvlei lodge transfer", "sossus dune lodge transfer", "sesriem transfer", "namibia private driver", "private driver namibia", "namibia driver guide"

### Ad group 4 — Etosha
Landing: `/transfers/hosea-kutako-to-etosha`

Keywords: "windhoek to etosha transfer", "etosha transfer", "transfer to etosha", "windhoek to etosha driver", "etosha national park transfer", "etosha airport transfer"

## Step 4 — negative keywords (campaign level)

Stops the wrong-intent leak. Add as phrase match:

`yango`, `bolt`, `uber`, `open taxi`, `taxi windhoek`, `windhoek taxi`, `intercape`, `carlos shuttle`, `roots shuttle`, `bus ticket`, `bus timetable`, `car hire`, `car rental`, `rent a car`, `rental car`, `self drive`, `self-drive`, `jobs`, `job`, `vacancy`, `salary`, `hiring`, `driver jobs`, `learnership`, `cheap`, `free`, `for sale`, `second hand`, `bakkie`

## Step 5 — the ad copy

Responsive Search Ad: paste the headlines and descriptions. Everything below is true against the
site. Do not add "24/7", "licensed", "vetted", "cheapest" or "best" — the site cannot back them.
Pin the route headline (the first one in each group) to **Position 1** so it always shows.

### Group 1 — Airport
Headlines:
- Hosea Kutako to Windhoek
- Windhoek Airport Transfer
- Private Transfer, One Price
- Fixed Price Per Vehicle
- Driver Meets You In Arrivals
- Name Board At Arrivals
- We Hold Your Flight Number
- Price Shown Before You Book
- Pay By Card Or Transfer
- Private Car, Not A Shuttle
- Book Online In Minutes
- Namibia Airport Pickup

Descriptions:
- Private transfer from Hosea Kutako to your Windhoek address. One fixed price for the car.
- Your driver meets you inside arrivals with a name board and helps with your luggage.
- See your price upfront, book online, pay by card or transfer. Support 06:00 to 22:00.
- A private car for your group, not a shared shuttle or a cramped minibus. Book in minutes.

### Group 2 — Coast
Headlines:
- Windhoek to Swakopmund
- Swakopmund Transfer
- Private Driver, One Price
- Fixed Price Per Vehicle
- Door To Door Transfer
- Price Shown Before You Book
- Pay By Card Or Transfer
- Private Car, Not A Bus
- Windhoek Swakopmund Shuttle
- Book Online In Minutes
- Namibia Coast Transfer

Descriptions:
- Private transfer between Windhoek and Swakopmund. One fixed price for the whole car.
- Door to door in a private car, not a shared bus. See the price before you book.
- Pay by card or bank transfer. Support 06:00 to 22:00. Quote your reference any time.
- Travelling the other way? We run Swakopmund to Windhoek at the same fixed price.

### Group 3 — Sossusvlei, lodges and private driver
Headlines:
- Windhoek to Sossusvlei
- Sossusvlei Transfer
- Private Driver In Namibia
- Your Driver, Your Pace
- Fixed Price Per Vehicle
- Price Shown Before You Book
- Multi-Day Private Charter
- Pay By Card Or Transfer
- Lodge Transfers Arranged
- Book Online In Minutes
- Namibia Private Driver

Descriptions:
- Private driver from Windhoek to Sossusvlei and the dunes. One fixed price for the car.
- Multi-day charter with your own driver. We quote the whole trip, not a price per seat.
- See the price before you book. Pay by card or bank transfer. Support 06:00 to 22:00.
- Transfers to Sossusvlei lodges and the Sesriem gate, priced from the real road distance.

### Group 4 — Etosha
Headlines:
- Windhoek to Etosha
- Etosha Park Transfer
- Private Driver To Etosha
- Fixed Price Per Vehicle
- Your Driver, Your Pace
- Price Shown Before You Book
- Pay By Card Or Transfer
- Private Car, Not A Bus
- Book Online In Minutes
- Namibia Private Driver

Descriptions:
- Private transfer from Windhoek to Etosha. One fixed price for the whole car.
- Your own driver to the park gates and your lodge. See the price before you book.
- Pay by card or bank transfer. Support 06:00 to 22:00. Quote your reference any time.
- Priced from the real road distance to Etosha, not a guess. Book online in minutes.

## Step 6 — assets (campaign level)

- Sitelinks: Airport transfers → the airport page; Windhoek to Swakopmund → the coast page; Sossusvlei → the destination page; Get a price → `/journey`.
- Callouts: `Fixed price per vehicle`, `Pay by card or EFT`, `Support 06:00 to 22:00`, `Driver meets you in arrivals`.
- Call asset: `+264 81 727 8410`.

## Step 7 — the weekly ten minutes

Every Monday:
1. Insights and reports → **Search terms**. Add every wrong-intent term as a negative.
2. Pause any keyword with 100+ impressions and under 3% CTR.
3. Goals → Conversions: note which keywords produced a Booking paid.
4. After four weeks, move budget to the group that produced paid bookings, and report the numbers.

Expect four to five relevant clicks a day. Search is a steady trickle here, not the revenue
engine. The engine is lodges, tour operators, Google Business Profile reviews, and repeat
customers. Keep search running small and clean; do not expect it to carry the six-month target.

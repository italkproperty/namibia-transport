import { toMoneyString } from "@/lib/money";
import type { FareQuote, RouteView, VehicleClassView } from "@/lib/maps/types";

/**
 * Pure fare maths, deliberately free of any server-only import so the client
 * price preview and the server action call the exact same function. If these
 * ever disagreed, a customer would be shown one price and charged another.
 *
 * Every private transfer prices per vehicle: fixed_price buys the whole car
 * for the base class, and the vehicle-class multiplier scales it. Passenger
 * count is not an input to the fare — nothing in the cost base scales with
 * it (not fuel, not driver hours, not the empty return), and our own fare
 * model: the airport route is published at N$850 per vehicle as a commercial
 * override; the cost model's N$650 baseline remains an operating
 * recommendation. Party size matters only to which vehicle class is eligible,
 * which is `lib/booking/eligibility.ts`'s job.
 *
 * The per_person pricing unit survives in the type for one future product —
 * a scheduled shared shuttle, where unrelated travellers pool a vehicle.
 * Until that product exists, no route may carry it: the seed and the tests
 * reject it, and at runtime it prices as per-vehicle rather than collapsing
 * a render.
 *
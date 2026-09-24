import "server-only";

import { modelCost, type PricingConstants, type VehicleCostProfile } from "./cost-model";
import { findRoad } from "@/lib/network/roads";
import { nodeLabel, findNode } from "@/lib/network/nodes";

/**
 * What a settings change does, before it is made.
 *
 * One number on the pricing form multiplies 2,352 journeys. Letting an
 * operator save it and then go and look at a route page is the wrong order:
 * by the time they look, every quote link already sent is at the new price.
 * So the form previews first — same model, same constants, both columns — and
 * saving is a separate, deliberate act.
 *
 * The reference journeys are chosen to span the shape of the fare rather than
 * to be popular. A change that leaves the airport run alone and doubles
 * Sossusvlei is invisible on a list of best sellers and obvious here.
 */
const REFERENCE_PAIRS: [string, string, string][] = [
  ["hosea-kutako", "windhoek", "Short, tar, turn-out dominated"],
  ["windhoek", "swakopmund", "Long, all tar, same day"],
  ["windhoek", "sossusvlei", "Long, part gravel, one night"],
  ["swakopmund", "sossusvlei", "Coast to desert, gravel heavy"],
  ["windhoek", "etosha-okaukuejo", "Long, tar, empty return"],
  ["windhoek", "luderitz", "Longest single leg we price"],
];

export type PreviewRow = {
  label: string;
  note: string;
  km: number;
  nights: number;
  /** Price under the settings in force now. */
  before: number;
  /** Price under the settings being proposed. */
  after: number;
  delta: number;
  percent: number;
  /** True when the floor, not the distance, sets the price. */
  atFloor: boolean;
};

export function previewJourneys(
  profile: VehicleCostProfile,
  before: PricingConstants,
  after: PricingConstants,
  beforeProfile: VehicleCostProfile = profile,
): PreviewRow[] {
  const rows: PreviewRow[] = [];

  for (const [from, to, note] of REFERENCE_PAIRS) {
    const road = findRoad(from, to);
    const a = findNode(from);
    const b = findNode(to);
    if (!road || !a || !b) continue;

    const was = modelCost(road, beforeProfile, before);
    const now = modelCost(road, profile, after);

    rows.push({
      label: `${nodeLabel(a)} → ${nodeLabel(b)}`,
      note,
      km: road.km,
      nights: now.nights,
      before: was.price,
      after: now.price,
      delta: now.price - was.price,
      percent: was.price > 0 ? ((now.price - was.price) / was.price) * 100 : 0,
      atFloor: now.atFloor,
    });
  }

  return rows;
}

/**
 * The largest swing in the preview, which is the number an operator should be
 * looking at. An average would hide exactly the case that matters: a change
 * that is quiet everywhere and violent on one shape of journey.
 */
export function worstSwing(rows: PreviewRow[]): number {
  return rows.reduce((worst, row) => Math.max(worst, Math.abs(row.percent)), 0);
}

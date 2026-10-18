import "server-only";

export type PublicCharterLeg = {
  from: string;
  to: string;
  distanceKm: number;
  durationMinutes: number;
  price: number;
};

export function buildPublicCharterLegs(snapshot: unknown, totalValue: string | number): PublicCharterLeg[] {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return [];
  const root = snapshot as Record<string, unknown>;
  const route = root.route && typeof root.route === "object" ? root.route as Record<string, unknown> : {};
  const request = root.request && typeof root.request === "object" ? root.request as Record<string, unknown> : {};
  const stops = Array.isArray(request.stops) ? request.stops as { label?: unknown }[] : [];
  const legs = Array.isArray(route.legs) ? route.legs as { distanceKm?: unknown; durationMinutes?: unknown }[] : [];
  const total = Number(totalValue);
  if (!Number.isFinite(total) || total < 0 || stops.length < 2 || legs.length !== stops.length - 1) return [];

  const weights = legs.map((leg) => {
    const km = Number(leg.distanceKm);
    return Number.isFinite(km) && km > 0 ? km : 0;
  });
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  const effective = weightTotal > 0 ? weights : weights.map(() => 1);
  const denominator = effective.reduce((sum, value) => sum + value, 0);
  let allocatedCents = 0;
  return legs.map((leg, index) => {
    const rawPrice = index === legs.length - 1
      ? Math.round(total * 100) - allocatedCents
      : Math.round((Math.round(total * 100) * effective[index]) / denominator);
    allocatedCents += rawPrice;
    const distanceKm = Number(leg.distanceKm);
    const durationMinutes = Number(leg.durationMinutes);
    const fromLabel: unknown = stops[index]?.label;
    const toLabel: unknown = stops[index + 1]?.label;
    const from = typeof fromLabel === "string" ? fromLabel.trim() : "";
    const to = typeof toLabel === "string" ? toLabel.trim() : "";
    return {
      from: from || `Stop ${index + 1}`,
      to: to || `Stop ${index + 2}`,
      distanceKm: Number.isFinite(distanceKm) && distanceKm >= 0 ? distanceKm : 0,
      durationMinutes: Number.isFinite(durationMinutes) && durationMinutes >= 0 ? durationMinutes : 0,
      price: rawPrice / 100,
    };
  });
}

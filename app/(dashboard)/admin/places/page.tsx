import type { Metadata } from "next";

import { PlaceForm } from "@/components/admin/place-form";
import { PlaceActiveToggle } from "@/components/admin/place-toggle";
import { AdminShell } from "@/components/admin/shell";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import gpsReferenced from "@/docs/map-coordinates.json";
import { formatNad } from "@/lib/money";
import { nodesByRegion, REGION_LABELS, SEARCH_PLACES } from "@/lib/network/nodes";
import { findRoad } from "@/lib/network/roads";
import { modelCost } from "@/lib/pricing/cost-model";
import { ensureVerifiedPlaces, listAllPlaces } from "@/lib/places/queries";

export const metadata: Metadata = {
  title: "Places",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Lodges, guest farms and hotels, priced to the door.
 *
 * The road model knows towns, gates and airports. This is where an operator
 * teaches it a place a traveller actually names: pin it, let Directions
 * measure the drive from the nearest node, confirm, save. The table below is
 * the proof — each row shows what a private car from Windhoek costs to that
 * door, computed by the same function the public quote uses.
 */
export default async function PlacesPage() {
  // Applied first, so the fares in the table are priced with these places.
  await ensureVerifiedPlaces();
  const all = await listAllPlaces();

  const anchors = nodesByRegion().map((group) => ({
    label: REGION_LABELS[group.region],
    nodes: group.nodes.map((node) => ({ slug: node.slug, name: node.name })),
  }));

  // Starting points only: a name and a pin to check, never a saved place.
  const suggestions = [
    ...(gpsReferenced as { name: string; lat: number; lng: number }[]).map((p) => ({
      name: p.name,
      lat: p.lat,
      lng: p.lng,
      source: "GPS-referenced map",
    })),
    ...SEARCH_PLACES.map((p) => ({
      name: p.name,
      lat: p.lat,
      lng: p.lng,
      source: "catalogue, approximate pin",
    })),
  ].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <AdminShell active="/admin/places">
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Places</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-snug">
            Lodges, guest farms and hotels priced to the door. Verify a place
            once and travellers can pick it on the site, the quote builder
            routes to it, and the assistant recognises its name.
          </p>
        </div>

        {!all.ok && all.needsMigration && (
          <div className="border-warning/40 bg-warning/10 rounded-lg border p-4 text-sm">
            <p className="font-semibold">The places table does not exist yet</p>
            <p className="mt-1">
              Run the &ldquo;verified places&rdquo; block at the bottom of{" "}
              <code>db/manual/RUN-ME.sql</code> in the Supabase SQL editor, then
              reload. Until then nothing here can be saved and the site prices
              towns, gates and airports only.
            </p>
          </div>
        )}
        {!all.ok && !all.needsMigration && (
          <p className="border-destructive/40 bg-destructive/10 rounded-lg border p-4 text-sm">
            The list of places did not load. Saved places are still being
            priced from the last copy; reload to try again.
          </p>
        )}

        <PlaceForm anchors={anchors} suggestions={suggestions} />

        <div>
          <h2 className="text-sm font-semibold">
            Verified places{all.ok ? ` (${all.rows.length})` : ""}
          </h2>
          {all.ok && all.rows.length === 0 && (
            <p className="text-muted-foreground mt-2 text-sm">
              None yet. Start with the places travellers ask for most.
            </p>
          )}
          {all.ok && all.rows.length > 0 && (
            <div className="mt-3 overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Place</TableHead>
                    <TableHead>Access drive</TableHead>
                    <TableHead>Distance from</TableHead>
                    <TableHead className="text-right">Windhoek to the door</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {all.rows.map((row) => {
                    const road = row.isActive ? findRoad("windhoek", row.slug) : null;
                    return (
                      <TableRow key={row.id} className={row.isActive ? "" : "opacity-60"}>
                        <TableCell>
                          <p className="font-medium">{row.name}</p>
                          <p className="text-muted-foreground font-mono text-xs">
                            {Number(row.lat).toFixed(4)}, {Number(row.lng).toFixed(4)}
                          </p>
                        </TableCell>
                        <TableCell>
                          {Number(row.accessKm)} km {row.accessSurface}
                          <p className="text-muted-foreground text-xs">
                            {row.measuredBy === "mapbox"
                              ? "measured by Directions"
                              : "entered by an operator"}
                            {row.minimumFare
                              ? ` · never below ${formatNad(row.minimumFare)}`
                              : ""}
                          </p>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{row.anchorSlug}</TableCell>
                        <TableCell className="tabular text-right">
                          {road ? (
                            <>
                              {formatNad(modelCost(road).price)}
                              <p className="text-muted-foreground text-xs">
                                {Math.round(road.km)} km
                              </p>
                            </>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              {row.isActive ? "not routable — check the anchor" : "not priced"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <PlaceActiveToggle id={row.id} active={row.isActive} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}

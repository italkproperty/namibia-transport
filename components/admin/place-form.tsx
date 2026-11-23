"use client";

import * as React from "react";
import { CheckCircle2Icon, RulerIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  measurePlaceAction,
  savePlaceAction,
  type MeasureState,
  type SavePlaceState,
} from "@/lib/admin/place-actions";

type AnchorGroup = { label: string; nodes: { slug: string; name: string }[] };
type Suggestion = { name: string; lat: number; lng: number; source: string };

/**
 * Pin, measure, confirm, save.
 *
 * Measuring comes back with the anchor Directions was asked to drive from and
 * what it found, and nothing is stored until the operator has seen that and
 * pressed Save. The distance stays editable because a farm track is often not
 * on the map and the person at the desk knows it is eleven kilometres.
 */
export function PlaceForm({
  anchors,
  suggestions,
}: {
  anchors: AnchorGroup[];
  suggestions: Suggestion[];
}) {
  const [name, setName] = React.useState("");
  const [coordinates, setCoordinates] = React.useState("");
  const [anchorSlug, setAnchorSlug] = React.useState("");
  const [accessKm, setAccessKm] = React.useState("");
  const [accessSurface, setAccessSurface] = React.useState<"gravel" | "tar">("gravel");
  const [minimumFare, setMinimumFare] = React.useState("");

  const [measured, measure, measuring] = React.useActionState<MeasureState, FormData>(
    measurePlaceAction,
    null,
  );
  const [saved, save, saving] = React.useActionState<SavePlaceState, FormData>(
    savePlaceAction,
    null,
  );

  // A measurement fills the fields it produced; the operator can still change them.
  // Once a place is saved its measurement is finished with. Without this the
  // panel stayed on screen over an emptied form, warning that "the pin was
  // changed" about a place that had just been saved correctly.
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    if (!measured?.ok) return;
    setDone(false);
    setAnchorSlug(measured.anchorSlug);
    if (measured.measuredKm !== null) setAccessKm(String(measured.measuredKm));
  }, [measured]);

  // After a save, clear for the next place.
  React.useEffect(() => {
    if (!saved?.ok) return;
    setDone(true);
    setName("");
    setCoordinates("");
    setAnchorSlug("");
    setAccessKm("");
    setMinimumFare("");
    setAccessSurface("gravel");
  }, [saved]);

  const pinned = measured?.ok && !done ? measured : null;
  // The pin on screen must be the pin that was measured.
  const stale =
    pinned !== null &&
    !coordinates.includes(String(pinned.lat)) &&
    !coordinates.includes(pinned.lat.toFixed(4));

  const submit =
    (action: (data: FormData) => void) => (event: React.FormEvent<HTMLFormElement>) => {
      // By hand, so a refused field does not wipe the rest of the form.
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      React.startTransition(() => action(data));
    };

  return (
    <div className="bg-card grid gap-5 rounded-xl border p-5">
      <div>
        <h2 className="text-sm font-semibold">Verify a place</h2>
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
          Open the lodge in Google Maps, copy its link or right-click the pin
          and copy the coordinates, and paste below.
        </p>
      </div>

      {saved?.ok && done && (
        <p className="text-success flex items-center gap-2 text-sm font-medium">
          <CheckCircle2Icon className="size-4" aria-hidden />
          {saved.name} is verified and priced to the door.
        </p>
      )}

      <form onSubmit={submit(measure)} className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="place-name">Name, as travellers write it</Label>
          <Input
            id="place-name"
            list="place-suggestions"
            value={name}
            onChange={(event) => {
              const value = event.target.value;
              setName(value);
              // Choosing a known name brings its pin along to be checked.
              const hit = suggestions.find((s) => s.name === value);
              if (hit) setCoordinates(`${hit.lat}, ${hit.lng}`);
            }}
            placeholder="Etango Ranch Guest Farm"
            autoComplete="off"
          />
          <datalist id="place-suggestions">
            {suggestions.map((s, index) => (
              <option key={`${s.name}-${index}`} value={s.name}>
                {s.source}
              </option>
            ))}
          </datalist>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="place-coordinates">Pin: coordinates or a Google Maps link</Label>
          <Input
            id="place-coordinates"
            name="coordinates"
            value={coordinates}
            onChange={(event) => setCoordinates(event.target.value)}
            placeholder="-22.4712, 17.4655"
            autoComplete="off"
          />
        </div>
        <input type="hidden" name="anchorSlug" value={pinned && !stale ? anchorSlug : ""} />
        <div className="sm:col-span-2">
          <Button
            type="submit"
            variant="outline"
            disabled={measuring || !coordinates.trim()}
            className="press"
          >
            <RulerIcon className="size-4" aria-hidden />
            {measuring ? "Measuring…" : pinned ? "Measure again" : "Measure the drive"}
          </Button>
        </div>
        {measured && !measured.ok && (
          <p className="text-destructive text-sm sm:col-span-2">{measured.message}</p>
        )}
      </form>

      {pinned && (
        <form onSubmit={submit(save)} className="grid gap-4 border-t pt-5 sm:grid-cols-2">
          <div className="bg-muted/50 rounded-lg p-3 text-sm sm:col-span-2">
            <p>
              Pin at{" "}
              <a
                className="font-mono underline"
                href={`https://www.google.com/maps?q=${pinned.lat},${pinned.lng}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {pinned.lat.toFixed(5)}, {pinned.lng.toFixed(5)}
              </a>
              , {Math.round(pinned.straightKm * 10) / 10} km in a straight line
              from {pinned.anchorName}.
            </p>
            <p className="mt-1">
              {pinned.measuredKm !== null
                ? `Directions measured ${pinned.measuredKm} km, about ${pinned.measuredMin} minutes, by road.`
                : "The drive was not measured."}
            </p>
            {pinned.note && <p className="mt-1 font-medium">{pinned.note}</p>}
            <p className="text-muted-foreground mt-1 text-xs">
              Open the pin and check it is the right gate before you save.
            </p>
          </div>

          <input type="hidden" name="name" value={name} />
          <input type="hidden" name="lat" value={pinned.lat} />
          <input type="hidden" name="lng" value={pinned.lng} />
          <input type="hidden" name="measuredKm" value={pinned.measuredKm ?? ""} />

          <div className="grid gap-1.5">
            <Label htmlFor="place-anchor">Access road starts from</Label>
            <select
              id="place-anchor"
              name="anchorSlug"
              className="border-input bg-background focus-ring h-10 rounded-md border px-3 text-sm"
              value={anchorSlug}
              onChange={(event) => setAnchorSlug(event.target.value)}
            >
              {anchors.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.nodes.map((node) => (
                    <option key={node.slug} value={node.slug}>
                      {node.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p className="text-muted-foreground text-xs">
              Changed it? Measure again so the distance is from the new start.
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="place-km">Access distance (km)</Label>
            <Input
              id="place-km"
              name="accessKm"
              inputMode="decimal"
              value={accessKm}
              onChange={(event) => setAccessKm(event.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              From that start to the door. Correct it if you know the road
              better than the map does.
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="place-surface">Access road surface</Label>
            <select
              id="place-surface"
              name="accessSurface"
              className="border-input bg-background focus-ring h-10 rounded-md border px-3 text-sm"
              value={accessSurface}
              onChange={(event) =>
                setAccessSurface(event.target.value === "tar" ? "tar" : "gravel")
              }
            >
              <option value="gravel">Gravel (the safe assumption)</option>
              <option value="tar">Tar all the way</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="place-floor">Never sell a trip here below (N$)</Label>
            <Input
              id="place-floor"
              name="minimumFare"
              inputMode="decimal"
              value={minimumFare}
              onChange={(event) => setMinimumFare(event.target.value)}
              placeholder="Optional"
            />
            <p className="text-muted-foreground text-xs">
              For a place minutes from an airport, where the real cost is the
              car coming out from town.
            </p>
          </div>

          {saved && !saved.ok && (
            <p className="text-destructive text-sm sm:col-span-2">{saved.message}</p>
          )}
          {stale && (
            <p className="text-sm sm:col-span-2">
              The pin was changed after measuring. Measure again before saving.
            </p>
          )}

          <div className="sm:col-span-2">
            <Button
              type="submit"
              disabled={saving || stale || name.trim().length < 3 || !accessKm.trim()}
              className="press h-11"
            >
              {saving ? "Saving…" : `Save ${name.trim() || "this place"} as verified`}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

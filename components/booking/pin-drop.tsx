"use client";

import * as React from "react";
import { MapPinIcon, XIcon } from "lucide-react";

import "mapbox-gl/dist/mapbox-gl.css";
import type { Map as MapboxMap, Marker as MapboxMarker } from "mapbox-gl";

import { Button } from "@/components/ui/button";
import { isInNamibia, mapsLink, roundCoord } from "@/lib/maps/bounds";
import { publicMapboxToken } from "@/lib/maps/mapbox";
import type { LatLng } from "@/lib/maps/types";

/**
 * The third part of the address answer, after the pick-list and the note.
 *
 * Namibian address data is too sparse for street-address autocomplete to
 * return somewhere a driver can find, which is why the destination is a
 * curated list. But a list cannot name every guesthouse, farm gate or private
 * home, and "the blue gate past the water tower" only helps a driver who is
 * already on the right road. A pin is the precision upgrade for exactly that
 * case, and it is optional precisely because most people do not need it.
 *
 * Deliberately collapsed until asked for. mapbox-gl is ~230KB — more than the
 * rest of the booking form put together — so it loads when someone opens this,
 * and never for the majority who pick a hotel off the list and move on.
 *
 * The thing to be careful about: most people booking an airport transfer are
 * flying into Namibia for the first time and have no idea where anything is.
 * Ask them to drop a pin and they will guess, and a confidently wrong pin is
 * worse than none — a driver trusts a coordinate over a place name. So the
 * copy below never asks anyone to place a pin they cannot place. When we
 * already know the property (`known`), it says so and offers the pin only for
 * a specific gate. Otherwise it says out loud that naming the lodge in the
 * notes beats a guess, because for a first-time visitor it does.
 */

type Props = {
  /** Where to open the map when there is no pin yet — the town, usually. */
  centre: LatLng | null;
  value: LatLng | null;
  onChange: (point: LatLng | null) => void;
  label: string;
  /** Names the place the pin refines, so the prompt is about their trip. */
  placeLabel?: string;
  /**
   * True when the chosen place is one we can already find — a named hotel or
   * a landmark. Changes the ask from "where is this?" to "any particular
   * entrance?", which is the only question left worth asking.
   */
  known?: boolean;
};

export function PinDrop({
  centre,
  value,
  onChange,
  label,
  placeLabel,
  known = false,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const token = publicMapboxToken();

  // Without a token or somewhere to open the map, there is nothing to offer.
  // Renders nothing rather than a button that cannot work.
  if (!token || (!centre && !value)) return null;

  return (
    <div className="rounded-lg border border-dashed p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <MapPinIcon className="text-brand size-4 shrink-0" aria-hidden />
            {label}
          </p>
          <p className="text-muted-foreground mt-0.5 text-sm leading-snug text-pretty">
            {value ? (
              "Your driver will be given this exact spot."
            ) : known && placeLabel ? (
              <>
                Not needed &mdash; we know where {placeLabel} is. Drop a pin
                only if you need a particular gate or entrance.
              </>
            ) : (
              <>
                Optional, and only if you know the spot. First time in Namibia?
                Skip this and put the name of your lodge or guesthouse in the
                notes below &mdash; a name we can look up beats a pin placed
                from a guess.
              </>
            )}
          </p>
        </div>

        {!open && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="press shrink-0"
            onClick={() => setOpen(true)}
          >
            {value ? "Move the pin" : "Drop a pin"}
          </Button>
        )}
      </div>

      {value && !open && (
        <p className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="tabular">
            {roundCoord(value.lat)}, {roundCoord(value.lng)}
          </span>
          <a
            href={mapsLink(value)}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            Check it on Google Maps
          </a>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="hover:text-foreground inline-flex items-center gap-1 underline underline-offset-2"
          >
            <XIcon className="size-3" aria-hidden />
            Remove
          </button>
        </p>
      )}

      {open && (
        <PinMap
          token={token}
          centre={value ?? centre!}
          value={value}
          onChange={onChange}
          onDone={() => setOpen(false)}
        />
      )}
    </div>
  );
}

/**
 * The map itself, mounted only once someone opens the control — which is what
 * keeps mapbox-gl out of the bundle for everyone else.
 */
function PinMap({
  token,
  centre,
  value,
  onChange,
  onDone,
}: {
  token: string;
  centre: LatLng;
  value: LatLng | null;
  onChange: (point: LatLng | null) => void;
  onDone: () => void;
}) {
  const container = React.useRef<HTMLDivElement | null>(null);
  const map = React.useRef<MapboxMap | null>(null);
  const marker = React.useRef<MapboxMarker | null>(null);
  const [draft, setDraft] = React.useState<LatLng>(value ?? centre);
  const [failed, setFailed] = React.useState(false);
  const [ready, setReady] = React.useState(false);

  // `onChange` is not a dependency: this effect builds the map once, and the
  // handler is read through a ref so a re-render never tears the map down.
  const commit = React.useRef(onChange);
  commit.current = onChange;

  React.useEffect(() => {
    const node = container.current;
    if (!node || map.current) return;

    let cancelled = false;

    (async () => {
      try {
        const mapboxgl = (await import("mapbox-gl")).default;
        if (cancelled || !container.current) return;

        mapboxgl.accessToken = token;
        const instance = new mapboxgl.Map({
          container: container.current,
          style: "mapbox://styles/mapbox/streets-v12",
          center: [centre.lng, centre.lat],
          zoom: 14,
          attributionControl: true,
        });
        instance.addControl(new mapboxgl.NavigationControl(), "top-right");

        const pin = new mapboxgl.Marker({ color: "#bc4b00", draggable: true })
          .setLngLat([centre.lng, centre.lat])
          .addTo(instance);

        const read = () => {
          const { lng, lat } = pin.getLngLat();
          setDraft({ lat: roundCoord(lat), lng: roundCoord(lng) });
        };
        pin.on("dragend", read);

        // Tapping the map moves the pin. On a phone, dragging a marker with a
        // thumb is fiddly and tapping where you mean is not.
        instance.on("click", (event) => {
          pin.setLngLat(event.lngLat);
          read();
        });

        // Degrade rather than collapse. A blank grey rectangle with a marker
        // floating in it is worse than saying so: the traveller cannot tell
        // whether they have placed a pin or not. The load timer covers the
        // case Mapbox never answers at all, which no error event reports.
        instance.on("load", () => setReady(true));
        instance.on("error", (event) => {
          const message = String(event?.error?.message ?? "");
          if (
            message.includes("style") ||
            message.includes("Failed to fetch")
          ) {
            setFailed(true);
          }
        });

        map.current = instance;
        marker.current = pin;
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    const timeout = window.setTimeout(() => {
      if (!cancelled) setFailed((already) => already || !map.current?.loaded());
    }, 10_000);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      marker.current?.remove();
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const outOfBounds = !isInNamibia(draft);

  if (failed) {
    return (
      <div className="mt-3">
        <p className="text-muted-foreground text-sm leading-snug text-pretty">
          The map could not load. Describe the spot in the notes below instead
          &mdash; a landmark helps a Namibian driver more than a street name
          anyway, and nothing about your booking depends on this.
        </p>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="press mt-2"
          onClick={onDone}
        >
          Close
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <div
        ref={container}
        className="bg-muted h-56 w-full overflow-hidden rounded-md border sm:h-64"
        // The form is long; a stray Enter inside the map must not submit it.
        onKeyDown={(event) => {
          if (event.key === "Enter") event.preventDefault();
        }}
      />

      <p className="text-muted-foreground mt-2 text-xs">
        Tap the map, or drag the pin, to mark the spot.
      </p>

      {outOfBounds && (
        <p className="text-destructive mt-1.5 text-xs">
          That is outside Namibia. Move the pin to where you are actually going.
        </p>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={outOfBounds || !ready}
          className="press bg-brand text-brand-foreground hover:bg-brand-hover"
          onClick={() => {
            commit.current(draft);
            onDone();
          }}
        >
          Use this spot
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="press"
          onClick={onDone}
        >
          Cancel
        </Button>
        <span className="text-muted-foreground tabular ml-auto text-xs">
          {draft.lat}, {draft.lng}
        </span>
      </div>
    </div>
  );
}

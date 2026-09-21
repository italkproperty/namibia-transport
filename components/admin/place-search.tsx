"use client";

import * as React from "react";
import { MapPinIcon, PlaneIcon } from "lucide-react";

export type PlaceOption = {
  slug: string;
  name: string;
  region: string;
  isAirport?: boolean;
};

/**
 * Type-to-find over every place the road network knows.
 *
 * Forty-nine towns, gates and airports is too many for a select and far too
 * few to need a server round trip, so the whole list ships with the page and
 * filters as you type. It matches on the region too, which is how an operator
 * actually searches when the traveller says "somewhere near Etosha".
 *
 * Keyboard first, because this gets driven while somebody is on the phone:
 * arrows move, Enter picks, Escape closes.
 */
export function PlaceSearch({
  places,
  value,
  onSelect,
  placeholder = "Search any town, gate or airport…",
  id,
}: {
  places: PlaceOption[];
  value: string | null;
  onSelect: (slug: string) => void;
  placeholder?: string;
  id?: string;
}) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const boxRef = React.useRef<HTMLDivElement | null>(null);

  const selected = places.find((place) => place.slug === value) ?? null;

  const matches = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return places.slice(0, 12);
    return places
      .filter(
        (place) =>
          place.name.toLowerCase().includes(needle) ||
          place.region.toLowerCase().includes(needle),
      )
      .slice(0, 12);
  }, [places, query]);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = (slug: string) => {
    onSelect(slug);
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={id ? `${id}-list` : undefined}
        aria-autocomplete="list"
        value={open ? query : (selected?.name ?? "")}
        placeholder={selected ? selected.name : placeholder}
        onFocus={() => {
          setOpen(true);
          setQuery("");
          setActive(0);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, matches.length - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (event.key === "Enter" && open && matches[active]) {
            event.preventDefault();
            pick(matches[active].slug);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        className="border-input bg-background focus-ring h-10 w-full rounded-md border px-3 text-sm"
      />

      {open && matches.length === 0 && (
        <div className="bg-popover absolute z-30 mt-1 w-full rounded-md border p-3 shadow-lg">
          <p className="text-sm font-medium">
            No town called &ldquo;{query.trim()}&rdquo;
          </p>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            This list is the towns, gates and airports our road model knows —
            lodges and guest farms are not in it. Pick the nearest town here,
            then type the real name in{" "}
            <span className="text-foreground">Called something else?</span> The
            traveller sees the name you type.
          </p>
        </div>
      )}

      {open && matches.length > 0 && (
        <ul
          id={id ? `${id}-list` : undefined}
          role="listbox"
          className="bg-popover absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-md border p-1 shadow-lg"
        >
          {matches.map((place, index) => (
            <li key={place.slug}>
              <button
                type="button"
                role="option"
                aria-selected={index === active}
                onMouseEnter={() => setActive(index)}
                onClick={() => pick(place.slug)}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${
                  index === active ? "bg-muted" : ""
                }`}
              >
                {place.isAirport ? (
                  <PlaneIcon
                    className="text-muted-foreground size-3.5 shrink-0"
                    aria-hidden
                  />
                ) : (
                  <MapPinIcon
                    className="text-muted-foreground size-3.5 shrink-0"
                    aria-hidden
                  />
                )}
                <span className="min-w-0 flex-1 truncate">{place.name}</span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {place.region}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

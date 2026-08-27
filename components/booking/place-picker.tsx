"use client";

import * as React from "react";
import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Place } from "@/lib/places";

/**
 * Destination picker over a curated list.
 *
 * A dropdown is fine for eight suburbs and hostile for forty hotels, so this
 * filters as you type. It is still a closed list — every option is somewhere
 * we know how to reach — which is the distinction CLAUDE.md draws between a
 * curated pick-list and street-address autocomplete.
 *
 * Matching is on the property name and its area together, so "klein" surfaces
 * the guesthouses in Klein Windhoek rather than only the suburb itself.
 */
const KIND_LABEL: Record<Place["kind"], string> = {
  hotel: "Hotels",
  guesthouse: "Guesthouses",
  landmark: "Airports & landmarks",
  area: "Areas",
};

const KIND_ORDER: Place["kind"][] = ["hotel", "guesthouse", "landmark", "area"];

export function PlacePicker({
  places,
  value,
  onChange,
  id,
  placeholder = "Search hotels and areas",
}: {
  places: Place[];
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const matches = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return places;
    return places.filter((place) =>
      `${place.name} ${place.area ?? ""}`.toLowerCase().includes(q)
    );
  }, [places, query]);

  const grouped = React.useMemo(() => {
    return KIND_ORDER.map((kind) => ({
      kind,
      items: matches.filter((place) => place.kind === kind),
    })).filter((group) => group.items.length > 0);
  }, [matches]);

  const choose = (name: string) => {
    onChange(name);
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger
        id={id}
        className="border-input bg-background focus-visible:ring-ring flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-md border px-3 text-left text-sm focus-visible:ring-[3px] focus-visible:outline-none"
      >
        <span className="min-w-0 truncate">{value || placeholder}</span>
        <ChevronDownIcon className="text-muted-foreground size-4 shrink-0" aria-hidden />
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <div className="flex items-center gap-2 border-b px-3">
          <SearchIcon className="text-muted-foreground size-4 shrink-0" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            className="h-10 w-full bg-transparent text-sm outline-none"
          />
        </div>

        <div className="max-h-72 overflow-y-auto p-1">
          {grouped.length === 0 ? (
            <p className="text-muted-foreground px-3 py-6 text-center text-sm">
              Nothing matches. Pick the nearest area and name it in the notes —
              your driver will confirm on WhatsApp.
            </p>
          ) : (
            grouped.map((group) => (
              <div key={group.kind}>
                <p className="text-muted-foreground px-3 pt-2 pb-1 text-[0.7rem] font-medium tracking-wide uppercase">
                  {KIND_LABEL[group.kind]}
                </p>
                <ul>
                  {group.items.map((place) => {
                    const selected = place.name === value;
                    return (
                      <li key={place.name}>
                        <button
                          type="button"
                          onClick={() => choose(place.name)}
                          className="hover:bg-muted focus-visible:bg-muted flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left focus-visible:outline-none"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm">
                              {place.name}
                            </span>
                            {place.area && (
                              <span className="text-muted-foreground text-xs">
                                {place.area}
                              </span>
                            )}
                          </span>
                          {selected && (
                            <CheckIcon className="text-brand size-4 shrink-0" aria-hidden />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

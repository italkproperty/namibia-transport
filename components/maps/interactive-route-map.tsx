"use client";

import * as React from "react";

// Static rather than dynamic: it is ~8KB gzipped, and Next has no typed way
// to await a stylesheet. The 230KB of JavaScript is what actually needed to
// be deferred, and still is.
import "mapbox-gl/dist/mapbox-gl.css";
import type { GeoJSONSource, Map as MapboxMap } from "mapbox-gl";

import { boundsOf, decodePolyline } from "@/lib/maps/polyline";
import { publicMapboxToken } from "@/lib/maps/mapbox";

/**
 * Upgrades a static route map into a real one you can pan, zoom and read.
 *
 * mapbox-gl is around 230KB of JavaScript, which is more than the whole rest
 * of this page. It is therefore never part of the initial bundle: the static
 * image renders first — instantly, and visible to crawlers — and the library
 * is imported only once the map scrolls into view. Someone who books without
 * ever reaching it never pays for it.
 *
 * Gestures are cooperative: two fingers to pan on touch, ctrl/⌘ to zoom on a
 * trackpad. A map embedded mid-page that swallows the scroll is worse than no
 * map at all.
 */

type Props = {
  /** Encoded polyline6 of the driven road. Without it there is no route. */
  geometry: string | null;
  origin: [number, number];
  destination: [number, number];
  originLabel: string;
  destinationLabel: string;
};

export function InteractiveRouteMap({
  geometry,
  origin,
  destination,
  originLabel,
  destinationLabel,
}: Props) {
  const container = React.useRef<HTMLDivElement | null>(null);
  // Typed from the library rather than `any`: `import type` is erased at
  // compile time, so this costs nothing in the bundle while still catching a
  // misspelled method.
  const map = React.useRef<MapboxMap | null>(null);
  const [ready, setReady] = React.useState(false);
  const [inView, setInView] = React.useState(false);

  const token = publicMapboxToken();

  const path = React.useMemo(
    () => (geometry ? decodePolyline(geometry, 6) : []),
    [geometry]
  );

  /* Load only when the map is actually about to be looked at. */
  React.useEffect(() => {
    const node = container.current;
    if (!node || inView) return;

    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [inView]);

  /* Create the map once, then keep it and swap its data. */
  React.useEffect(() => {
    if (!inView || !token || !container.current || map.current) return;

    let cancelled = false;

    (async () => {
      try {
        const mapboxgl = (await import("mapbox-gl")).default;
        if (cancelled || !container.current) return;

        mapboxgl.accessToken = token;

        const instance = new mapboxgl.Map({
          container: container.current,
          style: "mapbox://styles/mapbox/streets-v12",
          center: origin,
          zoom: 6,
          attributionControl: true,
          cooperativeGestures: true,
        });

        instance.addControl(
          new mapboxgl.NavigationControl({ showCompass: false }),
          "top-right"
        );
        instance.addControl(new mapboxgl.FullscreenControl(), "top-right");

        const marker = (colour: string, at: [number, number], label: string) =>
          new mapboxgl.Marker({ color: colour })
            .setLngLat(at)
            .setPopup(new mapboxgl.Popup({ offset: 24 }).setText(label))
            .addTo(instance);

        instance.on("load", () => {
          if (cancelled) return;

          if (path.length > 1) {
            instance.addSource("route", {
              type: "geojson",
              data: {
                type: "Feature",
                properties: {},
                geometry: { type: "LineString", coordinates: path },
              },
            });

            // Drawn twice: a wide soft casing so the line reads over pale
            // desert and dark tar alike, then the brand stroke on top.
            instance.addLayer({
              id: "route-casing",
              type: "line",
              source: "route",
              layout: { "line-cap": "round", "line-join": "round" },
              paint: {
                "line-color": "#fcfaf7",
                "line-width": 9,
                "line-opacity": 0.9,
              },
            });
            instance.addLayer({
              id: "route-line",
              type: "line",
              source: "route",
              layout: { "line-cap": "round", "line-join": "round" },
              paint: { "line-color": "#bc4b00", "line-width": 4.5 },
            });
          }

          marker("#1a1614", origin, originLabel);
          marker("#bc4b00", destination, destinationLabel);

          const bounds = boundsOf(
            path.length > 1 ? path : [origin, destination]
          );
          if (bounds) {
            instance.fitBounds(bounds, { padding: 56, duration: 0 });
          }

          setReady(true);
        });

        map.current = instance;
      } catch (error) {
        // The static image underneath stays visible, so a failure here costs
        // interactivity and nothing else.
        console.error("[maps] interactive map could not load", error);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Created once. Route changes are handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, token]);

  /* The home page swaps routes under us — update in place, never recreate. */
  React.useEffect(() => {
    const instance = map.current;
    if (!instance || !ready) return;

    const source = instance.getSource("route") as GeoJSONSource | undefined;
    if (source && path.length > 1) {
      source.setData({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: path },
      });
    }

    const bounds = boundsOf(path.length > 1 ? path : [origin, destination]);
    if (bounds) {
      instance.fitBounds(bounds, { padding: 56, duration: 600 });
    }
  }, [ready, path, origin, destination]);

  React.useEffect(() => {
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  if (!token) return null;

  return (
    <div
      ref={container}
      aria-hidden={!ready}
      className={`absolute inset-0 size-full transition-opacity duration-300 ${
        ready ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    />
  );
}

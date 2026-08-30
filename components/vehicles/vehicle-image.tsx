import Image from "next/image";

import { VehicleArt } from "@/components/vehicles/vehicle-art";
import type { VehicleSpec } from "@/lib/vehicles";

/**
 * The one place that decides drawing-or-photograph.
 *
 * Every surface renders through this, so setting `photo` on a spec swaps that
 * class everywhere at once — no component changes, no half-photographed page.
 * The drawings stay as the fallback, and stay in use at picker size, where a
 * photograph shrunk to ninety pixels is mush and a silhouette is not.
 */
export function VehicleImage({
  spec,
  alt,
  className,
  priority = false,
}: {
  spec: VehicleSpec;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  if (spec.photo) {
    // A fixed 16:9 box with object-contain rather than object-cover: these
    // photographs arrive at different aspect ratios and with the vehicle
    // framed differently in each, and cropping a car to fill a box takes the
    // bumpers off. Contain keeps every silhouette whole and keeps the image
    // areas the same height across the row.
    return (
      <div className={`relative aspect-[16/9] w-full ${className ?? ""}`}>
        <Image
          src={spec.photo}
          alt={alt}
          fill
          sizes="(min-width: 1024px) 22rem, (min-width: 640px) 45vw, 90vw"
          priority={priority}
          className={`object-contain ${spec.flip ? "-scale-x-100" : ""}`}
        />
      </div>
    );
  }

  return <VehicleArt kind={spec.art} className={className} />;
}

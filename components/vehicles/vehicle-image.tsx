import Image from "next/image";

import { VehicleArt } from "@/components/vehicles/vehicle-art";
import type { VehicleSpec } from "@/lib/vehicles";

/**
 * The one place that decides drawing-or-photograph.
 *
 * Every surface renders through this, so the day there is a photograph of a
 * real partner vehicle, setting `photo` on the spec swaps it everywhere at
 * once — no component changes, no half-photographed page.
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
    return (
      <Image
        src={spec.photo}
        alt={alt}
        width={640}
        height={360}
        priority={priority}
        className={`h-auto w-full rounded-lg object-cover ${className ?? ""}`}
      />
    );
  }

  return <VehicleArt kind={spec.art} className={className} />;
}

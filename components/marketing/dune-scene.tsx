/**
 * A branded Namibian horizon, drawn rather than photographed.
 *
 * Real photography of our actual vehicles and drivers replaces this once it
 * exists — an honest illustration in the brand's own geometry beats generic
 * stock or AI-generated "authenticity". Decorative only: aria-hidden, sits
 * behind content, never carries text.
 */
export function DuneScene({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      viewBox="0 0 1440 320"
      preserveAspectRatio="xMidYMax slice"
      fill="none"
    >
      {/* Sun, low over the far dunes. */}
      <circle cx="1150" cy="120" r="46" fill="var(--brand)" opacity="0.16" />
      <circle cx="1150" cy="120" r="26" fill="var(--brand)" opacity="0.2" />

      {/* Far ridge. */}
      <path
        d="M0 240 C 220 150, 430 160, 640 210 C 820 252, 1000 240, 1180 196 C 1280 172, 1370 168, 1440 178 L 1440 320 L 0 320 Z"
        fill="var(--brand)"
        opacity="0.12"
      />
      {/* Mid ridge. */}
      <path
        d="M0 276 C 180 210, 400 206, 610 248 C 800 286, 1010 278, 1200 240 C 1300 220, 1390 218, 1440 226 L 1440 320 L 0 320 Z"
        fill="var(--brand)"
        opacity="0.22"
      />
      {/* Near ridge. */}
      <path
        d="M0 306 C 240 262, 480 260, 720 288 C 940 314, 1180 308, 1440 278 L 1440 320 L 0 320 Z"
        fill="var(--brand)"
        opacity="0.34"
      />
      {/* The route line from the mark, at landscape scale. */}
      <path
        d="M60 312 C 320 290, 600 246, 860 200 C 980 179, 1080 160, 1160 146"
        stroke="var(--background)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="1 14"
        opacity="0.9"
      />
      <circle cx="1180" cy="142" r="5" fill="var(--background)" />
      <circle cx="1180" cy="142" r="9" stroke="var(--background)" strokeWidth="2" opacity="0.5" />
    </svg>
  );
}

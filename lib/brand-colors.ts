/**
 * The palette's literal values, for the surfaces CSS cannot reach.
 *
 * Everything rendered in the browser should use the tokens in `app/globals.css`
 * and never these. But four kinds of output are drawn outside a stylesheet and
 * have no access to a custom property:
 *
 *   - Mapbox static-image overlays, where a colour is six hex digits in a URL
 *   - Mapbox GL paint properties, which are evaluated in the map's own runtime
 *   - HTML email, where custom properties are unsupported by most clients
 *   - `next/og` images and the favicon, which render on the server with no DOM
 *
 * Before this file each of those carried its own copy, so a palette change
 * meant finding ten literals across maps, mail and icons and would silently
 * miss one. Now the values live here and the CSS tokens are the only other
 * place they appear — keep the two in step, and prefer changing this file
 * over typing a hex anywhere else.
 */

/**
 * These are the *compiled* values of the OKLCH tokens, read back off the built
 * stylesheet — not hand-converted approximations of them. The difference is
 * not academic: eyeballing --brand as #0b4f8f put a route-map pin four points
 * of blue away from the button beside it. If a token in globals.css changes,
 * take the new value from the built CSS rather than from a colour picker.
 */
export const BRAND_COLORS = {
  /** --foreground. Tar. */
  ink: "#11151a",
  /** --background. Cool paper. */
  paper: "#f3f5f6",
  /** --card. */
  surface: "#ffffff",
  /** --muted-foreground. */
  muted: "#5f656d",
  /** --border. */
  line: "#dbdee1",
  /** --brand. Route-marker blue. */
  brand: "#004e94",
  /** --brand-foreground. */
  onBrand: "#fbfcfd",
} as const;

/**
 * Mapbox's static API takes colours as bare hex without the leading hash, and
 * silently renders a default marker if one slips through with it.
 */
export function mapHex(color: string): string {
  return color.replace(/^#/, "");
}

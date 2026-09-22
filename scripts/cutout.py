#!/usr/bin/env python3
"""
Lift a vehicle off a flat studio backdrop.

Studio vehicle photography is the awkward case for a background remover: the
backdrop is a light grey sweep and most press cars are white, so the two
overlap in brightness and a plain threshold punches holes in the bodywork.
What separates them is connectivity — the backdrop reaches every border pixel
and the car does not — so the fill is stopped by edges rather than by colour,
which still holds along the roofline where white meets grey at ten levels of
contrast.

The fill is also held to light pixels. Without that it drains out of the
backdrop, through the soft contact shadow, and into the black of the tyres,
which then come out as grey ghosts.

The dark void under the sills is the underbody, not the floor, and belongs to
the car — filling the mask's holes keeps it, along with the gaps between the
wheel spokes.

Needs pillow, numpy and scipy, which are not project dependencies — this runs
by hand when a photograph arrives, not in the build:

    pip install pillow numpy scipy
    python3 scripts/cutout.py new-photo.jpg public/vehicles/suv-4x4.webp --shadow

Then look at the result on a dark ground at full size before committing it.
"""
import argparse

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage


def grad_of(im: Image.Image) -> np.ndarray:
    blurred = im.filter(ImageFilter.GaussianBlur(1)).convert("L")
    gy, gx = np.gradient(np.asarray(blurred).astype(float))
    return np.hypot(gx, gy)


def cut(src: str, edge: float, light: float, mode: str):
    im = Image.open(src).convert("RGB")
    rgb = np.asarray(im).astype(float)
    lum = rgb.mean(2)

    grad = grad_of(im)

    if mode == "white":
        # A subject cut out onto pure white already, which is a different
        # problem: there is no backdrop tone to find, and the edge-following
        # fill has nothing to follow — on the 474px sedan it wandered straight
        # through the bonnet and took half of it off. Keying on white instead
        # keeps the whole car, because bodywork is shaded and almost never
        # reaches 250, while the ground behind it is a flat 255.
        passable = lum >= light
    else:
        passable = (grad <= edge) & (lum > light)
    labels, _ = ndimage.label(passable)
    rim = np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]])
    background = np.isin(labels, np.unique(rim[rim > 0]))

    subject = ndimage.binary_fill_holes(~background)

    # Specks of backdrop the edge threshold isolated are not subjects.
    parts, count = ndimage.label(subject)
    if count > 1:
        sizes = ndimage.sum(subject, parts, range(1, count + 1))
        subject = parts == (int(np.argmax(sizes)) + 1)

    # The darkest sliver of the floor shadow is below the light threshold, so
    # it survives as a ragged streak welded to the tyres — a hard edge where
    # the photograph has a soft one, which is the tell that something was cut
    # out badly. Opening severs anything only a few pixels thick; dilating the
    # surviving core back into the mask returns the wipers, roof rails and
    # aerial that the same opening would otherwise shave off.
    core = ndimage.binary_opening(subject, ndimage.generate_binary_structure(2, 1), iterations=3)
    parts, count = ndimage.label(core)
    if count > 1:
        sizes = ndimage.sum(core, parts, range(1, count + 1))
        core = parts == (int(np.argmax(sizes)) + 1)
    if core.any():
        near = ndimage.binary_dilation(core, ndimage.generate_binary_structure(2, 2), iterations=6)
        subject = subject & near

    return im, rgb, subject


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument(
        "--mode",
        choices=("sweep", "white"),
        default="sweep",
        help="sweep: a grey studio backdrop. white: already cut onto pure white.",
    )
    ap.add_argument("--edge", type=float, default=4.0)
    ap.add_argument(
        "--light",
        type=float,
        default=None,
        help="Backdrop is lighter than this. Default 55 for sweep, 250 for white.",
    )
    ap.add_argument(
        "--shadow",
        action="store_true",
        help="Add a soft ground shadow under the subject.",
    )
    args = ap.parse_args()
    light = args.light if args.light is not None else (250.0 if args.mode == "white" else 55.0)

    im, rgb, subject = cut(args.src, args.edge, light, args.mode)
    h, w = subject.shape

    alpha = subject.astype(float)

    # The pixel on the silhouette is a blend of car and backdrop, so leaving it
    # opaque leaves a pale fringe against a dark page. Pull the hard edge in by
    # one pixel, then feather what is left.
    rim = subject & ~ndimage.binary_erosion(subject, iterations=1)
    alpha[rim] = 0.8
    alpha = np.clip(ndimage.gaussian_filter(alpha, 0.6), 0, 1)

    out = rgb.copy()

    if args.shadow:
        # A drawn shadow rather than the one in the photograph: the originals
        # disagree about how hard their floor shadow is, and three cars in a
        # row with three different grounds reads as three different sites.
        ys, xs = np.nonzero(subject)
        floor, left, right = ys.max(), xs.min(), xs.max()
        cx, half = (left + right) / 2, (right - left) / 2

        yy, xx = np.mgrid[0:h, 0:w]
        ellipse = ((xx - cx) / (half * 0.92)) ** 2 + (
            (yy - floor) / max(h * 0.035, 6)
        ) ** 2
        cast = np.clip(1 - ellipse, 0, 1) ** 1.6 * 0.30
        cast = ndimage.gaussian_filter(cast, max(h * 0.012, 3))
        cast[subject] = 0

        out = np.where(subject[..., None], out, 25.0)
        alpha = np.maximum(alpha, cast)

    rgba = np.dstack([out, np.clip(alpha, 0, 1) * 255]).astype(np.uint8)
    Image.fromarray(rgba, "RGBA").save(args.dst)

    opaque = (alpha > 0.99).mean() * 100
    clear = (alpha < 0.01).mean() * 100
    print(f"{args.dst}: {opaque:.1f}% opaque, {clear:.1f}% clear, {w}x{h}")

    # Two things this cannot do, said plainly rather than guessed at.
    #
    # It needs the subject to differ in tone from its ground. A white car on a
    # white sweep gives the fill almost nothing to stop at and it eats into the
    # bodywork — on the 474px sedan it took half the bonnet off. Several
    # attempts at scoring that automatically all passed the ruined cut, so
    # there is no score here: look at the result, on a dark ground, at full
    # size, where a bitten panel or a pale fringe is obvious and a thumbnail
    # hides both.
    if min(w, h) < 600:
        print(f"  WARNING: {w}x{h} is small for a card that renders near 700px wide.")


if __name__ == "__main__":
    main()

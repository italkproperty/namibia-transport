import * as React from "react";

/**
 * A pass-through, and it has to exist.
 *
 * Next renders the not-found file of the closest segment that is a real
 * boundary, and a route group with no layout of its own is not one — so
 * `notFound()` raised from a booking or quote page skipped both the group's
 * not-found and the root's, and fell all the way through to Next's built-in
 * default: black on white, no header, no way to reach us. This layout makes
 * `(booking)/not-found.tsx` the boundary it was meant to be.
 */
export default function BookingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

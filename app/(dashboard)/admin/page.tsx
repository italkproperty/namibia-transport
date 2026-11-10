import { redirect } from "next/navigation";

/** Fail inside half a minute, not at the platform's five: a page that has
 *  not answered by then is stuck behind a dead connection, and the
 *  operator needs an error they can act on, not a 504 later. */
export const maxDuration = 30;

export default function AdminIndexPage() {
  redirect("/admin/bookings");
}

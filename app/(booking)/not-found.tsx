import { NotFoundPage } from "@/components/marketing/not-found-page";

/**
 * A booking or quote reference that matches nothing.
 *
 * A reference is read off a WhatsApp message and typed by hand, or arrives in
 * a link an email client has wrapped — so getting one wrong is ordinary, and
 * the moment it happens is the moment a traveller is least able to cope with a
 * dead end. This says what the reference looks like and gives them a way to
 * send it to us.
 */
export default function BookingNotFound() {
  return <NotFoundPage lostLink />;
}

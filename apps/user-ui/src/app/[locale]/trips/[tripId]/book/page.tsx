/**
 * Booking page entry point.
 * Server component that awaits async params (Next.js 16 convention)
 * and delegates rendering to BookingClient.
 */

import BookingClient from "./BookingClient";

type Params = Promise<{
  locale: string;
  tripId: string;
}>;

export default async function BookingPage({ params }: { params: Params }) {
  // ⭐ fix baseline : BookingClient lit désormais la locale via useLocale(),
  // la prop `locale` n'existe plus dans ses Props.
  const { tripId } = await params;
  return <BookingClient tripId={tripId} />;
}

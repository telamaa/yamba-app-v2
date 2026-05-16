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
  const { locale, tripId } = await params;
  return <BookingClient locale={locale} tripId={tripId} />;
}

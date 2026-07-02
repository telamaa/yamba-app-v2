/**
 * /[locale]/bookings/[bookingId]
 * ==============================
 * Route Next.js App Router pour le détail d'un Booking côté Expéditeur.
 * L'URL reste stable peu importe le statut — BookingTrackerClient orchestre la view.
 */

import BookingTrackerClient from "@/components/booking/booking-tracker/BookingTrackerClient";

type Props = {
  params: Promise<{ locale: string; bookingId: string }>;
};

export default async function BookingTrackerPage({ params }: Props) {
  const { bookingId } = await params;
  return <BookingTrackerClient bookingId={bookingId} />;
}

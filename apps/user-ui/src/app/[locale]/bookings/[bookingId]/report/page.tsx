/**
 * /[locale]/bookings/[bookingId]/report
 * =====================================
 * Formulaire de signalement de litige côté Expéditeur (pendant la
 * période de vérification). Envoi → Deal DISPUTED, payout gelé,
 * ticket support ouvert.
 */

import BookingReportClient from "@/components/booking/booking-tracker/views/report/BookingReportClient";

type Props = {
  params: Promise<{ locale: string; bookingId: string }>;
};

export default async function BookingReportPage({ params }: Props) {
  const { bookingId } = await params;
  return <BookingReportClient bookingId={bookingId} />;
}

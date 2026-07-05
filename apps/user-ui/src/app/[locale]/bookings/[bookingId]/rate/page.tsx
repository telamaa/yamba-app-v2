/**
 * /[locale]/bookings/[bookingId]/rate
 * ===================================
 * L'Expéditeur note le Voyageur (Deal COMPLETED).
 */

import RatingClient from "@/components/rating/RatingClient";

type Props = {
  params: Promise<{ locale: string; bookingId: string }>;
};

export default async function BookingRatePage({ params }: Props) {
  const { bookingId } = await params;
  return (
    <RatingClient dealId={bookingId} backPath={"/bookings/" + bookingId} />
  );
}

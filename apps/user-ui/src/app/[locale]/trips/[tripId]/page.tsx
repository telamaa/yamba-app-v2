import { setRequestLocale } from "next-intl/server";
import TripDetailClient from "./TripDetailClient";

type Props = {
  params: Promise<{ locale: string; tripId: string }>;
};

export default async function TripDetailPage({ params }: Props) {
  const { locale, tripId } = await params;
  setRequestLocale(locale);

  return <TripDetailClient tripId={tripId} />;
}

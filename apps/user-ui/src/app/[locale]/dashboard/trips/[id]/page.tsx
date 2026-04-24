"use client";

import { useParams } from "next/navigation";
import TripDetails from "@/components/trips/detail/TripDetails";

export default function TripDetailPage() {
  const params = useParams();
  const tripId = params?.id as string;

  return <TripDetails tripId={tripId} />;
}

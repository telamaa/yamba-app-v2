import TripFileView from "@/components/TripFileView";

export default async function TripFilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TripFileView tripId={id} />;
}

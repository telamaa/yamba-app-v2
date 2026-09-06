import DisputeFileView from "@/components/DisputeFileView";

export default async function DisputeFilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DisputeFileView bookingId={id} />;
}

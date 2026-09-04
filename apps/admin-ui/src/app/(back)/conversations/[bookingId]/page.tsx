import ConversationView from "@/components/ConversationView";

export default async function ConversationPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  return <ConversationView bookingId={bookingId} />;
}

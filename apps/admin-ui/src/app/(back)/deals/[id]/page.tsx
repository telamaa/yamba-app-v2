import DealMoneyView from "@/components/DealMoneyView";

export default async function DealMoneyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DealMoneyView dealId={id} />;
}

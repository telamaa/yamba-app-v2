/**
 * /[locale]/carrier/deals/[dealId]
 * =================================
 * Route Next.js App Router pour l'écran "Nouvelle demande de Deal"
 * côté voyageur. Server Component, transmet juste le dealId au client.
 */

import DealRequestClient from "@/components/carrier/deal-request/DealRequestClient";

type Props = {
  params: Promise<{ locale: string; dealId: string }>;
};

export default async function CarrierDealPage({ params }: Props) {
  const { dealId } = await params;
  return <DealRequestClient dealId={dealId} />;
}

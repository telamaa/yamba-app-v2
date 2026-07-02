/**
 * /[locale]/carrier/deals/[dealId]
 * =================================
 * Route Next.js App Router pour le détail d'un Deal côté Voyageur.
 * L'URL reste stable peu importe le statut — DealClient orchestre la view.
 */

import DealClient from "@/components/carrier/deal/DealClient";

type Props = {
  params: Promise<{ locale: string; dealId: string }>;
};

export default async function CarrierDealPage({ params }: Props) {
  const { dealId } = await params;
  return <DealClient dealId={dealId} />;
}

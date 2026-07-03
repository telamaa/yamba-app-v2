/**
 * /[locale]/carrier/deals/[dealId]/deliver
 * ========================================
 * Écran de saisie du code de livraison (Voyageur face au destinataire).
 * La validation du code clôt le voyage : Deal → DELIVERED, timer J+4 démarre.
 */

import DealDeliverClient from "@/components/carrier/deal/views/deliver/DealDeliverClient";

type Props = {
  params: Promise<{ locale: string; dealId: string }>;
};

export default async function CarrierDealDeliverPage({ params }: Props) {
  const { dealId } = await params;
  return <DealDeliverClient dealId={dealId} />;
}

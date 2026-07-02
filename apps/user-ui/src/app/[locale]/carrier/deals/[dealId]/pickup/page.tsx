/**
 * /[locale]/carrier/deals/[dealId]/pickup
 * =======================================
 * Écran d'action "Prise en charge du colis" côté Voyageur (jour J).
 * Formulaire dédié : checklist de vérification + photos + notes,
 * puis confirmation (→ révèle le code à l'Expéditeur) ou refus.
 */

import DealPickupClient from "@/components/carrier/deal/views/pickup/DealPickupClient";

type Props = {
  params: Promise<{ locale: string; dealId: string }>;
};

export default async function CarrierDealPickupPage({ params }: Props) {
  const { dealId } = await params;
  return <DealPickupClient dealId={dealId} />;
}

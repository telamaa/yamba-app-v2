/**
 * /[locale]/carrier/deals/[dealId]/rate
 * =====================================
 * Le Voyageur note l'Expéditeur (Deal COMPLETED).
 * Mock : le dealId doit contenir "shipper" pour charger le bon contexte
 * (ex: /fr/carrier/deals/shipper123/rate).
 */

import RatingClient from "@/components/rating/RatingClient";

type Props = {
  params: Promise<{ locale: string; dealId: string }>;
};

export default async function CarrierDealRatePage({ params }: Props) {
  const { dealId } = await params;
  return (
    <RatingClient dealId={dealId} backPath={"/carrier/deals/" + dealId} />
  );
}

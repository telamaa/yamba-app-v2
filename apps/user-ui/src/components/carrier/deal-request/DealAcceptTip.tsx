/**
 * DealAcceptTip.tsx
 * =================
 * Encart bleu pédagogique "Avant d'accepter, lis bien ces points".
 * Réutilise le TipBlock de BookingFormUi (cohérence visuelle avec le booking shipper).
 */

"use client";

import { Lightbulb } from "lucide-react";
import { useTranslations } from "next-intl";
import { TipBlock } from "@/components/booking/BookingFormUi";

type Props = {
  shipperFirstName: string;
  compact?: boolean; // version courte pour mobile / sidebar
};

const TIP_KEYS_FULL = [
  "checkContent",
  "refuseIfDiffers",
  "takePhotos",
  "ownRisk",
] as const;

const TIP_KEYS_SHORT = [
  "checkContentShort",
  "refuseIfDiffersShort",
  "takePhotosShort",
  "codeShort",
] as const;

export default function DealAcceptTip({ shipperFirstName, compact }: Props) {
  const t = useTranslations("carrierDealRequest");

  const keys = compact ? TIP_KEYS_SHORT : TIP_KEYS_FULL;
  const items = keys.map((key) =>
    t(`acceptTip.${key}`, { shipperFirstName })
  );

  return (
    <TipBlock
      icon={<Lightbulb size={16} />}
      title={compact ? t("acceptTip.titleShort") : t("acceptTip.title")}
      items={items}
    />
  );
}

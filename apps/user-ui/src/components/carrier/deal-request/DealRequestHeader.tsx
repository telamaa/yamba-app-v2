/**
 * DealRequestHeader.tsx
 * =====================
 * Header mobile : back + titre + sous-titre temporel.
 * Le bouton "partager" est retiré (inutile à ce stade du parcours).
 */

"use client";

import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { IconButton } from "@/components/booking/BookingFormUi";

type Props = {
  receivedAtIso: string;
  onBackAction: () => void;
};

export default function DealRequestHeader({
                                            receivedAtIso,
                                            onBackAction,
                                          }: Props) {
  const t = useTranslations("carrierDealRequest");
  const receivedAgo = formatReceivedAgo(receivedAtIso);

  return (
    <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
      <IconButton onClickAction={onBackAction} ariaLabel={t("back")}>
        <ArrowLeft size={18} />
      </IconButton>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-medium">{t("title")}</div>
        <div className="text-[11px] text-slate-400 dark:text-slate-500">
          {t("receivedAgo", { time: receivedAgo })}
        </div>
      </div>
    </div>
  );
}

function formatReceivedAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / (60 * 1000));
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem > 0 ? `${hours}h ${rem}min` : `${hours}h`;
}

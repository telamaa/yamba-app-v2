/**
 * PickupContactCard.tsx
 * =====================
 * Card sidebar "TON EXPÉDITRICE" : avatar + rating + Message / Appeler.
 */

"use client";

import { MessageSquare, Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import type { DealRequest } from "@/components/carrier/deal/deal.types";
import { useOpenDealThread } from "@/hooks/useMessaging";

type Props = {
  deal: DealRequest;
};

export default function PickupContactCard({ deal }: Props) {
  const t = useTranslations("carrierDealPickup");
  const { shipper } = deal;
  const initials = `${shipper.firstName[0] ?? ""}${shipper.lastInitial}`.toUpperCase();

  // Message et Appeler ouvrent le fil du deal (A137) ; le numéro s'y révèle quand le serveur l'autorise.
  const thread = useOpenDealThread();
  const handleMessage = () => thread.open(deal.id);
  const handleCall = () => thread.open(deal.id, "phone");

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {t("contactCard.label")}
      </h3>
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #534AB7, #7F77DD)" }}
          aria-hidden="true"
        >
          {initials}
        </div>
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-slate-900 dark:text-white">
            {shipper.firstName} {shipper.lastInitial}.
          </div>
          {/* Stats absentes de l'API réelle (BookingCounterpart) — masquées */}
          {(shipper.rating != null || shipper.shipmentCount != null) && (
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {shipper.rating != null && <>⭐ {shipper.rating.toFixed(1)} ·{" "}</>}
              {shipper.shipmentCount != null && (
                <>{t("contactCard.shipments", { count: shipper.shipmentCount })} ·{" "}</>
              )}
              {t("contactCard.verified")}
            </div>
          )}
        </div>
      </div>
      <div className="mt-3.5 flex gap-2">
        <button
          type="button"
          onClick={handleMessage}
          disabled={thread.isPending}
          className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white text-[12.5px] font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
        >
          <MessageSquare size={13} aria-hidden="true" />
          {t("contactCard.message")}
        </button>
        <button
          type="button"
          onClick={handleCall}
          disabled={thread.isPending}
          className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white text-[12.5px] font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
        >
          <Phone size={13} aria-hidden="true" />
          {t("contactCard.call")}
        </button>
      </div>
    </section>
  );
}

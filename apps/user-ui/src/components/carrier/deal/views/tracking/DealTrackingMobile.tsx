/**
 * DealTrackingMobile.tsx
 * ======================
 * Vue mobile tracking : header sticky 56px · banner flush · spotlight ·
 * timeline · Marie · Aminata · paiement · signaler. Pas de bottom-bar
 * (actions contextuelles via le spotlight, rien d'urgent en permanence).
 */

"use client";

import { AlertTriangle, ArrowLeft, HelpCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { DealTrackingViewProps } from "./DealTrackingClient";
import TrackingBanner from "./TrackingBanner";
import TrackingRecipientCard from "./TrackingRecipientCard";
import {
  TrackingParcelCard,
  TrackingPaymentCard,
  TrackingShipperCard,
} from "./TrackingSidebarCards";
import TrackingSpotlight from "./TrackingSpotlight";
import TrackingTimeline from "./TrackingTimeline";

export default function DealTrackingMobile(props: DealTrackingViewProps) {
  const t = useTranslations("carrierDealTracking");
  const { deal } = props;

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-slate-950">
      {/* Header sticky */}
      <div className="sticky top-0 z-10 flex h-14 items-center gap-1 border-b border-slate-200 bg-white px-2 dark:border-slate-800 dark:bg-slate-950">
        <button
          type="button"
          onClick={props.onBackAction}
          aria-label={t("back")}
          className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-[15px] font-semibold text-slate-900 dark:text-white">
            {t("title")}
          </div>
          <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
            {t("subtitleShort", { shipperFirstName: deal.shipper.firstName })}
          </div>
        </div>
        <button
          type="button"
          onClick={() => console.info("[tracking] open help")}
          aria-label={t("help")}
          className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <HelpCircle size={19} />
        </button>
      </div>

      <TrackingBanner deal={deal} variant="flush" />

      <div className="flex-1 space-y-3 px-4 pb-10 pt-4">
        <TrackingSpotlight
          deal={deal}
          confirmedEvents={props.confirmedEvents}
          onEventConfirmedAction={props.onEventConfirmedAction}
          onEventCommittedAction={props.onEventCommittedAction}
          onDeliverAction={props.onDeliverAction}
          compact
        />

        <TrackingTimeline
          deal={deal}
          confirmedEvents={props.confirmedEvents}
          compact
        />

        {deal.recipient && (
          <TrackingRecipientCard recipient={deal.recipient} compact />
        )}

        <TrackingShipperCard deal={deal} />

        <TrackingPaymentCard deal={deal} />

        <TrackingParcelCard deal={deal} />

        <div className="pt-1 text-center">
          <button
            type="button"
            onClick={() => console.info("[tracking] report issue")}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-500 hover:text-red-700 dark:text-slate-400"
          >
            <AlertTriangle size={13} aria-hidden="true" />
            {t("report")}
          </button>
        </div>
      </div>
    </div>
  );
}

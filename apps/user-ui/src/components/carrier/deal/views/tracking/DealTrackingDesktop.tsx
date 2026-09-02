/**
 * DealTrackingDesktop.tsx
 * =======================
 * Vue desktop tracking : format page (comme /bookings) —
 * back + H1 + banner teal · gauche = spotlight + timeline + Marie + signaler ·
 * sidebar = paiement + colis + expéditrice.
 */

"use client";

import { AlertTriangle, ArrowLeft } from "lucide-react";
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

export default function DealTrackingDesktop(props: DealTrackingViewProps) {
  const t = useTranslations("carrierDealTracking");
  const { deal } = props;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-4 sm:px-6 sm:pt-6">
        <button
          type="button"
          onClick={props.onBackAction}
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <ArrowLeft size={14} />
          {t("back")}
        </button>
        <h1 className="text-[22px] font-semibold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t("subtitle", {
            shipperFirstName: deal.shipper.firstName,
            originCity: deal.trip.originCity,
            destinationCity: deal.trip.destinationCity,
          })}
        </p>

        <div className="my-5">
          <TrackingBanner deal={deal} variant="inset" />
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_300px] lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Main */}
          <div className="space-y-5">
            <TrackingSpotlight
              deal={deal}
              confirmedEvents={props.confirmedEvents}
              onEventConfirmedAction={props.onEventConfirmedAction}
          onEventCommittedAction={props.onEventCommittedAction}
              onDeliverAction={props.onDeliverAction}
            />

            <TrackingTimeline
              deal={deal}
              confirmedEvents={props.confirmedEvents}
            />

            {deal.recipient && (
              <TrackingRecipientCard recipient={deal.recipient} />
            )}

            <button
              type="button"
              onClick={() => console.info("[tracking] report issue")}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-500 transition-colors hover:text-red-700 dark:text-slate-400 dark:hover:text-red-400"
            >
              <AlertTriangle size={13} aria-hidden="true" />
              {t("report")}
            </button>
          </div>

          {/* Sidebar */}
          <aside className="hidden md:block">
            <div className="sticky top-[88px] space-y-4">
              <TrackingPaymentCard deal={deal} />
              <TrackingParcelCard deal={deal} />
              <TrackingShipperCard deal={deal} />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

/**
 * DealRequestDesktop.tsx
 * ======================
 * Wrapper desktop, aligné sur le pattern du booking shipper :
 *  - max-w-7xl direct sur fond slate-50 (pas de card enveloppante)
 *  - Lien retour discret en haut
 *  - H1 noir + sous-titre dynamique (reçue il y a X · trajet · date)
 *  - Banner expiration compact
 *  - Grid 2 cols : contenu principal + sidebar VRAIMENT sticky regroupant
 *    earnings + couverture + CTAs + footer note
 *  - Ordre du contenu : shipper → colis → photos → lieux → tip → charte
 *    (le gain est dans la sidebar pour éviter la duplication)
 */

"use client";

import { ArrowLeft } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { acceptDeal, declineDeal } from "./deal-request.api";
import type { DealRequest, DeclineReason } from "./deal-request.types";
import DealAcceptTip from "./DealAcceptTip";
import DealActionsFooter from "./DealActionsFooter";
import DealCarrierCharter from "./DealCarrierCharter";
import DealCoverageCard from "./DealCoverageCard";
import DealDeclineModal from "./DealDeclineModal";
import DealEarningsBreakdown from "./DealEarningsBreakdown";
import DealExpiryBanner from "./DealExpiryBanner";
import DealLocationsBlock from "./DealLocationsBlock";
import DealParcelDetails from "./DealParcelDetails";
import DealParcelPhotos from "./DealParcelPhotos";
import DealShipperCard from "./DealShipperCard";

type Props = {
  deal: DealRequest;
  onCloseAction: () => void;
};

export default function DealRequestDesktop({ deal, onCloseAction }: Props) {
  const t = useTranslations("carrierDealRequest");
  const locale = useLocale();

  const [charterAccepted, setCharterAccepted] = useState(false);
  const [charterError, setCharterError] = useState(false);
  const [isSubmittingAccept, setIsSubmittingAccept] = useState(false);
  const [isSubmittingDecline, setIsSubmittingDecline] = useState(false);
  const [declineModalOpen, setDeclineModalOpen] = useState(false);

  const handleAccept = async () => {
    if (!charterAccepted) {
      setCharterError(true);
      document
        .getElementById("carrier-charter-block")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setIsSubmittingAccept(true);
    try {
      const result = await acceptDeal(deal.id, { charterAccepted: true });
      toast.success(t("accept.toastSuccess"), { duration: 4500 });
      // eslint-disable-next-line no-console
      console.info("[deal-request] accepted, deliveryCode:", result.deliveryCode);
      onCloseAction();
    } catch {
      toast.error(t("accept.toastError"));
    } finally {
      setIsSubmittingAccept(false);
    }
  };

  const handleDeclineConfirm = async (payload: {
    reason?: DeclineReason;
    details?: string;
  }) => {
    setIsSubmittingDecline(true);
    try {
      await declineDeal(deal.id, payload);
      toast.success(
        t("decline.toastSuccess", { shipperFirstName: deal.shipper.firstName }),
        { duration: 4500 }
      );
      setDeclineModalOpen(false);
      onCloseAction();
    } catch {
      toast.error(t("decline.toastError"));
    } finally {
      setIsSubmittingDecline(false);
    }
  };

  const isSubmitting = isSubmittingAccept || isSubmittingDecline;

  // Construit le sous-titre dynamique : "Reçue il y a 2h · Paris → Brazza · jeu. 28 mai · vol direct 8h"
  const subtitleParts = [
    t("receivedAgo", { time: formatReceivedAgo(deal.createdAt) }),
    `${deal.trip.originCity} → ${deal.trip.destinationCity}`,
    formatDate(deal.trip.departureDate, locale),
  ];
  if (deal.trip.durationHours) {
    subtitleParts.push(
      deal.trip.isDirect
        ? t("tripCard.directFlight", { hours: deal.trip.durationHours })
        : `${deal.trip.durationHours}h`
    );
  }
  const subtitle = subtitleParts.join(" · ");

  return (
    <>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-4 sm:px-6 sm:pt-6">
          {/* Lien retour discret — un seul */}
          <button
            type="button"
            onClick={onCloseAction}
            className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            <ArrowLeft size={14} />
            {t("back")}
          </button>

          {/* H1 + sous-titre dynamique */}
          <header className="mb-5">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              {t("title")}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
          </header>

          {/* Bandeau expiration compact en chip */}
          <div className="mb-6">
            <DealExpiryBanner expiresAtIso={deal.expiresAt} variant="inline" />
          </div>

          {/* Grid 2 cols */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            {/* Main column */}
            <div className="space-y-6">
              <DealShipperCard
                shipper={deal.shipper}
                showMemberSince
                onViewProfileAction={() =>
                  console.info("[deal-request] view shipper profile")
                }
              />

              <DealParcelDetails
                category={deal.parcel.category}
                weightKg={deal.parcel.weightKg}
                declaredValueEur={deal.parcel.declaredValueEur}
                description={deal.parcel.description}
              />

              <DealParcelPhotos
                photos={deal.parcel.photos}
                shipperFirstName={deal.shipper.firstName}
              />

              <DealLocationsBlock
                pickup={deal.pickupLocation}
                delivery={deal.deliveryLocation}
              />

              <DealAcceptTip shipperFirstName={deal.shipper.firstName} />

              <div id="carrier-charter-block">
                <DealCarrierCharter
                  accepted={charterAccepted}
                  onChangeAction={(checked) => {
                    setCharterAccepted(checked);
                    if (checked) setCharterError(false);
                  }}
                  hasError={charterError}
                  errorMessage={t("charter.acceptError")}
                />
              </div>
            </div>

            {/* Sidebar — vraiment sticky, regroupe earnings + couverture + actions */}
            <aside className="hidden lg:block">
              <div className="sticky top-[88px] space-y-4">
                <DealEarningsBreakdown earnings={deal.earnings} variant="sidebar" />

                <DealCoverageCard
                  insurance={deal.insurance}
                  shipperFirstName={deal.shipper.firstName}
                  variant="sidebar"
                />

                <DealActionsFooter
                  shipperFirstName={deal.shipper.firstName}
                  charterAccepted={charterAccepted}
                  onDeclineAction={() => setDeclineModalOpen(true)}
                  onAcceptAction={handleAccept}
                  isSubmitting={isSubmitting}
                  variant="desktop"
                />
              </div>
            </aside>
          </div>
        </div>
      </div>

      <DealDeclineModal
        isOpen={declineModalOpen}
        shipperFirstName={deal.shipper.firstName}
        isSubmitting={isSubmittingDecline}
        onCloseAction={() => !isSubmittingDecline && setDeclineModalOpen(false)}
        onConfirmAction={handleDeclineConfirm}
      />
    </>
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

function formatDate(iso: string, locale: string): string {
  const date = new Date(iso);
  const weekday = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    weekday: "short",
  }).format(date);
  const day = date.getDate();
  const month = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    month: "short",
  }).format(date);
  return locale === "fr"
    ? `${weekday} ${day} ${month}`
    : `${weekday}, ${month} ${day}`;
}

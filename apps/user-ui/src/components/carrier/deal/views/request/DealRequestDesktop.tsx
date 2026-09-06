/**
 * DealRequestDesktop.tsx
 * ======================
 * Vue desktop pour un Deal en statut PENDING (demande à accepter/refuser).
 *
 * Layout aligné sur le pattern du booking shipper :
 *  - max-w-7xl direct sur fond slate-50 (pas de card enveloppante)
 *  - Lien retour discret en haut (un seul)
 *  - H1 noir + sous-titre dynamique (reçue il y a X · trajet · date)
 *  - Banner expiration compact (chip)
 *  - Grid 2 cols : contenu principal + sidebar VRAIMENT sticky
 *
 * À l'acceptation : appelle onAcceptedAction (le parent DealClient mute le
 * status à ACCEPTED et bascule sur DealAcceptedDesktop). L'URL reste stable.
 */

"use client";

import { ArrowLeft } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import type { DealRequest, DeclineReason } from "@/components/carrier/deal/deal.types";
import { useDealRequestActions } from "./useDealRequestActions";
import DealLocationsBlock from "@/components/carrier/deal/shared/DealLocationsBlock";
import DealParcelDetails from "@/components/carrier/deal/shared/DealParcelDetails";
import DealParcelPhotos from "@/components/carrier/deal/shared/DealParcelPhotos";
import DealShipperCard from "@/components/carrier/deal/shared/DealShipperCard";
import DealAcceptTip from "./DealAcceptTip";
import DealActionsFooter from "./DealActionsFooter";
import DealCarrierCharter from "./DealCarrierCharter";
import DealCoverageCard from "./DealCoverageCard";
import DealDeclineModal from "./DealDeclineModal";
import DealEarningsBreakdown from "./DealEarningsBreakdown";
import DealExpiryBanner from "./DealExpiryBanner";

type Props = {
  deal: DealRequest;
  onCloseAction: () => void;
  onAcceptedAction: () => void;
};

export default function DealRequestDesktop({
                                             deal,
                                             onCloseAction,
                                             onAcceptedAction,
                                           }: Props) {
  const t = useTranslations("carrierDealRequest");
  const locale = useLocale();

  const [charterAccepted, setCharterAccepted] = useState(false);
  const [charterError, setCharterError] = useState(false);
  const [declineModalOpen, setDeclineModalOpen] = useState(false);

  const {
    submitAccept,
    submitDecline,
    isSubmitting,
    isSubmittingDecline,
  } = useDealRequestActions({ deal, onAcceptedAction, onCloseAction });

  // Le serveur est seul juge : les CTA ne s'affichent que si la machine
  // les permet (une demande expirée mais pas encore balayée par le cron
  // n'a plus d'allowedActions, le footer disparaît).
  const canRespond =
    !deal.allowedActions || deal.allowedActions.includes("accept");

  const handleAccept = async () => {
    if (!charterAccepted) {
      setCharterError(true);
      document
        .getElementById("carrier-charter-block")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    await submitAccept();
  };

  const handleDeclineConfirm = async (payload: { reason?: DeclineReason }) => {
    const ok = await submitDecline(payload);
    if (ok) setDeclineModalOpen(false);
  };

  // Sous-titre dynamique : "Reçue il y a 2h · Paris → Brazza · jeu. 28 mai · vol direct 8h"
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
            <h1 className="text-[22px] font-semibold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
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
          {/* A45 : la colonne d'action existe dès md (768 px = bascule mobile) — jamais un écran sans Accepter/Refuser */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_300px] lg:grid-cols-[minmax(0,1fr)_340px]">
            {/* Main column */}
            <div className="space-y-6">
              <DealShipperCard
                shipper={deal.shipper}
                showMemberSince
                onViewProfileAction={
                  deal.shipper.publicSlug
                    ? () => window.open(`/${locale}/u/${deal.shipper.publicSlug}`, "_blank", "noopener")
                    : undefined
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
                  onChangeAction={(checked: boolean) => {
                    setCharterAccepted(checked);
                    if (checked) setCharterError(false);
                  }}
                  hasError={charterError}
                  errorMessage={t("charter.acceptError")}
                />
              </div>
            </div>

            {/* Sidebar — vraiment sticky, regroupe earnings + couverture + actions */}
            <aside className="hidden md:block">
              <div className="sticky top-[88px] space-y-4">
                <DealEarningsBreakdown earnings={deal.earnings} variant="sidebar" />

                <DealCoverageCard
                  insurance={deal.insurance}
                  shipperFirstName={deal.shipper.firstName}
                  variant="sidebar"
                />

                {canRespond && (
                  <DealActionsFooter
                    shipperFirstName={deal.shipper.firstName}
                    charterAccepted={charterAccepted}
                    onDeclineAction={() => setDeclineModalOpen(true)}
                    onAcceptAction={handleAccept}
                    isSubmitting={isSubmitting}
                    variant="desktop"
                  />
                )}
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

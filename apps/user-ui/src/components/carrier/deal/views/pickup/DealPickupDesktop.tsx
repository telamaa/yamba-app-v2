/**
 * DealPickupDesktop.tsx
 * =====================
 * V3 — format page ouverte (comme /bookings/[id]) :
 * back + H1 + sous-titre · warning inset · grid [1fr_320px] :
 *  gauche = actions (1 checklist · 2 photos · 3 notes)
 *  droite sticky = déclaration + confirmation (progression+CTAs) + contact
 */

"use client";

import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import type { DealPickupViewProps } from "./DealPickupClient";
import { PICKUP_CHECKLIST_ITEMS } from "./PickupChecklist";
import PickupChecklist from "./PickupChecklist";
import PickupConfirmCard from "./PickupConfirmCard";
import PickupContactCard from "./PickupContactCard";
import PickupDeclaredCard from "./PickupDeclaredCard";
import PickupNotes from "./PickupNotes";
import PickupPhotosGrid from "./PickupPhotosGrid";
import PickupRefuseDialog from "./PickupRefuseDialog";
import PickupWarningBanner from "./PickupWarningBanner";

export default function DealPickupDesktop(props: DealPickupViewProps) {
  const t = useTranslations("carrierDealPickup");
  const locale = useLocale();
  const { deal } = props;

  const shipperFirstName = deal.shipper.firstName;
  const shipperLastInitial = deal.shipper.lastInitial;
  const recipientFirstName =
    deal.deliveryLocation.name.split(" ")[0] || deal.deliveryLocation.name;
  const weightKg = formatWeight(deal.parcel.weightKg, locale);
  const dateStr = formatShortDate(deal.trip.departureDate, locale);
  const hourStr = formatHour(deal.trip.departureDate, locale);

  return (
    <>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-4 sm:px-6 sm:pt-6">
          {/* Header de page */}
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
            {t("pageSubtitle", {
              location: deal.pickupLocation.name,
              date: dateStr,
              hour: hourStr,
              shipperFirstName,
              shipperLastInitial,
            })}
          </p>

          {/* Warning inset */}
          <div className="my-5">
            <PickupWarningBanner variant="inset" />
          </div>

          {/* Grid contenu + sidebar */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_300px] lg:grid-cols-[minmax(0,1fr)_320px]">
            {/* Colonne principale : les actions */}
            <div className="space-y-5">
              <header>
                <h2 className="text-[17px] font-semibold tracking-tight text-slate-900 dark:text-white sm:text-lg">
                  {t("sectionTitle")}
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {t("sectionSubtitle", { shipperFirstName })}
                </p>
              </header>

              <PickupChecklist
                shipperFirstName={shipperFirstName}
                weightKg={weightKg}
                checked={props.checked}
                onToggleAction={props.onToggleCheckAction}
              />

              <PickupPhotosGrid
                photos={props.photos}
                onAddAction={props.onAddPhotoAction}
                onRemoveAction={props.onRemovePhotoAction}
              />

              <PickupNotes
                shipperFirstName={shipperFirstName}
                value={props.notes}
                onChangeAction={props.onNotesChangeAction}
              />
            </div>

            {/* Sidebar sticky */}
            <aside className="hidden md:block">
              <div className="sticky top-[88px] space-y-4">
                <PickupDeclaredCard deal={deal} />

                <PickupConfirmCard
                  shipperFirstName={shipperFirstName}
                  recipientFirstName={recipientFirstName}
                  checkedCount={props.checked.size}
                  totalChecks={PICKUP_CHECKLIST_ITEMS.length}
                  photoCount={props.photos.length}
                  canConfirm={props.canConfirm}
                  isSubmitting={props.isSubmitting}
                  onRefuseAction={props.onOpenRefuseAction}
                  onConfirmAction={props.onConfirmAction}
                />

                <PickupContactCard deal={deal} />
              </div>
            </aside>
          </div>
        </div>
      </div>

      <PickupRefuseDialog
        isOpen={props.refuseOpen}
        shipperFirstName={shipperFirstName}
        isSubmitting={props.isSubmittingRefuse}
        variant="modal"
        onCloseAction={props.onCloseRefuseAction}
        onConfirmAction={props.onRefuseConfirmAction}
      />
    </>
  );
}

function formatShortDate(iso: string, locale: string): string {
  const date = new Date(iso);
  const day = date.getDate();
  const month = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    month: "short",
  }).format(date);
  return locale === "fr" ? `${day} ${month}` : `${month} ${day}`;
}

function formatHour(iso: string, locale: string): string {
  const h = new Date(iso).getHours();
  return locale === "fr" ? `${h}h00` : `${h}:00`;
}

function formatWeight(kg: number, locale: string): string {
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    minimumFractionDigits: kg % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 2,
  }).format(kg);
}

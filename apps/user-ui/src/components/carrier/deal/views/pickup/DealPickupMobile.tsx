/**
 * DealPickupMobile.tsx
 * ====================
 * Mobile V3 : header sticky · warning flush · déclaration en tête (référence
 * avant action) · 1 checklist · 2 photos · 3 notes · contact · bottom-bar fixe.
 */

"use client";

import { useLocale, useTranslations } from "next-intl";
import type { DealPickupViewProps } from "./DealPickupClient";
import PickupChecklist from "./PickupChecklist";
import PickupContactCard from "./PickupContactCard";
import PickupDeclaredCard from "./PickupDeclaredCard";
import PickupFooter from "./PickupFooter";
import PickupHeader from "./PickupHeader";
import PickupNotes from "./PickupNotes";
import PickupPhotosGrid from "./PickupPhotosGrid";
import PickupRefuseDialog from "./PickupRefuseDialog";
import PickupWarningBanner from "./PickupWarningBanner";

export default function DealPickupMobile(props: DealPickupViewProps) {
  const t = useTranslations("carrierDealPickup");
  const locale = useLocale();
  const { deal } = props;

  const shipperFirstName = deal.shipper.firstName;
  const recipientFirstName =
    deal.deliveryLocation.name.split(" ")[0] || deal.deliveryLocation.name;
  const weightKg = formatWeight(deal.parcel.weightKg, locale);

  return (
    <>
      <div className="flex min-h-screen flex-col bg-white dark:bg-slate-950">
        <PickupHeader
          locationName={deal.pickupLocation.name}
          onBackAction={props.onBackAction}
          variant="mobile"
        />
        <PickupWarningBanner variant="flush" compact />

        <div className="flex-1 space-y-3 px-4 pb-44 pt-4">
          <header>
            <h2 className="text-[17px] font-semibold tracking-tight text-slate-900 dark:text-white">
              {t("titleShort")}
            </h2>
            <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">
              {t("subtitleShort")}
            </p>
          </header>

          <PickupDeclaredCard deal={deal} compact />

          <PickupChecklist
            shipperFirstName={shipperFirstName}
            weightKg={weightKg}
            checked={props.checked}
            onToggleAction={props.onToggleCheckAction}
            compact
          />

          <PickupPhotosGrid
            photos={props.photos}
            onAddAction={props.onAddPhotoAction}
            onRemoveAction={props.onRemovePhotoAction}
            compact
          />

          <PickupNotes
            shipperFirstName={shipperFirstName}
            value={props.notes}
            onChangeAction={props.onNotesChangeAction}
            compact
          />

          <PickupContactCard deal={deal} />
        </div>

        <PickupFooter
          shipperFirstName={shipperFirstName}
          recipientFirstName={recipientFirstName}
          canConfirm={props.canConfirm}
          isSubmitting={props.isSubmitting}
          onRefuseAction={props.onOpenRefuseAction}
          onConfirmAction={props.onConfirmAction}
          variant="mobile"
        />
      </div>

      <PickupRefuseDialog
        isOpen={props.refuseOpen}
        shipperFirstName={shipperFirstName}
        isSubmitting={props.isSubmittingRefuse}
        variant="sheet"
        onCloseAction={props.onCloseRefuseAction}
        onConfirmAction={props.onRefuseConfirmAction}
      />
    </>
  );
}

function formatWeight(kg: number, locale: string): string {
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    minimumFractionDigits: kg % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 2,
  }).format(kg);
}

/**
 * DealLocationsBlock.tsx
 * ======================
 * Affiche le lieu de remise + livraison avec icônes et notes contextuelles.
 */

"use client";

import { Building2, MapPin, Plane, Train } from "lucide-react";
import { useTranslations } from "next-intl";
import type { DealLocation } from "./deal-request.types";

type Props = {
  pickup: DealLocation;
  delivery: DealLocation;
};

export default function DealLocationsBlock({ pickup, delivery }: Props) {
  const t = useTranslations("carrierDealRequest");

  return (
    <section>
      <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        <span className="md:hidden">{t("locations.titleShort")}</span>
        <span className="hidden md:inline">{t("locations.title")}</span>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
        <LocationRow
          icon={iconFor(pickup.type)}
          label={t("locations.pickupLabel")}
          location={pickup}
        />
        <div className="my-3 border-t border-slate-100 dark:border-slate-800" />
        <LocationRow
          icon={iconFor(delivery.type)}
          label={t("locations.deliveryLabel")}
          location={delivery}
          fallbackDetail={t("locations.deliveryNotePending")}
        />
      </div>
    </section>
  );
}

function LocationRow({
                       icon,
                       label,
                       location,
                       fallbackDetail,
                     }: {
  icon: React.ReactNode;
  label: string;
  location: DealLocation;
  fallbackDetail?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 md:text-[11px]">
          {label}
        </div>
        <div className="mt-0.5 text-[14px] font-medium text-slate-900 dark:text-white md:text-[15px]">
          {location.name}
        </div>
        {(location.detail || fallbackDetail) && (
          <div className="mt-0.5 text-[12px] leading-snug text-slate-500 dark:text-slate-400 md:text-[13px]">
            {location.detail || fallbackDetail}
          </div>
        )}
        {location.flexibilityNote && (
          <div className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400 md:text-[12px]">
            {location.flexibilityNote}
          </div>
        )}
      </div>
    </div>
  );
}

function iconFor(type: DealLocation["type"]) {
  const size = 14;
  switch (type) {
    case "AIRPORT":
      return <Plane size={size} />;
    case "STATION":
      return <Train size={size} />;
    case "ADDRESS":
      return <Building2 size={size} />;
    case "POI":
    default:
      return <MapPin size={size} />;
  }
}

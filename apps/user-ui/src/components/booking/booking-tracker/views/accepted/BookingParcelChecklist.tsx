/**
 * BookingParcelChecklist.tsx
 * ==========================
 * Card "Prépare ton colis" avec checklist de 5 items à respecter
 * avant le rendez-vous avec le Voyageur.
 *
 * État interne : Set<string> des items cochés (purement visuel pour l'instant ;
 * sera persisté via API dans la PR backend pour permettre au Sender de tracker
 * sa préparation).
 */

"use client";

import { Check, Package } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { Booking } from "@/components/booking/booking-tracker/booking-tracker.types";

type Props = {
  booking: Booking;
  compact?: boolean;
};

type ChecklistItem = {
  id: string;
  label: string;
};

export default function BookingParcelChecklist({
                                                 booking,
                                                 compact = false,
                                               }: Props) {
  const t = useTranslations("bookingTracker");
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const carrierFirstName = booking.carrier.firstName;
  const weight = formatWeight(booking.parcel.weightKg);

  // Pré-calcule les labels avec des appels t() statiques (type-safe)
  const items: ChecklistItem[] = compact
    ? [
      { id: "pack", label: t("parcelChecklist.items.packShort") },
      { id: "weight", label: t("parcelChecklist.items.weightShort", { weight }) },
      { id: "noForbidden", label: t("parcelChecklist.items.noForbiddenShort") },
      { id: "photos", label: t("parcelChecklist.items.photosShort", { carrierFirstName }) },
      { id: "confirmMeeting", label: t("parcelChecklist.items.confirmMeetingShort", { carrierFirstName }) },
    ]
    : [
      { id: "pack", label: t("parcelChecklist.items.pack") },
      { id: "weight", label: t("parcelChecklist.items.weight", { weight }) },
      { id: "noForbidden", label: t("parcelChecklist.items.noForbidden") },
      { id: "photos", label: t("parcelChecklist.items.photos", { carrierFirstName }) },
      { id: "confirmMeeting", label: t("parcelChecklist.items.confirmMeeting", { carrierFirstName }) },
    ];

  const toggleItem = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 sm:rounded-2xl ${
        compact ? "p-3.5" : "p-4 sm:p-5"
      }`}
    >
      <div className={`flex items-start gap-3 ${compact ? "mb-2.5" : "mb-3"}`}>
        <div
          className={`flex flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 ${
            compact ? "h-8 w-8" : "h-9 w-9"
          }`}
          aria-hidden="true"
        >
          <Package size={compact ? 14 : 16} />
        </div>
        <div className="min-w-0 flex-1">
          <h3
            className={`font-semibold text-slate-900 dark:text-white ${
              compact ? "text-[14px]" : "text-[14px] sm:text-[15px]"
            }`}
          >
            {t("parcelChecklist.title")}
          </h3>
          <p
            className={`mt-0.5 text-slate-500 dark:text-slate-400 ${
              compact ? "text-[11px]" : "text-[12px] sm:text-[13px]"
            }`}
          >
            {compact
              ? t("parcelChecklist.subtitleShort")
              : t("parcelChecklist.subtitle", { carrierFirstName })}
          </p>
        </div>
      </div>

      <ul className="space-y-0">
        {items.map((item, i) => {
          const isChecked = checked.has(item.id);
          const isLast = i === items.length - 1;

          return (
            <li
              key={item.id}
              className={`flex items-start gap-3 py-2.5 ${
                isLast ? "" : "border-b border-slate-100 dark:border-slate-800"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleItem(item.id)}
                aria-pressed={isChecked}
                aria-label={item.label}
                className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  isChecked
                    ? "border-emerald-600 bg-emerald-600 dark:border-emerald-500 dark:bg-emerald-500"
                    : "border-slate-300 bg-white hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
                }`}
              >
                {isChecked && (
                  <Check
                    size={11}
                    strokeWidth={3}
                    className="text-white"
                    aria-hidden="true"
                  />
                )}
              </button>
              <button
                type="button"
                onClick={() => toggleItem(item.id)}
                className={`flex-1 text-left leading-snug transition-colors ${
                  compact ? "text-[12px]" : "text-[13px] sm:text-[14px]"
                } ${
                  isChecked
                    ? "text-slate-400 line-through dark:text-slate-600"
                    : "text-slate-700 dark:text-slate-300"
                }`}
              >
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function formatWeight(kg: number): string {
  const fr = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: kg % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 2,
  });
  return fr.format(kg);
}

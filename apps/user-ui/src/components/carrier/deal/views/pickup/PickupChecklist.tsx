/**
 * PickupChecklist.tsx
 * ===================
 * Bloc 2 — checklist de vérification physique (5 items, TOUS obligatoires).
 * Composant contrôlé : le parent tient le Set des items cochés.
 * Item coché = fond emerald clair + bordure (fidèle au mockup).
 */

"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import type { PickupChecklistItemId } from "@/components/carrier/deal/deal.types";
import PickupBlock from "./PickupBlock";

export const PICKUP_CHECKLIST_ITEMS: PickupChecklistItemId[] = [
  "CONTENT_MATCHES",
  "WEIGHT_OK",
  "NO_FORBIDDEN",
  "PACKAGING_OK",
  "ITEMS_IDENTIFIED",
];

type Props = {
  shipperFirstName: string;
  weightKg: string;
  checked: Set<PickupChecklistItemId>;
  onToggleAction: (id: PickupChecklistItemId) => void;
  compact?: boolean;
};

export default function PickupChecklist({
                                          shipperFirstName,
                                          weightKg,
                                          checked,
                                          onToggleAction,
                                          compact = false,
                                        }: Props) {
  const t = useTranslations("carrierDealPickup");

  const labels: Record<PickupChecklistItemId, string> = compact
    ? {
      CONTENT_MATCHES: t("checklist.items.CONTENT_MATCHES_short"),
      WEIGHT_OK: t("checklist.items.WEIGHT_OK_short", { weight: weightKg }),
      NO_FORBIDDEN: t("checklist.items.NO_FORBIDDEN_short"),
      PACKAGING_OK: t("checklist.items.PACKAGING_OK_short"),
      ITEMS_IDENTIFIED: t("checklist.items.ITEMS_IDENTIFIED_short"),
    }
    : {
      CONTENT_MATCHES: t("checklist.items.CONTENT_MATCHES", { shipperFirstName }),
      WEIGHT_OK: t("checklist.items.WEIGHT_OK", { weight: weightKg }),
      NO_FORBIDDEN: t("checklist.items.NO_FORBIDDEN"),
      PACKAGING_OK: t("checklist.items.PACKAGING_OK"),
      ITEMS_IDENTIFIED: t("checklist.items.ITEMS_IDENTIFIED"),
    };

  const allChecked = PICKUP_CHECKLIST_ITEMS.every((id) => checked.has(id));

  return (
    <PickupBlock
      num={1}
      state={allChecked ? "done" : "active"}
      title={t("checklist.title")}
      sub={compact ? t("checklist.subShort") : t("checklist.sub")}
      compact={compact}
    >
      <ul className="space-y-2">
        {PICKUP_CHECKLIST_ITEMS.map((id) => {
          const isChecked = checked.has(id);
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onToggleAction(id)}
                aria-pressed={isChecked}
                className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                  isChecked
                    ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40"
                    : "border-transparent bg-slate-50 hover:border-slate-300 active:bg-slate-100 dark:bg-slate-900/50 dark:hover:border-slate-700"
                }`}
              >
                <span
                  className={`mt-px flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-[1.5px] transition-colors ${
                    isChecked
                      ? "border-emerald-700 bg-emerald-700 text-white dark:border-emerald-600 dark:bg-emerald-600"
                      : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900"
                  }`}
                  aria-hidden="true"
                >
                  {isChecked && <Check size={14} strokeWidth={3} />}
                </span>
                <span
                  className={`leading-relaxed ${
                    compact ? "text-[13px]" : "text-[13px] sm:text-[14px]"
                  } ${
                    isChecked
                      ? "text-emerald-950 dark:text-emerald-100"
                      : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {labels[id]}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </PickupBlock>
  );
}

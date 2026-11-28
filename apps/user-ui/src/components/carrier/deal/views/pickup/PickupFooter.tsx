/**
 * PickupFooter.tsx
 * ================
 * La barre du BAS, fixe, sur téléphone (action urgente → standard mobile).
 * Info + CTAs Refuser / Confirmer la prise en charge.
 *
 * Confirmer est désactivé tant que `canConfirm` est false (la règle vit dans
 * `lib/carrier/prise-en-charge`, jamais ici) et la phrase qui dit CE QUI
 * MANQUE arrive déjà traduite.
 *
 * D115 bis — LA VARIANTE « DESKTOP » A ÉTÉ SUPPRIMÉE, et c'est une mesure,
 * pas un avis : ce composant n'est importé que par `DealPickupMobile`, avec
 * `variant="mobile"`. Les quarante lignes de la branche bureau n'étaient
 * donc atteintes par AUCUN rendu depuis leur écriture — le bureau pose sa
 * confirmation dans la colonne latérale (`PickupConfirmCard`). Du code
 * qu'aucun chemin n'atteint est un piège : on l'édite en croyant corriger
 * l'écran, et rien ne change. Mesuré par `grep -rn PickupFooter`, une
 * seconde ; invisible à la lecture, trois mois.
 */

"use client";

import { Check, Info } from "lucide-react";
import { useTranslations } from "next-intl";

type Props = {
  shipperFirstName: string;
  canConfirm: boolean;
  /** ANO-WEB-51 : ce qui manque pour confirmer (points, photo) — affiché sous les boutons quand ils sont inactifs. */
  blockingHint?: string | null;
  isSubmitting?: boolean;
  onRefuseAction: () => void;
  onConfirmAction: () => void;
};

export default function PickupFooter({
                                       shipperFirstName,
                                       canConfirm,
                                       blockingHint = null,
                                       isSubmitting = false,
                                       onRefuseAction,
                                       onConfirmAction,
                                     }: Props) {
  const t = useTranslations("carrierDealPickup");

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white px-4 pb-[max(env(safe-area-inset-bottom),14px)] pt-3 dark:border-slate-800 dark:bg-slate-950">
        <div className="mb-2.5 flex items-center justify-center gap-1.5 text-center text-[11px] leading-snug text-slate-500 dark:text-slate-400">
          <Info size={12} className="flex-shrink-0" aria-hidden="true" />
          <span>{t("final.infoShort", { shipperFirstName })}</span>
        </div>
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onRefuseAction}
            disabled={isSubmitting}
            className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-[13px] font-semibold text-slate-700 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-800 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            {t("final.refuseShort")}
          </button>
          <button
            type="button"
            onClick={onConfirmAction}
            disabled={!canConfirm || isSubmitting}
            className="inline-flex flex-[2] items-center justify-center gap-1.5 rounded-xl bg-[#FF9900] px-4 py-3.5 text-[13px] font-bold text-slate-950 transition-colors hover:bg-[#F08700] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
          >
            <Check size={15} strokeWidth={3} aria-hidden="true" />
            {isSubmitting ? t("final.submitting") : t("final.confirm")}
          </button>
        </div>
        {!canConfirm && !isSubmitting && blockingHint && (
          <p className="mt-2 text-center text-[11.5px] text-amber-700 dark:text-amber-400" role="status">{blockingHint}</p>
        )}
      </div>
    );
}

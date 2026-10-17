/**
 * BookingExitDialog.tsx
 * =====================
 * Quitter la réservation — la porte de sortie, et ce qu'elle coûte.
 *
 * Avant (retour de recette du 17/10) : la flèche « Retour au trajet » et la
 * croix de l'en-tête mobile effaçaient la saisie SANS RIEN DEMANDER. Anodin à
 * l'étape 1, brutal à l'étape 4 — on y a déjà saisi un destinataire, son
 * téléphone, des photos, et accepté une charte.
 *
 * L'arbitrage (utilisateur, 17/10) : **on repart toujours de zéro**. Pas de
 * brouillon conservé, pas de reprise — ce serait rouvrir tout ce qui change
 * entre-temps (trajet expiré, kilos restants, prix du Voyageur, paramètres de
 * la plateforme) pour une valeur faible. Ce qu'on offre à la place, c'est le
 * FAVORI : il existe déjà (D46), il est côté serveur, il suit le compte sur
 * tous les appareils — c'est la seule chose qui a besoin de survivre à la
 * sortie, parce que c'est ce qui permet de retrouver le trajet.
 *
 * Deux règles : on ne demande rien quand il n'y a rien à perdre (brouillon
 * intact), et « Reprendre » est l'action par défaut — un clic sur une croix
 * est très souvent un geste accidentel.
 */
"use client";

import { Heart, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { MANGO } from "./BookingFormUi";

type Props = {
  open: boolean;
  /** Le trajet est-il DÉJÀ en favori ? (on ne propose pas ce qui est fait) */
  alreadyFavorite: boolean;
  onResumeAction: () => void;
  /** `keepFavorite` : l'utilisateur veut garder le trajet sous la main. */
  onLeaveAction: (keepFavorite: boolean) => void;
};

export default function BookingExitDialog({
  open,
  alreadyFavorite,
  onResumeAction,
  onLeaveAction,
}: Props) {
  const t = useTranslations("booking.exit");
  const [keepFavorite, setKeepFavorite] = useState(true);

  // Échap = reprendre : la touche de fuite ne doit jamais DÉTRUIRE.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onResumeAction();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onResumeAction]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-exit-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-1.5 flex items-start justify-between gap-3">
          <h2
            id="booking-exit-title"
            className="text-[17px] font-semibold text-slate-900 dark:text-white"
          >
            {t("title")}
          </h2>
          <button
            type="button"
            onClick={onResumeAction}
            aria-label={t("resume")}
            className="-mr-1 -mt-1 rounded-full p-1 text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mb-4 text-[13.5px] leading-relaxed text-slate-600 dark:text-slate-300">
          {t("body")}
        </p>

        {!alreadyFavorite ? (
          <label className="mb-4 flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <input
              type="checkbox"
              checked={keepFavorite}
              onChange={(e) => setKeepFavorite(e.target.checked)}
              className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#FF9900]"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-[13px] font-medium text-slate-800 dark:text-slate-100">
                <Heart size={13} className="flex-shrink-0 text-[#FF9900]" />
                {t("favorite")}
              </span>
              <span className="mt-0.5 block text-[12px] leading-5 text-slate-500 dark:text-slate-400">
                {t("favoriteHint")}
              </span>
            </span>
          </label>
        ) : (
          <p className="mb-4 flex items-center gap-1.5 text-[12.5px] text-slate-500 dark:text-slate-400">
            <Heart size={13} className="flex-shrink-0 text-[#FF9900]" fill={MANGO} />
            {t("favoriteAlready")}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => onLeaveAction(!alreadyFavorite && keepFavorite)}
            className="rounded-lg border border-slate-200 px-4 py-2.5 text-[14px] font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {t("leave")}
          </button>
          <button
            type="button"
            onClick={onResumeAction}
            autoFocus
            className="rounded-lg px-4 py-2.5 text-[14px] font-semibold text-white"
            style={{ backgroundColor: MANGO }}
          >
            {t("resume")}
          </button>
        </div>
      </div>
    </div>
  );
}

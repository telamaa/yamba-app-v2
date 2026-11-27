"use client";

/**
 * TripPublishedPanel.tsx — la fin du tunnel, et le retour en un geste (D111).
 * ============================================================================
 * Le formulaire proposait « Aller simple / Aller-retour ». Le choix partait au
 * serveur, mais le mapper envoie `returnDepartureAt: null` DANS LES DEUX CAS
 * et ne crée aucun second trajet : le Voyageur croyait avoir annoncé son
 * retour, et aucun Expéditeur ne pouvait le trouver — le mot n'apparaissait
 * que sur sa propre fiche. C'est le défaut de D100 : un contrôle qui AFFIRME
 * ce que le produit ne fait pas.
 *
 * Le choix a donc disparu de l'étape ①, et le retour est proposé ICI, au seul
 * moment où le Voyageur est à la fois convaincu et disponible : il vient de
 * publier, et il rentre. Un tap, et le brouillon du retour est prêt — villes
 * inversées, lieux d'échange avec elles, prix et conditions gardés. Il ne
 * reste que les dates.
 *
 * Ce panneau remplace l'ancienne fin : un toast puis une redirection
 * automatique au bout d'une seconde et demie. Une redirection qui part toute
 * seule ferme la seule porte qui valait la peine d'être ouverte.
 *
 * Le composant ne décide RIEN : la transformation du brouillon vit dans
 * `lib/trips/retour-de-trajet.ts`, pure et vérifiée par le harnais.
 */
import { CheckCircle2 } from "lucide-react";

import type { CreateTripCopy } from "./create-trip.types";

const MANGO = "#FF9900";

export function TripPublishedPanel({
  copy,
  canPublishReturn,
  onPublishReturnAction,
  onSeeTripsAction,
}: {
  copy: CreateTripCopy;
  /** Faux quand l'aller n'avait pas ses deux villes : rien à inverser. */
  canPublishReturn: boolean;
  onPublishReturnAction: () => void;
  onSeeTripsAction: () => void;
}) {
  return (
    <div className="py-6 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 dark:bg-teal-900/30">
        <CheckCircle2 className="h-7 w-7 text-teal-600 dark:text-teal-400" aria-hidden />
      </div>

      <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
        {copy.publishedTitle}
      </h2>

      {canPublishReturn && (
        <div className="mx-auto mt-6 max-w-md rounded-2xl border border-slate-200 p-5 text-left dark:border-slate-800">
          <p className="text-[15px] font-semibold text-slate-900 dark:text-white">
            {copy.publishedReturnTitle}
          </p>
          <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
            {copy.publishedReturnBody}
          </p>
          <button
            type="button"
            onClick={onPublishReturnAction}
            className="mt-4 h-11 w-full rounded-xl text-[15px] font-semibold text-slate-900 transition-opacity hover:opacity-90"
            style={{ backgroundColor: MANGO }}
          >
            {copy.publishedReturnCta}
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={onSeeTripsAction}
        className="mx-auto mt-6 block h-11 rounded-xl border border-slate-200 px-6 text-[15px] font-semibold text-slate-900 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:text-white dark:hover:bg-slate-800"
      >
        {copy.publishedTripsCta}
      </button>
    </div>
  );
}

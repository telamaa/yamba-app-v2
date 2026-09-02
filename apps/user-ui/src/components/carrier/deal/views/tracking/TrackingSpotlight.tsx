/**
 * TrackingSpotlight.tsx
 * =====================
 * LA card d'action de l'écran tracking. Affiche toujours le prochain
 * événement logique :
 *   AT_AIRPORT → FLIGHT_DEPARTED → FLIGHT_ARRIVED → DELIVER (CTA livraison)
 *
 * - Événements optionnels : card amber + bouton de confirmation
 * - Undo 5s : l'événement n'est "envoyé" (API) qu'après la fenêtre d'annulation
 *   (pattern Gmail) — le toast porte le bouton Annuler ; à la fin de la
 *   fenêtre, `onEventCommittedAction` déclenche l'appel réel (A39 : le
 *   serveur n'a pas d'undo, c'est le client qui porte l'attente)
 * - DELIVER : card devient emerald, CTA primaire vers la saisie du code
 */

"use client";

import { Bell, Check, PackageCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type {
  DealRequest,
  DealTrackingEventId,
} from "@/components/carrier/deal/deal.types";

const EVENT_ORDER: DealTrackingEventId[] = [
  "AT_AIRPORT",
  "FLIGHT_DEPARTED",
  "FLIGHT_ARRIVED",
];

const UNDO_WINDOW_MS = 5000;

export function getNextEvent(
  confirmed: DealTrackingEventId[]
): DealTrackingEventId | "DELIVER" {
  for (const id of EVENT_ORDER) {
    if (!confirmed.includes(id)) return id;
  }
  return "DELIVER";
}

type Props = {
  deal: DealRequest;
  confirmedEvents: DealTrackingEventId[];
  onEventConfirmedAction: (id: DealTrackingEventId) => void;
  /** Fenêtre d'undo écoulée : l'appel API part MAINTENANT (A39). */
  onEventCommittedAction: (id: DealTrackingEventId) => void;
  onDeliverAction: () => void;
  compact?: boolean;
};

export default function TrackingSpotlight({
                                            deal,
                                            confirmedEvents,
                                            onEventConfirmedAction,
                                            onEventCommittedAction,
                                            onDeliverAction,
                                            compact = false,
                                          }: Props) {
  const t = useTranslations("carrierDealTracking");
  const pendingTimers = useRef<Map<DealTrackingEventId, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  // Nettoie les timers au démontage
  useEffect(() => {
    const timers = pendingTimers.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const shipperFirstName = deal.shipper.firstName;
  const recipientFirstName = deal.recipient?.firstName ?? "";
  const destinationCity = deal.trip.destinationCity;

  const next = getNextEvent(confirmedEvents);

  const handleConfirmEvent = (id: DealTrackingEventId) => {
    // Optimistic : on marque tout de suite, l'API part après la fenêtre d'undo
    onEventConfirmedAction(id);

    const timer = setTimeout(() => {
      pendingTimers.current.delete(id);
      // Fenêtre écoulée : l'appel réel part (POST /deals/:id/events).
      onEventCommittedAction(id);
    }, UNDO_WINDOW_MS);
    pendingTimers.current.set(id, timer);

    toast.success(t("spotlight.confirmedToast", { shipperFirstName }), {
      duration: UNDO_WINDOW_MS,
      action: {
        label: t("spotlight.undo"),
        onClick: () => {
          const pending = pendingTimers.current.get(id);
          if (pending) {
            clearTimeout(pending);
            pendingTimers.current.delete(id);
          }
          // Rollback : le parent retire l'événement
          onEventConfirmedAction(id); // toggle → le parent gère add/remove
          toast.info(t("spotlight.undoneToast"), { duration: 2500 });
        },
      },
    });
  };

  // ── Variant DELIVER (emerald, CTA primaire) ──
  if (next === "DELIVER") {
    return (
      <section
        className={`rounded-2xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/25 ${
          compact ? "p-4" : "p-5"
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`flex flex-shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white dark:bg-emerald-600 ${
              compact ? "h-9 w-9" : "h-10 w-10"
            }`}
            aria-hidden="true"
          >
            <PackageCheck size={compact ? 16 : 18} />
          </div>
          <div className="min-w-0 flex-1">
            <h3
              className={`font-bold text-emerald-950 dark:text-emerald-100 ${
                compact ? "text-[15px]" : "text-[16px]"
              }`}
            >
              {t("spotlight.DELIVER.title", { recipientFirstName })}
            </h3>
            <p
              className={`mt-1 leading-snug text-emerald-900/85 dark:text-emerald-200/85 ${
                compact ? "text-[12px]" : "text-[13px]"
              }`}
            >
              {compact
                ? t("spotlight.DELIVER.textShort", { recipientFirstName })
                : t("spotlight.DELIVER.text", { recipientFirstName })}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDeliverAction}
          className="mt-3.5 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-[14px] font-bold text-white transition-colors hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          <Check size={15} strokeWidth={3} aria-hidden="true" />
          {t("spotlight.DELIVER.button")}
        </button>
      </section>
    );
  }

  // ── Variant événement optionnel (amber) ──
  return (
    <section
      className={`rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/25 ${
        compact ? "p-4" : "p-5"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex flex-shrink-0 items-center justify-center rounded-full bg-amber-600 text-white ${
            compact ? "h-9 w-9" : "h-10 w-10"
          }`}
          aria-hidden="true"
        >
          <Bell size={compact ? 15 : 17} />
        </div>
        <div className="min-w-0 flex-1">
          <h3
            className={`font-bold text-amber-950 dark:text-amber-100 ${
              compact ? "text-[15px]" : "text-[16px]"
            }`}
          >
            {t(`spotlight.${next}.title`)}
          </h3>
          <p
            className={`mt-1 leading-snug text-amber-900/85 dark:text-amber-200/85 ${
              compact ? "text-[12px]" : "text-[13px]"
            }`}
          >
            {compact
              ? t(`spotlight.${next}.textShort`, {
                shipperFirstName,
                destinationCity,
              })
              : `${t(`spotlight.${next}.text`, {
                shipperFirstName,
                destinationCity,
              })} ${t("spotlight.optional")}`}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => handleConfirmEvent(next)}
        className="mt-3.5 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-4 text-[13.5px] font-bold text-amber-900 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-100 dark:hover:bg-amber-900/40"
      >
        <Check size={14} strokeWidth={3} aria-hidden="true" />
        {t(`spotlight.${next}.button`)}
      </button>
    </section>
  );
}

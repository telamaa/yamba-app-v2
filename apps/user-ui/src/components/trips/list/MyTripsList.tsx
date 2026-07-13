"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Car, Plane, Plus, Train } from "lucide-react";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";
import { useFlashToast } from "@/hooks/useFlashToast";
import useUser from "@/hooks/useUser";
import {
  useMyTrips,
  usePauseTrip,
  useResumeTrip,
  useCancelTrip,
  useRestoreTrip,
} from "@/hooks/useTrip";
import {
  useActivateTrip,
  useDeleteTrip,
  useDuplicateTrip,
  useRevertToDraft,
} from "./my-trips.mutations";
import {
  ActionMenu,
  ConfirmModal,
  OnboardingBanner,
  StatusBadge,
} from "./MyTripsShared";
import {
  MANGO,
  TRANSPORT_LABELS,
  formatTripDate,
  isTripPastDeparture,
  type TransportMode,
  type TripActionKey,
  type TripListItem,
} from "./my-trips.config";
import MyTripsSkeleton from "@/components/dashboard/trips/list/MyTripsSkeleton";

/**
 * Mes trajets — vue réelle (trip-service), identité visuelle "Mes envois" :
 * groupes par urgence (À finaliser / À venir / Historique), rows flat,
 * CTA contextuel. Remplace MyTripsTable (legacy, conservé non branché).
 * La vitrine mock des états deals vit sur /dashboard/trips/preview.
 */

const TRANSPORT_ICONS: Record<TransportMode, React.ElementType> = {
  PLANE: Plane,
  TRAIN: Train,
  CAR: Car,
};

type Group = "finalize" | "upcoming" | "history";
type Filter = "all" | Group;

/* ── Row ─────────────────────────────────────────────────────────── */

function TripRow({
                   trip,
                   group,
                   isFr,
                   needsOnboarding,
                   onAction,
                 }: {
  trip: TripListItem;
  group: Group;
  isFr: boolean;
  needsOnboarding: boolean;
  onAction: (key: TripActionKey, trip: TripListItem) => void;
}) {
  const router = useRouter();
  const TransportIcon = trip.transportMode
    ? TRANSPORT_ICONS[trip.transportMode]
    : Plane;
  const demands = trip.pendingDemandsCount ?? 0;
  const isDraft = trip.status === "DRAFT";
  const isPaused = trip.status === "PAUSED";
  const muted = group === "history";

  const from = trip.originCity ?? trip.originLabel ?? "—";
  const to = trip.destinationCity ?? trip.destinationLabel ?? "—";

  const transportLabel = trip.transportMode
    ? isFr
      ? TRANSPORT_LABELS[trip.transportMode].fr
      : TRANSPORT_LABELS[trip.transportMode].en
    : "";

  const subParts = [
    formatTripDate(trip.departureDateLocal, isFr),
    transportLabel,
  ];
  if (
    trip.arrivalDateLocal &&
    trip.arrivalDateLocal !== trip.departureDateLocal
  ) {
    subParts.splice(1, 0, "→ " + formatTripDate(trip.arrivalDateLocal, isFr));
  }

  const iconWrapperClass =
    "grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl " +
    (muted
      ? "border border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500"
      : isDraft || isPaused
        ? "bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300"
        : "bg-teal-50 text-teal-700 dark:bg-teal-900/25 dark:text-teal-300");

  const rowClass =
    "group flex w-full cursor-pointer items-center gap-3 rounded-lg bg-white px-4 py-3 " +
    "transition-colors hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800/60 mb-1.5 " +
    (muted ? "opacity-70 hover:opacity-100" : "");

  /* CTA contextuel par groupe */
  let cta: React.ReactNode = null;
  if (isDraft || isPaused) {
    const canTry = !isTripPastDeparture(trip.departureDateLocal);
    if (canTry) {
      cta = (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAction("activate", trip);
          }}
          className="hidden whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium text-slate-900 transition-[filter] hover:brightness-95 sm:inline-flex"
          style={{ backgroundColor: MANGO }}
        >
          {isDraft
            ? isFr
              ? "Activer"
              : "Activate"
            : isFr
              ? "Reprendre"
              : "Resume"}
        </button>
      );
    }
  } else if (group === "upcoming" && demands > 0) {
    cta = (
      <span
        className="hidden whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-medium sm:inline-flex"
        style={{ background: "rgba(255,153,0,0.10)", color: MANGO }}
      >
        {demands} {isFr ? "demande(s)" : "request(s)"}
      </span>
    );
  }

  return (
    <div
      className={rowClass}
      onClick={() => router.push(`/dashboard/trips/${trip.id}`)}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(`/dashboard/trips/${trip.id}`);
      }}
    >
      <div className={iconWrapperClass}>
        <TransportIcon size={17} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-medium text-slate-900 dark:text-white">
          {from}
          <span className="mx-1 font-normal text-slate-400">→</span>
          {to}
        </div>
        <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
          {subParts.filter(Boolean).join(" · ")}
        </div>
        {/* Mobile : badge + demandes sous le texte */}
        <div className="mt-2 flex flex-wrap items-center gap-2 sm:hidden">
          <StatusBadge
            status={trip.status}
            isFr={isFr}
            needsOnboarding={needsOnboarding}
          />
          {demands > 0 && (
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{ background: "rgba(255,153,0,0.10)", color: MANGO }}
            >
              {demands} {isFr ? "demande(s)" : "request(s)"}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-3">
        <span className="hidden sm:inline-flex">
          <StatusBadge
            status={trip.status}
            isFr={isFr}
            needsOnboarding={needsOnboarding}
          />
        </span>
        {cta}
        <ActionMenu trip={trip} isFr={isFr} onAction={onAction} />
      </div>
    </div>
  );
}

/* ── Composant principal ─────────────────────────────────────────── */

export default function MyTripsList() {
  const { lang } = useUiPreferences();
  const router = useRouter();
  const isFr = lang === "fr";

  useFlashToast();

  const { user } = useUser();
  const { data: rawData, isLoading, isError, refetch } = useMyTrips();
  const trips: TripListItem[] = useMemo(() => {
    if (!rawData) return [];
    if (Array.isArray(rawData)) return rawData;
    if (rawData.trips && Array.isArray(rawData.trips)) return rawData.trips;
    return [];
  }, [rawData]);

  const pauseTrip = usePauseTrip();
  const resumeTrip = useResumeTrip();
  const cancelTrip = useCancelTrip();
  const restoreTrip = useRestoreTrip();
  const deleteTrip = useDeleteTrip();
  const duplicateTrip = useDuplicateTrip();
  const activateTrip = useActivateTrip();
  const revertToDraft = useRevertToDraft();

  const [filter, setFilter] = useState<Filter>("all");
  const [modal, setModal] = useState<{
    type: "delete" | "cancel" | "revertToDraft";
    trip: TripListItem;
  } | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  /* Onboarding + Stripe */
  const carrierPage = (user as any)?.carrierPage;
  const hasOnboarding =
    carrierPage?.onboardingStep === "STRIPE" ||
    carrierPage?.onboardingStep === "COMPLETE";
  const stripeReady =
    carrierPage?.stripeOnboardingComplete && carrierPage?.stripeChargesEnabled;
  const needsOnboarding = !hasOnboarding;

  /* Groupement */
  const grouped = useMemo(() => {
    const map: Record<Group, TripListItem[]> = {
      finalize: [],
      upcoming: [],
      history: [],
    };
    for (const t of trips) {
      if (t.status === "DRAFT" || t.status === "PAUSED") map.finalize.push(t);
      else if (
        t.status === "PUBLISHED" &&
        !isTripPastDeparture(t.departureDateLocal)
      )
        map.upcoming.push(t);
      else map.history.push(t); // COMPLETED, CANCELLED, ARCHIVED, PUBLISHED passés
    }
    const byDate = (a: TripListItem, b: TripListItem) =>
      (b.departureDateLocal ?? "").localeCompare(a.departureDateLocal ?? "");
    map.finalize.sort(byDate);
    map.upcoming.sort((a, b) =>
      (a.departureDateLocal ?? "").localeCompare(b.departureDateLocal ?? "")
    );
    map.history.sort(byDate);
    return map;
  }, [trips]);

  const draftCount = grouped.finalize.filter((t) => t.status === "DRAFT").length;
  const showOnboardingBanner =
    needsOnboarding && draftCount > 0 && !bannerDismissed;

  const toastOpts = { duration: Infinity, closeButton: true } as const;

  /* Actions (logique conservée de MyTripsTable) */
  const handleAction = useCallback(
    (actionKey: TripActionKey, trip: TripListItem) => {
      const ok = (msg: string) => toast.success(msg, toastOpts);
      const ko = () => toast.error(isFr ? "Erreur" : "Error", toastOpts);

      switch (actionKey) {
        case "view":
          router.push(`/dashboard/trips/${trip.id}`);
          break;
        case "viewPublic":
          window.open(`/trips/${trip.id}`, "_blank");
          break;
        case "edit":
          router.push(`/trips/create?edit=${trip.id}`);
          break;
        case "activate": {
          if (!hasOnboarding) {
            toast.info(
              isFr
                ? "Complétez votre profil transporteur pour activer ce trajet"
                : "Complete your carrier profile to activate this trip",
              {
                duration: Infinity,
                closeButton: true,
                action: {
                  label: isFr ? "Configurer" : "Configure",
                  onClick: () => router.push("/carrier/onboarding"),
                },
              }
            );
            return;
          }
          if (!stripeReady) {
            toast.info(
              isFr
                ? "Configurez Stripe pour activer ce trajet et recevoir des paiements"
                : "Configure Stripe to activate this trip and receive payments",
              {
                duration: Infinity,
                closeButton: true,
                action: {
                  label: isFr ? "Configurer Stripe" : "Configure Stripe",
                  onClick: () => router.push("/carrier/onboarding?step=stripe"),
                },
              }
            );
            return;
          }
          if (trip.status === "DRAFT") {
            activateTrip.mutate(trip.id, {
              onSuccess: () => ok(isFr ? "Trajet activé" : "Trip activated"),
              onError: ko,
            });
          } else if (trip.status === "PAUSED") {
            resumeTrip.mutate(trip.id, {
              onSuccess: () => ok(isFr ? "Trajet republié" : "Trip resumed"),
              onError: ko,
            });
          }
          break;
        }
        case "pause":
          pauseTrip.mutate(trip.id, {
            onSuccess: () => ok(isFr ? "Trajet mis en pause" : "Trip paused"),
            onError: ko,
          });
          break;
        case "revertToDraft":
          setModal({ type: "revertToDraft", trip });
          break;
        case "duplicate":
          duplicateTrip.mutate(trip.id, {
            onSuccess: () =>
              ok(
                isFr
                  ? "Brouillon créé par duplication"
                  : "Draft created from duplicate"
              ),
            onError: ko,
          });
          break;
        case "restoreDraft":
          restoreTrip.mutate(trip.id, {
            onSuccess: () =>
              ok(isFr ? "Trajet restauré en brouillon" : "Trip restored as draft"),
            onError: ko,
          });
          break;
        case "archive":
          ok(isFr ? "Trajet archivé" : "Trip archived");
          break;
        case "cancel":
          setModal({ type: "cancel", trip });
          break;
        case "delete":
          setModal({ type: "delete", trip });
          break;
      }
    },
    [
      router,
      isFr,
      hasOnboarding,
      stripeReady,
      pauseTrip,
      resumeTrip,
      duplicateTrip,
      restoreTrip,
      activateTrip,
    ]
  );

  const confirmModal = useCallback(() => {
    if (!modal) return;
    const ok = (msg: string) => {
      toast.success(msg, toastOpts);
      setModal(null);
    };
    const ko = () => toast.error(isFr ? "Erreur" : "Error", toastOpts);

    if (modal.type === "delete") {
      deleteTrip.mutate(modal.trip.id, {
        onSuccess: () => ok(isFr ? "Brouillon supprimé" : "Draft deleted"),
        onError: ko,
      });
    } else if (modal.type === "cancel") {
      cancelTrip.mutate(modal.trip.id, {
        onSuccess: () => ok(isFr ? "Trajet annulé" : "Trip cancelled"),
        onError: ko,
      });
    } else if (modal.type === "revertToDraft") {
      revertToDraft.mutate(modal.trip.id, {
        onSuccess: () =>
          ok(isFr ? "Trajet repassé en brouillon" : "Trip reverted to draft"),
        onError: ko,
      });
    }
  }, [modal, isFr, deleteTrip, cancelTrip, revertToDraft]);

  const isConfirming =
    deleteTrip.isPending || cancelTrip.isPending || revertToDraft.isPending;

  /* ── Rendus ─────────────────────────────────────────────────── */

  if (isLoading) return <MyTripsSkeleton />;

  if (isError)
    return (
      <div className="py-20 text-center">
        <p className="text-[14px] text-slate-500 dark:text-slate-400">
          {isFr
            ? "Impossible de charger vos trajets."
            : "Unable to load your trips."}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-3 text-[13px] font-medium"
          style={{ color: MANGO }}
        >
          {isFr ? "Réessayer" : "Retry"}
        </button>
      </div>
    );

  const totalCount = trips.length;

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: isFr ? "Tous" : "All", count: totalCount },
    {
      key: "finalize",
      label: isFr ? "À finaliser" : "To finalize",
      count: grouped.finalize.length,
    },
    {
      key: "upcoming",
      label: isFr ? "À venir" : "Upcoming",
      count: grouped.upcoming.length,
    },
    {
      key: "history",
      label: isFr ? "Historique" : "History",
      count: grouped.history.length,
    },
  ];

  const chipBase =
    "rounded-full border px-3 py-1 text-xs font-medium transition-colors ";
  const chipInactive =
    "border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 " +
    "dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-white";
  const chipActive =
    "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900";

  const groupHead = (dotClass: string, label: string, count: number) => (
    <div className="mb-2 mt-7 flex items-center gap-2 px-0.5 first:mt-0">
      <span className={"h-1.5 w-1.5 rounded-full " + dotClass} />
      <h2 className="text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {label}
      </h2>
      <span className="text-[11px] text-slate-300 dark:text-slate-600">
        · {count}
      </span>
    </div>
  );

  const groupLabels: Record<Group, string> = {
    finalize: isFr ? "À finaliser" : "To finalize",
    upcoming: isFr ? "Trajets à venir" : "Upcoming trips",
    history: isFr ? "Historique" : "History",
  };
  const groupDots: Record<Group, string> = {
    finalize: "bg-amber-400",
    upcoming: "bg-teal-600",
    history: "bg-slate-300 dark:bg-slate-600",
  };

  const visibleGroups = (["finalize", "upcoming", "history"] as Group[]).filter(
    (g) => (filter === "all" || filter === g) && grouped[g].length > 0
  );

  return (
    <div>
      {/* Header + CTA */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-xl font-medium text-slate-900 dark:text-white">
          {isFr ? "Mes trajets" : "My trips"}
        </h1>
        <button
          type="button"
          onClick={() => router.push("/trips/create")}
          className="flex flex-shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-medium text-slate-900 transition-[filter] hover:brightness-95"
          style={{ backgroundColor: MANGO }}
        >
          <Plus size={15} strokeWidth={2.5} />
          <span className="hidden sm:inline">
            {isFr ? "Publier un trajet" : "Publish a trip"}
          </span>
        </button>
      </div>

      {showOnboardingBanner && (
        <OnboardingBanner
          draftCount={draftCount}
          isFr={isFr}
          onAction={() => router.push("/carrier/onboarding")}
          onDismiss={() => setBannerDismissed(true)}
        />
      )}

      {totalCount === 0 ? (
        <div className="rounded-xl bg-white px-6 py-12 text-center dark:bg-slate-950">
          <Plane
            size={40}
            className="mx-auto text-slate-300 dark:text-slate-600"
          />
          <p className="mt-3 text-[15px] font-medium text-slate-900 dark:text-white">
            {isFr ? "Aucun trajet publié" : "No trips published"}
          </p>
          <p className="mx-auto mt-1 max-w-[300px] text-[13px] text-slate-500 dark:text-slate-400">
            {isFr
              ? "Publie ton premier trajet et rentabilise tes kilos de bagage."
              : "Publish your first trip and monetize your spare luggage kilos."}
          </p>
          <button
            type="button"
            onClick={() => router.push("/trips/create")}
            className="mt-4 rounded-lg px-5 py-2 text-[13px] font-medium text-slate-900"
            style={{ backgroundColor: MANGO }}
          >
            {isFr ? "Publier un trajet" : "Publish a trip"}
          </button>
        </div>
      ) : (
        <>
          {/* Filtres — visibles uniquement s'il y a des trajets */}
          <div className="mb-6 flex flex-wrap gap-2">
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={
                  chipBase + (filter === f.key ? chipActive : chipInactive)
                }
              >
                {f.label}
                <span className="ml-1.5 opacity-60">{f.count}</span>
              </button>
            ))}
          </div>

          {visibleGroups.map((g) => (
            <section key={g}>
              {groupHead(groupDots[g], groupLabels[g], grouped[g].length)}
              {grouped[g].map((trip) => (
                <TripRow
                  key={trip.id}
                  trip={trip}
                  group={g}
                  isFr={isFr}
                  needsOnboarding={needsOnboarding}
                  onAction={handleAction}
                />
              ))}
            </section>
          ))}
        </>
      )}

      <ConfirmModal
        open={!!modal}
        title={
          modal
            ? modal.type === "delete"
              ? isFr
                ? "Supprimer ce brouillon ?"
                : "Delete this draft?"
              : modal.type === "cancel"
                ? isFr
                  ? "Annuler ce trajet ?"
                  : "Cancel this trip?"
                : isFr
                  ? "Repasser en brouillon ?"
                  : "Revert to draft?"
            : ""
        }
        message={
          modal
            ? (() => {
              const from =
                modal.trip.originCity ?? modal.trip.originLabel ?? "—";
              const to =
                modal.trip.destinationCity ??
                modal.trip.destinationLabel ??
                "—";
              if (modal.type === "delete")
                return isFr
                  ? `Le brouillon "${from} → ${to}" sera définitivement supprimé.`
                  : `The draft "${from} → ${to}" will be permanently deleted.`;
              if (modal.type === "cancel")
                return isFr
                  ? `Le trajet "${from} → ${to}" sera annulé. Les demandes en cours seront notifiées.`
                  : `The trip "${from} → ${to}" will be cancelled. Pending requests will be notified.`;
              return isFr
                ? `Le trajet "${from} → ${to}" sera masqué et repassé en brouillon. Vous pourrez le réactiver à tout moment.`
                : `The trip "${from} → ${to}" will be hidden and reverted to draft. You can reactivate it anytime.`;
            })()
            : ""
        }
        confirmLabel={
          modal
            ? modal.type === "delete"
              ? isFr
                ? "Supprimer"
                : "Delete"
              : modal.type === "cancel"
                ? isFr
                  ? "Annuler le trajet"
                  : "Cancel trip"
                : isFr
                  ? "Repasser en brouillon"
                  : "Revert to draft"
            : ""
        }
        isLoading={isConfirming}
        onConfirm={confirmModal}
        onCancel={() => setModal(null)}
        isFr={isFr}
      />

      <style jsx global>{`
        @keyframes fadeSlide {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}

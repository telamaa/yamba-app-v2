"use client";

import React, { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Car, Plane, Plus, Train } from "lucide-react";
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
  useArchiveTrip,
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
  TRANSPORT_LABEL_KEYS,
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
 * CTA contextuel. La vitrine mock des états deals vit sur
 * /dashboard/trips/preview.
 * ⭐ i18n : namespace "myTrips" (next-intl) — zéro ternaire isFr.
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
                   needsOnboarding,
                   onAction,
                 }: {
  trip: TripListItem;
  group: Group;
  needsOnboarding: boolean;
  onAction: (key: TripActionKey, trip: TripListItem) => void;
}) {
  const t = useTranslations("myTrips");
  const locale = useLocale();

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
    ? t(TRANSPORT_LABEL_KEYS[trip.transportMode])
    : "";

  const subParts = [
    formatTripDate(trip.departureDateLocal, locale),
    transportLabel,
  ];
  if (
    trip.arrivalDateLocal &&
    trip.arrivalDateLocal !== trip.departureDateLocal
  ) {
    subParts.splice(1, 0, "→ " + formatTripDate(trip.arrivalDateLocal, locale));
  }

  const iconWrapperClass =
    "grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl " +
    (muted
      ? "border border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500"
      : isDraft || isPaused
        ? "bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300"
        : "bg-teal-50 text-teal-700 dark:bg-teal-900/25 dark:text-teal-300");

  // "relative" pour ancrer le lien overlay
  const rowClass =
    "group relative flex w-full cursor-pointer items-center gap-3 rounded-lg bg-white px-4 py-3 " +
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
          {isDraft ? t("actionsMenu.activate") : t("actionsMenu.resume")}
        </button>
      );
    }
  } else if (group === "upcoming" && demands > 0) {
    cta = (
      <span
        className="hidden whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-medium sm:inline-flex"
        style={{ background: "rgba(255,153,0,0.10)", color: MANGO }}
      >
        {t("list.demands", { count: demands })}
      </span>
    );
  }

  return (
    <div className={rowClass}>
      {/* Lien réel en overlay : toute la row est un <a> natif
          (clic droit → nouvel onglet, clic molette, Enter au clavier),
          sans imbriquer les boutons dans le lien (HTML invalide). */}
      <Link
        href={`/dashboard/trips/${trip.id}`}
        className="absolute inset-0 z-0 rounded-lg"
        aria-label={`${from} → ${to}`}
      />

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
          <StatusBadge status={trip.status} needsOnboarding={needsOnboarding} />
          {demands > 0 && (
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{ background: "rgba(255,153,0,0.10)", color: MANGO }}
            >
              {t("list.demands", { count: demands })}
            </span>
          )}
        </div>
      </div>

      {/* z-10 : les contrôles restent cliquables AU-DESSUS du lien overlay */}
      <div className="relative z-10 flex flex-shrink-0 items-center gap-3">
        <span className="hidden sm:inline-flex">
          <StatusBadge status={trip.status} needsOnboarding={needsOnboarding} />
        </span>
        {cta}
        <ActionMenu trip={trip} onAction={onAction} />
      </div>
    </div>
  );
}

/* ── Composant principal ─────────────────────────────────────────── */

export default function MyTripsList() {
  const t = useTranslations("myTrips");
  const router = useRouter();

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
  const archiveTrip = useArchiveTrip();

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
    for (const trip of trips) {
      if (trip.status === "DRAFT" || trip.status === "PAUSED")
        map.finalize.push(trip);
      else if (
        trip.status === "PUBLISHED" &&
        !isTripPastDeparture(trip.departureDateLocal)
      )
        map.upcoming.push(trip);
      else map.history.push(trip); // COMPLETED, CANCELLED, ARCHIVED, PUBLISHED passés
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

  /* Actions */
  const handleAction = useCallback(
    (actionKey: TripActionKey, trip: TripListItem) => {
      const ok = (msg: string) => toast.success(msg, toastOpts);
      const ko = () => toast.error(t("toasts.error"), toastOpts);

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
            toast.info(t("gates.onboardingToast"), {
              duration: Infinity,
              closeButton: true,
              action: {
                label: t("gates.onboardingCta"),
                onClick: () => router.push("/carrier/onboarding"),
              },
            });
            return;
          }
          if (!stripeReady) {
            toast.info(t("gates.stripeToast"), {
              duration: Infinity,
              closeButton: true,
              action: {
                label: t("gates.stripeCta"),
                onClick: () => router.push("/carrier/onboarding?step=stripe"),
              },
            });
            return;
          }
          if (trip.status === "DRAFT") {
            activateTrip.mutate(trip.id, {
              onSuccess: () => ok(t("toasts.activated")),
              onError: ko,
            });
          } else if (trip.status === "PAUSED") {
            resumeTrip.mutate(trip.id, {
              onSuccess: () => ok(t("toasts.resumed")),
              onError: ko,
            });
          }
          break;
        }
        case "pause":
          pauseTrip.mutate(trip.id, {
            onSuccess: () => ok(t("toasts.paused")),
            onError: ko,
          });
          break;
        case "revertToDraft":
          setModal({ type: "revertToDraft", trip });
          break;
        case "duplicate":
          duplicateTrip.mutate(trip.id, {
            onSuccess: () => ok(t("toasts.duplicated")),
            onError: ko,
          });
          break;
        case "restoreDraft":
          restoreTrip.mutate(trip.id, {
            onSuccess: () => ok(t("toasts.restored")),
            onError: ko,
          });
          break;
        case "archive":
          archiveTrip.mutate(trip.id, {
            onSuccess: () => ok(t("toasts.archived")),
            onError: ko,
          });
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
      t,
      hasOnboarding,
      stripeReady,
      pauseTrip,
      resumeTrip,
      duplicateTrip,
      restoreTrip,
      activateTrip,
      archiveTrip,
    ]
  );

  const confirmModal = useCallback(() => {
    if (!modal) return;
    const ok = (msg: string) => {
      toast.success(msg, toastOpts);
      setModal(null);
    };
    const ko = () => toast.error(t("toasts.error"), toastOpts);

    if (modal.type === "delete") {
      deleteTrip.mutate(modal.trip.id, {
        onSuccess: () => ok(t("toasts.deleted")),
        onError: ko,
      });
    } else if (modal.type === "cancel") {
      cancelTrip.mutate(modal.trip.id, {
        onSuccess: () => ok(t("toasts.cancelled")),
        onError: ko,
      });
    } else if (modal.type === "revertToDraft") {
      revertToDraft.mutate(modal.trip.id, {
        onSuccess: () => ok(t("toasts.reverted")),
        onError: ko,
      });
    }
  }, [modal, t, deleteTrip, cancelTrip, revertToDraft]);

  const isConfirming =
    deleteTrip.isPending || cancelTrip.isPending || revertToDraft.isPending;

  /* Modal — libellés dérivés du type */
  const modalCopy = useMemo(() => {
    if (!modal) return { title: "", message: "", confirmLabel: "" };
    const from = modal.trip.originCity ?? modal.trip.originLabel ?? "—";
    const to = modal.trip.destinationCity ?? modal.trip.destinationLabel ?? "—";
    if (modal.type === "delete")
      return {
        title: t("modals.deleteTitle"),
        message: t("modals.deleteMessage", { from, to }),
        confirmLabel: t("modals.deleteConfirm"),
      };
    if (modal.type === "cancel")
      return {
        title: t("modals.cancelTitle"),
        message: t("modals.cancelMessage", { from, to }),
        confirmLabel: t("modals.cancelConfirm"),
      };
    return {
      title: t("modals.revertTitle"),
      message: t("modals.revertMessage", { from, to }),
      confirmLabel: t("modals.revertConfirm"),
    };
  }, [modal, t]);

  /* ── Rendus ─────────────────────────────────────────────────── */

  if (isLoading) return <MyTripsSkeleton />;

  if (isError)
    return (
      <div className="py-20 text-center">
        <p className="text-[14px] text-slate-500 dark:text-slate-400">
          {t("list.errorTitle")}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-3 text-[13px] font-medium"
          style={{ color: MANGO }}
        >
          {t("list.retry")}
        </button>
      </div>
    );

  const totalCount = trips.length;

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: t("list.filters.all"), count: totalCount },
    {
      key: "finalize",
      label: t("list.filters.finalize"),
      count: grouped.finalize.length,
    },
    {
      key: "upcoming",
      label: t("list.filters.upcoming"),
      count: grouped.upcoming.length,
    },
    {
      key: "history",
      label: t("list.filters.history"),
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
    finalize: t("list.groups.finalize"),
    upcoming: t("list.groups.upcoming"),
    history: t("list.groups.history"),
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
          {t("title")}
        </h1>
        <button
          type="button"
          onClick={() => router.push("/trips/create")}
          className="flex flex-shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-medium text-slate-900 transition-[filter] hover:brightness-95"
          style={{ backgroundColor: MANGO }}
        >
          <Plus size={15} strokeWidth={2.5} />
          <span className="hidden sm:inline">{t("publishTrip")}</span>
        </button>
      </div>

      {showOnboardingBanner && (
        <OnboardingBanner
          draftCount={draftCount}
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
            {t("empty.title")}
          </p>
          <p className="mx-auto mt-1 max-w-[300px] text-[13px] text-slate-500 dark:text-slate-400">
            {t("empty.subtitle")}
          </p>
          <button
            type="button"
            onClick={() => router.push("/trips/create")}
            className="mt-4 rounded-lg px-5 py-2 text-[13px] font-medium text-slate-900"
            style={{ backgroundColor: MANGO }}
          >
            {t("empty.cta")}
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
        title={modalCopy.title}
        message={modalCopy.message}
        confirmLabel={modalCopy.confirmLabel}
        isLoading={isConfirming}
        onConfirm={confirmModal}
        onCancel={() => setModal(null)}
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

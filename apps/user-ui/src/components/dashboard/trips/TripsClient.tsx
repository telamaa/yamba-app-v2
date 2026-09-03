"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Plane, Plus } from "lucide-react";
import SectionHeader from "@/components/dashboard/SectionHeader";
import { EmptyState } from "@/components/dashboard/DashboardUI";
import TripActionRow from "./TripActionRow";
import TripCard, { TripHistoryRow } from "./TripCard";
import PayoutBlockedBanner from "./PayoutBlockedBanner";
import TripsSkeleton from "./TripsSkeleton";
import { getMyTrips } from "./trips.api";
import {
  deriveCarrierActions,
  getTripGroup,
  type CarrierTripItem,
  type TripGroup,
} from "./trips.types";
import { formatMoney } from "./trips.format";

const MANGO = "#FF9900";

/** Gains pas encore versés (deals engagés non COMPLETED) */
function getUpcomingEarnings(trips: CarrierTripItem[]): number {
  let sum = 0;
  for (const trip of trips) {
    for (const deal of trip.deals) {
      if (
        deal.status === "ACCEPTED" ||
        deal.status === "PICKED_UP" ||
        deal.status === "DELIVERED"
      ) {
        sum += deal.netEarningsEur;
      }
    }
  }
  return sum;
}

export default function TripsClient() {
  const t = useTranslations("myTrips");
  const locale = useLocale();
  const router = useRouter();

  const [trips, setTrips] = useState<CarrierTripItem[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  /* Chargement avec garde d'annulation */
  useEffect(() => {
    let cancelled = false;
    setLoadError(false);
    getMyTrips()
      .then((data) => {
        if (!cancelled) setTrips(data);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* Tick 60s pour les countdowns */
  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  /* Dérivations (inbox + groupes) — jamais stockées */
  const actions = useMemo(
    () => deriveCarrierActions(trips ?? []),
    [trips]
  );

  const grouped = useMemo(() => {
    const map: Record<TripGroup, CarrierTripItem[]> = {
      upcoming: [],
      inProgress: [],
      history: [],
    };
    for (const trip of trips ?? []) {
      map[getTripGroup(trip)].push(trip);
    }
    return map;
  }, [trips]);

  const upcomingEarnings = useMemo(
    () => getUpcomingEarnings(trips ?? []),
    [trips]
  );

  /* ── Rendus ─────────────────────────────────────────────────── */

  if (loadError) {
    return (
      <>
        <SectionHeader title={t("title")} subtitle={" "} />
        <div className="rounded-lg bg-white px-4 py-6 text-center text-[13px] text-slate-500 dark:bg-slate-950 dark:text-slate-400">
          {t("loadError")}
        </div>
      </>
    );
  }

  if (trips === null) {
    return (
      <>
        <SectionHeader title={t("title")} subtitle={" "} />
        <TripsSkeleton />
      </>
    );
  }

  if (trips.length === 0) {
    return (
      <>
        <SectionHeader title={t("title")} subtitle={" "} />
        <PayoutBlockedBanner />
        <EmptyState
          icon={Plane}
          title={t("empty.title")}
          description={t("empty.subtitle")}
          actionLabel={t("empty.cta")}
          onAction={() => router.push("/dashboard/create")}
        />
      </>
    );
  }

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

  return (
    <>
      {/* Header + CTA Publier */}
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium text-slate-900 dark:text-white">
            {t("title")}
          </h1>
          <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
            {t("subtitle", {
              upcoming: grouped.upcoming.length,
              actions: actions.length,
              earnings: formatMoney(locale, upcomingEarnings),
            })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/dashboard/create")}
          className="flex flex-shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-medium text-slate-900 transition-[filter] hover:brightness-95"
          style={{ backgroundColor: MANGO }}
        >
          <Plus size={15} strokeWidth={2.5} />
          <span className="hidden sm:inline">{t("publishTrip")}</span>
        </button>
      </div>

      {/* À traiter (inbox dérivée, trans-trajets) */}
      {actions.length > 0 && (
        <section>
          {groupHead("bg-amber-400", t("groups.actions"), actions.length)}
          {actions.map((action) => (
            <TripActionRow
              key={action.kind + "_" + action.dealId}
              action={action}
              nowMs={nowMs}
            />
          ))}
        </section>
      )}

      {/* Trajets à venir */}
      {grouped.upcoming.length > 0 && (
        <section>
          {groupHead("bg-teal-600", t("groups.upcoming"), grouped.upcoming.length)}
          {grouped.upcoming.map((trip) => (
            <TripCard
              key={trip.id}
              trip={trip}
              nowMs={nowMs}
              defaultOpen={trip.deals.some((d) => d.status === "PENDING")}
            />
          ))}
        </section>
      )}

      {/* En cours (partis / atterris) */}
      {grouped.inProgress.length > 0 && (
        <section>
          {groupHead(
            "bg-emerald-500",
            t("groups.inProgress"),
            grouped.inProgress.length
          )}
          {grouped.inProgress.map((trip) => (
            <TripCard key={trip.id} trip={trip} nowMs={nowMs} defaultOpen />
          ))}
        </section>
      )}

      {/* Historique */}
      {grouped.history.length > 0 && (
        <section>
          {groupHead(
            "bg-slate-300 dark:bg-slate-600",
            t("groups.history"),
            grouped.history.length
          )}
          {grouped.history.map((trip) => (
            <TripHistoryRow key={trip.id} trip={trip} nowMs={nowMs} />
          ))}
        </section>
      )}
    </>
  );
}

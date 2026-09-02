"use client";

import { useEffect, useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  CheckCircle2,
  FileText,
  Package,
  Pause,
  Plane,
} from "lucide-react";
import useUser from "@/hooks/useUser";
import { useMyTrips } from "@/hooks/useTrip";
import { useMyDeals } from "@/hooks/useMyDeals";
import { groupDealsByTrip, toCarrierTripItem } from "@/components/dashboard/trips/my-deals.adapter";
import { deriveCarrierActions } from "@/components/dashboard/trips/trips.types";
import {
  isTripPastDeparture,
  type TripListItem,
} from "@/components/trips/list/my-trips.config";
import ShipmentRow from "@/components/dashboard/shipments/ShipmentRow";
import TripActionRow from "@/components/dashboard/trips/TripActionRow";
import { getMyShipmentsPreview } from "@/components/dashboard/shipments/shipments.api";
import { getMyTrips as getMyCarrierTripsMock } from "@/components/dashboard/trips/trips.api";
import type { ShipmentListItem } from "@/components/dashboard/shipments/shipments.types";
import type { CarrierTripItem } from "@/components/dashboard/trips/trips.types";
import { deriveHomeActions, type HomeAction } from "./home.types";
import HomeQuickLinks from "./HomeQuickLinks";

const MANGO = "#FF9900";

type Props = { source?: "live" | "preview" };

export default function HomeClient({ source = "live" }: Props) {
  return source === "preview" ? <HomePreview /> : <HomeLive />;
}

/* ── Briques partagées ───────────────────────────────────────────── */

function Greeting({ subtitle }: { subtitle: string }) {
  const t = useTranslations("dashboardHome");
  const { user } = useUser();
  const firstName =
    (user as any)?.firstName ?? (user as any)?.name?.split(" ")[0] ?? null;

  return (
    <div className="mb-6">
      <h1 className="text-xl font-medium text-slate-900 dark:text-white">
        {firstName ? t("greeting", { firstName }) : t("greetingAnonymous")}
      </h1>
      <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
        {subtitle}
      </p>
    </div>
  );
}

function GroupHead({ label, count }: { label: string; count?: number }) {
  return (
    <div className="mb-2 flex items-center gap-2 px-0.5">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
      <h2 className="text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {label}
      </h2>
      {count !== undefined && (
        <span className="text-[11px] text-slate-300 dark:text-slate-600">
          · {count}
        </span>
      )}
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div aria-hidden>
      <div className="mb-6 space-y-2">
        <div className="h-6 w-48 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
        <div className="h-3.5 w-36 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
      </div>
      <div className="mb-2 h-3 w-24 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="mb-1.5 flex items-center gap-3 rounded-lg bg-white px-4 py-3 dark:bg-slate-950"
        >
          <div className="h-10 w-10 flex-shrink-0 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3.5 w-1/2 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
            <div className="h-3 w-3/5 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyInbox() {
  const t = useTranslations("dashboardHome");
  return (
    <div className="rounded-xl bg-white px-6 py-10 text-center dark:bg-slate-950">
      <CheckCircle2
        size={36}
        className="mx-auto text-emerald-400 dark:text-emerald-500"
      />
      <p className="mt-3 text-[15px] font-medium text-slate-900 dark:text-white">
        {t("empty.title")}
      </p>
      <p className="mx-auto mt-1 max-w-[340px] text-[13px] text-slate-500 dark:text-slate-400">
        {t("empty.subtitle")}
      </p>
    </div>
  );
}

/* ── LIVE : dérivé des données réelles disponibles ───────────────── */

type LiveActionKind = "FINALIZE_DRAFT" | "RESUME_PAUSED";

function HomeLive() {
  const t = useTranslations("dashboardHome");
  const { data: rawData, isLoading } = useMyTrips();
  const { data: dealViews, isLoading: dealsLoading } = useMyDeals();
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const trips: TripListItem[] = useMemo(() => {
    if (!rawData) return [];
    if (Array.isArray(rawData)) return rawData;
    if (rawData.trips && Array.isArray(rawData.trips)) return rawData.trips;
    return [];
  }, [rawData]);

  /* A44 : les deals réels d'abord (répondre / prise en charge / livraison) */
  const dealActions = useMemo(() => {
    const byTrip = groupDealsByTrip(dealViews ?? []);
    return deriveCarrierActions(
      trips
        .filter((trip) => (byTrip.get(trip.id)?.length ?? 0) > 0)
        .map((trip) => toCarrierTripItem(trip, byTrip.get(trip.id) ?? []))
    );
  }, [trips, dealViews]);

  const liveActions = useMemo(() => {
    const actions: { kind: LiveActionKind; trip: TripListItem }[] = [];
    for (const trip of trips) {
      if (trip.status === "DRAFT") {
        actions.push({ kind: "FINALIZE_DRAFT", trip });
      } else if (
        trip.status === "PAUSED" &&
        !isTripPastDeparture(trip.departureDateLocal)
      ) {
        actions.push({ kind: "RESUME_PAUSED", trip });
      }
    }
    // Pauses (trajet perdu de vue) avant brouillons
    const order: Record<LiveActionKind, number> = {
      RESUME_PAUSED: 0,
      FINALIZE_DRAFT: 1,
    };
    return actions.sort((a, b) => order[a.kind] - order[b.kind]);
  }, [trips]);

  if (isLoading || dealsLoading) return <HomeSkeleton />;

  const total = dealActions.length + liveActions.length;

  return (
    <>
      <Greeting
        subtitle={
          total > 0 ? t("subtitleActions", { count: total }) : t("subtitleEmpty")
        }
      />

      {total > 0 ? (
        <section>
          <GroupHead label={t("groups.actions")} count={total} />
          {dealActions.map((action) => (
            <TripActionRow
              key={action.kind + "_" + action.dealId}
              action={action}
              nowMs={nowMs}
            />
          ))}
          {liveActions.map(({ kind, trip }) => (
            <LiveActionRow key={kind + "_" + trip.id} kind={kind} trip={trip} />
          ))}
        </section>
      ) : (
        <EmptyInbox />
      )}

      <HomeQuickLinks />
    </>
  );
}

function LiveActionRow({
                         kind,
                         trip,
                       }: {
  kind: LiveActionKind;
  trip: TripListItem;
}) {
  const t = useTranslations("dashboardHome");
  const origin = trip.originCity ?? trip.originLabel ?? "—";
  const destination = trip.destinationCity ?? trip.destinationLabel ?? "—";

  const content =
    kind === "RESUME_PAUSED"
        ? {
          Icon: Pause,
          iconClass:
            "bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300",
          title: t("liveTrip.resumePausedTitle"),
          sub: t("liveTrip.resumePausedSub", { origin, destination }),
          badge: t("liveTrip.badgePaused"),
          cta: t("liveTrip.ctaResume"),
          pulse: false,
        }
        : {
          Icon: FileText,
          iconClass:
            "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
          title: t("liveTrip.finalizeDraftTitle"),
          sub: t("liveTrip.finalizeDraftSub", { origin, destination }),
          badge: t("liveTrip.badgeDraft"),
          cta: t("liveTrip.ctaActivate"),
          pulse: false,
        };

  const { Icon } = content;

  return (
    <Link
      href="/dashboard/trips"
      className="group relative mb-1.5 flex w-full items-center gap-3 rounded-lg bg-white px-4 py-3 transition-colors hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800/60"
    >
      <span
        aria-hidden
        className="absolute bottom-3 left-0 top-3 w-[3px] rounded-r bg-amber-400"
      />
      <div
        className={
          "grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl " +
          content.iconClass
        }
      >
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-medium text-slate-900 dark:text-white">
          {content.title}
        </div>
        <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
          {content.sub}
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-3">
        <span className="hidden items-center gap-1.5 whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-800 sm:inline-flex dark:bg-amber-900/30 dark:text-amber-300">
          {content.pulse && (
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
          )}
          {content.badge}
        </span>
        <span
          className="inline-flex whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium text-slate-900 transition-[filter] group-hover:brightness-95"
          style={{ backgroundColor: MANGO }}
        >
          {content.cta}
        </span>
      </div>
    </Link>
  );
}

/* ── PREVIEW : feed fusionné des deux rôles (mocks) ──────────────── */

function HomePreview() {
  const t = useTranslations("dashboardHome");
  const [shipments, setShipments] = useState<ShipmentListItem[] | null>(null);
  const [carrierTrips, setCarrierTrips] = useState<CarrierTripItem[] | null>(
    null
  );
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    Promise.all([getMyShipmentsPreview(), getMyCarrierTripsMock()]).then(
      ([shipmentData, tripData]) => {
        if (cancelled) return;
        setShipments(shipmentData);
        setCarrierTrips(tripData);
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const actions: HomeAction[] = useMemo(
    () => deriveHomeActions(shipments ?? [], carrierTrips ?? []),
    [shipments, carrierTrips]
  );

  if (shipments === null || carrierTrips === null) return <HomeSkeleton />;

  return (
    <>
      <Greeting subtitle={t("subtitleActions", { count: actions.length })} />

      <section>
        <GroupHead label={t("groups.actions")} count={actions.length} />
        {actions.map((action) => (
          <div key={action.key} className="flex items-center gap-2">
            <RoleChip role={action.role} />
            <div className="min-w-0 flex-1">
              {action.role === "SHIPPER" ? (
                <ShipmentRow item={action.shipment} nowMs={nowMs} />
              ) : (
                <TripActionRow action={action.carrier} nowMs={nowMs} />
              )}
            </div>
          </div>
        ))}
      </section>

      <HomeQuickLinks />
    </>
  );
}

function RoleChip({ role }: { role: "SHIPPER" | "CARRIER" }) {
  const isShipper = role === "SHIPPER";
  const Icon = isShipper ? Package : Plane;
  const chipClass =
    "mb-1.5 hidden h-8 w-8 flex-shrink-0 place-items-center rounded-full sm:grid " +
    (isShipper
      ? "bg-violet-50 text-violet-700 dark:bg-violet-900/25 dark:text-violet-300"
      : "bg-teal-50 text-teal-700 dark:bg-teal-900/25 dark:text-teal-300");

  return (
    <span
      className={chipClass}
      aria-label={isShipper ? "Envoi" : "Trajet"}
      title={isShipper ? "Envoi" : "Trajet"}
    >
      <Icon size={14} />
    </span>
  );
}

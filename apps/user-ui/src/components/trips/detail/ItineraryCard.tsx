"use client";

import { useTranslations, useLocale } from "next-intl";
import {
  Calendar,
  Plane,
  Train,
  Car,
  Star,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  Leaf,
  Info,
  MessageCircle,
  Route,
  type LucideIcon, Sparkles,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { PublicTrip, TransportMode } from "@/lib/public-trip.types";
import {
  formatLongDate,
  formatLocalTime,
  formatTripDuration,
  calculateCO2SavedKg,
  formatMemberSince,
  getInitials,
} from "@/lib/public-trip.helpers";

type Props = {
  trip: PublicTrip;
};

const TRANSPORT_ICONS: Record<TransportMode, LucideIcon> = {
  PLANE: Plane,
  TRAIN: Train,
  CAR: Car,
};

export default function ItineraryCard({ trip }: Props) {
  const t = useTranslations("tripDetail");
  const locale = useLocale() as "fr" | "en";

  const TransportIcon = trip.transportMode ? TRANSPORT_ICONS[trip.transportMode] : Plane;
  const dateLabel = formatLongDate(trip.dates.departureAt, locale);
  const departureTime = formatLocalTime(trip.dates.departureAt, trip.dates.departureTimeLocal);
  const arrivalTime = formatLocalTime(trip.dates.arrivalAt, trip.dates.arrivalTimeLocal);
  const duration = formatTripDuration(trip.dates);
  const co2Saved = calculateCO2SavedKg(trip);
  const memberSince = formatMemberSince(trip.tripper.memberSince, locale);

  // Détermination des stopovers selon le mode
  const stopoverCities = (() => {
    if (trip.transportMode === "PLANE" && trip.flightType === "WITH_LAYOVER") {
      return trip.flightLayoverCities ?? [];
    }
    if (
      trip.transportMode === "TRAIN" &&
      (trip.trainTripType === "WITH_CONNECTION" ||
        trip.trainTripType === "WITH_INTERMEDIATE_STOPS")
    ) {
      return trip.trainStopCities ?? [];
    }
    return [];
  })();

  const hasCarDetour =
    trip.transportMode === "CAR" &&
    trip.carTripFlexibility === "DETOUR_BY_AGREEMENT";

// Construction de la liste unifiée des points
  type TimelinePoint = {
    type: "departure" | "stopover" | "arrival";
    time: string | null;
    duration: string | null;
    label: string | null;
    cityCode: string | null;
    sublabel: string | null;
  };

  const points: TimelinePoint[] = [
    {
      type: "departure",
      time: departureTime,
      duration: null,  // ← plus de duration ici
      label: trip.origin.city,
      cityCode: trip.origin.cityCode,
      sublabel: trip.origin.country,
    },
    ...stopoverCities.map<TimelinePoint>((city) => ({
      type: "stopover",
      time: null,
      duration: null,
      label: city,
      cityCode: null,
      sublabel: null,
    })),
    {
      type: "arrival",
      time: arrivalTime,
      duration: null,
      label: trip.destination.city,
      cityCode: trip.destination.cityCode,
      sublabel: trip.destination.country,
    },
  ];

  const transportLabel = (() => {
    if (trip.transportMode === "PLANE") {
      return trip.flightType === "DIRECT" ? t("flight.direct") : t("flight.label");
    }
    if (trip.transportMode === "TRAIN") {
      return trip.trainTripType === "DIRECT" ? t("train.direct") : t("train.label");
    }
    if (trip.transportMode === "CAR") return t("car.label");
    return "";
  })();

  const hasRating = trip.tripper.carrier && trip.tripper.carrier.ratingsCount > 0;

  return (
    <section className="px-5 pt-5 pb-2">
      {/* Header : Date à gauche, badges Vol direct + Réf. vol à droite */}
      <div className="mb-0.5 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 pt-1 text-sm">
          <Calendar size={14} className="text-slate-400" />
          <span className="font-semibold text-slate-900 dark:text-white">{dateLabel}</span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-[#B45309] dark:bg-orange-500/15 dark:text-[#FFB84D]">
            <TransportIcon size={11} />
            {transportLabel}
          </span>
          {trip.travelReference && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              <TransportIcon size={10} />
              {t("travelReference")} {trip.travelReference}
            </span>
          )}
        </div>
      </div>

      {/*/!* Timeline style BlaBlaCar *!/*/}
      {/*<div className="flex gap-x-4">*/}
      {/*  /!* Col 1 : heures + durée *!/*/}
      {/*  <div className="flex flex-col py-1">*/}
      {/*    <div className="text-base font-bold leading-none tabular-nums text-slate-900 dark:text-white">*/}
      {/*      {departureTime}*/}
      {/*    </div>*/}
      {/*    <div className="flex flex-1 items-center py-2">*/}
      {/*      {duration && (*/}
      {/*        <span className="text-[11px] text-slate-500 dark:text-slate-400">*/}
      {/*          {duration}*/}
      {/*        </span>*/}
      {/*      )}*/}
      {/*    </div>*/}
      {/*    <div className="text-base font-bold leading-none tabular-nums text-slate-900 dark:text-white">*/}
      {/*      {arrivalTime}*/}
      {/*    </div>*/}
      {/*  </div>*/}

      {/*  /!* Col 2 : 2 dots reliés par ligne continue + icône transport au centre *!/*/}
      {/*  <div className="relative flex flex-col items-center py-1">*/}
      {/*    <div className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-[#FF9900] bg-white dark:bg-slate-950" />*/}
      {/*    <div className="my-1 w-px flex-1 bg-slate-300 dark:bg-slate-700" />*/}
      {/*    <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#FF9900]" />*/}

      {/*    /!* Icône transport au milieu — fond opaque qui cache la ligne derrière *!/*/}
      {/*    <div className="absolute left-1/2 top-1/2 grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-slate-500 dark:bg-slate-950 dark:text-slate-400">*/}
      {/*      <TransportIcon size={12} />*/}
      {/*    </div>*/}
      {/*  </div>*/}

      {/*  /!* Col 3 : villes + pays *!/*/}
      {/*  <div className="flex min-w-0 flex-1 flex-col gap-y-8">*/}
      {/*    <div>*/}
      {/*      <div className="text-base font-bold leading-tight text-slate-900 dark:text-white">*/}
      {/*        {trip.origin.city}*/}
      {/*        {trip.origin.cityCode && (*/}
      {/*          <span className="ml-1 text-sm font-normal text-slate-400 dark:text-slate-500">*/}
      {/*      {trip.origin.cityCode}*/}
      {/*    </span>*/}
      {/*        )}*/}
      {/*      </div>*/}
      {/*      {trip.origin.country && (*/}
      {/*        <div className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">*/}
      {/*          {trip.origin.country}*/}
      {/*        </div>*/}
      {/*      )}*/}
      {/*    </div>*/}
      {/*    <div>*/}
      {/*      <div className="text-base font-bold leading-tight text-slate-900 dark:text-white">*/}
      {/*        {trip.destination.city}*/}
      {/*        {trip.destination.cityCode && (*/}
      {/*          <span className="ml-1 text-sm font-normal text-slate-400 dark:text-slate-500">*/}
      {/*      {trip.destination.cityCode}*/}
      {/*    </span>*/}
      {/*        )}*/}
      {/*      </div>*/}
      {/*      {trip.destination.country && (*/}
      {/*        <div className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">*/}
      {/*          {trip.destination.country}*/}
      {/*        </div>*/}
      {/*      )}*/}
      {/*    </div>*/}
      {/*  </div>*/}
      {/*</div>*/}

      {/* Timeline adaptative */}
      {stopoverCities.length === 0 ? (
        /* ─── CAS SIMPLE : départ → arrivée, durée pile au centre ─── */
        <div className="flex min-h-32 gap-x-4">
          {/* Col 1 : heure départ, durée centrée, heure arrivée */}
          <div className="flex w-12 shrink-0 flex-col items-end">
            <div className="text-base font-bold leading-none tabular-nums text-slate-900 dark:text-white">
              {departureTime}
            </div>
            <div className="flex flex-1 items-center py-2">
              {duration && (
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {duration}
          </span>
              )}
            </div>
            <div className="text-base font-bold leading-none tabular-nums text-slate-900 dark:text-white">
              {arrivalTime}
            </div>
          </div>

          {/* Col 2 : 2 dots reliés par ligne continue */}
          <div className="flex w-2.5 shrink-0 flex-col items-center pt-2">
            <div className="h-2.5 w-2.5 rounded-full border-2 border-[#FF9900] bg-white dark:bg-slate-950" />
            <div className="my-1 w-px flex-1 bg-slate-300 dark:bg-slate-700" />
            <div className="mb-2 h-2.5 w-2.5 rounded-full bg-[#FF9900]" />
          </div>

          {/* Col 3 : villes + pays */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div>
              <div className="text-base font-bold leading-tight text-slate-900 dark:text-white">
                {trip.origin.city}
                {trip.origin.cityCode && (
                  <span className="ml-1 text-sm font-normal text-slate-400 dark:text-slate-500">
              {trip.origin.cityCode}
            </span>
                )}
              </div>
              {trip.origin.country && (
                <div className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  {trip.origin.country}
                </div>
              )}
            </div>
            <div className="flex-1" />
            <div>
              <div className="text-base font-bold leading-tight text-slate-900 dark:text-white">
                {trip.destination.city}
                {trip.destination.cityCode && (
                  <span className="ml-1 text-sm font-normal text-slate-400 dark:text-slate-500">
              {trip.destination.cityCode}
            </span>
                )}
              </div>
              {trip.destination.country && (
                <div className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  {trip.destination.country}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ─── CAS AVEC STOPOVERS : point par point + connecteurs ─── */
        <div className="flex flex-col">
          {points.map((point, i) => {
            const isFirst = i === 0;
            const isLast = i === points.length - 1;
            const totalPoints = points.length;
            const isOddPoints = totalPoints % 2 === 1;
            const middlePointIndex = isOddPoints ? Math.floor(totalPoints / 2) : -1;
            const middleConnectorIndex = !isOddPoints ? (totalPoints - 2) / 2 : -1;
            const showDurationOnPoint = duration && i === middlePointIndex;
            const showDurationOnConnector = duration && i === middleConnectorIndex;

            return (
              <div key={`point-${i}`}>
                {/* Le point */}
                <div className="flex items-start gap-x-4">
                  <div className="w-12 shrink-0 pt-0.5 text-right">
                    {point.time ? (
                      <div className="text-base font-bold leading-none tabular-nums text-slate-900 dark:text-white">
                        {point.time}
                      </div>
                    ) : showDurationOnPoint ? (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {duration}
                      </div>
                    ) : null}
                  </div>

                  {/* Cellule du dot avec lignes au-dessus et en-dessous */}
                  <div className="relative flex w-2.5 shrink-0 justify-center self-stretch pt-2">
                    {/* Ligne AU-DESSUS du dot (sauf pour le premier point) */}
                    {!isFirst && (
                      <div className="absolute left-1/2 top-0 h-2 w-px -translate-x-1/2 bg-slate-300 dark:bg-slate-700" />
                    )}
                    {/* Le dot */}
                    <div className="relative z-10">
                      {point.type === "departure" && (
                        <div className="h-2.5 w-2.5 rounded-full border-2 border-[#FF9900] bg-white dark:bg-slate-950" />
                      )}
                      {point.type === "stopover" && (
                        <div className="h-2 w-2 rounded-full border border-slate-400 bg-white dark:bg-slate-950" />
                      )}
                      {point.type === "arrival" && (
                        <div className="h-2.5 w-2.5 rounded-full bg-[#FF9900]" />
                      )}
                    </div>
                    {/* Ligne EN DESSOUS du dot (sauf pour le dernier point) */}
                    {!isLast && (
                      <div className="absolute bottom-0 left-1/2 top-[18px] w-px -translate-x-1/2 bg-slate-300 dark:bg-slate-700" />
                    )}
                  </div>

                  {/* Nom + sublabel */}
                  <div className="min-w-0 flex-1">
                    <div
                      className={
                        point.type === "stopover"
                          ? "text-xs font-normal leading-tight text-slate-500 dark:text-slate-400"
                          : "text-base font-bold leading-tight text-slate-900 dark:text-white"
                      }
                    >
                      {point.label}
                      {point.cityCode && (
                        <span className="ml-1 text-sm font-normal text-slate-400 dark:text-slate-500">
                    {point.cityCode}
                  </span>
                      )}
                    </div>
                    {point.sublabel && (
                      <div className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                        {point.sublabel}
                      </div>
                    )}
                  </div>
                </div>

                {/* Connecteur entre 2 points */}
                {!isLast && (
                  <div className="flex items-center gap-x-4">
                    <div className="w-12 shrink-0 text-right">
                      {showDurationOnConnector && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {duration}
                        </span>
                      )}
                    </div>
                    <div className="flex w-2.5 shrink-0 justify-center">
                      <div className="h-8 w-px bg-slate-300 dark:bg-slate-700" />
                    </div>
                    <div className="flex-1" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pill détour voiture (uniquement si CAR avec DETOUR_BY_AGREEMENT) */}
      {hasCarDetour && (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">
          <Route size={11} />
          <span>{t("detourPossible")}</span>
        </div>
      )}

      {/* Tripper avec ligne horizontale au-dessus */}
      <Link
        href={`/u/${trip.tripper.publicSlug}`}
        className="-mx-5 mt-6 flex items-center gap-3 border-t border-slate-100 px-5 pt-5 pb-2 text-left transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900/50"
      >
        <div className="relative shrink-0">
          {trip.tripper.carrier?.isSuperCarrier && (
            <div className="absolute -inset-0.5 rounded-full bg-gradient-to-br from-[#FF9900] to-[#FFB84D]" />
          )}
          {trip.tripper.avatarUrl ? (
            <img
              src={trip.tripper.avatarUrl}
              alt={trip.tripper.firstName}
              className="relative h-12 w-12 rounded-full border-2 border-[#FF9900] object-cover"
            />
          ) : (
            <div className="relative grid h-12 w-12 place-items-center rounded-full border-2 border-[#FF9900] bg-orange-100 text-sm font-bold text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
              {getInitials(trip.tripper.firstName, trip.tripper.lastInitial)}
            </div>
          )}
          {trip.tripper.carrier?.isVerified && (
            <div className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full border-2 border-white bg-[#FF9900] text-slate-950 dark:border-slate-950">
              <CheckCircle2 size={9} strokeWidth={2.5} />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              {trip.tripper.firstName} {trip.tripper.lastInitial}.
            </span>
            {hasRating ? (
              <span className="inline-flex items-baseline gap-0.5 text-xs">
                <Star size={11} className="fill-[#FFB84D] text-[#FFB84D]" strokeWidth={0} />
                <span className="font-semibold text-slate-900 dark:text-white">
                  {trip.tripper.carrier!.ratingsAvg.toFixed(1).replace(".", locale === "fr" ? "," : ".")}
                </span>
                <span className="text-slate-400 dark:text-slate-500">
                  · {t("reviewsCount", { count: trip.tripper.carrier!.ratingsCount })}
                </span>
              </span>
            ) : (
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                {t("newTripper")}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            {memberSince && <span>{t("memberSince", { date: memberSince })}</span>}
            {trip.tripper.carrier?.isVerified && (
              <span className="inline-flex items-center gap-1">
                <ShieldCheck size={10} className="text-[#FF9900]" />
                {t("badges.profileVerified")}
              </span>
            )}
            {trip.tripper.carrier?.isSuperCarrier && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-1.5 py-0.5 font-semibold text-[#B45309] dark:bg-orange-500/15 dark:text-[#FFB84D]">
                {t("badges.superTripper")}
              </span>
            )}
            {trip.ticketVerified && (
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 size={10} className="text-blue-500" />
                {t("badges.verifiedTicket")}
              </span>
            )}
          </div>
        </div>

        <ChevronRight size={16} className="shrink-0 text-slate-400" />
      </Link>

      {/* Note du voyageur */}
      {trip.notes && trip.notes.trim().length > 0 && (
        <div className="mt-4 flex items-start gap-2">
          <Info size={13} className="mt-0.5 shrink-0 text-slate-400" />
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{trip.notes}</p>
        </div>
      )}

      {/* Factoid CO₂ */}
      {co2Saved != null && co2Saved > 0 && (
        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1.5 dark:bg-green-950/30">
          <Leaf size={11} className="shrink-0 text-green-600 dark:text-green-500" />
          <span className="text-[11px] text-slate-600 dark:text-slate-400">
            {t("co2.label")}{" "}
            <span className="font-semibold text-green-700 dark:text-green-400">
              {t("co2.saved", { kg: co2Saved.toFixed(1).replace(".", locale === "fr" ? "," : ".") })}
            </span>{" "}
            {t("co2.versus")}
          </span>
        </div>
      )}

      {/* CTA discuter */}
      <div className="mt-4">
        <div className="relative inline-block">
          <button
            type="button"
            disabled
            className="inline-flex cursor-not-allowed items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500"
          >
            <MessageCircle size={14} />
            {t("chatWith", { firstName: trip.tripper.firstName })}
          </button>
          <span className="absolute -right-1 -top-1.5 inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-900 dark:bg-amber-500/20 dark:text-amber-300">
            <Sparkles size={8} />
            {t("comingSoon")}
          </span>
        </div>
      </div>
    </section>
  );
}

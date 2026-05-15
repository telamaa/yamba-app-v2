"use client";

import { Eye, Star, Plane, Train, Car, MapPin, Flag } from "lucide-react";
import useUser from "@/hooks/useUser";
import type {
  CreateTripCopy,
  Draft,
  LocationFlexibility,
  LocationKind,
  ParcelCategory,
  TripLocationPoint,
} from "./create-trip.types";
import { getCategoryOptions } from "./create-trip.copy";

const MANGO = "#FF9900";
const TEAL = "#0F766E";

/* ── Public helpers (also used by StepReview) ─────── */

export function getLocationKindLabel(
  kind: LocationKind,
  copy: CreateTripCopy
): string {
  if (kind === "AIRPORT") return copy.atAirport;
  if (kind === "TRAIN_STATION") return copy.atTrainStation;
  return copy.inTheCity;
}

export function getLocationFlexibilityShortLabel(
  flexibility: LocationFlexibility,
  radiusKm: number | null,
  copy: CreateTripCopy
): string {
  if (flexibility === "EXACT") return copy.flexExact;
  if (flexibility === "CITY_WIDE") return copy.flexCityWide;
  if (flexibility === "RADIUS") {
    if (radiusKm === 5) return copy.flexRadius5;
    if (radiusKm === 10) return copy.flexRadius10;
    if (radiusKm === 15) return copy.flexRadius15;
    if (radiusKm === 20) return copy.flexRadius20;
  }
  return "";
}

/**
 * Inline summary: "CDG T2E hall départ (exact) ou Centre-ville Caen (rayon 10 km)"
 * Returns "—" if no enabled locations.
 * Uses location details if provided, falls back to the kind label.
 */
export function summarizeLocations(
  locations: TripLocationPoint[],
  copy: CreateTripCopy,
  isFr: boolean
): string {
  const enabled = locations.filter((l) => l.enabled);
  if (enabled.length === 0) return "—";
  const sep = isFr ? " ou " : " or ";
  return enabled
    .map((l) => {
      const main =
        l.details && l.details.trim().length > 0
          ? l.details.trim()
          : getLocationKindLabel(l.kind, copy);
      const flexLabel = getLocationFlexibilityShortLabel(
        l.flexibility,
        l.radiusKm,
        copy
      ).toLowerCase();
      return flexLabel ? `${main} (${flexLabel})` : main;
    })
    .join(sep);
}

/* ── Local helpers ────────────────────────────────── */

function formatPreviewDate(d: Date | undefined, isFr: boolean): string {
  if (!d) return "—";
  return d.toLocaleDateString(isFr ? "fr-FR" : "en-US", {
    day: "numeric",
    month: "short",
  });
}

function getTransportIcon(mode: Draft["transportMode"]) {
  if (mode === "plane") return Plane;
  if (mode === "train") return Train;
  if (mode === "car") return Car;
  return null;
}

function getTransportLabel(draft: Draft, copy: CreateTripCopy): string {
  const mode =
    draft.transportMode === "plane"
      ? copy.plane
      : draft.transportMode === "train"
        ? copy.train
        : draft.transportMode === "car"
          ? copy.car
          : "—";

  let sub = "";
  if (draft.transportMode === "plane" && draft.flightType) {
    sub = draft.flightType === "direct" ? copy.directFlight : copy.withLayover;
  } else if (draft.transportMode === "train" && draft.trainTripType) {
    sub = draft.trainTripType === "direct" ? copy.directTrain : copy.withConnection;
  } else if (draft.transportMode === "car" && draft.carTripFlexibility) {
    sub = draft.carTripFlexibility === "direct" ? copy.directTrip : copy.detourByAgreement;
  }

  return sub ? `${mode} · ${sub}` : mode;
}

function getCategoryDisplayPrice(
  catKey: ParcelCategory,
  draft: Draft
): string | null {
  const cond = draft.categoryConditions[catKey];
  if (cond && cond.priceAmount !== "" && Number(cond.priceAmount) > 0) {
    return `${cond.priceAmount}€`;
  }
  if (
    draft.useGlobalPrice &&
    draft.globalPrice !== "" &&
    Number(draft.globalPrice) > 0
  ) {
    return `${draft.globalPrice}€`;
  }
  return null;
}

function getInitials(name?: string | null): string {
  if (!name || name.trim().length === 0) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/* ── Component ───────────────────────────────────── */

export default function TripPublicPreview({
                                            draft,
                                            copy,
                                            isFr,
                                          }: {
  draft: Draft;
  copy: CreateTripCopy;
  isFr: boolean;
}) {
  const { user } = useUser();
  const carrierPage = (user as any)?.carrierPage as
    | {
    name?: string;
    ratingsAvg?: number;
    ratingsCount?: number;
    isVerified?: boolean;
  }
    | undefined;
  const avatarUrl = (user as any)?.avatar?.url as string | undefined;

  const TransportIcon = getTransportIcon(draft.transportMode);
  const categoryOptions = getCategoryOptions(isFr);

  const displayName =
    carrierPage?.name || (user as any)?.firstName || (isFr ? "Voyageur" : "Carrier");
  const initials = getInitials(displayName);

  const transportLabel = getTransportLabel(draft, copy);
  const dateLabel = formatPreviewDate(draft.departureDate, isFr);
  const hasRating = !!(carrierPage?.ratingsCount && carrierPage.ratingsCount > 0);
  const ratingText = hasRating
    ? `${(carrierPage!.ratingsAvg ?? 0).toFixed(1)} (${carrierPage!.ratingsCount})`
    : null;

  const route =
    draft.from && draft.to ? `${draft.from} → ${draft.to}` : "—";

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      {/* Hero */}
      <div
        className="flex h-10 items-center justify-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,153,0,0.14) 0%, rgba(15,118,110,0.14) 100%)",
        }}
      >
        <Eye size={12} />
        {copy.asSeenByShippers}
      </div>

      {/* Body */}
      <div className="p-4">
        {/* Row 1: avatar + route + meta */}
        <div className="flex items-start gap-3">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="h-9 w-9 flex-shrink-0 rounded-full object-cover"
            />
          ) : (
            <span
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-medium text-white"
              style={{ backgroundColor: MANGO }}
            >
              {initials}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-medium text-slate-900 dark:text-white">
              {route}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              {TransportIcon && (
                <TransportIcon size={11} className="text-slate-400" />
              )}
              <span>{transportLabel}</span>
              {dateLabel !== "—" && (
                <>
                  <span>·</span>
                  <span>{dateLabel}</span>
                </>
              )}
              {ratingText && (
                <>
                  <span>·</span>
                  <Star
                    size={11}
                    className="text-amber-500"
                    fill="currentColor"
                  />
                  <span>{ratingText}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: category pills with prices */}
        {draft.acceptedCategories.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {draft.acceptedCategories.map((catKey) => {
              const opt = categoryOptions.find((o) => o.key === catKey);
              if (!opt) return null;
              const price = getCategoryDisplayPrice(catKey, draft);
              return (
                <span
                  key={catKey}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{
                    backgroundColor: "rgba(15,118,110,0.1)",
                    color: TEAL,
                  }}
                >
                  {opt.label}
                  {price && <span>{price}</span>}
                </span>
              );
            })}
          </div>
        )}

        {/* Row 3: locations summary */}
        <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 dark:border-slate-800">
          <div className="flex items-start gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <MapPin
              size={12}
              className="mt-0.5 flex-shrink-0"
              style={{ color: MANGO }}
            />
            <span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {copy.pickupLocations} :
              </span>{" "}
              {summarizeLocations(draft.pickupLocations, copy, isFr)}
            </span>
          </div>
          <div className="flex items-start gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <Flag
              size={12}
              className="mt-0.5 flex-shrink-0"
              style={{ color: MANGO }}
            />
            <span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {copy.deliveryLocations} :
              </span>{" "}
              {summarizeLocations(draft.deliveryLocations, copy, isFr)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

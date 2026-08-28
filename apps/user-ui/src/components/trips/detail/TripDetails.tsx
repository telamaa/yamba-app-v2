"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowLeft, Plane, Train, Car, MapPin, Calendar, Tag, FileText,
  StickyNote, ExternalLink, Pencil, Pause, Zap, Copy, Archive, RotateCcw,
  XCircle, Trash2, AlertTriangle, Loader2, Package, Info, Building2,
  PackagePlus, PackageCheck,
} from "lucide-react";
import useUser from "@/hooks/useUser";
import { useTrip, usePauseTrip, useResumeTrip, useCancelTrip, useRestoreTrip } from "@/hooks/useTrip";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import { setFlashToast } from "@/lib/flash-toast";
import TripDocumentsManager from "@/components/trips/create/TripDocumentsManager";
import {
  STATUS_CONFIG, TRANSPORT_LABEL_KEYS, MANGO, TEAL, formatTripDate, isTripPastDeparture,
  type TripStatus, type TransportMode,
} from "../list/my-trips.config";

/**
 * ⭐ i18n : namespace "myTrips" (next-intl) — zéro ternaire isFr.
 * Convention §4.5 : pas de clés i18n dynamiques — tous les enums passent
 * par des maps statiques enum → clé, consommées via t(KEY_MAP[value]).
 */

type Translator = ReturnType<typeof useTranslations>;

/* ── Key maps (mapping statique enum → clé i18n) ── */

const CATEGORY_KEYS: Record<string, string> = {
  CLOTHES: "categories.CLOTHES",
  SHOES: "categories.SHOES",
  FASHION_ACCESSORIES: "categories.FASHION_ACCESSORIES",
  OTHER_ACCESSORIES: "categories.OTHER_ACCESSORIES",
  BOOKS: "categories.BOOKS",
  DOCUMENTS: "categories.DOCUMENTS",
  SMALL_TOYS: "categories.SMALL_TOYS",
  PHONE: "categories.PHONE",
  COMPUTER: "categories.COMPUTER",
  OTHER_ELECTRONICS: "categories.OTHER_ELECTRONICS",
  CHECKED_BAG_23KG: "categories.CHECKED_BAG_23KG",
  CABIN_BAG_12KG: "categories.CABIN_BAG_12KG",
};

function categoryLabel(t: Translator, category: string): string {
  const key = CATEGORY_KEYS[category];
  return key ? t(key) : category; // fallback brut pour valeur inconnue
}

const TRANSPORT_ICON: Record<string, React.ElementType> = { PLANE: Plane, TRAIN: Train, CAR: Car };

const TRIP_TYPE_KEYS: Record<string, string> = {
  ONE_WAY: "detail.tripTypes.ONE_WAY",
  ROUND_TRIP: "detail.tripTypes.ROUND_TRIP",
};
const FLIGHT_TYPE_KEYS: Record<string, string> = {
  DIRECT: "detail.flightTypes.DIRECT",
  WITH_LAYOVER: "detail.flightTypes.WITH_LAYOVER",
};
// ⚠️ WITH_INTERMEDIATE_STOPS supprimé — l'option n'existe plus dans le produit.
const TRAIN_TYPE_KEYS: Record<string, string> = {
  DIRECT: "detail.trainTypes.DIRECT",
  WITH_CONNECTION: "detail.trainTypes.WITH_CONNECTION",
};
const CAR_TYPE_KEYS: Record<string, string> = {
  DIRECT: "detail.carTypes.DIRECT",
  DETOUR_BY_AGREEMENT: "detail.carTypes.DETOUR_BY_AGREEMENT",
};
const TICKET_STATUS_META: Record<string, { labelKey: string; color: string }> = {
  NOT_SUBMITTED: { labelKey: "detail.ticketStatus.NOT_SUBMITTED", color: "#64748b" },
  PENDING: { labelKey: "detail.ticketStatus.PENDING", color: "#f59e0b" },
  VERIFIED: { labelKey: "detail.ticketStatus.VERIFIED", color: "#10b981" },
  REJECTED: { labelKey: "detail.ticketStatus.REJECTED", color: "#ef4444" },
};

/* ── Location labels & helpers ──────────── */

const LOCATION_KIND_KEYS: Record<string, string> = {
  AIRPORT: "detail.locationKinds.AIRPORT",
  TRAIN_STATION: "detail.locationKinds.TRAIN_STATION",
  CITY_AREA: "detail.locationKinds.CITY_AREA",
};

const LOCATION_KIND_ICON: Record<string, React.ElementType> = {
  AIRPORT: Plane,
  TRAIN_STATION: Train,
  CITY_AREA: Building2,
};

function getFlexibilityLabel(
  t: Translator,
  flexibility: string,
  radiusKm: number | null | undefined
): string {
  if (flexibility === "EXACT") return t("detail.flexibility.exact");
  if (flexibility === "CITY_WIDE") return t("detail.flexibility.cityWide");
  if (flexibility === "RADIUS" && radiusKm) {
    return t("detail.flexibility.radius", { km: radiusKm });
  }
  return "";
}

/* ── Inline mutations ─────────────────────── */

function useDeleteTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tripId: string) => { await apiClient.delete(`/trips/${tripId}`, { params: { hard: true }, requireAuth: true }); },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["my-trips"] }); },
  });
}
function useDuplicateTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tripId: string) => {
      const res = await apiClient.get(`/trips/${tripId}`, { requireAuth: true });
      const o = res.data.trip;
      await apiClient.post("/trips", {
        transportMode: o.transportMode, tripType: o.tripType,
        originLabel: o.originLabel, originPlaceId: o.originPlaceId, originCity: o.originCity, originRegion: o.originRegion, originCountry: o.originCountry, originLat: o.originLat, originLng: o.originLng,
        destinationLabel: o.destinationLabel, destinationPlaceId: o.destinationPlaceId, destinationCity: o.destinationCity, destinationRegion: o.destinationRegion, destinationCountry: o.destinationCountry, destinationLat: o.destinationLat, destinationLng: o.destinationLng,
        acceptedCategories: o.acceptedCategories, categoryConditions: o.categoryConditions,
        // ⭐ Locations dupliquées aussi
        pickupLocations: o.pickupLocations, deliveryLocations: o.deliveryLocations,
        handDeliveryOnly: o.handDeliveryOnly, instantBooking: o.instantBooking, currencyCode: o.currencyCode, notes: o.notes, publish: false,
      }, { requireAuth: true });
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["my-trips"] }); },
  });
}

function useActivateTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tripId: string) => {
      await apiClient.post(`/trips/${tripId}/publish`, {}, { requireAuth: true });
    },
    onSuccess: (_, tripId) => {
      void qc.invalidateQueries({ queryKey: ["my-trips"] });
      void qc.invalidateQueries({ queryKey: ["trip", tripId] });
    },
  });
}

function useRevertToDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tripId: string) => {
      await apiClient.post(`/trips/${tripId}/unpublish`, {}, { requireAuth: true });
    },
    onSuccess: (_, tripId) => {
      void qc.invalidateQueries({ queryKey: ["my-trips"] });
      void qc.invalidateQueries({ queryKey: ["trip", tripId] });
    },
  });
}

// Archive trip (COMPLETED/CANCELLED → ARCHIVED), one-way
function useArchiveTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tripId: string) => {
      await apiClient.post(`/trips/${tripId}/archive`, {}, { requireAuth: true });
    },
    onSuccess: (_, tripId) => {
      void qc.invalidateQueries({ queryKey: ["my-trips"] });
      void qc.invalidateQueries({ queryKey: ["trip", tripId] });
    },
  });
}

/* ── Reusable UI ──────────────────────────── */

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/50">
      <div className="mb-4 flex items-center gap-2 text-[13px] font-semibold text-slate-900 dark:text-white"><Icon size={16} className="text-slate-400" />{title}</div>
      {children}
    </div>
  );
}
function InfoRow({ label, value, sub }: { label: string; value: string | React.ReactNode; sub?: string }) {
  return (
    <div className="flex items-start justify-between py-2">
      <span className="text-[13px] text-slate-500 dark:text-slate-400">{label}</span>
      <div className="text-right"><span className="text-[13px] font-medium text-slate-900 dark:text-white">{value}</span>{sub && <div className="text-[11px] text-slate-400 dark:text-slate-500">{sub}</div>}</div>
    </div>
  );
}
function StatusBadge({ status }: { status: TripStatus }) {
  const t = useTranslations("myTrips");
  const c = STATUS_CONFIG[status]; if (!c) return null;
  return <span style={{ background: c.bg, color: c.text }} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold tracking-wide"><span style={{ background: c.dot }} className="h-2 w-2 rounded-full" />{t(c.labelKey)}</span>;
}
function ActionButton({ icon: Icon, label, onClick, variant = "default", loading = false, disabled = false }: {
  icon: React.ElementType; label: string; onClick: () => void; variant?: "default" | "primary" | "activate" | "danger"; loading?: boolean; disabled?: boolean;
}) {
  const base = "flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-medium transition-colors disabled:opacity-50";
  const styles = {
    default: `${base} border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800`,
    primary: `${base} text-slate-900`,
    activate: `${base} text-white`,
    danger: `${base} border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-500/10`,
  };
  const style = variant === "primary" ? { background: MANGO } : variant === "activate" ? { background: "#10b981" } : undefined;
  return <button type="button" onClick={onClick} disabled={disabled || loading} className={styles[variant]} style={style}>{loading ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}{label}</button>;
}
function ConfirmModal({ open, title, message, confirmLabel, isLoading, onConfirm, onCancel }: {
  open: boolean; title: string; message: string; confirmLabel: string; isLoading: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  const t = useTranslations("myTrips");
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} className="mx-4 w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900" style={{ animation: "scaleIn 0.2s ease" }}>
        <div className="p-6">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-500/10"><AlertTriangle size={20} /></div>
          <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white">{title}</h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">{message}</p>
        </div>
        <div className="flex gap-3 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
          <button type="button" onClick={onCancel} disabled={isLoading} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">{t("modals.goBack")}</button>
          <button type="button" onClick={onConfirm} disabled={isLoading} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50">{isLoading && <Loader2 size={14} className="animate-spin" />}{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/* ── Location row (single location card) ─── */

function LocationRow({
                       location,
                     }: {
  location: {
    kind: string;
    details?: string | null;
    flexibility: string;
    radiusKm?: number | null;
  };
}) {
  const t = useTranslations("myTrips");
  const KindIcon = LOCATION_KIND_ICON[location.kind] ?? MapPin;
  const kindKey = LOCATION_KIND_KEYS[location.kind];
  const kindLabel = kindKey ? t(kindKey) : location.kind;
  const flexLabel = getFlexibilityLabel(t, location.flexibility, location.radiusKm);

  return (
    <div className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
      <div className="flex items-start gap-2.5">
        <KindIcon size={14} className="mt-0.5 flex-shrink-0 text-[#FF9900]" />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-slate-900 dark:text-white">
            {kindLabel}
          </div>
          {location.details && (
            <div className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
              {location.details}
            </div>
          )}
          {flexLabel && (
            <div
              className="mt-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: "rgba(15,118,110,0.1)", color: TEAL }}
            >
              {flexLabel}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════ */

export default function TripDetails({ tripId }: { tripId: string }) {
  const t = useTranslations("myTrips");
  const locale = useLocale();
  const router = useRouter();
  const toastOpts = { duration: 6000, closeButton: true };

  const { user } = useUser();
  const { data: trip, isLoading, isError, refetch } = useTrip(tripId);

  const pauseTrip = usePauseTrip();
  const resumeTrip = useResumeTrip();
  const cancelTrip = useCancelTrip();
  const restoreTrip = useRestoreTrip();
  const deleteTrip = useDeleteTrip();
  const duplicateTrip = useDuplicateTrip();
  const activateTrip = useActivateTrip();
  const revertToDraftMut = useRevertToDraft();
  const archiveTrip = useArchiveTrip();

  const [modal, setModal] = useState<"cancel" | "delete" | "revertToDraft" | null>(null);

  /* ── Onboarding + Stripe status ── */
  const carrierPage = (user as any)?.carrierPage;
  const hasOnboarding = carrierPage?.onboardingStep === "STRIPE" || carrierPage?.onboardingStep === "COMPLETE";
  const stripeReady = carrierPage?.stripeOnboardingComplete && carrierPage?.stripeChargesEnabled;

  const ok = useCallback((msg: string) => toast.success(msg, toastOpts), []);
  const ko = useCallback(() => toast.error(t("toasts.error"), toastOpts), [t]);

  /* ── Activate handler with gates ── */
  const handleActivate = useCallback(() => {
    if (!hasOnboarding) {
      toast.info(t("gates.onboardingToast"), {
        id: "onboarding-required",
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
        id: "stripe-required",
        duration: Infinity,
        closeButton: true,
        action: {
          label: t("gates.stripeCta"),
          onClick: () => router.push("/carrier/onboarding?step=stripe"),
        },
      });
      return;
    }
    if (trip?.status === "DRAFT") {
      activateTrip.mutate(tripId, {
        onSuccess: () => ok(t("toasts.activated")),
        onError: (err: any) => {
          const message = err?.response?.data?.message || t("toasts.activationFailed");
          toast.error(message, toastOpts);
        },
      });
    } else if (trip?.status === "PAUSED") {
      resumeTrip.mutate(tripId, {
        onSuccess: () => ok(t("toasts.resumed")),
        onError: ko,
      });
    }
  }, [hasOnboarding, stripeReady, t, router, trip?.status, tripId, activateTrip, resumeTrip, ok, ko]);

  const handleConfirm = useCallback(() => {
    if (modal === "delete") {
      deleteTrip.mutate(tripId, {
        onSuccess: () => {
          setFlashToast({ type: "success", message: t("toasts.deletedRedirect") });
          router.push("/dashboard/trips");
        },
        onError: ko,
      });
    } else if (modal === "cancel") {
      cancelTrip.mutate(tripId, {
        onSuccess: () => { toast.success(t("toasts.cancelled"), toastOpts); setModal(null); },
        onError: ko,
      });
    } else if (modal === "revertToDraft") {
      revertToDraftMut.mutate(tripId, {
        onSuccess: () => { toast.success(t("toasts.reverted"), toastOpts); setModal(null); },
        onError: ko,
      });
    }
  }, [modal, tripId, t, deleteTrip, cancelTrip, revertToDraftMut, router, ko]);

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-slate-400" /></div>;
  if (isError || !trip) return (
    <div className="py-20 text-center">
      <p className="text-[14px] text-slate-500 dark:text-slate-400">{t("detail.errorTitle")}</p>
      <button type="button" onClick={() => refetch()} className="mt-3 text-[13px] font-medium" style={{ color: MANGO }}>{t("list.retry")}</button>
    </div>
  );

  const status = trip.status as TripStatus;
  const transport = trip.transportMode as TransportMode | null;
  const TransportIcon = transport ? TRANSPORT_ICON[transport] : null;
  const pastDeparture = isTripPastDeparture(trip.departureDateLocal);
  const originCity = trip.originCity ?? trip.originLabel ?? "—";
  const destCity = trip.destinationCity ?? trip.destinationLabel ?? "—";
  const categories: any[] = trip.categoryConditions ?? [];
  const documents: any[] = trip.documents ?? [];
  const pickupLocations: any[] = trip.pickupLocations ?? [];
  const deliveryLocations: any[] = trip.deliveryLocations ?? [];
  const hasLocations = pickupLocations.length > 0 || deliveryLocations.length > 0;

  const canEditDocuments = !["CANCELLED", "COMPLETED", "ARCHIVED"].includes(status);

  const getSubTypeKey = (): string | null => {
    if (transport === "PLANE" && trip.flightType) return FLIGHT_TYPE_KEYS[trip.flightType] ?? null;
    if (transport === "TRAIN" && trip.trainTripType) return TRAIN_TYPE_KEYS[trip.trainTripType] ?? null;
    if (transport === "CAR" && trip.carTripFlexibility) return CAR_TYPE_KEYS[trip.carTripFlexibility] ?? null;
    return null;
  };
  const subTypeKey = getSubTypeKey();

  const modalConfig = modal ? (() => {
    if (modal === "delete") return {
      title: t("modals.deleteTitle"),
      message: t("modals.deleteMessage", { from: originCity, to: destCity }),
      confirmLabel: t("modals.deleteConfirm"),
    };
    if (modal === "cancel") return {
      title: t("modals.cancelTitle"),
      message: t("modals.cancelMessage", { from: originCity, to: destCity }),
      confirmLabel: t("modals.cancelConfirm"),
    };
    return {
      title: t("modals.revertTitle"),
      message: t("modals.revertMessage", { from: originCity, to: destCity }),
      confirmLabel: t("modals.revertConfirm"),
    };
  })() : null;

  const isConfirming = deleteTrip.isPending || cancelTrip.isPending || revertToDraftMut.isPending;

  const ticketMeta = trip.ticketVerificationStatus
    ? TICKET_STATUS_META[trip.ticketVerificationStatus]
    : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <button type="button" onClick={() => router.push("/dashboard/trips")} className="mb-4 flex items-center gap-1.5 text-[13px] text-slate-500 transition-colors hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"><ArrowLeft size={16} />{t("detail.back")}</button>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-[22px] font-semibold tracking-tight text-slate-900 dark:text-white">{originCity} <span className="text-slate-300 dark:text-slate-600">→</span> {destCity}</h1>
        <StatusBadge status={status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* LEFT */}
        <div className="flex flex-col gap-5">
          <Section icon={MapPin} title={t("detail.route")}>
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center gap-1"><div className="h-3 w-3 rounded-full border-2" style={{ borderColor: MANGO }} /><div className="h-8 w-px bg-slate-200 dark:bg-slate-700" /><div className="h-3 w-3 rounded-full" style={{ background: TEAL }} /></div>
              <div className="flex-1 space-y-3">
                <div><div className="text-[14px] font-medium text-slate-900 dark:text-white">{trip.originLabel ?? originCity}</div>{trip.originRegion && <div className="text-[12px] text-slate-400">{[trip.originRegion, trip.originCountry].filter(Boolean).join(", ")}</div>}</div>
                <div><div className="text-[14px] font-medium text-slate-900 dark:text-white">{trip.destinationLabel ?? destCity}</div>{trip.destinationRegion && <div className="text-[12px] text-slate-400">{[trip.destinationRegion, trip.destinationCountry].filter(Boolean).join(", ")}</div>}</div>
              </div>
            </div>
            {trip.tripType && <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800"><InfoRow label={t("detail.type")} value={TRIP_TYPE_KEYS[trip.tripType] ? t(TRIP_TYPE_KEYS[trip.tripType]) : trip.tripType} /></div>}
          </Section>

          <Section icon={Calendar} title={t("detail.datesTitle")}>
            <div className="space-y-0 divide-y divide-slate-100 dark:divide-slate-800">
              <InfoRow label={t("detail.departure")} value={formatTripDate(trip.departureDateLocal, locale)} sub={trip.departureTimeLocal ?? undefined} />
              <InfoRow label={t("detail.arrival")} value={formatTripDate(trip.arrivalDateLocal, locale)} sub={trip.arrivalTimeLocal ?? undefined} />
            </div>
          </Section>

          <Section icon={transport === "PLANE" ? Plane : transport === "TRAIN" ? Train : Car} title={t("detail.transportTitle")}>
            <div className="space-y-0 divide-y divide-slate-100 dark:divide-slate-800">
              <InfoRow label={t("detail.mode")} value={<span className="flex items-center gap-1.5">{TransportIcon && <TransportIcon size={14} className="text-slate-400" />}{transport ? t(TRANSPORT_LABEL_KEYS[transport]) : "—"}</span>} />
              {subTypeKey && <InfoRow label={t("detail.tripTypeLabel")} value={t(subTypeKey)} />}
              {trip.flightLayoverCities?.length > 0 && <InfoRow label={t("detail.layovers")} value={trip.flightLayoverCities.join(", ")} />}
              {trip.trainStopCities?.length > 0 && <InfoRow label={t("detail.stops")} value={trip.trainStopCities.join(", ")} />}
              {trip.travelReference && <InfoRow label={t("detail.reference")} value={trip.travelReference} />}
            </div>
          </Section>

          {(categories.length > 0 || (typeof trip.pricePerKgCents === "number" && trip.pricePerKgCents > 0)) && (
            <Section icon={Tag} title={t("detail.pricingTitle")}>
              <div className="space-y-2">
                {typeof trip.pricePerKgCents === "number" && trip.pricePerKgCents > 0 && (
                  <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5 dark:border-slate-800">
                    <span className="text-[13px] font-medium text-slate-900 dark:text-white">
                      €/kg{typeof trip.capacityKg === "number" ? ` · ${trip.capacityKg} kg` : ""}
                    </span>
                    <span className="text-[13px] font-semibold" style={{ color: MANGO }}>
                      {(trip.pricePerKgCents / 100).toFixed(2)} €/kg
                    </span>
                  </div>
                )}
                {categories.map((c: any, i: number) => {
                  const price = typeof c.priceAmountCents === "number" ? (c.priceAmountCents / 100).toFixed(2) : "—";
                  return (
                    <div key={i} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5 dark:border-slate-800">
                      <span className="text-[13px] font-medium text-slate-900 dark:text-white">{categoryLabel(t, c.category)}</span>
                      <span className="text-[13px] font-semibold" style={{ color: MANGO }}>{price} €</span>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Lieux de remise & livraison */}
          {hasLocations && (
            <Section icon={MapPin} title={t("detail.locationsTitle")}>
              <div className="space-y-5">
                {pickupLocations.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center gap-1.5">
                      <PackagePlus size={12} className="text-[#FF9900]" />
                      <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                        {t("detail.pickup")}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      {pickupLocations.map((loc: any, i: number) => (
                        <LocationRow key={`pickup-${i}`} location={loc} />
                      ))}
                    </div>
                  </div>
                )}

                {deliveryLocations.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center gap-1.5">
                      <PackageCheck size={12} className="text-[#FF9900]" />
                      <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                        {t("detail.delivery")}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      {deliveryLocations.map((loc: any, i: number) => (
                        <LocationRow key={`delivery-${i}`} location={loc} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Section>
          )}

          <Section icon={FileText} title={t("detail.documentsTitle")}>
            <TripDocumentsManager
              tripId={tripId}
              documents={documents}
              isFr={locale === "fr"}
              maxDocuments={5}
              canEdit={canEditDocuments}
            />
          </Section>

          {trip.notes && <Section icon={StickyNote} title={t("detail.notesTitle")}><p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">{trip.notes}</p></Section>}
        </div>

        {/* RIGHT */}
        <div className="flex flex-col gap-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="mb-4 text-[13px] font-semibold text-slate-900 dark:text-white">{t("detail.actionsTitle")}</div>
            <div className="flex flex-col gap-2">
              {status === "DRAFT" && !pastDeparture && (
                <ActionButton icon={Zap} label={t("actionsMenu.activate")} variant="activate" loading={activateTrip.isPending} onClick={handleActivate} />
              )}
              {status === "PAUSED" && !pastDeparture && (
                <ActionButton icon={Zap} label={t("actionsMenu.resume")} variant="activate" loading={resumeTrip.isPending} onClick={handleActivate} />
              )}
              {status === "PUBLISHED" && (
                <ActionButton icon={Pause} label={t("actionsMenu.pause")} loading={pauseTrip.isPending} onClick={() => pauseTrip.mutate(tripId, { onSuccess: () => ok(t("toasts.paused")), onError: ko })} />
              )}
              {["PUBLISHED", "PAUSED"].includes(status) && (
                <ActionButton icon={FileText} label={t("actionsMenu.revertToDraft")} onClick={() => setModal("revertToDraft")} />
              )}
              {["DRAFT", "PUBLISHED", "PAUSED"].includes(status) && (
                <ActionButton icon={Pencil} label={t("actionsMenu.edit")} variant="primary" onClick={() => router.push(`/trips/create?edit=${tripId}`)} />
              )}
              <ActionButton icon={Copy} label={t("actionsMenu.duplicate")} loading={duplicateTrip.isPending} onClick={() => duplicateTrip.mutate(tripId, { onSuccess: () => { setFlashToast({ type: "success", message: t("toasts.duplicated") }); router.push("/dashboard/trips"); }, onError: ko })} />
              {status === "CANCELLED" && !pastDeparture && (
                <ActionButton icon={RotateCcw} label={t("actionsMenu.restoreDraft")} loading={restoreTrip.isPending} onClick={() => restoreTrip.mutate(tripId, { onSuccess: () => ok(t("toasts.restored")), onError: ko })} />
              )}
              {["COMPLETED", "CANCELLED"].includes(status) && (
                <ActionButton icon={Archive} label={t("actionsMenu.archive")} loading={archiveTrip.isPending} onClick={() => archiveTrip.mutate(tripId, { onSuccess: () => ok(t("toasts.archived")), onError: ko })} />
              )}
              {["PUBLISHED", "PAUSED"].includes(status) && (
                <ActionButton icon={XCircle} label={t("actionsMenu.cancelTrip")} variant="danger" onClick={() => setModal("cancel")} />
              )}
              {status === "DRAFT" && (
                <ActionButton icon={Trash2} label={t("actionsMenu.deleteDraft")} variant="danger" onClick={() => setModal("delete")} />
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-slate-900 dark:text-white"><Package size={16} className="text-slate-400" />{t("detail.requestsTitle")}</div>
            <div className="flex flex-col items-center py-6 text-center"><Package size={28} className="text-slate-300 dark:text-slate-600" /><p className="mt-2 text-[13px] text-slate-400 dark:text-slate-500">{t("detail.requestsEmpty")}</p></div>
          </div>

          {["PUBLISHED", "PAUSED", "COMPLETED"].includes(status) && (
            <button type="button" onClick={() => window.open(`/trips/${tripId}`, "_blank")} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13px] text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300 dark:hover:bg-slate-800"><ExternalLink size={14} />{t("detail.viewAsShipper")}</button>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="mb-3 text-[13px] font-semibold text-slate-900 dark:text-white">{t("detail.optionsTitle")}</div>
            <div className="space-y-0 divide-y divide-slate-100 dark:divide-slate-800">
              <InfoRow label={t("detail.handDelivery")} value={<span style={{ color: trip.handDeliveryOnly ? "#10b981" : "#64748b" }}>{trip.handDeliveryOnly ? t("detail.yes") : t("detail.no")}</span>} />
              <InfoRow label={t("detail.instantBooking")} value={<span style={{ color: trip.instantBooking ? "#10b981" : "#64748b" }}>{trip.instantBooking ? t("detail.yes") : t("detail.no")}</span>} />
              {ticketMeta && <InfoRow label={t("detail.ticketVerified")} value={<span style={{ color: ticketMeta.color }}>{t(ticketMeta.labelKey)}</span>} />}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-slate-900 dark:text-white"><Info size={16} className="text-slate-400" />{t("detail.infoTitle")}</div>
            <div className="space-y-0 divide-y divide-slate-100 text-[12px] dark:divide-slate-800">
              <InfoRow label={t("detail.createdAt")} value={formatTripDate(trip.createdAt?.slice(0, 10), locale)} />
              {trip.publishedAt && <InfoRow label={t("detail.publishedAt")} value={formatTripDate(trip.publishedAt.slice(0, 10), locale)} />}
              {trip.cancelledAt && <InfoRow label={t("detail.cancelledAt")} value={formatTripDate(trip.cancelledAt.slice(0, 10), locale)} />}
              <InfoRow label="ID" value={<span className="font-mono text-[11px] text-slate-400">{tripId.slice(-8)}</span>} />
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal open={!!modal}
                    title={modalConfig?.title ?? ""}
                    message={modalConfig?.message ?? ""}
                    confirmLabel={modalConfig?.confirmLabel ?? ""}
                    isLoading={isConfirming} onConfirm={handleConfirm} onCancel={() => setModal(null)} />

      <style jsx global>{`@keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
    </div>
  );
}

"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft, Plane, Train, Car, MapPin, Calendar, Tag, FileText,
  StickyNote, ExternalLink, Pencil, Pause, Zap, Copy, Archive, RotateCcw,
  XCircle, Trash2, AlertTriangle, Loader2, Package, Info,
} from "lucide-react";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";
import useUser from "@/hooks/useUser";
import { useTrip, usePauseTrip, useResumeTrip, useCancelTrip, useRestoreTrip } from "@/hooks/useTrip";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import { setFlashToast } from "@/lib/flash-toast";
import TripDocumentsManager from "@/components/trips/create/TripDocumentsManager";
import {
  STATUS_CONFIG, TRANSPORT_LABELS, MANGO, TEAL, formatTripDate, isTripPastDeparture,
  type TripStatus, type TransportMode,
} from "../list/my-trips.config";

/* ── Label maps ───────────────────────────── */

const CATEGORY_LABELS: Record<string, { fr: string; en: string }> = {
  CLOTHES: { fr: "Vêtements", en: "Clothes" }, SHOES: { fr: "Chaussures", en: "Shoes" },
  FASHION_ACCESSORIES: { fr: "Accessoires mode", en: "Fashion accessories" },
  OTHER_ACCESSORIES: { fr: "Autres accessoires", en: "Other accessories" },
  BOOKS: { fr: "Livres", en: "Books" }, DOCUMENTS: { fr: "Documents", en: "Documents" },
  SMALL_TOYS: { fr: "Petits jouets", en: "Small toys" }, PHONE: { fr: "Téléphone", en: "Phone" },
  COMPUTER: { fr: "Ordinateur", en: "Computer" }, OTHER_ELECTRONICS: { fr: "Autres électroniques", en: "Other electronics" },
  CHECKED_BAG_23KG: { fr: "Bagage soute 23kg", en: "Checked bag 23kg" },
  CABIN_BAG_12KG: { fr: "Bagage cabine 12kg", en: "Cabin bag 12kg" },
};
const HANDOFF_LABELS: Record<string, { fr: string; en: string }> = {
  BEFORE_DEPARTURE: { fr: "Avant le départ", en: "Before departure" }, AT_DEPARTURE: { fr: "Au départ", en: "At departure" },
};
const PICKUP_LABELS: Record<string, { fr: string; en: string }> = {
  ON_ARRIVAL: { fr: "À l'arrivée", en: "On arrival" }, LATER_AT_ADDRESS: { fr: "Plus tard à une adresse", en: "Later at address" },
};
const TRANSPORT_ICON: Record<string, React.ElementType> = { PLANE: Plane, TRAIN: Train, CAR: Car };
const TRIP_TYPE_LABELS: Record<string, { fr: string; en: string }> = {
  ONE_WAY: { fr: "Aller simple", en: "One way" }, ROUND_TRIP: { fr: "Aller-retour", en: "Round trip" },
};
const FLIGHT_TYPE_LABELS: Record<string, { fr: string; en: string }> = {
  DIRECT: { fr: "Vol direct", en: "Direct flight" }, WITH_LAYOVER: { fr: "Avec escale", en: "With layover" },
};
const TRAIN_TYPE_LABELS: Record<string, { fr: string; en: string }> = {
  DIRECT: { fr: "Direct", en: "Direct" }, WITH_CONNECTION: { fr: "Avec correspondance", en: "With connection" },
  WITH_INTERMEDIATE_STOPS: { fr: "Avec arrêts intermédiaires", en: "With intermediate stops" },
};
const CAR_TYPE_LABELS: Record<string, { fr: string; en: string }> = {
  DIRECT: { fr: "Trajet direct", en: "Direct trip" }, DETOUR_BY_AGREEMENT: { fr: "Détour possible", en: "Detour by agreement" },
};
const TICKET_STATUS_LABELS: Record<string, { fr: string; en: string; color: string }> = {
  NOT_SUBMITTED: { fr: "Non soumis", en: "Not submitted", color: "#64748b" },
  PENDING: { fr: "En vérification", en: "Pending", color: "#f59e0b" },
  VERIFIED: { fr: "Vérifié", en: "Verified", color: "#10b981" },
  REJECTED: { fr: "Rejeté", en: "Rejected", color: "#ef4444" },
};

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
        acceptedCategories: o.acceptedCategories, categoryConditions: o.categoryConditions, handDeliveryOnly: o.handDeliveryOnly, instantBooking: o.instantBooking, currencyCode: o.currencyCode, notes: o.notes, publish: false,
      }, { requireAuth: true });
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["my-trips"] }); },
  });
}

// NEW: Activate trip (DRAFT → PUBLISHED)
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

// NEW: Revert to draft (PUBLISHED/PAUSED → DRAFT)
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
function StatusBadge({ status, isFr }: { status: TripStatus; isFr: boolean }) {
  const c = STATUS_CONFIG[status]; if (!c) return null;
  return <span style={{ background: c.bg, color: c.text }} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold tracking-wide"><span style={{ background: c.dot }} className="h-2 w-2 rounded-full" />{isFr ? c.labelFr : c.labelEn}</span>;
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
function ConfirmModal({ open, title, message, confirmLabel, isLoading, onConfirm, onCancel, isFr }: {
  open: boolean; title: string; message: string; confirmLabel: string; isLoading: boolean; onConfirm: () => void; onCancel: () => void; isFr: boolean;
}) {
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
          <button type="button" onClick={onCancel} disabled={isLoading} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">{isFr ? "Retour" : "Go back"}</button>
          <button type="button" onClick={onConfirm} disabled={isLoading} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50">{isLoading && <Loader2 size={14} className="animate-spin" />}{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════ */

export default function TripDetails({ tripId }: { tripId: string }) {
  const { lang } = useUiPreferences();
  const router = useRouter();
  const isFr = lang === "fr";
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

  const [modal, setModal] = useState<"cancel" | "delete" | "revertToDraft" | null>(null);

  /* ── Onboarding + Stripe status ── */
  const carrierPage = (user as any)?.carrierPage;
  const hasOnboarding = carrierPage?.onboardingStep === "STRIPE" || carrierPage?.onboardingStep === "COMPLETE";
  const stripeReady = carrierPage?.stripeOnboardingComplete && carrierPage?.stripeChargesEnabled;

  const ok = useCallback((msg: string) => toast.success(msg, toastOpts), []);
  const ko = useCallback(() => toast.error(isFr ? "Erreur" : "Error", toastOpts), [isFr]);

  /* ── Activate handler with gates ── */
  const handleActivate = useCallback(() => {
    if (!hasOnboarding) {
      toast.info(
        isFr ? "Complétez votre profil transporteur pour activer ce trajet" : "Complete your carrier profile to activate this trip",
        {
          id: "onboarding-required",
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
        isFr ? "Configurez Stripe pour activer ce trajet et recevoir des paiements" : "Configure Stripe to activate this trip and receive payments",
        {
          id: "stripe-required",
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
    // All good — activate
    if (trip?.status === "DRAFT") {
      activateTrip.mutate(tripId, {
        onSuccess: () => ok(isFr ? "Trajet activé" : "Trip activated"),
        onError: (err: any) => {
          const message = err?.response?.data?.message || (isFr ? "Erreur lors de l'activation" : "Failed to activate");
          toast.error(message, toastOpts);
        },
      });
    } else if (trip?.status === "PAUSED") {
      resumeTrip.mutate(tripId, {
        onSuccess: () => ok(isFr ? "Trajet republié" : "Trip resumed"),
        onError: ko,
      });
    }
  }, [hasOnboarding, stripeReady, isFr, router, trip?.status, tripId, activateTrip, resumeTrip, ok, ko]);

  const handleConfirm = useCallback(() => {
    if (modal === "delete") {
      deleteTrip.mutate(tripId, {
        onSuccess: () => {
          setFlashToast({ type: "success", message: isFr ? "Brouillon supprimé avec succès" : "Draft deleted successfully" });
          router.push("/dashboard/trips");
        },
        onError: ko,
      });
    } else if (modal === "cancel") {
      cancelTrip.mutate(tripId, {
        onSuccess: () => { toast.success(isFr ? "Trajet annulé" : "Trip cancelled", toastOpts); setModal(null); },
        onError: ko,
      });
    } else if (modal === "revertToDraft") {
      revertToDraftMut.mutate(tripId, {
        onSuccess: () => { toast.success(isFr ? "Trajet repassé en brouillon" : "Trip reverted to draft", toastOpts); setModal(null); },
        onError: ko,
      });
    }
  }, [modal, tripId, isFr, deleteTrip, cancelTrip, revertToDraftMut, router, ko]);

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-slate-400" /></div>;
  if (isError || !trip) return (
    <div className="py-20 text-center">
      <p className="text-[14px] text-slate-500 dark:text-slate-400">{isFr ? "Impossible de charger ce trajet." : "Unable to load this trip."}</p>
      <button type="button" onClick={() => refetch()} className="mt-3 text-[13px] font-medium" style={{ color: MANGO }}>{isFr ? "Réessayer" : "Retry"}</button>
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

  // Can edit documents only if trip is in an editable state
  const canEditDocuments = !["CANCELLED", "COMPLETED", "ARCHIVED"].includes(status);

  const getSubType = () => {
    if (transport === "PLANE" && trip.flightType) return FLIGHT_TYPE_LABELS[trip.flightType];
    if (transport === "TRAIN" && trip.trainTripType) return TRAIN_TYPE_LABELS[trip.trainTripType];
    if (transport === "CAR" && trip.carTripFlexibility) return CAR_TYPE_LABELS[trip.carTripFlexibility];
    return null;
  };
  const subType = getSubType();

  // Modal config
  const modalConfig = modal ? (() => {
    if (modal === "delete") return {
      title: isFr ? "Supprimer ce brouillon ?" : "Delete this draft?",
      message: isFr ? `Le brouillon "${originCity} → ${destCity}" sera définitivement supprimé.` : `The draft "${originCity} → ${destCity}" will be permanently deleted.`,
      confirmLabel: isFr ? "Supprimer" : "Delete",
    };
    if (modal === "cancel") return {
      title: isFr ? "Annuler ce trajet ?" : "Cancel this trip?",
      message: isFr ? `Le trajet "${originCity} → ${destCity}" sera annulé.` : `The trip "${originCity} → ${destCity}" will be cancelled.`,
      confirmLabel: isFr ? "Annuler le trajet" : "Cancel trip",
    };
    return {
      title: isFr ? "Repasser en brouillon ?" : "Revert to draft?",
      message: isFr ? `Le trajet "${originCity} → ${destCity}" sera repassé en brouillon. Vous pourrez le réactiver à tout moment.` : `The trip "${originCity} → ${destCity}" will be reverted to draft. You can reactivate it anytime.`,
      confirmLabel: isFr ? "Repasser en brouillon" : "Revert to draft",
    };
  })() : null;

  const isConfirming = deleteTrip.isPending || cancelTrip.isPending || revertToDraftMut.isPending;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <button type="button" onClick={() => router.push("/dashboard/trips")} className="mb-4 flex items-center gap-1.5 text-[13px] text-slate-500 transition-colors hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"><ArrowLeft size={16} />{isFr ? "Mes trajets" : "My trips"}</button>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-[22px] font-semibold tracking-tight text-slate-900 dark:text-white">{originCity} <span className="text-slate-300 dark:text-slate-600">→</span> {destCity}</h1>
        <StatusBadge status={status} isFr={isFr} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* LEFT */}
        <div className="flex flex-col gap-5">
          <Section icon={MapPin} title={isFr ? "Itinéraire" : "Route"}>
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center gap-1"><div className="h-3 w-3 rounded-full border-2" style={{ borderColor: MANGO }} /><div className="h-8 w-px bg-slate-200 dark:bg-slate-700" /><div className="h-3 w-3 rounded-full" style={{ background: TEAL }} /></div>
              <div className="flex-1 space-y-3">
                <div><div className="text-[14px] font-medium text-slate-900 dark:text-white">{trip.originLabel ?? originCity}</div>{trip.originRegion && <div className="text-[12px] text-slate-400">{[trip.originRegion, trip.originCountry].filter(Boolean).join(", ")}</div>}</div>
                <div><div className="text-[14px] font-medium text-slate-900 dark:text-white">{trip.destinationLabel ?? destCity}</div>{trip.destinationRegion && <div className="text-[12px] text-slate-400">{[trip.destinationRegion, trip.destinationCountry].filter(Boolean).join(", ")}</div>}</div>
              </div>
            </div>
            {trip.tripType && <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800"><InfoRow label="Type" value={TRIP_TYPE_LABELS[trip.tripType] ? (isFr ? TRIP_TYPE_LABELS[trip.tripType].fr : TRIP_TYPE_LABELS[trip.tripType].en) : trip.tripType} /></div>}
          </Section>

          <Section icon={Calendar} title={isFr ? "Dates & horaires" : "Dates & times"}>
            <div className="space-y-0 divide-y divide-slate-100 dark:divide-slate-800">
              <InfoRow label={isFr ? "Départ" : "Departure"} value={formatTripDate(trip.departureDateLocal, isFr)} sub={trip.departureTimeLocal ?? undefined} />
              <InfoRow label={isFr ? "Arrivée" : "Arrival"} value={formatTripDate(trip.arrivalDateLocal, isFr)} sub={trip.arrivalTimeLocal ?? undefined} />
            </div>
          </Section>

          <Section icon={transport === "PLANE" ? Plane : transport === "TRAIN" ? Train : Car} title="Transport">
            <div className="space-y-0 divide-y divide-slate-100 dark:divide-slate-800">
              <InfoRow label={isFr ? "Mode" : "Mode"} value={<span className="flex items-center gap-1.5">{TransportIcon && <TransportIcon size={14} className="text-slate-400" />}{transport ? (isFr ? TRANSPORT_LABELS[transport].fr : TRANSPORT_LABELS[transport].en) : "—"}</span>} />
              {subType && <InfoRow label={isFr ? "Type de trajet" : "Trip type"} value={isFr ? subType.fr : subType.en} />}
              {trip.flightLayoverCities?.length > 0 && <InfoRow label={isFr ? "Escale(s)" : "Layover(s)"} value={trip.flightLayoverCities.join(", ")} />}
              {trip.trainStopCities?.length > 0 && <InfoRow label={isFr ? "Arrêt(s)" : "Stop(s)"} value={trip.trainStopCities.join(", ")} />}
              {trip.travelReference && <InfoRow label={isFr ? "Référence" : "Reference"} value={trip.travelReference} />}
            </div>
          </Section>

          {categories.length > 0 && (
            <Section icon={Tag} title={isFr ? "Catégories & tarifs" : "Categories & pricing"}>
              <div className="space-y-3">
                {categories.map((c: any, i: number) => {
                  const catLabel = CATEGORY_LABELS[c.category] ?? { fr: c.category, en: c.category };
                  const price = typeof c.priceAmountCents === "number" ? (c.priceAmountCents / 100).toFixed(2) : "—";
                  return (
                    <div key={i} className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                      <div className="flex items-center justify-between"><span className="text-[13px] font-medium text-slate-900 dark:text-white">{isFr ? catLabel.fr : catLabel.en}</span><span className="text-[13px] font-semibold" style={{ color: MANGO }}>{price} €</span></div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(c.handoffMoments ?? []).map((m: string) => <span key={m} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">{HANDOFF_LABELS[m] ? (isFr ? HANDOFF_LABELS[m].fr : HANDOFF_LABELS[m].en) : m}</span>)}
                        {(c.pickupMoments ?? []).map((m: string) => <span key={m} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">{PICKUP_LABELS[m] ? (isFr ? PICKUP_LABELS[m].fr : PICKUP_LABELS[m].en) : m}</span>)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Documents — always show so carrier can add/remove from detail page */}
          <Section icon={FileText} title={isFr ? "Documents" : "Documents"}>
            <TripDocumentsManager
              tripId={tripId}
              documents={documents}
              isFr={isFr}
              maxDocuments={5}
              canEdit={canEditDocuments}
            />
          </Section>

          {trip.notes && <Section icon={StickyNote} title="Notes"><p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">{trip.notes}</p></Section>}
        </div>

        {/* RIGHT */}
        <div className="flex flex-col gap-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="mb-4 text-[13px] font-semibold text-slate-900 dark:text-white">Actions</div>
            <div className="flex flex-col gap-2">
              {/* Activer pour DRAFT */}
              {status === "DRAFT" && !pastDeparture && (
                <ActionButton icon={Zap} label={isFr ? "Activer" : "Activate"} variant="activate" loading={activateTrip.isPending} onClick={handleActivate} />
              )}

              {/* Reprendre pour PAUSED */}
              {status === "PAUSED" && !pastDeparture && (
                <ActionButton icon={Zap} label={isFr ? "Reprendre" : "Resume"} variant="activate" loading={resumeTrip.isPending} onClick={handleActivate} />
              )}

              {/* Mettre en pause */}
              {status === "PUBLISHED" && (
                <ActionButton icon={Pause} label={isFr ? "Mettre en pause" : "Pause"} loading={pauseTrip.isPending} onClick={() => pauseTrip.mutate(tripId, { onSuccess: () => ok(isFr ? "Trajet mis en pause" : "Trip paused"), onError: ko })} />
              )}

              {/* Repasser en brouillon */}
              {["PUBLISHED", "PAUSED"].includes(status) && (
                <ActionButton icon={FileText} label={isFr ? "Repasser en brouillon" : "Revert to draft"} onClick={() => setModal("revertToDraft")} />
              )}

              {/* Modifier */}
              {["DRAFT", "PUBLISHED", "PAUSED"].includes(status) && (
                <ActionButton icon={Pencil} label={isFr ? "Modifier" : "Edit"} variant="primary" onClick={() => router.push(`/trips/create?edit=${tripId}`)} />
              )}

              {/* Dupliquer */}
              <ActionButton icon={Copy} label={isFr ? "Dupliquer" : "Duplicate"} loading={duplicateTrip.isPending} onClick={() => duplicateTrip.mutate(tripId, { onSuccess: () => { setFlashToast({ type: "success", message: isFr ? "Brouillon créé par duplication" : "Draft created from duplicate" }); router.push("/dashboard/trips"); }, onError: ko })} />

              {/* Restaurer en brouillon */}
              {status === "CANCELLED" && !pastDeparture && (
                <ActionButton icon={RotateCcw} label={isFr ? "Restaurer en brouillon" : "Restore as draft"} loading={restoreTrip.isPending} onClick={() => restoreTrip.mutate(tripId, { onSuccess: () => ok(isFr ? "Trajet restauré en brouillon" : "Trip restored as draft"), onError: ko })} />
              )}

              {/* Archiver */}
              {["COMPLETED", "CANCELLED"].includes(status) && (
                <ActionButton icon={Archive} label={isFr ? "Archiver" : "Archive"} onClick={() => ok(isFr ? "Trajet archivé" : "Trip archived")} />
              )}

              {/* Annuler */}
              {["PUBLISHED", "PAUSED"].includes(status) && (
                <ActionButton icon={XCircle} label={isFr ? "Annuler le trajet" : "Cancel trip"} variant="danger" onClick={() => setModal("cancel")} />
              )}

              {/* Supprimer */}
              {status === "DRAFT" && (
                <ActionButton icon={Trash2} label={isFr ? "Supprimer le brouillon" : "Delete draft"} variant="danger" onClick={() => setModal("delete")} />
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-slate-900 dark:text-white"><Package size={16} className="text-slate-400" />{isFr ? "Demandes" : "Requests"}</div>
            <div className="flex flex-col items-center py-6 text-center"><Package size={28} className="text-slate-300 dark:text-slate-600" /><p className="mt-2 text-[13px] text-slate-400 dark:text-slate-500">{isFr ? "Aucune demande pour le moment" : "No requests yet"}</p></div>
          </div>

          {["PUBLISHED", "PAUSED", "COMPLETED"].includes(status) && (
            <button type="button" onClick={() => window.open(`/trips/${tripId}`, "_blank")} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13px] text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300 dark:hover:bg-slate-800"><ExternalLink size={14} />{isFr ? "Voir en tant qu'expéditeur" : "View as shipper"}</button>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="mb-3 text-[13px] font-semibold text-slate-900 dark:text-white">{isFr ? "Options" : "Options"}</div>
            <div className="space-y-0 divide-y divide-slate-100 dark:divide-slate-800">
              <InfoRow label={isFr ? "Remise en main propre" : "Hand delivery only"} value={<span style={{ color: trip.handDeliveryOnly ? "#10b981" : "#64748b" }}>{trip.handDeliveryOnly ? (isFr ? "Oui" : "Yes") : (isFr ? "Non" : "No")}</span>} />
              <InfoRow label={isFr ? "Réservation instantanée" : "Instant booking"} value={<span style={{ color: trip.instantBooking ? "#10b981" : "#64748b" }}>{trip.instantBooking ? (isFr ? "Oui" : "Yes") : (isFr ? "Non" : "No")}</span>} />
              {trip.ticketVerificationStatus && <InfoRow label={isFr ? "Billet vérifié" : "Ticket verified"} value={<span style={{ color: TICKET_STATUS_LABELS[trip.ticketVerificationStatus]?.color }}>{isFr ? TICKET_STATUS_LABELS[trip.ticketVerificationStatus]?.fr : TICKET_STATUS_LABELS[trip.ticketVerificationStatus]?.en}</span>} />}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-slate-900 dark:text-white"><Info size={16} className="text-slate-400" />{isFr ? "Informations" : "Information"}</div>
            <div className="space-y-0 divide-y divide-slate-100 text-[12px] dark:divide-slate-800">
              <InfoRow label={isFr ? "Créé le" : "Created"} value={formatTripDate(trip.createdAt?.slice(0, 10), isFr)} />
              {trip.publishedAt && <InfoRow label={isFr ? "Publié le" : "Published"} value={formatTripDate(trip.publishedAt.slice(0, 10), isFr)} />}
              {trip.cancelledAt && <InfoRow label={isFr ? "Annulé le" : "Cancelled"} value={formatTripDate(trip.cancelledAt.slice(0, 10), isFr)} />}
              <InfoRow label="ID" value={<span className="font-mono text-[11px] text-slate-400">{tripId.slice(-8)}</span>} />
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal open={!!modal}
                    title={modalConfig?.title ?? ""}
                    message={modalConfig?.message ?? ""}
                    confirmLabel={modalConfig?.confirmLabel ?? ""}
                    isLoading={isConfirming} onConfirm={handleConfirm} onCancel={() => setModal(null)} isFr={isFr} />

      <style jsx global>{`@keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
    </div>
  );
}

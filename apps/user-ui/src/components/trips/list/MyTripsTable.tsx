"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Search, X, Filter, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  MoreVertical, Eye, ExternalLink, Pencil, Pause, Play, Copy, Archive,
  RotateCcw, XCircle, Trash2, AlertTriangle, Check, Plane, Train, Car,
  Loader2, AlertCircle, ArrowRight, Zap, FileText,
} from "lucide-react";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";
import { useFlashToast } from "@/hooks/useFlashToast";
import useUser from "@/hooks/useUser";
import apiClient from "@/lib/api-client";
import {
  useMyTrips, usePauseTrip, useResumeTrip, useCancelTrip, useRestoreTrip,
} from "@/hooks/useTrip";
import {
  STATUS_CONFIG, TRANSPORT_LABELS, MANGO, TRIPS_PER_PAGE,
  getActionsForStatus, formatTripDate, isTripPastDeparture,
  type TripListItem, type TripStatus, type TransportMode, type TripActionKey,
} from "./my-trips.config";

const ACTION_ICONS: Record<string, React.ElementType> = {
  eye: Eye, external: ExternalLink, pencil: Pencil,
  zap: Zap, pause: Pause, play: Play,
  "file-text": FileText, copy: Copy, archive: Archive,
  rotate: RotateCcw, "x-circle": XCircle, trash: Trash2,
};
const TRANSPORT_ICONS: Record<TransportMode, React.ElementType> = { PLANE: Plane, TRAIN: Train, CAR: Car };

function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    const listener = (e: MouseEvent | TouchEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) handler(); };
    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => { document.removeEventListener("mousedown", listener); document.removeEventListener("touchstart", listener); };
  }, [ref, handler]);
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
        originLabel: o.originLabel, originPlaceId: o.originPlaceId, originCity: o.originCity,
        originRegion: o.originRegion, originCountry: o.originCountry, originLat: o.originLat, originLng: o.originLng,
        destinationLabel: o.destinationLabel, destinationPlaceId: o.destinationPlaceId, destinationCity: o.destinationCity,
        destinationRegion: o.destinationRegion, destinationCountry: o.destinationCountry, destinationLat: o.destinationLat, destinationLng: o.destinationLng,
        acceptedCategories: o.acceptedCategories, categoryConditions: o.categoryConditions,
        handDeliveryOnly: o.handDeliveryOnly, instantBooking: o.instantBooking,
        currencyCode: o.currencyCode, notes: o.notes, publish: false,
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
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["my-trips"] }); },
  });
}

// NEW: Revert to draft (PUBLISHED/PAUSED → DRAFT)
function useRevertToDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tripId: string) => {
      await apiClient.post(`/trips/${tripId}/unpublish`, {}, { requireAuth: true });
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["my-trips"] }); },
  });
}

/* ── StatusBadge ──────────────────────────── */

function StatusBadge({ status, isFr, needsOnboarding }: { status: TripStatus; isFr: boolean; needsOnboarding?: boolean }) {
  const c = STATUS_CONFIG[status];
  if (!c) return null;
  return (
    <div className="flex flex-col items-start gap-1">
      <span style={{ background: c.bg, color: c.text }} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide">
        <span style={{ background: c.dot }} className="h-1.5 w-1.5 rounded-full" />
        {isFr ? c.labelFr : c.labelEn}
      </span>
      {needsOnboarding && status === "DRAFT" && (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}>
          <AlertCircle size={10} />
          {isFr ? "Config. requise" : "Setup required"}
        </span>
      )}
    </div>
  );
}

/* ── OnboardingBanner ─────────────────────── */

function OnboardingBanner({ draftCount, isFr, onAction, onDismiss }: {
  draftCount: number; isFr: boolean; onAction: () => void; onDismiss: () => void;
}) {
  return (
    <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-500/10">
      <AlertCircle size={18} className="mt-0.5 flex-shrink-0 text-amber-500" />
      <div className="flex-1">
        <p className="text-[13px] font-medium text-amber-800 dark:text-amber-300">
          {isFr ? `Vous avez ${draftCount} brouillon${draftCount > 1 ? "s" : ""} en attente de publication` : `You have ${draftCount} draft${draftCount > 1 ? "s" : ""} pending publication`}
        </p>
        <p className="mt-0.5 text-[12px] text-amber-600 dark:text-amber-400">
          {isFr ? "Configurez votre espace transporteur pour activer vos trajets et recevoir des demandes." : "Set up your carrier profile to activate your trips and receive requests."}
        </p>
        <button type="button" onClick={onAction} className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:opacity-90" style={{ backgroundColor: MANGO }}>
          {isFr ? "Configurer maintenant" : "Configure now"}<ArrowRight size={12} />
        </button>
      </div>
      <button type="button" onClick={onDismiss} className="flex-shrink-0 text-amber-400 hover:text-amber-600 dark:hover:text-amber-300"><X size={16} /></button>
    </div>
  );
}

/* ── MultiSelect ──────────────────────────── */

type SelectOption = { value: string; label: string; dot?: string };

function MultiSelect({ label, options, selected, onChange, isFr }: {
  label: string; options: SelectOption[]; selected: string[]; onChange: (v: string[]) => void; isFr: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));
  const toggle = (val: string) => { onChange(selected.includes(val) ? selected.filter((s) => s !== val) : [...selected, val]); };

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] text-slate-500 transition-colors hover:border-slate-300 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-500">
        <Filter size={12} />{label}
        {selected.length > 0 && <span className="ml-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-slate-900" style={{ background: MANGO }}>{selected.length}</span>}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-[100] mt-1 min-w-[160px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900" style={{ animation: "fadeSlide 0.15s ease" }}>
          {options.map((opt) => (
            <button key={opt.value} type="button" onClick={() => toggle(opt.value)} className="flex w-full items-center gap-2 px-3 py-2 text-[12px] text-slate-600 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800">
              <span className={`flex h-4 w-4 items-center justify-center rounded border ${selected.includes(opt.value) ? "border-amber-500 bg-amber-500/20" : "border-slate-300 dark:border-slate-600"}`}>{selected.includes(opt.value) && <Check size={10} />}</span>
              {opt.dot && <span className="h-2 w-2 rounded-full" style={{ background: opt.dot }} />}{opt.label}
            </button>
          ))}
          {selected.length > 0 && (<><div className="mx-3 my-1 border-t border-slate-100 dark:border-slate-700" /><button type="button" onClick={() => onChange([])} className="w-full px-3 py-1.5 text-left text-[11px] text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">{isFr ? "Tout effacer" : "Clear all"}</button></>)}
        </div>
      )}
    </div>
  );
}

/* ── ActionMenu ──────────────────────── */

function ActionMenu({ trip, isFr, onAction }: { trip: TripListItem; isFr: boolean; onAction: (key: TripActionKey, trip: TripListItem) => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pastDeparture = isTripPastDeparture(trip.departureDateLocal);
  const actions = getActionsForStatus(trip.status, pastDeparture);

  const openMenu = () => {
    if (btnRef.current) { const rect = btnRef.current.getBoundingClientRect(); setPos({ top: rect.bottom + 4, left: rect.right }); }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node) && btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = () => setOpen(false);
    window.addEventListener("scroll", handler, true);
    return () => window.removeEventListener("scroll", handler, true);
  }, [open]);

  return (
    <>
      <button ref={btnRef} type="button" onClick={openMenu} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"><MoreVertical size={16} /></button>
      {open && createPortal(
        <div ref={menuRef} className="fixed z-[9999] min-w-[220px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900" style={{ top: pos.top, left: pos.left, transform: "translateX(-100%)", animation: "fadeSlide 0.12s ease" }}>
          {actions.map((a, i) => { const Icon = ACTION_ICONS[a.icon]; const isHighlight = a.key === "activate"; return (
            <div key={a.key}>{a.danger && i > 0 && <div className="mx-3 my-1 border-t border-slate-100 dark:border-slate-700" />}
              <button type="button" onClick={() => { setOpen(false); onAction(a.key, trip); }}
                      className={`flex w-full items-center gap-2.5 px-3 py-2 text-[13px] transition-colors ${
                        a.danger
                          ? "text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                          : isHighlight
                            ? "font-medium hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                            : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                      }`}
                      style={isHighlight ? { color: "#10b981" } : undefined}
              >
                {Icon && <Icon size={14} />}{isFr ? a.labelFr : a.labelEn}
              </button>
            </div>
          ); })}
        </div>, document.body
      )}
    </>
  );
}

/* ── ConfirmModal ─────────────────────────── */

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
          <button type="button" onClick={onConfirm} disabled={isLoading} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50">
            {isLoading && <Loader2 size={14} className="animate-spin" />}{confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Pagination ───────────────────────────── */

function Pagination({ currentPage, totalPages, onPageChange, isFr }: { currentPage: number; totalPages: number; onPageChange: (page: number) => void; isFr: boolean }) {
  if (totalPages <= 1) return null;
  const pages: (number | "...")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) pages.push(i);
    else if (pages[pages.length - 1] !== "...") pages.push("...");
  }
  return (
    <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-800">
      <div className="text-[12px] text-slate-400 dark:text-slate-500">{isFr ? `Page ${currentPage} sur ${totalPages}` : `Page ${currentPage} of ${totalPages}`}</div>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"><ChevronLeft size={16} /></button>
        {pages.map((p, i) => p === "..." ? <span key={`dots-${i}`} className="px-1 text-[12px] text-slate-400">…</span> : (
          <button key={p} type="button" onClick={() => onPageChange(p)} className={`flex h-8 min-w-[32px] items-center justify-center rounded-lg text-[13px] font-medium transition-colors ${p === currentPage ? "text-slate-900 dark:text-white" : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"}`} style={p === currentPage ? { background: `${MANGO}20`, color: MANGO } : undefined}>{p}</button>
        ))}
        <button type="button" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"><ChevronRight size={16} /></button>
      </div>
    </div>
  );
}

type SortState = { key: string; dir: "asc" | "desc" };
function SortHeader({ label, sortKey, currentSort, onSort }: { label: string; sortKey: string; currentSort: SortState; onSort: (key: string) => void }) {
  const active = currentSort.key === sortKey;
  return (
    <button type="button" onClick={() => onSort(sortKey)} className="group flex items-center gap-1 text-left">
      <span className={active ? "text-slate-700 dark:text-slate-200" : ""}>{label}</span>
      <span className={`transition-opacity ${active ? "opacity-100" : "opacity-0 group-hover:opacity-50"}`}>{active && currentSort.dir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</span>
    </button>
  );
}

/* ══════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════ */

export default function MyTripsTable() {
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

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [transportFilter, setTransportFilter] = useState<string[]>([]);
  const [sort, setSort] = useState<SortState>({ key: "departureDateLocal", dir: "desc" });
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<{ type: "delete" | "cancel" | "revertToDraft"; trip: TripListItem } | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  /* ── Onboarding + Stripe status ── */
  const carrierPage = (user as any)?.carrierPage;
  const hasOnboarding = carrierPage?.onboardingStep === "STRIPE" || carrierPage?.onboardingStep === "COMPLETE";
  const stripeReady = carrierPage?.stripeOnboardingComplete && carrierPage?.stripeChargesEnabled;
  // const canActivate = hasOnboarding && stripeReady;
  const needsOnboarding = !hasOnboarding;

  const draftCount = useMemo(() => trips.filter((t) => t.status === "DRAFT").length, [trips]);
  const showOnboardingBanner = needsOnboarding && draftCount > 0 && !bannerDismissed;

  const statusOptions: SelectOption[] = Object.entries(STATUS_CONFIG).map(([k, v]) => ({ value: k, label: isFr ? v.labelFr : v.labelEn, dot: v.dot }));
  const transportOptions: SelectOption[] = Object.entries(TRANSPORT_LABELS).map(([k, v]) => ({ value: k, label: isFr ? v.fr : v.en }));

  const stats = useMemo(() => { const map: Record<string, number> = {}; for (const t of trips) map[t.status] = (map[t.status] ?? 0) + 1; return map; }, [trips]);

  const filtered = useMemo(() => {
    let result = [...trips];
    if (statusFilter.length === 0) result = result.filter((t) => t.status !== "ARCHIVED");
    if (search) { const q = search.toLowerCase(); result = result.filter((t) => `${t.originLabel ?? t.originCity ?? ""} ${t.destinationLabel ?? t.destinationCity ?? ""}`.toLowerCase().includes(q)); }
    if (statusFilter.length > 0) result = result.filter((t) => statusFilter.includes(t.status));
    if (transportFilter.length > 0) result = result.filter((t) => t.transportMode && transportFilter.includes(t.transportMode));
    result.sort((a, b) => {
      let cmp = 0;
      if (sort.key === "departureDateLocal") cmp = (a.departureDateLocal ?? "").localeCompare(b.departureDateLocal ?? "");
      else if (sort.key === "route") cmp = `${a.originCity ?? ""}${a.destinationCity ?? ""}`.localeCompare(`${b.originCity ?? ""}${b.destinationCity ?? ""}`);
      else if (sort.key === "demands") cmp = (a.pendingDemandsCount ?? 0) - (b.pendingDemandsCount ?? 0);
      else if (sort.key === "status") cmp = a.status.localeCompare(b.status);
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [trips, search, statusFilter, transportFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / TRIPS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * TRIPS_PER_PAGE, safePage * TRIPS_PER_PAGE);

  useEffect(() => { setPage(1); }, [search, statusFilter, transportFilter]);

  const handleSort = useCallback((key: string) => { setSort((prev) => prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }); setPage(1); }, []);
  const handleStatClick = useCallback((status: string) => { setStatusFilter((prev) => prev.length === 1 && prev[0] === status ? [] : [status]); }, []);

  const getFrom = (t: TripListItem) => t.originCity ?? t.originLabel ?? "—";
  const getTo = (t: TripListItem) => t.destinationCity ?? t.destinationLabel ?? "—";

  const toastOpts = { duration: Infinity, closeButton: true };

  const handleAction = useCallback((actionKey: TripActionKey, trip: TripListItem) => {
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
        // Gate 1: onboarding required
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
        // Gate 2: Stripe required
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
        // All good — activate
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
          onSuccess: () => ok(isFr ? "Brouillon créé par duplication" : "Draft created from duplicate"),
          onError: ko,
        });
        break;

      case "restoreDraft":
        restoreTrip.mutate(trip.id, {
          onSuccess: () => ok(isFr ? "Trajet restauré en brouillon" : "Trip restored as draft"),
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
  }, [router, isFr, hasOnboarding, stripeReady, pauseTrip, resumeTrip, duplicateTrip, restoreTrip, activateTrip]);

  const confirmModal = useCallback(() => {
    if (!modal) return;
    const ok = (msg: string) => { toast.success(msg, toastOpts); setModal(null); };
    const ko = () => toast.error(isFr ? "Erreur" : "Error", toastOpts);

    if (modal.type === "delete") {
      deleteTrip.mutate(modal.trip.id, { onSuccess: () => ok(isFr ? "Brouillon supprimé" : "Draft deleted"), onError: ko });
    } else if (modal.type === "cancel") {
      cancelTrip.mutate(modal.trip.id, { onSuccess: () => ok(isFr ? "Trajet annulé" : "Trip cancelled"), onError: ko });
    } else if (modal.type === "revertToDraft") {
      revertToDraft.mutate(modal.trip.id, { onSuccess: () => ok(isFr ? "Trajet repassé en brouillon" : "Trip reverted to draft"), onError: ko });
    }
  }, [modal, isFr, deleteTrip, cancelTrip, revertToDraft]);

  const isConfirming = deleteTrip.isPending || cancelTrip.isPending || revertToDraft.isPending;
  const activeFilterCount = (search ? 1 : 0) + statusFilter.length + transportFilter.length;

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-slate-400" /></div>;
  if (isError) return (
    <div className="py-20 text-center">
      <p className="text-[14px] text-slate-500 dark:text-slate-400">{isFr ? "Impossible de charger vos trajets." : "Unable to load your trips."}</p>
      <button type="button" onClick={() => refetch()} className="mt-3 text-[13px] font-medium" style={{ color: MANGO }}>{isFr ? "Réessayer" : "Retry"}</button>
    </div>
  );

  // ── Modal config ──
  const modalConfig = modal ? (() => {
    const from = getFrom(modal.trip);
    const to = getTo(modal.trip);
    if (modal.type === "delete") return {
      title: isFr ? "Supprimer ce brouillon ?" : "Delete this draft?",
      message: isFr ? `Le brouillon "${from} → ${to}" sera définitivement supprimé.` : `The draft "${from} → ${to}" will be permanently deleted.`,
      confirmLabel: isFr ? "Supprimer" : "Delete",
    };
    if (modal.type === "cancel") return {
      title: isFr ? "Annuler ce trajet ?" : "Cancel this trip?",
      message: isFr ? `Le trajet "${from} → ${to}" sera annulé. Les demandes en cours seront notifiées.` : `The trip "${from} → ${to}" will be cancelled. Pending requests will be notified.`,
      confirmLabel: isFr ? "Annuler le trajet" : "Cancel trip",
    };
    return {
      title: isFr ? "Repasser en brouillon ?" : "Revert to draft?",
      message: isFr ? `Le trajet "${from} → ${to}" sera masqué et repasé en brouillon. Vous pourrez le réactiver à tout moment.` : `The trip "${from} → ${to}" will be hidden and reverted to draft. You can reactivate it anytime.`,
      confirmLabel: isFr ? "Repasser en brouillon" : "Revert to draft",
    };
  })() : null;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[22px] font-semibold tracking-tight text-slate-900 dark:text-white">{isFr ? "Mes trajets" : "My trips"}</h1>
        <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">{isFr ? "Gérez vos trajets publiés et en cours" : "Manage your published and ongoing trips"}</p>
      </div>

      {showOnboardingBanner && (
        <OnboardingBanner draftCount={draftCount} isFr={isFr} onAction={() => router.push("/carrier/onboarding")} onDismiss={() => setBannerDismissed(true)} />
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {([
          { status: "PUBLISHED" as TripStatus, label: isFr ? "Actif" : "Active", color: "#10b981" },
          { status: "COMPLETED" as TripStatus, label: isFr ? "Terminé" : "Completed", color: "#0f766e" },
          { status: "DRAFT" as TripStatus, label: isFr ? "Brouillon" : "Draft", color: "#64748b" },
          { status: "PAUSED" as TripStatus, label: isFr ? "En pause" : "Paused", color: "#f59e0b" },
          { status: "CANCELLED" as TripStatus, label: isFr ? "Annulé" : "Cancelled", color: "#ef4444" },
        ]).map((s) => {
          const count = stats[s.status] ?? 0;
          const isActive = statusFilter.length === 1 && statusFilter[0] === s.status;
          if (count === 0 && !isActive) return null;
          return (
            <button key={s.status} type="button" onClick={() => handleStatClick(s.status)} className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium transition-all ${isActive ? "ring-1 ring-slate-400 dark:ring-slate-500" : "hover:ring-1 hover:ring-slate-300 dark:hover:ring-slate-600"}`} style={{ background: isActive ? `${s.color}20` : `${s.color}0a`, color: s.color }}>
              {s.label}<span className="font-semibold">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Search size={14} /></span>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={isFr ? "Rechercher un trajet…" : "Search trips…"} className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-[13px] text-slate-900 placeholder:text-slate-400 transition-colors focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200 dark:placeholder:text-slate-600 dark:focus:border-slate-500" />
          {search && <button type="button" onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><X size={14} /></button>}
        </div>
        <MultiSelect label={isFr ? "Statut" : "Status"} options={statusOptions} selected={statusFilter} onChange={setStatusFilter} isFr={isFr} />
        <MultiSelect label="Transport" options={transportOptions} selected={transportFilter} onChange={setTransportFilter} isFr={isFr} />
        {activeFilterCount > 0 && <button type="button" onClick={() => { setSearch(""); setStatusFilter([]); setTransportFilter([]); }} className="text-[12px] text-slate-400 transition-colors hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">{isFr ? "Réinitialiser" : "Reset"}</button>}
        <div className="ml-auto text-[12px] text-slate-400 dark:text-slate-600">{filtered.length} {isFr ? "trajet(s)" : "trip(s)"}</div>
      </div>

      <div className="hidden rounded-xl border border-slate-200 dark:border-slate-800 sm:block">
        <table className="w-full text-left">
          <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/40">
            <th className="px-4 py-3"><SortHeader label={isFr ? "Voyage" : "Trip"} sortKey="route" currentSort={sort} onSort={handleSort} /></th>
            <th className="px-4 py-3"><SortHeader label="Date" sortKey="departureDateLocal" currentSort={sort} onSort={handleSort} /></th>
            <th className="px-4 py-3">Transport</th>
            <th className="px-4 py-3"><SortHeader label={isFr ? "Demandes" : "Requests"} sortKey="demands" currentSort={sort} onSort={handleSort} /></th>
            <th className="px-4 py-3"><SortHeader label={isFr ? "Statut" : "Status"} sortKey="status" currentSort={sort} onSort={handleSort} /></th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
          </thead>
          <tbody>
          {paged.length === 0 ? (
            <tr><td colSpan={6} className="px-4 py-12 text-center">
              <Search size={32} className="mx-auto text-slate-300 dark:text-slate-600" />
              <p className="mt-2 text-[13px] text-slate-500">{isFr ? "Aucun trajet trouvé" : "No trips found"}</p>
              {activeFilterCount > 0 && <button type="button" onClick={() => { setSearch(""); setStatusFilter([]); setTransportFilter([]); }} className="mt-2 text-[12px] font-medium" style={{ color: MANGO }}>{isFr ? "Réinitialiser les filtres" : "Reset filters"}</button>}
            </td></tr>
          ) : paged.map((trip) => {
            const TransportIcon = trip.transportMode ? TRANSPORT_ICONS[trip.transportMode] : null;
            const demands = trip.pendingDemandsCount ?? 0;
            return (
              <tr key={trip.id} className="group border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50 dark:border-slate-800/50 dark:hover:bg-slate-800/30">
                <td className="px-4 py-3.5">
                  <button type="button" onClick={() => router.push(`/dashboard/trips/${trip.id}`)} className="flex items-center gap-2 text-left transition-colors hover:opacity-80">
                    <span className="text-[14px] font-medium text-slate-900 dark:text-white">{getFrom(trip)}</span>
                    <span className="text-slate-300 dark:text-slate-600">→</span>
                    <span className="text-[14px] font-medium text-slate-900 dark:text-white">{getTo(trip)}</span>
                  </button>
                </td>
                <td className="px-4 py-3.5">
                  <div className="text-[13px] text-slate-700 dark:text-slate-300">{formatTripDate(trip.departureDateLocal, isFr)}</div>
                  {trip.arrivalDateLocal && trip.arrivalDateLocal !== trip.departureDateLocal && <div className="text-[11px] text-slate-400 dark:text-slate-600">→ {formatTripDate(trip.arrivalDateLocal, isFr)}</div>}
                </td>
                <td className="px-4 py-3.5">{trip.transportMode && <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">{TransportIcon && <TransportIcon size={15} />}<span className="text-[13px]">{isFr ? TRANSPORT_LABELS[trip.transportMode].fr : TRANSPORT_LABELS[trip.transportMode].en}</span></div>}</td>
                <td className="px-4 py-3.5">
                  {demands > 0 ? <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium" style={{ background: "rgba(255,153,0,0.10)", color: MANGO }}>{demands}<span className="text-[11px] font-normal" style={{ color: "rgba(255,153,0,0.6)" }}>{isFr ? (trip.status === "COMPLETED" ? "livrés" : "en attente") : (trip.status === "COMPLETED" ? "delivered" : "pending")}</span></span>
                    : <span className="text-[12px] text-slate-300 dark:text-slate-600">—</span>}
                </td>
                <td className="px-4 py-3.5"><StatusBadge status={trip.status} isFr={isFr} needsOnboarding={needsOnboarding} /></td>
                <td className="px-4 py-3.5 text-right"><ActionMenu trip={trip} isFr={isFr} onAction={handleAction} /></td>
              </tr>
            );
          })}
          </tbody>
        </table>
        <Pagination currentPage={safePage} totalPages={totalPages} onPageChange={setPage} isFr={isFr} />
      </div>

      <div className="flex flex-col gap-3 sm:hidden">
        {paged.length === 0 ? <div className="rounded-xl border border-slate-200 py-12 text-center dark:border-slate-800"><p className="text-[13px] text-slate-500">{isFr ? "Aucun trajet trouvé" : "No trips found"}</p></div>
          : paged.map((trip) => {
            const TransportIcon = trip.transportMode ? TRANSPORT_ICONS[trip.transportMode] : null;
            const demands = trip.pendingDemandsCount ?? 0;
            return (
              <div key={trip.id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/50">
                <div className="flex items-start justify-between">
                  <button type="button" onClick={() => router.push(`/dashboard/trips/${trip.id}`)} className="text-left">
                    <div className="flex items-center gap-1.5 text-[15px] font-medium text-slate-900 dark:text-white">{getFrom(trip)} <span className="text-slate-300 dark:text-slate-600">→</span> {getTo(trip)}</div>
                    <div className="mt-1 flex items-center gap-2 text-[12px] text-slate-500">
                      {TransportIcon && <span className="flex items-center gap-1 text-slate-400"><TransportIcon size={13} />{trip.transportMode && (isFr ? TRANSPORT_LABELS[trip.transportMode].fr : TRANSPORT_LABELS[trip.transportMode].en)}</span>}
                      <span>·</span><span>{formatTripDate(trip.departureDateLocal, isFr)}</span>
                    </div>
                  </button>
                  <ActionMenu trip={trip} isFr={isFr} onAction={handleAction} />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <StatusBadge status={trip.status} isFr={isFr} needsOnboarding={needsOnboarding} />
                  {demands > 0 && <span className="text-[12px] font-medium" style={{ color: MANGO }}>{demands} {isFr ? "demande(s)" : "request(s)"}</span>}
                </div>
              </div>
            );
          })}
        <Pagination currentPage={safePage} totalPages={totalPages} onPageChange={setPage} isFr={isFr} />
      </div>

      <ConfirmModal open={!!modal}
                    title={modalConfig?.title ?? ""}
                    message={modalConfig?.message ?? ""}
                    confirmLabel={modalConfig?.confirmLabel ?? ""}
                    isLoading={isConfirming} onConfirm={confirmModal} onCancel={() => setModal(null)} isFr={isFr} />

      <style jsx global>{`
        @keyframes fadeSlide { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
}

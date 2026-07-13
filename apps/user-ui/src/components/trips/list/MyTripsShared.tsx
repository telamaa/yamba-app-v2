"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  ArrowRight,
  Copy,
  Eye,
  ExternalLink,
  FileText,
  Loader2,
  MoreVertical,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  Trash2,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import {
  STATUS_CONFIG,
  MANGO,
  getActionsForStatus,
  isTripPastDeparture,
  type TripActionKey,
  type TripListItem,
  type TripStatus,
} from "./my-trips.config";

/**
 * Briques UI partagées du module Mes trajets (réel), extraites de
 * MyTripsTable (legacy) : StatusBadge, OnboardingBanner, ActionMenu,
 * ConfirmModal. Utilisées par MyTripsList.
 */

const ACTION_ICONS: Record<string, React.ElementType> = {
  eye: Eye,
  external: ExternalLink,
  pencil: Pencil,
  zap: Zap,
  pause: Pause,
  play: Play,
  "file-text": FileText,
  copy: Copy,
  archive: Archive,
  rotate: RotateCcw,
  "x-circle": XCircle,
  trash: Trash2,
};

/* ── StatusBadge ─────────────────────────────────────────────────── */

export function StatusBadge({
                              status,
                              isFr,
                              needsOnboarding,
                            }: {
  status: TripStatus;
  isFr: boolean;
  needsOnboarding?: boolean;
}) {
  const c = STATUS_CONFIG[status];
  if (!c) return null;
  return (
    <div className="flex flex-col items-start gap-1">
      <span
        style={{ background: c.bg, color: c.text }}
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium"
      >
        <span style={{ background: c.dot }} className="h-1.5 w-1.5 rounded-full" />
        {isFr ? c.labelFr : c.labelEn}
      </span>
      {needsOnboarding && status === "DRAFT" && (
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}
        >
          <AlertCircle size={10} />
          {isFr ? "Config. requise" : "Setup required"}
        </span>
      )}
    </div>
  );
}

/* ── OnboardingBanner ────────────────────────────────────────────── */

export function OnboardingBanner({
                                   draftCount,
                                   isFr,
                                   onAction,
                                   onDismiss,
                                 }: {
  draftCount: number;
  isFr: boolean;
  onAction: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-500/10">
      <AlertCircle size={18} className="mt-0.5 flex-shrink-0 text-amber-500" />
      <div className="flex-1">
        <p className="text-[13px] font-medium text-amber-800 dark:text-amber-300">
          {isFr
            ? `Vous avez ${draftCount} brouillon${draftCount > 1 ? "s" : ""} en attente de publication`
            : `You have ${draftCount} draft${draftCount > 1 ? "s" : ""} pending publication`}
        </p>
        <p className="mt-0.5 text-[12px] text-amber-600 dark:text-amber-400">
          {isFr
            ? "Configurez votre espace transporteur pour activer vos trajets et recevoir des demandes."
            : "Set up your carrier profile to activate your trips and receive requests."}
        </p>
        <button
          type="button"
          onClick={onAction}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:opacity-90"
          style={{ backgroundColor: MANGO }}
        >
          {isFr ? "Configurer maintenant" : "Configure now"}
          <ArrowRight size={12} />
        </button>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="flex-shrink-0 text-amber-400 hover:text-amber-600 dark:hover:text-amber-300"
      >
        <X size={16} />
      </button>
    </div>
  );
}

/* ── ActionMenu (portal) ─────────────────────────────────────────── */
export function ActionMenu({
                             trip,
                             isFr,
                             onAction,
                           }: {
  trip: TripListItem;
  isFr: boolean;
  onAction: (key: TripActionKey, trip: TripListItem) => void;
}) {
  const [open, setOpen] = useState(false);
  // Positionné par `right` (distance au bord droit de la fenêtre) :
  // aucun transform inline → l'animation fadeSlide (qui anime transform)
  // ne peut plus écraser le positionnement et faire flasher le menu à droite.
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pastDeparture = isTripPastDeparture(trip.departureDateLocal);
  const actions = getActionsForStatus(trip.status, pastDeparture);

  const openMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      )
        setOpen(false);
    };
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
      <button
        ref={btnRef}
        type="button"
        onClick={openMenu}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      >
        <MoreVertical size={16} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[9999] min-w-[220px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"
            style={{
              top: pos.top,
              right: pos.right,
              animation: "fadeSlide 0.12s ease",
            }}
          >
            {actions.map((a, i) => {
              const Icon = ACTION_ICONS[a.icon];
              const isHighlight = a.key === "activate";
              return (
                <div key={a.key}>
                  {a.danger && i > 0 && (
                    <div className="mx-3 my-1 border-t border-slate-100 dark:border-slate-700" />
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(false);
                      onAction(a.key, trip);
                    }}
                    className={
                      "flex w-full items-center gap-2.5 px-3 py-2 text-[13px] transition-colors " +
                      (a.danger
                        ? "text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                        : isHighlight
                          ? "font-medium hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                          : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800")
                    }
                    style={isHighlight ? { color: "#10b981" } : undefined}
                  >
                    {Icon && <Icon size={14} />}
                    {isFr ? a.labelFr : a.labelEn}
                  </button>
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}


/* ── ConfirmModal ────────────────────────────────────────────────── */

export function ConfirmModal({
                               open,
                               title,
                               message,
                               confirmLabel,
                               isLoading,
                               onConfirm,
                               onCancel,
                               isFr,
                             }: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isFr: boolean;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="mx-4 w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        style={{ animation: "scaleIn 0.2s ease" }}
      >
        <div className="p-6">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-500/10">
            <AlertTriangle size={20} />
          </div>
          <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white">
            {title}
          </h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
            {message}
          </p>
        </div>
        <div className="flex gap-3 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 rounded-lg border border-slate-200 py-2.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {isFr ? "Retour" : "Go back"}
            MyTripsList.tsx          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {isLoading && <Loader2 size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Bell, Plus, Sparkles } from "lucide-react";
import { useSavedRoutes } from "@/hooks/useSavedRoutes";
import SavedRouteCard from "./SavedRouteCard";
import CreateSavedRouteModal from "./CreateSavedRouteModal";

export default function SavedRoutesList() {
  const t = useTranslations("savedRoutes.list");
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const { data: savedRoutes, isLoading, isError } = useSavedRoutes();

  // ─── Loading ────────────────────────────────
  if (isLoading) {
    return <SavedRoutesListSkeleton />;
  }

  // ─── Error ──────────────────────────────────
  if (isError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-500/30 dark:bg-red-500/10">
        <p className="text-sm text-red-700 dark:text-red-300">
          {t("errorMessage")}
        </p>
      </div>
    );
  }

  const routes = savedRoutes ?? [];

  // ─── Empty state ───────────────────────────
  if (routes.length === 0) {
    return (
      <>
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-950">
          <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-orange-50 text-[#FF9900] dark:bg-orange-500/15">
            <Bell size={22} strokeWidth={2.2} />
          </div>
          <h3 className="mb-2 text-base font-bold text-slate-900 dark:text-white">
            {t("emptyTitle")}
          </h3>
          <p className="mx-auto mb-5 max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            {t("emptyDescription")}
          </p>
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#FF9900] px-5 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-[#F08700]"
          >
            <Sparkles size={14} />
            {t("emptyCta")}
          </button>
        </div>

        <CreateSavedRouteModal
          isOpen={createModalOpen}
          closeAction={() => setCreateModalOpen(false)}
        />
      </>
    );
  }

  // ─── Liste ──────────────────────────────────
  return (
    <>
      {/* Header avec compteur + CTA */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {t("count", { count: routes.length })}
        </p>
        <button
          type="button"
          onClick={() => setCreateModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#FF9900] px-4 py-2 text-xs font-bold text-slate-950 transition-colors hover:bg-[#F08700]"
        >
          <Plus size={13} strokeWidth={2.5} />
          {t("newAlert")}
        </button>
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {routes.map((route) => (
          <SavedRouteCard key={route.id} savedRoute={route} />
        ))}
      </div>

      {/* Modal de création */}
      <CreateSavedRouteModal
        isOpen={createModalOpen}
        closeAction={() => setCreateModalOpen(false)}
      />
    </>
  );
}

/* ============================================================ */
/*                       SKELETON                                */
/* ============================================================ */

function SavedRoutesListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-[180px] animate-pulse rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40"
        />
      ))}
    </div>
  );
}

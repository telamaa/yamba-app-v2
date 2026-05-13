"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { UserPlus, Search } from "lucide-react";
import { useFollowing } from "@/hooks/useFollowing";
import FollowedTripperCard from "./FollowedTripperCard";

export default function FollowedTrippersList() {
  const t = useTranslations("following.list");

  const { data: following, isLoading, isError } = useFollowing();

  // ─── Loading ────────────────────────────────
  if (isLoading) {
    return <FollowedTrippersListSkeleton />;
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

  const items = following ?? [];

  // ─── Empty state ───────────────────────────
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-orange-50 text-[#FF9900] dark:bg-orange-500/15">
          <UserPlus size={22} strokeWidth={2.2} />
        </div>
        <h3 className="mb-2 text-base font-bold text-slate-900 dark:text-white">
          {t("emptyTitle")}
        </h3>
        <p className="mx-auto mb-5 max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          {t("emptyDescription")}
        </p>
        <Link
          href="/search"
          className="inline-flex items-center gap-1.5 rounded-full bg-[#FF9900] px-5 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-[#F08700]"
        >
          <Search size={14} />
          {t("emptyCta")}
        </Link>
      </div>
    );
  }

  // ─── Liste ──────────────────────────────────
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {t("count", { count: items.length })}
        </p>
        <Link
          href="/search"
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
        >
          <Search size={13} strokeWidth={2.5} />
          {t("discoverMore")}
        </Link>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <FollowedTripperCard key={item.user.id} item={item} />
        ))}
      </div>
    </>
  );
}

/* ============================================================ */
/*                       SKELETON                                */
/* ============================================================ */

function FollowedTrippersListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-[220px] animate-pulse rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40"
        />
      ))}
    </div>
  );
}

// apps/user-ui/src/components/layout/header/HeaderNotificationBell.tsx
"use client";

/**
 * HeaderNotificationBell — la cloche VIVANTE (A91, décisions 1A/3A)
 * ==================================================================
 * Desktop : un menu déroulant avec les cinq dernières notifications (copie
 * contextuelle par rôle), « Tout marquer lu » et « Voir tout ». Le badge
 * vient du cache partagé (`useNotifications`, rafraîchi toutes les 30 s et au
 * retour sur l'onglet). Mobile : lien direct vers la page, badge identique.
 */

import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import useUser from "@/hooks/useUser";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from "@/hooks/useNotifications";
import {
  buildNotificationCopy,
  formatWhen,
  getNotificationPresentation,
  isKnownNotificationType,
  readerRole,
} from "@/components/dashboard/notifications/notifications.types";
import { HEADER_COLORS } from "./header.constants";

type Props = {
  /** Compteur de notifications non lues (cache partagé). */
  count?: number;
  /** Variante : `desktop` (cercle bg + menu) ou `mobile` (lien). */
  variant?: "desktop" | "mobile";
};

export default function HeaderNotificationBell({ count = 0, variant = "desktop" }: Props) {
  const t = useTranslations("common.header");
  const tn = useTranslations("notifications");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const { user } = useUser();
  const userId: string | undefined = (user as { id?: string } | undefined)?.id;
  const { data } = useNotifications({ enabled: variant === "desktop" });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  // Fermeture au clic dehors / Échap.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const badge =
    count > 0 ? (
      <span
        className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full border-2 border-white px-1 text-[10px] font-semibold text-white dark:border-slate-950"
        style={{ backgroundColor: HEADER_COLORS.danger }}
      >
        {count > 99 ? "99+" : count}
      </span>
    ) : null;

  if (variant === "mobile") {
    return (
      <Link
        href="/dashboard/notifications"
        aria-label={t("notifications")}
        className="relative flex h-7 w-7 items-center justify-center text-slate-700 dark:text-slate-200"
      >
        <Bell size={18} />
        {badge}
      </Link>
    );
  }

  const items = (data?.items ?? []).slice(0, 5);
  const nowMs = Date.now();

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("notifications")}
        aria-expanded={open}
        aria-haspopup="menu"
        className="relative flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <Bell size={16} />
        {badge}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-11 z-50 w-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
            <span className="text-[13px] font-bold text-slate-900 dark:text-white">{tn("bellTitle")}</span>
            {count > 0 && (
              <button
                type="button"
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#0F766E] hover:underline disabled:opacity-60 dark:text-teal-300"
              >
                <CheckCheck size={13} aria-hidden="true" />
                {tn("markAllRead")}
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-slate-500 dark:text-slate-400">{tn("empty.title")}</p>
          ) : (
            <ul className="max-h-[360px] overflow-y-auto">
              {items.map((item) => {
                const p = getNotificationPresentation(item.type);
                const Icon = p.icon;
                const unread = item.readAt === null;
                const copy = isKnownNotificationType(item.type)
                  ? buildNotificationCopy(item, readerRole(item.payload, userId), tn, locale)
                  : { title: tn("items.fallback"), line: "" };
                const href = item.bookingId
                  ? userId && item.payload.carrierId === userId
                    ? `/carrier/deals/${item.bookingId}`
                    : `/bookings/${item.bookingId}`
                  : "/dashboard/notifications";
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (unread && !markRead.isPending) markRead.mutate(item.id);
                        setOpen(false);
                        router.push(href);
                      }}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-900 ${
                        unread ? "bg-amber-50/60 dark:bg-amber-900/10" : ""
                      }`}
                    >
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        <Icon size={14} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-[13px] font-semibold text-slate-900 dark:text-white">{copy.title}</span>
                          {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />}
                        </span>
                        {copy.line && <span className="mt-0.5 block truncate text-[12px] text-slate-500 dark:text-slate-400">{copy.line}</span>}
                        <span className="mt-0.5 block text-[11px] text-slate-400 dark:text-slate-500">{formatWhen(item.createdAt, nowMs, locale)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <Link
            href="/dashboard/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-slate-100 px-4 py-2.5 text-center text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            {tn("viewAll")}
          </Link>
        </div>
      )}
    </div>
  );
}

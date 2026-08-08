"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Bell } from "lucide-react";
import { DashboardCopy } from "@/app/[locale]/dashboard/dashboard.copy";
import SectionHeader from "@/components/dashboard/SectionHeader";
import { EmptyState } from "@/components/dashboard/DashboardUI";
import {
  useMarkNotificationRead,
  useNotifications,
} from "@/hooks/useNotifications";
import {
  formatWhen,
  getCorridorLabel,
  getNotificationPresentation,
  getWeightKg,
  isKnownNotificationType,
  type NotificationTone,
} from "@/components/dashboard/notifications/notifications.types";

/**
 * Notifications — la boîte RÉELLE (PR5, Lot 3c).
 * Moule visuel du preview (NotificationsPreview) : icône teintée,
 * non-lues surlignées, titre i18n (namespace "notifications"),
 * sous-titre neutre dérivé du payload (corridor · poids), temps
 * relatif. Clic sur une non-lue = marquage lu (idempotent côté
 * serveur), cache partagé avec la cloche du Header.
 */

const TONE: Record<NotificationTone, string> = {
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300",
  emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300",
  teal: "bg-teal-50 text-teal-700 dark:bg-teal-900/25 dark:text-teal-300",
  red: "bg-red-50 text-red-700 dark:bg-red-900/25 dark:text-red-300",
  slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

export default function Notifications({ copy }: { copy: DashboardCopy }) {
  const t = useTranslations("notifications");
  const locale = useLocale();
  const { data, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const [nowMs, setNowMs] = useState(() => Date.now());

  /* Tick 60 s pour les temps relatifs (pattern shipments). */
  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const items = data?.items;
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <>
      <SectionHeader
        title={copy.notifications.title}
        subtitle={
          unreadCount > 0
            ? t("subtitleUnread", { count: unreadCount })
            : copy.notifications.sub
        }
      />

      {isLoading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900"
            />
          ))}
        </div>
      )}

      {items && items.length === 0 && (
        <EmptyState
          icon={Bell}
          title={t("empty.title")}
          description={t("empty.description")}
        />
      )}

      {items && items.length > 0 && (
        <ul className="space-y-2">
          {items.map((item) => {
            const p = getNotificationPresentation(item.type);
            const Icon = p.icon;
            const unread = item.readAt === null;
            const title = isKnownNotificationType(item.type)
              ? t(`items.${p.i18nKey}`)
              : t("items.fallback");
            const weight = getWeightKg(item.payload);
            const sub = [
              getCorridorLabel(item.payload),
              weight !== undefined ? `${weight} kg` : undefined,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (unread && !markRead.isPending) {
                      markRead.mutate(item.id);
                    }
                  }}
                  className={
                    "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition " +
                    (unread
                      ? "border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-900/10"
                      : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950")
                  }
                >
                  <span
                    className={
                      "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full " +
                      TONE[p.tone]
                    }
                  >
                    <Icon size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {title}
                      </span>
                      {unread && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                      )}
                    </span>
                    {sub && (
                      <span className="mt-0.5 block truncate text-sm text-slate-500 dark:text-slate-400">
                        {sub}
                      </span>
                    )}
                    <span className="mt-1 block text-xs text-slate-400 dark:text-slate-500">
                      {formatWhen(item.createdAt, nowMs, locale)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

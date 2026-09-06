"use client";

/**
 * ConversationsList.tsx — mes fils (chantier F, D61)
 * ==================================================
 * Un fil par deal, le plus actif en haut, avec le nombre de messages non lus et le prochain
 * rendez-vous s'il existe : ce qui compte pour se coordonner, visible sans ouvrir.
 */
import { useLocale, useTranslations } from "next-intl";
import { CalendarClock, MessageSquare } from "lucide-react";
import type { ConversationSummary } from "./messaging.types";

function relative(iso: string, locale: string): string {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diffMin < 1) return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(0, "minute");
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (diffMin < 60) return rtf.format(-diffMin, "minute");
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return rtf.format(-diffH, "hour");
  return rtf.format(-Math.round(diffH / 24), "day");
}

export default function ConversationsList({
  items,
  selectedId,
  onSelectAction,
}: {
  items: ConversationSummary[];
  selectedId: string | null;
  onSelectAction: (id: string) => void;
}) {
  const t = useTranslations("messaging");
  const locale = useLocale();

  if (items.length === 0) {
    return (
      <div className="p-6 text-center">
        <MessageSquare size={22} className="mx-auto text-slate-300 dark:text-slate-600" />
        <p className="mt-2 text-[13px] font-semibold text-slate-700 dark:text-slate-200">{t("list.emptyTitle")}</p>
        <p className="mt-1 text-[12.5px] text-slate-500 dark:text-slate-400">{t("list.emptyBody")}</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
      {items.map((c) => {
        const selected = c.id === selectedId;
        return (
          <li key={c.id}>
            <button
              onClick={() => onSelectAction(c.id)}
              className={`flex w-full items-start gap-3 px-3 py-3 text-left transition-colors ${
                selected ? "bg-slate-50 dark:bg-slate-800/60" : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
              }`}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[13px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {c.counterpart.firstName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-[13.5px] font-semibold text-slate-900 dark:text-white">{c.counterpart.firstName}</p>
                  {c.lastMessage && <span className="shrink-0 text-[11px] text-slate-400">{relative(c.lastMessage.createdAt, locale)}</span>}
                </div>
                <p className="truncate text-[12px] text-slate-500 dark:text-slate-400">
                  {c.corridor.originCity} → {c.corridor.destinationCity}
                </p>
                {c.lastMessage ? (
                  <p className="mt-0.5 truncate text-[12.5px] text-slate-600 dark:text-slate-300">
                    {c.lastMessage.authorRole === c.role ? `${t("list.you")} ` : ""}
                    {c.lastMessage.body}
                  </p>
                ) : (
                  <p className="mt-0.5 truncate text-[12.5px] italic text-slate-400">{t("list.noMessage")}</p>
                )}
                {c.nextMeetup && (
                  <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <CalendarClock size={10} />
                    {new Date(c.nextMeetup.startAt).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    {c.nextMeetup.status === "PROPOSED" ? ` · ${t("list.toConfirm")}` : ""}
                  </p>
                )}
              </div>
              {c.unreadCount > 0 && (
                <span className="mt-1 flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-[#FF9900] px-1.5 text-[11px] font-bold text-slate-950">
                  {c.unreadCount}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

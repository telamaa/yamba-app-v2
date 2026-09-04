"use client";

/**
 * ConversationThread.tsx — le fil (chantier F, D61)
 * ==================================================
 * Affiche ce que le serveur décide : `access.canWrite` ferme la saisie (litige en cours,
 * fenêtre de 14 jours écoulée), `phone.opensAt` dit quand le numéro s'ouvre. Le refus du code
 * de livraison remonte tel quel : c'est une règle, pas une erreur technique.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, ArrowLeft, Flag, Phone, Send } from "lucide-react";
import { useMarkConversationRead, usePostMessage, useQuickReplies, useRevealPhone, useThread } from "@/hooks/useMessaging";
import MeetupPanel from "./MeetupPanel";
import ReportMessageDialog from "./ReportMessageDialog";
import type { ChatMessage } from "./messaging.types";

function dayLabel(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
}
function timeLabel(iso: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

export default function ConversationThread({
  conversationId,
  focusPhone = false,
  onBack,
}: {
  conversationId: string;
  /** Vrai quand on arrive par « Appeler » (A137) : le numéro, ou son heure d'ouverture, est mis en avant. */
  focusPhone?: boolean;
  onBack?: () => void;
}) {
  const t = useTranslations("messaging");
  const locale = useLocale();
  const { data, isLoading } = useThread(conversationId);
  const post = usePostMessage(conversationId);
  const markRead = useMarkConversationRead(conversationId);
  const reveal = useRevealPhone(conversationId);
  const { data: quickReplies } = useQuickReplies({ enabled: !!data?.conversation.access.canWrite });
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  // F-PR3 (D61 7A) — message en cours de signalement (bulle de l'autre partie seulement)
  const [reporting, setReporting] = useState<ChatMessage | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastMessageId = data?.messages[data.messages.length - 1]?.id ?? null;

  // Marque lu à l'ouverture et à chaque nouveau message reçu.
  useEffect(() => {
    if (data && data.conversation.unreadCount >= 0) markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, lastMessageId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lastMessageId]);

  const grouped = useMemo(() => {
    const out: Array<{ day: string; items: ChatMessage[] }> = [];
    for (const m of data?.messages ?? []) {
      const day = dayLabel(m.createdAt, locale);
      const last = out[out.length - 1];
      if (last && last.day === day) last.items.push(m);
      else out.push({ day, items: [m] });
    }
    return out;
  }, [data?.messages, locale]);

  if (isLoading || !data) return <div className="p-6 text-[13px] text-slate-500 dark:text-slate-400">{t("loading")}</div>;

  const { conversation, phone } = data;
  const access = conversation.access;

  async function send(text: string) {
    const value = text.trim();
    if (!value) return;
    setError(null);
    try {
      await post.mutateAsync({ body: value });
      setBody("");
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message ?? t("sendFailed"));
    }
  }

  return (
    <div className="flex h-full min-h-[60vh] flex-col">
      <header className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        {onBack && (
          <button onClick={onBack} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden" aria-label={t("back")}>
            <ArrowLeft size={16} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-slate-900 dark:text-white">{conversation.counterpart.firstName}</p>
          <p className="truncate text-[12px] text-slate-500 dark:text-slate-400">
            {conversation.corridor.originCity} → {conversation.corridor.destinationCity}
          </p>
        </div>
        <button
          onClick={() => reveal.mutate()}
          disabled={reveal.isPending || phone.revealed}
          title={phone.revealed ? (phone.phoneE164 ?? "") : phone.opensAt ? t("phone.opensAt", { time: `${dayLabel(phone.opensAt, locale)} ${timeLabel(phone.opensAt, locale)}` }) : ""}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-[12.5px] font-medium disabled:opacity-70 dark:border-slate-700"
        >
          <Phone size={13} />
          {phone.revealed ? phone.phoneE164 ?? t("phone.hidden") : t("phone.reveal")}
        </button>
      </header>

      {focusPhone && (
        <div className="flex flex-wrap items-center gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          <Phone size={13} className="shrink-0" />
          {phone.revealed && phone.phoneE164 ? (
            <>
              <span>{t("phone.banner.ready", { name: conversation.counterpart.firstName })}</span>
              <a href={`tel:${phone.phoneE164}`} className="font-semibold underline">
                {phone.phoneE164}
              </a>
            </>
          ) : phone.opensAt && new Date(phone.opensAt).getTime() <= Date.now() ? (
            <>
              <span>{t("phone.banner.available")}</span>
              <button onClick={() => reveal.mutate()} disabled={reveal.isPending} className="font-semibold underline disabled:opacity-60">
                {t("phone.reveal")}
              </button>
            </>
          ) : phone.opensAt ? (
            <span>{t("phone.banner.opensAt", { time: `${dayLabel(phone.opensAt, locale)} ${timeLabel(phone.opensAt, locale)}` })}</span>
          ) : (
            <span>{t("phone.banner.needsMeetup")}</span>
          )}
        </div>
      )}

      <div className="border-b border-slate-200 p-3 dark:border-slate-800">
        <MeetupPanel thread={data} />
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        {grouped.length === 0 && <p className="py-8 text-center text-[13px] text-slate-500 dark:text-slate-400">{t("empty")}</p>}
        {grouped.map((group) => (
          <div key={group.day}>
            <p className="mb-2 text-center text-[11px] uppercase tracking-wide text-slate-400">{group.day}</p>
            <div className="space-y-2">
              {group.items.map((m) => {
                if (m.kind !== "TEXT") {
                  return (
                    <p key={m.id} className="text-center text-[11.5px] text-slate-500 dark:text-slate-400">
                      {m.systemKey ? t(`system.${m.systemKey}` as never, { default: m.body } as never) : m.body}
                    </p>
                  );
                }
                const mine = m.authorRole === conversation.role;
                return (
                  <div key={m.id} className={`group flex items-end gap-1 ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-3 py-2 text-[13.5px] ${
                        mine ? "bg-[#FF9900] text-slate-950" : "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className={`mt-0.5 text-right text-[10.5px] ${mine ? "text-slate-800/70" : "text-slate-500 dark:text-slate-400"}`}>{timeLabel(m.createdAt, locale)}</p>
                    </div>
                    {!mine && (
                      <button
                        type="button"
                        onClick={() => setReporting(m)}
                        aria-label={t("report.action")}
                        title={t("report.action")}
                        className="rounded-md p-1 text-slate-400 opacity-60 hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100 dark:hover:bg-slate-800"
                      >
                        <Flag size={12} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {reporting && <ReportMessageDialog conversationId={conversationId} message={reporting} onCloseAction={() => setReporting(null)} />}

      {access.canWrite ? (
        <div className="border-t border-slate-200 p-3 dark:border-slate-800">
          {quickReplies && quickReplies.length > 0 && (
            <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
              {quickReplies.map((q) => (
                <button
                  key={q.key}
                  onClick={() => void send(q.text)}
                  className="shrink-0 rounded-full border border-slate-300 px-2.5 py-1 text-[12px] text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {q.text}
                </button>
              ))}
            </div>
          )}
          {error && (
            <p className="mb-2 flex items-start gap-1.5 rounded-lg bg-red-50 px-2.5 py-2 text-[12.5px] text-red-800 dark:bg-red-950/40 dark:text-red-200">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              {error}
            </p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(body);
            }}
            className="flex items-end gap-2"
          >
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, 2000))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(body);
                }
              }}
              rows={1}
              placeholder={t("placeholder")}
              className="max-h-32 min-h-[38px] flex-1 resize-y rounded-xl border border-slate-300 px-3 py-2 text-[13.5px] dark:border-slate-700 dark:bg-slate-900"
            />
            <button
              disabled={post.isPending || !body.trim()}
              className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white disabled:opacity-40 dark:bg-white dark:text-slate-900"
              aria-label={t("send")}
            >
              <Send size={16} />
            </button>
          </form>
          <p className="mt-1.5 text-[11px] text-slate-400">{t("codeWarning")}</p>
        </div>
      ) : (
        <div className="border-t border-slate-200 p-3 text-center text-[12.5px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
          {access.reason === "DISPUTE_OPEN"
            ? t("closed.dispute")
            : access.reason === "WRITE_WINDOW_OVER"
              ? t("closed.window")
              : t("closed.generic")}
        </div>
      )}
    </div>
  );
}

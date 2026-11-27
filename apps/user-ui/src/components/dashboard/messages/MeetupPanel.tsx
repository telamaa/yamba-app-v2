"use client";

/**
 * MeetupPanel.tsx — le rendez-vous, en haut du fil (chantier F, D61 1A)
 * =====================================================================
 * Le rendez-vous est un OBJET : on le voit, on l'accepte, on en propose un autre. Le front
 * n'invente rien : il affiche ce que le serveur a validé (créneau, statut, qui a proposé) et
 * n'autorise « Accepter » que sur une proposition de l'AUTRE partie.
 *
 * D118 bis — DEUX CORRECTIONS VENUES DE L'ÉCRAN NATIF :
 *   ① aucune borne de longueur n'était posée sur le lieu (3..160) ni sur le repère
 *      (≤ 500), que le contrat refuse : on tapait jusqu'à l'échec, et le refus
 *      arrivait sur un message générique. C'est `PickupNotes` de D115 bis, replayé ;
 *   ② sur les CINQ motifs de refus de créneau, deux tombaient dans le message
 *      générique — dont `END_BEFORE_START`, l'erreur la plus probable d'un
 *      formulaire à deux `datetime-local`.
 * Les règles vivent dans `@/lib/messaging/rendez-vous` (pur, zéro import).
 */
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarClock, Check, MapPin, Plus } from "lucide-react";
import { useAcceptMeetup, useProposeMeetup } from "@/hooks/useMessaging";
import {
  DETAIL_MAX,
  LIEU_MAX,
  LIEU_MIN,
  cleDuRefusDuRendezVous,
  restantDuChamp,
} from "@/lib/messaging/rendez-vous";
import type { ConversationThread, Meetup } from "./messaging.types";

function formatSlot(startAt: string, endAt: string, locale: string): string {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const day = start.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
  const from = start.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  const to = end.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  return `${day.charAt(0).toUpperCase()}${day.slice(1)}, ${from} - ${to}`;
}

/** Champ datetime-local → ISO. Le navigateur donne une heure locale sans fuseau. */
const toIso = (value: string) => (value ? new Date(value).toISOString() : "");

export default function MeetupPanel({ thread }: { thread: ConversationThread }) {
  const t = useTranslations("messaging");
  const locale = useLocale();
  const conversationId = thread.conversation.id;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ kind: "PICKUP" as Meetup["kind"], placeLabel: "", placeDetails: "", startAt: "", endAt: "" });
  const [error, setError] = useState<string | null>(null);
  const propose = useProposeMeetup(conversationId);
  const accept = useAcceptMeetup(conversationId);

  const role = thread.conversation.role;
  const current = thread.conversation.nextMeetup;
  const canWrite = thread.conversation.access.canWrite;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await propose.mutateAsync({
        kind: form.kind,
        placeLabel: form.placeLabel.trim(),
        placeDetails: form.placeDetails.trim() || undefined,
        startAt: toIso(form.startAt),
        endAt: toIso(form.endAt),
      });
      setOpen(false);
      setForm({ ...form, placeLabel: "", placeDetails: "", startAt: "", endAt: "" });
    } catch (err) {
      // ANO-WEB-45 (recette 5.15) : les bornes (30 min / 90 j / 12 h) se disent dans la langue du lecteur,
      // à partir du `details` du refus (A146) — plus jamais le `message` anglais de l'API.
      const details = (err as { response?: { data?: { details?: { code?: string; reason?: string } } } })?.response?.data?.details;
      // D118 bis ② — LES CINQ motifs de créneau sont nommés, pas trois : un
      // refus qui tombe dans un message générique ne dit rien à celui qui
      // doit le corriger.
      const phrases: Record<string, string> = {
        ferme: t("closed.generic"),
        change: t("errors.meetupChanged"),
        sienne: t("errors.meetupSienne"),
        introuvable: t("errors.meetupIntrouvable"),
        tropTot: t("errors.meetupTooSoon"),
        tropLoin: t("errors.meetupTooFar"),
        tropLong: t("errors.meetupTooLong"),
        finAvantDebut: t("errors.meetupFinAvantDebut"),
        creneau: t("errors.meetupCreneau"),
        echec: t("meetup.proposeFailed"),
      };
      setError(phrases[cleDuRefusDuRendezVous(details?.code, details?.reason)] ?? t("meetup.proposeFailed"));
    }
  }

  const canAccept = !!current && current.status === "PROPOSED" && current.proposedByRole !== role && canWrite;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/50">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <CalendarClock size={13} />
            {t("meetup.title")}
          </p>
          {current ? (
            <div className="mt-1">
              <p className="text-[13.5px] font-semibold text-slate-900 dark:text-white">
                {t(current.kind === "PICKUP" ? "meetup.pickup" : "meetup.delivery")} · {formatSlot(current.startAt, current.endAt, locale)}
              </p>
              <p className="mt-0.5 flex items-start gap-1 text-[12.5px] text-slate-600 dark:text-slate-300">
                <MapPin size={12} className="mt-0.5 shrink-0" />
                <span>
                  {current.placeLabel}
                  {current.placeDetails ? <span className="text-slate-500 dark:text-slate-400"> — {current.placeDetails}</span> : null}
                </span>
              </p>
              <p className="mt-1 text-[11.5px]">
                {current.status === "ACCEPTED" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <Check size={11} /> {t("meetup.accepted")}
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                    {current.proposedByRole === role ? t("meetup.waitingOther") : t("meetup.toAccept")}
                  </span>
                )}
              </p>
            </div>
          ) : (
            <p className="mt-1 text-[12.5px] text-slate-500 dark:text-slate-400">{t("meetup.none")}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          {canAccept && (
            <button
              onClick={() => accept.mutate(current.id)}
              disabled={accept.isPending}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-60"
            >
              {t("meetup.accept")}
            </button>
          )}
          {canWrite && (
            <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px] dark:border-slate-700">
              <Plus size={12} />
              {current ? t("meetup.counter") : t("meetup.propose")}
            </button>
          )}
        </div>
      </div>

      {open && (
        <form onSubmit={submit} className="mt-3 grid gap-2 border-t border-slate-100 pt-3 dark:border-slate-800 sm:grid-cols-2">
          <label className="text-[12px] text-slate-600 dark:text-slate-300">
            {t("meetup.kind")}
            <select
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as Meetup["kind"] })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-[13px] dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="PICKUP">{t("meetup.pickup")}</option>
              <option value="DELIVERY">{t("meetup.delivery")}</option>
            </select>
          </label>
          <label className="text-[12px] text-slate-600 dark:text-slate-300">
            {t("meetup.place")}
            <input
              required
              minLength={LIEU_MIN}
              maxLength={LIEU_MAX}
              value={form.placeLabel}
              onChange={(e) => setForm({ ...form, placeLabel: e.target.value.slice(0, LIEU_MAX) })}
              placeholder={t("meetup.placePlaceholder")}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-[13px] dark:border-slate-700 dark:bg-slate-900"
            />
            {restantDuChamp(form.placeLabel, LIEU_MAX) !== null && (
              <span className="mt-0.5 block text-[11px] text-slate-400">
                {t("meetup.remaining", { count: restantDuChamp(form.placeLabel, LIEU_MAX) ?? 0 })}
              </span>
            )}
          </label>
          <label className="text-[12px] text-slate-600 dark:text-slate-300">
            {t("meetup.start")}
            <input required type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-[13px] dark:border-slate-700 dark:bg-slate-900" />
          </label>
          <label className="text-[12px] text-slate-600 dark:text-slate-300">
            {t("meetup.end")}
            <input required type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-[13px] dark:border-slate-700 dark:bg-slate-900" />
          </label>
          <label className="text-[12px] text-slate-600 dark:text-slate-300 sm:col-span-2">
            {t("meetup.details")}
            <input
              maxLength={DETAIL_MAX}
              value={form.placeDetails}
              onChange={(e) => setForm({ ...form, placeDetails: e.target.value.slice(0, DETAIL_MAX) })}
              placeholder={t("meetup.detailsPlaceholder")}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-[13px] dark:border-slate-700 dark:bg-slate-900"
            />
            {restantDuChamp(form.placeDetails, DETAIL_MAX) !== null && (
              <span className="mt-0.5 block text-[11px] text-slate-400">
                {t("meetup.remaining", { count: restantDuChamp(form.placeDetails, DETAIL_MAX) ?? 0 })}
              </span>
            )}
          </label>
          {error && <p className="text-[12px] text-red-600 sm:col-span-2">{error}</p>}
          <div className="flex gap-2 sm:col-span-2">
            <button disabled={propose.isPending} className="rounded-lg bg-slate-900 px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-slate-900">
              {propose.isPending ? t("meetup.sending") : t("meetup.send")}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px] dark:border-slate-700">
              {t("cancel")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/**
 * DisputedCards.tsx — les cartes de la vue « Signalement en cours » (B4-PR2, A74)
 * ===============================================================================
 * Le dossier tel que déposé (ticket, motif, description, photos, solution
 * souhaitée, date), les 4 étapes du processus et le support avec le numéro
 * à rappeler. Une seule source de vérité pour desktop et mobile.
 */
"use client";

import { LifeBuoy, ShieldAlert } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { Booking } from "../../booking-tracker.types";

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@yamba.app";

export function DisputedBanner({ booking, compact = false }: { booking: Booking; compact?: boolean }) {
  const t = useTranslations("bookingTracker.disputed");
  const format = useFormatter();
  const openedAt = booking.disputedAt ? new Date(booking.disputedAt) : null;
  const date = openedAt ? format.dateTime(openedAt, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : "";
  return (
    <div
      className={`flex items-center gap-3 border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900 ${
        compact ? "border-y px-4 py-3" : "my-5 rounded-2xl border px-5 py-4"
      }`}
    >
      <div className={`flex flex-shrink-0 items-center justify-center rounded-full bg-slate-700 text-white dark:bg-slate-600 ${compact ? "h-7 w-7" : "h-9 w-9"}`}>
        <ShieldAlert size={compact ? 15 : 18} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className={`font-semibold text-slate-900 dark:text-white ${compact ? "text-[13px]" : "text-[14px] sm:text-[15px]"}`}>
          {t("banner.title", { ticket: booking.disputeTicket ?? booking.dispute?.ticketNumber ?? "" })}
        </div>
        <div className={`text-slate-600 dark:text-slate-400 ${compact ? "text-[11px]" : "mt-0.5 text-[12px] sm:text-[13px]"}`}>
          {date ? t("banner.openedAt", { date }) : t("banner.openedNoDate")}
        </div>
      </div>
    </div>
  );
}

export function DisputeFileCard({ booking, compact = false }: { booking: Booking; compact?: boolean }) {
  const t = useTranslations("bookingTracker");
  const format = useFormatter();
  const file = booking.dispute;
  const carrierFirstName = booking.carrier.firstName;
  const recipientFirstName = booking.recipient.firstName;
  const totalPaid = new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR" }).format(booking.payment.totalPaidEur);
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 ${compact ? "p-4" : "p-5"}`}>
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {t("disputed.file.label")}
      </h3>
      {!file ? (
        <p className="mt-2 text-[13px] text-slate-600 dark:text-slate-400">{t("disputed.file.unavailable")}</p>
      ) : (
        <div className="mt-3 space-y-3">
          <Row label={t("disputed.file.ticket")} value={file.ticketNumber} strong />
          <Row
            label={t("disputed.file.category")}
            value={t("report.category." + file.category + "_short", { recipientFirstName, carrierFirstName })}
          />
          <div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{t("disputed.file.description")}</div>
            <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-slate-800 dark:text-slate-200">{file.description}</p>
          </div>
          {file.desiredOutcome && (
            <Row
              label={t("disputed.file.outcome")}
              value={t("report.outcome." + file.desiredOutcome + "_short", { carrierFirstName, amount: totalPaid })}
            />
          )}
          <Row
            label={t("disputed.file.openedAt")}
            value={format.dateTime(new Date(file.createdAt), { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          />
          {file.photoUrls.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {t("disputed.file.photos", { count: file.photoUrls.length })}
              </div>
              <div className={`mt-2 grid gap-2 ${compact ? "grid-cols-3" : "grid-cols-5"}`}>
                {file.photoUrls.map((url, i) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="relative aspect-square overflow-hidden rounded-xl ring-1 ring-slate-200 dark:ring-slate-700"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={t("disputed.file.photoAlt", { index: i + 1 })} className="absolute inset-0 h-full w-full object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{label}</span>
      <span className={`text-right text-[13px] text-slate-900 dark:text-white ${strong ? "font-black tabular-nums" : "font-medium"}`}>{value}</span>
    </div>
  );
}

export function DisputeProcessCard({ booking, compact = false }: { booking: Booking; compact?: boolean }) {
  const t = useTranslations("bookingTracker");
  const carrierFirstName = booking.carrier.firstName;
  const steps = [1, 2, 3, 4].map((n) => t(`report.process.step${n}${compact ? "Short" : ""}`, { carrierFirstName }));
  return (
    <section className={`rounded-2xl border border-blue-200 bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/25 ${compact ? "p-4" : "p-5"}`}>
      <h3 className="text-[13.5px] font-bold text-blue-950 dark:text-blue-100">{t("disputed.process.title")}</h3>
      <ol className="mt-2.5 space-y-2">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[12.5px] leading-snug text-blue-900 dark:text-blue-200">
            <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-700 text-[10px] font-bold text-white dark:bg-blue-600">
              {i + 1}
            </span>
            <span dangerouslySetInnerHTML={{ __html: bold(step) }} />
          </li>
        ))}
      </ol>
    </section>
  );
}

/** `**gras**` des textes de process (même convention que les tips). */
function bold(text: string): string {
  return text.replace(/[<>]/g, "").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

export function DisputeSupportCard({ booking, compact = false }: { booking: Booking; compact?: boolean }) {
  const t = useTranslations("bookingTracker.disputed");
  const ticket = booking.disputeTicket ?? booking.dispute?.ticketNumber ?? "";
  const subject = encodeURIComponent(`Yamba — dossier ${ticket}`);
  return (
    <section className={`rounded-2xl border border-slate-200 bg-slate-50 text-center dark:border-slate-800 dark:bg-slate-900 ${compact ? "p-4" : "p-5"}`}>
      <LifeBuoy size={18} className="mx-auto text-slate-500 dark:text-slate-400" aria-hidden="true" />
      <h3 className="mt-2 text-[13.5px] font-bold text-slate-900 dark:text-white">{t("support.title")}</h3>
      <p className="mx-auto mt-1 max-w-xs text-[12px] leading-snug text-slate-600 dark:text-slate-400">
        {t("support.text", { ticket })}
      </p>
      <a
        href={`mailto:${SUPPORT_EMAIL}?subject=${subject}`}
        className="mt-3 inline-flex min-h-[40px] items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
      >
        {SUPPORT_EMAIL}
      </a>
    </section>
  );
}

export function DisputedPaymentCard({ booking, compact = false }: { booking: Booking; compact?: boolean }) {
  const t = useTranslations("bookingTracker");
  const carrierFirstName = booking.carrier.firstName;
  const total = new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR" }).format(booking.payment.totalPaidEur);
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 ${compact ? "p-4" : "p-5"}`}>
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t("payment.title")}</h3>
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] text-slate-700 dark:text-slate-300">{t("payment.debitedLabel")}</span>
        <span className="text-[20px] font-black tabular-nums text-slate-900 dark:text-white">{total}</span>
      </div>
      <div className="my-3 border-t border-slate-100 dark:border-slate-800" />
      <div className="flex items-center justify-between text-[12px]">
        <span className="text-slate-600 dark:text-slate-400">{t("delivered.payment.stateLabel")}</span>
        <span className="font-semibold text-slate-700 dark:text-slate-300">{t("disputed.payment.stateFrozen")}</span>
      </div>
      <p className="mt-3 text-[11px] leading-snug text-slate-500 dark:text-slate-400">{t("disputed.payment.note", { carrierFirstName })}</p>
    </section>
  );
}

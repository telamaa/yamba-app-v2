/**
 * BookingReportDesktop.tsx
 * ========================
 * Desktop : back + H1 + banner bleu empathie · gauche = formulaire complet
 * + CTA bar · sidebar = LE DEAL CONCERNÉ + PHOTOS DÉJÀ AU DOSSIER + fenêtre.
 */

"use client";

import { ArrowLeft, ImageIcon, Package } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  PAYOUT_DAY,
} from "../../booking-tracker.types";
import type { BookingReportViewProps } from "./BookingReportClient";
import {
  ReportCtaBar,
  ReportEmpathyBanner,
  ReportFormBody,
} from "./ReportFormBlocks";

export default function BookingReportDesktop(props: BookingReportViewProps) {
  const t = useTranslations("bookingTracker");
  const locale = useLocale();
  const { booking } = props;

  const carrierFirstName = booking.carrier.firstName;
  const deliveredDate = booking.delivery
    ? new Date(booking.delivery.deliveredAt)
    : null;
  const deliveredDateStr = deliveredDate
    ? formatShortDate(deliveredDate, locale)
    : "";
  const windowEndStr = deliveredDate
    ? formatShortDate(
      new Date(deliveredDate.getTime() + PAYOUT_DAY * 24 * 3600 * 1000),
      locale
    )
    : "";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-4 sm:px-6 sm:pt-6">
        <button
          type="button"
          onClick={props.onBackAction}
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <ArrowLeft size={14} />
          {t("report.back")}
        </button>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          {t("report.title")}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t("report.subtitle", {
            originCity: booking.trip.originCity,
            destinationCity: booking.trip.destinationCity,
            date: deliveredDateStr,
          })}
        </p>

        <div className="my-5">
          <ReportEmpathyBanner carrierFirstName={carrierFirstName} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Main */}
          <div className="space-y-4">
            <header>
              <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                {t("report.h1")}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {t("report.h1Subtitle")}
              </p>
            </header>

            <ReportFormBody {...props} />

            <ReportCtaBar {...props} variant="desktop" />
          </div>

          {/* Sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-[88px] space-y-4">
              {/* LE DEAL CONCERNÉ */}
              <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
                <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t("report.sidebar.dealLabel")}
                </h3>
                <div className="text-[14px] font-semibold text-slate-900 dark:text-white">
                  {booking.trip.originCity} → {booking.trip.destinationCity}
                </div>
                {deliveredDate && (
                  <div className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
                    {t("report.sidebar.deliveredAt", {
                      date: deliveredDateStr,
                      time: formatTime(deliveredDate, locale),
                    })}
                  </div>
                )}
                <div className="my-3 border-t border-slate-100 dark:border-slate-800" />
                <div className="space-y-1.5">
                  <SideRow
                    label={t("report.sidebar.carrierLabel")}
                    value={
                      booking.carrier.firstName +
                      " " +
                      booking.carrier.lastInitial +
                      "."
                    }
                  />
                  <SideRow
                    label={t("report.sidebar.recipientLabel")}
                    value={
                      booking.recipient.firstName +
                      " " +
                      booking.recipient.lastName[0] +
                      "."
                    }
                  />
                  <SideRow
                    label={t("report.sidebar.totalLabel")}
                    value={formatEur(booking.payment.totalPaidEur, locale)}
                    highlight
                  />
                </div>
              </section>

              {/* PHOTOS DÉJÀ AU DOSSIER */}
              <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
                <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t("report.sidebar.proofLabel")}
                </h3>
                <p className="text-[11.5px] text-slate-500 dark:text-slate-400">
                  {t("report.sidebar.proofDeclared")}
                </p>
                <div className="mt-2 flex gap-1.5">
                  {booking.parcel.photos.map((photo) => (
                    <PhotoMini
                      key={photo.id}
                      isPackaged={photo.context === "DECLARED_PACKAGED"}
                      gradient="linear-gradient(135deg, #534AB7, #7F77DD)"
                      label={photo.label}
                    />
                  ))}
                </div>
                {booking.pickup && booking.pickup.photos.length > 0 && (
                  <>
                    <p className="mt-3.5 text-[11.5px] text-slate-500 dark:text-slate-400">
                      {t("report.sidebar.proofPickup", { carrierFirstName })}
                    </p>
                    <div className="mt-2 flex gap-1.5">
                      {booking.pickup.photos.map((photo) => (
                        <PhotoMini
                          key={photo.id}
                          isPackaged={photo.context === "PICKUP_PACKAGED"}
                          gradient="linear-gradient(135deg, #BA7517, #EF9F27)"
                          label={photo.label}
                        />
                      ))}
                    </div>
                  </>
                )}
              </section>

              {/* FENÊTRE */}
              {windowEndStr && (
                <section className="rounded-2xl bg-slate-100 p-4 dark:bg-slate-900">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {t("report.sidebar.windowLabel")}
                  </h3>
                  <p className="mt-1.5 text-[12.5px] leading-snug text-slate-600 dark:text-slate-400">
                    {t("report.sidebar.windowText", { date: windowEndStr })}
                  </p>
                </section>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function SideRow({
                   label,
                   value,
                   highlight = false,
                 }: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-[12.5px]">
      <span className="text-slate-600 dark:text-slate-400">{label}</span>
      <span
        className={
          highlight
            ? "font-bold text-slate-900 dark:text-white"
            : "font-medium text-slate-900 dark:text-white"
        }
      >
        {value}
      </span>
    </div>
  );
}

function PhotoMini({
                     isPackaged,
                     gradient,
                     label,
                   }: {
  isPackaged: boolean;
  gradient: string;
  label?: string;
}) {
  return (
    <div
      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-white"
      style={{ background: gradient }}
      aria-label={label}
      title={label}
    >
      {isPackaged ? (
        <Package size={14} aria-hidden="true" />
      ) : (
        <ImageIcon size={14} aria-hidden="true" />
      )}
    </div>
  );
}

function formatShortDate(date: Date, locale: string): string {
  const day = date.getDate();
  const month = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    month: "short",
  }).format(date);
  return locale === "fr" ? day + " " + month : month + " " + day;
}

function formatTime(date: Date, locale: string): string {
  const h = date.getHours();
  const m = date.getMinutes().toString().padStart(2, "0");
  return locale === "fr" ? h + "h" + m : h + ":" + m;
}

function formatEur(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

/**
 * RatingBlocks.tsx
 * ================
 * Blocs du module de notation :
 *  - RatingBanner : amber "Ton Deal est terminé · X €" (mobile flush)
 *  - RatingPersonCard : avatar violet/teal + stats (mobile)
 *  - RatingVisibilityNote : encart bleu visibilité (mobile)
 *  - RatingPersonDealCard : personne + deal fusionnés (sidebar desktop)
 *  - RatingPublishCard : PUBLICATION — visibilité + Publier + Plus tard
 *    (sidebar desktop, miroir de PickupConfirmCard)
 */

"use client";

import { Eye, Send, Star } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { RatingContext } from "./rating.types";

// ── Banner amber ──────────────────────────────────────────

export function RatingBanner({
                               context,
                               variant = "inset",
                             }: {
  context: RatingContext;
  variant?: "inset" | "flush" | "slim";
}) {
  const t = useTranslations("rating");
  const locale = useLocale();

  const amount = formatEur(context.amountEur, locale);
  const firstName = context.person.firstName;
  const isCarrier = context.ratedRole === "CARRIER";

  const title =
    variant === "flush"
      ? isCarrier
        ? t("banner.titleShortCARRIER", { amount })
        : t("banner.titleShortSHIPPER", { amount })
      : isCarrier
        ? t("banner.titleCARRIER", { amount, firstName })
        : t("banner.titleSHIPPER", { amount, firstName });

  const sub =
    variant === "flush"
      ? t("banner.subShort")
      : isCarrier
        ? t("banner.subCARRIER")
        : t("banner.subSHIPPER");

  const containerClass =
    variant === "flush"
      ? "flex items-center gap-3 border-y border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/30"
      : variant === "slim"
        ? "flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 dark:border-amber-900/40 dark:bg-amber-950/30"
        : "flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 dark:border-amber-900/40 dark:bg-amber-950/30";

  return (
    <div className={containerClass} role="status">
      <div
        className={
          "flex flex-shrink-0 items-center justify-center rounded-full bg-amber-600 text-white " +
          (variant === "inset" ? "h-9 w-9" : "h-7 w-7")
        }
      >
        <Star
          size={variant === "inset" ? 16 : 13}
          fill="currentColor"
          aria-hidden="true"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={
            "font-semibold text-amber-950 dark:text-amber-100 " +
            (variant === "inset" ? "text-[14px] sm:text-[15px]" : "text-[13px]")
          }
        >
          {title}
        </div>
        <div
          className={
            "text-amber-800 dark:text-amber-300 " +
            (variant === "inset"
              ? "mt-0.5 text-[12px] sm:text-[13px]"
              : "text-[11px]")
          }
        >
          {sub}
        </div>
      </div>
    </div>
  );
}

// ── Card personne (mobile) ────────────────────────────────

export function RatingPersonCard({
                                   context,
                                   compact = false,
                                 }: {
  context: RatingContext;
  compact?: boolean;
}) {
  const t = useTranslations("rating");
  const { person, ratedRole } = context;

  const initials = (person.firstName[0] + person.lastInitial).toUpperCase();
  const isCarrier = ratedRole === "CARRIER";
  const gradient = isCarrier
    ? "linear-gradient(135deg, #534AB7, #7F77DD)"
    : "linear-gradient(135deg, #1D9E75, #5DCAA5)";

  const avatarSize = compact
    ? "h-14 w-14 text-[17px]"
    : "h-16 w-16 text-[20px]";

  return (
    <section
      className={
        "flex flex-col items-center gap-2 rounded-2xl bg-slate-100 text-center dark:bg-slate-900 " +
        (compact ? "px-4 py-4" : "px-5 py-5")
      }
    >
      <div
        className={
          "flex items-center justify-center rounded-full font-semibold text-white " +
          avatarSize
        }
        style={{ background: gradient }}
        aria-hidden="true"
      >
        {initials}
      </div>
      <div
        className={
          "font-semibold text-slate-900 dark:text-white " +
          (compact ? "text-[15px]" : "text-[16px]")
        }
      >
        {person.firstName} {person.lastInitial}.
      </div>
      <div
        className={
          "flex flex-wrap items-center justify-center gap-2 text-slate-500 dark:text-slate-400 " +
          (compact ? "text-[11px]" : "text-[12px]")
        }
      >
        <span className="inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {isCarrier ? t("person.roleCARRIER") : t("person.roleSHIPPER")}
        </span>
        <span className="inline-flex items-center gap-1">
          <Star
            size={11}
            fill="currentColor"
            className="text-amber-500"
            aria-hidden="true"
          />
          {person.rating.toFixed(1)} ·{" "}
          {isCarrier
            ? t("person.dealsCARRIER", { count: person.dealCount })
            : t("person.dealsSHIPPER", { count: person.dealCount })}
        </span>
      </div>
    </section>
  );
}

// ── Encart visibilité (mobile) ────────────────────────────

export function RatingVisibilityNote({
                                       context,
                                       compact = false,
                                     }: {
  context: RatingContext;
  compact?: boolean;
}) {
  const t = useTranslations("rating");

  const text = compact
    ? t("visibility.textShort", { ratedFirstName: context.person.firstName })
    : t("visibility.text", {
      ratedFirstName: context.person.firstName,
      raterName: context.raterName,
    });

  return (
    <div
      className={
        "flex items-start gap-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 sm:rounded-2xl " +
        (compact ? "px-3.5 py-3" : "px-4 py-3.5")
      }
    >
      <Eye
        size={14}
        className="mt-0.5 flex-shrink-0 text-blue-700 dark:text-blue-400"
        aria-hidden="true"
      />
      <p
        className={
          "leading-relaxed text-blue-800 dark:text-blue-300 " +
          (compact ? "text-[11px]" : "text-[12px]")
        }
      >
        {parseBold(text)}
      </p>
    </div>
  );
}

// ── Card personne + deal fusionnés (sidebar desktop) ──────

export function RatingPersonDealCard({ context }: { context: RatingContext }) {
  const t = useTranslations("rating");
  const locale = useLocale();
  const { person, ratedRole } = context;

  const initials = (person.firstName[0] + person.lastInitial).toUpperCase();
  const isCarrier = ratedRole === "CARRIER";
  const gradient = isCarrier
    ? "linear-gradient(135deg, #534AB7, #7F77DD)"
    : "linear-gradient(135deg, #1D9E75, #5DCAA5)";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex flex-col items-center gap-2 text-center">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full text-[20px] font-semibold text-white"
          style={{ background: gradient }}
          aria-hidden="true"
        >
          {initials}
        </div>
        <div className="text-[16px] font-semibold text-slate-900 dark:text-white">
          {person.firstName} {person.lastInitial}.
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 text-[12px] text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {isCarrier ? t("person.roleCARRIER") : t("person.roleSHIPPER")}
          </span>
          <span className="inline-flex items-center gap-1">
            <Star
              size={11}
              fill="currentColor"
              className="text-amber-500"
              aria-hidden="true"
            />
            {person.rating.toFixed(1)} ·{" "}
            {isCarrier
              ? t("person.dealsCARRIER", { count: person.dealCount })
              : t("person.dealsSHIPPER", { count: person.dealCount })}
          </span>
        </div>
      </div>

      {/* Deal fusionné */}
      <div className="mt-4 border-t border-slate-100 pt-3.5 dark:border-slate-800">
        <div className="flex items-center justify-between text-[12.5px]">
          <span className="text-slate-600 dark:text-slate-400">
            {context.originCity} → {context.destinationCity}
          </span>
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
            {t("sidebar.completedBadge")}
          </span>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[12.5px]">
          <span className="text-slate-600 dark:text-slate-400">
            {isCarrier
              ? t("sidebar.amountPaidLabel")
              : t("sidebar.amountReceivedLabel")}
          </span>
          <span className="font-bold text-slate-900 dark:text-white">
            {formatEur(context.amountEur, locale)}
          </span>
        </div>
      </div>
    </section>
  );
}

// ── Card PUBLICATION (sidebar desktop) ────────────────────

export function RatingPublishCard({
                                    context,
                                    canPublish,
                                    isSubmitting,
                                    onPublishAction,
                                    onLaterAction,
                                  }: {
  context: RatingContext;
  canPublish: boolean;
  isSubmitting: boolean;
  onPublishAction: () => void;
  onLaterAction: () => void;
}) {
  const t = useTranslations("rating");

  const visibilityText = t("visibility.textShort", {
    ratedFirstName: context.person.firstName,
  }).replace(/\*\*/g, "");

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {t("sidebar.publishLabel")}
      </h3>

      <div className="flex items-start gap-2 text-[12px] leading-relaxed text-slate-600 dark:text-slate-400">
        <Eye
          size={14}
          className="mt-0.5 flex-shrink-0 text-blue-600 dark:text-blue-400"
          aria-hidden="true"
        />
        <span>{visibilityText}</span>
      </div>

      <div className="mt-4 space-y-2.5">
        <button
          type="button"
          onClick={onPublishAction}
          disabled={!canPublish || isSubmitting}
          className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[#FF9900] px-4 text-[13.5px] font-bold text-slate-950 transition-colors hover:bg-[#F08700] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
        >
          <Send size={14} aria-hidden="true" />
          {isSubmitting ? t("cta.publishing") : t("cta.publish")}
        </button>
        {!canPublish && (
          <p className="text-center text-[11px] text-slate-400 dark:text-slate-500">
            {t("sidebar.starsRequiredHint")}
          </p>
        )}
        <button
          type="button"
          onClick={onLaterAction}
          disabled={isSubmitting}
          className="inline-flex min-h-[40px] w-full items-center justify-center rounded-xl text-[12.5px] font-semibold text-slate-500 transition-colors hover:text-slate-900 disabled:opacity-50 dark:text-slate-400 dark:hover:text-white"
        >
          {t("cta.later")}
        </button>
      </div>
    </section>
  );
}

// ── helpers ───────────────────────────────────────────────

function parseBold(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold text-blue-900 dark:text-blue-200">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    )
  );
}

function formatEur(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

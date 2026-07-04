/**
 * ReportFormBlocks.tsx
 * ====================
 * - ReportFormBody : les 4 blocs + process + pledge (partagé desktop/mobile)
 * - ReportCtaBar : info + Annuler/Envoyer + confirmation inline
 */

"use client";

import { HeartHandshake, Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { BookingReportViewProps } from "./BookingReportClient";
import {
  DISPUTE_MIN_DESCRIPTION_LENGTH,
} from "../../booking-tracker.types";
import ReportBlock from "./ReportBlock";
import ReportDescriptionBlock from "./ReportDescriptionBlock";
import { ReportPledge, ReportProcessInfo } from "./ReportInfoBlocks";
import ReportPhotosBlock from "./ReportPhotosBlock";
import ReportRadioGroup from "./ReportRadioGroup";

const CATEGORY_IDS = [
  "NOT_DELIVERED",
  "CONTENT_MISSING",
  "DAMAGED",
  "SIGNIFICANT_DELAY",
  "RECIPIENT_ISSUE",
  "OTHER",
] as const;

const OUTCOME_IDS = [
  "FULL_REFUND",
  "PARTIAL_REFUND",
  "CONTACT_CARRIER",
  "YAMBA_DECIDES",
] as const;

export function ReportFormBody(
  props: BookingReportViewProps & { compact?: boolean }
) {
  const t = useTranslations("bookingTracker");
  const locale = useLocale();
  const { booking, compact = false } = props;

  const carrierFirstName = booking.carrier.firstName;
  const recipientFirstName = booking.recipient.firstName;
  const totalPaid = formatEur(booking.payment.totalPaidEur, locale);

  const categoryOptions = CATEGORY_IDS.map((id) => ({
    id,
    label: compact
      ? t("report.category." + id + "_short", { recipientFirstName, carrierFirstName })
      : t("report.category." + id, { recipientFirstName, carrierFirstName }),
  }));

  const outcomeOptions = OUTCOME_IDS.map((id) => ({
    id,
    label: compact
      ? t("report.outcome." + id + "_short", { carrierFirstName, amount: totalPaid })
      : t("report.outcome." + id, { carrierFirstName, amount: totalPaid }),
  }));

  const descriptionDone =
    props.description.trim().length >= DISPUTE_MIN_DESCRIPTION_LENGTH;

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {/* Bloc 1 — Catégorie */}
      <ReportBlock
        num={1}
        state={props.category ? "done" : "active"}
        title={
          compact ? t("report.category.titleShort") : t("report.category.title")
        }
        badge="required"
        badgeLabel={t("report.requiredBadge")}
        sub={compact ? undefined : t("report.category.sub")}
        compact={compact}
      >
        <ReportRadioGroup
          name={t("report.category.title")}
          options={categoryOptions}
          selectedId={props.category}
          onSelectAction={props.onCategoryAction}
          compact={compact}
        />
      </ReportBlock>

      {/* Bloc 2 — Description */}
      <ReportBlock
        num={2}
        state={descriptionDone ? "done" : props.category ? "active" : "idle"}
        title={
          compact
            ? t("report.description.titleShort")
            : t("report.description.title")
        }
        badge="required"
        badgeLabel={t("report.requiredBadge")}
        sub={
          compact
            ? t("report.description.subShort")
            : t("report.description.sub")
        }
        compact={compact}
      >
        <ReportDescriptionBlock
          value={props.description}
          recipientFirstName={recipientFirstName}
          onChangeAction={props.onDescriptionAction}
          compact={compact}
        />
      </ReportBlock>

      {/* Bloc 3 — Photos */}
      <ReportBlock
        num={3}
        state={props.photos.length > 0 ? "done" : "idle"}
        title={compact ? t("report.photos.titleShort") : t("report.photos.title")}
        badge="recommended"
        badgeLabel={t("report.recommendedBadge")}
        sub={compact ? t("report.photos.subShort") : t("report.photos.sub")}
        compact={compact}
      >
        <ReportPhotosBlock
          photos={props.photos}
          recipientFirstName={recipientFirstName}
          onAddAction={props.onAddPhotoAction}
          onRemoveAction={props.onRemovePhotoAction}
          compact={compact}
        />
      </ReportBlock>

      {/* Bloc 4 — Solution souhaitée */}
      <ReportBlock
        num={4}
        state={props.outcome ? "done" : "idle"}
        title={compact ? t("report.outcome.titleShort") : t("report.outcome.title")}
        badge="optional"
        badgeLabel={t("report.optionalBadge")}
        sub={compact ? undefined : t("report.outcome.sub")}
        compact={compact}
      >
        <ReportRadioGroup
          name={t("report.outcome.title")}
          options={outcomeOptions}
          selectedId={props.outcome}
          onSelectAction={props.onOutcomeAction}
          compact={compact}
        />
      </ReportBlock>

      {/* Process + Pledge */}
      <ReportProcessInfo carrierFirstName={carrierFirstName} compact={compact} />
      <ReportPledge
        checked={props.pledgeAccepted}
        onToggleAction={props.onPledgeToggleAction}
        compact={compact}
      />
    </div>
  );
}

export function ReportCtaBar(
  props: BookingReportViewProps & { variant: "desktop" | "mobile" }
) {
  const t = useTranslations("bookingTracker");
  const carrierFirstName = props.booking.carrier.firstName;

  // Confirmation inline
  if (props.confirming) {
    return (
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
        <div className="text-[14px] font-semibold text-amber-950 dark:text-amber-100">
          {t("report.cta.confirmTitle")}
        </div>
        <p className="mt-1 text-[12.5px] leading-snug text-amber-900/85 dark:text-amber-200/85">
          {t("report.cta.confirmText", { carrierFirstName })}
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={props.onCancelConfirmAction}
            disabled={props.isSubmitting}
            className="flex-1 rounded-xl border border-amber-300 bg-white px-3 py-2.5 text-[13px] font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:bg-transparent dark:text-amber-200"
          >
            {t("report.cta.confirmCancel")}
          </button>
          <button
            type="button"
            onClick={props.onConfirmSubmitAction}
            disabled={props.isSubmitting}
            className="flex-1 rounded-xl bg-[#FF9900] px-3 py-2.5 text-[13px] font-bold text-slate-950 hover:bg-[#F08700] disabled:opacity-50"
          >
            {props.isSubmitting
              ? t("report.cta.submitting")
              : t("report.cta.confirmYes")}
          </button>
        </div>
      </div>
    );
  }

  const isMobileBar = props.variant === "mobile";

  return (
    <div
      className={
        isMobileBar
          ? "flex flex-col gap-2.5"
          : "flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900"
      }
    >
      <p
        className={
          "leading-snug text-slate-500 dark:text-slate-400 " +
          (isMobileBar ? "text-center text-[11px]" : "flex-1 text-[12px]")
        }
      >
        {isMobileBar ? t("report.cta.infoShort") : t("report.cta.info")}
      </p>
      <div className={isMobileBar ? "flex gap-2" : "flex flex-shrink-0 gap-2.5"}>
        <button
          type="button"
          onClick={props.onBackAction}
          className={
            "inline-flex min-h-[46px] items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-[13.5px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 " +
            (isMobileBar ? "flex-1" : "")
          }
        >
          {t("report.cta.cancel")}
        </button>
        <button
          type="button"
          onClick={props.onRequestSubmitAction}
          disabled={!props.canSubmit}
          className={
            "inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[#FF9900] px-5 text-[13.5px] font-bold text-slate-950 transition-colors hover:bg-[#F08700] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-500 " +
            (isMobileBar ? "flex-[2]" : "")
          }
        >
          <Send size={14} aria-hidden="true" />
          {isMobileBar ? t("report.cta.submitShort") : t("report.cta.submit")}
        </button>
      </div>
    </div>
  );
}

export function ReportEmpathyBanner({
                                      carrierFirstName,
                                      variant = "inset",
                                    }: {
  carrierFirstName: string;
  variant?: "inset" | "flush";
}) {
  const t = useTranslations("bookingTracker");

  const containerClass =
    variant === "flush"
      ? "flex items-center gap-3 border-y border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-900/50 dark:bg-blue-950/30"
      : "flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 dark:border-blue-900/40 dark:bg-blue-950/30";

  return (
    <div className={containerClass} role="status">
      <div
        className={
          "flex flex-shrink-0 items-center justify-center rounded-full bg-blue-700 text-white dark:bg-blue-600 " +
          (variant === "flush" ? "h-7 w-7" : "h-9 w-9")
        }
      >
        <HeartHandshake size={variant === "flush" ? 14 : 18} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={
            "font-semibold text-blue-950 dark:text-blue-100 " +
            (variant === "flush" ? "text-[13px]" : "text-[14px] sm:text-[15px]")
          }
        >
          {t("report.banner.title")}
        </div>
        <div
          className={
            "text-blue-800 dark:text-blue-300 " +
            (variant === "flush"
              ? "text-[11px]"
              : "mt-0.5 text-[12px] sm:text-[13px]")
          }
        >
          {variant === "flush"
            ? t("report.banner.textShort", { carrierFirstName })
            : t("report.banner.text", { carrierFirstName })}
        </div>
      </div>
    </div>
  );
}

function formatEur(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

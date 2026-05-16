"use client";

import { ArrowLeft } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useBookingDraft } from "@/hooks/useBookingDraft";
import { createDeal } from "@/services/booking.api";
import {
  canContinueStep,
  computeTotal,
  getFirstAcceptedCategory,
  validateStep,
} from "./booking.config";
import type { Step, TripContext, ValidationErrors } from "./booking.types";
import BookingStepperDesktop from "./BookingStepperDesktop";
import BookingSummarySidebar from "./BookingSummarySidebar";
import StepCharter from "./steps/StepCharter";
import StepParcel from "./steps/StepParcel";
import StepPayment from "./steps/StepPayment";
import StepRecipient from "./steps/StepRecipient";

const EMPTY_ERRORS: ValidationErrors = {};

type Props = {
  trip: TripContext;
  onCloseAction: () => void;
};

export default function BookingWizard({ trip, onCloseAction }: Props) {
  const t = useTranslations("booking");
  const locale = useLocale();
  const isFr = locale === "fr";

  const { draft, setDraft, step, setStep, clear } = useBookingDraft();
  const [showErrors, setShowErrors] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Normalize category if not accepted by this trip
  useEffect(() => {
    if (!trip.acceptedCategories.includes(draft.category)) {
      setDraft((prev) => ({ ...prev, category: getFirstAcceptedCategory(trip) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.tripId]);

  const errors = useMemo<ValidationErrors>(() => {
    if (!showErrors) return EMPTY_ERRORS;
    return validateStep(step, draft, trip, isFr);
  }, [showErrors, step, draft, trip, isFr]);

  useEffect(() => {
    setShowErrors(false);
  }, [step]);

  const price = useMemo(() => computeTotal(draft, trip), [draft, trip]);

  const goToStep = (target: Step) => {
    setShowErrors(false);
    setStep(target);
  };

  const nextStep = () => {
    if (!canContinueStep(step, draft, trip, isFr)) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    setStep((s) => (s < 4 ? ((s + 1) as Step) : s));
  };

  const prevStep = () => {
    setStep((s) => (s > 1 ? ((s - 1) as Step) : s));
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await createDeal(draft, trip);
      toast.success(
        isFr
          ? `Demande envoyée (mock — id : ${result.dealId})`
          : `Request sent (mock — id: ${result.dealId})`,
        { duration: 4500 }
      );
      clear();
      onCloseAction();
    } catch {
      toast.error(isFr ? "Erreur lors de l'envoi" : "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const subtitle = `${trip.originCity} → ${trip.destinationCity} · ${formatDate(
    trip.departureDate,
    locale
  )}`;

  const ctaLabel =
    step === 4
      ? t("pay", { amount: formatPrice(price.total, locale) })
      : step === 3
        ? t("goToPayment")
        : t("continue");

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-4 sm:px-6 sm:pt-6">
      {/* Back link */}
      <button
        type="button"
        onClick={onCloseAction}
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
      >
        <ArrowLeft size={14} />
        {t("backToTrip")}
      </button>

      {/* Page title */}
      <header className="mb-6">
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {subtitle}
        </p>
      </header>

      {/* Stepper */}
      <div className="mb-6">
        <BookingStepperDesktop current={step} onStepClickAction={goToStep} />
      </div>

      {/* Body: 2 cols */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06),0_2px_8px_-2px_rgba(0,0,0,0.04)] dark:border-slate-800 dark:bg-slate-950 sm:p-7">
          {step === 1 && (
            <StepParcel
              trip={trip}
              draft={draft}
              setDraftAction={setDraft}
              errors={errors}
              hideInsurance
            />
          )}
          {step === 2 && (
            <StepRecipient
              draft={draft}
              setDraftAction={setDraft}
              errors={errors}
            />
          )}
          {step === 3 && (
            <StepCharter
              draft={draft}
              setDraftAction={setDraft}
              errors={errors}
            />
          )}
          {step === 4 && (
            <StepPayment
              draft={draft}
              setDraftAction={setDraft}
              price={price}
            />
          )}
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-[88px]">
            <BookingSummarySidebar
              trip={trip}
              draft={draft}
              setDraftAction={setDraft}
              price={price}
              currentStep={step}
              ctaPrimaryLabel={ctaLabel}
              ctaPrimaryDisabled={isSubmitting}
              ctaIsLock={step === 4}
              onCtaPrimaryAction={step < 4 ? nextStep : handleSubmit}
              showBackButton={step > 1}
              onBackAction={prevStep}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

function formatDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

function formatPrice(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

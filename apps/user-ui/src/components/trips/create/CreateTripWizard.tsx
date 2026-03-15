"use client";

import { useEffect, useMemo, useState } from "react";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";
import { Draft, MobileScreen, Step } from "./create-trip.types";
import { initialDraft } from "./create-trip.state";
import { getCategoryOptions, getCreateTripCopy } from "./create-trip.copy";
import { createDefaultCategoryCondition } from "./create-trip.config";
import CreateTripWizardSkeleton from "./CreateTripWizardSkeleton";
import TripProgressBar from "./TripProgressBar";
import TripSummarySidebar from "./TripSummarySidebar";
import StepTrip from "./steps/StepTrip";
import StepConditionsSimple from "./steps/StepConditionsSimple";
import StepPublish from "./steps/StepPublish";
import TripMobileHeader from "./mobile/TripMobileHeader";
import TripMobileBottomBar from "./mobile/TripMobileBottomBar";
import TripMobileOverlay from "./mobile/TripMobileOverlay";

export default function CreateTripWizard() {
  const { lang } = useUiPreferences();
  const isFr = lang === "fr";

  const copy = useMemo(() => getCreateTripCopy(isFr), [isFr]);
  const categoryOptions = useMemo(() => getCategoryOptions(isFr), [isFr]);

  const [step, setStep] = useState<Step>(1);
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [mobileScreen, setMobileScreen] = useState<MobileScreen>(null);
  const [mounted, setMounted] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    const t = setTimeout(() => setIsPageLoading(false), 700);
    return () => clearTimeout(t);
  }, []);

  const pathTypeLabel = useMemo(() => {
    if (draft.transportMode === "plane") {
      if (draft.flightType === "direct") return copy.directFlight;
      if (draft.flightType === "withLayover") return copy.withLayover;
    }

    if (draft.transportMode === "train") {
      if (draft.trainTripType === "direct") return copy.directTrain;
      if (draft.trainTripType === "withConnection") return copy.withConnection;
      if (draft.trainTripType === "withIntermediateStops") return copy.withIntermediateStops;
    }

    if (draft.transportMode === "car") {
      if (draft.carTripFlexibility === "direct") return copy.directTrip;
      if (draft.carTripFlexibility === "detourByAgreement") return copy.detourByAgreement;
    }

    return copy.emptyValue;
  }, [copy, draft]);

  const canContinue = useMemo(() => {
    if (step === 1) {
      const hasBase =
        !!draft.transportMode &&
        !!draft.from &&
        !!draft.to &&
        !!draft.departureDate &&
        !!draft.arrivalDate;

      if (!hasBase) return false;

      if (draft.transportMode === "plane") return !!draft.flightType;
      if (draft.transportMode === "train") return !!draft.trainTripType;
      if (draft.transportMode === "car") return !!draft.carTripFlexibility;

      return true;
    }

    if (step === 2) {
      if (draft.acceptedCategories.length === 0) return false;

      return draft.acceptedCategories.every((categoryKey) => {
        const condition = draft.categoryConditions[categoryKey];

        return (
          !!condition &&
          condition.priceAmount !== "" &&
          condition.handoffMoments.length > 0 &&
          condition.pickupMoments.length > 0
        );
      });
    }

    return true;
  }, [draft, step]);

  const toggleCategory = (value: Draft["acceptedCategories"][number]) => {
    setDraft((prev) => {
      const alreadySelected = prev.acceptedCategories.includes(value);

      if (alreadySelected) {
        const nextAcceptedCategories = prev.acceptedCategories.filter((item) => item !== value);
        const nextCategoryConditions = { ...prev.categoryConditions };
        delete nextCategoryConditions[value];

        return {
          ...prev,
          acceptedCategories: nextAcceptedCategories,
          categoryConditions: nextCategoryConditions,
        };
      }

      return {
        ...prev,
        acceptedCategories: [...prev.acceptedCategories, value],
        categoryConditions: {
          ...prev.categoryConditions,
          [value]:
            prev.categoryConditions[value] ?? createDefaultCategoryCondition(value),
        },
      };
    });
  };

  const nextStep = () => {
    if (!canContinue) return;
    setStep((prev) => (prev < 3 ? ((prev + 1) as Step) : prev));
  };

  const prevStep = () => {
    setStep((prev) => (prev > 1 ? ((prev - 1) as Step) : prev));
  };

  const saveDraft = () => {
    console.log("save draft", draft);
  };

  const publishTrip = () => {
    console.log("publish trip", draft);
  };

  if (isPageLoading) {
    return <CreateTripWizardSkeleton step={step} />;
  }

  return (
    <>
      <div className="md:hidden">
        <TripMobileHeader
          copy={copy}
          draft={draft}
          isFr={isFr}
          step={step}
          pathTypeLabel={pathTypeLabel}
        />
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6 pt-[154px] pb-[104px] md:py-6 md:pt-6 md:pb-6">
        <header className="mb-6 hidden md:block">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            {copy.title}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{copy.subtitle}</p>
          <TripProgressBar step={step} steps={copy.steps} />
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="p-0">
            {step === 1 && (
              <StepTrip
                copy={copy}
                isFr={isFr}
                draft={draft}
                setDraft={setDraft}
                pathTypeLabel={pathTypeLabel}
                setMobileScreen={setMobileScreen}
              />
            )}

            {step === 2 && (
              <StepConditionsSimple
                copy={copy}
                draft={draft}
                setDraft={setDraft}
                categoryOptions={categoryOptions}
                toggleCategory={toggleCategory}
                setMobileScreen={setMobileScreen}
              />
            )}

            {step === 3 && (
              <StepPublish
                copy={copy}
                draft={draft}
                isFr={isFr}
                pathTypeLabel={pathTypeLabel}
                categoryOptions={categoryOptions}
              />
            )}

            <div className="mt-8 hidden items-center justify-between gap-3 md:flex">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={prevStep}
                  disabled={step === 1}
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                >
                  {copy.back}
                </button>

                <button
                  type="button"
                  onClick={saveDraft}
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                >
                  {copy.saveDraft}
                </button>
              </div>

              {step < 3 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  disabled={!canContinue}
                  className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#FF9900] px-6 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {copy.continue}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={publishTrip}
                  className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#FF9900] px-6 text-sm font-semibold text-slate-900"
                >
                  {copy.publish}
                </button>
              )}
            </div>
          </section>

          <div className="hidden lg:block">
            <TripSummarySidebar
              copy={copy}
              draft={draft}
              isFr={isFr}
              pathTypeLabel={pathTypeLabel}
            />
          </div>
        </div>
      </main>

      <TripMobileBottomBar
        copy={copy}
        step={step}
        canContinue={canContinue}
        onBack={prevStep}
        onNext={nextStep}
        onPublish={publishTrip}
      />

      <TripMobileOverlay
        mounted={mounted}
        mobileScreen={mobileScreen}
        onClose={() => setMobileScreen(null)}
        copy={copy}
        isFr={isFr}
        draft={draft}
        setDraft={setDraft}
        categoryOptions={categoryOptions}
        toggleCategory={toggleCategory}
      />
    </>
  );
}

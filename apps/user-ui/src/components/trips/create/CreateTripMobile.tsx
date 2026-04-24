"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";
import { useCreateTrip, useUpdateTrip } from "@/hooks/useTrip";
import { useEditTrip } from "@/hooks/useEditTrip";
import { setFlashToast } from "@/lib/flash-toast";
import type { Draft, ParcelCategory, Step } from "./create-trip.types";
import { initialDraft } from "./create-trip.state";
import { getCreateTripCopy } from "./create-trip.copy";
import {
  canContinueStep,
  createDefaultCategoryCondition,
  validateStep1,
  validateStep2,
  saveDraftToStorage,
  loadDraftFromStorage,
  clearDraftStorage,
  type ValidationErrors,
} from "./create-trip.config";
import { ErrorSummary } from "./TripFormUi";
import TripLiveSummary from "./TripLiveSummary";
import StepTrip from "./steps/StepTrip";
import StepConditions from "./steps/StepConditions";
import StepReview from "./steps/StepReview";
import MobileBottomBar from "./mobile/MobileBottomBar";
import useUser from "@/hooks/useUser";

const MANGO = "#FF9900";
const EMPTY_ERRORS: ValidationErrors = {};

export default function CreateTripMobile() {
  const { lang } = useUiPreferences();
  const router = useRouter();
  const isFr = lang === "fr";
  const copy = useMemo(() => getCreateTripCopy(isFr), [isFr]);

  const [step, setStep] = useState<Step>(1);
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [showExitGuard, setShowExitGuard] = useState(false);
  const [shakeFields, setShakeFields] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const { user } = useUser();

  // ── API ──
  const createTrip = useCreateTrip();
  const updateTrip = useUpdateTrip();
  const isPublishing = createTrip.isPending || updateTrip.isPending;

  // ── Edit mode ──
  const { editTripId, isEditMode, editDraft, isLoadingEdit } = useEditTrip();

  useEffect(() => {
    if (editDraft) setDraft(editDraft);
  }, [editDraft]);

  // ── Validation ──
  const errors = useMemo<ValidationErrors>(() => {
    if (!showErrors) return EMPTY_ERRORS;
    if (step === 1) return validateStep1(draft, isFr);
    if (step === 2) return validateStep2(draft, isFr);
    return EMPTY_ERRORS;
  }, [showErrors, step, draft, isFr]);

  useEffect(() => {
    setShowErrors(false);
  }, [step]);

  // ── Auto-save (localStorage) — only in create mode ──
  useEffect(() => {
    if (isEditMode) return;
    const interval = setInterval(() => saveDraftToStorage(draft), 10000);
    return () => clearInterval(interval);
  }, [draft, isEditMode]);

  // ── Load saved draft — only in create mode ──
  useEffect(() => {
    if (isEditMode) return;
    const saved = loadDraftFromStorage() as Draft | null;
    if (saved) {
      if (saved.departureDate) saved.departureDate = new Date(saved.departureDate);
      if (saved.arrivalDate) saved.arrivalDate = new Date(saved.arrivalDate);
      setDraft(saved);
    }
  }, [isEditMode]);

  // ── Scroll to top on step change ──
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  // ── Completion % for progress bar ──
  const completionPercent = useMemo(() => {
    if (step === 1) {
      let filled = 0;
      let total = 5;
      if (draft.transportMode) filled++;
      if (draft.from) filled++;
      if (draft.to) filled++;
      if (draft.departureDate) filled++;
      if (draft.arrivalDate) filled++;
      if (draft.transportMode === "plane") { total++; if (draft.flightType) filled++; }
      if (draft.transportMode === "train") { total++; if (draft.trainTripType) filled++; }
      if (draft.transportMode === "car") { total++; if (draft.carTripFlexibility) filled++; }
      return Math.round((filled / total) * 100);
    }
    if (step === 2) {
      const total = 1 + draft.acceptedCategories.length * 3;
      let filled = 0;
      if (draft.acceptedCategories.length > 0) filled++;
      draft.acceptedCategories.forEach((key) => {
        const c = draft.categoryConditions[key];
        if (c) {
          if (c.priceAmount !== "") filled++;
          if (c.handoffMoments.length > 0) filled++;
          if (c.pickupMoments.length > 0) filled++;
        }
      });
      return total > 0 ? Math.round((filled / total) * 100) : 0;
    }
    return 100;
  }, [draft, step]);

  // ── Category toggle ──
  const toggleCategory = useCallback((value: ParcelCategory) => {
    setDraft((prev) => {
      const has = prev.acceptedCategories.includes(value);
      if (has) {
        const nextCats = prev.acceptedCategories.filter((c) => c !== value);
        const nextConds = { ...prev.categoryConditions };
        delete nextConds[value];
        return { ...prev, acceptedCategories: nextCats, categoryConditions: nextConds };
      }
      return {
        ...prev,
        acceptedCategories: [...prev.acceptedCategories, value],
        categoryConditions: {
          ...prev.categoryConditions,
          [value]: prev.categoryConditions[value] ?? createDefaultCategoryCondition(value),
        },
      };
    });
  }, []);

  // ── Navigation ──
  const goTo = (target: Step) => {
    setDirection(target > step ? "forward" : "backward");
    setStep(target);
  };

  const nextStep = () => {
    if (!canContinueStep(step, draft, isFr)) {
      setShowErrors(true);
      setShakeFields(true);
      setTimeout(() => setShakeFields(false), 600);
      return;
    }
    setShowErrors(false);
    setDirection("forward");
    setStep((prev) => (prev < 3 ? ((prev + 1) as Step) : prev));
  };

  const prevStep = () => {
    setDirection("backward");
    setStep((prev) => (prev > 1 ? ((prev - 1) as Step) : prev));
  };

  const handleClose = () => {
    const hasProgress = draft.transportMode || draft.from || draft.to || draft.acceptedCategories.length > 0;
    if (hasProgress && completionPercent > 30) {
      setShowExitGuard(true);
    } else {
      router.back();
    }
  };

  // ── Save draft (localStorage) ──
  const handleSaveDraft = () => {
    saveDraftToStorage(draft);
    toast.success(isFr ? "Brouillon sauvegardé" : "Draft saved", { closeButton: true });
  };

  // ── Publish / Update trip (API) ──
  const handlePublish = async () => {
    // ── Gate: save as draft if onboarding OR Stripe not done ──
    const carrierPage = (user as any)?.carrierPage;
    const hasOnboarding =
      carrierPage?.onboardingStep === "STRIPE" ||
      carrierPage?.onboardingStep === "COMPLETE";
    const stripeReady =
      carrierPage?.stripeOnboardingComplete && carrierPage?.stripeChargesEnabled;

    if (!hasOnboarding || !stripeReady) {
      const onSuccess = () => {
        clearDraftStorage();
        setFlashToast({
          type: "onboarding_required",
          message: !hasOnboarding
            ? (isFr
              ? "Votre trajet a été sauvegardé en brouillon. Configurez votre profil transporteur pour le publier."
              : "Your trip has been saved as a draft. Set up your carrier profile to publish it.")
            : (isFr
              ? "Votre trajet a été sauvegardé en brouillon. Configurez Stripe pour pouvoir le publier et recevoir des paiements."
              : "Your trip has been saved as a draft. Configure Stripe to publish it and receive payments."),
          persistent: true,
        });
        router.push("/dashboard/trips");
      };

      const onError = (err: any) => {
        const message =
          err?.response?.data?.message ||
          (isFr ? "Erreur lors de la sauvegarde" : "Failed to save draft");
        toast.error(message, { duration: Infinity, closeButton: true });
      };

      if (isEditMode && editTripId) {
        updateTrip.mutate({ tripId: editTripId, draft, publish: false }, { onSuccess, onError });
      } else {
        createTrip.mutate({ draft, publish: false }, { onSuccess, onError });
      }
      return;
    }
    // ── Fin du gate ──

    if (isEditMode && editTripId) {
      updateTrip.mutate(
        { tripId: editTripId, draft, publish: true },
        {
          onSuccess: () => {
            clearDraftStorage();
            setFlashToast({ type: "success", message: isFr ? "Trajet mis à jour avec succès !" : "Trip updated successfully!" });
            router.push("/dashboard/trips");
          },
          onError: (err: any) => {
            const message = err?.response?.data?.message || (isFr ? "Erreur lors de la mise à jour" : "Failed to update trip");
            toast.error(message, { duration: 8000, closeButton: true });
          },
        }
      );
    } else {
      createTrip.mutate(
        { draft, publish: true },
        {
          onSuccess: () => {
            clearDraftStorage();
            setFlashToast({ type: "success", message: isFr ? "Trajet publié avec succès !" : "Trip published successfully!" });
            router.push("/dashboard/trips");
          },
          onError: (err: any) => {
            const message = err?.response?.data?.message || (isFr ? "Erreur lors de la publication" : "Failed to publish trip");
            toast.error(message, { duration: 8000, closeButton: true });
          },
        }
      );
    }
  };

  // ── Loading state for edit mode ──
  if (isLoadingEdit) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-white dark:bg-slate-950 md:hidden">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-[#FF9900]" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-white dark:bg-slate-950 md:hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-900">
        <button type="button" onClick={step > 1 ? prevStep : handleClose} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 dark:text-slate-400">
          {step > 1 ? <ChevronLeft size={22} /> : <X size={22} />}
        </button>
        <div className="text-center">
          <div className="text-[13px] font-medium text-slate-900 dark:text-white">
            {isEditMode ? (isFr ? "Modifier le trajet" : "Edit trip") : copy.steps[step - 1]}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500">{step}/3</div>
        </div>
        <div className="w-9" />
      </div>

      {/* Progress bar */}
      <div className="h-[2px] w-full bg-slate-100 dark:bg-slate-900">
        <div className="h-full transition-all duration-500" style={{ width: `${((step - 1) / 3) * 100 + completionPercent / 3}%`, backgroundColor: MANGO }} />
      </div>

      {/* Content */}
      <div ref={contentRef} className={["flex-1 overflow-y-auto px-4 pb-32 pt-4", shakeFields ? "animate-[shake_0.4s_ease]" : ""].join(" ")}>
        {showErrors && <ErrorSummary errors={errors} isFr={isFr} />}
        <TripLiveSummary draft={draft} />
        <div key={step} style={{ animation: `${direction === "forward" ? "slideInRight" : "slideInLeft"} 0.2s ease` }}>
          {step === 1 && <StepTrip copy={copy} isFr={isFr} draft={draft} setDraft={setDraft} errors={errors} />}
          {step === 2 && <StepConditions copy={copy} isFr={isFr} draft={draft} setDraft={setDraft} toggleCategory={toggleCategory} errors={errors} />}
          {step === 3 && <StepReview copy={copy} isFr={isFr} draft={draft} onGoTo={goTo} />}
        </div>
      </div>

      {/* Bottom bar */}
      <MobileBottomBar
        step={step}
        canContinue={!showErrors || Object.keys(errors).length === 0}
        isPublishing={isPublishing}
        onBack={prevStep}
        onNext={nextStep}
        onPublish={handlePublish}
        onSaveDraft={isEditMode ? () => {} : handleSaveDraft}
        backLabel={copy.back}
        continueLabel={copy.continue}
        publishLabel={isEditMode ? (isFr ? "Mettre à jour" : "Update") : copy.publish}
        draftLabel={isEditMode ? "" : copy.saveDraft}
      />

      {/* Exit guard */}
      {showExitGuard && (
        <div className="fixed inset-0 z-[300] flex items-end bg-black/40">
          <div className="w-full rounded-t-2xl bg-white px-6 pb-8 pt-6 dark:bg-slate-900">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
            <h3 className="text-[16px] font-medium text-slate-900 dark:text-white">{copy.almostDone}</h3>
            <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">{copy.almostDoneSub}</p>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => { setShowExitGuard(false); if (!isEditMode) saveDraftToStorage(draft); router.back(); }} className="flex-1 rounded-lg border border-slate-200 py-3 text-[13px] text-slate-600 dark:border-slate-700 dark:text-slate-400">{copy.leave}</button>
              <button type="button" onClick={() => setShowExitGuard(false)} className="flex-1 rounded-lg py-3 text-[13px] font-medium text-slate-900" style={{ backgroundColor: MANGO }}>{copy.stayAndFinish}</button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes slideInRight { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes slideInLeft { from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes fadeSlide { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-4px); } 40% { transform: translateX(4px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(2px); } }
      `}</style>
    </div>
  );
}

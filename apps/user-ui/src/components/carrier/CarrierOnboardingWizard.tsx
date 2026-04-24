"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";
import { usePersistedFormState } from "@/hooks/usePersistedFormState";
import useUser from "@/hooks/useUser";
import apiClient from "@/lib/api-client";
import CityAutocomplete, { type PlaceDetails } from "@/components/search/CityAutocomplete";
import PhoneInput from "@/components/ui/PhoneInput";
import {
  User as UserIcon,
  CreditCard,
  Check,
  ArrowRight,
  ArrowLeft,
  Loader2,
  ExternalLink,
  AlertCircle,
} from "lucide-react";

type OnboardingStepKey = "profile" | "stripe";

type FieldErrors = {
  name?: string;
  bio?: string;
  address?: string;
  phone?: string;
};

type ProfileDraft = {
  name: string;
  bio: string;
  addressText: string;
  addressDetails: PlaceDetails | null;
  phone: string;
};

const initialProfileDraft: ProfileDraft = {
  name: "",
  bio: "",
  addressText: "",
  addressDetails: null,
  phone: "",
};

// Bump si la structure de ProfileDraft change
const ONBOARDING_VERSION = 1;

function buildCopy(isFr: boolean) {
  return {
    title: isFr ? "Devenir transporteur" : "Become a carrier",
    subtitle: isFr ? "Configurez votre espace pour publier vos premiers trajets." : "Set up your space to publish your first trips.",
    stepProfile: isFr ? "Votre profil" : "Your profile",
    stepStripe: isFr ? "Paiement" : "Payment",

    profileTitle: isFr ? "Créez votre espace transporteur" : "Create your carrier space",
    profileSubtitle: isFr ? "Ces informations seront visibles par les expéditeurs. Tous les champs sont obligatoires." : "This information will be visible to shippers. All fields are required.",

    nameLabel: isFr ? "Nom de l'espace" : "Space name",
    namePlaceholder: isFr ? "Ex : Marie D." : "Ex: Marie D.",
    nameHint: isFr ? "Pré-rempli avec votre prénom. Modifiable à tout moment." : "Pre-filled with your first name. You can change it anytime.",
    nameRequired: isFr ? "Le nom du profil est requis" : "Profile name is required",
    nameTooShort: isFr ? "Le nom doit contenir au moins 2 caractères" : "Name must be at least 2 characters",

    bioLabel: isFr ? "Bio" : "Bio",
    bioPlaceholder: isFr ? "Parlez un peu de vous, de vos trajets habituels..." : "Tell us about yourself, your usual trips...",
    bioLimit: 500,
    bioMinLength: 20,
    bioRequired: isFr ? "Décrivez-vous en quelques mots" : "Describe yourself in a few words",
    bioTooShort: isFr ? "La bio doit contenir au moins 20 caractères" : "Bio must be at least 20 characters",

    addressLabel: isFr ? "Adresse" : "Address",
    addressPlaceholder: isFr ? "Rechercher une adresse, une ville..." : "Search an address, a city...",
    addressHint: isFr ? "Seuls la ville et le pays seront visibles publiquement." : "Only the city and country will be publicly visible.",
    addressRequired: isFr ? "Sélectionnez une adresse dans la liste" : "Select an address from the list",

    phoneLabel: isFr ? "Téléphone" : "Phone",
    phoneHint: isFr ? "Utilisé uniquement pour la coordination des livraisons." : "Used only for delivery coordination.",
    phoneRequired: isFr ? "Le téléphone est requis pour la coordination" : "Phone is required for coordination",
    phoneInvalid: isFr ? "Numéro de téléphone invalide" : "Invalid phone number",

    stripeTitle: isFr ? "Recevez vos paiements" : "Receive your payments",
    stripeSubtitle: isFr ? "Connectez votre compte bancaire via Stripe pour recevoir les paiements des expéditeurs en toute sécurité." : "Connect your bank account via Stripe to securely receive payments from shippers.",
    stripeConnect: isFr ? "Connecter avec Stripe" : "Connect with Stripe",
    stripeConnecting: isFr ? "Redirection vers Stripe..." : "Redirecting to Stripe...",
    stripeSkip: isFr ? "Configurer plus tard" : "Set up later",
    stripeSkipHint: isFr ? "Vous pourrez connecter votre compte à tout moment. Vous ne pourrez pas recevoir de paiements tant que Stripe n'est pas configuré." : "You can connect your account anytime. You won't be able to receive payments until Stripe is set up.",
    stripeSecure: isFr ? "Stripe est utilisé par des millions d'entreprises. Vos données bancaires ne transitent jamais par nos serveurs." : "Stripe is used by millions of businesses. Your banking data never passes through our servers.",

    continue: isFr ? "Continuer" : "Continue",
    back: isFr ? "Retour" : "Back",
    finish: isFr ? "Terminer sans Stripe" : "Finish without Stripe",
    finishLater: isFr ? "Configurer plus tard" : "Set up later",
    saving: isFr ? "Enregistrement..." : "Saving...",

    genericError: isFr ? "Une erreur est survenue. Réessayez." : "Something went wrong. Please try again.",

    successTitle: isFr ? "Votre espace est prêt !" : "Your space is ready!",
    successSubtitle: isFr ? "Vous pouvez maintenant publier votre premier trajet." : "You can now publish your first trip.",
    publishTrip: isFr ? "Publier un trajet" : "Publish a trip",
    goHome: isFr ? "Retour à l'accueil" : "Go to homepage",
    goDashboard: isFr ? "Retour au dashboard" : "Back to dashboard",
  };
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="mt-1.5 flex items-center gap-1.5 text-[12px]" style={{ color: "#FF9900" }}>
      <AlertCircle size={12} className="flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export default function CarrierOnboardingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { lang } = useUiPreferences();
  const { user, isLoading: userLoading } = useUser();
  const isFr = lang === "fr";
  const copy = useMemo(() => buildCopy(isFr), [isFr]);

  const requestedStep = searchParams.get("step");
  const isStripeOnlyMode = requestedStep === "stripe";

  const initialStep: OnboardingStepKey = isStripeOnlyMode ? "stripe" : "profile";
  const [currentStep, setCurrentStep] = useState<OnboardingStepKey>(initialStep);
  const [isComplete, setIsComplete] = useState(false);

  // ── Persistance automatique du formulaire profil ──
  const [profile, setProfile, clearProfile] = usePersistedFormState<ProfileDraft>(
    "carrier-onboarding",
    initialProfileDraft,
    { version: ONBOARDING_VERSION }
  );

  const [errors, setErrors] = useState<FieldErrors>({});
  const [showErrors, setShowErrors] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [isStripeLoading, setIsStripeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Pré-remplissage depuis l'API utilisateur (uniquement si le form est vide) ──
  useEffect(() => {
    if (!user) return;
    const cp = (user as any).carrierPage;

    if (cp) {
      // Si on a déjà des données en sessionStorage, on ne les écrase pas
      // (sauf si les champs sont vides)
      setProfile((prev) => {
        const shouldPrefillName = !prev.name;
        const shouldPrefillBio = !prev.bio;
        const shouldPrefillPhone = !prev.phone;
        const shouldPrefillAddress = !prev.addressDetails;

        let nextAddressText = prev.addressText;
        let nextAddressDetails = prev.addressDetails;

        if (shouldPrefillAddress && cp.primaryAddress) {
          const pa = cp.primaryAddress;
          const display = pa.formattedAddress || [pa.city, pa.country].filter(Boolean).join(", ") || "";
          nextAddressText = display;
          nextAddressDetails = {
            formattedAddress: pa.formattedAddress ?? display,
            placeId: pa.placeId ?? "",
            lat: pa.lat ?? null, lng: pa.lng ?? null,
            streetLine1: pa.streetLine1 ?? null, city: pa.city ?? null,
            region: pa.region ?? null, postalCode: pa.postalCode ?? null,
            country: pa.country ?? null, countryCode: pa.countryCode ?? null,
          };
        }

        return {
          name: shouldPrefillName ? (cp.name ?? prev.name) : prev.name,
          bio: shouldPrefillBio ? (cp.bio ?? prev.bio) : prev.bio,
          phone: shouldPrefillPhone ? (cp.phoneE164 ?? (user as any).phoneE164 ?? prev.phone) : prev.phone,
          addressText: nextAddressText,
          addressDetails: nextAddressDetails,
        };
      });

      const stripeReady = cp.stripeOnboardingComplete && cp.stripeChargesEnabled;
      if (isStripeOnlyMode) {
        setCurrentStep("stripe");
        if (stripeReady) setIsComplete(true);
      } else {
        if (cp.onboardingStep === "STRIPE" || cp.onboardingStep === "COMPLETE") setCurrentStep("stripe");
        if (cp.onboardingStep === "COMPLETE" && stripeReady) setIsComplete(true);
      }
    } else {
      // Pré-remplir nom/phone uniquement si vides
      setProfile((prev) => ({
        ...prev,
        name: prev.name || `${user.firstName} ${user.lastName?.charAt(0) ?? ""}.`.trim(),
        phone: prev.phone || ((user as any).phoneE164 ?? ""),
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isStripeOnlyMode]);

  useEffect(() => {
    if (!userLoading && !user) router.push("/login?redirect=/carrier/onboarding");
  }, [user, userLoading, router]);

  useEffect(() => {
    if (isStripeOnlyMode) return;
    if (!user) return;
    const cp = (user as any).carrierPage;
    const stripeReady = cp?.stripeOnboardingComplete && cp?.stripeChargesEnabled;
    if ((user as any).carrierStatus === "ACTIVE" && stripeReady) setIsComplete(true);
  }, [user, isStripeOnlyMode]);

  // ── Field validation ──
  const validateFields = (): FieldErrors => {
    const errs: FieldErrors = {};

    const trimmedName = profile.name.trim();
    if (!trimmedName) errs.name = copy.nameRequired;
    else if (trimmedName.length < 2) errs.name = copy.nameTooShort;

    const trimmedBio = profile.bio.trim();
    if (!trimmedBio) errs.bio = copy.bioRequired;
    else if (trimmedBio.length < copy.bioMinLength) errs.bio = copy.bioTooShort;

    if (!profile.addressDetails || !profile.addressDetails.city) errs.address = copy.addressRequired;

    const trimmedPhone = profile.phone.trim();
    if (!trimmedPhone) errs.phone = copy.phoneRequired;
    else if (!trimmedPhone.startsWith("+") || trimmedPhone.length < 8) errs.phone = copy.phoneInvalid;

    return errs;
  };

  useEffect(() => {
    if (showErrors) setErrors(validateFields());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, showErrors]);

  const handleSaveProfile = async () => {
    const validationErrors = validateFields();
    setErrors(validationErrors);
    setShowErrors(true);

    if (Object.keys(validationErrors).length > 0) {
      setTimeout(() => {
        const firstError = document.querySelector("[data-field-error='true']");
        firstError?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      await apiClient.post("/carrier/onboarding/profile", {
        name: profile.name.trim(),
        bio: profile.bio.trim(),
        address: {
          formattedAddress: profile.addressDetails!.formattedAddress,
          placeId: profile.addressDetails!.placeId || undefined,
          lat: profile.addressDetails!.lat ?? undefined,
          lng: profile.addressDetails!.lng ?? undefined,
          streetLine1: profile.addressDetails!.streetLine1 || undefined,
          city: profile.addressDetails!.city || undefined,
          region: profile.addressDetails!.region || undefined,
          postalCode: profile.addressDetails!.postalCode || undefined,
          country: profile.addressDetails!.country || undefined,
          countryCode: profile.addressDetails!.countryCode || undefined,
        },
        phoneE164: profile.phone.trim(),
      }, { requireAuth: true });

      await queryClient.invalidateQueries({ queryKey: ["user"] });
      // Ne pas clear le formulaire, l'utilisateur peut vouloir revenir en arrière
      setCurrentStep("stripe");
      setShowErrors(false);
    } catch (err: any) {
      setError(err?.response?.data?.message || copy.genericError);
    } finally {
      setIsSaving(false);
    }
  };

  const handleStripeConnect = async () => {
    setError(null);
    setIsStripeLoading(true);
    try {
      const response = await apiClient.post("/carrier/onboarding/stripe", {}, { requireAuth: true });
      const { url } = response.data;
      if (url) window.location.href = url;
      else setError(copy.genericError);
    } catch (err: any) {
      setError(err?.response?.data?.message || copy.genericError);
    } finally {
      setIsStripeLoading(false);
    }
  };

  const handleSkipStripe = async () => {
    if (isStripeOnlyMode) {
      router.push("/dashboard/yamber");
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await apiClient.post("/carrier/onboarding/complete", {}, { requireAuth: true });
      await queryClient.invalidateQueries({ queryKey: ["user"] });
      clearProfile();
      setIsComplete(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || copy.genericError);
    } finally {
      setIsSaving(false);
    }
  };

  if (userLoading) return <main className="flex min-h-screen items-center justify-center"><Loader2 size={32} className="animate-spin text-[#FF9900]" /></main>;
  if (!user) return null;

  if (isComplete) {
    return (
      <main className="px-4">
        <div className="mx-auto flex min-h-[85vh] max-w-lg items-center justify-center py-10">
          <div className="w-full text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <Check size={40} className="text-green-600 dark:text-green-400" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">{copy.successTitle}</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{copy.successSubtitle}</p>
            <div className="mt-8 flex flex-col gap-3">
              <button type="button" onClick={() => router.push("/trips/create")} className="w-full rounded-lg bg-[#FF9900] px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-[#F08700]">{copy.publishTrip}</button>
              <button type="button" onClick={() => router.push(isStripeOnlyMode ? "/dashboard/yamber" : "/")} className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900">{isStripeOnlyMode ? copy.goDashboard : copy.goHome}</button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const steps = [
    { key: "profile" as const, label: copy.stepProfile, icon: UserIcon },
    { key: "stripe" as const, label: copy.stepStripe, icon: CreditCard },
  ];
  const currentIndex = steps.findIndex((s) => s.key === currentStep);

  const fieldCls = (hasError: boolean) =>
    `mt-2 w-full rounded-lg border px-4 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:ring-4 dark:bg-slate-950 dark:text-white ${
      hasError
        ? "border-[#FF9900] focus:border-[#FF9900] focus:ring-[#FF9900]/25"
        : "border-slate-200 focus:border-[#FF9900]/80 focus:ring-[#FF9900]/25 dark:border-slate-800 dark:focus:border-[#FFAE33]/70"
    }`;

  return (
    <main className="px-4">
      <div className="mx-auto max-w-lg py-10 pt-[100px]">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          {isStripeOnlyMode ? (isFr ? "Configurer Stripe" : "Configure Stripe") : copy.title}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {isStripeOnlyMode ? (isFr ? "Connectez votre compte bancaire pour recevoir vos paiements." : "Connect your bank account to receive payments.") : copy.subtitle}
        </p>

        {!isStripeOnlyMode && (
          <div className="mt-8 flex items-center gap-3">
            {steps.map((step, i) => {
              const Icon = step.icon;
              const isActive = step.key === currentStep;
              const isDone = i < currentIndex;
              return (
                <div key={step.key} className="flex flex-1 items-center gap-2">
                  <div className={["flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors", isDone ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" : isActive ? "bg-[#FF9900] text-slate-900" : "bg-slate-100 text-slate-400 dark:bg-slate-900 dark:text-slate-500"].join(" ")}>
                    {isDone ? <Check size={16} /> : <Icon size={16} />}
                  </div>
                  <span className={["text-sm font-medium", isActive ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-500"].join(" ")}>{step.label}</span>
                  {i < steps.length - 1 && <div className="mx-2 h-px flex-1 bg-slate-200 dark:bg-slate-800" />}
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </div>
        )}

        {/* ── Step 1: Profile ── */}
        {currentStep === "profile" && (
          <div className="mt-8 space-y-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{copy.profileTitle}</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{copy.profileSubtitle}</p>
            </div>

            {/* Name */}
            <div data-field-error={!!errors.name}>
              <label htmlFor="carrier-name" className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {copy.nameLabel} <span className="text-[#FF9900]">*</span>
              </label>
              <input
                id="carrier-name" type="text" value={profile.name}
                onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                placeholder={copy.namePlaceholder}
                className={fieldCls(!!errors.name)}
              />
              {errors.name
                ? <FieldError message={errors.name} />
                : <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{copy.nameHint}</p>}
            </div>

            {/* Bio */}
            <div data-field-error={!!errors.bio}>
              <label htmlFor="carrier-bio" className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {copy.bioLabel} <span className="text-[#FF9900]">*</span>
              </label>
              <div className="relative mt-2">
                <textarea
                  id="carrier-bio" value={profile.bio}
                  onChange={(e) => { if (e.target.value.length <= copy.bioLimit) setProfile((p) => ({ ...p, bio: e.target.value })); }}
                  placeholder={copy.bioPlaceholder}
                  rows={4}
                  maxLength={copy.bioLimit}
                  className={`w-full resize-none rounded-lg border px-4 py-2.5 pb-8 text-sm text-slate-900 outline-none transition-colors focus:ring-4 dark:bg-slate-950 dark:text-white ${
                    errors.bio
                      ? "border-[#FF9900] focus:border-[#FF9900] focus:ring-[#FF9900]/25"
                      : "border-slate-200 focus:border-[#FF9900]/80 focus:ring-[#FF9900]/25 dark:border-slate-800 dark:focus:border-[#FFAE33]/70"
                  }`}
                />
                <span className={["absolute bottom-2.5 right-3 text-xs", profile.bio.length > copy.bioLimit * 0.9 ? "text-red-500 dark:text-red-400" : profile.bio.length > copy.bioLimit * 0.75 ? "text-amber-500 dark:text-amber-400" : "text-slate-400 dark:text-slate-500"].join(" ")}>
                  {profile.bio.length}/{copy.bioLimit}
                </span>
              </div>
              <FieldError message={errors.bio} />
            </div>

            {/* Address */}
            <div data-field-error={!!errors.address}>
              <label className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {copy.addressLabel} <span className="text-[#FF9900]">*</span>
              </label>
              <div className={`relative z-[50] mt-2 rounded-lg border px-4 py-2.5 dark:bg-slate-950 ${
                errors.address ? "border-[#FF9900]" : "border-slate-200 dark:border-slate-800 bg-white"
              }`}>
                <CityAutocomplete
                  value={profile.addressText}
                  action={(v) => {
                    setProfile((p) => ({
                      ...p,
                      addressText: v,
                      addressDetails: v.trim() ? p.addressDetails : null,
                    }));
                  }}
                  onPlaceSelect={(details) => {
                    setProfile((p) => ({
                      ...p,
                      addressText: details.formattedAddress,
                      addressDetails: details,
                    }));
                  }}
                  placeholder={copy.addressPlaceholder}
                  language={isFr ? "fr" : "en"}
                  inputClassName="text-sm"
                  dropdownInline
                />
              </div>
              {errors.address
                ? <FieldError message={errors.address} />
                : <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{copy.addressHint}</p>}
            </div>

            {/* Phone */}
            <div data-field-error={!!errors.phone}>
              <PhoneInput
                value={profile.phone}
                action={(v) => setProfile((p) => ({ ...p, phone: v }))}
                defaultCountry={profile.addressDetails?.countryCode ?? "FR"}
                label={`${copy.phoneLabel} *`}
                hint={errors.phone ? undefined : copy.phoneHint}
              />
              <FieldError message={errors.phone} />
            </div>

            <div className="flex items-center justify-between gap-3 pt-4">
              <button type="button" onClick={() => router.back()} className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                <ArrowLeft size={16} className="mr-2" />{copy.back}
              </button>
              <button type="button" onClick={handleSaveProfile} disabled={isSaving} className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#FF9900] px-6 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-50">
                {isSaving ? <><Loader2 size={16} className="mr-2 animate-spin" />{copy.saving}</> : <>{copy.continue}<ArrowRight size={16} className="ml-2" /></>}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Stripe Connect ── */}
        {currentStep === "stripe" && (
          <div className="mt-8 space-y-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{copy.stripeTitle}</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{copy.stripeSubtitle}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#635BFF]/10"><CreditCard size={24} className="text-[#635BFF]" /></div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Stripe Connect</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{copy.stripeSecure}</p>
                </div>
              </div>
              <button type="button" onClick={handleStripeConnect} disabled={isStripeLoading} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#635BFF] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#5147E5] disabled:opacity-60">
                {isStripeLoading ? <><Loader2 size={16} className="animate-spin" />{copy.stripeConnecting}</> : <>{copy.stripeConnect}<ExternalLink size={14} /></>}
              </button>
            </div>

            <p className="text-xs text-slate-400 dark:text-slate-500">{copy.stripeSkipHint}</p>

            <div className="flex items-center justify-between gap-3 pt-4">
              <button type="button" onClick={() => setCurrentStep("profile")} className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                <ArrowLeft size={16} className="mr-2" />{copy.back}
              </button>
              <button type="button" onClick={handleSkipStripe} disabled={isSaving} className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 disabled:opacity-50">
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : (isStripeOnlyMode ? copy.finishLater : copy.finish)}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

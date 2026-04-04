"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";
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
} from "lucide-react";

type OnboardingStepKey = "profile" | "stripe";

function buildCopy(isFr: boolean) {
  return {
    title: isFr ? "Devenir transporteur" : "Become a carrier",
    subtitle: isFr
      ? "Configurez votre espace pour publier vos premiers trajets."
      : "Set up your space to publish your first trips.",
    stepProfile: isFr ? "Votre profil" : "Your profile",
    stepStripe: isFr ? "Paiement" : "Payment",

    profileTitle: isFr ? "Créez votre espace transporteur" : "Create your carrier space",
    profileSubtitle: isFr
      ? "Ces informations seront visibles par les expéditeurs."
      : "This information will be visible to shippers.",
    nameLabel: isFr ? "Nom de l'espace" : "Space name",
    namePlaceholder: isFr ? "Ex : Marie D." : "Ex: Marie D.",
    nameHint: isFr
      ? "Pré-rempli avec votre prénom. Modifiable à tout moment."
      : "Pre-filled with your first name. You can change it anytime.",
    bioLabel: isFr ? "Bio" : "Bio",
    bioPlaceholder: isFr
      ? "Parlez un peu de vous, de vos trajets habituels..."
      : "Tell us about yourself, your usual trips...",
    bioLimit: 500,
    addressLabel: isFr ? "Adresse" : "Address",
    addressPlaceholder: isFr ? "Rechercher une adresse, une ville..." : "Search an address, a city...",
    addressHint: isFr
      ? "Seuls la ville et le pays seront visibles publiquement."
      : "Only the city and country will be publicly visible.",
    phoneLabel: isFr ? "Téléphone" : "Phone",
    phoneHint: isFr
      ? "Utilisé uniquement pour la coordination des livraisons."
      : "Used only for delivery coordination.",

    stripeTitle: isFr ? "Recevez vos paiements" : "Receive your payments",
    stripeSubtitle: isFr
      ? "Connectez votre compte bancaire via Stripe pour recevoir les paiements des expéditeurs en toute sécurité."
      : "Connect your bank account via Stripe to securely receive payments from shippers.",
    stripeConnect: isFr ? "Connecter avec Stripe" : "Connect with Stripe",
    stripeConnecting: isFr ? "Redirection vers Stripe..." : "Redirecting to Stripe...",
    stripeSkip: isFr ? "Configurer plus tard" : "Set up later",
    stripeSkipHint: isFr
      ? "Vous pourrez connecter votre compte à tout moment depuis vos paramètres. Vous ne pourrez pas recevoir de paiements tant que Stripe n'est pas configuré."
      : "You can connect your account at any time from your settings. You won't be able to receive payments until Stripe is set up.",
    stripeSecure: isFr
      ? "Stripe est utilisé par des millions d'entreprises. Vos données bancaires ne transitent jamais par nos serveurs."
      : "Stripe is used by millions of businesses. Your banking data never passes through our servers.",

    continue: isFr ? "Continuer" : "Continue",
    back: isFr ? "Retour" : "Back",
    finish: isFr ? "Terminer sans Stripe" : "Finish without Stripe",
    saving: isFr ? "Enregistrement..." : "Saving...",

    genericError: isFr
      ? "Une erreur est survenue. Réessayez."
      : "Something went wrong. Please try again.",

    successTitle: isFr ? "Votre espace est prêt !" : "Your space is ready!",
    successSubtitle: isFr
      ? "Vous pouvez maintenant publier votre premier trajet."
      : "You can now publish your first trip.",
    publishTrip: isFr ? "Publier un trajet" : "Publish a trip",
    goHome: isFr ? "Retour à l'accueil" : "Go to homepage",
  };
}

export default function CarrierOnboardingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { lang } = useUiPreferences();
  const { user, isLoading: userLoading } = useUser();
  const isFr = lang === "fr";
  const copy = useMemo(() => buildCopy(isFr), [isFr]);

  const initialStep = searchParams.get("step") === "stripe" ? "stripe" : "profile";
  const [currentStep, setCurrentStep] = useState<OnboardingStepKey>(initialStep);
  const [isComplete, setIsComplete] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [addressText, setAddressText] = useState("");
  const [addressDetails, setAddressDetails] = useState<PlaceDetails | null>(null);
  const [phone, setPhone] = useState("");

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [isStripeLoading, setIsStripeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill from user data
  useEffect(() => {
    if (!user) return;

    const cp = (user as any).carrierPage;
    if (cp) {
      setName(cp.name ?? "");
      setBio(cp.bio ?? "");
      setPhone(cp.phoneE164 ?? (user as any).phoneE164 ?? "");

      if (cp.primaryAddress) {
        const pa = cp.primaryAddress;
        const display = pa.formattedAddress
          || [pa.city, pa.country].filter(Boolean).join(", ")
          || "";
        setAddressText(display);
        setAddressDetails({
          formattedAddress: pa.formattedAddress ?? display,
          placeId: pa.placeId ?? "",
          lat: pa.lat ?? null,
          lng: pa.lng ?? null,
          streetLine1: pa.streetLine1 ?? null,
          city: pa.city ?? null,
          region: pa.region ?? null,
          postalCode: pa.postalCode ?? null,
          country: pa.country ?? null,
          countryCode: pa.countryCode ?? null,
        });
      }

      if (cp.onboardingStep === "STRIPE" || cp.onboardingStep === "COMPLETE") {
        setCurrentStep("stripe");
      }
      if (cp.onboardingStep === "COMPLETE") {
        setIsComplete(true);
      }
    } else {
      const initial = `${user.firstName} ${user.lastName?.charAt(0) ?? ""}.`.trim();
      setName(initial);
      setPhone((user as any).phoneE164 ?? "");
    }
  }, [user]);

  useEffect(() => {
    if (!userLoading && !user) {
      router.push("/login?redirect=/carrier/onboarding");
    }
  }, [user, userLoading, router]);

  useEffect(() => {
    if (user && (user as any).carrierStatus === "ACTIVE") {
      setIsComplete(true);
    }
  }, [user]);

  const canContinueProfile = name.trim().length > 0;

  const handleSaveProfile = async () => {
    if (!canContinueProfile) return;
    setError(null);
    setIsSaving(true);

    try {
      await apiClient.post(
        "/carrier/onboarding/profile",
        {
          name: name.trim(),
          bio: bio.trim() || undefined,
          address: addressDetails
            ? {
              formattedAddress: addressDetails.formattedAddress,
              placeId: addressDetails.placeId || undefined,
              lat: addressDetails.lat ?? undefined,
              lng: addressDetails.lng ?? undefined,
              streetLine1: addressDetails.streetLine1 || undefined,
              city: addressDetails.city || undefined,
              region: addressDetails.region || undefined,
              postalCode: addressDetails.postalCode || undefined,
              country: addressDetails.country || undefined,
              countryCode: addressDetails.countryCode || undefined,
            }
            : undefined,
          phoneE164: phone.trim() || undefined,
        },
        { requireAuth: true }
      );

      await queryClient.invalidateQueries({ queryKey: ["user"] });
      setCurrentStep("stripe");
    } catch {
      setError(copy.genericError);
    } finally {
      setIsSaving(false);
    }
  };

  const handleStripeConnect = async () => {
    setError(null);
    setIsStripeLoading(true);

    try {
      const response = await apiClient.post(
        "/carrier/onboarding/stripe",
        {},
        { requireAuth: true }
      );

      const { url } = response.data;
      if (url) {
        window.location.href = url;
      } else {
        setError(copy.genericError);
      }
    } catch {
      setError(copy.genericError);
    } finally {
      setIsStripeLoading(false);
    }
  };

  const handleSkipStripe = async () => {
    setError(null);
    setIsSaving(true);

    try {
      await apiClient.post(
        "/carrier/onboarding/complete",
        {},
        { requireAuth: true }
      );

      await queryClient.invalidateQueries({ queryKey: ["user"] });
      setIsComplete(true);
    } catch {
      setError(copy.genericError);
    } finally {
      setIsSaving(false);
    }
  };

  if (userLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[#FF9900]" />
      </main>
    );
  }

  if (!user) return null;

  // ── Success screen ──
  if (isComplete) {
    return (
      <main className="px-4">
        <div className="mx-auto flex min-h-[85vh] max-w-lg items-center justify-center py-10">
          <div className="w-full text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <Check size={40} className="text-green-600 dark:text-green-400" />
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {copy.successTitle}
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {copy.successSubtitle}
            </p>

            <div className="mt-8 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => router.push("/trips/create")}
                className="w-full rounded-lg bg-[#FF9900] px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-[#F08700]"
              >
                {copy.publishTrip}
              </button>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                {copy.goHome}
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ── Step indicator ──
  const steps = [
    { key: "profile" as const, label: copy.stepProfile, icon: UserIcon },
    { key: "stripe" as const, label: copy.stepStripe, icon: CreditCard },
  ];

  const currentIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <main className="px-4">
      <div className="mx-auto max-w-lg py-10 pt-[100px]">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          {copy.title}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {copy.subtitle}
        </p>

        {/* Step indicator */}
        <div className="mt-8 flex items-center gap-3">
          {steps.map((step, i) => {
            const Icon = step.icon;
            const isActive = step.key === currentStep;
            const isDone = i < currentIndex;

            return (
              <div key={step.key} className="flex flex-1 items-center gap-2">
                <div
                  className={[
                    "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors",
                    isDone
                      ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                      : isActive
                        ? "bg-[#FF9900] text-slate-900"
                        : "bg-slate-100 text-slate-400 dark:bg-slate-900 dark:text-slate-500",
                  ].join(" ")}
                >
                  {isDone ? <Check size={16} /> : <Icon size={16} />}
                </div>
                <span
                  className={[
                    "text-sm font-medium",
                    isActive
                      ? "text-slate-900 dark:text-white"
                      : "text-slate-400 dark:text-slate-500",
                  ].join(" ")}
                >
                  {step.label}
                </span>
                {i < steps.length - 1 && (
                  <div className="mx-2 h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </div>
        )}

        {/* ── Step 1: Profile ── */}
        {currentStep === "profile" && (
          <div className="mt-8 space-y-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {copy.profileTitle}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {copy.profileSubtitle}
              </p>
            </div>

            {/* Name */}
            <div>
              <label htmlFor="carrier-name" className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {copy.nameLabel}
              </label>
              <input
                id="carrier-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={copy.namePlaceholder}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#FF9900]/80 focus:ring-4 focus:ring-[#FF9900]/25 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:border-[#FFAE33]/70 dark:focus:ring-[#FF9900]/18"
              />
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                {copy.nameHint}
              </p>
            </div>

            {/* Bio */}
            <div>
              <label htmlFor="carrier-bio" className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {copy.bioLabel}
              </label>
              <div className="relative mt-2">
                <textarea
                  id="carrier-bio"
                  value={bio}
                  onChange={(e) => {
                    if (e.target.value.length <= copy.bioLimit) {
                      setBio(e.target.value);
                    }
                  }}
                  placeholder={copy.bioPlaceholder}
                  rows={4}
                  maxLength={copy.bioLimit}
                  className="w-full resize-none rounded-lg border border-slate-200 bg-white px-4 py-2.5 pb-8 text-sm text-slate-900 outline-none focus:border-[#FF9900]/80 focus:ring-4 focus:ring-[#FF9900]/25 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:border-[#FFAE33]/70 dark:focus:ring-[#FF9900]/18"
                />
                <span
                  className={[
                    "absolute bottom-2.5 right-3 text-xs",
                    bio.length > copy.bioLimit * 0.9
                      ? "text-red-500 dark:text-red-400"
                      : bio.length > copy.bioLimit * 0.75
                        ? "text-amber-500 dark:text-amber-400"
                        : "text-slate-400 dark:text-slate-500",
                  ].join(" ")}
                >
                  {bio.length}/{copy.bioLimit}
                </span>
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {copy.addressLabel}
              </label>
              <div className="relative z-[50] mt-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 dark:border-slate-800 dark:bg-slate-950">
                <CityAutocomplete
                  value={addressText}
                  action={(v) => {
                    setAddressText(v);
                    if (!v.trim()) setAddressDetails(null);
                  }}
                  onPlaceSelect={(details) => {
                    setAddressText(details.formattedAddress);
                    setAddressDetails(details);
                  }}
                  placeholder={copy.addressPlaceholder}
                  language={isFr ? "fr" : "en"}
                  inputClassName="text-sm"
                  dropdownInline
                />
              </div>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                {copy.addressHint}
              </p>
            </div>

            {/* Phone */}
            <PhoneInput
              value={phone}
              action={setPhone}
              defaultCountry={addressDetails?.countryCode ?? "FR"}
              label={copy.phoneLabel}
              hint={copy.phoneHint}
            />

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 pt-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
              >
                <ArrowLeft size={16} className="mr-2" />
                {copy.back}
              </button>

              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={!canContinueProfile || isSaving}
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#FF9900] px-6 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    {copy.saving}
                  </>
                ) : (
                  <>
                    {copy.continue}
                    <ArrowRight size={16} className="ml-2" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Stripe Connect ── */}
        {currentStep === "stripe" && (
          <div className="mt-8 space-y-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {copy.stripeTitle}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {copy.stripeSubtitle}
              </p>
            </div>

            {/* Stripe card */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#635BFF]/10">
                  <CreditCard size={24} className="text-[#635BFF]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Stripe Connect
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {copy.stripeSecure}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleStripeConnect}
                disabled={isStripeLoading}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#635BFF] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#5147E5] disabled:opacity-60"
              >
                {isStripeLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {copy.stripeConnecting}
                  </>
                ) : (
                  <>
                    {copy.stripeConnect}
                    <ExternalLink size={14} />
                  </>
                )}
              </button>
            </div>

            <p className="text-xs text-slate-400 dark:text-slate-500">
              {copy.stripeSkipHint}
            </p>

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 pt-4">
              <button
                type="button"
                onClick={() => setCurrentStep("profile")}
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
              >
                <ArrowLeft size={16} className="mr-2" />
                {copy.back}
              </button>

              <button
                type="button"
                onClick={handleSkipStripe}
                disabled={isSaving}
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  copy.finish
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

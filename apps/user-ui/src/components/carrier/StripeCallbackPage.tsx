"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";
import useUser from "@/hooks/useUser";
import apiClient from "@/lib/api-client";
import { Check, AlertTriangle, Loader2, ArrowRight, RefreshCw } from "lucide-react";

type Status = "loading" | "success" | "incomplete" | "error";

function buildCopy(isFr: boolean) {
  return {
    loading: isFr ? "Vérification de votre compte Stripe..." : "Verifying your Stripe account...",

    successTitle: isFr ? "Stripe connecté avec succès !" : "Stripe connected successfully!",
    successSubtitle: isFr
      ? "Votre espace est prêt. Vous pouvez maintenant publier des trajets et recevoir des paiements."
      : "Your space is ready. You can now publish trips and receive payments.",

    incompleteTitle: isFr ? "Configuration Stripe incomplète" : "Stripe setup incomplete",
    incompleteSubtitle: isFr
      ? "Il semble que la configuration de votre compte Stripe n'est pas terminée. Vous pouvez réessayer ou terminer plus tard."
      : "It looks like your Stripe account setup is not finished. You can retry or finish later.",

    errorTitle: isFr ? "Erreur de vérification" : "Verification error",
    errorSubtitle: isFr
      ? "Nous n'avons pas pu vérifier le statut de votre compte Stripe. Réessayez dans quelques instants."
      : "We couldn't verify your Stripe account status. Please try again in a moment.",

    publishTrip: isFr ? "Publier un trajet" : "Publish a trip",
    goHome: isFr ? "Retour à l'accueil" : "Go to homepage",
    retryStripe: isFr ? "Réessayer Stripe" : "Retry Stripe",
    skipForNow: isFr ? "Terminer sans Stripe" : "Finish without Stripe",
  };
}

export default function StripeCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { lang } = useUiPreferences();
  const { user, isLoading: userLoading } = useUser();
  const isFr = lang === "fr";
  const copy = useMemo(() => buildCopy(isFr), [isFr]);

  const [status, setStatus] = useState<Status>("loading");
  const isRefresh = searchParams.get("refresh") === "true";

  // ✅ Ref pour empêcher les appels multiples
  const hasChecked = useRef(false);

  useEffect(() => {
    if (userLoading || !user) return;

    // Si c'est un refresh (Stripe a redirigé car l'utilisateur a abandonné ou le lien a expiré)
    if (isRefresh) {
      setStatus("incomplete");
      return;
    }

    // ✅ Ne vérifier qu'UNE SEULE fois
    if (hasChecked.current) return;
    hasChecked.current = true;

    const checkStatus = async () => {
      try {
        const res = await apiClient.get("/carrier/onboarding/stripe/status", {
          requireAuth: true,
        });

        const data = res.data;

        if (data.detailsSubmitted && data.chargesEnabled) {
          setStatus("success");
          // Invalider le cache user pour mettre à jour le statut dans le header, etc.
          await queryClient.invalidateQueries({ queryKey: ["user"] });
        } else {
          setStatus("incomplete");
        }
      } catch {
        setStatus("error");
      }
    };

    checkStatus();
  }, [user, userLoading, isRefresh, queryClient]);

  const handleRetryStripe = async () => {
    setStatus("loading");
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
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  const handleSkip = async () => {
    setStatus("loading");
    try {
      await apiClient.post(
        "/carrier/onboarding/complete",
        {},
        { requireAuth: true }
      );
      await queryClient.invalidateQueries({ queryKey: ["user"] });
      router.push("/");
    } catch {
      setStatus("error");
    }
  };

  if (userLoading || status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <Loader2 size={32} className="mx-auto animate-spin text-[#FF9900]" />
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            {copy.loading}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="px-4">
      <div className="mx-auto flex min-h-[85vh] max-w-lg items-center justify-center py-10">
        <div className="w-full text-center">

          {/* Success */}
          {status === "success" && (
            <>
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
                  <ArrowRight size={14} className="ml-2 inline" />
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/")}
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                >
                  {copy.goHome}
                </button>
              </div>
            </>
          )}

          {/* Incomplete */}
          {status === "incomplete" && (
            <>
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                <AlertTriangle size={40} className="text-amber-600 dark:text-amber-400" />
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {copy.incompleteTitle}
              </h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                {copy.incompleteSubtitle}
              </p>
              <div className="mt-8 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleRetryStripe}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#635BFF] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#5147E5]"
                >
                  <RefreshCw size={14} />
                  {copy.retryStripe}
                </button>
                <button
                  type="button"
                  onClick={handleSkip}
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                >
                  {copy.skipForNow}
                </button>
              </div>
            </>
          )}

          {/* Error */}
          {status === "error" && (
            <>
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertTriangle size={40} className="text-red-600 dark:text-red-400" />
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {copy.errorTitle}
              </h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                {copy.errorSubtitle}
              </p>
              <div className="mt-8 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleRetryStripe}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#635BFF] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#5147E5]"
                >
                  <RefreshCw size={14} />
                  {copy.retryStripe}
                </button>
                <button
                  type="button"
                  onClick={handleSkip}
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                >
                  {copy.skipForNow}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

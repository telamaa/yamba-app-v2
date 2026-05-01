"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import {
  getApiErrorMessage,
  hasApiBaseUrl,
  requestPasswordResetOtp,
} from "@/services/auth.api";
import type { HeroVisual } from "@/lib/auth/hero-visuals";
import AuthHeroVisual from "@/components/auth/visual/AuthHeroVisual";

type Lang = "fr" | "en";

type FormData = {
  email: string;
};

type Props = {
  heroVisual: HeroVisual;
};

export default function ForgotPasswordForm({ heroVisual }: Props) {
  const router = useRouter();
  const { lang } = useUiPreferences();
  const [serverError, setServerError] = useState<string | null>(null);

  const copy = useMemo(() => {
    const fr = (lang as Lang) === "fr";
    return {
      trust: fr ? "Récupération sécurisée" : "Secure recovery",
      title: fr ? "Mot de passe oublié ?" : "Forgot your password?",
      subtitle: fr
        ? "Saisissez votre e-mail. Si un compte existe, nous vous enverrons un code à 6 chiffres."
        : "Enter your email. If an account exists, we'll send you a 6-digit code.",
      email: fr ? "Adresse e-mail" : "Email address",
      emailPlaceholder: fr ? "vous@email.com" : "you@email.com",
      cta: fr ? "Envoyer le code" : "Send code",
      ctaLoading: fr ? "Envoi…" : "Sending…",
      back: fr ? "Retour à la connexion" : "Back to login",
      hint: fr
        ? "Pour des raisons de sécurité, le message est identique même si le compte n'existe pas."
        : "For security reasons, the response is the same whether the account exists or not.",
      requiredEmail: fr ? "L'e-mail est requis." : "Email is required.",
      invalidEmail: fr ? "Veuillez saisir un e-mail valide." : "Please enter a valid email.",
      genericError: fr
        ? "Envoi du code impossible pour le moment."
        : "Unable to send the code right now.",
      configError: fr
        ? "La configuration de l'application est incomplète."
        : "Application configuration is incomplete.",
    };
  }, [lang]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    mode: "onSubmit",
  });

  const requestOtpMutation = useMutation({
    mutationFn: requestPasswordResetOtp,
    onSuccess: (_, variables) => {
      const normalizedEmail = variables.email.trim().toLowerCase();

      if (typeof window !== "undefined") {
        sessionStorage.setItem("pwd_reset_email", normalizedEmail);
      }

      setServerError(null);
      // 🔒 SÉCURITÉ : email transite UNIQUEMENT via sessionStorage, jamais en URL
      // (évite fuites via logs serveur, historique navigateur, referrer, analytics)
      router.push("/password/verify");
    },
    onError: (error) => {
      setServerError(getApiErrorMessage(error, copy.genericError));
    },
  });

  const onSubmitEmail = ({ email }: FormData) => {
    setServerError(null);

    if (!hasApiBaseUrl()) {
      setServerError(copy.configError);
      return;
    }

    requestOtpMutation.mutate({
      email: email.trim().toLowerCase(),
    });
  };

  return (
    <main className="lg:grid lg:grid-cols-2 lg:min-h-[calc(100vh-64px)]">
      {/* LEFT — visuel desktop */}
      <div className="hidden lg:block">
        <AuthHeroVisual visual={heroVisual} />
      </div>

      {/* RIGHT — formulaire */}
      <div className="flex items-center justify-center px-4 py-8 lg:px-8 lg:py-10">
        <div className="w-full max-w-[400px]">
          {/* Trust pill */}
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#0F766E] bg-white px-2.5 py-1 text-[11px] font-medium text-[#0F766E] dark:border-[#2DD4BF] dark:bg-slate-950 dark:text-[#2DD4BF]">
            <ShieldCheck size={12} />
            <span>{copy.trust}</span>
          </div>

          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white lg:text-3xl">
            {copy.title}
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {copy.subtitle}
          </p>

          <form
            onSubmit={handleSubmit(onSubmitEmail)}
            noValidate
            className="mt-6 space-y-4"
          >
            <div>
              <label
                htmlFor="forgot-email"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                {copy.email}
              </label>
              <input
                id="forgot-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder={copy.emailPlaceholder}
                aria-invalid={!!errors.email}
                className={`mt-1.5 w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-600 ${
                  errors.email
                    ? "border-red-300 focus:border-red-400 focus:ring-4 focus:ring-red-200 dark:border-red-800"
                    : "border-slate-200 focus:border-[#FF9900] focus:ring-4 focus:ring-[#FF9900]/20 dark:border-slate-800 dark:focus:border-[#FFAE33]"
                }`}
                {...register("email", {
                  required: copy.requiredEmail,
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: copy.invalidEmail,
                  },
                })}
              />
              {errors.email && (
                <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">
                  {String(errors.email.message)}
                </p>
              )}
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">{copy.hint}</p>

            {serverError && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200"
              >
                {serverError}
              </div>
            )}

            <button
              type="submit"
              disabled={requestOtpMutation.isPending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#FF9900] px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm transition-colors hover:bg-[#F08700] active:bg-[#E07A00] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF9900]/30"
            >
              {requestOtpMutation.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {copy.ctaLoading}
                </>
              ) : (
                copy.cta
              )}
            </button>

            <div className="pt-2 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0D9488] underline underline-offset-2 decoration-[#0D9488]/40 hover:decoration-[#0D9488] dark:text-[#2DD4BF] dark:decoration-[#2DD4BF]/40 dark:hover:decoration-[#2DD4BF]"
              >
                <ArrowLeft size={12} />
                {copy.back}
              </Link>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}

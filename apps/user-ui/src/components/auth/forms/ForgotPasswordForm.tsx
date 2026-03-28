"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import {
  getApiErrorMessage,
  hasApiBaseUrl,
  requestPasswordResetOtp,
} from "@/services/auth.api";

type Lang = "fr" | "en";

type FormData = {
  email: string;
};

export default function ForgotPasswordForm() {
  const router = useRouter();
  const { lang } = useUiPreferences();
  const [serverError, setServerError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const copy = useMemo(() => {
    const fr = (lang as Lang) === "fr";
    return {
      title: fr ? "Mot de passe oublié" : "Forgot your password?",
      subtitle: fr
        ? "Saisissez votre e-mail. Si un compte existe, nous vous enverrons un code."
        : "Enter your email. If an account exists, we’ll send you a code.",
      email: fr ? "E-mail" : "Email",
      cta: fr ? "Envoyer le code" : "Send code",
      back: fr ? "Retour à la connexion" : "Back to login",
      hint: fr
        ? "Pour des raisons de sécurité, le message est identique même si le compte n’existe pas."
        : "For security reasons, the message is the same whether the account exists or not.",
      sent: fr
        ? "Si un compte existe, un code a été envoyé."
        : "If an account exists, a code has been sent.",
      requiredEmail: fr ? "L’e-mail est requis." : "Email is required.",
      invalidEmail: fr ? "Veuillez saisir un e-mail valide." : "Please enter a valid email.",
      genericError: fr
        ? "Envoi du code impossible pour le moment."
        : "Unable to send the code right now.",
      configError: fr
        ? "La configuration de l’application est incomplète."
        : "Application configuration is incomplete.",
    };
  }, [lang]);

  const UI = {
    label: "text-sm font-semibold text-slate-800 dark:text-slate-100",
    input:
      "mt-2 w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none " +
      "focus:border-[#FF9900]/80 focus:ring-4 focus:ring-[#FF9900]/25 " +
      "dark:border-slate-800 dark:bg-slate-950 dark:text-white " +
      "dark:focus:border-[#FFAE33]/70 dark:focus:ring-[#FF9900]/18",
    btnPrimary:
      "w-full rounded-lg bg-[#FF9900] px-4 py-2.5 text-sm font-semibold text-slate-900 " +
      "shadow-sm transition-colors hover:bg-[#F08700] active:bg-[#E07A00] disabled:opacity-60 " +
      "focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF9900]/30 " +
      "dark:focus-visible:ring-[#FF9900]/18",
    link:
      "font-semibold text-[#0F766E] hover:text-[#115E59] hover:underline " +
      "dark:text-[#2DD4BF] dark:hover:text-[#5EEAD4]",
    help: "text-xs text-slate-500 dark:text-slate-500",
    notice:
      "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 " +
      "dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200",
  };

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
      setInfo(copy.sent);
      router.push(`/password/verify?email=${encodeURIComponent(normalizedEmail)}`);
    },
    onError: (error) => {
      setInfo(null);
      setServerError(getApiErrorMessage(error, copy.genericError));
    },
  });

  const onSubmitEmail = ({ email }: FormData) => {
    setServerError(null);
    setInfo(null);

    if (!hasApiBaseUrl()) {
      setServerError(copy.configError);
      return;
    }

    requestOtpMutation.mutate({
      email: email.trim().toLowerCase(),
    });
  };

  return (
    <main className="px-4">
      <div className="mx-auto flex min-h-[85vh] max-w-6xl items-center justify-center py-10">
        <div className="w-full max-w-[420px]">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {copy.title}
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{copy.subtitle}</p>

          <form onSubmit={handleSubmit(onSubmitEmail)} className="mt-8 space-y-5" noValidate>
            <div>
              <label className={UI.label}>{copy.email}</label>
              <input
                type="email"
                autoComplete="email"
                className={UI.input}
                {...register("email", {
                  required: copy.requiredEmail,
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: copy.invalidEmail,
                  },
                })}
              />
              {errors.email && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                  {String(errors.email.message)}
                </p>
              )}
            </div>

            <p className={UI.help}>{copy.hint}</p>

            {info && <div className={UI.notice}>{info}</div>}

            {serverError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                {serverError}
              </div>
            )}

            <button
              type="submit"
              disabled={requestOtpMutation.isPending}
              className={UI.btnPrimary}
            >
              {requestOtpMutation.isPending ? "…" : copy.cta}
            </button>

            <div className="pt-2 text-center text-sm text-slate-600 dark:text-slate-400">
              <Link href="/login" className={UI.link}>
                {copy.back}
              </Link>
            </div>
          </form>

          <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-500">
            Vérifiez l’URL pour vous assurer de vous connecter au bon site.
          </p>
        </div>
      </div>
    </main>
  );
}

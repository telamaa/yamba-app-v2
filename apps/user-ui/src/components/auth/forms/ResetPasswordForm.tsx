"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import {
  getApiErrorMessage,
  hasApiBaseUrl,
  resetPassword,
} from "@/services/auth.api";

type Lang = "fr" | "en";

type FormData = {
  password: string;
  confirmPassword: string;
};

function normalizeForComparison(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function looksLikeSimpleDate(password: string) {
  const digits = password.replace(/\D/g, "");
  return /^\d{6}$/.test(digits) || /^\d{8}$/.test(digits);
}

function hasSequentialPattern(password: string) {
  const lower = password.toLowerCase();
  const patterns = [
    "1234",
    "2345",
    "3456",
    "4567",
    "5678",
    "6789",
    "abcd",
    "azerty",
    "qwerty",
    "password",
    "motdepasse",
  ];

  return patterns.some((pattern) => lower.includes(pattern));
}

function hasTooManyRepeatedChars(password: string) {
  return /(.)\1{2,}/.test(password);
}

function validateStrongPassword(password: string, email: string): true | string {
  const normalizedPassword = normalizeForComparison(password);
  const emailLocalPart = normalizeForComparison(email).split("@")[0] ?? "";

  const includesPersonalInfo =
    emailLocalPart.length >= 3 && normalizedPassword.includes(emailLocalPart);

  const baseChecksOk =
    password.length >= 8 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password);

  if (!baseChecksOk) {
    return "Choisissez un mot de passe d’au moins 8 caractères avec une majuscule, une minuscule, un chiffre et un caractère spécial.";
  }

  if (includesPersonalInfo) {
    return "Pour votre sécurité, évitez d’utiliser votre e-mail dans le mot de passe.";
  }

  if (looksLikeSimpleDate(password)) {
    return "Pour votre sécurité, évitez un mot de passe qui ressemble à une date facile à deviner.";
  }

  if (hasSequentialPattern(password) || hasTooManyRepeatedChars(password)) {
    return "Pour votre sécurité, évitez les suites simples, répétitions ou mots de passe trop prévisibles.";
  }

  return true;
}

export default function ResetPasswordForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const { lang } = useUiPreferences();
  const [serverError, setServerError] = useState<string | null>(null);

  const token =
    sp.get("token") ??
    (typeof window !== "undefined"
      ? sessionStorage.getItem("pwd_reset_token") ?? ""
      : "");

  const resetEmail =
    typeof window !== "undefined"
      ? sessionStorage.getItem("pwd_reset_email") ?? ""
      : "";

  const copy = useMemo(() => {
    const fr = (lang as Lang) === "fr";
    return {
      title: fr ? "Nouveau mot de passe" : "Set a new password",
      subtitle: fr
        ? "Choisissez un mot de passe robuste pour sécuriser votre compte."
        : "Choose a strong password to secure your account.",
      newPwd: fr ? "Nouveau mot de passe" : "New password",
      confirmPwd: fr ? "Confirmer le mot de passe" : "Confirm password",
      hint: fr
        ? "Utilisez au moins 8 caractères avec une majuscule, une minuscule, un chiffre et un caractère spécial."
        : "Use at least 8 characters with an uppercase letter, a lowercase letter, a number and a special character.",
      cta: fr ? "Réinitialiser" : "Reset password",
      back: fr ? "Retour à la connexion" : "Back to login",
      mismatch: fr ? "Les mots de passe ne correspondent pas." : "Passwords do not match.",
      requiredPassword: fr ? "Le mot de passe est requis." : "Password is required.",
      success: fr ? "Mot de passe mis à jour. Redirection…" : "Password updated. Redirecting…",
      missingToken: fr
        ? "Session expirée. Veuillez recommencer la procédure."
        : "Session expired. Please restart the process.",
      genericError: fr
        ? "Réinitialisation impossible pour le moment."
        : "Unable to reset password right now.",
      configError: fr
        ? "La configuration de l’application est incomplète."
        : "Application configuration is incomplete.",
    };
  }, [lang]);

  const UI = {
    label: "text-sm font-semibold text-slate-800 dark:text-slate-100",
    help: "text-xs text-slate-500 dark:text-slate-500",
    link:
      "font-semibold text-[#0F766E] hover:text-[#115E59] hover:underline " +
      "dark:text-[#2DD4BF] dark:hover:text-[#5EEAD4]",
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
    notice:
      "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 " +
      "dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200",
  };

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    mode: "onSubmit",
  });

  const password = watch("password") ?? "";

  const resetPasswordMutation = useMutation({
    mutationFn: resetPassword,
    onSuccess: () => {
      setServerError(null);

      if (typeof window !== "undefined") {
        sessionStorage.removeItem("pwd_reset_token");
        sessionStorage.removeItem("pwd_reset_email");
      }

      router.push("/login");
    },
    onError: (error) => {
      setServerError(getApiErrorMessage(error, copy.genericError));
    },
  });

  const onSubmitPassword = ({ password }: FormData) => {
    setServerError(null);

    if (!hasApiBaseUrl()) {
      setServerError(copy.configError);
      return;
    }

    if (!token) {
      setServerError(copy.missingToken);
      return;
    }

    resetPasswordMutation.mutate({
      passwordResetToken: token,
      newPassword: password,
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

          <form onSubmit={handleSubmit(onSubmitPassword)} className="mt-8 space-y-5" noValidate>
            <div>
              <label className={UI.label}>{copy.newPwd}</label>
              <input
                type="password"
                autoComplete="new-password"
                className={UI.input}
                {...register("password", {
                  required: copy.requiredPassword,
                  validate: (value) => validateStrongPassword(value, resetEmail),
                })}
              />
              <p className={UI.help}>{copy.hint}</p>
              {errors.password && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                  {String(errors.password.message)}
                </p>
              )}
            </div>

            <div>
              <label className={UI.label}>{copy.confirmPwd}</label>
              <input
                type="password"
                autoComplete="new-password"
                className={UI.input}
                {...register("confirmPassword", {
                  validate: (value) => value === password || copy.mismatch,
                })}
              />
              {errors.confirmPassword && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                  {String(errors.confirmPassword.message)}
                </p>
              )}
            </div>

            {resetPasswordMutation.isSuccess && (
              <div className={UI.notice}>{copy.success}</div>
            )}

            {serverError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                {serverError}
              </div>
            )}

            <button
              type="submit"
              disabled={resetPasswordMutation.isPending}
              className={UI.btnPrimary}
            >
              {resetPasswordMutation.isPending ? "…" : copy.cta}
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

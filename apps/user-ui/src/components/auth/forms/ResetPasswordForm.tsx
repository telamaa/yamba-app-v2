"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ClipboardEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import {
  getApiErrorData,
  getApiErrorMessage,
  hasApiBaseUrl,
  resetPassword,
} from "@/services/auth.api";
import type { HeroVisual } from "@/lib/auth/hero-visuals";
import AuthHeroVisual from "@/components/auth/visual/AuthHeroVisual";
import { maskEmail } from "@/lib/auth/email-mask";
import { useToast } from "@/components/ui/Toast";
import PasswordStrengthIndicator from "@/components/auth/shared/PasswordStrengthIndicator";

type FormData = {
  password: string;
  confirmPassword: string;
};

type Props = {
  heroVisual: HeroVisual;
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
    "1234", "2345", "3456", "4567", "5678", "6789",
    "abcd", "azerty", "qwerty", "password", "motdepasse",
  ];
  return patterns.some((p) => lower.includes(p));
}

function hasTooManyRepeatedChars(password: string) {
  return /(.)\1{2,}/.test(password);
}

function validateStrongPassword(
  password: string,
  email: string,
  fr: boolean
): true | string {
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
    return fr
      ? "Choisissez un mot de passe d'au moins 8 caractères avec une majuscule, une minuscule, un chiffre et un caractère spécial."
      : "Choose a password with at least 8 characters including uppercase, lowercase, number and special character.";
  }

  if (includesPersonalInfo) {
    return fr
      ? "Pour votre sécurité, évitez d'utiliser votre e-mail dans le mot de passe."
      : "For your security, avoid using your email in the password.";
  }

  if (looksLikeSimpleDate(password)) {
    return fr
      ? "Pour votre sécurité, évitez un mot de passe qui ressemble à une date facile à deviner."
      : "For your security, avoid passwords that look like an easy-to-guess date.";
  }

  if (hasSequentialPattern(password) || hasTooManyRepeatedChars(password)) {
    return fr
      ? "Pour votre sécurité, évitez les suites simples, répétitions ou mots de passe trop prévisibles."
      : "For your security, avoid simple sequences, repeated characters, or predictable passwords.";
  }

  return true;
}

export default function ResetPasswordForm({ heroVisual }: Props) {
  const router = useRouter();
  const { lang } = useUiPreferences();
  const { toast } = useToast();
  const fr = lang === "fr";

  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  // Recovery state
  const [token, setToken] = useState<string>("");
  const [resetEmail, setResetEmail] = useState<string>("");
  const [sessionExpired, setSessionExpired] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Hydration safe : on lit sessionStorage UNIQUEMENT côté client
  useEffect(() => {
    if (typeof window === "undefined") return;

    const t = sessionStorage.getItem("pwd_reset_token") ?? "";
    const e = sessionStorage.getItem("pwd_reset_email") ?? "";

    setToken(t);
    setResetEmail(e);
    setHydrated(true);

    if (!t) {
      setSessionExpired(true);
    }
  }, []);

  const copy = useMemo(() => {
    return {
      trust: fr ? "Réinitialisation sécurisée" : "Secure reset",
      title: fr ? "Nouveau mot de passe" : "Set a new password",
      subtitle: fr
        ? "Choisissez un mot de passe robuste pour sécuriser votre compte."
        : "Choose a strong password to secure your account.",
      forAccount: fr ? "Pour le compte :" : "For account:",
      newPwd: fr ? "Nouveau mot de passe" : "New password",
      confirmPwd: fr ? "Confirmer le mot de passe" : "Confirm password",
      hint: fr
        ? "Au moins 8 caractères avec majuscule, minuscule, chiffre et caractère spécial."
        : "At least 8 characters with uppercase, lowercase, number and special character.",
      cta: fr ? "Réinitialiser le mot de passe" : "Reset password",
      ctaLoading: fr ? "Réinitialisation…" : "Resetting…",
      back: fr ? "Retour à la connexion" : "Back to login",
      mismatch: fr ? "Les mots de passe ne correspondent pas." : "Passwords do not match.",
      requiredPassword: fr ? "Le mot de passe est requis." : "Password is required.",
      successTitle: fr ? "Mot de passe modifié" : "Password updated",
      successMessage: fr
        ? "Vous pouvez maintenant vous connecter avec votre nouveau mot de passe."
        : "You can now log in with your new password.",
      sessionExpiredTitle: fr ? "Session expirée" : "Session expired",
      sessionExpired: fr
        ? "Votre session de réinitialisation a expiré. Merci de recommencer la procédure."
        : "Your reset session has expired. Please restart the recovery flow.",
      restartFlow: fr ? "Recommencer la procédure" : "Restart the recovery",
      genericError: fr
        ? "Réinitialisation impossible pour le moment."
        : "Unable to reset password right now.",
      configError: fr
        ? "La configuration de l'application est incomplète."
        : "Application configuration is incomplete.",
      pasteDisabledTitle: fr ? "Collage désactivé" : "Paste disabled",
      pasteDisabledMessage: fr
        ? "Pour votre sécurité, veuillez ressaisir le mot de passe."
        : "For your security, please retype the password.",
      showPwd: fr ? "Afficher" : "Show",
      hidePwd: fr ? "Masquer" : "Hide",
    };
  }, [fr]);

  // Copy spécifique pour le PasswordStrengthIndicator
  const passwordStrengthCopy = useMemo(
    () => ({
      title: fr ? "Force du mot de passe" : "Password strength",
      level: fr ? "Niveau" : "Level",
      weak: fr ? "Faible" : "Weak",
      medium: fr ? "Moyen" : "Medium",
      strong: fr ? "Fort" : "Strong",
      excellent: fr ? "Excellent" : "Excellent",
      close: fr ? "Fermer" : "Close",
      criteria: {
        minLength: fr ? "Au moins 8 caractères" : "At least 8 characters",
        lowercase: fr ? "Une lettre minuscule" : "One lowercase letter",
        uppercase: fr ? "Une lettre majuscule" : "One uppercase letter",
        number: fr ? "Un chiffre" : "One number",
        special: fr ? "Un caractère spécial" : "One special character",
        personalInfo: fr
          ? "Pas d'info personnelle (e-mail, prénom)"
          : "No personal info (email, name)",
        simpleDate: fr
          ? "Pas une date évidente"
          : "Not an obvious date",
        predictable: fr
          ? "Pas de suite ou répétition simple"
          : "No simple sequence or repetition",
      },
    }),
    [fr]
  );

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    mode: "onSubmit",
  });

  const password = watch("password") ?? "";

  // Context pour PasswordStrengthIndicator (juste l'email ici)
  const passwordContext = useMemo(
    () => ({
      email: resetEmail,
      firstName: "",
      lastName: "",
    }),
    [resetEmail]
  );

  const resetPasswordMutation = useMutation({
    mutationFn: resetPassword,
    onSuccess: () => {
      setServerError(null);

      if (typeof window !== "undefined") {
        sessionStorage.removeItem("pwd_reset_token");
        sessionStorage.removeItem("pwd_reset_email");
      }

      toast({
        type: "success",
        title: copy.successTitle,
        message: copy.successMessage,
      });

      router.push("/login");
    },
    onError: (error) => {
      const data = getApiErrorData(error);

      if (data?.message?.toLowerCase().includes("expired")) {
        setSessionExpired(true);
        return;
      }

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
      setSessionExpired(true);
      return;
    }

    resetPasswordMutation.mutate({
      passwordResetToken: token,
      newPassword: password,
    });
  };

  const handleConfirmPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    toast({
      type: "info",
      title: copy.pasteDisabledTitle,
      message: copy.pasteDisabledMessage,
    });
  };

  const maskedEmail = useMemo(
    () => (resetEmail ? maskEmail(resetEmail) : ""),
    [resetEmail]
  );

  // ── Render placeholder pendant hydration ──
  if (!hydrated) {
    return (
      <main className="lg:grid lg:grid-cols-2 lg:min-h-[calc(100vh-64px)]">
        <div className="hidden lg:block">
          <AuthHeroVisual visual={heroVisual} />
        </div>
        <div className="flex items-center justify-center px-4 py-8 lg:px-8 lg:py-10">
          <div className="w-full max-w-[400px] animate-pulse">
            <div className="h-5 w-40 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="mt-4 h-8 w-64 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="mt-2 h-4 w-72 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="mt-6 h-10 rounded-lg bg-slate-200 dark:bg-slate-800" />
            <div className="mt-3 h-10 rounded-lg bg-slate-200 dark:bg-slate-800" />
            <div className="mt-4 h-10 rounded-lg bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>
      </main>
    );
  }

  // ── Render session expired ──
  if (sessionExpired) {
    return (
      <main className="lg:grid lg:grid-cols-2 lg:min-h-[calc(100vh-64px)]">
        <div className="hidden lg:block">
          <AuthHeroVisual visual={heroVisual} />
        </div>

        <div className="flex items-center justify-center px-4 py-8 lg:px-8 lg:py-10">
          <div className="w-full max-w-[400px] text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <span className="text-2xl">⏰</span>
            </div>
            <h1 className="mt-4 text-2xl font-extrabold text-slate-900 dark:text-white">
              {copy.sessionExpiredTitle}
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {copy.sessionExpired}
            </p>
            <Link
              href="/password/forgot"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#FF9900] px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm hover:bg-[#F08700] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF9900]/30"
            >
              {copy.restartFlow}
            </Link>
            <Link
              href="/login"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#0D9488] underline underline-offset-2 decoration-[#0D9488]/40 hover:decoration-[#0D9488] dark:text-[#2DD4BF] dark:decoration-[#2DD4BF]/40 dark:hover:decoration-[#2DD4BF]"
            >
              <ArrowLeft size={12} />
              {copy.back}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // ── Render normal ──
  return (
    <main className="lg:grid lg:grid-cols-2 lg:min-h-[calc(100vh-64px)]">
      <div className="hidden lg:block">
        <AuthHeroVisual visual={heroVisual} />
      </div>

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

          {/* Email line (read-only) */}
          {maskedEmail && (
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/40">
              <p className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {copy.forAccount}
              </p>
              <p className="mt-0.5 font-mono text-sm text-slate-900 dark:text-white">
                {maskedEmail}
              </p>
            </div>
          )}

          <form
            onSubmit={handleSubmit(onSubmitPassword)}
            noValidate
            className="mt-6 space-y-4"
          >
            {/* New Password — wrapper relative pour positionner le popover */}
            <div className="relative">
              <label
                htmlFor="new-password"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                {copy.newPwd}
              </label>
              <div className="relative mt-1.5">
                <input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  aria-invalid={!!errors.password}
                  className={`w-full rounded-lg border bg-white px-3.5 py-2.5 pr-10 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-600 ${
                    errors.password
                      ? "border-red-300 focus:border-red-400 focus:ring-4 focus:ring-red-200 dark:border-red-800"
                      : "border-slate-200 focus:border-[#FF9900] focus:ring-4 focus:ring-[#FF9900]/20 dark:border-slate-800 dark:focus:border-[#FFAE33]"
                  }`}
                  {...register("password", {
                    required: copy.requiredPassword,
                    validate: (value) =>
                      validateStrongPassword(value, resetEmail, fr),
                    onBlur: () => setIsPasswordFocused(false),
                  })}
                  onFocus={() => setIsPasswordFocused(true)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? copy.hidePwd : copy.showPwd}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Strength indicator avec popover/bottom sheet */}
              <PasswordStrengthIndicator
                password={password}
                context={passwordContext}
                isFocused={isPasswordFocused}
                copy={passwordStrengthCopy}
                onCloseAction={() => setIsPasswordFocused(false)}  //
              />

              {!errors.password && password.length === 0 && (
                <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  {copy.hint}
                </p>
              )}

              {errors.password && (
                <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">
                  {String(errors.password.message)}
                </p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="confirm-password"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                {copy.confirmPwd}
              </label>
              <div className="relative mt-1.5">
                <input
                  id="confirm-password"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  onPaste={handleConfirmPaste}
                  aria-invalid={!!errors.confirmPassword}
                  className={`w-full rounded-lg border bg-white px-3.5 py-2.5 pr-10 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-600 ${
                    errors.confirmPassword
                      ? "border-red-300 focus:border-red-400 focus:ring-4 focus:ring-red-200 dark:border-red-800"
                      : "border-slate-200 focus:border-[#FF9900] focus:ring-4 focus:ring-[#FF9900]/20 dark:border-slate-800 dark:focus:border-[#FFAE33]"
                  }`}
                  {...register("confirmPassword", {
                    validate: (value) => value === password || copy.mismatch,
                  })}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? copy.hidePwd : copy.showPwd}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">
                  {String(errors.confirmPassword.message)}
                </p>
              )}
            </div>

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
              disabled={resetPasswordMutation.isPending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#FF9900] px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm transition-colors hover:bg-[#F08700] active:bg-[#E07A00] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF9900]/30"
            >
              {resetPasswordMutation.isPending ? (
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

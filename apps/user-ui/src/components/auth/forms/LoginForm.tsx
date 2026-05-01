"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";
import { useForm } from "react-hook-form";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getApiErrorData,
  getApiErrorMessage,
  hasApiBaseUrl,
  loginUser,
  type LoginPayload,
  type LoginResponse,
} from "@/services/auth.api";
import type { HeroVisual } from "@/lib/auth/hero-visuals";
import AuthHeroVisual from "@/components/auth/visual/AuthHeroVisual";


type FormData = {
  email: string;
  password: string;
  remember: boolean;
};

type Props = {
  heroVisual: HeroVisual;
};

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.2 6.2 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.1-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.2 6.2 29.3 4 24 4c-7.7 0-14.4 4.3-17.7 10.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.2C29.3 35.4 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.6 5.1C9.4 39.7 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.3 5.2C40.9 35.6 44 30.3 44 24c0-1.1-.1-2.3-.4-3.5z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#1877F2" d="M24 4C13 4 4 13 4 24s9 20 20 20 20-9 20-20S35 4 24 4z" />
      <path fill="#fff" d="M26.6 38V26.8h3.7l.6-4.4h-4.3v-2.8c0-1.3.4-2.2 2.2-2.2h2.3V13.5c-.4-.1-1.8-.2-3.4-.2-3.4 0-5.7 2.1-5.7 6v3.1h-3.8v4.4H24V38h2.6z" />
    </svg>
  );
}

function buildCopy(lang: string) {
  const fr = lang === "fr";
  return {
    trust: fr ? "Connexion sécurisée" : "Secure connection",
    title: fr ? "Connectez-vous" : "Sign in to Yamba",
    subtitle: fr
      ? "Reprenez là où vous vous êtes arrêté."
      : "Pick up where you left off.",
    google: fr ? "Continuer avec Google" : "Continue with Google",
    facebook: fr ? "Continuer avec Facebook" : "Continue with Facebook",
    orMail: fr ? "ou par e-mail" : "or with email",
    email: fr ? "E-mail" : "Email",
    emailPh: fr ? "vous@email.com" : "you@email.com",
    password: fr ? "Mot de passe" : "Password",
    forgot: fr ? "Oublié ?" : "Forgot?",
    remember: fr ? "Rester connecté" : "Stay signed in",
    cta: fr ? "Se connecter" : "Sign in",
    ctaLoading: fr ? "Connexion…" : "Signing in…",
    notMemberYet: fr ? "Pas encore membre ?" : "Not a member yet?",
    signup: fr ? "Inscrivez-vous" : "Sign up",
    showPasswordAria: fr ? "Afficher le mot de passe" : "Show password",
    hidePasswordAria: fr ? "Masquer le mot de passe" : "Hide password",
    requiredEmail: fr ? "L'e-mail est requis." : "Email is required.",
    invalidEmail: fr
      ? "Veuillez saisir un e-mail valide."
      : "Please enter a valid email.",
    requiredPassword: fr
      ? "Le mot de passe est requis."
      : "Password is required.",
    minPassword: fr
      ? "Le mot de passe doit contenir au moins 8 caractères."
      : "Password must be at least 8 characters.",
    genericError: fr
      ? "Connexion impossible pour le moment."
      : "Unable to sign in right now.",
    invalidCredentials: fr
      ? "E-mail ou mot de passe incorrect."
      : "Invalid email or password.",
    configError: fr
      ? "La configuration de l'application est incomplète."
      : "Application configuration is incomplete.",
    networkError: fr
      ? "Impossible de joindre le serveur. Vérifiez votre connexion."
      : "Unable to reach the server. Please check your connection.",
    rateLimitError: fr
      ? "Trop de tentatives. Réessayez dans quelques instants."
      : "Too many attempts. Please try again in a moment.",
  };
}

type Copy = ReturnType<typeof buildCopy>;

function normalizeMessage(message?: string | null) {
  return String(message ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function localizeLoginError(message: string | undefined, copy: Copy) {
  const normalized = normalizeMessage(message);
  if (!normalized) return copy.genericError;

  if (
    normalized === "invalid email or password" ||
    normalized === "invalid credentials" ||
    normalized === "unauthorized" ||
    normalized === "email or password incorrect" ||
    normalized === "incorrect email or password" ||
    normalized === "request failed with status code 401"
  ) {
    return copy.invalidCredentials;
  }

  if (normalized === "email is required" || normalized === "e-mail is required") {
    return copy.requiredEmail;
  }

  if (
    normalized === "please enter a valid email." ||
    normalized === "please enter a valid email" ||
    normalized === "invalid email" ||
    normalized === "invalid email format"
  ) {
    return copy.invalidEmail;
  }

  if (normalized === "password is required") {
    return copy.requiredPassword;
  }

  if (
    normalized === "password must be at least 8 characters." ||
    normalized === "password must be at least 8 characters" ||
    normalized === "password must be at least 8 characters long"
  ) {
    return copy.minPassword;
  }

  if (
    normalized.includes("network error") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("load failed")
  ) {
    return copy.networkError;
  }

  if (
    normalized.includes("too many requests") ||
    normalized.includes("rate limit") ||
    normalized.includes("too many attempts")
  ) {
    return copy.rateLimitError;
  }

  return copy.genericError;
}

export default function LoginForm({ heroVisual }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { lang } = useUiPreferences();
  const [passwordVisible, setPasswordVisible] = useState(false);

  const copy = useMemo(() => buildCopy(lang), [lang]);

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<FormData>({
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      email: "",
      password: "",
      remember: true, // ✅ coché par défaut (UX friendly)
    },
  });

  const loginMutation = useMutation<LoginResponse, unknown, LoginPayload>({
    mutationFn: loginUser,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["user"] });
      const redirect = searchParams.get("redirect");
      router.push(redirect || "/");
      router.refresh();
    },
    onError: (error) => {
      const data = getApiErrorData(error);

      if (data?.errors?.email) {
        setError("email", {
          type: "server",
          message: localizeLoginError(String(data.errors.email), copy),
        });
      }

      if (data?.errors?.password) {
        setError("password", {
          type: "server",
          message: localizeLoginError(String(data.errors.password), copy),
        });
      }

      if (!data?.errors?.email && !data?.errors?.password) {
        const rawMessage = getApiErrorMessage(error, copy.invalidCredentials);
        setError("root.serverError", {
          type: "server",
          message: localizeLoginError(rawMessage, copy),
        });
      }
    },
  });

  const onSubmit = async (values: FormData) => {
    clearErrors("root.serverError");

    if (!hasApiBaseUrl()) {
      setError("root.serverError", {
        type: "config",
        message: copy.configError,
      });
      return;
    }

    try {
      await loginMutation.mutateAsync({
        email: values.email.trim().toLowerCase(),
        password: values.password,
        rememberMe: values.remember,
      });
    } catch {
      // géré par onError
    }
  };

  // ====== Styles centralisés ======
  const inputBase =
    "mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none " +
    "transition-colors placeholder:text-slate-400 " +
    "focus:border-[#FF9900] focus:ring-4 focus:ring-[#FF9900]/20 " +
    "dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-600 " +
    "dark:focus:border-[#FFAE33] dark:focus:ring-[#FF9900]/15";
  const inputError =
    "border-red-300 focus:border-red-400 focus:ring-red-200 dark:border-red-800 dark:focus:border-red-700 dark:focus:ring-red-900/40";
  const labelBase = "text-xs font-semibold text-slate-800 dark:text-slate-100";
  const linkSubtle =
    "text-xs font-semibold text-[#0F766E] hover:text-[#115E59] hover:underline " +
    "dark:text-[#2DD4BF] dark:hover:text-[#5EEAD4]";
  const oauthBtn =
    "flex w-full items-center justify-center gap-2.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 " +
    "text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50 " +
    "dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-900/50";

  return (
    <main className="lg:grid lg:grid-cols-2 lg:min-h-[calc(100vh-64px)]">
      {/* LEFT — visuel desktop only */}
      <div className="hidden lg:block">
        <AuthHeroVisual visual={heroVisual} />
      </div>

      {/* RIGHT — formulaire */}
      <div className="flex items-center justify-center px-4 py-8 lg:px-8 lg:py-10">
        <div className="w-full max-w-[360px]">
          {/* Trust pill */}
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#0F766E] bg-white px-2.5 py-1 text-[11px] font-medium text-[#0F766E] dark:border-[#2DD4BF] dark:bg-slate-950 dark:text-[#2DD4BF]">
            <ShieldCheck size={12} />
            <span>{copy.trust}</span>
          </div>

          {/* Titre + sous-titre */}
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white lg:text-3xl">
            {copy.title}
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            {copy.subtitle}
          </p>

          {/* OAuth — en haut */}
          <div className="mt-6 space-y-2">
            <button
              type="button"
              onClick={() => console.log("google oauth (ui only)")}
              className={oauthBtn}
            >
              <GoogleIcon />
              {copy.google}
            </button>
            <button
              type="button"
              onClick={() => console.log("facebook oauth (ui only)")}
              className={oauthBtn}
            >
              <FacebookIcon />
              {copy.facebook}
            </button>
          </div>

          {/* Séparateur */}
          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {copy.orMail}
            </span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
          </div>

          {/* Form e-mail/password */}
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
            <div>
              <label htmlFor="email" className={labelBase}>
                {copy.email}
              </label>
              <input
                id="email"
                type="email"
                inputMode="email"
                enterKeyHint="next"
                autoComplete="email"
                placeholder={copy.emailPh}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
                className={`${inputBase} ${errors.email ? inputError : ""}`}
                {...register("email", {
                  required: copy.requiredEmail,
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: copy.invalidEmail,
                  },
                  setValueAs: (value) =>
                    typeof value === "string" ? value.trim().toLowerCase() : value,
                  onChange: () => {
                    clearErrors("email");
                    clearErrors("root.serverError");
                  },
                })}
              />
              {errors.email?.message && (
                <p
                  id="email-error"
                  className="mt-1.5 text-xs text-red-600 dark:text-red-400"
                >
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="password" className={labelBase}>
                  {copy.password}
                </label>
                <Link href="/password/forgot" className={linkSubtle}>
                  {copy.forgot}
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={passwordVisible ? "text" : "password"}
                  enterKeyHint="go"
                  autoComplete="current-password"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? "password-error" : undefined}
                  className={`${inputBase} pr-11 ${errors.password ? inputError : ""}`}
                  {...register("password", {
                    required: copy.requiredPassword,
                    minLength: {
                      value: 8,
                      message: copy.minPassword,
                    },
                    onChange: () => {
                      clearErrors("password");
                      clearErrors("root.serverError");
                    },
                  })}
                />
                {/* Bouton œil — centrage robuste avec inset-y-0 + my-auto */}
                <button
                  type="button"
                  onClick={() => setPasswordVisible((v) => !v)}
                  aria-label={
                    passwordVisible ? copy.hidePasswordAria : copy.showPasswordAria
                  }
                  aria-pressed={passwordVisible}
                  className="absolute inset-y-0 right-1.5 my-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  {passwordVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password?.message && (
                <p
                  id="password-error"
                  className="mt-1.5 text-xs text-red-600 dark:text-red-400"
                >
                  {errors.password.message}
                </p>
              )}
            </div>

            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 accent-[#FF9900] focus:ring-2 focus:ring-[#FF9900]/30 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-950"
                {...register("remember")}
              />
              <span>{copy.remember}</span>
            </label>

            {errors.root?.serverError?.message && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200"
              >
                {errors.root.serverError.message}
              </div>
            )}

            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#FF9900] px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm transition-colors hover:bg-[#F08700] active:bg-[#E07A00] disabled:opacity-60 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF9900]/30 dark:focus-visible:ring-[#FF9900]/20"
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {copy.ctaLoading}
                </>
              ) : (
                copy.cta
              )}
            </button>
          </form>

          {/* Footer signup — texte simple sur une ligne, lien orange */}
          <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
            {copy.notMemberYet}{" "}
            <Link
              href="/register"
              className="font-bold text-[#FF9900] hover:underline hover:underline-offset-[3px] dark:text-[#FFB347]"
            >
              {copy.signup}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

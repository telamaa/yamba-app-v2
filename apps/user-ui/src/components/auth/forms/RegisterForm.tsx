"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";
import { useForm } from "react-hook-form";
import { useRouter } from "@/i18n/navigation";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import {
  getApiErrorData,
  getApiErrorMessage,
  hasApiBaseUrl,
  registerUser,
  type RegisterPayload,
  type RegisterResponse,
} from "@/services/auth.api";
import type { HeroVisual } from "@/lib/auth/hero-visuals";
import { LEGAL_VERSIONS } from "@/lib/legal/versions";
import {
  getPasswordChecks,
  isPasswordValid,
  type PasswordContext,
} from "@/lib/auth/password-strength";
import PasswordStrengthIndicator from "../shared/PasswordStrengthIndicator";
import { useToast } from "@/components/ui/Toast";
import AuthHeroVisual from "@/components/auth/visual/AuthHeroVisual";

type RegisterFormData = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  passwordConfirm: string;
  termsAccepted: boolean;
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
    trust: fr ? "Inscription sécurisée" : "Secure signup",
    title: fr ? "Devenez Yamber" : "Become a Yamber",
    subtitle: fr
      ? "Envoyez ou transportez des colis, en toute simplicité."
      : "Send or transport parcels, simply.",
    google: fr ? "Continuer avec Google" : "Continue with Google",
    facebook: fr ? "Continuer avec Facebook" : "Continue with Facebook",
    orMail: fr ? "ou par e-mail" : "or with email",
    firstName: fr ? "Prénom" : "First name",
    firstNamePh: fr ? "Aminata" : "Aminata",
    lastName: fr ? "Nom" : "Last name",
    lastNamePh: fr ? "Diallo" : "Diallo",
    email: fr ? "E-mail" : "Email",
    emailPh: fr ? "vous@email.com" : "you@email.com",
    password: fr ? "Mot de passe" : "Password",
    passwordConfirm: fr ? "Confirmer le mot de passe" : "Confirm password",
    cta: fr ? "Créer mon compte" : "Create my account",
    ctaLoading: fr ? "Création…" : "Creating…",
    haveAccount: fr ? "Déjà membre ?" : "Already a member?",
    login: fr ? "Connectez-vous" : "Sign in",
    showPasswordAria: fr ? "Afficher le mot de passe" : "Show password",
    hidePasswordAria: fr ? "Masquer le mot de passe" : "Hide password",
    requiredFirstName: fr ? "Le prénom est requis." : "First name is required.",
    requiredLastName: fr ? "Le nom est requis." : "Last name is required.",
    requiredEmail: fr ? "L'e-mail est requis." : "Email is required.",
    invalidEmail: fr ? "Veuillez saisir un e-mail valide." : "Please enter a valid email.",
    requiredPassword: fr ? "Le mot de passe est requis." : "Password is required.",
    weakPassword: fr
      ? "Le mot de passe ne respecte pas tous les critères."
      : "Password does not meet all criteria.",
    requiredPasswordConfirm: fr
      ? "Veuillez confirmer le mot de passe."
      : "Please confirm the password.",
    passwordMismatch: fr ? "Les mots de passe ne correspondent pas." : "Passwords do not match.",
    requiredTerms: fr
      ? "Vous devez accepter les conditions pour continuer."
      : "You must accept the terms to continue.",
    cguTextStart: fr ? "J'accepte les" : "I accept the",
    cguLink1: fr ? "Conditions générales d'utilisation" : "Terms of Service",
    cguAnd: fr ? "et la" : "and the",
    cguLink2: fr ? "Politique de confidentialité" : "Privacy Policy",
    cguDot: fr ? " de Yamba." : " of Yamba.",
    genericError: fr ? "Inscription impossible pour le moment." : "Unable to sign up right now.",
    configError: fr
      ? "La configuration de l'application est incomplète."
      : "Application configuration is incomplete.",
    pasteBlockedTitle: fr ? "Collage désactivé" : "Paste disabled",
    pasteBlocked: fr
      ? "Pour votre sécurité, veuillez ressaisir le mot de passe."
      : "For your security, please retype the password.",
    pwdPopover: {
      title: fr ? "Sécurité du mot de passe" : "Password security",
      level: fr ? "Niveau" : "Level",
      weak: fr ? "Faible" : "Weak",
      medium: fr ? "Moyen" : "Medium",
      strong: fr ? "Fort" : "Strong",
      excellent: fr ? "Excellent" : "Excellent",
      close: fr ? "Compris" : "Got it",
      criteria: {
        minLength: fr ? "Au moins 8 caractères" : "At least 8 characters",
        lowercase: fr ? "Une minuscule" : "One lowercase letter",
        uppercase: fr ? "Une majuscule" : "One uppercase letter",
        number: fr ? "Un chiffre" : "One number",
        special: fr ? "Un caractère spécial" : "One special character",
        personalInfo: fr ? "Pas votre nom ou e-mail" : "Not your name or email",
        simpleDate: fr ? "Pas une date évidente" : "Not an obvious date",
        predictable: fr ? "Pas de suite simple (1234, abcd)" : "No simple sequence (1234, abcd)",
      },
    },
  };
}

export default function RegisterForm({ heroVisual }: Props) {
  const router = useRouter();
  const { lang } = useUiPreferences();
  const { toast } = useToast();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const copy = useMemo(() => buildCopy(lang), [lang]);

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    watch,
    getValues,
    formState: { errors },
  } = useForm<RegisterFormData>({
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      passwordConfirm: "",
      termsAccepted: false,
    },
  });

  const watchedPassword = watch("password") ?? "";
  const watchedFirstName = watch("firstName") ?? "";
  const watchedLastName = watch("lastName") ?? "";
  const watchedEmail = watch("email") ?? "";

  const passwordContext: PasswordContext = {
    firstName: watchedFirstName,
    lastName: watchedLastName,
    email: watchedEmail,
  };

  // 🔒 Bloque le coller sur le champ "Confirmer le mot de passe"
  const handleBlockPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    toast({
      type: "info",
      title: copy.pasteBlockedTitle,
      message: copy.pasteBlocked,
    });
  };

  const registerMutation = useMutation<RegisterResponse, unknown, RegisterPayload>({
    mutationFn: registerUser,
    onSuccess: (data, variables) => {
      if (!data?.verificationToken) {
        setError("root.serverError", { type: "server", message: copy.genericError });
        return;
      }

      const normalizedEmail = variables.email.trim().toLowerCase();

      // 🔒 SÉCURITÉ : token + email écrits en sessionStorage AVANT la redirection
      sessionStorage.setItem("register_verification_token", String(data.verificationToken));
      sessionStorage.setItem("register_verification_email", normalizedEmail);

      // 🔒 SÉCURITÉ : URL propre, pas d'email exposé via logs serveur, historique
      // navigateur, referrer headers ou analytics. L'email est lu côté verify
      // depuis sessionStorage (avec fallback URL pour les liens magiques email)
      router.push("/register/verify");
      router.refresh();
    },
    onError: (error) => {
      const data = getApiErrorData(error);
      let hasFieldErrors = false;
      const fieldNames: Array<keyof RegisterFormData> = [
        "firstName",
        "lastName",
        "email",
        "password",
      ];

      for (const field of fieldNames) {
        const fieldMessage = data?.errors?.[field];
        if (fieldMessage) {
          hasFieldErrors = true;
          setError(field, { type: "server", message: String(fieldMessage) });
        }
      }

      if (!hasFieldErrors) {
        setError("root.serverError", {
          type: "server",
          message: getApiErrorMessage(error, copy.genericError),
        });
      }
    },
  });

  const onSubmit = async (values: RegisterFormData) => {
    clearErrors("root.serverError");

    if (!hasApiBaseUrl()) {
      setError("root.serverError", { type: "config", message: copy.configError });
      return;
    }

    const checks = getPasswordChecks(values.password, {
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
    });
    if (!isPasswordValid(checks)) {
      setError("password", { type: "validate", message: copy.weakPassword });
      return;
    }

    if (values.password !== values.passwordConfirm) {
      setError("passwordConfirm", { type: "validate", message: copy.passwordMismatch });
      return;
    }

    try {
      await registerMutation.mutateAsync({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim().toLowerCase(),
        password: values.password,
        termsAccepted: true,
        termsVersion: LEGAL_VERSIONS.terms,
        privacyVersion: LEGAL_VERSIONS.privacy,
      });
    } catch {
      // géré par onError
    }
  };

  const inputBase =
    "mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none " +
    "transition-colors placeholder:text-slate-400 " +
    "focus:border-[#FF9900] focus:ring-4 focus:ring-[#FF9900]/20 " +
    "dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-600 " +
    "dark:focus:border-[#FFAE33] dark:focus:ring-[#FF9900]/15";
  const inputError =
    "border-red-300 focus:border-red-400 focus:ring-red-200 dark:border-red-800 dark:focus:border-red-700 dark:focus:ring-red-900/40";
  const labelBase = "text-xs font-semibold text-slate-800 dark:text-slate-100";
  const oauthBtn =
    "flex w-full items-center justify-center gap-2.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 " +
    "text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50 " +
    "dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-900/50";

  // 🎨 Style des liens CGU/Privacy — teal plus vif + underline subtil avec offset (pattern Stripe)
  const cguLinkClass =
    "font-semibold text-[#0D9488] underline underline-offset-2 decoration-[#0D9488]/40 " +
    "hover:decoration-[#0D9488] " +
    "dark:text-[#2DD4BF] dark:decoration-[#2DD4BF]/40 dark:hover:decoration-[#2DD4BF]";

  return (
    <main className="lg:grid lg:grid-cols-2 lg:min-h-[calc(100vh-64px)]">
      {/* LEFT — visuel desktop */}
      <div className="hidden lg:block">
        <AuthHeroVisual visual={heroVisual} />
      </div>

      {/* RIGHT — formulaire */}
      <div className="flex items-center justify-center px-4 py-8 lg:px-8 lg:py-10">
        <div className="w-full max-w-[380px]">
          {/* Trust pill */}
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#0F766E] bg-white px-2.5 py-1 text-[11px] font-medium text-[#0F766E] dark:border-[#2DD4BF] dark:bg-slate-950 dark:text-[#2DD4BF]">
            <ShieldCheck size={12} />
            <span>{copy.trust}</span>
          </div>

          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white lg:text-3xl">
            {copy.title}
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{copy.subtitle}</p>

          {/* OAuth */}
          <div className="mt-6 space-y-2">
            <button
              type="button"
              onClick={() => console.log("google oauth")}
              className={oauthBtn}
            >
              <GoogleIcon />
              {copy.google}
            </button>
            <button
              type="button"
              onClick={() => console.log("facebook oauth")}
              className={oauthBtn}
            >
              <FacebookIcon />
              {copy.facebook}
            </button>
          </div>

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {copy.orMail}
            </span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
            {/* Prénom + Nom */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="firstName" className={labelBase}>
                  {copy.firstName}
                </label>
                <input
                  id="firstName"
                  autoComplete="given-name"
                  enterKeyHint="next"
                  placeholder={copy.firstNamePh}
                  aria-invalid={!!errors.firstName}
                  aria-describedby={errors.firstName ? "firstName-error" : undefined}
                  className={`${inputBase} ${errors.firstName ? inputError : ""}`}
                  {...register("firstName", {
                    required: copy.requiredFirstName,
                    setValueAs: (v) => (typeof v === "string" ? v.trim() : v),
                    onChange: () => {
                      clearErrors("firstName");
                      clearErrors("root.serverError");
                    },
                  })}
                />
                {errors.firstName?.message && (
                  <p
                    id="firstName-error"
                    className="mt-1 text-xs text-red-600 dark:text-red-400"
                  >
                    {errors.firstName.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="lastName" className={labelBase}>
                  {copy.lastName}
                </label>
                <input
                  id="lastName"
                  autoComplete="family-name"
                  enterKeyHint="next"
                  placeholder={copy.lastNamePh}
                  aria-invalid={!!errors.lastName}
                  aria-describedby={errors.lastName ? "lastName-error" : undefined}
                  className={`${inputBase} ${errors.lastName ? inputError : ""}`}
                  {...register("lastName", {
                    required: copy.requiredLastName,
                    setValueAs: (v) => (typeof v === "string" ? v.trim() : v),
                    onChange: () => {
                      clearErrors("lastName");
                      clearErrors("root.serverError");
                    },
                  })}
                />
                {errors.lastName?.message && (
                  <p
                    id="lastName-error"
                    className="mt-1 text-xs text-red-600 dark:text-red-400"
                  >
                    {errors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className={labelBase}>
                {copy.email}
              </label>
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                enterKeyHint="next"
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
                  setValueAs: (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
                  onChange: () => {
                    clearErrors("email");
                    clearErrors("root.serverError");
                  },
                })}
              />
              {errors.email?.message && (
                <p id="email-error" className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className={labelBase}>
                {copy.password}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={passwordVisible ? "text" : "password"}
                  autoComplete="new-password"
                  enterKeyHint="next"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? "password-error" : undefined}
                  className={`${inputBase} pr-11 ${errors.password ? inputError : ""}`}
                  {...register("password", {
                    required: copy.requiredPassword,
                    onChange: () => {
                      clearErrors("password");
                      clearErrors("root.serverError");
                    },
                  })}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => {
                    if (window.matchMedia("(min-width: 1024px)").matches) {
                      setPasswordFocused(false);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => setPasswordVisible((v) => !v)}
                  aria-label={passwordVisible ? copy.hidePasswordAria : copy.showPasswordAria}
                  aria-pressed={passwordVisible}
                  className="absolute inset-y-0 right-1.5 my-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  {passwordVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              <PasswordStrengthIndicator
                password={watchedPassword}
                context={passwordContext}
                isFocused={passwordFocused}
                copy={copy.pwdPopover}
                onCloseAction={() => setPasswordFocused(false)}
              />

              {errors.password?.message && (
                <p
                  id="password-error"
                  className="mt-1 text-xs text-red-600 dark:text-red-400"
                >
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Confirm password — paste désactivé */}
            <div>
              <label htmlFor="passwordConfirm" className={labelBase}>
                {copy.passwordConfirm}
              </label>
              <div className="relative">
                <input
                  id="passwordConfirm"
                  type={confirmVisible ? "text" : "password"}
                  autoComplete="new-password"
                  enterKeyHint="done"
                  aria-invalid={!!errors.passwordConfirm}
                  aria-describedby={
                    errors.passwordConfirm ? "passwordConfirm-error" : undefined
                  }
                  // 🔒 Sécurité UX : empêche le coller, le drop, et l'auto-fill par les password managers
                  // Force l'utilisateur à retaper son mot de passe pour valider qu'il s'en souvient
                  onPaste={handleBlockPaste}
                  onDrop={(e) => e.preventDefault()}
                  data-1p-ignore
                  data-lpignore="true"
                  data-form-type="other"
                  className={`${inputBase} pr-11 ${errors.passwordConfirm ? inputError : ""}`}
                  {...register("passwordConfirm", {
                    required: copy.requiredPasswordConfirm,
                    validate: (v) =>
                      v === getValues("password") || copy.passwordMismatch,
                    onChange: () => {
                      clearErrors("passwordConfirm");
                      clearErrors("root.serverError");
                    },
                  })}
                />
                <button
                  type="button"
                  onClick={() => setConfirmVisible((v) => !v)}
                  aria-label={
                    confirmVisible ? copy.hidePasswordAria : copy.showPasswordAria
                  }
                  className="absolute inset-y-0 right-1.5 my-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 dark:text-slate-400"
                >
                  {confirmVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.passwordConfirm?.message && (
                <p
                  id="passwordConfirm-error"
                  className="mt-1 text-xs text-red-600 dark:text-red-400"
                >
                  {errors.passwordConfirm.message}
                </p>
              )}
            </div>

            {/* CGU — liens avec teal-600 + underline subtil */}
            <div className="pt-2">
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 flex-shrink-0 rounded border-slate-300 accent-[#FF9900] focus:ring-2 focus:ring-[#FF9900]/30 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-950"
                  {...register("termsAccepted", { required: copy.requiredTerms })}
                />
                <span className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                  {copy.cguTextStart}{" "}
                  <Link
                    href="/legal/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cguLinkClass}
                  >
                    {copy.cguLink1}
                  </Link>{" "}
                  {copy.cguAnd}{" "}
                  <Link
                    href="/legal/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cguLinkClass}
                  >
                    {copy.cguLink2}
                  </Link>
                  {copy.cguDot}
                </span>
              </label>
              {errors.termsAccepted?.message && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {errors.termsAccepted.message}
                </p>
              )}
            </div>

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
              disabled={registerMutation.isPending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#FF9900] px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm transition-colors hover:bg-[#F08700] active:bg-[#E07A00] disabled:opacity-60 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF9900]/30"
            >
              {registerMutation.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {copy.ctaLoading}
                </>
              ) : (
                copy.cta
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
            {copy.haveAccount}{" "}
            <Link
              href="/login"
              className="font-bold text-[#FF9900] hover:underline hover:underline-offset-[3px] dark:text-[#FFB347]"
            >
              {copy.login}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

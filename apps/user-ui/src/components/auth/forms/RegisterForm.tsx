"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";
import { useForm } from "react-hook-form";
import { useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { REGISTER_REDIRECT_KEY, sanitizeRedirect, withRedirect } from "@/lib/auth/safe-redirect";
import { setPendingPassword } from "@/lib/auth/register-flow-state";
import GoogleSignInButton from "@/components/auth/shared/GoogleSignInButton";
import { Eye, EyeOff, Loader2 } from "lucide-react";
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
import {
  firstFailingCheck,
  passwordCheckMessage,
  passwordCodeMessage,
  readAuthErrorDetails,
  registerCodeMessage,
} from "@/lib/auth/auth-error-codes";
import PasswordStrengthIndicator from "../shared/PasswordStrengthIndicator";
import AuthHeroVisual from "@/components/auth/visual/AuthHeroVisual";

type RegisterFormData = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  termsAccepted: boolean;
};

type Props = {
  heroVisual: HeroVisual;
};

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
    // « Yamba » sort du titre (revue du 10/11) : 25 caractères passaient sur
    // DEUX lignes sur un iPhone, soit ~45 pt pris à un écran qui doit tenir
    // sur un écran. La marque est déjà partout autour — l'en-tête du site,
    // l'application elle-même sur mobile.
    title: fr ? "Crée ton compte" : "Create your account",
    subtitle: fr
      ? "Envoie ou transporte des colis, en toute simplicité."
      : "Send or transport parcels, simply.",
    facebook: fr ? "Continuer avec Facebook" : "Continue with Facebook",
    orSocial: fr ? "ou continue avec" : "or continue with",
    firstName: fr ? "Prénom" : "First name",
    firstNamePh: "Marie",
    lastName: fr ? "Nom" : "Last name",
    lastNamePh: "Love",
    email: fr ? "E-mail" : "Email",
    // L'adresse PROLONGE les deux prénoms au-dessus d'elle : un exemple qui
    // se lit comme un tout vaut mieux que trois exemples sans rapport.
    emailPh: "marielove@email.com",
    password: fr ? "Mot de passe" : "Password",
    cta: fr ? "Créer mon compte" : "Create my account",
    ctaLoading: fr ? "Création…" : "Creating…",
    haveAccount: fr ? "Déjà membre ?" : "Already a member?",
    login: fr ? "Connecte-toi" : "Sign in",
    showPasswordAria: fr ? "Afficher le mot de passe" : "Show password",
    hidePasswordAria: fr ? "Masquer le mot de passe" : "Hide password",
    requiredFirstName: fr ? "Le prénom est requis." : "First name is required.",
    requiredLastName: fr ? "Le nom est requis." : "Last name is required.",
    requiredEmail: fr ? "L'e-mail est requis." : "Email is required.",
    invalidEmail: fr ? "Saisis un e-mail valide." : "Please enter a valid email.",
    requiredPassword: fr ? "Le mot de passe est requis." : "Password is required.",
    requiredTerms: fr
      ? "Tu dois accepter les conditions pour continuer."
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
        personalInfo: fr ? "Pas ton nom ni ton e-mail" : "Not your name or email",
        simpleDate: fr ? "Pas une date évidente" : "Not an obvious date",
        predictable: fr ? "Pas de suite simple (1234, abcd)" : "No simple sequence (1234, abcd)",
      },
    },
  };
}

export default function RegisterForm({ heroVisual }: Props) {
  const router = useRouter();
  const { lang } = useUiPreferences();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const copy = useMemo(() => buildCopy(lang), [lang]);
  // Page visée avant l'inscription (ex. réservation) : conservée jusqu'à la
  // connexion qui suit l'OTP — en sessionStorage, l'URL de vérification
  // reste propre.
  const searchParams = useSearchParams();
  const redirectTo = sanitizeRedirect(searchParams.get("redirect"));
  const loginHref = withRedirect("/login", redirectTo);

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>({
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
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

      // D92 3A — le mot de passe reste en MÉMOIRE DE MODULE (jamais en
      // stockage, jamais dans l'URL) pour que l'écran de vérification puisse
      // enchaîner la connexion, comme le fait le téléphone. Un rechargement
      // le perd : le repli est la connexion préremplie.
      setPendingPassword(normalizedEmail, variables.password);
      if (redirectTo) sessionStorage.setItem(REGISTER_REDIRECT_KEY, redirectTo);
      else sessionStorage.removeItem(REGISTER_REDIRECT_KEY);

      // 🔒 SÉCURITÉ : URL propre, pas d'email exposé via logs serveur, historique
      // navigateur, referrer headers ou analytics. L'email est lu côté verify
      // depuis sessionStorage (avec fallback URL pour les liens magiques email)
      router.push("/register/verify");
      router.refresh();
    },
    onError: (error) => {
      const data = getApiErrorData(error);

      // Codes de règle du serveur → message localisé sur LE champ concerné
      const details = readAuthErrorDetails(data);
      if (details?.type === "password") {
        setError("password", {
          type: "server",
          message: passwordCodeMessage(lang === "fr", details.code),
        });
        return;
      }
      if (details?.type === "register") {
        setError("email", {
          type: "server",
          message: registerCodeMessage(lang === "fr", details.code),
        });
        return;
      }

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
      // Nommer LE critère fautif (recette 03/09) — plus jamais « ne respecte pas tous les critères »
      setError("password", {
        type: "validate",
        message: passwordCheckMessage(lang === "fr", firstFailingCheck(checks)),
      });
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
    "mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-base sm:text-sm text-slate-900 outline-none " +
    "transition-colors placeholder:text-slate-400 " +
    "focus:border-[#FF9900] focus:ring-4 focus:ring-[#FF9900]/20 " +
    "dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-600 " +
    "dark:focus:border-[#FFAE33] dark:focus:ring-[#FF9900]/15";
  const inputError =
    "border-red-300 focus:border-red-400 focus:ring-red-200 dark:border-red-800 dark:focus:border-red-700 dark:focus:ring-red-900/40";
  // D91 — 13 px / 500 en gris moyen, et non 12 px / 600 en quasi-blanc : huit
  // libellés à la graisse du titre faisaient une page où rien ne recule.
  const labelBase = "text-[13px] font-medium text-slate-500 dark:text-slate-400";
  const oauthBtn =
    "flex w-full items-center justify-center gap-2.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 " +
    "text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50 " +
    "dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-900/50";

  // 🎨 Style des liens CGU/Privacy — teal plus vif + underline subtil avec offset (pattern Stripe)
  const cguLinkClass =
    "font-medium text-[#0D9488] underline underline-offset-2 decoration-[#0D9488]/40 " +
    "hover:decoration-[#0D9488] " +
    "dark:text-[#2DD4BF] dark:decoration-[#2DD4BF]/40 dark:hover:decoration-[#2DD4BF]";

  return (
    <main className="mx-auto w-full max-w-7xl px-4">
      {/* D92 — la largeur du contenu est celle de l'EN-TÊTE : `mx-auto
          max-w-7xl px-4`, la même ligne que `Header.tsx:99`. La page partait
          auparavant bord à bord, si bien que le logo et « Connexion » étaient
          les deux seuls éléments à respecter une marge : rien en dessous ne
          s'alignait sur eux, et la colonne de gauche touchait le bord de
          l'écran sur un grand moniteur.

          AUCUNE BORDURE, AUCUN COIN ARRONDI, AUCUNE MARGE VERTICALE (revue du
          10/11) : le contenu s'INCRUSTE dans la page. Un cadre ferait de
          l'inscription un objet POSÉ sur le site — une carte, une fenêtre —
          là où elle en est une page. Le dégradé de la colonne de gauche
          suffit à séparer les deux moitiés ; un trait en plus ne sépare rien
          qui ne le soit déjà, il ajoute seulement une frontière à lire.
          `overflow-hidden` est parti avec les coins : il n'était là que pour
          les rogner, et il met en péril tout `position: sticky` à venir. */}
      <div className="lg:grid lg:grid-cols-2 lg:min-h-[calc(var(--yamba-viewport)-64px)]">
      {/* LEFT — visuel desktop */}
      <div className="hidden lg:block">
        <AuthHeroVisual visual={heroVisual} />
      </div>

      {/* RIGHT — formulaire */}
      <div className="flex items-center justify-center px-4 py-8 lg:px-8 lg:py-10">
        <div className="w-full max-w-[380px]">
          {/* D91 — plus de pilule de sécurité en tête de colonne. Une affirmation de
              sécurité que l'on se décerne à soi-même n'ajoute aucune preuve :
              elle installe la question que personne ne se posait, et elle
              occupait le premier point de fixation de la colonne. La réassurance
              VÉRIFIABLE est sous le bouton, et les trois garanties concrètes
              sont dans la colonne de gauche. */}
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white lg:text-3xl">
            {copy.title}
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{copy.subtitle}</p>

          {/* `mt-6` : le bloc social créait cette respiration quand il était au
              dessus. Sans lui, le premier libellé collait au sous-titre. */}
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-3">
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
                  className="absolute bottom-0 right-1.5 top-1.5 my-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
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

            {/* D91 — PAS de champ « Confirmer le mot de passe ».
                Le mobile l'avait déjà retiré et motivé (A208) : le trousseau
                remplit les deux champs d'un coup, donc la confirmation ne
                confirme rien, et l'œil du champ fait le travail. Avec lui
                disparaît le blocage du collage, que le NCSC et le NIST
                déconseillent explicitement — il casse les gestionnaires de
                mots de passe et pousse vers des mots de passe tapables. */}

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

          {/* D91 — le social passe APRÈS le formulaire, comme sur le mobile.
              Il occupait la meilleure place de la page avec, en premier bouton
              actionnable, une porte qui ne s'ouvre pas encore. Les deux
              fournisseurs RESTENT offerts (arbitrage du 09/11 : « laisse la
              connexion Google active dans les interfaces, on paramétrera
              après ») — ils sont simplement servis après le chemin qui, lui,
              fonctionne. */}
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {copy.orSocial}
            </span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
          </div>

          <div className="space-y-2">
            <GoogleSignInButton redirectTo={redirectTo} text="signup_with" />
            <button
              type="button"
              onClick={() => console.log("facebook oauth")}
              className={oauthBtn}
            >
              <FacebookIcon />
              {copy.facebook}
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            {copy.haveAccount}{" "}
            <Link
              href={loginHref}
              className="font-medium text-[#FF9900] hover:underline hover:underline-offset-[3px] dark:text-[#FFB347]"
            >
              {copy.login}
            </Link>
          </p>
        </div>
      </div>
      </div>
    </main>
  );
}

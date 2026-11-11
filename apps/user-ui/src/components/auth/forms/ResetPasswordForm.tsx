"use client";

/**
 * ResetPasswordForm.tsx — le nouveau mot de passe, aligné sur le téléphone
 * (D97).
 * =======================================================================
 * Quatre défauts, dont deux qui faisaient échouer l'écran pour de bon :
 *
 *  1. **La confirmation du mot de passe est SUPPRIMÉE.** D91 l'avait retirée
 *     de l'inscription du site — l'œil et le gestionnaire de mots de passe la
 *     rendent inutile, et elle double le risque de faute sur un champ qu'on
 *     ne relit pas. Elle avait survécu ici. Avec elle part le **collage
 *     interdit** sur ce champ : empêcher le collage, c'est condamner
 *     précisément les mots de passe qu'on souhaite — ceux qu'un gestionnaire
 *     génère.
 *  2. **Les règles de mot de passe étaient RÉÉCRITES ici** (une soixantaine
 *     de lignes : longueur, casse, chiffre, caractère spécial, dates, suites,
 *     info personnelle) alors que `lib/auth/password-strength.ts` les porte
 *     déjà pour l'inscription et la jauge affichée juste en dessous. Deux
 *     copies d'une règle, dont une qui pouvait dériver sans que rien ne le
 *     dise. L'écran lit maintenant la source commune.
 *  3. **L'expiration se détectait sur le TEXTE du message** de l'API : on y
 *     cherchait un mot anglais. Une reformulation côté serveur, et l'écran
 *     affichait une erreur générique au lieu de proposer de recommencer.
 *     Le serveur pose `RESET_SESSION_EXPIRED` — on le lit (D96 4A).
 *  4. La pastille de sécurité auto-décernée (D91 1A) et le bouton qui change
 *     de mot en travaillant (D95 4A).
 *
 * **Reste en ternaires, délibérément** : les libellés des huit critères de la
 * jauge, parce qu'ils sont PARTAGÉS avec l'inscription — on migre l'écran que
 * l'on touche, pas celui d'à côté (doctrine de D92).
 */

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import {
  firstFailingCheck,
  passwordCheckMessage,
  passwordCodeMessage,
  readAuthErrorDetails,
} from "@/lib/auth/auth-error-codes";
import { getPasswordChecks } from "@/lib/auth/password-strength";
import { getApiErrorData, hasApiBaseUrl, resetPassword } from "@/services/auth.api";
import type { HeroVisual } from "@/lib/auth/hero-visuals";
import AuthHeroVisual from "@/components/auth/visual/AuthHeroVisual";
import { useToast } from "@/components/ui/Toast";
import PasswordStrengthIndicator from "@/components/auth/shared/PasswordStrengthIndicator";

type Props = {
  heroVisual: HeroVisual;
};

export default function ResetPasswordForm({ heroVisual }: Props) {
  const router = useRouter();
  const t = useTranslations("auth.reset");
  const fr = useLocale() === "fr";
  const { toast } = useToast();

  const [password, setPassword] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  const [token, setToken] = useState<string>("");
  const [resetEmail, setResetEmail] = useState<string>("");
  const [sessionExpired, setSessionExpired] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Hydration safe : on lit sessionStorage UNIQUEMENT côté client.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const jeton = sessionStorage.getItem("pwd_reset_token") ?? "";
    const adresse = sessionStorage.getItem("pwd_reset_email") ?? "";
    setToken(jeton);
    setResetEmail(adresse);
    setHydrated(true);
    if (!jeton) setSessionExpired(true);
  }, []);

  const passwordContext = useMemo(
    () => ({ email: resetEmail, firstName: "", lastName: "" }),
    [resetEmail]
  );

  /** Les libellés de la jauge — partagés avec l'inscription, donc hors de ce lot. */
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
        minLength: fr ? "8 caractères minimum" : "At least 8 characters",
        lowercase: fr ? "Une lettre minuscule" : "One lowercase letter",
        uppercase: fr ? "Une lettre majuscule" : "One uppercase letter",
        number: fr ? "Un chiffre" : "One number",
        special: fr ? "Un caractère spécial" : "One special character",
        personalInfo: fr ? "Pas d'info personnelle (e-mail, prénom)" : "No personal info (email, name)",
        simpleDate: fr ? "Pas une date évidente" : "Not an obvious date",
        predictable: fr ? "Pas de suite ou répétition simple" : "No simple sequence or repetition",
      },
    }),
    [fr]
  );

  const resetPasswordMutation = useMutation({
    mutationFn: resetPassword,
    onSuccess: () => {
      setServerError(null);
      sessionStorage.removeItem("pwd_reset_token");
      sessionStorage.removeItem("pwd_reset_email");
      toast({ type: "success", title: t("successTitle"), message: t("successMessage") });
      // Un reset n'ouvre PAS de session : on revient se connecter, l'adresse
      // préremplie (le téléphone fait exactement cela, bandeau compris).
      router.push("/login?email=" + encodeURIComponent(resetEmail));
    },
    onError: (error) => {
      const data = getApiErrorData(error);
      const details = readAuthErrorDetails(data);
      // Règle de mot de passe refusée par le serveur → nommer LE critère.
      if (details?.type === "password") {
        setServerError(passwordCodeMessage(fr, details.code));
        return;
      }
      const code = (data as { details?: { code?: string } })?.details?.code;
      if (code === "RESET_SESSION_EXPIRED") {
        setSessionExpired(true);
        return;
      }
      if (code === "PASSWORD_UNCHANGED" || code === "PASSWORD_STATE_CHANGED") {
        setServerError(t(`errors.${code}`));
        return;
      }
      setServerError(t("errors.generic"));
    },
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (resetPasswordMutation.isPending) return;
    setServerError(null);

    if (!hasApiBaseUrl()) {
      setServerError(t("errors.config"));
      return;
    }
    if (!token) {
      setSessionExpired(true);
      return;
    }
    if (password.length === 0) {
      setServerError(t("errors.MISSING_PASSWORD"));
      return;
    }
    // LA source des règles, celle de l'inscription et de la jauge ci-dessous.
    const manquant = firstFailingCheck(getPasswordChecks(password, passwordContext));
    if (manquant !== null) {
      setServerError(passwordCheckMessage(fr, manquant));
      return;
    }

    resetPasswordMutation.mutate({ passwordResetToken: token, newPassword: password });
  };

  const colonneGauche = (
    <div className="hidden lg:block">
      <AuthHeroVisual visual={heroVisual} />
    </div>
  );

  const retourConnexion = (
    <Link
      href="/login"
      className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-[#0D9488] hover:underline hover:underline-offset-[3px] dark:text-[#2DD4BF]"
    >
      <ArrowLeft size={13} aria-hidden />
      {t("backToLogin")}
    </Link>
  );

  // ── Pendant l'hydratation : la forme de l'écran, sans son contenu ──
  if (!hydrated) {
    return (
      <main className="lg:grid lg:grid-cols-2 lg:min-h-[calc(var(--yamba-viewport)-64px)]">
        {colonneGauche}
        <div className="flex items-center justify-center px-4 py-8 lg:px-8 lg:py-10">
          <div className="w-full max-w-[400px] animate-pulse">
            <div className="h-8 w-64 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="mt-2 h-4 w-72 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="mt-6 h-10 rounded-lg bg-slate-200 dark:bg-slate-800" />
            <div className="mt-4 h-10 rounded-lg bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>
      </main>
    );
  }

  // ── L'étape a expiré : on ne laisse personne devant un formulaire mort ──
  if (sessionExpired) {
    return (
      <main className="lg:grid lg:grid-cols-2 lg:min-h-[calc(var(--yamba-viewport)-64px)]">
        {colonneGauche}
        <div className="flex items-center justify-center px-4 py-8 lg:px-8 lg:py-10">
          <div className="w-full max-w-[400px] text-center">
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {t("sessionExpiredTitle")}
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t("sessionExpired")}</p>
            <Link
              href="/password/forgot"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#FF9900] px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm hover:bg-[#F08700] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF9900]/30"
            >
              {t("restart")}
            </Link>
            {retourConnexion}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="lg:grid lg:grid-cols-2 lg:min-h-[calc(var(--yamba-viewport)-64px)]">
      {colonneGauche}

      <div className="flex items-center justify-center px-4 py-8 lg:px-8 lg:py-10">
        <div className="w-full max-w-[400px]">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white lg:text-3xl">
            {t("title")}
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t("subtitle")}</p>

          {/* L'adresse EN CLAIR (D92 2A) : c'est celle qu'on vient de saisir,
              et elle dit POUR QUEL compte on change le mot de passe. */}
          {resetEmail && (
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/40">
              <p className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t("forAccount")}
              </p>
              <p className="mt-0.5 break-all font-mono text-sm text-slate-900 dark:text-white">
                {resetEmail}
              </p>
            </div>
          )}

          <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
            <div className="relative">
              <label
                htmlFor="new-password"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                {t("passwordLabel")}
              </label>
              <div className="relative mt-1.5">
                <input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  autoFocus
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setServerError(null);
                  }}
                  onFocus={() => setIsPasswordFocused(true)}
                  onBlur={() => setIsPasswordFocused(false)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 pr-10 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#FF9900] focus:ring-4 focus:ring-[#FF9900]/20 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-600 dark:focus:border-[#FFAE33]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                  aria-pressed={showPassword}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <PasswordStrengthIndicator
                password={password}
                context={passwordContext}
                isFocused={isPasswordFocused}
                copy={passwordStrengthCopy}
                onCloseAction={() => setIsPasswordFocused(false)}
              />
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
              aria-busy={resetPasswordMutation.isPending}
              className="relative inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#FF9900] px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm transition-colors hover:bg-[#F08700] active:bg-[#E07A00] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF9900]/30"
            >
              {/* D95 4A — le libellé s'efface, il ne change pas. */}
              {resetPasswordMutation.isPending && (
                <Loader2 size={16} aria-hidden className="absolute inset-0 m-auto animate-spin" />
              )}
              <span className={resetPasswordMutation.isPending ? "opacity-0" : undefined}>
                {t("submit")}
              </span>
            </button>

            <div className="pt-2 text-center">{retourConnexion}</div>
          </form>
        </div>
      </div>
    </main>
  );
}

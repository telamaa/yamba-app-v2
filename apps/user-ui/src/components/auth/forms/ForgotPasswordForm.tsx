"use client";

/**
 * ForgotPasswordForm.tsx — « mot de passe oublié » du site, aligné sur le
 * téléphone (D97).
 * =========================================================================
 * L'écran le plus simple du parcours, et il portait quand même quatre des
 * défauts de la série :
 *
 *  • une pastille de sécurité auto-décernée (D91 1A) ;
 *  • un bouton qui changeait de mot en travaillant (« Envoi… ») — D95 4A ;
 *  • le MESSAGE brut de l'API affiché tel quel en cas d'échec, alors que
 *    cette route répond TOUJOURS 200 par construction (anti-énumération) :
 *    tout ce qui arrive ici est un problème de réseau ou de serveur, et se
 *    dit dans nos mots ;
 *  • ses textes en ternaires, invisibles au contrôle i18n de la CI.
 *
 * Et une règle reprise du téléphone : **le bouton reste éteint tant que
 * l'adresse n'est pas valide**. Le désactivé n'est permis que lorsqu'UN SEUL
 * champ visible l'explique — c'est exactement le cas ici, comme à l'étape 1
 * de la connexion (D96).
 */

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import LoadingDots from "@/components/ui/LoadingDots";
import { hasApiBaseUrl, requestPasswordResetOtp } from "@/services/auth.api";
import type { HeroVisual } from "@/lib/auth/hero-visuals";
import AuthHeroVisual from "@/components/auth/visual/AuthHeroVisual";

/** Le miroir de `isValidEmail` du mobile, elle-même miroir de la regex serveur. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Props = {
  heroVisual: HeroVisual;
};

export default function ForgotPasswordForm({ heroVisual }: Props) {
  const router = useRouter();
  const t = useTranslations("auth.forgot");

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const normalized = email.trim().toLowerCase();
  const emailValid = EMAIL_REGEX.test(normalized);

  const requestOtpMutation = useMutation({
    mutationFn: requestPasswordResetOtp,
    onSuccess: () => {
      // 🔒 L'adresse transite UNIQUEMENT par sessionStorage, jamais en URL
      // (journaux serveur, historique du navigateur, referrer, mesure d'audience).
      sessionStorage.setItem("pwd_reset_email", normalized);
      setError(null);
      router.push("/password/verify");
    },
    // Cette route répond toujours 200 : ce qui tombe ici n'est pas métier.
    onError: () => setError(t("errors.generic")),
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!emailValid || requestOtpMutation.isPending) return;
    if (!hasApiBaseUrl()) {
      setError(t("errors.config"));
      return;
    }
    setError(null);
    requestOtpMutation.mutate({ email: normalized });
  };

  return (
    <main className="lg:grid lg:grid-cols-2 lg:min-h-[calc(var(--yamba-viewport)-64px)]">
      {/* LEFT — visuel desktop */}
      <div className="hidden lg:block">
        <AuthHeroVisual visual={heroVisual} />
      </div>

      {/* RIGHT — formulaire */}
      <div className="flex items-center justify-center px-4 py-8 lg:px-8 lg:py-10">
        <div className="w-full max-w-[400px]">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white lg:text-3xl">
            {t("title")}
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t("subtitle")}</p>

          <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="forgot-email"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                {t("emailLabel")}
              </label>
              <input
                id="forgot-email"
                type="email"
                inputMode="email"
                enterKeyHint="go"
                autoComplete="email"
                autoFocus
                placeholder={t("emailPlaceholder")}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-base text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#FF9900] focus:ring-4 focus:ring-[#FF9900]/20 sm:text-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-600 dark:focus:border-[#FFAE33]"
              />
            </div>

            {/* La note anti-énumération : elle explique le silence du serveur,
                donc elle doit être lisible AVANT l'envoi, pas après. */}
            <p className="text-xs text-slate-500 dark:text-slate-400">{t("securityNote")}</p>

            {error !== null && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!emailValid || requestOtpMutation.isPending}
              aria-busy={requestOtpMutation.isPending}
              className="relative inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#FF9900] px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm transition-colors hover:bg-[#F08700] active:bg-[#E07A00] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF9900]/30"
            >
              {/* La vague de trois points PREND la place du libellé (arbitrage à l'écran du
                  13/11/2026). Le bouton ne change pas de taille pour autant : il est en
                  pleine largeur et sa hauteur vient de son padding.
                  Le `sr-only` garde le NOM du bouton pour un lecteur d'écran — sans lui, le
                  bouton devient anonyme pendant toute l'attente, et c'est le seul coût réel
                  de cette disposition. */}
              {requestOtpMutation.isPending ? (
                <>
                  <LoadingDots />
                  <span className="sr-only">{t("submit")}</span>
                </>
              ) : (
                t("submit")
              )}
            </button>
          </form>

          {/* La sortie, au gabarit des pieds d'écran (D95 6A) : 13 px, graisse
              de corps. La flèche dit le retour, la couleur dit le lien. */}
          <p className="mt-5 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-[13px] text-[#0D9488] hover:underline hover:underline-offset-[3px] dark:text-[#2DD4BF]"
            >
              <ArrowLeft size={13} aria-hidden />
              {t("backToLogin")}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

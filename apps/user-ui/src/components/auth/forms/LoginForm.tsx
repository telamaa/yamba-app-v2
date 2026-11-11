"use client";

/**
 * LoginForm.tsx — la connexion du site, alignée sur le parcours du téléphone (D96).
 * =================================================================================
 * Page 3 de la passe de finitions. Jusqu'ici, les deux applications ne
 * proposaient pas le même PARCOURS : le téléphone demandait l'adresse, la
 * faisait confirmer, puis le mot de passe (identifier-first, A208) ; le site
 * posait un seul formulaire, avec les fournisseurs sociaux AU-DESSUS — ce que
 * sa propre page d'inscription ne fait pas.
 *
 * **Le site s'aligne sur le téléphone, et non l'inverse** (arbitrage du
 * 11/11). Ce qui change ici :
 *
 *  1A — DEUX ÉTAPES : l'adresse, puis le mot de passe. L'étape 1 porte aussi
 *       les autres méthodes (mot de passe, Google, Facebook), donc l'écran
 *       répond d'abord à « qui es-tu ? » et ensuite seulement à « comment le
 *       prouves-tu ? ».
 *  2A — la confirmation d'adresse est PORTÉE TELLE QUELLE depuis le mobile.
 *       Elle protège le parcours « code par e-mail » (une faute de frappe =
 *       un code qui ne vient jamais, en silence) — parcours qui n'existe pas
 *       encore côté serveur. On porte le parcours, on ne le juge pas ici.
 *  3A — les fournisseurs sociaux passent SOUS le formulaire, derrière un
 *       séparateur, comme sur la page d'inscription du même site.
 *  4A — les refus parlent par `details.code` (RG-MOB-1), comme le mobile.
 *       Les DIX-HUIT comparaisons de messages anglais normalisés qui
 *       tenaient lieu de traduction sont SUPPRIMÉES : il suffisait qu'un
 *       mot change côté serveur pour que l'Expéditeur reçoive le message
 *       générique à la place de la vraie raison.
 *  5A — la LONGUEUR MINIMALE est retirée du champ mot de passe. Une politique de mot de
 *       passe se vérifie à la CRÉATION. Sur la connexion, elle refuse
 *       d'essayer un mot de passe ancien et renseigne un attaquant sur la
 *       politique — pour un gain nul, le serveur étant seul juge.
 *  6A — les textes vivent dans `messages/{fr,en}/auth.json` sous `auth.login`,
 *       espace de noms calqué sur celui du mobile (les ~45 ternaires
 *       `fr ? … : …` de `buildCopy` disparaissent, et avec eux le dernier
 *       usage de `UiPreferencesProvider` sur cet écran).
 *  7A — le bouton qui travaille garde sa taille et son mot (D95 4A) : le
 *       libellé s'efface, il ne change pas.
 *  8A — plus de pastille de sécurité auto-décernée : un signal de confiance
 *       nomme un tiers ou un fait vérifiable, sinon il ne dit rien (D91 1A,
 *       déjà appliqué à l'inscription — il n'avait survécu ici que parce que
 *       personne n'avait relu cet écran).
 *
 * L'ÉTAT DE L'ÉTAPE N'EST PAS DANS L'URL, délibérément : le mobile a deux
 * routes (`/login`, `/login-password`) parce qu'une pile de navigation native
 * donne le retour gratuitement. Ici, une seconde URL perdrait l'adresse au
 * rechargement (le mobile la garde en mémoire de module) et casserait la
 * variante MODALE — la fenêtre « ta session a expiré », qui est précisément
 * l'endroit où la connexion compte le plus.
 */

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { useFlashToast } from "@/hooks/useFlashToast";
import { sanitizeRedirect, withRedirect } from "@/lib/auth/safe-redirect";
import GoogleSignInButton from "@/components/auth/shared/GoogleSignInButton";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getApiErrorData,
  hasApiBaseUrl,
  loginUser,
  type LoginPayload,
  type LoginResponse,
} from "@/services/auth.api";
import { readLoginErrorCode, isLoginErrorCode } from "@/lib/auth/auth-error-codes";
import type { HeroVisual } from "@/lib/auth/hero-visuals";
import AuthHeroVisual from "@/components/auth/visual/AuthHeroVisual";

/** Le miroir de `isValidEmail` du mobile, elle-même miroir de la regex serveur. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isValidEmail = (value: string) => EMAIL_REGEX.test(value.trim().toLowerCase());

type Step = "identifier" | "password";

type Props = {
  /** Page : visuel de gauche (absent en variante modale). */
  heroVisual?: HeroVisual;
  /** `page` (défaut) = /login plein écran · `modal` = formulaire seul dans AuthGateModal (A63). */
  variant?: "page" | "modal";
  /** Modal : chemin de retour imposé (sinon lu dans ?redirect=). */
  redirectOverride?: string | null;
  /** Modal : appelé après connexion réussie (cache utilisateur déjà rafraîchi) — remplace la navigation. */
  onSuccessAction?: () => void;
};

function FacebookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#1877F2" d="M24 4C13 4 4 13 4 24s9 20 20 20 20-9 20-20S35 4 24 4z" />
      <path fill="#fff" d="M26.6 38V26.8h3.7l.6-4.4h-4.3v-2.8c0-1.3.4-2.2 2.2-2.2h2.3V13.5c-.4-.1-1.8-.2-3.4-.2-3.4 0-5.7 2.1-5.7 6v3.1h-3.8v4.4H24V38h2.6z" />
    </svg>
  );
}

export default function LoginForm({ heroVisual, variant = "page", redirectOverride, onSuccessAction }: Props) {
  const isModal = variant === "modal";
  const t = useTranslations("auth.login");
  const tc = useTranslations("auth.common");
  const ts = useTranslations("auth.social");
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const passwordFieldRef = useRef<HTMLInputElement | null>(null);

  // Message de succès posé par l'étape précédente (vérification OTP, etc.)
  useFlashToast();
  const justVerified = !isModal && searchParams.get("verified") === "1";
  // Retour à la page visée (réservation, publication…) — chemin interne seulement
  const redirectTo = isModal
    ? sanitizeRedirect(redirectOverride)
    : sanitizeRedirect(searchParams.get("redirect") ?? searchParams.get("returnTo"));
  const registerHref = withRedirect("/register", redirectTo);

  const [step, setStep] = useState<Step>("identifier");
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false); // A62 — DÉCOCHÉ par défaut (60 min d'inactivité, D27)
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** L'adresse VERROUILLÉE par l'étape 1 ; null = on est entré par « e-mail et mot de passe ». */
  const [lockedEmail, setLockedEmail] = useState<string | null>(null);

  const normalized = email.trim().toLowerCase();
  const emailValid = isValidEmail(normalized);

  /**
   * Le message d'un refus, lu sur son CODE et jamais sur son message.
   * Les quatre codes connus ont leur clé dans les deux dictionnaires — une
   * clé calculée que `tsc` ne voit pas (gabarit) et que le contrôle i18n de
   * la CI ne voit pas non plus (il compare FR et EN entre EUX) : c'est une
   * fiche qui le tient.
   */
  const messageOf = (err: unknown): string => {
    const code = readLoginErrorCode(getApiErrorData(err));
    if (code !== null && isLoginErrorCode(code)) return t(`errors.${code}`);
    // Aucun code : soit le réseau n'a pas répondu, soit le serveur a parlé
    // d'autre chose. On ne traduit JAMAIS son message, on dit le nôtre.
    const data = getApiErrorData(err);
    return Object.keys(data).length === 0 ? t("errors.network") : t("errors.generic");
  };

  const loginMutation = useMutation<LoginResponse, unknown, LoginPayload>({
    mutationFn: loginUser,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["user"] });
      if (onSuccessAction) {
        // A63 — connexion DANS la page : l'appelant reprend son action, pas de navigation ici
        onSuccessAction();
        return;
      }
      router.push(redirectTo || "/");
      router.refresh();
    },
    onError: (err) => setError(messageOf(err)),
  });

  /** Étape 1 → la confirmation d'adresse (le geste du mobile, à l'identique). */
  const onContinue = (event: FormEvent) => {
    event.preventDefault();
    if (!emailValid) {
      setError(normalized.length === 0 ? t("errors.MISSING_EMAIL") : t("errors.INVALID_EMAIL"));
      return;
    }
    setError(null);
    setConfirming(true);
  };

  const goToPassword = (locked: boolean) => {
    setConfirming(false);
    setLockedEmail(locked ? normalized : null);
    setStep("password");
    // Le mobile pose le focus sur le mot de passe quand l'adresse est connue.
    if (locked) window.setTimeout(() => passwordFieldRef.current?.focus(), 0);
  };

  const backToIdentifier = () => {
    setStep("identifier");
    setLockedEmail(null);
    setPassword("");
    setError(null);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (loginMutation.isPending) return;
    if (!hasApiBaseUrl()) {
      setError(t("errors.config"));
      return;
    }
    if (!emailValid) {
      setError(t("errors.INVALID_EMAIL"));
      return;
    }
    if (password.length === 0) {
      setError(t("errors.MISSING_PASSWORD"));
      return;
    }
    setError(null);
    try {
      await loginMutation.mutateAsync({ email: normalized, password, rememberMe: remember });
    } catch {
      // géré par onError
    }
  };

  // ====== Styles centralisés ======
  const inputBase =
    "mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-base sm:text-sm text-slate-900 outline-none " +
    "transition-colors placeholder:text-slate-400 " +
    "focus:border-[#FF9900] focus:ring-4 focus:ring-[#FF9900]/20 " +
    "dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-600 " +
    "dark:focus:border-[#FFAE33] dark:focus:ring-[#FF9900]/15";
  const labelBase = "text-xs font-semibold text-slate-800 dark:text-slate-100";
  /** D91 5A / D95 : un lien secondaire se désigne par sa COULEUR, pas par sa graisse. */
  const linkSubtle =
    "text-xs font-medium text-[#0F766E] hover:text-[#115E59] hover:underline " +
    "dark:text-[#2DD4BF] dark:hover:text-[#5EEAD4]";
  const methodBtn =
    "flex w-full items-center justify-center gap-2.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 " +
    "text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50 " +
    "dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-900/50";
  const ctaBtn =
    "relative inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#FF9900] px-4 py-2.5 text-sm font-bold text-slate-900 " +
    "shadow-sm transition-colors hover:bg-[#F08700] active:bg-[#E07A00] disabled:opacity-60 " +
    "focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF9900]/30 dark:focus-visible:ring-[#FF9900]/20";

  const errorBlock = error !== null && (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200"
    >
      {error}
    </div>
  );

  const emailField = (
    <div>
      <label htmlFor="email" className={labelBase}>
        {t("emailLabel")}
      </label>
      <input
        id="email"
        type="email"
        inputMode="email"
        enterKeyHint={step === "identifier" ? "go" : "next"}
        autoComplete="email"
        placeholder={t("emailPlaceholder")}
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          setError(null);
        }}
        className={inputBase}
      />
    </div>
  );

  const identifierStep = (
    <>
      {justVerified && (
        <div
          role="status"
          className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 dark:border-emerald-900/50 dark:bg-emerald-950/30"
        >
          <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
          <p className="text-[13px] text-emerald-900 dark:text-emerald-100">{t("notices.accountVerified")}</p>
        </div>
      )}

      <form onSubmit={onContinue} noValidate className="mt-6 space-y-3">
        {emailField}
        {errorBlock}
        {/* Le désactivé n'est permis que quand UN SEUL champ visible l'explique
            (doctrine du mobile) : ici l'adresse est le seul champ de l'étape. */}
        <button type="submit" disabled={!emailValid} className={ctaBtn}>
          {t("continue")}
        </button>
      </form>

      {/* Séparateur — « ou », le mot du mobile */}
      <div className="my-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {tc("or")}
        </span>
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
      </div>

      <div className="space-y-2">
        <button type="button" onClick={() => goToPassword(emailValid)} className={methodBtn}>
          <KeyRound size={16} aria-hidden="true" />
          {t("methodPassword")}
        </button>
        {/* D47 — bouton officiel Google Identity Services (inerte sans client ID) */}
        <GoogleSignInButton redirectTo={redirectTo} rememberMe={false} text="signin_with" onSuccessAction={onSuccessAction} />
        <button type="button" onClick={() => console.log("facebook oauth (ui only)")} className={methodBtn}>
          <FacebookIcon />
          {ts("facebook")}
        </button>
      </div>
    </>
  );

  const passwordStep = (
    <form onSubmit={onSubmit} noValidate className="mt-6 space-y-3">
      {lockedEmail !== null ? (
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-950">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900 dark:text-white">
            {lockedEmail}
          </span>
          <button type="button" onClick={backToIdentifier} className={linkSubtle}>
            {t("changeEmail")}
          </button>
        </div>
      ) : (
        emailField
      )}

      <div>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="password" className={labelBase}>
            {t("passwordLabel")}
          </label>
          <Link href="/password/forgot" className={linkSubtle}>
            {t("forgot")}
          </Link>
        </div>
        <div className="relative">
          <input
            id="password"
            ref={passwordFieldRef}
            type={passwordVisible ? "text" : "password"}
            enterKeyHint="go"
            autoComplete="current-password"
            placeholder={t("passwordPlaceholder")}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            className={`${inputBase} pr-11`}
          />
          {/* Bouton œil — centrage robuste avec inset-y-0 + my-auto */}
          <button
            type="button"
            onClick={() => setPasswordVisible((v) => !v)}
            aria-label={passwordVisible ? tc("hidePassword") : tc("showPassword")}
            aria-pressed={passwordVisible}
            className="absolute bottom-0 right-1.5 top-1.5 my-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            {passwordVisible ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
        <input
          type="checkbox"
          aria-describedby="remember-hint"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-[#FF9900] focus:ring-2 focus:ring-[#FF9900]/30 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-950"
        />
        <span>
          {t("rememberLabel")}
          <span id="remember-hint" className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
            {t("rememberHelper")}
          </span>
        </span>
      </label>

      {errorBlock}

      <button type="submit" disabled={loginMutation.isPending} aria-busy={loginMutation.isPending} className={ctaBtn}>
        {/* D95 4A — le libellé s'EFFACE, il ne change pas : il garde sa place,
            donc le bouton garde sa largeur, et le disque se superpose. */}
        {loginMutation.isPending && (
          <Loader2 size={16} className="absolute inset-0 m-auto animate-spin" aria-hidden="true" />
        )}
        <span className={loginMutation.isPending ? "opacity-0" : undefined}>{t("submit")}</span>
      </button>
    </form>
  );

  const formBlock = (
    <>
      {step === "identifier" ? identifierStep : passwordStep}

      {/* Pied d'écran — le gabarit de D95 6A : 13 px, graisse de corps, mangue. */}
      <p className="mt-5 text-center text-[13px] text-slate-500 dark:text-slate-400">
        {t("noAccount")}{" "}
        <Link
          href={registerHref}
          className="text-[#FF9900] hover:underline hover:underline-offset-[3px] dark:text-[#FFB347]"
        >
          {t("registerLink")}
        </Link>
      </p>

      {/* La confirmation d'adresse — le geste du mobile, porté tel quel (2A).
          Une vraie fenêtre : rôle `dialog`, décrite par l'adresse, fermable à
          la touche Échap comme au clic sur le fond. */}
      {confirming && (
        <div
          // z-220 et non z-60 : en variante MODALE, ce formulaire vit dans la
          // fenêtre « ta session a expiré », qui est à z-210. Une confirmation
          // rendue dessous serait invisible — et le parcours, bloqué.
          className="fixed inset-0 z-[220] flex items-center justify-center bg-black/55 px-6"
          onClick={() => setConfirming(false)}
          onKeyDown={(e) => e.key === "Escape" && setConfirming(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-confirm-email"
            className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="login-confirm-email" className="text-lg font-bold text-slate-900 dark:text-white">
              {normalized}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              {t("confirmBody")}
            </p>
            <button type="button" autoFocus onClick={() => goToPassword(true)} className={`${ctaBtn} mt-4`}>
              {t("confirmYes")}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="mt-3 w-full text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              {t("confirmBack")}
            </button>
          </div>
        </div>
      )}
    </>
  );

  if (isModal) {
    return <div className="w-full">{formBlock}</div>;
  }

  return (
    <main className="lg:grid lg:grid-cols-2 lg:min-h-[calc(var(--yamba-viewport)-64px)]">
      {/* LEFT — visuel desktop only */}
      <div className="hidden lg:block">
        {heroVisual && <AuthHeroVisual visual={heroVisual} />}
      </div>

      {/* RIGHT — formulaire */}
      <div className="flex items-center justify-center px-4 py-8 lg:px-8 lg:py-10">
        <div className="w-full max-w-[360px]">
          {/* Titre + sous-titre — l'étape 2 dit ce qu'elle attend, et n'a plus
              de sous-titre : l'adresse affichée dit déjà où l'on en est. */}
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white lg:text-3xl">
            {step === "identifier" ? t("title") : t("passwordTitle")}
          </h1>
          {step === "identifier" && (
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{t("subtitle")}</p>
          )}

          {formBlock}
        </div>
      </div>
    </main>
  );
}

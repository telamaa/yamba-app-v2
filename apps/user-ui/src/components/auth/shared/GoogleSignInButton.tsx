"use client";

/**
 * GoogleSignInButton — « Continuer avec Google » (D47)
 * ====================================================
 * Rend le bouton officiel Google Identity Services (le seul chemin fiable
 * pour obtenir un id_token au clic), envoie le jeton à POST /auth/google :
 *  - LOGGED_IN        → cache utilisateur invalidé, disjoncteur de refresh
 *                       remis à zéro, retour sur `redirectTo` ;
 *  - CONSENT_REQUIRED → NOUVEAU compte : écran « Finalise ton compte »
 *                       (CGU + confidentialité), puis le même jeton est
 *                       rejoué AVEC le consentement — jamais de compte
 *                       créé sans journal de consentement (RGPD).
 * Sans NEXT_PUBLIC_GOOGLE_CLIENT_ID : bouton inerte « bientôt disponible ».
 */
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { useGoogleIdentity } from "@/hooks/useGoogleIdentity";
import { googleSignIn, getApiErrorData, type GoogleSignInResponse } from "@/services/auth.api";
import { resetAuthRefreshCircuitBreaker } from "@/lib/api-client";
import { LEGAL_VERSIONS } from "@/lib/legal/versions";

type Props = {
  /** Chemin interne de retour après connexion (null → accueil). */
  redirectTo: string | null;
  rememberMe?: boolean;
  text?: "signin_with" | "signup_with" | "continue_with";
};

type Pending = { credential: string; profile: Extract<GoogleSignInResponse, { status: "CONSENT_REQUIRED" }>["profile"] };

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.1 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.6 39.6 16.3 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C40.9 35.7 44 30.3 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export default function GoogleSignInButton({ redirectTo, rememberMe = false, text = "continue_with" }: Props) {
  const t = useTranslations("auth.google");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);

  const finish = async (result: Extract<GoogleSignInResponse, { status: "LOGGED_IN" }>) => {
    resetAuthRefreshCircuitBreaker();
    await queryClient.invalidateQueries({ queryKey: ["user"] });
    if (result.created) toast.success(t("created", { firstName: result.user.firstName }));
    else if (result.linked) toast.success(t("linked"));
    else toast.success(t("welcomeBack", { firstName: result.user.firstName }));
    router.push(redirectTo || "/");
    router.refresh();
  };

  const failWith = (error: unknown) => {
    const details = getApiErrorData(error).details as { type?: string; code?: string } | undefined;
    if (details?.type === "oauth" && details.code === "GOOGLE_TOKEN_INVALID") toast.error(t("tokenInvalid"));
    else if (details?.type === "oauth" && details.code === "GOOGLE_EMAIL_UNVERIFIED") toast.error(t("emailUnverified"));
    else if (details?.type === "oauth" && details.code === "GOOGLE_NOT_CONFIGURED") toast.error(t("unavailable"));
    else toast.error(t("genericError"));
  };

  const submit = async (credential: string, consent?: { termsVersion: string; privacyVersion: string }) => {
    setBusy(true);
    try {
      const result = await googleSignIn({ credential, rememberMe, consent });
      if (result.status === "CONSENT_REQUIRED") {
        setPending({ credential, profile: result.profile });
        return;
      }
      setPending(null);
      await finish(result);
    } catch (error) {
      failWith(error);
    } finally {
      setBusy(false);
    }
  };

  const { containerRef, configured, ready, failed } = useGoogleIdentity({
    onCredentialAction: (credential) => void submit(credential),
    locale,
    text,
  });

  const onConfirmConsent = () => {
    if (!pending) return;
    if (!accepted) {
      setConsentError(t("consent.required"));
      return;
    }
    setConsentError(null);
    void submit(pending.credential, { termsVersion: LEGAL_VERSIONS.terms, privacyVersion: LEGAL_VERSIONS.privacy });
  };

  const inertClass =
    "inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-500";

  return (
    <>
      {configured && !failed ? (
        <div className="relative min-h-[44px] w-full" aria-busy={busy}>
          <div ref={containerRef} className={`flex w-full justify-center ${ready ? "" : "invisible"}`} />
          {!ready && (
            <div className="absolute inset-0 animate-pulse rounded-full bg-slate-100 dark:bg-slate-900" aria-hidden />
          )}
        </div>
      ) : (
        <button type="button" disabled className={inertClass} title={failed ? t("loadError") : t("unavailable")}>
          <GoogleIcon />
          {failed ? t("loadError") : t("unavailable")}
        </button>
      )}

      {pending && (
        <div
          className="fixed inset-0 z-[220] flex items-end justify-center sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="google-consent-title"
        >
          <button type="button" aria-label={t("consent.cancel")} onClick={() => setPending(null)} className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" />
          <div className="relative w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl dark:bg-slate-950 sm:rounded-3xl">
            <h2 id="google-consent-title" className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
              {t("consent.title")}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {t("consent.subtitle", { email: pending.profile.email })}
            </p>

            <label className="mt-5 flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => {
                  setAccepted(e.target.checked);
                  if (e.target.checked) setConsentError(null);
                }}
                className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-slate-300 accent-[#FF9900]"
              />
              <span>
                {t("consent.cguStart")}{" "}
                <Link href="/legal/terms" target="_blank" className="font-semibold text-[#0F766E] underline underline-offset-2">
                  {t("consent.cguTerms")}
                </Link>{" "}
                {t("consent.cguAnd")}{" "}
                <Link href="/legal/privacy" target="_blank" className="font-semibold text-[#0F766E] underline underline-offset-2">
                  {t("consent.cguPrivacy")}
                </Link>{" "}
                {t("consent.cguEnd")}
              </span>
            </label>
            {consentError && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{consentError}</p>}

            <div className="mt-5 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={onConfirmConsent}
                disabled={busy}
                className="w-full rounded-full bg-[#FF9900] px-5 py-3 text-sm font-bold text-slate-950 transition-all hover:brightness-95 disabled:opacity-60"
              >
                {t("consent.cta")}
              </button>
              <button
                type="button"
                onClick={() => setPending(null)}
                className="text-center text-xs font-medium text-slate-500 underline-offset-4 hover:underline dark:text-slate-400"
              >
                {t("consent.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

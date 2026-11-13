"use client";

/**
 * OtpVerifyView.tsx — l'écran « saisis ton code », UNE fois pour les deux
 * parcours du site (D97).
 * =========================================================================
 * Le site avait **deux** écrans de vérification de code : celui de
 * l'inscription (829 lignes) et celui du mot de passe oublié (689 lignes).
 * Le même écran, écrit deux fois — six cases, un collage, deux comptes à
 * rebours, un verrou, un renvoi — et c'est D92 qui l'a rendu visible : elle a
 * refondu le PREMIER (l'adresse en clair, la 6ᵉ frappe qui valide, les cases
 * qui se voient, un seul compte à rebours, l'aide qui arrive quand elle sert),
 * et le second est resté tel quel. Deux écrans jumeaux dont un seul a été
 * corrigé, c'est la définition d'un écart qui se reformera.
 *
 * Le téléphone, lui, n'a jamais eu ce problème : `otp-verify-view.tsx` y est
 * partagé par l'inscription et le mot de passe oublié depuis A208. Cette vue
 * en est le **jumeau**, props comprises.
 *
 * Ce qui reste à l'appelant — et seulement cela :
 *   • d'où vient l'adresse (jeton d'inscription, ou `pwd_reset_email`) ;
 *   • ce que « vérifier » appelle, et où l'on va ensuite ;
 *   • ce que « Modifier » veut dire (annuler une inscription, ou retourner
 *     demander un code) ;
 *   • la phrase sous le titre : le parcours d'inscription SAIT qu'un compte
 *     existe, celui du mot de passe oublié ne doit jamais le dire
 *     (anti-énumération, ANO-API-08).
 *
 * Tout le reste — les six cases et leur clavier, le collage, les minuteries,
 * le verrou et ses essais restants, le bloc de renvoi en trois temps, la
 * boîte mail, les contrastes WCAG de D92 5A — vit ici, et une seule fois.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Clock, Loader2, Mail } from "lucide-react";
import { getApiErrorData } from "@/services/auth.api";
import type { HeroVisual } from "@/lib/auth/hero-visuals";
import {
  OTP_EXPIRY_SECONDS,
  RESEND_COOLDOWN_SECONDS,
  resendPhase,
  showValidity,
} from "@/lib/auth/otp-display";
import { webmailUrl } from "@/lib/auth/webmail";
import AuthHeroVisual from "@/components/auth/visual/AuthHeroVisual";

const OTP_LENGTH = 6;

/** Ce que le serveur dit d'un code refusé (auth.helper.ts, `OtpErrorDetails`). */
type OtpErrorDetails = {
  type?: string;
  code?: "OTP_INCORRECT" | "OTP_INVALIDATED" | "OTP_LOCKED" | "OTP_EXPIRED";
  attemptsLeft?: number;
  locked?: boolean;
  lockUntilSeconds?: number;
};

type ErrorContext = {
  attemptsLeft?: number;
  locked: boolean;
};

type Props = {
  heroVisual: HeroVisual;
  /** L'adresse, EN CLAIR (D92 2A) — jamais masquée : c'est elle qu'on relit. */
  email: string;
  /** La phrase sous le titre, déjà traduite par l'appelant. */
  subtitle: string;
  /** Vérifie le code. Rejette avec l'erreur d'API telle quelle. */
  onVerifyAction: (otp: string) => Promise<void>;
  /** Redemande un code. Rejette avec l'erreur d'API telle quelle. */
  onResendAction: () => Promise<void>;
  /** Le geste à côté de l'adresse (« Modifier »). */
  onChangeEmailAction: () => void;
  changeEmailPending?: boolean;
  /** Le parcours a perdu son jeton : on le dit, on ne laisse pas saisir. */
  missingToken?: boolean;
  missingTokenMessage?: string;
  /** Un renvoi réussi : l'appelant prévient (bandeau, toast…). */
  onResentAction?: () => void;
};

function onlyDigits(s: string): string {
  return s.replace(/\D/g, "");
}

/** `754` → `12:34`, `29` → `00:29` — jumeau de `formatMMSS` du mobile. */
function formatMMSS(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function readOtpDetails(error: unknown): OtpErrorDetails | null {
  const data = getApiErrorData(error) as { details?: OtpErrorDetails };
  return data?.details?.type === "otp" ? data.details : null;
}

export default function OtpVerifyView({
  heroVisual,
  email,
  subtitle,
  onVerifyAction,
  onResendAction,
  onChangeEmailAction,
  changeEmailPending = false,
  missingToken = false,
  missingTokenMessage,
  onResentAction,
}: Props) {
  const t = useTranslations("auth.otp");

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [resendTimer, setResendTimer] = useState(RESEND_COOLDOWN_SECONDS);
  const [expiryTimer, setExpiryTimer] = useState(OTP_EXPIRY_SECONDS);
  const [lockTimer, setLockTimer] = useState(0);
  const [errorContext, setErrorContext] = useState<ErrorContext | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const resendIntervalRef = useRef<number | null>(null);
  const expiryIntervalRef = useRef<number | null>(null);
  const lockIntervalRef = useRef<number | null>(null);
  /** La vérification d'office ne part qu'UNE fois par saisie complète. */
  const verifiedValue = useRef("");

  const otp = digits.join("");

  const clearResendTimer = () => {
    if (resendIntervalRef.current) window.clearInterval(resendIntervalRef.current);
    resendIntervalRef.current = null;
  };
  const clearExpiryTimer = () => {
    if (expiryIntervalRef.current) window.clearInterval(expiryIntervalRef.current);
    expiryIntervalRef.current = null;
  };
  const clearLockTimer = () => {
    if (lockIntervalRef.current) window.clearInterval(lockIntervalRef.current);
    lockIntervalRef.current = null;
  };

  const startResendTimer = useCallback(() => {
    clearResendTimer();
    setResendTimer(RESEND_COOLDOWN_SECONDS);
    resendIntervalRef.current = window.setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearResendTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const startExpiryTimer = useCallback(() => {
    clearExpiryTimer();
    setExpiryTimer(OTP_EXPIRY_SECONDS);
    expiryIntervalRef.current = window.setInterval(() => {
      setExpiryTimer((prev) => {
        if (prev <= 1) {
          clearExpiryTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const startLockTimer = (durationSeconds: number) => {
    clearLockTimer();
    setLockTimer(durationSeconds);
    lockIntervalRef.current = window.setInterval(() => {
      setLockTimer((prev) => {
        if (prev <= 1) {
          clearLockTimer();
          setErrorContext(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    if (missingToken) return undefined;
    startResendTimer();
    startExpiryTimer();
    // D92 4A — le focus est DANS la première case à l'arrivée. Sans lui on
    // arrivait sur six cases, on collait son code, et rien ne se passait.
    inputsRef.current[0]?.focus();
    return () => {
      clearResendTimer();
      clearExpiryTimer();
      clearLockTimer();
    };
  }, [missingToken, startResendTimer, startExpiryTimer]);

  const expiryWarning = expiryTimer > 0 && expiryTimer <= 60;
  const expired = expiryTimer === 0;
  const isLocked = errorContext?.locked === true && lockTimer > 0;

  const oublierLesErreurs = () => {
    setFieldError(null);
    setServerError(null);
    setErrorContext(null);
  };

  const verify = useCallback(
    async (value: string) => {
      setFieldError(null);
      setServerError(null);
      if (value.length !== OTP_LENGTH) {
        setFieldError(t("incomplete"));
        return;
      }
      setVerifying(true);
      try {
        await onVerifyAction(value);
      } catch (error) {
        verifiedValue.current = "";
        const details = readOtpDetails(error);
        if (details !== null) {
          setErrorContext({
            attemptsLeft: details.attemptsLeft,
            locked: details.locked ?? false,
          });
          if (details.locked && details.lockUntilSeconds) startLockTimer(details.lockUntilSeconds);
          // Jamais le message anglais brut de l'API : la phrase est construite
          // du CODE, et vit dans le dictionnaire (D96 4A, étendu à l'OTP).
          setFieldError(t(`codes.${details.code ?? "OTP_INCORRECT"}`));
          return;
        }
        setServerError(t("invalidOtp"));
      } finally {
        setVerifying(false);
      }
    },
    [onVerifyAction, t]
  );

  // D92 4A — sixième chiffre → vérification d'office.
  const canAutoVerify = otp.length === OTP_LENGTH && !verifying && !expired && !isLocked;
  useEffect(() => {
    if (canAutoVerify && verifiedValue.current !== otp) {
      verifiedValue.current = otp;
      void verify(otp);
    }
  }, [otp, canAutoVerify, verify]);

  const focusIndex = (i: number) => {
    const el = inputsRef.current[i];
    el?.focus();
    el?.select();
  };

  const updateDigitAt = (index: number, value: string) => {
    setDigits((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const fillDigits = (value: string) => {
    const clean = onlyDigits(value).slice(0, OTP_LENGTH);
    const next = Array(OTP_LENGTH).fill("");
    clean.split("").forEach((char, idx) => {
      next[idx] = char;
    });
    setDigits(next);
    return clean;
  };

  const handleChange = (index: number, raw: string) => {
    oublierLesErreurs();
    const value = onlyDigits(raw);
    if (value.length >= 2) {
      const pasted = fillDigits(value);
      focusIndex(Math.min(pasted.length - 1, OTP_LENGTH - 1));
      return;
    }
    const one = value.slice(0, 1);
    updateDigitAt(index, one);
    if (one && index < OTP_LENGTH - 1) focusIndex(index + 1);
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    oublierLesErreurs();
    if (e.key === "Backspace") {
      if (digits[index]) {
        updateDigitAt(index, "");
        return;
      }
      if (index > 0) {
        updateDigitAt(index - 1, "");
        focusIndex(index - 1);
      }
      return;
    }
    if (e.key === "ArrowLeft" && index > 0) focusIndex(index - 1);
    if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) focusIndex(index + 1);
  };

  const handlePaste = (e: ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    oublierLesErreurs();
    const text = onlyDigits(e.clipboardData.getData("text")).slice(0, OTP_LENGTH);
    if (!text) return;
    fillDigits(text);
    focusIndex(Math.min(text.length - 1, OTP_LENGTH - 1));
  };

  const canResend = resendTimer === 0 && !errorContext?.locked;
  const phase = canResend ? "ready" : resendPhase(resendTimer);
  const mailbox = useMemo(() => (email ? webmailUrl(email) : null), [email]);

  const resend = async () => {
    if (!canResend || resending) return;
    setServerError(null);
    setResending(true);
    try {
      await onResendAction();
      setDigits(Array(OTP_LENGTH).fill(""));
      setErrorContext(null);
      setFieldError(null);
      verifiedValue.current = "";
      startResendTimer();
      startExpiryTimer();
      inputsRef.current[0]?.focus();
      onResentAction?.();
    } catch {
      setServerError(t("genericError"));
    } finally {
      setResending(false);
    }
  };

  const attemptsLeft = errorContext?.attemptsLeft;
  const showAttemptsWarning =
    typeof attemptsLeft === "number" && attemptsLeft >= 0 && !isLocked;

  const lockedDuration = (): string => {
    if (lockTimer < 60) return t("lockSeconds", { count: lockTimer });
    if (lockTimer < 3600) return t("lockMinutes", { count: Math.ceil(lockTimer / 60) });
    return t("lockHours", { count: Math.ceil(lockTimer / 3600) });
  };

  const mailboxButton: ReactNode =
    mailbox === null ? null : (
      <a
        href={mailbox}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
      >
        <Mail size={16} aria-hidden />
        {t("openMailbox")}
      </a>
    );

  return (
    <main className="mx-auto w-full max-w-7xl px-4">
      {/* D92 — la largeur du contenu est celle de l'EN-TÊTE, et le contenu
          s'INCRUSTE dans la page : aucune bordure, aucun coin arrondi. */}
      <div className="lg:grid lg:grid-cols-2 lg:min-h-[calc(var(--yamba-viewport)-64px)]">
        {/* LEFT — la colonne répond à l'attente, elle ne vend plus (D92 1A) */}
        <div className="hidden lg:block">
          <AuthHeroVisual visual={heroVisual} variant="waiting" action={mailboxButton} />
        </div>

        {/* RIGHT — formulaire */}
        <div className="flex items-center justify-center px-4 py-8 lg:px-8 lg:py-10">
          <div className="w-full max-w-[400px]">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white lg:text-3xl">
              {t("title")}
            </h1>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>

            {/* D92 2A — l'adresse EN CLAIR, et le geste qui répond d'elle. */}
            {email && (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/40">
                <span className="min-w-0 break-all font-mono text-sm text-slate-900 dark:text-white">
                  {email}
                </span>
                <button
                  type="button"
                  onClick={onChangeEmailAction}
                  disabled={changeEmailPending}
                  className="flex-shrink-0 text-xs font-medium text-[#0D9488] underline underline-offset-2 decoration-[#0D9488]/40 hover:decoration-[#0D9488] disabled:opacity-50 dark:text-[#2DD4BF] dark:decoration-[#2DD4BF]/40 dark:hover:decoration-[#2DD4BF]"
                >
                  {changeEmailPending ? "…" : t("changeEmail")}
                </button>
              </div>
            )}

            {mailbox !== null && <div className="mt-3 lg:hidden">{mailboxButton}</div>}

            {missingToken ? (
              <div
                role="alert"
                className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200"
              >
                {missingTokenMessage ?? t("missingToken")}
              </div>
            ) : (
              <>
                {/* D92 6A — la validité ne se montre qu'à sa dernière minute. */}
                {isLocked ? (
                  <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-red-50 px-3 py-1.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                    <AlertTriangle size={12} />
                    <span>{t("lockedRetryIn")}</span>
                    <span className="font-mono font-semibold">{lockedDuration()}</span>
                  </div>
                ) : (
                  showValidity(expiryTimer) && (
                    <div
                      className={`mt-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${
                        expired
                          ? "border-red-300 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
                          : expiryWarning
                            ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
                            : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300"
                      }`}
                    >
                      <Clock size={12} />
                      {expired ? (
                        <span className="font-semibold">{t("expired")}</span>
                      ) : (
                        <>
                          <span>{t("validFor")}</span>
                          <span className="font-mono font-semibold">{formatMMSS(expiryTimer)}</span>
                        </>
                      )}
                    </div>
                  )
                )}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void verify(otp);
                  }}
                  noValidate
                  className="mt-6 space-y-4"
                >
                  <div>
                    <label className="mb-3 block text-center text-[13px] font-medium text-slate-500 dark:text-slate-400">
                      {t("enterCode")}
                    </label>

                    <div className="flex items-center justify-center gap-2 sm:gap-2.5" onPaste={handlePaste}>
                      {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                        <input
                          key={i}
                          ref={(el) => {
                            inputsRef.current[i] = el;
                          }}
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          pattern="\d*"
                          maxLength={1}
                          value={digits[i]}
                          onChange={(e) => handleChange(i, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(i, e)}
                          disabled={expired || isLocked || verifying}
                          /* D92 5A — la case se VOIT (WCAG 2.1 SC 1.4.11 :
                             3:1 pour la limite d'un contrôle), et la case
                             remplie prend le TEAL de la charte. */
                          className={`h-12 w-10 rounded-lg border bg-white text-center font-mono text-lg font-bold text-slate-900 outline-none transition-all sm:h-13 sm:w-11 dark:text-white ${
                            fieldError !== null || isLocked
                              ? "border-red-300 focus:border-red-400 focus:ring-4 focus:ring-red-200 dark:border-red-700 dark:bg-red-950/20 dark:focus:border-red-600 dark:focus:ring-red-900/40"
                              : digits[i]
                                ? "border-[#0F766E] bg-teal-50/40 focus:ring-4 focus:ring-[#0F766E]/20 dark:border-[#2DD4BF] dark:bg-teal-950/20 dark:focus:ring-[#2DD4BF]/25"
                                : "border-slate-300 bg-white focus:border-[#FF9900] focus:ring-4 focus:ring-[#FF9900]/20 dark:border-slate-600 dark:bg-slate-900 dark:focus:border-[#FFAE33]"
                          } disabled:cursor-not-allowed disabled:opacity-50`}
                          aria-label={`${t("enterCode")} ${i + 1}/${OTP_LENGTH}`}
                        />
                      ))}
                    </div>

                    <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
                      {t("pasteHint")}
                    </p>

                    {showAttemptsWarning && attemptsLeft !== undefined && attemptsLeft > 0 && (
                      <div
                        role="alert"
                        className={`mt-3 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs ${
                          attemptsLeft === 1
                            ? "border-red-300 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
                            : attemptsLeft <= 2
                              ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
                              : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300"
                        }`}
                      >
                        <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="font-semibold">{t("incorrectCode")}</span>{" "}
                          <span>{t("attemptsLeft", { count: attemptsLeft })}</span>
                        </div>
                      </div>
                    )}

                    {isLocked && (
                      <div
                        role="alert"
                        className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-950/30"
                      >
                        <div className="flex items-start gap-2">
                          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-red-600 dark:text-red-400" />
                          <div className="text-xs">
                            <p className="font-semibold text-red-800 dark:text-red-300">{t("locked")}</p>
                            <p className="mt-1 text-red-700 dark:text-red-400">{t("lockedTip")}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {fieldError !== null && !showAttemptsWarning && !isLocked && (
                      <div
                        role="alert"
                        className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
                      >
                        {fieldError}
                      </div>
                    )}
                  </div>

                  {serverError !== null && !isLocked && (
                    <div
                      role="alert"
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200"
                    >
                      {serverError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={verifying || expired || isLocked}
                    aria-busy={verifying}
                    className="relative inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#FF9900] px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm transition-colors hover:bg-[#F08700] active:bg-[#E07A00] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF9900]/30"
                  >
                    {/* D95 4A — le libellé s'EFFACE, il ne change pas. */}
                    {verifying && <Loader2 size={18} aria-hidden className="absolute inset-0 m-auto animate-spin" />}
                    <span className={verifying ? "opacity-0" : undefined}>{t("verify")}</span>
                  </button>
                </form>

                {/* D92 6A — le bloc de renvoi en trois temps. */}
                <div className="mt-5 border-t border-slate-200 pt-4 text-center dark:border-slate-800">
                  {phase === "ready" ? (
                    <>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{t("notReceived")}</p>
                      <button
                        type="button"
                        onClick={resend}
                        disabled={resending}
                        className="mt-1 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-[#0D9488] transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-[#2DD4BF] dark:hover:bg-slate-900/40"
                      >
                        {resending ? <Loader2 size={11} className="animate-spin" /> : null}
                        {t("resend")}
                      </button>
                    </>
                  ) : phase === "early" ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t("hintEarly")}</p>
                  ) : (
                    <>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{t("notReceivedWaiting")}</p>
                      <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                        {t("resendIn", { time: formatMMSS(resendTimer) })}
                      </p>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

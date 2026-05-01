"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, Clock, Loader2, ShieldCheck } from "lucide-react";
import {
  getApiErrorData,
  getApiErrorMessage,
  hasApiBaseUrl,
  resendPasswordResetOtp,
  verifyPasswordResetOtp,
} from "@/services/auth.api";

import { useToast } from "@/components/ui/Toast";
import AuthHeroVisual from "@/components/auth/visual/AuthHeroVisual";
import {HeroVisual} from "@/lib/auth/hero-visuals";
import {maskEmail} from "@/lib/auth/email-mask";

const OTP_LENGTH = 6;
const OTP_EXPIRY_SECONDS = 600;
const RESEND_COOLDOWN_SECONDS = 60;

type Lang = "fr" | "en";

type VerifyFormData = {
  otp: string;
};

type OtpErrorDetails = {
  type?: string;
  attemptsLeft?: number;
  locked?: boolean;
  lockUntilSeconds?: number;
};

type ErrorContext = {
  attemptsLeft?: number;
  locked: boolean;
  lockUntilSeconds?: number;
};

type Props = {
  heroVisual: HeroVisual;
};

function onlyDigits(s: string): string {
  return s.replace(/\D/g, "");
}

function formatMMSS(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatLockDuration(seconds: number, fr: boolean): string {
  if (seconds < 60) return fr ? `${seconds} secondes` : `${seconds} seconds`;
  if (seconds < 3600) {
    const min = Math.ceil(seconds / 60);
    return fr ? `${min} minute${min > 1 ? "s" : ""}` : `${min} minute${min > 1 ? "s" : ""}`;
  }
  const hrs = Math.ceil(seconds / 3600);
  return fr ? `${hrs} heure${hrs > 1 ? "s" : ""}` : `${hrs} hour${hrs > 1 ? "s" : ""}`;
}

function buildCopy(lang: string) {
  const fr = (lang as Lang) === "fr";
  return {
    trust: fr ? "Vérification sécurisée" : "Secure verification",
    title: fr ? "Vérification du code" : "Verify the code",
    subtitle: fr
      ? "Nous avons envoyé un code à 6 chiffres à :"
      : "We've sent a 6-digit code to:",
    timerLabel: fr ? "Code valable" : "Code valid for",
    timerExpired: fr ? "Code expiré" : "Code expired",
    otpLabel: fr ? "Saisissez votre code" : "Enter your code",
    otpHelp: fr
      ? "Astuce : vous pouvez coller le code directement."
      : "Tip: you can paste the full code at once.",
    cta: fr ? "Valider mon code" : "Verify my code",
    ctaLoading: fr ? "Vérification…" : "Verifying…",
    resendText: fr
      ? "Pas reçu le code ? Vérifiez vos spams ou"
      : "Didn't get the code? Check your spam or",
    resendCta: fr ? "Renvoyer le code" : "Resend code",
    resendCooldown: fr ? "Renvoyer dans" : "Resend in",
    resentToastTitle: fr ? "Code renvoyé" : "Code resent",
    resentToastMessage: fr
      ? "Si un compte existe, un nouveau code a été envoyé."
      : "If an account exists, a new code has been sent.",
    // Wrong email — pattern Stripe
    wrongEmailQuestion: fr ? "Trompé d'adresse e-mail ?" : "Wrong email?",
    startOver: fr ? "Recommencer" : "Start over",
    missingEmail: fr
      ? "Session expirée. Merci de recommencer la procédure."
      : "Session expired. Please restart the recovery flow.",
    incomplete: fr ? "Veuillez saisir le code complet." : "Please enter the full code.",
    invalidOtp: fr ? "Code invalide ou expiré." : "Invalid or expired code.",
    genericError: fr
      ? "Validation impossible pour le moment."
      : "Unable to verify right now.",
    configError: fr
      ? "La configuration de l'application est incomplète."
      : "Application configuration is incomplete.",
    // Exponential backoff
    attemptsLeftSingular: fr
      ? "tentative restante avant verrouillage temporaire"
      : "attempt left before temporary lock",
    attemptsLeftPlural: fr
      ? "tentatives restantes avant verrouillage temporaire"
      : "attempts left before temporary lock",
    incorrectCode: fr ? "Code incorrect." : "Incorrect code.",
    locked: fr ? "Compte verrouillé temporairement." : "Account temporarily locked.",
    lockedRetryIn: fr ? "Réessayez dans" : "Try again in",
    lockedTip: fr
      ? "Pour votre sécurité, votre compte est verrouillé suite à plusieurs tentatives incorrectes."
      : "For your security, your account has been locked due to multiple incorrect attempts.",
  };
}

export default function ResetVerifyForm({ heroVisual }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const { lang } = useUiPreferences();
  const { toast } = useToast();
  const fr = lang === "fr";

  const copy = useMemo(() => buildCopy(lang), [lang]);

  const emailFromQuery = sp.get("email") ?? "";

  const [email, setEmail] = useState<string>("");
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [resendTimer, setResendTimer] = useState(RESEND_COOLDOWN_SECONDS);
  const [expiryTimer, setExpiryTimer] = useState(OTP_EXPIRY_SECONDS);

  const [errorContext, setErrorContext] = useState<ErrorContext | null>(null);
  const [lockTimer, setLockTimer] = useState(0);

  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const resendIntervalRef = useRef<number | null>(null);
  const expiryIntervalRef = useRef<number | null>(null);
  const lockIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    const e =
      emailFromQuery ||
      (typeof window !== "undefined"
        ? sessionStorage.getItem("pwd_reset_email") ?? ""
        : "");

    setEmail(e);

    if (emailFromQuery) {
      sessionStorage.setItem("pwd_reset_email", emailFromQuery);
    }
  }, [emailFromQuery]);

  const {
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<VerifyFormData>({
    mode: "onSubmit",
    defaultValues: { otp: "" },
  });

  const otp = digits.join("");

  useEffect(() => {
    setValue("otp", otp);
  }, [otp, setValue]);

  const clearResendTimer = () => {
    if (resendIntervalRef.current) {
      window.clearInterval(resendIntervalRef.current);
      resendIntervalRef.current = null;
    }
  };

  const clearExpiryTimer = () => {
    if (expiryIntervalRef.current) {
      window.clearInterval(expiryIntervalRef.current);
      expiryIntervalRef.current = null;
    }
  };

  const clearLockTimer = () => {
    if (lockIntervalRef.current) {
      window.clearInterval(lockIntervalRef.current);
      lockIntervalRef.current = null;
    }
  };

  const startResendTimer = () => {
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
  };

  const startExpiryTimer = () => {
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
  };

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
    if (email) {
      startResendTimer();
      startExpiryTimer();
    }
    return () => {
      clearResendTimer();
      clearExpiryTimer();
      clearLockTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const verifyOtpMutation = useMutation({
    mutationFn: verifyPasswordResetOtp,
    onSuccess: (data) => {
      if (data.passwordResetToken && typeof window !== "undefined") {
        sessionStorage.setItem("pwd_reset_token", data.passwordResetToken);
      }
      sessionStorage.removeItem("pwd_reset_email");
      router.push("/password/reset");
    },
    onError: (error) => {
      const data = getApiErrorData(error);

      const details = (data as { details?: OtpErrorDetails })?.details;

      if (details?.type === "otp") {
        setErrorContext({
          attemptsLeft: details.attemptsLeft,
          locked: details.locked ?? false,
          lockUntilSeconds: details.lockUntilSeconds,
        });

        if (details.locked && details.lockUntilSeconds) {
          startLockTimer(details.lockUntilSeconds);
        }

        if (data?.message) {
          setError("otp", { type: "server", message: data.message });
          return;
        }
      }

      if (data?.errors?.otp) {
        setError("otp", { type: "server", message: String(data.errors.otp) });
        return;
      }

      setError("root.serverError", {
        type: "server",
        message: getApiErrorMessage(error, copy.invalidOtp),
      });
    },
  });

  const resendOtpMutation = useMutation({
    mutationFn: resendPasswordResetOtp,
    onSuccess: () => {
      setDigits(Array(OTP_LENGTH).fill(""));
      setErrorContext(null);
      startResendTimer();
      startExpiryTimer();
      inputsRef.current[0]?.focus();
      toast({
        type: "success",
        title: copy.resentToastTitle,
        message: copy.resentToastMessage,
      });
    },
    onError: (error) => {
      setError("root.serverError", {
        type: "server",
        message: getApiErrorMessage(error, copy.genericError),
      });
    },
  });

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
    clearErrors("otp");
    clearErrors("root.serverError");
    setErrorContext(null);

    const value = onlyDigits(raw);

    if (value.length >= 2) {
      const pasted = fillDigits(value);
      focusIndex(Math.min(pasted.length - 1, OTP_LENGTH - 1));
      return;
    }

    const one = value.slice(0, 1);
    updateDigitAt(index, one);

    if (one && index < OTP_LENGTH - 1) {
      focusIndex(index + 1);
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    clearErrors("otp");
    clearErrors("root.serverError");

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
    clearErrors("otp");
    clearErrors("root.serverError");
    const text = onlyDigits(e.clipboardData.getData("text")).slice(0, OTP_LENGTH);
    if (!text) return;
    fillDigits(text);
    focusIndex(Math.min(text.length - 1, OTP_LENGTH - 1));
  };

  const verifyOtp = async (otpValue: string) => {
    clearErrors("otp");
    clearErrors("root.serverError");

    if (!hasApiBaseUrl()) {
      setError("root.serverError", { type: "config", message: copy.configError });
      return;
    }
    if (!email) {
      setError("root.serverError", { type: "session", message: copy.missingEmail });
      return;
    }
    if (otpValue.length !== OTP_LENGTH) {
      setError("otp", { type: "manual", message: copy.incomplete });
      return;
    }

    try {
      await verifyOtpMutation.mutateAsync({
        email,
        otp: otpValue,
      });
    } catch {
      // géré dans onError
    }
  };

  const onSubmit = async (values: VerifyFormData) => {
    await verifyOtp(values.otp);
  };

  const canResend = resendTimer === 0 && !errorContext?.locked;

  const resendOtp = async () => {
    if (!canResend || !email) return;
    clearErrors("root.serverError");
    try {
      await resendOtpMutation.mutateAsync({ email });
    } catch {
      // géré dans onError
    }
  };

  // Start over : pas de cleanup backend nécessaire (pas de pending Redis)
  // On supprime juste le sessionStorage local et on redirige
  const handleStartOver = () => {
    sessionStorage.removeItem("pwd_reset_email");
    sessionStorage.removeItem("pwd_reset_token");
    router.push("/password/forgot");
  };

  const maskedEmail = useMemo(() => maskEmail(email), [email]);
  const expiryWarning = expiryTimer > 0 && expiryTimer <= 60;
  const expired = expiryTimer === 0;
  const isLocked = errorContext?.locked === true && lockTimer > 0;

  const attemptsLeft = errorContext?.attemptsLeft;
  const showAttemptsWarning =
    typeof attemptsLeft === "number" && attemptsLeft >= 0 && !isLocked;

  return (
    <main className="lg:grid lg:grid-cols-2 lg:min-h-[calc(100vh-64px)]">
      <div className="hidden lg:block">
        <AuthHeroVisual visual={heroVisual} />
      </div>

      <div className="flex items-center justify-center px-4 py-8 lg:px-8 lg:py-10">
        <div className="w-full max-w-[400px]">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#0F766E] bg-white px-2.5 py-1 text-[11px] font-medium text-[#0F766E] dark:border-[#2DD4BF] dark:bg-slate-950 dark:text-[#2DD4BF]">
            <ShieldCheck size={12} />
            <span>{copy.trust}</span>
          </div>

          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white lg:text-3xl">
            {copy.title}
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            {copy.subtitle}
          </p>

          {/* Email read-only (no change action) */}
          {email && (
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/40">
              <span className="font-mono text-sm text-slate-900 dark:text-white">
                {maskedEmail}
              </span>
            </div>
          )}

          {isLocked ? (
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-red-50 px-3 py-1.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
              <AlertTriangle size={12} />
              <span>{copy.lockedRetryIn}</span>
              <span className="font-mono font-bold">
                {formatLockDuration(lockTimer, fr)}
              </span>
            </div>
          ) : (
            <div
              className={`mt-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${
                expired
                  ? "border-red-300 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
                  : expiryWarning
                    ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
                    : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400"
              }`}
            >
              <Clock size={12} />
              {expired ? (
                <span className="font-semibold">{copy.timerExpired}</span>
              ) : (
                <>
                  <span>{copy.timerLabel}</span>
                  <span className="font-mono font-bold">{formatMMSS(expiryTimer)}</span>
                </>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4">
            <div>
              <label className="block text-center text-xs font-semibold text-slate-700 dark:text-slate-200 mb-3">
                {copy.otpLabel}
              </label>

              <div
                className="flex items-center justify-center gap-2 sm:gap-2.5"
                onPaste={handlePaste}
              >
                {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      inputsRef.current[i] = el;
                    }}
                    inputMode="numeric"
                    autoComplete={i === 0 ? "one-time-code" : "off"}
                    pattern="\d*"
                    maxLength={1}
                    value={digits[i]}
                    onChange={(e) => handleChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    disabled={expired || isLocked || verifyOtpMutation.isPending}
                    className={`h-12 w-10 rounded-lg border bg-white text-center font-mono text-lg font-bold text-slate-900 outline-none transition-all sm:h-13 sm:w-11 dark:bg-slate-950 dark:text-white ${
                      errors.otp || isLocked
                        ? "border-red-300 focus:border-red-400 focus:ring-4 focus:ring-red-200 dark:border-red-800 dark:focus:border-red-700 dark:focus:ring-red-900/40"
                        : digits[i]
                          ? "border-emerald-500 bg-emerald-50/30 focus:ring-4 focus:ring-emerald-200 dark:border-emerald-700 dark:bg-emerald-950/20 dark:focus:ring-emerald-900/40"
                          : "border-slate-200 focus:border-[#FF9900] focus:ring-4 focus:ring-[#FF9900]/20 dark:border-slate-800 dark:focus:border-[#FFAE33]"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                    aria-label={`OTP digit ${i + 1}`}
                  />
                ))}
              </div>

              <p className="mt-2 text-center text-[11px] text-slate-500 dark:text-slate-400">
                {copy.otpHelp}
              </p>

              {showAttemptsWarning && attemptsLeft !== undefined && attemptsLeft > 0 && (
                <div
                  role="alert"
                  className={`mt-3 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs ${
                    attemptsLeft === 1
                      ? "border-red-300 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
                      : attemptsLeft <= 2
                        ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
                        : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300"
                  }`}
                >
                  <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-semibold">{copy.incorrectCode}</span>{" "}
                    <span>
                      {attemptsLeft}{" "}
                      {attemptsLeft === 1
                        ? copy.attemptsLeftSingular
                        : copy.attemptsLeftPlural}
                      .
                    </span>
                  </div>
                </div>
              )}

              {isLocked && (
                <div
                  role="alert"
                  className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-950/30"
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle
                      size={16}
                      className="mt-0.5 flex-shrink-0 text-red-600 dark:text-red-400"
                    />
                    <div className="text-xs">
                      <p className="font-bold text-red-800 dark:text-red-300">
                        {copy.locked}
                      </p>
                      <p className="mt-1 text-red-700 dark:text-red-400">
                        {copy.lockedTip}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {errors.otp?.message && !showAttemptsWarning && !isLocked && (
                <div
                  role="alert"
                  className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
                >
                  {errors.otp.message}
                </div>
              )}
            </div>

            {errors.root?.serverError?.message && !isLocked && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200"
              >
                {errors.root.serverError.message}
              </div>
            )}

            <button
              type="submit"
              disabled={verifyOtpMutation.isPending || expired || isLocked}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#FF9900] px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm transition-colors hover:bg-[#F08700] active:bg-[#E07A00] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF9900]/30"
            >
              {verifyOtpMutation.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {copy.ctaLoading}
                </>
              ) : (
                copy.cta
              )}
            </button>
          </form>

          <div className="mt-5 border-t border-slate-200 pt-4 text-center dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">{copy.resendText}</p>
            <button
              type="button"
              onClick={resendOtp}
              disabled={!canResend || resendOtpMutation.isPending}
              className={`mt-1 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
                !canResend || resendOtpMutation.isPending
                  ? "cursor-not-allowed text-slate-400 dark:text-slate-600"
                  : "text-[#0D9488] hover:bg-slate-50 dark:text-[#2DD4BF] dark:hover:bg-slate-900/40"
              }`}
            >
              {resendOtpMutation.isPending ? (
                <Loader2 size={11} className="animate-spin" />
              ) : null}
              {!canResend && resendTimer > 0
                ? `${copy.resendCooldown} ${formatMMSS(resendTimer)}`
                : copy.resendCta}
            </button>
          </div>

          {/* Wrong email — Start over (pattern Stripe/Linear) */}
          <div className="mt-4 text-center">
            <span className="text-[11px] text-slate-500 dark:text-slate-500">
              {copy.wrongEmailQuestion}{" "}
            </span>
            <button
              type="button"
              onClick={handleStartOver}
              className="text-[11px] font-semibold text-[#0D9488] underline underline-offset-2 decoration-[#0D9488]/40 hover:decoration-[#0D9488] dark:text-[#2DD4BF] dark:decoration-[#2DD4BF]/40 dark:hover:decoration-[#2DD4BF]"
            >
              {copy.startOver}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

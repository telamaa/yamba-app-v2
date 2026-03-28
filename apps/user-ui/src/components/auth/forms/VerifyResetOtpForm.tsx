"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import {
  getApiErrorMessage,
  hasApiBaseUrl,
  requestPasswordResetOtp,
  verifyPasswordResetOtp,
} from "@/services/auth.api";

type Lang = "fr" | "en";

type FormData = {
  email: string;
};

export default function VerifyResetOtpForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const { lang } = useUiPreferences();

  const initialEmail =
    sp.get("email") ??
    (typeof window !== "undefined"
      ? sessionStorage.getItem("pwd_reset_email") ?? ""
      : "");

  const [otp, setOtp] = useState(["", "", "", ""]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [canResend, setCanResend] = useState(false);
  const [timer, setTimer] = useState(300);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const timerRef = useRef<number | null>(null);

  const copy = useMemo(() => {
    const fr = (lang as Lang) === "fr";
    return {
      title: fr ? "Vérification du code" : "Verify the code",
      subtitle: fr
        ? "Saisissez le code à 4 chiffres reçu par e-mail."
        : "Enter the 4-digit code sent to your email.",
      email: fr ? "E-mail" : "Email",
      otpLabel: fr ? "Code OTP" : "OTP code",
      cta: fr ? "Valider" : "Verify",
      back: fr ? "Retour" : "Back",
      resend: fr ? "Renvoyer le code" : "Resend code",
      resendIn: fr ? "Renvoyer dans" : "Resend in",
      changeEmail: fr ? "Changer d’e-mail" : "Change email",
      help: fr ? "Vous pouvez coller le code complet." : "You can paste the full code.",
      nextHint: fr
        ? "Après validation, vous pourrez définir un nouveau mot de passe."
        : "After verification, you’ll be able to set a new password.",
      requiredEmail: fr ? "L’e-mail est requis." : "Email is required.",
      invalidEmail: fr ? "Veuillez saisir un e-mail valide." : "Please enter a valid email.",
      invalidOtp: fr ? "Veuillez saisir le code complet." : "Please enter the full code.",
      resentOk: fr ? "Code renvoyé." : "Code resent.",
      genericError: fr
        ? "Validation impossible pour le moment."
        : "Unable to verify right now.",
      configError: fr
        ? "La configuration de l’application est incomplète."
        : "Application configuration is incomplete.",
    };
  }, [lang]);

  const UI = {
    label: "text-sm font-semibold text-slate-800 dark:text-slate-100",
    help: "text-xs text-slate-500 dark:text-slate-500",
    link:
      "font-semibold text-[#0F766E] hover:text-[#115E59] hover:underline " +
      "dark:text-[#2DD4BF] dark:hover:text-[#5EEAD4]",
    input:
      "mt-2 w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none " +
      "focus:border-[#FF9900]/80 focus:ring-4 focus:ring-[#FF9900]/25 " +
      "dark:border-slate-800 dark:bg-slate-950 dark:text-white " +
      "dark:focus:border-[#FFAE33]/70 dark:focus:ring-[#FF9900]/18",
    btnPrimary:
      "w-full rounded-lg bg-[#FF9900] px-4 py-2.5 text-sm font-semibold text-slate-900 " +
      "shadow-sm transition-colors hover:bg-[#F08700] active:bg-[#E07A00] disabled:opacity-60 " +
      "focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF9900]/30 " +
      "dark:focus-visible:ring-[#FF9900]/18",
    otpBox:
      "h-12 w-12 rounded-lg border border-slate-200 bg-white text-center text-lg font-semibold " +
      "text-slate-900 outline-none " +
      "focus:border-[#FF9900]/80 focus:ring-4 focus:ring-[#FF9900]/25 " +
      "dark:border-slate-800 dark:bg-slate-950 dark:text-white " +
      "dark:focus:border-[#FFAE33]/70 dark:focus:ring-[#FF9900]/18",
    notice:
      "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 " +
      "dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200",
  };

  const { register, handleSubmit, watch } = useForm<FormData>({
    defaultValues: {
      email: initialEmail,
    },
  });

  const userEmail = watch("email") ?? "";

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startResendTimer = () => {
    clearTimer();
    setCanResend(false);
    setTimer(300);

    timerRef.current = window.setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearTimer();
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    startResendTimer();
    return () => clearTimer();
  }, []);

  const requestOtpMutation = useMutation({
    mutationFn: requestPasswordResetOtp,
    onSuccess: (_, variables) => {
      const normalizedEmail = variables.email.trim().toLowerCase();

      if (typeof window !== "undefined") {
        sessionStorage.setItem("pwd_reset_email", normalizedEmail);
      }

      setServerError(null);
      setOtp(["", "", "", ""]);
      startResendTimer();
    },
    onError: (error) => {
      setServerError(getApiErrorMessage(error, copy.genericError));
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: verifyPasswordResetOtp,
    onSuccess: (data, variables) => {
      if (typeof window !== "undefined") {
        sessionStorage.setItem("pwd_reset_email", variables.email.trim().toLowerCase());
        if (data.passwordResetToken) {
          sessionStorage.setItem("pwd_reset_token", data.passwordResetToken);
        }
      }

      setServerError(null);
      router.push("/password/reset");
    },
    onError: (error) => {
      setServerError(getApiErrorMessage(error, copy.genericError));
    },
  });

  const handleOtpChange = (index: number, value: string) => {
    if (!/^[0-9]?$/.test(value)) return;

    setServerError(null);

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < inputRefs.current.length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (
    index: number,
    e: KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = () => {
    setServerError(null);

    if (!hasApiBaseUrl()) {
      setServerError(copy.configError);
      return;
    }

    const normalizedEmail = userEmail.trim().toLowerCase();

    if (!normalizedEmail) {
      setServerError(copy.requiredEmail);
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setServerError(copy.invalidEmail);
      return;
    }

    const otpValue = otp.join("");
    if (otpValue.length !== 4) {
      setServerError(copy.invalidOtp);
      return;
    }

    verifyOtpMutation.mutate({
      email: normalizedEmail,
      otp: otpValue,
    });
  };

  const handleResendOtp = () => {
    setServerError(null);

    if (!hasApiBaseUrl()) {
      setServerError(copy.configError);
      return;
    }

    const normalizedEmail = userEmail.trim().toLowerCase();

    if (!normalizedEmail) {
      setServerError(copy.requiredEmail);
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setServerError(copy.invalidEmail);
      return;
    }

    requestOtpMutation.mutate({
      email: normalizedEmail,
    });
  };

  const formatMMSS = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <main className="px-4">
      <div className="mx-auto flex min-h-[85vh] max-w-6xl items-center justify-center py-10">
        <div className="w-full max-w-[420px]">
          <h1 className="text-center text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {copy.title}
          </h1>
          <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
            {copy.subtitle}
          </p>

          <form onSubmit={handleSubmit(() => handleVerifyOtp())} className="mt-8 space-y-5" noValidate>
            <div>
              <label className={UI.label}>{copy.email}</label>
              <input
                type="email"
                autoComplete="email"
                className={UI.input}
                {...register("email")}
              />
            </div>

            <div className="text-center">
              <label className={UI.label}>{copy.otpLabel}</label>
              <div className="mt-3 flex items-center justify-center gap-3">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      if (el) inputRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    className={UI.otpBox}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  />
                ))}
              </div>
              <p className={`mt-2 ${UI.help}`}>{copy.help}</p>
              <p className={`mt-1 ${UI.help}`}>{copy.nextHint}</p>
            </div>

            {requestOtpMutation.isSuccess && !serverError && (
              <div className={UI.notice}>{copy.resentOk}</div>
            )}

            {serverError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                {serverError}
              </div>
            )}

            <button
              type="submit"
              disabled={verifyOtpMutation.isPending}
              className={UI.btnPrimary}
            >
              {verifyOtpMutation.isPending ? "…" : copy.cta}
            </button>

            <div className="pt-1">
              <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-8 text-sm">
                <button type="button" onClick={() => router.back()} className={UI.link}>
                  {copy.back}
                </button>

                {canResend ? (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    className={UI.link}
                    disabled={requestOtpMutation.isPending}
                  >
                    {requestOtpMutation.isPending ? "…" : copy.resend}
                  </button>
                ) : (
                  <p className="font-semibold text-slate-400 dark:text-slate-600">
                    {copy.resendIn} {formatMMSS(timer)}
                  </p>
                )}
              </div>

              <div className="pt-3 text-center text-sm text-slate-600 dark:text-slate-400">
                <Link href="/password/forgot" className={UI.link}>
                  {copy.changeEmail}
                </Link>
              </div>
            </div>
          </form>

          <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-500">
            Vérifiez l’URL pour vous assurer de vous connecter au bon site.
          </p>
        </div>
      </div>
    </main>
  );
}

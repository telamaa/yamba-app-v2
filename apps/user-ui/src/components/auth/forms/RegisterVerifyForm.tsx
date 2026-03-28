"use client";

// import Link from "next/link";
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
import {
  getApiErrorData,
  getApiErrorMessage,
  hasApiBaseUrl,
  resendRegistrationOtp,
  verifyRegistrationOtp,
} from "@/services/auth.api";

type Lang = "fr" | "en";

type VerifyFormData = {
  otp: string;
};

function onlyDigits(s: string) {
  return s.replace(/\D/g, "");
}

function formatMMSS(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function RegisterVerifyForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const { lang } = useUiPreferences();

  const copy = useMemo(() => {
    const fr = (lang as Lang) === "fr";
    return {
      title: fr ? "Vérifiez votre e-mail" : "Verify your email",
      subtitle: fr
        ? "Saisissez le code à 4 chiffres reçu par e-mail."
        : "Enter the 4-digit code sent to your email.",
      otpLabel: fr ? "Code OTP" : "OTP code",
      cta: fr ? "Valider" : "Verify",
      back: fr ? "Retour" : "Back",
      resend: fr ? "Renvoyer le code" : "Resend code",
      resendIn: fr ? "Renvoyer dans" : "Resend in",
      // changeEmail: fr ? "Changer d’e-mail" : "Change email",
      help: fr ? "Vous pouvez coller le code complet." : "You can paste the full code.",
      missingToken: fr
        ? "Session expirée. Merci de recommencer l’inscription."
        : "Session expired. Please register again.",
      incomplete: fr ? "Veuillez saisir le code complet." : "Please enter the full code.",
      invalidOtp: fr ? "Code invalide ou expiré." : "Invalid or expired code.",
      resentOk: fr ? "Code renvoyé." : "Code resent.",
      genericError: fr
        ? "Validation impossible pour le moment."
        : "Unable to verify right now.",
      resendUnavailable: fr
        ? "Le renvoi de code n’est pas disponible. Merci de recommencer l’inscription."
        : "Code resend is not available. Please restart registration.",
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
    btnPrimaryBase:
      "rounded-lg bg-[#FF9900] px-4 py-2.5 text-sm font-semibold text-slate-900 " +
      "shadow-sm transition-colors hover:bg-[#F08700] active:bg-[#E07A00] disabled:opacity-60 " +
      "focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF9900]/30 " +
      "dark:focus-visible:ring-[#FF9900]/18",
    otpBox:
      "h-12 w-12 rounded-lg border border-slate-200 bg-white text-center text-lg font-semibold " +
      "text-slate-900 outline-none " +
      "focus:border-[#FF9900]/80 focus:ring-4 focus:ring-[#FF9900]/25 " +
      "dark:border-slate-800 dark:bg-slate-950 dark:text-white " +
      "dark:focus:border-[#FFAE33]/70 dark:focus:ring-[#FF9900]/18",
    otpBoxError:
      "border-red-300 focus:border-red-400 focus:ring-red-200 " +
      "dark:border-red-800 dark:focus:border-red-700 dark:focus:ring-red-900/40",
    notice:
      "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 " +
      "dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200",
    helperError: "mt-2 text-xs text-red-600 dark:text-red-400 text-center",
  };

  const tokenFromQuery = sp.get("token") ?? "";
  const emailFromQuery = sp.get("email") ?? "";

  const token =
    tokenFromQuery ||
    (typeof window !== "undefined"
      ? sessionStorage.getItem("register_verification_token") ?? ""
      : "");

  const email =
    emailFromQuery ||
    (typeof window !== "undefined"
      ? sessionStorage.getItem("register_verification_email") ?? ""
      : "");

  const [digits, setDigits] = useState<string[]>(["", "", "", ""]);
  const [canResend, setCanResend] = useState(false);
  const [timer, setTimer] = useState(60);
  const [resentMsg, setResentMsg] = useState<string | null>(null);

  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const lastAutoSubmitOtpRef = useRef<string>("");
  // const resendIntervalRef = useRef<ReturnType<typeof window.setInterval> | null>(null);
  const resendIntervalRef = useRef<number | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    formState: { errors, isValid },
  } = useForm<VerifyFormData>({
    mode: "onChange",
    defaultValues: {
      otp: "",
    },
  });

  const clearResendTimer = () => {
    if (resendIntervalRef.current) {
      window.clearInterval(resendIntervalRef.current);
      resendIntervalRef.current = null;
    }
  };

  const startResendTimer = () => {
    clearResendTimer();
    setCanResend(false);
    setTimer(60);

    resendIntervalRef.current = window.setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearResendTimer();
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const verifyOtpMutation = useMutation({
    mutationFn: verifyRegistrationOtp,
    onSuccess: () => {
      sessionStorage.removeItem("register_verification_token");
      sessionStorage.removeItem("register_verification_email");
      router.push("/login");
      router.refresh();
    },
    onError: (error) => {
      const data = getApiErrorData(error);

      if (data?.errors?.otp) {
        setError("otp", {
          type: "server",
          message: String(data.errors.otp),
        });
        return;
      }

      setError("root.serverError", {
        type: "server",
        message: getApiErrorMessage(error, copy.invalidOtp),
      });
    },
  });

  const resendOtpMutation = useMutation({
    mutationFn: resendRegistrationOtp,
    onSuccess: (data, variables) => {
      const nextToken = data?.verificationToken || variables.verificationToken;

      sessionStorage.setItem("register_verification_token", nextToken);

      setDigits(["", "", "", ""]);
      lastAutoSubmitOtpRef.current = "";
      setResentMsg(copy.resentOk);
      startResendTimer();
      inputsRef.current[0]?.focus();
    },
    onError: (error) => {
      setError("root.serverError", {
        type: "server",
        message: getApiErrorMessage(error, copy.genericError),
      });
    },
  });

  const otp = digits.join("");

  useEffect(() => {
    if (tokenFromQuery) {
      sessionStorage.setItem("register_verification_token", tokenFromQuery);
    }
  }, [tokenFromQuery]);

  useEffect(() => {
    if (emailFromQuery) {
      sessionStorage.setItem("register_verification_email", emailFromQuery);
    }
  }, [emailFromQuery]);

  useEffect(() => {
    setValue("otp", otp, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    });
  }, [otp, setValue]);

  useEffect(() => {
    if (token) {
      startResendTimer();
    }

    return () => {
      clearResendTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const clean = onlyDigits(value).slice(0, 4);
    const next = ["", "", "", ""];
    clean.split("").forEach((char, idx) => {
      next[idx] = char;
    });
    setDigits(next);
    return clean;
  };

  const handleChange = (index: number, raw: string) => {
    clearErrors("otp");
    clearErrors("root.serverError");
    setResentMsg(null);

    const value = onlyDigits(raw);

    if (value.length >= 2) {
      const pasted = fillDigits(value);
      focusIndex(Math.min(pasted.length - 1, 3));
      return;
    }

    const one = value.slice(0, 1);
    updateDigitAt(index, one);

    if (one && index < 3) {
      focusIndex(index + 1);
    }
  };

  const handleKeyDown = (
    index: number,
    e: KeyboardEvent<HTMLInputElement>
  ) => {
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

    if (e.key === "ArrowLeft" && index > 0) {
      focusIndex(index - 1);
    }

    if (e.key === "ArrowRight" && index < 3) {
      focusIndex(index + 1);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    clearErrors("otp");
    clearErrors("root.serverError");
    setResentMsg(null);

    const text = onlyDigits(e.clipboardData.getData("text")).slice(0, 4);
    if (!text) return;

    fillDigits(text);
    focusIndex(Math.min(text.length - 1, 3));
  };

  const verifyOtp = async (otpValue: string) => {
    clearErrors("otp");
    clearErrors("root.serverError");
    setResentMsg(null);

    if (!hasApiBaseUrl()) {
      setError("root.serverError", {
        type: "config",
        message: copy.configError,
      });
      return;
    }

    if (!token) {
      setError("root.serverError", {
        type: "session",
        message: copy.missingToken,
      });
      return;
    }

    if (otpValue.length !== 4) {
      setError("otp", {
        type: "manual",
        message: copy.incomplete,
      });
      return;
    }

    try {
      await verifyOtpMutation.mutateAsync({
        verificationToken: token,
        otp: otpValue,
      });
    } catch {
      // géré par onError
    }
  };

  useEffect(() => {
    if (
      otp.length === 4 &&
      otp !== lastAutoSubmitOtpRef.current &&
      !verifyOtpMutation.isPending
    ) {
      lastAutoSubmitOtpRef.current = otp;
      void verifyOtp(otp);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp, verifyOtpMutation.isPending]);

  const onSubmit = async (values: VerifyFormData) => {
    await verifyOtp(values.otp);
  };

  const resendOtp = async () => {
    if (!canResend) return;

    clearErrors("otp");
    clearErrors("root.serverError");
    setResentMsg(null);

    if (!hasApiBaseUrl()) {
      setError("root.serverError", {
        type: "config",
        message: copy.configError,
      });
      return;
    }

    if (!token) {
      setError("root.serverError", {
        type: "session",
        message: copy.missingToken,
      });
      return;
    }

    try {
      await resendOtpMutation.mutateAsync({
        verificationToken: token,
      });
    } catch {
      // géré par onError
    }
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

          {email ? (
            <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
              {email}
            </p>
          ) : null}

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5" noValidate>
            <input
              type="hidden"
              {...register("otp", {
                required: copy.incomplete,
                validate: (value) => /^\d{4}$/.test(value) || copy.incomplete,
              })}
            />

            <div className="text-center">
              <label className={UI.label}>{copy.otpLabel}</label>

              <div className="mt-3 flex items-center justify-center gap-3" onPaste={handlePaste}>
                {[0, 1, 2, 3].map((i) => (
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
                    className={`${UI.otpBox} ${errors.otp ? UI.otpBoxError : ""}`}
                    aria-label={`OTP digit ${i + 1}`}
                  />
                ))}
              </div>

              <p className={`mt-2 ${UI.help}`}>{copy.help}</p>

              {errors.otp?.message ? (
                <p className={UI.helperError}>{errors.otp.message}</p>
              ) : null}
            </div>

            {resentMsg ? <div className={UI.notice}>{resentMsg}</div> : null}

            {errors.root?.serverError?.message ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                {errors.root.serverError.message}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={verifyOtpMutation.isPending || !isValid}
              className={[UI.btnPrimaryBase, "block w-full sm:mx-auto sm:w-[320px]"].join(" ")}
            >
              {verifyOtpMutation.isPending ? "…" : copy.cta}
            </button>

            <div className="pt-1">
              <div className="flex flex-col items-center justify-center gap-3 text-sm sm:flex-row sm:gap-8">
                <button
                  type="button"
                  onClick={() => router.push("/register")}
                  className={UI.link}
                >
                  {copy.back}
                </button>

                <button
                  type="button"
                  onClick={resendOtp}
                  disabled={!canResend || resendOtpMutation.isPending}
                  className={[
                    "font-semibold",
                    !canResend || resendOtpMutation.isPending
                      ? "cursor-not-allowed text-slate-400 dark:text-slate-600"
                      : UI.link,
                  ].join(" ")}
                >
                  {!canResend
                    ? `${copy.resendIn} ${formatMMSS(timer)}`
                    : resendOtpMutation.isPending
                      ? "…"
                      : copy.resend}
                </button>
              </div>

              {/*<div className="pt-3 text-center text-sm text-slate-600 dark:text-slate-400">*/}
              {/*  <Link href="/auth/register" className={UI.link}>*/}
              {/*    {copy.changeEmail}*/}
              {/*  </Link>*/}
              {/*</div>*/}
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

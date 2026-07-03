/**
 * DeliverOtpInput.tsx
 * ===================
 * Saisie du code de livraison à 6 chiffres (pattern OTP) :
 *  - 6 cases groupées 3+3 avec séparateur (miroir du code affiché côté Sender)
 *  - auto-focus, auto-avance, backspace intelligent (revient en arrière)
 *  - paste distribué (Marie montre son téléphone, Thomas colle)
 *  - inputMode numeric (clavier chiffres sur mobile)
 *  - erreur → animation shake + message + compteur de tentatives
 *  - verrouillé → cases disabled + compte à rebours
 */

"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

const CODE_LENGTH = 6;

type Props = {
  recipientFirstName: string;
  attemptsUsed: number;
  maxAttempts: number;
  errorMessage?: string | null;
  isLocked: boolean;
  lockCountdown?: string;
  isSubmitting: boolean;
  onSubmitAction: (code: string) => void;
  compact?: boolean;
};

export default function DeliverOtpInput({
                                          recipientFirstName,
                                          attemptsUsed,
                                          maxAttempts,
                                          errorMessage,
                                          isLocked,
                                          lockCountdown,
                                          isSubmitting,
                                          onSubmitAction,
                                          compact = false,
                                        }: Props) {
  const t = useTranslations("carrierDealDeliver");
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [shake, setShake] = useState(false);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const code = digits.join("");
  const isComplete = code.length === CODE_LENGTH && digits.every((d) => d !== "");

  // Shake + reset à chaque nouvelle erreur
  useEffect(() => {
    if (!errorMessage) return;
    setShake(true);
    setDigits(Array(CODE_LENGTH).fill(""));
    const timer = setTimeout(() => {
      setShake(false);
      inputsRef.current[0]?.focus();
    }, 500);
    return () => clearTimeout(timer);
  }, [errorMessage]);

  const handleChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < CODE_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
    if (e.key === "Enter" && isComplete && !isSubmitting && !isLocked) {
      onSubmitAction(code);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!pasted) return;
    const next = Array(CODE_LENGTH).fill("");
    pasted.split("").forEach((d, i) => {
      next[i] = d;
    });
    setDigits(next);
    const focusIndex = Math.min(pasted.length, CODE_LENGTH - 1);
    inputsRef.current[focusIndex]?.focus();
  };

  return (
    <section
      className={`rounded-2xl border-2 bg-white transition-colors dark:bg-slate-950 ${
        errorMessage
          ? "border-red-300 dark:border-red-800"
          : "border-amber-300 dark:border-amber-800"
      } ${compact ? "p-4" : "p-5 sm:p-6"}`}
    >
      <div className="text-center text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 sm:text-[11px]">
        {compact
          ? t("otp.labelShort")
          : t("otp.label", { recipientFirstName: recipientFirstName.toUpperCase() })}
      </div>

      {/* Les 6 cases */}
      <div
        className={`mt-4 flex items-center justify-center gap-2 ${
          shake ? "animate-[shake_0.4s_ease-in-out]" : ""
        }`}
        style={
          shake
            ? undefined
            : undefined
        }
      >
        {digits.map((digit, i) => (
          <span key={i} className="flex items-center">
            {i === 3 && (
              <span
                className="mx-1 text-[20px] font-bold text-slate-300 dark:text-slate-600"
                aria-hidden="true"
              >
                ·
              </span>
            )}
            <input
              ref={(el) => {
                inputsRef.current[i] = el;
              }}
              type="text"
              inputMode="numeric"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              maxLength={1}
              value={digit}
              disabled={isLocked || isSubmitting}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={handlePaste}
              onFocus={(e) => e.target.select()}
              aria-label={`Chiffre ${i + 1}`}
              className={`rounded-xl border-2 bg-white text-center font-black tabular-nums text-slate-900 transition-colors focus:outline-none disabled:opacity-40 dark:bg-slate-900 dark:text-white ${
                compact
                  ? "h-12 w-10 text-[22px]"
                  : "h-14 w-11 text-[26px] sm:h-16 sm:w-12 sm:text-[30px]"
              } ${
                errorMessage
                  ? "border-red-300 focus:border-red-500 dark:border-red-800"
                  : digit
                    ? "border-amber-400 dark:border-amber-600"
                    : "border-slate-200 focus:border-[#FF9900] dark:border-slate-700"
              }`}
            />
          </span>
        ))}
      </div>

      {/* Erreur / verrouillage / compteur */}
      {isLocked ? (
        <div className="mt-3 text-center">
          <p className="text-[12.5px] font-semibold text-red-700 dark:text-red-400">
            {t("otp.locked", { minutes: 15 })}
          </p>
          {lockCountdown && (
            <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
              {t("otp.lockedCountdown", { countdown: lockCountdown })}
            </p>
          )}
        </div>
      ) : errorMessage ? (
        <p className="mt-3 text-center text-[12.5px] font-semibold text-red-700 dark:text-red-400">
          {errorMessage}
        </p>
      ) : (
        <p className="mt-3 text-center text-[12px] text-slate-500 dark:text-slate-400">
          {t("otp.attempt", { current: attemptsUsed + 1, max: maxAttempts })}
        </p>
      )}

      {/* CTA */}
      <button
        type="button"
        onClick={() => onSubmitAction(code)}
        disabled={!isComplete || isSubmitting || isLocked}
        className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF9900] px-4 font-bold text-slate-950 transition-colors hover:bg-[#F08700] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-500 ${
          compact ? "min-h-[48px] text-[14px]" : "min-h-[50px] text-[14.5px]"
        }`}
      >
        <Check size={15} strokeWidth={3} aria-hidden="true" />
        {isSubmitting ? t("otp.validating") : t("otp.validate")}
      </button>
    </section>
  );
}

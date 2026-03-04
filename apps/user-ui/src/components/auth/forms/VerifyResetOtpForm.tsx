"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";

type Lang = "fr" | "en";

function onlyDigits(s: string) {
  return s.replace(/\D/g, "");
}

function formatMMSS(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function VerifyResetOtpForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const { lang } = useUiPreferences();

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
      incomplete: fr ? "Veuillez saisir le code complet." : "Please enter the full code.",
      needEmail: fr ? "Veuillez saisir votre e-mail." : "Please enter your email.",
      resentOk: fr ? "Code renvoyé." : "Code resent.",
      nextHint: fr
        ? "Après validation, vous pourrez définir un nouveau mot de passe."
        : "After verification, you’ll be able to set a new password.",
    };
  }, [lang]);

  // Palette Mango (#FF9900)
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

  // Email initial depuis query (?email=)
  const initialEmail = sp.get("email") ?? "";
  const [email, setEmail] = useState(initialEmail);
  const emailRef = useRef<HTMLInputElement | null>(null);

  // OTP
  const [digits, setDigits] = useState<string[]>(["", "", "", ""]);
  const otp = digits.join("");

  // ✅ Ready state (bouton actif seulement si tout est saisi)
  const isReady = email.trim().length > 0 && otp.length === 4;

  // states
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resend timer (5 min)
  const RESEND_SECONDS = 5 * 60;
  const [resendLeft, setResendLeft] = useState<number>(RESEND_SECONDS);
  const [resentMsg, setResentMsg] = useState<string | null>(null);

  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  // Countdown
  useEffect(() => {
    if (resendLeft <= 0) return;
    const t = setInterval(() => setResendLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendLeft]);

  const focusIndex = (i: number) => {
    const el = inputsRef.current[i];
    el?.focus();
    el?.select();
  };

  const setAt = (i: number, v: string) => {
    const next = [...digits];
    next[i] = v;
    setDigits(next);
  };

  const handleChange = (i: number, raw: string) => {
    setError(null);
    setResentMsg(null);

    const v = onlyDigits(raw);

    // Collage "1234"
    if (v.length >= 2) {
      const all = v.slice(0, 4).split("");
      const next = ["", "", "", ""];
      for (let k = 0; k < 4; k++) next[k] = all[k] ?? "";
      setDigits(next);
      focusIndex(Math.min(all.length - 1, 3));
      return;
    }

    const one = v.slice(0, 1);
    setAt(i, one);
    if (one && i < 3) focusIndex(i + 1);
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    setError(null);

    if (e.key === "Backspace") {
      if (digits[i]) {
        setAt(i, "");
        return;
      }
      if (i > 0) {
        focusIndex(i - 1);
        setAt(i - 1, "");
      }
    }

    if (e.key === "ArrowLeft" && i > 0) focusIndex(i - 1);
    if (e.key === "ArrowRight" && i < 3) focusIndex(i + 1);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    setError(null);
    setResentMsg(null);

    const text = onlyDigits(e.clipboardData.getData("text")).slice(0, 4);
    if (!text) return;

    const next = ["", "", "", ""];
    text.split("").forEach((c, idx) => (next[idx] = c));
    setDigits(next);
    focusIndex(Math.min(text.length - 1, 3));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResentMsg(null);

    if (!email.trim()) {
      setError(copy.needEmail);
      emailRef.current?.focus();
      return;
    }
    if (otp.length !== 4) {
      setError(copy.incomplete);
      return;
    }

    setBusy(true);
    try {
      // UI only pour l’instant
      console.log("[password/verify]", { email, otp });

      // Quand tu branches le back :
      // const res = await authApi.resetVerifyOtp({ email, otp });
      // sessionStorage.setItem("pwd_reset_token", res.passwordResetToken);
      // router.push(`/auth/password/reset?token=${encodeURIComponent(res.passwordResetToken)}`);

      router.push("/auth/password/reset"); // placeholder UI
    } catch (err: any) {
      setError(err?.message ?? "Error");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (resendLeft > 0) return;

    // UI only
    console.log("[password/resend] ui only", { email });

    setResentMsg(copy.resentOk);
    setResendLeft(RESEND_SECONDS);
    window.setTimeout(() => setResentMsg(null), 3500);
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

          <form onSubmit={submit} className="mt-8 space-y-5">
            {/* Email */}
            <div>
              <label className={UI.label}>{copy.email}</label>
              <input
                ref={emailRef}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={UI.input}
              />
            </div>

            {/* OTP */}
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
                    autoComplete="one-time-code"
                    pattern="\d*"
                    maxLength={1}
                    value={digits[i]}
                    onChange={(e) => handleChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    className={UI.otpBox}
                    aria-label={`OTP digit ${i + 1}`}
                  />
                ))}
              </div>
              <p className={`mt-2 ${UI.help}`}>{copy.help}</p>
              <p className={`mt-1 ${UI.help}`}>{copy.nextHint}</p>
            </div>

            {resentMsg && <div className={UI.notice}>{resentMsg}</div>}

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                {error}
              </div>
            )}

            {/* ✅ bouton actif seulement si tout est saisi */}
            <button type="submit" disabled={busy || !isReady} className={UI.btnPrimary}>
              {busy ? "…" : copy.cta}
            </button>

            {/* Back + Resend + Change email */}
            <div className="pt-1">
              <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-8 text-sm">
                <button type="button" onClick={() => router.back()} className={UI.link}>
                  {copy.back}
                </button>

                <button
                  type="button"
                  onClick={resend}
                  disabled={resendLeft > 0}
                  className={[
                    "font-semibold",
                    resendLeft > 0
                      ? "text-slate-400 cursor-not-allowed dark:text-slate-600"
                      : UI.link,
                  ].join(" ")}
                >
                  {resendLeft > 0
                    ? `${copy.resendIn} ${formatMMSS(resendLeft)}`
                    : copy.resend}
                </button>
              </div>

              <div className="pt-3 text-center text-sm text-slate-600 dark:text-slate-400">
                <Link href="/auth/password/forgot" className={UI.link}>
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

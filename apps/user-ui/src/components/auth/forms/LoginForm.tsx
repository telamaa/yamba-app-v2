"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.2 6.2 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.1-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.2 6.2 29.3 4 24 4c-7.7 0-14.4 4.3-17.7 10.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.2C29.3 35.4 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.6 5.1C9.4 39.7 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.3 5.2C40.9 35.6 44 30.3 44 24c0-1.1-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#1877F2"
        d="M24 4C13 4 4 13 4 24s9 20 20 20 20-9 20-20S35 4 24 4z"
      />
      <path
        fill="#fff"
        d="M26.6 38V26.8h3.7l.6-4.4h-4.3v-2.8c0-1.3.4-2.2 2.2-2.2h2.3V13.5c-.4-.1-1.8-.2-3.4-.2-3.4 0-5.7 2.1-5.7 6v3.1h-3.8v4.4H24V38h2.6z"
      />
    </svg>
  );
}

export default function LoginForm() {
  const { lang } = useUiPreferences();

  const copy = useMemo(() => {
    const fr = lang === "fr";
    return {
      title: fr ? "Bon retour sur Yamba" : "Welcome back to Yamba",
      subtitle: fr
        ? "Saisissez votre e-mail et votre mot de passe."
        : "Enter your email and password.",
      email: fr ? "E-mail" : "Email",
      password: fr ? "Mot de passe" : "Password",
      forgot: fr ? "Mot de passe oublié ?" : "Forgot password?",
      remember: fr ? "Se souvenir de moi sur cet appareil" : "Remember me on this device",
      cta: fr ? "Connexion" : "Sign in",
      or: fr ? "OU" : "OR",
      google: fr ? "Me connecter avec Google" : "Continue with Google",
      facebook: fr ? "Me connecter avec Facebook" : "Continue with Facebook",
      foot: fr ? "Vous découvrez Yamba ?" : "New to Yamba?",
      create: fr ? "Créez un compte" : "Create an account",
    };
  }, [lang]);

  // Palette Mango (#FF9900) + accent Teal pour les liens
  const UI = {
    label: "text-sm font-semibold text-slate-800 dark:text-slate-100",
    input:
      "mt-2 w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none " +
      "focus:border-[#FF9900]/80 focus:ring-4 focus:ring-[#FF9900]/25 " +
      "dark:border-slate-800 dark:bg-slate-950 dark:text-white " +
      "dark:focus:border-[#FFAE33]/70 dark:focus:ring-[#FF9900]/18",
    link:
      "text-sm font-semibold text-[#0F766E] hover:text-[#115E59] hover:underline " +
      "dark:text-[#2DD4BF] dark:hover:text-[#5EEAD4]",
    btnPrimary:
      "w-full rounded-lg bg-[#FF9900] px-4 py-2.5 text-sm font-semibold text-slate-900 " +
      "shadow-sm transition-colors hover:bg-[#F08700] active:bg-[#E07A00] disabled:opacity-60 " +
      "focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF9900]/30 " +
      "dark:focus-visible:ring-[#FF9900]/18",
    btnSecondary:
      "w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 " +
      "shadow-sm transition-colors hover:bg-slate-50 " +
      "dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-900/50",
    footerLink:
      "font-semibold text-[#0F766E] hover:text-[#115E59] hover:underline " +
      "dark:text-[#2DD4BF] dark:hover:text-[#5EEAD4]",
  };

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ bouton actif seulement si email + password saisis
  const isReady = email.trim().length > 0 && password.trim().length > 0;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isReady) return;

    setBusy(true);
    try {
      // UI only pour l’instant
      console.log("[login]", { email, password, remember });
    } catch (err: any) {
      setError(err?.message ?? "Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="px-4">
      <div className="mx-auto flex min-h-[85vh] max-w-6xl items-center justify-center py-10">
        <div className="w-full max-w-[420px]">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {copy.title}
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{copy.subtitle}</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            {/* Email */}
            <div>
              <label className={UI.label}>{copy.email}</label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={UI.input}
              />
            </div>

            {/* Password + forgot */}
            <div>
              <div className="flex items-center justify-between gap-3">
                <label className={UI.label}>{copy.password}</label>
                <Link href="/auth/password/forgot" className={UI.link}>
                  {copy.forgot}
                </Link>
              </div>

              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={UI.input}
              />
            </div>

            {/* Remember */}
            <label className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className={[
                  "h-4 w-4 rounded border-slate-300",
                  "accent-[#FF9900]",
                  "focus:ring-4 focus:ring-[#FF9900]/25 focus:ring-offset-2",
                  "focus:ring-offset-white dark:focus:ring-offset-slate-950",
                ].join(" ")}
              />
              <span>{copy.remember}</span>
            </label>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                {error}
              </div>
            )}

            {/* CTA */}
            <button type="submit" disabled={busy || !isReady} className={UI.btnPrimary}>
              {busy ? "…" : copy.cta}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-4 pt-1">
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              <span className="text-xs font-semibold text-slate-400">{copy.or}</span>
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            </div>

            {/* Social */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => console.log("google oauth (ui only)")}
                className={UI.btnSecondary}
              >
                <span className="inline-flex items-center justify-center gap-3">
                  <GoogleIcon />
                  {copy.google}
                </span>
              </button>

              <button
                type="button"
                onClick={() => console.log("facebook oauth (ui only)")}
                className={UI.btnSecondary}
              >
                <span className="inline-flex items-center justify-center gap-3">
                  <FacebookIcon />
                  {copy.facebook}
                </span>
              </button>
            </div>

            {/* Footer */}
            <div className="pt-5 text-center text-sm text-slate-600 dark:text-slate-400">
              {copy.foot}{" "}
              <Link href="/auth/register" className={UI.footerLink}>
                {copy.create}
              </Link>
            </div>
          </form>

          <p className="mt-6 text-xs text-slate-500 dark:text-slate-500">
            Vérifiez l’URL pour vous assurer de vous connecter au bon site.
          </p>
        </div>
      </div>
    </main>
  );
}

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

type Gender = "MALE" | "FEMALE" | "OTHER";

export default function RegisterForm() {
  const { lang } = useUiPreferences();

  const copy = useMemo(() => {
    const fr = lang === "fr";
    return {
      title: fr ? "Bienvenue sur Yamba" : "Welcome to Yamba",
      subtitle: fr
        ? "Créez votre compte pour publier et retrouver vos trajets."
        : "Create an account to share and manage your trips.",
      firstName: fr ? "Prénom" : "First name",
      lastName: fr ? "Nom" : "Last name",
      gender: fr ? "Genre" : "Gender",
      email: fr ? "E-mail" : "Email",
      password: fr ? "Mot de passe" : "Password",
      pwdHint: fr ? "8 caractères minimum." : "At least 8 characters.",
      cta: fr ? "Créer mon compte" : "Create account",
      or: fr ? "OU" : "OR",
      google: fr ? "Créer un compte avec Google" : "Continue with Google",
      facebook: fr ? "Créer un compte avec Facebook" : "Continue with Facebook",
      have: fr ? "Vous avez déjà un compte ?" : "Already have an account?",
      login: fr ? "Connexion" : "Log in",
      genderLabels: fr
        ? { MALE: "Homme", FEMALE: "Femme", OTHER: "Autre" }
        : { MALE: "Male", FEMALE: "Female", OTHER: "Other" },
    };
  }, [lang]);

  // ✅ EXACTEMENT le même “design system” que LoginForm (tailles + palette)
  const UI = {
    label: "text-sm font-semibold text-slate-800 dark:text-slate-100",
    input:
      "mt-2 w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none " +
      "focus:border-[#FF9900]/80 focus:ring-4 focus:ring-[#FF9900]/25 " +
      "dark:border-slate-800 dark:bg-slate-950 dark:text-white " +
      "dark:focus:border-[#FFAE33]/70 dark:focus:ring-[#FF9900]/18",
    select:
      "mt-2 w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none " +
      "focus:border-[#FF9900]/80 focus:ring-4 focus:ring-[#FF9900]/25 " +
      "dark:border-slate-800 dark:bg-slate-950 dark:text-white " +
      "dark:focus:border-[#FFAE33]/70 dark:focus:ring-[#FF9900]/18",
    btnPrimary:
      "w-full rounded-lg bg-[#FF9900] px-4 py-2.5 text-sm font-semibold text-slate-900 " +
      "shadow-sm transition-colors hover:bg-[#F08700] active:bg-[#E07A00] disabled:opacity-60 " +
      "focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF9900]/30 " +
      "dark:focus-visible:ring-[#FF9900]/18",
    btnSecondary:
      "w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 " +
      "shadow-sm transition-colors hover:bg-slate-50 " +
      "dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-900/50",
    link:
      "font-semibold text-[#0F766E] hover:text-[#115E59] hover:underline " +
      "dark:text-[#2DD4BF] dark:hover:text-[#5EEAD4]",
    help: "text-xs text-slate-500 dark:text-slate-500",
  };

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState<Gender>("OTHER");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      // UI only pour l’instant
      console.log("[register]", { firstName, lastName, email, password, gender });
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
            {/* First + Last name (same row) */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={UI.label}>{copy.firstName}</label>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={UI.input}
                  autoComplete="given-name"
                />
              </div>
              <div>
                <label className={UI.label}>{copy.lastName}</label>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={UI.input}
                  autoComplete="family-name"
                />
              </div>
            </div>

            {/* Gender */}
            <div>
              <label className={UI.label}>{copy.gender}</label>
              <select value={gender} onChange={(e) => setGender(e.target.value as Gender)} className={UI.select}>
                <option value="MALE">{copy.genderLabels.MALE}</option>
                <option value="FEMALE">{copy.genderLabels.FEMALE}</option>
                <option value="OTHER">{copy.genderLabels.OTHER}</option>
              </select>
            </div>

            {/* Email */}
            <div>
              <label className={UI.label}>{copy.email}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={UI.input}
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div>
              <label className={UI.label}>{copy.password}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={UI.input}
                autoComplete="new-password"
              />
              <p className={UI.help}>{copy.pwdHint}</p>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                {error}
              </div>
            )}

            {/* CTA */}
            <button type="submit" disabled={busy} className={UI.btnPrimary}>
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
            <div className="pt-3 text-center text-sm text-slate-600 dark:text-slate-400">
              {copy.have}{" "}
              <Link href="/auth/login" className={UI.link}>
                {copy.login}
              </Link>
            </div>
          </form>

          {/* même petit texte “sécurité” que LoginForm si tu veux garder la cohérence */}
          <p className="mt-6 text-xs text-slate-500 dark:text-slate-500">
            Vérifiez l’URL pour vous assurer de vous connecter au bon site.
          </p>
        </div>
      </div>
    </main>
  );
}

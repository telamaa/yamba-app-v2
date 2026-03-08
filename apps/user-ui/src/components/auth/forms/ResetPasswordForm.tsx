"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";

type Lang = "fr" | "en";

export default function ResetPasswordForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const { lang } = useUiPreferences();

  const copy = useMemo(() => {
    const fr = (lang as Lang) === "fr";
    return {
      title: fr ? "Nouveau mot de passe" : "Set a new password",
      subtitle: fr
        ? "Choisissez un mot de passe robuste pour sécuriser votre compte."
        : "Choose a strong password to secure your account.",
      newPwd: fr ? "Nouveau mot de passe" : "New password",
      confirmPwd: fr ? "Confirmer le mot de passe" : "Confirm password",
      hint: fr ? "8 caractères minimum." : "At least 8 characters.",
      cta: fr ? "Réinitialiser" : "Reset password",
      back: fr ? "Retour à la connexion" : "Back to login",
      mismatch: fr ? "Les mots de passe ne correspondent pas." : "Passwords do not match.",
      tooShort: fr ? "Le mot de passe doit faire au moins 8 caractères." : "Password must be at least 8 characters.",
      success: fr ? "Mot de passe mis à jour. Redirection…" : "Password updated. Redirecting…",
      missingToken: fr
        ? "Session expirée. Veuillez recommencer la procédure."
        : "Session expired. Please restart the process.",
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
    notice:
      "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 " +
      "dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200",
  };

  // token possible: ?token=... (plus tard via backend). Pour l’UI on accepte vide, mais on affiche warning.
  const token = sp.get("token") ?? (typeof window !== "undefined" ? sessionStorage.getItem("pwd_reset_token") ?? "" : "");

  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const minLenOk = newPassword.length >= 8;
  const matchOk = newPassword.length > 0 && newPassword === confirm;
  const isReady = minLenOk && matchOk;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!token) {
      // UI : on avertit, mais tu peux choisir de bloquer totalement
      setError(copy.missingToken);
      return;
    }

    if (!minLenOk) {
      setError(copy.tooShort);
      return;
    }
    if (!matchOk) {
      setError(copy.mismatch);
      return;
    }

    setBusy(true);
    try {
      // UI only pour l’instant
      console.log("[password/reset]", { passwordResetToken: token, newPassword });

      // Quand tu branches le back :
      // await authApi.resetPassword({ passwordResetToken: token, newPassword });

      setInfo(copy.success);
      // nettoyage token (optionnel)
      if (typeof window !== "undefined") sessionStorage.removeItem("pwd_reset_token");

      window.setTimeout(() => router.push("/auth/login"), 1200);
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

          <form onSubmit={submit} className="mt-8 space-y-5">
            <div>
              <label className={UI.label}>{copy.newPwd}</label>
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={UI.input}
              />
              <p className={UI.help}>{copy.hint}</p>
            </div>

            <div>
              <label className={UI.label}>{copy.confirmPwd}</label>
              <input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={UI.input}
              />
              {confirm.length > 0 && !matchOk && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-300">{copy.mismatch}</p>
              )}
            </div>

            {info && <div className={UI.notice}>{info}</div>}

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                {error}
              </div>
            )}

            <button type="submit" disabled={busy || !isReady} className={UI.btnPrimary}>
              {busy ? "…" : copy.cta}
            </button>

            <div className="pt-2 text-center text-sm text-slate-600 dark:text-slate-400">
              <Link href="/auth/login" className={UI.link}>
                {copy.back}
              </Link>
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

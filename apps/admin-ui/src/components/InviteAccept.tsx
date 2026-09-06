"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError, post } from "@/lib/api";

export default function InviteAccept() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) return setError("Les deux mots de passe diffèrent.");
    setBusy(true);
    setError(null);
    try {
      await post("/auth/admin/invite/accept", { token, password }, { auth: false });
      router.replace("/login");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de définir le mot de passe.");
    } finally {
      setBusy(false);
    }
  }

  if (!token) return <p className="text-[13px] text-red-700">Lien d'invitation incomplet.</p>;
  return (
    <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-lg font-bold">Définir mon mot de passe</h1>
      <p className="mt-1 text-[13px] text-slate-500">8 caractères au moins, sans ton nom ni ton email. La double authentification suivra à la première connexion.</p>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>}
      <input type="password" required autoComplete="new-password" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-[14px]" />
      <input type="password" required autoComplete="new-password" placeholder="Confirmer" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-[14px]" />
      <button disabled={busy} className="mt-4 w-full rounded-lg bg-slate-900 py-2.5 text-[14px] font-semibold text-white disabled:opacity-60">{busy ? "Enregistrement…" : "Enregistrer et me connecter"}</button>
    </form>
  );
}

"use client";

/**
 * SessionsList — « Mes sessions admin »
 * A188 (recette 02-ADMIN § 5.26) : chaque ligne nomme son appareil et son IP (ANO-ADM-81) ; une panne de lecture n'est pas
 * « Aucune session. » (ANO-ADM-84) ; « Révoquer » sa propre session ne renvoie à /login qu'une fois la session fermée
 * (ANO-ADM-82) ; une session déjà fermée (double clic, révoquée ailleurs) recharge la liste sans erreur (ANO-ADM-83).
 * A190 (recette § 6) : « Révoquer toutes mes autres sessions » en un geste ; régénérer ses codes de secours avec un code
 * TOTP — les nouveaux codes ne sont montrés qu'une fois.
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiFetch, del, post } from "@/lib/api";
import { dateTime } from "@/lib/format";
import type { AdminSessionItem } from "@/lib/types";

export default function SessionsList() {
  const router = useRouter();
  const [items, setItems] = useState<AdminSessionItem[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const load = useCallback(() => {
    setLoadError(false);
    apiFetch<{ items: AdminSessionItem[] }>("/admin/me/sessions")
      .then((r) => setItems(r.items))
      .catch(() => setLoadError(true));
  }, []);
  useEffect(load, [load]);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [totp, setTotp] = useState("");
  const [codesMsg, setCodesMsg] = useState<string | null>(null);

  async function revokeOthers() {
    if (pending) return;
    setPending("others");
    setMsg(null);
    try {
      const r = await del<{ revoked: number }>("/admin/me/sessions");
      setMsg(r.revoked === 0 ? "Aucune autre session n'était ouverte." : `${r.revoked} ${r.revoked === 1 ? "autre session fermée" : "autres sessions fermées"}. Cette session reste ouverte.`);
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) setMsg("Révocation impossible : le service ne répond pas. Réessaie dans un instant.");
    } finally {
      setPending(null);
    }
    load();
  }

  async function regenerate() {
    if (pending) return;
    setPending("codes");
    setCodesMsg(null);
    try {
      const r = await post<{ backupCodes: string[] }>("/admin/me/backup-codes", { code: totp.replace(/\s+/g, "") });
      setCodes(r.backupCodes);
      setTotp("");
    } catch (e) {
      const code = e instanceof ApiError ? (e.data as { details?: { code?: string } } | undefined)?.details?.code : undefined;
      setCodesMsg(code === "OTP_INCORRECT" ? "Code incorrect : saisis le code à six chiffres affiché par ton application d'authentification." : code === "TOO_MANY_ATTEMPTS" ? "Trop d'essais : réessaie dans 15 minutes." : "Régénération impossible : le service ne répond pas. Réessaie dans un instant.");
    } finally {
      setPending(null);
    }
  }

  async function revoke(s: AdminSessionItem) {
    if (pending) return; // double clic : un seul envoi
    setPending(s.jti);
    setMsg(null);
    try {
      await del(`/admin/me/sessions/${s.jti}`);
      if (s.current) return router.replace("/login");
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 0;
      if (s.current && status === 401) return router.replace("/login"); // déjà fermée
      if (status === 404) setMsg("Cette session était déjà fermée.");
      else if (status !== 401) setMsg(s.current ? "Révocation impossible : le service ne répond pas, ta session est toujours ouverte. Réessaie dans un instant." : "Révocation impossible : le service ne répond pas. Réessaie dans un instant.");
    } finally {
      setPending(null);
    }
    load();
  }

  if (loadError) {
    return (
      <div role="alert" className="mt-4 max-w-2xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
        Impossible de lire tes sessions pour le moment.
        <button type="button" onClick={load} className="ml-3 rounded-lg border border-red-300 bg-white px-2.5 py-1 text-[12px] font-medium">Réessayer</button>
      </div>
    );
  }
  if (!items) return <p className="mt-4 text-[13px] text-slate-500">Chargement…</p>;

  return (
    <>
      {msg && <p role="alert" className="mt-4 max-w-2xl rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">{msg}</p>}
      {items.some((s) => !s.current) && (
        <button type="button" onClick={revokeOthers} disabled={pending !== null} className="mt-4 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-[12.5px] font-medium text-red-700 disabled:opacity-60">
          Révoquer toutes mes autres sessions
        </button>
      )}
      <ul className="mt-4 max-w-2xl space-y-2">
        {items.map((s) => (
          <li key={s.jti} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px]">
            <span className="min-w-0">
              {s.current && <span className="mr-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">cette session</span>}
              <span className="font-semibold">{s.device}</span>
              {s.ip && <span className="text-slate-500"> · IP {s.ip}</span>}
              <span className="block text-[12px] text-slate-500">ouverte le {dateTime(s.createdAt)} · active le {dateTime(s.lastActivityAt)}</span>
            </span>
            <button onClick={() => revoke(s)} disabled={pending !== null} className="shrink-0 text-[12px] text-red-700 hover:underline disabled:opacity-60">Révoquer</button>
          </li>
        ))}
        {items.length === 0 && <li className="text-[13px] text-slate-500">Aucune session.</li>}
      </ul>
      <section className="mt-8 max-w-2xl rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-[13px] font-semibold">Codes de secours</h2>
        {codes ? (
          <>
            <p className="mt-1 text-[12.5px] text-slate-700">Nouveaux codes, montrés une seule fois — les anciens ne fonctionnent plus :</p>
            <ul className="mt-2 grid grid-cols-2 gap-1 font-mono text-[13px]">{codes.map((c) => <li key={c}>{c}</li>)}</ul>
            <button type="button" onClick={() => setCodes(null)} className="mt-3 text-[12px] underline">Je les ai notés</button>
          </>
        ) : (
          <>
            <p className="mt-1 text-[12.5px] text-slate-500">Régénérer invalide tous tes anciens codes. Saisis un code de ton application d&apos;authentification (pas un code de secours).</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input value={totp} onChange={(e) => setTotp(e.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder="Code à 6 chiffres" aria-label="Code de l'application d'authentification" className="w-40 rounded-lg border border-slate-300 px-2 py-1.5 text-[13px]" />
              <button type="button" onClick={regenerate} disabled={pending !== null || !/^\d{6}$/.test(totp.replace(/\s+/g, ""))} className="rounded-lg bg-slate-900 px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50">
                Régénérer mes codes de secours
              </button>
            </div>
            {codesMsg && <p role="alert" className="mt-2 text-[12.5px] text-red-700">{codesMsg}</p>}
          </>
        )}
      </section>
    </>
  );
}

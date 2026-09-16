"use client";

/**
 * SessionsList — « Mes sessions admin »
 * A188 (recette 02-ADMIN § 5.26) : chaque ligne nomme son appareil et son IP (ANO-ADM-81) ; une panne de lecture n'est pas
 * « Aucune session. » (ANO-ADM-84) ; « Révoquer » sa propre session ne renvoie à /login qu'une fois la session fermée
 * (ANO-ADM-82) ; une session déjà fermée (double clic, révoquée ailleurs) recharge la liste sans erreur (ANO-ADM-83).
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiFetch, del } from "@/lib/api";
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
    </>
  );
}

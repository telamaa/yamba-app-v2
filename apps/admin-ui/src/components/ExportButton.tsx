"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/api";
import { can } from "@/lib/permissions";
import type { AdminMe } from "@/lib/types";

const REASON_MIN = 20;

/**
 * Bouton d'export CSV (C-PR7a, D60 2A). Téléchargement direct (le cookie admin suit par /api) ; l'export est journalisé côté serveur.
 * `personal` = données nominatives : SUPER_ADMIN seul, motif obligatoire (≥ 20) envoyé au journal.
 */
export default function ExportButton({ me, path, params, personal, label = "Exporter en CSV" }: { me: AdminMe | null; path: string; params: URLSearchParams; personal?: boolean; label?: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const allowed = personal ? can(me?.adminRoles, "exports.personal") : can(me?.adminRoles, "exports.operational");
  if (!allowed) return null;
  function go(extraReason?: string) {
    const p = new URLSearchParams(params);
    p.delete("cursor"); p.delete("limit");
    if (extraReason) p.set("reason", extraReason);
    window.open(apiUrl(`${path}?${p.toString()}`), "_blank", "noopener");
    setOpen(false); setReason("");
  }
  if (!personal) return <button onClick={() => go()} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px]">{label}</button>;
  return (
    <span className="relative inline-block">
      <button onClick={() => setOpen((o) => !o)} className="rounded-lg border border-red-300 px-3 py-1.5 text-[12.5px] text-red-800">{label} (données personnelles)</button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-80 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <p className="text-[12px] text-slate-600">Export nominatif : le motif est écrit au journal avec les filtres et le nombre de lignes (RGPD).</p>
          <textarea value={reason} onChange={(e) => setReason(e.target.value.slice(0, 500))} rows={2} placeholder={`Motif (${REASON_MIN} caractères au moins)`} className="mt-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-[12.5px]" />
          <div className="mt-2 flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 px-3 py-1 text-[12px]">Annuler</button>
            <button disabled={reason.trim().length < REASON_MIN} onClick={() => go(reason.trim())} className="rounded-lg bg-red-700 px-3 py-1 text-[12px] font-semibold text-white disabled:opacity-50">Télécharger</button>
          </div>
        </div>
      )}
    </span>
  );
}

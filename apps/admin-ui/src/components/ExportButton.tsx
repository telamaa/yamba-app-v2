"use client";

import { useState } from "react";
import { ApiError, downloadFile } from "@/lib/api";
import { can } from "@/lib/permissions";
import type { AdminMe } from "@/lib/types";

const REASON_MIN = 20;
const EXPORT_MAX_ROWS = 5000;

/** Les refus de l'export, lus par leur code (A146) — jamais le message anglais de l'API. */
function refusDeLExport(e: unknown): string {
  if (!(e instanceof ApiError)) return "Téléchargement impossible : le service ne répond pas.";
  const code = (e.data as { details?: { code?: string } } | undefined)?.details?.code;
  if (code === "REASON_TOO_SHORT") return `Motif trop court : ${REASON_MIN} caractères au moins, il est écrit au journal.`;
  if (code === "ADMIN_PERMISSION_DENIED" || e.status === 403) return "Ton profil ne permet pas cet export.";
  if (code === "INVALID_QUERY") return "Les filtres de la liste sont invalides : corrige-les puis relance l'export.";
  if (e.status === 401) return "Session expirée : reconnecte-toi.";
  return `Export impossible (${e.status}).`;
}

/**
 * Bouton d'export CSV (C-PR7a, D60 2A). L'export est journalisé côté serveur.
 * `personal` = données nominatives : SUPER_ADMIN ou PRIVACY (A143), motif obligatoire (≥ 20) envoyé au journal.
 *
 * Recette 02-ADMIN § 5.6 : téléchargement par `fetch` (session rafraîchie, refus lisibles — ANO-ADM-13), nombre de
 * lignes et troncature annoncés après coup, compteur de caractères du motif.
 */
export default function ExportButton({ me, path, params, personal, label = "Exporter en CSV" }: { me: AdminMe | null; path: string; params: URLSearchParams; personal?: boolean; label?: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "warn" | "err"; text: string } | null>(null);
  const allowed = personal ? can(me?.adminRoles, "exports.personal") : can(me?.adminRoles, "exports.operational");
  if (!allowed) return null;

  async function go(extraReason?: string) {
    const p = new URLSearchParams(params);
    p.delete("cursor"); p.delete("limit");
    if (extraReason) p.set("reason", extraReason);
    setBusy(true);
    setMsg(null);
    try {
      const out = await downloadFile(`${path}?${p.toString()}`);
      const n = out.rows ?? 0;
      setMsg(out.truncated
        ? { tone: "warn", text: `Export tronqué à ${EXPORT_MAX_ROWS.toLocaleString("fr-FR")} lignes : affine les filtres pour tout obtenir (${out.filename}).` }
        : { tone: "ok", text: `${n.toLocaleString("fr-FR")} ligne${n > 1 ? "s" : ""} exportée${n > 1 ? "s" : ""} — ${out.filename}, journalisé.` });
      setOpen(false);
      setReason("");
    } catch (e) {
      setMsg({ tone: "err", text: refusDeLExport(e) });
    } finally {
      setBusy(false);
    }
  }

  const note = msg && (
    <span role="status" className={`ml-2 text-[11.5px] ${msg.tone === "ok" ? "text-emerald-700" : msg.tone === "warn" ? "text-amber-800" : "text-red-700"}`}>{msg.text}</span>
  );

  if (!personal) {
    return (
      <span className="inline-flex flex-wrap items-center">
        <button onClick={() => go()} disabled={busy} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px] disabled:opacity-50">{busy ? "Export…" : label}</button>
        {note}
      </span>
    );
  }
  const longueur = reason.trim().length;
  return (
    <span className="relative inline-flex flex-wrap items-center">
      <button onClick={() => { setOpen((o) => !o); setMsg(null); }} className="rounded-lg border border-red-300 px-3 py-1.5 text-[12.5px] text-red-800">{label} (données personnelles)</button>
      {note}
      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 w-80 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <p className="text-[12px] text-slate-600">Export nominatif : le motif est écrit au journal avec les filtres et le nombre de lignes (RGPD).</p>
          <p className="mt-1 text-[11.5px] text-slate-500">Les filtres de la liste s&apos;appliquent au fichier.</p>
          <textarea value={reason} onChange={(e) => setReason(e.target.value.slice(0, 500))} rows={2} placeholder={`Motif (${REASON_MIN} caractères au moins)`} aria-label="Motif de l'export" className="mt-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-[12.5px]" />
          <p className={`text-right text-[11px] ${longueur < REASON_MIN ? "text-slate-400" : "text-emerald-700"}`}>{longueur} / {REASON_MIN}</p>
          <div className="mt-1 flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 px-3 py-1 text-[12px]">Annuler</button>
            <button disabled={busy || longueur < REASON_MIN} onClick={() => go(reason.trim())} className="rounded-lg bg-red-700 px-3 py-1 text-[12px] font-semibold text-white disabled:opacity-50">{busy ? "Export…" : "Télécharger"}</button>
          </div>
        </div>
      )}
    </span>
  );
}

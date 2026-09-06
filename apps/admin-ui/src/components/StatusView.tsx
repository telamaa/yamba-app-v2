"use client";

/**
 * StatusView.tsx — la page « État des services » (C-PR8c, D64 5A) + l'interrupteur de maintenance (1A)
 * =====================================================================================================
 * Sondage 30 s. Services (santé, dépendances, version), crons (dernier battement, âge, résultat),
 * outbox (non publié, plus ancien, parqué), emails 24 h, maintenance (planifier, activer, lever —
 * OPS ou super administrateur, motif au journal, email aux super administrateurs).
 */
import { useCallback, useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import { can } from "@/lib/permissions";
import { dateTime } from "@/lib/format";
import type { AdminMe, AdminStatusResponse, CronRun, MaintenanceState } from "@/lib/types";

const POLL_MS = 30_000;
const REASON_MIN = 20;

function ago(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 90) return `il y a ${s} s`;
  if (s < 5400) return `il y a ${Math.round(s / 60)} min`;
  if (s < 172800) return `il y a ${Math.round(s / 3600)} h`;
  return `il y a ${Math.round(s / 86400)} j`;
}
/** Un cron est « en retard » si son dernier battement a plus de deux fois son intervalle attendu (approx. par la fréquence lue dans l'expression cron). */
function cronLate(c: CronRun): boolean {
  const ageMs = Date.now() - new Date(c.ranAt).getTime();
  const s = c.schedule ?? "";
  const expected = /^\*\/(\d+) /.test(s) ? Number(/^\*\/(\d+) /.exec(s)![1]) * 60_000 : /^\d+ \* /.test(s) ? 3_600_000 : 86_400_000;
  return ageMs > 2 * expected;
}

export default function StatusView() {
  const [data, setData] = useState<AdminStatusResponse | null>(null);
  const [me, setMe] = useState<AdminMe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    apiFetch<AdminStatusResponse>("/admin/status").then((d) => { setData(d); setError(null); }).catch((e) => setError(e instanceof ApiError ? `${e.status} : ${e.message}` : "Chargement impossible."));
  }, []);
  useEffect(() => {
    load();
    apiFetch<AdminMe>("/admin/me").then(setMe).catch(() => undefined);
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  if (error && !data) return <p className="mt-4 text-[13px] text-red-700">{error}</p>;
  if (!data) return <p className="mt-4 text-[13px] text-slate-500">Chargement…</p>;
  const down = data.services.filter((s) => !s.reachable || s.report?.status !== "ok");
  return (
    <div className="mt-4 space-y-6">
      <p className={`rounded-xl border px-3 py-2 text-[12.5px] ${down.length === 0 ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-900"}`}>
        {down.length === 0 ? "Tous les services répondent et leurs dépendances sont saines." : `${down.length} service(s) en difficulté : ${down.map((s) => s.name).join(", ")}.`} Relu {ago(data.at)}.{error ? ` Dernière tentative en échec : ${error}` : ""}
      </p>

      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Services</h2>
        <div className="mt-2 grid gap-3 md:grid-cols-3">
          {data.services.map((s) => (
            <div key={s.name} className={`rounded-xl border p-3 text-[12.5px] ${!s.reachable ? "border-red-300 bg-red-50" : s.report?.status === "ok" ? "border-emerald-200 bg-white" : "border-amber-300 bg-amber-50"}`}>
              <div className="flex items-baseline justify-between"><b>{s.name}</b><span className="text-[11px] text-slate-500">{s.ms} ms</span></div>
              {!s.reachable ? (
                <p className="mt-1 text-red-800">Injoignable — {s.error ?? "aucune réponse"}</p>
              ) : (
                <>
                  <p className="mt-1 text-slate-600">{s.report?.status === "ok" ? "OK" : "Dégradé"} · version {s.report?.version ?? "?"} · démarré {s.report ? `il y a ${Math.round(s.report.uptimeSeconds / 60)} min` : "?"}</p>
                  <ul className="mt-1 space-y-0.5">
                    {Object.entries(s.report?.checks ?? {}).map(([k, c]) => (
                      <li key={k} className={c.ok ? "text-slate-600" : "text-red-800"}>{c.ok ? "✓" : "✗"} {k} ({c.ms} ms){c.error ? ` — ${c.error}` : ""}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-[12.5px]">
          <b>Outbox</b>
          <p className="mt-1 text-slate-600">{data.outbox.unpublished} événement(s) non publié(s){data.outbox.oldestUnpublishedAt ? `, le plus ancien ${ago(data.outbox.oldestUnpublishedAt)}` : ""}.</p>
          <p className={data.outbox.parked > 0 ? "text-red-800" : "text-slate-600"}>{data.outbox.parked} parqué(s) (≥ {data.outbox.parkedThreshold} tentatives).</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-[12.5px]">
          <b>Emails (24 h)</b>
          <p className="mt-1 text-slate-600">{data.emails.sentLast24h} envoyé(s)</p>
          <p className={data.emails.failedLast24h > 0 ? "text-red-800" : "text-slate-600"}>{data.emails.failedLast24h} en échec</p>
        </div>
      </section>

      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Crons — dernier battement</h2>
        {data.crons.length === 0 ? (
          <p className="mt-2 text-[12.5px] text-slate-500">Aucun battement enregistré : les crons n&apos;ont pas encore tourné depuis le déploiement (ou Redis est vide).</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-[12.5px]">
              <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">Service</th><th className="px-3 py-2">Cron</th><th className="px-3 py-2">Dernier passage</th><th className="px-3 py-2">Durée</th><th className="px-3 py-2">Résultat</th></tr></thead>
              <tbody>
                {data.crons.map((c) => (
                  <tr key={`${c.service}:${c.name}`} className={`border-t border-slate-100 ${!c.ok ? "bg-red-50" : cronLate(c) ? "bg-amber-50" : ""}`}>
                    <td className="px-3 py-2">{c.service}</td>
                    <td className="px-3 py-2"><code>{c.name}</code>{c.schedule ? <span className="ml-1 text-[11px] text-slate-400">{c.schedule}</span> : null}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{dateTime(c.ranAt)} <span className="text-slate-500">({ago(c.ranAt)})</span>{cronLate(c) && c.ok ? <span className="ml-1 text-amber-800">en retard ?</span> : null}</td>
                    <td className="px-3 py-2">{c.durationMs} ms</td>
                    <td className={`px-3 py-2 ${c.ok ? "text-slate-600" : "text-red-800"}`}>{c.ok ? c.summary ?? "ok" : `échec — ${c.error}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <MaintenanceEditor state={data.maintenance} canWrite={can(me?.adminRoles, "maintenance.write")} onDone={load} />
    </div>
  );
}

function MaintenanceEditor({ state, canWrite, onDone }: { state: MaintenanceState; canWrite: boolean; onDone: () => void }) {
  const [enabled, setEnabled] = useState(state.enabled);
  const [messageFr, setMessageFr] = useState(state.messageFr);
  const [messageEn, setMessageEn] = useState(state.messageEn);
  const [scheduledAt, setScheduledAt] = useState(state.scheduledAt ? state.scheduledAt.slice(0, 16) : "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { setEnabled(state.enabled); setMessageFr(state.messageFr); setMessageEn(state.messageEn); setScheduledAt(state.scheduledAt ? state.scheduledAt.slice(0, 16) : ""); }, [state]);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await apiFetch<MaintenanceState>("/admin/maintenance", { method: "PUT", body: JSON.stringify({ enabled, messageFr: messageFr.trim(), messageEn: messageEn.trim(), scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null, reason: reason.trim(), expectedVersion: state.version }) });
      setMsg("Enregistré : journal écrit, super administrateurs prévenus, le gateway applique dans les 10 s.");
      setReason("");
      onDone();
    } catch (e) {
      setMsg(e instanceof ApiError ? (e.status === 409 ? "L'état a changé entre-temps : la page est rechargée." : `${e.status} : ${e.message}`) : "Enregistrement impossible.");
      if (e instanceof ApiError && e.status === 409) onDone();
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={`rounded-xl border p-4 ${state.enabled ? "border-red-300 bg-red-50" : "border-slate-200 bg-white"}`}>
      <h2 className="text-[13.5px] font-bold">Maintenance {state.envOverride ? <span className="ml-2 rounded-full bg-red-700 px-2 py-0.5 text-[10px] text-white">forcée par l&apos;environnement du gateway</span> : null}</h2>
      <p className="mt-1 text-[12.5px] text-slate-600">
        {state.enabled ? "Plateforme en lecture seule : les membres lisent, aucune écriture ne passe (sauf connexion et back-office)." : state.scheduledAt ? `Maintenance annoncée le ${dateTime(state.scheduledAt)} : le bandeau est affiché, rien n'est bloqué.` : "Aucune maintenance en cours ni annoncée."}
        {state.updatedAt ? ` Dernière modification le ${dateTime(state.updatedAt)} par ${state.updatedBy ?? "?"} (version ${state.version}).` : ""}
      </p>
      {canWrite ? (
        <div className="mt-3 space-y-2 text-[12.5px]">
          <label className="flex items-center gap-2"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> <b>Activer la lecture seule maintenant</b></label>
          <label className="block">Annoncer pour le (optionnel) <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="ml-2 rounded border border-slate-300 px-2 py-1" /></label>
          <label className="block">Message FR <input value={messageFr} onChange={(e) => setMessageFr(e.target.value.slice(0, 300))} placeholder="Maintenance ce soir de 23 h à 23 h 30 : la plateforme sera en lecture seule." className="mt-1 w-full rounded border border-slate-300 px-2 py-1" /></label>
          <label className="block">Message EN <input value={messageEn} onChange={(e) => setMessageEn(e.target.value.slice(0, 300))} placeholder="Maintenance tonight from 11 pm to 11:30 pm: the platform will be read-only." className="mt-1 w-full rounded border border-slate-300 px-2 py-1" /></label>
          <label className="block">Motif (au journal, {REASON_MIN} caractères au moins) <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="mt-1 w-full rounded border border-slate-300 px-2 py-1" /></label>
          <button type="button" disabled={busy || reason.trim().length < REASON_MIN} onClick={save} className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-40 ${enabled ? "bg-red-700" : "bg-slate-900"}`}>{enabled ? "Passer en lecture seule" : state.enabled ? "Lever la maintenance" : "Enregistrer l'annonce"}</button>
          {msg && <p className="text-[12px] text-slate-700">{msg}</p>}
        </div>
      ) : (
        <p className="mt-2 text-[12px] text-slate-500">Profil Exploitation ou super administrateur pour modifier.</p>
      )}
    </section>
  );
}

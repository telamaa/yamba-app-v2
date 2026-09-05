"use client";

/**
 * PlatformSettingsEditor.tsx — la page « Paramètres » (C-PR8a, D62)
 * ==================================================================
 * Groupes du catalogue, une ligne par clé : valeur en vigueur, défaut, badge « modifiée »,
 * info-bulle (le texte du catalogue), aperçu chiffré, remise par défaut d'une clé.
 * Les modifications s'accumulent dans un panneau « à valider » (diff avant/après, motif ≥ 20,
 * version lue → 409 si elle a bougé). « Tout réinitialiser » montre son diff avant de partir.
 * L'écriture est bornée par portée : métier = super admin, exploitation = Exploitation.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch, patch, post } from "@/lib/api";
import { can } from "@/lib/permissions";
import { dateTime } from "@/lib/format";
import { SETTING_GROUP_LABEL, SETTING_GROUP_ORDER, formatSetting, inputBounds, inputStep, previewOf, toInput, toStored } from "@/lib/settings-format";
import type { AdminMe, AdminSettingsResponse, SettingDefinition, SettingsHistoryItem, SettingsWriteResponse } from "@/lib/types";

const REASON_MIN = 20;

export default function PlatformSettingsEditor() {
  const [data, setData] = useState<AdminSettingsResponse | null>(null);
  const [me, setMe] = useState<AdminMe | null>(null);
  const [pending, setPending] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [openInfo, setOpenInfo] = useState<string | null>(null);
  const [history, setHistory] = useState<{ key: string; items: SettingsHistoryItem[] } | null>(null);

  const load = useCallback(() => {
    apiFetch<AdminSettingsResponse>("/admin/settings").then(setData).catch((e) => setMsg({ tone: "err", text: e.message }));
    apiFetch<AdminMe>("/admin/me").then(setMe).catch(() => undefined);
  }, []);
  useEffect(load, [load]);

  const canWrite = useCallback(
    (def: SettingDefinition) => (me ? can(me.adminRoles, def.scope === "BUSINESS" ? "settings.business.write" : "settings.operations.write") : false),
    [me]
  );

  const groups = useMemo(() => {
    if (!data) return [];
    return SETTING_GROUP_ORDER.map((g) => ({ group: g, defs: data.catalog.filter((d) => d.group === g) })).filter((x) => x.defs.length > 0);
  }, [data]);

  const diff = useMemo(() => {
    if (!data) return [];
    return Object.entries(pending)
      .map(([key, after]) => ({ def: data.catalog.find((d) => d.key === key)!, before: data.values[key], after }))
      .filter((x) => x.def && x.before !== x.after);
  }, [pending, data]);

  const resetDiff = useMemo(() => {
    if (!data) return [];
    return data.catalog.filter((d) => data.values[d.key] !== data.defaults[d.key] && canWrite(d)).map((def) => ({ def, before: data.values[def.key], after: data.defaults[def.key] }));
  }, [data, canWrite]);

  function setValue(def: SettingDefinition, raw: string) {
    const n = Number(raw.replace(",", "."));
    if (!Number.isFinite(n)) return;
    setPending((p) => ({ ...p, [def.key]: toStored(def, n) }));
  }
  function clearPending(key: string) {
    setPending((p) => {
      const { [key]: _omit, ...rest } = p;
      return rest;
    });
  }

  async function submit() {
    if (!data || diff.length === 0) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await patch<SettingsWriteResponse>("/admin/settings", { changes: Object.fromEntries(diff.map((d) => [d.def.key, d.after])), reason: reason.trim(), expectedVersion: data.version });
      setMsg({ tone: "ok", text: `${r.changed.length} paramètre(s) modifié(s) — version ${r.version}, journalisé, super administrateurs prévenus.` });
      setPending({});
      setReason("");
      load();
    } catch (e) {
      setMsg({ tone: "err", text: e instanceof ApiError ? (e.status === 409 ? "Les paramètres ont changé entre-temps : la page est rechargée, refais ta modification." : `${e.status} : ${e.message}${detailsOf(e)}`) : "Enregistrement impossible." });
      if (e instanceof ApiError && e.status === 409) { setPending({}); load(); }
    } finally {
      setBusy(false);
    }
  }

  async function resetAll() {
    if (!data || resetDiff.length === 0) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await post<SettingsWriteResponse>("/admin/settings/reset", { keys: resetDiff.map((d) => d.def.key), reason: reason.trim(), expectedVersion: data.version });
      setMsg({ tone: "ok", text: `${r.changed.length} paramètre(s) remis par défaut — version ${r.version}, journalisé.` });
      setPending({});
      setReason("");
      setResetOpen(false);
      load();
    } catch (e) {
      setMsg({ tone: "err", text: e instanceof ApiError ? `${e.status} : ${e.message}${detailsOf(e)}` : "Réinitialisation impossible." });
    } finally {
      setBusy(false);
    }
  }

  async function showHistory(key: string) {
    if (history?.key === key) return setHistory(null);
    try {
      const r = await apiFetch<{ items: SettingsHistoryItem[] }>(`/admin/settings/history?key=${encodeURIComponent(key)}`);
      setHistory({ key, items: r.items });
    } catch (e) {
      setMsg({ tone: "err", text: e instanceof ApiError ? `${e.status} : ${e.message}` : "Historique indisponible." });
    }
  }

  if (!data) return <p className="mt-4 text-[13px] text-slate-500">{msg ? msg.text : "Chargement…"}</p>;
  const reasonOk = reason.trim().length >= REASON_MIN;
  const modifiedCount = data.catalog.filter((d) => data.values[d.key] !== data.defaults[d.key]).length;

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-3 text-[12.5px] text-slate-600">
        <span>Version <b>{data.version}</b></span>
        {data.updatedAt && <span>· dernière écriture le {dateTime(data.updatedAt)}{data.updatedBy ? ` par ${data.updatedBy.firstName} ${data.updatedBy.lastName.charAt(0)}.` : ""}</span>}
        <span>· {modifiedCount === 0 ? "toutes les valeurs sont celles par défaut" : `${modifiedCount} valeur(s) modifiée(s) par rapport au défaut`}</span>
        {resetDiff.length > 0 && (
          <button type="button" onClick={() => setResetOpen((o) => !o)} className="ml-auto rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[12.5px] font-medium hover:bg-slate-50">
            Tout réinitialiser ({resetDiff.length})
          </button>
        )}
      </div>
      {msg && <p className={`mt-3 rounded-lg px-3 py-2 text-[12.5px] ${msg.tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{msg.text}</p>}

      {resetOpen && (
        <section className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <h2 className="text-[13.5px] font-bold text-amber-900">Tout remettre par défaut — voici exactement ce qui va changer</h2>
          <ul className="mt-2 space-y-1 text-[12.5px] text-amber-900">
            {resetDiff.map((d) => (
              <li key={d.def.key}><b>{d.def.label}</b> : {formatSetting(d.def, d.before)} → {formatSetting(d.def, d.after)} <span className="text-amber-700">(défaut, {d.def.rule})</span></li>
            ))}
          </ul>
          <ReasonField reason={reason} setReason={setReason} />
          <div className="mt-2 flex gap-2">
            <button type="button" disabled={busy || !reasonOk} onClick={resetAll} className="rounded-lg bg-amber-700 px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-40">Confirmer la réinitialisation</button>
            <button type="button" onClick={() => setResetOpen(false)} className="rounded-lg border border-amber-300 px-3 py-1.5 text-[12.5px]">Annuler</button>
          </div>
        </section>
      )}

      {groups.map(({ group, defs }) => (
        <section key={group} className="mt-6">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{SETTING_GROUP_LABEL[group]}</h2>
          <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-[12.5px]">
              <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <tr><th className="px-3 py-2">Paramètre</th><th className="px-3 py-2">En vigueur</th><th className="px-3 py-2">Nouvelle valeur</th><th className="px-3 py-2">Défaut</th><th className="px-3 py-2">Portée</th><th className="px-3 py-2"></th></tr>
              </thead>
              <tbody>
                {defs.map((def) => {
                  const current = data.values[def.key];
                  const isDefault = current === data.defaults[def.key];
                  const editable = canWrite(def);
                  const pendingValue = pending[def.key];
                  const shown = pendingValue ?? current;
                  const { min, max } = inputBounds(def);
                  const preview = previewOf(def.key, { ...data.values, ...pending });
                  return (
                    <>
                      <tr key={def.key} className={`border-t border-slate-100 align-top ${pendingValue !== undefined && pendingValue !== current ? "bg-amber-50/60" : ""}`}>
                        <td className="px-3 py-2">
                          <div className="flex items-start gap-1.5">
                            <div>
                              <button type="button" onClick={() => setOpenInfo(openInfo === def.key ? null : def.key)} title={def.description} className="text-left font-semibold text-slate-900 hover:underline">{def.label}</button>
                              <div className="text-[11px] text-slate-500">{def.rule}{def.contractual ? " · figure dans les CGU" : ""}</div>
                            </div>
                          </div>
                          {openInfo === def.key && (
                            <div className="mt-1 rounded-lg bg-slate-50 p-2 text-[12px] text-slate-700">
                              {def.description}
                              {def.example && <div className="mt-1 text-slate-500">Exemple : {def.example}</div>}
                              <div className="mt-1 text-slate-500">Bornes : {formatSetting(def, def.min)} à {formatSetting(def, def.max)} · lu par {def.consumers.join(", ")}.</div>
                              {def.contractual && <div className="mt-1 font-medium text-amber-800">Cette valeur figure dans les CGU : mettre le texte à jour après modification.</div>}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="font-semibold tabular-nums">{formatSetting(def, current)}</span>
                          {!isDefault && <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">modifiée</span>}
                        </td>
                        <td className="px-3 py-2">
                          {editable ? (
                            <div className="flex items-center gap-1">
                              <input type="number" min={min} max={max} step={inputStep(def)} value={toInput(def, shown)} onChange={(e) => setValue(def, e.target.value)} className="w-28 rounded-lg border border-slate-300 px-2 py-1 tabular-nums" aria-label={def.label} />
                              <span className="text-[11px] text-slate-500">{def.unit === "cents" ? "€" : def.unit === "percent" ? "%" : def.unit}</span>
                              {pendingValue !== undefined && pendingValue !== current && <button type="button" onClick={() => clearPending(def.key)} className="text-[11px] text-slate-500 underline">annuler</button>}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">{def.scope === "BUSINESS" ? "super administrateur seul" : "Exploitation ou super administrateur"}</span>
                          )}
                          {preview && pendingValue !== undefined && pendingValue !== current && <div className="mt-1 text-[11px] text-slate-600">{preview}</div>}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-slate-500 tabular-nums">
                          {formatSetting(def, data.defaults[def.key])}
                          {!isDefault && editable && <button type="button" onClick={() => setPending((p) => ({ ...p, [def.key]: data.defaults[def.key] }))} className="ml-2 text-[11px] underline">remettre</button>}
                        </td>
                        <td className="px-3 py-2 text-[11px] text-slate-500">{def.scope === "BUSINESS" ? "métier" : "exploitation"}</td>
                        <td className="px-3 py-2"><button type="button" onClick={() => showHistory(def.key)} className="text-[11px] text-slate-500 underline">historique</button></td>
                      </tr>
                      {history?.key === def.key && (
                        <tr key={`${def.key}-h`} className="bg-slate-50">
                          <td colSpan={6} className="px-3 py-2 text-[12px] text-slate-700">
                            {history.items.length === 0 ? "Jamais modifié." : (
                              <ul className="space-y-0.5">
                                {history.items.map((h) => (
                                  <li key={h.id}>{dateTime(h.at)} · {h.admin} · {h.action === "SETTINGS_RESET" ? "remis par défaut" : "modifié"} : {h.before !== null ? formatSetting(def, h.before) : "—"} → {h.after !== null ? formatSetting(def, h.after) : "—"}{h.reason ? ` · « ${h.reason} »` : ""}</li>
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <section className="mt-6">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Modifiables par déploiement seulement</h2>
        <p className="mt-1 text-[12px] text-slate-500">Invariants de sécurité : visibles ici pour la vue d&apos;ensemble, jamais depuis une page web.</p>
        <ul className="mt-2 grid gap-1 text-[12.5px] md:grid-cols-2">
          {data.fixed.map((f) => <li key={f.key} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5"><b>{f.label}</b> : {f.value} <span className="text-[11px] text-slate-500">({f.rule})</span></li>)}
        </ul>
      </section>

      {diff.length > 0 && (
        <section className="sticky bottom-3 mt-6 rounded-xl border border-slate-900 bg-white p-4 shadow-lg">
          <h2 className="text-[13.5px] font-bold">À valider — {diff.length} modification(s)</h2>
          <ul className="mt-2 space-y-1 text-[12.5px]">
            {diff.map((d) => (
              <li key={d.def.key}><b>{d.def.label}</b> : {formatSetting(d.def, d.before)} → <b>{formatSetting(d.def, d.after)}</b>{d.def.contractual ? <span className="ml-2 text-amber-800">figure dans les CGU</span> : null}</li>
            ))}
          </ul>
          <ReasonField reason={reason} setReason={setReason} />
          <div className="mt-2 flex items-center gap-2">
            <button type="button" disabled={busy || !reasonOk} onClick={submit} className="rounded-lg bg-slate-900 px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-40">Enregistrer (journalisé, email aux super administrateurs)</button>
            <button type="button" onClick={() => setPending({})} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px]">Tout annuler</button>
            <span className="text-[11px] text-slate-500">Effet dans les 30 s sur tous les services · jamais sur les réservations existantes.</span>
          </div>
        </section>
      )}
    </div>
  );
}

function detailsOf(e: ApiError): string {
  const d = e.data as { details?: { errors?: Record<string, string> } } | undefined;
  const errors = d?.details?.errors;
  return errors ? ` — ${Object.entries(errors).map(([k, v]) => `${k} : ${v}`).join(" · ")}` : "";
}

function ReasonField({ reason, setReason }: { reason: string; setReason: (v: string) => void }) {
  return (
    <label className="mt-3 block text-[12.5px]">
      <span className="font-medium">Motif (au journal, {REASON_MIN} caractères au moins)</span>
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5" placeholder="Pourquoi ce changement, pour qui le relira dans six mois." />
      <span className="text-[11px] text-slate-500">{reason.trim().length}/{REASON_MIN}</span>
    </label>
  );
}

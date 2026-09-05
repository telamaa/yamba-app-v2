"use client";

/** SettingsDocumentation.tsx — la page « Documentation des paramètres » (C-PR8a, D62 1A) : le catalogue rendu, à une seule source. */
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { SETTING_GROUP_LABEL, SETTING_GROUP_ORDER, formatSetting } from "@/lib/settings-format";
import type { AdminSettingsResponse } from "@/lib/types";

export default function SettingsDocumentation() {
  const [data, setData] = useState<AdminSettingsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    apiFetch<AdminSettingsResponse>("/admin/settings").then(setData).catch((e) => setError(e.message));
  }, []);
  if (error) return <p className="mt-4 text-[13px] text-red-700">{error}</p>;
  if (!data) return <p className="mt-4 text-[13px] text-slate-500">Chargement…</p>;
  return (
    <div className="mt-4 space-y-6 text-[13px]">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-bold">Comment ça marche</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">
          <li><b>Portée métier</b> (commission, planchers, fenêtres contractuelles) : super administrateur seul. <b>Portée exploitation</b> (seuils d&apos;alerte, relances, conservation, documents) : profil Exploitation ou super administrateur. Lecture ouverte à tous les profils.</li>
          <li>Chaque modification : motif de 20 caractères, une ligne de journal par clé (avant / après), email à tous les super administrateurs, effet dans les 30 secondes sur tous les services.</li>
          <li><b>Jamais rétroactif</b> : une réservation garde le prix figé à sa création. Le prix comparable des trajets déjà publiés se recalcule par script, pas à la volée.</li>
          <li>Les bornes et les règles de cohérence (S ≤ M ≤ L, intervalle de relance ≥ délai, plafond ≥ prime…) sont refusées par le serveur, quel que soit le profil.</li>
          <li>Si la base des paramètres est illisible, chaque service repart sur les valeurs par défaut : une base vide reproduit exactement le comportement d&apos;origine.</li>
        </ul>
      </section>

      {SETTING_GROUP_ORDER.map((g) => {
        const defs = data.catalog.filter((d) => d.group === g);
        if (!defs.length) return null;
        return (
          <section key={g}>
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{SETTING_GROUP_LABEL[g]}</h2>
            <div className="mt-2 space-y-2">
              {defs.map((d) => (
                <article key={d.key} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h3 className="font-semibold">{d.label}</h3>
                    <code className="text-[11px] text-slate-500">{d.key}</code>
                    <span className="text-[11px] text-slate-500">{d.rule}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${d.scope === "BUSINESS" ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-800"}`}>{d.scope === "BUSINESS" ? "métier" : "exploitation"}</span>
                    {d.contractual && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">CGU</span>}
                  </div>
                  <p className="mt-1 text-slate-700">{d.description}</p>
                  {d.example && <p className="mt-1 text-[12px] text-slate-500">Exemple : {d.example}</p>}
                  <p className="mt-1 text-[12px] text-slate-500">
                    En vigueur : <b className="text-slate-900">{formatSetting(d, data.values[d.key])}</b> · défaut : {formatSetting(d, d.default)} · bornes : {formatSetting(d, d.min)} à {formatSetting(d, d.max)} · lu par {d.consumers.join(", ")}.
                  </p>
                </article>
              ))}
            </div>
          </section>
        );
      })}

      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Modifiables par déploiement seulement (classe B)</h2>
        <p className="mt-1 text-[12px] text-slate-500">Un super administrateur dont la session serait volée ne doit pas pouvoir désarmer la plateforme depuis une page web.</p>
        <ul className="mt-2 space-y-1">
          {data.fixed.map((f) => <li key={f.key} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5"><b>{f.label}</b> : {f.value} <span className="text-[11px] text-slate-500">({f.rule})</span></li>)}
        </ul>
      </section>

      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Prévus, pas encore lus par le code (classe C)</h2>
        <p className="mt-1 text-[12px] text-slate-500">Un curseur qui ne commande rien serait une illusion de contrôle : ces clés apparaîtront quand leur règle sera livrée.</p>
        <ul className="mt-2 space-y-1">
          {data.planned.map((p) => <li key={p.key} className="rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-slate-600"><code className="text-[11px]">{p.key}</code> <span className="text-[11px] text-slate-500">({p.rule})</span></li>)}
        </ul>
      </section>
    </div>
  );
}

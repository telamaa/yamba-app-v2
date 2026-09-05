"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, apiFetch, del, patch, post } from "@/lib/api";
import { dateTime } from "@/lib/format";
import { ADMIN_ROLES, ROLE_LABEL, type AdminRole } from "@/lib/permissions";
import type { AdminAccount } from "@/lib/types";

const ROLE_HINT: Record<AdminRole, string> = {
  SUPER_ADMIN: "tout, comptes admin, remboursements manuels",
  MEDIATOR: "litiges, sanctions, masquage, versements",
  SUPPORT: "fiches, billets, propositions",
  FINANCE: "finances, exports, pilotage, journal",
  OPS: "paramètres d'exploitation (seuils, relances), état des services, maintenance — jamais l'argent ni les comptes",
};

/** C-PR3bis (D60 1A) — profils cumulés : cases à cocher, au moins un profil. */
function RolesPicker({ value, onChange, disabled, compact }: { value: AdminRole[]; onChange: (roles: AdminRole[]) => void; disabled?: boolean; compact?: boolean }) {
  const toggle = (r: AdminRole) => {
    const next = value.includes(r) ? value.filter((x) => x !== r) : [...value, r];
    if (next.length === 0) return; // au moins un profil
    onChange(ADMIN_ROLES.filter((x) => next.includes(x)));
  };
  return (
    <div className={`flex ${compact ? "flex-wrap gap-x-3 gap-y-1" : "flex-col gap-1.5"}`}>
      {ADMIN_ROLES.map((r) => (
        <label key={r} className={`flex items-center gap-1.5 ${compact ? "text-[11.5px]" : "text-[12.5px]"}`} title={ROLE_HINT[r]}>
          <input type="checkbox" checked={value.includes(r)} disabled={disabled} onChange={() => toggle(r)} />
          <span>{ROLE_LABEL[r]}</span>
          {!compact && <span className="text-[11px] text-slate-400">· {ROLE_HINT[r]}</span>}
        </label>
      ))}
    </div>
  );
}

export default function AdminsManager() {
  const [items, setItems] = useState<AdminAccount[]>([]);
  const [form, setForm] = useState<{ email: string; firstName: string; lastName: string; adminRoles: AdminRole[] }>({ email: "", firstName: "", lastName: "", adminRoles: ["SUPPORT"] });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiFetch<{ items: AdminAccount[] }>("/admin/admins").then((r) => setItems(r.items)).catch(() => undefined);
  }, []);
  useEffect(load, [load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await post<{ existingAccount: boolean }>("/admin/admins/invite", form);
      setMsg(r.existingAccount ? "Profils posés sur un compte existant, email envoyé." : "Compte créé, invitation envoyée (48 h).");
      setForm({ email: "", firstName: "", lastName: "", adminRoles: ["SUPPORT"] });
      load();
    } catch (err) {
      setMsg(err instanceof ApiError ? `${err.status} : ${err.message}` : "Invitation impossible.");
    } finally {
      setBusy(false);
    }
  }
  async function changeRoles(id: string, adminRoles: AdminRole[]) {
    setMsg(null);
    try {
      await patch(`/admin/admins/${id}`, { adminRoles });
      load();
    } catch (err) {
      setMsg(err instanceof ApiError ? `${err.status} : ${err.message}` : "Changement impossible.");
      load();
    }
  }
  async function revoke(id: string, name: string) {
    if (!window.confirm(`Retirer l'accès admin de ${name} ? Sa 2FA et ses sessions admin sont supprimées.`)) return;
    try {
      await del(`/admin/admins/${id}`);
      load();
    } catch (err) {
      setMsg(err instanceof ApiError ? `${err.status} : ${err.message}` : "Retrait impossible.");
    }
  }

  return (
    <div className="mt-4 grid gap-5 md:grid-cols-[1fr_340px]">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
            <tr><th className="px-3 py-2">Nom</th><th className="px-3 py-2">Email</th><th className="px-3 py-2">Profils (cumulables)</th><th className="px-3 py-2">État</th><th className="px-3 py-2"></th></tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id} className="border-t border-slate-100 align-top">
                <td className="px-3 py-2 font-semibold">{a.firstName} {a.lastName}</td>
                <td className="px-3 py-2">{a.email}</td>
                <td className="px-3 py-2"><RolesPicker compact value={a.adminRoles.length ? a.adminRoles : [a.adminRole]} onChange={(roles) => changeRoles(a.id, roles)} /></td>
                <td className="px-3 py-2 text-[11.5px] text-slate-600">{!a.inviteAccepted ? "invitation en attente" : a.totpEnabled ? "2FA active" : "2FA à activer"} · {dateTime(a.createdAt)}</td>
                <td className="px-3 py-2"><button onClick={() => revoke(a.id, `${a.firstName} ${a.lastName}`)} className="text-[12px] text-red-700 hover:underline">Retirer</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {msg && <p className="px-3 py-2 text-[12px] text-slate-600">{msg}</p>}
      </div>
      <form onSubmit={invite} className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-[13px] font-bold">Inviter</h2>
        <input required type="email" placeholder="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-[13px]" />
        <div className="mt-2 flex gap-2">
          <input required placeholder="Prénom" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-[13px]" />
          <input required placeholder="Nom" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-[13px]" />
        </div>
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Profils (un ou plusieurs)</p>
        <div className="mt-1"><RolesPicker value={form.adminRoles} onChange={(adminRoles) => setForm({ ...form, adminRoles })} disabled={busy} /></div>
        <p className="mt-2 text-[11px] text-slate-500">Les permissions se cumulent. Un compte créé ici n'a aucun rôle client (ni publier ni réserver).</p>
        <button disabled={busy} className="mt-3 w-full rounded-lg bg-slate-900 py-2 text-[13px] font-semibold text-white disabled:opacity-60">{busy ? "Envoi…" : "Envoyer l'invitation"}</button>
      </form>
    </div>
  );
}

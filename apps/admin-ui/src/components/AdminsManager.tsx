"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, apiFetch, del, patch, post } from "@/lib/api";
import { dateTime } from "@/lib/format";
import { ROLE_LABEL, type AdminRole } from "@/lib/permissions";
import type { AdminAccount } from "@/lib/types";

const ROLES: AdminRole[] = ["SUPER_ADMIN", "MEDIATOR", "SUPPORT", "FINANCE"];

export default function AdminsManager() {
  const [items, setItems] = useState<AdminAccount[]>([]);
  const [form, setForm] = useState({ email: "", firstName: "", lastName: "", adminRole: "SUPPORT" as AdminRole });
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
      setMsg(r.existingAccount ? "Profil posé sur un compte existant, email envoyé." : "Compte créé, invitation envoyée (48 h).");
      setForm({ email: "", firstName: "", lastName: "", adminRole: "SUPPORT" });
      load();
    } catch (err) {
      setMsg(err instanceof ApiError ? `${err.status} : ${err.message}` : "Invitation impossible.");
    } finally {
      setBusy(false);
    }
  }
  async function changeRole(id: string, adminRole: AdminRole) {
    try {
      await patch(`/admin/admins/${id}`, { adminRole });
      load();
    } catch (err) {
      setMsg(err instanceof ApiError ? `${err.status} : ${err.message}` : "Changement impossible.");
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
    <div className="mt-4 grid gap-5 md:grid-cols-[1fr_320px]">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
            <tr><th className="px-3 py-2">Nom</th><th className="px-3 py-2">Email</th><th className="px-3 py-2">Profil</th><th className="px-3 py-2">État</th><th className="px-3 py-2"></th></tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-semibold">{a.firstName} {a.lastName}</td>
                <td className="px-3 py-2">{a.email}</td>
                <td className="px-3 py-2">
                  <select value={a.adminRole} onChange={(e) => changeRole(a.id, e.target.value as AdminRole)} className="rounded border border-slate-300 px-2 py-1 text-[12px]">
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2 text-[11.5px] text-slate-600">{!a.inviteAccepted ? "invitation en attente" : a.totpEnabled ? "2FA active" : "2FA à activer"} · {dateTime(a.createdAt)}</td>
                <td className="px-3 py-2"><button onClick={() => revoke(a.id, `${a.firstName} ${a.lastName}`)} className="text-[12px] text-red-700 hover:underline">Retirer</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form onSubmit={invite} className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-[13px] font-bold">Inviter</h2>
        <input required type="email" placeholder="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-[13px]" />
        <div className="mt-2 flex gap-2">
          <input required placeholder="Prénom" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-[13px]" />
          <input required placeholder="Nom" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-[13px]" />
        </div>
        <select value={form.adminRole} onChange={(e) => setForm({ ...form, adminRole: e.target.value as AdminRole })} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-[13px]">
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
        <button disabled={busy} className="mt-3 w-full rounded-lg bg-slate-900 py-2 text-[13px] font-semibold text-white disabled:opacity-60">{busy ? "Envoi…" : "Envoyer l'invitation"}</button>
        {msg && <p className="mt-2 text-[12px] text-slate-600">{msg}</p>}
      </form>
    </div>
  );
}

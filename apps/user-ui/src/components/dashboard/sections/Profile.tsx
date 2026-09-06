"use client";

/**
 * Profile.tsx — le profil que le membre tient lui-même (D67, chantier E)
 * ======================================================================
 * Avatar (téléversé chez ImageKit puis déclaré au serveur), prénom et nom, présentation du Voyageur,
 * date de naissance, visibilités (page publique, ville), lien vers sa page publique.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@/i18n/navigation";
import type { DashboardCopy } from "@/app/[locale]/dashboard/dashboard.copy";
import SectionHeader from "@/components/dashboard/SectionHeader";
import { CardSection } from "@/components/dashboard/DashboardUI";
import { useImageKitUpload } from "@/hooks/useImageKitUpload";
import useUser from "@/hooks/useUser";
import { deleteMyAvatar, fetchMyProfile, fieldErrors, setMyAvatar, updateMyProfile, type MyProfile } from "@/services/profile.api";

const MANGO = "#FF9900";
const AVATAR_MAX = 2 * 1024 * 1024;

export default function Profile({ copy }: { copy: DashboardCopy }) {
  const c = copy.profilePage;
  const qc = useQueryClient();
  const { user } = useUser();
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [form, setForm] = useState<{ firstName: string; lastName: string; displayName: string; bio: string; birthDate: string }>({ firstName: "", lastName: "", displayName: "", bio: "", birthDate: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const { uploadDetailed } = useImageKitUpload("/avatars", { maxSizeBytes: AVATAR_MAX, allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"] });

  const load = useCallback(() => {
    fetchMyProfile().then((p) => {
      setProfile(p);
      setForm({ firstName: p.firstName, lastName: p.lastName, displayName: p.carrier?.displayName ?? "", bio: p.carrier?.bio ?? "", birthDate: p.birthDate ?? "" });
    }).catch(() => setMsg({ tone: "err", text: c.error }));
  }, [c.error]);
  useEffect(load, [load]);

  function apply(next: MyProfile, text: string) {
    setProfile(next);
    setMsg({ tone: "ok", text });
    qc.invalidateQueries({ queryKey: ["user"] });
  }

  async function save() {
    if (!profile) return;
    setBusy(true);
    setMsg(null);
    setErrors({});
    const body: Parameters<typeof updateMyProfile>[0] = {};
    if (form.firstName !== profile.firstName) body.firstName = form.firstName;
    if (form.lastName !== profile.lastName) body.lastName = form.lastName;
    if (profile.carrier && form.displayName !== profile.carrier.displayName) body.displayName = form.displayName;
    if (profile.carrier && form.bio !== (profile.carrier.bio ?? "")) body.bio = form.bio || null;
    if (form.birthDate !== (profile.birthDate ?? "")) body.birthDate = form.birthDate || null;
    if (Object.keys(body).length === 0) { setBusy(false); setMsg({ tone: "ok", text: c.nothingToSave }); return; }
    try {
      apply(await updateMyProfile(body), c.saved);
    } catch (e) {
      const fe = fieldErrors(e);
      setErrors(fe);
      setMsg({ tone: "err", text: Object.keys(fe).length ? c.fixFields : c.error });
    } finally {
      setBusy(false);
    }
  }

  async function toggle(key: "profilePublic" | "showCity") {
    if (!profile) return;
    try {
      apply(await updateMyProfile({ [key]: !profile[key] }), c.saved);
    } catch {
      setMsg({ tone: "err", text: c.error });
    }
  }

  async function onAvatarFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await uploadDetailed(file);
      if (!r.ok) { setMsg({ tone: "err", text: r.error.code === "TOO_LARGE" ? c.avatarTooLarge : r.error.code === "INVALID_TYPE" ? c.avatarBadType : c.error }); return; }
      apply(await setMyAvatar(r.file.fileId, r.file.url), c.avatarSaved);
    } catch {
      setMsg({ tone: "err", text: c.error });
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function removeAvatar() {
    setBusy(true);
    try { apply(await deleteMyAvatar(), c.avatarRemoved); } catch { setMsg({ tone: "err", text: c.error }); } finally { setBusy(false); }
  }

  const initial = (profile?.firstName ?? user?.firstName ?? "U").charAt(0).toUpperCase();
  const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-[13.5px] dark:border-slate-700 dark:bg-slate-900";
  const err = (k: string) => errors[k] ? <p className="mt-1 text-[12px] text-red-700 dark:text-red-400">{c.errors[errors[k]] ?? errors[k]}</p> : null;

  return (
    <>
      <SectionHeader title={copy.profile.title} subtitle={copy.profile.sub} />

      <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl bg-white p-4 dark:bg-slate-950">
        {profile?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatarUrl} alt="" className="h-16 w-16 flex-shrink-0 rounded-full object-cover" />
        ) : (
          <div className="grid h-16 w-16 flex-shrink-0 place-items-center rounded-full text-xl font-medium text-slate-900" style={{ backgroundColor: MANGO }}>{initial}</div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-base font-medium text-slate-900 dark:text-white">{profile ? `${profile.firstName} ${profile.lastName}` : "—"}</div>
          <div className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">{user?.email ?? "—"}{user?.phoneE164 ? ` · ${user.phoneE164}` : ""}</div>
          <div className="mt-2 flex flex-wrap gap-2 text-[12.5px]">
            <button type="button" disabled={busy} onClick={() => fileInput.current?.click()} className="rounded-lg border border-slate-300 px-3 py-1 font-medium dark:border-slate-700">{profile?.avatarUrl ? c.avatarChange : c.avatarAdd}</button>
            {profile?.avatarUrl && <button type="button" disabled={busy} onClick={removeAvatar} className="rounded-lg border border-slate-300 px-3 py-1 dark:border-slate-700">{c.avatarRemove}</button>}
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => onAvatarFile(e.target.files?.[0])} />
            {profile?.publicSlug && <Link href={`/u/${profile.publicSlug}`} className="rounded-lg bg-slate-900 px-3 py-1 font-semibold text-white dark:bg-white dark:text-slate-900">{c.viewPublic}</Link>}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">{c.avatarHint}</p>
        </div>
      </div>

      {msg && <p className={`mb-4 rounded-lg px-3 py-2 text-[12.5px] ${msg.tone === "ok" ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200" : "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200"}`}>{msg.text}</p>}

      <CardSection>
        <div className="grid gap-3 text-[13px] md:grid-cols-2">
          <label className="block"><span className="text-slate-600 dark:text-slate-400">{c.firstName}</span><input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className={input} maxLength={40} />{err("firstName")}</label>
          <label className="block"><span className="text-slate-600 dark:text-slate-400">{c.lastName}</span><input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className={input} maxLength={40} />{err("lastName")}</label>
          <label className="block"><span className="text-slate-600 dark:text-slate-400">{c.birthDate}</span><input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} className={input} />{err("birthDate")}<span className="text-[11px] text-slate-400">{c.birthDateHint}</span></label>
          {profile?.carrier && (
            <>
              <label className="block"><span className="text-slate-600 dark:text-slate-400">{c.displayName}</span><input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} className={input} maxLength={40} />{err("displayName")}</label>
              <label className="block md:col-span-2"><span className="text-slate-600 dark:text-slate-400">{c.bio}</span><textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value.slice(0, 300) })} rows={3} className={input} />{err("bio")}<span className="text-[11px] text-slate-400">{form.bio.length}/300</span></label>
            </>
          )}
        </div>
        <div className="mt-3"><button type="button" disabled={busy || !profile} onClick={save} className="rounded-lg bg-slate-900 px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-slate-900">{c.save}</button></div>
      </CardSection>

      <CardSection>
        <ToggleLine label={copy.publicProfile} description={c.publicProfileHint} on={profile?.profilePublic ?? true} onToggleAction={() => toggle("profilePublic")} />
        <ToggleLine label={copy.showCity} description={copy.showCitySub} on={profile?.showCity ?? true} onToggleAction={() => toggle("showCity")} />
      </CardSection>
    </>
  );
}

function ToggleLine({ label, description, on, onToggleAction }: { label: string; description: string; on: boolean; onToggleAction: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 px-1 py-2">
      <div>
        <p className="text-[13.5px] font-medium text-slate-900 dark:text-white">{label}</p>
        <p className="text-[12px] text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <button type="button" role="switch" aria-checked={on} onClick={onToggleAction} className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-[#0F766E]" : "bg-slate-300 dark:bg-slate-700"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${on ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}

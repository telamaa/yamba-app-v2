/**
 * AdminShell.tsx — garde de session + navigation du back-office
 * =============================================================
 * Charge /admin/me au montage : 401 → /login (après une tentative de refresh
 * par le client). Session courte (15 min d'accès, 45 min d'inactivité) :
 * chaque navigation re-vérifie.
 */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch, post } from "@/lib/api";
import type { AdminMe } from "@/lib/types";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<AdminMe | null>(null);

  useEffect(() => {
    apiFetch<AdminMe>("/admin/me")
      .then(setMe)
      .catch(() => router.replace("/login"));
  }, [router, pathname]);

  async function logout() {
    await post("/auth/admin/logout").catch(() => undefined);
    router.replace("/login");
  }

  if (!me) return <div className="p-8 text-[13px] text-slate-500">Vérification de la session…</div>;

  const nav = [
    { href: "/disputes", label: "À arbitrer" },
    { href: "/audit", label: "Journal" },
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-slate-200 bg-white p-4">
        <p className="text-[15px] font-bold">Yamba · Admin</p>
        <p className="mt-0.5 text-[12px] text-slate-500">{me.firstName} {me.lastName}</p>
        <nav className="mt-6 space-y-1">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className={`block rounded-lg px-3 py-2 text-[13.5px] font-medium ${pathname.startsWith(n.href) ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"}`}>
              {n.label}
            </Link>
          ))}
        </nav>
        {me.remainingBackupCodes <= 2 && (
          <p className="mt-6 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">Il te reste {me.remainingBackupCodes} code(s) de secours.</p>
        )}
        <button onClick={logout} className="mt-6 text-[12.5px] text-slate-500 underline-offset-2 hover:underline">Se déconnecter</button>
      </aside>
      <main className="min-w-0 flex-1 p-6">{children}</main>
    </div>
  );
}

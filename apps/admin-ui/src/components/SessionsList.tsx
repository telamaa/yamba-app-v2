"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, del } from "@/lib/api";
import { dateTime } from "@/lib/format";
import type { AdminSessionItem } from "@/lib/types";

export default function SessionsList() {
  const router = useRouter();
  const [items, setItems] = useState<AdminSessionItem[]>([]);
  const load = useCallback(() => {
    apiFetch<{ items: AdminSessionItem[] }>("/admin/me/sessions").then((r) => setItems(r.items)).catch(() => undefined);
  }, []);
  useEffect(load, [load]);

  async function revoke(s: AdminSessionItem) {
    await del(`/admin/me/sessions/${s.jti}`).catch(() => undefined);
    if (s.current) router.replace("/login");
    else load();
  }

  return (
    <ul className="mt-4 max-w-2xl space-y-2">
      {items.map((s) => (
        <li key={s.jti} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px]">
          <span>
            {s.current && <span className="mr-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">cette session</span>}
            ouverte le {dateTime(s.createdAt)} · active le {dateTime(s.lastActivityAt)}
          </span>
          <button onClick={() => revoke(s)} className="text-[12px] text-red-700 hover:underline">Révoquer</button>
        </li>
      ))}
      {items.length === 0 && <li className="text-[13px] text-slate-500">Aucune session.</li>}
    </ul>
  );
}

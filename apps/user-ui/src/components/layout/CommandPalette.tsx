"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

export type CommandAction = {
  label: string;
  href: string;
  keywords?: string[];
};

export default function CommandPalette({ actions }: { actions: CommandAction[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isK = e.key.toLowerCase() === "k";
      if ((e.metaKey || e.ctrlKey) && isK) {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return actions;
    return actions.filter((a) => {
      const hay = [a.label, ...(a.keywords ?? [])].join(" ").toLowerCase();
      return hay.includes(needle);
    });
  }, [actions, q]);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      <button
        aria-label="Close command palette"
        className="absolute inset-0 bg-black/30"
        onClick={() => setOpen(false)}
      />
      <div className="absolute left-1/2 top-24 w-[92vw] max-w-xl -translate-x-1/2 rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <Search size={16} className="text-slate-500" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher une action… (ex: login, trip, seller)"
            className="w-full bg-transparent text-sm outline-none"
          />
          <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
            Esc
          </span>
        </div>

        <div className="max-h-72 overflow-auto p-2">
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-sm text-slate-500">Aucun résultat</div>
          ) : (
            filtered.map((a) => (
              <button
                key={a.href}
                onClick={() => go(a.href)}
                className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-900"
              >
                {a.label}
              </button>
            ))
          )}
        </div>

        <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500 dark:border-slate-800">
          Astuce : <span className="font-medium">⌘K</span> / <span className="font-medium">Ctrl+K</span>
        </div>
      </div>
    </div>
  );
}

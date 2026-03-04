"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Globe, Sun, Moon, ChevronDown, Menu, X } from "lucide-react";
import { useOnClickOutside } from "@/hooks/useOnClickOutside";
import CommandPalette, { CommandAction } from "./CommandPalette";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";

type Lang = "fr" | "en";
const LANGS: Record<Lang, { label: string; code: string }> = {
  fr: { label: "Français", code: "FR" },
  en: { label: "Anglais", code: "EN" },
};

// Palette Mango (#FF9900) + accent Teal (optionnel)
const COLORS = {
  mango: "#FF9900",
  mangoTint: "#FFF6E8",
  teal: "#0F766E",
};

export default function Header() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();

  const isDark = resolvedTheme === "dark";
  const [isCompact, setIsCompact] = useState(false);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);

  // Global preferences
  const ui = useUiPreferences();
  const lang = (ui.lang ?? "en") as Lang;
  const setLang = ui.setLang;

  const langRef = useRef<HTMLDivElement | null>(null);
  const quickRef = useRef<HTMLDivElement | null>(null);

  useOnClickOutside(langRef, () => setLangOpen(false), langOpen);
  useOnClickOutside(quickRef, () => setQuickOpen(false), quickOpen);

  useEffect(() => {
    const onScroll = () => setIsCompact(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const currentLang = LANGS[lang] ?? LANGS.en;

  const toggleTheme = () => setTheme(isDark ? "light" : "dark");

  const selectLang = (next: Lang) => {
    setLang(next);
    setLangOpen(false);
    setMobileOpen(false);
  };

  // ✅ Textes FR/EN (robuste, ne dépend pas de t())
  const L = useMemo(() => {
    if (lang === "fr") {
      return {
        login: "Connexion",
        share: "Partager un trajet",
        quickActions: "Actions rapides",
        newTrip: "Nouveau trajet",
        carrier: "Devenir transporteur",
        seller: "Devenir vendeur",
        help: "Aide",
        carrierShort: "Transporteur",
        sellerShort: "Vendeur",
      };
    }
    return {
      login: "Log in",
      share: "Share your trip",
      quickActions: "Quick actions",
      newTrip: "New trip",
      carrier: "Become a carrier",
      seller: "Become a seller",
      help: "Help",
      carrierShort: "Carrier",
      sellerShort: "Seller",
    };
  }, [lang]);

  const isLogin = pathname?.startsWith("/auth/login");
  const isShare = pathname === "/share";

  const actions: CommandAction[] = useMemo(
    () => [
      { label: L.login, href: "/auth/login", keywords: ["login", "connexion"] },
      { label: L.share, href: "/share", keywords: ["trip", "trajet"] },
      { label: L.carrier, href: "/become/carrier", keywords: ["carrier", "transporteur"] },
      { label: L.seller, href: "/become/seller", keywords: ["seller", "vendeur"] },
      { label: L.help, href: "/help", keywords: ["support", "aide"] },
    ],
    [L]
  );

  // ✅ CTA outline Mango : bordure orange, fond blanc, texte = même “noir” que bouton langue
  const ctaLeft =
    "inline-flex items-center rounded-l-lg px-4 py-2 text-sm font-semibold shadow-sm transition-colors " +
    "border border-[#FF9900] bg-white text-slate-700 hover:bg-[#FFF6E8] " +
    "dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900/60 " +
    "focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF9900]/25";

  const ctaRight =
    "inline-flex h-[40px] items-center justify-center rounded-r-lg px-2 shadow-sm transition-colors " +
    "border border-l-0 border-[#FF9900] bg-white text-slate-700 hover:bg-[#FFF6E8] " +
    "dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900/60 " +
    "focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF9900]/25";

  return (
    <>
      <CommandPalette actions={actions} />

      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/70">
        <div
          className={[
            "mx-auto flex max-w-6xl items-center justify-between px-4 transition-all",
            isCompact ? "py-2" : "py-3",
          ].join(" ")}
        >
          {/* Left: logo + brand + beta */}
          <Link href="/" className="flex items-center gap-3">
            <div
              className={[
                "grid place-items-center rounded-xl text-slate-950 shadow-sm transition-all",
                isCompact ? "h-8 w-8" : "h-9 w-9",
              ].join(" ")}
              style={{ backgroundColor: COLORS.mango }}
            >
              <span className="text-sm font-extrabold">Y</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
                Yamba
              </span>
              <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-300">
                BETA
              </span>
            </div>
          </Link>

          {/* Desktop actions */}
          <div className="hidden items-center gap-4 md:flex">
            {/* Language */}
            <div className="relative" ref={langRef}>
              <button
                type="button"
                onClick={() => setLangOpen((v) => !v)}
                className="inline-flex items-center gap-2 rounded-xl px-2 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF9900]/20"
                aria-label="Language"
              >
                <Globe size={18} />
                <span className="font-medium">{currentLang.label}</span>
                <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  {currentLang.code}
                </span>
              </button>

              {langOpen && (
                <div className="absolute right-0 mt-2 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-950">
                  <button
                    className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-900"
                    onClick={() => selectLang("fr")}
                  >
                    Français <span className="text-slate-400">(FR)</span>
                  </button>
                  <button
                    className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-900"
                    onClick={() => selectLang("en")}
                  >
                    Anglais <span className="text-slate-400">(EN)</span>
                  </button>
                </div>
              )}
            </div>

            {/* Theme toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF9900]/20"
              aria-label="Toggle theme"
              title="Toggle theme"
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Log in */}
            <Link
              href="/auth/login"
              className={[
                "text-sm font-medium transition-colors",
                isLogin ? "underline underline-offset-4" : "hover:underline hover:underline-offset-4",
                "text-slate-700 dark:text-slate-200 dark:hover:text-white",
              ].join(" ")}
              style={isLogin ? { color: COLORS.teal } : undefined}
            >
              {L.login}
            </Link>

            {/* CTA outline split */}
            <div className="relative flex items-center" ref={quickRef}>
              <Link href="/share" className={ctaLeft} style={isShare ? { backgroundColor: COLORS.mangoTint } : undefined}>
                {L.share}
              </Link>

              <button
                type="button"
                onClick={() => setQuickOpen((v) => !v)}
                className={ctaRight}
                aria-label="Quick actions"
                title="Quick actions"
                style={isShare ? { backgroundColor: COLORS.mangoTint } : undefined}
              >
                <ChevronDown size={16} />
              </button>

              {quickOpen && (
                <div className="absolute right-0 top-12 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-950">
                  <div className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {L.quickActions}
                    <span className="ml-2 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] dark:bg-slate-900">
                      ⌘K
                    </span>
                  </div>
                  <div className="h-px bg-slate-200 dark:bg-slate-800" />

                  <Link
                    href="/share"
                    className="block px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-900"
                    onClick={() => setQuickOpen(false)}
                  >
                    {L.newTrip}
                  </Link>
                  <Link
                    href="/become/carrier"
                    className="block px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-900"
                    onClick={() => setQuickOpen(false)}
                  >
                    {L.carrier}
                  </Link>
                  <Link
                    href="/become/seller"
                    className="block px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-900"
                    onClick={() => setQuickOpen(false)}
                  >
                    {L.seller}
                  </Link>
                  <Link
                    href="/help"
                    className="block px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-900"
                    onClick={() => setQuickOpen(false)}
                  >
                    {L.help}
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Mobile right */}
          <div className="flex items-center gap-2 md:hidden">
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF9900]/20"
              aria-label="Toggle theme"
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF9900]/20"
              aria-label="Open menu"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile panel */}
        {mobileOpen && (
          <div className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 md:hidden">
            <div className="mx-auto max-w-6xl space-y-3 px-4 py-4">
              {/* Language */}
              <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Globe size={18} />
                  <span className="text-sm font-medium">{currentLang.label}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    className={`rounded-lg px-3 py-1 text-sm ${
                      lang === "fr"
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950"
                        : "bg-slate-100 dark:bg-slate-900"
                    }`}
                    onClick={() => selectLang("fr")}
                  >
                    FR
                  </button>
                  <button
                    className={`rounded-lg px-3 py-1 text-sm ${
                      lang === "en"
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950"
                        : "bg-slate-100 dark:bg-slate-900"
                    }`}
                    onClick={() => selectLang("en")}
                  >
                    EN
                  </button>
                </div>
              </div>

              {/* Login */}
              <Link
                href="/auth/login"
                className="block rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-medium hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                onClick={() => setMobileOpen(false)}
                style={isLogin ? { borderColor: COLORS.teal, color: COLORS.teal } : undefined}
              >
                {L.login}
              </Link>

              {/* CTA outline (mobile) */}
              <Link
                href="/share"
                className="inline-flex w-full items-center justify-center rounded-lg border border-[#FF9900] bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-[#FFF6E8] dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900/60"
                onClick={() => setMobileOpen(false)}
              >
                {L.share}
              </Link>

              {/* Quick actions mobile */}
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/become/carrier"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-center text-sm dark:border-slate-800"
                  onClick={() => setMobileOpen(false)}
                >
                  {L.carrierShort}
                </Link>
                <Link
                  href="/become/seller"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-center text-sm dark:border-slate-800"
                  onClick={() => setMobileOpen(false)}
                >
                  {L.sellerShort}
                </Link>
                <Link
                  href="/help"
                  className="col-span-2 rounded-xl border border-slate-200 px-3 py-2 text-center text-sm dark:border-slate-800"
                  onClick={() => setMobileOpen(false)}
                >
                  {L.help}
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  );
}

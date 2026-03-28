"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import {
  Globe,
  Sun,
  Moon,
  Menu,
  X,
  User,
  Settings,
  HelpCircle,
  LogOut,
  Truck,
  Store,
  Bell,
  Shield,
  CreditCard,
  MessageSquare,
} from "lucide-react";
import { useOnClickOutside } from "@/hooks/useOnClickOutside";
import CommandPalette, { CommandAction } from "./CommandPalette";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";
import useUser from "@/hooks/useUser";
import { useQueryClient } from "@tanstack/react-query";
import { logoutUser as logoutApi } from "@/services/auth.api";

type Lang = "fr" | "en";
const LANGS: Record<Lang, { label: string; code: string }> = {
  fr: { label: "Français", code: "FR" },
  en: { label: "Anglais", code: "EN" },
};

const COLORS = {
  mango: "#FF9900",
  mangoTint: "#FFF6E8",
  teal: "#0F766E",
};

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { resolvedTheme, setTheme } = useTheme();

  const [mounted, setMounted] = useState(false);
  const [isCompact, setIsCompact] = useState(false);

  const { user, isLoading } = useUser();

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === "dark";

  const [mobileOpen, setMobileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const ui = useUiPreferences();
  const lang = (ui.lang ?? "en") as Lang;
  const setLang = ui.setLang;

  const langRef = useRef<HTMLDivElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useOnClickOutside(langRef, () => setLangOpen(false), langOpen);
  useOnClickOutside(userMenuRef, () => setUserMenuOpen(false), userMenuOpen);

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

  // Logout handler
  const handleLogout = async () => {
    try {
      await logoutApi();
    } catch {
      // Même si l'appel échoue, on nettoie côté client
    }
    queryClient.setQueryData(["user"], null);
    setUserMenuOpen(false);
    setMobileOpen(false);
    router.push("/");
    router.refresh();
  };

  const L = useMemo(() => {
    if (lang === "fr") {
      return {
        login: "Connexion",
        share: "Partager un trajet",
        help: "Aide",
        carrierShort: "Transporteur",
        sellerShort: "Vendeur",
        // User menu
        myAccount: "Mon compte",
        myTrips: "Mes trajets",
        myParcels: "Mes colis",
        becomeCarrier: "Devenir transporteur",
        becomeSeller: "Devenir vendeur",
        notifications: "Notifications",
        messages: "Messages",
        payments: "Paiements",
        security: "Sécurité & confidentialité",
        settings: "Paramètres",
        logout: "Déconnexion",
      };
    }
    return {
      login: "Log in",
      share: "Share your trip",
      help: "Help",
      carrierShort: "Carrier",
      sellerShort: "Seller",
      // User menu
      myAccount: "My account",
      myTrips: "My trips",
      myParcels: "My parcels",
      becomeCarrier: "Become a carrier",
      becomeSeller: "Become a seller",
      notifications: "Notifications",
      messages: "Messages",
      payments: "Payments",
      security: "Security & privacy",
      settings: "Settings",
      logout: "Sign out",
    };
  }, [lang]);

  const isLogin = pathname?.startsWith("/auth/login");
  const isShare = pathname === "/share";

  const actions: CommandAction[] = useMemo(
    () => [
      { label: L.login, href: "/login", keywords: ["login", "connexion"] },
      { label: L.share, href: "/share", keywords: ["trip", "trajet"] },
      { label: L.becomeCarrier, href: "/become/carrier", keywords: ["carrier", "transporteur"] },
      { label: L.becomeSeller, href: "/become/seller", keywords: ["seller", "vendeur"] },
      { label: L.help, href: "/help", keywords: ["support", "aide"] },
    ],
    [L]
  );

  // Initiale du prénom
  const userInitial = user?.firstName?.charAt(0)?.toUpperCase() ?? "U";
  const userAvatar = user?.avatar ?? user?.profileImage ?? null;

  // CTA simple
  const ctaClass =
    "inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition-colors " +
    "border border-[#FF9900] bg-white text-slate-700 hover:bg-[#FFF6E8] " +
    "dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900/60 " +
    "focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF9900]/25";

  // Items du menu utilisateur
  const userMenuItems = [
    { label: L.myAccount, href: "/account", icon: User },
    { label: L.myTrips, href: "/my-trips", icon: Truck },
    { label: L.myParcels, href: "/my-parcels", icon: Store },
    { type: "separator" as const },
    { label: L.notifications, href: "/notifications", icon: Bell },
    { label: L.messages, href: "/messages", icon: MessageSquare },
    { label: L.payments, href: "/payments", icon: CreditCard },
    { type: "separator" as const },
    { label: L.becomeCarrier, href: "/become/carrier", icon: Truck },
    { label: L.becomeSeller, href: "/become/seller", icon: Store },
    { type: "separator" as const },
    { label: L.security, href: "/security", icon: Shield },
    { label: L.settings, href: "/settings", icon: Settings },
    { label: L.help, href: "/help", icon: HelpCircle },
    { type: "separator" as const },
    { label: L.logout, icon: LogOut, danger: true },
  ];

  // Rendu d'un item du menu (partagé desktop + mobile)
  const renderMenuItem = (item: (typeof userMenuItems)[number], i: number, keyPrefix: string) => {
    if ("type" in item && item.type === "separator") {
      return (
        <div
          key={`${keyPrefix}sep-${i}`}
          className="my-1 h-px bg-slate-200 dark:bg-slate-800"
        />
      );
    }

    const Icon = "icon" in item ? item.icon : null;
    const isDanger = "danger" in item && item.danger;

    if (isDanger) {
      return (
        <button
          key={`${keyPrefix}item-${i}`}
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 transition-colors hover:bg-slate-50 dark:text-red-400 dark:hover:bg-slate-900"
        >
          {Icon && <Icon size={18} className="flex-shrink-0" />}
          <span>{"label" in item ? item.label : ""}</span>
        </button>
      );
    }

    return (
      <Link
        key={`${keyPrefix}item-${i}`}
        href={"href" in item ? item.href! : "#"}
        className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-900"
        onClick={() => {
          setUserMenuOpen(false);
          setMobileOpen(false);
        }}
      >
        {Icon && <Icon size={18} className="flex-shrink-0" />}
        <span>{"label" in item ? item.label : ""}</span>
      </Link>
    );
  };

  return (
    <>
      <CommandPalette actions={actions} />

      <header className="fixed inset-x-0 top-0 z-[100] border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
        <div
          className={[
            "mx-auto flex h-[78px] max-w-6xl items-center justify-between px-4 transition-all",
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
              {!mounted ? (
                <span className="inline-block h-[18px] w-[18px]" />
              ) : isDark ? (
                <Sun size={18} />
              ) : (
                <Moon size={18} />
              )}
            </button>

            {/* CTA simple */}
            <Link
              href="/share"
              className={ctaClass}
              style={isShare ? { backgroundColor: COLORS.mangoTint } : undefined}
            >
              {L.share}
            </Link>

            {/* Connexion / Avatar utilisateur */}
            {!isLoading && !user && (
              <Link
                href="/login"
                className={[
                  "text-sm font-medium transition-colors",
                  isLogin
                    ? "underline underline-offset-4"
                    : "hover:underline hover:underline-offset-4",
                  "text-slate-700 dark:text-slate-200 dark:hover:text-white",
                ].join(" ")}
                style={isLogin ? { color: COLORS.teal } : undefined}
              >
                {L.login}
              </Link>
            )}

            {!isLoading && user && (
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-slate-950 transition-shadow hover:ring-2 hover:ring-[#FF9900]/40 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF9900]/25"
                  style={!userAvatar ? { backgroundColor: COLORS.mango } : undefined}
                  aria-label="User menu"
                >
                  {userAvatar ? (
                    <img src={userAvatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    userInitial
                  )}
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950">
                    {/* En-tête utilisateur */}
                    <div className="flex items-center gap-3 px-4 py-4">
                      <div
                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-slate-950"
                        style={!userAvatar ? { backgroundColor: COLORS.mango } : undefined}
                      >
                        {userAvatar ? (
                          <img src={userAvatar} alt="" className="h-full w-full object-cover" />
                        ) : (
                          userInitial
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                          {/*{user.firstName} {user.lastName ?? ""}*/}
                          {user?.firstName.split(" ")[0]}
                        </p>
                        {user.email && (
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {user.email}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="h-px bg-slate-200 dark:bg-slate-800" />

                    {/* Items du menu */}
                    <div className="max-h-[60vh] overflow-y-auto py-1">
                      {userMenuItems.map((item, i) => renderMenuItem(item, i, "d-"))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile right */}
          <div className="flex items-center gap-2 md:hidden">
            {/* Compact lang toggle */}
            <button
              type="button"
              onClick={() => selectLang(lang === "fr" ? "en" : "fr")}
              className="inline-flex h-10 items-center justify-center rounded-xl px-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF9900]/20"
              aria-label="Toggle language"
            >
              {lang === "fr" ? "FR" : "EN"}
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF9900]/20"
              aria-label="Toggle theme"
              title="Toggle theme"
            >
              {!mounted ? (
                <span className="inline-block h-[18px] w-[18px]" />
              ) : isDark ? (
                <Sun size={18} />
              ) : (
                <Moon size={18} />
              )}
            </button>

            {/* Avatar mobile (si connecté) */}
            {!isLoading && user && (
              <button
                type="button"
                onClick={() => setMobileOpen((v) => !v)}
                className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-slate-950 transition-shadow hover:ring-2 hover:ring-[#FF9900]/40 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF9900]/25"
                style={!userAvatar ? { backgroundColor: COLORS.mango } : undefined}
                aria-label="User menu"
              >
                {userAvatar ? (
                  <img src={userAvatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  userInitial
                )}
              </button>
            )}

            {/* Burger menu (si non connecté) */}
            {!isLoading && !user && (
              <button
                type="button"
                onClick={() => setMobileOpen((v) => !v)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF9900]/20"
                aria-label="Open menu"
              >
                {mobileOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            )}
          </div>
        </div>

        {/* Mobile panel */}
        {mobileOpen && (
          <div className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 md:hidden">
            <div className="mx-auto max-w-6xl space-y-3 px-4 py-4">
              {/* Utilisateur connecté : en-tête profil */}
              {user && (
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                  <div
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-slate-950"
                    style={!userAvatar ? { backgroundColor: COLORS.mango } : undefined}
                  >
                    {userAvatar ? (
                      <img src={userAvatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      userInitial
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {user?.firstName.split(" ")[0]}
                    </p>
                    {user.email && (
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {user.email}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Login (si non connecté) */}
              {!user && (
                <Link
                  href="/login"
                  className="block rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-medium hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                  onClick={() => setMobileOpen(false)}
                  style={isLogin ? { borderColor: COLORS.teal, color: COLORS.teal } : undefined}
                >
                  {L.login}
                </Link>
              )}

              {/* Menu items utilisateur (si connecté) */}
              {user && (
                <div className="space-y-1 rounded-xl border border-slate-200 py-1 dark:border-slate-800">
                  {userMenuItems.map((item, i) => renderMenuItem(item, i, "m-"))}
                </div>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  );
}

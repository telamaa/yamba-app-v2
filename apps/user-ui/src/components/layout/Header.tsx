"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import {
  Sun,
  Moon,
  Menu,
  X,
  User,
  HelpCircle,
  LogOut,
  Zap,
  Bell,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useOnClickOutside } from "@/hooks/useOnClickOutside";
import CommandPalette, { CommandAction } from "./CommandPalette";
import LocaleSwitcher from "@/components/layout/LocaleSwitcher";
import useUser from "@/hooks/useUser";
import useShareTrip from "@/hooks/useShareTrip";
import { useQueryClient } from "@tanstack/react-query";
import { logoutUser as logoutApi } from "@/services/auth.api";
import { getUserInitials, formatDisplayName } from "@/lib/format-user";

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
  const { handleShareTrip } = useShareTrip();

  // next-intl: translations
  const t = useTranslations("common");

  const [mounted, setMounted] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const { user, isLoading } = useUser();

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === "dark";

  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const userMenuRef = useRef<HTMLDivElement | null>(null);
  useOnClickOutside(userMenuRef, () => setUserMenuOpen(false), userMenuOpen);

  useEffect(() => {
    const onScroll = () => setIsCompact(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toggleTheme = () => setTheme(isDark ? "light" : "dark");

  // Logout handler
  const handleLogout = async () => {
    try {
      await logoutApi();
    } catch {
      // ignore
    }
    queryClient.setQueryData(["user"], null);
    setUserMenuOpen(false);
    setMobileOpen(false);
    router.push("/");
    router.refresh();
  };

  const isLogin = pathname?.startsWith("/login");

  const actions: CommandAction[] = useMemo(
    () => [
      { label: t("header.login"), href: "/login", keywords: ["login", "connexion"] },
      { label: t("header.shareTrip"), href: "/trips/create", keywords: ["trip", "trajet"] },
      { label: t("header.help"), href: "/dashboard/help", keywords: ["support", "aide"] },
    ],
    [t]
  );

  const userInitials = getUserInitials(user?.firstName, user?.lastName);
  const userDisplayName = formatDisplayName(user?.firstName, user?.lastName);
  const userAvatar = user?.avatar?.url ?? null;

  const ctaClass =
    "inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition-colors " +
    "border border-[#FF9900] bg-white text-slate-700 hover:bg-[#FFF6E8] " +
    "dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900/60 " +
    "focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF9900]/25";

  const userMenuItems = [
    { label: t("userMenu.myAccount"), href: "/dashboard/home", icon: User },
    { label: t("userMenu.myTrips"), href: "/dashboard/trips", icon: Zap },
    { label: t("userMenu.notifications"), href: "/dashboard/notifications", icon: Bell },
    { label: t("userMenu.help"), href: "/dashboard/help", icon: HelpCircle },
    { type: "separator" as const },
    { label: t("userMenu.logout"), icon: LogOut, danger: true },
  ];

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

  const renderAvatar = (size: string) => (
    <div
      className={`flex ${size} flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-slate-950`}
      style={!userAvatar ? { backgroundColor: COLORS.mango } : undefined}
    >
      {userAvatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={userAvatar} alt="" className="h-full w-full object-cover" />
      ) : (
        userInitials
      )}
    </div>
  );

  return (
    <>
      <CommandPalette actions={actions} />

      <header className="fixed inset-x-0 top-0 z-[100] border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
        <div
          className={[
            "mx-auto flex h-[78px] max-w-7xl items-center justify-between px-4 transition-all",
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
            {/* Language switcher (nouveau) */}
            <LocaleSwitcher />

            {/* Theme toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF9900]/20"
              aria-label={t("header.toggleTheme")}
              title={t("header.toggleTheme")}
            >
              {!mounted ? (
                <span className="inline-block h-[18px] w-[18px]" />
              ) : isDark ? (
                <Sun size={18} />
              ) : (
                <Moon size={18} />
              )}
            </button>

            {/* CTA Share trip */}
            <button
              type="button"
              onClick={handleShareTrip}
              className={ctaClass}
            >
              {t("header.shareTrip")}
            </button>

            {/* Login (si non connecté) */}
            {!user && (
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
                {t("header.login")}
              </Link>
            )}

            {/* Avatar utilisateur */}
            {!isLoading && user && (
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-slate-950 transition-shadow hover:ring-2 hover:ring-[#FF9900]/40 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF9900]/25"
                  style={!userAvatar ? { backgroundColor: COLORS.mango } : undefined}
                  aria-label={t("header.userMenu")}
                >
                  {userAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={userAvatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    userInitials
                  )}
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950">
                    <div className="flex items-center gap-3 px-4 py-4">
                      {renderAvatar("h-10 w-10")}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                          {userDisplayName}
                        </p>
                        {user.email && (
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {user.email}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="h-px bg-slate-200 dark:bg-slate-800" />

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
            {/* Language switcher compact */}
            <LocaleSwitcher />

            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF9900]/20"
              aria-label={t("header.toggleTheme")}
              title={t("header.toggleTheme")}
            >
              {!mounted ? (
                <span className="inline-block h-[18px] w-[18px]" />
              ) : isDark ? (
                <Sun size={18} />
              ) : (
                <Moon size={18} />
              )}
            </button>

            {!isLoading && user && (
              <button
                type="button"
                onClick={() => setMobileOpen((v) => !v)}
                className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-slate-950 transition-shadow hover:ring-2 hover:ring-[#FF9900]/40 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF9900]/25"
                style={!userAvatar ? { backgroundColor: COLORS.mango } : undefined}
                aria-label={t("header.userMenu")}
              >
                {userAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={userAvatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  userInitials
                )}
              </button>
            )}

            {!user && (
              <button
                type="button"
                onClick={() => setMobileOpen((v) => !v)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF9900]/20"
                aria-label={t("header.openMenu")}
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
              {user && (
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                  {renderAvatar("h-10 w-10")}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {userDisplayName}
                    </p>
                    {user.email && (
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {user.email}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {!user && (
                <Link
                  href="/login"
                  className="block rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-medium hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                  onClick={() => setMobileOpen(false)}
                  style={isLogin ? { borderColor: COLORS.teal, color: COLORS.teal } : undefined}
                >
                  {t("header.login")}
                </Link>
              )}

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

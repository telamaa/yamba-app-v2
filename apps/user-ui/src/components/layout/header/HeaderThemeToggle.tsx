// apps/user-ui/src/components/layout/header/HeaderThemeToggle.tsx
"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { useTranslations } from "next-intl";
import { HEADER_COLORS } from "./header.constants";

type Props = {
  /** Variante visuelle : `icon` = bouton rond classique, `inline` = inline pour bottom sheet. */
  variant?: "icon" | "inline";
};

/**
 * Toggle thème clair/sombre.
 *
 * - `variant="icon"`  : bouton 40×40 dans la top bar (defaut).
 * - `variant="inline"`: utilisé dans le bottom sheet à côté d'un label.
 *
 * Gère le mismatch d'hydratation via `mounted`.
 */
export default function HeaderThemeToggle({ variant = "icon" }: Props) {
  const { resolvedTheme, setTheme } = useTheme();
  const t = useTranslations("common.header");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";
  const toggle = () => setTheme(isDark ? "light" : "dark");

  if (variant === "inline") {
    return (
      <div className="flex rounded-full bg-slate-100 p-0.5 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => setTheme("light")}
          aria-label={t("themeLight")}
          className={`flex h-7 w-9 items-center justify-center rounded-full transition-colors ${
            !isDark
              ? "bg-white text-slate-900 shadow-sm dark:bg-white dark:text-slate-900"
              : "text-slate-500 dark:text-slate-400"
          }`}
        >
          <Sun size={14} />
        </button>
        <button
          type="button"
          onClick={() => setTheme("dark")}
          aria-label={t("themeDark")}
          className={`flex h-7 w-9 items-center justify-center rounded-full transition-colors ${
            isDark
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 dark:text-slate-400"
          }`}
        >
          <Moon size={14} />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t("toggleTheme")}
      title={t("toggleTheme")}
      className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-4 dark:text-slate-200 dark:hover:bg-slate-900"
      style={{ outlineColor: HEADER_COLORS.mango }}
    >
      {!mounted ? (
        <span className="inline-block h-[18px] w-[18px]" />
      ) : isDark ? (
        <Sun size={18} />
      ) : (
        <Moon size={18} />
      )}
    </button>
  );
}

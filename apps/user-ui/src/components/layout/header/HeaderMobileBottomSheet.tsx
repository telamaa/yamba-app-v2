// apps/user-ui/src/components/layout/header/HeaderMobileBottomSheet.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { DISCOVER_MENU_ITEMS, type MenuItem } from "./menu-items";
import HeaderLocaleSwitcher from "./HeaderLocaleSwitcher";
import HeaderThemeToggle from "./HeaderThemeToggle";
import HeaderUserMenuContent from "./HeaderUserMenuContent";
import { HEADER_COLORS, HEADER_Z_INDEX } from "./header.constants";
import type { HeaderUserState } from "./useHeaderUserState";

type Props = {
  open: boolean;
  onCloseAction: () => void;
  user: HeaderUserState;
  notificationCount?: number;
  messageCount?: number;
};

const SWIPE_DOWN_THRESHOLD_PX = 80;
const IOS_SPRING = "cubic-bezier(0.32, 0.72, 0, 1)";

/**
 * Bottom sheet natif pour le menu mobile.
 *
 * Deux modes selon `user.isAuthenticated` :
 *  - authenticated : réutilise `HeaderUserMenuContent` (variant sheet)
 *  - anonymous     : section "Découvrir Yamba" + Préférences + 2 CTA
 *
 * Comportement :
 *  - tap backdrop → ferme
 *  - swipe down sur le drag handle → ferme (seuil 80px)
 *  - bloque le scroll body quand ouvert
 *  - ferme sur Escape
 *  - safe-area iOS respectée via `env(safe-area-inset-bottom)`
 *
 * Pas de `position: fixed` problématique : le sheet est bien `fixed` mais c'est le
 * pattern attendu. Côté SSR, le composant ne rend rien tant que `open=false`.
 */
export default function HeaderMobileBottomSheet({
                                                  open,
                                                  onCloseAction,
                                                  user,
                                                  notificationCount = 0,
                                                  messageCount = 0,
                                                }: Props) {
  const t = useTranslations("common");
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [dragY, setDragY] = useState(0);
  const dragStartY = useRef<number | null>(null);

  // Bloque le scroll du body et gère Escape
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseAction();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onCloseAction]);

  // Reset dragY quand on ferme
  useEffect(() => {
    if (!open) setDragY(0);
  }, [open]);

  const handleTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    if (delta > 0) setDragY(delta);
  };
  const handleTouchEnd = () => {
    if (dragY > SWIPE_DOWN_THRESHOLD_PX) {
      onCloseAction();
    } else {
      setDragY(0);
    }
    dragStartY.current = null;
  };

  if (!open) return null;

  const isAnonymous = !user.isAuthenticated;

  return (
    <div
      className="fixed inset-0 md:hidden"
      style={{ zIndex: HEADER_Z_INDEX + 10 }}
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label={t("header.closeMenu")}
        onClick={onCloseAction}
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        style={{ transition: `opacity 250ms ${IOS_SPRING}` }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white dark:bg-slate-950"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)",
          transform: `translateY(${dragY}px)`,
          transition: dragStartY.current === null ? `transform 250ms ${IOS_SPRING}` : "none",
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pb-2 pt-2.5">
          <div className="h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        {isAnonymous ? (
          <AnonymousContent onCloseAction={onCloseAction} />
        ) : (
          <HeaderUserMenuContent
            user={user}
            variant="sheet"
            onItemClickAction={onCloseAction}
            notificationCount={notificationCount}
            messageCount={messageCount}
          />
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/* Sub-component : Anonymous mode content                                  */
/* ─────────────────────────────────────────────────────────────────────── */

type AnonymousContentProps = { onCloseAction: () => void };

function AnonymousContent({ onCloseAction }: AnonymousContentProps) {
  const t = useTranslations("common");

  const renderItem = (item: MenuItem, key: string) => {
    if (item.type === "separator") return null;
    const Icon = item.icon;
    return (
      <Link
        key={key}
        href={item.href}
        onClick={onCloseAction}
        className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-900"
      >
        <Icon size={18} className="flex-shrink-0" />
        <span>{t(`discover.${item.labelKey}`)}</span>
      </Link>
    );
  };

  return (
    <div>
      {/* Tagline */}
      <div className="px-4 pb-4 pt-1">
        <p className="text-base font-semibold text-slate-900 dark:text-white">
          {t("header.welcomeTitle")}
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t("header.welcomeSubtitle")}
        </p>
      </div>

      <div className="h-px bg-slate-200 dark:bg-slate-800" aria-hidden />

      {/* Discover */}
      <div className="py-2">
        <p className="px-4 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {t("discover.sectionLabel")}
        </p>
        {DISCOVER_MENU_ITEMS.map((item, i) => renderItem(item, `disc-${i}`))}
      </div>

      <div className="h-px bg-slate-200 dark:bg-slate-800" aria-hidden />

      {/* Preferences */}
      <div className="py-2">
        <p className="px-4 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {t("userMenu.sections.preferences")}
        </p>
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="text-sm text-slate-700 dark:text-slate-200">
            {t("userMenu.preferences.language")}
          </span>
          <HeaderLocaleSwitcher variant="inline" />
        </div>
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="text-sm text-slate-700 dark:text-slate-200">
            {t("userMenu.preferences.theme")}
          </span>
          <HeaderThemeToggle variant="inline" />
        </div>
      </div>

      <div className="h-px bg-slate-200 dark:bg-slate-800" aria-hidden />

      {/* CTAs */}
      <div className="flex flex-col gap-2.5 px-4 py-4">
        <Link
          href="/register"
          onClick={onCloseAction}
          className="flex items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-slate-950 transition-opacity hover:opacity-90"
          style={{ backgroundColor: HEADER_COLORS.mango }}
        >
          {t("header.createAccount")}
        </Link>
        <Link
          href="/login"
          onClick={onCloseAction}
          className="flex items-center justify-center rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900"
        >
          {t("header.login")}
        </Link>
      </div>
    </div>
  );
}

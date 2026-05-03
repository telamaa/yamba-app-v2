// apps/user-ui/src/components/layout/header/HeaderUserMenuContent.tsx
"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@/i18n/navigation";
import { logoutUser as logoutApi } from "@/services/auth.api";
import {
  AUTHENTICATED_MENU_ITEMS,
  SUPPORT_MENU_ITEM,
  type MenuItem,
} from "./menu-items";
import HeaderLocaleSwitcher from "./HeaderLocaleSwitcher";
import HeaderThemeToggle from "./HeaderThemeToggle";
import HeaderUserAvatar from "./HeaderUserAvatar";
import { HEADER_COLORS } from "./header.constants";
import type { HeaderUserState } from "./useHeaderUserState";

type Props = {
  user: HeaderUserState;
  /** Variante : `dropdown` (desktop) ou `sheet` (mobile bottom sheet). */
  variant: "dropdown" | "sheet";
  /** Callback appelé après un click sur un item (pour fermer le dropdown / sheet). */
  onItemClickAction?: () => void;
  /** Compteurs stub. Branchés plus tard via hooks dédiés. */
  notificationCount?: number;
  messageCount?: number;
};

/**
 * Contenu réutilisable du menu utilisateur connecté.
 *
 * Catégorisation cohérente desktop ↔ mobile :
 *  - User card    : toujours présente
 *  - Compte       : items identiques (Mon compte, Envois, Trajets, Notifs, Messages)
 *  - Préférences  : sheet uniquement (langue/thème déjà en top bar desktop)
 *  - Support      : présente partout (Centre d'aide)
 *  - Déconnexion  : isolée en bas, toujours rouge
 */
export default function HeaderUserMenuContent({
                                                user,
                                                variant,
                                                onItemClickAction,
                                                notificationCount = 0,
                                                messageCount = 0,
                                              }: Props) {
  const t = useTranslations("common");
  const router = useRouter();
  const queryClient = useQueryClient();

  const isSheet = variant === "sheet";
  const sectionPadding = isSheet ? "py-2" : "py-1";
  const itemPadding = isSheet ? "py-2.5" : "py-2";

  const handleLogout = async () => {
    try {
      await logoutApi();
    } catch {
      // ignore
    }
    queryClient.setQueryData(["user"], null);
    onItemClickAction?.();
    router.push("/");
    router.refresh();
  };

  const renderBadgeCount = (item: MenuItem) => {
    if (item.type !== "link" || !item.badge) return null;
    const count = item.badge === "notifications" ? notificationCount : messageCount;
    if (count <= 0) return null;
    const bg =
      item.badge === "notifications" ? HEADER_COLORS.danger : HEADER_COLORS.mango;
    const fg = item.badge === "notifications" ? "#fff" : "#1a1a1a";
    return (
      <span
        className="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold"
        style={{ backgroundColor: bg, color: fg }}
      >
        {count > 99 ? "99+" : count}
      </span>
    );
  };

  const renderItem = (item: MenuItem, key: string) => {
    if (item.type === "separator") {
      return (
        <div
          key={key}
          className="my-1 h-px bg-slate-200 dark:bg-slate-800"
          aria-hidden
        />
      );
    }
    const Icon = item.icon;
    return (
      <Link
        key={key}
        href={item.href}
        onClick={onItemClickAction}
        className={`flex items-center gap-3 px-4 ${itemPadding} text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-900`}
      >
        <Icon size={18} className="flex-shrink-0" />
        <span>{t(`userMenu.${item.labelKey}`)}</span>
        {renderBadgeCount(item)}
      </Link>
    );
  };

  const renderSectionLabel = (labelKey: string) => (
    <p className="px-4 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
      {t(`userMenu.sections.${labelKey}`)}
    </p>
  );

  return (
    <div>
      {/* User card */}
      <div className="flex items-center gap-3 px-4 py-4">
        <HeaderUserAvatar
          initials={user.initials}
          avatarUrl={user.avatarUrl}
          size={isSheet ? "xl" : "lg"}
          carrierState={user.carrierState}
          hasPendingAction={user.hasPendingAction}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
              {user.displayName}
            </p>
            {user.carrierState === "active" && (
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{
                  backgroundColor: `${HEADER_COLORS.tealDark}26`,
                  color: HEADER_COLORS.tealDark,
                }}
              >
                {t("userMenu.badges.yamberActive")}
              </span>
            )}
            {user.carrierState === "verified" && (
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{
                  backgroundColor: `${HEADER_COLORS.tealDark}26`,
                  color: HEADER_COLORS.tealDark,
                }}
              >
                {t("userMenu.badges.yamberVerified")}
              </span>
            )}
            {user.carrierState === "pending" && (
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{
                  backgroundColor: `${HEADER_COLORS.mango}26`,
                  color: HEADER_COLORS.mango,
                }}
              >
                {t("userMenu.badges.yamberPending")}
              </span>
            )}
          </div>
          {user.email && (
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {user.email}
            </p>
          )}
        </div>
      </div>

      <div className="h-px bg-slate-200 dark:bg-slate-800" aria-hidden />

      {/* Account section */}
      <div className={sectionPadding}>
        {isSheet && renderSectionLabel("account")}
        {AUTHENTICATED_MENU_ITEMS.map((item, i) => renderItem(item, `acc-${i}`))}
      </div>

      {/* Preferences section (sheet only) */}
      {isSheet && (
        <>
          <div className="h-px bg-slate-200 dark:bg-slate-800" aria-hidden />
          <div className={sectionPadding}>
            {renderSectionLabel("preferences")}
            <div className={`flex items-center justify-between px-4 ${itemPadding}`}>
              <span className="text-sm text-slate-700 dark:text-slate-200">
                {t("userMenu.preferences.language")}
              </span>
              <HeaderLocaleSwitcher variant="inline" />
            </div>
            <div className={`flex items-center justify-between px-4 ${itemPadding}`}>
              <span className="text-sm text-slate-700 dark:text-slate-200">
                {t("userMenu.preferences.theme")}
              </span>
              <HeaderThemeToggle variant="inline" />
            </div>
          </div>
        </>
      )}

      {/* Support section (présente partout — desktop ET mobile) */}
      <div className="h-px bg-slate-200 dark:bg-slate-800" aria-hidden />
      <div className={sectionPadding}>
        {isSheet && renderSectionLabel("support")}
        {renderItem(SUPPORT_MENU_ITEM, "sup-0")}
      </div>

      {/* Logout */}
      <div className="h-px bg-slate-200 dark:bg-slate-800" aria-hidden />
      <button
        type="button"
        onClick={handleLogout}
        className={`flex w-full items-center gap-3 px-4 ${itemPadding} text-sm font-semibold text-red-600 transition-colors hover:bg-slate-50 dark:text-red-400 dark:hover:bg-slate-900`}
      >
        <LogOut size={18} className="flex-shrink-0" />
        <span>{t("userMenu.logout")}</span>
      </button>
    </div>
  );
}

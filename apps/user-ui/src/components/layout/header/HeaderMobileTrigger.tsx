// apps/user-ui/src/components/layout/header/HeaderMobileTrigger.tsx
"use client";

import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import HeaderUserAvatar from "./HeaderUserAvatar";
import { HEADER_COLORS } from "./header.constants";
import type { HeaderUserState } from "./useHeaderUserState";

type Props = {
  user: HeaderUserState;
  onOpenAction: () => void;
};

/**
 * Déclencheur du bottom sheet mobile.
 *
 * Pattern adaptatif :
 *  - utilisateur connecté  → avatar (point d'entrée principal du menu user)
 *  - utilisateur anonyme   → hamburger (point d'entrée navigation publique)
 *
 * Le bottom sheet (`HeaderMobileBottomSheet`) gère lui-même son contenu en
 * fonction de `user.isAuthenticated` ; ce composant ne fait que déclencher.
 */
export default function HeaderMobileTrigger({ user, onOpenAction }: Props) {
  const t = useTranslations("common.header");

  if (user.isAuthenticated) {
    return (
      <button
        type="button"
        onClick={onOpenAction}
        aria-label={t("userMenu")}
        className="flex rounded-full focus:outline-none focus-visible:ring-4"
        style={{ outlineColor: `${HEADER_COLORS.mango}40` }}
      >
        <HeaderUserAvatar
          initials={user.initials}
          avatarUrl={user.avatarUrl}
          size="md"
          carrierState={user.carrierState}
          hasPendingAction={user.hasPendingAction}
        />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpenAction}
      aria-label={t("openMenu")}
      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-4 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
      style={{ outlineColor: `${HEADER_COLORS.mango}40` }}
    >
      <Menu size={18} />
    </button>
  );
}

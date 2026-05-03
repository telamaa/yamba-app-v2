// apps/user-ui/src/components/layout/header/HeaderUserDropdown.tsx
"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useOnClickOutside } from "@/hooks/useOnClickOutside";
import HeaderUserAvatar from "./HeaderUserAvatar";
import HeaderUserMenuContent from "./HeaderUserMenuContent";
import { HEADER_COLORS } from "./header.constants";
import type { HeaderUserState } from "./useHeaderUserState";

type Props = {
  user: HeaderUserState;
  notificationCount?: number;
  messageCount?: number;
};

/**
 * Dropdown desktop ouvert au clic sur l'avatar utilisateur.
 *
 * Réutilise `HeaderUserMenuContent` en variante "dropdown" : pas de section
 * Préférences (déjà dans la top bar desktop), juste Compte et Déconnexion.
 *
 * Fermeture :
 *  - clic en dehors (`useOnClickOutside`)
 *  - clic sur un item (callback `onItemClickAction`)
 *  - touche Escape (gérée par `useOnClickOutside` côté DOM)
 */
export default function HeaderUserDropdown({
                                             user,
                                             notificationCount = 0,
                                             messageCount = 0,
                                           }: Props) {
  const t = useTranslations("common.header");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useOnClickOutside(containerRef, () => setOpen(false), open);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("userMenu")}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex rounded-full transition-shadow hover:ring-2 focus:outline-none focus-visible:ring-4"
        style={{
          outlineColor: `${HEADER_COLORS.mango}40`,
        }}
      >
        <HeaderUserAvatar
          initials={user.initials}
          avatarUrl={user.avatarUrl}
          size="md"
          carrierState={user.carrierState}
          hasPendingAction={user.hasPendingAction}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-3 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950"
        >
          <HeaderUserMenuContent
            user={user}
            variant="dropdown"
            onItemClickAction={() => setOpen(false)}
            notificationCount={notificationCount}
            messageCount={messageCount}
          />
        </div>
      )}
    </div>
  );
}

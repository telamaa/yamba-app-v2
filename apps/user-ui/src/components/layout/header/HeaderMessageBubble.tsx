// apps/user-ui/src/components/layout/header/HeaderMessageBubble.tsx
"use client";

import { MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { HEADER_COLORS } from "./header.constants";

type Props = {
  /** Compteur de conversations avec messages non lus. Stub à 0 pour l'instant. */
  count?: number;
  /** Variante : `desktop` (cercle bg) ou `mobile` (transparent). */
  variant?: "desktop" | "mobile";
};

/**
 * Bulle messages avec badge.
 *
 * Stub : pour l'instant, redirige vers `/dashboard/messages`.
 * Le `count` viendra d'un hook `useUnreadMessages` à brancher plus tard.
 *
 * Volontairement séparé de la cloche notifications pour différencier les
 * conversations Shipper ↔ Yamber (canal de confiance) des événements système.
 */
export default function HeaderMessageBubble({ count = 0, variant = "desktop" }: Props) {
  const t = useTranslations("common.header");

  const wrapperClass =
    variant === "desktop"
      ? "relative flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      : "relative flex h-7 w-7 items-center justify-center text-slate-700 dark:text-slate-200";

  return (
    <Link href="/dashboard/messages" aria-label={t("messages")} className={wrapperClass}>
      <MessageSquare size={variant === "desktop" ? 16 : 18} />
      {count > 0 && (
        <span
          className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full border-2 border-white px-1 text-[10px] font-semibold text-slate-950 dark:border-slate-950"
          style={{ backgroundColor: HEADER_COLORS.mango }}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

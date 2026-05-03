// apps/user-ui/src/components/layout/header/menu-items.ts

import {
  User,
  Inbox,
  Zap,
  Bell,
  MessageSquare,
  HelpCircle,
  Info,
  Compass,
  type LucideIcon,
} from "lucide-react";

export type MenuItem =
  | {
  type: "link";
  labelKey: string;
  href: string;
  icon: LucideIcon;
  /** Clé optionnelle de translation pour un badge count (ex: "3"). */
  badge?: "notifications" | "messages";
}
  | { type: "separator" };

/**
 * Items du bottom sheet / dropdown utilisateur connecté.
 * Les `labelKey` sont résolues via `useTranslations("common.userMenu")`.
 */
export const AUTHENTICATED_MENU_ITEMS: MenuItem[] = [
  { type: "link", labelKey: "myAccount", href: "/dashboard/home", icon: User },
  { type: "link", labelKey: "myShipments", href: "/dashboard/shipments", icon: Inbox },
  { type: "link", labelKey: "myTrips", href: "/dashboard/trips", icon: Zap },
  {
    type: "link",
    labelKey: "notifications",
    href: "/dashboard/notifications",
    icon: Bell,
    badge: "notifications",
  },
  {
    type: "link",
    labelKey: "messages",
    href: "/dashboard/messages",
    icon: MessageSquare,
    badge: "messages",
  },
];

/**
 * Items "Découvrir Yamba" — visibles dans le bottom sheet anonyme.
 * Les `labelKey` sont résolues via `useTranslations("common.discover")`.
 */
export const DISCOVER_MENU_ITEMS: MenuItem[] = [
  { type: "link", labelKey: "howItWorks", href: "/how-it-works", icon: Info },
  { type: "link", labelKey: "becomeYamber", href: "/become-yamber", icon: Compass },
  { type: "link", labelKey: "helpFaq", href: "/help", icon: HelpCircle },
];

/**
 * Item "Centre d'aide" — section Support du bottom sheet authentifié.
 */
export const SUPPORT_MENU_ITEM: MenuItem = {
  type: "link",
  labelKey: "helpCenter",
  href: "/dashboard/help",
  icon: HelpCircle,
};

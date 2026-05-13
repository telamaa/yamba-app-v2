import {
  Home,
  Zap,
  Package,
  Plus,
  MessageSquare,
  Bell,
  BellRing,
  CreditCard,
  Wallet,
  User,
  UserPlus,
  Globe,
  Shield,
  Settings,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";

export type SectionKey =
  | "home"
  | "trips"
  | "shipments"
  | "create"
  | "messages"
  | "notifications"
  | "savedRoutes"
  | "following"
  | "payments"
  | "wallet"
  | "profile"
  | "yamber"
  | "security"
  | "settings"
  | "help";

export type NavGroup = {
  labelKey: string;
  items: NavItem[];
};

export type NavItem = {
  key: SectionKey;
  icon: LucideIcon;
  labelKey: string;
  badge?: number;
  standalone?: boolean;
  /**
   * Slug URL optionnel (override le segment de path par défaut).
   * Utile pour les sections multi-mots : key "savedRoutes" → slug "saved-routes".
   * Si non défini, le path utilisé est /dashboard/{key}.
   */
  slug?: string;
};

export const HOME_ITEM: NavItem = {
  key: "home",
  icon: Home,
  labelKey: "home",
  standalone: true,
};

export const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: "activity",
    items: [
      { key: "trips", icon: Zap, labelKey: "trips", badge: 3 },
      { key: "shipments", icon: Package, labelKey: "shipments" },
      { key: "create", icon: Plus, labelKey: "create" },
    ],
  },
  {
    labelKey: "communication",
    items: [
      { key: "messages", icon: MessageSquare, labelKey: "messages", badge: 2 },
      { key: "notifications", icon: Bell, labelKey: "notifications", badge: 5 },
    ],
  },
  {
    labelKey: "alerts",
    items: [
      {
        key: "savedRoutes",
        icon: BellRing,
        labelKey: "savedRoutes",
        slug: "saved-routes",
      },
      {
        key: "following",
        icon: UserPlus,
        labelKey: "following",
      },
    ],
  },
  {
    labelKey: "finances",
    items: [
      { key: "payments", icon: CreditCard, labelKey: "payments" },
      { key: "wallet", icon: Wallet, labelKey: "wallet" },
    ],
  },
  {
    labelKey: "account",
    items: [
      { key: "profile", icon: User, labelKey: "profile" },
      { key: "yamber", icon: Globe, labelKey: "yamber" },
    ],
  },
  {
    labelKey: "settingsGroup",
    items: [
      { key: "security", icon: Shield, labelKey: "security" },
      { key: "settings", icon: Settings, labelKey: "settings" },
      { key: "help", icon: HelpCircle, labelKey: "help" },
    ],
  },
];

export type MobileTab = "home" | "activity" | "messages" | "payments" | "more";

export const MOBILE_TABS: {
  key: MobileTab;
  icon: LucideIcon;
  labelKey: string;
}[] = [
  { key: "home", icon: Home, labelKey: "home" },
  { key: "activity", icon: Zap, labelKey: "activity" },
  { key: "messages", icon: MessageSquare, labelKey: "messages" },
  { key: "payments", icon: CreditCard, labelKey: "finances" },
  { key: "more", icon: Settings, labelKey: "more" },
];

export const MOBILE_TAB_SECTIONS: Record<MobileTab, SectionKey[]> = {
  home: ["home"],
  activity: ["trips", "shipments", "savedRoutes", "following"],
  messages: ["messages"],
  payments: ["payments"],
  more: [
    "security",
    "settings",
    "help",
    "notifications",
    "profile",
    "yamber",
    "wallet",
    "create",
  ],
};

export const DEFAULT_SECTION: SectionKey = "home";

/**
 * Construit le segment d'URL pour un NavItem (utilise slug si défini, sinon key).
 * Permet de centraliser la logique slug-or-key pour tous les composants nav.
 */
export function getNavItemPath(item: NavItem): string {
  return item.slug ?? item.key;
}

/**
 * Résout un segment d'URL (ex: "saved-routes") vers sa SectionKey (ex: "savedRoutes").
 * Si le segment matche un slug, retourne le key correspondant.
 * Sinon, si le segment matche déjà un key, le retourne tel quel.
 * Sinon, retourne DEFAULT_SECTION.
 */
export function resolveSectionKey(segment: string): SectionKey {
  if (HOME_ITEM.slug === segment || HOME_ITEM.key === segment) {
    return HOME_ITEM.key;
  }
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (item.slug === segment || item.key === segment) {
        return item.key;
      }
    }
  }
  return DEFAULT_SECTION;
}

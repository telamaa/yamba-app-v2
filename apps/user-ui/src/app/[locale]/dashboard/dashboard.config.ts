import {
  Home,
  Zap,
  Package,
  MessageSquare,
  Bell,
  BellRing,
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
  | "create" // ⚠️ hors nav (action, pas destination) — segment conservé pour compat
  | "messages"
  | "notifications"
  | "savedRoutes"
  | "following"
  | "finances" // ✨ fusion Paiements + Portefeuille (chantier Stripe backend)
  | "payments" // ⚠️ deprecated — segment aliasé vers finances
  | "wallet" // ⚠️ deprecated — segment aliasé vers finances
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

/**
 * Nav = destinations uniquement. Les actions (créer un trajet) vivent dans
 * les CTA contextuels (Mes trajets, header, raccourcis home).
 *
 * Badges : "trips" est calculé dynamiquement dans DashboardSidebar
 * (demandes reçues + brouillons/pauses). "shipments" viendra avec le
 * backend bookings. "messages"/"notifications" viendront avec leurs
 * chantiers respectifs (messagerie V2 / événements state machine).
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: "activity",
    items: [
      { key: "trips", icon: Zap, labelKey: "trips" },
      { key: "shipments", icon: Package, labelKey: "shipments" },
    ],
  },
  {
    labelKey: "communication",
    items: [
      { key: "messages", icon: MessageSquare, labelKey: "messages" },
      { key: "notifications", icon: Bell, labelKey: "notifications" },
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
    items: [{ key: "finances", icon: Wallet, labelKey: "finances" }],
  },
  {
    labelKey: "account",
    items: [
      { key: "profile", icon: User, labelKey: "profile" },
      // "yamber" : masqué dans DashboardSidebar si l'utilisateur est déjà carrier
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

/**
 * Aliases de segments URL → SectionKey.
 * Compat ascendante : les anciennes URLs /dashboard/payments et
 * /dashboard/wallet (utilisée par BecomeYamber) rendent la section
 * finances. /dashboard/create reste résolvable (hors nav).
 */
const SEGMENT_ALIASES: Record<string, SectionKey> = {
  payments: "finances",
  wallet: "finances",
  create: "create",
};

export type MobileTab = "home" | "activity" | "messages" | "finances" | "more";

export const MOBILE_TABS: {
  key: MobileTab;
  icon: LucideIcon;
  labelKey: string;
}[] = [
  { key: "home", icon: Home, labelKey: "home" },
  { key: "activity", icon: Zap, labelKey: "activity" },
  { key: "messages", icon: MessageSquare, labelKey: "messages" },
  { key: "finances", icon: Wallet, labelKey: "finances" },
  { key: "more", icon: Settings, labelKey: "more" },
];

export const MOBILE_TAB_SECTIONS: Record<MobileTab, SectionKey[]> = {
  home: ["home"],
  activity: ["trips", "shipments", "savedRoutes", "following"],
  messages: ["messages"],
  finances: ["finances", "payments", "wallet"],
  more: ["security", "settings", "help", "notifications", "profile", "yamber"],
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
 * Ordre : aliases (compat) → home → nav groups → défaut.
 */
export function resolveSectionKey(segment: string): SectionKey {
  if (segment in SEGMENT_ALIASES) {
    return SEGMENT_ALIASES[segment];
  }
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

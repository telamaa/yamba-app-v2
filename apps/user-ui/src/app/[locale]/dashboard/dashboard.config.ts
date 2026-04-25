import {
  Home,
  Zap,
  Package,
  Plus,
  MessageSquare,
  Bell,
  CreditCard,
  Wallet,
  User,
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
  | "payments"
  | "wallet"
  | "profile"
  | "yamber"
  | "security"
  | "settings"
  | "help";

export type NavGroup = {
  /** Clé de traduction dans messages/{locale}/dashboard.json sous "groups" */
  labelKey: string;
  items: NavItem[];
};

export type NavItem = {
  key: SectionKey;
  icon: LucideIcon;
  /** Clé de traduction dans messages/{locale}/dashboard.json sous "sections" */
  labelKey: string;
  badge?: number;
  standalone?: boolean;
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
  activity: ["trips", "shipments"],
  messages: ["messages"],
  payments: ["payments"],
  more: ["security", "settings", "help", "notifications", "profile", "yamber", "wallet", "create"],
};

export const DEFAULT_SECTION: SectionKey = "home";

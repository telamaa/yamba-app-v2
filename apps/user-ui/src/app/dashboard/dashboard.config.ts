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
  labelFr: string;
  labelEn: string;
  items: NavItem[];
};

export type NavItem = {
  key: SectionKey;
  icon: LucideIcon;
  labelFr: string;
  labelEn: string;
  badge?: number;
  standalone?: boolean;
};

export const HOME_ITEM: NavItem = {
  key: "home",
  icon: Home,
  labelFr: "Accueil",
  labelEn: "Home",
  standalone: true,
};

export const NAV_GROUPS: NavGroup[] = [
  {
    labelFr: "Activité",
    labelEn: "Activity",
    items: [
      { key: "trips", icon: Zap, labelFr: "Mes trajets", labelEn: "My trips", badge: 3 },
      { key: "shipments", icon: Package, labelFr: "Mes envois", labelEn: "My shipments" },
      { key: "create", icon: Plus, labelFr: "Créer un trajet", labelEn: "Create a trip" },
    ],
  },
  {
    labelFr: "Communication",
    labelEn: "Communication",
    items: [
      { key: "messages", icon: MessageSquare, labelFr: "Messages", labelEn: "Messages", badge: 2 },
      { key: "notifications", icon: Bell, labelFr: "Notifications", labelEn: "Notifications", badge: 5 },
    ],
  },
  {
    labelFr: "Finances",
    labelEn: "Finances",
    items: [
      { key: "payments", icon: CreditCard, labelFr: "Paiements", labelEn: "Payments" },
      { key: "wallet", icon: Wallet, labelFr: "Portefeuille", labelEn: "Wallet" },
    ],
  },
  {
    labelFr: "Compte",
    labelEn: "Account",
    items: [
      { key: "profile", icon: User, labelFr: "Profil", labelEn: "Profile" },
      { key: "yamber", icon: Globe, labelFr: "Devenir Yamber", labelEn: "Become a Yamber" },
    ],
  },
  {
    labelFr: "Réglages",
    labelEn: "Settings",
    items: [
      { key: "security", icon: Shield, labelFr: "Sécurité", labelEn: "Security" },
      { key: "settings", icon: Settings, labelFr: "Paramètres", labelEn: "Settings" },
      { key: "help", icon: HelpCircle, labelFr: "Aide", labelEn: "Help" },
    ],
  },
];

export type MobileTab = "home" | "activity" | "messages" | "payments" | "more";

export const MOBILE_TABS: {
  key: MobileTab;
  icon: LucideIcon;
  labelFr: string;
  labelEn: string;
}[] = [
  { key: "home", icon: Home, labelFr: "Accueil", labelEn: "Home" },
  { key: "activity", icon: Zap, labelFr: "Activité", labelEn: "Activity" },
  { key: "messages", icon: MessageSquare, labelFr: "Messages", labelEn: "Messages" },
  { key: "payments", icon: CreditCard, labelFr: "Finances", labelEn: "Finances" },
  { key: "more", icon: Settings, labelFr: "Plus", labelEn: "More" },
];

export const MOBILE_TAB_SECTIONS: Record<MobileTab, SectionKey[]> = {
  home: ["home"],
  activity: ["trips", "shipments"],
  messages: ["messages"],
  payments: ["payments"],
  more: ["security", "settings", "help", "notifications", "profile", "yamber", "wallet", "create"],
};

export const DEFAULT_SECTION: SectionKey = "home";

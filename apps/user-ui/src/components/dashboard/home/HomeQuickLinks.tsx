"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  MessageSquare,
  Package,
  Plus,
  User,
  Wallet,
  Zap,
} from "lucide-react";

/** Raccourcis de la home — rétrogradés sous le feed d'actions. */
export default function HomeQuickLinks() {
  const t = useTranslations("dashboardHome");

  const links = [
    { href: "/trips/create", icon: Plus, label: t("quickLinks.createTrip") },
    { href: "/dashboard/shipments", icon: Package, label: t("quickLinks.myShipments") },
    { href: "/dashboard/trips", icon: Zap, label: t("quickLinks.myTrips") },
    { href: "/dashboard/messages", icon: MessageSquare, label: t("quickLinks.messages") },
    { href: "/dashboard/wallet", icon: Wallet, label: t("quickLinks.wallet") },
    { href: "/dashboard/profile", icon: User, label: t("quickLinks.profile") },
  ];

  return (
    <section className="mt-8">
      <div className="mb-2 flex items-center gap-2 px-0.5">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
        <h2 className="text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {t("quickLinks.title")}
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {links.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-2.5 rounded-lg bg-white px-4 py-3 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800/60"
          >
            <Icon size={16} className="flex-shrink-0 text-slate-400 dark:text-slate-500" />
            <span className="truncate">{label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import useUser from "@/hooks/useUser";
import { useTripsBadge } from "@/hooks/useTripsBadge";
import {
  HOME_ITEM,
  NAV_GROUPS,
  getNavItemPath,
  resolveSectionKey,
  type NavItem,
  type SectionKey,
} from "@/app/[locale]/dashboard/dashboard.config";

const MANGO = "#FF9900";

export default function DashboardSidebar() {
  const pathname = usePathname();
  const t = useTranslations("dashboard");

  // usePathname de @/i18n/navigation renvoie le path SANS la locale
  const lastSegment = pathname?.split("/").pop() ?? "home";
  const activeSection = resolveSectionKey(lastSegment);

  /* ── Masquage conditionnel : "Devenir Yamber" si déjà carrier ── */
  const { user } = useUser();
  const isCarrier = Boolean((user as any)?.roles?.includes("CARRIER"));

  /* ── Badge "Mes trajets" (A44) : demandes en attente + brouillons/pauses —
     hook partagé avec la barre mobile. "shipments"/"messages" viendront
     avec leurs chantiers. */
  const tripsBadge = useTripsBadge();

  const dynamicBadges: Partial<Record<SectionKey, number>> = {
    trips: tripsBadge,
  };

  const renderItem = (item: NavItem, isActive: boolean) => {
    const Icon = item.icon;
    const badge =
      item.key in dynamicBadges ? dynamicBadges[item.key] : item.badge;
    return (
      <Link
        key={item.key}
        href={`/dashboard/${getNavItemPath(item)}`}
        className={[
          "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] transition-colors",
          isActive
            ? "font-medium text-slate-900 bg-slate-100 dark:text-[#FFB84D] dark:bg-[#FF9900]/10"
            : "text-slate-500 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/50",
        ].join(" ")}
      >
        <Icon
          size={18}
          className={isActive ? "opacity-100" : "opacity-50"}
          style={isActive ? { color: MANGO } : undefined}
        />
        <span className="flex-1 truncate">
          {t(`sections.${item.labelKey}`)}
        </span>
        {badge !== undefined && badge > 0 && (
          <span
            className="ml-auto min-w-[20px] rounded-full px-1.5 py-px text-center text-[11px] font-medium text-slate-900"
            style={{ backgroundColor: MANGO }}
          >
            {badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside className="flex w-[200px] flex-col">
      {/* Home — standalone */}
      <div className="mb-3">
        {renderItem(HOME_ITEM, activeSection === "home")}
      </div>

      {/* Nav groups */}
      <nav className="flex-1">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter(
            (item) => !(item.key === "yamber" && isCarrier)
          );
          if (items.length === 0) return null;
          return (
            <div key={group.labelKey} className="mb-1">
              <div className="pb-1 pt-3 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {t(`groups.${group.labelKey}`)}
              </div>
              {items.map((item) =>
                renderItem(item, activeSection === item.key)
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

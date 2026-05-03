"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  MOBILE_TAB_SECTIONS,
  MOBILE_TABS,
  MobileTab,
} from "@/app/[locale]/dashboard/dashboard.config";

const MANGO_DARK = "#CC7A00";

function getActiveMobileTab(pathname: string): MobileTab {
  const segment = pathname.split("/").pop() ?? "";

  for (const [tab, sections] of Object.entries(MOBILE_TAB_SECTIONS)) {
    if ((sections as string[]).includes(segment)) {
      return tab as MobileTab;
    }
  }
  return "home";
}

export default function DashboardMobileNav() {
  const pathname = usePathname();
  const t = useTranslations();
  const activeTab = getActiveMobileTab(pathname ?? "");

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex justify-around border-t border-slate-100 bg-white pb-[env(safe-area-inset-bottom)] pt-2 dark:border-slate-900 dark:bg-slate-950">
      {MOBILE_TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        const Icon = tab.icon;
        const firstSection = MOBILE_TAB_SECTIONS[tab.key][0];

        return (
          <Link
            key={tab.key}
            href={`/dashboard/${firstSection}`}
            className={[
              "flex flex-col items-center gap-0.5 px-2 py-1 text-[10px]",
              isActive ? "font-medium" : "",
            ].join(" ")}
            style={{ color: isActive ? MANGO_DARK : undefined }}
          >
            <Icon
              size={22}
              className={isActive ? "" : "text-slate-400 dark:text-slate-500"}
            />
            <span
              className={isActive ? "" : "text-slate-400 dark:text-slate-500"}
            >
              {t(tab.labelKey)}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {HOME_ITEM, NAV_GROUPS, SectionKey} from "@/app/dashboard/dashboard.config";


const MANGO = "#FF9900";

type Props = {
  isFr: boolean;
};

export default function DashboardSidebar({ isFr }: Props) {
  const pathname = usePathname();
  const activeSection = (pathname?.split("/").pop() ?? "home") as SectionKey;

  const renderItem = (item: typeof HOME_ITEM, isActive: boolean) => {
    const Icon = item.icon;
    return (
      <Link
        key={item.key}
        href={`/dashboard/${item.key}`}
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
          {isFr ? item.labelFr : item.labelEn}
        </span>
        {item.badge && (
          <span
            className="ml-auto min-w-[20px] rounded-full px-1.5 py-px text-center text-[11px] font-medium text-slate-900"
            style={{ backgroundColor: MANGO }}
          >
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside className="hidden md:flex w-[200px] flex-col flex-shrink-0 pt-1 sticky top-[98spx] h-[calc(100vh-104px)] overflow-y-auto">
      {/* Home — standalone */}
      <div className="mb-3">
        {renderItem(HOME_ITEM, activeSection === "home")}
      </div>

      {/* Nav groups */}
      <nav className="flex-1">
        {NAV_GROUPS.map((group) => (
          <div key={group.labelEn} className="mb-1">
            <div className="pb-1 pt-3 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {isFr ? group.labelFr : group.labelEn}
            </div>

            {group.items.map((item) => renderItem(item, activeSection === item.key))}
          </div>
        ))}
      </nav>
    </aside>
  );
}

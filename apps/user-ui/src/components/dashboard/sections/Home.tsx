"use client";

import Link from "next/link";
import {
  Plus,
  MessageSquare,
  CreditCard,
  Globe,
  Shield,
  User,
  Settings,
  HelpCircle,
} from "lucide-react";
import useUser from "@/hooks/useUser";
import { DashboardCopy } from "@/app/dashboard/dashboard.copy";
import { getUserInitials, formatDisplayName } from "@/lib/format-user";

const MANGO = "#FF9900";

const QUICK_ACTIONS = (copy: DashboardCopy) => [
  { label: copy.qaCreateTrip, href: "/dashboard/create", icon: Plus },
  { label: copy.qaMessages, href: "/dashboard/messages", icon: MessageSquare },
  { label: copy.qaPayments, href: "/dashboard/payments", icon: CreditCard },
  { label: copy.qaYamber, href: "/dashboard/yamber", icon: Globe },
  { label: copy.qaSecurity, href: "/dashboard/security", icon: Shield },
  { label: copy.qaProfile, href: "/dashboard/profile", icon: User },
  { label: copy.qaSettings, href: "/dashboard/settings", icon: Settings },
  { label: copy.qaHelp, href: "/dashboard/help", icon: HelpCircle },
];

export default function HomeSection({ copy }: { copy: DashboardCopy }) {
  const { user } = useUser();

  const initials = getUserInitials(user?.firstName, user?.lastName);
  const displayName = formatDisplayName(user?.firstName, user?.lastName);
  const email = user?.email ?? "";
  const avatarUrl = user?.avatar?.url ?? null;

  return (
    <div className="flex flex-col items-center pt-4 pb-8">
      {/* Avatar */}
      <div
        className="grid h-20 w-20 place-items-center overflow-hidden rounded-full text-2xl font-semibold text-slate-900"
        style={!avatarUrl ? { backgroundColor: MANGO } : undefined}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          initials
        )}
      </div>

      {/* Name & email */}
      <h1 className="mt-4 text-2xl font-semibold text-slate-900 dark:text-white">
        {displayName}
      </h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {email}
      </p>

      {/* Quick action pills */}
      <div className="mt-8 flex flex-wrap justify-center gap-2.5">
        {QUICK_ACTIONS(copy).map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <Icon size={16} className="opacity-60" />
              {action.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

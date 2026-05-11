"use client";

import { useTranslations } from "next-intl";
import { Star } from "lucide-react";
import type { PublicUser } from "@/lib/public-user.types";
import { calculateGlobalRating } from "@/lib/public-user.helpers";

type Props = {
  user: PublicUser;
};

export default function UserStatsRow({ user }: Props) {
  const t = useTranslations("userProfile.stats");
  const globalRating = calculateGlobalRating(user);

  return (
    <div className="grid grid-cols-3 gap-2">
      <StatCard
        label={t("trips")}
        value={user.stats.tripsPublishedCount.toString()}
      />
      <StatCard
        label={t("parcelsCarried")}
        value={user.stats.parcelsCarriedCount.toString()}
      />
      <StatCard
        label={t("globalRating")}
        value={
          globalRating ? (
            <span className="inline-flex items-center gap-1">
              <Star size={15} className="fill-[#FF9900] text-[#FF9900]" />
              {globalRating.average.toFixed(1).replace(".", ",")}
            </span>
          ) : (
            <span className="text-sm font-medium italic text-slate-400 dark:text-slate-500">
              {t("notRatedYet")}
            </span>
          )
        }
      />
    </div>
  );
}

function StatCard({
                    label,
                    value,
                  }: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
      <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}

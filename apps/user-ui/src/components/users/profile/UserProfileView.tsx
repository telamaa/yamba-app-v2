"use client";

import { useTranslations } from "next-intl";
import type { PublicUser } from "@/lib/public-user.types";
import UserHero from "./UserHero";
import UserStatsRow from "./UserStatsRow";
import TripperBlock from "./TripperBlock";
import ShipperBlock from "./ShipperBlock";
import FollowSidebar from "./FollowSidebar";

type Props = {
  user: PublicUser;
};

export default function UserProfileView({ user }: Props) {
  const t = useTranslations("userProfile");
  return (
    // <div className="mx-auto max-w-7xl px-4 py-6 lg:py-8">
    <div className="mx-auto max-w-7xl px-4 py-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* D67 (ANO-WEB-21) — le propriétaire voit sa page même masquée : on le lui signale. */}
      {user.hidden && (
        <div role="status" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          {t("hiddenBanner")}
        </div>
      )}
      {/* Hero pleine largeur */}
      <div className="mb-4 lg:mb-5">
        <UserHero user={user} />
      </div>

      {/* Layout 2 colonnes desktop, stack mobile */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-5">
        {/* ── Colonne principale ──────────────────────── */}
        <main className="space-y-4 lg:order-1">
          <UserStatsRow user={user} />

          {user.tripper && (
            <TripperBlock
              tripper={user.tripper}
              tripperRating={user.tripperRating}
              reputation={user.reputation?.carrier ?? null}
              firstName={user.firstName}
              userSlug={user.publicSlug}
            />
          )}

          <ShipperBlock
            reputation={user.reputation?.shipper ?? null}
            shipper={user.shipper}
            shipperRating={user.shipperRating}
            parcelsSentCount={user.stats.parcelsSentCount}
            firstName={user.firstName}
          />
        </main>

        {/* ── Sidebar ─────────────────────────────────── */}
        <aside className="lg:order-2">
          <div className="lg:sticky lg:top-6">
            <FollowSidebar user={user} />
          </div>
        </aside>
      </div>
    </div>
  );
}

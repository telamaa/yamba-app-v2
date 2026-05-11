"use client";

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
  return (
    // <div className="mx-auto max-w-7xl px-4 py-6 lg:py-8">
    <div className="mx-auto max-w-7xl px-4 py-6 lg:grid-cols-[minmax(0,1fr)_320px]">
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
              firstName={user.firstName}
              userSlug={user.publicSlug}
            />
          )}

          <ShipperBlock
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

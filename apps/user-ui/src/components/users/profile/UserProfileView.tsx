"use client";

import { useTranslations } from "next-intl";
import type { PublicUser } from "@/lib/public-user.types";
import UserHero from "./UserHero";
import UserStatsRow from "./UserStatsRow";
import TripperBlock from "./TripperBlock";
import ShipperBlock from "./ShipperBlock";
import FollowSidebar from "./FollowSidebar";
import { conteneurDePage } from "@/lib/layout/largeur-de-page";

type Props = {
  user: PublicUser;
};

export default function UserProfileView({ user }: Props) {
  const t = useTranslations("userProfile");
  return (
    // D110 avait noté ici « la grille à deux colonnes de cette page n'a
    // jamais fonctionné », et avait reculé devant la correction en croyant
    // qu'elle déplacerait tout le contenu.
    //
    // MESURÉ DANS LE DOM le 28/11/2026 (Chrome système, 1440 px) : c'est
    // FAUX. La grille à deux colonnes marche — elle est portée par le div
    // intérieur, qui a bien son `grid` (`main` 932 px à x=104, l'aside
    // 280 px à x=1056). Ce qui ne marchait pas, c'était la déclaration
    // EXTÉRIEURE : `grid-template-columns` y était calculée et sans effet,
    // faute de `display: grid`. Une classe morte, vestige d'un découpage
    // antérieur — pas un défaut de mise en page.
    //
    // La supprimer ne déplace donc rien : re-mesuré après, les quatre
    // nombres sont identiques. **Une dette décrite de travers coûte plus
    // cher que la dette elle-même** : celle-ci a vécu dix-huit jours parce
    // que sa description faisait peur.
    <div className={conteneurDePage("py-6")}>
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

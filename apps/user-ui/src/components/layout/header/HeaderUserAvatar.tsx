// apps/user-ui/src/components/layout/header/HeaderUserAvatar.tsx
"use client";

import { Check } from "lucide-react";
import { HEADER_COLORS } from "./header.constants";
import type { CarrierState } from "./useHeaderUserState";

type Size = "sm" | "md" | "lg" | "xl";

const SIZE_MAP: Record<Size, { box: string; font: string; indicator: number }> = {
  sm: { box: "h-7 w-7", font: "text-[11px]", indicator: 12 },
  md: { box: "h-9 w-9", font: "text-[13px]", indicator: 14 },
  lg: { box: "h-10 w-10", font: "text-[14px]", indicator: 16 },
  xl: { box: "h-12 w-12", font: "text-[16px]", indicator: 18 },
};

type Props = {
  initials: string;
  avatarUrl: string | null;
  size?: Size;
  carrierState?: CarrierState;
  hasPendingAction?: boolean;
};

/**
 * Avatar utilisateur avec indicateurs de statut.
 *
 * Indicateurs (mutuellement exclusifs, priorité haut→bas) :
 *  - dot orange si `hasPendingAction` (onboarding Yamber à terminer)
 *  - check teal si `carrierState === "verified"` (super carrier)
 *
 * Aucune indication pour `active` ou `none` (pas de bruit visuel inutile).
 */
export default function HeaderUserAvatar({
                                           initials,
                                           avatarUrl,
                                           size = "md",
                                           carrierState = "none",
                                           hasPendingAction = false,
                                         }: Props) {
  const { box, font, indicator } = SIZE_MAP[size];
  const indicatorPx = indicator;

  return (
    <span className="relative inline-flex flex-shrink-0">
      <span
        className={`flex ${box} items-center justify-center overflow-hidden rounded-full font-bold text-slate-950`}
        style={!avatarUrl ? { backgroundColor: HEADER_COLORS.mango } : undefined}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className={font}>{initials}</span>
        )}
      </span>

      {hasPendingAction && (
        <span
          aria-hidden
          className="absolute right-0 top-0 rounded-full border-2 border-white dark:border-slate-950"
          style={{
            width: indicatorPx,
            height: indicatorPx,
            backgroundColor: HEADER_COLORS.mango,
          }}
        />
      )}

      {!hasPendingAction && carrierState === "verified" && (
        <span
          aria-label="Yamber vérifié"
          className="absolute -right-0.5 -bottom-0.5 flex items-center justify-center rounded-full border-2 border-white text-white dark:border-slate-950"
          style={{
            width: indicatorPx,
            height: indicatorPx,
            backgroundColor: HEADER_COLORS.tealDark,
          }}
        >
          <Check size={Math.max(8, indicatorPx - 6)} strokeWidth={3} />
        </span>
      )}
    </span>
  );
}

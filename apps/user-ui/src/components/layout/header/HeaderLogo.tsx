"use client";

import { Link } from "@/i18n/navigation";
import { HEADER_COLORS } from "./header.constants";

type Props = {
  /** Mode compact (logo plus petit après scroll). */
  compact?: boolean;
  /** Variante mobile : tailles légèrement réduites pour l'écran étroit. */
  mobile?: boolean;
};

/**
 * Logo Yamba + badge BETA en exposant discret.
 *
 * Le badge BETA est affiché en exposant orange (`Yamba^BETA`) aussi bien en
 * desktop qu'en mobile pour cohérence avec le footer. Pas de pill encombrant.
 */
export default function HeaderLogo({ compact = false, mobile = false }: Props) {
  const squareSize = compact ? "h-8 w-8" : mobile ? "h-[30px] w-[30px]" : "h-9 w-9";
  const squareRadius = mobile ? "rounded-[7px]" : "rounded-xl";
  const labelSize = mobile ? "text-[15px]" : "text-xl";
  const betaSize = mobile ? "text-[8px]" : "text-[10px]";

  return (
    <Link href="/" className="flex items-center gap-2 md:gap-3" aria-label="Yamba">
      <div
        className={`grid place-items-center ${squareSize} ${squareRadius} text-slate-950 transition-all`}
        style={{ backgroundColor: HEADER_COLORS.mango }}
      >
        <span className="font-bold leading-none" style={{ fontSize: mobile ? 15 : 14 }}>
          Y
        </span>
      </div>

      <span
        className={`${labelSize} font-semibold tracking-tight text-slate-900 dark:text-white`}
      >
        Yamba
        <span
          className={`ml-1 align-super ${betaSize} font-semibold`}
          style={{ color: HEADER_COLORS.mango }}
        >
          BETA
        </span>
      </span>
    </Link>
  );
}

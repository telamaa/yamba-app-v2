"use client";

import { Link } from "@/i18n/navigation";
import YambaSymbol from "@/components/brand/YambaSymbol";
import { HEADER_COLORS } from "./header.constants";

type Props = {
  /** Mode compact (logo plus petit après scroll). */
  compact?: boolean;
  /** Variante mobile : tailles légèrement réduites pour l'écran étroit. */
  mobile?: boolean;
};

/**
 * Logo Yamba (symbole M1 « Porter ») + mot « Yamba » + badge BETA en exposant.
 *
 * Le mot reste du texte dans la police système du site (SF Pro sur Mac,
 * Segoe UI sur Windows, Roboto sur Android) pour coller au reste de l'interface.
 * Le badge BETA est en exposant orange, comme dans le footer.
 */
export default function HeaderLogo({ compact = false, mobile = false }: Props) {
  const symbolSize = compact ? 28 : mobile ? 26 : 32;
  const labelSize = mobile ? "text-[15px]" : "text-xl";
  const betaSize = mobile ? "text-[8px]" : "text-[10px]";

  return (
    <Link href="/" className="flex items-center gap-2 md:gap-2.5" aria-label="Yamba">
      <YambaSymbol size={symbolSize} className="shrink-0 transition-all" />

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

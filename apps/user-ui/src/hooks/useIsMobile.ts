/**
 * useIsMobile.ts
 * ==============
 * Detect whether the viewport is below Tailwind's `md` breakpoint (768px).
 * Returns `null` during SSR / before mount so callers can render a neutral
 * fallback and avoid hydration mismatches.
 */

"use client";

import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT_PX = 768;

export function useIsMobile(): boolean | null {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  return isMobile;
}

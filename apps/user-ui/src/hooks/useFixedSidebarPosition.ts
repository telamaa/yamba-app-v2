"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

type FixedRect = {
  /** True quand l'élément doit basculer en position:fixed */
  isFixed: boolean;
  /** Coordonnée left absolue (px depuis le viewport gauche) */
  left: number;
  /** Largeur de l'élément (mesurée sur le placeholder parent) */
  width: number;
  /** Hauteur de l'élément placeholder (pour réserver l'espace dans le DOM) */
  placeholderHeight: number;
};

/**
 * Hook pour positionner un élément en `position: fixed` quand son
 * placeholder parent passe au-dessus d'un seuil de scroll.
 *
 * Utilise `getBoundingClientRect` du placeholder pour calculer left/width.
 * Marche dans 100% des contextes DOM (résiste aux overflow / transform /
 * contain des parents, contrairement à `position: sticky`).
 *
 * @param topOffset Distance depuis le top du viewport quand l'élément se fige.
 *
 * @example
 * const { placeholderRef, fixedRect } = useFixedSidebarPosition(178);
 *
 * <div ref={placeholderRef} className="hidden lg:block">
 *   {fixedRect.isFixed && <div style={{ height: fixedRect.placeholderHeight }} />}
 *   <div
 *     style={fixedRect.isFixed ? {
 *       position: 'fixed',
 *       top: 178,
 *       left: fixedRect.left,
 *       width: fixedRect.width,
 *     } : undefined}
 *   >
 *     <SearchFiltersSidebar />
 *   </div>
 * </div>
 */
export function useFixedSidebarPosition(topOffset: number) {
  const placeholderRef = useRef<HTMLDivElement | null>(null);
  const measuredHeightRef = useRef(0);

  const [fixedRect, setFixedRect] = useState<FixedRect>({
    isFixed: false,
    left: 0,
    width: 0,
    placeholderHeight: 0,
  });

  // Recalcule les dimensions et l'état fixed à chaque scroll/resize
  const recompute = () => {
    const el = placeholderRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const shouldBeFixed = rect.top <= topOffset;

    // Si on n'est pas en mode fixed, on mesure la hauteur "naturelle"
    // de l'élément (utile pour le placeholder quand on bascule en fixed).
    if (!shouldBeFixed) {
      measuredHeightRef.current = rect.height;
    }

    setFixedRect({
      isFixed: shouldBeFixed,
      left: rect.left,
      width: rect.width,
      placeholderHeight: measuredHeightRef.current,
    });
  };

  useLayoutEffect(() => {
    recompute();
    // Initial measurement after mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onScroll = () => recompute();
    const onResize = () => recompute();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    // Observe le placeholder pour détecter les changements de layout
    // (ex: ouverture/fermeture de filtres qui changent la largeur)
    const el = placeholderRef.current;
    let resizeObserver: ResizeObserver | null = null;
    if (el && typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => recompute());
      resizeObserver.observe(el);
    }

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      resizeObserver?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topOffset]);

  return {
    placeholderRef,
    fixedRect,
  };
}

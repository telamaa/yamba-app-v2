"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

type StickyStyle = {
  position: "fixed";
  top: number;
  width: number;
};

type Result = {
  /** Référence à attacher au CONTENEUR PARENT (pour mesurer la largeur et la position). */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Référence à attacher à l'ELEMENT STICKY lui-même (pour mesurer sa hauteur). */
  stickyRef: React.RefObject<HTMLDivElement | null>;
  /** True si l'élément doit être en position fixed. */
  isSticky: boolean;
  /** Style à appliquer quand isSticky=true. À spread sur l'élément. */
  stickyStyle: StickyStyle | null;
  /** Hauteur (réservée) pour éviter le saut de layout quand l'élément devient fixed. */
  placeholderHeight: number;
};

/**
 * Hook pour rendre un élément "sticky" en utilisant `position: fixed` et un calcul JS,
 * plutôt que `position: sticky` natif (qui peut échouer selon les contextes parents).
 *
 * Pattern Booking / Skyscanner / Linear : robuste, marche dans 100% des cas.
 *
 * @param topOffset Distance depuis le top du viewport quand l'élément devient sticky.
 *
 * @example
 * const { containerRef, stickyRef, isSticky, stickyStyle, placeholderHeight } = useStickyOnScroll(158);
 *
 * <div ref={containerRef}>
 *   {isSticky && <div style={{ height: placeholderHeight }} />}
 *   <div ref={stickyRef} style={isSticky ? stickyStyle : undefined}>
 *     <Sidebar ... />
 *   </div>
 * </div>
 */
export function useStickyOnScroll(topOffset: number): Result {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stickyRef = useRef<HTMLDivElement | null>(null);

  const [isSticky, setIsSticky] = useState(false);
  const [width, setWidth] = useState(0);
  const [placeholderHeight, setPlaceholderHeight] = useState(0);

  // ── Mesure la largeur du conteneur (utilisée pour figer la sidebar à la bonne taille) ──
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => {
      setWidth(container.getBoundingClientRect().width);
    };

    updateWidth();

    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(container);
    window.addEventListener("resize", updateWidth);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateWidth);
    };
  }, []);

  // ── Mesure la hauteur de l'élément sticky pour réserver l'espace (placeholder) ──
  useLayoutEffect(() => {
    const sticky = stickyRef.current;
    if (!sticky) return;

    const updateHeight = () => {
      setPlaceholderHeight(sticky.getBoundingClientRect().height);
    };

    updateHeight();

    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(sticky);

    return () => {
      resizeObserver.disconnect();
    };
  }, [isSticky]);

  // ── Détecte quand le conteneur passe au-dessus du seuil ──
  useEffect(() => {
    const onScroll = () => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      // Quand le top du conteneur passe au-dessus du seuil, on bascule en fixed.
      setIsSticky(rect.top <= topOffset);
    };

    onScroll(); // initial state
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [topOffset]);

  return {
    containerRef,
    stickyRef,
    isSticky,
    stickyStyle: isSticky
      ? {
        position: "fixed",
        top: topOffset,
        width,
      }
      : null,
    placeholderHeight: isSticky ? placeholderHeight : 0,
  };
}

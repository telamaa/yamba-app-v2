"use client";

import { useEffect, useState } from "react";

/**
 * Hook qui retourne `true` dès que le scroll vertical dépasse le seuil donné.
 *
 * Utile pour:
 *  - Rendre un header/une barre "sticky" avec un style compact au scroll
 *  - Afficher un bouton "scroll to top" après X pixels scrollés
 *  - Tout autre comportement dépendant de la position de scroll
 *
 * @example
 * const isScrolled = useScrollThreshold(80);
 * <div className={isScrolled ? "compact" : "full"}>...</div>
 */
export function useScrollThreshold(threshold: number = 80): boolean {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const check = () => {
      setIsScrolled(window.scrollY > threshold);
    };

    // Check au mount (au cas où la page est déjà scrollée)
    check();

    window.addEventListener("scroll", check, { passive: true });
    return () => window.removeEventListener("scroll", check);
  }, [threshold]);

  return isScrolled;
}

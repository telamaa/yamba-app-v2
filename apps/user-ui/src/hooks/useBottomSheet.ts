"use client";

import { useEffect, useState, useCallback } from "react";

/**
 * Hook simple pour gérer l'ouverture/fermeture d'un bottom sheet.
 * - Bloque le scroll du body quand le sheet est ouvert
 * - Permet de fermer avec ESC
 * - Retourne les helpers open/close/toggle
 */
export function useBottomSheet(initialOpen = false) {
  const [isOpen, setIsOpen] = useState(initialOpen);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  // Bloque le scroll du body quand le sheet est ouvert
  useEffect(() => {
    if (!isOpen) return;

    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen]);

  // Fermeture avec ESC
  useEffect(() => {
    if (!isOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  return { isOpen, open, close, toggle };
}

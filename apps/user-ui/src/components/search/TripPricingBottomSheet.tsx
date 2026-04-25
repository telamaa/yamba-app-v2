"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import TripPricingList from "./TripPricingList";
import {
  ParcelCategory,
  YambaTripResult,
} from "./search-results.types";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  trip: YambaTripResult;
  /** Catégories actuellement filtrées dans la sidebar (pour highlight) */
  highlightedCategories?: ParcelCategory[];
  /** Callback quand l'utilisateur clique "Voir le trajet complet" */
  onViewTrip?: (tripId: string) => void;
};

/**
 * Bottom sheet mobile qui affiche les tarifs par catégorie.
 *
 * Wrapper mobile autour de TripPricingList (composant partagé avec desktop).
 *
 * Features :
 *  - Slide-up depuis le bas avec drag handle
 *  - Swipe down (>100px) pour fermer
 *  - Tap backdrop pour fermer
 *  - ESC pour fermer
 *  - Body scroll lock quand ouvert
 *  - CTA bottom "Voir le trajet complet"
 */
export default function TripPricingBottomSheet({
                                                 isOpen,
                                                 onClose,
                                                 trip,
                                                 highlightedCategories = [],
                                                 onViewTrip,
                                               }: Props) {
  const t = useTranslations("search");
  const [isVisible, setIsVisible] = useState(false);

  const sheetRef = useRef<HTMLDivElement | null>(null);
  const dragStartY = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
      setDragOffset(0);
    }
  }, [isOpen]);

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen]);

  // Swipe down to close
  const handleTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    if (delta > 0) setDragOffset(delta);
  };

  const handleTouchEnd = () => {
    if (dragStartY.current === null) return;
    if (dragOffset > 100) {
      onClose();
    } else {
      setDragOffset(0);
    }
    dragStartY.current = null;
  };

  if (!isOpen) return null;

  const handleViewTrip = () => {
    if (onViewTrip) {
      onViewTrip(trip.id);
    } else {
      // ⚠️ TODO: la page détail du trajet n'existe pas encore.
      // Remplacer plus tard par : router.push(`/${locale}/trips/${trip.id}`)
      // eslint-disable-next-line no-console
      console.log("Navigate to trip", trip.id);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[200] md:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pricing-sheet-title"
    >
      <div
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/50 transition-opacity duration-300"
        style={{ opacity: isVisible ? 1 : 0 }}
        aria-hidden
      />

      <div
        ref={sheetRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white dark:bg-slate-950"
        style={{
          transform: isVisible
            ? `translateY(${dragOffset}px)`
            : "translateY(100%)",
          transition:
            dragStartY.current !== null
              ? "none"
              : "transform 300ms cubic-bezier(0.16, 1, 0.3, 1)",
          maxHeight: "85vh",
          paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
        }}
      >
        <div className="flex justify-center pb-1 pt-3">
          <div className="h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        <TripPricingList
          trip={trip}
          highlightedCategories={highlightedCategories}
          variant="comfortable"
        />

        <div className="px-5 pt-4">
          <button
            type="button"
            onClick={handleViewTrip}
            className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-[#FF9900] px-6 text-[15px] font-semibold text-slate-950 transition-colors hover:bg-[#F08700] active:bg-[#E07A00]"
          >
            {t("pricingSheet.viewTrip")}
          </button>
        </div>
      </div>
    </div>
  );
}

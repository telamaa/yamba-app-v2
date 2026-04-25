"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import TripPricingList from "./TripPricingList";
import {
  ParcelCategory,
  YambaTripResult,
} from "./search-results.types";

type Props = {
  isOpen: boolean;
  /** Callback de fermeture. Suffixe "Action" requis par Next.js pour les "use client" entry files. */
  onCloseAction: () => void;
  trip: YambaTripResult;
  /** Ref vers l'élément trigger (le bouton "Starting from ?") pour positionner le popover */
  triggerRef: React.RefObject<HTMLElement | null>;
  /** Catégories filtrées dans la sidebar (highlight orange) */
  highlightedCategories?: ParcelCategory[];
  /** Callback quand l'utilisateur clique "Voir le trajet". Suffixe "Action" requis par Next.js. */
  onViewTripAction?: (tripId: string) => void;
  /** Position du popover : "bottom-right" (default) ou "bottom-left" */
  align?: "bottom-right" | "bottom-left";
};

const POPOVER_WIDTH = 320;
const GAP = 8;
const VIEWPORT_PADDING = 8;

/**
 * Popover desktop qui affiche les tarifs par catégorie d'un trajet.
 *
 * Pendant desktop du TripPricingBottomSheet (mobile).
 *
 * Implémentation :
 *  - Rendu via createPortal dans document.body pour éviter d'être clippé
 *    par les overflow:hidden des cards parent
 *  - Position calculée dynamiquement via getBoundingClientRect du trigger
 *  - Suit le trigger sur scroll/resize
 *  - Smart positioning : adjuste si le popover dépasse de la viewport
 *
 * Features :
 *  - Click outside pour fermer (via custom mousedown listener qui exclut
 *    le trigger pour éviter le double-toggle)
 *  - ESC pour fermer
 *  - Animation fade + slight slide
 *  - Largeur fixe 320px
 *
 * Convention Next.js :
 *  - Les props callbacks (onCloseAction, onViewTripAction) doivent suivre
 *    la convention "Action" requise pour les "use client" entry files.
 */
export default function TripPricingPopover({
                                             isOpen,
                                             onCloseAction,
                                             trip,
                                             triggerRef,
                                             highlightedCategories = [],
                                             onViewTripAction,
                                             align = "bottom-right",
                                           }: Props) {
  const t = useTranslations("search");
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(
    null
  );

  // Mount detection (Portal SSR-safe)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Calcul de la position du popover relative au trigger
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();

    const top = rect.bottom + GAP;

    let left: number;
    if (align === "bottom-right") {
      left = rect.right - POPOVER_WIDTH;
    } else {
      left = rect.left;
    }

    // Smart positioning : éviter de dépasser de la viewport
    const maxLeft = window.innerWidth - POPOVER_WIDTH - VIEWPORT_PADDING;
    const minLeft = VIEWPORT_PADDING;
    if (left > maxLeft) left = maxLeft;
    if (left < minLeft) left = minLeft;

    setPosition({ top, left });
  }, [align, triggerRef]);

  // Recalculer la position à l'ouverture + sur scroll/resize
  useLayoutEffect(() => {
    if (!isOpen) {
      setPosition(null);
      return;
    }
    updatePosition();

    // useCapture=true pour catcher tous les scroll, y compris sur containers internes
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen, updatePosition]);

  // ⚠️ Custom mousedown listener pour click-outside.
  // Pas useOnClickOutside ici parce qu'on a besoin d'accéder à l'event
  // pour exclure le trigger lui-même (sinon double-toggle quand on clique
  // sur le `?` pour fermer : le bouton fait setOpen(false) et le hook
  // appelle aussi onCloseAction).
  useEffect(() => {
    if (!isOpen) return;

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;

      // Si le clic est dans le popover, ne rien faire
      if (popoverRef.current?.contains(target)) return;
      // Si le clic est sur le trigger, ne rien faire (le bouton gère son toggle)
      if (triggerRef.current?.contains(target)) return;

      onCloseAction();
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [isOpen, onCloseAction, triggerRef]);

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseAction();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onCloseAction]);

  if (!isOpen || !mounted || !position) return null;

  const handleViewTrip = () => {
    if (onViewTripAction) {
      onViewTripAction(trip.id);
    } else {
      // ⚠️ TODO: la page détail du trajet n'existe pas encore.
      // Remplacer plus tard par : router.push(`/${locale}/trips/${trip.id}`)
      // eslint-disable-next-line no-console
      console.log("Navigate to trip", trip.id);
    }
    onCloseAction();
  };

  const popoverContent = (
    <div
      ref={popoverRef}
      role="dialog"
      aria-modal="false"
      aria-label={t("pricingSheet.title")}
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        width: POPOVER_WIDTH,
        zIndex: 200,
      }}
      className={[
        "overflow-hidden rounded-2xl",
        "border border-slate-200 bg-white shadow-xl",
        "dark:border-slate-800 dark:bg-slate-950",
        "animate-[yambaPopoverIn_180ms_cubic-bezier(0.16,1,0.3,1)]",
      ].join(" ")}
    >
      <style jsx>{`
        @keyframes yambaPopoverIn {
          from {
            opacity: 0;
            transform: translateY(-4px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>

      <div className="pb-3">
        <TripPricingList
          trip={trip}
          highlightedCategories={highlightedCategories}
          variant="compact"
        />
      </div>

      <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/40">
        <button
          type="button"
          onClick={handleViewTrip}
          className="inline-flex h-9 w-full items-center justify-center rounded-xl bg-[#FF9900] px-4 text-[13px] font-semibold text-slate-950 transition-colors hover:bg-[#F08700] active:bg-[#E07A00]"
        >
          {t("pricingSheet.viewTrip")}
        </button>
      </div>
    </div>
  );

  return createPortal(popoverContent, document.body);
}

"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  FileText,
  Smartphone,
  BookOpen,
  Briefcase,
  Shirt,
  Footprints,
  ShoppingBag,
  Package,
  Gift,
  Laptop,
  Cpu,
  X,
  type LucideIcon,
} from "lucide-react";
import type { ParcelCategory, PublicTrip } from "@/lib/public-trip.types";
import { formatPriceShort } from "@/lib/public-trip.helpers";

const VISIBLE_LIMIT_MOBILE = 3;
const VISIBLE_LIMIT_DESKTOP = 6;

const CATEGORY_ICONS: Record<ParcelCategory, LucideIcon> = {
  CLOTHES: Shirt,
  SHOES: Footprints,
  FASHION_ACCESSORIES: ShoppingBag,
  OTHER_ACCESSORIES: Package,
  BOOKS: BookOpen,
  DOCUMENTS: FileText,
  SMALL_TOYS: Gift,
  PHONE: Smartphone,
  COMPUTER: Laptop,
  OTHER_ELECTRONICS: Cpu,
  CHECKED_BAG_23KG: Briefcase,
  CABIN_BAG_12KG: Briefcase,
};

type Props = {
  trip: PublicTrip;
};

export default function CategoriesCard({ trip }: Props) {
  const t = useTranslations("tripDetail");
  const tCategories = useTranslations("tripDetail.categories");
  const locale = useLocale() as "fr" | "en";
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Lock body scroll quand modal ouverte (compensation de la scrollbar)
  useEffect(() => {
    if (isModalOpen) {
      const scrollbarWidth =
        window.innerWidth - document.documentElement.clientWidth;
      document.body.style.paddingRight = `${scrollbarWidth}px`;
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.paddingRight = "";
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.paddingRight = "";
      document.body.style.overflow = "";
    };
  }, [isModalOpen]);

  // Fermer la modal avec Escape
  useEffect(() => {
    if (!isModalOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsModalOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isModalOpen]);

  if (!trip.categoryConditions || trip.categoryConditions.length === 0) {
    return null;
  }

  const allCategories = trip.categoryConditions;
  const total = allCategories.length;

  // On render jusqu'à 6 catégories au total ; les indices 3-5 sont cachés en mobile via CSS.
  const renderedCategories = allCategories.slice(0, VISIBLE_LIMIT_DESKTOP);

  // Bouton "Voir les X" :
  // - Mobile : visible si total > 3
  // - Desktop : visible si total > 6
  // Si total ∈ [4..6], on cache le bouton en desktop (sm:hidden).
  const showButtonMobile = total > VISIBLE_LIMIT_MOBILE;
  const hideButtonOnDesktop = total <= VISIBLE_LIMIT_DESKTOP;

  return (
    <>
      <section>
        <header className="px-5 pt-4 pb-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            {t("categories.title", { firstName: trip.tripper.firstName })}
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            {t("categories.hint")}
          </p>
        </header>

        <div className="grid grid-cols-1 gap-x-10 gap-y-4 px-5 pb-3 sm:grid-cols-2">
          {renderedCategories.map((cond, idx) => (
            <div
              key={cond.category}
              className={
                idx >= VISIBLE_LIMIT_MOBILE ? "hidden sm:block" : undefined
              }
            >
              <ModalCategoryRow
                category={cond.category}
                priceLabel={formatPriceShort(
                  cond.priceAmountCents,
                  trip.currencyCode,
                  locale
                )}
                label={tCategories(cond.category as any)}
              />
            </div>
          ))}
        </div>

        {showButtonMobile && (
          <div
            className={`px-5 pb-4 ${hideButtonOnDesktop ? "sm:hidden" : ""}`}
          >
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center justify-center rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
            >
              {t("categories.viewAll", { count: total })}
            </button>
          </div>
        )}
      </section>

      {/* Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setIsModalOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header modal */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {t("categories.modalTitle", {
                  firstName: trip.tripper.firstName,
                })}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                aria-label={t("close")}
              >
                <X size={16} />
              </button>
            </div>

            {/* Body modal scrollable */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-1 gap-x-10 gap-y-4 sm:grid-cols-2">
                {allCategories.map((cond) => (
                  <ModalCategoryRow
                    key={cond.category}
                    category={cond.category}
                    priceLabel={formatPriceShort(
                      cond.priceAmountCents,
                      trip.currencyCode,
                      locale
                    )}
                    label={tCategories(cond.category as any)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Row catégorie : grid 3 colonnes pour aligner icône / label / prix
 * sur toutes les rows (utilisé dans la card et dans la modal).
 */
function ModalCategoryRow({
                            category,
                            priceLabel,
                            label,
                          }: {
  category: ParcelCategory;
  priceLabel: string;
  label: string;
}) {
  const Icon = CATEGORY_ICONS[category] ?? Package;
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
      <Icon
        size={20}
        className="shrink-0 text-slate-600 dark:text-slate-300"
      />
      <span className="text-sm text-slate-900 dark:text-white">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-300">
        {priceLabel}
      </span>
    </div>
  );
}

"use client";

import {
  Banknote,
  BookOpen,
  Briefcase,
  Clock3,
  Cpu,
  FileText,
  Footprints,
  Laptop,
  Medal,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  Smartphone,
  Ticket,
  ToyBrick,
  Zap,
  Package,
} from "lucide-react";
import { useMemo } from "react";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";
import { ParcelCategory, SortOption } from "./search-results.types";

type Lang = "fr" | "en";

type Props = {
  sort: SortOption;
  onSortChange: (value: SortOption) => void;

  superTripperOnly: boolean;
  onSuperTripperChange: (value: boolean) => void;

  profileVerifiedOnly: boolean;
  onProfileVerifiedChange: (value: boolean) => void;

  instantBookingOnly: boolean;
  onInstantBookingChange: (value: boolean) => void;

  verifiedTicketOnly: boolean;
  onVerifiedTicketChange: (value: boolean) => void;

  superTripperCount: number;
  profileVerifiedCount: number;
  instantBookingCount: number;
  verifiedTicketCount: number;

  selectedCategories: ParcelCategory[];
  onToggleCategory: (value: ParcelCategory) => void;
  onClear: () => void;
};

function getCategoryMeta(category: ParcelCategory, isFr: boolean) {
  switch (category) {
    case "clothes":
      return { label: isFr ? "Vêtements" : "Clothes", icon: <Shirt size={14} /> };
    case "shoes":
      return { label: isFr ? "Chaussures" : "Shoes", icon: <Footprints size={14} /> };
    case "fashion-accessories":
      return {
        label: isFr ? "Accessoires de mode" : "Fashion accessories",
        icon: <ShoppingBag size={14} />,
      };
    case "other-accessories":
      return {
        label: isFr ? "Autres Accessoires" : "Other accessories",
        icon: <Package size={14} />,
      };
    case "books":
      return { label: isFr ? "Livres" : "Books", icon: <BookOpen size={14} /> };
    case "documents":
      return { label: isFr ? "Documents" : "Documents", icon: <FileText size={14} /> };
    case "small-toys":
      return { label: isFr ? "Petits jouets" : "Small toys", icon: <ToyBrick size={14} /> };
    case "phone":
      return { label: isFr ? "Téléphone" : "Phone", icon: <Smartphone size={14} /> };
    case "computer":
      return { label: isFr ? "Ordinateur" : "Computer", icon: <Laptop size={14} /> };
    case "other-electronics":
      return {
        label: isFr ? "Electronique" : "Electronics",
        icon: <Cpu size={14} />,
      };
    case "checked-bag-23kg":
      return {
        label: isFr ? "Valise soute 23 Kg" : "Checked bag 23 kg",
        icon: <Briefcase size={14} />,
      };
    case "cabin-bag-12kg":
    default:
      return {
        label: isFr ? "Valise cabine 12 Kg" : "Cabin bag 12 kg",
        icon: <Briefcase size={14} />,
      };
  }
}

function RightMeta({
                     count,
                     icon,
                   }: {
  count?: number;
  icon: React.ReactNode;
}) {
  const disabled = typeof count === "number" && count === 0;

  return (
    <span
      className={[
        "flex items-center gap-3",
        disabled ? "text-slate-300 dark:text-slate-600" : "text-slate-500 dark:text-slate-400",
      ].join(" ")}
    >
      {typeof count === "number" && (
        <span className="min-w-[18px] text-right text-sm font-semibold">{count}</span>
      )}
      <span>{icon}</span>
    </span>
  );
}

export default function SearchFiltersSidebar({
                                               sort,
                                               onSortChange,
                                               superTripperOnly,
                                               onSuperTripperChange,
                                               profileVerifiedOnly,
                                               onProfileVerifiedChange,
                                               instantBookingOnly,
                                               onInstantBookingChange,
                                               verifiedTicketOnly,
                                               onVerifiedTicketChange,
                                               superTripperCount,
                                               profileVerifiedCount,
                                               instantBookingCount,
                                               verifiedTicketCount,
                                               selectedCategories,
                                               onToggleCategory,
                                               onClear,
                                             }: Props) {
  const { lang } = useUiPreferences();

  const copy = useMemo(() => {
    const isFr = (lang as Lang) === "fr";
    return {
      title: isFr ? "Trier par" : "Sort by",
      clear: isFr ? "Tout effacer" : "Clear all",
      earliest: isFr ? "Départ le plus tôt" : "Earliest departure",
      lowestPrice: isFr ? "Prix le plus bas" : "Lowest price",
      trust: isFr ? "Confiance et sécurité" : "Trust & safety",
      superTripper: isFr ? "Super tripper" : "Super tripper",
      verified: isFr ? "Profil vérifié" : "Verified profile",
      instantBooking: isFr ? "Réservation instantanée" : "Instant booking",
      verifiedTicket: isFr ? "Billet vérifié" : "Verified ticket",
      services: isFr ? "Services" : "Services",
    };
  }, [lang]);

  const categories: ParcelCategory[] = [
    "clothes",
    "shoes",
    "fashion-accessories",
    "other-accessories",
    "books",
    "documents",
    "small-toys",
    "phone",
    "computer",
    "other-electronics",
    "checked-bag-23kg",
    "cabin-bag-12kg",
  ];

  const trustOptions = [
    {
      checked: superTripperOnly,
      onChange: onSuperTripperChange,
      label: copy.superTripper,
      icon: <Medal size={20} className="text-[#FF9900]" />,
      count: superTripperCount,
    },
    {
      checked: profileVerifiedOnly,
      onChange: onProfileVerifiedChange,
      label: copy.verified,
      icon: <ShieldCheck size={20} className="text-[#FF9900]" />,
      count: profileVerifiedCount,
    },
    {
      checked: instantBookingOnly,
      onChange: onInstantBookingChange,
      label: copy.instantBooking,
      icon: <Zap size={20} className="text-[#FF9900]" />,
      count: instantBookingCount,
    },
    {
      checked: verifiedTicketOnly,
      onChange: onVerifiedTicketChange,
      label: copy.verifiedTicket,
      icon: <Ticket size={20} className="text-[#FF9900]" />,
      count: verifiedTicketCount,
    },
  ];

  return (
    <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
          {copy.title}
        </h2>
        <button
          type="button"
          onClick={onClear}
          className="text-sm font-medium text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
        >
          {copy.clear}
        </button>
      </div>

      <div className="space-y-6">
        {/* Sort */}
        <div>
          <div className="space-y-3">
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <span className="flex items-center gap-3">
                <input
                  type="radio"
                  name="sort"
                  checked={sort === "earliest"}
                  onChange={() => onSortChange("earliest")}
                  className="h-4 w-4 accent-[#FF9900]"
                />
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  {copy.earliest}
                </span>
              </span>

              <RightMeta icon={<Clock3 size={20} />} />
            </label>

            <label className="flex cursor-pointer items-center justify-between gap-3">
              <span className="flex items-center gap-3">
                <input
                  type="radio"
                  name="sort"
                  checked={sort === "lowestPrice"}
                  onChange={() => onSortChange("lowestPrice")}
                  className="h-4 w-4 accent-[#FF9900]"
                />
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  {copy.lowestPrice}
                </span>
              </span>

              <RightMeta icon={<Banknote size={20} />} />
            </label>
          </div>
        </div>

        <div className="h-px bg-slate-200 dark:bg-slate-800" />

        {/* Trust */}
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            {copy.trust}
          </h3>

          <div className="space-y-3">
            {trustOptions.map((option) => {
              const disabled = option.count === 0;

              return (
                <label
                  key={option.label}
                  className={[
                    "flex items-center justify-between gap-3",
                    disabled ? "cursor-not-allowed" : "cursor-pointer",
                  ].join(" ")}
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={option.checked}
                      disabled={disabled}
                      onChange={(e) => option.onChange(e.target.checked)}
                      className="h-4 w-4 rounded accent-[#FF9900] disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <span
                      className={[
                        "text-sm font-medium",
                        disabled
                          ? "text-slate-300 dark:text-slate-600"
                          : "text-slate-900 dark:text-white",
                      ].join(" ")}
                    >
                      {option.label}
                    </span>
                  </span>

                  <RightMeta count={option.count} icon={option.icon} />
                </label>
              );
            })}
          </div>
        </div>

        <div className="h-px bg-slate-200 dark:bg-slate-800" />

        {/* Services */}
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            {copy.services}
          </h3>

          <div className="flex flex-wrap gap-2">
            {categories.map((category) => {
              const meta = getCategoryMeta(category, lang === "fr");
              const active = selectedCategories.includes(category);

              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => onToggleCategory(category)}
                  className={[
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition-colors",
                    active
                      ? "border-[#FF9900]/40 bg-[#FFF6E8] text-slate-900 dark:border-[#FF9900]/20 dark:bg-slate-900 dark:text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900",
                  ].join(" ")}
                >
                  {meta.icon}
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}

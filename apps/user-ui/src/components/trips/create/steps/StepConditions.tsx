"use client";

import React, { useEffect, useState } from "react";
import type {
  CreateTripCopy,
  Draft,
  ParcelCategory,
  TripLocationPoint,
} from "../create-trip.types";
import type { ValidationErrors } from "../create-trip.config";
import { getCategoryOptions } from "../create-trip.copy";
import {
  CATEGORY_GROUPS,
  estimateRevenue,
  getDefaultLocationsForMode,
} from "../create-trip.config";
import {
  CategoryChip,
  FieldError,
  PriceInput,
  RevenueBadge,
  SectionLabel,
  Toggle,
} from "@/components/trips/create/TripFormUi";
import LocationsSection from "../LocationsSection";

export default function StepConditions({
                                         copy,
                                         isFr,
                                         draft,
                                         setDraft,
                                         toggleCategory,
                                         errors,
                                       }: {
  copy: CreateTripCopy;
  isFr: boolean;
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  toggleCategory: (key: ParcelCategory) => void;
  errors: ValidationErrors;
}) {
  const [showPerCategory, setShowPerCategory] = useState(!draft.useGlobalPrice);
  const categoryOptions = getCategoryOptions(isFr);
  const revenue = estimateRevenue(draft.categoryConditions);

  /* ── Defensive seed of default locations ─────────────
   * En mode édition, useEditTrip peut renvoyer un draft où
   * pickupLocations / deliveryLocations sont undefined ou [].
   * Si on a un transportMode mais pas (encore) de lieux, on
   * seed les défauts pour ce mode.
   *
   * Utilisation de `?.length ?? 0` pour tolérer undefined.
   * ──────────────────────────────────────────────────── */
  useEffect(() => {
    const noPickup = (draft.pickupLocations?.length ?? 0) === 0;
    const noDelivery = (draft.deliveryLocations?.length ?? 0) === 0;

    if (draft.transportMode && noPickup && noDelivery) {
      const defaults = getDefaultLocationsForMode(draft.transportMode);
      setDraft((prev) => ({
        ...prev,
        pickupLocations: defaults.pickupLocations,
        deliveryLocations: defaults.deliveryLocations,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.transportMode]);

  /* ── Handlers ────────────────────────────────────── */

  const handleGlobalPriceChange = (value: number | "") => {
    setDraft((prev) => {
      const next = { ...prev, globalPrice: value };
      if (prev.useGlobalPrice) {
        const updatedConditions = { ...prev.categoryConditions };
        prev.acceptedCategories.forEach((key) => {
          if (updatedConditions[key]) {
            updatedConditions[key] = {
              ...updatedConditions[key]!,
              priceAmount: value,
            };
          }
        });
        next.categoryConditions = updatedConditions;
      }
      return next;
    });
  };

  const updateCategoryPrice = (catKey: ParcelCategory, value: number | "") => {
    setDraft((prev) => {
      const condition = prev.categoryConditions[catKey];
      if (!condition) return prev;
      return {
        ...prev,
        useGlobalPrice: false,
        categoryConditions: {
          ...prev.categoryConditions,
          [catKey]: { ...condition, priceAmount: value },
        },
      };
    });
    setShowPerCategory(true);
  };

  const handlePickupChange = (next: TripLocationPoint[]) => {
    setDraft((prev) => ({ ...prev, pickupLocations: next }));
  };

  const handleDeliveryChange = (next: TripLocationPoint[]) => {
    setDraft((prev) => ({ ...prev, deliveryLocations: next }));
  };

  const togglePerCategory = () => {
    const opening = !showPerCategory;
    setShowPerCategory(opening);
    setDraft((prev) => ({ ...prev, useGlobalPrice: !opening }));
  };

  /* ── Render ──────────────────────────────────────── */

  return (
    <div>
      {/* ═══ Section 1 : Catégories & prix ═══ */}
      <SectionLabel first>{copy.categories}</SectionLabel>

      {CATEGORY_GROUPS.map((group) => (
        <div key={group.labelEn} className="mb-4">
          <div className="mb-2 text-[11px] text-slate-400 dark:text-slate-500">
            {isFr ? group.labelFr : group.labelEn}
          </div>
          <div className="flex flex-wrap gap-2">
            {group.items.map((catKey) => {
              const opt = categoryOptions.find((o) => o.key === catKey);
              if (!opt) return null;
              return (
                <CategoryChip
                  key={catKey}
                  label={opt.label}
                  active={draft.acceptedCategories.includes(catKey)}
                  onClick={() => toggleCategory(catKey)}
                />
              );
            })}
          </div>
        </div>
      ))}
      <FieldError error={errors.categories} />

      {/* Global price */}
      {draft.acceptedCategories.length > 0 && (
        <div className="animate-[fadeSlide_0.2s_ease]">
          <SectionLabel>{copy.globalPrice}</SectionLabel>
          <div className="flex items-center gap-4">
            <PriceInput
              value={draft.globalPrice}
              onChange={handleGlobalPriceChange}
            />
            <span className="text-[12px] text-slate-400 dark:text-slate-500">
              {copy.globalPriceSub}
            </span>
          </div>

          <button
            type="button"
            onClick={togglePerCategory}
            className="mt-3 text-[12px] font-medium transition-colors"
            style={{ color: "#FF9900" }}
          >
            {showPerCategory ? "▾ " : "▸ "}
            {copy.adjustPrices}
          </button>
        </div>
      )}

      {/* Per-category prices */}
      {draft.acceptedCategories.length > 0 && showPerCategory && (
        <div className="mt-3 animate-[fadeSlide_0.2s_ease]">
          <div className="mb-2 text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {copy.pricePerCategory}
          </div>
          <div className="space-y-1.5">
            {draft.acceptedCategories.map((catKey) => {
              const opt = categoryOptions.find((o) => o.key === catKey);
              const condition = draft.categoryConditions[catKey];
              if (!opt) return null;
              const value = condition?.priceAmount ?? "";
              const priceErr = errors[`price_${catKey}`];

              return (
                <div key={catKey}>
                  <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
                    <span className="text-[12px] text-slate-700 dark:text-slate-300">
                      {opt.label}
                    </span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={value}
                        min={0}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const v = raw === "" ? "" : Number(raw);
                          updateCategoryPrice(catKey, v);
                        }}
                        className={[
                          "w-16 rounded-md border bg-white px-2 py-1 text-right text-[12px] text-slate-900 focus:outline-none dark:bg-slate-900 dark:text-white",
                          priceErr
                            ? "border-[#FF9900]"
                            : "border-slate-200 focus:border-[#FF9900] dark:border-slate-700",
                        ].join(" ")}
                      />
                      <span className="text-[12px] text-slate-400">€</span>
                    </div>
                  </div>
                  <FieldError error={priceErr} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Revenue estimate */}
      {revenue.max > 0 && (
        <div className="mt-5">
          <RevenueBadge
            min={revenue.min}
            max={revenue.max}
            label={copy.revenueEstimate}
          />
        </div>
      )}

      {/* ═══ Section 2 : Lieux de remise ═══ */}
      <div className="mt-6">
        <LocationsSection
          context="PICKUP"
          title={copy.pickupLocations}
          subtitle={copy.pickupLocationsSub}
          locations={draft.pickupLocations ?? []}
          onChangeAction={handlePickupChange}
          copy={copy}
          error={errors.pickupLocations}
        />
      </div>

      {/* ═══ Section 3 : Lieux de livraison ═══ */}
      <LocationsSection
        context="DELIVERY"
        title={copy.deliveryLocations}
        subtitle={copy.deliveryLocationsSub}
        locations={draft.deliveryLocations ?? []}
        onChangeAction={handleDeliveryChange}
        copy={copy}
        error={errors.deliveryLocations}
      />

      {/* ═══ Section 4 : Options & message ═══ */}
      <SectionLabel>{copy.options}</SectionLabel>
      <div className="rounded-xl bg-slate-50 px-4 dark:bg-slate-800/50">
        <Toggle
          label={copy.handOnly}
          on={draft.handDeliveryOnly}
          onChange={(v) =>
            setDraft((prev) => ({ ...prev, handDeliveryOnly: v }))
          }
        />
        <Toggle
          label={copy.instantBooking}
          on={draft.instantBooking}
          onChange={(v) =>
            setDraft((prev) => ({ ...prev, instantBooking: v }))
          }
        />
      </div>

      <SectionLabel>{copy.notes}</SectionLabel>
      <textarea
        value={draft.notes}
        onChange={(e) =>
          setDraft((prev) => ({ ...prev, notes: e.target.value }))
        }
        placeholder={copy.notesPlaceholder}
        rows={2}
        maxLength={2000}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-[#FF9900] focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
      />
    </div>
  );
}

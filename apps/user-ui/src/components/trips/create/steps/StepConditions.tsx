import React, { useState } from "react";
import type { CreateTripCopy, Draft, ParcelCategory, HandoffMoment, PickupMoment } from "../create-trip.types";
import type { ValidationErrors } from "../create-trip.config";
import { getCategoryOptions } from "../create-trip.copy";
import { CATEGORY_GROUPS, estimateRevenue } from "../create-trip.config";
import {
  CategoryChip,
  ConditionCard,
  FieldError,
  PriceInput,
  RevenueBadge,
  SectionLabel, Toggle
} from "@/components/trips/create/TripFormUi";


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

  const handoffLabels = [
    { key: "beforeDeparture", label: copy.beforeDeparture },
    { key: "atDeparture", label: copy.atDeparture },
  ];
  const pickupLabels = [
    { key: "onArrival", label: copy.onArrival },
    { key: "laterAtAddress", label: copy.laterAtAddress },
  ];

  const handleGlobalPriceChange = (value: number | "") => {
    setDraft((prev) => {
      const next = { ...prev, globalPrice: value };
      if (prev.useGlobalPrice) {
        const updatedConditions = { ...prev.categoryConditions };
        prev.acceptedCategories.forEach((key) => {
          if (updatedConditions[key]) {
            updatedConditions[key] = { ...updatedConditions[key]!, priceAmount: value };
          }
        });
        next.categoryConditions = updatedConditions;
      }
      return next;
    });
  };

  const toggleHandoff = (catKey: ParcelCategory, moment: string) => {
    setDraft((prev) => {
      const condition = prev.categoryConditions[catKey];
      if (!condition) return prev;
      const has = condition.handoffMoments.includes(moment as HandoffMoment);
      return {
        ...prev,
        categoryConditions: {
          ...prev.categoryConditions,
          [catKey]: {
            ...condition,
            handoffMoments: has
              ? condition.handoffMoments.filter((m) => m !== moment)
              : [...condition.handoffMoments, moment as HandoffMoment],
          },
        },
      };
    });
  };

  const togglePickup = (catKey: ParcelCategory, moment: string) => {
    setDraft((prev) => {
      const condition = prev.categoryConditions[catKey];
      if (!condition) return prev;
      const has = condition.pickupMoments.includes(moment as PickupMoment);
      return {
        ...prev,
        categoryConditions: {
          ...prev.categoryConditions,
          [catKey]: {
            ...condition,
            pickupMoments: has
              ? condition.pickupMoments.filter((m) => m !== moment)
              : [...condition.pickupMoments, moment as PickupMoment],
          },
        },
      };
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

  return (
    <div>
      {/* Categories grouped */}
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
            onClick={() => {
              setShowPerCategory((v) => !v);
              setDraft((prev) => ({ ...prev, useGlobalPrice: !showPerCategory }));
            }}
            className="mt-3 text-[12px] font-medium transition-colors"
            style={{ color: "#FF9900" }}
          >
            {showPerCategory ? "▾ " : "▸ "}
            {copy.adjustPrices}
          </button>
        </div>
      )}

      {/* Per-category conditions */}
      {draft.acceptedCategories.length > 0 && showPerCategory && (
        <div className="mt-4 space-y-3 animate-[fadeSlide_0.2s_ease]">
          <SectionLabel>{copy.pricePerCategory}</SectionLabel>
          {draft.acceptedCategories.map((catKey) => {
            const opt = categoryOptions.find((o) => o.key === catKey);
            const condition = draft.categoryConditions[catKey];
            if (!opt || !condition) return null;

            return (
              <ConditionCard
                key={catKey}
                title={opt.label}
                price={condition.priceAmount}
                onPriceChange={(v) => updateCategoryPrice(catKey, v)}
                handoffMoments={condition.handoffMoments}
                pickupMoments={condition.pickupMoments}
                handoffLabels={handoffLabels}
                pickupLabels={pickupLabels}
                onToggleHandoff={(m) => toggleHandoff(catKey, m)}
                onTogglePickup={(m) => togglePickup(catKey, m)}
                priceError={errors[`price_${catKey}`]}
                handoffError={errors[`handoff_${catKey}`]}
                pickupError={errors[`pickup_${catKey}`]}
              />
            );
          })}
        </div>
      )}

      {/* Revenue estimate */}
      {revenue.max > 0 && (
        <div className="mt-6">
          <RevenueBadge min={revenue.min} max={revenue.max} label={copy.revenueEstimate} />
        </div>
      )}

      {/* Options */}
      <SectionLabel>{copy.options}</SectionLabel>
      <div className="rounded-xl bg-slate-50 px-4 dark:bg-slate-800/50">
        <Toggle
          label={copy.handOnly}
          on={draft.handDeliveryOnly}
          onChange={(v) => setDraft((prev) => ({ ...prev, handDeliveryOnly: v }))}
        />
        <Toggle
          label={copy.instantBooking}
          on={draft.instantBooking}
          onChange={(v) => setDraft((prev) => ({ ...prev, instantBooking: v }))}
        />
      </div>

      {/* Notes */}
      <SectionLabel>{copy.notes}</SectionLabel>
      <textarea
        value={draft.notes}
        onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))}
        placeholder={copy.notesPlaceholder}
        rows={2}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-[#FF9900] focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
      />
    </div>
  );
}

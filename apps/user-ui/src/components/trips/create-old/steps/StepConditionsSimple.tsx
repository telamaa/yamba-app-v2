"use client";

import { Upload } from "lucide-react";
import {
  CategoryCondition,
  CategoryOption,
  CreateTripCopy,
  Draft,
  HandoffMoment,
  MobileScreen,
  PickupMoment,
} from "../create-trip.types";
import {
  CATEGORY_PRICE_RULES,
  clampCategoryPrice,
  createDefaultCategoryCondition,
} from "../create-trip.config";
import {
  CategoryChip,
  InfoDot,
  InputField,
  SectionTitle,
  ToggleRow,
} from "../TripFormUi";

function toggleArrayValue<T extends string>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export default function StepConditionsSimple({
                                               copy,
                                               draft,
                                               setDraft,
                                               categoryOptions,
                                               toggleCategory,
                                               setMobileScreen,
                                             }: {
  copy: CreateTripCopy;
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  categoryOptions: CategoryOption[];
  toggleCategory: (value: CategoryOption["key"]) => void;
  setMobileScreen: (value: MobileScreen) => void;
}) {
  const selectedCategories = categoryOptions.filter((category) =>
    draft.acceptedCategories.includes(category.key)
  );

  const updateCategoryCondition = (
    categoryKey: CategoryOption["key"],
    updater: (current: CategoryCondition) => CategoryCondition
  ) => {
    setDraft((prev) => {
      const current =
        prev.categoryConditions[categoryKey] ?? createDefaultCategoryCondition(categoryKey);

      return {
        ...prev,
        categoryConditions: {
          ...prev.categoryConditions,
          [categoryKey]: updater(current),
        },
      };
    });
  };

  const toggleCategoryMoment = (
    categoryKey: CategoryOption["key"],
    type: "handoff" | "pickup",
    value: HandoffMoment | PickupMoment
  ) => {
    updateCategoryCondition(categoryKey, (current) => {
      if (type === "handoff") {
        return {
          ...current,
          handoffMoments: toggleArrayValue(
            current.handoffMoments,
            value as HandoffMoment
          ),
        };
      }

      return {
        ...current,
        pickupMoments: toggleArrayValue(
          current.pickupMoments,
          value as PickupMoment
        ),
      };
    });
  };

  return (
    <>
      <SectionTitle title={copy.step2Title} subtitle={copy.step2Sub} />

      <div className="mt-2">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {copy.categories}
          </div>
          <button
            type="button"
            onClick={() => setMobileScreen("categories")}
            className="text-sm font-semibold text-[#FF9900] md:hidden"
          >
            {copy.openCategories}
          </button>
        </div>

        <div className="hidden flex-wrap gap-2 md:flex">
          {categoryOptions.map((category) => (
            <CategoryChip
              key={category.key}
              active={draft.acceptedCategories.includes(category.key)}
              label={category.label}
              onClick={() => toggleCategory(category.key)}
            />
          ))}
        </div>

        <div className="rounded-[20px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 md:hidden">
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {draft.acceptedCategories.length > 0
              ? `${draft.acceptedCategories.length}`
              : copy.emptyValue}
          </div>
        </div>
      </div>

      {selectedCategories.length > 0 ? (
        <div className="mt-6 grid gap-4">
          {selectedCategories.map((category) => {
            const rule = CATEGORY_PRICE_RULES[category.key];
            const condition =
              draft.categoryConditions[category.key] ??
              createDefaultCategoryCondition(category.key);

            return (
              <div
                key={category.key}
                className="rounded-[22px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    {category.label}
                  </div>
                  <div className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
                    {rule.minSuggestedPrice} € • {rule.maxAllowedPrice} €
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <InputField
                    label={copy.price}
                    type="number"
                    inputMode="numeric"
                    min={rule.minSuggestedPrice}
                    max={rule.maxAllowedPrice}
                    step={1}
                    value={condition.priceAmount}
                    onChange={(value) => {
                      if (value === "") {
                        updateCategoryCondition(category.key, (current) => ({
                          ...current,
                          priceAmount: "",
                        }));
                        return;
                      }

                      const numericValue = Number(value);
                      if (Number.isNaN(numericValue)) return;

                      updateCategoryCondition(category.key, (current) => ({
                        ...current,
                        priceAmount: clampCategoryPrice(category.key, numericValue),
                      }));
                    }}
                    suffix="€"
                    helperText={`Min ${rule.minSuggestedPrice} € • Max ${rule.maxAllowedPrice} €`}
                  />

                  <div className="rounded-[18px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                    <div className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {copy.handoffMoments}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          ["beforeDeparture", copy.beforeDeparture],
                          ["atDeparture", copy.atDeparture],
                        ] as Array<[HandoffMoment, string]>
                      ).map(([value, label]) => (
                        <CategoryChip
                          key={value}
                          active={condition.handoffMoments.includes(value)}
                          label={label}
                          onClick={() => toggleCategoryMoment(category.key, "handoff", value)}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-[18px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    <span>{copy.pickupMoments}</span>
                    <InfoDot text={copy.pickupInfo} />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ["onArrival", copy.onArrival],
                        ["laterAtAddress", copy.laterAtAddress],
                      ] as Array<[PickupMoment, string]>
                    ).map(([value, label]) => (
                      <CategoryChip
                        key={value}
                        active={condition.pickupMoments.includes(value)}
                        label={label}
                        onClick={() => toggleCategoryMoment(category.key, "pickup", value)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="mt-6">
        <div className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
          {copy.options}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <ToggleRow
            label={copy.handOnly}
            checked={draft.handDeliveryOnly}
            onChange={(value) => setDraft((prev) => ({ ...prev, handDeliveryOnly: value }))}
          />
          <ToggleRow
            label={copy.instantBooking}
            checked={draft.instantBooking}
            onChange={(value) => setDraft((prev) => ({ ...prev, instantBooking: value }))}
          />
        </div>
      </div>

      <div className="mt-6 rounded-[24px] border border-dashed border-slate-300 bg-white p-5 dark:border-slate-700 dark:bg-slate-950">
        <div className="flex items-start gap-3">
          <Upload className="mt-0.5 text-slate-400 dark:text-slate-500" size={20} />
          <div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">{copy.uploadTitle}</div>
            <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{copy.uploadSub}</div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <label className="block">
          <div className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
            {copy.notes}
          </div>
          <textarea
            rows={4}
            value={draft.notes}
            onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder={copy.notesPlaceholder}
            className="w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500"
          />
        </label>
      </div>
    </>
  );
}

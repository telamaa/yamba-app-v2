"use client";

import { CreateTripCopy, Draft, MobileScreen, CategoryOption, ParcelVolume } from "../create-trip.types";
import { CategoryChip, InputField, SectionTitle, ToggleRow } from "../TripFormUi";

export default function StepCapacity({
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
  return (
    <>
      <SectionTitle title={copy.step3Title} subtitle={copy.step3Sub} />

      <div className="grid gap-4 md:grid-cols-3">
        <InputField
          label={copy.maxParcelCount}
          type="number"
          value={draft.maxParcelCount}
          onChange={(value) =>
            setDraft((prev) => ({
              ...prev,
              maxParcelCount: value ? Number(value) : "",
            }))
          }
        />
        <InputField
          label={copy.maxWeight}
          type="number"
          value={draft.maxWeightKg}
          onChange={(value) =>
            setDraft((prev) => ({
              ...prev,
              maxWeightKg: value ? Number(value) : "",
            }))
          }
          suffix="kg"
        />
        <div>
          <div className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
            {copy.volume}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(["small", "medium", "large"] as ParcelVolume[]).map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setDraft((prev) => ({ ...prev, volumeSize: size }))}
                className={[
                  "rounded-[16px] border px-3 py-3 text-sm font-semibold",
                  draft.volumeSize === size
                    ? "border-[#FF9900]/40 bg-[#FFF6E8] text-slate-900 dark:border-[#FF9900]/20 dark:bg-slate-900 dark:text-white"
                    : "border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300",
                ].join(" ")}
              >
                {size === "small" ? copy.small : size === "medium" ? copy.medium : copy.large}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {copy.categories}
          </div>
          <button
            type="button"
            onClick={() => setMobileScreen("categories")}
            className="text-sm font-semibold text-[#FF9900]"
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

        <div className="md:hidden rounded-[20px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {draft.acceptedCategories.length > 0
              ? `${draft.acceptedCategories.length}`
              : copy.emptyValue}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
          {copy.constraints}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <ToggleRow
            label={copy.fragile}
            checked={draft.fragileItemsAllowed}
            onChange={(value) => setDraft((prev) => ({ ...prev, fragileItemsAllowed: value }))}
          />
          <ToggleRow
            label={copy.urgentDocs}
            checked={draft.urgentDocumentsAllowed}
            onChange={(value) => setDraft((prev) => ({ ...prev, urgentDocumentsAllowed: value }))}
          />
          <ToggleRow
            label={copy.handOnly}
            checked={draft.handDeliveryOnly}
            onChange={(value) => setDraft((prev) => ({ ...prev, handDeliveryOnly: value }))}
          />
        </div>
      </div>
    </>
  );
}

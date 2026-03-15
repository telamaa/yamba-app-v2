"use client";

import type { Dispatch, SetStateAction } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import Calendar from "@/components/ui/Calendar";
import CityAutocomplete from "@/components/search/CityAutocomplete";
import type {
  CategoryOption,
  CreateTripCopy,
  Draft,
  MobileScreen,
} from "../create-trip.types";
import {
  CategoryChip,
  CompactSegmentedControl,
  InputField,
} from "../TripFormUi";

type Props = {
  mounted: boolean;
  mobileScreen: MobileScreen;
  onClose: () => void;
  copy: CreateTripCopy;
  isFr: boolean;
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft>>;
  categoryOptions: CategoryOption[];
  toggleCategory: (value: CategoryOption["key"]) => void;
};

export default function TripMobileOverlay({
                                            mounted,
                                            mobileScreen,
                                            onClose,
                                            copy,
                                            isFr,
                                            draft,
                                            setDraft,
                                            categoryOptions,
                                            toggleCategory,
                                          }: Props) {
  if (!mounted || !mobileScreen) return null;

  const planeNeedsCities = draft.flightType === "withLayover";
  const trainNeedsCities =
    draft.trainTripType === "withConnection" ||
    draft.trainTripType === "withIntermediateStops";

  return createPortal(
    <div className="fixed inset-0 z-[500] overflow-y-auto bg-white dark:bg-slate-950 md:hidden">
      <div className="px-4 pb-8 pt-4">
        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-500 dark:text-slate-400"
            aria-label={copy.close}
          >
            <X size={28} />
          </button>
        </div>

        {mobileScreen === "from" && (
          <div className="space-y-5">
            <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {copy.from}
            </h2>

            <div className="relative z-[300] rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <CityAutocomplete
                value={draft.from}
                action={(value) => setDraft((prev) => ({ ...prev, from: value }))}
                onSelect={onClose}
                placeholder={copy.from}
                language={isFr ? "fr" : "en"}
                autoFocus
                inputClassName="text-base"
                dropdownInline
              />
            </div>
          </div>
        )}

        {mobileScreen === "to" && (
          <div className="space-y-5">
            <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {copy.to}
            </h2>

            <div className="relative z-[300] rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <CityAutocomplete
                value={draft.to}
                action={(value) => setDraft((prev) => ({ ...prev, to: value }))}
                onSelect={onClose}
                placeholder={copy.to}
                language={isFr ? "fr" : "en"}
                autoFocus
                inputClassName="text-base"
                dropdownInline
              />
            </div>
          </div>
        )}

        {mobileScreen === "date" && (
          <div className="space-y-5">
            <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {copy.date}
            </h2>

            <Calendar
              lang={isFr ? "fr" : "en"}
              mode="single"
              selected={draft.departureDate}
              onSelect={(date) => {
                setDraft((prev) => ({ ...prev, departureDate: date ?? undefined }));
                onClose();
              }}
            />
          </div>
        )}

        {mobileScreen === "arrivalDate" && (
          <div className="space-y-5">
            <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {copy.arrivalDate}
            </h2>

            <Calendar
              lang={isFr ? "fr" : "en"}
              mode="single"
              selected={draft.arrivalDate}
              onSelect={(date) => {
                setDraft((prev) => ({ ...prev, arrivalDate: date ?? undefined }));
                onClose();
              }}
            />
          </div>
        )}

        {mobileScreen === "pathType" && (
          <div className="space-y-5">
            <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {copy.tripPathType}
            </h2>

            {draft.transportMode === "plane" && (
              <div className="space-y-4">
                <CompactSegmentedControl
                  label={copy.tripPathType}
                  value={draft.flightType}
                  columns={2}
                  options={[
                    { value: "direct", label: copy.directFlight },
                    { value: "withLayover", label: copy.withLayover },
                  ]}
                  onChange={(value) => {
                    setDraft((prev) => ({
                      ...prev,
                      flightType: value,
                      ...(value === "direct" ? { flightLayoverCities: "" } : {}),
                    }));

                    if (value === "direct") {
                      onClose();
                    }
                  }}
                />

                {planeNeedsCities && (
                  <InputField
                    label={copy.flightLayoverCities}
                    value={draft.flightLayoverCities}
                    onChange={(value) =>
                      setDraft((prev) => ({
                        ...prev,
                        flightLayoverCities: value,
                      }))
                    }
                    placeholder={isFr ? "Ex. Casablanca, Madrid" : "E.g. Casablanca, Madrid"}
                    helperText={
                      isFr
                        ? "Optionnel. Indique une ou plusieurs villes séparées par des virgules."
                        : "Optional. Enter one or more cities separated by commas."
                    }
                  />
                )}
              </div>
            )}

            {draft.transportMode === "train" && (
              <div className="space-y-4">
                <CompactSegmentedControl
                  label={copy.tripPathType}
                  value={draft.trainTripType}
                  columns={3}
                  options={[
                    { value: "direct", label: copy.directTrain },
                    { value: "withConnection", label: copy.withConnection },
                    { value: "withIntermediateStops", label: copy.withIntermediateStops },
                  ]}
                  onChange={(value) => {
                    setDraft((prev) => ({
                      ...prev,
                      trainTripType: value,
                      ...(value === "direct" ? { trainStopCities: "" } : {}),
                    }));

                    if (value === "direct") {
                      onClose();
                    }
                  }}
                />

                {trainNeedsCities && (
                  <InputField
                    label={copy.trainStopCities}
                    value={draft.trainStopCities}
                    onChange={(value) =>
                      setDraft((prev) => ({
                        ...prev,
                        trainStopCities: value,
                      }))
                    }
                    placeholder={isFr ? "Ex. Lyon, Valence, Marseille" : "E.g. Lyon, Valence, Marseille"}
                    helperText={
                      isFr
                        ? "Optionnel. Indique une ou plusieurs villes séparées par des virgules."
                        : "Optional. Enter one or more cities separated by commas."
                    }
                  />
                )}
              </div>
            )}

            {draft.transportMode === "car" && (
              <CompactSegmentedControl
                label={copy.tripPathType}
                value={draft.carTripFlexibility}
                columns={2}
                options={[
                  { value: "direct", label: copy.directTrip },
                  { value: "detourByAgreement", label: copy.detourByAgreement },
                ]}
                onChange={(value) => {
                  setDraft((prev) => ({ ...prev, carTripFlexibility: value }));
                  onClose();
                }}
              />
            )}
          </div>
        )}

        {mobileScreen === "categories" && (
          <div className="space-y-5">
            <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {copy.categories}
            </h2>

            <div className="flex flex-wrap gap-2">
              {categoryOptions.map((category) => (
                <CategoryChip
                  key={category.key}
                  active={draft.acceptedCategories.includes(category.key)}
                  label={category.label}
                  onClick={() => toggleCategory(category.key)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

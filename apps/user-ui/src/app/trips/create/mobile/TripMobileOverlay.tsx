"use client";

import { createPortal } from "react-dom";
import { Car, Plane, Train, X } from "lucide-react";
import Calendar from "@/components/ui/Calendar";
import CityAutocomplete from "@/components/search/CityAutocomplete";
import {
  CategoryOption,
  CreateTripCopy,
  Draft,
  MobileScreen,
} from "../../../../components/trips/create/create-trip.types";
import { CategoryChip, ChoiceCard } from "../../../../components/trips/create/TripFormUi";

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
                                          }: {
  mounted: boolean;
  mobileScreen: MobileScreen;
  onClose: () => void;
  copy: CreateTripCopy;
  isFr: boolean;
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  categoryOptions: CategoryOption[];
  toggleCategory: (value: CategoryOption["key"]) => void;
}) {
  if (!mounted || !mobileScreen) return null;

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
            <div className="relative z-[300] rounded-[28px] border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
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
            <div className="relative z-[300] rounded-[28px] border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
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

        {mobileScreen === "pathType" && (
          <div className="space-y-5">
            <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {copy.tripPathType}
            </h2>

            <div className="grid gap-3">
              {draft.transportMode === "plane" && (
                <>
                  <ChoiceCard
                    active={draft.flightType === "direct"}
                    icon={<Plane size={20} />}
                    title={copy.directFlight}
                    description={isFr ? "Sans escale" : "No layover"}
                    onClick={() => {
                      setDraft((prev) => ({ ...prev, flightType: "direct" }));
                      onClose();
                    }}
                  />
                  <ChoiceCard
                    active={draft.flightType === "withLayover"}
                    icon={<Plane size={20} />}
                    title={copy.withLayover}
                    description={isFr ? "Une ou plusieurs escales" : "One or more layovers"}
                    onClick={() => {
                      setDraft((prev) => ({ ...prev, flightType: "withLayover" }));
                      onClose();
                    }}
                  />
                </>
              )}

              {draft.transportMode === "train" && (
                <>
                  <ChoiceCard
                    active={draft.trainTripType === "direct"}
                    icon={<Train size={20} />}
                    title={copy.directTrain}
                    description={isFr ? "Sans correspondance" : "No connection"}
                    onClick={() => {
                      setDraft((prev) => ({ ...prev, trainTripType: "direct" }));
                      onClose();
                    }}
                  />
                  <ChoiceCard
                    active={draft.trainTripType === "withConnection"}
                    icon={<Train size={20} />}
                    title={copy.withConnection}
                    description={isFr ? "Avec changement de train" : "With train connection"}
                    onClick={() => {
                      setDraft((prev) => ({ ...prev, trainTripType: "withConnection" }));
                      onClose();
                    }}
                  />
                  <ChoiceCard
                    active={draft.trainTripType === "withIntermediateStops"}
                    icon={<Train size={20} />}
                    title={copy.withIntermediateStops}
                    description={isFr ? "Avec arrêts sur le trajet" : "With stops along the route"}
                    onClick={() => {
                      setDraft((prev) => ({
                        ...prev,
                        trainTripType: "withIntermediateStops",
                      }));
                      onClose();
                    }}
                  />
                </>
              )}

              {draft.transportMode === "car" && (
                <>
                  <ChoiceCard
                    active={draft.carTripFlexibility === "direct"}
                    icon={<Car size={20} />}
                    title={copy.directTrip}
                    description={isFr ? "Sans détour" : "No detour"}
                    onClick={() => {
                      setDraft((prev) => ({ ...prev, carTripFlexibility: "direct" }));
                      onClose();
                    }}
                  />
                  <ChoiceCard
                    active={draft.carTripFlexibility === "smallDetourPossible"}
                    icon={<Car size={20} />}
                    title={copy.smallDetourPossible}
                    description={isFr ? "Petit détour accepté" : "Small detour accepted"}
                    onClick={() => {
                      setDraft((prev) => ({
                        ...prev,
                        carTripFlexibility: "smallDetourPossible",
                      }));
                      onClose();
                    }}
                  />
                  <ChoiceCard
                    active={draft.carTripFlexibility === "detourByAgreement"}
                    icon={<Car size={20} />}
                    title={copy.detourByAgreement}
                    description={isFr ? "Flexible selon accord" : "Flexible upon agreement"}
                    onClick={() => {
                      setDraft((prev) => ({
                        ...prev,
                        carTripFlexibility: "detourByAgreement",
                      }));
                      onClose();
                    }}
                  />
                </>
              )}
            </div>
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

import { useState } from "react";
import CityAutocomplete, { type PlaceDetails } from "@/components/search/CityAutocomplete";
import type { CreateTripCopy, Draft, TripDocumentDraft } from "../create-trip.types";
import type { ValidationErrors } from "../create-trip.config";
import {
  FieldError,
  FormField,
  FormInput,
  SectionLabel,
  SegmentedControl,
  SwapButton,
} from "../TripFormUi";
import DocumentUpload from "../DocumentUpload";

function toDateInputValue(date?: Date) {
  if (!date) return "";
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fromDateInputValue(value: string) {
  if (!value) return undefined;
  return new Date(`${value}T12:00:00`);
}

/* ── City field: static when filled, autocomplete on click ── */

function CityField({
                     label,
                     value,
                     onChangeAction,
                     onSelectAction,
                     onPlaceSelectAction,
                     placeholder,
                     isFr,
                     error,
                   }: {
  label: string;
  value: string;
  onChangeAction: (v: string) => void;
  onSelectAction: (v: string) => void;
  onPlaceSelectAction: (details: PlaceDetails) => void;
  placeholder: string;
  isFr: boolean;
  error?: string;
}) {
  const [editing, setEditing] = useState(false);
  const hasFilled = value.length > 0 && !editing;

  if (hasFilled) {
    return (
      <div>
        <label className="mb-1.5 block text-[12px] text-slate-500 dark:text-slate-400">
          {label}
        </label>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-[13px] text-slate-900 transition-colors hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:border-slate-600"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="flex-shrink-0 text-slate-400"
          >
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span className="flex-1 truncate">{value}</span>
        </button>
      </div>
    );
  }

  return (
    <div>
      <label className="mb-1.5 block text-[12px] text-slate-500 dark:text-slate-400">
        {label}
      </label>
      <CityAutocomplete
        value={value}
        action={(v: string) => onChangeAction(v)}
        onSelect={(v: string) => {
          onSelectAction(v);
          setEditing(false);
        }}
        onPlaceSelect={(details: PlaceDetails) => {
          onPlaceSelectAction(details);
        }}
        placeholder={placeholder}
        language={isFr ? "fr" : "en"}
        autoFocus={editing}
        inputClassName="text-[13px]"
      />
      <FieldError error={error} />
    </div>
  );
}

export default function StepTrip({
                                   copy,
                                   isFr,
                                   draft,
                                   setDraft,
                                   errors,
                                 }: {
  copy: CreateTripCopy;
  isFr: boolean;
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  errors: ValidationErrors;
}) {
  const swapFromTo = () => {
    setDraft((prev) => ({
      ...prev,
      from: prev.to,
      to: prev.from,
      fromPlace: prev.toPlace,
      toPlace: prev.fromPlace,
    }));
  };

  const showFlightSub = draft.transportMode === "plane";
  const showTrainSub = draft.transportMode === "train";
  const showCarSub = draft.transportMode === "car";
  const showLayoverCities =
    draft.transportMode === "plane" && draft.flightType === "withLayover";
  const showTrainStopCities =
    draft.transportMode === "train" &&
    (draft.trainTripType === "withConnection" ||
      draft.trainTripType === "withIntermediateStops");

  const refPlaceholder =
    draft.transportMode === "plane"
      ? "Ex. AF1234"
      : draft.transportMode === "train"
        ? "Ex. TGV 6231"
        : "Ex. BL-7890";

  const handleAddDocs = (docs: TripDocumentDraft[]) => {
    setDraft((prev) => ({
      ...prev,
      tripDocuments: [...prev.tripDocuments, ...docs],
    }));
  };

  const handleRemoveDoc = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      tripDocuments: prev.tripDocuments.filter((d) => d.id !== id),
    }));
  };

  return (
    <div>
      {/* Transport + Type — separate labels, grid 50/50 */}
      <div className="grid grid-cols-2 gap-x-6">
        <div>
          <SectionLabel first>{isFr ? "Transport" : "Transport"}</SectionLabel>
          <SegmentedControl
            value={draft.transportMode}
            options={[
              { value: "plane", label: copy.plane },
              { value: "train", label: copy.train },
              { value: "car", label: copy.car },
            ]}
            onChange={(value) =>
              setDraft((prev) => ({
                ...prev,
                transportMode: value as Draft["transportMode"],
                flightType: value === "plane" ? prev.flightType : null,
                trainTripType: value === "train" ? prev.trainTripType : null,
                carTripFlexibility:
                  value === "car" ? prev.carTripFlexibility : null,
              }))
            }
            error={errors.transportMode}
          />
        </div>
        <div>
          <SectionLabel first>
            {isFr ? "Type d'annonce" : "Trip type"}
          </SectionLabel>
          <SegmentedControl
            value={draft.tripType}
            options={[
              { value: "oneWay", label: copy.oneWay },
              { value: "roundTrip", label: copy.roundTrip },
            ]}
            onChange={(value) =>
              setDraft((prev) => ({
                ...prev,
                tripType: value as Draft["tripType"],
              }))
            }
          />
        </div>
      </div>

      {/* Conditional: flight type + layover cities */}
      {showFlightSub && (
        <div className="animate-[fadeSlide_0.2s_ease]">
          <SectionLabel>{copy.tripPathType}</SectionLabel>
          <div className="grid grid-cols-2 items-start gap-x-6">
            <SegmentedControl
              value={draft.flightType}
              options={[
                { value: "direct", label: copy.directFlight },
                { value: "withLayover", label: copy.withLayover },
              ]}
              onChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  flightType: value as Draft["flightType"],
                }))
              }
              error={errors.flightType}
            />
            {showLayoverCities && (
              <div className="animate-[fadeSlide_0.15s_ease]">
                <FormInput
                  value={draft.flightLayoverCities}
                  onChange={(v: string) =>
                    setDraft((prev) => ({
                      ...prev,
                      flightLayoverCities: v,
                    }))
                  }
                  placeholder={isFr ? "Ville d'escale" : "Layover city"}
                  error={errors.flightLayoverCities}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Conditional: train type + stop cities */}
      {showTrainSub && (
        <div className="animate-[fadeSlide_0.2s_ease]">
          <SectionLabel>{copy.tripPathType}</SectionLabel>
          <div className="grid grid-cols-2 items-start gap-x-6">
            <SegmentedControl
              value={draft.trainTripType}
              options={[
                { value: "direct", label: copy.directTrain },
                { value: "withConnection", label: copy.withConnection },
                {
                  value: "withIntermediateStops",
                  label: copy.withIntermediateStops,
                },
              ]}
              onChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  trainTripType: value as Draft["trainTripType"],
                }))
              }
              error={errors.trainTripType}
            />
            {showTrainStopCities && (
              <div className="animate-[fadeSlide_0.15s_ease]">
                <FormInput
                  value={draft.trainStopCities}
                  onChange={(v: string) =>
                    setDraft((prev) => ({
                      ...prev,
                      trainStopCities: v,
                    }))
                  }
                  placeholder={
                    isFr ? "Ville de correspondance" : "Connection city"
                  }
                  error={errors.trainStopCities}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Conditional: car flexibility */}
      {showCarSub && (
        <div className="animate-[fadeSlide_0.2s_ease]">
          <SectionLabel>{copy.tripPathType}</SectionLabel>
          <SegmentedControl
            value={draft.carTripFlexibility}
            options={[
              { value: "direct", label: copy.directTrip },
              { value: "detourByAgreement", label: copy.detourByAgreement },
            ]}
            onChange={(value) =>
              setDraft((prev) => ({
                ...prev,
                carTripFlexibility: value as Draft["carTripFlexibility"],
              }))
            }
            error={errors.carTripFlexibility}
          />
        </div>
      )}

      {/* Route: From / Swap / To */}
      <SectionLabel>{isFr ? "Itinéraire" : "Route"}</SectionLabel>
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <CityField
          label={copy.from}
          value={draft.from}
          onChangeAction={(v) =>
            setDraft((prev) => ({ ...prev, from: v, fromPlace: null }))
          }
          onSelectAction={(v) =>
            setDraft((prev) => ({ ...prev, from: v }))
          }
          onPlaceSelectAction={(details) =>
            setDraft((prev) => ({ ...prev, fromPlace: details }))
          }
          placeholder={isFr ? "Ville de départ" : "Departure city"}
          isFr={isFr}
          error={errors.from}
        />
        <SwapButton onClick={swapFromTo} />
        <CityField
          label={copy.to}
          value={draft.to}
          onChangeAction={(v) =>
            setDraft((prev) => ({ ...prev, to: v, toPlace: null }))
          }
          onSelectAction={(v) =>
            setDraft((prev) => ({ ...prev, to: v }))
          }
          onPlaceSelectAction={(details) =>
            setDraft((prev) => ({ ...prev, toPlace: details }))
          }
          placeholder={isFr ? "Ville d'arrivée" : "Arrival city"}
          isFr={isFr}
          error={errors.to}
        />
      </div>

      {/* Dates & times */}
      <SectionLabel>
        {isFr ? "Dates & horaires" : "Dates & times"}
      </SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <FormField label={copy.date} error={errors.departureDate}>
          <input
            type="date"
            value={toDateInputValue(draft.departureDate)}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                departureDate: fromDateInputValue(e.target.value),
              }))
            }
            className={[
              "w-full rounded-lg border bg-white px-3 py-2.5 text-[13px] text-slate-900 focus:outline-none dark:bg-slate-900 dark:text-white",
              errors.departureDate
                ? "border-[#FF9900]"
                : "border-slate-200 focus:border-[#FF9900] dark:border-slate-700",
            ].join(" ")}
          />
        </FormField>

        <FormField label={copy.arrivalDate} error={errors.arrivalDate}>
          <input
            type="date"
            value={toDateInputValue(draft.arrivalDate)}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                arrivalDate: fromDateInputValue(e.target.value),
              }))
            }
            className={[
              "w-full rounded-lg border bg-white px-3 py-2.5 text-[13px] text-slate-900 focus:outline-none dark:bg-slate-900 dark:text-white",
              errors.arrivalDate
                ? "border-[#FF9900]"
                : "border-slate-200 focus:border-[#FF9900] dark:border-slate-700",
            ].join(" ")}
          />
        </FormField>

        <FormField label={copy.departureTime} error={errors.departureTime}>
          <input
            type="time"
            value={draft.departureTime}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                departureTime: e.target.value,
              }))
            }
            className={[
              "w-full rounded-lg border bg-white px-3 py-2.5 text-[13px] text-slate-900 focus:outline-none dark:bg-slate-900 dark:text-white",
              errors.departureTime
                ? "border-[#FF9900]"
                : "border-slate-200 focus:border-[#FF9900] dark:border-slate-700",
            ].join(" ")}
          />
        </FormField>

        <FormField label={copy.arrivalTime} error={errors.arrivalTime}>
          <input
            type="time"
            value={draft.arrivalTime}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                arrivalTime: e.target.value,
              }))
            }
            className={[
              "w-full rounded-lg border bg-white px-3 py-2.5 text-[13px] text-slate-900 focus:outline-none dark:bg-slate-900 dark:text-white",
              errors.arrivalTime
                ? "border-[#FF9900]"
                : "border-slate-200 focus:border-[#FF9900] dark:border-slate-700",
            ].join(" ")}
          />
        </FormField>
      </div>

      {/* Travel reference + Document upload */}
      <SectionLabel>
        {isFr ? "Référence & justificatif" : "Reference & proof"}
      </SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <FormField label={copy.travelReference}>
          <FormInput
            value={draft.travelReference}
            onChange={(v: string) =>
              setDraft((prev) => ({ ...prev, travelReference: v }))
            }
            placeholder={refPlaceholder}
          />
        </FormField>

        <DocumentUpload
          documents={draft.tripDocuments}
          onAddAction={handleAddDocs}
          onRemoveAction={handleRemoveDoc}
          label={copy.docUpload}
          hint={copy.docUploadSub}
        />
      </div>
    </div>
  );
}

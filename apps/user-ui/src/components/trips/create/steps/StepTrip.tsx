"use client";

import { CalendarDays, MapPin, Search } from "lucide-react";
import CityAutocomplete from "@/components/search/CityAutocomplete";
import { CreateTripCopy, Draft, MobileScreen } from "../create-trip.types";
import {
  CompactSegmentedControl,
  FieldCard,
  InputField,
  SectionTitle,
} from "../TripFormUi";

function toDateInputValue(date?: Date) {
  if (!date) return "";
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDateInputValue(value: string) {
  if (!value) return undefined;
  return new Date(`${value}T12:00:00`);
}

export default function StepTrip({
                                   copy,
                                   isFr,
                                   draft,
                                   setDraft,
                                   pathTypeLabel,
                                   setMobileScreen,
                                 }: {
  copy: CreateTripCopy;
  isFr: boolean;
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  pathTypeLabel: string;
  setMobileScreen: (value: MobileScreen) => void;
}) {
  const showFlightLayoverCities =
    draft.transportMode === "plane" && draft.flightType === "withLayover";

  const showTrainStopCities =
    draft.transportMode === "train" &&
    (draft.trainTripType === "withConnection" ||
      draft.trainTripType === "withIntermediateStops");

  const travelReferencePlaceholder =
    draft.transportMode === "plane"
      ? isFr
        ? "Ex. AF1234"
        : "E.g. AF1234"
      : draft.transportMode === "train"
        ? isFr
          ? "Ex. TGV 1234"
          : "E.g. TGV 1234"
        : isFr
          ? "Ex. Paris → Lyon"
          : "E.g. Paris → Lyon";

  return (
    <>
      <SectionTitle title={copy.step1Title} subtitle={copy.step1Sub} />

      <div className="space-y-4">
        <CompactSegmentedControl
          label={isFr ? "Mode de transport" : "Transport mode"}
          value={draft.transportMode}
          columns={3}
          options={[
            { value: "plane", label: copy.plane },
            { value: "train", label: copy.train },
            { value: "car", label: copy.car },
          ]}
          onChange={(value) =>
            setDraft((prev) => ({
              ...prev,
              transportMode: value,
              flightType: value === "plane" ? prev.flightType : null,
              trainTripType: value === "train" ? prev.trainTripType : null,
              carTripFlexibility: value === "car" ? prev.carTripFlexibility : null,
              flightLayoverCities: value === "plane" ? prev.flightLayoverCities : "",
              trainStopCities: value === "train" ? prev.trainStopCities : "",
            }))
          }
        />

        <CompactSegmentedControl
          label={isFr ? "Type d’annonce" : "Trip format"}
          value={draft.tripType}
          columns={2}
          options={[
            { value: "oneWay", label: copy.oneWay },
            { value: "roundTrip", label: copy.roundTrip },
          ]}
          onChange={(value) =>
            setDraft((prev) => ({
              ...prev,
              tripType: value,
            }))
          }
        />
      </div>

      <div className="mt-6 hidden gap-4 md:grid md:grid-cols-2">
        <label className="block">
          <div className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
            {copy.from}
          </div>
          <div className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
            <CityAutocomplete
              value={draft.from}
              action={(value) => setDraft((prev) => ({ ...prev, from: value }))}
              placeholder={copy.from}
              language={isFr ? "fr" : "en"}
            />
          </div>
        </label>

        <label className="block">
          <div className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
            {copy.to}
          </div>
          <div className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
            <CityAutocomplete
              value={draft.to}
              action={(value) => setDraft((prev) => ({ ...prev, to: value }))}
              placeholder={copy.to}
              language={isFr ? "fr" : "en"}
            />
          </div>
        </label>

        <InputField
          label={copy.date}
          type="date"
          value={toDateInputValue(draft.departureDate)}
          onChange={(value) =>
            setDraft((prev) => ({
              ...prev,
              departureDate: fromDateInputValue(value),
            }))
          }
        />

        <InputField
          label={copy.arrivalDate}
          type="date"
          value={toDateInputValue(draft.arrivalDate)}
          onChange={(value) =>
            setDraft((prev) => ({
              ...prev,
              arrivalDate: fromDateInputValue(value),
            }))
          }
        />

        <InputField
          label={copy.departureTime}
          type="time"
          value={draft.departureTime}
          onChange={(value) => setDraft((prev) => ({ ...prev, departureTime: value }))}
        />

        <InputField
          label={copy.arrivalTime}
          type="time"
          value={draft.arrivalTime}
          onChange={(value) => setDraft((prev) => ({ ...prev, arrivalTime: value }))}
        />
      </div>

      <div className="mt-6 grid gap-4 md:hidden">
        <FieldCard
          label={copy.from}
          value={draft.from || copy.emptyValue}
          icon={<MapPin size={18} />}
          onClick={() => setMobileScreen("from")}
        />
        <FieldCard
          label={copy.to}
          value={draft.to || copy.emptyValue}
          icon={<MapPin size={18} />}
          onClick={() => setMobileScreen("to")}
        />
        <FieldCard
          label={copy.date}
          value={
            draft.departureDate
              ? draft.departureDate.toLocaleDateString(isFr ? "fr-FR" : "en-US")
              : copy.emptyValue
          }
          icon={<CalendarDays size={18} />}
          onClick={() => setMobileScreen("date")}
        />
        <FieldCard
          label={copy.arrivalDate}
          value={
            draft.arrivalDate
              ? draft.arrivalDate.toLocaleDateString(isFr ? "fr-FR" : "en-US")
              : copy.emptyValue
          }
          icon={<CalendarDays size={18} />}
          onClick={() => setMobileScreen("arrivalDate")}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <InputField
            label={copy.departureTime}
            type="time"
            value={draft.departureTime}
            onChange={(value) => setDraft((prev) => ({ ...prev, departureTime: value }))}
          />
          <InputField
            label={copy.arrivalTime}
            type="time"
            value={draft.arrivalTime}
            onChange={(value) => setDraft((prev) => ({ ...prev, arrivalTime: value }))}
          />
        </div>
      </div>

      <div className="mt-6 md:hidden">
        <FieldCard
          label={copy.tripPathType}
          value={pathTypeLabel}
          icon={<Search size={18} />}
          onClick={() => setMobileScreen("pathType")}
        />
      </div>

      <div className="mt-6 hidden md:block">
        {draft.transportMode === "plane" && (
          <CompactSegmentedControl
            label={copy.tripPathType}
            value={draft.flightType}
            columns={2}
            options={[
              { value: "direct", label: copy.directFlight },
              { value: "withLayover", label: copy.withLayover },
            ]}
            onChange={(value) =>
              setDraft((prev) => ({
                ...prev,
                flightType: value,
                ...(value === "direct" ? { flightLayoverCities: "" } : {}),
              }))
            }
          />
        )}

        {draft.transportMode === "train" && (
          <CompactSegmentedControl
            label={copy.tripPathType}
            value={draft.trainTripType}
            columns={3}
            options={[
              { value: "direct", label: copy.directTrain },
              { value: "withConnection", label: copy.withConnection },
              { value: "withIntermediateStops", label: copy.withIntermediateStops },
            ]}
            onChange={(value) =>
              setDraft((prev) => ({
                ...prev,
                trainTripType: value,
                ...(value === "direct" ? { trainStopCities: "" } : {}),
              }))
            }
          />
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
            onChange={(value) =>
              setDraft((prev) => ({
                ...prev,
                carTripFlexibility: value,
              }))
            }
          />
        )}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {showFlightLayoverCities ? (
          <InputField
            label={copy.flightLayoverCities}
            value={draft.flightLayoverCities}
            onChange={(value) => setDraft((prev) => ({ ...prev, flightLayoverCities: value }))}
            placeholder={isFr ? "Ex. Casablanca, Madrid" : "E.g. Casablanca, Madrid"}
          />
        ) : null}

        {showTrainStopCities ? (
          <InputField
            label={copy.trainStopCities}
            value={draft.trainStopCities}
            onChange={(value) => setDraft((prev) => ({ ...prev, trainStopCities: value }))}
            placeholder={isFr ? "Ex. Lyon, Valence, Marseille" : "E.g. Lyon, Valence, Marseille"}
          />
        ) : null}

        <InputField
          label={copy.travelReference}
          value={draft.travelReference}
          onChange={(value) => setDraft((prev) => ({ ...prev, travelReference: value }))}
          placeholder={travelReferencePlaceholder}
        />
      </div>
    </>
  );
}

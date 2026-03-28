"use client";

import { CalendarDays, MapPin, Search } from "lucide-react";
import { CreateTripCopy, Draft, MobileScreen } from "../create-trip.types";
import { FieldCard, InputField, SectionTitle } from "../TripFormUi";

export default function StepRoute({
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

  return (
    <>
      <SectionTitle title={copy.step2Title} subtitle={copy.step2Sub} />

      <div className="grid gap-4 md:grid-cols-2">
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

      <div className="mt-6">
        <FieldCard
          label={copy.tripPathType}
          value={pathTypeLabel}
          icon={<Search size={18} />}
          onClick={() => setMobileScreen("pathType")}
        />
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
          placeholder={isFr ? "Ex. AF1234 / TGV 1234 / Paris → Lyon" : "E.g. AF1234 / TGV 1234 / Paris → Lyon"}
        />
      </div>
    </>
  );
}

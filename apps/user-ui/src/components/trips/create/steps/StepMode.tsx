"use client";

import { Car, ChevronRight, Plane, Plus, Train } from "lucide-react";
import { CreateTripCopy, Draft } from "../create-trip.types";
import { ChoiceCard, SectionTitle } from "../TripFormUi";

export default function StepMode({
                                   copy,
                                   isFr,
                                   draft,
                                   setDraft,
                                 }: {
  copy: CreateTripCopy;
  isFr: boolean;
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
}) {
  return (
    <>
      <SectionTitle title={copy.step1Title} subtitle={copy.step1Sub} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ChoiceCard
          active={draft.transportMode === "plane"}
          icon={<Plane size={24} />}
          title={copy.plane}
          description={isFr ? "Trajet aérien avec ou sans escale" : "Air trip with or without layover"}
          onClick={() =>
            setDraft((prev) => ({
              ...prev,
              transportMode: "plane",
              trainTripType: null,
              carTripFlexibility: null,
            }))
          }
        />
        <ChoiceCard
          active={draft.transportMode === "train"}
          icon={<Train size={24} />}
          title={copy.train}
          description={isFr ? "Trajet ferroviaire direct ou avec correspondance" : "Rail trip direct or with connection"}
          onClick={() =>
            setDraft((prev) => ({
              ...prev,
              transportMode: "train",
              flightType: null,
              carTripFlexibility: null,
            }))
          }
        />
        <ChoiceCard
          active={draft.transportMode === "car"}
          icon={<Car size={24} />}
          title={copy.car}
          description={isFr ? "Trajet routier avec flexibilité éventuelle" : "Road trip with optional flexibility"}
          onClick={() =>
            setDraft((prev) => ({
              ...prev,
              transportMode: "car",
              flightType: null,
              trainTripType: null,
            }))
          }
        />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <ChoiceCard
          active={draft.tripType === "oneWay"}
          icon={<ChevronRight size={20} />}
          title={copy.oneWay}
          description={isFr ? "Un seul trajet publié" : "A single published trip"}
          onClick={() => setDraft((prev) => ({ ...prev, tripType: "oneWay" }))}
        />
        <ChoiceCard
          active={draft.tripType === "roundTrip"}
          icon={<Plus size={20} />}
          title={copy.roundTrip}
          description={isFr ? "Publier un aller et un retour" : "Publish an outbound and return trip"}
          onClick={() => setDraft((prev) => ({ ...prev, tripType: "roundTrip" }))}
        />
      </div>
    </>
  );
}

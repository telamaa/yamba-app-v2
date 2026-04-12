import { FileText, ShieldCheck } from "lucide-react";
import type { CreateTripCopy, Draft, Step } from "../create-trip.types";
import { getCategoryOptions } from "../create-trip.copy";
import {ReviewCard, SectionLabel} from "@/components/trips/create/TripFormUi";


const MANGO = "#FF9900";

function formatDate(d?: Date): string {
  if (!d) return "—";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function getTransportLabel(draft: Draft, copy: CreateTripCopy): string {
  const mode =
    draft.transportMode === "plane" ? copy.plane
      : draft.transportMode === "train" ? copy.train
        : draft.transportMode === "car" ? copy.car
          : "—";

  let subType = "";
  if (draft.transportMode === "plane" && draft.flightType) {
    subType = draft.flightType === "direct" ? copy.directFlight : copy.withLayover;
  }
  if (draft.transportMode === "train" && draft.trainTripType) {
    subType =
      draft.trainTripType === "direct" ? copy.directTrain
        : draft.trainTripType === "withConnection" ? copy.withConnection
          : copy.withIntermediateStops;
  }
  if (draft.transportMode === "car" && draft.carTripFlexibility) {
    subType = draft.carTripFlexibility === "direct" ? copy.directTrip : copy.detourByAgreement;
  }

  return subType ? `${mode} · ${subType}` : mode;
}

export default function StepReview({
                                     copy,
                                     isFr,
                                     draft,
                                     onGoTo,
                                   }: {
  copy: CreateTripCopy;
  isFr: boolean;
  draft: Draft;
  onGoTo: (step: Step) => void;
}) {
  const categoryOptions = getCategoryOptions(isFr);

  const optionsList: string[] = [];
  if (draft.handDeliveryOnly) optionsList.push(copy.handOnly);
  if (draft.instantBooking) optionsList.push(copy.instantBooking);

  return (
    <div>
      <SectionLabel first>{copy.step3Title}</SectionLabel>
      <p className="mb-5 text-[13px] text-slate-500 dark:text-slate-400">{copy.step3Sub}</p>

      {/* Transport */}
      <ReviewCard
        label={copy.reviewMode}
        value={getTransportLabel(draft, copy)}
        sub={draft.tripType === "roundTrip" ? copy.roundTrip : copy.oneWay}
        onEdit={() => onGoTo(1)}
        editLabel={copy.edit}
      />

      {/* Route */}
      <ReviewCard
        label={copy.reviewRoute}
        value={draft.from && draft.to ? `${draft.from} → ${draft.to}` : "—"}
        sub={
          [
            draft.flightLayoverCities && `Escale : ${draft.flightLayoverCities}`,
            draft.trainStopCities && `Correspondance : ${draft.trainStopCities}`,
            draft.travelReference && `Réf. ${draft.travelReference}`,
          ]
            .filter(Boolean)
            .join(" · ") || undefined
        }
        onEdit={() => onGoTo(1)}
        editLabel={copy.edit}
      />

      {/* Dates */}
      <ReviewCard
        label={copy.reviewSchedule}
        value={`${formatDate(draft.departureDate)}${draft.arrivalDate ? ` → ${formatDate(draft.arrivalDate)}` : ""}`}
        sub={
          [draft.departureTime, draft.arrivalTime].filter(Boolean).join(" → ") || undefined
        }
        onEdit={() => onGoTo(1)}
        editLabel={copy.edit}
      />

      {/* Documents */}
      {draft.tripDocuments.length > 0 && (
        <ReviewCard
          label={copy.reviewDocuments}
          onEdit={() => onGoTo(1)}
          editLabel={copy.edit}
        >
          <div className="space-y-1.5">
            {draft.tripDocuments.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-2 text-[12px] text-slate-600 dark:text-slate-400"
              >
                <FileText size={13} className="flex-shrink-0 text-slate-400" />
                <span className="truncate">{doc.name}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5 pt-1">
              <ShieldCheck size={12} className="text-emerald-600 dark:text-emerald-400" />
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                {copy.docPending}
              </span>
            </div>
          </div>
        </ReviewCard>
      )}

      {/* Categories & prices */}
      <ReviewCard
        label={copy.reviewCategoryConditions}
        onEdit={() => onGoTo(2)}
        editLabel={copy.edit}
      >
        <div className="flex flex-wrap gap-2">
          {draft.acceptedCategories.map((catKey) => {
            const opt = categoryOptions.find((o) => o.key === catKey);
            const condition = draft.categoryConditions[catKey];
            if (!opt) return null;

            return (
              <div
                key={catKey}
                className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 dark:bg-slate-800"
              >
                <span className="text-[13px] font-medium text-slate-900 dark:text-white">
                  {opt.label}
                </span>
                {condition && condition.priceAmount !== "" && (
                  <span className="text-[13px] font-medium" style={{ color: MANGO }}>
                    {condition.priceAmount}€
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </ReviewCard>

      {/* Options */}
      {optionsList.length > 0 && (
        <ReviewCard
          label={copy.options}
          value={optionsList.join(" · ")}
          onEdit={() => onGoTo(2)}
          editLabel={copy.edit}
        />
      )}

      {/* Notes */}
      {draft.notes && (
        <ReviewCard
          label={copy.notes}
          value={draft.notes}
          onEdit={() => onGoTo(2)}
          editLabel={copy.edit}
        />
      )}
    </div>
  );
}

import { FileText, ShieldCheck } from "lucide-react";
import type { CreateTripCopy, Draft, Step, TripDocumentDraft } from "../create-trip.types";
import { getCategoryOptions } from "../create-trip.copy";
import { CABIN_BAG_KG, CHECKED_BAG_KG, PARCEL_FAMILIES, estimateNetGain, isBagActive } from "../create-trip.config";
import { formatMoney, formatPerKg } from "@/lib/pricing-example";
import { intlTagFor } from "@/lib/number-format";
import { FormField, FormInput, ReviewCard, SectionLabel } from "@/components/trips/create/TripFormUi";
import DocumentUpload from "../DocumentUpload";
import TripPublicPreview, { summarizeLocations } from "../TripPublicPreview";

const MANGO = "#FF9900";

function formatDate(d?: Date): string {
  if (!d) return "—";
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getTransportLabel(draft: Draft, copy: CreateTripCopy): string {
  const mode =
    draft.transportMode === "plane"
      ? copy.plane
      : draft.transportMode === "train"
        ? copy.train
        : draft.transportMode === "car"
          ? copy.car
          : "—";

  let subType = "";
  if (draft.transportMode === "plane" && draft.flightType) {
    subType =
      draft.flightType === "direct" ? copy.directFlight : copy.withLayover;
  }
  if (draft.transportMode === "train" && draft.trainTripType) {
    subType =
      draft.trainTripType === "direct" ? copy.directTrain : copy.withConnection;
  }
  if (draft.transportMode === "car" && draft.carTripFlexibility) {
    subType =
      draft.carTripFlexibility === "direct"
        ? copy.directTrip
        : copy.detourByAgreement;
  }

  return subType ? `${mode} · ${subType}` : mode;
}

export default function StepReview({
                                     copy,
                                     isFr,
                                     draft,
                                     setDraft,
                                     onGoTo,
                                   }: {
  copy: CreateTripCopy;
  isFr: boolean;
  draft: Draft;
  /** D111 — la vérification ÉCRIT désormais : elle porte le billet. */
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  onGoTo: (step: Step) => void;
}) {
  const tag = intlTagFor(isFr ? "fr" : "en");
  const categoryOptions = getCategoryOptions(isFr);

  const refPlaceholder =
    draft.transportMode === "plane"
      ? "Ex. AF1234"
      : draft.transportMode === "train"
        ? "Ex. TGV 6231"
        : "Ex. BL-7890";

  const handleAddDocs = (docs: TripDocumentDraft[]) => {
    setDraft((prev) => ({ ...prev, tripDocuments: [...prev.tripDocuments, ...docs] }));
  };

  const handleRemoveDoc = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      tripDocuments: prev.tripDocuments.filter((d) => d.id !== id),
    }));
  };

  const optionsList: string[] = [];
  if (draft.handDeliveryOnly) optionsList.push(copy.handOnly);
  // D20 v1 : l'option instantanée n'est plus proposée — jamais affichée

  const pickupSummary = summarizeLocations(draft.pickupLocations, copy, isFr);
  const deliverySummary = summarizeLocations(draft.deliveryLocations, copy, isFr);

  return (
    <div>
      <SectionLabel first>{copy.step3Title}</SectionLabel>
      <p className="mb-5 text-[13px] text-slate-500 dark:text-slate-400">
        {copy.step3Sub}
      </p>

      {/* ⭐ Public preview */}
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {copy.publicPreview}
      </div>
      <div className="mb-6">
        <TripPublicPreview draft={draft} copy={copy} isFr={isFr} />
      </div>

      {/* Edit-a-section header */}
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {isFr ? "Modifier une section" : "Edit a section"}
      </div>

      {/* Transport */}
      <ReviewCard
        label={copy.reviewMode}
        value={getTransportLabel(draft, copy)}
        // D111 — la sous-ligne disait « Aller simple » ou « Aller-retour ».
        // Le choix a disparu de l'étape ① (il ne créait jamais de second
        // trajet), donc cette ligne ne dirait plus qu'une seule chose, pour
        // toujours. Une valeur qui ne peut pas varier n'informe personne :
        // `getTransportLabel` porte déjà le mode ET son type (vol direct,
        // avec escale…), qui eux changent.
        onEdit={() => onGoTo(1)}
        editLabel={copy.edit}
      />

      {/* Route */}
      <ReviewCard
        label={copy.reviewRoute}
        value={
          draft.from && draft.to ? `${draft.from} → ${draft.to}` : "—"
        }
        sub={
          [
            draft.flightLayoverCities &&
            (isFr
              ? `Escale : ${draft.flightLayoverCities}`
              : `Layover: ${draft.flightLayoverCities}`),
            draft.trainStopCities &&
            (isFr
              ? `Correspondance : ${draft.trainStopCities}`
              : `Connection: ${draft.trainStopCities}`),
            draft.travelReference &&
            (isFr
              ? `Réf. ${draft.travelReference}`
              : `Ref. ${draft.travelReference}`),
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
        value={`${formatDate(draft.departureDate)}${
          draft.arrivalDate ? ` → ${formatDate(draft.arrivalDate)}` : ""
        }`}
        sub={
          [draft.departureTime, draft.arrivalTime].filter(Boolean).join(" → ") ||
          undefined
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
                <FileText
                  size={13}
                  className="flex-shrink-0 text-slate-400"
                />
                <span className="truncate">{doc.name}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5 pt-1">
              <ShieldCheck
                size={12}
                className="text-emerald-600 dark:text-emerald-400"
              />
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                {copy.docPending}
              </span>
            </div>
          </div>
        </ReviewCard>
      )}

      {/* ⭐ Prix & capacité (moteur PER_KG — D13/D14/D19) */}
      {typeof draft.pricePerKg === "number" && draft.pricePerKg > 0 && (
        <ReviewCard
          label={copy.reviewPricing}
          onEdit={() => onGoTo(2)}
          editLabel={copy.edit}
        >
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="text-[18px] font-extrabold tabular-nums" style={{ color: MANGO }}>
              {formatPerKg(draft.pricePerKg, tag)}
            </span>
            {typeof draft.capacityKg === "number" && draft.capacityKg > 0 && (
              <span className="text-[13px] font-medium text-slate-700 dark:text-slate-300">
                {copy.availableKg(draft.capacityKg)}
              </span>
            )}
            {estimateNetGain(draft) > 0 && (
              <span className="text-[13px] font-semibold text-[#0F766E] dark:text-teal-400">
                {copy.netGain} {formatMoney(estimateNetGain(draft), tag)}
              </span>
            )}
          </div>

          {PARCEL_FAMILIES.some((f) => draft.familyConditions[f.key].mode !== "ACCEPT") && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PARCEL_FAMILIES.filter((f) => draft.familyConditions[f.key].mode !== "ACCEPT").map((f) => {
                const c = draft.familyConditions[f.key];
                const refused = c.mode === "REFUSE";
                return (
                  <span
                    key={f.key}
                    className={[
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                      refused
                        ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                        : "text-slate-900 dark:text-[#FFB84D]",
                    ].join(" ")}
                    style={refused ? undefined : { backgroundColor: "rgba(255,153,0,0.10)" }}
                  >
                    {isFr ? f.labelFr : f.labelEn}
                    {refused ? ` · ${copy.refused.toLowerCase()}` : ` · ${copy.surchargeShort(c.surchargePct)}`}
                  </span>
                );
              })}
            </div>
          )}

          {(isBagActive(draft.checkedBag23Price, CHECKED_BAG_KG, draft.capacityKg) ||
            isBagActive(draft.cabinBag12Price, CABIN_BAG_KG, draft.capacityKg)) && (
            <div className="mt-2 flex flex-wrap gap-1.5 text-[12px] text-slate-600 dark:text-slate-400">
              {isBagActive(draft.checkedBag23Price, CHECKED_BAG_KG, draft.capacityKg) && (
                <span>{copy.checkedBag23} · {formatMoney(Number(draft.checkedBag23Price), tag)} ({copy.bagConsumes(CHECKED_BAG_KG)})</span>
              )}
              {isBagActive(draft.cabinBag12Price, CABIN_BAG_KG, draft.capacityKg) && (
                <span>{copy.cabinBag12} · {formatMoney(Number(draft.cabinBag12Price), tag)} ({copy.bagConsumes(CABIN_BAG_KG)})</span>
              )}
            </div>
          )}
        </ReviewCard>
      )}

      {/* Legacy PER_CATEGORY — seulement si AUCUNE offre PER_KG (trajet ancien non migré) */}
      {draft.acceptedCategories.length > 0 && !(typeof draft.pricePerKg === "number" && draft.pricePerKg > 0) && (
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
                  <span
                    className="text-[13px] font-medium"
                    style={{ color: MANGO }}
                  >
                    {formatMoney(Number(condition.priceAmount), tag)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </ReviewCard>
      )}

      {/* ⭐ Locations */}
      <ReviewCard
        label={copy.reviewLocations}
        onEdit={() => onGoTo(2)}
        editLabel={copy.edit}
      >
        <div className="space-y-2">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {copy.pickupLocations}
            </div>
            <div className="mt-0.5 text-[12px] text-slate-600 dark:text-slate-400">
              {pickupSummary}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {copy.deliveryLocations}
            </div>
            <div className="mt-0.5 text-[12px] text-slate-600 dark:text-slate-400">
              {deliverySummary}
            </div>
          </div>
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

      {/* D111 — LE BILLET, remonté de l'étape ① jusqu'ici.
          Il y vivait replié, facultatif, en bas d'un écran déjà long, alors
          qu'il débloque le badge « Voyage vérifié » — donc des réservations.
          Ici, il est à côté du bouton « Publier », au moment où le Voyageur
          est déjà engagé : c'est là qu'une pièce justificative se fournit. */}
      <div className="mt-6">
        <SectionLabel first>
          {isFr ? "Ton billet" : "Your ticket"}{" "}
          <span className="font-normal text-slate-400 dark:text-slate-500">
            · {isFr ? "facultatif" : "optional"}
          </span>
        </SectionLabel>
        <div className="grid grid-cols-1 gap-y-3 sm:grid-cols-2 sm:gap-x-3 sm:gap-y-0">
          <FormField label={copy.travelReference}>
            <FormInput
              value={draft.travelReference}
              onChange={(v: string) => setDraft((prev) => ({ ...prev, travelReference: v }))}
              placeholder={refPlaceholder}
            />
          </FormField>

          <DocumentUpload
            documents={draft.tripDocuments}
            onAddAction={handleAddDocs}
            onRemoveAction={handleRemoveDoc}
            label={copy.docUpload}
            hint={copy.docUploadSub}
            limitHint={copy.docLimitReached(5)}
          />
        </div>
        <p className="mt-2 text-[12px] text-slate-500 dark:text-slate-400">
          {isFr
            ? "Il débloque le badge « Voyage vérifié »."
            : "It unlocks the “Verified trip” badge."}
        </p>
      </div>
    </div>
  );
}

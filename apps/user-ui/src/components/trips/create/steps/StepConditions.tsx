"use client";

/**
 * StepConditions — étape 2 du wizard : l'offre tarifaire du Voyageur.
 * Miroir de context/mockup-pricing-yamba.html (colonne « Tu publies un
 * trajet »), refondu « dépôt d'annonce en 90 s » :
 *
 *   TON OFFRE   prix au kilo (pré-rempli à la médiane D15) + jauge · capacité
 *               (pré-remplie) · gain net immédiatement dessous (D16)
 *   ▸ Familles de colis        (accordéon fermé, résumé sur la ligne — D14)
 *   ▸ Bagage entier (forfait)  (accordéon fermé — PRC-04)
 *   Lieux de remise / livraison (obligatoires, inchangés)
 *   ▸ Options & message        (accordéon fermé)
 *
 * Trois champs obligatoires visibles (prix, capacité, un lieu par contexte),
 * tout le reste replié : un Voyageur pressé publie en deux « Continuer ».
 * Les explications vivent dans des popovers ⓘ (tap-friendly), pas en texte
 * courant. « Réservation instantanée » n'est plus proposée (D20 v1 : toute
 * demande passe par l'acceptation du Voyageur).
 *
 * Le moteur legacy PER_CATEGORY n'est plus saisi ici (A28) — un trajet
 * existant relu en édition migre vers PER_KG à sa prochaine publication.
 */

import React, { useCallback, useEffect, useMemo } from "react";
import type {
  CreateTripCopy,
  Draft,
  FamilyConditionDraft,
  ParcelFamily,
  TripLocationPoint,
} from "../create-trip.types";
import type { ValidationErrors } from "../create-trip.config";
import {
  CABIN_BAG_KG,
  CAPACITY_KG_RANGE,
  CHECKED_BAG_KG,
  DEFAULT_CAPACITY_KG,
  PARCEL_FAMILIES,
  PRICE_PER_KG_RANGE,
  SURCHARGE_PCT_RANGE,
  bagEquivalentPerKg,
  estimateNetGain,
  getDefaultLocationsForMode,
  getFairPriceVerdict,
  roundToHalf,
  suggestPricePerKg,
  summarizeFamilyConditions,
} from "../create-trip.config";
import { SectionLabel, Toggle } from "@/components/trips/create/TripFormUi";
import {
  Accordion,
  BAG_ICONS,
  BagFlatRateRow,
  FairPriceGauge,
  FamilyConditionRow,
  InfoHint,
  NetGainCard,
  SliderField,
  formatEur,
} from "../TripPricingUi";
import LocationsSection from "../LocationsSection";

export default function StepConditions({
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
  // La suggestion ne dépend que de 3 champs de l'étape 1 → mémo ciblé
  const suggestion = useMemo(
    () => suggestPricePerKg(draft),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft.transportMode, draft.flightType, draft.departureDate]
  );
  const verdict =
    typeof draft.pricePerKg === "number" && draft.pricePerKg > 0
      ? getFairPriceVerdict(draft.pricePerKg, suggestion)
      : null;
  const netGain = estimateNetGain(draft);
  const capacity = typeof draft.capacityKg === "number" ? draft.capacityKg : 0;

  /* ── Pré-remplissage (D15 : la suggestion guide, le Voyageur ajuste) ──
   * Une seule fois, à l'arrivée sur l'étape, si rien n'est encore saisi.
   * ──────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (draft.pricePerKg === "" || draft.capacityKg === "") {
      setDraft((prev) => ({
        ...prev,
        pricePerKg: prev.pricePerKg === "" ? roundToHalf(suggestion.median) : prev.pricePerKg,
        capacityKg: prev.capacityKg === "" ? DEFAULT_CAPACITY_KG : prev.capacityKg,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Defensive seed of default locations (mode édition) ── */
  useEffect(() => {
    const noPickup = (draft.pickupLocations?.length ?? 0) === 0;
    const noDelivery = (draft.deliveryLocations?.length ?? 0) === 0;
    if (draft.transportMode && noPickup && noDelivery) {
      const defaults = getDefaultLocationsForMode(draft.transportMode);
      setDraft((prev) => ({
        ...prev,
        pickupLocations: defaults.pickupLocations,
        deliveryLocations: defaults.deliveryLocations,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.transportMode]);

  /* ── Handlers (stables : les lignes famille sont mémoïsées) ── */

  const setField = useCallback(
    <K extends keyof Draft>(key: K, value: Draft[K]) =>
      setDraft((prev) => ({ ...prev, [key]: value })),
    [setDraft]
  );

  const familyHandlers = useMemo(
    () =>
      Object.fromEntries(
        PARCEL_FAMILIES.map((f) => [
          f.key,
          (next: FamilyConditionDraft) =>
            setDraft((prev) => ({
              ...prev,
              familyConditions: { ...prev.familyConditions, [f.key]: next },
            })),
        ])
      ) as Record<ParcelFamily, (next: FamilyConditionDraft) => void>,
    [setDraft]
  );

  const familyLabels = useMemo(
    () => ({
      accepted: copy.accepted,
      refused: copy.refused,
      addSurcharge: copy.addSurcharge,
      surcharge: copy.surchargeLabel,
      removeSurcharge: copy.removeSurcharge,
    }),
    [copy]
  );

  const handlePickupChange = (next: TripLocationPoint[]) => setField("pickupLocations", next);
  const handleDeliveryChange = (next: TripLocationPoint[]) => setField("deliveryLocations", next);

  /* ── Résumés des accordéons ── */
  const familiesSummary = summarizeFamilyConditions(draft.familyConditions, isFr) ?? copy.familiesAllAccepted;
  const bagsCount = (draft.checkedBag23Price !== "" ? 1 : 0) + (draft.cabinBag12Price !== "" ? 1 : 0);
  const bagsSummary = bagsCount === 0 ? copy.bagsNone : copy.bagsSummary(bagsCount);
  const optionsSummary = draft.handDeliveryOnly ? copy.handOnly : null;

  const eqChecked = bagEquivalentPerKg(draft.checkedBag23Price, CHECKED_BAG_KG);
  const eqCabin = bagEquivalentPerKg(draft.cabinBag12Price, CABIN_BAG_KG);

  /* ── Render ──────────────────────────────────────── */

  return (
    <div>
      {/* ═══ TON OFFRE : prix · capacité · gain ═══ */}
      <SectionLabel first>{copy.yourOffer}</SectionLabel>

      <div className="mb-1.5 flex items-center gap-1 text-[13px] font-medium text-slate-700 dark:text-slate-300">
        {copy.pricePerKg}
        <InfoHint label={copy.pricePerKg}>{copy.priceHint}</InfoHint>
      </div>
      <SliderField
        value={draft.pricePerKg}
        min={PRICE_PER_KG_RANGE.min}
        max={PRICE_PER_KG_RANGE.max}
        step={PRICE_PER_KG_RANGE.step}
        unit={copy.perKgUnit}
        ariaLabel={copy.pricePerKg}
        onChangeAction={(v) => setField("pricePerKg", v)}
        error={errors.pricePerKg}
      />
      <FairPriceGauge
        price={draft.pricePerKg}
        suggestion={suggestion}
        verdict={verdict}
        labels={{
          low: copy.gaugeLow,
          median: copy.gaugeMedian,
          high: copy.gaugeHigh,
          ok: copy.fairPriceOk,
          tooLow: copy.fairPriceLow,
          tooHigh: copy.fairPriceHigh,
        }}
      />
      <div className="-mt-1 flex items-center gap-1 text-[12px] text-slate-500 dark:text-slate-400">
        {copy.priceAnchor(formatEur(suggestion.median), formatEur(suggestion.low), formatEur(suggestion.high))}
        <InfoHint label={copy.whyThisPrice}>
          <span className="block font-semibold text-slate-800 dark:text-slate-100">{copy.whyThisPrice}</span>
          <ul className="mt-1 space-y-0.5">
            {suggestion.factors.map((f) => (
              <li key={f.key} className="flex justify-between gap-3">
                <span>
                  {f.key === "base"
                    ? copy.factorBase(formatEur(f.value ?? 0))
                    : f.key === "directFlight"
                      ? copy.factorDirectFlight
                      : copy.factorDepartureSoon}
                </span>
                {f.key !== "base" && (
                  <span className="tabular-nums font-medium">
                    {f.pct > 0 ? "+" : ""}
                    {f.pct} %
                  </span>
                )}
              </li>
            ))}
          </ul>
        </InfoHint>
      </div>

      <div className="mb-1.5 mt-5 flex items-center gap-1 text-[13px] font-medium text-slate-700 dark:text-slate-300">
        {copy.capacity}
        <InfoHint label={copy.capacity}>{copy.capacityHint}</InfoHint>
      </div>
      <SliderField
        value={draft.capacityKg}
        min={CAPACITY_KG_RANGE.min}
        max={CAPACITY_KG_RANGE.max}
        step={CAPACITY_KG_RANGE.step}
        unit={copy.kgUnit}
        ariaLabel={copy.capacity}
        onChangeAction={(v) => setField("capacityKg", v)}
        error={errors.capacityKg}
      />

      {netGain > 0 && capacity > 0 && (
        <div className="mt-4">
          <NetGainCard title={copy.netGainTitle(capacity)} amount={netGain} sub={copy.netGainPaid} />
        </div>
      )}

      {/* ═══ ▸ Familles de colis (D14) ═══ */}
      <div className="mt-6">
        <Accordion
          title={copy.families}
          summary={familiesSummary}
          actionLabel={copy.adjust}
          hint={<InfoHint label={copy.families}>{copy.familiesHint}</InfoHint>}
        >
          <div className="space-y-2">
            {PARCEL_FAMILIES.map((family) => (
              <FamilyConditionRow
                key={family.key}
                iconKey={family.icon}
                label={isFr ? family.labelFr : family.labelEn}
                condition={draft.familyConditions[family.key]}
                surchargeRange={SURCHARGE_PCT_RANGE}
                labels={familyLabels}
                onChangeAction={familyHandlers[family.key]}
                error={errors[`family_${family.key}`]}
              />
            ))}
          </div>
        </Accordion>

        {/* ═══ ▸ Bagage entier — forfait (PRC-04) ═══ */}
        <Accordion
          title={copy.bags}
          summary={bagsSummary}
          actionLabel={bagsCount === 0 ? copy.add : copy.adjust}
          hint={<InfoHint label={copy.bags}>{copy.bagsHint}</InfoHint>}
          defaultOpen={bagsCount > 0}
        >
          <div className="space-y-2">
            <BagFlatRateRow
              icon={BAG_ICONS.checked}
              label={copy.checkedBag23}
              hint={copy.bagConsumes(CHECKED_BAG_KG)}
              equivalent={eqChecked !== null ? copy.bagEquivalent(formatEur(eqChecked)) : null}
              disabledReason={capacity < CHECKED_BAG_KG ? copy.bagNeedsCapacity(CHECKED_BAG_KG) : null}
              value={draft.checkedBag23Price}
              onChangeAction={(v) => setField("checkedBag23Price", v)}
              error={errors.checkedBag23Price}
            />
            <BagFlatRateRow
              icon={BAG_ICONS.cabin}
              label={copy.cabinBag12}
              hint={copy.bagConsumes(CABIN_BAG_KG)}
              equivalent={eqCabin !== null ? copy.bagEquivalent(formatEur(eqCabin)) : null}
              disabledReason={capacity < CABIN_BAG_KG ? copy.bagNeedsCapacity(CABIN_BAG_KG) : null}
              value={draft.cabinBag12Price}
              onChangeAction={(v) => setField("cabinBag12Price", v)}
              error={errors.cabinBag12Price}
            />
          </div>
        </Accordion>
      </div>

      {/* ═══ Lieux de remise / livraison (obligatoires) ═══ */}
      <div className="mt-6">
        <LocationsSection
          context="PICKUP"
          title={copy.pickupLocations}
          subtitle={copy.pickupLocationsSub}
          locations={draft.pickupLocations ?? []}
          onChangeAction={handlePickupChange}
          copy={copy}
          error={errors.pickupLocations}
        />
      </div>
      <LocationsSection
        context="DELIVERY"
        title={copy.deliveryLocations}
        subtitle={copy.deliveryLocationsSub}
        locations={draft.deliveryLocations ?? []}
        onChangeAction={handleDeliveryChange}
        copy={copy}
        error={errors.deliveryLocations}
      />

      {/* ═══ ▸ Options & message ═══ */}
      <div className="mt-6">
        <Accordion
          title={copy.optionsAndMessage}
          summary={optionsSummary ?? (draft.notes.trim() ? draft.notes.trim() : null)}
          actionLabel={copy.adjust}
        >
          <div className="rounded-xl bg-slate-50 px-4 dark:bg-slate-800/50">
            <Toggle
              label={copy.handOnly}
              on={draft.handDeliveryOnly}
              onChange={(v) => setField("handDeliveryOnly", v)}
            />
          </div>
          <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">{copy.responseWithin24h}</p>
          <textarea
            value={draft.notes}
            onChange={(e) => setField("notes", e.target.value)}
            placeholder={copy.notesPlaceholder}
            rows={2}
            maxLength={2000}
            className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-[#FF9900] focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
          />
        </Accordion>
      </div>
    </div>
  );
}

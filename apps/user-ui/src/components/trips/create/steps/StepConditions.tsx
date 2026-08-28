"use client";

/**
 * StepConditions — étape 2 du wizard : l'offre tarifaire du Voyageur.
 * Miroir de context/mockup-pricing-yamba.html (colonne « Tu publies un
 * trajet ») : ① prix au kilo + jauge « prix juste » (D13/D15) ② capacité
 * (D19) ③ familles OK / +% / Non (D14) ④ bagages entiers forfait (PRC-04)
 * puis gain net (D16), lieux de remise/livraison, options, message.
 *
 * Le moteur legacy PER_CATEGORY n'est plus saisi ici (A28) — un trajet
 * existant relu en édition migre vers PER_KG à sa prochaine publication.
 */

import React, { useEffect, useMemo } from "react";
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
  PARCEL_FAMILIES,
  PRICE_PER_KG_RANGE,
  SURCHARGE_PCT_RANGE,
  estimateNetGain,
  getDefaultLocationsForMode,
  getFairPriceVerdict,
  suggestPricePerKg,
} from "../create-trip.config";
import { SectionLabel, Toggle } from "@/components/trips/create/TripFormUi";
import {
  BagFlatRateRow,
  FairPriceGauge,
  FamilyConditionRow,
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
  const suggestion = useMemo(() => suggestPricePerKg(draft), [draft]);
  const verdict =
    typeof draft.pricePerKg === "number" && draft.pricePerKg > 0
      ? getFairPriceVerdict(draft.pricePerKg, suggestion)
      : null;
  const netGain = estimateNetGain(draft);

  /* ── Defensive seed of default locations ─────────────
   * En mode édition, useEditTrip peut renvoyer un draft où
   * pickupLocations / deliveryLocations sont undefined ou [].
   * Si on a un transportMode mais pas (encore) de lieux, on
   * seed les défauts pour ce mode.
   * ──────────────────────────────────────────────────── */
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

  /* ── Handlers ────────────────────────────────────── */

  const setField = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const setFamily = (key: ParcelFamily, next: FamilyConditionDraft) =>
    setDraft((prev) => ({
      ...prev,
      familyConditions: { ...prev.familyConditions, [key]: next },
    }));

  const handlePickupChange = (next: TripLocationPoint[]) =>
    setField("pickupLocations", next);
  const handleDeliveryChange = (next: TripLocationPoint[]) =>
    setField("deliveryLocations", next);

  /* ── Render ──────────────────────────────────────── */

  return (
    <div>
      {/* ═══ Section 1 : Prix au kilo + jauge (D13/D15) ═══ */}
      <SectionLabel first>{copy.pricePerKg}</SectionLabel>
      <p className="-mt-1 mb-3 text-[12px] text-slate-400 dark:text-slate-500">
        {copy.pricePerKgSub}
      </p>
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
      <p className="mt-2 text-[12px] text-slate-500 dark:text-slate-400">
        {copy.priceAnchor(
          formatEur(suggestion.median),
          formatEur(suggestion.low),
          formatEur(suggestion.high)
        )}
      </p>

      {/* ═══ Section 2 : Capacité (D19) ═══ */}
      <SectionLabel>{copy.capacity}</SectionLabel>
      <p className="-mt-1 mb-3 text-[12px] text-slate-400 dark:text-slate-500">
        {copy.capacitySub}
      </p>
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
      <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
        ⚖️ {copy.capacityTolerance}
      </p>

      {/* ═══ Section 3 : Familles de colis (D14) ═══ */}
      <SectionLabel>{copy.families}</SectionLabel>
      <p className="-mt-1 mb-3 text-[12px] text-slate-400 dark:text-slate-500">
        {copy.familiesSub}
      </p>
      <div className="space-y-2">
        {PARCEL_FAMILIES.map((family) => (
          <FamilyConditionRow
            key={family.key}
            icon={family.icon}
            label={isFr ? family.labelFr : family.labelEn}
            condition={draft.familyConditions[family.key]}
            surchargeRange={SURCHARGE_PCT_RANGE}
            labels={{
              accept: copy.familyAccept,
              surcharge: copy.familySurcharge,
              refuse: copy.familyRefuse,
            }}
            onChangeAction={(next) => setFamily(family.key, next)}
            error={errors[`family_${family.key}`]}
          />
        ))}
      </div>

      {/* ═══ Section 4 : Bagages entiers — forfait (PRC-04) ═══ */}
      <SectionLabel>{copy.bags}</SectionLabel>
      <p className="-mt-1 mb-3 text-[12px] text-slate-400 dark:text-slate-500">
        {copy.bagsSub}
      </p>
      <div className="space-y-2">
        <BagFlatRateRow
          icon="🧳"
          label={copy.checkedBag23}
          hint={copy.bagConsumes(CHECKED_BAG_KG)}
          value={draft.checkedBag23Price}
          onChangeAction={(v) => setField("checkedBag23Price", v)}
          error={errors.checkedBag23Price}
        />
        <BagFlatRateRow
          icon="🎒"
          label={copy.cabinBag12}
          hint={copy.bagConsumes(CABIN_BAG_KG)}
          value={draft.cabinBag12Price}
          onChangeAction={(v) => setField("cabinBag12Price", v)}
          error={errors.cabinBag12Price}
        />
      </div>

      {/* ═══ Gain net (D16) ═══ */}
      {netGain > 0 && typeof draft.capacityKg === "number" && (
        <div className="mt-5 animate-[fadeSlide_0.2s_ease]">
          <NetGainCard
            title={copy.netGainIfFull(draft.capacityKg)}
            label={copy.netGain}
            amount={netGain}
            sub={copy.netGainSub}
          />
        </div>
      )}

      {/* ═══ Section 5 : Lieux de remise ═══ */}
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

      {/* ═══ Section 6 : Lieux de livraison ═══ */}
      <LocationsSection
        context="DELIVERY"
        title={copy.deliveryLocations}
        subtitle={copy.deliveryLocationsSub}
        locations={draft.deliveryLocations ?? []}
        onChangeAction={handleDeliveryChange}
        copy={copy}
        error={errors.deliveryLocations}
      />

      {/* ═══ Section 7 : Options & message ═══ */}
      <SectionLabel>{copy.options}</SectionLabel>
      <div className="rounded-xl bg-slate-50 px-4 dark:bg-slate-800/50">
        <Toggle
          label={copy.handOnly}
          on={draft.handDeliveryOnly}
          onChange={(v) => setField("handDeliveryOnly", v)}
        />
        <Toggle
          label={copy.instantBooking}
          on={draft.instantBooking}
          onChange={(v) => setField("instantBooking", v)}
        />
      </div>

      <SectionLabel>{copy.notes}</SectionLabel>
      <textarea
        value={draft.notes}
        onChange={(e) => setField("notes", e.target.value)}
        placeholder={copy.notesPlaceholder}
        rows={2}
        maxLength={2000}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-[#FF9900] focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
      />
    </div>
  );
}

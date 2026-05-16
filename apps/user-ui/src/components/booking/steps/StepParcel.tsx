"use client";

import { Lightbulb } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { MAX_PHOTOS } from "../booking.config";
import {
  FormField,
  FormInput,
  FormSelect,
  FormTextarea,
  InfoTooltip,
  InsuranceOption,
  LocationDisplay,
  LocationOption,
  PhotoGrid,
  RequiredBadge,
  SectionTitle,
  TipBlock,
} from "../BookingFormUi";
import type {
  Draft,
  ParcelCategory,
  ParcelPhoto,
  PhotoContext,
  TripContext,
  ValidationErrors,
} from "../booking.types";

type Props = {
  trip: TripContext;
  draft: Draft;
  setDraftAction: (updater: (prev: Draft) => Draft) => void;
  errors: ValidationErrors;
  hideInsurance?: boolean;
};

const GOLDEN_RULES_KEYS = ["pack", "weigh", "describe", "prohibited"] as const;

export default function StepParcel({
                                     trip,
                                     draft,
                                     setDraftAction,
                                     errors,
                                     hideInsurance,
                                   }: Props) {
  const t = useTranslations("booking");

  const hasMultiplePickup = trip.pickupOptions.length > 1;
  const hasMultipleDelivery = trip.deliveryOptions.length > 1;

  const onSelectPickup = useCallback(
    (id: string) => setDraftAction((prev) => ({ ...prev, pickupLocationId: id })),
    [setDraftAction]
  );
  const onSelectDelivery = useCallback(
    (id: string) => setDraftAction((prev) => ({ ...prev, deliveryLocationId: id })),
    [setDraftAction]
  );

  const photoTagContent = t("step1.photos.tagContent");
  const photoTagPackaged = t("step1.photos.tagPackaged");

  const handleAddPhotos = useCallback(
    (files: File[]) => {
      setDraftAction((prev) => {
        const room = MAX_PHOTOS - prev.photos.length;
        const toAdd = files.slice(0, room);
        const newPhotos: ParcelPhoto[] = toAdd.map((file, i) => {
          const totalIndex = prev.photos.length + i;
          const previewUrl = URL.createObjectURL(file);
          let context: PhotoContext = "CUSTOM";
          let label: string | undefined;
          if (totalIndex === 0) {
            context = "DECLARED_CONTENT";
            label = photoTagContent;
          } else if (totalIndex === 1) {
            context = "DECLARED_PACKAGED";
            label = photoTagPackaged;
          }
          return {
            id: `photo-${Date.now()}-${totalIndex}-${Math.random().toString(36).slice(2, 7)}`,
            file,
            previewUrl,
            context,
            label,
          };
        });
        return { ...prev, photos: [...prev.photos, ...newPhotos] };
      });
    },
    [setDraftAction, photoTagContent, photoTagPackaged]
  );

  const handleRemovePhoto = useCallback(
    (id: string) => {
      setDraftAction((prev) => {
        const photo = prev.photos.find((p) => p.id === id);
        if (photo?.previewUrl) URL.revokeObjectURL(photo.previewUrl);
        return { ...prev, photos: prev.photos.filter((p) => p.id !== id) };
      });
    },
    [setDraftAction]
  );

  const photosRequired = draft.insurance === "EXTENDED_500";

  const categoryOptions = trip.acceptedCategories.map((cat) => ({
    value: cat,
    label: t("step1.parcelDetails.categoryOption", {
      label: t(`categories.${cat}`),
      price: formatEur(trip.categoryPrices[cat] ?? 0),
    }),
  }));

  const goldenRules = GOLDEN_RULES_KEYS.map((key) =>
    t(`step1.goldenRules.${key}`, { carrierFirstName: trip.carrier.firstName })
  );

  return (
    <div className="px-4 py-5 md:px-0 md:py-0">
      <h1 className="mb-1.5 text-[19px] font-medium tracking-tight md:text-[22px]">
        {t("step1.title")}
      </h1>
      <p className="mb-5 text-[13px] text-slate-500 dark:text-slate-400 md:text-[14px] md:mb-6">
        {t("step1.subtitle")}
      </p>

      {/* Locations */}
      <SectionTitle>{t("step1.locationsTitle")}</SectionTitle>
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <div className="mb-2 text-[13px] font-medium text-slate-600 dark:text-slate-300">
            {t("step1.pickupBlockTitle", { carrierFirstName: trip.carrier.firstName })}
          </div>
          {hasMultiplePickup ? (
            <div className="space-y-2">
              {trip.pickupOptions.map((loc) => (
                <LocationOption
                  key={loc.id}
                  location={loc}
                  selected={draft.pickupLocationId === loc.id}
                  onSelectAction={() => onSelectPickup(loc.id)}
                  hasError={Boolean(errors.pickupLocationId)}
                />
              ))}
              {errors.pickupLocationId && (
                <div className="mt-1 text-[12px] font-medium" style={{ color: "#FF9900" }}>
                  {errors.pickupLocationId}
                </div>
              )}
            </div>
          ) : (
            <LocationDisplay
              location={trip.pickupOptions[0]}
              hint={t("step1.locationSingleHint")}
            />
          )}
        </div>

        <div>
          <div className="mb-2 text-[13px] font-medium text-slate-600 dark:text-slate-300">
            {t("step1.deliveryBlockTitle")}
          </div>
          {hasMultipleDelivery ? (
            <div className="space-y-2">
              {trip.deliveryOptions.map((loc) => (
                <LocationOption
                  key={loc.id}
                  location={loc}
                  selected={draft.deliveryLocationId === loc.id}
                  onSelectAction={() => onSelectDelivery(loc.id)}
                  hasError={Boolean(errors.deliveryLocationId)}
                />
              ))}
              {errors.deliveryLocationId && (
                <div className="mt-1 text-[12px] font-medium" style={{ color: "#FF9900" }}>
                  {errors.deliveryLocationId}
                </div>
              )}
            </div>
          ) : (
            <LocationDisplay
              location={trip.deliveryOptions[0]}
              hint={t("step1.locationSingleHint")}
            />
          )}
        </div>
      </div>

      {/* Golden rules tip */}
      <TipBlock
        icon={<Lightbulb size={16} />}
        title={t("step1.goldenRules.title")}
        items={goldenRules}
        extraLink={{
          label: t("step1.goldenRules.linkProhibited"),
          onClickAction: () => console.info("[booking] open prohibited items list"),
        }}
      />

      {/* Category */}
      <FormField label={t("step1.parcelDetails.categoryLabel")} error={errors.category}>
        <FormSelect<ParcelCategory>
          value={draft.category}
          onChangeAction={(value) => setDraftAction((prev) => ({ ...prev, category: value }))}
          options={categoryOptions}
          hasError={Boolean(errors.category)}
        />
      </FormField>

      {/* Weight + Declared value */}
      <div className="grid grid-cols-2 gap-3.5">
        <FormField label={t("step1.parcelDetails.weightLabel")} error={errors.weightKg}>
          <FormInput
            value={draft.weightKg}
            onChangeAction={(v) => setDraftAction((prev) => ({ ...prev, weightKg: v }))}
            hasError={Boolean(errors.weightKg)}
            inputMode="decimal"
            placeholder="2.5"
          />
        </FormField>
        <FormFieldWithTooltip
          label={t("step1.parcelDetails.valueLabel")}
          tooltip={t("step1.parcelDetails.declaredValueTooltip")}
          error={errors.declaredValueEur}
        >
          <FormInput
            value={draft.declaredValueEur}
            onChangeAction={(v) =>
              setDraftAction((prev) => ({ ...prev, declaredValueEur: v }))
            }
            hasError={Boolean(errors.declaredValueEur)}
            inputMode="numeric"
            placeholder="150"
          />
        </FormFieldWithTooltip>
      </div>

      {/* Description */}
      <FormField label={t("step1.parcelDetails.descriptionLabel")} error={errors.description}>
        <FormTextarea
          value={draft.description}
          onChangeAction={(v) => setDraftAction((prev) => ({ ...prev, description: v }))}
          placeholder={t("step1.parcelDetails.descriptionPlaceholder")}
          rows={2}
          hasError={Boolean(errors.description)}
        />
      </FormField>

      {/* Photos */}
      <FormField
        label={t("step1.photos.label")}
        hint={t("step1.photos.hint")}
        error={errors.photos}
        badge={
          photosRequired ? <RequiredBadge label={t("step1.photos.requiredBadge")} /> : undefined
        }
      >
        <PhotoGrid
          photos={draft.photos}
          maxSlots={MAX_PHOTOS}
          onAddAction={handleAddPhotos}
          onRemoveAction={handleRemovePhoto}
          addLabel={t("step1.photos.add")}
          removeAriaLabel={t("step1.photos.remove")}
        />
      </FormField>

      {/* Insurance (mobile only) */}
      {!hideInsurance && (
        <>
          <SectionTitle>{t("insurance.title")}</SectionTitle>
          <InsuranceOption
            selected={draft.insurance === "BASIC"}
            onSelectAction={() => setDraftAction((prev) => ({ ...prev, insurance: "BASIC" }))}
            title={t("insurance.basic.title")}
            price={t("insurance.basic.price")}
            priceVariant="free"
            description={t("insurance.basic.description")}
          />
          <InsuranceOption
            selected={draft.insurance === "EXTENDED_500"}
            onSelectAction={() =>
              setDraftAction((prev) => ({ ...prev, insurance: "EXTENDED_500" }))
            }
            title={t("insurance.extended.title")}
            price={t("insurance.extended.price")}
            description={t("insurance.extended.description")}
            extraLink={{
              label: t("insurance.extended.ipidLink"),
              onClickAction: () => console.info("[booking] open IPID sheet"),
            }}
          />
        </>
      )}
    </div>
  );
}

function FormFieldWithTooltip({
                                label,
                                tooltip,
                                error,
                                children,
                              }: {
  label: string;
  tooltip: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <label className="mb-1.5 flex items-center text-[13px] font-medium text-slate-600 dark:text-slate-300">
        <span>{label}</span>
        <InfoTooltip content={tooltip} />
      </label>
      {children}
      {error && (
        <div className="mt-1.5 text-[12px] font-medium" style={{ color: "#FF9900" }}>
          {error}
        </div>
      )}
    </div>
  );
}

function formatEur(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
  }).format(amount);
}

"use client";

import { ChevronDown, Lightbulb } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { MAX_PHOTOS, isPerKgTrip, parseWeight } from "../booking.config";
import { quoteShipperPrice } from "@packages/pricing";
import { PHOTO_MAX_SIZE_BYTES } from "@/hooks/useImageKitUpload";
import { toast } from "sonner";
import { usePricingParams } from "@/hooks/usePricingParams";
import {
  FormField,
  FormInput,
  FormSelect,
  FormTextarea,
  InfoTooltip,
  InsuranceOption,
  PhotoGrid,
  RequiredBadge,
  RenderBoldText,
  SectionTitle,
} from "../BookingFormUi";
import {
  PARCEL_FAMILIES,
  type Draft,
  type ParcelCategory,
  type ParcelFamily,
  type ParcelPhoto,
  type ParcelProduct,
  type PhotoContext,
  type SizeClass,
  type TripContext,
  type ValidationErrors,
} from "../booking.types";

/** Les poids d'un envoi réel — les mêmes que l'app mobile. */
const WEIGHT_SHORTCUTS = [1, 2, 5, 10] as const;

function ChoiceChip({
  active,
  disabled,
  title,
  onClickAction,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  title?: string;
  onClickAction: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      title={title}
      onClick={onClickAction}
      className={[
        "inline-flex min-h-[40px] items-center rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
        active
          ? "border-[#FF9900]/60 bg-[#FFF6E8] text-slate-900 dark:bg-[#FF9900]/10 dark:text-[#FFB84D]"
          : disabled
            ? "cursor-not-allowed border-slate-100 text-slate-300 line-through dark:border-slate-800 dark:text-slate-600"
            // Fond TRANSPARENT : rempli, la seule pastille non refusée d'une rangée
            // prenait l'air d'une seconde sélection (revue UX 17/10).
            : "border-slate-200 bg-transparent text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:text-slate-300",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

type Props = {
  trip: TripContext;
  draft: Draft;
  setDraftAction: (updater: (prev: Draft) => Draft) => void;
  errors: ValidationErrors;
};

const GOLDEN_RULES_KEYS = ["pack", "weigh", "describe", "prohibited"] as const;

export default function StepParcel({
                                     trip,
                                     draft,
                                     setDraftAction,
                                     errors,
                                   }: Props) {
  const pricingParams = usePricingParams(); // D62 7A
  const t = useTranslations("booking");
  // La liste des objets interdits est celle de la fiche trajet — UNE source,
  // pas une copie qui divergera (le lien ci-dessous ne faisait que l'écrire
  // dans la console : une promesse d'interface qui ne menait nulle part).
  const tTrip = useTranslations("tripDetail");
  const locale = useLocale();
  const [showProhibited, setShowProhibited] = useState(false);
  const [showRefused, setShowRefused] = useState(false);
  // Le lien « Voir les conditions » n'écrivait que dans la console : une promesse
  // d'interface qui ne menait nulle part (même défaut que les objets interdits).
  const [showIpid, setShowIpid] = useState(false);

  const photoTagContent = t("step1.photos.tagContent");
  const photoTagPackaged = t("step1.photos.tagPackaged");

  const handleAddPhotos = useCallback(
    (files: File[]) => {
      // ANO-WEB-39 (recette 5.12) — une photo trop lourde est refusée DÈS la sélection, avec son message,
      // et non à l'étape 4 au moment du paiement (le téléversement, lui, part au paiement).
      const acceptees = files.filter((f) => f.size <= PHOTO_MAX_SIZE_BYTES);
      if (acceptees.length < files.length) {
        toast.error(t("step4.errors.UPLOAD_TOO_LARGE", { maxMb: Math.round(PHOTO_MAX_SIZE_BYTES / (1024 * 1024)) }));
      }
      if (acceptees.length === 0) return;
      setDraftAction((prev) => {
        const room = MAX_PHOTOS - prev.photos.length;
        const toAdd = acceptees.slice(0, room);
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
  const perKg = isPerKgTrip(trip);

  const categoryOptions = trip.acceptedCategories.map((cat) => ({
    value: cat,
    label: t("step1.parcelDetails.categoryOption", {
      label: t(`categories.${cat}`),
      price: formatEur(trip.categoryPrices[cat] ?? 0, locale),
    }),
  }));

  const goldenRules = GOLDEN_RULES_KEYS.map((key) =>
    t(`step1.goldenRules.${key}`, { carrierFirstName: trip.carrier.firstName })
  );

  // ── D14 — ce que le Voyageur ACCEPTE d'abord ; ses refus repliés ──────────
  // Six pastilles barrées en tête de page, c'était six fois « non » avant le
  // premier « oui » (revue UX 17/10).
  const acceptedFamilies = PARCEL_FAMILIES.filter(
    (f) => trip.familyStances[f]?.mode !== "REFUSE"
  );
  const refusedFamilies = PARCEL_FAMILIES.filter(
    (f) => trip.familyStances[f]?.mode === "REFUSE"
  );

  // ── PRC-03 — la taille dit son PRIX, pas son coefficient ─────────────────
  // « ×1,1 » est de la mécanique interne. On montre l'écart en euros, calculé
  // par LE moteur (@packages/pricing) avec les paramètres de la plateforme —
  // plancher par colis compris, d'où le cas « la taille ne change rien ».
  const sizeDeltaCents = useMemo((): Record<SizeClass, number> | null => {
    if (!perKg || draft.product !== "PARCEL") return null;
    const weight = parseWeight(draft.weightKg);
    if (!weight || weight <= 0) return null;
    const stance = trip.familyStances[draft.family];
    const surchargePct = stance?.mode === "SURCHARGE" ? stance.surchargePct : 0;
    try {
      const totals = (["S", "M", "L"] as SizeClass[]).map(
        (sz) =>
          quoteShipperPrice(
            {
              product: "PARCEL",
              pricePerKgCents: trip.pricePerKgCents,
              weightKg: weight,
              sizeClass: sz,
              familySurchargePct: surchargePct,
              protection: draft.insurance,
            },
            pricingParams
          ).totalShipperCents
      );
      const cheapest = Math.min(...totals);
      return { S: totals[0] - cheapest, M: totals[1] - cheapest, L: totals[2] - cheapest };
    } catch {
      // Prix du trajet absent / incohérent : on n'invente pas d'écart, on n'affiche rien.
      return null;
    }
  }, [perKg, draft.product, draft.weightKg, draft.family, draft.insurance, trip.familyStances, trip.pricePerKgCents, pricingParams]);

  // « +6 € » et « 500 € » étaient écrits en dur dans les traductions : un admin
  // qui change le paramètre (D62) faisait mentir la page. Ils viennent du moteur.
  const guaranteeCap = formatEur(pricingParams.protectionExtendedCapCents / 100, locale);
  const guaranteePremium = t("insurance.extended.price", {
    amount: formatEur(pricingParams.protectionExtendedPremiumCents / 100, locale),
  });

  const sizeIsFlat =
    sizeDeltaCents !== null &&
    sizeDeltaCents.S === 0 &&
    sizeDeltaCents.M === 0 &&
    sizeDeltaCents.L === 0;
  const sizeHint = sizeDeltaCents === null
    ? t("step1.size.hintPending")
    : sizeIsFlat
      ? t("step1.size.hintFlat")
      : t("step1.size.hint");

  // ── Les blocs de la page, nommés — l'ordre se lit d'un coup d'œil tout en bas ──

  const familyChip = (f: ParcelFamily, refused: boolean) => {
    const st = trip.familyStances[f];
    const pct = st?.mode === "SURCHARGE" ? st.surchargePct : 0;
    return (
      <ChoiceChip
        key={f}
        active={!refused && draft.family === f}
        disabled={refused}
        title={refused ? t("step1.family.refused", { carrierFirstName: trip.carrier.firstName }) : undefined}
        onClickAction={() => setDraftAction((prev) => ({ ...prev, family: f }))}
      >
        {t(`families.${f}`)}
        {pct > 0 && (
          <span className="ml-1 font-bold text-[#B45309] dark:text-[#FFB84D]">+{pct} %</span>
        )}
      </ChoiceChip>
    );
  };

  /** PRC-04 — colis au kilo ou bagage entier (seulement si le Voyageur en propose un) */
  const productBlock =
    trip.checkedBag23PriceCents || trip.cabinBag12PriceCents ? (
      <FormField label={t("step1.product.label")} error={errors.product}>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["PARCEL", t("step1.product.parcel"), null],
              ["CHECKED_BAG_23KG", t("step1.product.checkedBag"), trip.checkedBag23PriceCents],
              ["CABIN_BAG_12KG", t("step1.product.cabinBag"), trip.cabinBag12PriceCents],
            ] as Array<[ParcelProduct, string, number | null]>
          )
            .filter(([k, , cents]) => k === "PARCEL" || !!cents)
            .map(([k, label, cents]) => (
              <ChoiceChip
                key={k}
                active={draft.product === k}
                onClickAction={() => setDraftAction((prev) => ({ ...prev, product: k }))}
              >
                {label}
                {cents ? <span className="ml-1 font-bold">{formatEur(cents / 100, locale)}</span> : null}
              </ChoiceChip>
            ))}
        </div>
        {/* CAP-01 — la place restante conditionne AUSSI le bagage entier (23 ou 12 kg) :
            elle n'était annoncée que sous le poids du colis, donc invisible pour un bagage. */}
        {draft.product !== "PARCEL" && typeof trip.remainingKg === "number" && (
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {t("step1.parcelDetails.remainingKg", { kg: trip.remainingKg })}
          </div>
        )}
      </FormField>
    ) : null;

  /** D14 — ce que le Voyageur accepte d'abord ; ses refus repliés sous une ligne */
  const familyBlock = (
    <FormField label={t("step1.family.label")} error={errors.family}>
      {acceptedFamilies.length > 0 ? (
        <div className="flex flex-wrap gap-2">{acceptedFamilies.map((f) => familyChip(f, false))}</div>
      ) : (
        <p className="text-[12.5px] text-[#B45309] dark:text-[#FFB84D]">
          {t("step1.family.noneAccepted", { carrierFirstName: trip.carrier.firstName })}
        </p>
      )}
      {/* L'indice appartient au CHAMP : rendu par `FormField`, il tombait sous la
          ligne des refus et se lisait comme un commentaire sur les refus. */}
      <div className="mt-1.5 text-[12px] leading-5 text-slate-400 dark:text-slate-500">
        {t("step1.family.hint")}
      </div>
      {refusedFamilies.length > 0 && (
        <div className="mt-1.5">
          <button
            type="button"
            onClick={() => setShowRefused((v) => !v)}
            aria-expanded={showRefused}
            className="inline-flex items-center gap-1 text-[11.5px] text-slate-500 underline-offset-2 hover:underline dark:text-slate-400"
          >
            {t("step1.family.refusedToggle", {
              count: refusedFamilies.length,
              carrierFirstName: trip.carrier.firstName,
            })}
            <ChevronDown
              size={13}
              className={showRefused ? "rotate-180 transition-transform" : "transition-transform"}
            />
          </button>
          {showRefused && (
            <div className="mt-2 flex flex-wrap gap-2">{refusedFamilies.map((f) => familyChip(f, true))}</div>
          )}
        </div>
      )}
    </FormField>
  );

  const weightValueBlock = (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3.5 sm:grid-cols-2 md:max-w-md">
      <FormFieldWithTooltip
        label={t("step1.parcelDetails.weightLabel")}
        tooltip={t("step1.parcelDetails.weightTooltip", { min: 0.5, floor: 8 })}
        error={errors.weightKg}
      >
        <FormInput
          value={draft.weightKg}
          onChangeAction={(v) => setDraftAction((prev) => ({ ...prev, weightKg: v }))}
          hasError={Boolean(errors.weightKg)}
          inputMode="decimal"
          placeholder={locale === "fr" ? "2,5" : "2.5"}
        />
        {/* On tape rarement « 2 » : on le choisit. Les poids réels d'un envoi,
            filtrés par la place qui reste. */}
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {WEIGHT_SHORTCUTS.filter(
            (kg) => typeof trip.remainingKg !== "number" || kg <= trip.remainingKg
          ).map((kg) => (
            <ChoiceChip
              key={kg}
              active={parseWeight(draft.weightKg) === kg}
              onClickAction={() => setDraftAction((prev) => ({ ...prev, weightKg: String(kg) }))}
            >
              {t("step1.parcelDetails.weightShortcut", { kg })}
            </ChoiceChip>
          ))}
        </div>
        {typeof trip.remainingKg === "number" && (
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {t("step1.parcelDetails.remainingKg", { kg: trip.remainingKg })}
          </div>
        )}
      </FormFieldWithTooltip>
      <FormFieldWithTooltip
        label={t("step1.parcelDetails.valueLabel")}
        tooltip={t("step1.parcelDetails.declaredValueTooltip")}
        error={errors.declaredValueEur}
      >
        <FormInput
          value={draft.declaredValueEur}
          onChangeAction={(v) => setDraftAction((prev) => ({ ...prev, declaredValueEur: v }))}
          hasError={Boolean(errors.declaredValueEur)}
          inputMode="numeric"
          placeholder="150"
        />
      </FormFieldWithTooltip>
    </div>
  );

  /** PRC-03 — à l'œil, jamais de dimensions, et plus AUCUN rectangle : les mêmes
   *  pastilles que la question juste au-dessus. Deux questions voisines répondues
   *  de la même façon, c'est une chose de moins à comprendre (revue du 17/10).
   *  Seule la taille qui coûte plus cher porte son prix. */
  const sizeBlock = (
    <FormField label={t("step1.size.label")} hint={sizeHint} error={errors.sizeClass}>
      <div className="flex flex-wrap gap-2" role="radiogroup">
        {(["S", "M", "L"] as SizeClass[]).map((sz) => {
          const active = draft.sizeClass === sz;
          const delta = sizeDeltaCents?.[sz] ?? 0;
          return (
            <ChoiceChip
              key={sz}
              active={active}
              onClickAction={() => setDraftAction((prev) => ({ ...prev, sizeClass: sz }))}
            >
              <span className="font-bold">{sz}</span>
              <span className="ml-1.5 opacity-80">{t(`step1.size.${sz}`)}</span>
              {!sizeIsFlat && delta > 0 && (
                <span className="ml-1.5 font-bold text-[#B45309] dark:text-[#FFB84D]">
                  {t("step1.size.extra", { amount: formatEur(delta / 100, locale) })}
                </span>
              )}
            </ChoiceChip>
          );
        })}
      </div>
    </FormField>
  );

  /** Bagage entier : ni poids ni taille, seule la valeur du contenu reste à dire */
  const bagValueBlock = (
    <FormFieldWithTooltip
      label={t("step1.parcelDetails.valueLabel")}
      tooltip={t("step1.parcelDetails.declaredValueTooltip")}
      error={errors.declaredValueEur}
    >
      <FormInput
        value={draft.declaredValueEur}
        onChangeAction={(v) => setDraftAction((prev) => ({ ...prev, declaredValueEur: v }))}
        hasError={Boolean(errors.declaredValueEur)}
        inputMode="numeric"
        placeholder="150"
      />
    </FormFieldWithTooltip>
  );

  /** Legacy PER_CATEGORY — les trajets publiés avant le moteur au kilo */
  const legacyBlock = (
    <>
      <FormField label={t("step1.parcelDetails.categoryLabel")} error={errors.category}>
        <FormSelect<ParcelCategory>
          value={draft.category}
          onChangeAction={(value) => setDraftAction((prev) => ({ ...prev, category: value }))}
          options={categoryOptions}
          hasError={Boolean(errors.category)}
        />
      </FormField>
      {weightValueBlock}
    </>
  );

  /* D22 — la garantie AVANT les photos : c'est elle qui les rend obligatoires.
     Posée après, l'expéditeur lisait « facultatif » sur un champ qui ne l'était
     plus deux décisions plus bas. Et elle vit DANS le formulaire, y compris sur
     desktop : rangée dans la colonne « récapitulatif », une décision à +6 € est
     une décision qu'on ne prend pas (revue UX 17/10). */
  const insuranceBlock = (
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
        onSelectAction={() => setDraftAction((prev) => ({ ...prev, insurance: "EXTENDED_500" }))}
        title={t("insurance.extended.title", { cap: guaranteeCap })}
        price={guaranteePremium}
        description={t("insurance.extended.description", { cap: guaranteeCap })}
        extraLink={{
          label: t("insurance.extended.ipidLink"),
          onClickAction: () => setShowIpid((v) => !v),
        }}
      />
      {/* GAR-05 — « les exclusions sont présentées à l'Expéditeur AVANT le choix
          du niveau de protection » : un lien à cliquer ne présente rien. Choisir
          la Garantie les ouvre d'office (la saisie douanière d'un colis non
          conforme en fait partie), et le lien reste pour qui veut les lire sans
          avoir choisi. */}
      {(showIpid || draft.insurance === "EXTENDED_500") && (
        <p className="-mt-2 mb-5 text-[12px] leading-relaxed text-slate-600 dark:text-slate-300">
          {t("insurance.extended.ipidText")}
        </p>
      )}
    </>
  );

  const descriptionBlock = (
    <FormField
      label={t("step1.parcelDetails.descriptionLabel")}
      error={errors.description}
      badge={<RequiredBadge label={t("step1.requiredBadge")} />}
    >
      <FormTextarea
        value={draft.description}
        onChangeAction={(v) => setDraftAction((prev) => ({ ...prev, description: v }))}
        placeholder={t("step1.parcelDetails.descriptionPlaceholder")}
        rows={2}
        hasError={Boolean(errors.description)}
      />
    </FormField>
  );

  const photosBlock = (
    <FormField
      label={t("step1.photos.label")}
      hint={t("step1.photos.hint", { max: MAX_PHOTOS })}
      error={errors.photos}
      badge={photosRequired ? <RequiredBadge label={t("step1.photos.requiredBadge")} /> : undefined}
    >
      <PhotoGrid
        photos={draft.photos}
        maxSlots={Math.min(draft.photos.length + 1, MAX_PHOTOS)}
        onAddAction={handleAddPhotos}
        onRemoveAction={handleRemovePhoto}
        addLabel={t("step1.photos.add")}
        removeAriaLabel={t("step1.photos.remove")}
        cols={5}
      />
    </FormField>
  );

  /** Les règles d'or : repliées, à plat. Trois défauts payés d'un coup (captures
   *  du 17/10) — le titre s'écrivait DEUX fois à l'ouverture (le `summary` et le
   *  `TipBlock` portaient le même), le mot « Voir » disparaissait sans laisser de
   *  quoi replier, et un encadré teinté vivait dans un encadré bordé. */
  const goldenRulesBlock = (
    <details className="group mb-2 border-t border-slate-200 pt-3 dark:border-slate-800">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-[13px] font-medium text-slate-700 dark:text-slate-200">
        <Lightbulb size={15} className="flex-shrink-0 text-[#0F766E]" />
        <span className="flex-1">{t("step1.goldenRules.title")}</span>
        <ChevronDown
          size={15}
          className="flex-shrink-0 text-slate-400 transition-transform group-open:rotate-180"
        />
      </summary>
      <ul className="mt-2.5 list-disc space-y-1 pl-10 text-[12.5px] leading-[1.7] text-slate-600 dark:text-slate-300">
        {goldenRules.map((rule, i) => (
          <li key={i}>
            <RenderBoldText text={rule} />
            {i === goldenRules.length - 1 && !showProhibited && (
              <>
                {" "}
                <button
                  type="button"
                  onClick={() => setShowProhibited(true)}
                  className="text-[#0F766E] underline underline-offset-2 hover:no-underline dark:text-[#5EEAD4]"
                >
                  {t("step1.goldenRules.linkProhibited")}
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      {showProhibited && (
        <p className="mt-2 pl-10 text-[12px] leading-relaxed text-slate-600 dark:text-slate-300">
          <span className="font-semibold">{tTrip("conditions.prohibited.title")} : </span>
          {tTrip("conditions.prohibited.description")}
        </p>
      )}
    </details>
  );

  // L'ordre de la page : le colis (ce que c'est, ce qu'il pèse, sa taille), ce qui
  // le protège, ce qui le montre, et SEULEMENT ensuite où l'on se voit. Les lieux
  // ouvraient une page intitulée « Décris ton colis » — on les a remis à leur place.
  return (
    <div className="px-4 py-5 md:px-0 md:py-0">
      <h1 className="mb-1.5 text-[19px] font-medium tracking-tight md:text-[22px]">
        {t("step1.title")}
      </h1>
      <p className="mb-5 text-[13px] text-slate-500 dark:text-slate-400 md:text-[14px] md:mb-6">
        {t("step1.subtitle")}
      </p>

      {perKg ? (
        <>
          {productBlock}
          {draft.product === "PARCEL" ? (
            <>
              {familyBlock}
              {weightValueBlock}
              {sizeBlock}
            </>
          ) : (
            bagValueBlock
          )}
        </>
      ) : (
        legacyBlock
      )}

      {insuranceBlock}
      {descriptionBlock}
      {photosBlock}
      {goldenRulesBlock}
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
    <div className="mb-4 min-w-0">
      {/* `relative` : c'est le LABEL qui ancre l'infobulle (pleine largeur du
          champ), pas l'icône — voir InfoTooltip dans BookingFormUi. */}
      <label className="relative mb-1.5 flex items-center text-[13px] font-medium text-slate-600 dark:text-slate-300">
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

function formatEur(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
  }).format(amount);
}

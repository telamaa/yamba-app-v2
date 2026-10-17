/**
 * StepRecipient.tsx
 * =================
 * Step 2: recipient information.
 */

"use client";

import { ChevronDown, Lightbulb } from "lucide-react";
import { useTranslations } from "next-intl";
import { FormField, FormInput, RenderBoldText, SectionTitle } from "../BookingFormUi";
import MeetingPoints from "../MeetingPoints";
import { PHONE_PREFIXES } from "../booking.config";
import { useLocale } from "next-intl";
import type { Draft, TripContext, ValidationErrors } from "../booking.types";

type Props = {
  trip: TripContext;
  draft: Draft;
  setDraftAction: (updater: (prev: Draft) => Draft) => void;
  errors: ValidationErrors;
};

const DELIVERY_FLOW_KEYS = ["codeGiven", "shareIt", "handToTraveler"] as const;

export default function StepRecipient({
                                        trip,
                                        draft,
                                        setDraftAction,
                                        errors,
                                      }: Props) {
  const t = useTranslations("booking");
  const locale = useLocale();

  const setRecipient = (patch: Partial<Draft["recipient"]>) =>
    setDraftAction((prev) => ({
      ...prev,
      recipient: { ...prev.recipient, ...patch },
    }));

  const deliveryFlow = DELIVERY_FLOW_KEYS.map((key) =>
    t(`step2.deliveryFlow.${key}`)
  );

  return (
    <div className="px-4 py-5 md:px-0 md:py-0">
      <h1 className="mb-1.5 text-[19px] font-medium tracking-tight md:text-[22px]">
        {t("step2.title")}
      </h1>
      <p className="mb-5 text-[13px] text-slate-500 dark:text-slate-400 md:text-[14px] md:mb-6">
        {t("step2.subtitle")}
      </p>

      {/* Le rendez-vous d'abord : « où » avant « à qui ». Il vivait en tête de
          l'étape 1, sur une page intitulée « Décris ton colis » — un lieu n'est
          pas une propriété du colis (revue UX 17/10). */}
      <MeetingPoints trip={trip} draft={draft} setDraftAction={setDraftAction} errors={errors} />

      {/* LA CARTE DU DESTINATAIRE — même conteneur que « Ton colis » et les
          lieux : une carte bordée, un filet entre les blocs. Mais PAS la
          disposition « libellé à gauche, contrôle à droite » : elle convient à
          une VALEUR (un nombre, un choix), pas à du texte libre. Un email dans
          une boîte étroite alignée à droite est pénible à saisir et à relire.
          On adopte la grammaire du CONTENEUR, pas celle de la ligne. */}
      <SectionTitle>{t("step2.form.sectionTitle")}</SectionTitle>
      <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 px-4 dark:divide-slate-800/70 dark:border-slate-800">
        {/* Téléphone D'ABORD : c'est le canal du code de livraison (indicatif + numéro) */}
        <div className="pt-4">
          <FormField
            label={t("step2.form.phone")}
            hint={t("step2.form.phoneHint")}
            error={errors.recipientPhoneE164}
          >
            <div className="flex gap-2">
              <select
                value={draft.recipient.phonePrefix}
                onChange={(e) => setRecipient({ phonePrefix: e.target.value })}
                aria-label={t("step2.form.phonePrefix")}
                className="h-11 w-[9.5rem] shrink-0 rounded-lg border border-slate-200 bg-white px-2 text-[13px] text-slate-900 focus:border-[#FF9900] focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                {PHONE_PREFIXES.map((c) => (
                  <option key={c.code} value={c.prefix}>
                    {c.prefix} · {locale === "fr" ? c.labelFr : c.labelEn}
                  </option>
                ))}
              </select>
              <div className="min-w-0 flex-1">
                <FormInput
                  value={draft.recipient.phoneE164}
                  onChangeAction={(v) => setRecipient({ phoneE164: v })}
                  placeholder="6 42 18 81 12"
                  type="tel"
                  inputMode="tel"
                  hasError={Boolean(errors.recipientPhoneE164)}
                  autoComplete="tel-national"
                />
              </div>
            </div>
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3.5 pt-4">
          <FormField label={t("step2.form.firstName")} error={errors.recipientFirstName}>
            <FormInput
              value={draft.recipient.firstName}
              onChangeAction={(v) => setRecipient({ firstName: v })}
              placeholder="Marie"
              hasError={Boolean(errors.recipientFirstName)}
              autoComplete="given-name"
            />
          </FormField>
          <FormField label={t("step2.form.lastName")} error={errors.recipientLastName}>
            <FormInput
              value={draft.recipient.lastName}
              onChangeAction={(v) => setRecipient({ lastName: v })}
              placeholder="Mboungou"
              hasError={Boolean(errors.recipientLastName)}
              autoComplete="family-name"
            />
          </FormField>
        </div>

        <div className="pt-4">
          <FormField
            label={`${t("step2.form.email")} ${t("step2.form.emailOptional")}`}
            hint={t("step2.form.emailHint")}
            error={errors.recipientEmail}
          >
            <FormInput
              value={draft.recipient.email}
              onChangeAction={(v) => setRecipient({ email: v })}
              placeholder="marie.mboungou@gmail.com"
              type="email"
              inputMode="email"
              hasError={Boolean(errors.recipientEmail)}
              autoComplete="email"
            />
          </FormField>
        </div>
      </div>

      {/* Le code de livraison, APRÈS le numéro et REPLIÉ (revue du 17/10). Il
          était en gros bloc vert AVANT le destinataire : purement informatif, il
          pesait autant que les décisions qui l'entouraient, et il expliquait un
          code à envoyer à quelqu'un dont le numéro n'était pas encore saisi.
          Déplié d'un geste, il arrive au moment où il devient concret.
          Même repliable que les « règles d'or » de l'étape 1 : un `<details>`
          natif, donc gratuit au clavier et pour un lecteur d'écran. */}
      <details className="group mt-5 border-t border-slate-200 pt-3 dark:border-slate-800">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-[13px] font-medium text-slate-700 dark:text-slate-200">
          <Lightbulb size={15} className="flex-shrink-0 text-[#0F766E]" />
          <span className="flex-1">{t("step2.deliveryFlow.title")}</span>
          <ChevronDown
            size={15}
            className="flex-shrink-0 text-slate-400 transition-transform group-open:rotate-180"
          />
        </summary>
        <ul className="mt-2.5 list-disc space-y-1 pl-10 text-[12.5px] leading-[1.7] text-slate-600 dark:text-slate-300">
          {deliveryFlow.map((item, i) => (
            <li key={i}>
              <RenderBoldText text={item} />
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

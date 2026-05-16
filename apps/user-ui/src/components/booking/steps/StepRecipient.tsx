/**
 * StepRecipient.tsx
 * =================
 * Step 2: recipient information.
 */

"use client";

import { Lightbulb } from "lucide-react";
import { useTranslations } from "next-intl";
import { FormField, FormInput, TipBlock } from "../BookingFormUi";
import type { Draft, ValidationErrors } from "../booking.types";

type Props = {
  draft: Draft;
  setDraftAction: (updater: (prev: Draft) => Draft) => void;
  errors: ValidationErrors;
};

const DELIVERY_FLOW_KEYS = ["codeGiven", "shareIt", "handToTraveler"] as const;

export default function StepRecipient({
                                        draft,
                                        setDraftAction,
                                        errors,
                                      }: Props) {
  const t = useTranslations("booking");

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

      <TipBlock
        icon={<Lightbulb size={16} />}
        title={t("step2.deliveryFlow.title")}
        items={deliveryFlow}
      />

      {/* First + Last name */}
      <div className="grid grid-cols-2 gap-3.5">
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

      {/* Phone */}
      <FormField
        label={t("step2.form.phone")}
        hint={t("step2.form.phoneHint")}
        error={errors.recipientPhoneE164}
      >
        <FormInput
          value={draft.recipient.phoneE164}
          onChangeAction={(v) => setRecipient({ phoneE164: v })}
          placeholder="+242 06 421 88 12"
          type="tel"
          inputMode="tel"
          hasError={Boolean(errors.recipientPhoneE164)}
          autoComplete="tel"
        />
      </FormField>

      {/* Email (optional) */}
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
  );
}

/**
 * StepCharter.tsx
 * ===============
 * Step 3: shipper commitment.
 */

"use client";

import { Lightbulb } from "lucide-react";
import { useTranslations } from "next-intl";
import { CharterBlock, CharterCheckbox, TipBlock } from "../BookingFormUi";
import type { Draft, ValidationErrors } from "../booking.types";

type Props = {
  draft: Draft;
  setDraftAction: (updater: (prev: Draft) => Draft) => void;
  errors: ValidationErrors;
};

const CGV_HREF = "/legal/cgv";
const TRANSPORT_CONTRACT_HREF = "/legal/transport-contract";
const FULL_CHARTER_HREF = "/legal/shipper-charter";

const HANDOVER_FLOW_KEYS = ["visualInspection", "refusalPossible", "crossPhotos"] as const;
const CHARTER_ITEMS_KEYS = ["noIllicit", "matchDeclared", "customsCompliant"] as const;

export default function StepCharter({ draft, setDraftAction, errors }: Props) {
  const t = useTranslations("booking");

  const allAccepted = draft.charterAccepted && draft.termsAccepted;
  const handleToggle = (checked: boolean) => {
    setDraftAction((prev) => ({
      ...prev,
      charterAccepted: checked,
      termsAccepted: checked,
    }));
  };

  const hasError = Boolean(errors.charterAccepted || errors.termsAccepted);

  const handoverFlow = HANDOVER_FLOW_KEYS.map((key) =>
    t(`step3.handoverFlow.${key}`)
  );
  const charterItems = CHARTER_ITEMS_KEYS.map((key) =>
    t(`step3.charter.${key}`)
  );

  return (
    <div className="px-4 py-5 md:px-0 md:py-0">
      <h1 className="mb-1.5 text-[19px] font-medium tracking-tight md:text-[22px]">
        {t("step3.title")}
      </h1>
      <p className="mb-5 text-[13px] text-slate-500 dark:text-slate-400 md:text-[14px] md:mb-6">
        {t("step3.subtitle")}
      </p>

      <TipBlock
        icon={<Lightbulb size={16} />}
        title={t("step3.handoverFlow.title")}
        items={handoverFlow}
      />

      <CharterBlock
        title={t("step3.charter.title")}
        subtitle={t("step3.charter.subtitle")}
        intro={t("step3.charter.intro")}
        items={charterItems}
        disclaimer={t("step3.charter.disclaimer")}
        fullLinkLabel={t("step3.charter.fullLink")}
        onFullLinkClickAction={() => {
          window.open(FULL_CHARTER_HREF, "_blank", "noopener,noreferrer");
        }}
      />

      <CharterCheckbox
        checked={allAccepted}
        onChangeAction={handleToggle}
        title={t("step3.accept.title")}
        descPrefix={t("step3.accept.descPrefix")}
        cgvLabel={t("step3.accept.cgvLabel")}
        cgvHref={CGV_HREF}
        descJoin={t("step3.accept.descJoin")}
        contractLabel={t("step3.accept.contractLabel")}
        contractHref={TRANSPORT_CONTRACT_HREF}
        descSuffix={t("step3.accept.descSuffix")}
        hasError={hasError}
      />

      {hasError && (
        <div
          className="mt-2 text-[12px] font-medium"
          style={{ color: "#FF9900" }}
        >
          {errors.charterAccepted ?? errors.termsAccepted}
        </div>
      )}
    </div>
  );
}

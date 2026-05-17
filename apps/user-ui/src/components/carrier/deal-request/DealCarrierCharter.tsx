/**
 * DealCarrierCharter.tsx
 * ======================
 * Bloc d'engagement juridique amber + case d'acceptation unique
 * (Charte + Contrat + CGV).
 * Réutilise CharterBlock et CharterCheckbox de BookingFormUi.
 */

"use client";

import { useTranslations } from "next-intl";
import { CharterBlock, CharterCheckbox } from "@/components/booking/BookingFormUi";

type Props = {
  accepted: boolean;
  onChangeAction: (checked: boolean) => void;
  hasError?: boolean;
  errorMessage?: string;
};

const CHARTER_KEYS = [
  "verifyContent",
  "refuseSuspicious",
  "transportCarefully",
  "deliverWithCode",
  "respectCustoms",
  "reportIncident",
] as const;

const CGV_HREF = "/legal/cgv";
const TRANSPORT_CONTRACT_HREF = "/legal/transport-contract";
const FULL_CHARTER_HREF = "/legal/carrier-charter";

export default function DealCarrierCharter({
                                             accepted,
                                             onChangeAction,
                                             hasError,
                                             errorMessage,
                                           }: Props) {
  const t = useTranslations("carrierDealRequest");

  const items = CHARTER_KEYS.map((key) => t(`charter.${key}`));

  return (
    <section>
      <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {t("charter.blockTitle")}
      </div>

      <CharterBlock
        title={t("charter.title")}
        subtitle={t("charter.subtitle")}
        intro={t("charter.intro")}
        items={items}
        disclaimer={t("charter.disclaimer")}
        fullLinkLabel={t("charter.viewFullLink")}
        onFullLinkClickAction={() => {
          window.open(FULL_CHARTER_HREF, "_blank", "noopener,noreferrer");
        }}
      />

      <CharterCheckbox
        checked={accepted}
        onChangeAction={onChangeAction}
        title={t("charter.acceptTitle")}
        descPrefix={t("charter.acceptDescPrefix")}
        cgvLabel={t("charter.acceptContractLabel")}
        cgvHref={TRANSPORT_CONTRACT_HREF}
        descJoin={t("charter.acceptDescJoin")}
        contractLabel={t("charter.acceptCgvLabel")}
        contractHref={CGV_HREF}
        descSuffix={t("charter.acceptDescSuffix")}
        hasError={hasError}
      />

      {hasError && errorMessage && (
        <div
          className="mt-2 text-[12px] font-medium"
          style={{ color: "#FF9900" }}
        >
          {errorMessage}
        </div>
      )}
    </section>
  );
}

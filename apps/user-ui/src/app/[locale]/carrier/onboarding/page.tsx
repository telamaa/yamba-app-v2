"use client";

import { Suspense } from "react";
import CarrierOnboardingWizard from "@/components/carrier/CarrierOnboardingWizard";

export default function CarrierOnboardingPage() {
  // useSearchParams() dans le composant → frontière Suspense obligatoire pour
  // le pré-rendu statique (sinon `next build` échoue : missing-suspense-with-csr-bailout)
  return (
    <Suspense fallback={null}>
      <CarrierOnboardingWizard />
    </Suspense>
  );
}

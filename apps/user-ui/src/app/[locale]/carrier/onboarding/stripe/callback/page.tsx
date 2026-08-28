"use client";

import { Suspense } from "react";
import StripeCallbackPage from "@/components/carrier/StripeCallbackPage";

export default function StripeCallback() {
  // useSearchParams() dans le composant → frontière Suspense obligatoire pour
  // le pré-rendu statique (sinon `next build` échoue : missing-suspense-with-csr-bailout)
  return (
    <Suspense fallback={null}>
      <StripeCallbackPage />
    </Suspense>
  );
}

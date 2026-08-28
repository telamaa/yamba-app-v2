import { Suspense } from "react";
import RefreshGate from "@/components/auth/shared/RefreshGate";

export default function Page() {
  // useSearchParams() dans le composant → frontière Suspense obligatoire pour
  // le pré-rendu statique (sinon `next build` échoue : missing-suspense-with-csr-bailout)
  return (
    <Suspense fallback={null}>
      <RefreshGate />
    </Suspense>
  );
}

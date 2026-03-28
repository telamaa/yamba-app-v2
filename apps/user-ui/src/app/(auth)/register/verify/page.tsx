import { Suspense } from "react";
import RegisterVerifyForm from "@/components/auth/forms/RegisterVerifyForm";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RegisterVerifyForm />
    </Suspense>
  );
}

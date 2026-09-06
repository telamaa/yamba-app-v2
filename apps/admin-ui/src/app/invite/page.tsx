import { Suspense } from "react";
import InviteAccept from "@/components/InviteAccept";

export default function InvitePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Suspense fallback={null}>
        <InviteAccept />
      </Suspense>
    </main>
  );
}

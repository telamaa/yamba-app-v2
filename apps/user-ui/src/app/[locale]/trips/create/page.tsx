"use client";

import { useEffect, useState } from "react";
import CreateTripWizard from "@/components/trips/create/CreateTripWizard";
import CreateTripMobile from "@/components/trips/create/CreateTripMobile";

export default function CreateTripPage() {
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);

    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  if (!mounted) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-[#FF9900]" />
      </div>
    );
  }

  return isMobile ? <CreateTripMobile /> : <CreateTripWizard />;
}

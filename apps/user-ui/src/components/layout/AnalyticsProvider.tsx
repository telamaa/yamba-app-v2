"use client";

/** AnalyticsProvider.tsx — pages vues et identité (D66 3A) : ne fait rien tant que le consentement n'est pas donné. */
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import useUser from "@/hooks/useUser";
import { identifyUser, readConsent, resetAnalytics, trackPageview } from "@/lib/analytics";

export default function AnalyticsProvider() {
  const pathname = usePathname();
  const { user } = useUser();
  const identified = useRef<string | null>(null);
  useEffect(() => {
    if (readConsent() !== "granted") return;
    void trackPageview(pathname);
  }, [pathname]);
  useEffect(() => {
    if (readConsent() !== "granted") return;
    if (user?.id && identified.current !== user.id) { identified.current = user.id; void identifyUser(user.id); }
    if (!user && identified.current) { identified.current = null; resetAnalytics(); }
  }, [user]);
  return null;
}

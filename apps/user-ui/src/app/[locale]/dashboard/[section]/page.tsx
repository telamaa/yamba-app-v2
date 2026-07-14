"use client";
import { useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";
import { getDashboardCopy } from "../dashboard.copy";
import {
  DEFAULT_SECTION,
  resolveSectionKey,
} from "../dashboard.config";
import DashboardSectionRenderer from "@/components/dashboard/DashboardSectionRenderer";

export default function DashboardSectionPage() {
  const params = useParams<{ section: string }>();
  const router = useRouter();
  const { lang } = useUiPreferences();
  const isFr = lang === "fr";
  const copy = useMemo(() => getDashboardCopy(isFr), [isFr]);

  const segment = params?.section ?? "home";
  // resolveSectionKey gère les aliases (payments/wallet → finances, create)
  // et retombe sur DEFAULT_SECTION pour un segment inconnu.
  const resolved = resolveSectionKey(segment);
  const isValid = segment === "home" || resolved !== DEFAULT_SECTION;

  useEffect(() => {
    if (!isValid) {
      router.replace("/dashboard/home");
    }
  }, [isValid, router]);

  if (!isValid) return null;

  return (
    <DashboardSectionRenderer section={resolved} copy={copy} isFr={isFr} />
  );
}

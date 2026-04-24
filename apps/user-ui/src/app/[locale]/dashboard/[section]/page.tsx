"use client";

import { useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";
import { getDashboardCopy } from "../dashboard.copy";
import { NAV_GROUPS, type SectionKey } from "../dashboard.config";
import DashboardSectionRenderer from "@/components/dashboard/DashboardSectionRenderer";


const VALID_SECTIONS = new Set<string>([
  "home",
  ...NAV_GROUPS.flatMap((g) => g.items.map((i) => i.key)),
]);

export default function DashboardSectionPage() {
  const params = useParams<{ section: string }>();
  const router = useRouter();
  const { lang } = useUiPreferences();
  const isFr = lang === "fr";
  const copy = useMemo(() => getDashboardCopy(isFr), [isFr]);

  const section = params?.section ?? "home";
  const isValid = VALID_SECTIONS.has(section);

  useEffect(() => {
    if (!isValid) {
      router.replace("/dashboard/home");
    }
  }, [isValid, router]);

  if (!isValid) return null;

  return (
    <DashboardSectionRenderer
      section={section as SectionKey}
      copy={copy}
      isFr={isFr}
    />
  );
}

"use client";

import { DashboardCopy } from "@/app/[locale]/dashboard/dashboard.copy";
import HomeClient from "@/components/dashboard/home/HomeClient";

/**
 * Section Accueil du dashboard — inbox d'actions unifiée.
 * Wrapper mince : signature `{ copy }` conservée pour le renderer.
 * Live : actions dérivées des données réelles (brouillons, pauses,
 * demandes reçues). La home pleine (2 rôles) : /dashboard/home/preview.
 */
export default function HomeSection({ copy }: { copy: DashboardCopy }) {
  void copy; // signature conservée, i18n gérée par le module
  return <HomeClient />;
}

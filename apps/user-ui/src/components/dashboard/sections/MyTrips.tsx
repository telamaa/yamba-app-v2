"use client";

import { DashboardCopy } from "@/app/[locale]/dashboard/dashboard.copy";
import TripsClient from "@/components/dashboard/trips/TripsClient";

/**
 * Section "Mes trajets" du dashboard (vue Voyageur).
 *
 * Wrapper mince : signature `{ copy }` conservée pour ne pas toucher à
 * DashboardSectionRenderer. Contenu réel dans dashboard/trips/ (next-intl,
 * namespace "myTrips") : bande "À traiter" dérivée de la machine d'état
 * + trip cards dépliables avec deals imbriqués.
 */
export default function MyTrips({ copy }: { copy: DashboardCopy }) {
  void copy; // signature conservée, i18n gérée par le module
  return <TripsClient />;
}

"use client";

import { DashboardCopy } from "@/app/[locale]/dashboard/dashboard.copy";
import ShipmentsClient from "@/components/dashboard/shipments/ShipmentsClient";

/**
 * Section "Mes envois" du dashboard.
 *
 * Wrapper mince : la signature `{ copy }` est conservée pour ne pas toucher
 * à DashboardSectionRenderer, mais le contenu réel (header, filtres, liste
 * pilotée par la machine d'état) vit dans le module dashboard/shipments/
 * qui utilise next-intl (namespace "shipments").
 */
export default function MyShipments({ copy }: { copy: DashboardCopy }) {
  void copy; // signature conservée, i18n gérée par le module
  return <ShipmentsClient />;
}

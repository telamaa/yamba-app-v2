/** Affichage d'une valeur de paramètre selon son unité (C-PR8a, D62) — jamais de Float en base, des cents partout. */
import type { SettingDefinition, SettingGroup } from "@/lib/types";

export const SETTING_GROUP_LABEL: Record<SettingGroup, string> = {
  pricing: "Prix et commission",
  protection: "Garantie Yamba",
  cancellation: "Annulation",
  rating: "Notation",
  dispute: "Litiges",
  reputation: "Réputation",
  messaging: "Messagerie",
  alerts: "Alertes d'exploitation",
  documents: "Documents",
};
export const SETTING_GROUP_ORDER: SettingGroup[] = ["pricing", "protection", "cancellation", "rating", "dispute", "reputation", "messaging", "alerts", "documents"];

export function formatSetting(def: Pick<SettingDefinition, "unit">, v: number): string {
  switch (def.unit) {
    case "cents": return `${(v / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
    case "percent": return `${v.toLocaleString("fr-FR")} %`;
    case "kg": return `${v.toLocaleString("fr-FR")} kg`;
    case "coef": return `× ${v.toLocaleString("fr-FR")}`;
    case "hours": return `${v.toLocaleString("fr-FR")} h`;
    case "days": return `${v.toLocaleString("fr-FR")} j`;
    case "minutes": return `${v.toLocaleString("fr-FR")} min`;
    case "rating": return `${v.toLocaleString("fr-FR")} / 5`;
    case "mb": return `${v.toLocaleString("fr-FR")} Mo`;
    default: return v.toLocaleString("fr-FR");
  }
}

/** Valeur saisie (euros pour les cents) → valeur du catalogue. */
export function toStored(def: Pick<SettingDefinition, "unit">, input: number): number {
  return def.unit === "cents" ? Math.round(input * 100) : input;
}
export function toInput(def: Pick<SettingDefinition, "unit">, stored: number): number {
  return def.unit === "cents" ? stored / 100 : stored;
}
export function inputStep(def: Pick<SettingDefinition, "unit" | "step">): number {
  return def.unit === "cents" ? def.step / 100 : def.step;
}
export function inputBounds(def: Pick<SettingDefinition, "unit" | "min" | "max">): { min: number; max: number } {
  return def.unit === "cents" ? { min: def.min / 100, max: def.max / 100 } : { min: def.min, max: def.max };
}

/** Aperçu chiffré pour les clés de prix (D62 5A) : « sur un transport de 20 € … ». */
export function previewOf(key: string, values: Record<string, number>): string | null {
  const transport = 2000;
  if (key === "pricing.commissionPct" || key === "pricing.commissionFloorCents") {
    const c = Math.max(Math.round((transport * values["pricing.commissionPct"]) / 100), values["pricing.commissionFloorCents"]);
    return `Sur un transport de 20 € : commission ${(c / 100).toFixed(2)} €, total Expéditeur ${((transport + c) / 100).toFixed(2)} €.`;
  }
  if (key === "pricing.minTransportCents" || key === "pricing.minBillableKg") {
    const perKg = 1000;
    const t = Math.max(Math.round(perKg * Math.max(0.2, values["pricing.minBillableKg"])), values["pricing.minTransportCents"]);
    return `Colis de 0,2 kg à 10 €/kg : transport ${(t / 100).toFixed(2)} €.`;
  }
  if (key.startsWith("pricing.sizeCoef")) {
    const coef = values[key];
    return `Transport 20 € dans cette taille : ${((transport * coef) / 100).toFixed(2)} €.`;
  }
  if (key === "cancellation.lateRetentionPct") return `Total 30 € annulé après la fenêtre : ${((3000 * (100 - values[key])) / 10000).toFixed(2)} € rendus.`;
  if (key === "dispute.responseDelayHours") return `Litige ouvert lundi 9 h : décidable ${values[key] % 24 === 0 ? `${values[key] / 24} jour(s) plus tard` : `${values[key]} h plus tard`}.`;
  return null;
}

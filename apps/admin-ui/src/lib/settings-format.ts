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
  privacy: "Données personnelles",
  retention: "Conservation",
  trust: "Confiance (TrustScore interne)",
};
export const SETTING_GROUP_ORDER: SettingGroup[] = ["pricing", "protection", "cancellation", "rating", "dispute", "reputation", "messaging", "alerts", "documents", "privacy", "retention", "trust"];

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

/** Recette § 5.20 — un montant d'aperçu en français (« 3,00 € »), comme le reste de la page (l'aperçu écrivait « 3.00 € »). */
const euros = (cents: number) => (cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Aperçu chiffré pour les clés de prix (D62 5A) : « sur un transport de 20 € … ». */
export function previewOf(key: string, values: Record<string, number>): string | null {
  const transport = 2000;
  if (key === "pricing.commissionPct" || key === "pricing.commissionFloorCents") {
    const c = Math.max(Math.round((transport * values["pricing.commissionPct"]) / 100), values["pricing.commissionFloorCents"]);
    return `Sur un transport de 20 € : commission ${euros(c)} €, total Expéditeur ${euros(transport + c)} €.`;
  }
  if (key === "pricing.minTransportCents" || key === "pricing.minBillableKg") {
    const perKg = 1000;
    const t = Math.max(Math.round(perKg * Math.max(0.2, values["pricing.minBillableKg"])), values["pricing.minTransportCents"]);
    return `Colis de 0,2 kg à 10 €/kg : transport ${euros(t)} €.`;
  }
  if (key.startsWith("pricing.sizeCoef")) {
    const coef = values[key];
    return `Transport 20 € dans cette taille : ${euros(Math.round(transport * coef))} €.`;
  }
  if (key === "cancellation.lateRetentionPct") return `Total 30 € annulé après la fenêtre : ${euros(Math.round((3000 * (100 - values[key])) / 100))} € rendus.`;
  if (key === "dispute.responseDelayHours") return `Litige ouvert lundi 9 h : décidable ${values[key] % 24 === 0 ? `${values[key] / 24} jour(s) plus tard` : `${values[key]} h plus tard`}.`;
  return null;
}

/**
 * ANO-ADM-54 (recette 02-ADMIN § 5.20) — un refus d'écriture des paramètres, lu par son code (A146), en français. L'écran
 * affichait « 400 : Some values are out of bounds. — pricing.commissionPct : Must be between 5 and 20 (percent). ».
 * `reload` : la page est périmée (un collègue a écrit entre-temps) — elle se recharge et les saisies sont à refaire.
 */
export function settingsRefusalMessage(
  e: { status?: number; data?: unknown } | null | undefined,
  catalog: ReadonlyArray<Pick<SettingDefinition, "key" | "label" | "unit" | "min" | "max">>
): { text: string; reload: boolean } {
  const details = (e?.data as { details?: { code?: string; errors?: Record<string, string> } } | undefined)?.details;
  const code = details?.code;
  const def = (key: string) => catalog.find((d) => d.key === key);
  if (e?.status === 409 || code === "STALE_VERSION") return { text: "Les paramètres ont changé entre-temps : la page est rechargée, refais ta modification.", reload: true };
  if (code === "SETTING_OUT_OF_BOUNDS" && details?.errors) {
    const lignes = Object.keys(details.errors).map((key) => {
      const d = def(key);
      return d ? `${d.label} : entre ${formatSetting(d, d.min)} et ${formatSetting(d, d.max)}` : `${key} : paramètre inconnu`;
    });
    return { text: `Valeur refusée — ${lignes.join(" · ")}.`, reload: false };
  }
  if (code === "SETTINGS_INCOHERENT") return { text: `Règle de cohérence non respectée : ${details?.errors?.coherence ?? "vérifie les valeurs liées."}`, reload: false };
  if (code === "ADMIN_ROLE_CHANGE_DENIED" || e?.status === 403) return { text: "Ton profil ne peut pas modifier ces paramètres : la page est rechargée.", reload: true };
  if (code === "NOTHING_TO_CHANGE") return { text: "Rien à enregistrer : chaque valeur est déjà celle en vigueur.", reload: true };
  if (code === "NOTHING_TO_RESET") return { text: "Rien à remettre : chaque valeur est déjà celle par défaut.", reload: true };
  if (code === "REASON_TOO_SHORT" || code === "INVALID_SETTINGS_REQUEST") return { text: "Demande refusée : le motif doit faire 20 caractères au moins.", reload: false };
  return { text: "Enregistrement impossible pour le moment. Recharge la page avant de réessayer.", reload: false };
}

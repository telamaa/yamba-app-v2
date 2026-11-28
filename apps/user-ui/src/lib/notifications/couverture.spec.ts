/**
 * couverture.spec.ts — l'union fermée des notifications, couverte en entier (D119 bis).
 * =======================================================================================
 * Il n'y a pas de module ici : la règle à garder n'est pas une fonction,
 * c'est une COUVERTURE. `NotificationType` est une union FERMÉE de 25 clés,
 * et le site en laissait QUATRE tomber dans un repli intitulé
 * « Notification ».
 *
 * Le défaut le plus instructif des quatre : `booking.dispute_carrier_responded`
 * avait ses PHRASES écrites (`copy`) et pas sa ligne de présentation —
 * écrit, puis oublié à mi-chemin. Les deux portes doivent s'ouvrir, et une
 * seule des deux suffit à tout bloquer.
 *
 * C'est la leçon d'ANO-API-16 (recette du 08/09, BLOQUANTE : l'union ne
 * couvrait pas `conversation.*` et toute la boîte répondait 500), rejouée
 * côté CLIENT — là, personne n'avait compté.
 *
 * `notifications.types.ts` ne peut pas être importé ici (il tire
 * `lucide-react`) : on le LIT, comme le harnais le fait déjà ailleurs.
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  BookingEventTypeSchema,
  MessagingEventTypeSchema,
  SYSTEM_NOTIFICATION_TYPES,
} from "@packages/api-contracts";

const SITE = resolve(__dirname, "../../..");
/** Les trois crans du transport (A39, D116) : chacun a ses phrases. */
const JALONS = ["AT_AIRPORT", "FLIGHT_DEPARTED", "FLIGHT_ARRIVED"] as const;

const TYPES: string[] = [
  ...BookingEventTypeSchema.options,
  ...SYSTEM_NOTIFICATION_TYPES,
  ...MessagingEventTypeSchema.options,
];

/** La table de présentation, lue à la source (elle décide du repli). */
function typesPresentes(): Set<string> {
  const source = readFileSync(
    join(SITE, "src/components/dashboard/notifications/notifications.types.ts"),
    "utf8"
  );
  return new Set([...source.matchAll(/"([a-z]+\.[a-z_]+)": \{ icon/g)].map((m) => m[1]));
}

function dictionnaire(locale: string): {
  copy: Record<string, Record<string, { title?: string; line?: string }>>;
  items: Record<string, string>;
} {
  return JSON.parse(readFileSync(join(SITE, `messages/${locale}/notifications.json`), "utf8"));
}

describe("l'union fermée est couverte EN ENTIER", () => {
  it("le contrat porte vingt-cinq clés, toutes distinctes", () => {
    expect(TYPES.length).toBe(25);
    expect(new Set(TYPES).size).toBe(25);
  });

  it("CHAQUE type a sa ligne de présentation — sinon il tombe dans le repli", () => {
    // `isKnownNotificationType` lit cette table : un type absent affiche
    // « Notification », quelles que soient les phrases écrites à côté.
    const presentes = typesPresentes();
    const muets = TYPES.filter((type) => !presentes.has(type));
    expect(`manquants → ${muets.join(", ") || "aucun"}`).toBe("manquants → aucun");
  });

  it("CHAQUE type a ses phrases, par RÔLE, dans les DEUX langues", () => {
    // Le site rédige par rôle : « ta demande a été acceptée » (Expéditeur)
    // est « tu as accepté » (Voyageur). Une phrase au mauvais rôle est
    // fausse, donc les deux existent ou aucune.
    for (const locale of ["fr", "en"]) {
      const { copy } = dictionnaire(locale);
      const troues = TYPES.filter((type) => {
        const entree = copy[type.replace(/\./g, "_")] as Record<string, never> | undefined;
        if (entree === undefined) return true;
        // `booking.tracking_event` a une forme À PART, et c'est légitime :
        // un jalon a ses phrases PAR ÉTAPE (`…ROLE.AT_AIRPORT.title`),
        // parce que « l'avion a décollé » et « je suis à l'aéroport » ne se
        // disent pas pareil. La fiche connaît cette forme plutôt que de
        // l'excepter — une exception se contourne, une forme se vérifie.
        if (type === "booking.tracking_event") {
          return ["SHIPPER", "CARRIER"].some((role) =>
            JALONS.some(
              (jalon) =>
                typeof (entree as Record<string, Record<string, { title?: string }>>)[role]?.[jalon]
                  ?.title !== "string"
            )
          );
        }
        const parRole = entree as unknown as Record<string, { title?: string } | undefined>;
        return (
          typeof parRole.SHIPPER?.title !== "string" ||
          typeof parRole.CARRIER?.title !== "string"
        );
      });
      expect(`${locale} → ${troues.join(", ") || "aucun"}`).toBe(`${locale} → aucun`);
    }
  });

  it("le REPLI existe quand même, pour l'événement de DEMAIN", () => {
    // Un client ne doit jamais rester muet sur un type que le serveur a
    // déployé avant lui. C'est un filet, pas une traduction.
    for (const locale of ["fr", "en"]) {
      expect(typeof dictionnaire(locale).items.fallback).toBe("string");
    }
  });

  it("les deux fronts nomment les mêmes vingt-cinq clés", () => {
    // Lu avec `readFileSync` : jamais un import à travers une frontière de
    // projet (D93).
    const natif = JSON.parse(
      readFileSync(resolve(SITE, "../mobile/messages/fr/notifications.json"), "utf8")
    ) as { items: Record<string, string> };
    const muets = TYPES.filter((type) => typeof natif.items[type.replace(/\./g, "_")] !== "string");
    expect(`mobile → ${muets.join(", ") || "aucun"}`).toBe("mobile → aucun");
  });
});

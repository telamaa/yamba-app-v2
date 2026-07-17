/**
 * @packages/api-contracts — barrel
 * ================================
 * Point d'entrée unique du module. Importer ce barrel a un effet de bord
 * voulu : chaque schéma portant .meta({ id }) s'enregistre dans
 * z.globalRegistry, ce qui alimente la génération OpenAPI.
 */

export * from "./common";
export * from "./trip/trip.enums";
export * from "./trip/trip.schema";

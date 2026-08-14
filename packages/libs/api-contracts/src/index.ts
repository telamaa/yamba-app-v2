/**
 * @packages/api-contracts — barrel
 * ================================
 * Point d'entrée unique du module. Importer ce barrel a un effet de bord
 * voulu : chaque schéma portant .meta({ id }) s'enregistre dans
 * z.globalRegistry, ce qui alimente la génération OpenAPI.
 *
 * A22 : registre commun assumé — les documents OAS de chaque service
 * embarquent l'ensemble des components de la plateforme (un seul
 * espace de noms de schémas).
 */

export * from "./common";
export * from "./trip/trip.enums";
export * from "./trip/trip.schema";
export * from "./trip/trip-search.schema";
export * from "./trip/trip-public.schema";
export * from "./booking/booking.enums";
export * from "./booking/booking.schema";
export * from "./booking/booking-events.schema";
export * from "./notification/notification.schema";
export * from "./trip/trip-pricing.schema";

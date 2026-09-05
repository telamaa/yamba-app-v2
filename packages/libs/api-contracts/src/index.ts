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
export * from "./locale";
export * from "./trip/trip.enums";
export * from "./trip/trip.schema";
export * from "./trip/trip-search.schema";
export * from "./trip/trip-public.schema";
export * from "./booking/booking.enums";
export * from "./booking/booking.schema";
export * from "./booking/booking-events.schema";
export * from "./booking/booking-request.schema";
export * from "./booking/booking-lifecycle.schema";
export * from "./booking/booking-transport.schema";
export * from "./booking/booking-settlement.schema";
export * from "./booking/booking-wallet.schema";
export * from "./booking/booking-rating.schema";
export * from "./notification/notification.schema";
export * from "./trip/trip-pricing.schema";
export * from "./trip/trip-favorite.schema";
export * from "./admin/admin-dispute.schema";
export * from "./admin/admin-users.schema";
export * from "./admin/admin-trips.schema";
export * from "./admin/admin-finances.schema";
export * from "./admin/admin-pilotage.schema";
export * from "./messaging/messaging.schema";
export * from "./messaging/messaging-events.schema";
export * from "./admin/admin-alerts.schema";
export * from "./admin/platform-settings.schema"; // C-PR8a (D62)
export * from "./admin/admin-privacy.schema"; // C-PR8b (D63)
export * from "./admin/admin-status.schema"; // C-PR8c (D64)
export * from "./admin/member-sessions.schema"; // D65
export * from "./admin/member-profile.schema"; // D67

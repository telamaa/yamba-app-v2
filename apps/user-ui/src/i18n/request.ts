import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }
  const [
    common,
    home,
    auth,
    dashboard,
    trips,
    carrier,
    search,
    tripDetail,
    userProfile,
    savedRoutes,
    following,
    booking,
    carrierDealRequest,
    carrierDealAccepted, // ✨ Phase 2
    bookingTracker, // ✨ Phase 3
    carrierDealPickup, // ✨ pickup
    carrierDealTracking, // ✨ NEW tracking
    carrierDealDeliver, // ✨ NEW deliver
    rating, // ✨ NEW rating
    shipments, // ✨ NEW dashboard Mes envois
    myTrips, // ✨ NEW dashboard Mes trajets
    dashboardHome, // ✨ NEW dashboard home inbox
    notifications, // ✨ NEW dashboard notifications (PR5)
    favorites, // D46 — Mes favoris
    finances, // A83 — Finances (portefeuille + paiements)
    mediation, // C-PR2 (D55) — décision de médiation, version du Voyageur
    messaging, // F-PR2 (D61) — conversation, rendez-vous, numéro
  ] = await Promise.all([
    import(`../../messages/${locale}/common.json`),
    import(`../../messages/${locale}/home.json`),
    import(`../../messages/${locale}/auth.json`),
    import(`../../messages/${locale}/dashboard.json`),
    import(`../../messages/${locale}/trips.json`),
    import(`../../messages/${locale}/carrier.json`),
    import(`../../messages/${locale}/search.json`),
    import(`../../messages/${locale}/trip-detail.json`),
    import(`../../messages/${locale}/user-profile.json`),
    import(`../../messages/${locale}/savedRoutes.json`),
    import(`../../messages/${locale}/following.json`),
    import(`../../messages/${locale}/booking.json`),
    import(`../../messages/${locale}/carrierDealRequest.json`),
    import(`../../messages/${locale}/carrierDealAccepted.json`), // ✨ Phase 2
    import(`../../messages/${locale}/bookingTracker.json`), // ✨ Phase 3
    import(`../../messages/${locale}/carrierDealPickup.json`), // ✨ pickup
    import(`../../messages/${locale}/carrierDealTracking.json`), // ✨ NEW tracking
    import(`../../messages/${locale}/carrierDealDeliver.json`), // ✨ NEW deliver
    import(`../../messages/${locale}/rating.json`), // ✨ NEW rating
    import(`../../messages/${locale}/shipments.json`), // ✨ NEW dashboard Mes envois
    import(`../../messages/${locale}/myTrips.json`), // ✨ NEW dashboard Mes trajets
    import(`../../messages/${locale}/dashboardHome.json`), // ✨ NEW dashboard home inbox
    import(`../../messages/${locale}/notifications.json`), // ✨ NEW dashboard notifications (PR5)
    import(`../../messages/${locale}/favorites.json`), // D46
    import(`../../messages/${locale}/finances.json`), // A83
    import(`../../messages/${locale}/mediation.json`), // C-PR2
    import(`../../messages/${locale}/messaging.json`), // F-PR2 (D61)
  ]);
  return {
    locale,
    messages: {
      common: common.default,
      home: home.default,
      auth: auth.default,
      dashboard: dashboard.default,
      trips: trips.default,
      carrier: carrier.default,
      search: search.default,
      tripDetail: tripDetail.default,
      userProfile: userProfile.default,
      savedRoutes: savedRoutes.default,
      following: following.default,
      booking: booking.default,
      carrierDealRequest: carrierDealRequest.default,
      carrierDealAccepted: carrierDealAccepted.default, // ✨ Phase 2
      bookingTracker: bookingTracker.default, // ✨ Phase 3
      carrierDealPickup: carrierDealPickup.default, // ✨ pickup
      carrierDealTracking: carrierDealTracking.default, // ✨ NEW tracking
      carrierDealDeliver: carrierDealDeliver.default, // ✨ NEW deliver
      rating: rating.default, // ✨ NEW rating
      shipments: shipments.default, // ✨ NEW dashboard Mes envois
      myTrips: myTrips.default, // ✨ NEW dashboard Mes trajets
      dashboardHome: dashboardHome.default, // ✨ NEW dashboard home inbox
      notifications: notifications.default, // ✨ NEW dashboard notifications (PR5)
      favorites: favorites.default, // D46
      finances: finances.default, // A83
      mediation: mediation.default, // C-PR2
      messaging: messaging.default, // F-PR2 (D61)
    },
  };
});

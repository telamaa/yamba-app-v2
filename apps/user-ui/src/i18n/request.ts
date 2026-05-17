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
    carrierDealRequest, // ✨ NEW
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
    import(`../../messages/${locale}/carrierDealRequest.json`), // ✨ NEW
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
      carrierDealRequest: carrierDealRequest.default, // ✨ NEW
    },
  };
});

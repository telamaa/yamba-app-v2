/**
 * booking.api.ts
 * ==============
 * Frontend stubs for the booking flow.
 * When deal-service is implemented, replace each function's body
 * with a real `fetch()` through the gateway (port 8080).
 *
 * The function signatures should not change — this keeps the swap
 * a one-line change in each function rather than a refactor of the UI.
 */

import { computeTotal } from "@/components/booking/booking.config";
import type {
  CreateDealResponse,
  Draft,
  PriceBreakdown,
  TripContext,
} from "@/components/booking/booking.types";

const SIMULATED_LATENCY_MS = 800;

const wait = (ms: number): Promise<void> =>
  new Promise((res) => setTimeout(res, ms));

/**
 * Create a Deal in PENDING_CARRIER state.
 * Real implementation will POST /api/deals through the gateway.
 */
export async function createDeal(
  draft: Draft,
  trip: TripContext
): Promise<CreateDealResponse> {
  // eslint-disable-next-line no-console
  console.info("[booking.api.stub] createDeal", { draft, trip });
  await wait(SIMULATED_LATENCY_MS);

  return {
    dealId: `deal-mock-${Date.now()}`,
    // paymentClientSecret will come from the real backend when wired.
  };
}

/**
 * Price breakdown for the sidebar/bottom-sheet.
 * Stays a pure computation for now; later may call backend to get
 * authoritative pricing (currency conversion, dynamic fees, etc.).
 */
export function computePrice(
  draft: Draft,
  trip: TripContext
): PriceBreakdown {
  return computeTotal(draft, trip);
}

/**
 * Fetch the trip context for the booking wizard.
 * Currently returns the mock trip; will hit trip-service in the future.
 */
export async function fetchTripContext(
  tripId: string
): Promise<TripContext | null> {
  // eslint-disable-next-line no-console
  console.info("[booking.api.stub] fetchTripContext", { tripId });
  await wait(SIMULATED_LATENCY_MS / 2);
  // The page.tsx will pass the real mockTrip from booking.state.ts;
  // returning null here would force the page to show a 404.
  // For frontend-only dev we let the caller handle the mock.
  return null;
}

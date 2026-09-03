/**
 * wallet.types.ts — forme LUE de GET /me/wallet (A83)
 * ===================================================
 * Miroir de lecture du contrat `WalletResponse` (@packages/api-contracts,
 * source de vérité côté serveur) : seuls les champs affichés sont déclarés,
 * comme pour les autres DTO du front (le paquet Zod n'est pas embarqué).
 */

export type WalletPayoutState = "UPCOMING" | "PENDING" | "BLOCKED" | "FROZEN" | "SENT" | "HELD" | "REVERSED";
export type WalletPaymentState = "AUTHORIZED" | "HELD" | "RELEASED" | "RELEASED_NO_CHARGE" | "REFUNDED" | "PARTIALLY_REFUNDED";

export type WalletPayoutItem = {
  bookingId: string;
  tripId: string;
  bookingStatus: string;
  corridor: { originCity: string; destinationCity: string };
  counterpartFirstName: string | null;
  kind: "DELIVERY" | "LATE_CANCELLATION";
  state: WalletPayoutState;
  amountCents: number | null;
  currencyCode: string;
  date: string | null;
};

export type CarrierWallet = {
  upcomingCents: number;
  pendingCents: number;
  blockedCents: number;
  sentCents: number;
  sentThisMonthCents: number;
  currencyCode: string;
  items: WalletPayoutItem[];
};

export type WalletPaymentItem = {
  bookingId: string;
  tripId: string;
  bookingStatus: string;
  corridor: { originCity: string; destinationCity: string };
  counterpartFirstName: string | null;
  state: WalletPaymentState;
  amountCents: number;
  refundAmountCents: number | null;
  retentionCents: number | null;
  currencyCode: string;
  date: string | null;
};

export type ShipperWallet = {
  heldCents: number;
  spentCents: number;
  refundedCents: number;
  currencyCode: string;
  items: WalletPaymentItem[];
};

export type WalletResponse = {
  success: true;
  carrier: CarrierWallet;
  shipper: ShipperWallet;
  generatedAt: string;
};

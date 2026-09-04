/**
 * types.ts — miroir TypeScript des contrats admin (packages/libs/api-contracts/src/admin).
 * Le contrat Zod reste la source ; ce miroir évite d'embarquer zod dans le bundle admin.
 */
export type ArbitrationKind = "DISPUTE" | "RETENTION";
export type DisputeCategory = "NOT_DELIVERED" | "CONTENT_MISSING" | "DAMAGED" | "SIGNIFICANT_DELAY" | "RECIPIENT_ISSUE" | "OTHER";

export type ArbitrationQueueItem = {
  bookingId: string;
  kind: ArbitrationKind;
  ticketNumber: string | null;
  category: DisputeCategory | null;
  openedAt: string;
  originCity: string;
  destinationCity: string;
  amountCents: number;
  currencyCode: string;
  shipperFirstName: string;
  carrierFirstName: string;
  carrierResponded: boolean;
  decidableAt: string;
};
export type ArbitrationQueueResponse = { items: ArbitrationQueueItem[]; counts: { disputes: number; retentions: number } };

export type Party = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  completedDealsCount: number;
  lateCancellationsCount: number;
  disputesLostCount: number;
  ratingsAvg: number;
  ratingsCount: number;
};

export type DisputeResolutionOutcome = "REJECTED" | "PARTIAL_REFUND" | "FULL_REFUND";
export type RetentionArbitrationOutcome = "COMPENSATE_CARRIER" | "RESTITUTE_SHIPPER";
export type DisputeResolution = { outcome: DisputeResolutionOutcome; refundCents: number; carrierPayoutCents: number; reason: string; resolvedAt: string };
export type AdminResolutionResponse = {
  bookingId: string;
  kind: ArbitrationKind;
  finalStatus: "COMPLETED" | "CANCELLED";
  outcome: string;
  refundCents: number;
  carrierPayoutCents: number;
  payoutStatus: string | null;
  resolvedAt: string;
};

export type AdminDisputeFile = {
  bookingId: string;
  kind: ArbitrationKind;
  status: string;
  timeline: {
    requestedAt: string;
    acceptedAt: string | null;
    departureAt: string;
    pickedUpAt: string | null;
    deliveredAt: string | null;
    disputedAt: string | null;
    closedAt: string | null;
    closedBy: string | null;
    cancelReason: string | null;
  };
  corridor: { originCity: string; destinationCity: string; transportMode: string | null };
  parcel: { category: string; description: string; declaredValueCents: number; weightKg: number; photoUrls: string[] };
  recipient: { firstName: string; lastName: string };
  money: {
    totalShipperCents: number;
    transportCents: number;
    commissionCents: number;
    premiumCents: number;
    currencyCode: string;
    capturedAt: string | null;
    refundedAt: string | null;
    refundAmountCents: number | null;
    payoutStatus: string | null;
    payoutAmountCents: number | null;
    retentionCents: number | null;
    retentionDisposition: string | null;
  };
  shipper: Party;
  carrier: Party;
  pickup: { confirmedAt: string; photoUrls: string[]; checklist: string[]; notes: string | null } | null;
  trackingEvents: Array<{ step: string; confirmedAt: string }>;
  deliveryPhotoUrls: string[];
  dispute: {
    ticketNumber: string;
    category: DisputeCategory;
    description: string;
    desiredOutcome: "FULL_REFUND" | "PARTIAL_REFUND" | "CONTACT_CARRIER" | "YAMBA_DECIDES" | null;
    photoUrls: string[];
    pledgeAcceptedAt: string;
    status: string;
    carrierStatement: { statement: string; photoUrls: string[]; respondedAt: string } | null;
    responseDeadlineAt: string;
    resolution: DisputeResolution | null;
  } | null;
  retentionDecision: { outcome: RetentionArbitrationOutcome; reason: string; decidedAt: string } | null;
  canDecide: boolean;
  decidableAt: string | null;
  proposedAmounts: {
    rejectedCarrierPayoutCents: number;
    fullRefundCents: number;
    compensateCarrierCents: number | null;
    restituteShipperCents: number | null;
  };
};

export type AdminMe = { id: string; email: string; firstName: string; lastName: string; remainingBackupCodes: number };

export type AuditItem = {
  id: string;
  at: string;
  admin: string;
  action: string;
  targetType: string;
  targetId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
};
export type AuditResponse = { items: AuditItem[]; nextCursor: string | null };

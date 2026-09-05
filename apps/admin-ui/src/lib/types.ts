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

export type AdminMe = { id: string; email: string; firstName: string; lastName: string; adminRole: import("./permissions").AdminRole | null; adminRoles: import("./permissions").AdminRole[]; remainingBackupCodes: number };

/* ── C-PR3 (D56) — utilisateurs, comptes admin, sessions ── */
export type AccountStatus = "ACTIVE" | "RESTRICTED" | "SUSPENDED";
export type AdminUserSummary = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneE164: string | null;
  roles: string[];
  adminRole: import("./permissions").AdminRole | null;
  adminRoles: import("./permissions").AdminRole[];
  accountStatus: AccountStatus;
  carrierStatus: string;
  createdAt: string;
  matchedOn: string | null;
};
export type AdminUsersResponse = { items: AdminUserSummary[]; total: number; nextCursor?: string | null };
export type ReputationFacts = { reputationLevel: string | null; ratingsAvg: number; ratingsCount: number; completedDealsCount: number; lateCancellationsCount: number; disputesLostCount: number };
export type AdminUserFile = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneE164: string | null;
  preferredLocale: string;
  roles: string[];
  adminRole: import("./permissions").AdminRole | null;
  adminRoles: import("./permissions").AdminRole[];
  accountStatus: AccountStatus;
  suspension: { level: AccountStatus; reason: string; until: string | null; at: string; byAdmin: string } | null;
  suspensionProposal: { level: string; reason: string; byAdmin: string; at: string } | null;
  createdAt: string;
  isDeleted: boolean;
  isMe: boolean;
  carrier: (ReputationFacts & { status: string; stripeAccountId: string | null; stripeChargesEnabled: boolean; stripePayoutsEnabled: boolean }) | null;
  shipper: ReputationFacts;
  activity: {
    trips: Array<{ id: string; status: string; originCity: string; destinationCity: string; departureAt: string }>;
    deals: Array<{ id: string; status: string; role: "SHIPPER" | "CARRIER"; originCity: string; destinationCity: string; totalShipperCents: number; transportCents: number; currencyCode: string; disputeTicket: string | null; requestedAt: string }>;
    activeDealsCount: number;
    activeSessionsCount: number;
  };
  adminActions: Array<{ id: string; at: string; admin: string; action: string; after: unknown }>;
};
export type AdminAccount = { id: string; firstName: string; lastName: string; email: string; adminRole: import("./permissions").AdminRole; adminRoles: import("./permissions").AdminRole[]; totpEnabled: boolean; inviteAccepted: boolean; createdAt: string };
export type AdminSessionItem = { jti: string; createdAt: string; lastActivityAt: string; current: boolean };

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

/* ── C-PR4 (D57) — trajets, billets, KPI ── */
export type AdminTripSummary = {
  id: string; status: string; originCity: string; destinationCity: string; departureAt: string | null; transportMode: string | null;
  carrier: { id: string; firstName: string; lastName: string; accountStatus: string };
  ticketVerificationStatus: string; hidden: boolean; hideProposed: boolean; activeBookingsCount: number; publishedAt: string | null;
};
export type AdminTripsResponse = { items: AdminTripSummary[]; total: number; nextCursor?: string | null };
export type AdminTripFile = {
  id: string; status: string; originCity: string; destinationCity: string; departureAt: string | null; arrivalAt: string | null; transportMode: string | null;
  capacityKg: number | null; reservedKg: number | null; pricing: unknown; createdAt: string; publishedAt: string | null; cancelledAt: string | null;
  carrier: { id: string; firstName: string; lastName: string; email: string; accountStatus: string; carrierStatus: string };
  ticketVerificationStatus: string;
  hidden: { at: string; reason: string; byAdmin: string } | null;
  hideProposal: { reason: string; byAdmin: string; at: string } | null;
  documents: Array<{ id: string; type: string; status: string; originalName: string | null; createdAt: string; reviewedAt: string | null; rejectionReason: string | null }>;
  bookings: Array<{ id: string; status: string; shipperFirstName: string; weightKg: number; totalShipperCents: number; transportCents: number; currencyCode: string; disputeTicket: string | null; requestedAt: string }>;
  adminActions: Array<{ id: string; at: string; admin: string; action: string; after: unknown }>;
};
export type TicketQueueItem = {
  documentId: string; tripId: string; originCity: string; destinationCity: string; departureAt: string | null; transportMode: string | null;
  carrier: { id: string; firstName: string; lastName: string }; originalName: string | null; mimeType: string | null; submittedAt: string;
};
export type TicketQueueResponse = { items: TicketQueueItem[]; expiredNow: number };
export type TicketRejectionReason = "ILLEGIBLE" | "DATES_MISMATCH" | "NAME_MISMATCH" | "SUSPICIOUS";
export type AdminHomeKpis = {
  disputesToDecide: number | null; retentionsHeld: number | null; ticketsToVerify: number | null; hiddenTrips: number | null; hideProposals: number | null;
  suspensionProposals: number | null; restrictedUsers: number | null; suspendedUsers: number | null; publishedTrips: number | null; activeDeals: number | null;
  payoutsFailed: number | null; payoutsReversed: number | null; manualRefundProposals: number | null; pendingAdminInvites: number | null; usersTotal: number | null; completedDeals30d: number | null; messageReportsOpen?: number | null; generatedAt: string;
};

/* ── C-PR5a (D58) — finances ── */
export type FinanceQueueKind = "FAILED" | "REVERSED" | "HELD" | "PROPOSED_REFUNDS";
export type FinanceQueueItem = {
  bookingId: string; kind: FinanceQueueKind; status: string;
  corridor: { originCity: string; destinationCity: string; departureAt: string | null };
  shipper: { id: string; firstName: string };
  carrier: { id: string; firstName: string; stripeReady: boolean | null };
  amountCents: number; currencyCode: string; payoutStatus: string | null; payoutAttempts: number;
  payoutFailureKind: "ACCOUNT_NOT_READY" | "PROVIDER_ERROR" | "REVERSED" | null; payoutFailureDetail: string | null;
  lastAttemptAt: string | null; nextRetryAt: string | null; disputeTicket: string | null; since: string;
};
export type FinanceQueueResponse = { kind: FinanceQueueKind; items: FinanceQueueItem[]; generatedAt: string };
export type MoneyTimelineEvent = { at: string; kind: string; amountCents: number | null; detail: string | null };
export type AdminDealMoneyFile = {
  id: string; status: string; disputeTicket: string | null;
  corridor: { originCity: string; destinationCity: string; departureAt: string | null };
  shipper: { id: string; firstName: string; lastName: string };
  carrier: { id: string; firstName: string; lastName: string; stripeAccountIdMasked: string | null; stripePayoutsEnabled: boolean | null };
  pricing: { pricingModel: string; weightKg: number; transportCents: number; commissionCents: number; premiumCents: number; totalShipperCents: number; currencyCode: string };
  payment: { provider: string | null; intentId: string | null; chargeId: string | null; capturedAt: string | null; refundedAt: string | null; refundAmountCents: number | null; refundId: string | null };
  payout: { status: string | null; amountCents: number | null; sentAt: string | null; attempts: number; failureKind: string | null; failureDetail: string | null; lastAttemptAt: string | null; nextRetryAt: string | null; transferId: string | null; reversal: { resolution: string; reason: string; at: string; byAdmin: string } | null };
  retention: { cents: number; disposition: string | null; decisionReason: string | null; decidedAt: string | null } | null;
  dates: { requestedAt: string; acceptedAt: string | null; pickedUpAt: string | null; deliveredAt: string | null; disputedAt: string | null; completedAt: string | null; completedBy: string | null; closedAt: string | null; closedBy: string | null };
  timeline: MoneyTimelineEvent[];
  adminActions: Array<{ id: string; at: string; admin: string; action: string; after: unknown }>;
  manualRefund: { maxRefundableCents: number; proposal: { amountCents: number; reason: string; byAdmin: string; at: string } | null; last: { amountCents: number; reason: string; byAdmin: string; at: string } | null };
  allowedActions: { retryPayout: boolean; resolveReversal: boolean; reconcile: boolean; proposeRefund: boolean; applyRefund: boolean };
};
export type FinanceReportMonth = { month: string; currencyCode: string; capturedCents: number; capturedCount: number; refundedCents: number; refundCount: number; paidOutCents: number; payoutCount: number; revenueCents: number; completedCount: number; retentionCents: number; cancelledCount: number };
export type FinanceSnapshot = { currencyCode: string; pendingPayoutCents: number; frozenPayoutCents: number; reversedOpenCents: number; heldRetentionCents: number; proposedRefundCents: number };
export type FinanceReport = { from: string; to: string; generatedAt: string; months: FinanceReportMonth[]; snapshot: FinanceSnapshot[] };
export type PaymentReconciliation = {
  provider: string; checkedAt: string;
  live: { intentStatus: string; amountCents: number; amountReceivedCents: number; chargeId: string | null; refunds: Array<{ id: string; amountCents: number; status: string; createdAt: string | null }>; transfer: { id: string; amountCents: number; reversedCents: number; createdAt: string | null } | null } | null;
  divergences: Array<{ code: string; message: string; dbCents: number | null; liveCents: number | null }>;
};

/* ── C-PR6a (D59) — pilotage ── */
export type PilotageFinancePoint = { currencyCode: string; capturedCents: number; refundedCents: number; paidOutCents: number; revenueCents: number; retentionCents: number };
export type PilotageSeriesPoint = { period: string; periodStart: string; signups: number; tripsPublished: number; requests: number; accepted: number; delivered: number; completed: number; cancelled: number; disputes: number; volume: Array<{ currencyCode: string; capturedCents: number }>; finance: PilotageFinancePoint[] };
export type PilotageMetric = "signups" | "tripsPublished" | "requests" | "accepted" | "delivered" | "completed" | "cancelled" | "disputes" | "captured" | "refunded" | "paidOut" | "revenue" | "retention";
export type PilotageDrilldownItem = { kind: "USER" | "TRIP" | "DEAL"; id: string; label: string; at: string; status: string | null; amountCents: number | null; currencyCode: string | null };
export type PilotageDrilldownResponse = { metric: PilotageMetric; granularity: "week" | "month"; period: string; periodStart: string; periodEnd: string; items: PilotageDrilldownItem[]; total: number; truncated: boolean };
export type PilotageSeriesResponse = { granularity: "week" | "month"; from: string; to: string; points: PilotageSeriesPoint[]; totals: { users: number; carriersReady: number; tripsPublishedOpen: number }; generatedAt: string; cached: boolean };
export type CorridorStat = { key: string; originCity: string; originCountryCode: string | null; destinationCity: string; destinationCountryCode: string | null; tripsPublished: number; requests: number; accepted: number; acceptanceRatePct: number | null; avgPricePerKgCents: number | null; currencyCode: string | null; disputes: number; views: number; searches: number; searchesNoResult: number };
export type CorridorsResponse = { periodDays: number; from: string; items: CorridorStat[]; generatedAt: string; cached: boolean };
export type DealHistoryEvent = { at: string; source: "OUTBOX" | "ADMIN" | "NOTIFICATION" | "EMAIL"; type: string; actor: string | null; recipient: string | null; summary: Record<string, unknown>; relay: { publishedAt: string | null; attempts: number; parked: boolean; lastError: string | null } | null; status: string | null };
export type DealHistoryResponse = { bookingId: string; events: DealHistoryEvent[]; counts: { outbox: number; admin: number; notifications: number; emails: number; parked: number }; generatedAt: string };

/* ── C-PR6b (D59) — alertes de seuil ── */
export type OpsAlert = { rule: string; severity: "warning" | "critical"; title: string; detail: string; count: number | null; href: string };
export type OpsAlertsResponse = { alerts: OpsAlert[]; evaluatedAt: string; thresholds: Record<string, number> };

/* ── F-PR3 (D61 7A) — conversations et messages signalés ── */
export type MessageReportReason = "OFF_PLATFORM" | "SCAM" | "HARASSMENT" | "OTHER";
export type MessageReportStatus = "OPEN" | "REVIEWED" | "DISMISSED";
export type AdminChatMeetup = {
  id: string; kind: "PICKUP" | "DELIVERY"; status: "PROPOSED" | "ACCEPTED" | "CANCELLED"; proposedByRole: "SHIPPER" | "CARRIER";
  placeLabel: string; placeDetails: string | null; startAt: string; endAt: string; acceptedAt: string | null; cancelledAt: string | null; createdAt: string;
};
export type AdminChatMessage = {
  id: string; kind: "TEXT" | "SYSTEM" | "MEETUP"; authorRole: "SHIPPER" | "CARRIER" | "SYSTEM"; authorId: string | null; body: string; photoUrls: string[];
  systemKey: string | null; systemData: Record<string, unknown> | null; flaggedContact: boolean; createdAt: string;
  reports: { id: string; reason: MessageReportReason; details: string | null; status: MessageReportStatus; reporterRole: "SHIPPER" | "CARRIER"; createdAt: string }[];
};
export type AdminConversation = {
  conversationId: string; bookingId: string; bookingStatus: string;
  corridor: { originCity: string; destinationCity: string; departureAt: string | null };
  shipper: { id: string; firstName: string; lastName: string };
  carrier: { id: string; firstName: string; lastName: string };
  messages: AdminChatMessage[]; meetups: AdminChatMeetup[];
  phoneReveals: { revealedToRole: "SHIPPER" | "CARRIER"; revealedAt: string }[];
  lastMessageAt: string | null;
};
export type AdminMessageReportItem = {
  id: string; status: MessageReportStatus; reason: MessageReportReason; details: string | null; createdAt: string;
  reporter: { id: string; firstName: string; role: "SHIPPER" | "CARRIER" };
  author: { id: string | null; firstName: string; role: "SHIPPER" | "CARRIER" | "SYSTEM" };
  message: { id: string; body: string; createdAt: string };
  conversationId: string; bookingId: string; corridor: { originCity: string; destinationCity: string };
};
export type AdminMessageReportsResponse = { items: AdminMessageReportItem[]; total: number };

/* ── C-PR8a (D62) — paramètres de la plateforme ── */
export type SettingScope = "BUSINESS" | "OPERATIONS";
export type SettingUnit = "percent" | "cents" | "kg" | "coef" | "hours" | "days" | "minutes" | "count" | "rating" | "mb";
export type SettingGroup = "pricing" | "protection" | "cancellation" | "rating" | "dispute" | "reputation" | "messaging" | "alerts" | "documents" | "privacy" | "retention";
export type SettingDefinition = {
  key: string; group: SettingGroup; label: string; description: string; rule: string; unit: SettingUnit;
  default: number; min: number; max: number; step: number; scope: SettingScope; contractual?: boolean; consumers: string[]; example?: string;
};
export type AdminSettingsResponse = {
  values: Record<string, number>; defaults: Record<string, number>; version: number;
  updatedAt: string | null; updatedBy: { id: string; firstName: string; lastName: string } | null;
  lastChange: { at: string; byName: string; keys: string[] } | null;
  catalog: SettingDefinition[];
  fixed: { key: string; label: string; value: string; rule: string }[];
  planned: { key: string; rule: string }[];
};
export type SettingsWriteResponse = { version: number; changed: { key: string; before: number; after: number }[] };
export type SettingsHistoryItem = { id: string; at: string; admin: string; action: string; key: string | null; before: number | null; after: number | null; reason: string | null; version: number | null };

/* ── C-PR8b (D63) — données personnelles ── */
export type ErasureBlocker = "ACTIVE_DEAL" | "PENDING_REQUEST" | "PAYOUT_PENDING" | "RETENTION_HELD" | "PUBLISHED_TRIP" | "ADMIN_ACCOUNT";
export type DataRequestItem = {
  id: string; userId: string; userLabel: string; type: "EXPORT" | "ERASURE"; channel: "MEMBER" | "ADMIN"; status: "DONE" | "REFUSED";
  refusalReasons: string[]; requestedByAdmin: string | null; reason: string | null; requestedAt: string; completedAt: string | null;
};
export type DataRequestsResponse = { items: DataRequestItem[]; nextCursor: string | null };

/* ── C-PR8c (D64) — maintenance et état des services ── */
export type MaintenanceState = { enabled: boolean; messageFr: string; messageEn: string; scheduledAt: string | null; updatedAt: string | null; updatedBy: string | null; version: number; envOverride?: boolean };
export type HealthCheck = { ok: boolean; ms: number; error: string | null };
export type HealthReport = { status: "ok" | "degraded"; service: string; version: string; uptimeSeconds: number; checks: Record<string, HealthCheck>; at: string };
export type ServiceStatus = { name: string; url: string; reachable: boolean; ms: number; report: HealthReport | null; error: string | null };
export type CronRun = { service: string; name: string; ranAt: string; durationMs: number; ok: boolean; summary: string | null; error: string | null; schedule: string | null };
export type AdminStatusResponse = {
  at: string; services: ServiceStatus[]; crons: CronRun[];
  outbox: { unpublished: number; oldestUnpublishedAt: string | null; parked: number; parkedThreshold: number };
  emails: { failedLast24h: number; sentLast24h: number };
  maintenance: MaintenanceState;
};
export type PublicMaintenance = { enabled: boolean; message: { fr: string; en: string }; scheduledAt: string | null };

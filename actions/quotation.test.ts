import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  quotationFindUnique: vi.fn(),
  quotationCreate: vi.fn(),
  quotationUpdate: vi.fn(),
  quotationDelete: vi.fn(),
  approvalRecordFindUnique: vi.fn(),
  approvalRecordCreate: vi.fn(),
  approvalRecordUpdate: vi.fn(),
  approvalRecordStepCreate: vi.fn(),
  approvalRecordStepUpdateMany: vi.fn(),
  packageFindUnique: vi.fn(),
  venueFindUnique: vi.fn(),
  eventTypeFindUnique: vi.fn(),
  paymentMethodFindUnique: vi.fn(),
  childDeleteMany: vi.fn(),
  childCreate: vi.fn(),
  customerCreate: vi.fn(),
  bookingFindFirst: vi.fn(),
  bookingCreate: vi.fn(),
  snapCustomerCreate: vi.fn(),
  snapVenueCreate: vi.fn(),
  snapPackageCreate: vi.fn(),
  snapPackagePricingCreate: vi.fn(),
  snapPackageInternalItemCreate: vi.fn(),
  snapComplimentaryCreate: vi.fn(),
  snapBookingBonusCreate: vi.fn(),
  termOfPaymentCreate: vi.fn(),
  clientAgreementCreate: vi.fn(),
  activityLogCreate: vi.fn(),
  transaction: vi.fn(),
  requirePermission: vi.fn(),
  resolveApprovalSteps: vi.fn(),
  buildBookingApprovalSteps: vi.fn(),
  resolveManagerId: vi.fn(),
  getNextSequence: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => new Map<string, string>() as unknown as Headers,
}));
vi.mock("@/lib/db", () => ({
  db: {
    quotation: {
      findUnique: mocks.quotationFindUnique,
      create: mocks.quotationCreate,
      update: mocks.quotationUpdate,
      delete: mocks.quotationDelete,
    },
    approvalRecord: {
      findUnique: mocks.approvalRecordFindUnique,
      create: mocks.approvalRecordCreate,
      update: mocks.approvalRecordUpdate,
    },
    approvalRecordStep: {
      create: mocks.approvalRecordStepCreate,
      updateMany: mocks.approvalRecordStepUpdateMany,
    },
    package: { findUnique: mocks.packageFindUnique },
    venue: { findUnique: mocks.venueFindUnique },
    eventType: { findUnique: mocks.eventTypeFindUnique },
    paymentMethod: { findUnique: mocks.paymentMethodFindUnique },
    quotationItem: { deleteMany: mocks.childDeleteMany, create: mocks.childCreate },
    quotationPrice: { deleteMany: mocks.childDeleteMany, create: mocks.childCreate },
    quotationTaxDeposit: { deleteMany: mocks.childDeleteMany, create: mocks.childCreate },
    quotationTerm: { deleteMany: mocks.childDeleteMany, create: mocks.childCreate },
    quotationComplimentary: { deleteMany: mocks.childDeleteMany, create: mocks.childCreate },
    quotationBonus: { deleteMany: mocks.childDeleteMany, create: mocks.childCreate },
    snapQuotationPackage: { deleteMany: mocks.childDeleteMany, create: mocks.childCreate },
    snapQuotationPackageItem: { create: mocks.childCreate },
    snapQuotationPackagePrice: { create: mocks.childCreate },
    snapQuotationPackageTaxDeposit: { create: mocks.childCreate },
    snapQuotationPackageComplimentary: { create: mocks.childCreate },
    snapQuotationPackageBonus: { create: mocks.childCreate },
    customer: { create: mocks.customerCreate },
    booking: { findFirst: mocks.bookingFindFirst, create: mocks.bookingCreate },
    snapCustomer: { create: mocks.snapCustomerCreate },
    snapVenue: { create: mocks.snapVenueCreate },
    snapPackage: { create: mocks.snapPackageCreate },
    snapPackagePricing: { create: mocks.snapPackagePricingCreate },
    snapPackageInternalItem: { create: mocks.snapPackageInternalItemCreate },
    snapComplimentary: { create: mocks.snapComplimentaryCreate },
    snapBookingBonus: { create: mocks.snapBookingBonusCreate },
    termOfPayment: { create: mocks.termOfPaymentCreate },
    clientAgreement: { create: mocks.clientAgreementCreate },
    activityLog: { create: mocks.activityLogCreate },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/permissions", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/rate-limit", () => ({
  mutationLimiter: { check: () => true },
  rateLimitError: () => ({ error: "Rate limited" }),
}));
vi.mock("@/lib/counter", () => ({ getNextSequence: mocks.getNextSequence }));
vi.mock("@/lib/approval-flows", () => ({
  resolveApprovalSteps: mocks.resolveApprovalSteps,
  buildBookingApprovalSteps: mocks.buildBookingApprovalSteps,
}));
vi.mock("@/lib/resolve-manager", () => ({ resolveManagerId: mocks.resolveManagerId }));
vi.mock("@/lib/access-code", () => ({ generateAccessCode: () => "ABC123" }));

import {
  convertQuotationToMiceBooking,
  deleteQuotation,
  duplicateQuotationAsRevision,
  updateQuotation,
} from "@/actions/quotation";

const approvedQuotation = {
  id: "quotation-1",
  quotationNo: "#001-MICE",
  clientName: "PT Nusantara",
  clientPhone: "08123456789",
  instansi: "PT Nusantara",
  salesId: "sales-1",
  venueId: "venue-1",
  eventTypeId: "event-type-1",
  paymentMethodId: "payment-1",
  packageId: "package-1",
  packageName: "Meeting Package",
  pax: 100,
  eventDate: new Date("2026-05-01T00:00:00.000Z"),
  time: "08:00 - 16:00",
  notes: "Catatan",
  details: "Venue only",
  subtotal: 10_000_000,
  discount: 500_000,
  discountName: "Diskon",
  totalPrice: 9_500_000,
  termAndCondition: "Term",
  signatureSales: "data:image/png;base64,xxx",
  signingLocation: "Bandung",
  booking: null,
  venue: { id: "venue-1", name: "Ballroom", code: "BLR", address: "Jl. Mawar", description: null, brand: { name: "Swasana", code: "SWS" } },
  eventType: { code: "M8", name: "Meeting 8 Jam" },
  terms: [{ name: "Booking Fee", amount: 5_000_000, dueDate: new Date("2026-04-01T00:00:00.000Z"), sortOrder: 0 }],
  items: [{ type: "ITEM", title: "Ruang meeting", description: "<p>Full day</p>", qty: 1, price: 10_000_000, total: 10_000_000, manualTotal: false, sortOrder: 0 }],
  prices: [],
  taxDeposits: [],
  complimentaries: [{ complimentaryId: "comp-1", name: "Coffee break", price: 50_000, isShowPrice: true, description: null, qty: 10, sortOrder: 0 }],
  bonuses: [{ bonusId: "bonus-1", name: "Screen", price: 100_000, description: null, qty: 1, sortOrder: 0 }],
};

function findTransactionOps(): unknown[] {
  expect(mocks.transaction).toHaveBeenCalledTimes(1);
  return mocks.transaction.mock.calls[0][0] as unknown[];
}

describe("quotation lifecycle guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({
      session: { user: { id: "user-1", profileId: "profile-1", roleId: "role-1", name: "Sales", email: "sales@swasana.test" } },
      error: null,
    });
    mocks.transaction.mockResolvedValue([]);
    mocks.getNextSequence.mockResolvedValue(7);
    mocks.resolveManagerId.mockResolvedValue("manager-1");
    mocks.resolveApprovalSteps.mockResolvedValue([
      { sortOrder: 1, approverType: "role", approverRoleId: "role-manager", roleName: "manager" },
    ]);
    mocks.buildBookingApprovalSteps.mockResolvedValue([
      { stepOrder: 1, approverType: "role", approverRoleId: "role-manager", approverUserId: null, status: "pending", decidedById: null, decidedAt: null, signature: null },
    ]);
    mocks.packageFindUnique.mockResolvedValue({ id: "package-1" });
    mocks.venueFindUnique.mockResolvedValue({ id: "venue-1", name: "Ballroom", code: "BLR", address: "Jl. Mawar", description: null, brand: { name: "Swasana", code: "SWS" } });
    mocks.eventTypeFindUnique.mockResolvedValue({ id: "event-type-1", code: "M8" });
    mocks.paymentMethodFindUnique.mockResolvedValue({ bankName: "BCA", bankAccountNumber: "8692428519", bankRecipient: "CV Cita Tenun Bangsa" });
    mocks.bookingFindFirst.mockResolvedValue(null);

    for (const createMock of [
      mocks.customerCreate,
      mocks.bookingCreate,
      mocks.snapCustomerCreate,
      mocks.snapVenueCreate,
      mocks.snapPackageCreate,
      mocks.snapPackagePricingCreate,
      mocks.snapPackageInternalItemCreate,
      mocks.snapComplimentaryCreate,
      mocks.snapBookingBonusCreate,
      mocks.termOfPaymentCreate,
      mocks.clientAgreementCreate,
      mocks.activityLogCreate,
      mocks.approvalRecordCreate,
      mocks.approvalRecordStepCreate,
      mocks.quotationCreate,
      mocks.quotationDelete,
      mocks.quotationUpdate,
      mocks.childDeleteMany,
      mocks.childCreate,
    ]) {
      createMock.mockReturnValue(Promise.resolve({}));
    }
  });

  it("freezes bank details onto the quotation instead of joining PaymentMethod", async () => {
    mocks.quotationFindUnique.mockResolvedValue({ id: "quotation-1", booking: null });
    mocks.approvalRecordFindUnique.mockResolvedValue({ id: "approval-1", status: "pending" });

    const result = await updateQuotation({ id: "quotation-1", paymentMethodId: "payment-1" });

    expect(result.success).toBe(true);
    expect(mocks.quotationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentMethodId: "payment-1",
          bankName: "BCA",
          bankAccountNumber: "8692428519",
          bankRecipient: "CV Cita Tenun Bangsa",
        }),
      }),
    );
  });

  it("edits an unconverted quotation without reading or resetting approval", async () => {
    mocks.quotationFindUnique.mockResolvedValue({ id: "quotation-1", booking: null });

    const result = await updateQuotation({ id: "quotation-1", clientName: "Ubah" });

    expect(result.success).toBe(true);
    expect(mocks.approvalRecordFindUnique).not.toHaveBeenCalled();
    expect(mocks.approvalRecordUpdate).not.toHaveBeenCalled();
    expect(mocks.approvalRecordStepUpdateMany).not.toHaveBeenCalled();
    expect(mocks.activityLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "quotation.updated" }),
    });
    findTransactionOps();
  });

  it("refuses to delete a quotation that already produced a booking", async () => {
    mocks.quotationFindUnique.mockResolvedValue({ id: "quotation-1", quotationNo: "#001-MICE", booking: { id: "booking-1" } });
    mocks.approvalRecordFindUnique.mockResolvedValue({ status: "pending" });

    const result = await deleteQuotation("quotation-1");

    expect(result).toEqual({ success: false, error: "Quotation yang sudah dikonversi tidak dapat dihapus." });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("creates a revision without an approval prerequisite", async () => {
    mocks.quotationFindUnique.mockResolvedValue({ ...approvedQuotation, packageSnapshot: null });

    const result = await duplicateQuotationAsRevision("quotation-1");

    expect(result.success).toBe(true);
    expect(mocks.approvalRecordFindUnique).not.toHaveBeenCalled();
    expect(mocks.approvalRecordCreate).not.toHaveBeenCalled();
    findTransactionOps();
  });
});

describe("convertQuotationToMiceBooking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({
      session: { user: { id: "user-1", profileId: "profile-1", roleId: "role-1", name: "Sales", email: "sales@swasana.test" } },
      error: null,
    });
    mocks.transaction.mockResolvedValue([]);
    mocks.getNextSequence.mockResolvedValue(7);
    mocks.resolveManagerId.mockResolvedValue("manager-1");
    mocks.packageFindUnique.mockResolvedValue({ id: "package-1" });
    mocks.venueFindUnique.mockResolvedValue({ id: "venue-1", name: "Ballroom", code: "BLR", address: "Jl. Mawar", description: null, brand: { name: "Swasana", code: "SWS" } });
    mocks.eventTypeFindUnique.mockResolvedValue({ id: "event-type-1", code: "M8" });
    mocks.paymentMethodFindUnique.mockResolvedValue({ bankName: "BCA", bankAccountNumber: "8692428519", bankRecipient: "CV Cita Tenun Bangsa" });
    mocks.bookingFindFirst.mockResolvedValue(null);
    mocks.buildBookingApprovalSteps.mockResolvedValue([
      { stepOrder: 1, approverType: "role", approverRoleId: "role-manager", approverUserId: null, status: "pending", decidedById: null, decidedAt: null, signature: null },
    ]);

    for (const createMock of [
      mocks.customerCreate,
      mocks.bookingCreate,
      mocks.snapCustomerCreate,
      mocks.snapVenueCreate,
      mocks.snapPackageCreate,
      mocks.snapPackagePricingCreate,
      mocks.snapPackageInternalItemCreate,
      mocks.snapComplimentaryCreate,
      mocks.snapBookingBonusCreate,
      mocks.termOfPaymentCreate,
      mocks.clientAgreementCreate,
      mocks.activityLogCreate,
      mocks.approvalRecordCreate,
      mocks.approvalRecordStepCreate,
    ]) {
      createMock.mockReturnValue(Promise.resolve({}));
    }
  });

  it("converts without reading a quotation approval record", async () => {
    mocks.quotationFindUnique.mockResolvedValue(approvedQuotation);

    const result = await convertQuotationToMiceBooking("quotation-1");

    expect(result.success).toBe(true);
    expect(mocks.approvalRecordFindUnique).not.toHaveBeenCalled();
  });

  it("rejects a second conversion of the same quotation", async () => {
    mocks.quotationFindUnique.mockResolvedValue({ ...approvedQuotation, booking: { id: "booking-1" } });
    mocks.approvalRecordFindUnique.mockResolvedValue({ status: "approved" });

    const result = await convertQuotationToMiceBooking("quotation-1");

    expect(result).toEqual({ success: false, error: "Quotation ini sudah dikonversi menjadi booking." });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects conversion when a TOP has no positive amount or due date", async () => {
    mocks.quotationFindUnique.mockResolvedValue({
      ...approvedQuotation,
      terms: [{ name: "Down Payment", amount: 0, dueDate: null, sortOrder: 0 }],
    });
    mocks.approvalRecordFindUnique.mockResolvedValue({ status: "approved" });

    const result = await convertQuotationToMiceBooking("quotation-1");

    expect(result).toEqual({
      success: false,
      error: "Semua TOP wajib memiliki nominal dan tanggal jatuh tempo sebelum konversi.",
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("creates the booking, snapshots and audit trail in a single transaction", async () => {
    mocks.quotationFindUnique.mockResolvedValue(approvedQuotation);
    mocks.approvalRecordFindUnique.mockResolvedValue({ status: "approved" });

    const result = await convertQuotationToMiceBooking("quotation-1");

    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.error);

    const bookingId = result.data.id;
    expect(mocks.bookingCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: bookingId,
        category: "MICE",
        recordStatus: "saved",
        bookingStatus: "Pending",
        quotationId: "quotation-1",
        packageId: "package-1",
        salesId: "sales-1",
        managerId: "manager-1",
        venueId: "venue-1",
        poSeq: 7,
        poNumber: expect.stringContaining("007/SWS/BLR/M8/"),
      }),
    });

    // Commercial snapshots follow the approved document, not the live package.
    expect(mocks.snapPackagePricingCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ bookingId, price: 9_500_000, fullPrice: 10_000_000, pax: 100 }),
    });
    expect(mocks.termOfPaymentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ bookingId, name: "Booking Fee", amount: 5_000_000 }),
    });
    expect(mocks.snapComplimentaryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ bookingId, name: "Coffee break" }),
    });
    expect(mocks.snapBookingBonusCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ bookingId, name: "Screen" }),
    });
    expect(mocks.approvalRecordCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ module: "booking-mice", entityId: bookingId, status: "pending" }),
    });
    expect(mocks.activityLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "quotation.converted_to_booking_mice",
        entityType: "quotation",
        entityId: "quotation-1",
      }),
    });

    // Everything above must be committed atomically.
    expect(findTransactionOps().length).toBeGreaterThan(0);
  });

  it("still converts after the quotation's package was deleted from the master catalogue", async () => {
    // The whole point of the FK-less design: master data can disappear without
    // invalidating an issued document. Venue/eventType are resolved separately
    // because the resulting *booking* is a live record and needs real FKs.
    mocks.quotationFindUnique.mockResolvedValue(approvedQuotation);
    mocks.approvalRecordFindUnique.mockResolvedValue({ status: "approved" });
    mocks.packageFindUnique.mockResolvedValue(null);

    const result = await convertQuotationToMiceBooking("quotation-1");

    expect(result.success).toBe(true);
    expect(mocks.snapVenueCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ venueName: "Ballroom", brandCode: "SWS" }),
    });
  });

  it("refuses to convert when the quotation's venue no longer exists", async () => {
    mocks.quotationFindUnique.mockResolvedValue(approvedQuotation);
    mocks.approvalRecordFindUnique.mockResolvedValue({ status: "approved" });
    mocks.venueFindUnique.mockResolvedValue(null);

    const result = await convertQuotationToMiceBooking("quotation-1");

    expect(result).toEqual({
      success: false,
      error: "Venue atau tipe event pada quotation sudah tidak tersedia.",
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("does not reference a package that no longer exists", async () => {
    mocks.quotationFindUnique.mockResolvedValue(approvedQuotation);
    mocks.approvalRecordFindUnique.mockResolvedValue({ status: "approved" });
    mocks.packageFindUnique.mockResolvedValue(null);

    const result = await convertQuotationToMiceBooking("quotation-1");

    expect(result.success).toBe(true);
    expect(mocks.bookingCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ packageId: null }),
    });
    expect(mocks.snapPackageCreate).not.toHaveBeenCalled();
  });
});

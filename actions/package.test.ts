import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  packageFindUnique: vi.fn(),
  packageCreate: vi.fn(),
  categoryFindMany: vi.fn(),
  packageCategoryPriceCreate: vi.fn(),
  packageVendorItemCreate: vi.fn(),
  packageInternalItemCreate: vi.fn(),
  packageMiceItemCreate: vi.fn(),
  packageMicePriceCreate: vi.fn(),
  packageMiceTaxDepositCreate: vi.fn(),
  packageComplimentaryCreate: vi.fn(),
  packageBonusCreate: vi.fn(),
  transaction: vi.fn(),
  requirePermission: vi.fn(),
  logAudit: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidateTag: mocks.revalidateTag }));
vi.mock("@/lib/db", () => ({
  db: {
    package: { findUnique: mocks.packageFindUnique, create: mocks.packageCreate },
    category: { findMany: mocks.categoryFindMany },
    packageCategoryPrice: { create: mocks.packageCategoryPriceCreate },
    packageVendorItem: { create: mocks.packageVendorItemCreate },
    packageInternalItem: { create: mocks.packageInternalItemCreate },
    packageMiceItem: { create: mocks.packageMiceItemCreate },
    packageMicePrice: { create: mocks.packageMicePriceCreate },
    packageMiceTaxDeposit: { create: mocks.packageMiceTaxDepositCreate },
    packageComplimentary: { create: mocks.packageComplimentaryCreate },
    packageBonus: { create: mocks.packageBonusCreate },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/permissions", () => ({
  requirePermission: mocks.requirePermission,
  hasPermission: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({
  mutationLimiter: { check: () => true },
  rateLimitError: () => ({ error: "Rate limited" }),
}));
vi.mock("@/lib/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("@/lib/approval-flows", () => ({ resolveApprovalSteps: vi.fn() }));
vi.mock("@/lib/notifications", () => ({ createNotifications: vi.fn() }));

import { duplicatePackage } from "@/actions/package";

const sourcePackage = {
  packageName: "Meeting Package",
  category: "MICE" as const,
  venueId: "venue-1",
  packageTypeCategoryId: null,
  eventTypeId: "event-type-1",
  paymentMethodId: "payment-1",
  notes: "Package notes",
  pax: 100,
  margin: 0,
  sellingPrice: 0,
  termAndCondition: "Terms",
  cancellationRefundPolicy: "Cancellation policy",
  closingNote: "Closing note",
  categoryPrices: [{ categoryId: "category-1", categoryName: "Venue", basePrice: 100, sortOrder: 0, isShow: true }],
  vendorItems: [{ categoryId: "category-1", categoryName: "Venue", itemText: "Vendor item", sortOrder: 0 }],
  internalItems: [{ itemName: "Internal item", itemDescription: "Internal description", sortOrder: 0 }],
  miceItems: [{ itemName: "Projector", itemDescription: "Full HD", sortOrder: 0 }],
  micePrices: [{ name: "Meeting room", description: "Eight hours", priceType: "QTY" as const, qty: 1, price: 1_000_000, total: 1_000_000, sortOrder: 0 }],
  taxDeposits: [{ name: "Tax", nominal: 100_000, sortOrder: 0 }],
  complimentaries: [{ complimentaryId: "complimentary-1", name: "Coffee break", price: 50_000, isShowPrice: true, description: "One serving", qty: 10, sortOrder: 0 }],
  bonuses: [{ bonusId: "bonus-1", name: "Free screen", price: 200_000, description: "Main hall", qty: 1, sortOrder: 0 }],
};

describe("duplicatePackage — MICE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.packageFindUnique.mockResolvedValue(sourcePackage);
    mocks.categoryFindMany.mockResolvedValue([{ id: "category-1" }]);
    mocks.requirePermission.mockResolvedValue({
      session: {
        user: {
          id: "user-1",
          profileId: "profile-1",
          roleId: "role-1",
          isSuperAdmin: false,
        },
      },
      error: null,
    });
    mocks.transaction.mockResolvedValue([]);
    mocks.logAudit.mockResolvedValue(undefined);

    for (const createMock of [
      mocks.packageCreate,
      mocks.packageCategoryPriceCreate,
      mocks.packageVendorItemCreate,
      mocks.packageInternalItemCreate,
      mocks.packageMiceItemCreate,
      mocks.packageMicePriceCreate,
      mocks.packageMiceTaxDepositCreate,
      mocks.packageComplimentaryCreate,
      mocks.packageBonusCreate,
    ]) {
      createMock.mockReturnValue(Promise.resolve({}));
    }
  });

  it("copies the complete MICE package graph and keeps the duplicate unavailable", async () => {
    const result = await duplicatePackage("package-1");

    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.error);

    const packageId = result.data.id;
    expect(mocks.packageCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: packageId,
        packageName: "Meeting Package (Copy)",
        category: "MICE",
        eventTypeId: "event-type-1",
        paymentMethodId: "payment-1",
        termAndCondition: "Terms",
        cancellationRefundPolicy: "Cancellation policy",
        closingNote: "Closing note",
        approvalStatus: "approved",
        available: false,
      }),
    });

    expect(mocks.packageMiceItemCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ packageId, itemName: "Projector", itemDescription: "Full HD" }),
    });
    expect(mocks.packageMicePriceCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ packageId, name: "Meeting room", total: 1_000_000 }),
    });
    expect(mocks.packageMiceTaxDepositCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ packageId, name: "Tax", nominal: 100_000 }),
    });
    expect(mocks.packageComplimentaryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ packageId, complimentaryId: "complimentary-1", name: "Coffee break" }),
    });
    expect(mocks.packageBonusCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ packageId, bonusId: "bonus-1", name: "Free screen" }),
    });
    expect(mocks.transaction).toHaveBeenCalledWith(expect.arrayContaining([expect.any(Promise)]));
    expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "packages.duplicate",
      entityType: "package-mice",
      entityId: packageId,
    }));
  });
});

"use server";

import { revalidateTag } from "next/cache";
import { notifySuperAdmins } from "@/lib/notifications";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { bookingSchema, updateBookingSchema, editBookingSchema, approveBookingSchema } from "@/lib/validations/booking";

export async function createBooking(data: unknown) {
  const { session, error } = await requirePermission({ module: "booking", action: "create" });
  if (error) return { success: false, error };

  const parsed = bookingSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const input = parsed.data;

  let newCustomerId: string | null = null;

  try {
    let customerId = input.customerId;

    // Create or update customer
    if (!customerId && input.customerName) {
      const c = await db.customer.create({
        data: {
          name: input.customerName,
          mobileNumber: input.contactNumbers || "-",
          email: input.contactEmail || "-@placeholder.com",
          nikNumber: input.contactNik || null,
          ktpAddress: input.contactKtpAddress || null,
          type: "Other",
          memberStatus: "Non-Member",
          updatedBy: session!.user.name ?? session!.user.email,
        },
      });
      customerId = c.id;
      newCustomerId = c.id;
    } else if (customerId) {
      const existing = await db.customer.findUnique({ where: { id: customerId }, select: { id: true } });
      if (!existing) return { success: false, error: "Customer tidak ditemukan." };

      const updates: Record<string, unknown> = {};
      if (input.contactNumbers) updates.mobileNumber = input.contactNumbers;
      if (input.contactEmail) updates.email = input.contactEmail;
      if (input.contactNik) updates.nikNumber = input.contactNik;
      if (input.contactKtpAddress) updates.ktpAddress = input.contactKtpAddress;
      if (Object.keys(updates).length > 0) {
        updates.updatedBy = session!.user.name ?? session!.user.email;
        await db.customer.update({ where: { id: customerId }, data: updates });
      }
    }

    if (!customerId) return { success: false, error: "Customer wajib diisi." };

    const [customer, venue, pkg, variant] = await Promise.all([
      db.customer.findUniqueOrThrow({ where: { id: customerId } }),
      db.venue.findUniqueOrThrow({ where: { id: input.venueId }, include: { brand: true } }),
      db.package.findUniqueOrThrow({ where: { id: input.packageId } }),
      input.packageVariantId
        ? db.packageVariant.findUniqueOrThrow({
            where: { id: input.packageVariantId },
            include: { vendorItems: true, internalItems: true },
          })
        : null,
    ]);

    const bookingId = crypto.randomUUID();

    // Generate PO Number: {count}/{brandCode}/{venueCode}/W/{dd-mm-yy}
    const bookingCount = await db.booking.count();
    const now = new Date();
    const dd = now.getDate().toString().padStart(2, "0");
    const mm = (now.getMonth() + 1).toString().padStart(2, "0");
    const yy = now.getFullYear().toString().slice(-2);
    const poNumber = `${(bookingCount + 1).toString().padStart(3, "0")}/${venue.brand?.code ?? ""}/${venue.code}/W/${dd}-${mm}-${yy}`;

    // Build array-form transaction (Neon HTTP compatible)
    const ops: Promise<unknown>[] = [
      db.booking.create({
        data: {
          id: bookingId,
          bookingDate: new Date(input.bookingDate),
          salesId: session!.user.profileId!,
          customerId,
          venueId: input.venueId,
          packageId: input.packageId,
          packageVariantId: input.packageVariantId ?? null,
          paymentMethodId: input.paymentMethodId ?? null,
          sourceOfInformationId: input.sourceOfInformationId ?? null,
          weddingSession: input.weddingSession ?? null,
          weddingType: input.weddingType ?? null,
          signingLocation: input.signingLocation ?? null,
          poNumber,
          signatures: input.signatureSales
            ? { sales: { signature: input.signatureSales, signedAt: new Date().toISOString() } }
            : undefined,
        },
      }),
      db.snapCustomer.create({
        data: {
          bookingId,
          customerId: customer.id,
          name: customer.name,
          email: customer.email,
          mobileNumber: customer.mobileNumber,
          nikNumber: customer.nikNumber,
          ktpAddress: customer.ktpAddress,
        },
      }),
      db.snapVenue.create({
        data: {
          bookingId,
          venueId: venue.id,
          venueName: venue.name,
          address: venue.address,
          description: venue.description,
          brandName: venue.brand?.name ?? null,
          brandCode: venue.brand?.code ?? null,
        },
      }),
      db.snapPackage.create({
        data: {
          bookingId,
          packageId: pkg.id,
          packageName: pkg.packageName,
          notes: pkg.notes,
        },
      }),
    ];

    if (variant) {
      ops.push(
        db.snapPackageVariant.create({
          data: { bookingId, variantId: variant.id, variantName: variant.variantName, pax: variant.pax, price: variant.price },
        })
      );
      if (variant.internalItems.length > 0) {
        ops.push(
          ...variant.internalItems.map((item, i) =>
            db.snapPackageInternalItem.create({ data: { bookingId, itemName: item.itemName, itemDescription: item.itemDescription, sortOrder: i } })
          )
        );
      }
      if (variant.vendorItems.length > 0) {
        ops.push(
          ...variant.vendorItems.map((item, i) =>
            db.snapPackageVendorItem.create({ data: { bookingId, categoryName: item.categoryName, itemText: item.itemText, sortOrder: i } })
          )
        );
      }
    }

    if (input.bonuses && input.bonuses.length > 0) {
      ops.push(
        ...input.bonuses.map((bonus) =>
          db.snapBonus.create({ data: { bookingId, vendorId: bonus.vendorId, vendorCategoryId: bonus.vendorCategoryId, vendorName: bonus.vendorName, description: bonus.description ?? null, qty: bonus.qty } })
        )
      );
    }

    if (input.termOfPayments && input.termOfPayments.length > 0) {
      ops.push(
        ...input.termOfPayments.map((t) =>
          db.termOfPayment.create({ data: { bookingId, name: t.name, amount: BigInt(t.amount), dueDate: new Date(t.dueDate), sortOrder: t.sortOrder } })
        )
      );
    }

    // Neon HTTP adapter does not support $transaction — run sequentially
    // Create booking first (other tables have FK to it)
    await ops[0];
    // Then create all snapshots in parallel
    if (ops.length > 1) await Promise.all(ops.slice(1));

    await logAudit({
      userId: session!.user.id,
      action: "created",
      entityType: "booking",
      entityId: bookingId,
      changes: { customerId, venueId: input.venueId, packageId: input.packageId },
      description: `Created booking for ${customer.name}`,
    });

    revalidateTag("bookings", "max");
    revalidateTag("customers", "max");

    // Notify all super admins about new booking (exclude creator)
    notifySuperAdmins({
      title: "Booking Baru",
      message: `${session!.user.name ?? "User"} membuat booking untuk ${customer.name}.`,
      type: "booking_created",
      entityType: "booking",
      entityId: bookingId,
    }, session!.user.profileId!);

    return { success: true, bookingId };
  } catch (e) {
    // Rollback: delete newly created customer if booking failed
    if (newCustomerId) {
      try { await db.customer.delete({ where: { id: newCustomerId } }); } catch { /* noop */ }
    }
    console.error("[createBooking]", e);
    return { success: false, error: "Gagal membuat booking." };
  }
}

export async function updateBooking(data: unknown) {
  const { session, error } = await requirePermission({ module: "booking", action: "edit" });
  if (error) return { success: false, error };

  const parsed = updateBookingSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { id, ...rest } = parsed.data;

  try {
    const updateData: Record<string, unknown> = {};
    if (rest.bookingDate) updateData.bookingDate = new Date(rest.bookingDate);
    if (rest.bookingStatus !== undefined) updateData.bookingStatus = rest.bookingStatus;
    if (rest.paymentStatus !== undefined) updateData.paymentStatus = rest.paymentStatus;
    if (rest.weddingSession !== undefined) updateData.weddingSession = rest.weddingSession;
    if (rest.weddingType !== undefined) updateData.weddingType = rest.weddingType;
    if (rest.rejectionNotes !== undefined) updateData.rejectionNotes = rest.rejectionNotes;
    if (rest.lostReason !== undefined) updateData.lostReason = rest.lostReason;
    if (rest.paymentMethodId !== undefined) updateData.paymentMethodId = rest.paymentMethodId;
    if (rest.sourceOfInformationId !== undefined) updateData.sourceOfInformationId = rest.sourceOfInformationId;

    await db.booking.update({ where: { id }, data: updateData });

    await logAudit({
      userId: session!.user.id,
      action: "updated",
      entityType: "booking",
      entityId: id,
      changes: rest,
      description: `Updated booking`,
    });

    revalidateTag("bookings", "max");

    return { success: true };
  } catch {
    return { success: false, error: "Gagal memperbarui booking." };
  }
}

export async function deleteBooking(id: string) {
  const { session, error } = await requirePermission({ module: "booking", action: "delete" });
  if (error) return { success: false, error };

  try {
    await db.booking.delete({ where: { id } });

    await logAudit({
      userId: session!.user.id,
      action: "deleted",
      entityType: "booking",
      entityId: id,
      description: "Deleted booking",
    });

    revalidateTag("bookings", "max");
    return { success: true };
  } catch {
    return { success: false, error: "Gagal menghapus booking." };
  }
}

export async function transferBooking(bookingId: string, targetSalesId: string) {
  const { session, error } = await requirePermission({ module: "booking", action: "edit" });
  if (error) return { success: false, error };

  if (!bookingId || !targetSalesId) return { success: false, error: "Parameter tidak valid." };

  try {
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      select: { salesId: true, sales: { select: { fullName: true } } },
    });
    if (!booking) return { success: false, error: "Booking tidak ditemukan." };

    const targetSales = await db.profile.findUnique({
      where: { id: targetSalesId },
      select: { fullName: true },
    });
    if (!targetSales) return { success: false, error: "Sales tujuan tidak ditemukan." };

    await db.booking.update({ where: { id: bookingId }, data: { salesId: targetSalesId } });

    await logAudit({
      userId: session!.user.id,
      action: "updated",
      entityType: "booking",
      entityId: bookingId,
      changes: {
        salesId: { from: booking.salesId, to: targetSalesId },
        fromSales: booking.sales?.fullName ?? "Unknown",
        toSales: targetSales.fullName,
      },
      description: `Transfer booking dari ${booking.sales?.fullName ?? "Unknown"} ke ${targetSales.fullName}`,
    });

    revalidateTag("bookings", "max");
    return { success: true };
  } catch {
    return { success: false, error: "Gagal mentransfer booking." };
  }
}

export async function editBooking(data: unknown) {
  const { session, error } = await requirePermission({ module: "booking", action: "edit" });
  if (error) return { success: false, error };

  const parsed = editBookingSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { id, customerName, contactNumbers, contactEmail, contactNik, contactKtpAddress, ...rest } = parsed.data;

  try {
    const booking = await db.booking.findUnique({
      where: { id },
      select: { customerId: true, venueId: true, packageId: true, packageVariantId: true },
    });
    if (!booking) return { success: false, error: "Booking tidak ditemukan." };

    const venueChanged = rest.venueId !== booking.venueId;
    const packageChanged = rest.packageId !== booking.packageId;
    const variantChanged = rest.packageVariantId !== booking.packageVariantId;

    const ops: Promise<unknown>[] = [
      // Update booking
      db.booking.update({
        where: { id },
        data: {
          bookingDate: new Date(rest.bookingDate),
          venueId: rest.venueId,
          packageId: rest.packageId,
          packageVariantId: rest.packageVariantId ?? null,
          paymentMethodId: rest.paymentMethodId ?? null,
          sourceOfInformationId: rest.sourceOfInformationId ?? null,
          weddingSession: rest.weddingSession ?? null,
          weddingType: rest.weddingType ?? null,
          signingLocation: rest.signingLocation ?? null,
        },
      }),
      // Update customer snapshot
      db.snapCustomer.update({
        where: { bookingId: id },
        data: {
          name: customerName,
          mobileNumber: contactNumbers || "-",
          email: contactEmail || "-@placeholder.com",
          nikNumber: contactNik || null,
          ktpAddress: contactKtpAddress || null,
        },
      }),
      // Update actual customer
      db.customer.update({
        where: { id: booking.customerId },
        data: {
          name: customerName,
          mobileNumber: contactNumbers || "-",
          email: contactEmail || "-@placeholder.com",
          nikNumber: contactNik || null,
          ktpAddress: contactKtpAddress || null,
          updatedBy: session!.user.name ?? session!.user.email,
        },
      }),
    ];

    // Update venue snapshot if venue changed
    if (venueChanged) {
      const venue = await db.venue.findUniqueOrThrow({
        where: { id: rest.venueId },
        include: { brand: true },
      });
      ops.push(
        db.snapVenue.update({
          where: { bookingId: id },
          data: {
            venueId: venue.id,
            venueName: venue.name,
            address: venue.address,
            description: venue.description,
            brandName: venue.brand?.name ?? null,
            brandCode: venue.brand?.code ?? null,
          },
        })
      );
    }

    // Update package + variant snapshots if changed
    if (packageChanged || variantChanged) {
      const pkg = await db.package.findUniqueOrThrow({ where: { id: rest.packageId } });
      ops.push(
        db.snapPackage.update({
          where: { bookingId: id },
          data: { packageId: pkg.id, packageName: pkg.packageName, notes: pkg.notes },
        })
      );

      if (rest.packageVariantId) {
        const variant = await db.packageVariant.findUniqueOrThrow({
          where: { id: rest.packageVariantId },
          include: { vendorItems: true, internalItems: true },
        });

        // Upsert variant snapshot
        ops.push(
          db.snapPackageVariant.upsert({
            where: { bookingId: id },
            create: { bookingId: id, variantId: variant.id, variantName: variant.variantName, pax: variant.pax, price: variant.price },
            update: { variantId: variant.id, variantName: variant.variantName, pax: variant.pax, price: variant.price },
          })
        );

        // Replace internal + vendor items
        ops.push(
          db.snapPackageInternalItem.deleteMany({ where: { bookingId: id } }),
          db.snapPackageVendorItem.deleteMany({ where: { bookingId: id } }),
          ...variant.internalItems.map((item, i) =>
            db.snapPackageInternalItem.create({ data: { bookingId: id, itemName: item.itemName, itemDescription: item.itemDescription, sortOrder: i } })
          ),
          ...variant.vendorItems.map((item, i) =>
            db.snapPackageVendorItem.create({ data: { bookingId: id, categoryName: item.categoryName, itemText: item.itemText, sortOrder: i } })
          )
        );
      } else {
        // No variant — delete variant snapshot if exists
        ops.push(db.snapPackageVariant.deleteMany({ where: { bookingId: id } }));
      }
    }

    await Promise.all(ops);

    await logAudit({
      userId: session!.user.id,
      action: "updated",
      entityType: "booking",
      entityId: id,
      changes: { venueId: rest.venueId, packageId: rest.packageId, bookingDate: rest.bookingDate },
      description: `Edited booking for ${customerName}`,
    });

    revalidateTag("bookings", "max");
    revalidateTag("customers", "max");
    return { success: true };
  } catch {
    return { success: false, error: "Gagal mengupdate booking." };
  }
}

export async function approveBooking(data: unknown) {
  const { session, error } = await requirePermission({ module: "booking", action: "approve" });
  if (error) return { success: false, error };

  const parsed = approveBookingSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { id, signatureManager } = parsed.data;

  try {
    const booking = await db.booking.findUnique({
      where: { id },
      select: { id: true, salesId: true, signatures: true, snapCustomer: { select: { name: true } } },
    });
    if (!booking) return { success: false, error: "Booking tidak ditemukan." };

    const existingSignatures = (booking.signatures as Record<string, unknown>) ?? {};

    await db.booking.update({
      where: { id },
      data: {
        bookingStatus: "Confirmed",
        managerId: session!.user.profileId!,
        signatures: {
          ...existingSignatures,
          manager: {
            name: session!.user.name ?? "",
            role: "manager",
            signature: signatureManager,
            signedAt: new Date().toISOString(),
          },
        },
      },
    });

    await logAudit({
      userId: session!.user.id,
      action: "updated",
      entityType: "booking",
      entityId: id,
      changes: { bookingStatus: "Confirmed", managerId: session!.user.profileId },
      description: `Approved booking for ${booking.snapCustomer?.name ?? id}`,
    });

    revalidateTag("bookings", "max");

    return { success: true };
  } catch {
    return { success: false, error: "Gagal menyetujui booking." };
  }
}

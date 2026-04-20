"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { bookingSchema, updateBookingSchema } from "@/lib/validations/booking";

export async function createBooking(data: unknown) {
  const { session, error } = await requirePermission({ module: "bookings", action: "create" });
  if (error) return { success: false, error };

  const parsed = bookingSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const input = parsed.data;

  try {
    const [customer, venue, pkg, variant] = await Promise.all([
      db.customer.findUniqueOrThrow({ where: { id: input.customerId } }),
      db.venue.findUniqueOrThrow({ where: { id: input.venueId }, include: { brand: true } }),
      db.package.findUniqueOrThrow({ where: { id: input.packageId } }),
      input.packageVariantId
        ? db.packageVariant.findUniqueOrThrow({
            where: { id: input.packageVariantId },
            include: { vendorItems: true, internalItems: true },
          })
        : null,
    ]);

    const booking = await db.$transaction(async (tx) => {
      const b = await tx.booking.create({
        data: {
          bookingDate: new Date(input.bookingDate),
          salesId: session!.user.profileId!,
          customerId: input.customerId,
          venueId: input.venueId,
          packageId: input.packageId,
          packageVariantId: input.packageVariantId ?? null,
          paymentMethodId: input.paymentMethodId ?? null,
          sourceOfInformationId: input.sourceOfInformationId ?? null,
          weddingSession: input.weddingSession ?? null,
          weddingType: input.weddingType ?? null,
        },
      });

      await tx.snapCustomer.create({
        data: {
          bookingId: b.id,
          customerId: customer.id,
          name: customer.name,
          email: customer.email,
          mobileNumber: customer.mobileNumber,
          nikNumber: customer.nikNumber,
          ktpAddress: customer.ktpAddress,
        },
      });

      await tx.snapVenue.create({
        data: {
          bookingId: b.id,
          venueId: venue.id,
          venueName: venue.name,
          address: venue.address,
          description: venue.description,
          brandName: venue.brand?.name ?? null,
          brandCode: venue.brand?.code ?? null,
        },
      });

      await tx.snapPackage.create({
        data: {
          bookingId: b.id,
          packageId: pkg.id,
          packageName: pkg.packageName,
          notes: pkg.notes,
        },
      });

      if (variant) {
        await tx.snapPackageVariant.create({
          data: {
            bookingId: b.id,
            variantId: variant.id,
            variantName: variant.variantName,
            pax: variant.pax,
            price: variant.price,
          },
        });

        if (variant.internalItems.length > 0) {
          await tx.snapPackageInternalItem.createMany({
            data: variant.internalItems.map((item, i) => ({
              bookingId: b.id,
              itemName: item.itemName,
              itemDescription: item.itemDescription,
              sortOrder: i,
            })),
          });
        }

        if (variant.vendorItems.length > 0) {
          await tx.snapPackageVendorItem.createMany({
            data: variant.vendorItems.map((item, i) => ({
              bookingId: b.id,
              categoryName: item.categoryName,
              itemText: item.itemText,
              sortOrder: i,
            })),
          });
        }
      }

      if (input.bonuses && input.bonuses.length > 0) {
        await tx.snapBonus.createMany({
          data: input.bonuses.map((bonus) => ({
            bookingId: b.id,
            vendorId: bonus.vendorId,
            vendorCategoryId: bonus.vendorCategoryId,
            vendorName: bonus.vendorName,
            description: bonus.description ?? null,
            qty: bonus.qty,
          })),
        });
      }

      if (input.termOfPayments && input.termOfPayments.length > 0) {
        await tx.termOfPayment.createMany({
          data: input.termOfPayments.map((t) => ({
            bookingId: b.id,
            name: t.name,
            amount: BigInt(t.amount),
            dueDate: new Date(t.dueDate),
            sortOrder: t.sortOrder,
          })),
        });
      }

      return b;
    });

    await logAudit({
      userId: session!.user.id,
      action: "created",
      entityType: "booking",
      entityId: booking.id,
      changes: { customerId: input.customerId, venueId: input.venueId, packageId: input.packageId },
      description: `Created booking for ${customer.name}`,
    });

    revalidateTag("bookings", "max");
    return { success: true, bookingId: booking.id };
  } catch (e) {
    console.error("[createBooking]", e);
    return { success: false, error: "Gagal membuat booking." };
  }
}

export async function updateBooking(data: unknown) {
  const { session, error } = await requirePermission({ module: "bookings", action: "update" });
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
  const { session, error } = await requirePermission({ module: "bookings", action: "delete" });
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

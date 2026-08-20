import { z } from "zod";

const idTypeEnum = z.enum(["KTP", "Paspor"]);

export const bookingSchema = z.object({
  eventDate: z.string().min(1, "Tanggal event wajib diisi"),
  weddingSession: z.enum(["morning", "evening", "fullday"]).optional().nullable(),
  weddingType: z.string().optional().nullable(),
  customerId: z.string().optional().default(""),
  customerName: z.string().optional().default(""),
  contactNumbers: z.string().optional().default(""),
  contactEmailCpp: z.string().email("Email CPP tidak valid").optional().or(z.literal("")).default(""),
  contactEmailCpw: z.string().email("Email CPW tidak valid").optional().or(z.literal("")).default(""),
  contactIdTypeCpp: idTypeEnum.default("KTP"),
  contactIdTypeCpw: idTypeEnum.default("KTP"),
  contactNikCpp: z.string().optional().or(z.literal("")).default(""),
  contactNikCpw: z.string().optional().or(z.literal("")).default(""),
  contactCppAddress: z.string().optional().default(""),
  contactCpwAddress: z.string().optional().default(""),
  contactBitrixId: z.string().optional().default(""),
  venueId: z.string().min(1, "Venue wajib dipilih"),
  packageId: z.string().min(1, "Package wajib dipilih"),
  // Optional: admin/manager assigns on behalf of a sales. When omitted, the
  // action falls back to the caller's own profileId.
  salesId: z.string().optional().nullable(),
  paymentMethodId: z.string().optional().nullable(),
  sourceOfInformationId: z.string().optional().nullable(),
  sourceOfInformationDetail: z.string().optional().nullable(),
  specialBonusName: z.string().optional().nullable(),
  specialBonusAmount: z.coerce.number().optional().nullable(),
  bonuses: z.array(z.object({
    vendorId: z.string().min(1),
    vendorCategoryId: z.string().min(1),
    vendorName: z.string().min(1),
    description: z.string().optional().nullable(),
    qty: z.coerce.number().int().min(1).default(1),
    nominal: z.coerce.number().min(0).default(0),
  })).optional().default([]),
  complimentaries: z.array(z.object({
    complimentaryId: z.string().optional().nullable(),
    name: z.string().min(1),
    price: z.coerce.number().int().min(0).default(0),
    isShowPrice: z.boolean().default(false),
    description: z.string().optional().nullable(),
    qty: z.coerce.number().int().min(1).default(1),
    sortOrder: z.coerce.number().int().default(0),
  })).optional().default([]),
  categoryToggles: z.array(z.object({
    categoryName: z.string().min(1),
    basePrice: z.coerce.number().int().min(0),
    sortOrder: z.coerce.number().int().default(0),
    isShow: z.boolean().default(true),
    isTakeout: z.boolean().default(false),
    takeoutNominal: z.coerce.number().int().min(0).default(0),
  })).optional().default([]),
  // Fase 5: TOP = jadwal murni (nama/nominal/tanggal). Status & bukti bayar
  // dipindah ke Cashbook (Ledger) — bukan lagi kolom termin.
  termOfPayments: z.array(z.object({
    name: z.string().min(1),
    amount: z.coerce.number().min(0),
    dueDate: z.string().min(1),
    sortOrder: z.coerce.number().int().default(0),
  })).optional().default([]),
  signingLocation: z.string().optional().nullable(),
  signatureSales: z.string().optional().nullable(),
  withMaterai: z.boolean().default(false),
  leadId: z.string().optional().nullable(),
}).superRefine((data, ctx) => {
  const nikCpp = data.contactNikCpp ?? "";
  if (nikCpp !== "") {
    if (data.contactIdTypeCpp === "KTP" && !/^\d{16}$/.test(nikCpp)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "NIK CPP harus 16 digit angka", path: ["contactNikCpp"] });
    } else if (data.contactIdTypeCpp === "Paspor" && !/^[A-Za-z0-9]{6,9}$/.test(nikCpp)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Paspor CPP harus 6–9 karakter alfanumerik", path: ["contactNikCpp"] });
    }
  }
  const nikCpw = data.contactNikCpw ?? "";
  if (nikCpw !== "") {
    if (data.contactIdTypeCpw === "KTP" && !/^\d{16}$/.test(nikCpw)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "NIK CPW harus 16 digit angka", path: ["contactNikCpw"] });
    } else if (data.contactIdTypeCpw === "Paspor" && !/^[A-Za-z0-9]{6,9}$/.test(nikCpw)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Paspor CPW harus 6–9 karakter alfanumerik", path: ["contactNikCpw"] });
    }
  }
});

export const updateBookingSchema = z.object({
  id: z.string().min(1),
  eventDate: z.string().optional(),
  bookingStatus: z.enum(["Pending", "Uploaded", "Confirmed", "Rejected", "Canceled", "Lost"]).optional(),
  paymentStatus: z.string().optional(),
  weddingSession: z.enum(["morning", "evening", "fullday"]).optional().nullable(),
  weddingType: z.string().optional().nullable(),
  rejectionNotes: z.string().optional().nullable(),
  lostReason: z.string().optional().nullable(),
  paymentMethodId: z.string().optional().nullable(),
  sourceOfInformationId: z.string().optional().nullable(),
});

/** Cancel a wedding booking → status Canceled. Reason wajib; dokumen surat
 *  permohonan (opsional) di-handle terpisah sebagai FormData file di action. */
export const cancelBookingSchema = z.object({
  id: z.string().min(1),
  cancelReason: z
    .string()
    .trim()
    .min(3, "Alasan cancel wajib diisi (min 3 karakter)")
    .max(500, "Alasan maksimal 500 karakter"),
});

export const editBookingSchema = z.object({
  id: z.string().min(1),
  eventDate: z.string().min(1, "Tanggal event wajib diisi"),
  weddingSession: z.enum(["morning", "evening", "fullday"]).optional().nullable(),
  weddingType: z.string().optional().nullable(),
  venueId: z.string().min(1, "Venue wajib dipilih"),
  packageId: z.string().min(1, "Package wajib dipilih"),
  paymentMethodId: z.string().optional().nullable(),
  sourceOfInformationId: z.string().optional().nullable(),
  sourceOfInformationDetail: z.string().optional().nullable(),
  signingLocation: z.string().optional().nullable(),
  eventTime: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  // Customer fields
  customerName: z.string().min(1, "Nama customer wajib diisi"),
  contactNumbers: z.string().optional().default(""),
  contactEmailCpp: z.string().email("Email CPP tidak valid").optional().or(z.literal("")).default(""),
  contactEmailCpw: z.string().email("Email CPW tidak valid").optional().or(z.literal("")).default(""),
  contactIdTypeCpp: idTypeEnum.default("KTP"),
  contactIdTypeCpw: idTypeEnum.default("KTP"),
  contactNikCpp: z.string().optional().or(z.literal("")).default(""),
  contactNikCpw: z.string().optional().or(z.literal("")).default(""),
  contactCppAddress: z.string().optional().default(""),
  contactCpwAddress: z.string().optional().default(""),
  contactBitrixId: z.string().optional().default(""),
  bonuses: z.array(z.object({
    vendorId: z.string().min(1),
    vendorCategoryId: z.string().min(1),
    vendorName: z.string().min(1),
    description: z.string().optional().nullable(),
    qty: z.coerce.number().int().min(1).default(1),
    nominal: z.coerce.number().min(0).default(0),
  })).optional().default([]),
  // complimentaries intentionally omitted — managed via EditComplimentaryDrawer +
  // saveSnapComplimentaries which does NOT reset approval or client agreement.
  categoryToggles: z.array(z.object({
    categoryName: z.string().min(1),
    basePrice: z.coerce.number().int().min(0),
    sortOrder: z.coerce.number().int().default(0),
    isShow: z.boolean().default(true),
    isTakeout: z.boolean().default(false),
    takeoutNominal: z.coerce.number().int().min(0).default(0),
  })).optional().default([]),
  // Fase 5: TOP = jadwal murni. Status/ack pembayaran diturunkan dari Ledger,
  // tak lagi dikirim/disimpan per termin.
  termOfPayments: z.array(z.object({
    id: z.string().optional(),
    name: z.string().min(1),
    amount: z.coerce.number().min(0),
    dueDate: z.string().min(1),
    sortOrder: z.coerce.number().int().default(0),
  })).optional().default([]),
  specialBonusName: z.string().optional().nullable(),
  specialBonusAmount: z.coerce.number().optional().nullable(),
  signatureSales: z.string().optional().nullable(),
  /** Sinyal eksplisit: user me-re-select paket (sama atau beda) sehingga harga
   *  master harus di-refresh dari DB. Diset true di drawer saat SearchableSelect
   *  paket onChange terpicu. False = harga snapshot tidak di-touch. */
  refreshPackagePrice: z.boolean().optional().default(false),
}).superRefine((data, ctx) => {
  const nikCpp = data.contactNikCpp ?? "";
  if (nikCpp !== "") {
    if (data.contactIdTypeCpp === "KTP" && !/^\d{16}$/.test(nikCpp)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "NIK CPP harus 16 digit angka", path: ["contactNikCpp"] });
    } else if (data.contactIdTypeCpp === "Paspor" && !/^[A-Za-z0-9]{6,9}$/.test(nikCpp)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Paspor CPP harus 6–9 karakter alfanumerik", path: ["contactNikCpp"] });
    }
  }
  const nikCpw = data.contactNikCpw ?? "";
  if (nikCpw !== "") {
    if (data.contactIdTypeCpw === "KTP" && !/^\d{16}$/.test(nikCpw)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "NIK CPW harus 16 digit angka", path: ["contactNikCpw"] });
    } else if (data.contactIdTypeCpw === "Paspor" && !/^[A-Za-z0-9]{6,9}$/.test(nikCpw)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Paspor CPW harus 6–9 karakter alfanumerik", path: ["contactNikCpw"] });
    }
  }
});

/** Client-info-only update: updates snapCustomer + customer master WITHOUT touching
 *  venue/package/TOP or triggering approval reset. Used by Step 1 "Save & Publish". */
export const updateBookingClientInfoSchema = z.object({
  id: z.string().min(1),
  customerName: z.string().min(1, "Nama customer wajib diisi"),
  contactNumbers: z.string().optional().default(""),
  contactEmailCpp: z.string().email("Email CPP tidak valid").optional().or(z.literal("")).default(""),
  contactEmailCpw: z.string().email("Email CPW tidak valid").optional().or(z.literal("")).default(""),
  contactIdTypeCpp: idTypeEnum.default("KTP"),
  contactIdTypeCpw: idTypeEnum.default("KTP"),
  contactNikCpp: z.string().optional().or(z.literal("")).default(""),
  contactNikCpw: z.string().optional().or(z.literal("")).default(""),
  contactCppAddress: z.string().optional().default(""),
  contactCpwAddress: z.string().optional().default(""),
  contactBitrixId: z.string().optional().default(""),
  salesId: z.string().optional().nullable(),
  sourceOfInformationId: z.string().optional().nullable(),
  sourceOfInformationDetail: z.string().optional().nullable(),
}).superRefine((data, ctx) => {
  const nikCpp = data.contactNikCpp ?? "";
  if (nikCpp !== "") {
    if (data.contactIdTypeCpp === "KTP" && !/^\d{16}$/.test(nikCpp)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "NIK CPP harus 16 digit angka", path: ["contactNikCpp"] });
    } else if (data.contactIdTypeCpp === "Paspor" && !/^[A-Za-z0-9]{6,9}$/.test(nikCpp)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Paspor CPP harus 6–9 karakter alfanumerik", path: ["contactNikCpp"] });
    }
  }
  const nikCpw = data.contactNikCpw ?? "";
  if (nikCpw !== "") {
    if (data.contactIdTypeCpw === "KTP" && !/^\d{16}$/.test(nikCpw)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "NIK CPW harus 16 digit angka", path: ["contactNikCpw"] });
    } else if (data.contactIdTypeCpw === "Paspor" && !/^[A-Za-z0-9]{6,9}$/.test(nikCpw)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Paspor CPW harus 6–9 karakter alfanumerik", path: ["contactNikCpw"] });
    }
  }
});

/** Restore a past BookingRevision as the active version. Rolls the snapshot back
 *  to the target revision's content (package/venue/pricing/items), creating a NEW
 *  revision so history stays append-only. Resets approval + re-signature. */
export const restoreBookingRevisionSchema = z.object({
  bookingId: z.string().min(1),
  revisionId: z.string().min(1),
});

/** Sync the booking's package snapshot from the current master Package. Re-pulls
 *  name/notes/pricing/items/category-prices/T&C from the master (e.g. after the
 *  master was corrected), preserving per-booking takeout toggles. Creates a new
 *  revision + resets approval. */
export const syncBookingPackageSchema = z.object({
  bookingId: z.string().min(1),
});

/** Signature-only update: updates signingLocation + ApprovalRecordStep signature
 *  WITHOUT touching venue/package/TOP or triggering approval reset. */
export const updateBookingSignatureSchema = z.object({
  id: z.string().min(1),
  signingLocation: z.string().min(1, "Lokasi tanda tangan wajib diisi").max(200),
  /** Optional — only provided when the caller IS the sales PIC. Non-sales callers
   *  omit this to save signingLocation only, without touching the approval step. */
  signatureSales: z.string().min(1).optional(),
});

export type BookingInput = z.infer<typeof bookingSchema>;
export type UpdateBookingInput = z.infer<typeof updateBookingSchema>;
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;
export type EditBookingInput = z.infer<typeof editBookingSchema>;
export type UpdateBookingClientInfoInput = z.infer<typeof updateBookingClientInfoSchema>;
export type UpdateBookingSignatureInput = z.infer<typeof updateBookingSignatureSchema>;
export type RestoreBookingRevisionInput = z.infer<typeof restoreBookingRevisionSchema>;
export type SyncBookingPackageInput = z.infer<typeof syncBookingPackageSchema>;

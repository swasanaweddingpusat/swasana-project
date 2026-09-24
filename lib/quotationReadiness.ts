interface QuotationTermReadiness {
  amount: number;
  dueDate: Date | string | null;
}

interface QuotationConversionReadinessInput {
  venueId: string | null;
  eventTypeId: string | null;
  eventDate: Date | string | null;
  packageSource: string | null;
  packageId: string | null;
  subtotal: number;
  signingLocation: string | null;
  signatureSales: string | null;
  terms: readonly QuotationTermReadiness[];
}

export function getQuotationConversionReadinessError(
  quotation: QuotationConversionReadinessInput,
): string | null {
  if (!quotation.venueId || !quotation.eventTypeId || !quotation.eventDate) {
    return "Venue, tipe event, dan tanggal event wajib lengkap sebelum konversi.";
  }
  if (quotation.packageSource === "meeting-package" && !quotation.packageId) {
    return "Meeting Package wajib dipilih sebelum konversi.";
  }
  if (quotation.subtotal <= 0) {
    return "Quotation harus memiliki harga sebelum konversi.";
  }
  if (!quotation.signingLocation?.trim() || !quotation.signatureSales?.trim()) {
    return "Lokasi dan tanda tangan sales wajib lengkap sebelum konversi.";
  }
  if (
    quotation.terms.length === 0 ||
    quotation.terms.some((term) => term.amount <= 0 || !term.dueDate)
  ) {
    return "Semua TOP wajib memiliki nominal dan tanggal jatuh tempo sebelum konversi.";
  }
  return null;
}

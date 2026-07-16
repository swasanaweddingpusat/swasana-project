/**
 * Preview alokasi greedy satu pembayaran ke beberapa termin.
 *
 * Cermin dari greedy yang dipakai saat submit (booking-draft finalize &
 * EditPaymentStep.buildAllocations): budget dibagi urut, tiap termin diisi
 * sampai sisa tagihannya, termin terakhir bisa parsial. Dipakai HANYA untuk
 * indikator UI — angka final tetap dihitung ulang & di-guard di server.
 *
 * Urutan `orderedTerms` HARUS sama dengan urutan alokasi flow-nya:
 * create = urutan pilih (termUids), edit = urutan sortOrder (terms.filter).
 */

export interface AllocPreviewTerm {
  id: string;
  /** Sisa tagihan termin ini (amount − sudah terbayar). */
  remaining: number;
}

export interface AllocPreview {
  /** id termin → nominal teralokasi (greedy). */
  perTerm: Map<string, number>;
  /** Total yang benar-benar masuk termin (≤ amount). */
  allocated: number;
  /** Kekurangan: Σ sisa termin terpilih − amount (saat bayar < total tagihan terpilih). */
  kurang: number;
  /** Kelebihan: amount − Σ sisa termin terpilih (saat bayar > total tagihan terpilih). */
  lebih: number;
  /** Σ sisa tagihan seluruh termin terpilih. */
  totalRemaining: number;
}

export function computeAllocationPreview(
  orderedTerms: AllocPreviewTerm[],
  amount: number,
): AllocPreview {
  const perTerm = new Map<string, number>();
  const gross = Math.max(0, amount);
  let budget = gross;
  let totalRemaining = 0;

  for (const t of orderedTerms) {
    const rem = Math.max(0, t.remaining);
    totalRemaining += rem;
    const alloc = Math.min(rem, budget);
    perTerm.set(t.id, alloc);
    budget -= alloc;
  }

  return {
    perTerm,
    allocated: gross - budget,
    kurang: Math.max(0, totalRemaining - gross),
    lebih: Math.max(0, gross - totalRemaining),
    totalRemaining,
  };
}

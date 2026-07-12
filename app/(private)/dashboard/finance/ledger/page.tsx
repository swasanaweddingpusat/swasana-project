import { getLedgerEntries, getBookingsForLedgerPicker } from "@/lib/queries/ledger";
import { getPromoPrograms } from "@/lib/queries/promo";
import {
  getPaymentMethodsForPicker,
  toPaymentMethodPickerItems,
} from "@/lib/queries/payment-methods";
import { LedgerClient } from "./_components/ledger-client";
import type { LedgerPromoOption } from "./_components/ledger-entry-drawer";

/**
 * Halaman Cashbook (buku besar cash-in). Server component: fetch data real
 * (ledger + picker booking/promo/rekening) lalu render shell interaktif.
 * Judul/subtitle halaman diambil dari route-meta di header dashboard.
 */
export default async function LedgerPage(): Promise<React.ReactElement> {
  const [entriesResult, bookings, promoPrograms, paymentMethodRows] = await Promise.all([
    getLedgerEntries(),
    getBookingsForLedgerPicker(),
    getPromoPrograms(),
    getPaymentMethodsForPicker(),
  ]);

  const promos: LedgerPromoOption[] = promoPrograms
    .filter((p) => p.isActive)
    .map((p) => ({
      id: p.id,
      name: p.name,
      discountType: p.discountType,
      discountValue: p.discountValue,
    }));

  return (
    <LedgerClient
      entries={entriesResult.data}
      bookings={bookings}
      promos={promos}
      paymentMethods={toPaymentMethodPickerItems(paymentMethodRows)}
    />
  );
}

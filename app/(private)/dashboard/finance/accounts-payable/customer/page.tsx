import { getPayables, getPayableSummary } from "@/lib/queries/customer-payout";
import { getBookingsForLedgerPicker } from "@/lib/queries/ledger";
import {
  getPaymentMethodsForPicker,
  toPaymentMethodPickerItems,
} from "@/lib/queries/payment-methods";
import { requirePagePermission } from "@/lib/require-page-permission";
import { PayableClientView } from "./_components/PayableClientView";

/**
 * Halaman Customer Payout — kewajiban uang keluar ke customer (cashback & refund).
 * Server component: gate finance-ap:view, fetch data real lalu render client view.
 * Judul/subtitle dari route-meta di header dashboard.
 */
export default async function CustomerPayoutPage(): Promise<React.ReactElement> {
  // Guard + bikin route dynamic (auth() akses cookies) — cegah Next static-prerender
  // yang bakal nembak Prisma pas build.
  await requirePagePermission("finance-ap");

  const [payablesResult, summary, bookings, paymentMethodRows] = await Promise.all([
    getPayables({ page: 1 }),
    getPayableSummary(),
    getBookingsForLedgerPicker(),
    getPaymentMethodsForPicker(),
  ]);

  return (
    <PayableClientView
      payables={payablesResult.data}
      total={payablesResult.total}
      summary={summary}
      bookings={bookings}
      paymentMethods={toPaymentMethodPickerItems(paymentMethodRows)}
    />
  );
}

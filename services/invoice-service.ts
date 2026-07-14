import { issueInvoice, voidInvoice } from "@/actions/invoice";
import type { IssueInvoiceInput } from "@/lib/validations/invoice";

export async function issueInvoiceClient(
  input: IssueInvoiceInput,
): Promise<{ id: string; invoiceNumber: string }> {
  const res = await issueInvoice(input);
  if (!res.success) throw new Error(res.error);
  return (res as { success: true; data: { id: string; invoiceNumber: string } }).data;
}

export async function voidInvoiceClient(invoiceId: string): Promise<void> {
  const res = await voidInvoice(invoiceId);
  if (!res.success) throw new Error(res.error);
}

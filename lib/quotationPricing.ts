interface QuotationTotalLine {
  total: number;
}

interface CalculateQuotationTotalsInput {
  items?: readonly QuotationTotalLine[];
  additionals?: readonly QuotationTotalLine[];
  prices?: readonly QuotationTotalLine[];
  discount?: number;
}

export interface QuotationTotals {
  subtotal: number;
  totalPrice: number;
}

export function calculateQuotationTotals({
  items = [],
  additionals = [],
  prices = [],
  discount = 0,
}: CalculateQuotationTotalsInput): QuotationTotals {
  const sumLines = (lines: readonly QuotationTotalLine[]): number =>
    lines.reduce((sum, line) => sum + Math.max(0, line.total), 0);

  const subtotal = sumLines(items) + sumLines(additionals) + sumLines(prices);
  return {
    subtotal,
    totalPrice: Math.max(0, subtotal - Math.max(0, discount)),
  };
}

-- QuotationTerm.paymentStatus / paymentEvidence dead columns removed: payment
-- tracking for MICE quotations was never wired to these fields (zero code
-- references) — the source of truth for payments lives at the Booking level
-- (TermOfPayment + Ledger / PaymentAllocation), see the comment on
-- TermOfPayment in prisma/schema.prisma and docs/finance-ar-invoice-issue-spec.md.
ALTER TABLE "quotation_terms" DROP COLUMN IF EXISTS "paymentStatus";
ALTER TABLE "quotation_terms" DROP COLUMN IF EXISTS "paymentEvidence";

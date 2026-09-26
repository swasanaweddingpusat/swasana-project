-- Quotations are sales documents and no longer have an approval lifecycle.
-- ApprovalRecordStep and ApprovalFlowStep rows cascade from their parent rows.
DELETE FROM "approval_records"
WHERE "module" = 'quotations';

DELETE FROM "approval_flow_configs"
WHERE "module" = 'quotations';

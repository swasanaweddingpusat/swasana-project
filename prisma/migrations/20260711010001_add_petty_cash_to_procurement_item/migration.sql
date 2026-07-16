-- Add harga and pettyCash fields to procurement_items
ALTER TABLE procurement_items
ADD COLUMN IF NOT EXISTS "harga" DECIMAL(65,30) NOT NULL DEFAULT 0;

ALTER TABLE procurement_items
ADD COLUMN IF NOT EXISTS "pettyCash" DECIMAL(65,30) NOT NULL DEFAULT 0;

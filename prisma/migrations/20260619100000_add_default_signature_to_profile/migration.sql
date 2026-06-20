-- Migration: add_default_signature_to_profile
-- Adds defaultSignature field to profiles table (base64 PNG data URL for sales default signature)

ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "defaultSignature" TEXT;

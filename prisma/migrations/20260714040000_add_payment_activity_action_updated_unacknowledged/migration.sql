-- Migration: add 'updated' and 'unacknowledged' to PaymentActivityAction enum
-- Idempotent: checks pg_enum join pg_type (avoids ::regtype cast issues)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'PaymentActivityAction'
      AND e.enumlabel = 'updated'
  ) THEN
    ALTER TYPE "PaymentActivityAction" ADD VALUE 'updated';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'PaymentActivityAction'
      AND e.enumlabel = 'unacknowledged'
  ) THEN
    ALTER TYPE "PaymentActivityAction" ADD VALUE 'unacknowledged';
  END IF;
END
$$;

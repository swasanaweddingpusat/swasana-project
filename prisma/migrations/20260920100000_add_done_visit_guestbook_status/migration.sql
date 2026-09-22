-- Add the status used when a guest has completed their visit.
ALTER TYPE "GuestVisitStatus" ADD VALUE IF NOT EXISTS 'done_visit';
-- Ensure HR recruitment enums exist with all required values.
-- These enums may already exist (from hr&payroll branch) with different values,
-- so we ADD VALUE IF NOT EXISTS for each value needed by the recruitment migration.

DO $$ BEGIN CREATE TYPE "PositionType" AS ENUM ('FULL_TIME','PART_TIME','CONTRACT','INTERNSHIP'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "JobStatus" AS ENUM ('OPEN','CLOSED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ApplicantStatus" AS ENUM ('NEW','REVIEWED','INTERVIEWED','OFFERED','HIRED','REJECTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "InterviewType" AS ENUM ('PHONE_SCREENING','TECHNICAL','HR_ROUND','FINAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "InterviewStatus" AS ENUM ('SCHEDULED','COMPLETED','CANCELLED','NO_SHOW'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "OfferStatus" AS ENUM ('PENDING','ACCEPTED','REJECTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "OnboardingStatus" AS ENUM ('IN_PROGRESS','COMPLETED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE "OnboardingStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';
ALTER TYPE "OnboardingStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';

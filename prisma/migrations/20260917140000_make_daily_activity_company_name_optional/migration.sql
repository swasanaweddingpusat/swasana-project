-- Nama perusahaan/instansi jadi opsional di Daily Activity.
ALTER TABLE "daily_activities" ALTER COLUMN "companyName" DROP NOT NULL;

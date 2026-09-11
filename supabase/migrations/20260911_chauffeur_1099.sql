-- Chauffeur 1099 / license / address fields. Additive only — no DROP, no data wipe.

ALTER TABLE public.chauffeurs
  ADD COLUMN IF NOT EXISTS driver_license_id text,
  ADD COLUMN IF NOT EXISTS driver_license_expires_on date,
  ADD COLUMN IF NOT EXISTS is_1099_contractor boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS tax_id_type text,
  ADD COLUMN IF NOT EXISTS tax_id_last4 text,
  ADD COLUMN IF NOT EXISTS tax_id_encrypted text,
  ADD COLUMN IF NOT EXISTS address_line1 text,
  ADD COLUMN IF NOT EXISTS address_line2 text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS zip text;

DO $$ BEGIN
  ALTER TABLE public.chauffeurs
    ADD CONSTRAINT chauffeurs_tax_id_type_check
    CHECK (tax_id_type IS NULL OR tax_id_type IN ('ssn', 'ein'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.chauffeurs.tax_id_encrypted IS
  'App-encrypted tax ID (AES-GCM). Never log. Decrypt only for admin 1099 print.';
COMMENT ON COLUMN public.chauffeurs.tax_id_last4 IS
  'Last 4 of SSN/EIN for masked display. Admin-only in the app.';
COMMENT ON COLUMN public.chauffeurs.driver_license_id IS
  'Driver license / Driver ID. Required by the app on save; nullable for legacy rows.';

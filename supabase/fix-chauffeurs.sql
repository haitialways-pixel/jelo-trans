-- Quick fix: run this alone in Supabase SQL Editor if you see
--   ERROR: relation "public.chauffeurs" does not exist
--
-- Safe to re-run. Creates chauffeurs, then adds missing reservation columns.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.chauffeurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  notify_email boolean NOT NULL DEFAULT true,
  notify_sms boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','busy','off_duty')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chauffeurs
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS notify_email boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_sms boolean NOT NULL DEFAULT true;

-- Add reservation columns only when reservations table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'reservations'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'reservations' AND column_name = 'chauffeur_id'
    ) THEN
      ALTER TABLE public.reservations
        ADD COLUMN chauffeur_id uuid REFERENCES public.chauffeurs(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'reservations' AND column_name = 'source'
    ) THEN
      ALTER TABLE public.reservations
        ADD COLUMN source text NOT NULL DEFAULT 'web';
      ALTER TABLE public.reservations
        ADD CONSTRAINT reservations_source_check CHECK (source IN ('web', 'manual'));
    END IF;
  END IF;
END $$;

SELECT 'chauffeurs table ready' AS status;
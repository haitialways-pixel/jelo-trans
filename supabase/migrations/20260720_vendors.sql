-- Vendor directory for staff invoices (bill-to parties).
-- Staff-only read/write; not exposed to anon/public.

CREATE TABLE IF NOT EXISTS public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company text,
  email text NOT NULL,
  phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS vendors_email_lower_unique
  ON public.vendors (lower(btrim(email)));

CREATE INDEX IF NOT EXISTS idx_vendors_name ON public.vendors (name);
CREATE INDEX IF NOT EXISTS idx_vendors_company ON public.vendors (company);

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read vendors" ON public.vendors;
CREATE POLICY "Staff read vendors" ON public.vendors
  FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "Staff manages vendors" ON public.vendors;
CREATE POLICY "Staff manages vendors" ON public.vendors
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Service role manages vendors" ON public.vendors;
CREATE POLICY "Service role manages vendors" ON public.vendors
  FOR ALL TO service_role USING (true) WITH CHECK (true);

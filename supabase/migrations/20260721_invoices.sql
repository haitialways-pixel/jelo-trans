-- Sent vendor invoices — persisted for staff retrieval / resend.
-- Depends on public.vendors (20260720_vendors.sql). Staff-only.

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  vendor_name text NOT NULL,
  vendor_company text,
  vendor_email text NOT NULL,
  vendor_phone text,
  company_name text NOT NULL DEFAULT 'Imperial Odyssey, LLC',
  company_address text,
  company_phone text,
  company_email text,
  company_website text,
  invoice_date timestamptz NOT NULL DEFAULT now(),
  due_date date,
  trip_type text CHECK (trip_type IS NULL OR trip_type IN ('one_way', 'round_trip', 'charter')),
  duration_hours numeric(10,2),
  origin text,
  destination text,
  departure_at timestamptz,
  return_at timestamptz,
  booking_ticket_number text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  tax_label text,
  tax_amount numeric(10,2) NOT NULL DEFAULT 0,
  discount_amount numeric(10,2) NOT NULL DEFAULT 0,
  other_fees numeric(10,2) NOT NULL DEFAULT 0,
  other_fees_label text,
  amount_due numeric(10,2) NOT NULL,
  notes text,
  accepted_methods text[] NOT NULL DEFAULT '{}',
  ach_instructions text,
  zelle_instructions text,
  card_instructions text,
  card_payment_link text,
  email_message_id text,
  sent_to text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'void')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS invoices_invoice_number_unique
  ON public.invoices (upper(btrim(invoice_number)));

CREATE INDEX IF NOT EXISTS idx_invoices_sent_at ON public.invoices (sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_vendor_id ON public.invoices (vendor_id);
CREATE INDEX IF NOT EXISTS idx_invoices_vendor_email ON public.invoices (lower(vendor_email));
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices (status);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read invoices" ON public.invoices;
CREATE POLICY "Staff read invoices" ON public.invoices
  FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "Staff manages invoices" ON public.invoices;
CREATE POLICY "Staff manages invoices" ON public.invoices
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Service role manages invoices" ON public.invoices;
CREATE POLICY "Service role manages invoices" ON public.invoices
  FOR ALL TO service_role USING (true) WITH CHECK (true);

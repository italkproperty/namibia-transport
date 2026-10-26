-- Namibia Transport: invoice payment allocations (manual verification phase).
-- Run in Supabase SQL Editor only after PR #71's invoice foundation migration
-- has been applied. This is additive and safe to rerun.
CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  currency char(3) NOT NULL DEFAULT 'NAD' CHECK (currency = 'NAD'),
  method text NOT NULL CHECK (method IN ('bank_transfer', 'card', 'cash', 'other')),
  reference text,
  paid_at timestamptz NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoice_payments_invoice_paid_idx
  ON public.invoice_payments (invoice_id, paid_at);

-- Confirm the table and index exist after running this script.
SELECT
  to_regclass('public.invoice_payments') AS invoice_payments_table,
  to_regclass('public.invoice_payments_invoice_paid_idx') AS invoice_payments_index;

-- One PayToday payment attempt for an entire multi-leg quote.
-- Safe to run more than once. No existing payment or booking rows are changed.
BEGIN;

CREATE TABLE IF NOT EXISTS public.booking_group_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_ref text NOT NULL,
  provider text NOT NULL,
  provider_reference text,
  status public.payment_status NOT NULL DEFAULT 'pending',
  amount numeric(10,2) NOT NULL,
  currency char(3) NOT NULL DEFAULT 'NAD',
  checkout_url text,
  expires_at timestamptz,
  raw jsonb,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_group_payments_amount_positive CHECK (amount > 0),
  CONSTRAINT booking_group_payments_currency_nad CHECK (currency = 'NAD')
);

CREATE INDEX IF NOT EXISTS booking_group_payments_group_idx
  ON public.booking_group_payments (group_ref, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS booking_group_payments_provider_reference_key
  ON public.booking_group_payments (provider, provider_reference)
  WHERE provider_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS booking_group_payments_status_idx
  ON public.booking_group_payments (status, created_at DESC);

COMMIT;

-- Verify the table and indexes exist.
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'booking_group_payments';

SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'booking_group_payments'
ORDER BY indexname;

-- Namibia Transport: reconcile legacy invoice tables with the invoice admin workflow.
-- Apply manually only after reviewing the preview deployment and taking a database backup.
-- This migration is additive/idempotent: it preserves legacy columns and existing records.
-- Do NOT run db:seed or db:push as part of this change.

BEGIN;

-- The original manual setup created invoices with legacy names such as customer_name
-- and total_amount. Add the canonical columns expected by db/schema.ts while retaining
-- legacy fields for compatibility and auditability.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS public_token text,
  ADD COLUMN IF NOT EXISTS customer_id uuid,
  ADD COLUMN IF NOT EXISTS corporate_quote_id uuid,
  ADD COLUMN IF NOT EXISTS billing_name text,
  ADD COLUMN IF NOT EXISTS billing_email text,
  ADD COLUMN IF NOT EXISTS billing_whatsapp text,
  ADD COLUMN IF NOT EXISTS billing_address text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS currency char(3) DEFAULT 'NAD',
  ADD COLUMN IF NOT EXISTS subtotal numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS issued_at timestamptz,
  ADD COLUMN IF NOT EXISTS due_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms text,
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Copy legacy data only when the legacy column exists. Existing values in canonical
-- columns always win; this is safe to re-run.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='invoices' AND column_name='customer_name'
  ) THEN
    EXECUTE $q$
      UPDATE public.invoices
      SET billing_name = COALESCE(NULLIF(billing_name, ''), NULLIF(customer_name, ''))
      WHERE billing_name IS NULL OR billing_name = ''
    $q$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='invoices' AND column_name='customer_email'
  ) THEN
    EXECUTE $q$
      UPDATE public.invoices
      SET billing_email = COALESCE(billing_email, customer_email)
      WHERE billing_email IS NULL
    $q$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='invoices' AND column_name='customer_whatsapp'
  ) THEN
    EXECUTE $q$
      UPDATE public.invoices
      SET billing_whatsapp = COALESCE(billing_whatsapp, customer_whatsapp)
      WHERE billing_whatsapp IS NULL
    $q$;
  END IF;

  -- If the legacy invoice references a customer record, use its canonical contact
  -- details before falling back to a generic name.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='invoices' AND column_name='customer_id'
  ) AND to_regclass('public.customers') IS NOT NULL THEN
    EXECUTE $q$
      UPDATE public.invoices i
      SET billing_name = COALESCE(NULLIF(i.billing_name, ''), c.full_name),
          billing_email = COALESCE(i.billing_email, c.email),
          billing_whatsapp = COALESCE(i.billing_whatsapp, c.whatsapp)
      FROM public.customers c
      WHERE i.customer_id = c.id
        AND (i.billing_name IS NULL OR i.billing_name = ''
          OR i.billing_email IS NULL OR i.billing_whatsapp IS NULL)
    $q$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='invoices' AND column_name='total_amount'
  ) THEN
    EXECUTE $q$
      UPDATE public.invoices
      SET total = total_amount
      WHERE (total IS NULL OR total = 0) AND total_amount IS NOT NULL
    $q$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='invoices' AND column_name='due_date'
  ) THEN
    EXECUTE $q$
      UPDATE public.invoices
      SET due_at = due_date
      WHERE due_at IS NULL AND due_date IS NOT NULL
    $q$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='invoices' AND column_name='service_description'
  ) THEN
    EXECUTE $q$
      UPDATE public.invoices
      SET description = COALESCE(NULLIF(description, ''), service_description)
      WHERE description IS NULL OR description = ''
    $q$;
  END IF;
END $$;

-- Backfill any remaining required canonical values without deleting legacy data.
UPDATE public.invoices
SET
  billing_name = COALESCE(NULLIF(billing_name, ''), 'Customer'),
  description = COALESCE(NULLIF(description, ''), 'Transport service'),
  currency = COALESCE(currency, 'NAD'),
  subtotal = COALESCE(subtotal, total, 0),
  discount_amount = COALESCE(discount_amount, 0),
  total = COALESCE(total, subtotal, 0),
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, created_at, now());

ALTER TABLE public.invoices
  ALTER COLUMN billing_name SET NOT NULL,
  ALTER COLUMN description SET NOT NULL,
  ALTER COLUMN currency SET DEFAULT 'NAD',
  ALTER COLUMN currency SET NOT NULL,
  ALTER COLUMN subtotal SET DEFAULT 0,
  ALTER COLUMN subtotal SET NOT NULL,
  ALTER COLUMN discount_amount SET DEFAULT 0,
  ALTER COLUMN discount_amount SET NOT NULL,
  ALTER COLUMN total SET DEFAULT 0,
  ALTER COLUMN total SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

-- Drizzle expects the invoice_status enum. Replace the legacy check constraint
-- before converting the status column; preserve old non-draft states as issued,
-- and legacy cancelled states as void.
DO $$
DECLARE
  current_type text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid=t.typnamespace
    WHERE n.nspname='public' AND t.typname='invoice_status'
  ) THEN
    CREATE TYPE public.invoice_status AS ENUM ('draft', 'issued', 'void');
  END IF;

  ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;

  SELECT c.udt_name INTO current_type
  FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='invoices' AND c.column_name='status';

  IF current_type IS DISTINCT FROM 'invoice_status' THEN
    UPDATE public.invoices
    SET status = CASE
      WHEN lower(status::text) = 'draft' THEN 'draft'
      WHEN lower(status::text) IN ('void', 'cancelled', 'canceled') THEN 'void'
      ELSE 'issued'
    END;
    ALTER TABLE public.invoices
      ALTER COLUMN status TYPE public.invoice_status
      USING status::text::public.invoice_status;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_number_key
  ON public.invoices (invoice_number);
CREATE UNIQUE INDEX IF NOT EXISTS invoices_public_token_key
  ON public.invoices (public_token);
CREATE INDEX IF NOT EXISTS invoices_customer_created_idx
  ON public.invoices (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS invoices_status_due_idx
  ON public.invoices (status, due_at);
CREATE INDEX IF NOT EXISTS invoices_booking_idx
  ON public.invoices (booking_id);
CREATE INDEX IF NOT EXISTS invoices_corporate_quote_idx
  ON public.invoices (corporate_quote_id);
CREATE INDEX IF NOT EXISTS invoices_charter_quote_idx
  ON public.invoices (charter_quote_id);

-- Invoice lines already exist in this database with additional legacy columns.
-- Add the fields the current admin workflow uses; keep tax_rate/discount columns.
ALTER TABLE public.invoice_lines
  ADD COLUMN IF NOT EXISTS currency char(3) DEFAULT 'NAD',
  ADD COLUMN IF NOT EXISTS sort_order smallint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

UPDATE public.invoice_lines
SET currency = COALESCE(currency, 'NAD'),
    sort_order = COALESCE(sort_order, 0),
    created_at = COALESCE(created_at, now());

ALTER TABLE public.invoice_lines
  ALTER COLUMN currency SET DEFAULT 'NAD',
  ALTER COLUMN currency SET NOT NULL,
  ALTER COLUMN sort_order SET DEFAULT 0,
  ALTER COLUMN sort_order SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS invoice_lines_invoice_sort_idx
  ON public.invoice_lines (invoice_id, sort_order);

-- Payment allocation table may predate the current schema; add missing columns.
ALTER TABLE public.invoice_payments
  ADD COLUMN IF NOT EXISTS currency char(3) DEFAULT 'NAD',
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

UPDATE public.invoice_payments
SET currency = COALESCE(currency, 'NAD'),
    created_at = COALESCE(created_at, now());

ALTER TABLE public.invoice_payments
  ALTER COLUMN currency SET DEFAULT 'NAD',
  ALTER COLUMN currency SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS invoice_payments_invoice_paid_idx
  ON public.invoice_payments (invoice_id, paid_at);

-- Use a transactional yearly counter. Seed it from any existing NT-INV-YYYY-NNNNN
-- or NT-YYYY-NNNNN invoice numbers so issuing cannot reuse an existing number.
CREATE TABLE IF NOT EXISTS public.invoice_sequences (
  year integer PRIMARY KEY,
  last_number integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.invoice_sequences (year, last_number)
SELECT parsed_year, MAX(parsed_number)
FROM (
  SELECT
    (regexp_match(invoice_number, '^NT-(?:INV-)?([0-9]{4})-([0-9]+)
WHERE parsed_year IS NOT NULL AND parsed_number IS NOT NULL
GROUP BY parsed_year
ON CONFLICT (year) DO UPDATE
SET last_number = GREATEST(public.invoice_sequences.last_number, EXCLUDED.last_number),
    updated_at = now();

COMMIT;

-- Verification summary: one row per invoice-related table; this does not alter data.
SELECT
  table_name,
  COUNT(*) AS column_count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('invoices', 'invoice_lines', 'invoice_payments', 'invoice_sequences')
GROUP BY table_name
ORDER BY table_name;
))[1]::integer AS parsed_year,
    (regexp_match(invoice_number, '^NT-(?:INV-)?([0-9]{4})-([0-9]+)
WHERE parsed_year IS NOT NULL AND parsed_number IS NOT NULL
GROUP BY parsed_year
ON CONFLICT (year) DO UPDATE
SET last_number = GREATEST(public.invoice_sequences.last_number, EXCLUDED.last_number),
    updated_at = now();

COMMIT;

-- Verification summary: one row per invoice-related table; this does not alter data.
SELECT
  table_name,
  COUNT(*) AS column_count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('invoices', 'invoice_lines', 'invoice_payments', 'invoice_sequences')
GROUP BY table_name
ORDER BY table_name;
))[2]::integer AS parsed_number
  FROM public.invoices
  WHERE invoice_number ~ '^NT-(INV-)?[0-9]{4}-[0-9]+
WHERE parsed_year IS NOT NULL AND parsed_number IS NOT NULL
GROUP BY parsed_year
ON CONFLICT (year) DO UPDATE
SET last_number = GREATEST(public.invoice_sequences.last_number, EXCLUDED.last_number),
    updated_at = now();

COMMIT;

-- Verification summary: one row per invoice-related table; this does not alter data.
SELECT
  table_name,
  COUNT(*) AS column_count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('invoices', 'invoice_lines', 'invoice_payments', 'invoice_sequences')
GROUP BY table_name
ORDER BY table_name;

) parsed
WHERE parsed_year IS NOT NULL AND parsed_number IS NOT NULL
GROUP BY parsed_year
ON CONFLICT (year) DO UPDATE
SET last_number = GREATEST(public.invoice_sequences.last_number, EXCLUDED.last_number),
    updated_at = now();

COMMIT;

-- Verification summary: one row per invoice-related table; this does not alter data.
SELECT
  table_name,
  COUNT(*) AS column_count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('invoices', 'invoice_lines', 'invoice_payments', 'invoice_sequences')
GROUP BY table_name
ORDER BY table_name;

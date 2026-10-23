-- Namibia Transport: paid invoice ledger.
-- Run manually in Supabase SQL Editor before deploying the application changes.
create table if not exists public.payment_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  public_token text not null unique,
  payment_type text not null check (payment_type in ('booking', 'charter_quote')),
  payment_id uuid not null,
  booking_reference text,
  customer_name text not null,
  customer_email text,
  description text not null,
  currency char(3) not null default 'NAD',
  amount numeric(10,2) not null check (amount >= 0),
  vat_rate numeric(5,4) not null default 0,
  vat_amount numeric(10,2) not null default 0,
  total numeric(10,2) not null,
  payment_status text not null default 'paid' check (payment_status in ('paid')),
  paid_at timestamptz not null default now(),
  emailed_at timestamptz,
  email_error text,
  created_at timestamptz not null default now(),
  constraint payment_invoices_payment_unique unique (payment_type, payment_id)
);

create index if not exists payment_invoices_created_at_idx
  on public.payment_invoices (created_at desc);
create index if not exists payment_invoices_reference_idx
  on public.payment_invoices (booking_reference);

alter table public.payment_invoices enable row level security;
revoke all on public.payment_invoices from anon, authenticated;
grant all on public.payment_invoices to service_role;

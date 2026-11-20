-- Disposable test database only. No production connection.
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text,
  phone text,
  customer_type text not null default 'individual'
    check (customer_type in ('individual', 'company')),
  contact_person text,
  uen text,
  tags text[] not null default '{}',
  notes text,

  -- Legacy denormalized vehicle fields still used by Dashboard, Reports,
  -- Reminders, PDF generation, and older customer searches.
  car_plate text unique,
  car_make text,
  car_model text,
  car_year text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null
    constraint vehicles_customer_id_fkey references public.customers(id) on delete cascade,
  car_plate text not null,
  car_make text,
  car_model text,
  car_year text,
  vehicle_make text,
  vehicle_model text,
  is_primary boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid
    constraint invoices_customer_id_fkey references public.customers(id) on delete set null,
  vehicle_id uuid
    constraint invoices_vehicle_id_fkey references public.vehicles(id) on delete set null,
  invoice_no text unique,
  date date default current_date,
  technician text,
  advisor text,
  mechanic text,
  mileage text,
  chassis_no text,
  engine_no text,
  notes text,
  subtotal numeric not null default 0,
  discount numeric not null default 0,
  total numeric not null default 0,
  status text not null default 'draft'
    check (status in ('draft', 'confirmed', 'paid')),
  work_status text not null default 'waiting'
    check (work_status in ('waiting', 'repairing', 'parts', 'completed', 'paid')),
  work_order_only boolean not null default false,
  invoice_type text not null default 'onew'
    check (invoice_type in ('onew', 'kc_engine', 'kc_gearbox')),

  -- Tekmetric-style Work Board fields.
  arrived_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  promise_at timestamptz,
  customer_waiting boolean not null default false,
  customer_approval_status text not null default 'not_sent'
    check (customer_approval_status in ('not_sent', 'sent', 'approved', 'declined', 'partial')),
  customer_approved_at timestamptz,

  -- Void workflow. status remains original; voided_at is the source of truth.
  voided_at timestamptz,
  void_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  category_icon text,
  default_price numeric not null default 0,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.parts_library (
  id uuid primary key default gen_random_uuid(),
  part_name text not null,
  category text,
  vehicle_text text,
  vehicle_make text,
  vehicle_model text,
  selling_price numeric,
  selling_price_text text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.part_aliases (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null
    constraint part_aliases_part_id_fkey references public.parts_library(id) on delete cascade,
  alias_name text not null,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  constraint part_aliases_part_id_alias_name_key unique (part_id, alias_name)
);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null
    constraint invoice_items_invoice_id_fkey references public.invoices(id) on delete cascade,
  description text not null,
  category text,
  qty numeric not null default 1,
  unit_price numeric not null default 0,
  amount numeric not null default 0,
  sort_order integer not null default 0,
  part_id uuid
    constraint invoice_items_part_id_fkey references public.parts_library(id) on delete set null,
  item_type text not null default 'service'
    check (item_type in ('service', 'part', 'labour', 'discount', 'legacy')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.invoice_parts_pending (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null
    constraint invoice_parts_pending_invoice_id_fkey references public.invoices(id) on delete cascade,
  part_id uuid
    constraint invoice_parts_pending_part_id_fkey references public.parts_library(id) on delete set null,
  part_name text not null,
  supplier text,
  ordered_at date,
  eta_date date,
  arrived_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'ordered', 'arrived', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customer_activities (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null
    constraint customer_activities_customer_id_fkey references public.customers(id) on delete cascade,
  type text not null default 'note',
  content text not null,
  created_by text,
  created_at timestamptz not null default now()
);

create table public.customer_notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null
    constraint customer_notes_customer_id_fkey references public.customers(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customer_tasks (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null
    constraint customer_tasks_customer_id_fkey references public.customers(id) on delete cascade,
  title text not null,
  due_date date,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
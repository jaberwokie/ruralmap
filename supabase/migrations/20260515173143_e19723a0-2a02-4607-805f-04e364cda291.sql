-- staging_facilities table
create table if not exists public.staging_facilities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null,
  classification text,
  data_confidence text,
  city text,
  county text,
  street_address text,
  state text default 'NV',
  zip text,
  phone text,
  website text,
  latitude double precision,
  longitude double precision,
  notes text,
  tier text,
  service text,
  volume integer,
  access_type text,
  operational jsonb,
  psychiatric jsonb,
  inpatient jsonb,
  access_notes text,
  review_status text not null default 'pending',
  verification_status text not null default 'unverified',
  mappable boolean not null default true,
  match_conflict boolean not null default false,
  validation_severity text,
  validation_messages jsonb not null default '[]',
  source_file_name text,
  source_row_number integer,
  import_batch_id text,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- staging_rural_services table
create table if not exists public.staging_rural_services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  city text,
  county text,
  street_address text,
  state text default 'NV',
  zip text,
  phone text,
  website text,
  latitude double precision,
  longitude double precision,
  notes text,
  access_notes text,
  operational jsonb,
  operational_service_class text,
  bh_category_mapped text,
  bh_entity_type text,
  bh_service_type text,
  service_tags text,
  review_status text not null default 'pending',
  verification_status text not null default 'unverified',
  mappable boolean not null default true,
  match_conflict boolean not null default false,
  validation_severity text,
  validation_messages jsonb not null default '[]',
  source_file_name text,
  source_row_number integer,
  import_batch_id text,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at triggers
create trigger staging_facilities_updated_at
  before update on public.staging_facilities
  for each row execute function public.handle_updated_at();

create trigger staging_rural_services_updated_at
  before update on public.staging_rural_services
  for each row execute function public.handle_updated_at();

-- RLS
alter table public.staging_facilities enable row level security;
alter table public.staging_rural_services enable row level security;

create policy "Authenticated users can read staging_facilities"
  on public.staging_facilities for select
  to authenticated using (true);

create policy "Authenticated users can insert staging_facilities"
  on public.staging_facilities for insert
  to authenticated with check (true);

create policy "Authenticated users can update staging_facilities"
  on public.staging_facilities for update
  to authenticated using (true);

create policy "Authenticated users can read staging_rural_services"
  on public.staging_rural_services for select
  to authenticated using (true);

create policy "Authenticated users can insert staging_rural_services"
  on public.staging_rural_services for insert
  to authenticated with check (true);

create policy "Authenticated users can update staging_rural_services"
  on public.staging_rural_services for update
  to authenticated using (true);
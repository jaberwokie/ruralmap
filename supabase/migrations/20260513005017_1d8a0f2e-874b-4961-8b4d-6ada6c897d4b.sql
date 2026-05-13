create table if not exists public.facilities (
  id text primary key,
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
  lat double precision,
  lng double precision,
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rural_services (
  id text primary key,
  name text not null,
  category text not null,
  county text,
  city text,
  street_address text,
  state text default 'NV',
  zip text,
  phone text,
  website text,
  notes text,
  lat double precision,
  lng double precision,
  bh_category_mapped text,
  bh_entity_type text,
  bh_service_type text,
  service_tags text,
  operational jsonb,
  operational_service_class text,
  access_notes text,
  review_status text not null default 'pending',
  verification_status text not null default 'unverified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger facilities_updated_at
  before update on public.facilities
  for each row execute function public.handle_updated_at();

create trigger rural_services_updated_at
  before update on public.rural_services
  for each row execute function public.handle_updated_at();

alter table public.facilities enable row level security;
alter table public.rural_services enable row level security;

create policy "Authenticated users can read facilities"
  on public.facilities for select
  to authenticated
  using (true);

create policy "Authenticated users can update facilities"
  on public.facilities for update
  to authenticated
  using (true);

create policy "Authenticated users can insert facilities"
  on public.facilities for insert
  to authenticated
  with check (true);

create policy "Authenticated users can read rural_services"
  on public.rural_services for select
  to authenticated
  using (true);

create policy "Authenticated users can update rural_services"
  on public.rural_services for update
  to authenticated
  using (true);

create policy "Authenticated users can insert rural_services"
  on public.rural_services for insert
  to authenticated
  with check (true);
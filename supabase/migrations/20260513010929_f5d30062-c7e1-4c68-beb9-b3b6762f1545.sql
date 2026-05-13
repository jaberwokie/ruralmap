alter table public.facilities
  add column if not exists mappable boolean not null default true;

alter table public.rural_services
  add column if not exists mappable boolean not null default true;
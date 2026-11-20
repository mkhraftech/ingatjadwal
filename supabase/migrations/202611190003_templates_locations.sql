create table if not exists public.facility_locations (
  id uuid primary key default gen_random_uuid(),
  uid uuid not null unique default gen_random_uuid(),
  facility_id uuid not null references public.facilities on delete cascade,
  name text not null check (char_length(name) between 2 and 100),
  active boolean not null default true,
  created_by uuid references auth.users on delete set null default auth.uid(),
  updated_by uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users on delete set null,
  unique (id, facility_id)
);

create unique index if not exists facility_locations_name_active_idx
  on public.facility_locations (facility_id, lower(name)) where deleted_at is null;
create index if not exists facility_locations_facility_idx
  on public.facility_locations (facility_id, name) where active and deleted_at is null;

alter table public.appointments add column if not exists location_id uuid;
do $$ begin
  alter table public.appointments add constraint appointments_location_facility_fkey
    foreign key (location_id, facility_id) references public.facility_locations(id, facility_id);
exception when duplicate_object then null;
end $$;

alter table public.facility_locations enable row level security;
create policy locations_read on public.facility_locations for select to authenticated
  using (public.is_facility_member(facility_id));
create policy locations_manage on public.facility_locations for all to authenticated
  using (public.can_manage_facility(facility_id)) with check (public.can_manage_facility(facility_id));
grant select, insert, update on public.facility_locations to authenticated;

insert into public.facility_locations (facility_id, name)
select id, 'Ruang Terapi 1' from public.facilities where deleted_at is null
on conflict do nothing;

create or replace function public.seed_default_facility_location() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.facility_locations(facility_id, name) values (new.id, 'Ruang Terapi 1')
  on conflict do nothing;
  return new;
end;
$$;
create trigger facilities_seed_default_location after insert on public.facilities
for each row execute function public.seed_default_facility_location();

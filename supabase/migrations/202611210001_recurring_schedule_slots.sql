create table public.facility_schedule_slots (
  id uuid primary key default gen_random_uuid(),
  uid uuid not null unique default gen_random_uuid(),
  facility_id uuid not null references public.facilities on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  slot_time time not null,
  created_by uuid references auth.users on delete set null default auth.uid(),
  updated_by uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users on delete set null
);

create unique index facility_schedule_slots_unique_active_idx
  on public.facility_schedule_slots (facility_id, weekday, slot_time)
  where deleted_at is null;
create index facility_schedule_slots_facility_day_idx
  on public.facility_schedule_slots (facility_id, weekday, slot_time)
  where deleted_at is null;

alter table public.facility_schedule_slots enable row level security;

create policy schedule_slots_read on public.facility_schedule_slots for select to authenticated
  using (public.is_facility_member(facility_id));
create policy schedule_slots_manage on public.facility_schedule_slots for all to authenticated
  using (public.can_manage_facility(facility_id))
  with check (public.can_manage_facility(facility_id));

grant select, insert, update on public.facility_schedule_slots to authenticated;

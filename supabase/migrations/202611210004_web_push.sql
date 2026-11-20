create table public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  facility_id uuid not null references public.facilities on delete cascade,
  endpoint text not null unique check (length(endpoint) <= 2048),
  p256dh text not null,
  auth_key text not null,
  last_test_at timestamptz
);

create table public.push_deliveries (
  device_id uuid not null references public.push_devices on delete cascade,
  reminder_id uuid not null references public.reminder_tasks(id) on delete cascade,
  due_at timestamptz not null,
  primary key (device_id, reminder_id, due_at)
);

alter table public.push_devices enable row level security;
alter table public.push_deliveries enable row level security;
revoke all on public.push_devices, public.push_deliveries from public, anon, authenticated;
grant select, insert, update, delete on public.push_devices to authenticated;
create policy own_push_devices on public.push_devices for all to authenticated
  using (user_id = (select auth.uid()) and public.is_facility_member(facility_id))
  with check (user_id = (select auth.uid()) and public.is_facility_member(facility_id));

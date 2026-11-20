-- Business records use soft deletion so historical and audit data remain available.
alter table public.facilities
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users on delete set null;
alter table public.facility_memberships
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users on delete set null;
alter table public.patients
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users on delete set null;
alter table public.therapy_programs
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users on delete set null;
alter table public.appointments
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users on delete set null;
alter table public.message_templates
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users on delete set null;
alter table public.reminder_tasks
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users on delete set null;

create index if not exists facilities_active_idx on public.facilities(id) where deleted_at is null;
create index if not exists memberships_active_idx on public.facility_memberships(user_id, created_at) where active and deleted_at is null;
create index if not exists patients_active_idx on public.patients(facility_id, display_name) where active and deleted_at is null;
create index if not exists appointments_not_deleted_idx on public.appointments(facility_id, starts_at) where deleted_at is null;
create index if not exists reminder_tasks_not_deleted_idx on public.reminder_tasks(facility_id, due_at) where deleted_at is null;

create or replace function public.sync_appointment_reminders() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare facility_tz text;
begin
 select timezone into facility_tz from public.facilities where id=new.facility_id and deleted_at is null;
 if new.deleted_at is not null or new.status not in ('scheduled','confirmed') then
  update public.reminder_tasks set status='cancelled',updated_at=now(),
   deleted_at=case when new.deleted_at is not null then coalesce(deleted_at,now()) else deleted_at end,
   deleted_by=case when new.deleted_at is not null then coalesce(deleted_by,auth.uid()) else deleted_by end
   where appointment_id=new.id and (new.deleted_at is not null or status in ('pending','follow_up','opened_whatsapp'));
  return new;
 end if;
 insert into public.reminder_tasks(facility_id,appointment_id,stage,due_at)
 select new.facility_id,new.id,stage,
  ((((new.starts_at at time zone facility_tz)::date-offset_days)::timestamp+time '09:00') at time zone facility_tz)
 from (values ('h2'::public.reminder_stage,2),('h1'::public.reminder_stage,1),('day_of'::public.reminder_stage,0)) as reminder(stage,offset_days)
 on conflict(appointment_id,stage) do update set due_at=excluded.due_at,status='pending',handled_by=null,handled_at=null,updated_at=now(),deleted_at=null,deleted_by=null;
 return new;
end;
$$;

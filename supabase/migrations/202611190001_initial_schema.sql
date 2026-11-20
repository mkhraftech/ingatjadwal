create extension if not exists pgcrypto with schema extensions;

create type public.facility_role as enum ('owner', 'admin', 'staff');
create type public.appointment_status as enum ('scheduled', 'confirmed', 'attended', 'no_show', 'forfeited', 'cancelled', 'rescheduled');
create type public.reminder_stage as enum ('h2', 'h1', 'day_of');
create type public.reminder_status as enum ('pending', 'opened_whatsapp', 'sent', 'confirmed', 'follow_up', 'cancelled');

create table public.facilities (
 id uuid primary key default gen_random_uuid(), uid uuid not null unique default gen_random_uuid(),
 name text not null check (char_length(name) between 2 and 120),
 timezone text not null default 'Asia/Jakarta', contact_phone text, created_at timestamptz not null default now()
);
create table public.facility_memberships (
 id uuid primary key default gen_random_uuid(), facility_id uuid not null references public.facilities on delete cascade,
 user_id uuid not null references auth.users on delete cascade, role public.facility_role not null default 'staff',
 active boolean not null default true, created_at timestamptz not null default now(), unique(facility_id,user_id)
);
create table public.patients (
 id uuid primary key default gen_random_uuid(), uid uuid not null unique default gen_random_uuid(),
 facility_id uuid not null references public.facilities on delete cascade,
 display_name text not null check (char_length(display_name) between 2 and 120),
 phone_e164 text not null check (phone_e164 ~ '^[1-9][0-9]{7,14}$'), medical_record_ref text,
 active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(id,facility_id)
);
create table public.therapy_programs (
 id uuid primary key default gen_random_uuid(), uid uuid not null unique default gen_random_uuid(),
 facility_id uuid not null references public.facilities on delete cascade, patient_id uuid not null,
 name text not null default 'Program terapi', period_start date not null, period_end date not null,
 target_sessions smallint not null default 4 check (target_sessions between 1 and 31),
 status text not null default 'active' check (status in ('active','completed','cancelled')),
 created_at timestamptz not null default now(), check (period_end >= period_start), unique(id,facility_id),
 foreign key(patient_id,facility_id) references public.patients(id,facility_id)
);
create table public.appointments (
 id uuid primary key default gen_random_uuid(), uid uuid not null unique default gen_random_uuid(),
 facility_id uuid not null references public.facilities on delete cascade, patient_id uuid not null, program_id uuid,
 starts_at timestamptz not null, duration_minutes smallint not null check(duration_minutes between 15 and 240),
 location text not null default 'Unit Rehabilitasi', service_label text not null default 'Terapi rehabilitasi',
 status public.appointment_status not null default 'scheduled', rescheduled_from_id uuid references public.appointments,
 created_by uuid references auth.users on delete set null default auth.uid(),
 updated_by uuid references auth.users on delete set null default auth.uid(),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,facility_id),
 foreign key(patient_id,facility_id) references public.patients(id,facility_id),
 foreign key(program_id,facility_id) references public.therapy_programs(id,facility_id)
);
create table public.message_templates (
 id uuid primary key default gen_random_uuid(), facility_id uuid not null references public.facilities on delete cascade,
 stage public.reminder_stage not null, body text not null check(char_length(body) between 1 and 2000),
 active boolean not null default true, updated_by uuid references auth.users on delete set null default auth.uid(),
 updated_at timestamptz not null default now(), unique(facility_id,stage)
);
create table public.reminder_tasks (
 id uuid primary key default gen_random_uuid(), uid uuid not null unique default gen_random_uuid(),
 facility_id uuid not null references public.facilities on delete cascade, appointment_id uuid not null,
 stage public.reminder_stage not null, due_at timestamptz not null,
 status public.reminder_status not null default 'pending', assigned_to uuid references auth.users on delete set null,
 handled_by uuid references auth.users on delete set null, handled_at timestamptz, updated_at timestamptz not null default now(),
 foreign key(appointment_id,facility_id) references public.appointments(id,facility_id), unique(appointment_id,stage)
);
create function public.sync_appointment_reminders() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare facility_tz text;
begin
 select timezone into facility_tz from public.facilities where id=new.facility_id;
 if new.status not in ('scheduled','confirmed') then
  update public.reminder_tasks set status='cancelled',updated_at=now()
   where appointment_id=new.id and status in ('pending','follow_up','opened_whatsapp');
  return new;
 end if;
 insert into public.reminder_tasks(facility_id,appointment_id,stage,due_at)
 select new.facility_id,new.id,stage,
  ((((new.starts_at at time zone facility_tz)::date-offset_days)::timestamp+time '09:00') at time zone facility_tz)
 from (values ('h2'::public.reminder_stage,2),('h1'::public.reminder_stage,1),('day_of'::public.reminder_stage,0)) as reminder(stage,offset_days)
 on conflict(appointment_id,stage) do update set due_at=excluded.due_at,status='pending',handled_by=null,handled_at=null,updated_at=now();
 return new;
end;
$$;
create trigger appointments_sync_reminders after insert or update of starts_at,status on public.appointments
for each row execute function public.sync_appointment_reminders();
create table public.audit_events (
 id bigint generated always as identity primary key, facility_id uuid not null references public.facilities on delete cascade,
 actor_id uuid references auth.users on delete set null default auth.uid(), entity_type text not null,
 entity_id uuid not null, action text not null, before_state jsonb, after_state jsonb, created_at timestamptz not null default now()
);
create function public.audit_appointment_change() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
 insert into public.audit_events(facility_id,actor_id,entity_type,entity_id,action,before_state,after_state)
 values(new.facility_id,auth.uid(),'appointment',new.uid,lower(tg_op),
  case when tg_op='INSERT' then null else to_jsonb(old)-'id' end,to_jsonb(new)-'id');
 return new;
end;
$$;
create trigger appointments_audit after insert or update on public.appointments
for each row execute function public.audit_appointment_change();

create index patients_facility_name_idx on public.patients(facility_id,display_name) where active;
create index appointments_facility_start_idx on public.appointments(facility_id,starts_at) where status in ('scheduled','confirmed');
create index reminder_due_idx on public.reminder_tasks(facility_id,due_at) where status in ('pending','follow_up');
create index audit_facility_created_idx on public.audit_events(facility_id,created_at desc);

create function public.is_facility_member(target_facility uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.facility_memberships m where m.facility_id=target_facility and m.user_id=(select auth.uid()) and m.active); $$;
create function public.can_manage_facility(target_facility uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.facility_memberships m where m.facility_id=target_facility and m.user_id=(select auth.uid()) and m.active and m.role in ('owner','admin')); $$;
revoke all on function public.is_facility_member(uuid) from public;
revoke all on function public.can_manage_facility(uuid) from public;
grant execute on function public.is_facility_member(uuid) to authenticated;
grant execute on function public.can_manage_facility(uuid) to authenticated;

alter table public.facilities enable row level security;
alter table public.facility_memberships enable row level security;
alter table public.patients enable row level security;
alter table public.therapy_programs enable row level security;
alter table public.appointments enable row level security;
alter table public.message_templates enable row level security;
alter table public.reminder_tasks enable row level security;
alter table public.audit_events enable row level security;

create policy facility_read on public.facilities for select to authenticated using(public.is_facility_member(id));
create policy facility_update on public.facilities for update to authenticated using(public.can_manage_facility(id)) with check(public.can_manage_facility(id));
create policy memberships_read on public.facility_memberships for select to authenticated using(user_id=(select auth.uid()) or public.can_manage_facility(facility_id));
create policy memberships_admin on public.facility_memberships for all to authenticated using(public.can_manage_facility(facility_id)) with check(public.can_manage_facility(facility_id));
create policy patients_read on public.patients for select to authenticated using(public.is_facility_member(facility_id));
create policy patients_insert on public.patients for insert to authenticated with check(public.is_facility_member(facility_id));
create policy patients_update on public.patients for update to authenticated using(public.is_facility_member(facility_id)) with check(public.is_facility_member(facility_id));
create policy programs_access on public.therapy_programs for all to authenticated using(public.is_facility_member(facility_id)) with check(public.is_facility_member(facility_id));
create policy appointments_access on public.appointments for all to authenticated using(public.is_facility_member(facility_id)) with check(public.is_facility_member(facility_id));
create policy templates_read on public.message_templates for select to authenticated using(public.is_facility_member(facility_id));
create policy templates_admin on public.message_templates for all to authenticated using(public.can_manage_facility(facility_id)) with check(public.can_manage_facility(facility_id));
create policy reminders_access on public.reminder_tasks for all to authenticated using(public.is_facility_member(facility_id)) with check(public.is_facility_member(facility_id));
create policy audit_read on public.audit_events for select to authenticated using(public.is_facility_member(facility_id));
create policy audit_insert on public.audit_events for insert to authenticated with check(public.is_facility_member(facility_id) and actor_id=(select auth.uid()));

grant usage on schema public to authenticated;
grant select,insert,update on public.facilities,public.facility_memberships,public.patients,public.therapy_programs,public.appointments,public.message_templates,public.reminder_tasks,public.audit_events to authenticated;
grant usage,select on sequence public.audit_events_id_seq to authenticated;

create function public.create_initial_facility(facility_name text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare new_facility_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  if exists(select 1 from public.facility_memberships where user_id=auth.uid() and active) then
    raise exception 'User already belongs to a facility';
  end if;
  if char_length(trim(facility_name)) not between 2 and 120 then raise exception 'Facility name is invalid'; end if;
  insert into public.facilities(name) values(trim(facility_name)) returning id into new_facility_id;
  insert into public.facility_memberships(facility_id,user_id,role) values(new_facility_id,auth.uid(),'owner');
  return new_facility_id;
end;
$$;
revoke all on function public.create_initial_facility(text) from public;
grant execute on function public.create_initial_facility(text) to authenticated;


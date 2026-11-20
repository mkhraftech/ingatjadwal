alter table public.facility_schedule_slots add column slot_end time;
update public.facility_schedule_slots set slot_end = slot_time + interval '60 minutes';
alter table public.facility_schedule_slots
  alter column slot_end set not null,
  add constraint schedule_slot_duration_check check (
    mod(extract(epoch from (slot_end - slot_time)) + 86400, 86400) between 900 and 14400
  );

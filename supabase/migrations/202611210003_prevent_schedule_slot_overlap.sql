create extension if not exists btree_gist with schema extensions;
set local search_path = public, extensions;

create function public.schedule_slot_week_range(
  weekday smallint, starts_at time, ends_at time
) returns int4multirange
language sql immutable strict set search_path = ''
as $$
  with boundaries as (
    select (weekday - 1) * 86400 + extract(epoch from starts_at)::int as first_second,
           mod(extract(epoch from ends_at - starts_at)::int + 86400, 86400) as duration
  )
  select case when first_second + duration <= 604800
    then int4multirange(int4range(first_second, first_second + duration))
    else int4multirange(
      int4range(first_second, 604800),
      int4range(0, first_second + duration - 604800)
    )
  end
  from boundaries;
$$;

alter table public.facility_schedule_slots
  add constraint facility_schedule_slots_no_overlap
  exclude using gist (
    facility_id with =,
    (public.schedule_slot_week_range(weekday, slot_time, slot_end)) with &&
  ) where (deleted_at is null);

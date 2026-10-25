begin;

alter table public.trips
  add column if not exists version integer not null default 1;

create or replace function public.bump_trip_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.version := old.version + 1;
  return new;
end;
$$;

drop trigger if exists trips_bump_version on public.trips;

create trigger trips_bump_version
before update on public.trips
for each row
execute function public.bump_trip_version();

create or replace function public.add_place_to_trip(
  p_trip_id uuid,
  p_place_id uuid,
  p_day integer
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_trip public.trips%rowtype;
  selected_place public.places%rowtype;
  entry_text text;
  existing_plan text;
  next_plan text;
begin
  if auth.uid() is null then
    raise exception 'Please log in before adding a place.';
  end if;

  -- Lock this trip while appending to its current itinerary.
  select *
  into selected_trip
  from public.trips
  where id = p_trip_id
    and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'This trip is unavailable. Reload your trips.';
  end if;

  if p_day is null
     or p_day < 1
     or p_day > selected_trip.days then
    raise exception 'This day is unavailable. Reload your trips.';
  end if;

  select *
  into selected_place
  from public.places
  where id = p_place_id
    and published = true;

  if not found then
    raise exception 'This place is no longer available.';
  end if;

  entry_text :=
    'Visit ' || selected_place.name ||
    ' — ' || selected_place.destination;

  existing_plan := coalesce(
    selected_trip.itinerary[p_day],
    ''
  );

  -- A repeated click or retry does not add the same line twice.
  if entry_text = any(
    string_to_array(existing_plan, E'\n')
  ) then
    return 'already_added';
  end if;

  next_plan := concat_ws(
    E'\n',
    nullif(rtrim(existing_plan), ''),
    entry_text
  );

  if char_length(next_plan) > 3000 then
    raise exception
      'This day is full. Shorten its plan before adding another place.';
  end if;

  selected_trip.itinerary[p_day] := next_plan;

  update public.trips
  set itinerary = selected_trip.itinerary
  where id = selected_trip.id
    and user_id = auth.uid();

  return 'added';
end;
$$;

revoke all on function public.add_place_to_trip(uuid, uuid, integer)
from public, anon;

grant execute on function public.add_place_to_trip(uuid, uuid, integer)
to authenticated;

commit;
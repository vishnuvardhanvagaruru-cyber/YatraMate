begin;

-- Normalise case, whitespace, and common spaced dash separators so manually
-- formatted copies of an existing place entry are recognised as duplicates.
create or replace function public.normalize_trip_entry(p_entry text)
returns text
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  select regexp_replace(
    regexp_replace(lower(btrim(p_entry)), '[[:space:]]+', ' ', 'g'),
    ' [-–] ',
    ' — ',
    'g'
  );
$$;

revoke all on function public.normalize_trip_entry(text)
  from public, anon;
grant execute on function public.normalize_trip_entry(text)
  to authenticated;

-- The picker receives the trip version. The add operation checks that version
-- again under a row lock, so a stale open picker cannot target a changed date.
drop function if exists public.matching_trips_for_place(uuid);

create function public.matching_trips_for_place(p_place_id uuid)
returns table (
  id uuid,
  destination text,
  start_date date,
  days integer,
  version integer
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  place_key text;
begin
  if auth.uid() is null then
    raise exception 'Please log in to view your trips.';
  end if;

  select public.destination_match_key(p.destination)
  into place_key
  from public.places as p
  where p.id = p_place_id and p.published = true;

  if not found or place_key is null or place_key = '' then
    raise exception 'This place is no longer available.';
  end if;

  return query
  select t.id, t.destination, t.start_date, t.days, t.version
  from public.trips as t
  where t.user_id = auth.uid()
    and public.destination_match_key(t.destination) = place_key
  order by t.start_date desc, t.id;
end;
$$;

revoke all on function public.matching_trips_for_place(uuid)
  from public, anon;
grant execute on function public.matching_trips_for_place(uuid)
  to authenticated;

drop function if exists public.add_place_to_trip(uuid, uuid, integer);

create function public.add_place_to_trip(
  p_trip_id uuid,
  p_place_id uuid,
  p_day integer,
  p_expected_version integer
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
  normalized_entry text;
begin
  if auth.uid() is null then
    raise exception 'Please log in before adding a place.';
  end if;

  -- Lock this user's trip while checking its version and appending the place.
  select *
  into selected_trip
  from public.trips
  where id = p_trip_id
    and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'This trip is unavailable. Reload your trips.';
  end if;

  if p_expected_version is null
     or selected_trip.version is distinct from p_expected_version then
    raise exception
      'This trip changed while you were choosing a day. Reload your trips and choose again.';
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

  if public.destination_match_key(selected_trip.destination)
       is distinct from
       public.destination_match_key(selected_place.destination)
     or public.destination_match_key(selected_place.destination) = '' then
    raise exception
      'This place does not match the trip destination. Choose a matching trip.';
  end if;

  entry_text :=
    'Visit ' || selected_place.name ||
    ' — ' || selected_place.destination;
  normalized_entry := public.normalize_trip_entry(entry_text);

  existing_plan := coalesce(
    selected_trip.itinerary[p_day],
    ''
  );

  -- Check each line while holding the trip lock. This also makes a retry safe.
  if exists (
    select 1
    from unnest(string_to_array(existing_plan, E'\n')) as plan_line(value)
    where public.normalize_trip_entry(plan_line.value) = normalized_entry
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

revoke all on function public.add_place_to_trip(uuid, uuid, integer, integer)
  from public, anon;
grant execute on function public.add_place_to_trip(uuid, uuid, integer, integer)
  to authenticated;

-- Sanity checks for duplicate normalisation. They run before commit.
do $$
begin
  if public.normalize_trip_entry('  VISIT   Charminar – Hyderabad  ')
       <> public.normalize_trip_entry('Visit Charminar — Hyderabad') then
    raise exception 'Equivalent place-entry formatting did not match.';
  end if;

  if public.normalize_trip_entry('Visit Charminar — Hyderabad')
       = public.normalize_trip_entry('Visit Golconda Fort — Hyderabad') then
    raise exception 'Different places were incorrectly treated as duplicates.';
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;

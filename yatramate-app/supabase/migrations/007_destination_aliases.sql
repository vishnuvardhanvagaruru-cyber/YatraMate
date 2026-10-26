begin;

-- A small, explicit alias list. App users can read but cannot edit it.
create table if not exists public.destination_aliases (
  alias text primary key check (length(btrim(alias)) > 0),
  canonical_key text not null check (length(btrim(canonical_key)) > 0)
);

alter table public.destination_aliases enable row level security;

revoke all on public.destination_aliases from public, anon, authenticated;
grant select on public.destination_aliases to authenticated;

drop policy if exists "Read destination aliases"
  on public.destination_aliases;

create policy "Read destination aliases"
  on public.destination_aliases
  for select to authenticated
  using (true);

insert into public.destination_aliases (alias, canonical_key)
values
  ('manali', 'manali'),
  ('manali india', 'manali'),
  ('manali himachal pradesh', 'manali'),
  ('manali himachal pradesh india', 'manali'),
  ('manali hp', 'manali'),
  ('manali hp india', 'manali'),
  ('hyderabad', 'hyderabad'),
  ('hyderabad india', 'hyderabad'),
  ('hyderabad telangana', 'hyderabad'),
  ('hyderabad telangana india', 'hyderabad'),
  ('hyderabad ts', 'hyderabad'),
  ('hyderabad ts india', 'hyderabad'),
  ('hyderabad tg', 'hyderabad'),
  ('hyderabad tg india', 'hyderabad'),
  ('goa', 'goa'),
  ('goa india', 'goa'),
  ('jaipur', 'jaipur'),
  ('jaipur india', 'jaipur'),
  ('jaipur rajasthan', 'jaipur'),
  ('jaipur rajasthan india', 'jaipur'),
  ('jaipur rj', 'jaipur'),
  ('jaipur rj india', 'jaipur'),
  ('tirupati', 'tirupati'),
  ('tirupati india', 'tirupati'),
  ('tirupati andhra pradesh', 'tirupati'),
  ('tirupati andhra pradesh india', 'tirupati'),
  ('tirupati ap', 'tirupati'),
  ('tirupati ap india', 'tirupati'),
  ('munnar', 'munnar'),
  ('munnar india', 'munnar'),
  ('munnar kerala', 'munnar'),
  ('munnar kerala india', 'munnar'),
  ('munnar kl', 'munnar'),
  ('munnar kl india', 'munnar')
on conflict (alias) do nothing;

-- Unknown names must still match in full; no fuzzy or substring matching.
create or replace function public.destination_match_key(p_destination text)
returns text
language plpgsql
stable
strict
security invoker
set search_path = ''
as $$
declare
  normalized text;
  mapped text;
begin
  normalized := lower(btrim(regexp_replace(
    p_destination, '[[:space:],]+', ' ', 'g'
  )));

  select a.canonical_key into mapped
  from public.destination_aliases as a
  where a.alias = normalized;

  return coalesce(mapped, normalized);
end;
$$;

revoke all on function public.destination_match_key(text)
  from public, anon;
grant execute on function public.destination_match_key(text)
  to authenticated;

-- Both the picker and the add operation use the same matching function.
create or replace function public.matching_trips_for_place(p_place_id uuid)
returns table (
  id uuid,
  destination text,
  start_date date,
  days integer
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
  select t.id, t.destination, t.start_date, t.days
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

  if public.destination_match_key(selected_trip.destination)
       is distinct from
       public.destination_match_key(selected_place.destination)
     or public.destination_match_key(selected_place.destination) = '' then
    raise exception 'This place does not match the trip destination. Choose a matching trip.';
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


-- These checks run inside the transaction when you execute this migration.
-- If one fails, none of this migration is committed.
do $$
begin
  if public.destination_match_key(' MANALI, India ') <> 'manali'
     or public.destination_match_key('Manali, Himachal Pradesh, India') <> 'manali'
     or public.destination_match_key('HYDERABAD, Telangana') <> 'hyderabad'
     or public.destination_match_key('Jaipur, Rajasthan, India') <> 'jaipur'
     or public.destination_match_key('Tirupati, AP') <> 'tirupati'
     or public.destination_match_key('Munnar, Kerala') <> 'munnar'
     or public.destination_match_key('Goa, India') <> 'goa' then
    raise exception 'A recognised destination alias did not match.';
  end if;

  if public.destination_match_key('Hyderabad') =
       public.destination_match_key('Goa')
     or public.destination_match_key('Hyderabad, Pakistan') =
       public.destination_match_key('Hyderabad')
     or public.destination_match_key('Goa Velha') =
       public.destination_match_key('Goa')
     or public.destination_match_key('Manalii') =
       public.destination_match_key('Manali') then
    raise exception 'An unrelated destination was incorrectly matched.';
  end if;

  if public.destination_match_key('  NEW   DELHI  ') <>
       public.destination_match_key('New Delhi') then
    raise exception 'Whitespace matching failed.';
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;

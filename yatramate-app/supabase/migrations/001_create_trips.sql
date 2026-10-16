begin;

-- Store each trip and its daily itinerary.
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,

  destination text not null
    check (char_length(trim(destination)) between 1 and 100),

  start_date date not null,
  days integer not null check (days between 1 and 30),
  travelers integer not null check (travelers between 1 and 50),
  budget numeric(12, 2) not null
    check (budget between 0 and 100000000),

  itinerary text[] not null,
  created_at timestamptz not null default now(),

  constraint itinerary_matches_days
    check (cardinality(itinerary) = days)
);

-- Speed up loading a user's saved trips.
create index trips_user_id_idx on public.trips(user_id);

-- Enable privacy rules.
alter table public.trips enable row level security;

-- Visitors must sign in before accessing trips.
revoke all on table public.trips from anon, authenticated;

grant select, insert, update, delete
  on table public.trips to authenticated;

create policy "Read own trips"
  on public.trips
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Create own trips"
  on public.trips
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Update own trips"
  on public.trips
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Delete own trips"
  on public.trips
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

commit;
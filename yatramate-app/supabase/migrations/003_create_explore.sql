begin;

-- Places maintained by you through the Supabase dashboard.
create table public.places (
  id uuid primary key default gen_random_uuid(),
  destination text not null
    check (char_length(trim(destination)) between 1 and 100),
  name text not null
    check (char_length(trim(name)) between 1 and 200),
  category text not null
    check (
      category in (
        'attraction',
        'food',
        'hotel',
        'temple',
        'shopping',
        'transport'
      )
    ),
  description text not null default '',
  address text not null default '',
  maps_query text not null
    check (char_length(trim(maps_query)) between 1 and 500),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  unique (destination, name)
);

create index places_destination_category_idx
  on public.places (destination, category);

alter table public.places enable row level security;

revoke all on table public.places from anon, authenticated;
grant select on table public.places to anon, authenticated;

-- Visitors can see only published entries.
-- There are no browser-facing write policies for this table.
create policy "Read published places"
  on public.places
  for select
  to anon, authenticated
  using (published = true);


-- Each account has its own private favorites.
create table public.saved_places (
  user_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  place_id uuid not null
    references public.places(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

create index saved_places_place_id_idx
  on public.saved_places (place_id);

alter table public.saved_places enable row level security;

revoke all on table public.saved_places from anon, authenticated;
grant select, insert, delete
  on table public.saved_places to authenticated;

create policy "Read own saved places"
  on public.saved_places
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Save published places"
  on public.saved_places
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.places
      where places.id = saved_places.place_id
        and places.published = true
    )
  );

create policy "Remove own saved places"
  on public.saved_places
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

commit;
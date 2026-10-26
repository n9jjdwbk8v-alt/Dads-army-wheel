-- Dads Army: one shared team, synced between phones.
--
-- How it fits together
--   * Each phone signs in anonymously (Supabase Auth > Sign In / Providers > Anonymous must be switched on), then
--     picks its name from the roster. That links the phone (auth user) to a player: a row in `sessions`.
--   * The app's saved data is kept as it is on the phone today: one JSON document per section
--     (players, teams, history, gameday, fees) in `team_state`. The last save of a section wins.
--   * People are players from the roster with a role (admin or player) and optional permission overrides.
--     Admins sign in with a PIN; players just tap their name.
--   * Phones read `team_state` directly (row level security decides what each person may see) and save through
--     `save_section`, which checks what that person may change.
--   * The first phone to connect uploads what it has with `create_team`, and becomes the first admin.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------------------------

-- The app is for one team, so there is only ever one row.
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  only_one boolean not null default true unique check (only_one),
  name text not null,
  -- What players (not admins) can do unless an admin changes it for one person.
  default_permissions jsonb not null default '{
    "here": true,
    "roster": false,
    "split": true,
    "seeFees": false,
    "editFees": false,
    "gameday": false,
    "history": true
  }'::jsonb,
  created_at timestamptz not null default now()
);

-- The app's saved data, one JSON document per section, exactly as each phone stores it.
create table public.team_state (
  team_id uuid not null references public.teams (id) on delete cascade,
  section text not null check (section in ('players', 'teams', 'history', 'gameday', 'fees')),
  data jsonb not null,
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  primary key (team_id, section)
);

-- Everyone on the roster who has a role or their own permissions. Someone on the roster with no row here is a
-- player with the team's default permissions.
create table public.people (
  team_id uuid not null references public.teams (id) on delete cascade,
  player_id text not null,
  role text not null default 'player' check (role in ('admin', 'player')),
  -- Only the permissions that differ from the team's defaults, e.g. {"seeFees": true}.
  permissions jsonb not null default '{}'::jsonb,
  -- bcrypt hash of an admin's PIN. Never readable by phones.
  pin_hash text,
  created_at timestamptz not null default now(),
  primary key (team_id, player_id)
);

-- Which person each signed-in phone is.
create table public.sessions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  team_id uuid not null,
  player_id text not null,
  created_at timestamptz not null default now(),
  foreign key (team_id, player_id) references public.people (team_id, player_id) on delete cascade
);

create index sessions_person_idx on public.sessions (team_id, player_id);

-- ---------------------------------------------------------------------------------------------------------------
-- Helpers (used by the policies and functions below)
-- ---------------------------------------------------------------------------------------------------------------

-- The person this phone is signed in as, if any.
create function public.my_session()
returns public.sessions
language sql
stable
security definer
set search_path = ''
as $$
  select s.* from public.sessions s where s.user_id = auth.uid();
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.sessions s
    join public.people p on p.team_id = s.team_id and p.player_id = s.player_id
    where s.user_id = auth.uid() and p.role = 'admin'
  );
$$;

-- Whether this phone's person may do `perm`. Admins may do everything.
create function public.has_perm(perm text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select case
        when p.role = 'admin' then true
        else coalesce((p.permissions ->> perm)::boolean, (t.default_permissions ->> perm)::boolean, false)
      end
      from public.sessions s
      join public.teams t on t.id = s.team_id
      join public.people p on p.team_id = s.team_id and p.player_id = s.player_id
      where s.user_id = auth.uid()
    ),
    false
  );
$$;

-- Whether a player id is on the team's roster (the `players` section).
create function public.on_roster(p_team uuid, p_player_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.team_state ts, jsonb_array_elements(ts.data) as pl
    where ts.team_id = p_team and ts.section = 'players' and pl ->> 'id' = p_player_id
  );
$$;

-- Hashes a PIN, after checking it is 4 to 8 digits.
create function public.hash_pin(p_pin text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_pin is null or p_pin !~ '^[0-9]{4,8}$' then
    raise exception 'PIN must be 4 to 8 digits' using errcode = '22023';
  end if;
  return extensions.crypt(p_pin, extensions.gen_salt('bf'));
end;
$$;

create function public.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can do that' using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Setting up and signing in
-- ---------------------------------------------------------------------------------------------------------------

-- The first phone uploads what it has saved, and its person becomes the first admin.
-- `p_sections` is {"players": [...], "teams": {...}, "history": [...], "gameday": {...}, "fees": {...}}.
create function public.create_team(p_name text, p_sections jsonb, p_admin_player_id text, p_pin text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_team uuid;
  v_section text;
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  if exists (select 1 from public.teams) then
    raise exception 'The team is already set up' using errcode = '23505';
  end if;
  if jsonb_typeof(p_sections -> 'players') is distinct from 'array' then
    raise exception 'The upload needs the roster' using errcode = '22023';
  end if;

  insert into public.teams (name) values (coalesce(nullif(trim(p_name), ''), 'Dads Army')) returning id into v_team;

  for v_section in select jsonb_object_keys(p_sections) loop
    if v_section in ('players', 'teams', 'history', 'gameday', 'fees') then
      insert into public.team_state (team_id, section, data, updated_by)
      values (v_team, v_section, p_sections -> v_section, auth.uid());
    end if;
  end loop;

  if not public.on_roster(v_team, p_admin_player_id) then
    raise exception 'The first admin must be on the roster' using errcode = '22023';
  end if;

  insert into public.people (team_id, player_id, role, pin_hash)
  values (v_team, p_admin_player_id, 'admin', public.hash_pin(p_pin));
  insert into public.sessions (user_id, team_id, player_id) values (auth.uid(), v_team, p_admin_player_id);
  return v_team;
end;
$$;

-- The "Who are you?" list: everyone on the roster, which of them are admins, and who has a phone signed in.
-- Open to any signed-in phone, including one that hasn't picked a name yet.
create function public.list_people()
returns table (player_id text, name text, role text, needs_pin boolean, signed_in boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    pl ->> 'id',
    pl ->> 'name',
    coalesce(p.role, 'player'),
    coalesce(p.role = 'admin' and p.pin_hash is not null, false),
    exists (select 1 from public.sessions s where s.team_id = t.id and s.player_id = pl ->> 'id')
  from public.teams t
  join public.team_state ts on ts.team_id = t.id and ts.section = 'players'
  cross join lateral jsonb_array_elements(ts.data) as pl
  left join public.people p on p.team_id = t.id and p.player_id = pl ->> 'id'
  where auth.uid() is not null
  order by pl ->> 'name';
$$;

-- Signs this phone in as a person on the roster. Admins must give their PIN.
create function public.claim_name(p_player_id text, p_pin text default null)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_team uuid;
  v_person public.people;
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  select id into v_team from public.teams;
  if v_team is null then
    raise exception 'The team is not set up yet' using errcode = 'P0002';
  end if;
  if not public.on_roster(v_team, p_player_id) then
    raise exception 'That name is not on the roster' using errcode = 'P0002';
  end if;

  insert into public.people (team_id, player_id) values (v_team, p_player_id) on conflict do nothing;
  select * into v_person from public.people where team_id = v_team and player_id = p_player_id;

  if v_person.role = 'admin' and v_person.pin_hash is not null
     and (p_pin is null or extensions.crypt(p_pin, v_person.pin_hash) <> v_person.pin_hash) then
    raise exception 'Wrong PIN' using errcode = '28P01';
  end if;

  insert into public.sessions (user_id, team_id, player_id) values (auth.uid(), v_team, p_player_id)
  on conflict (user_id) do update set team_id = excluded.team_id, player_id = excluded.player_id, created_at = now();
  return v_person.role;
end;
$$;

-- "Not me": this phone forgets who it is.
create function public.sign_out()
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  delete from public.sessions where user_id = auth.uid();
$$;

-- What this phone's person is and may do, for the app to show and hide things.
create function public.whoami()
returns table (player_id text, role text, permissions jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.player_id,
    p.role,
    case when p.role = 'admin' then (
      select jsonb_object_agg(k, true) from jsonb_object_keys(t.default_permissions) as k
    ) else t.default_permissions || p.permissions end
  from public.sessions s
  join public.teams t on t.id = s.team_id
  join public.people p on p.team_id = s.team_id and p.player_id = s.player_id
  where s.user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Saving
-- ---------------------------------------------------------------------------------------------------------------

-- Saves one section of the app's data. The last save wins. Returns the new version.
create function public.save_section(p_section text, p_data jsonb)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session public.sessions;
  v_version bigint;
  v_allowed boolean;
begin
  v_session := public.my_session();
  if v_session.user_id is null then
    raise exception 'Pick your name first' using errcode = '42501';
  end if;

  v_allowed := case p_section
    when 'players' then public.has_perm('roster')
    when 'teams' then public.has_perm('split')
    when 'history' then public.has_perm('split')
    when 'gameday' then public.has_perm('gameday')
    when 'fees' then public.has_perm('editFees')
    else false
  end;
  if not v_allowed then
    raise exception 'You don''t have permission to change %', p_section using errcode = '42501';
  end if;
  if p_section = 'players' and jsonb_typeof(p_data) is distinct from 'array' then
    raise exception 'The roster must be a list' using errcode = '22023';
  end if;

  insert into public.team_state (team_id, section, data, updated_by)
  values (v_session.team_id, p_section, p_data, auth.uid())
  on conflict (team_id, section) do update
    set data = excluded.data, version = public.team_state.version + 1, updated_at = now(), updated_by = auth.uid()
  returning version into v_version;
  return v_version;
end;
$$;

-- Ticks or unticks this phone's own person as here tonight, without needing permission to edit the roster.
create function public.set_here(p_here boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session public.sessions;
begin
  v_session := public.my_session();
  if v_session.user_id is null or not public.has_perm('here') then
    raise exception 'You don''t have permission to do that' using errcode = '42501';
  end if;
  update public.team_state
  set data = (
        select jsonb_agg(
                 case when pl ->> 'id' = v_session.player_id then jsonb_set(pl, '{here}', to_jsonb(p_here)) else pl end
                 order by ord)
        from jsonb_array_elements(data) with ordinality as e(pl, ord)
      ),
      version = version + 1,
      updated_at = now(),
      updated_by = auth.uid()
  where team_id = v_session.team_id and section = 'players';
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Admin controls
-- ---------------------------------------------------------------------------------------------------------------

-- The admin "People" list: everyone on the roster with their role, overrides and how many phones are signed in.
create function public.people_overview()
returns table (player_id text, name text, role text, permissions jsonb, phones integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return query
    select
      pl ->> 'id',
      pl ->> 'name',
      coalesce(p.role, 'player'),
      coalesce(p.permissions, '{}'::jsonb),
      (select count(*)::integer from public.sessions s where s.team_id = t.id and s.player_id = pl ->> 'id')
    from public.teams t
    join public.team_state ts on ts.team_id = t.id and ts.section = 'players'
    cross join lateral jsonb_array_elements(ts.data) as pl
    left join public.people p on p.team_id = t.id and p.player_id = pl ->> 'id'
    order by pl ->> 'name';
end;
$$;

-- Makes someone an admin (with the PIN they'll sign in with) or a player. The last admin can't be removed.
create function public.set_role(p_player_id text, p_role text, p_pin text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_team uuid;
begin
  perform public.require_admin();
  select team_id into v_team from public.my_session();
  if p_role not in ('admin', 'player') then
    raise exception 'Role must be admin or player' using errcode = '22023';
  end if;
  if not public.on_roster(v_team, p_player_id) then
    raise exception 'That name is not on the roster' using errcode = 'P0002';
  end if;
  if p_role = 'admin' and p_pin is null and not exists (
    select 1 from public.people
    where team_id = v_team and player_id = p_player_id and role = 'admin' and pin_hash is not null
  ) then
    raise exception 'A new admin needs a PIN' using errcode = '22023';
  end if;
  if p_role = 'player' and (
    select count(*) from public.people where team_id = v_team and role = 'admin' and player_id <> p_player_id
  ) = 0 then
    raise exception 'The team needs at least one admin' using errcode = '23514';
  end if;

  insert into public.people (team_id, player_id, role, pin_hash)
  values (v_team, p_player_id, p_role, case when p_pin is not null then public.hash_pin(p_pin) end)
  on conflict (team_id, player_id) do update
    set role = excluded.role,
        pin_hash = case
          when excluded.role = 'player' then null
          when p_pin is not null then excluded.pin_hash
          else public.people.pin_hash
        end;
end;
$$;

-- Sets one person's permissions. Pass only what differs from the team's defaults; {} puts them back to default.
create function public.set_permissions(p_player_id text, p_permissions jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_team uuid;
begin
  perform public.require_admin();
  select team_id into v_team from public.my_session();
  if jsonb_typeof(p_permissions) is distinct from 'object' then
    raise exception 'Permissions must be an object' using errcode = '22023';
  end if;
  insert into public.people (team_id, player_id, permissions) values (v_team, p_player_id, p_permissions)
  on conflict (team_id, player_id) do update set permissions = excluded.permissions;
end;
$$;

-- Sets what players can do by default.
create function public.set_default_permissions(p_permissions jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  if jsonb_typeof(p_permissions) is distinct from 'object' then
    raise exception 'Permissions must be an object' using errcode = '22023';
  end if;
  update public.teams set default_permissions = default_permissions || p_permissions
  where id = (public.my_session()).team_id;
end;
$$;

-- Changes an admin's PIN: an admin can reset anyone's, and an admin can change their own.
create function public.set_pin(p_player_id text, p_pin text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  update public.people set pin_hash = public.hash_pin(p_pin)
  where team_id = (public.my_session()).team_id and player_id = p_player_id and role = 'admin';
  if not found then
    raise exception 'Only admins have a PIN' using errcode = '22023';
  end if;
end;
$$;

-- Signs a person out of every phone they're signed in on.
create function public.sign_out_person(p_player_id text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  delete from public.sessions where team_id = (public.my_session()).team_id and player_id = p_player_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Who can read what (row level security)
-- ---------------------------------------------------------------------------------------------------------------

alter table public.teams enable row level security;
alter table public.team_state enable row level security;
alter table public.people enable row level security;
alter table public.sessions enable row level security;

-- Signed-in people can read their team.
create policy "team members read their team" on public.teams
  for select to authenticated
  using (id = (public.my_session()).team_id);

-- Everyone signed in reads the roster, teams and game day; fees and history need permission.
create policy "team members read what they may see" on public.team_state
  for select to authenticated
  using (
    team_id = (public.my_session()).team_id
    and case section
      when 'fees' then public.has_perm('seeFees')
      when 'history' then public.has_perm('history')
      else true
    end
  );

create policy "team members read roles" on public.people
  for select to authenticated
  using (team_id = (public.my_session()).team_id);

create policy "phones read their own session" on public.sessions
  for select to authenticated
  using (user_id = auth.uid());

-- No insert, update or delete policies: every change goes through the functions above, which check permission.

-- Phones never see PIN hashes.
revoke all on public.teams, public.team_state, public.people, public.sessions from anon, authenticated;
grant select on public.teams, public.team_state, public.sessions to authenticated;
grant select (team_id, player_id, role, permissions, created_at) on public.people to authenticated;

-- Only signed-in phones can call the functions; the helpers are for the policies and functions only.
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.create_team(text, jsonb, text, text),
  public.list_people(),
  public.claim_name(text, text),
  public.sign_out(),
  public.whoami(),
  public.save_section(text, jsonb),
  public.set_here(boolean),
  public.people_overview(),
  public.set_role(text, text, text),
  public.set_permissions(text, jsonb),
  public.set_default_permissions(jsonb),
  public.set_pin(text, text),
  public.sign_out_person(text),
  -- Used inside the read policies, which run as the signed-in user.
  public.my_session(),
  public.has_perm(text)
to authenticated;

-- Phones hear about each other's saves straight away.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.team_state;
  end if;
end;
$$;

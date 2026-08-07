-- Reconstroi os objetos publicos esperados pelo frontend quando o historico de
-- migrations existe, mas as tabelas foram removidas do banco remoto.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'event_status' and typnamespace = 'public'::regnamespace) then
    create type public.event_status as enum ('draft', 'published', 'cancelled', 'finished');
  end if;
  if not exists (select 1 from pg_type where typname = 'participation_status' and typnamespace = 'public'::regnamespace) then
    create type public.participation_status as enum ('interested', 'going');
  end if;
end
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (char_length(username) between 3 and 30),
  display_name text not null check (char_length(display_name) between 2 and 80),
  avatar_url text,
  bio text check (char_length(bio) <= 500),
  city text,
  state char(2),
  favorite_animes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address_line text not null,
  address_number text,
  neighborhood text,
  city text not null,
  state char(2) not null,
  postal_code text,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles(id) on delete cascade,
  venue_id uuid references public.venues(id) on delete set null,
  title text not null check (char_length(title) between 3 and 120),
  slug text unique not null,
  description text not null check (char_length(description) <= 5000),
  category text not null,
  cover_url text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status public.event_status not null default 'draft',
  capacity integer check (capacity is null or capacity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_event_period check (ends_at is null or ends_at > starts_at)
);

create table if not exists public.event_participants (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.participation_status not null default 'interested',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text unique not null,
  icon text not null default '✨',
  description text not null,
  member_count integer not null default 0 check (member_count >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.community_members (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (community_id, user_id)
);

create index if not exists events_starts_at_idx on public.events(starts_at);
create index if not exists events_status_idx on public.events(status);
create index if not exists events_organizer_id_idx on public.events(organizer_id);
create index if not exists event_participants_user_id_idx on public.event_participants(user_id);
create index if not exists community_members_user_id_idx on public.community_members(user_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  requested_username text;
  safe_username text;
  requested_display_name text;
begin
  requested_username := lower(regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', ''), '[^a-zA-Z0-9_]', '', 'g'));
  if char_length(requested_username) < 3 then
    requested_username := 'user_' || substr(new.id::text, 1, 8);
  end if;
  requested_username := left(requested_username, 30);

  if exists (select 1 from public.profiles where username = requested_username) then
    safe_username := left(requested_username, 21) || '_' || substr(new.id::text, 1, 8);
  else
    safe_username := requested_username;
  end if;

  requested_display_name := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');

  insert into public.profiles (id, username, display_name)
  values (new.id, safe_username, left(coalesce(requested_display_name, safe_username), 80))
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.sync_community_member_count()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.communities set member_count = member_count + 1 where id = new.community_id;
    return new;
  end if;
  update public.communities set member_count = greatest(member_count - 1, 0) where id = old.community_id;
  return old;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at before update on public.events for each row execute function public.set_updated_at();
drop trigger if exists participants_set_updated_at on public.event_participants;
create trigger participants_set_updated_at before update on public.event_participants for each row execute function public.set_updated_at();
drop trigger if exists community_members_sync_count on public.community_members;
create trigger community_members_sync_count after insert or delete on public.community_members for each row execute function public.sync_community_member_count();
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Repara perfis ausentes de usuarios criados antes da reconstrucao do schema.
insert into public.profiles (id, username, display_name)
select
  u.id,
  'user_' || substr(u.id::text, 1, 8),
  left(coalesce(nullif(btrim(u.raw_user_meta_data ->> 'display_name'), ''), split_part(coalesce(u.email, ''), '@', 1), 'Usuario'), 80)
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict do nothing;

alter table public.profiles enable row level security;
alter table public.venues enable row level security;
alter table public.events enable row level security;
alter table public.event_participants enable row level security;
alter table public.communities enable row level security;
alter table public.community_members enable row level security;

drop policy if exists "Perfis sao publicos" on public.profiles;
create policy "Perfis sao publicos" on public.profiles for select using (true);
drop policy if exists "Usuario atualiza o proprio perfil" on public.profiles;
create policy "Usuario atualiza o proprio perfil" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
drop policy if exists "Locais sao publicos" on public.venues;
create policy "Locais sao publicos" on public.venues for select using (true);
drop policy if exists "Usuario cadastra o proprio local" on public.venues;
create policy "Usuario cadastra o proprio local" on public.venues for insert to authenticated with check (created_by = (select auth.uid()));
drop policy if exists "Eventos publicados sao publicos" on public.events;
create policy "Eventos publicados sao publicos" on public.events for select using (status = 'published' or organizer_id = (select auth.uid()));
drop policy if exists "Organizador cria eventos" on public.events;
create policy "Organizador cria eventos" on public.events for insert to authenticated with check (organizer_id = (select auth.uid()));
drop policy if exists "Organizador atualiza eventos" on public.events;
create policy "Organizador atualiza eventos" on public.events for update to authenticated using (organizer_id = (select auth.uid())) with check (organizer_id = (select auth.uid()));
drop policy if exists "Organizador exclui eventos" on public.events;
create policy "Organizador exclui eventos" on public.events for delete to authenticated using (organizer_id = (select auth.uid()));
drop policy if exists "Participacoes sao visiveis" on public.event_participants;
create policy "Participacoes sao visiveis" on public.event_participants for select using (true);
drop policy if exists "Usuario registra participacao" on public.event_participants;
create policy "Usuario registra participacao" on public.event_participants for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "Usuario atualiza participacao" on public.event_participants;
create policy "Usuario atualiza participacao" on public.event_participants for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "Usuario remove participacao" on public.event_participants;
create policy "Usuario remove participacao" on public.event_participants for delete to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Comunidades sao publicas" on public.communities;
create policy "Comunidades sao publicas" on public.communities for select using (true);
drop policy if exists "Membros sao publicos" on public.community_members;
create policy "Membros sao publicos" on public.community_members for select using (true);
drop policy if exists "Usuario entra em comunidade" on public.community_members;
create policy "Usuario entra em comunidade" on public.community_members for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "Usuario sai de comunidade" on public.community_members;
create policy "Usuario sai de comunidade" on public.community_members for delete to authenticated using (user_id = (select auth.uid()));

create or replace view public.event_details with (security_invoker = true) as
select e.*, v.name as venue_name, v.address_line, v.address_number, v.neighborhood,
  v.city, v.state, v.postal_code, v.latitude, v.longitude,
  count(ep.user_id) filter (where ep.status = 'going') as confirmed_count,
  count(ep.user_id) filter (where ep.status = 'interested') as interested_count
from public.events e
left join public.venues v on v.id = e.venue_id
left join public.event_participants ep on ep.event_id = e.id
group by e.id, v.id;

grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.communities, public.community_members, public.venues, public.events, public.event_participants, public.event_details to anon, authenticated;
grant insert, update, delete on public.profiles, public.communities, public.community_members, public.venues, public.events, public.event_participants to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.sync_community_member_count() from public, anon, authenticated;

insert into public.communities (id, slug, name, icon, description, member_count) values
  ('10000000-0000-0000-0000-000000000001', 'shonen-brasil', 'Shonen Brasil', '⚔️', 'Teorias, lutas e lancamentos semanais.', 24800),
  ('10000000-0000-0000-0000-000000000002', 'cosplay-creators', 'Cosplay Creators', '🌸', 'Crie, compartilhe e evolua seu cosplay.', 18200),
  ('10000000-0000-0000-0000-000000000003', 'gamers-otaku', 'Gamers Otaku', '🎮', 'Do gacha ao competitivo, jogamos juntos.', 31400)
on conflict (id) do update set slug = excluded.slug, name = excluded.name, icon = excluded.icon, description = excluded.description;

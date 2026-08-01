-- AnimeConect: estrutura inicial do banco de dados
-- Execute este arquivo no SQL Editor do Supabase.

create extension if not exists pgcrypto;

create type public.event_status as enum ('draft', 'published', 'cancelled', 'finished');
create type public.participation_status as enum ('interested', 'going');

create table public.profiles (
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

create table public.venues (
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
  created_at timestamptz not null default now()
);

create table public.events (
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

create table public.event_participants (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.participation_status not null default 'interested',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index events_starts_at_idx on public.events(starts_at);
create index events_status_idx on public.events(status);
create index events_organizer_id_idx on public.events(organizer_id);
create index event_participants_user_id_idx on public.event_participants(user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger events_set_updated_at before update on public.events
for each row execute function public.set_updated_at();
create trigger participants_set_updated_at before update on public.event_participants
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', 'user_' || substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data ->> 'display_name', 'Novo usuÃ¡rio')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.venues enable row level security;
alter table public.events enable row level security;
alter table public.event_participants enable row level security;

create policy "Perfis sÃ£o pÃºblicos" on public.profiles for select using (true);
create policy "UsuÃ¡rio atualiza o prÃ³prio perfil" on public.profiles
for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "Locais sÃ£o pÃºblicos" on public.venues for select using (true);
create policy "UsuÃ¡rio autenticado cadastra local" on public.venues
for insert to authenticated with check (true);

create policy "Eventos publicados sÃ£o pÃºblicos" on public.events
for select using (status = 'published' or organizer_id = (select auth.uid()));
create policy "Organizador cria eventos" on public.events
for insert to authenticated with check (organizer_id = (select auth.uid()));
create policy "Organizador atualiza eventos" on public.events
for update to authenticated using (organizer_id = (select auth.uid())) with check (organizer_id = (select auth.uid()));
create policy "Organizador exclui eventos" on public.events
for delete to authenticated using (organizer_id = (select auth.uid()));

create policy "ParticipaÃ§Ãµes sÃ£o visÃ­veis" on public.event_participants
for select using (true);
create policy "UsuÃ¡rio registra a prÃ³pria participaÃ§Ã£o" on public.event_participants
for insert to authenticated with check (user_id = (select auth.uid()));
create policy "UsuÃ¡rio atualiza a prÃ³pria participaÃ§Ã£o" on public.event_participants
for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "UsuÃ¡rio remove a prÃ³pria participaÃ§Ã£o" on public.event_participants
for delete to authenticated using (user_id = (select auth.uid()));

create or replace view public.event_details
with (security_invoker = true)
as
select
  e.*,
  v.name as venue_name,
  v.address_line,
  v.address_number,
  v.neighborhood,
  v.city,
  v.state,
  v.postal_code,
  v.latitude,
  v.longitude,
  count(ep.user_id) filter (where ep.status = 'going') as confirmed_count,
  count(ep.user_id) filter (where ep.status = 'interested') as interested_count
from public.events e
left join public.venues v on v.id = e.venue_id
left join public.event_participants ep on ep.event_id = e.id
group by e.id, v.id;


-- Próxima etapa do schema

-- Restringe a execuÃ§Ã£o direta da funÃ§Ã£o usada exclusivamente pelo trigger de autenticaÃ§Ã£o.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Associa novos locais ao usuÃ¡rio que os cadastrou.
alter table public.venues
  add column if not exists created_by uuid
  references public.profiles(id) on delete set null
  default auth.uid();

drop policy if exists "UsuÃ¡rio autenticado cadastra local" on public.venues;

create policy "UsuÃ¡rio autenticado cadastra o prÃ³prio local"
on public.venues
for insert
to authenticated
with check (created_by = (select auth.uid()));


-- Próxima etapa do schema

create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text unique not null,
  icon text not null default 'âœ¨',
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

create index if not exists community_members_user_id_idx on public.community_members(user_id);

alter table public.communities enable row level security;
alter table public.community_members enable row level security;

create policy "Comunidades sÃ£o pÃºblicas" on public.communities for select using (true);
create policy "Membros sÃ£o pÃºblicos" on public.community_members for select using (true);
create policy "UsuÃ¡rio entra em comunidade" on public.community_members
for insert to authenticated with check (user_id = (select auth.uid()));
create policy "UsuÃ¡rio sai de comunidade" on public.community_members
for delete to authenticated using (user_id = (select auth.uid()));

insert into public.communities (id, slug, name, icon, description, member_count) values
  ('10000000-0000-0000-0000-000000000001', 'shonen-brasil', 'Shonen Brasil', 'âš”ï¸', 'Teorias, lutas e lanÃ§amentos semanais.', 24800),
  ('10000000-0000-0000-0000-000000000002', 'cosplay-creators', 'Cosplay Creators', 'ðŸŒ¸', 'Crie, compartilhe e evolua seu cosplay.', 18200),
  ('10000000-0000-0000-0000-000000000003', 'gamers-otaku', 'Gamers Otaku', 'ðŸŽ®', 'Do gacha ao competitivo, jogamos juntos.', 31400)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  icon = excluded.icon,
  description = excluded.description;


-- Próxima etapa do schema

create or replace function public.sync_community_member_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.communities
    set member_count = member_count + 1
    where id = new.community_id;
    return new;
  end if;

  update public.communities
  set member_count = greatest(member_count - 1, 0)
  where id = old.community_id;
  return old;
end;
$$;

revoke execute on function public.sync_community_member_count() from public, anon, authenticated;

create trigger community_members_sync_count
after insert or delete on public.community_members
for each row execute function public.sync_community_member_count();

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
    coalesce(new.raw_user_meta_data ->> 'display_name', 'Novo usuário')
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

create policy "Perfis são públicos" on public.profiles for select using (true);
create policy "Usuário atualiza o próprio perfil" on public.profiles
for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "Locais são públicos" on public.venues for select using (true);
create policy "Usuário autenticado cadastra local" on public.venues
for insert to authenticated with check (true);

create policy "Eventos publicados são públicos" on public.events
for select using (status = 'published' or organizer_id = (select auth.uid()));
create policy "Organizador cria eventos" on public.events
for insert to authenticated with check (organizer_id = (select auth.uid()));
create policy "Organizador atualiza eventos" on public.events
for update to authenticated using (organizer_id = (select auth.uid())) with check (organizer_id = (select auth.uid()));
create policy "Organizador exclui eventos" on public.events
for delete to authenticated using (organizer_id = (select auth.uid()));

create policy "Participações são visíveis" on public.event_participants
for select using (true);
create policy "Usuário registra a própria participação" on public.event_participants
for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Usuário atualiza a própria participação" on public.event_participants
for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Usuário remove a própria participação" on public.event_participants
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

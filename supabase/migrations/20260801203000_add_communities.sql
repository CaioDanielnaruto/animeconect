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

create index if not exists community_members_user_id_idx on public.community_members(user_id);

alter table public.communities enable row level security;
alter table public.community_members enable row level security;

create policy "Comunidades são públicas" on public.communities for select using (true);
create policy "Membros são públicos" on public.community_members for select using (true);
create policy "Usuário entra em comunidade" on public.community_members
for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Usuário sai de comunidade" on public.community_members
for delete to authenticated using (user_id = (select auth.uid()));

insert into public.communities (id, slug, name, icon, description, member_count) values
  ('10000000-0000-0000-0000-000000000001', 'shonen-brasil', 'Shonen Brasil', '⚔️', 'Teorias, lutas e lançamentos semanais.', 24800),
  ('10000000-0000-0000-0000-000000000002', 'cosplay-creators', 'Cosplay Creators', '🌸', 'Crie, compartilhe e evolua seu cosplay.', 18200),
  ('10000000-0000-0000-0000-000000000003', 'gamers-otaku', 'Gamers Otaku', '🎮', 'Do gacha ao competitivo, jogamos juntos.', 31400)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  icon = excluded.icon,
  description = excluded.description;

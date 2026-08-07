create type public.friendship_status as enum ('pending', 'accepted', 'blocked');

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  community_id uuid references public.communities(id) on delete set null,
  content text not null check (char_length(content) between 1 and 2000),
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.post_likes (
  post_id uuid references public.posts(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create table public.friendships (
  requester_id uuid references public.profiles(id) on delete cascade,
  addressee_id uuid references public.profiles(id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.conversation_members (
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('friend_request','friend_accepted','post_like','message','system')),
  title text not null,
  body text,
  resource_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.user_roles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role text not null check (role in ('moderator','admin')),
  created_at timestamptz not null default now()
);

create index posts_created_at_idx on public.posts(created_at desc);
create index posts_author_id_idx on public.posts(author_id);
create index friendships_addressee_idx on public.friendships(addressee_id, status);
create index messages_conversation_idx on public.messages(conversation_id, created_at);
create index notifications_user_idx on public.notifications(user_id, created_at desc);

create or replace function public.is_admin(check_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles where user_id = check_user and role = 'admin');
$$;
revoke execute on function public.is_admin(uuid) from public, anon;
grant execute on function public.is_admin(uuid) to authenticated;

create or replace function public.create_direct_conversation(other_user uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare conversation uuid;
begin
  if auth.uid() is null or other_user = auth.uid() then raise exception 'Invalid participant'; end if;
  select cm1.conversation_id into conversation
  from public.conversation_members cm1 join public.conversation_members cm2 on cm2.conversation_id = cm1.conversation_id
  where cm1.user_id = auth.uid() and cm2.user_id = other_user
    and (select count(*) from public.conversation_members x where x.conversation_id = cm1.conversation_id) = 2 limit 1;
  if conversation is null then
    insert into public.conversations default values returning id into conversation;
    insert into public.conversation_members values (conversation, auth.uid(), now()), (conversation, other_user, now());
  end if;
  return conversation;
end; $$;
grant execute on function public.create_direct_conversation(uuid) to authenticated;

alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.friendships enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.user_roles enable row level security;

create policy "Posts publicos" on public.posts for select using (true);
create policy "Usuario cria posts" on public.posts for insert to authenticated with check (author_id = auth.uid());
create policy "Autor gerencia post" on public.posts for update to authenticated using (author_id = auth.uid() or public.is_admin()) with check (author_id = auth.uid() or public.is_admin());
create policy "Autor remove post" on public.posts for delete to authenticated using (author_id = auth.uid() or public.is_admin());
create policy "Curtidas publicas" on public.post_likes for select using (true);
create policy "Usuario curte" on public.post_likes for insert to authenticated with check (user_id = auth.uid());
create policy "Usuario descurte" on public.post_likes for delete to authenticated using (user_id = auth.uid());
create policy "Amizades dos envolvidos" on public.friendships for select to authenticated using (requester_id = auth.uid() or addressee_id = auth.uid() or public.is_admin());
create policy "Usuario solicita amizade" on public.friendships for insert to authenticated with check (requester_id = auth.uid());
create policy "Envolvido atualiza amizade" on public.friendships for update to authenticated using (requester_id = auth.uid() or addressee_id = auth.uid()) with check (requester_id = auth.uid() or addressee_id = auth.uid());
create policy "Envolvido remove amizade" on public.friendships for delete to authenticated using (requester_id = auth.uid() or addressee_id = auth.uid());
create policy "Membro ve conversa" on public.conversations for select to authenticated using (exists(select 1 from public.conversation_members where conversation_id=id and user_id=auth.uid()));
create policy "Membro ve participantes" on public.conversation_members for select to authenticated using (exists(select 1 from public.conversation_members mine where mine.conversation_id=conversation_id and mine.user_id=auth.uid()));
create policy "Membro ve mensagens" on public.messages for select to authenticated using (exists(select 1 from public.conversation_members where conversation_id=messages.conversation_id and user_id=auth.uid()));
create policy "Membro envia mensagens" on public.messages for insert to authenticated with check (sender_id=auth.uid() and exists(select 1 from public.conversation_members where conversation_id=messages.conversation_id and user_id=auth.uid()));
create policy "Usuario ve notificacoes" on public.notifications for select to authenticated using (user_id=auth.uid());
create policy "Usuario atualiza notificacoes" on public.notifications for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "Admins veem papeis" on public.user_roles for select to authenticated using (user_id=auth.uid() or public.is_admin());
create policy "Admins gerenciam papeis" on public.user_roles for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace view public.post_details with (security_invoker=true) as
select p.*, pr.username, pr.display_name, pr.avatar_url, c.name community_name,
 count(pl.user_id) like_count
from public.posts p join public.profiles pr on pr.id=p.author_id
left join public.communities c on c.id=p.community_id
left join public.post_likes pl on pl.post_id=p.id
group by p.id, pr.id, c.id;

grant select on public.post_details to anon, authenticated;
grant select on public.posts, public.post_likes to anon, authenticated;
grant insert, update, delete on public.posts, public.post_likes, public.friendships, public.messages, public.notifications, public.user_roles to authenticated;
grant select on public.friendships, public.conversations, public.conversation_members, public.messages, public.notifications, public.user_roles to authenticated;

alter publication supabase_realtime add table public.messages, public.notifications;

alter table public.user_roles add column if not exists moderator_alias text not null default 'Equipe AnimeConect'
  check (char_length(moderator_alias) between 3 and 40);
update public.user_roles set moderator_alias='Caio_Dan_kido' where role='admin';

create table public.event_messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);
create table public.call_rooms (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  media_type text not null check (media_type in ('audio','video')),
  status text not null default 'active' check (status in ('active','ended')),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
create table public.call_participants (
  room_id uuid references public.call_rooms(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key(room_id,user_id)
);
create table public.call_signals (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.call_rooms(id) on delete cascade,
  from_user uuid not null references public.profiles(id) on delete cascade,
  to_user uuid not null references public.profiles(id) on delete cascade,
  signal_type text not null check (signal_type in ('offer','answer','ice')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create table public.moderation_audit (
  id bigint generated always as identity primary key,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  actor_alias text not null,
  action text not null,
  target_type text not null,
  target_id text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index event_messages_event_idx on public.event_messages(event_id,created_at);
create index call_signals_room_idx on public.call_signals(room_id,created_at);
create index moderation_audit_created_idx on public.moderation_audit(created_at desc);

create or replace function public.can_access_event_room(check_event uuid, check_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.events where id=check_event and organizer_id=check_user)
    or exists(select 1 from public.event_participants where event_id=check_event and user_id=check_user);
$$;
revoke execute on function public.can_access_event_room(uuid,uuid) from public,anon;
grant execute on function public.can_access_event_room(uuid,uuid) to authenticated;

create or replace function public.can_access_call(check_room uuid, check_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.call_participants where room_id=check_room and user_id=check_user and left_at is null);
$$;
revoke execute on function public.can_access_call(uuid,uuid) from public,anon;
grant execute on function public.can_access_call(uuid,uuid) to authenticated;

create or replace function public.log_admin_action(action_name text,target_kind text,target_value text default null,extra jsonb default '{}') returns void
language plpgsql security definer set search_path='' as $$
declare alias_name text;
begin
  select moderator_alias into alias_name from public.user_roles where user_id=auth.uid() and role='admin';
  if alias_name is null then raise exception 'Administrator access required'; end if;
  insert into public.moderation_audit(actor_id,actor_alias,action,target_type,target_id,details)
  values(auth.uid(),alias_name,action_name,target_kind,target_value,extra);
end; $$;
grant execute on function public.log_admin_action(text,text,text,jsonb) to authenticated;

alter table public.event_messages enable row level security;
alter table public.call_rooms enable row level security;
alter table public.call_participants enable row level security;
alter table public.call_signals enable row level security;
alter table public.moderation_audit enable row level security;
create policy "Participante ve chat do evento" on public.event_messages for select to authenticated using(public.can_access_event_room(event_id));
create policy "Participante envia no evento" on public.event_messages for insert to authenticated with check(sender_id=auth.uid() and public.can_access_event_room(event_id));
create policy "Autor ou admin remove mensagem" on public.event_messages for delete to authenticated using(sender_id=auth.uid() or public.is_admin());
create policy "Participante ve salas" on public.call_rooms for select to authenticated using(public.can_access_event_room(event_id));
create policy "Participante cria sala" on public.call_rooms for insert to authenticated with check(created_by=auth.uid() and public.can_access_event_room(event_id));
create policy "Criador encerra sala" on public.call_rooms for update to authenticated using(created_by=auth.uid()) with check(created_by=auth.uid());
create policy "Participante ve membros chamada" on public.call_participants for select to authenticated using(public.can_access_call(room_id) or exists(select 1 from public.call_rooms where id=room_id and public.can_access_event_room(event_id)));
create policy "Usuario entra em chamada" on public.call_participants for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from public.call_rooms where id=room_id and status='active' and public.can_access_event_room(event_id)));
create policy "Usuario sai da chamada" on public.call_participants for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "Participante recebe sinal" on public.call_signals for select to authenticated using(to_user=auth.uid() and public.can_access_call(room_id));
create policy "Participante envia sinal" on public.call_signals for insert to authenticated with check(from_user=auth.uid() and public.can_access_call(room_id) and exists(select 1 from public.call_participants where room_id=call_signals.room_id and user_id=to_user and left_at is null));
create policy "Admins veem auditoria" on public.moderation_audit for select to authenticated using(public.is_admin());

grant select,insert,delete on public.event_messages to authenticated;
grant select,insert,update on public.call_rooms,public.call_participants to authenticated;
grant select,insert on public.call_signals to authenticated;
grant select on public.moderation_audit to authenticated;
grant usage,select on sequence public.call_signals_id_seq,public.moderation_audit_id_seq to authenticated;
alter publication supabase_realtime add table public.event_messages,public.call_participants,public.call_signals;

create table public.user_blocks (
  blocker_id uuid references public.profiles(id) on delete cascade,
  blocked_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(blocker_id,blocked_id),
  check(blocker_id<>blocked_id)
);
create table public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid references public.profiles(id) on delete set null,
  target_type text not null check(target_type in ('user','post','message','event')),
  target_id text,
  reason text not null check(char_length(reason) between 10 and 1000),
  status text not null default 'open' check(status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index user_reports_status_idx on public.user_reports(status,created_at desc);

create or replace function public.users_are_blocked(first_user uuid,second_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.user_blocks where (blocker_id=first_user and blocked_id=second_user) or (blocker_id=second_user and blocked_id=first_user));
$$;
revoke execute on function public.users_are_blocked(uuid,uuid) from public,anon;
grant execute on function public.users_are_blocked(uuid,uuid) to authenticated;

create or replace function public.create_direct_conversation(other_user uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare conversation uuid;
begin
  if auth.uid() is null or other_user=auth.uid() then raise exception 'Invalid participant'; end if;
  if public.users_are_blocked(auth.uid(),other_user) then raise exception 'Conversation unavailable'; end if;
  if not exists(select 1 from public.friendships where status='accepted' and ((requester_id=auth.uid() and addressee_id=other_user) or (requester_id=other_user and addressee_id=auth.uid()))) then
    raise exception 'Accepted friendship required';
  end if;
  select cm1.conversation_id into conversation from public.conversation_members cm1
  join public.conversation_members cm2 on cm2.conversation_id=cm1.conversation_id
  where cm1.user_id=auth.uid() and cm2.user_id=other_user
    and (select count(*) from public.conversation_members x where x.conversation_id=cm1.conversation_id)=2 limit 1;
  if conversation is null then
    insert into public.conversations default values returning id into conversation;
    insert into public.conversation_members values(conversation,auth.uid(),now()),(conversation,other_user,now());
  end if;
  return conversation;
end; $$;

create or replace function public.enforce_write_rate_limit() returns trigger
language plpgsql security definer set search_path='' as $$
declare actor uuid; actor_column text; max_actions integer; period interval; action_count bigint;
begin
  case tg_table_name
    when 'posts' then actor:=new.author_id; actor_column:='author_id'; max_actions:=5; period:=interval '1 minute';
    when 'messages' then actor:=new.sender_id; actor_column:='sender_id'; max_actions:=60; period:=interval '1 minute';
    when 'event_messages' then actor:=new.sender_id; actor_column:='sender_id'; max_actions:=60; period:=interval '1 minute';
    when 'friendships' then actor:=new.requester_id; actor_column:='requester_id'; max_actions:=10; period:=interval '1 hour';
    when 'call_signals' then actor:=new.from_user; actor_column:='from_user'; max_actions:=240; period:=interval '1 minute';
    when 'user_reports' then actor:=new.reporter_id; actor_column:='reporter_id'; max_actions:=5; period:=interval '1 hour';
    else raise exception 'Unsupported rate limit target';
  end case;
  execute format('select count(*) from public.%I where %I=$1 and created_at>now()-$2',tg_table_name,actor_column)
    into action_count using actor,period;
  if action_count>=max_actions then raise exception 'Rate limit exceeded. Try again later'; end if;
  return new;
end; $$;
revoke execute on function public.enforce_write_rate_limit() from public,anon,authenticated;
create trigger posts_rate_limit before insert on public.posts for each row execute function public.enforce_write_rate_limit();
create trigger messages_rate_limit before insert on public.messages for each row execute function public.enforce_write_rate_limit();
create trigger event_messages_rate_limit before insert on public.event_messages for each row execute function public.enforce_write_rate_limit();
create trigger friendships_rate_limit before insert on public.friendships for each row execute function public.enforce_write_rate_limit();
create trigger call_signals_rate_limit before insert on public.call_signals for each row execute function public.enforce_write_rate_limit();
create trigger user_reports_rate_limit before insert on public.user_reports for each row execute function public.enforce_write_rate_limit();

alter table public.call_signals add constraint call_signal_payload_size check(octet_length(payload::text)<=65536);
create or replace function public.cleanup_expired_call_signals() returns trigger
language plpgsql security definer set search_path='' as $$
begin delete from public.call_signals where created_at<now()-interval '15 minutes'; return new; end; $$;
revoke execute on function public.cleanup_expired_call_signals() from public,anon,authenticated;
create trigger cleanup_call_signals before insert on public.call_signals for each statement execute function public.cleanup_expired_call_signals();

alter table public.user_blocks enable row level security;
alter table public.user_reports enable row level security;
create policy "Envolvido ve bloqueio" on public.user_blocks for select to authenticated using(blocker_id=auth.uid() or blocked_id=auth.uid());
create policy "Usuario bloqueia" on public.user_blocks for insert to authenticated with check(blocker_id=auth.uid());
create policy "Usuario desbloqueia" on public.user_blocks for delete to authenticated using(blocker_id=auth.uid());
create policy "Usuario cria denuncia" on public.user_reports for insert to authenticated with check(reporter_id=auth.uid());
create policy "Usuario ve propria denuncia" on public.user_reports for select to authenticated using(reporter_id=auth.uid() or public.is_admin());
create policy "Admin analisa denuncia" on public.user_reports for update to authenticated using(public.is_admin()) with check(public.is_admin());
grant select,insert,delete on public.user_blocks to authenticated;
grant select,insert,update on public.user_reports to authenticated;

drop policy if exists "Usuario solicita amizade" on public.friendships;
create policy "Usuario solicita amizade" on public.friendships for insert to authenticated
with check(requester_id=auth.uid() and not public.users_are_blocked(requester_id,addressee_id));
drop policy if exists "Envolvido atualiza amizade" on public.friendships;
create policy "Destinatario responde amizade" on public.friendships for update to authenticated
using(addressee_id=auth.uid()) with check(addressee_id=auth.uid() and requester_id<>auth.uid());

create or replace function public.audit_moderation_delete() returns trigger
language plpgsql security definer set search_path='' as $$
declare alias_name text; owner_id uuid;
begin
  owner_id:=case when tg_table_name='posts' then old.author_id else old.sender_id end;
  if auth.uid()<>owner_id then
    select moderator_alias into alias_name from public.user_roles where user_id=auth.uid() and role='admin';
    if alias_name is not null then insert into public.moderation_audit(actor_id,actor_alias,action,target_type,target_id)
      values(auth.uid(),alias_name,'delete',tg_table_name,old.id::text); end if;
  end if;
  return old;
end; $$;
revoke execute on function public.audit_moderation_delete() from public,anon,authenticated;
create trigger audit_post_delete before delete on public.posts for each row execute function public.audit_moderation_delete();
create trigger audit_event_message_delete before delete on public.event_messages for each row execute function public.audit_moderation_delete();

create or replace function public.is_conversation_member(check_conversation uuid, check_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.conversation_members where conversation_id=check_conversation and user_id=check_user);
$$;
revoke execute on function public.is_conversation_member(uuid,uuid) from public, anon;
grant execute on function public.is_conversation_member(uuid,uuid) to authenticated;

drop policy "Membro ve conversa" on public.conversations;
drop policy "Membro ve participantes" on public.conversation_members;
drop policy "Membro ve mensagens" on public.messages;
drop policy "Membro envia mensagens" on public.messages;
create policy "Membro ve conversa" on public.conversations for select to authenticated using (public.is_conversation_member(id));
create policy "Membro ve participantes" on public.conversation_members for select to authenticated using (public.is_conversation_member(conversation_id));
create policy "Membro ve mensagens" on public.messages for select to authenticated using (public.is_conversation_member(conversation_id));
create policy "Membro envia mensagens" on public.messages for insert to authenticated with check (sender_id=auth.uid() and public.is_conversation_member(conversation_id));

create or replace function public.notify_social_action() returns trigger
language plpgsql security definer set search_path = '' as $$
declare recipient uuid;
begin
  if tg_table_name = 'friendships' then
    recipient := case when tg_op='INSERT' then new.addressee_id else new.requester_id end;
    insert into public.notifications(user_id,actor_id,kind,title,resource_id)
    values(recipient,auth.uid(),case when tg_op='INSERT' then 'friend_request' else 'friend_accepted' end,
      case when tg_op='INSERT' then 'Novo pedido de amizade' else 'Pedido de amizade aceito' end,null);
  elsif tg_table_name = 'post_likes' then
    insert into public.notifications(user_id,actor_id,kind,title,resource_id)
    select author_id,new.user_id,'post_like','Seu post recebeu uma curtida',new.post_id from public.posts where id=new.post_id and author_id<>new.user_id;
  elsif tg_table_name = 'messages' then
    insert into public.notifications(user_id,actor_id,kind,title,body,resource_id)
    select user_id,new.sender_id,'message','Nova mensagem',left(new.content,120),new.conversation_id
    from public.conversation_members where conversation_id=new.conversation_id and user_id<>new.sender_id;
  end if;
  return new;
end; $$;
revoke execute on function public.notify_social_action() from public, anon, authenticated;
create trigger notify_friend_request after insert on public.friendships for each row execute function public.notify_social_action();
create trigger notify_friend_accept after update of status on public.friendships for each row when (new.status='accepted' and old.status<>'accepted') execute function public.notify_social_action();
create trigger notify_post_like after insert on public.post_likes for each row execute function public.notify_social_action();
create trigger notify_message after insert on public.messages for each row execute function public.notify_social_action();

alter table public.user_roles drop constraint if exists user_roles_role_check;
alter table public.user_roles add constraint user_roles_role_check check(role in ('owner','admin','moderator','suspended'));

create table public.authorized_accounts(
  email_hash text primary key check(email_hash~'^[0-9a-f]{64}$'),
  label text not null check(char_length(label) between 3 and 120),
  user_id uuid unique references auth.users(id) on delete set null,
  active boolean not null default true,
  authorized_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.authorized_accounts(email_hash,label,user_id,active,authorized_by)
select '20bbf60033e4cfee4156fb1dadfbd0a80088c00ac34d90fb6caff7edf47200b2','Conta do Criador',u.id,true,u.id
from auth.users u where encode(extensions.digest(lower(trim(u.email)),'sha256'),'hex')='20bbf60033e4cfee4156fb1dadfbd0a80088c00ac34d90fb6caff7edf47200b2'
on conflict(email_hash) do update set user_id=excluded.user_id,active=true;

update public.user_roles set role='owner',moderator_alias='Caio_Dan_kido'
where user_id=(select user_id from public.authorized_accounts where email_hash='20bbf60033e4cfee4156fb1dadfbd0a80088c00ac34d90fb6caff7edf47200b2');

create or replace function public.is_owner(check_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((auth.jwt()->>'aal')='aal2',false) and check_user=auth.uid()
 and exists(select 1 from public.user_roles where user_id=check_user and role='owner');
$$;
revoke execute on function public.is_owner(uuid) from public,anon;
grant execute on function public.is_owner(uuid) to authenticated;

create or replace function public.is_admin(check_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((auth.jwt()->>'aal')='aal2',false) and check_user=auth.uid()
 and exists(select 1 from public.user_roles where user_id=check_user and role in ('owner','admin'));
$$;

create or replace function public.has_active_access(check_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.authorized_accounts a join auth.users u on u.id=check_user
 where a.active and (a.user_id=check_user or a.email_hash=encode(extensions.digest(lower(trim(u.email)),'sha256'),'hex')));
$$;
revoke execute on function public.has_active_access(uuid) from public,anon;
grant execute on function public.has_active_access(uuid) to authenticated;

create or replace function public.owner_authorize_account(account_hash text,account_label text) returns void
language plpgsql security definer set search_path='' as $$
declare matched_user uuid;
begin
 if not public.is_owner() then raise exception 'Creator AAL2 access required'; end if;
 if account_hash!~'^[0-9a-f]{64}$' then raise exception 'Invalid account hash'; end if;
 select id into matched_user from auth.users where encode(extensions.digest(lower(trim(email)),'sha256'),'hex')=account_hash limit 1;
 insert into public.authorized_accounts(email_hash,label,user_id,active,authorized_by)
 values(account_hash,left(trim(account_label),120),matched_user,true,auth.uid())
 on conflict(email_hash) do update set label=excluded.label,user_id=coalesce(excluded.user_id,public.authorized_accounts.user_id),active=true,updated_at=now();
 perform public.log_admin_action('authorize_account','account',account_hash,jsonb_build_object('label',account_label));
end; $$;
grant execute on function public.owner_authorize_account(text,text) to authenticated;

create or replace function public.owner_set_account_role(account_hash text,new_role text) returns void
language plpgsql security definer set search_path='' as $$
declare target_user uuid; owner_hash constant text:='20bbf60033e4cfee4156fb1dadfbd0a80088c00ac34d90fb6caff7edf47200b2';
begin
 if not public.is_owner() then raise exception 'Creator AAL2 access required'; end if;
 if account_hash=owner_hash then raise exception 'Creator role is immutable'; end if;
 if new_role not in ('admin','moderator','suspended') then raise exception 'Invalid delegated role'; end if;
 select user_id into target_user from public.authorized_accounts where email_hash=account_hash and active;
 if target_user is null then raise exception 'Authorized user must create the account first'; end if;
 insert into public.user_roles(user_id,role,moderator_alias) values(target_user,new_role,'Equipe AnimeConect')
 on conflict(user_id) do update set role=excluded.role;
 perform public.log_admin_action('set_role','account',account_hash,jsonb_build_object('role',new_role));
end; $$;
grant execute on function public.owner_set_account_role(text,text) to authenticated;

create or replace function public.owner_set_account_active(account_hash text,is_active boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_owner() then raise exception 'Creator AAL2 access required'; end if;
 if account_hash='20bbf60033e4cfee4156fb1dadfbd0a80088c00ac34d90fb6caff7edf47200b2' then raise exception 'Creator account cannot be suspended'; end if;
 update public.authorized_accounts set active=is_active,updated_at=now() where email_hash=account_hash;
 if not is_active then update public.user_roles set role='suspended' where user_id=(select user_id from public.authorized_accounts where email_hash=account_hash); end if;
 perform public.log_admin_action(case when is_active then 'activate_account' else 'suspend_account' end,'account',account_hash,'{}');
end; $$;
grant execute on function public.owner_set_account_active(text,boolean) to authenticated;

create or replace function public.enforce_authorized_signup() returns trigger
language plpgsql security definer set search_path='' as $$
declare account_hash text;
begin
 account_hash:=encode(extensions.digest(lower(trim(new.email)),'sha256'),'hex');
 if not exists(select 1 from public.authorized_accounts where email_hash=account_hash and active) then raise exception 'This email has not been authorized by the creator'; end if;
 update public.authorized_accounts set user_id=new.id,updated_at=now() where email_hash=account_hash;
 return new;
end; $$;
revoke execute on function public.enforce_authorized_signup() from public,anon,authenticated;
drop trigger if exists enforce_authorized_signup on auth.users;
create trigger enforce_authorized_signup before insert on auth.users for each row execute function public.enforce_authorized_signup();

create or replace function public.protect_creator_profile() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.user_roles where user_id=old.id and role='owner') then
   if auth.uid() is not null and auth.uid()<>old.id then
     update public.user_roles set role='suspended' where user_id=auth.uid() and role in ('admin','moderator');
     insert into public.moderation_audit(actor_id,actor_alias,action,target_type,target_id,details)
     select auth.uid(),moderator_alias,'forbidden_owner_delete','profile',old.id::text,'{}' from public.user_roles where user_id=auth.uid();
   end if;
   return null;
 end if;
 return old;
end; $$;
revoke execute on function public.protect_creator_profile() from public,anon,authenticated;
create trigger protect_creator_profile before delete on public.profiles for each row execute function public.protect_creator_profile();

alter table public.authorized_accounts enable row level security;
create policy "Criador gerencia autorizados" on public.authorized_accounts for select to authenticated using(public.is_owner());
revoke insert,update,delete on public.user_roles from authenticated;
grant update(moderator_alias) on public.user_roles to authenticated;
drop policy if exists "Admins gerenciam papeis" on public.user_roles;
create policy "Usuario atualiza proprio pseudonimo" on public.user_roles for update to authenticated
using(user_id=auth.uid() and role in ('owner','admin','moderator')) with check(user_id=auth.uid() and role in ('owner','admin','moderator'));
grant select on public.authorized_accounts to authenticated;

do $$
declare table_name text;
begin
 foreach table_name in array array['profiles','venues','events','event_participants','communities','community_members','posts','post_likes','friendships','conversations','conversation_members','messages','notifications','user_roles','event_messages','call_rooms','call_participants','call_signals','moderation_audit','user_blocks','user_reports'] loop
   execute format('create policy "Conta autorizada" on public.%I as restrictive for all to authenticated using (public.has_active_access()) with check (public.has_active_access())',table_name);
 end loop;
end $$;

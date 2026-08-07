create or replace function public.enforce_authorized_signup() returns trigger
language plpgsql security definer set search_path='' as $$
declare account_hash text;
begin
 account_hash:=encode(extensions.digest(lower(trim(new.email)),'sha256'),'hex');
 if not exists(select 1 from public.authorized_accounts where email_hash=account_hash and active) then
   raise exception 'This email has not been authorized by the creator';
 end if;
 return new;
end; $$;

create or replace function public.link_authorized_signup() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 update public.authorized_accounts set user_id=new.id,updated_at=now()
 where email_hash=encode(extensions.digest(lower(trim(new.email)),'sha256'),'hex') and active;
 return new;
end; $$;
revoke execute on function public.link_authorized_signup() from public,anon,authenticated;
create trigger link_authorized_signup after insert on auth.users for each row execute function public.link_authorized_signup();

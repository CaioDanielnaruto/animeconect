create or replace function public.is_admin(check_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce((auth.jwt()->>'aal')='aal2',false)
    and check_user=auth.uid()
    and exists(select 1 from public.user_roles where user_id=check_user and role='admin');
$$;
revoke execute on function public.is_admin(uuid) from public,anon;
grant execute on function public.is_admin(uuid) to authenticated;

comment on function public.is_admin(uuid) is 'Requires an authenticated AAL2 session and an admin role.';

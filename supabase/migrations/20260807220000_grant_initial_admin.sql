do $$
declare
  admin_user_id uuid;
begin
  select id into admin_user_id
  from auth.users
  where encode(extensions.digest(lower(email), 'sha256'), 'hex') = '20bbf60033e4cfee4156fb1dadfbd0a80088c00ac34d90fb6caff7edf47200b2'
  limit 1;

  if admin_user_id is null then
    raise exception 'Configured administrator account was not found';
  end if;

  insert into public.user_roles (user_id, role)
  values (admin_user_id, 'admin')
  on conflict (user_id) do update set role = excluded.role;
end
$$;

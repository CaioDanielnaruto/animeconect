create or replace function public.sync_community_member_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.communities
    set member_count = member_count + 1
    where id = new.community_id;
    return new;
  end if;

  update public.communities
  set member_count = greatest(member_count - 1, 0)
  where id = old.community_id;
  return old;
end;
$$;

revoke execute on function public.sync_community_member_count() from public, anon, authenticated;

create trigger community_members_sync_count
after insert or delete on public.community_members
for each row execute function public.sync_community_member_count();

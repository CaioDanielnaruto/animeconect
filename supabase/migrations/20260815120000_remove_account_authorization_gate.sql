-- Cadastro e uso comum sao publicos para qualquer conta autenticada.
-- Somente owner/admin conservam as operacoes administrativas.
do $$
declare table_name text;
begin
  foreach table_name in array array['profiles','venues','events','event_participants','communities','community_members','posts','post_likes','friendships','conversations','conversation_members','messages','notifications','user_roles','event_messages','call_rooms','call_participants','call_signals','moderation_audit','user_blocks','user_reports'] loop
    execute format('drop policy if exists %I on public.%I','Conta autorizada',table_name);
  end loop;
end $$;

-- Compatibilidade com codigo antigo: apenas contas suspensas ficam sem acesso.
create or replace function public.has_active_access(check_user uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = ''
as $$
  select check_user = auth.uid() and auth.uid() is not null
    and not exists (
      select 1 from public.user_roles
      where user_id = check_user and role = 'suspended'
    );
$$;

revoke execute on function public.has_active_access(uuid) from public, anon;
grant execute on function public.has_active_access(uuid) to authenticated;

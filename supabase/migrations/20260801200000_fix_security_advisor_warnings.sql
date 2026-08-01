-- Restringe a execução direta da função usada exclusivamente pelo trigger de autenticação.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Associa novos locais ao usuário que os cadastrou.
alter table public.venues
  add column if not exists created_by uuid
  references public.profiles(id) on delete set null
  default auth.uid();

drop policy if exists "Usuário autenticado cadastra local" on public.venues;

create policy "Usuário autenticado cadastra o próprio local"
on public.venues
for insert
to authenticated
with check (created_by = (select auth.uid()));

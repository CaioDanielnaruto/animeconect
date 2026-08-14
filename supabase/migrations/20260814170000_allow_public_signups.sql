-- Cadastro do AnimeConect e publico. A lista de contas autorizadas continua
-- existindo apenas para administracao de papeis pelo painel do criador.
drop trigger if exists enforce_authorized_signup on auth.users;
drop function if exists public.enforce_authorized_signup();

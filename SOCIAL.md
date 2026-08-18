# Módulos sociais

O AnimeConect possui uma área social autenticada acessível pelo botão **Abrir rede social**.

## Recursos

- Feed com criação, exclusão e curtidas em posts.
- Descoberta de pessoas, pedidos e aceite de amizade.
- Conversas privadas entre amigos e mensagens em tempo real.
- Notificações automáticas para amizade, curtidas e mensagens.
- Painel administrativo com métricas e moderação de posts.

## Administração

O painel usa a tabela `public.user_roles`. Nenhum usuário recebe privilégio automaticamente. Isso evita transformar a primeira conta criada em administradora sem uma decisão explícita.

Conceda o papel pelo SQL Editor do Supabase, substituindo o e-mail:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin'
from auth.users
where email = 'ADMIN@EXEMPLO.COM'
on conflict (user_id) do update set role = excluded.role;
```

## Segurança

As tabelas usam Row Level Security. Posts são públicos; amizades, conversas, mensagens e notificações ficam disponíveis somente aos usuários envolvidos. Funções privilegiadas têm `search_path` vazio e execução restrita.

Migrações:

- `20260807210000_add_social_platform.sql`
- `20260807211000_fix_social_rls_and_notifications.sql`

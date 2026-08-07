# AnimeConect

Plataforma web para fãs de anime descobrirem eventos, participarem de comunidades e organizarem encontros.

## Funcionalidades

- cadastro, login, sessão persistente e logout;
- perfil com avatar, bio, localização e animes favoritos;
- comunidades com entrada, saída e contagem automática de membros;
- catálogo de eventos com busca e filtro por categoria;
- detalhes, quantidade de interessados e presenças confirmadas;
- marcação de interesse ou presença;
- criação de evento, local, capacidade, capa e rascunho/publicação;
- modo de demonstração quando o Supabase não está configurado;
- interface responsiva para desktop e celular.

## Tecnologias

React 19, Vite 8, Supabase/PostgreSQL, CSS e Oxlint.

## Desenvolvimento local

1. Instale as dependências com `npm install`.
2. Copie `.env.example` para `.env`.
3. Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
4. Aplique as migrações da pasta `supabase/migrations` no projeto Supabase.
5. Execute `npm run dev`.

## Scripts

- `npm run dev`: servidor local com atualização automática.
- `npm run lint`: análise estática do código.
- `npm run build`: compilação de produção em `dist`.
- `npm run preview`: visualização local da compilação.

## Banco e segurança

O banco contém `profiles`, `venues`, `events`, `event_participants`, `communities` e `community_members`. Todas as tabelas usam Row Level Security. Usuários alteram apenas seus próprios dados, organizadores controlam seus próprios eventos e eventos publicados podem ser lidos publicamente.

Consulte `supabase/README.md` para os comandos do Supabase CLI.

## Estrutura principal

- `src/Platform.jsx`: fluxos e interface principal.
- `src/components/`: componentes reutilizáveis.
- `src/lib/`: cliente Supabase e utilitários.
- `src/App.css` e `src/Platform.css`: identidade visual e estilos funcionais.
- `supabase/schema.sql`: esquema consolidado.
- `supabase/migrations/`: histórico versionado do banco.

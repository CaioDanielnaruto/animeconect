# Segurança

## Relato de vulnerabilidades

Não publique detalhes de vulnerabilidades em posts, chats ou issues públicas. Envie o relato de forma privada ao proprietário do projeto, incluindo impacto, passos mínimos de reprodução e evidências sem dados pessoais de terceiros.

## Controles atuais

- Row Level Security em dados sociais, administrativos, eventos, mensagens e chamadas.
- Conversas diretas apenas entre amizades aceitas e não bloqueadas.
- Bloqueio e denúncia de usuários.
- Limites de escrita contra spam em posts, mensagens, amizades, chamadas e denúncias.
- Sinais WebRTC direcionados, limitados a 64 KiB e removidos depois de 15 minutos.
- Auditoria de moderação sem acesso administrativo a conversas privadas.
- CSP, HSTS, proteção contra frames, MIME sniffing e políticas de câmera/microfone.
- Dependências de produção auditadas com `npm audit`.

## Limites de privacidade

Áudio e vídeo WebRTC são criptografados em trânsito e não são gravados pelo aplicativo. Mensagens de texto são armazenadas no PostgreSQL para histórico e não possuem criptografia ponta a ponta. Administradores não recebem permissão RLS para ler conversas privadas.

## Operação recomendada

- Ativar MFA para contas do GitHub, Supabase, Vercel e administradores.
- Manter confirmação de e-mail e proteção contra senhas vazadas no Supabase Auth.
- Usar credenciais TURN temporárias geradas no servidor.
- Revisar denúncias, logs e alertas regularmente.
- Manter backups e testar restauração.

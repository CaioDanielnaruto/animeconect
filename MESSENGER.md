# Messenger, chamadas e segurança

## Acesso

Os grupos são vinculados a eventos. Apenas o organizador e usuários que marcaram interesse ou presença podem ler mensagens, enviar mensagens ou participar de chamadas.

## Chamadas

As chamadas usam WebRTC. O navegador solicita permissão antes de acessar microfone ou câmera. Áudio e vídeo trafegam criptografados entre os participantes; o Supabase armazena apenas sinais temporários de negociação, não grava mídia.

O servidor STUN público permite conexões diretas comuns. Para redes corporativas, CGNAT ou firewalls restritivos, configure um TURN confiável na Vercel:

```text
VITE_TURN_URL=turns:turn.seudominio.com:5349
VITE_TURN_USERNAME=usuario_temporario
VITE_TURN_CREDENTIAL=credencial_temporaria
```

Em produção, prefira credenciais TURN temporárias emitidas por um backend. Não coloque segredos permanentes em variáveis `VITE_*`, pois elas são incluídas no navegador.

## Administração

O pseudônimo inicial é `Caio_Dan_kido` e pode ser alterado no monitor administrativo. A auditoria registra ações administrativas, mas o painel não permite ler conversas privadas. Isso preserva a privacidade dos usuários e mantém responsabilização interna.

## Proteções

- Row Level Security em mensagens, salas, participantes, sinais e auditoria.
- Verificação de vínculo com o evento no servidor.
- Consentimento de câmera e microfone pelo navegador.
- Sinais direcionados somente ao destinatário autenticado.
- Nenhuma gravação automática de áudio ou vídeo.
- Limites de tamanho nas mensagens.

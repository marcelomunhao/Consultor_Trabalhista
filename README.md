# Trabalhista

Frontend de um assistente de **Departamento Pessoal** (CLT e convenções coletivas),
com **sidebar** estilo claude.ai:

- **Login** — tela de acesso (e-mails autorizados + senha compartilhada),
  configurável por env. Vazio = acesso livre.
- **Novo chat** — começa uma conversa limpa (novo `sessionId` → memória nova).
- **Assistente** — chat com IA. Cada conversa tem um `sessionId`, então o backend
  responde e memoriza individualmente (suporta ~10 usuários simultâneos).
- **Vencimentos** — lista as CCTs/documentos **vencidos** e **a vencer** (30 dias).
- **Enviar CCT** — upload de `.md` ou `.pdf` (PDF passa por OCR Gemini no n8n) que
  dispara a ingestão (chunk + embedding), indexando o documento para a busca do chat.

O **backend é n8n** (3 webhooks) + **Supabase** (Postgres). Não há servidor próprio
neste repositório. Contrato completo em [`docs/n8n-webhook.md`](docs/n8n-webhook.md).

## Stack

- **React 19 + TypeScript** (Vite) · **Tailwind CSS v4**
- Backend: **n8n** (2 webhooks) + **Supabase/Postgres** (`dp_assistant.documentos`, `dp_chat_memory`)

## Arquitetura

```
Browser (React/Vite)
  ├─ Assistente  → POST /webhook/trabalhista-chat        { message, sessionId } → { reply }
  │                  n8n: Webhook → AI Agent (Claude + memória + busca RAG) → Respond
  └─ Vencimentos → GET  /webhook/trabalhista-documentos  → [ { ...vigencia_ate } ]
                     n8n: Webhook → Postgres (dp_assistant.documentos) → Respond
```

## Como rodar

Pré-requisitos: Node 20+.

```bash
npm install
cp .env.example .env       # Windows: copy .env.example .env  (ou rode start.bat)
npm run dev                # http://localhost:5180
```

O `.env.example` já vem com as URLs de produção dos webhooks.

### Scripts

| Script            | O que faz                                  |
| ----------------- | ------------------------------------------ |
| `npm run dev`     | Servidor de desenvolvimento (porta 5180)   |
| `npm run build`   | Type-check + build de produção em `dist/`  |
| `npm run preview` | Serve o build de produção localmente       |
| `npm run lint`    | Type-check sem emitir                       |

## Variáveis de ambiente

| Variável                  | Descrição                                                  |
| ------------------------- | ---------------------------------------------------------- |
| `VITE_N8N_WEBHOOK_URL`    | Webhook de chat (POST `{message, sessionId}`→`{reply}`).   |
| `VITE_DOCS_WEBHOOK_URL`   | Webhook de documentos (GET → array com vigências).         |
| `VITE_INGEST_WEBHOOK_URL` | Webhook de ingestão (POST `{filename, content}`).          |
| `VITE_AUTH_USERS`         | E-mails autorizados (separados por vírgula). Vazio = livre.|
| `VITE_AUTH_PASSWORD`      | Senha compartilhada. **Não comite a senha real.**          |

Variáveis `VITE_*` vão para o bundle do navegador — não coloque segredos aqui.
O login é uma **barreira client-side** (a senha fica no bundle compilado, fora do
git): bom para dissuadir acesso casual, mas não é segurança forte. Para endurecer,
proteja os webhooks com token e valide o login no n8n.

## Estrutura

```
.
├── docs/n8n-webhook.md     # contrato dos 2 webhooks (chat e documentos) + CORS
├── src/
│   ├── api.ts              # sendMessage() + fetchDocumentos() + uploadCct()
│   ├── auth.ts             # login (e-mails + senha por env) e sessão
│   ├── user.ts             # UUID por navegador + newChatId()
│   ├── vigencia.ts         # agrupamento vencidos / a vencer + formatação
│   ├── types.ts            # Message, WebhookRequest, Documento
│   ├── App.tsx             # shell: LoginGate + Sidebar + área principal
│   └── components/
│       ├── Sidebar.tsx          # menu lateral (novo chat, navegação, upload, sair)
│       ├── LoginGate.tsx        # tela de login / liberação
│       ├── UploadCct.tsx        # envio de CCT (.md) → ingest
│       ├── ChatView.tsx         # chat (estado, sessão, loading, erro)
│       ├── ChatInput.tsx
│       ├── MessageBubble.tsx
│       └── DocumentosPanel.tsx  # lista de vencimentos
├── .env.example
└── vite.config.ts
```

## Notas de segurança

- Os webhooks estão com CORS `*` e **sem autenticação**. O de chat aciona um LLM —
  considere proteger (header/token) antes de expor publicamente.
- A tabela `dp_chat_memory` (Supabase) está com **RLS desabilitado**. Avalie ligar
  RLS com políticas (ex.: liberar só ao `service_role` usado pelo n8n).

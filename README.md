# Trabalhista

Frontend de um assistente de **Departamento Pessoal** (CLT e convenções coletivas).
Duas abas:

- **Assistente** — chat com IA. Cada usuário tem um UUID estável (localStorage)
  enviado como `sessionId`, então o backend responde e memoriza por pessoa
  (suporta ~10 usuários simultâneos).
- **Vencimentos** — lista as CCTs/documentos **vencidos** e **a vencer** (30 dias).

O **backend é n8n** (via webhooks) + **Supabase** (Postgres). Não há servidor
próprio neste repositório. Contrato completo em [`docs/n8n-webhook.md`](docs/n8n-webhook.md).

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

| Variável                | Descrição                                              |
| ----------------------- | ------------------------------------------------------ |
| `VITE_N8N_WEBHOOK_URL`  | Webhook de chat (POST `{message, sessionId}`→`{reply}`). |
| `VITE_DOCS_WEBHOOK_URL` | Webhook de documentos (GET → array com vigências).     |

Variáveis `VITE_*` vão para o bundle do navegador — não coloque segredos aqui.

## Estrutura

```
.
├── docs/n8n-webhook.md     # contrato dos 2 webhooks (chat e documentos) + CORS
├── src/
│   ├── api.ts              # sendMessage() + fetchDocumentos()
│   ├── user.ts             # UUID estável por navegador (localStorage)
│   ├── vigencia.ts         # agrupamento vencidos / a vencer + formatação
│   ├── types.ts            # Message, WebhookRequest, Documento
│   ├── App.tsx             # shell com abas (Assistente | Vencimentos)
│   └── components/
│       ├── ChatView.tsx        # chat (estado, sessão, loading, erro)
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

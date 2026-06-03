# Trabalhista

Frontend de chat para um assistente trabalhista. O **backend é um workflow do
n8n**: o frontend envia as mensagens via webhook e recebe a resposta pelo node
*Respond to Webhook*. Não há servidor próprio neste repositório.

## Stack

- **React 19 + TypeScript** (Vite)
- **Tailwind CSS v4** (plugin oficial do Vite)
- Backend: **n8n** (externo, via webhook) — ver [`docs/n8n-webhook.md`](docs/n8n-webhook.md)

## Arquitetura

```
Browser (React/Vite)
  → POST {VITE_N8N_WEBHOOK_URL}   body: { message, sessionId }
  → n8n: Webhook → (processamento) → Respond to Webhook
  → Browser renderiza a resposta no chat
```

## Como rodar

Pré-requisitos: Node 20+.

```bash
npm install
cp .env.example .env       # no Windows: copy .env.example .env
# edite .env e preencha VITE_N8N_WEBHOOK_URL com a URL do seu webhook n8n
npm run dev                # http://localhost:5180
```

### Scripts

| Script            | O que faz                                  |
| ----------------- | ------------------------------------------ |
| `npm run dev`     | Servidor de desenvolvimento (porta 5180)   |
| `npm run build`   | Type-check + build de produção em `dist/`  |
| `npm run preview` | Serve o build de produção localmente       |
| `npm run lint`    | Type-check sem emitir                       |

## Variáveis de ambiente

| Variável                | Descrição                                            |
| ----------------------- | ---------------------------------------------------- |
| `VITE_N8N_WEBHOOK_URL`  | URL do webhook do n8n que recebe e responde o chat. |

Variáveis `VITE_*` vão para o bundle do navegador — não coloque segredos aqui.

## Estrutura

```
.
├── docs/
│   └── n8n-webhook.md      # contrato do backend n8n (request/response, CORS)
├── src/
│   ├── api.ts              # cliente do webhook (envio + parsing flexível da resposta)
│   ├── types.ts            # tipos de mensagem e payload
│   ├── App.tsx             # tela de chat (estado, sessão, loading, erro)
│   └── components/
│       ├── MessageBubble.tsx
│       └── ChatInput.tsx
├── .env.example
└── vite.config.ts
```

## Próximos passos sugeridos

- Subir o workflow n8n correspondente e versionar o export em `docs/` ou `n8n/`.
- Tratar streaming/respostas longas, se o backend evoluir para isso.
- Histórico persistente de conversa (hoje vive só na sessão da aba).

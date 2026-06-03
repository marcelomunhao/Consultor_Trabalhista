# Trabalhista

Assistente de **Departamento Pessoal** (CLT e convenções coletivas) com interface
de chat estilo claude.ai. O usuário conversa com um agente de IA que consulta uma
base de normas trabalhistas (RAG), acompanha o **vencimento das CCTs** e pode
**enviar novos documentos** para a base.

O **backend são workflows do n8n** (via webhooks) + **Supabase/Postgres**. Não há
servidor próprio neste repositório — só o frontend (React/Vite).

---

## Funcionalidades

- **Chat com IA** — respostas em **streaming suave** (efeito de digitação,
  desacoplado da rede via buffer + `requestAnimationFrame`), formatadas em
  **markdown** (títulos, negrito, listas, tabelas). Mostra **"Pensando..."**
  enquanto o agente consulta as normas.
- **Conversas salvas** — lista de chats na sidebar (por usuário), com **novo
  chat**, **renomear** e **excluir** (com modal de confirmação). A memória
  continua no n8n pelo mesmo `chatId`.
- **Compartilhar** — gera um link somente-leitura com o contexto da conversa
  (**válido por 30 dias**).
- **Vencimentos** — lista CCTs **vencidas** e **a vencer** (30 dias), com **busca
  por nome** (sindicato, categoria, tipo).
- **Enviar CCT** — upload de **`.md`** ou **`.pdf`** (PDF passa por **OCR Gemini**
  no n8n) que dispara a ingestão (chunk + embedding) e indexa o documento para a
  busca do chat.
- **Login** — acesso restrito por e-mail + senha compartilhada (configurável por
  env; vazio = acesso livre).

---

## Stack

- **React 19 + TypeScript** (Vite) · **Tailwind CSS v4**
- **react-markdown** + **remark-gfm** (formatação das respostas)
- Backend: **n8n** (4 workflows / webhooks) + **Supabase / Postgres**
  (`dp_assistant`)

---

## Arquitetura

```
Browser (React/Vite :5180)
  ├─ Chat        → POST /webhook/trabalhista-chat        (streaming NDJSON)
  │                  n8n: Webhook → AI Agent (Claude + memória + busca RAG)
  ├─ Vencimentos → GET  /webhook/trabalhista-documentos  → [ docs c/ vigência ]
  │                  n8n: Webhook → Postgres (dp_assistant.documentos)
  ├─ Upload CCT  → POST /webhook/trabalhista-ingest      { filename, content|file_base64 }
  │                  n8n: Webhook → (PDF? OCR Gemini) → chunk → embedding → insert
  └─ Compartilhar→ POST /webhook/trabalhista-share-save  → { id }
                   GET  /webhook/trabalhista-share-get?id= → { title, messages }
```

Contrato detalhado dos webhooks: [`docs/n8n-webhook.md`](docs/n8n-webhook.md).

### Workflows n8n

| Workflow | ID | Endpoints |
| --- | --- | --- |
| `DP_Trabalhista_Chat_API` | `bCc1WDoYsIQuiTk6` | `POST /webhook/trabalhista-chat` (streaming) |
| `DP_Trabalhista_Documentos_API` | `oWeYx5xN0JKqHvBJ` | `GET /webhook/trabalhista-documentos` |
| `DP_Trabalhista_Ingestao_API` | `9wmiEK3TnkTnhdXU` | `POST /webhook/trabalhista-ingest` |
| `DP_Trabalhista_Share` | `wYq8qu7BgNXUPyhl` | `POST /…/share-save` · `GET /…/share-get?id=` |

O chat reusa o agente existente (`DP_Trabalhista_Agente`): mesmo modelo (Claude
Sonnet), memória em `dp_chat_memory` e a ferramenta de busca RAG
(`DP_Trabalhista_SubBusca`).

### Tabelas Supabase (`dp_assistant`)

| Tabela | Uso |
| --- | --- |
| `documentos` | CCTs/normas com `vigencia_de/ate` e `metadata` (sindicato, tipo, base) |
| `chunks` | trechos com embedding (busca RAG) |
| `shared_chats` | conversas compartilhadas (`expires_at` = 30 dias) |
| `public.dp_chat_memory` | memória de conversa do agente (por `sessionId`/`chatId`) |

---

## Como rodar

Pré-requisitos: **Node 20+**.

```bash
npm install
cp .env.example .env       # Windows: copy .env.example .env  (ou use start.bat)
# preencha as URLs dos webhooks e o login no .env
npm run dev                # http://localhost:5180
```

No Windows, o **`start.bat`** instala dependências na 1ª vez, garante o `.env` e
sobe o dev. O Vite escuta na rede (`host: true`), então também é acessível por
**http://&lt;IP-da-máquina&gt;:5180** (ex.: `http://192.168.0.47:5180`).

### Scripts

| Script | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento (porta 5180, exposto na rede) |
| `npm run build` | Type-check + build de produção em `dist/` |
| `npm run preview` | Serve o build de produção |
| `npm run lint` | Type-check sem emitir |

---

## Variáveis de ambiente

Todas `VITE_*` vão para o bundle do navegador — **não coloque segredos fortes aqui**.

| Variável | Descrição |
| --- | --- |
| `VITE_N8N_WEBHOOK_URL` | Webhook de chat (streaming). |
| `VITE_DOCS_WEBHOOK_URL` | Webhook de documentos (Vencimentos). |
| `VITE_INGEST_WEBHOOK_URL` | Webhook de ingestão (upload de CCT). |
| `VITE_SHARE_SAVE_URL` | Webhook de compartilhamento — salvar. |
| `VITE_SHARE_GET_URL` | Webhook de compartilhamento — abrir. |
| `VITE_AUTH_USERS` | E-mails autorizados (separados por vírgula). Vazio = acesso livre. |
| `VITE_AUTH_PASSWORD` | Senha compartilhada. **Não comite a senha real.** |

A chave do **Gemini** (OCR de PDF) **não fica no frontend** — está embutida no node
OCR do workflow de ingestão, no n8n.

---

## Estrutura

```
.
├── docs/n8n-webhook.md       # contrato dos 4 webhooks + CORS + tabelas
├── src/
│   ├── api.ts                # cliente: chat(streaming), docs, upload, share
│   ├── auth.ts               # login por e-mail + senha (env) e sessão
│   ├── chats.ts              # store de conversas (localStorage, por usuário)
│   ├── user.ts               # UUID por navegador + novo chatId
│   ├── vigencia.ts           # agrupamento vencidos / a vencer + datas
│   ├── types.ts              # Message, WebhookRequest, Documento
│   ├── App.tsx               # rota ?share=, LoginGate, Workspace (sidebar + main)
│   └── components/
│       ├── Sidebar.tsx           # navegação, lista de chats (⋯ renomear/excluir), upload
│       ├── LoginGate.tsx         # tela de login / liberação
│       ├── ChatView.tsx          # chat (streaming suave), header + Compartilhar
│       ├── ChatInput.tsx         # campo de envio (centralizado / barra)
│       ├── MessageBubble.tsx     # bolha (markdown, "Pensando...")
│       ├── Markdown.tsx          # render de markdown estilizado
│       ├── DocumentosPanel.tsx   # Vencimentos + busca por nome
│       ├── UploadCct.tsx         # envio de CCT (.md/.pdf)
│       ├── SharedView.tsx        # conversa compartilhada (read-only, sem login)
│       └── ConfirmModal.tsx      # modal de confirmação reutilizável
├── .env.example
├── start.bat                 # setup/run no Windows
└── vite.config.ts
```

---

## Notas de segurança

- **Login é client-side**: a senha fica no bundle compilado (fora do git). Bom para
  dissuadir acesso casual, **não é segurança forte**. Para endurecer, proteja os
  webhooks com token e valide o login no n8n.
- Webhooks com **CORS `*`** e **sem autenticação**; o de chat aciona um LLM.
  Considere restringir origem e exigir token antes de expor publicamente.
- A tabela `dp_chat_memory` está com **RLS desabilitado** — avalie ligar RLS com
  política liberando apenas o `service_role` usado pelo n8n.
- A chave do Gemini está embutida na URL do node OCR (no workflow, não no git);
  recomenda-se mover para uma credencial do n8n.

## Limitações conhecidas

- Upload aceita `.md` e `.pdf` (com OCR). PDF leva ~50s (OCR) e o node tem timeout
  de 180s.
- Um CCT recém-enviado fica pesquisável pelo chat, mas **só aparece em
  "Vencimentos"** após preencher a `vigencia_ate` (vem do pipeline de
  `vigencias.json`).
- O arquivo enviado é indexado no banco, mas **não é gravado** no bucket
  `dp-assistant/DOC/` (fonte canônica do ingest em lote).
- Acesso por IP (`http://…`) não tem contexto seguro, então copiar o link de
  compartilhamento usa uma caixa de fallback (o UUID do navegador também usa um
  gerador alternativo).

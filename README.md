# Trabalhista

Assistente de **Departamento Pessoal** (CLT e convenções coletivas) com interface
de chat estilo claude.ai. O usuário conversa com um agente de IA que consulta uma
base de normas trabalhistas (**RAG**), acompanha o **vencimento das CCTs** e pode
**enviar novos documentos** para a base.

O **backend são workflows do n8n** (via webhooks) + **Supabase/Postgres**. Não há
servidor próprio neste repositório — só o frontend (**React/Vite**).

---

## Funcionalidades

- **Chat com IA (RAG)** — respostas em **streaming suave** (efeito de digitação,
  desacoplado da rede via buffer + `requestAnimationFrame`), formatadas em
  **markdown** com **títulos destacados** (`## Resposta direta / Fundamentação /
  Ressalvas`), negrito e listas. Mostra **"Pensando..."** enquanto o agente busca.
- **Selo de vigência das fontes** — cada resposta exibe, por fonte citada, um selo
  colorido: 🟢 **em vigência** (`até DD/MM/AAAA`), 🟡 **a vencer** (≤30 dias) ou
  🔴 **vencida**. O agente anexa um bloco técnico `<vigencia>` (oculto no texto) que
  o frontend converte nos selos.
- **Histórico de documentos vencidos** — a busca também usa CCTs **vencidas** como
  referência histórica quando não há fonte vigente; nesses casos a resposta
  **sinaliza explicitamente** que a fonte venceu (texto + selo vermelho).
- **Anexar imagem (visão)** — botão "+" no campo de envio: o usuário anexa uma
  imagem (holerite, TRCT, página de CCT, print) e o **modelo multimodal a analisa**.
  Redimensionada no cliente (lado maior ≤1568px, ≤5MB) e enviada em base64.
- **Conversas salvas** — lista de chats na sidebar (por usuário), com **novo chat**,
  **renomear** e **excluir** (modal de confirmação). A memória continua no n8n pelo
  mesmo `chatId`.
- **Compartilhar** — link somente-leitura com o contexto da conversa
  (**válido por 30 dias**).
- **Vencimentos** — lista CCTs **vencidas** e **a vencer** (30 dias), com **busca
  por nome** (sindicato, categoria, tipo).
- **Enviar CCT** — upload de **`.md`** ou **`.pdf`** (PDF passa por **OCR Gemini**
  no n8n) → ingestão (chunk + embedding) → indexado para a busca do chat.
- **Login** — acesso restrito por e-mail + senha compartilhada (env; vazio = livre).
- **Robustez** — eventos de erro do agente (ex.: rate limit) viram mensagem clara;
  **timeout de 75s** evita "Pensando" infinito; proteção contra a bolha travar se a
  aba perde o foco.

---

## Stack

- **React 19 + TypeScript** (Vite) · **Tailwind CSS v4**
- **react-markdown** + **remark-gfm** (formatação das respostas)
- Backend: **n8n** (5 workflows) + **Supabase / Postgres** (schema `dp_assistant`,
  com **pgvector**)
- IA: **OpenAI `gpt-4.1-mini`** (primário) + **Claude Sonnet 4.5** (fallback) ·
  embeddings **`text-embedding-3-small`** · OCR **Gemini** (ingestão de PDF)

---

## Arquitetura (visão geral)

```
Browser (React/Vite :5180)
  ├─ Chat        → POST /webhook/trabalhista-chat        (streaming NDJSON)
  │                  { message, sessionId, image_base64?, image_mime? }
  │                  n8n: Webhook → Preparar Imagem → AI Agent (OpenAI/Claude
  │                       + memória Postgres + tool buscar_norma_trabalhista)
  ├─ Vencimentos → GET  /webhook/trabalhista-documentos  → [ docs c/ vigência ]
  │                  n8n: Webhook → Postgres (dp_assistant.documentos)
  ├─ Upload CCT  → POST /webhook/trabalhista-ingest      { filename, content|file_base64 }
  │                  n8n: Webhook → (PDF? OCR Gemini) → chunk → embedding → upsert
  └─ Compartilhar→ POST /webhook/trabalhista-share-save  → { id }
                   GET  /webhook/trabalhista-share-get?id= → { title, messages }
```

Contrato detalhado dos webhooks: [`docs/n8n-webhook.md`](docs/n8n-webhook.md).
Base do n8n (produção): `https://webhook.vps.central-rnc.com.br/webhook/<path>`.

---

## Banco de dados (Supabase / Postgres)

Schema **`dp_assistant`** (+ a tabela de memória em `public`). Vetores via extensão
**pgvector** (`extensions.vector`, 1536 dimensões — `text-embedding-3-small`).

### Tabelas

**`dp_assistant.documentos`** — um registro por norma/CCT.

| Coluna | Tipo | Descrição |
| --- | --- | --- |
| `id` | uuid (PK) | identificador do documento |
| `titulo` | text | nome do arquivo/documento |
| `tipo` | text | CCT / ACT / Aditivo / Lei … |
| `fonte` | text | origem (usada na dedup com `content_hash`) |
| `vigencia_de` | date | início da vigência (pode ser null) |
| `vigencia_ate` | date | fim da vigência (null = sem prazo, ex.: CLT) |
| `metadata` | jsonb | `tipo_documento`, `sindicato_laboral`, `base_territorial` |
| `content_hash` | text | hash do conteúdo (dedup no ingest) |
| `created_at` | timestamptz | criação |

**`dp_assistant.chunks`** — trechos vetorizados de cada documento (busca RAG).

| Coluna | Tipo | Descrição |
| --- | --- | --- |
| `id` | uuid (PK) | identificador do chunk |
| `documento_id` | uuid (FK → `documentos.id`) | documento de origem |
| `conteudo` | text | texto do trecho |
| `referencia` | text | referência da cláusula/artigo (ex.: "Cláusula D", "Art. 477") |
| `embedding` | vector(1536) | embedding do trecho |
| `metadata` | jsonb | metadados extras do chunk |
| `created_at` | timestamptz | criação |

**`dp_assistant.shared_chats`** — conversas compartilhadas.

| Coluna | Tipo | Descrição |
| --- | --- | --- |
| `id` | uuid | id do compartilhamento (vai na URL `?share=`) |
| `title` | text | título da conversa |
| `messages` | jsonb | mensagens (inclui imagem em base64 e bloco `<vigencia>`) |
| `created_at` / `expires_at` | timestamptz | `expires_at = now() + 30 dias` |

**`public.dp_chat_memory`** — memória de conversa do agente (LangChain Postgres
Chat Memory), chaveada pelo `sessionId`/`chatId`. Mantém o histórico por usuário.

### Relação

```
documentos (1) ──< chunks (N)        chunks.documento_id → documentos.id
```

### Função de busca vetorial

`dp_assistant.match_documents(query_embedding vector, match_count int = 5, filter jsonb = '{}')`
→ retorna `(id, content, metadata, similarity)`.

- Faz `JOIN chunks → documentos` e devolve, **dentro do `metadata`**:
  `referencia`, `titulo`, `tipo`, `vigencia_de`, `vigencia_ate` — para o agente
  **citar a fonte e a vigência**.
- Ordena por distância de cosseno (`embedding <=> query_embedding`), `LIMIT match_count`.
- **Inclui documentos vencidos de propósito** (histórico). A vigência viaja no
  `metadata`; o agente prioriza fontes vigentes e **sinaliza** quando usa uma vencida.

> Funções de ingestão (usadas pelo workflow de upload): `fn_upsert_documento_raw`,
> `fn_insert_chunks_lote`.

---

## Fluxos no n8n

Cinco workflows. IDs e endpoints:

| Workflow | ID | Endpoint(s) |
| --- | --- | --- |
| `DP_Trabalhista_Chat_API` | `bCc1WDoYsIQuiTk6` | `POST /webhook/trabalhista-chat` (streaming) |
| `DP_Trabalhista_SubBusca` | `xwdCPcx8owt6PS2m` | sub-workflow (chamado como tool) |
| `DP_Trabalhista_Documentos_API` | `oWeYx5xN0JKqHvBJ` | `GET /webhook/trabalhista-documentos` |
| `DP_Trabalhista_Ingestao_API` | `9wmiEK3TnkTnhdXU` | `POST /webhook/trabalhista-ingest` |
| `DP_Trabalhista_Share` | `wYq8qu7BgNXUPyhl` | `POST /…/share-save` · `GET /…/share-get?id=` |

### 1. Chat — `DP_Trabalhista_Chat_API`

```
Webhook (POST, responseMode: streaming)
  → Preparar Imagem (Code: se body.image_base64, converte base64 → binário)
  → Agente Trabalhista (@n8n/.../agent, enableStreaming, passthroughBinaryImages)
        ├─ model[0] = OpenAI Chat Model  (gpt-4.1-mini)   ← primário
        ├─ model[1] = Claude Sonnet      (claude-sonnet-4-5) ← fallback (needsFallback)
        ├─ memory   = Memória Postgres   (dp_chat_memory, contextWindowLength 8)
        └─ tool     = buscar_norma_trabalhista → DP_Trabalhista_SubBusca
```

- **Streaming**: responde NDJSON (`{type:"item",content:"…"}`), transmitido token a
  token. Eventos `error` (ex.: rate limit) são repassados ao frontend.
- **Visão**: o nó *Preparar Imagem* transforma `image_base64` em binário; com
  `passthroughBinaryImages` o agente entrega a imagem ao modelo multimodal.
- **Fallback**: se o modelo primário (OpenAI) falhar, o agente reexecuta no Claude.
- **System prompt** (resumo): usar **sempre** a tool antes de afirmar normas; máx. 2
  buscas por tema; **priorizar vigentes** e sinalizar vencidas; responder em markdown
  com os 3 títulos `##`; e anexar ao final o bloco técnico:

  ```
  <vigencia>
  VIG|<fonte>|<inicio_iso>|<fim_iso>
  </vigencia>
  ```

  O frontend (`src/vigencia.ts` → `extrairVigencias`) extrai esse bloco, **esconde**
  do texto e renderiza os selos coloridos.

### 2. Busca RAG — `DP_Trabalhista_SubBusca` (sub-workflow / tool)

```
Execute Workflow Trigger (input: consulta)
  → OpenAI Embeddings (HTTP) — text-embedding-3-small
  → Monta Query (Code: monta SQL com o vetor, lê referencia/titulo/tipo/vigência)
  → Postgres match_documents (top-N por similaridade, inclui vencidos)
  → Formata Resultado (Code: por trecho → Fonte + janela de Vigência + status +
        "LINHA_VIGENCIA: VIG|fonte|de|ate" + conteúdo)
```

Devolve um texto consolidado com fonte e vigência de cada trecho — é o que alimenta
as citações e o bloco `<vigencia>` do agente.

### 3. Vencimentos — `DP_Trabalhista_Documentos_API`

```
Webhook (GET) → Postgres (SELECT em dp_assistant.documentos WHERE vigencia_ate
                IS NOT NULL ORDER BY vigencia_ate) → Respond (JSON)
```

O frontend (`src/vigencia.ts`) agrupa em **vencidos** e **a vencer** (30 dias).

### 4. Ingestão de CCT — `DP_Trabalhista_Ingestao_API`

```
Webhook (POST) → Prepara → (PDF? → OCR Gemini → extrai markdown)
  → Parse + Chunk → fn_upsert_documento_raw → Embedding (OpenAI) →
    fn_insert_chunks_lote → Respond ({ status, chunks })
```

Aceita `.md/.txt` (texto) ou `.pdf` (base64, OCR no n8n). Dedup por `fonte + hash`.

### 5. Compartilhar — `DP_Trabalhista_Share`

```
POST /share-save { title, messages } → INSERT shared_chats (expires_at +30d) → { id }
GET  /share-get?id=  → SELECT (se não expirado) → { title, messages }
```

### Credenciais no n8n

| Credencial | Tipo | Usada por |
| --- | --- | --- |
| `Supabase` | postgres | match_documents, memória, documentos, share, ingest |
| `Trabalhista` / `OpenAI account` | openAiApi | chat (gpt-4.1-mini) e embeddings |
| `Anthropic account` | anthropicApi | fallback (Claude Sonnet) |

---

## Como rodar

Pré-requisitos: **Node 20+**.

```bash
npm install
cp .env.example .env        # Windows: copy .env.example .env  (ou use start.bat)
# preencha as URLs dos webhooks e o login no .env
npm run dev                 # http://localhost:5180
```

No Windows, o **`start.bat`** instala dependências na 1ª vez, garante o `.env` e
sobe o dev. O Vite escuta na rede (`host: true`), então também é acessível por
**http://&lt;IP-da-máquina&gt;:5180** (ex.: `http://192.168.0.47:5180`). Se a porta
estiver ocupada, o Vite usa a próxima livre (5181, 5182…) — **mesma versão**.

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

As chaves de **OpenAI**, **Anthropic** e **Gemini** ficam **no n8n** (credenciais /
node OCR), **nunca no frontend**.

---

## Estrutura

```
.
├── docs/n8n-webhook.md       # contrato dos webhooks + bloco <vigencia> + CORS
├── src/
│   ├── api.ts                # cliente: chat(streaming + timeout), docs, upload, share
│   ├── auth.ts               # login por e-mail + senha (env) e sessão
│   ├── chats.ts              # store de conversas (localStorage, por usuário)
│   ├── user.ts               # UUID por navegador + novo chatId
│   ├── vigencia.ts           # agrupar vencidos/a vencer + extrairVigencias + badgeStatus
│   ├── types.ts              # Message (com image), WebhookRequest (com image_base64), Documento
│   ├── App.tsx               # rota ?share=, LoginGate, Workspace (sidebar + main)
│   └── components/
│       ├── Sidebar.tsx           # navegação, lista de chats (⋯ renomear/excluir), upload
│       ├── LoginGate.tsx         # tela de login / liberação
│       ├── ChatView.tsx          # chat (streaming suave + anti-travamento), Compartilhar
│       ├── ChatInput.tsx         # campo de envio + anexo de imagem ("+")
│       ├── MessageBubble.tsx     # bolha (markdown, imagem, selos de vigência, "Pensando...")
│       ├── Markdown.tsx          # render de markdown estilizado (títulos, listas, tabelas)
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

- **Rate limit da Anthropic**: o Claude (fallback) está em tier baixo (30k tokens/min);
  por isso o primário é a OpenAI (tier mais alto). Subir o tier reduz risco em picos.
- A busca RAG é **por texto**: ao anexar imagem, o modelo a **vê e descreve**, mas
  afirmações normativas continuam vindo da base via embeddings da consulta.
- Documentos **vencidos** aparecem na busca como histórico — sempre confira no texto
  o status (vigente/vencido) e a CCT vigente do período.
- Upload aceita `.md` e `.pdf` (com OCR). PDF leva ~50s (OCR), timeout de 180s. Um CCT
  recém-enviado fica pesquisável, mas **só aparece em "Vencimentos"** após preencher
  `vigencia_ate`. O arquivo é indexado no banco, mas **não é gravado** no bucket
  `dp-assistant/DOC/`.
- Acesso por IP (`http://…`) não tem contexto seguro; copiar o link de
  compartilhamento usa uma caixa de fallback (e o UUID do navegador usa gerador
  alternativo).
```

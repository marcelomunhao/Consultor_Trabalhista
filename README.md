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
- **Contas e acesso** — login por e-mail + senha **validados no servidor** (Supabase
  Edge Function); senha em **hash bcrypt** no banco, **nunca no bundle**.
  - **Cadastre-se** (com campo de **confirmação de senha**): cria a conta
    **pendente**, que só entra após aprovação de um administrador.
  - **Painel "Usuários"** (visível só para admins): **aprovar/recusar** pendentes e
    **excluir** usuários ativos (com modal de confirmação). **Admins nunca podem ser
    excluídos** — nem por outro admin, nem a si mesmos.
  - **Esqueci minha senha**: e-mail real (via n8n/SMTP) com link de redefinição —
    token de **uso único**, válido por **1 hora**; tela `?reset=` define a nova senha.
  - Sem `VITE_LOGIN_URL` no `.env` = acesso livre (sem tela de login).
- **Robustez** — eventos de erro do agente (ex.: rate limit) viram mensagem clara;
  **timeout de 75s** evita "Pensando" infinito; proteção contra a bolha travar se a
  aba perde o foco.

---

## Stack

- **React 19 + TypeScript** (Vite) · **Tailwind CSS v4**
- **react-markdown** + **remark-gfm** (formatação das respostas)
- Backend: **n8n** (6 workflows) + **Supabase / Postgres** (schema `dp_assistant`,
  com **pgvector** e **pgcrypto**) + **Supabase Edge Function** (`login` — roteia
  todas as ações de conta por `{ action }`)
- IA: **OpenAI `gpt-4.1-mini`** (primário) + **Claude Sonnet 4.5** (fallback) ·
  embeddings **`text-embedding-3-small`** · OCR **Gemini** (ingestão de PDF)

---

## Arquitetura (visão geral)

```
Browser (React/Vite :5180)
  ├─ Auth        → POST <supabase>/functions/v1/login    { action, ... }
  │                  Edge Function: login | signup | forgot | reset | admin_list |
  │                  admin_approve | admin_reject | admin_delete  → Postgres (bcrypt)
  │                  forgot → n8n /webhook/trabalhista-email-reset → SMTP Gmail
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

**`dp_assistant.usuarios`** — login do app. Senha em **hash bcrypt** (`pgcrypto`),
nunca em texto puro nem no frontend.

| Coluna | Tipo | Descrição |
| --- | --- | --- |
| `email` | text (PK) | e-mail de acesso |
| `senha_hash` | text | hash bcrypt (`crypt(senha, gen_salt('bf'))`) |
| `nome` | text | nome exibível (opcional) |
| `ativo` | boolean | `false` = pendente/desativado; `true` = pode entrar |
| `is_admin` | boolean | admin (aprova cadastros e vê o painel de usuários) |
| `created_at` | timestamptz | criação |

**`dp_assistant.sessions`** — token opaco (uuid) emitido no login, usado para
autenticar ações (ex.: painel admin). `expires_at` = 30 dias.
**`dp_assistant.password_resets`** — token de uso único para "esqueci a senha"
(`expires_at` = 1 hora, `used_at` quando consumido).

#### Fluxo de acesso

- **Login**: validado na Edge Function (bcrypt no servidor); em caso de sucesso
  retorna `is_admin` + um **token de sessão** (gravado em `sessions`, 30 dias). A
  senha **nunca trafega para o navegador**. Conta pendente recebe a mensagem
  "aguardando aprovação".
- **Cadastre-se**: formulário com nome, e-mail, senha e **confirmação de senha**
  (validadas iguais no front; mínimo 6 caracteres no servidor). Cria a conta
  **pendente** (`ativo=false`) — só entra após aprovação.
- **Aprovação/Gestão**: admins (**ti@** e **marcelo@**) veem o painel **Usuários**:
  **aprovar** (ativa) ou **recusar** (remove) pendentes, e **excluir** usuários
  ativos. **Admins nunca podem ser excluídos** (proteção no servidor) — para
  remover um admin, rebaixe antes (`is_admin = false`) via SQL. Não-admins não veem
  o painel.
- **Esqueci a senha**: gera token de **uso único** (1h) em `password_resets` e envia
  o link por e-mail (via n8n/SMTP); a tela `?reset=<token>` define a nova senha.
  A resposta é sempre "ok" (não revela se o e-mail existe).
- **Bootstrap dos admins**: `ti@` e `marcelo@` foram criados com senha **aleatória
  irrecuperável** — cada um define a própria senha pelo **"Esqueci minha senha"**.

A Edge Function `login` roteia por `{ action }`: `login`, `signup`, `forgot`,
`reset`, `admin_list`, `admin_approve`, `admin_reject`, `admin_delete` (as
`admin_*` exigem o token de uma **sessão válida** cujo usuário seja `is_admin`).

#### Gerenciar usuários (SQL no Supabase)

```sql
-- criar/atualizar usuario ATIVO (admins: is_admin = true):
insert into dp_assistant.usuarios (email, nome, senha_hash, ativo, is_admin)
values ('fulano@empresa.com', 'Fulano',
        extensions.crypt('SENHA', extensions.gen_salt('bf')), true, false)
on conflict (email) do update set senha_hash = excluded.senha_hash, ativo = true;

-- promover a admin:  update dp_assistant.usuarios set is_admin = true where email = '...';
-- desativar:         update dp_assistant.usuarios set ativo = false where email = '...';
```

#### Esqueci a senha — envio do e-mail via n8n

A Edge Function **não** envia SMTP direto (o runtime bloqueia TCP). Ela faz POST
no workflow **`DP_Trabalhista_Email_Reset`** (`/webhook/trabalhista-email-reset`)
com `{ to, subject, html, link, secret }`; o n8n valida o segredo compartilhado e
dispara via **SMTP (Gmail)** com a credencial `SMTP account`. O link de reset usa
o `Origin` da requisição (`<app>/?reset=<token>`).

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

Seis workflows. IDs e endpoints:

| Workflow | ID | Endpoint(s) |
| --- | --- | --- |
| `DP_Trabalhista_Chat_API` | `bCc1WDoYsIQuiTk6` | `POST /webhook/trabalhista-chat` (streaming) |
| `DP_Trabalhista_SubBusca` | `xwdCPcx8owt6PS2m` | sub-workflow (chamado como tool) |
| `DP_Trabalhista_Documentos_API` | `oWeYx5xN0JKqHvBJ` | `GET /webhook/trabalhista-documentos` |
| `DP_Trabalhista_Ingestao_API` | `9wmiEK3TnkTnhdXU` | `POST /webhook/trabalhista-ingest` |
| `DP_Trabalhista_Share` | `wYq8qu7BgNXUPyhl` | `POST /…/share-save` · `GET /…/share-get?id=` |
| `DP_Trabalhista_Email_Reset` | `mtQhhnEEmXTKHMVx` | `POST /webhook/trabalhista-email-reset` (interno: chamado pela Edge Function `login`) |

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

### 6. E-mail de reset de senha — `DP_Trabalhista_Email_Reset`

```
Webhook (POST /webhook/trabalhista-email-reset, responseMode: responseNode)
  → Valida e Prepara (Code: confere o SEGREDO compartilhado do body; rejeita
        chamadas sem ele — evita uso do webhook como relay de spam)
  → Enviar Email (SMTP Gmail, credencial "SMTP account";
        from: "Assistente Trabalhista <sistema@central-rnc.com.br>")
  → Responder ({ ok: true })
```

Chamado **somente** pela Edge Function `login` (ação `forgot`) com
`{ secret, to, subject, html, link }`. O link de reset usa o `Origin` da requisição
do app (`<app>/?reset=<token>`).

### Credenciais no n8n

| Credencial | Tipo | Usada por |
| --- | --- | --- |
| `Supabase` | postgres | match_documents, memória, documentos, share, ingest |
| `Trabalhista` / `OpenAI account` | openAiApi | chat (gpt-4.1-mini) e embeddings |
| `Anthropic account` | anthropicApi | fallback (Claude Sonnet) |
| `SMTP account` | smtp | e-mail de reset de senha (Gmail, porta 465/SSL) |

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

### Primeiro acesso

1. **Admins** (`ti@` e `marcelo@`): já existem no banco com senha aleatória — use
   **"Esqueci minha senha"** na tela de login para receber o link por e-mail e
   definir a sua senha. Depois disso, entram com o painel **Usuários** habilitado.
2. **Demais usuários**: clicam em **"Cadastre-se"** (nome, e-mail, senha +
   confirmação) → a conta fica **pendente** → um admin **aprova** no painel
   Usuários → pronto, já podem entrar.
3. **Importante**: o link do e-mail de reset aponta para o endereço que abriu o
   app (Origin) — peça o reset **a partir do endereço que você usa** (ex.:
   `http://192.168.0.47:5180`).

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
| `VITE_LOGIN_URL` | URL da Edge Function de login (Supabase). Vazio = acesso livre. Usuários/senhas ficam no banco (`dp_assistant.usuarios`, hash bcrypt) — **nada de senha no `.env`**. |

As chaves de **OpenAI**, **Anthropic** e **Gemini** ficam **no n8n** (credenciais /
node OCR), **nunca no frontend**.

---

## Estrutura

```
.
├── docs/n8n-webhook.md       # contrato dos webhooks + bloco <vigencia> + CORS
├── src/
│   ├── api.ts                # cliente: chat(streaming + timeout), docs, upload, share
│   ├── auth.ts               # login via Edge Function (validação no servidor) + sessão
│   ├── chats.ts              # store de conversas (localStorage, por usuário)
│   ├── user.ts               # UUID por navegador + novo chatId
│   ├── vigencia.ts           # agrupar vencidos/a vencer + extrairVigencias + badgeStatus
│   ├── types.ts              # Message (com image), WebhookRequest (com image_base64), Documento
│   ├── App.tsx               # rotas ?share= e ?reset=, LoginGate, Workspace (sidebar + main)
│   └── components/
│       ├── Sidebar.tsx           # navegação (Vencimentos; Usuários p/ admin), chats, upload
│       ├── LoginGate.tsx         # autenticação: Entrar / Cadastre-se (c/ confirmação) / Esqueci a senha
│       ├── ResetView.tsx         # redefinição de senha pelo link do e-mail (?reset=token)
│       ├── UsuariosPanel.tsx     # painel admin: aprovar/recusar pendentes, excluir ativos
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

- **Login validado no servidor**: e-mail/senha são conferidos na Edge Function
  `login`, com a senha em **hash bcrypt** (`pgcrypto`) na `dp_assistant.usuarios` —
  **não fica no bundle**. **Porém** os webhooks do n8n seguem **abertos** (CORS `*`,
  sem token): o login ainda é um **portão de UI**, não protege os webhooks em si.
  Para segurança real de backend, exija um token (emitido no login) nos webhooks.
- **Ações de admin exigem sessão**: `admin_*` só funcionam com um token válido de
  `sessions` (30 dias) pertencente a um usuário `is_admin` — conferido **no
  servidor**, não no front. **Admins não podem ser excluídos** pela API.
- **Webhook de e-mail com segredo**: o `trabalhista-email-reset` rejeita chamadas
  sem o segredo compartilhado (evita abuso como relay de spam). O reset usa token
  de **uso único** com expiração de 1h e resposta neutra (não revela se o e-mail
  existe).
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

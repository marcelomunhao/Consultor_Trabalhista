# Backend n8n — contrato dos webhooks

O frontend fala com **dois webhooks** de workflows n8n. Não há backend próprio
neste repositório — só o contrato que os workflows respeitam.

Base do n8n: `https://webhook.vps.central-rnc.com.br`
(produção: `/webhook/<path>` — teste no editor: `/webhook-test/<path>`)

| Função | Workflow n8n | ID | Webhook (produção) |
|---|---|---|---|
| Chat (Assistente) | `DP_Trabalhista_Chat_API` | `bCc1WDoYsIQuiTk6` | `POST /webhook/trabalhista-chat` |
| Vencimentos | `DP_Trabalhista_Documentos_API` | `oWeYx5xN0JKqHvBJ` | `GET /webhook/trabalhista-documentos` |
| Upload de CCT | `DP_Trabalhista_Ingestao_API` | `9wmiEK3TnkTnhdXU` | `POST /webhook/trabalhista-ingest` |
| Compartilhar (salvar) | `DP_Trabalhista_Share` | `wYq8qu7BgNXUPyhl` | `POST /webhook/trabalhista-share-save` |
| Compartilhar (abrir) | `DP_Trabalhista_Share` | `wYq8qu7BgNXUPyhl` | `GET /webhook/trabalhista-share-get?id=` |

---

## 1. Chat — `POST /webhook/trabalhista-chat`

Fluxo: `Webhook → AI Agent (Claude + memória Postgres + tool buscar_norma_trabalhista) → Respond to Webhook`.

**Request** (`application/json`):
```json
{ "message": "Qual o prazo de pagamento da rescisão sem justa causa?", "sessionId": "uuid-do-usuario" }
```
- `sessionId`: UUID estável por navegador (gerado no front, `localStorage`). O n8n
  usa como chave da **memória de conversa** (tabela `dp_chat_memory`), então cada
  usuário tem histórico e resposta individuais — suporta os ~10 simultâneos.

**Response (streaming):** o webhook está em `responseMode: streaming` e o AI Agent
com `enableStreaming`. A resposta vem como **NDJSON** (uma linha JSON por evento):
```
{"type":"begin","metadata":{...}}
{"type":"item","content":"## Resposta"}
{"type":"item","content":" direta\n..."}
{"type":"end","metadata":{...}}
```
O frontend (`src/api.ts` → `sendMessageStream`) lê o stream, concatena os
`item.content` e atualiza a bolha token a token. Há fallback para resposta única
(`{reply}` / texto) caso o streaming esteja desligado.

O agente é a versão "API" do `DP_Trabalhista_Agente` (Chat Trigger): mesmo modelo
(Claude Sonnet), mesma memória (`dp_chat_memory`) e a mesma ferramenta de busca
RAG (`DP_Trabalhista_SubBusca`). Se você ajustar o prompt em um, sincronize o outro.

---

## 2. Documentos — `GET /webhook/trabalhista-documentos`

Fluxo: `Webhook → Postgres (SELECT em dp_assistant.documentos) → Respond to Webhook`.

**Response**: array de documentos com vigência preenchida (`vigencia_ate IS NOT NULL`),
ordenados por data final:
```json
[
  {
    "id": "uuid",
    "titulo": "2025-CCT_Sinpro_2025-2026_pdf",
    "tipo": "CCT",
    "sindicato": "SINPRO/ES",
    "base": "ES",
    "vigencia_de": "2025-03-01",
    "vigencia_ate": "2026-02-28"
  }
]
```

O frontend (`src/vigencia.ts`) agrupa em **vencidos** (`vigencia_ate < hoje`) e
**a vencer** (próximos 30 dias). `tipo`/`sindicato`/`base` vêm do `metadata` (jsonb).

---

## 3. Upload de CCT — `POST /webhook/trabalhista-ingest`

Fluxo: `Webhook → Prepara → (PDF? → OCR Gemini → Extrai MD) → Parse e Chunk → Upsert Documento → (se novo) Explode → Embedding (OpenAI) → Insert Chunks → Respond`.

Indexa um CCT enviado pela sidebar para a busca RAG do chat. Aceita **`.md`/`.txt`**
(texto) ou **`.pdf`** (OCR via **Gemini 2.5 Flash**). Usa as mesmas funções SQL do
ingest em lote (`fn_upsert_documento_raw`, `fn_insert_chunks_lote`).

**Request** (`application/json`):
```json
// markdown / texto
{ "filename": "2026-NOVA_CCT_2026-2027.md", "content": "<markdown completo>" }
// PDF (OCR no n8n)
{ "filename": "CCT.pdf", "mime": "application/pdf", "file_base64": "<base64 do PDF>" }
```

**Response**:
```json
{ "status": "ingerido", "chunks": 39 }
```
- `status`: `ingerido` (novo/atualizado) ou `ja_ingerido` (dedup por fonte+hash, sem mudança).
- PDF leva ~50s (OCR). O node OCR tem timeout de 180s.

**Limitações / notas:**
- A chave do Gemini está **embutida na URL do node OCR** (no workflow, não no git).
  Mover para uma credencial do n8n é recomendado.
- Não grava o arquivo no bucket `dp-assistant/DOC/` (só indexa no banco). O ingest
  em lote continua sendo a fonte canônica via bucket.
- Não preenche `vigencia_de/ate` do novo documento (a vigência vem do pipeline de
  `vigencias.json`), então um CCT recém-enviado fica pesquisável pelo chat, mas só
  aparece em "Vencimentos" após preencher a vigência.

---

## 4. Compartilhar conversa — `DP_Trabalhista_Share`

Tabela `dp_assistant.shared_chats (id uuid, title, messages jsonb, created_at)`.

- **Salvar** — `POST /webhook/trabalhista-share-save` com `{ title, messages }` →
  insere e responde `{ "id": "<uuid>" }`. O front monta o link `?share=<id>`.
- **Abrir** — `GET /webhook/trabalhista-share-get?id=<uuid>` → `{ title, messages }`.
  O front (`SharedView`) abre em modo somente-leitura, sem login.

---

## CORS

Ambos os webhooks têm *Allowed Origins* = `*` no node Webhook e devolvem
`Access-Control-Allow-Origin: *` no Respond to Webhook. Em produção, restrinja ao
domínio do frontend.

## Origem dos dados de vigência

`dp_assistant.documentos.vigencia_de/ate` e `metadata` foram populados a partir de
`pdfs/MD/vigencias.json` (gerado pelo pipeline de OCR das CCTs). Para atualizar
quando entrarem novas CCTs, rode a ingestão e reaplique o backfill de vigência.

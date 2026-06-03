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

**Response**:
```json
{ "reply": "## Resposta direta\n..." }
```

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

Fluxo: `Webhook → Parse e Chunk → Upsert Documento → (se novo) Explode → Embedding (OpenAI) → Insert Chunks → Respond`.

Indexa um documento `.md` enviado pela sidebar para a busca RAG do chat. Usa as
mesmas funções SQL do ingest em lote (`fn_upsert_documento_raw`, `fn_insert_chunks_lote`).

**Request** (`application/json`):
```json
{ "filename": "2026-NOVA_CCT_2026-2027.md", "content": "<markdown completo>" }
```

**Response**:
```json
{ "status": "ingerido", "chunks": 42 }
```
- `status`: `ingerido` (novo/atualizado) ou `ja_ingerido` (dedup por fonte+hash, sem mudança).

**Limitações conhecidas (hoje):**
- Aceita **`.md` já convertido**. **PDF precisa de OCR** (Gemini) — não implementado
  no n8n ainda (falta credencial Google). Próximo passo.
- Não grava o arquivo no bucket `dp-assistant/DOC/` (só indexa no banco). O ingest
  em lote continua sendo a fonte canônica via bucket.
- Não preenche `vigencia_de/ate` do novo documento (a vigência vem do pipeline de
  OCR/`vigencias.json`), então um CCT recém-enviado fica pesquisável pelo chat, mas
  só aparece em "Vencimentos" após preencher a vigência.

---

## CORS

Ambos os webhooks têm *Allowed Origins* = `*` no node Webhook e devolvem
`Access-Control-Allow-Origin: *` no Respond to Webhook. Em produção, restrinja ao
domínio do frontend.

## Origem dos dados de vigência

`dp_assistant.documentos.vigencia_de/ate` e `metadata` foram populados a partir de
`pdfs/MD/vigencias.json` (gerado pelo pipeline de OCR das CCTs). Para atualizar
quando entrarem novas CCTs, rode a ingestão e reaplique o backfill de vigência.

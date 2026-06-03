# Contrato do backend (n8n)

O frontend fala com um workflow do **n8n** via webhook. Não há código de backend
neste repositório — apenas o contrato que o workflow precisa respeitar.

## Fluxo

```
Frontend (React)
  → POST {VITE_N8N_WEBHOOK_URL}
      body JSON: { "message": string, "sessionId": string }
  → n8n: node Webhook (HTTP POST, Respond = "Using Respond to Webhook node")
      → ...processamento (AI Agent, regras, consulta, etc.)
      → node Respond to Webhook
  → Frontend recebe a resposta e renderiza no chat
```

## Request (frontend → n8n)

`Content-Type: application/json`

```json
{
  "message": "Qual o piso salarial da categoria X?",
  "sessionId": "abc123-def456"
}
```

- `message`: texto digitado pelo usuário.
- `sessionId`: identifica a conversa (persistente enquanto a aba estiver aberta).
  Use no n8n para manter memória/contexto por sessão.

## Response (n8n → frontend)

O node **Respond to Webhook** pode devolver de várias formas. O frontend
(`src/api.ts`) aceita qualquer uma destas:

1. **Texto puro** — `Respond With: Text`, corpo = a resposta.
2. **JSON** com um dos campos: `reply`, `output`, `text`, `message`, `answer`,
   `response`. Ex.:
   ```json
   { "reply": "O piso é R$ 1.800,00." }
   ```
   (Útil porque o node *AI Agent* costuma emitir `output`.)
3. **Array de items do n8n** — ex. `[{ "json": { "output": "..." } }]`. O frontend
   percorre e extrai o primeiro campo de texto que encontrar.

## Configuração do node Webhook

- **HTTP Method:** POST
- **Path:** ex. `trabalhista-chat`
- **Respond:** `Using 'Respond to Webhook' node`
- **CORS:** habilite o domínio do frontend (ou `*` em desenvolvimento) em
  *Allowed Origins*, senão o navegador bloqueia a chamada.

## CORS — atenção

Como o frontend é uma SPA no navegador, o n8n precisa devolver os headers
`Access-Control-Allow-Origin` (e responder ao preflight `OPTIONS`). Configure isso
no node Webhook; sem CORS as requisições falham mesmo com o workflow correto.

# Requisitos

Pré-requisitos para rodar o frontend localmente.

## Ferramentas

| Ferramenta | Versão mínima | Observação                                  |
| ---------- | ------------- | ------------------------------------------- |
| Node.js    | 20+           | Testado em Node 22. Inclui o `npm`.         |
| npm        | 10+           | Vem junto com o Node.                       |
| Git        | qualquer      | Para clonar/versionar.                      |

Verifique:

```powershell
node -v
npm -v
```

## Dependências do projeto

Instaladas via `npm install` (definidas em `package.json`):

**Runtime**
- `react` ^19.1.0
- `react-dom` ^19.1.0

**Desenvolvimento / build**
- `vite` ^6.0.0
- `@vitejs/plugin-react` ^4.3.4
- `tailwindcss` ^4.1.0 + `@tailwindcss/vite` ^4.1.0
- `typescript` ^5.7.0
- `@types/react`, `@types/react-dom`

## Configuração obrigatória

1. Criar o `.env` a partir do `.env.example`.
2. Preencher `VITE_N8N_WEBHOOK_URL` com a URL do webhook do n8n.

```powershell
copy .env.example .env
```

| Variável                | Obrigatória | Descrição                                        |
| ----------------------- | ----------- | ------------------------------------------------ |
| `VITE_N8N_WEBHOOK_URL`  | Sim         | Webhook de chat do n8n (recebe/responde o chat). |
| `VITE_DOCS_WEBHOOK_URL` | Sim         | Webhook de documentos (aba Vencimentos).         |

## Backend (n8n)

Não roda neste repositório. É necessário um workflow do n8n com:
- node **Webhook** (POST, *Respond = Using Respond to Webhook node*) com **CORS** liberado para o domínio do frontend;
- node **Respond to Webhook** devolvendo a resposta.

Contrato completo em [`docs/n8n-webhook.md`](docs/n8n-webhook.md).

## Como subir

```powershell
.\start.bat
```

O `start.bat` instala dependências na primeira vez, garante o `.env` e inicia o
servidor em http://localhost:5180. Alternativa manual: `npm install` + `npm run dev`.

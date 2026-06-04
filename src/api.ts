import type { Documento, Message, WebhookRequest } from "./types";

const CHAT_WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL as string | undefined;
const DOCS_WEBHOOK_URL = import.meta.env.VITE_DOCS_WEBHOOK_URL as string | undefined;
const INGEST_WEBHOOK_URL = import.meta.env.VITE_INGEST_WEBHOOK_URL as string | undefined;
const SHARE_SAVE_URL = import.meta.env.VITE_SHARE_SAVE_URL as string | undefined;
const SHARE_GET_URL = import.meta.env.VITE_SHARE_GET_URL as string | undefined;

export class WebhookError extends Error {}

/** Salva a conversa para compartilhamento e retorna o id do share. */
export async function shareChat(
  title: string,
  messages: Message[],
  signal?: AbortSignal,
): Promise<string> {
  if (!SHARE_SAVE_URL) throw new WebhookError("VITE_SHARE_SAVE_URL nao configurada.");
  const res = await fetch(SHARE_SAVE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, messages }),
    signal,
  });
  if (!res.ok) throw new WebhookError(`O n8n respondeu com status ${res.status}.`);
  const data = (await res.json()) as { id?: string };
  if (!data?.id) throw new WebhookError("Resposta de compartilhamento sem id.");
  return data.id;
}

/** Carrega uma conversa compartilhada (read-only) pelo id. */
export async function fetchSharedChat(
  id: string,
  signal?: AbortSignal,
): Promise<{ title: string; messages: Message[] }> {
  if (!SHARE_GET_URL) throw new WebhookError("VITE_SHARE_GET_URL nao configurada.");
  const res = await fetch(`${SHARE_GET_URL}?id=${encodeURIComponent(id)}`, { signal });
  if (!res.ok) throw new WebhookError(`O n8n respondeu com status ${res.status}.`);
  const data = (await res.json()) as { title?: string; messages?: unknown };
  const messages = Array.isArray(data?.messages) ? (data.messages as Message[]) : [];
  return { title: data?.title ?? "Conversa", messages };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Envia um CCT ao webhook de ingestao do n8n. `.md`/`.txt` vao como texto;
 * `.pdf` vai em base64 e o n8n faz OCR (Gemini) antes de chunk + embedding.
 * O documento fica indexado para a busca do chat.
 */
export async function uploadCct(file: File, signal?: AbortSignal): Promise<string> {
  if (!INGEST_WEBHOOK_URL) {
    throw new WebhookError(
      "VITE_INGEST_WEBHOOK_URL nao configurada. Preencha a URL do webhook de ingestao no .env.",
    );
  }

  const isPdf = /\.pdf$/i.test(file.name) || file.type === "application/pdf";
  const payload = isPdf
    ? { filename: file.name, mime: "application/pdf", file_base64: await fileToBase64(file) }
    : { filename: file.name, content: await file.text() };

  const res = await fetch(INGEST_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) {
    throw new WebhookError(`O n8n respondeu com status ${res.status}.`);
  }

  const raw = await res.text();
  if (!raw) return "Arquivo enviado.";
  try {
    const data = JSON.parse(raw);
    return extractReply(data) ?? (data?.status as string) ?? "Arquivo enviado.";
  } catch {
    return raw;
  }
}

/**
 * Envia uma mensagem ao webhook de chat do n8n e devolve a resposta de texto.
 *
 * O node "Respond to Webhook" pode responder de varias formas; aceitamos tanto
 * texto puro quanto JSON com um dos campos comuns (reply/output/text/message).
 */
export async function sendMessage(req: WebhookRequest, signal?: AbortSignal): Promise<string> {
  if (!CHAT_WEBHOOK_URL) {
    throw new WebhookError(
      "VITE_N8N_WEBHOOK_URL nao configurada. Copie .env.example para .env e preencha a URL do webhook.",
    );
  }

  const res = await fetch(CHAT_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });

  if (!res.ok) {
    throw new WebhookError(`O n8n respondeu com status ${res.status}.`);
  }

  const raw = await res.text();
  if (!raw) return "";

  try {
    const data = JSON.parse(raw);
    return extractReply(data) ?? raw;
  } catch {
    return raw;
  }
}

/**
 * Envia a mensagem e consome a resposta em streaming (NDJSON do n8n: cada linha
 * e um objeto JSON; tokens vem em {type:"item", content:"..."}). Chama onUpdate
 * com o texto acumulado a cada token. Retorna o texto final.
 *
 * Faz fallback para resposta nao-streaming (JSON {reply} ou texto puro).
 */
export async function sendMessageStream(
  req: WebhookRequest,
  onUpdate: (full: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  if (!CHAT_WEBHOOK_URL) {
    throw new WebhookError(
      "VITE_N8N_WEBHOOK_URL nao configurada. Copie .env.example para .env e preencha a URL do webhook.",
    );
  }

  // Rede de seguranca: se nenhum conteudo chegar dentro do tempo limite (conexao
  // morta / "Pensando" infinito), aborta e lanca erro amigavel em vez de travar.
  const FIRST_TOKEN_TIMEOUT_MS = 75_000;
  const stallCtrl = new AbortController();
  if (signal) {
    if (signal.aborted) stallCtrl.abort();
    else signal.addEventListener("abort", () => stallCtrl.abort(), { once: true });
  }
  let gotContent = false;
  const stallTimer = setTimeout(() => {
    if (!gotContent) stallCtrl.abort();
  }, FIRST_TOKEN_TIMEOUT_MS);

  try {
    const res = await fetch(CHAT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal: stallCtrl.signal,
    });
    if (!res.ok) throw new WebhookError(`O n8n respondeu com status ${res.status}.`);
    if (!res.body) {
      const raw = await res.text();
      const txt = parseNaoStreaming(raw);
      onUpdate(txt);
      return txt;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";

    const consumirLinha = (linha: string) => {
      const t = linha.trim();
      if (!t) return;
      // Evento de erro do agente/n8n (ex.: rate limit da Anthropic): surfaça em vez
      // de deixar a resposta vir vazia.
      if (t.startsWith("{")) {
        try {
          const obj = JSON.parse(t) as { type?: string; content?: unknown };
          if (obj.type === "error") {
            throw new WebhookError(mensagemErroAgente(typeof obj.content === "string" ? obj.content : ""));
          }
        } catch (e) {
          if (e instanceof WebhookError) throw e;
          // JSON invalido: segue como token de texto normal abaixo
        }
      }
      const piece = parseLinhaStream(t);
      if (piece) {
        gotContent = true; // chegou conteudo real -> cancela o timeout de stall
        full += piece;
        onUpdate(sanitizeStream(full));
      }
    };

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        consumirLinha(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
      }
    }
    consumirLinha(buffer);

    // Se nada foi extraido como stream, tenta interpretar como JSON/texto inteiro.
    if (!full) {
      const fallback = parseNaoStreaming(buffer);
      if (fallback) {
        onUpdate(sanitizeStream(fallback));
        return sanitizeFinal(fallback);
      }
    }
    return sanitizeFinal(full);
  } catch (e) {
    // Abort por estouro do timeout de stall (nao por cancelamento externo).
    if (stallCtrl.signal.aborted && !(signal && signal.aborted)) {
      throw new WebhookError(
        "A IA demorou demais para responder (sem retorno do servidor). Tente novamente.",
      );
    }
    throw e;
  } finally {
    clearTimeout(stallTimer);
  }
}

/** Traduz a mensagem de erro do agente para algo amigavel ao usuario. */
function mensagemErroAgente(raw: string): string {
  if (/rate limit|input tokens per minute|tokens per minute|\b429\b/i.test(raw)) {
    return "Limite de requisições da IA atingido (tokens por minuto da conta Anthropic). Aguarde alguns segundos e tente novamente — se persistir, é preciso elevar o tier da conta.";
  }
  return raw || "O agente retornou um erro ao gerar a resposta.";
}

/**
 * Mostra apenas a resposta final do agente: descarta a narracao e os rastros de
 * tool-call ('Calling ... with input: {...}') que aparecem ENTRE as buscas.
 * A resposta final e sempre o texto apos o ultimo tool-call completo.
 */
function apenasRespostaFinal(s: string): string {
  const re = /Calling\s+\S+\s+with input:\s*\{[^}]*\}/g;
  let fim = 0;
  for (let m = re.exec(s); m; m = re.exec(s)) fim = m.index + m[0].length;
  return s
    .slice(fim)
    .replace(/Calling\s+[\s\S]*$/, "") // rastro de tool-call incompleto no fim
    .replace(/^\s+/, "");
}

/**
 * Exibicao ao vivo: so a resposta final e esconde o bloco <vigencia> de rodape,
 * inclusive quando ainda esta chegando incompleto (ex.: "...<vige").
 */
function sanitizeStream(s: string): string {
  return apenasRespostaFinal(s)
    .replace(/\n*<vigencia[\s\S]*$/i, "")
    .replace(/\n*<v(?:i(?:g(?:e(?:n(?:c(?:i(?:a(?:>)?)?)?)?)?)?)?)?$/i, "");
}

/**
 * Valor final/armazenado: tira tool-calls mas PRESERVA o bloco <vigencia>,
 * que o MessageBubble usa para montar os selos de vigencia.
 */
function sanitizeFinal(s: string): string {
  return apenasRespostaFinal(s);
}

/** Extrai o texto de uma linha NDJSON do stream do n8n. */
function parseLinhaStream(linha: string): string {
  try {
    const obj = JSON.parse(linha) as { type?: string; content?: unknown };
    if (obj.type === "item" && typeof obj.content === "string") return obj.content;
    return "";
  } catch {
    // Linha nao-JSON: trata como token de texto puro.
    return linha;
  }
}

function parseNaoStreaming(raw: string): string {
  if (!raw) return "";
  try {
    return extractReply(JSON.parse(raw)) ?? raw;
  } catch {
    return raw;
  }
}

/**
 * Busca a lista de documentos (CCTs etc.) com suas vigencias no webhook de
 * vencimentos do n8n. Retorna a lista crua; o agrupamento por situacao
 * (vencido / a vencer) e feito no frontend (ver vigencia.ts).
 */
export async function fetchDocumentos(signal?: AbortSignal): Promise<Documento[]> {
  if (!DOCS_WEBHOOK_URL) {
    throw new WebhookError(
      "VITE_DOCS_WEBHOOK_URL nao configurada. Preencha a URL do webhook de vencimentos no .env.",
    );
  }

  const res = await fetch(DOCS_WEBHOOK_URL, { signal });
  if (!res.ok) {
    throw new WebhookError(`O n8n respondeu com status ${res.status}.`);
  }

  const data = await res.json();
  return normalizeDocumentos(data);
}

/** Aceita array direto, { data: [...] } ou items do n8n [{ json: {...} }]. */
function normalizeDocumentos(data: unknown): Documento[] {
  const arr = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { data?: unknown }).data)
      ? (data as { data: unknown[] }).data
      : [];

  return arr.map((item) => {
    const row = (item && typeof item === "object" && "json" in item
      ? (item as { json: unknown }).json
      : item) as Record<string, unknown>;

    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    return {
      id: String(row.id ?? row.fonte ?? row.titulo ?? crypto.randomUUID?.() ?? Math.random()),
      titulo: String(row.titulo ?? row.fonte ?? "(sem titulo)"),
      tipo: (row.tipo as string) ?? (meta.tipo_documento as string) ?? null,
      sindicato: (row.sindicato as string) ?? (meta.sindicato_laboral as string) ?? null,
      base: (row.base as string) ?? (meta.base_territorial as string) ?? null,
      vigencia_de: (row.vigencia_de as string) ?? null,
      vigencia_ate: (row.vigencia_ate as string) ?? null,
    };
  });
}

function extractReply(data: unknown): string | null {
  if (typeof data === "string") return data;

  if (Array.isArray(data)) {
    for (const item of data) {
      const found = extractReply(item);
      if (found) return found;
    }
    return null;
  }

  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (obj.json) {
      const nested = extractReply(obj.json);
      if (nested) return nested;
    }
    for (const key of ["reply", "output", "text", "message", "answer", "response"]) {
      const value = obj[key];
      if (typeof value === "string" && value.trim()) return value;
    }
  }

  return null;
}

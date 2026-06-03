import type { Documento, WebhookRequest } from "./types";

const CHAT_WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL as string | undefined;
const DOCS_WEBHOOK_URL = import.meta.env.VITE_DOCS_WEBHOOK_URL as string | undefined;
const INGEST_WEBHOOK_URL = import.meta.env.VITE_INGEST_WEBHOOK_URL as string | undefined;

export class WebhookError extends Error {}

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

  const res = await fetch(CHAT_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
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
    const piece = parseLinhaStream(t);
    if (piece) {
      full += piece;
      onUpdate(sanitizeResposta(full));
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
      onUpdate(fallback);
      return fallback;
    }
  }
  return sanitizeResposta(full);
}

/**
 * Remove o rastro de chamadas de ferramenta do agente
 * (ex.: 'Calling buscar_norma_trabalhista with input: {...}') que vaza no stream.
 */
function sanitizeResposta(s: string): string {
  return s
    .replace(/Calling\s+\S+\s+with input:\s*\{[^}]*\}/g, "") // tool-calls completos
    .replace(/Calling\s+[\s\S]*$/, "") // rastro de tool-call em progresso (no fim)
    .replace(/^\s+/, "");
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

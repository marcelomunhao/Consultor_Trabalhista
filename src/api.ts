import type { Documento, WebhookRequest } from "./types";

const CHAT_WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL as string | undefined;
const DOCS_WEBHOOK_URL = import.meta.env.VITE_DOCS_WEBHOOK_URL as string | undefined;

export class WebhookError extends Error {}

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

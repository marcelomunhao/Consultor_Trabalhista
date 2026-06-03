import type { WebhookRequest } from "./types";

const WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL as string | undefined;

export class WebhookError extends Error {}

/**
 * Envia uma mensagem ao webhook do n8n e devolve a resposta de texto.
 *
 * O node "Respond to Webhook" do n8n pode responder de varias formas; aceitamos
 * tanto texto puro quanto JSON com um dos campos comuns (reply/output/text/message).
 */
export async function sendMessage(req: WebhookRequest, signal?: AbortSignal): Promise<string> {
  if (!WEBHOOK_URL) {
    throw new WebhookError(
      "VITE_N8N_WEBHOOK_URL nao configurada. Copie .env.example para .env e preencha a URL do webhook.",
    );
  }

  const res = await fetch(WEBHOOK_URL, {
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

  // Tenta JSON; se nao for, devolve o texto cru.
  try {
    const data = JSON.parse(raw);
    return extractReply(data) ?? raw;
  } catch {
    return raw;
  }
}

function extractReply(data: unknown): string | null {
  if (typeof data === "string") return data;

  // n8n costuma devolver array de items: [{ json: {...} }] ou [{...}]
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

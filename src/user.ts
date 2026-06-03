const STORAGE_KEY = "trabalhista-user-id";

function generateUuid(): string {
  // crypto.randomUUID existe em contexto seguro (https/localhost).
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback simples (suficiente para identificar a sessao do usuario).
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * UUID estavel por navegador (persistido em localStorage). Identifica o
 * dispositivo/usuario de forma estavel entre sessoes.
 */
export function getUserId(): string {
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = generateUuid();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

/**
 * Gera um novo identificador de conversa. Enviado ao n8n como sessionId — cada
 * chatId e uma thread de memoria separada, entao "Novo chat" comeca limpo.
 */
export function newChatId(): string {
  return generateUuid();
}

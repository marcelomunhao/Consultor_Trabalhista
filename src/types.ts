export type Role = "user" | "assistant";

export interface Message {
  id: string;
  role: Role;
  content: string;
  /** Timestamp em ms (Date.now) de quando a mensagem entrou no chat. */
  at: number;
}

/** Payload enviado ao webhook do n8n. */
export interface WebhookRequest {
  message: string;
  /** Identifica a conversa para o n8n manter contexto/memoria por sessao. */
  sessionId: string;
}

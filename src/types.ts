export type Role = "user" | "assistant";

export interface Message {
  id: string;
  role: Role;
  content: string;
  /** Timestamp em ms (Date.now) de quando a mensagem entrou no chat. */
  at: number;
  /** Imagem anexada (data URL) para exibir no balao do usuario. */
  image?: string;
}

/** Payload enviado ao webhook de chat do n8n. */
export interface WebhookRequest {
  message: string;
  /** UUID do usuario — o n8n usa para responder/lembrar de forma individual. */
  sessionId: string;
  /** Imagem anexada em base64 (sem o prefixo data:) — opcional. */
  image_base64?: string;
  /** MIME da imagem anexada (ex.: image/png) — opcional. */
  image_mime?: string;
}

/** Documento (CCT/ACT/Aditivo/etc.) vindo do webhook de vencimentos. */
export interface Documento {
  id: string;
  titulo: string;
  tipo: string | null;
  sindicato: string | null;
  base: string | null;
  /** Datas ISO (YYYY-MM-DD) ou null. */
  vigencia_de: string | null;
  vigencia_ate: string | null;
}

export type SituacaoVigencia = "vencido" | "a_vencer" | "em_dia" | "sem_data";

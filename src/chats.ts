import type { Message } from "./types";
import { getCurrentUser } from "./auth";
import { newChatId } from "./user";

export interface Chat {
  id: string;
  title: string;
  /** true quando o usuario renomeou manualmente (nao sobrescrever pela 1a mensagem). */
  titleCustom?: boolean;
  messages: Message[];
  updatedAt: number;
}

/** Chaveado por usuario logado para nao misturar conversas no mesmo navegador. */
function storageKey(): string {
  return `trabalhista-chats:${getCurrentUser() ?? "anon"}`;
}

export function loadChats(): Chat[] {
  try {
    const raw = localStorage.getItem(storageKey());
    const arr = raw ? (JSON.parse(raw) as Chat[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveChats(chats: Chat[]): void {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(chats.slice(0, 50)));
  } catch {
    // ignora estouro de quota
  }
}

export function novoChat(): Chat {
  return { id: newChatId(), title: "Novo chat", messages: [], updatedAt: Date.now() };
}

/** Titulo derivado da 1a mensagem do usuario. */
export function tituloDoChat(messages: Message[]): string {
  const primeira = messages.find((m) => m.role === "user");
  if (!primeira) return "Novo chat";
  const t = primeira.content.trim().replace(/\s+/g, " ");
  return t.length > 42 ? `${t.slice(0, 42)}…` : t;
}

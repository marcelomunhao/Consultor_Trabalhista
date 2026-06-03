import { useEffect, useState } from "react";
import { fetchSharedChat } from "../api";
import { MessageBubble } from "./MessageBubble";
import type { Message } from "../types";

type Estado =
  | { tipo: "loading" }
  | { tipo: "ok"; title: string; messages: Message[] }
  | { tipo: "erro" };

/** Visualizacao somente-leitura de uma conversa compartilhada (?share=id). */
export function SharedView({ id }: { id: string }) {
  const [estado, setEstado] = useState<Estado>({ tipo: "loading" });

  useEffect(() => {
    const ctrl = new AbortController();
    fetchSharedChat(id, ctrl.signal)
      .then((d) => setEstado({ tipo: "ok", title: d.title, messages: d.messages }))
      .catch((err) => {
        if ((err as Error).name !== "AbortError") setEstado({ tipo: "erro" });
      });
    return () => ctrl.abort();
  }, [id]);

  const base = `${window.location.origin}${window.location.pathname}`;

  return (
    <div className="flex h-full flex-col bg-white">
      <header className="flex items-center justify-between gap-2 border-b border-[#e0eef5] bg-[#0c272f] px-5 py-3 text-white">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0e7490] text-xs font-bold">
            T
          </div>
          <span className="truncate text-sm font-medium">
            {estado.tipo === "ok" ? estado.title : "Conversa compartilhada"}
          </span>
        </div>
        <a
          href={base}
          className="shrink-0 rounded-lg bg-[#0e7490] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0c5d72]"
        >
          Abrir o assistente
        </a>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl space-y-3 px-4 py-6">
          {estado.tipo === "loading" && (
            <p className="text-center text-sm text-[#5b8497]">Carregando conversa...</p>
          )}
          {estado.tipo === "erro" && (
            <p className="text-center text-sm text-red-600">
              Conversa não encontrada ou link inválido.
            </p>
          )}
          {estado.tipo === "ok" &&
            (estado.messages.length === 0 ? (
              <p className="text-center text-sm text-[#5b8497]">Conversa vazia.</p>
            ) : (
              estado.messages.map((m) => <MessageBubble key={m.id} message={m} />)
            ))}
        </div>
      </div>

      <footer className="border-t border-[#eef2f5] py-2 text-center text-[11px] text-[#9bbccb]">
        Conversa compartilhada (somente leitura) — Assistente Trabalhista
      </footer>
    </div>
  );
}

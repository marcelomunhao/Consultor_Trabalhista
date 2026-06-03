import { useEffect, useRef, useState } from "react";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import { sendMessageStream, WebhookError } from "../api";
import type { Message } from "../types";

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

const SUGESTOES = [
  "Prazo de pagamento da rescisão sem justa causa",
  "Como calcular o adicional noturno",
  "Regras do aviso prévio",
  "Piso salarial da categoria",
];

interface ChatViewProps {
  chatId: string;
  messages: Message[];
  onMessagesChange: (updater: (prev: Message[]) => Message[]) => void;
}

/** chatId identifica a conversa (sessionId no n8n). Trocar de chatId = chat limpo. */
export function ChatView({ chatId, messages, onMessagesChange }: ChatViewProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Streaming suave: os tokens vao para targetRef (sem re-render); um loop de
  // animacao revela o texto em direcao ao alvo, re-renderizando so a bolha.
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const targetRef = useRef("");
  const shownRef = useRef("");
  const doneRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamingText, loading]);

  function animar(botId: string) {
    targetRef.current = "";
    shownRef.current = "";
    doneRef.current = false;
    setStreamingText("");
    setStreamingId(botId);

    const tick = () => {
      const alvo = targetRef.current;
      const atual = shownRef.current;
      if (atual.length < alvo.length) {
        // revela uma fracao do que falta -> rapido quando atrasado, suave no fim
        const falta = alvo.length - atual.length;
        const passo = Math.max(2, Math.ceil(falta * 0.2));
        const proximo = alvo.slice(0, atual.length + passo);
        shownRef.current = proximo;
        setStreamingText(proximo);
        rafRef.current = requestAnimationFrame(tick);
      } else if (!doneRef.current) {
        rafRef.current = requestAnimationFrame(tick); // espera mais tokens
      } else {
        rafRef.current = null;
        setStreamingId(null); // terminou: passa a renderizar do estado do app
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  async function handleSend(text: string) {
    setError(null);
    const userMsg: Message = { id: makeId(), role: "user", content: text, at: Date.now() };
    const botId = makeId();
    onMessagesChange((prev) => [
      ...prev,
      userMsg,
      { id: botId, role: "assistant", content: "", at: Date.now() },
    ]);
    setLoading(true);
    animar(botId);

    try {
      const final = await sendMessageStream({ message: text, sessionId: chatId }, (full) => {
        targetRef.current = full; // so atualiza o buffer; a animacao exibe
      });
      const texto = final || "(resposta vazia do n8n)";
      targetRef.current = texto;
      onMessagesChange((prev) => prev.map((m) => (m.id === botId ? { ...m, content: texto } : m)));
      doneRef.current = true; // a animacao termina de revelar e limpa o streamingId
    } catch (err) {
      doneRef.current = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      setStreamingId(null);
      setError(
        err instanceof WebhookError
          ? err.message
          : "Falha ao falar com o backend. Verifique o webhook do n8n.",
      );
      onMessagesChange((prev) => prev.filter((m) => m.id !== botId));
    } finally {
      setLoading(false);
    }
  }

  // Tela inicial: input centralizado, estilo claude.ai.
  if (messages.length === 0 && !loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-4">
        <div className="w-full max-w-2xl">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-[#0f2b35]">
              Assistente Trabalhista
            </h2>
            <p className="mt-1.5 text-sm text-[#3f6f81]">Como posso ajudar você hoje?</p>
          </div>

          {error && (
            <div className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <ChatInput disabled={loading} onSend={handleSend} hero />

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {SUGESTOES.map((s) => (
              <button
                key={s}
                onClick={() => handleSend(s)}
                className="rounded-full border border-[#bcd7e3] bg-white px-3.5 py-1.5 text-sm text-[#1a5366] shadow-sm transition hover:border-[#0e7490] hover:bg-[#eaf6fb] hover:text-[#0e7490]"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Conversa em andamento: coluna central (mensagens) + input centralizado embaixo.
  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl space-y-3 px-4 py-6">
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m.id === streamingId ? { ...m, content: streamingText } : m}
            />
          ))}
        </div>
      </div>

      {error && (
        <div className="mx-auto w-full max-w-3xl px-4 pt-1">
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-3xl px-4 pb-4 pt-2">
        <ChatInput disabled={loading} onSend={handleSend} />
      </div>
    </div>
  );
}

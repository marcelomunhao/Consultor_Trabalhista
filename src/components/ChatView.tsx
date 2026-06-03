import { useEffect, useRef, useState } from "react";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import { sendMessage, WebhookError } from "../api";
import { getUserId } from "../user";
import type { Message } from "../types";

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function ChatView() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userId = useRef(getUserId());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend(text: string) {
    setError(null);
    const userMsg: Message = { id: makeId(), role: "user", content: text, at: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const reply = await sendMessage({ message: text, sessionId: userId.current });
      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role: "assistant",
          content: reply || "(resposta vazia do n8n)",
          at: Date.now(),
        },
      ]);
    } catch (err) {
      setError(
        err instanceof WebhookError
          ? err.message
          : "Falha ao falar com o backend. Verifique o webhook do n8n.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-5">
        {messages.length === 0 && !loading && (
          <div className="mt-10 text-center text-sm text-[#629bb5]">
            Envie uma mensagem para comecar a conversa.
          </div>
        )}

        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm border border-[#d7e8f0] bg-white px-4 py-3 shadow-sm">
              <span className="flex gap-1">
                <Dot /> <Dot delay="0.15s" /> <Dot delay="0.3s" />
              </span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="border-t border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <ChatInput disabled={loading} onSend={handleSend} />
    </div>
  );
}

function Dot({ delay = "0s" }: { delay?: string }) {
  return (
    <span
      className="inline-block h-2 w-2 animate-bounce rounded-full bg-[#629bb5]"
      style={{ animationDelay: delay }}
    />
  );
}

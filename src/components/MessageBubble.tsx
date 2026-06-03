import type { Message } from "../types";
import { Markdown } from "./Markdown";

const timeFmt = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words shadow-sm",
          isUser
            ? "bg-[#0e7490] text-white rounded-br-sm"
            : "bg-white text-[#0f2b35] border border-[#cfe0e9] rounded-bl-sm",
        ].join(" ")}
      >
        {isUser ? (
          <span className="whitespace-pre-wrap">{message.content}</span>
        ) : message.content ? (
          <Markdown>{message.content}</Markdown>
        ) : (
          <TypingDots />
        )}
        {(isUser || message.content) && (
          <span
            className={`mt-1 block text-[10px] ${isUser ? "text-cyan-100/90" : "text-[#5b8497]"}`}
          >
            {timeFmt.format(message.at)}
          </span>
        )}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="flex gap-1 py-1">
      {["0s", "0.15s", "0.3s"].map((d) => (
        <span
          key={d}
          className="inline-block h-2 w-2 animate-bounce rounded-full bg-[#629bb5]"
          style={{ animationDelay: d }}
        />
      ))}
    </span>
  );
}

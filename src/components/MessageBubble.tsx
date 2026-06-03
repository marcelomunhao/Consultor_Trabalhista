import type { Message } from "../types";

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
          "max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm",
          isUser
            ? "bg-[#0e7490] text-white rounded-br-sm"
            : "bg-white text-[#0f2b35] border border-[#cfe0e9] rounded-bl-sm",
        ].join(" ")}
      >
        {message.content}
        <span
          className={`mt-1 block text-[10px] ${isUser ? "text-cyan-100/90" : "text-[#5b8497]"}`}
        >
          {timeFmt.format(message.at)}
        </span>
      </div>
    </div>
  );
}

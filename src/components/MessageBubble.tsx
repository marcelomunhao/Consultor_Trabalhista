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
            ? "bg-[#347891] text-white rounded-br-sm"
            : "bg-white text-[#183844] border border-[#d7e8f0] rounded-bl-sm",
        ].join(" ")}
      >
        {message.content}
        <span
          className={`mt-1 block text-[10px] ${isUser ? "text-cyan-100/80" : "text-[#629bb5]"}`}
        >
          {timeFmt.format(message.at)}
        </span>
      </div>
    </div>
  );
}

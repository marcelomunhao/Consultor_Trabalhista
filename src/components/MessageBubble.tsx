import { memo } from "react";
import type { Message } from "../types";
import { Markdown } from "./Markdown";

const timeFmt = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});

function MessageBubbleBase({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div
      className={[
        "w-full rounded-2xl px-4 py-3 text-sm leading-relaxed break-words",
        isUser
          ? "bg-[#0e7490] text-white"
          : "border border-[#e0eef5] bg-white text-[#0f2b35]",
      ].join(" ")}
    >
      {isUser ? (
        <span className="whitespace-pre-wrap">{message.content}</span>
      ) : message.content ? (
        <Markdown>{message.content}</Markdown>
      ) : (
        <Pensando />
      )}
      {(isUser || message.content) && (
        <span className={`mt-1.5 block text-[10px] ${isUser ? "text-cyan-100/80" : "text-[#5b8497]"}`}>
          {timeFmt.format(message.at)}
        </span>
      )}
    </div>
  );
}

export const MessageBubble = memo(MessageBubbleBase);

function Pensando() {
  return (
    <span className="flex items-center gap-2 py-0.5 text-[#5b8497]">
      <span className="animate-pulse font-medium">Pensando</span>
      <span className="flex gap-1">
        {["0s", "0.15s", "0.3s"].map((d) => (
          <span
            key={d}
            className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-[#629bb5]"
            style={{ animationDelay: d }}
          />
        ))}
      </span>
    </span>
  );
}

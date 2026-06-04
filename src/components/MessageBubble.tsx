import { memo } from "react";
import type { Message } from "../types";
import { Markdown } from "./Markdown";
import {
  badgeStatus,
  extrairVigencias,
  formatData,
  type VigenciaBadge,
  type VigenciaFonte,
} from "../vigencia";

const timeFmt = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});

function MessageBubbleBase({ message }: { message: Message }) {
  const isUser = message.role === "user";

  // Nas respostas do assistente, separa o texto do bloco <vigencia> de rodape:
  // o texto vai pro markdown e as fontes viram selos coloridos.
  const { texto, fontes } = isUser
    ? { texto: message.content, fontes: [] as VigenciaFonte[] }
    : extrairVigencias(message.content);

  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "rounded-2xl px-4 py-3 text-sm leading-relaxed break-words",
          isUser
            ? "max-w-[80%] bg-[#0e7490] text-white"
            : "w-full border border-[#e0eef5] bg-white text-[#0f2b35]",
        ].join(" ")}
      >
        {isUser ? (
          <span className="whitespace-pre-wrap">{message.content}</span>
        ) : texto ? (
          <Markdown>{texto}</Markdown>
        ) : (
          <Pensando />
        )}

        {!isUser && fontes.length > 0 && <VigenciaBadges fontes={fontes} />}

        {(isUser || texto) && (
          <span className={`mt-1.5 block text-[10px] ${isUser ? "text-cyan-100/80" : "text-[#5b8497]"}`}>
            {timeFmt.format(message.at)}
          </span>
        )}
      </div>
    </div>
  );
}

export const MessageBubble = memo(MessageBubbleBase);

const BADGE_STYLE: Record<VigenciaBadge, string> = {
  vigente: "border-emerald-200 bg-emerald-50 text-emerald-700",
  permanente: "border-emerald-200 bg-emerald-50 text-emerald-700",
  a_vencer: "border-amber-200 bg-amber-50 text-amber-700",
  vencida: "border-red-200 bg-red-50 text-red-700",
};

const DOT_STYLE: Record<VigenciaBadge, string> = {
  vigente: "bg-emerald-500",
  permanente: "bg-emerald-500",
  a_vencer: "bg-amber-500",
  vencida: "bg-red-500",
};

function rotuloStatus(f: VigenciaFonte, status: VigenciaBadge): string {
  switch (status) {
    case "vencida":
      return `Vencida em ${formatData(f.ate)}`;
    case "a_vencer":
      return `Vence em ${formatData(f.ate)}`;
    case "vigente":
      return `Em vigência até ${formatData(f.ate)}`;
    case "permanente":
      return "Em vigência";
  }
}

function VigenciaBadges({ fontes }: { fontes: VigenciaFonte[] }) {
  return (
    <div className="mt-3 border-t border-[#eef4f8] pt-2.5">
      <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wide text-[#7ba0b1]">
        Vigência das fontes
      </span>
      <div className="flex flex-wrap gap-1.5">
        {fontes.map((f) => {
          const status = badgeStatus(f.ate);
          return (
            <span
              key={f.fonte}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${BADGE_STYLE[status]}`}
              title={`${f.fonte} — ${rotuloStatus(f, status)}`}
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_STYLE[status]}`} />
              <span className="max-w-[16rem] truncate">{f.fonte}</span>
              <span className="opacity-60">·</span>
              <span className="whitespace-nowrap">{rotuloStatus(f, status)}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

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

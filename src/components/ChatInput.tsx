import { useState, type FormEvent, type KeyboardEvent } from "react";

interface ChatInputProps {
  disabled: boolean;
  onSend: (text: string) => void;
  /** Variante centralizada (tela inicial) com card arredondado em vez de barra. */
  hero?: boolean;
}

export function ChatInput({ disabled, onSend, hero = false }: ChatInputProps) {
  const [value, setValue] = useState("");

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    submit();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  const containerCls = hero
    ? "flex items-center gap-2 rounded-2xl border-2 border-[#bcd7e3] bg-white p-3 shadow-xl shadow-[#0e7490]/10 transition focus-within:border-[#0e7490]"
    : "flex items-center gap-2 rounded-2xl border border-[#cfe0e9] bg-white p-2.5 shadow-lg shadow-black/5 transition focus-within:border-[#0e7490]";

  return (
    <form onSubmit={handleSubmit} className={containerCls}>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={hero ? 2 : 1}
        placeholder="Escreva sua mensagem..."
        className={`max-h-40 flex-1 resize-none rounded-xl border border-[#cfe0e9] bg-[#f4fafd] px-3.5 py-2.5 text-sm text-[#0f2b35] outline-none placeholder:text-[#7da7b8] focus:border-[#0e7490] focus:ring-2 focus:ring-[#0e7490]/25 ${
          hero ? "min-h-[78px]" : "min-h-[52px]"
        }`}
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="rounded-xl bg-[#0e7490] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0c5d72] disabled:cursor-not-allowed disabled:opacity-40"
      >
        Enviar
      </button>
    </form>
  );
}

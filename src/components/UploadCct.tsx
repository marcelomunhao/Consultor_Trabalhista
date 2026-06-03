import { useRef, useState } from "react";
import { uploadCct, WebhookError } from "../api";

type Estado =
  | { tipo: "idle" }
  | { tipo: "enviando"; nome: string }
  | { tipo: "ok"; msg: string }
  | { tipo: "erro"; msg: string };

export function UploadCct({ onUploaded }: { onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<Estado>({ tipo: "idle" });

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setEstado({ tipo: "enviando", nome: file.name });
    try {
      const msg = await uploadCct(file);
      setEstado({ tipo: "ok", msg });
      onUploaded();
    } catch (err) {
      setEstado({
        tipo: "erro",
        msg: err instanceof WebhookError ? err.message : "Falha no envio do arquivo.",
      });
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const enviando = estado.tipo === "enviando";

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".md,.txt,.pdf,text/markdown,text/plain,application/pdf"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={enviando}
        className="flex w-full items-center gap-2 rounded-lg border border-dashed border-[#3a6675] bg-[#163945] px-3 py-2.5 text-sm text-[#a9c8d5] transition hover:border-[#4f8197] hover:text-white disabled:opacity-60"
      >
        <UploadIcon />
        {enviando ? "Processando..." : "Enviar CCT (.md/.pdf)"}
      </button>

      {estado.tipo === "enviando" && (
        <p className="mt-1.5 truncate px-1 text-[11px] text-[#9bc3d2]">
          {estado.nome} — PDF faz OCR, pode levar ~1 min
        </p>
      )}
      {estado.tipo === "ok" && (
        <p className="mt-1.5 px-1 text-[11px] text-emerald-300">{estado.msg}</p>
      )}
      {estado.tipo === "erro" && (
        <p className="mt-1.5 px-1 text-[11px] text-red-300">{estado.msg}</p>
      )}
    </div>
  );
}

function UploadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
    </svg>
  );
}

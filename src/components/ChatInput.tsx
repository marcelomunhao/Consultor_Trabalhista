import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";

export interface ImagemAnexada {
  /** data URL (data:image/...;base64,....) para preview e armazenamento. */
  dataUrl: string;
  mime: string;
}

interface ChatInputProps {
  disabled: boolean;
  onSend: (text: string, image?: ImagemAnexada) => void;
  /** Variante centralizada (tela inicial) com card arredondado em vez de barra. */
  hero?: boolean;
}

const MAX_LADO = 1568; // redimensiona o maior lado da imagem (bom p/ visao + payload menor)
const MAX_BYTES = 5 * 1024 * 1024; // 5MB no arquivo original

/** Le o arquivo, redimensiona (canvas) e devolve data URL pronto p/ envio. */
function prepararImagem(file: File): Promise<ImagemAnexada> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Imagem invalida."));
      img.onload = () => {
        const maior = Math.max(img.width, img.height);
        const escala = maior > MAX_LADO ? MAX_LADO / maior : 1;
        const w = Math.round(img.width * escala);
        const h = Math.round(img.height * escala);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve({ dataUrl: String(reader.result), mime: file.type });
        ctx.drawImage(img, 0, 0, w, h);
        // PNG preserva texto nitido (prints); demais viram JPEG p/ economizar.
        const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
        const dataUrl = canvas.toDataURL(mime, mime === "image/jpeg" ? 0.85 : undefined);
        resolve({ dataUrl, mime });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function ChatInput({ disabled, onSend, hero = false }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [image, setImage] = useState<ImagemAnexada | null>(null);
  const [erroImg, setErroImg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function escolherArquivo(file: File | undefined) {
    setErroImg(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErroImg("Selecione um arquivo de imagem.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setErroImg("Imagem muito grande (máx. 5MB).");
      return;
    }
    try {
      setImage(await prepararImagem(file));
    } catch {
      setErroImg("Não foi possível ler a imagem.");
    }
  }

  function submit() {
    const text = value.trim();
    if ((!text && !image) || disabled) return;
    onSend(text, image ?? undefined);
    setValue("");
    setImage(null);
    setErroImg(null);
    if (fileRef.current) fileRef.current.value = "";
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
    ? "rounded-2xl border-2 border-[#bcd7e3] bg-white px-3 py-2.5 shadow-xl shadow-[#0e7490]/10 transition focus-within:border-[#0e7490]"
    : "rounded-2xl border border-[#cfe0e9] bg-white px-3 py-2 shadow-lg shadow-black/5 transition focus-within:border-[#0e7490]";

  return (
    <form onSubmit={handleSubmit} className={containerCls}>
      {image && (
        <div className="mb-1.5 inline-flex items-start gap-2">
          <img src={image.dataUrl} alt="Anexo" className="h-16 w-16 rounded-lg border border-[#e0eef5] object-cover" />
          <button
            type="button"
            onClick={() => {
              setImage(null);
              if (fileRef.current) fileRef.current.value = "";
            }}
            className="rounded-md px-1.5 py-0.5 text-xs text-[#5b8497] hover:bg-[#eef6fb] hover:text-[#0f2b35]"
            aria-label="Remover imagem"
          >
            ✕
          </button>
        </div>
      )}

      {erroImg && <p className="mb-1 px-1 text-xs text-red-600">{erroImg}</p>}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => escolherArquivo(e.target.files?.[0])}
      />

      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={hero ? 2 : 1}
        placeholder="Escreva uma mensagem..."
        className={`max-h-40 w-full resize-none border-0 bg-transparent px-1 text-sm text-[#0f2b35] outline-none placeholder:text-[#7da7b8] ${
          hero ? "min-h-[60px]" : "min-h-[36px]"
        }`}
      />

      <div className="mt-1 flex items-center justify-between">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          title="Anexar imagem"
          aria-label="Anexar imagem"
          className="rounded-lg p-1.5 text-[#5b8497] transition hover:bg-[#eef6fb] hover:text-[#0e7490] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <PlusIcon />
        </button>
        <button
          type="submit"
          disabled={disabled || (!value.trim() && !image)}
          className="rounded-xl bg-[#0e7490] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0c5d72] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Enviar
        </button>
      </div>
    </form>
  );
}

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

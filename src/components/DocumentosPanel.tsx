import { useCallback, useEffect, useState } from "react";
import { fetchDocumentos, WebhookError } from "../api";
import { agrupar, diasRestantes, formatData, JANELA_DIAS } from "../vigencia";
import type { Documento } from "../types";

export function DocumentosPanel() {
  const [docs, setDocs] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDocumentos(signal);
      setDocs(data);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(
        err instanceof WebhookError
          ? err.message
          : "Falha ao buscar documentos. Verifique o webhook de vencimentos.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    carregar(ctrl.signal);
    return () => ctrl.abort();
  }, [carregar]);

  const { vencidos, aVencer } = agrupar(docs);

  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 py-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#183844]">Vencimentos de documentos</h2>
        <button
          onClick={() => carregar()}
          disabled={loading}
          className="rounded-lg border border-[#cfe3ec] bg-white px-3 py-1.5 text-xs font-medium text-[#347891] transition hover:bg-[#eef6fb] disabled:opacity-50"
        >
          {loading ? "Atualizando..." : "Atualizar"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {!error && !loading && docs.length === 0 && (
        <p className="text-sm text-[#629bb5]">Nenhum documento retornado pelo webhook.</p>
      )}

      <Secao
        titulo="A vencer"
        subtitulo={`proximos ${JANELA_DIAS} dias`}
        cor="amber"
        docs={aVencer}
        vazio="Nenhum documento vence nos proximos 30 dias."
      />

      <Secao
        titulo="Vencidos"
        subtitulo="precisam de renovacao"
        cor="red"
        docs={vencidos}
        vazio="Nenhum documento vencido."
      />
    </div>
  );
}

const cores = {
  amber: { dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  red: { dot: "bg-red-500", badge: "bg-red-50 text-red-700 border-red-200" },
} as const;

function Secao({
  titulo,
  subtitulo,
  cor,
  docs,
  vazio,
}: {
  titulo: string;
  subtitulo: string;
  cor: keyof typeof cores;
  docs: Documento[];
  vazio: string;
}) {
  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${cores[cor].dot}`} />
        <h3 className="text-sm font-semibold text-[#183844]">{titulo}</h3>
        <span className="rounded-full bg-[#e6f1f7] px-2 py-0.5 text-xs font-medium text-[#347891]">
          {docs.length}
        </span>
        <span className="text-xs text-[#9bbccb]">{subtitulo}</span>
      </div>

      {docs.length === 0 ? (
        <p className="pl-4 text-xs text-[#9bbccb]">{vazio}</p>
      ) : (
        <ul className="space-y-2">
          {docs.map((doc) => (
            <DocumentoCard key={doc.id} doc={doc} cor={cor} />
          ))}
        </ul>
      )}
    </section>
  );
}

function DocumentoCard({ doc, cor }: { doc: Documento; cor: keyof typeof cores }) {
  const dias = diasRestantes(doc);
  const rotulo =
    dias === null
      ? ""
      : dias < 0
        ? `vencido ha ${Math.abs(dias)} dia(s)`
        : dias === 0
          ? "vence hoje"
          : `faltam ${dias} dia(s)`;

  return (
    <li className="rounded-xl border border-[#e0eef5] bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[#183844]">
            {doc.sindicato || doc.titulo}
          </p>
          {doc.base && <p className="truncate text-xs text-[#629bb5]">{doc.base}</p>}
        </div>
        {doc.tipo && (
          <span className="shrink-0 rounded-md bg-[#eef6fb] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#447f98]">
            {doc.tipo}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-[#347891]">
          Vigencia ate <strong>{formatData(doc.vigencia_ate)}</strong>
        </span>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${cores[cor].badge}`}>
          {rotulo}
        </span>
      </div>
    </li>
  );
}

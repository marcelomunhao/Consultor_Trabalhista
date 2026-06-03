import type { Documento, SituacaoVigencia } from "./types";

/** Janela (em dias) para considerar um documento "a vencer". */
export const JANELA_DIAS = 30;

function hoje(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseData(iso: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}

export function situacao(doc: Documento, ref: Date = hoje()): SituacaoVigencia {
  const ate = parseData(doc.vigencia_ate);
  if (!ate) return "sem_data";
  if (ate < ref) return "vencido";
  const limite = new Date(ref);
  limite.setDate(limite.getDate() + JANELA_DIAS);
  if (ate <= limite) return "a_vencer";
  return "em_dia";
}

/** Dias restantes (negativo = ja vencido) ate a data final de vigencia. */
export function diasRestantes(doc: Documento, ref: Date = hoje()): number | null {
  const ate = parseData(doc.vigencia_ate);
  if (!ate) return null;
  return Math.round((ate.getTime() - ref.getTime()) / 86_400_000);
}

const dateFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function formatData(iso: string | null): string {
  const d = parseData(iso);
  return d ? dateFmt.format(d) : "—";
}

export interface DocumentosAgrupados {
  vencidos: Documento[];
  aVencer: Documento[];
}

/** Separa em vencidos e a vencer (dentro da janela), ordenando por data final. */
export function agrupar(docs: Documento[], ref: Date = hoje()): DocumentosAgrupados {
  const vencidos: Documento[] = [];
  const aVencer: Documento[] = [];

  for (const doc of docs) {
    const s = situacao(doc, ref);
    if (s === "vencido") vencidos.push(doc);
    else if (s === "a_vencer") aVencer.push(doc);
  }

  // Vencidos: mais recente primeiro. A vencer: mais proximo primeiro.
  vencidos.sort((a, b) => (b.vigencia_ate ?? "").localeCompare(a.vigencia_ate ?? ""));
  aVencer.sort((a, b) => (a.vigencia_ate ?? "").localeCompare(b.vigencia_ate ?? ""));

  return { vencidos, aVencer };
}

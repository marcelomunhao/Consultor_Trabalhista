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

/** Uma fonte citada pelo agente, extraida do bloco <vigencia> da resposta. */
export interface VigenciaFonte {
  fonte: string;
  /** Datas ISO (YYYY-MM-DD) ou null. */
  de: string | null;
  ate: string | null;
}

export type VigenciaBadge = "vigente" | "a_vencer" | "vencida" | "permanente";

/** Status de vigencia de uma fonte (sem data final = norma sem prazo, ex.: CLT). */
export function badgeStatus(ate: string | null, ref: Date = hoje()): VigenciaBadge {
  if (!ate) return "permanente";
  const d = parseData(ate);
  if (!d) return "permanente";
  if (d < ref) return "vencida";
  const limite = new Date(ref);
  limite.setDate(limite.getDate() + JANELA_DIAS);
  if (d <= limite) return "a_vencer";
  return "vigente";
}

// Bloco tecnico que o agente anexa ao final da resposta (ver system prompt do n8n).
const VIG_BLOCK = /\n*<vigencia>\s*([\s\S]*?)<\/vigencia>\s*$/i;

/**
 * Separa o texto da resposta do bloco <vigencia> de rodape. Retorna o texto
 * limpo (para exibir) e as fontes parseadas (para os selos). Cada linha do bloco
 * tem o formato `VIG|fonte|de_iso|ate_iso`.
 */
export function extrairVigencias(texto: string): { texto: string; fontes: VigenciaFonte[] } {
  const m = texto.match(VIG_BLOCK);
  if (!m) return { texto, fontes: [] };

  const fontes: VigenciaFonte[] = [];
  const vistos = new Set<string>();
  for (const linha of m[1].split("\n")) {
    const t = linha.trim();
    if (!t.startsWith("VIG|")) continue;
    const [, fonte = "", de = "", ate = ""] = t.split("|");
    const nome = fonte.trim();
    if (!nome || vistos.has(nome)) continue;
    vistos.add(nome);
    fontes.push({ fonte: nome, de: de.trim() || null, ate: ate.trim() || null });
  }

  return { texto: texto.replace(VIG_BLOCK, "").trimEnd(), fontes };
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

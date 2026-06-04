import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renderiza markdown (titulos, negrito, listas, tabelas) com estilos compactos. */
export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: (p) => <h1 className="mb-2 mt-5 text-lg font-bold text-[#0f2b35] first:mt-0" {...p} />,
        h2: (p) => (
          <h2
            className="mb-2 mt-5 border-b border-[#e7f0f5] pb-1 text-base font-bold text-[#0e7490] first:mt-0"
            {...p}
          />
        ),
        h3: (p) => <h3 className="mb-1.5 mt-4 text-[15px] font-semibold text-[#0f2b35] first:mt-0" {...p} />,
        p: (p) => <p className="mb-3 leading-7 last:mb-0" {...p} />,
        ul: (p) => <ul className="mb-3 ml-5 list-disc space-y-2 last:mb-0" {...p} />,
        ol: (p) => <ol className="mb-3 ml-5 list-decimal space-y-2 last:mb-0" {...p} />,
        li: (p) => <li className="leading-7 [&>ul]:mt-2 [&>ol]:mt-2" {...p} />,
        strong: (p) => <strong className="font-semibold text-[#0f2b35]" {...p} />,
        em: (p) => <em className="italic" {...p} />,
        a: (p) => (
          <a className="text-[#0e7490] underline" target="_blank" rel="noreferrer" {...p} />
        ),
        code: (p) => (
          <code className="rounded bg-[#eef6fb] px-1 py-0.5 text-[0.85em] text-[#0c5d72]" {...p} />
        ),
        hr: () => <hr className="my-4 border-[#e0eef5]" />,
        blockquote: (p) => (
          <blockquote className="my-3 border-l-2 border-[#bcd7e3] pl-3 text-[#3f6f81]" {...p} />
        ),
        table: (p) => (
          <div className="my-2 overflow-x-auto">
            <table className="w-full border-collapse text-xs" {...p} />
          </div>
        ),
        th: (p) => <th className="border border-[#cfe0e9] px-2 py-1 text-left font-semibold" {...p} />,
        td: (p) => <td className="border border-[#cfe0e9] px-2 py-1" {...p} />,
      }}
    >
      {children}
    </ReactMarkdown>
  );
}

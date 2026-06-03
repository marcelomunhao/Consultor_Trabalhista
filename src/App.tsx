import { useState, type ReactNode } from "react";
import { ChatView } from "./components/ChatView";
import { DocumentosPanel } from "./components/DocumentosPanel";

type Aba = "chat" | "documentos";

export default function App() {
  const [aba, setAba] = useState<Aba>("chat");

  return (
    <div className="flex h-full items-center justify-center bg-gradient-to-b from-[#eef6fb] to-[#dcecf4] p-4">
      <div className="flex h-[min(90vh,760px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#cfe3ec] bg-[#f2fafd] shadow-xl">
        {/* Header */}
        <header className="flex items-center gap-3 border-b border-[#d7e8f0] bg-[#183844] px-5 py-4 text-white">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#347891] font-semibold">
            T
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-tight">Assistente Trabalhista</h1>
            <p className="text-xs text-[#9bc3d2]">Departamento Pessoal — CLT e convencoes coletivas</p>
          </div>
        </header>

        {/* Abas */}
        <nav className="flex border-b border-[#d7e8f0] bg-white">
          <TabButton ativo={aba === "chat"} onClick={() => setAba("chat")}>
            Assistente
          </TabButton>
          <TabButton ativo={aba === "documentos"} onClick={() => setAba("documentos")}>
            Vencimentos
          </TabButton>
        </nav>

        {/* Conteudo */}
        <div className="min-h-0 flex-1">
          {aba === "chat" ? <ChatView /> : <DocumentosPanel />}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "flex-1 px-4 py-2.5 text-sm font-medium transition",
        ativo
          ? "border-b-2 border-[#347891] text-[#183844]"
          : "text-[#629bb5] hover:text-[#347891]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

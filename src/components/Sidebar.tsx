import { UploadCct } from "./UploadCct";
import type { ReactNode } from "react";

export type View = "chat" | "documentos";

interface SidebarProps {
  view: View;
  onSelectView: (v: View) => void;
  onNewChat: () => void;
  userEmail: string | null;
  authEnabled: boolean;
  onLogout: () => void;
  onUploaded: () => void;
}

export function Sidebar({
  view,
  onSelectView,
  onNewChat,
  userEmail,
  authEnabled,
  onLogout,
  onUploaded,
}: SidebarProps) {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col bg-[#12303a] text-[#cfe3ec]">
      {/* Brand */}
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#347891] text-sm font-bold text-white">
          T
        </div>
        <span className="text-sm font-semibold text-white">Trabalhista</span>
      </div>

      {/* Novo chat */}
      <div className="px-3">
        <button
          onClick={onNewChat}
          className="flex w-full items-center gap-2 rounded-lg border border-[#2c5663] bg-[#163945] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#1c4654]"
        >
          <PlusIcon />
          Novo chat
        </button>
      </div>

      {/* Navegacao */}
      <nav className="mt-4 space-y-1 px-3">
        <NavItem active={view === "chat"} onClick={() => onSelectView("chat")} icon={<ChatIcon />}>
          Assistente
        </NavItem>
        <NavItem
          active={view === "documentos"}
          onClick={() => onSelectView("documentos")}
          icon={<DocIcon />}
        >
          Vencimentos
        </NavItem>
      </nav>

      {/* Upload de CCT */}
      <div className="mt-6 px-3">
        <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-[#6f97a6]">
          Base de conhecimento
        </p>
        <UploadCct onUploaded={onUploaded} />
      </div>

      {/* Rodape: usuario */}
      <div className="mt-auto border-t border-[#1d4350] p-3">
        {authEnabled ? (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs text-[#9bc3d2]">{userEmail}</p>
            </div>
            <button
              onClick={onLogout}
              className="shrink-0 rounded-md px-2 py-1 text-xs text-[#9bc3d2] transition hover:bg-[#1d4350] hover:text-white"
            >
              Sair
            </button>
          </div>
        ) : (
          <p className="px-1 text-xs text-[#6f97a6]">Acesso livre</p>
        )}
      </div>
    </aside>
  );
}

function NavItem({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition",
        active ? "bg-[#1d4350] text-white" : "text-[#a9c8d5] hover:bg-[#163945] hover:text-white",
      ].join(" ")}
    >
      {icon}
      {children}
    </button>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  );
}

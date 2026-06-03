import { UploadCct } from "./UploadCct";
import type { ReactNode } from "react";
import type { Chat } from "../chats";

export type View = "chat" | "documentos";

interface SidebarProps {
  view: View;
  onSelectView: (v: View) => void;
  onNewChat: () => void;
  chats: Chat[];
  activeChatId: string;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  userEmail: string | null;
  authEnabled: boolean;
  onLogout: () => void;
  onUploaded: () => void;
}

export function Sidebar({
  view,
  onSelectView,
  onNewChat,
  chats,
  activeChatId,
  onSelectChat,
  onDeleteChat,
  userEmail,
  authEnabled,
  onLogout,
  onUploaded,
}: SidebarProps) {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col bg-[#0c272f] text-[#cfe3ec]">
      {/* Brand */}
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0e7490] text-sm font-bold text-white">
          T
        </div>
        <span className="text-sm font-semibold text-white">Trabalhista</span>
      </div>

      {/* Novo chat */}
      <div className="px-3">
        <button
          onClick={onNewChat}
          className="flex w-full items-center gap-2 rounded-lg bg-[#0e7490] px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0c5d72]"
        >
          <PlusIcon />
          Novo chat
        </button>
      </div>

      {/* Navegacao */}
      <nav className="mt-4 space-y-1 px-3">
        <NavItem active={view === "documentos"} onClick={() => onSelectView("documentos")} icon={<DocIcon />}>
          Vencimentos
        </NavItem>
      </nav>

      {/* Lista de chats */}
      <div className="mt-4 flex min-h-0 flex-1 flex-col px-3">
        <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-[#6f97a6]">
          Chats
        </p>
        <div className="-mr-1 flex-1 space-y-0.5 overflow-y-auto pr-1">
          {chats.map((c) => (
            <ChatItem
              key={c.id}
              chat={c}
              active={view === "chat" && c.id === activeChatId}
              onSelect={() => onSelectChat(c.id)}
              onDelete={() => onDeleteChat(c.id)}
            />
          ))}
        </div>
      </div>

      {/* Upload de CCT */}
      <div className="mt-3 px-3">
        <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-[#6f97a6]">
          Base de conhecimento
        </p>
        <UploadCct onUploaded={onUploaded} />
      </div>

      {/* Rodape: usuario */}
      <div className="mt-3 border-t border-[#1d4350] p-3">
        {authEnabled ? (
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-xs text-[#9bc3d2]">{userEmail}</p>
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

function ChatItem({
  chat,
  active,
  onSelect,
  onDelete,
}: {
  chat: Chat;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={[
        "group flex cursor-pointer items-center justify-between gap-1 rounded-lg px-2.5 py-1.5 text-sm transition",
        active ? "bg-[#163945] text-white" : "text-[#a9c8d5] hover:bg-[#143540] hover:text-white",
      ].join(" ")}
    >
      <span className="truncate">{chat.title || "Novo chat"}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        title="Excluir chat"
        className="hidden shrink-0 rounded p-0.5 text-[#7da7b8] transition hover:text-white group-hover:block"
      >
        <XIcon />
      </button>
    </div>
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
        active
          ? "bg-[#0e7490] text-white shadow-sm"
          : "text-[#a9c8d5] hover:bg-[#143540] hover:text-white",
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

function DocIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

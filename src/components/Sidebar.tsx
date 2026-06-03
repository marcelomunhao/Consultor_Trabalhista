import { UploadCct } from "./UploadCct";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Chat } from "../chats";

export type View = "chat" | "documentos";

interface SidebarProps {
  view: View;
  onSelectView: (v: View) => void;
  onNewChat: () => void;
  chats: Chat[];
  activeChatId: string;
  onSelectChat: (id: string) => void;
  onRenameChat: (id: string, title: string) => void;
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
  onRenameChat,
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
              onRename={(t) => onRenameChat(c.id, t)}
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
  onRename,
  onDelete,
}: {
  chat: Chat;
  active: boolean;
  onSelect: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(chat.title);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const fechar = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, [menu]);

  function salvar() {
    setEditing(false);
    const t = val.trim();
    if (t && t !== chat.title) onRename(t);
    else setVal(chat.title);
  }

  if (editing) {
    return (
      <div className="px-0.5 py-0.5">
        <input
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") salvar();
            if (e.key === "Escape") {
              setEditing(false);
              setVal(chat.title);
            }
          }}
          onBlur={salvar}
          className="w-full rounded-md border border-[#0e7490] bg-[#0c272f] px-2 py-1 text-sm text-white outline-none"
        />
      </div>
    );
  }

  return (
    <div
      ref={ref}
      onClick={onSelect}
      className={[
        "group relative flex cursor-pointer items-center justify-between gap-1 rounded-lg px-2.5 py-1.5 text-sm transition",
        active ? "bg-[#163945] text-white" : "text-[#a9c8d5] hover:bg-[#143540] hover:text-white",
      ].join(" ")}
    >
      <span className="truncate">{chat.title || "Novo chat"}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setVal(chat.title);
          setMenu((o) => !o);
        }}
        title="Opções"
        className={[
          "shrink-0 rounded p-0.5 text-[#7da7b8] transition hover:text-white",
          menu ? "block" : "hidden group-hover:block",
        ].join(" ")}
      >
        <DotsIcon />
      </button>

      {menu && (
        <div className="absolute right-1 top-8 z-20 w-32 overflow-hidden rounded-lg border border-[#1d4350] bg-[#0c272f] py-1 shadow-xl">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenu(false);
              setEditing(true);
            }}
            className="block w-full px-3 py-1.5 text-left text-sm text-[#cfe3ec] transition hover:bg-[#143540]"
          >
            Renomear
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenu(false);
              if (window.confirm(`Excluir o chat "${chat.title || "Novo chat"}"?`)) onDelete();
            }}
            className="block w-full px-3 py-1.5 text-left text-sm text-red-300 transition hover:bg-[#143540]"
          >
            Excluir
          </button>
        </div>
      )}
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

function DotsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
    </svg>
  );
}

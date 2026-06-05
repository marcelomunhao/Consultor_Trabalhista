import { useEffect, useState } from "react";
import { Sidebar, type View } from "./components/Sidebar";
import { ChatView } from "./components/ChatView";
import { DocumentosPanel } from "./components/DocumentosPanel";
import { UsuariosPanel } from "./components/UsuariosPanel";
import { LoginGate } from "./components/LoginGate";
import { SharedView } from "./components/SharedView";
import { ResetView } from "./components/ResetView";
import { authEnabled, isAdmin, logout } from "./auth";
import { loadChats, novoChat, saveChats, tituloDoChat, type Chat } from "./chats";
import type { Message } from "./types";

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const shareId = params.get("share");
  if (shareId) return <SharedView id={shareId} />;
  const resetToken = params.get("reset");
  if (resetToken) return <ResetView token={resetToken} />;
  return <LoginGate>{(email) => <Workspace email={email} />}</LoginGate>;
}

function Workspace({ email }: { email: string | null }) {
  const [view, setView] = useState<View>("chat");
  const [chats, setChats] = useState<Chat[]>(() => {
    const existentes = loadChats();
    return existentes.length ? existentes : [novoChat()];
  });
  const [activeId, setActiveId] = useState<string>(() => chats[0].id);
  const [docsVersion, setDocsVersion] = useState(0);

  useEffect(() => {
    saveChats(chats);
  }, [chats]);

  const active = chats.find((c) => c.id === activeId) ?? chats[0];

  function atualizarMensagens(updater: (prev: Message[]) => Message[]) {
    setChats((prev) =>
      prev.map((c) => {
        if (c.id !== activeId) return c;
        const messages = updater(c.messages);
        const title = c.titleCustom ? c.title : tituloDoChat(messages);
        return { ...c, messages, title, updatedAt: Date.now() };
      }),
    );
  }

  function renomearChat(id: string, novo: string) {
    const t = novo.trim();
    if (!t) return;
    setChats((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: t, titleCustom: true } : c)),
    );
  }

  function novoChatHandler() {
    setView("chat");
    const atual = chats.find((c) => c.id === activeId);
    if (atual && atual.messages.length === 0) return; // ja esta num chat vazio
    const nc = novoChat();
    setChats((prev) => [nc, ...prev]);
    setActiveId(nc.id);
  }

  function selecionarChat(id: string) {
    setActiveId(id);
    setView("chat");
  }

  function excluirChat(id: string) {
    setChats((prev) => {
      const rest = prev.filter((c) => c.id !== id);
      const next = rest.length ? rest : [novoChat()];
      if (id === activeId) setActiveId(next[0].id);
      return next;
    });
  }

  function sair() {
    logout();
    window.location.reload();
  }

  return (
    <div className="flex h-full bg-white">
      <Sidebar
        view={view}
        onSelectView={setView}
        onNewChat={novoChatHandler}
        chats={chats}
        activeChatId={activeId}
        onSelectChat={selecionarChat}
        onRenameChat={renomearChat}
        onDeleteChat={excluirChat}
        userEmail={email}
        authEnabled={authEnabled()}
        isAdmin={isAdmin()}
        onLogout={sair}
        onUploaded={() => {
          if (view === "documentos") setDocsVersion((v) => v + 1);
        }}
      />

      <main className="min-w-0 flex-1">
        {view === "chat" ? (
          <ChatView
            key={active.id}
            chatId={active.id}
            title={active.title}
            messages={active.messages}
            onMessagesChange={atualizarMensagens}
          />
        ) : view === "usuarios" ? (
          <UsuariosPanel />
        ) : (
          <DocumentosPanel key={docsVersion} />
        )}
      </main>
    </div>
  );
}

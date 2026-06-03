import { useState } from "react";
import { Sidebar, type View } from "./components/Sidebar";
import { ChatView } from "./components/ChatView";
import { DocumentosPanel } from "./components/DocumentosPanel";
import { LoginGate } from "./components/LoginGate";
import { authEnabled, logout } from "./auth";
import { newChatId } from "./user";

export default function App() {
  return <LoginGate>{(email) => <Workspace email={email} />}</LoginGate>;
}

function Workspace({ email }: { email: string | null }) {
  const [view, setView] = useState<View>("chat");
  const [chatId, setChatId] = useState<string>(() => newChatId());
  // Forca recarregar o painel de documentos apos um upload bem-sucedido.
  const [docsVersion, setDocsVersion] = useState(0);

  function novoChat() {
    setChatId(newChatId());
    setView("chat");
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
        onNewChat={novoChat}
        userEmail={email}
        authEnabled={authEnabled()}
        onLogout={sair}
        onUploaded={() => {
          if (view === "documentos") setDocsVersion((v) => v + 1);
        }}
      />

      <main className="min-w-0 flex-1">
        {view === "chat" ? (
          <ChatView key={chatId} chatId={chatId} />
        ) : (
          <DocumentosPanel key={docsVersion} />
        )}
      </main>
    </div>
  );
}

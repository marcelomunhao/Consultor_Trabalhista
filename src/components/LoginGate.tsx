import { useState, type FormEvent, type ReactNode } from "react";
import { authEnabled, getCurrentUser, login } from "../auth";

/**
 * Bloqueia o app atras de uma tela de login quando a autenticacao esta
 * configurada (VITE_LOGIN_URL). A validacao ocorre no servidor (Edge Function).
 * Caso contrario, libera.
 */
export function LoginGate({ children }: { children: (email: string | null) => ReactNode }) {
  const [user, setUser] = useState<string | null>(() => getCurrentUser());

  if (!authEnabled() || user) {
    return <>{children(user)}</>;
  }

  return <LoginForm onSuccess={setUser} />;
}

function LoginForm({ onSuccess }: { onSuccess: (email: string) => void }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (carregando) return;
    setErro(null);
    setCarregando(true);
    const r = await login(email, senha);
    setCarregando(false);
    if (r.ok) onSuccess(r.email ?? email.trim().toLowerCase());
    else setErro(r.erro ?? "Falha no login.");
  }

  return (
    <div className="flex h-full items-center justify-center bg-gradient-to-br from-[#0c272f] via-[#0e3a47] to-[#0e7490] p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-[#cfe3ec] bg-white p-6 shadow-xl"
      >
        <div className="mb-5 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0e7490] font-bold text-white">
            T
          </div>
          <div>
            <h1 className="text-sm font-semibold text-[#183844]">Assistente Trabalhista</h1>
            <p className="text-xs text-[#629bb5]">Acesso restrito</p>
          </div>
        </div>

        <label className="mb-1 block text-xs font-medium text-[#0e7490]">E-mail</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
          className="mb-3 w-full rounded-lg border border-[#cfe3ec] bg-[#f2fafd] px-3 py-2 text-sm text-[#183844] outline-none focus:border-[#0e7490] focus:ring-2 focus:ring-[#0e7490]/20"
        />

        <label className="mb-1 block text-xs font-medium text-[#0e7490]">Senha</label>
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          autoComplete="current-password"
          required
          className="mb-4 w-full rounded-lg border border-[#cfe3ec] bg-[#f2fafd] px-3 py-2 text-sm text-[#183844] outline-none focus:border-[#0e7490] focus:ring-2 focus:ring-[#0e7490]/20"
        />

        {erro && <p className="mb-3 text-xs text-red-600">{erro}</p>}

        <button
          type="submit"
          disabled={carregando}
          className="w-full rounded-lg bg-[#0e7490] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#0c5d72] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {carregando ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}

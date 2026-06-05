import { useState, type FormEvent, type ReactNode } from "react";
import { authEnabled, forgot, getCurrentUser, login, signup } from "../auth";

type Modo = "login" | "signup" | "forgot";

/**
 * Bloqueia o app atras da tela de autenticacao quando configurada (VITE_LOGIN_URL).
 * Validacao no servidor (Edge Function). Modos: entrar, cadastrar, esqueci a senha.
 */
export function LoginGate({ children }: { children: (email: string | null) => ReactNode }) {
  const [user, setUser] = useState<string | null>(() => getCurrentUser());

  if (!authEnabled() || user) {
    return <>{children(user)}</>;
  }
  return <AuthScreen onSuccess={setUser} />;
}

const inputCls =
  "w-full rounded-lg border border-[#cfe3ec] bg-[#f2fafd] px-3 py-2 text-sm text-[#183844] outline-none focus:border-[#0e7490] focus:ring-2 focus:ring-[#0e7490]/20";
const btnCls =
  "w-full rounded-lg bg-[#0e7490] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#0c5d72] disabled:cursor-not-allowed disabled:opacity-60";
const linkCls = "text-[#0e7490] hover:underline";

function AuthScreen({ onSuccess }: { onSuccess: (email: string) => void }) {
  const [modo, setModo] = useState<Modo>("login");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  function trocar(m: Modo) {
    setModo(m);
    setErro(null);
    setAviso(null);
    setSenha("");
    setSenha2("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (carregando) return;
    setErro(null);
    setAviso(null);
    if (modo === "signup" && senha !== senha2) {
      setErro("As senhas não conferem.");
      return;
    }
    setCarregando(true);
    try {
      if (modo === "login") {
        const r = await login(email, senha);
        if (r.ok) onSuccess(r.email);
        else setErro(r.erro ?? "Falha no login.");
      } else if (modo === "signup") {
        const r = await signup(email, senha, nome);
        if (r.ok) {
          setAviso("Cadastro enviado! Aguarde a aprovação de um administrador para acessar.");
          setModo("login");
          setSenha("");
        } else setErro(r.erro ?? "Falha no cadastro.");
      } else {
        const r = await forgot(email);
        if (r.ok) {
          setAviso("Se o e-mail estiver cadastrado, enviamos um link para redefinir a senha.");
          setModo("login");
        } else setErro(r.erro ?? "Falha ao enviar.");
      }
    } finally {
      setCarregando(false);
    }
  }

  const titulo = modo === "login" ? "Acesso restrito" : modo === "signup" ? "Criar conta" : "Recuperar senha";
  const botao = carregando
    ? "Enviando..."
    : modo === "login"
      ? "Entrar"
      : modo === "signup"
        ? "Cadastrar"
        : "Enviar link";

  return (
    <div className="flex h-full items-center justify-center bg-gradient-to-br from-[#0c272f] via-[#0e3a47] to-[#0e7490] p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl border border-[#cfe3ec] bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0e7490] font-bold text-white">T</div>
          <div>
            <h1 className="text-sm font-semibold text-[#183844]">Assistente Trabalhista</h1>
            <p className="text-xs text-[#629bb5]">{titulo}</p>
          </div>
        </div>

        {modo === "signup" && (
          <>
            <label className="mb-1 block text-xs font-medium text-[#0e7490]">Nome</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" className={`mb-3 ${inputCls}`} />
          </>
        )}

        <label className="mb-1 block text-xs font-medium text-[#0e7490]">E-mail</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
          className={`mb-3 ${inputCls}`}
        />

        {modo !== "forgot" && (
          <>
            <label className="mb-1 block text-xs font-medium text-[#0e7490]">Senha</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete={modo === "login" ? "current-password" : "new-password"}
              required
              minLength={6}
              className={`${modo === "signup" ? "mb-3" : "mb-4"} ${inputCls}`}
            />
          </>
        )}

        {modo === "signup" && (
          <>
            <label className="mb-1 block text-xs font-medium text-[#0e7490]">Confirmar senha</label>
            <input
              type="password"
              value={senha2}
              onChange={(e) => setSenha2(e.target.value)}
              autoComplete="new-password"
              required
              minLength={6}
              className={`mb-4 ${inputCls}`}
            />
          </>
        )}

        {erro && <p className="mb-3 text-xs text-red-600">{erro}</p>}
        {aviso && <p className="mb-3 text-xs text-emerald-700">{aviso}</p>}

        <button type="submit" disabled={carregando} className={btnCls}>
          {botao}
        </button>

        <div className="mt-4 flex justify-between text-xs text-[#3f6f81]">
          {modo === "login" ? (
            <>
              <button type="button" className={linkCls} onClick={() => trocar("signup")}>
                Cadastre-se
              </button>
              <button type="button" className={linkCls} onClick={() => trocar("forgot")}>
                Esqueci minha senha
              </button>
            </>
          ) : (
            <button type="button" className={linkCls} onClick={() => trocar("login")}>
              ← Voltar ao login
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

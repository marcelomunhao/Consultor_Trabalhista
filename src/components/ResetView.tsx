import { useState, type FormEvent } from "react";
import { resetSenha } from "../auth";

/** Tela de redefinicao de senha aberta pelo link do e-mail (?reset=<token>). */
export function ResetView({ token }: { token: string }) {
  const [senha, setSenha] = useState("");
  const [conf, setConf] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const base = `${window.location.origin}${window.location.pathname}`;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (carregando) return;
    setErro(null);
    if (senha.length < 6) return setErro("A senha deve ter ao menos 6 caracteres.");
    if (senha !== conf) return setErro("As senhas não conferem.");
    setCarregando(true);
    const r = await resetSenha(token, senha);
    setCarregando(false);
    if (r.ok) setOk(true);
    else setErro(r.erro ?? "Não foi possível redefinir a senha.");
  }

  return (
    <div className="flex h-full items-center justify-center bg-gradient-to-br from-[#0c272f] via-[#0e3a47] to-[#0e7490] p-4">
      <div className="w-full max-w-sm rounded-2xl border border-[#cfe3ec] bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0e7490] font-bold text-white">T</div>
          <div>
            <h1 className="text-sm font-semibold text-[#183844]">Assistente Trabalhista</h1>
            <p className="text-xs text-[#629bb5]">Redefinir senha</p>
          </div>
        </div>

        {ok ? (
          <>
            <p className="mb-4 text-sm text-emerald-700">Senha redefinida com sucesso!</p>
            <a href={base} className="block w-full rounded-lg bg-[#0e7490] px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-[#0c5d72]">
              Ir para o login
            </a>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="mb-1 block text-xs font-medium text-[#0e7490]">Nova senha</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="new-password"
              required
              minLength={6}
              className="mb-3 w-full rounded-lg border border-[#cfe3ec] bg-[#f2fafd] px-3 py-2 text-sm text-[#183844] outline-none focus:border-[#0e7490] focus:ring-2 focus:ring-[#0e7490]/20"
            />
            <label className="mb-1 block text-xs font-medium text-[#0e7490]">Confirmar nova senha</label>
            <input
              type="password"
              value={conf}
              onChange={(e) => setConf(e.target.value)}
              autoComplete="new-password"
              required
              minLength={6}
              className="mb-4 w-full rounded-lg border border-[#cfe3ec] bg-[#f2fafd] px-3 py-2 text-sm text-[#183844] outline-none focus:border-[#0e7490] focus:ring-2 focus:ring-[#0e7490]/20"
            />

            {erro && <p className="mb-3 text-xs text-red-600">{erro}</p>}

            <button
              type="submit"
              disabled={carregando}
              className="w-full rounded-lg bg-[#0e7490] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#0c5d72] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {carregando ? "Salvando..." : "Redefinir senha"}
            </button>
            <a href={base} className="mt-4 block text-center text-xs text-[#3f6f81] hover:underline">
              ← Voltar ao login
            </a>
          </form>
        )}
      </div>
    </div>
  );
}

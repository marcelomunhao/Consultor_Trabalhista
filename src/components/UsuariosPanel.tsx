import { useCallback, useEffect, useState } from "react";
import { adminAprovar, adminListarUsuarios, adminRecusar } from "../auth";

interface Usuario {
  email: string;
  nome: string | null;
  ativo: boolean;
  is_admin: boolean;
  criado: string;
}

/** Painel do administrador: aprova/recusa cadastros pendentes e lista usuários. */
export function UsuariosPanel() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [acao, setAcao] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    const r = await adminListarUsuarios();
    if (r.ok && Array.isArray(r.usuarios)) setUsuarios(r.usuarios as Usuario[]);
    else setErro((r.erro as string) ?? "Falha ao carregar usuários.");
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function aprovar(email: string) {
    setAcao(email);
    await adminAprovar(email);
    setAcao(null);
    carregar();
  }
  async function recusar(email: string) {
    setAcao(email);
    await adminRecusar(email);
    setAcao(null);
    carregar();
  }

  const pendentes = usuarios.filter((u) => !u.ativo);
  const ativos = usuarios.filter((u) => u.ativo);

  return (
    <div className="mx-auto h-full w-full max-w-3xl overflow-y-auto px-5 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-[#0f2b35]">Usuários</h2>
        <button onClick={carregar} className="rounded-lg border border-[#cfe0e9] bg-white px-3 py-1.5 text-xs font-medium text-[#0e7490] hover:bg-[#eef6fb]">
          Atualizar
        </button>
      </div>

      {erro && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
      {carregando && <p className="text-sm text-[#5b8497]">Carregando...</p>}

      {!carregando && (
        <>
          <section className="mb-6">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#7ba0b1]">
              Pendentes de aprovação ({pendentes.length})
            </h3>
            {pendentes.length === 0 ? (
              <p className="text-sm text-[#5b8497]">Nenhum cadastro pendente.</p>
            ) : (
              <ul className="space-y-2">
                {pendentes.map((u) => (
                  <li key={u.email} className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#0f2b35]">{u.nome || u.email}</p>
                      <p className="truncate text-xs text-[#5b8497]">{u.email} · solicitado em {u.criado}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => aprovar(u.email)}
                        disabled={acao === u.email}
                        className="rounded-lg bg-[#0e7490] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0c5d72] disabled:opacity-50"
                      >
                        Aprovar
                      </button>
                      <button
                        onClick={() => recusar(u.email)}
                        disabled={acao === u.email}
                        className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        Recusar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#7ba0b1]">
              Ativos ({ativos.length})
            </h3>
            <ul className="space-y-1.5">
              {ativos.map((u) => (
                <li key={u.email} className="flex items-center justify-between gap-2 rounded-lg border border-[#e0eef5] bg-white px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-[#0f2b35]">{u.nome || u.email}</p>
                    <p className="truncate text-xs text-[#5b8497]">{u.email}</p>
                  </div>
                  {u.is_admin && (
                    <span className="shrink-0 rounded-full bg-[#0e7490]/10 px-2 py-0.5 text-[11px] font-medium text-[#0e7490]">
                      admin
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

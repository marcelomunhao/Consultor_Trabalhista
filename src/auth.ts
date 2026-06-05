const AUTH_KEY = "trabalhista-auth-email";
const TOKEN_KEY = "trabalhista-auth-token";
const ADMIN_KEY = "trabalhista-auth-admin";
const NOME_KEY = "trabalhista-auth-nome";

/** URL da Edge Function de auth (Supabase). Roteia por { action }. */
const AUTH_URL = import.meta.env.VITE_LOGIN_URL as string | undefined;

/** Login fica ativo quando a URL esta configurada. Vazio = acesso livre. */
export function authEnabled(): boolean {
  return !!AUTH_URL;
}

export function getCurrentUser(): string | null {
  if (!authEnabled()) return "livre";
  return localStorage.getItem(AUTH_KEY);
}
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function isAdmin(): boolean {
  return localStorage.getItem(ADMIN_KEY) === "1";
}

type Resp = { ok: boolean; erro?: string; [k: string]: unknown };

async function call(payload: Record<string, unknown>): Promise<Resp> {
  if (!AUTH_URL) return { ok: false, erro: "Login não configurado (VITE_LOGIN_URL)." };
  try {
    const res = await fetch(AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => null)) as Resp | null;
    return data ?? { ok: false, erro: "Resposta inválida do servidor." };
  } catch {
    return { ok: false, erro: "Não foi possível conectar. Tente novamente." };
  }
}

/** Valida no servidor; guarda email, token, admin e nome. */
export async function login(email: string, senha: string) {
  const e = email.trim().toLowerCase();
  const r = await call({ action: "login", email: e, senha });
  if (r.ok) {
    localStorage.setItem(AUTH_KEY, String(r.email ?? e));
    localStorage.setItem(TOKEN_KEY, String(r.token ?? ""));
    localStorage.setItem(ADMIN_KEY, r.is_admin ? "1" : "0");
    localStorage.setItem(NOME_KEY, String(r.nome ?? ""));
  }
  return { ok: r.ok, erro: r.erro, email: String(r.email ?? e) };
}

/** Cadastro: cria conta PENDENTE (precisa de aprovação de um admin). */
export async function signup(email: string, senha: string, nome: string) {
  return call({ action: "signup", email: email.trim().toLowerCase(), senha, nome: nome.trim() });
}

/** Esqueci a senha: dispara o e-mail com o link de redefinição. */
export async function forgot(email: string) {
  return call({ action: "forgot", email: email.trim().toLowerCase() });
}

/** Redefinir senha a partir do token recebido por e-mail. */
export async function resetSenha(token: string, senha: string) {
  return call({ action: "reset", token, senha });
}

// --- Admin (usa o token da sessão; o servidor confere is_admin) ---
export async function adminListarUsuarios() {
  return call({ action: "admin_list", token: getToken() ?? "" });
}
export async function adminAprovar(email: string) {
  return call({ action: "admin_approve", token: getToken() ?? "", email });
}
export async function adminRecusar(email: string) {
  return call({ action: "admin_reject", token: getToken() ?? "", email });
}
/** Exclui um usuário (admins não podem ser excluídos — rebaixe antes via SQL). */
export async function adminExcluir(email: string) {
  return call({ action: "admin_delete", token: getToken() ?? "", email });
}

export function logout(): void {
  for (const k of [AUTH_KEY, TOKEN_KEY, ADMIN_KEY, NOME_KEY]) localStorage.removeItem(k);
}

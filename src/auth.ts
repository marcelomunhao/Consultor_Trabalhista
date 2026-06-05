const AUTH_KEY = "trabalhista-auth-email";

/** URL da Edge Function de login (Supabase). Valida e-mail+senha no servidor. */
const LOGIN_URL = import.meta.env.VITE_LOGIN_URL as string | undefined;

/** Login fica ativo quando a URL de validacao esta configurada. Vazio = livre. */
export function authEnabled(): boolean {
  return !!LOGIN_URL;
}

export function getCurrentUser(): string | null {
  if (!authEnabled()) return "livre";
  return localStorage.getItem(AUTH_KEY);
}

/**
 * Valida e-mail + senha no SERVIDOR (Supabase Edge Function `login`), que confere
 * o hash (bcrypt) na tabela `dp_assistant.usuarios`. A senha nunca fica no bundle
 * nem é comparada no navegador — o front só envia e recebe ok/erro.
 */
export async function login(
  email: string,
  senha: string,
): Promise<{ ok: boolean; erro?: string; email?: string }> {
  if (!LOGIN_URL) return { ok: false, erro: "Login não configurado (VITE_LOGIN_URL)." };
  const e = email.trim().toLowerCase();
  try {
    const res = await fetch(LOGIN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: e, senha }),
    });
    const data = (await res.json().catch(() => null)) as
      | { ok?: boolean; erro?: string; email?: string }
      | null;
    if (res.ok && data?.ok) {
      const logado = (data.email ?? e).toLowerCase();
      localStorage.setItem(AUTH_KEY, logado);
      return { ok: true, email: logado };
    }
    return { ok: false, erro: data?.erro ?? "E-mail ou senha inválidos." };
  } catch {
    return { ok: false, erro: "Não foi possível validar o login. Tente novamente." };
  }
}

export function logout(): void {
  localStorage.removeItem(AUTH_KEY);
}

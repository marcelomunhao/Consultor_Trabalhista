const AUTH_KEY = "trabalhista-auth-email";

/** Lista de e-mails permitidos (definida em VITE_AUTH_USERS, separada por virgula). */
function allowedEmails(): string[] {
  const raw = (import.meta.env.VITE_AUTH_USERS as string | undefined) ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function expectedPassword(): string {
  return (import.meta.env.VITE_AUTH_PASSWORD as string | undefined) ?? "";
}

/** Se nao ha usuarios configurados, o login fica desativado (acesso livre). */
export function authEnabled(): boolean {
  return allowedEmails().length > 0 && expectedPassword().length > 0;
}

export function getCurrentUser(): string | null {
  if (!authEnabled()) return "livre";
  return localStorage.getItem(AUTH_KEY);
}

/** Valida e-mail (na lista) + senha. Em sucesso, persiste a sessao. */
export function login(email: string, senha: string): { ok: boolean; erro?: string } {
  const e = email.trim().toLowerCase();
  if (!allowedEmails().includes(e)) {
    return { ok: false, erro: "Usuario nao autorizado." };
  }
  if (senha !== expectedPassword()) {
    return { ok: false, erro: "Senha incorreta." };
  }
  localStorage.setItem(AUTH_KEY, e);
  return { ok: true };
}

export function logout(): void {
  localStorage.removeItem(AUTH_KEY);
}

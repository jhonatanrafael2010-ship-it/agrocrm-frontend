// src/services/auth.ts
// Serviço de autenticação

import { API_BASE } from "../config";
import { invalidateAllCache } from "../utils/offlineSync";

const TOKEN_KEY = "nutricrm_token";
const USER_KEY = "nutricrm_user";

export interface User {
  id: number;
  username: string;
  consultant_id: number | null;
  consultant_name: string | null;
  is_admin: boolean;
  active: boolean;
  created_at: string;
}

export interface LoginResponse {
  ok: boolean;
  token: string;
  user: User;
  error?: string;
}

// Salva token e usuário no localStorage
export function saveAuth(token: string, user: User): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

// Remove autenticação
export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  // Limpa também o consultant_id antigo se existir
  localStorage.removeItem("nutricrm_consultant_id");
}

// Retorna o token atual
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

// Retorna o usuário atual
export function getUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Verifica se está autenticado
export function isAuthenticated(): boolean {
  const token = getToken();
  if (!token) return false;

  // Verifica se token expirou (decodifica JWT)
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const exp = payload.exp * 1000; // exp está em segundos
    if (Date.now() >= exp) {
      clearAuth();
      return false;
    }
    return true;
  } catch {
    clearAuth();
    return false;
  }
}

// Retorna o consultant_id do usuário logado
export function getConsultantId(): number | null {
  const user = getUser();
  return user?.consultant_id ?? null;
}

// Faz login
export async function login(username: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE}auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  const data = await res.json();

  if (!res.ok) {
    return { ok: false, token: "", user: {} as User, error: data.error || "Erro ao fazer login" };
  }

  saveAuth(data.token, data.user);
  // Limpa cache para forçar reload com novos dados filtrados por consultor
  invalidateAllCache();
  return { ok: true, token: data.token, user: data.user };
}

// Faz logout
export async function logout(): Promise<void> {
  const token = getToken();
  if (token) {
    try {
      await fetch(`${API_BASE}auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      // Ignora erros de rede no logout
    }
  }
  clearAuth();
}

// Verifica autenticação com o servidor
export async function verifyAuth(): Promise<User | null> {
  const token = getToken();
  if (!token) return null;

  try {
    const res = await fetch(`${API_BASE}auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      clearAuth();
      return null;
    }

    const data = await res.json();
    // Atualiza dados do usuário local
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return data.user;
  } catch {
    // Erro de rede - mantém autenticação local
    return getUser();
  }
}

// Helper para fazer requisições autenticadas
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(options.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(url, { ...options, headers });
}

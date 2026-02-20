"use client";

import { ensureAccessSeed, getUsers, UserRecord } from "@/lib/access";

export type SessionUser = { userId: string };

const LS_SESSION_KEY = "pdv_session_v1";

export function getSession(): SessionUser | null {
  try {
    const raw = localStorage.getItem(LS_SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SessionUser;
    if (!s?.userId) return null;
    return s;
  } catch {
    return null;
  }
}

export function setSession(userId: string) {
  try {
    localStorage.setItem(LS_SESSION_KEY, JSON.stringify({ userId } as SessionUser));
  } catch {
    // ignore
  }
}

export function logoutUser() {
  try {
    localStorage.removeItem(LS_SESSION_KEY);
  } catch {
    // ignore
  }
}

/** Usuário completo logado */
export function getCurrentUser(): UserRecord | null {
  try {
    const s = getSession();
    if (!s) return null;

    ensureAccessSeed();
    const users = getUsers();
    return users.find((u) => u.id === s.userId) ?? null;
  } catch {
    return null;
  }
}

/** Garante auth e redireciona; retorna UserRecord */
export function requireAuthOrRedirect(loginPath = "/login"): UserRecord | null {
  const me = getCurrentUser();
  if (!me) {
    if (typeof window !== "undefined") window.location.href = loginPath;
    return null;
  }
  if (!me.active) {
    if (typeof window !== "undefined") window.location.href = loginPath;
    return null;
  }
  return me;
}

export function loginWithPin(
  login: string,
  pin: string
): { ok: boolean; msg?: string; userId?: string } {
  ensureAccessSeed();

  const l = (login || "").trim().toLowerCase();
  const p = (pin || "").trim();

  const users = getUsers();
  const u = users.find((x) => x.login === l && x.pin === p);

  if (!u) return { ok: false, msg: "Login ou PIN inválido." };
  if (!u.active) return { ok: false, msg: "Usuário desativado." };

  setSession(u.id);
  return { ok: true, userId: u.id };
}
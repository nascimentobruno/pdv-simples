"use client";

import { loadDB, saveDB, uid } from "@/lib/store";

/** =========================
 *  Permissões (flags)
 *  ========================= */
export type Permissao =
  | "DASHBOARD"
  | "LOJAS"
  | "PRODUTOS"
  | "ESTOQUE"
  | "COMPRAS"
  | "PDV"
  | "RELATORIOS"
  | "USUARIOS"
  | "CONFIG";

/** =========================
 *  Tipos
 *  ========================= */
export type RoleRecord = {
  id: string;
  nome: string;
  permissoes: Permissao[];
  active: boolean;
  isSystem?: boolean; // não deixa remover (ex: Admin)
};

export type UserRecord = {
  id: string;
  login: string;
  pin: string;
  nome: string;
  roleId: string;
  active: boolean;

  // exceções por usuário
  allow?: Permissao[];
  deny?: Permissao[];
};

export type AccessContext = {
  user: UserRecord;
  role: RoleRecord | null;
  perms: Set<Permissao>;
};

/** =========================
 *  Defaults (Seed)
 *  ========================= */
export function defaultRoles(): RoleRecord[] {
  return [
    {
      id: "r_admin",
      nome: "Administrador",
      permissoes: [
        "DASHBOARD",
        "LOJAS",
        "PRODUTOS",
        "ESTOQUE",
        "COMPRAS",
        "PDV",
        "RELATORIOS",
        "USUARIOS",
        "CONFIG",
      ],
      active: true,
      isSystem: true,
    },
    {
      id: "r_caixa",
      nome: "Caixa",
      permissoes: ["DASHBOARD", "PDV", "RELATORIOS"],
      active: true,
      isSystem: true,
    },
  ];
}

export function defaultUsers(): UserRecord[] {
  return [
    {
      id: "u_admin",
      login: "admin",
      pin: "1234",
      nome: "Administrador",
      roleId: "r_admin",
      active: true,
      allow: [],
      deny: [],
    },
    {
      id: "u_caixa",
      login: "caixa",
      pin: "1234",
      nome: "Caixa",
      roleId: "r_caixa",
      active: true,
      allow: [],
      deny: [],
    },
  ];
}

/** =========================
 *  Seed / DB
 *  ========================= */
export function ensureAccessSeed() {
  const db = (loadDB() as any) || {};
  let changed = false;

  if (!Array.isArray(db.roles) || db.roles.length === 0) {
    db.roles = defaultRoles();
    changed = true;
  }
  if (!Array.isArray(db.users) || db.users.length === 0) {
    db.users = defaultUsers();
    changed = true;
  }

  // config mínima
  if (!db.config || typeof db.config !== "object") {
    db.config = { lojaNome: "Loja Principal" };
    changed = true;
  } else if (!db.config.lojaNome) {
    db.config.lojaNome = "Loja Principal";
    changed = true;
  }

  if (changed) saveDB(db);
}

export function getRoles(): RoleRecord[] {
  ensureAccessSeed();
  const db = (loadDB() as any) || {};
  return Array.isArray(db.roles) ? (db.roles as RoleRecord[]) : [];
}

export function getUsers(): UserRecord[] {
  ensureAccessSeed();
  const db = (loadDB() as any) || {};
  return Array.isArray(db.users) ? (db.users as UserRecord[]) : [];
}

export function saveRoles(roles: RoleRecord[]) {
  const db = (loadDB() as any) || {};
  db.roles = roles;
  saveDB(db);
}

export function saveUsers(users: UserRecord[]) {
  const db = (loadDB() as any) || {};
  db.users = users;
  saveDB(db);
}

export function getRoleById(id: string): RoleRecord | null {
  return getRoles().find((r) => r.id === id) ?? null;
}

export function getUserById(id: string): UserRecord | null {
  return getUsers().find((u) => u.id === id) ?? null;
}

/** =========================
 *  Builders
 *  ========================= */
export function newRole(nome: string): RoleRecord {
  return {
    id: "r_" + uid(),
    nome: (nome || "").trim(),
    permissoes: [],
    active: true,
    isSystem: false,
  };
}

export function newUser(login: string, pin: string, nome: string, roleId: string): UserRecord {
  return {
    id: "u_" + uid(),
    login: (login || "").trim().toLowerCase(),
    pin: (pin || "").trim(),
    nome: (nome || "").trim(),
    roleId,
    active: true,
    allow: [],
    deny: [],
  };
}

/** =========================
 *  Permissões efetivas
 *  Cargo + allow - deny
 *  ========================= */
export function getAccessContext(userId: string): AccessContext | null {
  ensureAccessSeed();

  const user = getUserById(userId);
  if (!user || !user.active) return null;

  const role = getRoleById(user.roleId);
  const base = new Set<Permissao>((role?.permissoes ?? []).filter(Boolean));

  // apply allow
  for (const p of user.allow ?? []) base.add(p);

  // apply deny
  for (const p of user.deny ?? []) base.delete(p);

  return { user, role, perms: base };
}

export function hasPerm(ctx: AccessContext | null, perm: Permissao): boolean {
  if (!ctx) return false;
  return ctx.perms.has(perm);
}
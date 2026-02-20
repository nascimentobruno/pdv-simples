"use client";

import React, { useEffect, useMemo, useState } from "react";
import { requireAuthOrRedirect } from "@/lib/auth";
import {
  Permissao,
  RoleRecord,
  UserRecord,
  ensureAccessSeed,
  getRoles,
  getUsers,
  newRole,
  newUser,
  saveRoles,
  saveUsers,
} from "@/lib/access";

const PERMS: Array<{ key: Permissao; label: string }> = [
  { key: "DASHBOARD", label: "Visão geral" },
  { key: "LOJAS", label: "Lojas" },
  { key: "PRODUTOS", label: "Produtos" },
  { key: "ESTOQUE", label: "Estoque" },
  { key: "COMPRAS", label: "Compras" },
  { key: "PDV", label: "PDV" },
  { key: "RELATORIOS", label: "Relatórios" },
  { key: "USUARIOS", label: "Usuários" },
  { key: "CONFIG", label: "Configurações" },
];

export default function ConfigPage() {
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);

  const [newRoleName, setNewRoleName] = useState("");
  const [uLogin, setULogin] = useState("");
  const [uPin, setUPin] = useState("");
  const [uNome, setUNome] = useState("");
  const [uRoleId, setURoleId] = useState("");

  useEffect(() => {
    requireAuthOrRedirect("/login");
    ensureAccessSeed();
    const r = getRoles();
    const u = getUsers();
    setRoles(r);
    setUsers(u);
    setURoleId(r[0]?.id || "");
  }, []);

  const roleById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);

  function persistRoles(next: RoleRecord[]) {
    setRoles(next);
    saveRoles(next);
  }

  function persistUsers(next: UserRecord[]) {
    setUsers(next);
    saveUsers(next);
  }

  function toggleRolePerm(roleId: string, perm: Permissao) {
    const next = roles.map((r) => {
      if (r.id !== roleId) return r;
      const has = r.permissoes.includes(perm);
      const permissoes = has ? r.permissoes.filter((p) => p !== perm) : [...r.permissoes, perm];
      return { ...r, permissoes };
    });
    persistRoles(next);
  }

  function createRole() {
    const nome = newRoleName.trim();
    if (!nome) return;
    const r = newRole(nome);
    persistRoles([r, ...roles]);
    setNewRoleName("");
  }

  function deleteRole(roleId: string) {
    const role = roles.find((r) => r.id === roleId);
    if (!role) return;

    // não deixa deletar cargo do sistema
    if (role.isSystem) return;

    // não deixa deletar se tiver usuário usando
    if (users.some((u) => u.roleId === roleId)) return;

    persistRoles(roles.filter((r) => r.id !== roleId));
  }

  function createUser() {
    if (!uRoleId) return;

    const login = uLogin.trim().toLowerCase();
    const pin = uPin.trim();
    const nome = uNome.trim();

    if (!login || !pin || !nome) return;
    if (users.some((u) => u.login === login)) return;

    const u = newUser(login, pin, nome, uRoleId);
    persistUsers([u, ... users]);

    setULogin("");
    setUPin("");
    setUNome("");
  }

  function toggleUserActive(userId: string) {
    persistUsers(users.map((u) => (u.id === userId ? { ...u, active: !u.active } : u)));
  }

  function setUserRole(userId: string, roleId: string) {
    persistUsers(users.map((u) => (u.id === userId ? { ...u, roleId } : u)));
  }

  function toggleUserAllow(userId: string, perm: Permissao) {
    persistUsers(
      users.map((u) => {
        if (u.id !== userId) return u;
        const allow = new Set<Permissao>(u.allow ?? []);
        if (allow.has(perm)) allow.delete(perm);
        else allow.add(perm);
        return { ...u, allow: Array.from(allow) };
      })
    );
  }

  function toggleUserDeny(userId: string, perm: Permissao) {
    persistUsers(
      users.map((u) => {
        if (u.id !== userId) return u;
        const deny = new Set<Permissao>(u.deny ?? []);
        if (deny.has(perm)) deny.delete(perm);
        else deny.add(perm);
        return { ...u, deny: Array.from(deny) };
      })
    );
  }

  function deleteUser(userId: string) {
    persistUsers(users.filter((u) => u.id !== userId));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-sm text-zinc-400">
          Controle total: cargos com flags + exceções por usuário (allow/deny).
        </p>
      </div>

      {/* CARGOS */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <div className="text-lg font-bold">Cargos</div>
            <div className="text-xs text-zinc-500">Marque as permissões por cargo.</div>
          </div>

          <div className="flex gap-2">
            <input
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="Novo cargo (ex: SUPERVISOR)"
              className="h-10 w-64 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm outline-none focus:border-zinc-600"
            />
            <button
              onClick={createRole}
              className="h-10 rounded-xl bg-white px-4 text-sm font-bold text-black hover:opacity-90"
            >
              Criar cargo
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {roles.map((r) => (
            <div key={r.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-bold">{r.nome}</div>
                  <div className="text-xs text-zinc-500">ID: {r.id}</div>
                </div>

                <button
                  onClick={() => deleteRole(r.id)}
                  disabled={!!r.isSystem || users.some((u) => u.roleId === r.id)}
                  className={`rounded-xl border px-3 py-2 text-xs font-bold ${
                    r.isSystem || users.some((u) => u.roleId === r.id)
                      ? "border-zinc-800 bg-zinc-950 text-zinc-600"
                      : "border-zinc-800 bg-zinc-950 hover:bg-zinc-800"
                  }`}
                  title={
                    r.isSystem
                      ? "Cargo do sistema"
                      : users.some((u) => u.roleId === r.id)
                      ? "Existe usuário usando este cargo"
                      : "Remover cargo"
                  }
                >
                  Remover
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                {PERMS.map((p) => {
                  const checked = r.permissoes.includes(p.key);
                  return (
                    <label
                      key={p.key}
                      className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRolePerm(r.id, p.key)}
                      />
                      <span className="text-zinc-200">{p.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* USUÁRIOS */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <div className="text-lg font-bold">Usuários</div>
            <div className="text-xs text-zinc-500">
              Acesso vem do cargo, mas você pode dar exceções por usuário (allow/deny).
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            <input
              value={uNome}
              onChange={(e) => setUNome(e.target.value)}
              placeholder="Nome"
              className="h-10 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm outline-none focus:border-zinc-600"
            />
            <input
              value={uLogin}
              onChange={(e) => setULogin(e.target.value)}
              placeholder="Login"
              className="h-10 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm outline-none focus:border-zinc-600"
            />
            <input
              value={uPin}
              onChange={(e) => setUPin(e.target.value)}
              placeholder="PIN"
              className="h-10 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm outline-none focus:border-zinc-600"
              inputMode="numeric"
            />
            <select
              value={uRoleId}
              onChange={(e) => setURoleId(e.target.value)}
              className="h-10 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm outline-none focus:border-zinc-600"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                </option>
              ))}
            </select>

            <button
              onClick={createUser}
              className="h-10 rounded-xl bg-white px-4 text-sm font-bold text-black hover:opacity-90"
            >
              Criar
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {users.map((u) => {
            const role = roleById.get(u.roleId);
            return (
              <div key={u.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-bold">{u.nome}</div>
                    <div className="text-xs text-zinc-500">
                      login: <span className="text-zinc-200 font-semibold">{u.login}</span> • cargo:{" "}
                      <span className="text-zinc-200 font-semibold">{role?.nome || "—"}</span> •{" "}
                      {u.active ? "ativo" : "inativo"}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleUserActive(u.id)}
                      className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-bold hover:bg-zinc-800"
                    >
                      {u.active ? "Desativar" : "Ativar"}
                    </button>

                    <button
                      onClick={() => deleteUser(u.id)}
                      className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-bold hover:bg-zinc-800"
                    >
                      Remover
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
                    <div className="text-xs font-bold text-zinc-300">Cargo</div>
                    <select
                      value={u.roleId}
                      onChange={(e) => setUserRole(u.id, e.target.value)}
                      className="mt-2 h-10 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm outline-none focus:border-zinc-600"
                    >
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
                    <div className="text-xs font-bold text-zinc-300">Permissões extras (ALLOW)</div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {PERMS.map((p) => (
                        <label
                          key={p.key}
                          className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={(u.allow ?? []).includes(p.key)}
                            onChange={() => toggleUserAllow(u.id, p.key)}
                          />
                          <span className="text-zinc-200">{p.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
                    <div className="text-xs font-bold text-zinc-300">Bloqueios (DENY)</div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {PERMS.map((p) => (
                        <label
                          key={p.key}
                          className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={(u.deny ?? []).includes(p.key)}
                            onChange={() => toggleUserDeny(u.id, p.key)}
                          />
                          <span className="text-zinc-200">{p.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-xs text-zinc-500">
                  Regra final: <span className="text-zinc-200 font-semibold">Cargo</span> +{" "}
                  <span className="text-zinc-200 font-semibold">Allow</span> −{" "}
                  <span className="text-zinc-200 font-semibold">Deny</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
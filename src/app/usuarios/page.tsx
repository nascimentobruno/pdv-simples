// src/app/usuarios/page.tsx  (ajuste o caminho se seu arquivo estiver diferente)
"use client";

import { useEffect, useMemo, useState } from "react";
import { requireAuthOrRedirect, hasRole, makePinSecrets } from "@/lib/auth";
import { createUsuario, getUsuarios, setUsuarioAtivo, setUsuarioRole, updateUsuario, uid, Usuario, Role } from "@/lib/store";

const ROLES: Role[] = ["ADMIN", "GERENTE", "CAIXA", "ESTOQUISTA", "FINANCEIRO"];

export default function UsuariosPage() {
  const [me, setMe] = useState<any>(null);

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [filtro, setFiltro] = useState("");

  const [form, setForm] = useState({
    nome: "",
    login: "",
    pin: "",
    role: "CAIXA" as Role,
  });

  async function refresh() {
    const list = await getUsuarios();
    setUsuarios(list);
  }

  useEffect(() => {
    (async () => {
      const u = await requireAuthOrRedirect("/login");
      if (!u) return;

      if (!hasRole(u, ["ADMIN"])) {
        window.location.href = "/compras";
        return;
      }

      setMe(u);
      await refresh();
    })();
  }, []);

  const usuariosFiltrados = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    const base = [...usuarios];
    if (!q) return base;

    return base.filter((u) => {
      return (
        u.nome.toLowerCase().includes(q) ||
        u.login.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) ||
        (u.ativo ? "ativo" : "inativo").includes(q)
      );
    });
  }, [usuarios, filtro]);

  async function criarUsuarioHandler() {
    const nome = form.nome.trim();
    const login = form.login.trim().toLowerCase();
    const pin = form.pin.trim();
    const role = form.role;

    if (!nome) return alert("Informe o nome.");
    if (!login) return alert("Informe o login.");
    if (!pin) return alert("Informe o PIN (ex: 1234).");
    if (pin.length < 4) return alert("PIN muito curto. Use pelo menos 4 dígitos.");

    try {
      const secrets = await makePinSecrets(pin);

      const novo: Usuario = {
        id: uid(),
        nome,
        login,
        role,
        ativo: true,
        createdAt: new Date().toISOString(),
        pinSalt: secrets.pinSalt,
        pinHash: secrets.pinHash,
      };

      await createUsuario(novo);
      await refresh();

      setForm({ nome: "", login: "", pin: "", role: "CAIXA" });
    } catch (e: any) {
      alert(e?.message || "Erro ao criar usuário.");
    }
  }

  async function toggleAtivoHandler(userId: string) {
    if (me?.id === userId) return alert("Você não pode desativar seu próprio usuário.");

    const u = usuarios.find((x) => x.id === userId);
    if (!u) return;

    await setUsuarioAtivo(userId, !u.ativo);
    await refresh();
  }

  async function resetPinHandler(userId: string) {
    const newPin = prompt("Novo PIN para este usuário (mínimo 4 dígitos):");
    if (!newPin) return;
    if (newPin.trim().length < 4) return alert("PIN muito curto. Use pelo menos 4 dígitos.");

    const secrets = await makePinSecrets(newPin.trim());
    await updateUsuario(userId, { pinSalt: secrets.pinSalt, pinHash: secrets.pinHash });
    await refresh();
  }

  async function setRoleHandler(userId: string, role: Role) {
    if (me?.id === userId && role !== "ADMIN") {
      return alert("Você não pode remover seu próprio ADMIN.");
    }
    await setUsuarioRole(userId, role);
    await refresh();
  }

  return (
    <div className="container-app space-y-6">
      <div className="card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">Usuários</h1>
            <p className="muted mt-1 text-sm">
              Crie perfis (CAIXA, ESTOQUISTA, GERENTE...) e controle acesso.
            </p>
          </div>

          <button className="btn" onClick={() => (window.location.href = "/compras")}>
            Voltar
          </button>
        </div>
      </div>

      {/* CRIAR USUÁRIO */}
      <div className="card space-y-3">
        <h2 className="font-semibold">Novo usuário</h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input
            className="input"
            placeholder="Nome (ex: João)"
            value={form.nome}
            onChange={(e) => setForm((s) => ({ ...s, nome: e.target.value }))}
          />
          <input
            className="input"
            placeholder="Login (ex: joao)"
            value={form.login}
            onChange={(e) => setForm((s) => ({ ...s, login: e.target.value }))}
          />
          <input
            className="input"
            placeholder="PIN (ex: 1234)"
            value={form.pin}
            onChange={(e) => setForm((s) => ({ ...s, pin: e.target.value }))}
            inputMode="numeric"
          />
          <select
            className="input"
            value={form.role}
            onChange={(e) => setForm((s) => ({ ...s, role: e.target.value as Role }))}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <button className="btn btn-primary w-full" onClick={criarUsuarioHandler}>
          + Criar usuário
        </button>

        <div className="muted text-xs">
          Segurança: PIN é salvo com <b>hash + salt</b> (não fica visível no JSON).
        </div>
      </div>

      {/* LISTA */}
      <div className="card space-y-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <h2 className="font-semibold">Lista</h2>

          <input
            className="input md:max-w-sm"
            placeholder="Buscar por nome, login, role, ativo..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
        </div>

        {usuariosFiltrados.length === 0 ? (
          <p className="muted text-sm">Nenhum usuário encontrado.</p>
        ) : (
          <div className="space-y-2">
            {usuariosFiltrados.map((u) => {
              const isMe = me?.id === u.id;

              return (
                <div key={u.id} className="rounded-xl border border-zinc-800 bg-zinc-950/20 p-3">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <div className="font-semibold">
                        {u.nome}{" "}
                        {isMe ? <span className="badge ml-2 align-middle">Você</span> : null}{" "}
                        {!u.ativo ? <span className="badge ml-2 align-middle">Inativo</span> : null}
                      </div>
                      <div className="muted text-xs mt-1">
                        Login: <b>{u.login}</b> • Role: <b>{u.role}</b>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <select
                        className="input sm:w-[180px]"
                        value={u.role}
                        onChange={(e) => setRoleHandler(u.id, e.target.value as Role)}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>

                      <button className="btn" onClick={() => resetPinHandler(u.id)}>
                        Reset PIN
                      </button>

                      <button className="btn" onClick={() => toggleAtivoHandler(u.id)} disabled={isMe}>
                        {u.ativo ? "Desativar" : "Ativar"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="font-semibold">Regras rápidas (recomendadas)</h3>
        <ul className="muted text-sm mt-2 space-y-1 list-disc pl-5">
          <li><b>ADMIN</b>: gerencia tudo (inclusive usuários e configurações).</li>
          <li><b>GERENTE</b>: vendas + compras + estoque + relatórios (sem usuários).</li>
          <li><b>CAIXA</b>: vendas e consulta (sem custo).</li>
          <li><b>ESTOQUISTA</b>: compras + estoque (sem vendas).</li>
          <li><b>FINANCEIRO</b>: relatórios e exportações.</li>
        </ul>
      </div>
    </div>
  );
}
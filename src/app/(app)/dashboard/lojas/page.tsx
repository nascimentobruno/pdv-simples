// src/app/(app)/dashboard/lojas/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { loadDB, saveDB, uid } from "@/lib/store";
import { requireAuthOrRedirect } from "@/lib/auth";

type Loja = { id: string; nome: string; ativa: boolean };

export default function LojasPage() {
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [nome, setNome] = useState("");

  useEffect(() => {
    requireAuthOrRedirect("/login");
    const db = loadDB() as any;
    const list = Array.isArray(db?.lojas) ? db.lojas : [];
    setLojas(list);
  }, []);

  function persist(next: Loja[]) {
    setLojas(next);
    const db = loadDB() as any;
    saveDB({ ...(db || {}), lojas: next });
  }

  function add() {
    const n = nome.trim();
    if (!n) return;

    const next = [{ id: uid(), nome: n, ativa: true }, ...lojas];
    persist(next);
    setNome("");
  }

  function toggle(id: string) {
    persist(lojas.map((l) => (l.id === id ? { ...l, ativa: !l.ativa } : l)));
  }

  function remove(id: string) {
    persist(lojas.filter((l) => l.id !== id));
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Gestão de Lojas</h1>
        <p className="text-sm text-zinc-400">Crie e gerencie suas lojas.</p>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        <div className="flex gap-2">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome da loja"
            className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-sm outline-none focus:border-zinc-600"
          />
          <button
            onClick={add}
            className="rounded-xl bg-white text-black font-bold px-4"
          >
            Adicionar
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        {lojas.length === 0 ? (
          <div className="text-sm text-zinc-400">Nenhuma loja cadastrada ainda.</div>
        ) : (
          <div className="space-y-2">
            {lojas.map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                <div>
                  <div className="font-semibold">{l.nome}</div>
                  <div className="text-xs text-zinc-400">{l.ativa ? "Ativa" : "Inativa"}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggle(l.id)}
                    className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-bold hover:bg-zinc-800"
                  >
                    {l.ativa ? "Desativar" : "Ativar"}
                  </button>
                  <button
                    onClick={() => remove(l.id)}
                    className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-bold hover:bg-zinc-800"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
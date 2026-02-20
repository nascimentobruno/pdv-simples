// src/app/(app)/dashboard/estoque/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { loadDB, saveDB } from "@/lib/store";
import { requireAuthOrRedirect } from "@/lib/auth";

type EstoqueRow = { variacaoId: string; quantidade: number };
type ProdutoRow = { id: string; nome?: string; sku?: string; ativo?: boolean };
type VariacaoRow = { id: string; produtoId: string; tamanho?: string; cor?: string; skuVariacao?: string };

export default function EstoquePage() {
  const [estoque, setEstoque] = useState<EstoqueRow[]>([]);
  const [produtos, setProdutos] = useState<ProdutoRow[]>([]);
  const [variacoes, setVariacoes] = useState<VariacaoRow[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    requireAuthOrRedirect("/login");
    const db = loadDB() as any;
    setEstoque(Array.isArray(db?.estoque) ? db.estoque : []);
    setProdutos(Array.isArray(db?.produtos) ? db.produtos : []);
    setVariacoes(Array.isArray(db?.variacoes) ? db.variacoes : []);
  }, []);

  const mapProdNome = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of produtos) m.set(p.id, p.nome || "Produto");
    return m;
  }, [produtos]);

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase();

    const estMap = new Map<string, number>();
    for (const e of estoque) estMap.set(String(e.variacaoId), Number(e.quantidade ?? 0));

    const out = variacoes.map((v) => {
      const nomeProduto = mapProdNome.get(v.produtoId) || "Produto";
      const size = v.tamanho ? ` • ${v.tamanho}` : "";
      const cor = v.cor ? ` • ${v.cor}` : "";
      const nome = `${nomeProduto}${size}${cor}`;
      const sku = (v.skuVariacao || "").toString();
      const qtd = estMap.get(v.id) ?? 0;
      return { id: v.id, nome, sku, qtd };
    });

    const filtered = !ql
      ? out
      : out.filter((r) => r.nome.toLowerCase().includes(ql) || r.sku.toLowerCase().includes(ql));

    return filtered.sort((a, b) => a.nome.localeCompare(b.nome));
  }, [estoque, variacoes, mapProdNome, q]);

  function setQty(variacaoId: string, quantidade: number) {
    const next = [...estoque];
    const idx = next.findIndex((e) => String(e.variacaoId) === String(variacaoId));
    if (idx >= 0) next[idx] = { ...next[idx], quantidade };
    else next.push({ variacaoId, quantidade });

    setEstoque(next);

    const db = loadDB() as any;
    saveDB({ ...(db || {}), estoque: next });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Estoque</h1>
        <p className="text-sm text-zinc-400">Controle de estoque por variação.</p>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        <label className="block text-xs font-semibold text-zinc-400">Buscar (nome/SKU)</label>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-sm outline-none focus:border-zinc-600"
          placeholder="Digite para filtrar..."
        />
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        {rows.length === 0 ? (
          <div className="text-sm text-zinc-400">Nenhuma variação encontrada. Cadastre em Produtos/Variações.</div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => {
              const badge =
                r.qtd === 0 ? "bg-red-600 text-white" : r.qtd <= 3 ? "bg-yellow-500 text-black" : "bg-zinc-800 text-zinc-200";

              return (
                <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{r.nome}</div>
                    <div className="text-xs text-zinc-400 truncate">{r.sku || r.id}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${badge}`}>
                      {r.qtd === 0 ? "ESGOTADO" : r.qtd <= 3 ? "ÚLTIMAS" : "OK"}
                    </span>

                    <input
                      value={r.qtd}
                      onChange={(e) => setQty(r.id, Math.max(0, Math.floor(Number(e.target.value || 0))))}
                      className="h-10 w-20 rounded-xl border border-zinc-800 bg-zinc-950 px-2 text-center text-sm outline-none focus:border-zinc-600"
                      inputMode="numeric"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
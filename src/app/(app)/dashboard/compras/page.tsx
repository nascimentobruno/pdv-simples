"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Compra,
  ItemCompra,
  Variacao,
  Produto,
  Estoque,
  loadDB,
  saveDB,
  uid,
  num,
  int,
  fmtBRL,
} from "@/lib/store";

export default function ComprasPage() {
  const [compras, setCompras] = useState<Compra[]>([]);
  const [itensCompra, setItensCompra] = useState<ItemCompra[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [variacoes, setVariacoes] = useState<Variacao[]>([]);
  const [estoque, setEstoque] = useState<Estoque[]>([]);

  const [compraAtualId, setCompraAtualId] = useState<string>("");

  const [frete, setFrete] = useState<string>("");
  const [outras, setOutras] = useState<string>("");

  const [itemForm, setItemForm] = useState({
    variacaoId: "",
    qtd: "",
    custoUnit: "",
  });

  useEffect(() => {
    const db = loadDB();
    setCompras(db.compras.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
    setItensCompra(db.itensCompra);
    setProdutos(db.produtos);
    setVariacoes(db.variacoes);
    setEstoque(db.estoque);
  }, []);

  function persist(next: Partial<ReturnType<typeof loadDB>>) {
    const db = loadDB();
    const updated = { ...db, ...next };
    saveDB(updated);
    setCompras(updated.compras.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
    setItensCompra(updated.itensCompra);
    setProdutos(updated.produtos);
    setVariacoes(updated.variacoes);
    setEstoque(updated.estoque);
  }

  const compraAtual = useMemo(() => compras.find((c) => c.id === compraAtualId) || null, [compras, compraAtualId]);

  const itensDaCompraAtual = useMemo(() => {
    if (!compraAtual) return [];
    return itensCompra.filter((i) => i.compraId === compraAtual.id);
  }, [itensCompra, compraAtual]);

  const variacaoSelecionada = useMemo(() => {
    return variacoes.find((v) => v.id === itemForm.variacaoId) || null;
  }, [variacoes, itemForm.variacaoId]);

  const produtoDaVariacao = useMemo(() => {
    if (!variacaoSelecionada) return null;
    return produtos.find((p) => p.id === variacaoSelecionada.produtoId) || null;
  }, [variacaoSelecionada, produtos]);

  function estoqueDaVariacao(variacaoId: string) {
    return estoque.find((e) => e.variacaoId === variacaoId);
  }

  const totalProdutos = useMemo(() => {
    return itensDaCompraAtual.reduce((acc, i) => acc + i.subtotal, 0);
  }, [itensDaCompraAtual]);

  const totalCompra = useMemo(() => {
    return totalProdutos + num(frete) + num(outras);
  }, [totalProdutos, frete, outras]);

  function novaCompra() {
    const c: Compra = {
      id: uid(),
      dataHora: new Date().toISOString(),
      frete: 0,
      outrasDespesas: 0,
      totalProdutos: 0,
      totalCompra: 0,
      status: "RASCUNHO",
      createdAt: new Date().toISOString(),
    };

    persist({ compras: [c, ...compras] });
    setCompraAtualId(c.id);
    setFrete("");
    setOutras("");
    setItemForm({ variacaoId: "", qtd: "", custoUnit: "" });
  }

  function selecionarCompra(id: string) {
    const c = compras.find((x) => x.id === id);
    if (!c) return;

    setCompraAtualId(id);
    setFrete(String(c.frete || ""));
    setOutras(String(c.outrasDespesas || ""));
    setItemForm({ variacaoId: "", qtd: "", custoUnit: "" });
  }

  function adicionarItem() {
    if (!compraAtual) {
      alert("Crie ou selecione uma compra.");
      return;
    }
    if (compraAtual.status !== "RASCUNHO") {
      alert("Essa compra não está em rascunho.");
      return;
    }

    const variacaoId = itemForm.variacaoId;
    const qtd = Math.max(1, int(itemForm.qtd));
    const custoUnit = Math.max(0, num(itemForm.custoUnit));

    if (!variacaoId) {
      alert("Selecione uma variação.");
      return;
    }

    const subtotal = qtd * custoUnit;

    const item: ItemCompra = {
      id: uid(),
      compraId: compraAtual.id,
      variacaoId,
      qtd,
      custoUnit,
      subtotal,
      createdAt: new Date().toISOString(),
    };

    persist({ itensCompra: [item, ...itensCompra] });

    setItemForm({ variacaoId: "", qtd: "", custoUnit: "" });
  }

  function removerItem(itemId: string) {
    if (!compraAtual) return;
    if (compraAtual.status !== "RASCUNHO") return;

    persist({ itensCompra: itensCompra.filter((i) => i.id !== itemId) });
  }

  function salvarTotaisNoRascunho() {
    if (!compraAtual) return;
    if (compraAtual.status !== "RASCUNHO") return;

    const nextCompras = compras.map((c) =>
      c.id === compraAtual.id
        ? {
            ...c,
            frete: num(frete),
            outrasDespesas: num(outras),
            totalProdutos,
            totalCompra,
          }
        : c
    );

    persist({ compras: nextCompras });
  }

  function confirmarCompra() {
    if (!compraAtual) return;
    if (compraAtual.status !== "RASCUNHO") return;
    if (itensDaCompraAtual.length === 0) {
      alert("Adicione ao menos 1 item.");
      return;
    }

    // 1) Atualiza estoque + custo médio (se não travado)
    const db = loadDB();

    const nextEstoque = [...db.estoque];
    const nextVariacoes = [...db.variacoes];
    const nextMov = [...db.movimentos];

    for (const item of itensDaCompraAtual) {
      const vIndex = nextVariacoes.findIndex((v) => v.id === item.variacaoId);
      if (vIndex === -1) continue;

      const v = nextVariacoes[vIndex];

      // estoque atual antes da entrada
      let e = nextEstoque.find((x) => x.variacaoId === item.variacaoId);
      if (!e) {
        e = {
          id: uid(),
          variacaoId: item.variacaoId,
          quantidadeAtual: 0,
          estoqueMinimo: 0,
          updatedAt: new Date().toISOString(),
        };
        nextEstoque.unshift(e);
      }

      const oldQty = e.quantidadeAtual;
      const addQty = item.qtd;

      // custo médio ponderado (se não travado)
      if (!v.custoTravado) {
        const oldCost = v.custoMedio || 0;
        const newCost = (oldCost * oldQty + item.custoUnit * addQty) / Math.max(1, oldQty + addQty);
        nextVariacoes[vIndex] = { ...v, custoMedio: Number(newCost.toFixed(4)) };
      }

      // entrada estoque
      e.quantidadeAtual = oldQty + addQty;
      e.updatedAt = new Date().toISOString();

      // movimento
      nextMov.unshift({
        id: uid(),
        variacaoId: item.variacaoId,
        tipo: "ENTRADA",
        quantidade: addQty,
        motivo: "COMPRA",
        referenciaId: compraAtual.id,
        dataHora: new Date().toISOString(),
      });
    }

    // 2) Atualiza compra para CONFIRMADA + totais
        const nextCompras = db.compras.map((c) =>
        c.id === compraAtual.id
        ? {
        ...c,
        frete: num(frete),
        outrasDespesas: num(outras),
        totalProdutos,
        totalCompra,
        status: "CONFIRMADA" as const,
      }
    : c
);

    saveDB({
      ...db,
      estoque: nextEstoque,
      variacoes: nextVariacoes,
      movimentos: nextMov,
      compras: nextCompras,
    });

    // 3) Recarrega states
    const refreshed = loadDB();
    setCompras(refreshed.compras.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
    setItensCompra(refreshed.itensCompra);
    setProdutos(refreshed.produtos);
    setVariacoes(refreshed.variacoes);
    setEstoque(refreshed.estoque);

    alert("Compra confirmada! Estoque atualizado e custo médio recalculado (quando não travado).");
  }

  const opcoesVariacoes = useMemo(() => {
    return variacoes
      .map((v) => {
        const p = produtos.find((x) => x.id === v.produtoId);
        const label = `${p?.nome ?? "Produto"} • ${v.tamanho ?? "-"} • ${v.cor ?? "-"} (${fmtBRL(v.precoVenda)} | custo ${fmtBRL(v.custoMedio)})`;
        return { id: v.id, label };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [variacoes, produtos]);

  return (
    <div className="container-app space-y-6">
      <div className="card">
        <h1 className="text-2xl md:text-3xl font-black tracking-tight">Compras</h1>
        <p className="muted mt-1 text-sm">
          Entrada de estoque + cálculo correto de custo médio (quando custo não estiver travado).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* LISTA COMPRAS */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card">
            <button className="btn btn-primary w-full" onClick={novaCompra}>
              + Nova compra (rascunho)
            </button>
          </div>

          <div className="card space-y-2">
            <h2 className="font-semibold">Minhas compras</h2>

            {compras.length === 0 ? (
              <p className="muted text-sm">Nenhuma compra ainda.</p>
            ) : (
              <div className="space-y-2">
                {compras.map((c) => (
                  <button
                    key={c.id}
                    className={`w-full text-left rounded-xl border px-3 py-3 transition ${
                      compraAtualId === c.id
                        ? "border-white/20 bg-zinc-900/70"
                        : "border-zinc-800 bg-zinc-950/20 hover:bg-zinc-900/50"
                    }`}
                    onClick={() => selecionarCompra(c.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{new Date(c.dataHora).toLocaleString("pt-BR")}</div>
                        <div className="muted text-xs mt-1">
                          Status: {c.status} • Total: {fmtBRL(c.totalCompra)}
                        </div>
                      </div>
                      <span className="badge">{c.status}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* DETALHE COMPRA */}
        <div className="lg:col-span-3 space-y-4">
          {!compraAtual ? (
            <div className="card">
              <p className="muted">Crie ou selecione uma compra para adicionar itens.</p>
            </div>
          ) : (
            <>
              <div className="card space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black">Compra</h2>
                    <p className="muted text-sm">
                      {new Date(compraAtual.dataHora).toLocaleString("pt-BR")} • Status: {compraAtual.status}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button className="btn" onClick={salvarTotaisNoRascunho} disabled={compraAtual.status !== "RASCUNHO"}>
                      Salvar totais
                    </button>
                    <button className="btn btn-primary" onClick={confirmarCompra} disabled={compraAtual.status !== "RASCUNHO"}>
                      Confirmar compra
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input
                    className="input"
                    placeholder="Frete (ex: 25.00)"
                    value={frete}
                    onChange={(e) => setFrete(e.target.value)}
                    disabled={compraAtual.status !== "RASCUNHO"}
                  />
                  <input
                    className="input"
                    placeholder="Outras despesas (ex: 10.00)"
                    value={outras}
                    onChange={(e) => setOutras(e.target.value)}
                    disabled={compraAtual.status !== "RASCUNHO"}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <Resumo label="Total produtos" value={fmtBRL(totalProdutos)} />
                  <Resumo label="Frete + outras" value={fmtBRL(num(frete) + num(outras))} />
                  <Resumo label="Total compra" value={fmtBRL(totalCompra)} />
                </div>
              </div>

              <div className="card space-y-4">
                <h3 className="text-lg font-semibold">Adicionar item</h3>

                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    ✅ Ao <b>confirmar</b> a compra, o estoque entra automaticamente e o custo médio é recalculado
                    (somente nas variações sem custo travado).
                  </p>
                </div>

                <div className="space-y-2">
                  <select
                    className="input"
                    value={itemForm.variacaoId}
                    onChange={(e) => setItemForm((s) => ({ ...s, variacaoId: e.target.value }))}
                    disabled={compraAtual.status !== "RASCUNHO"}
                  >
                    <option value="">Selecione a variação</option>
                    {opcoesVariacoes.map((o) => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </select>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input
                      className="input"
                      placeholder="Quantidade (ex: 10)"
                      value={itemForm.qtd}
                      onChange={(e) => setItemForm((s) => ({ ...s, qtd: e.target.value }))}
                      disabled={compraAtual.status !== "RASCUNHO"}
                    />
                    <input
                      className="input"
                      placeholder="Custo unitário (ex: 59.90)"
                      value={itemForm.custoUnit}
                      onChange={(e) => setItemForm((s) => ({ ...s, custoUnit: e.target.value }))}
                      disabled={compraAtual.status !== "RASCUNHO"}
                    />
                  </div>

                  {variacaoSelecionada && (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-3">
                      <p className="text-sm font-medium">
                        {produtoDaVariacao?.nome ?? "Produto"} • {variacaoSelecionada.tamanho ?? "-"} • {variacaoSelecionada.cor ?? "-"}
                      </p>
                      <p className="muted text-xs mt-1">
                        Estoque atual: {estoqueDaVariacao(variacaoSelecionada.id)?.quantidadeAtual ?? 0} •
                        Preço venda: {fmtBRL(variacaoSelecionada.precoVenda)} •
                        Custo atual: {fmtBRL(variacaoSelecionada.custoMedio)} •
                        {variacaoSelecionada.custoTravado ? "Custo travado" : "Custo recalculável"}
                      </p>
                    </div>
                  )}

                  <button className="btn btn-primary w-full" onClick={adicionarItem} disabled={compraAtual.status !== "RASCUNHO"}>
                    Adicionar item
                  </button>
                </div>
              </div>

              <div className="card space-y-3">
                <h3 className="font-semibold">Itens da compra</h3>

                {itensDaCompraAtual.length === 0 ? (
                  <p className="muted text-sm">Nenhum item ainda.</p>
                ) : (
                  <div className="space-y-2">
                    {itensDaCompraAtual.map((i) => {
                      const v = variacoes.find((x) => x.id === i.variacaoId);
                      const p = v ? produtos.find((x) => x.id === v.produtoId) : null;

                      return (
                        <div key={i.id} className="rounded-xl border border-zinc-800 bg-zinc-950/20 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-medium">
                                {p?.nome ?? "Produto"} • {v?.tamanho ?? "-"} • {v?.cor ?? "-"}
                              </div>
                              <div className="muted text-xs mt-1">
                                Qtd: {i.qtd} • Custo unit: {fmtBRL(i.custoUnit)} • Subtotal: {fmtBRL(i.subtotal)}
                              </div>
                            </div>

                            {compraAtual.status === "RASCUNHO" && (
                              <button className="btn" onClick={() => removerItem(i.id)}>
                                Remover
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Resumo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/30 p-3">
      <div className="muted text-xs">{label}</div>
      <div className="text-lg font-black mt-1">{value}</div>
    </div>
  );
}
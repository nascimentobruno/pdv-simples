"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Categoria,
  Produto,
  Variacao,
  Estoque,
  loadDB,
  saveDB,
  uid,
  num,
  int,
  fmtBRL,
  margemPct,
  pct,
} from "@/lib/store";

export default function ProdutosPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [variacoes, setVariacoes] = useState<Variacao[]>([]);
  const [estoque, setEstoque] = useState<Estoque[]>([]);

  const [novaCategoria, setNovaCategoria] = useState("");
  const [novoProduto, setNovoProduto] = useState({ nome: "", categoriaId: "" });

  const [produtoSelecionadoId, setProdutoSelecionadoId] = useState<string>("");

  const [novaVariacao, setNovaVariacao] = useState({
    tamanho: "",
    cor: "",
    skuVariacao: "",
    precoVenda: "",
    custoMedio: "",
    estoqueInicial: "",
    estoqueMinimo: "",
    custoTravado: false,
  });

  useEffect(() => {
    const db = loadDB();
    setCategorias(db.categorias);
    setProdutos(db.produtos);
    setVariacoes(db.variacoes);
    setEstoque(db.estoque);
  }, []);

  function persist(next: {
    categorias?: Categoria[];
    produtos?: Produto[];
    variacoes?: Variacao[];
    estoque?: Estoque[];
  }) {
    const db = loadDB();
    const updated = {
      ...db,
      categorias: next.categorias ?? categorias,
      produtos: next.produtos ?? produtos,
      variacoes: next.variacoes ?? variacoes,
      estoque: next.estoque ?? estoque,
    };
    saveDB(updated);
    setCategorias(updated.categorias);
    setProdutos(updated.produtos);
    setVariacoes(updated.variacoes);
    setEstoque(updated.estoque);
  }

  const categoriasMap = useMemo(() => {
    const m = new Map<string, Categoria>();
    categorias.forEach((c) => m.set(c.id, c));
    return m;
  }, [categorias]);

  const produtoSelecionado = useMemo(() => {
    return produtos.find((p) => p.id === produtoSelecionadoId) || null;
  }, [produtos, produtoSelecionadoId]);

  const variacoesDoProduto = useMemo(() => {
    if (!produtoSelecionado) return [];
    return variacoes
      .filter((v) => v.produtoId === produtoSelecionado.id)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [variacoes, produtoSelecionado]);

  function estoqueDaVariacao(variacaoId: string) {
    return estoque.find((e) => e.variacaoId === variacaoId);
  }

  const previewVariacao = useMemo(() => {
    if (!produtoSelecionado) return null;

    const tamanho = novaVariacao.tamanho.trim() || "—";
    const cor = novaVariacao.cor.trim() || "—";
    const est = novaVariacao.estoqueInicial.trim() || "0";
    const preco = (novaVariacao.precoVenda.trim() || "0").replace(",", ".");
    return `${produtoSelecionado.nome} • ${tamanho} • ${cor} • Estoque: ${est} • R$ ${preco}`;
  }, [novaVariacao, produtoSelecionado]);

  function adicionarCategoria() {
    const nome = novaCategoria.trim();
    if (!nome) return;

    const existe = categorias.some((c) => c.nome.toLowerCase() === nome.toLowerCase());
    if (existe) {
      alert("Essa categoria já existe.");
      return;
    }

    const c: Categoria = { id: uid(), nome, ativo: true, createdAt: new Date().toISOString() };
    persist({ categorias: [c, ...categorias] });
    setNovaCategoria("");
  }

  function adicionarProduto() {
    const nome = novoProduto.nome.trim();
    if (!nome) return;

    const p: Produto = {
      id: uid(),
      nome,
      categoriaId: novoProduto.categoriaId || undefined,
      ativo: true,
      createdAt: new Date().toISOString(),
    };

    persist({ produtos: [p, ...produtos] });
    setNovoProduto({ nome: "", categoriaId: "" });
    setProdutoSelecionadoId(p.id);
  }

  function adicionarVariacao() {
    if (!produtoSelecionado) return;

    const tamanho = novaVariacao.tamanho.trim();
    const cor = novaVariacao.cor.trim();

    if (!tamanho || !cor) {
      alert("Preencha Tamanho e Cor.");
      return;
    }

    const duplicada = variacoes.some(
      (v) =>
        v.produtoId === produtoSelecionado.id &&
        (v.tamanho || "").toLowerCase() === tamanho.toLowerCase() &&
        (v.cor || "").toLowerCase() === cor.toLowerCase()
    );
    if (duplicada) {
      alert("Já existe uma variação com esse tamanho/cor.");
      return;
    }

    const v: Variacao = {
      id: uid(),
      produtoId: produtoSelecionado.id,
      tamanho,
      cor,
      skuVariacao: novaVariacao.skuVariacao.trim() || undefined,
      precoVenda: num(novaVariacao.precoVenda),
      custoMedio: num(novaVariacao.custoMedio),
      custoTravado: !!novaVariacao.custoTravado,
      createdAt: new Date().toISOString(),
    };

    const e: Estoque = {
      id: uid(),
      variacaoId: v.id,
      quantidadeAtual: Math.max(0, int(novaVariacao.estoqueInicial)),
      estoqueMinimo: Math.max(0, int(novaVariacao.estoqueMinimo)),
      updatedAt: new Date().toISOString(),
    };

    persist({ variacoes: [v, ...variacoes], estoque: [e, ...estoque] });

    setNovaVariacao({
      tamanho: "",
      cor: "",
      skuVariacao: "",
      precoVenda: "",
      custoMedio: "",
      estoqueInicial: "",
      estoqueMinimo: "",
      custoTravado: false,
    });
  }

  function removerVariacao(variacaoId: string) {
    if (!confirm("Remover variação?")) return;

    persist({
      variacoes: variacoes.filter((v) => v.id !== variacaoId),
      estoque: estoque.filter((e) => e.variacaoId !== variacaoId),
    });
  }

  function updateVariacao(variacaoId: string, patch: Partial<Pick<Variacao, "precoVenda" | "custoMedio" | "custoTravado">>) {
    const next = variacoes.map((v) => (v.id === variacaoId ? { ...v, ...patch } : v));
    persist({ variacoes: next });
  }

  function updateEstoque(variacaoId: string, patch: Partial<Pick<Estoque, "quantidadeAtual" | "estoqueMinimo">>) {
    const next = estoque.map((e) =>
      e.variacaoId === variacaoId ? { ...e, ...patch, updatedAt: new Date().toISOString() } : e
    );
    persist({ estoque: next });
  }

  return (
    <div className="container-app space-y-6">
      <div className="card">
        <h1 className="text-2xl md:text-3xl font-black tracking-tight">Produtos</h1>
        <p className="muted mt-1 text-sm">
          Modo profissional: variações por <b>tamanho</b> e <b>cor</b>, com estoque e custo por variação.
        </p>
      </div>

      {/* CATEGORIAS */}
      <div className="card space-y-3">
        <h2 className="text-lg font-semibold">Categorias</h2>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            className="input"
            placeholder="Ex: Camisetas, Moletons..."
            value={novaCategoria}
            onChange={(e) => setNovaCategoria(e.target.value)}
          />
          <button className="btn btn-primary" onClick={adicionarCategoria}>
            Adicionar
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {categorias.map((c) => (
            <span key={c.id} className="badge">{c.nome}</span>
          ))}
        </div>
      </div>

      {/* PRODUTO */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="card space-y-3">
            <h2 className="text-lg font-semibold">Novo Produto</h2>

            <input
              className="input"
              placeholder="Nome do produto (ex: Camiseta Devil Classic)"
              value={novoProduto.nome}
              onChange={(e) => setNovoProduto((p) => ({ ...p, nome: e.target.value }))}
            />

            <select
              className="input"
              value={novoProduto.categoriaId}
              onChange={(e) => setNovoProduto((p) => ({ ...p, categoriaId: e.target.value }))}
            >
              <option value="">Selecione a categoria (opcional)</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>

            <button className="btn btn-primary" onClick={adicionarProduto}>
              Criar Produto
            </button>
          </div>

          <div className="card space-y-3">
            <h2 className="text-lg font-semibold">Selecionar Produto</h2>

            <select
              className="input"
              value={produtoSelecionadoId}
              onChange={(e) => setProdutoSelecionadoId(e.target.value)}
            >
              <option value="">Selecione um produto</option>
              {produtos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}{p.categoriaId ? ` • ${categoriasMap.get(p.categoriaId)?.nome ?? ""}` : ""}
                </option>
              ))}
            </select>

            <p className="muted text-sm">
              Dica: crie o produto e depois as variações (P/Preto, M/Preto...).
            </p>
          </div>
        </div>

        {/* VARIAÇÕES */}
        <div className="lg:col-span-3 space-y-4">
          {!produtoSelecionado ? (
            <div className="card">
              <p className="muted">Selecione um produto para cadastrar variações.</p>
            </div>
          ) : (
            <>
              <div className="card">
                <h2 className="text-xl font-black">{produtoSelecionado.nome}</h2>
                <p className="muted text-sm mt-1">
                  {produtoSelecionado.categoriaId
                    ? `Categoria: ${categoriasMap.get(produtoSelecionado.categoriaId)?.nome ?? "-"}`
                    : "Sem categoria"}
                </p>
              </div>

              <div className="card space-y-4">
                <h3 className="text-lg font-semibold">Nova variação</h3>

                {/* LEGENDA */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    📦 Cada variação possui seu próprio <b>preço</b>, <b>custo</b> e <b>estoque</b>.
                    Exemplo: P/Preto e M/Preto são controladas separadamente.
                  </p>
                </div>

                {/* PRÉVIA */}
                {previewVariacao && (
                  <div className="rounded-xl border border-zinc-700 bg-zinc-950/60 p-3">
                    <p className="text-xs text-zinc-400 mb-1">Prévia da variação:</p>
                    <p className="text-sm font-medium text-white">{previewVariacao}</p>
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-3">
                  <input
                    className="input"
                    placeholder="Tamanho (ex: P, M, G)"
                    value={novaVariacao.tamanho}
                    onChange={(e) => setNovaVariacao((v) => ({ ...v, tamanho: e.target.value }))}
                  />
                  <input
                    className="input"
                    placeholder="Cor (ex: Preto, Branco)"
                    value={novaVariacao.cor}
                    onChange={(e) => setNovaVariacao((v) => ({ ...v, cor: e.target.value }))}
                  />

                  <input
                    className="input"
                    placeholder="SKU da variação (opcional)"
                    value={novaVariacao.skuVariacao}
                    onChange={(e) => setNovaVariacao((v) => ({ ...v, skuVariacao: e.target.value }))}
                  />

                  <label className="flex items-center gap-2 text-sm rounded-xl border border-zinc-800 bg-zinc-950/30 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={novaVariacao.custoTravado}
                      onChange={(e) => setNovaVariacao((v) => ({ ...v, custoTravado: e.target.checked }))}
                    />
                    Custo travado
                  </label>

                  <input
                    className="input"
                    placeholder="Preço de venda (ex: 139.90)"
                    value={novaVariacao.precoVenda}
                    onChange={(e) => setNovaVariacao((v) => ({ ...v, precoVenda: e.target.value }))}
                  />
                  <input
                    className="input"
                    placeholder="Custo médio (ex: 59.90)"
                    value={novaVariacao.custoMedio}
                    onChange={(e) => setNovaVariacao((v) => ({ ...v, custoMedio: e.target.value }))}
                  />

                  <input
                    className="input"
                    placeholder="Estoque inicial (ex: 10)"
                    value={novaVariacao.estoqueInicial}
                    onChange={(e) => setNovaVariacao((v) => ({ ...v, estoqueInicial: e.target.value }))}
                  />
                  <input
                    className="input"
                    placeholder="Estoque mínimo (alerta)"
                    value={novaVariacao.estoqueMinimo}
                    onChange={(e) => setNovaVariacao((v) => ({ ...v, estoqueMinimo: e.target.value }))}
                  />
                </div>

                <button className="btn btn-primary w-full" onClick={adicionarVariacao}>
                  Adicionar variação
                </button>
              </div>

              <div className="card space-y-3">
                <h3 className="font-semibold">Variações</h3>

                {variacoesDoProduto.length === 0 ? (
                  <p className="muted text-sm">Nenhuma variação cadastrada ainda.</p>
                ) : (
                  <div className="space-y-2">
                    {variacoesDoProduto.map((v) => {
                      const e = estoqueDaVariacao(v.id);
                      const estAtual = e?.quantidadeAtual ?? 0;
                      const estMin = e?.estoqueMinimo ?? 0;
                      const abaixo = estAtual <= estMin;

                      const margem = margemPct(v.precoVenda, v.custoMedio);
                      const lucro = (v.precoVenda || 0) - (v.custoMedio || 0);

                      return (
                        <div
                          key={v.id}
                          className={`rounded-2xl border p-3 ${abaixo ? "border-red-500/40 bg-red-500/5" : "border-zinc-800 bg-zinc-950/20"}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium">
                                {produtoSelecionado.nome} • {v.tamanho} • {v.cor}
                              </p>
                              <p className="muted text-xs mt-1">
                                SKU: {v.skuVariacao || "-"} • {abaixo ? "⚠ Estoque baixo" : "OK"} •{" "}
                                Custo {v.custoTravado ? "travado" : "médio"}
                              </p>
                            </div>
                            <button className="btn" onClick={() => removerVariacao(v.id)}>
                              Remover
                            </button>
                          </div>

                          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                            <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-2">
                              <div className="muted text-xs">Preço</div>
                              <input
                                className="input mt-1"
                                value={String(v.precoVenda)}
                                onChange={(ev) => updateVariacao(v.id, { precoVenda: num(ev.target.value) })}
                              />
                            </div>

                            <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-2">
                              <div className="muted text-xs">Custo</div>
                              <input
                                className="input mt-1"
                                value={String(v.custoMedio)}
                                onChange={(ev) => updateVariacao(v.id, { custoMedio: num(ev.target.value) })}
                              />
                            </div>

                            <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-2">
                              <div className="muted text-xs">Estoque</div>
                              <input
                                className="input mt-1"
                                value={String(estAtual)}
                                onChange={(ev) =>
                                  updateEstoque(v.id, { quantidadeAtual: Math.max(0, Math.trunc(num(ev.target.value))) })
                                }
                              />
                            </div>

                            <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-2">
                              <div className="muted text-xs">Mínimo</div>
                              <input
                                className="input mt-1"
                                value={String(estMin)}
                                onChange={(ev) =>
                                  updateEstoque(v.id, { estoqueMinimo: Math.max(0, Math.trunc(num(ev.target.value))) })
                                }
                              />
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                            <MiniStat label="Margem" value={pct(margem)} />
                            <MiniStat label="Lucro por peça" value={fmtBRL(lucro)} />
                            <MiniStat label="Total em estoque" value={`${estAtual} un`} />
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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-3">
      <div className="muted text-xs">{label}</div>
      <div className="font-black mt-1">{value}</div>
    </div>
  );
}
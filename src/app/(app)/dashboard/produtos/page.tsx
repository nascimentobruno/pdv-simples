"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  pct,
} from "@/lib/store";

type ImportRow = {
  produtoNome: string;
  skuProduto?: string;
  tamanho?: string;
  cor?: string;
  estoque: number;
  custo: number;
  precoVenda: number;
  ativo?: number; // 1/0 (aplica no Produto)
  obs?: string;
};

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

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [importStatus, setImportStatus] = useState<string>("");

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

  function updateVariacao(
    variacaoId: string,
    patch: Partial<Pick<Variacao, "precoVenda" | "custoMedio" | "custoTravado">>
  ) {
    const next = variacoes.map((v) => (v.id === variacaoId ? { ...v, ...patch } : v));
    persist({ variacoes: next });
  }

  function updateEstoque(
    variacaoId: string,
    patch: Partial<Pick<Estoque, "quantidadeAtual" | "estoqueMinimo">>
  ) {
    const next = estoque.map((e) =>
      e.variacaoId === variacaoId ? { ...e, ...patch, updatedAt: new Date().toISOString() } : e
    );
    persist({ estoque: next });
  }

  /** =========================
   *  IMPORT/EXPORT (1 aba)
   *  ========================= */

  async function downloadModeloXlsx() {
    const XLSX = await import("xlsx");

    const aoa: (string | number)[][] = [];
    aoa.push([
      "produtoNome*",
      "skuProduto",
      "tamanho",
      "cor",
      "estoque*",
      "custo*",
      "precoVenda*",
      "ativo(1/0)",
      "obs",
    ]);
    aoa.push(["Camiseta Basic", "SKU-BASIC", "P", "Preto", 10, 35.0, 79.9, 1, "Exemplo"]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Importar");

    XLSX.writeFile(wb, "modelo_importacao_simples_pdv.xlsx");
  }

  async function exportarXlsx() {
    const XLSX = await import("xlsx");

    const rows = variacoes
      .map((v) => {
        const p = produtos.find((pp) => pp.id === v.produtoId);
        if (!p) return null;

        const e = estoqueDaVariacao(v.id);
        return {
          "produtoNome*": p.nome,
          skuProduto: "",
          tamanho: v.tamanho || "",
          cor: v.cor || "",
          "estoque*": e?.quantidadeAtual ?? 0,
          "custo*": v.custoMedio ?? 0,
          "precoVenda*": v.precoVenda ?? 0,
          "ativo(1/0)": p.ativo === false ? 0 : 1,
          obs: "",
        };
      })
      .filter((x): x is Record<string, any> => !!x);

    const ws = XLSX.utils.json_to_sheet(rows, { skipHeader: false });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Importar");

    XLSX.writeFile(wb, `produtos_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function normalizeKey(s: string) {
    return (s || "").toString().trim().toLowerCase();
  }

  function parseNumCell(v: any): number {
    const raw = (v ?? "").toString().replace("R$", "").trim();
    return num(raw);
  }

  function parseIntCell(v: any): number {
    return Math.max(0, int((v ?? "").toString()));
  }

  async function importarArquivo(file: File) {
    setImportStatus("");

    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });

      const sheetName = wb.SheetNames.includes("Importar") ? "Importar" : wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      if (!ws) {
        alert("Planilha inválida (sem abas).");
        return;
      }

      const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });

      if (!json.length) {
        alert("Planilha vazia.");
        return;
      }

      const rows: ImportRow[] = [];
      for (const r of json) {
        const produtoNome =
          r["produtoNome*"] ?? r["produtoNome"] ?? r["produto"] ?? r["nome"] ?? "";
        const tamanho = r["tamanho"] ?? "";
        const cor = r["cor"] ?? "";
        const estoqueVal = r["estoque*"] ?? r["estoque"] ?? r["quantidade"] ?? 0;
        const custoVal = r["custo*"] ?? r["custo"] ?? r["custoMedio"] ?? 0;
        const precoVal = r["precoVenda*"] ?? r["precoVenda"] ?? r["preco"] ?? 0;
        const ativoVal = r["ativo(1/0)"] ?? r["ativo"] ?? "";

        const produtoNomeStr = (produtoNome ?? "").toString().trim();
        if (!produtoNomeStr) continue;

        const estoqueNum = parseIntCell(estoqueVal);
        const custoNum = parseNumCell(custoVal);
        const precoNum = parseNumCell(precoVal);

        if (Number.isNaN(estoqueNum) || Number.isNaN(custoNum) || Number.isNaN(precoNum)) continue;
        if (precoNum <= 0) continue;

        rows.push({
          produtoNome: produtoNomeStr,
          skuProduto: (r["skuProduto"] ?? "").toString().trim(),
          tamanho: (tamanho ?? "").toString().trim(),
          cor: (cor ?? "").toString().trim(),
          estoque: estoqueNum,
          custo: custoNum,
          precoVenda: precoNum,
          ativo: ativoVal === "" ? undefined : parseIntCell(ativoVal),
          obs: (r["obs"] ?? "").toString().trim(),
        });
      }

      if (!rows.length) {
        alert("Não encontrei linhas válidas. Confira os campos obrigatórios.");
        return;
      }

      let nextProdutos = [...produtos];
      let nextVariacoes = [...variacoes];
      let nextEstoque = [...estoque];

      let createdProducts = 0;
      let updatedProducts = 0;
      let createdVars = 0;
      let updatedVars = 0;

      const prodByName = new Map<string, Produto>();
      for (const p of nextProdutos) prodByName.set(normalizeKey(p.nome), p);

      const varKey = (produtoId: string, tamanho?: string, cor?: string) =>
        `${produtoId}__${normalizeKey(tamanho || "")}__${normalizeKey(cor || "")}`;

      const varByKey = new Map<string, Variacao>();
      for (const v of nextVariacoes) {
        varByKey.set(varKey(v.produtoId, v.tamanho, v.cor), v);
      }

      const estByVarId = new Map<string, Estoque>();
      for (const e of nextEstoque) estByVarId.set(e.variacaoId, e);

      const nowISO = new Date().toISOString();

      for (const r of rows) {
        const pKey = normalizeKey(r.produtoNome);
        let p = prodByName.get(pKey);

        if (!p) {
          p = {
            id: uid(),
            nome: r.produtoNome,
            categoriaId: undefined,
            ativo: r.ativo === undefined ? true : r.ativo !== 0,
            createdAt: nowISO,
          };
          nextProdutos = [p, ...nextProdutos];
          prodByName.set(pKey, p);
          createdProducts++;
        } else {
          if (r.ativo !== undefined) {
            const nextAtivo = r.ativo !== 0;
            if (p.ativo !== nextAtivo) {
              p = { ...p, ativo: nextAtivo };
              nextProdutos = nextProdutos.map((x) => (x.id === p!.id ? p! : x));
              prodByName.set(pKey, p);
              updatedProducts++;
            }
          }
        }

        const key = varKey(p.id, r.tamanho, r.cor);
        let v = varByKey.get(key);

        if (!v) {
          v = {
            id: uid(),
            produtoId: p.id,
            tamanho: r.tamanho?.trim() || "",
            cor: r.cor?.trim() || "",
            skuVariacao: undefined,
            precoVenda: r.precoVenda,
            custoMedio: r.custo,
            custoTravado: false,
            createdAt: nowISO,
          };
          nextVariacoes = [v, ...nextVariacoes];
          varByKey.set(key, v);
          createdVars++;
        } else {
          const nextV: Variacao = {
            ...v,
            precoVenda: r.precoVenda,
            custoMedio: r.custo,
            createdAt: v.createdAt,
          };
          nextVariacoes = nextVariacoes.map((x) => (x.id === v!.id ? nextV : x));
          v = nextV;
          varByKey.set(key, v);
          updatedVars++;
        }

        const eOld = estByVarId.get(v.id);
        if (!eOld) {
          const eNew: Estoque = {
            id: uid(),
            variacaoId: v.id,
            quantidadeAtual: Math.max(0, r.estoque),
            estoqueMinimo: 0,
            updatedAt: nowISO,
          };
          nextEstoque = [eNew, ...nextEstoque];
          estByVarId.set(v.id, eNew);
        } else {
          const eNew: Estoque = {
            ...eOld,
            quantidadeAtual: Math.max(0, r.estoque),
            updatedAt: nowISO,
          };
          nextEstoque = nextEstoque.map((x) => (x.variacaoId === v.id ? eNew : x));
          estByVarId.set(v.id, eNew);
        }
      }

      persist({ produtos: nextProdutos, variacoes: nextVariacoes, estoque: nextEstoque });

      setImportStatus(
        `Importação concluída: +${createdProducts} produtos, +${createdVars} variações | Atualizados: ${updatedProducts} produtos, ${updatedVars} variações`
      );
    } catch (e) {
      console.error(e);
      alert("Falha ao importar. Confira o arquivo e tente novamente.");
    }
  }

  return (
    <div className="container-app space-y-6">
      <div className="card">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">Produtos</h1>
            <p className="muted mt-1 text-sm">
              Modo profissional: variações por <b>tamanho</b> e <b>cor</b>, com estoque e custo por variação.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button className="btn" onClick={downloadModeloXlsx} title="Baixar modelo Excel (1 aba)">
              Baixar modelo (Excel)
            </button>

            <button className="btn" onClick={() => fileRef.current?.click()} title="Importar Excel no formato do modelo">
              Importar Excel
            </button>

            <button className="btn btn-primary" onClick={exportarXlsx} title="Exportar no mesmo formato do modelo">
              Exportar Excel
            </button>

            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) importarArquivo(f);
              }}
            />
          </div>
        </div>

        {importStatus ? (
          <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 text-sm text-zinc-200">
            {importStatus}
          </div>
        ) : null}

        <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/30 p-3">
          <p className="text-xs text-zinc-300 leading-relaxed">
            📌 Importação simples: <b>1 linha = 1 variação</b> com <b>estoque</b>, <b>custo</b> e <b>preço de venda</b>. O
            sistema cria/atualiza Produto pelo <b>nome</b> e cria/atualiza a variação por <b>produto + tamanho + cor</b>.
          </p>
        </div>
      </div>

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
            <span key={c.id} className="badge">
              {c.nome}
            </span>
          ))}
        </div>
      </div>

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
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
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
                  {p.nome}
                  {p.categoriaId ? ` • ${categoriasMap.get(p.categoriaId)?.nome ?? ""}` : ""}
                </option>
              ))}
            </select>

            <p className="muted text-sm">Dica: crie o produto e depois as variações (P/Preto, M/Preto...).</p>
          </div>
        </div>

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

                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    📦 Cada variação possui seu próprio <b>preço</b>, <b>custo</b> e <b>estoque</b>. Exemplo: P/Preto e
                    M/Preto são controladas separadamente.
                  </p>
                </div>

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

                      const lucro = (v.precoVenda || 0) - (v.custoMedio || 0);
                      const margem = (v.precoVenda || 0) > 0 ? (lucro / (v.precoVenda || 1)) * 100 : 0;

                      return (
                        <div
                          key={v.id}
                          className={`rounded-2xl border p-3 ${
                            abaixo ? "border-red-500/40 bg-red-500/5" : "border-zinc-800 bg-zinc-950/20"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium">
                                {produtoSelecionado.nome} • {v.tamanho} • {v.cor}
                              </p>
                              <p className="muted text-xs mt-1">
                                SKU: {v.skuVariacao || "-"} • {abaixo ? "⚠ Estoque baixo" : "OK"} • Custo{" "}
                                {v.custoTravado ? "travado" : "médio"}
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
                                  updateEstoque(v.id, {
                                    quantidadeAtual: Math.max(0, Math.trunc(num(ev.target.value))),
                                  })
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
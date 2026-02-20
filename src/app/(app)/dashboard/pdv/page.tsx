"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { requireAuthOrRedirect, logoutUser } from "@/lib/auth";
import { loadDB, saveDB, uid } from "@/lib/store";
import HelpButton from "@/components/HelpButton";

/** =========================
 *  Tipos (Produtos / Carrinho)
 *  ========================= */
type Product = {
  id: string; // aqui vamos usar variacaoId
  sku: string;
  name: string;
  price: number;
  produtoId?: string;
  variacaoId?: string;
};

type CartItem = {
  product: Product;
  qty: number;
};

/** =========================
 *  Tipos (Estoque)
 *  ========================= */
type EstoqueRow = {
  id?: string;
  variacaoId: string;
  quantidade: number;
};

/** =========================
 *  Tipos (Pagamentos)
 *  ========================= */
type PaymentMode = "CASH" | "PIX" | "DEBIT" | "CREDIT";

type InstallmentFee = { installments: number; feePct: number }; // % (0-100)

type PaymentFees = {
  cashPct: number;
  pixPct: number;
  debitPct: number;
  creditPct: number;
  creditInstallments: InstallmentFee[]; // 1..12
};

type CardMachine = {
  id: string;
  name: string;
  enabled: boolean;
  fees: PaymentFees;
};

type PaymentsConfig = {
  version: 1;
  machines: CardMachine[];
  updatedAtISO: string;
};

const LS_PAY_CFG_KEY = "pdv_payments_config_v1";

/** =========================
 *  Tipos (Venda)
 *  ========================= */
type SalePaymentLine = {
  id: string;
  mode: PaymentMode;
  amount: number; // valor BRUTO desta linha

  machineId?: string;
  machineName?: string;

  installments?: number; // crédito
  feePctApplied: number; // % aplicado
  feeValue: number; // R$ taxa desta linha
  netAmount: number; // líquido desta linha
};

type Sale = {
  id: string;
  createdAtISO: string;

  items: Array<{ sku: string; name: string; qty: number; price: number }>;
  subtotal: number;
  discountValue: number;
  total: number; // BRUTO da venda

  payments: SalePaymentLine[];
  feeTotal: number;
  netTotal: number;

  store?: string;
  operator?: string;
  note?: string;
};

const LS_SALES_KEY = "pdv_simples_sales_v3";

/** =========================
 *  Utils
 *  ========================= */
function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function clamp(n: number, min: number, max: number) {
  if (Number.isNaN(n)) return min;
  return Math.min(Math.max(n, min), max);
}
function toNum(v: string) {
  const n = Number((v ?? "").toString().replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** =========================
 *  Config padrão (pagamentos)
 *  ========================= */
function defaultPaymentsConfig(): PaymentsConfig {
  const mk = (id: string, name: string): CardMachine => ({
    id,
    name,
    enabled: id === "m1",
    fees: {
      cashPct: 0,
      pixPct: 0,
      debitPct: 1.89,
      creditPct: 3.49,
      creditInstallments: Array.from({ length: 12 }, (_, i) => ({
        installments: i + 1,
        feePct: i === 0 ? 3.49 : 3.49 + i * 0.75,
      })),
    },
  });

  return {
    version: 1,
    machines: [mk("m1", "Maquininha 1"), mk("m2", "Maquininha 2"), mk("m3", "Maquininha 3")],
    updatedAtISO: new Date().toISOString(),
  };
}

/** =========================
 *  Split (linhas de pagamento)
 *  ========================= */
type PaymentDraftLine = {
  id: string;
  mode: PaymentMode;
  amountStr: string; // input
  machineId: string; // usado para cartão
  installments: number; // crédito
};

function defaultPaymentLine(activeMachineId: string): PaymentDraftLine {
  return {
    id: uid(),
    mode: "PIX",
    amountStr: "",
    machineId: activeMachineId || "",
    installments: 1,
  };
}

export default function PDVPage() {
  /** =========================
   *  AUTH + contexto (LOJA/OPERADOR)
   *  ========================= */
  const [operator, setOperator] = useState<string>("—");
  const [store, setStore] = useState<string>("Loja Principal");

  useEffect(() => {
  const me = requireAuthOrRedirect("/login");
  if (!me) return;

  setOperator(me.nome || "");

  const db = loadDB() as any;
  const lojaNome =
    db?.config?.lojaNome ||
    db?.config?.loja ||
    db?.config?.nomeLoja ||
    "Loja Principal";

  setStore(lojaNome);
}, []);

  /** =========================
   *  ESTOQUE (AGORA VEM DO DB)
   *  ========================= */
  const [estoque, setEstoque] = useState<EstoqueRow[]>([]);

  function reloadEstoqueFromDB() {
    const db = loadDB() as any;
    const est = Array.isArray(db?.estoque) ? db.estoque : [];
    const out: EstoqueRow[] = est
      .map((e: any) => ({
        id: e.id,
        variacaoId: String(e.variacaoId ?? ""),
        quantidade: Number(e.quantidade ?? e.estoque ?? 0),
      }))
      .filter((e: EstoqueRow) => !!e.variacaoId);

    setEstoque(out);
  }

  /** helper: pega estoque por variacaoId */
  function getStock(variacaoId: string): number {
    return estoque.find((e) => e.variacaoId === variacaoId)?.quantidade ?? 0;
  }

  /** =========================
   *  PRODUTOS (AGORA VEM DO DB)
   *  ========================= */
  const [products, setProducts] = useState<Product[]>([]);

  function reloadProductsFromDB() {
    const db = loadDB() as any;

    const produtos = Array.isArray(db?.produtos) ? db.produtos : [];
    const variacoes = Array.isArray(db?.variacoes) ? db.variacoes : [];

    const mapProdutoNome = new Map<string, string>();
    const mapProdutoSku = new Map<string, string>();
    const mapProdutoAtivo = new Map<string, boolean>();

    for (const p of produtos) {
      mapProdutoNome.set(p.id, p.nome ?? "Produto");
      mapProdutoSku.set(p.id, p.sku ?? "");
      mapProdutoAtivo.set(p.id, p.ativo !== false);
    }

    const out: Product[] = variacoes
      .filter((v: any) => {
        const ativoProduto = mapProdutoAtivo.get(v.produtoId);
        return ativoProduto !== false;
      })
      .map((v: any): Product => {
        const nomeProduto = mapProdutoNome.get(v.produtoId) ?? "Produto";
        const size = v.tamanho ? ` • ${v.tamanho}` : "";
        const cor = v.cor ? ` • ${v.cor}` : "";
        const name = `${nomeProduto}${size}${cor}`;

        const sku = (v.skuVariacao || mapProdutoSku.get(v.produtoId) || v.id || "").toString();

        return {
          id: v.id,
          variacaoId: v.id,
          produtoId: v.produtoId,
          sku,
          name,
          price: Number(v.precoVenda ?? 0),
        };
      })
      .filter((p: Product) => p.price > 0)
      .sort((a: Product, b: Product) => a.name.localeCompare(b.name));

    setProducts(out);
  }

  useEffect(() => {
    reloadProductsFromDB();
    reloadEstoqueFromDB();
  }, []);

  /** =========================
   *  State (Venda)
   *  ========================= */
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);

  const [discountType, setDiscountType] = useState<"VALOR" | "PERCENT">("VALOR");
  const [discountInput, setDiscountInput] = useState<string>("0");
  const [note, setNote] = useState<string>("");

  const [sales, setSales] = useState<Sale[]>([]);
  const [payCfg, setPayCfg] = useState<PaymentsConfig>(defaultPaymentsConfig());

  const searchRef = useRef<HTMLInputElement | null>(null);

  // flash
  const [flashState, setFlashState] = useState<string>("");
  function showFlash(msg: string) {
    setFlashState(msg);
    window.setTimeout(() => setFlashState(""), 2600);
  }

  /** carregar config pagamentos */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_PAY_CFG_KEY);
      if (!raw) {
        const d = defaultPaymentsConfig();
        localStorage.setItem(LS_PAY_CFG_KEY, JSON.stringify(d));
        setPayCfg(d);
        return;
      }
      const parsed = JSON.parse(raw) as PaymentsConfig;
      if (parsed?.version === 1 && Array.isArray(parsed.machines)) {
        setPayCfg(parsed);
      } else {
        const d = defaultPaymentsConfig();
        localStorage.setItem(LS_PAY_CFG_KEY, JSON.stringify(d));
        setPayCfg(d);
      }
    } catch {
      const d = defaultPaymentsConfig();
      localStorage.setItem(LS_PAY_CFG_KEY, JSON.stringify(d));
      setPayCfg(d);
    }
  }, []);

  /** carregar histórico */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_SALES_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Sale[];
      if (Array.isArray(parsed)) setSales(parsed);
    } catch {
      // ignore
    }
  }, []);

  /** atalhos: "/" busca; F2 finaliza */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "F2") {
        e.preventDefault();
        handleFinalize();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, discountType, discountInput, note, sales, estoque]);

  /** produtos filtrados */
  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    );
  }, [query, products]);

  /** totais */
  const subtotal = useMemo(
    () => cart.reduce((acc, it) => acc + it.product.price * it.qty, 0),
    [cart]
  );

  const discountValue = useMemo(() => {
    const raw = toNum(discountInput);
    if (!raw || raw < 0) return 0;

    if (discountType === "VALOR") return Math.min(raw, subtotal);

    const pct = Math.min(raw, 100);
    return Math.min((pct / 100) * subtotal, subtotal);
  }, [discountInput, discountType, subtotal]);

  const total = useMemo(() => round2(Math.max(subtotal - discountValue, 0)), [subtotal, discountValue]);

  /** maquininhas ativas */
  const activeMachines = useMemo(() => payCfg.machines.filter((m) => m.enabled), [payCfg.machines]);
  const defaultActiveMachineId = useMemo(() => activeMachines[0]?.id || "", [activeMachines]);

  /** =========================
   *  Split payments state
   *  ========================= */
  const [paymentsDraft, setPaymentsDraft] = useState<PaymentDraftLine[]>(() => [
    defaultPaymentLine(""),
  ]);

  // quando carregar config, garantir machineId default nas linhas de cartão
  useEffect(() => {
    setPaymentsDraft((prev) => {
      const copy = prev.map((l) => {
        const isCard = l.mode === "DEBIT" || l.mode === "CREDIT";
        if (!isCard) return l;

        const stillActive = activeMachines.some((m) => m.id === l.machineId);
        const nextMachineId = stillActive ? l.machineId : defaultActiveMachineId;
        return { ...l, machineId: nextMachineId };
      });

      return copy.length ? copy : [defaultPaymentLine(defaultActiveMachineId)];
    });
  }, [activeMachines, defaultActiveMachineId]);

  /** =========================
   *  Cálculo por linha: fee% e net
   *  ========================= */
  function getFeePctForLine(line: PaymentDraftLine): number {
    if (line.mode === "CASH") {
      const ref = activeMachines[0];
      return ref ? clamp(ref.fees.cashPct, 0, 100) : 0;
    }
    if (line.mode === "PIX") {
      const ref = activeMachines[0];
      return ref ? clamp(ref.fees.pixPct, 0, 100) : 0;
    }

    const m = activeMachines.find((x) => x.id === line.machineId);
    if (!m) return 0;

    if (line.mode === "DEBIT") return clamp(m.fees.debitPct, 0, 100);

    const inst = clamp(line.installments, 1, 12);
    const feeByInst = (m.fees.creditInstallments || []).find((x) => x.installments === inst)?.feePct;
    return clamp(feeByInst ?? m.fees.creditPct, 0, 100);
  }

  const paymentsComputed = useMemo(() => {
    const computed = paymentsDraft.map((l) => {
      const amount = round2(toNum(l.amountStr));
      const feePct = getFeePctForLine(l);
      const feeValue = round2((feePct / 100) * amount);
      const netAmount = round2(Math.max(amount - feeValue, 0));

      const machine =
        l.mode === "DEBIT" || l.mode === "CREDIT"
          ? activeMachines.find((m) => m.id === l.machineId)
          : undefined;

      return {
        draft: l,
        amount,
        feePct,
        feeValue,
        netAmount,
        machineName: machine?.name || "",
      };
    });

    const paidTotal = round2(computed.reduce((a, x) => a + x.amount, 0));
    const feeTotal = round2(computed.reduce((a, x) => a + x.feeValue, 0));
    const netTotal = round2(computed.reduce((a, x) => a + x.netAmount, 0));
    const remaining = round2(total - paidTotal);

    return { computed, paidTotal, feeTotal, netTotal, remaining };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentsDraft, total, activeMachines]);

  /** preencher automaticamente o "restante" na última linha */
  function fillRemainingToLastLine() {
    setPaymentsDraft((prev) => {
      if (!prev.length) return prev;
      const current = prev.map((x) => ({ ...x }));
      const amounts = current.map((l) => round2(toNum(l.amountStr)));
      const paid = round2(amounts.reduce((a, n) => a + n, 0));
      const remaining = round2(total - paid);

      const lastIdx = current.length - 1;
      const lastAmount = round2(toNum(current[lastIdx].amountStr));
      const nextLast = round2(Math.max(lastAmount + remaining, 0));

      current[lastIdx].amountStr = String(nextLast).replace(".", ",");
      return current;
    });
  }

  /** =========================
   *  Carrinho (com trava de estoque)
   *  ========================= */
  function addToCart(p: Product) {
    const variacaoId = p.variacaoId || p.id;
    const estoqueAtual = getStock(variacaoId);

    // 🔒 estoque 0 = não adiciona
    if (estoqueAtual === 0) {
      showFlash("Sem estoque para este item.");
      return;
    }

    setCart((prev) => {
      const idx = prev.findIndex((x) => x.product.id === p.id);
      if (idx >= 0) {
        // 🚫 não deixa passar do estoque
        if (prev[idx].qty + 1 > estoqueAtual) {
          showFlash("Quantidade máxima em estoque atingida.");
          return prev;
        }
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        return copy;
      }
      return [...prev, { product: p, qty: 1 }];
    });
  }

  function setQty(productId: string, qty: number) {
    setCart((prev) => {
      const target = prev.find((x) => x.product.id === productId);
      if (!target) return prev;

      const variacaoId = target.product.variacaoId || target.product.id;
      const estoqueAtual = getStock(variacaoId);

      // clamp entre 0 e estoqueAtual
      const q = clamp(Math.floor(qty), 0, Math.max(estoqueAtual, 0));

      const copy = prev.map((it) => (it.product.id === productId ? { ...it, qty: q } : it));
      return copy.filter((it) => it.qty > 0);
    });
  }

  function removeItem(productId: string) {
    setCart((prev) => prev.filter((it) => it.product.id !== productId));
  }

  function clearSale() {
    setCart([]);
    setDiscountInput("0");
    setDiscountType("VALOR");
    setNote("");
    setQuery("");

    setPaymentsDraft([defaultPaymentLine(defaultActiveMachineId)]);
  }

  function persistSales(next: Sale[]) {
    setSales(next);
    try {
      localStorage.setItem(LS_SALES_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  function handleAddFirstMatch() {
    const first = filteredProducts[0];
    if (!first) return;
    addToCart(first); // já respeita estoque
  }

  /** =========================
   *  Finalizar (com baixa de estoque)
   *  ========================= */
  function validateStock(): { ok: boolean; msg?: string } {
    for (const it of cart) {
      const variacaoId = it.product.variacaoId || it.product.id;
      const est = getStock(variacaoId);
      if (est === 0) return { ok: false, msg: `Sem estoque: ${it.product.name}` };
      if (it.qty > est) return { ok: false, msg: `Estoque insuficiente: ${it.product.name} (disp: ${est})` };
    }
    return { ok: true };
  }

  function validateSplit(): { ok: boolean; msg?: string } {
    if (cart.length === 0) return { ok: false, msg: "Carrinho vazio. Adicione itens antes de finalizar." };

    const st = validateStock();
    if (!st.ok) return st;

    const nonEmpty = paymentsComputed.computed.filter((x) => x.amount > 0);

    if (nonEmpty.length === 0) return { ok: false, msg: "Informe pelo menos 1 forma de pagamento com valor." };

    if (nonEmpty.length > 3) return { ok: false, msg: "Máximo de 3 pagamentos por venda." };

    for (const x of nonEmpty) {
      const m = x.draft.mode;
      if (m === "DEBIT" || m === "CREDIT") {
        if (activeMachines.length === 0) return { ok: false, msg: "Nenhuma maquininha ativa. Vá em Configurações > Pagamentos." };
        if (!x.draft.machineId) return { ok: false, msg: "Selecione uma maquininha nas linhas de cartão." };
        if (!activeMachines.some((mm) => mm.id === x.draft.machineId)) return { ok: false, msg: "Maquininha selecionada não está ativa." };
      }
      if (m === "CREDIT") {
        const inst = clamp(x.draft.installments, 1, 12);
        if (!inst) return { ok: false, msg: "Parcelas inválidas no crédito." };
      }
    }

    const diff = round2(total - paymentsComputed.paidTotal);
    if (Math.abs(diff) > 0.01) {
      return { ok: false, msg: `Pagamentos não fecham o total. Falta/Sobra: ${brl(diff)}` };
    }

    return { ok: true };
  }

  function applyStockDeductionOrFail(): { ok: boolean; msg?: string; nextEstoque?: EstoqueRow[] } {
    const next = estoque.map((e) => ({ ...e }));

    for (const it of cart) {
      const variacaoId = it.product.variacaoId || it.product.id;
      const row = next.find((e) => e.variacaoId === variacaoId);

      const atual = row?.quantidade ?? 0;
      if (atual < it.qty) {
        return { ok: false, msg: `Estoque insuficiente: ${it.product.name} (disp: ${atual})` };
      }

      if (row) row.quantidade = atual - it.qty;
      // se não tem row de estoque, consideramos 0 (já teria falhado na validação)
    }

    return { ok: true, nextEstoque: next };
  }

  function handleFinalize() {
    const v = validateSplit();
    if (!v.ok) {
      showFlash(v.msg || "Erro ao finalizar.");
      return;
    }

    // ✅ baixa estoque
    const d = applyStockDeductionOrFail();
    if (!d.ok || !d.nextEstoque) {
      showFlash(d.msg || "Erro ao baixar estoque.");
      return;
    }

    // persiste estoque no DB
    try {
      const db = loadDB() as any;
      const nextDB = { ...(db || {}) };
      nextDB.estoque = d.nextEstoque;
      saveDB(nextDB);
      setEstoque(d.nextEstoque);
    } catch {
      showFlash("Falha ao salvar estoque no banco.");
      return;
    }

    const lines = paymentsComputed.computed
      .filter((x) => x.amount > 0)
      .map((x): SalePaymentLine => {
        const isCard = x.draft.mode === "DEBIT" || x.draft.mode === "CREDIT";
        const machine = isCard ? activeMachines.find((m) => m.id === x.draft.machineId) : undefined;

        return {
          id: x.draft.id,
          mode: x.draft.mode,
          amount: x.amount,
          machineId: machine?.id,
          machineName: machine?.name,
          installments: x.draft.mode === "CREDIT" ? clamp(x.draft.installments, 1, 12) : undefined,
          feePctApplied: x.feePct,
          feeValue: x.feeValue,
          netAmount: x.netAmount,
        };
      });

    const feeTotal = round2(lines.reduce((a, p) => a + p.feeValue, 0));
    const netTotal = round2(lines.reduce((a, p) => a + p.netAmount, 0));

    const sale: Sale = {
      id: uid(),
      createdAtISO: new Date().toISOString(),
      items: cart.map((it) => ({
        sku: it.product.sku,
        name: it.product.name,
        qty: it.qty,
        price: it.product.price,
      })),
      subtotal,
      discountValue,
      total,
      payments: lines,
      feeTotal,
      netTotal,
      store,
      operator,
      note: note.trim() || undefined,
    };

    const next = [sale, ...sales].slice(0, 50);
    persistSales(next);

    showFlash(`Venda finalizada • Líquido: ${brl(netTotal)} • Taxa: ${brl(feeTotal)}`);
    clearSale();
  }

  function handleDeleteSale(id: string) {
    const next = sales.filter((s) => s.id !== id);
    persistSales(next);
  }

  /** =========================
   *  Helpers UI split
   *  ========================= */
  function addPaymentLine() {
    setPaymentsDraft((prev) => {
      if (prev.length >= 3) return prev;
      return [...prev, defaultPaymentLine(defaultActiveMachineId)];
    });
  }

  function removePaymentLine(id: string) {
    setPaymentsDraft((prev) => {
      const next = prev.filter((l) => l.id !== id);
      return next.length ? next : [defaultPaymentLine(defaultActiveMachineId)];
    });
  }

  function setLine<K extends keyof PaymentDraftLine>(id: string, key: K, value: PaymentDraftLine[K]) {
    setPaymentsDraft((prev) => prev.map((l) => (l.id === id ? { ...l, [key]: value } : l)));
  }

  function modeLabel(m: PaymentMode) {
    switch (m) {
      case "PIX":
        return "PIX";
      case "CASH":
        return "Dinheiro";
      case "DEBIT":
        return "Cartão • Débito";
      case "CREDIT":
        return "Cartão • Crédito";
    }
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">PDV</h1>
            <p className="text-sm text-zinc-400">
              Venda rápida • Atalhos: <span className="font-semibold text-zinc-200">/</span> buscar •{" "}
              <span className="font-semibold text-zinc-200">F2</span> finalizar •{" "}
              <span className="font-semibold text-zinc-200">Enter</span> adiciona 1º resultado
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Split: até 3 pagamentos • Taxa por forma/maquininha/parcelas • Saldo líquido correto.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => {
                  reloadProductsFromDB();
                  reloadEstoqueFromDB();
                  showFlash("Produtos e estoque recarregados do banco.");
                }}
                className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-semibold hover:bg-zinc-900"
              >
                Recarregar produtos/estoque
              </button>

              <button
                onClick={() => {
                  logoutUser();
                  window.location.href = "/login";
                }}
                className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-semibold hover:bg-zinc-900"
              >
                Sair
              </button>
            </div>
          </div>

          <div className="grid w-full grid-cols-1 gap-2 md:w-auto md:grid-cols-3">
            <Field label="Loja">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200">
                {store}
              </div>
            </Field>

            <Field label="Operador">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200">
                {operator}
              </div>
            </Field>

            <Field label="Agora">
              <NowClient />
            </Field>
          </div>
        </div>

        {/* Busca */}
        <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-semibold text-zinc-400">Buscar produto (nome/SKU)</label>
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddFirstMatch();
                }
              }}
              placeholder='Digite e pressione "Enter"'
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-zinc-600"
            />
          </div>

          <button
            onClick={handleAddFirstMatch}
            className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm font-semibold hover:bg-zinc-900"
            title="Adicionar 1º resultado (Enter)"
          >
            Adicionar 1º
          </button>

          <button
            onClick={clearSale}
            className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm font-semibold hover:bg-zinc-900"
          >
            Limpar venda
          </button>
        </div>

        {flashState ? (
          <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200">
            {flashState}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Produtos */}
        <div className="lg:col-span-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Produtos</h2>
              <span className="text-xs text-zinc-400">{filteredProducts.length} itens</span>
            </div>

            {products.length === 0 ? (
              <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
                Nenhum produto/variação encontrado no banco. Vá em <b>Produtos</b> e <b>Variações</b> e cadastre.
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                {filteredProducts.map((p) => {
                  const variacaoId = p.variacaoId || p.id;
                  const est = getStock(variacaoId);

                  const tag =
                    est === 0 ? (
                      <span className="absolute right-3 top-3 rounded-full bg-red-600 px-2 py-[2px] text-[10px] font-bold text-white">
                        Esgotado
                      </span>
                    ) : est <= 3 ? (
                      <span className="absolute right-3 top-3 rounded-full bg-yellow-500 px-2 py-[2px] text-[10px] font-bold text-black">
                        Últimas
                      </span>
                    ) : null;

                  return (
                    <button
                      key={p.id}
                      onClick={() => addToCart(p)}
                      disabled={est === 0}
                      className={`group relative rounded-2xl border p-3 text-left ${
                        est === 0
                          ? "border-zinc-800 bg-zinc-950 opacity-60 cursor-not-allowed"
                          : "border-zinc-800 bg-zinc-950 hover:bg-zinc-900"
                      }`}
                      title={est === 0 ? "Sem estoque" : "Clique para adicionar"}
                    >
                      {tag}

                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">{p.name}</div>
                          <div className="mt-1 text-xs text-zinc-400">{p.sku}</div>
                        </div>
                        <div className="text-sm font-bold">{brl(p.price)}</div>
                      </div>

                      <div className="mt-2 flex items-center justify-between">
                        <div className="text-xs text-zinc-400 group-hover:text-zinc-300">
                          {est === 0 ? "Sem estoque" : "Clique para adicionar"}
                        </div>
                        <div className="text-[10px] text-zinc-500">Estoque: {est}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Carrinho / Checkout */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <h2 className="text-lg font-bold">Carrinho</h2>

            <div className="mt-3 space-y-2">
              {cart.length === 0 ? (
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
                  Carrinho vazio. Busque um produto e adicione.
                </div>
              ) : (
                cart.map((it) => {
                  const variacaoId = it.product.variacaoId || it.product.id;
                  const est = getStock(variacaoId);

                  return (
                    <div key={it.product.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">{it.product.name}</div>
                          <div className="mt-1 text-xs text-zinc-400">{it.product.sku}</div>
                          <div className="mt-1 text-[10px] text-zinc-500">Estoque: {est}</div>
                        </div>
                        <div className="text-sm font-bold">{brl(it.product.price)}</div>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setQty(it.product.id, it.qty - 1)}
                            className="h-9 w-9 rounded-xl border border-zinc-800 bg-zinc-900 font-bold hover:bg-zinc-800"
                          >
                            -
                          </button>
                          <input
                            value={it.qty}
                            onChange={(e) => setQty(it.product.id, Number(e.target.value))}
                            className="h-9 w-16 rounded-xl border border-zinc-800 bg-zinc-900 px-2 text-center text-sm outline-none focus:border-zinc-600"
                            inputMode="numeric"
                          />
                          <button
                            onClick={() => setQty(it.product.id, it.qty + 1)}
                            className="h-9 w-9 rounded-xl border border-zinc-800 bg-zinc-900 font-bold hover:bg-zinc-800"
                            title={est > 0 && it.qty >= est ? "Atingiu o limite do estoque" : "Adicionar +1"}
                          >
                            +
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold">{brl(it.product.price * it.qty)}</div>
                          <button
                            onClick={() => removeItem(it.product.id)}
                            className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desconto */}
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Desconto">
                <div className="flex gap-2">
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as any)}
                    className="h-10 w-24 rounded-xl border border-zinc-800 bg-zinc-950 px-2 text-sm outline-none focus:border-zinc-600"
                  >
                    <option value="VALOR">R$</option>
                    <option value="PERCENT">%</option>
                  </select>
                  <input
                    value={discountInput}
                    onChange={(e) => setDiscountInput(e.target.value)}
                    className="h-10 flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm outline-none focus:border-zinc-600"
                    inputMode="decimal"
                    placeholder={discountType === "VALOR" ? "0,00" : "0"}
                  />
                </div>
              </Field>

              <Field label="Ações rápidas">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setPaymentsDraft((prev) => {
                        const first = prev[0] || defaultPaymentLine(defaultActiveMachineId);
                        const nextFirst = { ...first, amountStr: String(total).replace(".", ",") };
                        return [nextFirst];
                      });
                      showFlash("Total aplicado na 1ª forma.");
                    }}
                    className="h-10 flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm font-semibold hover:bg-zinc-900"
                  >
                    100% na 1ª
                  </button>

                  <button
                    onClick={() => {
                      fillRemainingToLastLine();
                      showFlash("Restante preenchido na última linha.");
                    }}
                    className="h-10 flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm font-semibold hover:bg-zinc-900"
                    title="Completa a soma com o valor que falta"
                  >
                    Completar
                  </button>
                </div>
              </Field>
            </div>

            {/* Split pagamentos */}
            <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold">Pagamentos (até 3)</h3>
                  <p className="text-xs text-zinc-500">
                    Total a pagar: <span className="text-zinc-200 font-semibold">{brl(total)}</span>
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={addPaymentLine}
                    disabled={paymentsDraft.length >= 3}
                    className={`rounded-xl border px-3 py-2 text-xs font-bold ${
                      paymentsDraft.length >= 3
                        ? "border-zinc-800 bg-zinc-900 text-zinc-500"
                        : "border-zinc-800 bg-zinc-900 hover:bg-zinc-800"
                    }`}
                  >
                    + Adicionar
                  </button>
                </div>
              </div>

              <div className="mt-3 space-y-3">
                {paymentsDraft.map((l, idx) => {
                  const computed = paymentsComputed.computed.find((x) => x.draft.id === l.id);
                  const isCard = l.mode === "DEBIT" || l.mode === "CREDIT";

                  return (
                    <div key={l.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-bold text-zinc-400">Pagamento {idx + 1}</div>
                        <button
                          onClick={() => removePaymentLine(l.id)}
                          className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
                          title="Remover linha"
                        >
                          Remover
                        </button>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div>
                          <label className="block text-xs font-semibold text-zinc-400">Forma</label>
                          <select
                            value={l.mode}
                            onChange={(e) => {
                              const mode = e.target.value as PaymentMode;
                              setLine(l.id, "mode", mode);

                              if (mode === "DEBIT" || mode === "CREDIT") {
                                setLine(l.id, "machineId", defaultActiveMachineId);
                              }
                              if (mode === "CREDIT") {
                                setLine(l.id, "installments", clamp(l.installments || 1, 1, 12));
                              }
                            }}
                            className="mt-1 h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm outline-none focus:border-zinc-600"
                          >
                            <option value="PIX">PIX</option>
                            <option value="CASH">Dinheiro</option>
                            <option value="DEBIT">Cartão • Débito</option>
                            <option value="CREDIT">Cartão • Crédito</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-zinc-400">Valor</label>
                          <input
                            value={l.amountStr}
                            onChange={(e) => setLine(l.id, "amountStr", e.target.value)}
                            className="mt-1 h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm outline-none focus:border-zinc-600"
                            inputMode="decimal"
                            placeholder="0,00"
                          />
                        </div>

                        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                          <div className="flex items-center justify-between text-xs text-zinc-400">
                            <span>Taxa</span>
                            <span className="font-semibold text-zinc-200">
                              {(computed?.feePct ?? 0).toFixed(2).replace(".", ",")}%
                            </span>
                          </div>
                          <div className="mt-2 flex items-center justify-between text-xs text-zinc-400">
                            <span>Taxa (R$)</span>
                            <span className="font-semibold text-zinc-200">{brl(computed?.feeValue ?? 0)}</span>
                          </div>
                          <div className="mt-2 flex items-center justify-between text-xs text-zinc-400">
                            <span>Líquido</span>
                            <span className="font-semibold text-zinc-200">{brl(computed?.netAmount ?? 0)}</span>
                          </div>
                        </div>
                      </div>

                      {isCard ? (
                        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                          <div>
                            <label className="block text-xs font-semibold text-zinc-400">Maquininha</label>
                            <select
                              value={l.machineId}
                              onChange={(e) => setLine(l.id, "machineId", e.target.value)}
                              className="mt-1 h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm outline-none focus:border-zinc-600"
                            >
                              {activeMachines.length === 0 ? (
                                <option value="">Nenhuma ativa (configure)</option>
                              ) : (
                                activeMachines.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.name}
                                  </option>
                                ))
                              )}
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-zinc-400">Parcelas</label>
                            <select
                              disabled={l.mode !== "CREDIT"}
                              value={l.installments}
                              onChange={(e) =>
                                setLine(l.id, "installments", clamp(Number(e.target.value), 1, 12))
                              }
                              className={`mt-1 h-10 w-full rounded-xl border px-3 text-sm outline-none focus:border-zinc-600 ${
                                l.mode !== "CREDIT"
                                  ? "border-zinc-800 bg-zinc-950 text-zinc-500"
                                  : "border-zinc-800 bg-zinc-950"
                              }`}
                            >
                              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                                <option key={n} value={n}>
                                  {n}x
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="md:col-span-2 text-xs text-zinc-500">
                            Forma:{" "}
                            <span className="text-zinc-200 font-semibold">{modeLabel(l.mode)}</span> •
                            Maquininha:{" "}
                            <span className="text-zinc-200 font-semibold">
                              {computed?.machineName || "—"}
                            </span>
                            {l.mode === "CREDIT" ? (
                              <>
                                {" "}
                                • Parcelas:{" "}
                                <span className="text-zinc-200 font-semibold">{l.installments}x</span>
                              </>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 text-xs text-zinc-500">
                          Forma: <span className="text-zinc-200 font-semibold">{modeLabel(l.mode)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Resumo split */}
              <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400">Total (bruto)</span>
                  <span className="font-semibold">{brl(total)}</span>
                </div>

                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-zinc-400">Pago (bruto)</span>
                  <span className="font-semibold">{brl(paymentsComputed.paidTotal)}</span>
                </div>

                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-zinc-400">Falta / Sobra</span>
                  <span className="font-semibold">{brl(paymentsComputed.remaining)}</span>
                </div>

                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-zinc-400">Taxa total</span>
                  <span className="font-semibold">- {brl(paymentsComputed.feeTotal)}</span>
                </div>

                <div className="mt-2 flex items-center justify-between text-lg">
                  <span className="font-bold text-zinc-200">Líquido total</span>
                  <span className="font-bold text-zinc-200">{brl(paymentsComputed.netTotal)}</span>
                </div>

                <button
                  onClick={handleFinalize}
                  className="mt-4 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-bold hover:bg-zinc-800"
                  title="Finalizar (F2)"
                >
                  Finalizar venda (F2)
                </button>

                <div className="mt-3 text-xs text-zinc-500">
                  Configure taxas em{" "}
                  <span className="text-zinc-200 font-semibold">/dashboard/configuracoes/pagamentos</span>.
                </div>
              </div>
            </div>

            {/* Observação */}
            <Field label="Observação (opcional)">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm outline-none focus:border-zinc-600"
                placeholder="Ex: cliente retirou no balcão"
              />
            </Field>
          </div>

          {/* Histórico */}
          <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Últimas vendas</h2>
              <span className="text-xs text-zinc-400">{sales.length}</span>
            </div>

            <div className="mt-3 space-y-2">
              {sales.length === 0 ? (
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
                  Sem vendas registradas ainda.
                </div>
              ) : (
                sales.map((s) => (
                  <div key={s.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">
                          {new Date(s.createdAtISO).toLocaleString("pt-BR")}
                        </div>
                        <div className="mt-1 text-xs text-zinc-400">
                          {s.items.reduce((a, it) => a + it.qty, 0)} itens • Bruto {brl(s.total)} • Taxa{" "}
                          {brl(s.feeTotal)} •{" "}
                          <span className="text-zinc-200 font-semibold">Líquido {brl(s.netTotal)}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {s.payments.map((p) => (
                            <span
                              key={p.id}
                              className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300"
                              title={`Taxa: ${p.feePctApplied
                                .toFixed(2)
                                .replace(".", ",")}% • Líquido: ${brl(p.netAmount)}`}
                            >
                              {modeLabel(p.mode)}: {brl(p.amount)}
                              {p.mode === "DEBIT" || p.mode === "CREDIT" ? (
                                <>
                                  {" "}
                                  • {p.machineName || "Maquininha"}
                                  {p.mode === "CREDIT" ? ` • ${p.installments || 1}x` : ""}
                                </>
                              ) : null}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-sm font-bold">{brl(s.netTotal)}</div>
                    </div>

                    <div className="mt-3">
                      <button
                        onClick={() => handleDeleteSale(s.id)}
                        className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
                      >
                        Excluir do histórico
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {sales.length > 0 ? (
              <button
                onClick={() => persistSales([])}
                className="mt-3 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-900"
              >
                Limpar histórico
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-zinc-500">
        PDV Simples • {store} • {operator}
      </div>
      <HelpButton supportName="Bruno (RideCode)" supportEmail="bruno@ridecode.tech" />
    </div>
  );
}

/** Campo padrão */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <label className="mb-1 block text-xs font-semibold text-zinc-400">{label}</label>
      {children}
    </div>
  );
}

/** Agora (client-only) — evita Hydration mismatch */
function NowClient() {
  const [now, setNow] = useState<string>("");
  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleString("pt-BR"));
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200">
      {now || "—"}
    </div>
  );
}
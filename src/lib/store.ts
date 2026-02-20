// src/lib/store.ts
"use client";

/** =========================
 *  Tipos base
 *  ========================= */

export type Role = "ADMIN" | "GERENTE" | "CAIXA" | "ESTOQUISTA" | "FINANCEIRO";

export type Usuario = {
  id: string;
  nome: string;
  login: string;
  pin: string; // simples por enquanto (depois dá pra hash)
  role: Role;
  ativo: boolean;
  createdAt: string;
};

export type Categoria = {
  id: string;
  nome: string;
  ativo: boolean;
  createdAt: string;
};

export type Produto = {
  id: string;
  nome: string;
  ativo: boolean;
  categoriaId?: string; // ✅ usado na UI
  createdAt: string;
};

export type Variacao = {
  id: string;
  produtoId: string;
  tamanho: string;
  cor: string;
  skuVariacao?: string;

  precoVenda: number;
  custoMedio: number;

  custoTravado: boolean; // ✅ boolean (seu código usa checkbox)
  createdAt: string; // ✅ obrigatório (você ordena por isso)
};

export type Estoque = {
  id: string; // ✅ você cria id no produtos/page.tsx
  variacaoId: string;

  quantidadeAtual: number;
  estoqueMinimo: number;

  updatedAt: string; // ✅ você seta updatedAt na UI
};

/** =========================
 *  Compras (para tela /compras)
 *  ========================= */

export type CompraStatus = "ABERTA" | "FECHADA" | "CANCELADA";

export type ItemCompra = {
  id: string;
  variacaoId: string; // compra em cima da variação
  quantidade: number;
  custoUnit: number;
};

export type Compra = {
  id: string;
  status: CompraStatus;

  createdAt: string;
  updatedAt: string;

  fornecedor?: string;

  frete: number;
  outrasDespesas: number;

  itensCompra: ItemCompra[];

  totalProdutos: number;
  totalCompra: number;
};

/** =========================
 *  Vendas (para PDV)
 *  ========================= */

export type ItemVenda = {
  id: string;
  variacaoId: string;
  qty: number;
  precoUnit: number;
  subtotal: number;
};

export type Venda = {
  id: string;
  createdAt: string;

  itens: ItemVenda[];

  subtotal: number;
  desconto: number;
  total: number;

  pagamentoModo: "CASH" | "PIX" | "DEBIT" | "CREDIT";
  observacao?: string;
};

/** =========================
 *  DB (estrutura única)
 *  ========================= */

export type DB = {
  schemaVersion: number;

  usuarios: Usuario[];

  categorias: Categoria[];
  produtos: Produto[];
  variacoes: Variacao[];
  estoque: Estoque[];

  compras: Compra[];
  vendas: Venda[];

  settings: Record<string, any>;
};

export const SCHEMA_VERSION = 2;

export function makeDefaultDB(): DB {
  const now = new Date().toISOString();

  // Admin padrão (PIN 1234) — você pode trocar depois
  const admin: Usuario = {
    id: uid(),
    nome: "Admin",
    login: "admin",
    pin: "1234",
    role: "ADMIN",
    ativo: true,
    createdAt: now,
  };

  return {
    schemaVersion: SCHEMA_VERSION,

    usuarios: [admin],

    categorias: [],
    produtos: [],
    variacoes: [],
    estoque: [],

    compras: [],
    vendas: [],

    settings: {},
  };
}

/** =========================
 *  Persistência
 *  - Web: localStorage
 *  - Electron: window.PDV.readJson / writeJson
 *  ========================= */

const LS_KEY = "pdv-db-v1";

function isElectron(): boolean {
  return typeof window !== "undefined" && !!(window as any).PDV?.readJson;
}

async function electronReadDB(): Promise<DB | null> {
  try {
    const api = (window as any).PDV;
    const db = await api.readJson("settings"); // vamos guardar o DB em "settings" OU crie "db"
    // Se você quiser separar, podemos mudar para "db.json". Por agora usamos settings.
    if (!db || typeof db !== "object") return null;
    return db as DB;
  } catch {
    return null;
  }
}

async function electronWriteDB(db: DB): Promise<boolean> {
  try {
    const api = (window as any).PDV;
    const ok = await api.writeJson("settings", db);
    return !!ok;
  } catch {
    return false;
  }
}

export function loadDB(): DB {
  if (typeof window === "undefined") return makeDefaultDB();

  // Electron (sync wrapper): carrega do cache do localStorage se ainda não foi sincronizado
  // Pra manter sua app rodando sem virar tudo async, fazemos fallback no LS.
  const raw = window.localStorage.getItem(LS_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as DB;
      return migrateDB(parsed);
    } catch {
      // ignore
    }
  }
  const fresh = makeDefaultDB();
  window.localStorage.setItem(LS_KEY, JSON.stringify(fresh));
  return fresh;
}

export function saveDB(db: DB): void {
  if (typeof window === "undefined") return;
  const migrated = migrateDB(db);
  window.localStorage.setItem(LS_KEY, JSON.stringify(migrated));

  // se for Electron, tenta persistir também (best effort)
  if (isElectron()) {
    void electronWriteDB(migrated);
  }
}

/**
 * Sincroniza (opcional) no startup da aplicação Electron:
 * - chama isso uma vez no layout/app bootstrap
 */
export async function syncFromElectron(): Promise<DB> {
  const current = loadDB();
  if (!isElectron()) return current;

  const fromFile = await electronReadDB();
  if (!fromFile) {
    // se não existe ainda, cria no arquivo
    await electronWriteDB(current);
    return current;
  }

  const migrated = migrateDB(fromFile);
  window.localStorage.setItem(LS_KEY, JSON.stringify(migrated));
  return migrated;
}

/** =========================
 *  Migração (caso seu DB antigo tenha campos diferentes)
 *  ========================= */

export function migrateDB(input: any): DB {
  const base = makeDefaultDB();

  const db: DB = {
    ...base,
    ...input,
    schemaVersion: typeof input?.schemaVersion === "number" ? input.schemaVersion : 0,
    usuarios: Array.isArray(input?.usuarios) ? input.usuarios : base.usuarios,

    categorias: Array.isArray(input?.categorias) ? input.categorias : [],
    produtos: Array.isArray(input?.produtos) ? input.produtos : [],
    variacoes: Array.isArray(input?.variacoes) ? input.variacoes : [],
    estoque: Array.isArray(input?.estoque) ? input.estoque : [],

    compras: Array.isArray(input?.compras) ? input.compras : [],
    vendas: Array.isArray(input?.vendas) ? input.vendas : [],

    settings: typeof input?.settings === "object" && input.settings ? input.settings : {},
  };

  // Corrige Produto: se existir "categoria" antigo, converte para categoriaId
  db.produtos = db.produtos.map((p: any) => {
    if (p && typeof p === "object") {
      const categoriaId = p.categoriaId ?? p.categoria;
      const cleaned: Produto = {
        id: String(p.id ?? uid()),
        nome: String(p.nome ?? ""),
        ativo: p.ativo !== false,
        categoriaId: categoriaId ? String(categoriaId) : undefined,
        createdAt: String(p.createdAt ?? new Date().toISOString()),
      };
      return cleaned;
    }
    return p as Produto;
  });

  // Corrige Variacao: garante campos e boolean
  db.variacoes = db.variacoes.map((v: any) => {
    const cleaned: Variacao = {
      id: String(v.id ?? uid()),
      produtoId: String(v.produtoId ?? ""),
      tamanho: String(v.tamanho ?? ""),
      cor: String(v.cor ?? ""),
      skuVariacao: v.skuVariacao ? String(v.skuVariacao) : undefined,
      precoVenda: num(v.precoVenda),
      custoMedio: num(v.custoMedio),
      custoTravado: !!v.custoTravado,
      createdAt: String(v.createdAt ?? new Date().toISOString()),
    };
    return cleaned;
  });

  // Corrige Estoque: garante id + updatedAt
  db.estoque = db.estoque.map((e: any) => {
    const cleaned: Estoque = {
      id: String(e.id ?? uid()),
      variacaoId: String(e.variacaoId ?? ""),
      quantidadeAtual: Math.max(0, int(e.quantidadeAtual)),
      estoqueMinimo: Math.max(0, int(e.estoqueMinimo)),
      updatedAt: String(e.updatedAt ?? new Date().toISOString()),
    };
    return cleaned;
  });

  // Compras: normaliza
  db.compras = db.compras.map((c: any) => {
    const itens = Array.isArray(c?.itensCompra) ? c.itensCompra : [];
    const cleaned: Compra = {
      id: String(c.id ?? uid()),
      status: (c.status as CompraStatus) ?? "ABERTA",
      createdAt: String(c.createdAt ?? new Date().toISOString()),
      updatedAt: String(c.updatedAt ?? c.createdAt ?? new Date().toISOString()),
      fornecedor: c.fornecedor ? String(c.fornecedor) : undefined,
      frete: num(c.frete),
      outrasDespesas: num(c.outrasDespesas),
      itensCompra: itens.map((it: any) => ({
        id: String(it.id ?? uid()),
        variacaoId: String(it.variacaoId ?? ""),
        quantidade: Math.max(0, int(it.quantidade)),
        custoUnit: num(it.custoUnit),
      })),
      totalProdutos: num(c.totalProdutos),
      totalCompra: num(c.totalCompra),
    };
    return cleaned;
  });

  // Vendas: normaliza (pra futura baixa de estoque)
  db.vendas = db.vendas.map((v: any) => {
    const itens = Array.isArray(v?.itens) ? v.itens : [];
    const cleaned: Venda = {
      id: String(v.id ?? uid()),
      createdAt: String(v.createdAt ?? new Date().toISOString()),
      itens: itens.map((it: any) => ({
        id: String(it.id ?? uid()),
        variacaoId: String(it.variacaoId ?? ""),
        qty: Math.max(0, int(it.qty)),
        precoUnit: num(it.precoUnit),
        subtotal: num(it.subtotal),
      })),
      subtotal: num(v.subtotal),
      desconto: num(v.desconto),
      total: num(v.total),
      pagamentoModo: (v.pagamentoModo as Venda["pagamentoModo"]) ?? "CASH",
      observacao: v.observacao ? String(v.observacao) : undefined,
    };
    return cleaned;
  });

  // Categorias: garante formato
  db.categorias = db.categorias.map((c: any) => ({
    id: String(c.id ?? uid()),
    nome: String(c.nome ?? ""),
    ativo: c.ativo !== false,
    createdAt: String(c.createdAt ?? new Date().toISOString()),
  }));

  // Usuarios: garante formato
  db.usuarios = db.usuarios.map((u: any) => ({
    id: String(u.id ?? uid()),
    nome: String(u.nome ?? ""),
    login: String(u.login ?? ""),
    pin: String(u.pin ?? ""),
    role: (u.role as Role) ?? "CAIXA",
    ativo: u.ativo !== false,
    createdAt: String(u.createdAt ?? new Date().toISOString()),
  }));

  db.schemaVersion = SCHEMA_VERSION;

  return db;
}

/** =========================
 *  Helpers
 *  ========================= */

export function uid(): string {
  // simples e bom o bastante pro PDV local
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function num(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v).trim();
  if (!s) return 0;
  // troca vírgula por ponto e remove símbolos
  const cleaned = s.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function int(v: any): number {
  return Math.trunc(num(v));
}

export function fmtBRL(v: number): string {
  const n = Number.isFinite(v) ? v : 0;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function pct(v: number): string {
  const n = Number.isFinite(v) ? v : 0;
  return `${n.toFixed(1)}%`;
}

/** margem = lucro / venda * 100 */
export function margemPct(lucro: number, venda: number): number {
  const v = Number.isFinite(venda) ? venda : 0;
  if (v <= 0) return 0;
  return (num(lucro) / v) * 100;
}
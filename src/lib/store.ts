export type UUID = string;

export type Categoria = {
  id: UUID;
  nome: string;
  ativo: boolean;
  createdAt: string;
};

export type Produto = {
  id: UUID;
  nome: string;
  sku?: string;
  categoriaId?: UUID;
  ativo: boolean;
  createdAt: string;
};

export type Variacao = {
  id: UUID;
  produtoId: UUID;
  tamanho?: string;
  cor?: string;
  skuVariacao?: string;
  precoVenda: number;
  custoMedio: number;
  custoTravado: boolean;
  createdAt: string;
};

export type Estoque = {
  id: UUID;
  variacaoId: UUID;
  quantidadeAtual: number;
  estoqueMinimo: number;
  updatedAt: string;
};

export type CompraStatus = "RASCUNHO" | "CONFIRMADA" | "CANCELADA";

export type Compra = {
  id: UUID;
  dataHora: string;
  frete: number;
  outrasDespesas: number;
  totalProdutos: number;
  totalCompra: number;
  status: CompraStatus;
  createdAt: string;
};

export type ItemCompra = {
  id: UUID;
  compraId: UUID;
  variacaoId: UUID;
  qtd: number;
  custoUnit: number;
  subtotal: number;
  createdAt: string;
};

export type MovimentoEstoque = {
  id: UUID;
  variacaoId: UUID;
  tipo: "ENTRADA" | "SAIDA" | "AJUSTE";
  quantidade: number;
  motivo?: string; // COMPRA | VENDA | INVENTARIO...
  referenciaId?: UUID; // id compra/venda
  dataHora: string;
};

export type DB = {
  categorias: Categoria[];
  produtos: Produto[];
  variacoes: Variacao[];
  estoque: Estoque[];
  compras: Compra[];
  itensCompra: ItemCompra[];
  movimentos: MovimentoEstoque[];
};

const KEY = "pdv-simples-db:v2";

function nowISO() {
  return new Date().toISOString();
}

export function uid(): UUID {
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

function seed(): DB {
  return {
    categorias: [
      { id: uid(), nome: "Camisetas", ativo: true, createdAt: nowISO() },
      { id: uid(), nome: "Moletons", ativo: true, createdAt: nowISO() },
      { id: uid(), nome: "Acessórios", ativo: true, createdAt: nowISO() },
    ],
    produtos: [],
    variacoes: [],
    estoque: [],
    compras: [],
    itensCompra: [],
    movimentos: [],
  };
}

export function loadDB(): DB {
  if (typeof window === "undefined") return seed();

  const raw = localStorage.getItem(KEY);
  if (!raw) {
    const s = seed();
    localStorage.setItem(KEY, JSON.stringify(s));
    return s;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<DB>;

    // MIGRAÇÃO/SAFE DEFAULTS
    const db: DB = {
      categorias: parsed.categorias ?? [],
      produtos: parsed.produtos ?? [],
      variacoes: parsed.variacoes ?? [],
      estoque: parsed.estoque ?? [],
      compras: (parsed as any).compras ?? [],
      itensCompra: (parsed as any).itensCompra ?? [],
      movimentos: (parsed as any).movimentos ?? [],
    };

    // se vier vazio demais, dá um seed mínimo de categorias
    if (!db.categorias || db.categorias.length === 0) {
      db.categorias = seed().categorias;
    }

    // persistir versão saneada
    localStorage.setItem(KEY, JSON.stringify(db));
    return db;
  } catch {
    const s = seed();
    localStorage.setItem(KEY, JSON.stringify(s));
    return s;
  }
}

export function saveDB(db: DB) {
  localStorage.setItem(KEY, JSON.stringify(db));
}

export function fmtBRL(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
}

export function num(v: string) {
  const x = Number(String(v).replace(",", "."));
  return Number.isFinite(x) ? x : 0;
}

export function int(v: string) {
  const x = Math.trunc(num(v));
  return Number.isFinite(x) ? x : 0;
}

export function margemPct(preco: number, custo: number) {
  if (!preco) return 0;
  return ((preco - (custo || 0)) / preco) * 100;
}

export function pct(n: number) {
  return `${(n || 0).toFixed(1)}%`;
}
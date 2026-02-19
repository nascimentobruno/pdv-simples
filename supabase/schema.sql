-- PDV Simples (MVP) - Postgres/Supabase
-- Multi-tenant via loja_id

create extension if not exists pgcrypto;

-- Lojas
create table if not exists lojas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  created_at timestamptz not null default now()
);

-- Categorias
create table if not exists categorias (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references lojas(id) on delete cascade,
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (loja_id, nome)
);

-- Produtos
create table if not exists produtos (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references lojas(id) on delete cascade,
  categoria_id uuid references categorias(id) on delete set null,
  nome text not null,
  sku text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Variações (tamanho/cor)
create table if not exists variacoes (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references produtos(id) on delete cascade,
  tamanho text,
  cor text,
  sku_variacao text,
  preco_venda numeric(12,2) not null default 0,
  custo_medio numeric(12,2) not null default 0,
  custo_travado boolean not null default false,
  created_at timestamptz not null default now(),
  unique (produto_id, tamanho, cor)
);

-- Estoque (saldo atual)
create table if not exists estoque (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references lojas(id) on delete cascade,
  variacao_id uuid not null references variacoes(id) on delete cascade,
  quantidade_atual integer not null default 0,
  estoque_minimo integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (loja_id, variacao_id)
);

-- Fornecedores (opcional, mas útil)
create table if not exists fornecedores (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references lojas(id) on delete cascade,
  nome text not null,
  telefone text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (loja_id, nome)
);

-- Compras
create table if not exists compras (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references lojas(id) on delete cascade,
  fornecedor_id uuid references fornecedores(id) on delete set null,
  data_hora timestamptz not null default now(),
  frete numeric(12,2) not null default 0,
  outras_despesas numeric(12,2) not null default 0,
  total_produtos numeric(12,2) not null default 0,
  total_compra numeric(12,2) not null default 0,
  status text not null default 'RASCUNHO', -- RASCUNHO | CONFIRMADA | CANCELADA
  created_at timestamptz not null default now()
);

create table if not exists itens_compra (
  id uuid primary key default gen_random_uuid(),
  compra_id uuid not null references compras(id) on delete cascade,
  variacao_id uuid not null references variacoes(id) on delete restrict,
  qtd integer not null,
  custo_unit numeric(12,2) not null,
  subtotal numeric(12,2) not null,
  created_at timestamptz not null default now()
);

-- Vendas
create table if not exists vendas (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references lojas(id) on delete cascade,
  data_hora timestamptz not null default now(),
  total_bruto numeric(12,2) not null default 0,
  desconto numeric(12,2) not null default 0,
  total_liquido numeric(12,2) not null default 0,
  forma_pagamento text not null default 'PIX',
  status text not null default 'CONCLUIDA', -- CONCLUIDA | CANCELADA
  created_at timestamptz not null default now()
);

create table if not exists itens_venda (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null references vendas(id) on delete cascade,
  variacao_id uuid not null references variacoes(id) on delete restrict,
  qtd integer not null,
  preco_unit numeric(12,2) not null,
  custo_unit numeric(12,2) not null,
  total_item numeric(12,2) not null,
  lucro_item numeric(12,2) not null,
  created_at timestamptz not null default now()
);

-- Movimentos de estoque (auditoria)
create table if not exists movimentos_estoque (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references lojas(id) on delete cascade,
  variacao_id uuid not null references variacoes(id) on delete restrict,
  tipo text not null, -- ENTRADA | SAIDA | AJUSTE
  quantidade integer not null,
  motivo text, -- COMPRA | VENDA | TROCA | PERDA | INVENTARIO...
  referencia_id uuid, -- id da compra/venda (opcional)
  data_hora timestamptz not null default now()
);

-- Trigger pra manter updated_at do estoque
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_estoque_updated_at on estoque;
create trigger trg_estoque_updated_at
before update on estoque
for each row execute function set_updated_at();

-- Perfil do usuário (1 por auth.user)
create table if not exists perfis (
  user_id uuid primary key,
  nome text,
  created_at timestamptz not null default now()
);

-- Planos (você pode fixar via seed depois)
create table if not exists planos (
  id text primary key, -- 'FREE' | 'PRO' | 'SCALE'
  nome text not null,
  max_lojas int not null
);

-- Assinatura por usuário (simples no MVP)
create table if not exists assinaturas (
  user_id uuid primary key,
  plano_id text not null references planos(id),
  status text not null default 'ATIVA', -- ATIVA | CANCELADA | INADIMPLENTE
  updated_at timestamptz not null default now()
);

-- Vínculo usuário-loja (permissões)
create table if not exists usuarios_lojas (
  user_id uuid not null,
  role text not null default 'ADMIN', -- ADMIN | VENDEDOR
  created_at timestamptz not null default now(),
  primary key (user_id, loja_id)
);

-- Seed de planos (roda 1x)
insert into planos (id, nome, max_lojas)
values
  ('FREE','Grátis',2),
  ('PRO','Pro',5),
  ('SCALE','Scale',9999)
on conflict (id) do nothing;

create or replace function pode_criar_loja(p_user_id uuid)
returns boolean as $$
declare
  v_max int;
  v_qtd int;
begin
  select p.max_lojas
    into v_max
  from assinaturas a
  join planos p on p.id = a.plano_id
  where a.user_id = p_user_id and a.status = 'ATIVA';

  -- se não tiver assinatura ainda, assume FREE
  if v_max is null then
    v_max := 2;
  end if;

  select count(*)
    into v_qtd
  from usuarios_lojas
  where user_id = p_user_id;

  return v_qtd < v_max;
end;
$$ language plpgsql;

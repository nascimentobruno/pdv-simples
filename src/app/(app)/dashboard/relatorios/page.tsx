const cards = [
  { title: "Lojas", desc: "Gerencie até 2 grátis", href: "/dashboard/lojas" },
  { title: "Produtos", desc: "Categorias e variações", href: "/dashboard/produtos" },
  { title: "Estoque", desc: "Saldo, mínimo e giro", href: "/dashboard/estoque" },
  { title: "Compras", desc: "Entrada e custo médio", href: "/dashboard/compras" },
  { title: "PDV", desc: "Venda rápida no balcão", href: "/dashboard/pdv" },
  { title: "Relatórios", desc: "Lucro, margem e ranking", href: "/dashboard/relatorios" },
];

export default function DashboardHome() {
  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">Visão geral</h1>
            <p className="muted">PDV + Estoque + Compras + Relatórios — simples e vendável.</p>
          </div>
          <div className="flex gap-2">
            <a className="btn btn-primary" href="/dashboard/pdv">Abrir PDV</a>
            <a className="btn" href="/dashboard/compras">Nova Compra</a>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Metric label="Vendas (mês)" value="R$ 0,00" />
        <Metric label="Lucro (mês)" value="R$ 0,00" />
        <Metric label="Margem" value="0%" />
        <Metric label="Itens em estoque" value="0" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((c) => (
          <a key={c.href} href={c.href} className="card hover:bg-zinc-900/60 transition">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">{c.title}</h2>
                <p className="muted text-sm mt-1">{c.desc}</p>
              </div>
              <span className="badge">Abrir</span>
            </div>
          </a>
        ))}
      </div>

      <div className="card">
        <h3 className="font-bold">Próximos passos</h3>
        <ul className="mt-2 space-y-1 text-sm text-zinc-300">
          <li>• Conectar Supabase + Auth</li>
          <li>• Criar “Minhas lojas” (limit 2 grátis)</li>
          <li>• CRUD de categorias/produtos/variações</li>
          <li>• Compras com custo médio + entrada no estoque</li>
        </ul>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <div className="muted text-xs">{label}</div>
      <div className="text-xl font-black mt-1">{value}</div>
    </div>
  );
}

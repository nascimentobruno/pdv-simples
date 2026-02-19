export default function DashboardHome() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">PDV Simples</h1>
      <p className="text-zinc-400">
        Sistema de Vendas, Estoque e Compras
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
        <Card title="Lojas" href="/dashboard/lojas" />
        <Card title="Produtos" href="/dashboard/produtos" />
        <Card title="Estoque" href="/dashboard/estoque" />
        <Card title="Compras" href="/dashboard/compras" />
        <Card title="PDV" href="/dashboard/pdv" />
        <Card title="Relatórios" href="/dashboard/relatorios" />
      </div>
    </div>
  );
}

function Card({ title, href }: { title: string; href: string }) {
  return (
    <a
      href={href}
      className="p-6 rounded-2xl bg-zinc-900 hover:bg-zinc-800 transition border border-zinc-700"
    >
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-sm text-zinc-400 mt-1">
        Acessar módulo
      </p>
    </a>
  );
}

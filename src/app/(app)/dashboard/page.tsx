export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="card">
        <h1 className="text-3xl font-black">PDV Simples</h1>
        <p className="muted mt-1">
          Sistema de vendas, estoque, compras e relatórios
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Modulo title="Relatórios" href="/dashboard/relatorios" />
        <Modulo title="PDV" href="/dashboard/pdv" />
        <Modulo title="Compras" href="/dashboard/compras" />
        <Modulo title="Estoque" href="/dashboard/estoque" />
        <Modulo title="Produtos" href="/dashboard/produtos" />
        <Modulo title="Lojas" href="/dashboard/lojas" />
      </div>
    </div>
  );
}

function Modulo({ title, href }: { title: string; href: string }) {
  return (
    <a
      href={href}
      className="card hover:bg-zinc-900/60 transition cursor-pointer"
    >
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="muted text-sm mt-1">
        Acessar módulo
      </p>
    </a>
  );
}

import Link from "next/link";

const nav = [
  { href: "/dashboard", label: "Visão geral" },
  { href: "/dashboard/lojas", label: "Lojas" },
  { href: "/dashboard/produtos", label: "Produtos" },
  { href: "/dashboard/estoque", label: "Estoque" },
  { href: "/dashboard/compras", label: "Compras" },
  { href: "/dashboard/pdv", label: "PDV" },
  { href: "/dashboard/relatorios", label: "Relatórios" },
  { href: "/dashboard/config", label: "Config" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-zinc-950/70 backdrop-blur">
        <div className="container-app py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="font-black tracking-tight text-lg">
              PDV Simples
            </Link>
            <span className="badge hidden sm:inline-flex">MVP</span>
          </div>

          <div className="hidden md:flex items-center gap-2">
            {nav.map((i) => (
              <Link key={i.href} href={i.href} className="text-sm text-zinc-300 hover:text-white px-2 py-1">
                {i.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <a className="btn text-sm" href="/dashboard/config">Config</a>
            <form action="/dashboard/logout" method="post">
              <button className="btn text-sm">Sair</button>
            </form>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="md:hidden border-t border-zinc-900/80">
          <div className="container-app py-2 flex gap-2 overflow-x-auto">
            {nav.map((i) => (
              <Link key={i.href} href={i.href} className="badge whitespace-nowrap hover:bg-zinc-900">
                {i.label}
              </Link>
            ))}
          </div>
        </div>
      </header>

      <main className="container-app py-6">{children}</main>
    </div>
  );
}

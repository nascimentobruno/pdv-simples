"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AccessContext, hasPerm, Permissao } from "@/lib/access";
import { getCurrentUser, logoutUser } from "@/lib/auth";

type NavItem = { label: string; href: string; perm: Permissao };

const ITEMS: NavItem[] = [
  { label: "Visão geral", href: "/dashboard", perm: "DASHBOARD" },
  { label: "Lojas", href: "/dashboard/lojas", perm: "LOJAS" },
  { label: "Produtos", href: "/dashboard/produtos", perm: "PRODUTOS" },
  { label: "Estoque", href: "/dashboard/estoque", perm: "ESTOQUE" },
  { label: "Compras", href: "/dashboard/compras", perm: "COMPRAS" },
  { label: "PDV", href: "/dashboard/pdv", perm: "PDV" },
  { label: "Relatórios", href: "/dashboard/relatorios", perm: "RELATORIOS" },
  { label: "Usuários", href: "/dashboard/usuarios", perm: "USUARIOS" },
  { label: "Config", href: "/dashboard/config", perm: "CONFIG" },
];

export default function TopNav({ ctx }: { ctx: AccessContext | null }) {
  const pathname = usePathname();
  const router = useRouter();

  const me = getCurrentUser();
  const nome = me?.nome ?? "Usuário";
  const cargo = ctx?.role?.nome ?? "—";

  const visible = ITEMS.filter((i) => hasPerm(ctx, i.perm));

  return (
    <div className="sticky top-0 z-50 border-b border-zinc-800 bg-black/70 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="text-sm font-bold tracking-wide">PDV Simples</div>
          <span className="rounded-full border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs">
            MVP
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-2">
          {visible.map((i) => {
            const active = pathname === i.href;
            return (
              <Link
                key={i.href}
                href={i.href}
                className={[
                  "rounded-xl px-3 py-2 text-xs font-semibold border",
                  active
                    ? "border-zinc-500 bg-zinc-900"
                    : "border-zinc-800 bg-zinc-950 hover:bg-zinc-900",
                ].join(" ")}
              >
                {i.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex flex-col items-end leading-tight">
            <div className="text-xs font-semibold">{nome}</div>
            <div className="text-[11px] text-zinc-400">{cargo}</div>
          </div>

          <button
            onClick={() => router.push("/dashboard")}
            className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-semibold hover:bg-zinc-900"
            title="Início"
          >
            Início
          </button>

          <button
            onClick={() => router.back()}
            className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-semibold hover:bg-zinc-900"
            title="Voltar"
          >
            Voltar
          </button>

          <button
            onClick={() => {
              logoutUser();
              router.push("/login");
            }}
            className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-semibold hover:bg-zinc-900"
            title="Sair"
          >
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}
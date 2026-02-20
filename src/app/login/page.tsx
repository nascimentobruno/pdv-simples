"use client";

import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { loginWithPin } from "@/lib/auth";


export default function LoginPage() {
  const [login, setLogin] = useState("admin");
  const [pin, setPin] = useState("1234");
  const [err, setErr] = useState("");
  const router = useRouter();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");

    const res = loginWithPin(login, pin);
    if (!res.ok) {
      setErr(res.msg || "Falha no login.");
      return;
    }

    // Agora o acesso é por flags (role + allow/deny), então sempre vai pro dashboard.
      router.replace("/dashboard");
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <div className="text-2xl font-bold">Entrar</div>
        <div className="text-sm text-zinc-400 mt-1">Acesse com seu login e PIN.</div>

        <form className="mt-5 space-y-3" onSubmit={onSubmit}>
          <div>
            <label className="block text-xs font-semibold text-zinc-400">Login</label>
            <input
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-sm outline-none focus:border-zinc-600"
              placeholder="ex: admin"
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400">PIN</label>
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-sm outline-none focus:border-zinc-600"
              placeholder="ex: 1234"
              inputMode="numeric"
              autoComplete="current-password"
            />
          </div>

          {err ? (
            <div className="rounded-xl border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-200">
              {err}
            </div>
          ) : null}

          <button type="submit" className="w-full rounded-xl bg-white text-black font-bold py-3 hover:opacity-90">
            Entrar
          </button>

          <div className="text-xs text-zinc-500 mt-2">
            Padrão: <span className="text-zinc-200 font-semibold">admin / 1234</span> •{" "}
            <span className="text-zinc-200 font-semibold">caixa / 1234</span>
          </div>
        </form>

        <div className="mt-6 text-center text-xs text-zinc-500">
          Desenvolvido e idealizado por <span className="text-zinc-200 font-semibold">RideCode</span> • acesse{" "}
          <a className="underline text-zinc-200" href="https://www.ridecode.tech" target="_blank" rel="noreferrer">
            www.ridecode.tech
          </a>
        </div>
      </div>
    </div>
  );
}
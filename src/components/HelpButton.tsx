"use client";

import React, { useMemo, useState } from "react";

type Props = {
  supportName?: string;
  supportEmail: string;
  supportWhatsapp?: string; // opcional: "5511999999999"
};

export default function HelpButton({
  supportName = "Suporte",
  supportEmail,
  supportWhatsapp,
}: Props) {
  const [open, setOpen] = useState(false);

  const driveText = useMemo(
    () => [
      "Backup no Google Drive (recomendado)",
      "1) Instale o Google Drive para computador e faça login.",
      "2) No Explorador de Arquivos, abra “Meu Drive”.",
      "3) Crie uma pasta: Meu Drive\\PDV-SIMPLES",
      "4) No PDV, vá em Configurações → Pasta de dados (ou “Backup”).",
      "5) Clique em “Selecionar pasta” e escolha a pasta criada no Meu Drive.",
      "6) Pronto: o PDV salvará os arquivos lá e o Drive sincroniza automaticamente.",
      "",
      "Dica: evite abrir o PDV em duas máquinas ao mesmo tempo usando a mesma pasta do Drive.",
    ].join("\n"),
    []
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(driveText);
      alert("Instruções copiadas!");
    } catch {
      alert("Não consegui copiar. Selecione o texto e copie manualmente.");
    }
  };

  const openMail = () => {
    const subject = encodeURIComponent("Suporte PDV");
    const body = encodeURIComponent(
      "Olá! Preciso de ajuda com o PDV.\n\nDescreva aqui o problema e, se possível, envie print."
    );
    window.open(`mailto:${supportEmail}?subject=${subject}&body=${body}`, "_blank");
  };

  const openWhatsapp = () => {
    if (!supportWhatsapp) return;
    const msg = encodeURIComponent("Olá! Preciso de ajuda com o PDV.");
    window.open(`https://wa.me/${supportWhatsapp}?text=${msg}`, "_blank");
  };

  return (
    <>
      {/* Botão flutuante */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-50 rounded-full border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm font-semibold text-zinc-100 shadow-lg hover:bg-zinc-900"
        title="Ajuda / Suporte"
      >
        Ajuda
      </button>

      {/* Modal */}
      {open ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-zinc-100 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">Ajuda e Suporte</h3>
                <p className="mt-1 text-sm text-zinc-400">
                  Atendimento: <span className="font-semibold text-zinc-200">{supportName}</span>
                </p>
                <p className="text-sm text-zinc-400">
                  E-mail: <span className="font-semibold text-zinc-200">{supportEmail}</span>
                </p>
              </div>

              <button
                onClick={() => setOpen(false)}
                className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800"
              >
                Fechar
              </button>
            </div>

            <div className="mt-4">
              <div className="text-sm font-bold">Como salvar no Google Drive</div>
              <pre className="mt-2 whitespace-pre-wrap rounded-2xl border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-200">
                {driveText}
              </pre>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={copy}
                  className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-semibold hover:bg-zinc-800"
                >
                  Copiar instruções
                </button>

                <button
                  onClick={openMail}
                  className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-semibold hover:bg-zinc-800"
                >
                  Enviar e-mail
                </button>

                {supportWhatsapp ? (
                  <button
                    onClick={openWhatsapp}
                    className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-semibold hover:bg-zinc-800"
                  >
                    Chamar no WhatsApp
                  </button>
                ) : null}
              </div>

              <div className="mt-3 text-xs text-zinc-500">
                Se precisar, envie prints e o horário do ocorrido pra facilitar o diagnóstico.
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
"use client";

import { useTransition } from "react";
import { cn } from "@/lib/utils";

// Upload em 1 clique: clicar no botão abre o seletor de arquivo e, ao
// escolher a imagem, a action é chamada na hora (sem passo extra).
//
// Sem <form> aqui de propósito: este bloco é renderizado dentro do form de
// customização e HTML não permite <form> aninhado — o parser descartava o
// form interno no SSR e o upload nunca disparava. O FormData é montado à mão.
export function LogoUploadForm({
  uploadAction,
}: {
  uploadAction: (formData: FormData) => void;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        id="logo-upload-input"
        disabled={pending}
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Zera o input para que reenviar o mesmo arquivo dispare onChange.
          e.target.value = "";
          if (!file) return;

          const formData = new FormData();
          formData.append("logo", file);
          startTransition(() => uploadAction(formData));
        }}
      />
      <label
        htmlFor="logo-upload-input"
        aria-disabled={pending}
        className={cn(
          "inline-flex cursor-pointer items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition",
          "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90",
          pending && "pointer-events-none opacity-60",
        )}
      >
        {pending ? "Enviando…" : "Enviar imagem"}
      </label>
      <p className="mt-2 text-xs opacity-50">PNG/JPG/WEBP/SVG · até 2MB</p>
    </div>
  );
}

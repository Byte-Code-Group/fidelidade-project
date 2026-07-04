"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

// Upload em 1 clique: clicar no botão abre o seletor de arquivo e, ao
// escolher a imagem, o form é enviado automaticamente (sem passo extra).
export function LogoUploadForm({
  uploadAction,
}: {
  uploadAction: (formData: FormData) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={uploadAction}>
      <input
        type="file"
        name="logo"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        id="logo-upload-input"
        onChange={() => formRef.current?.requestSubmit()}
      />
      <label
        htmlFor="logo-upload-input"
        className={cn(
          "inline-flex cursor-pointer items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition",
          "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90",
        )}
      >
        Enviar imagem
      </label>
      <p className="mt-2 text-xs opacity-50">PNG/JPG/WEBP/SVG · até 2MB</p>
    </form>
  );
}

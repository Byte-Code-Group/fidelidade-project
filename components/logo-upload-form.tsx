"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const TIPOS_ACEITOS = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const TAMANHO_MAX = 2 * 1024 * 1024;

// Upload em 1 clique: clicar no botão abre o seletor e, ao escolher a imagem,
// a action é chamada na hora. Enquanto sobe, mostra o preview local na
// miniatura com overlay de carregando + botão em estado "Enviando…", pra
// pessoa saber que o clique pegou (antes o único sinal era a página recarregar
// do nada, segundos depois).
//
// Sem <form> aqui de propósito: este bloco é renderizado dentro do form de
// customização e HTML não permite <form> aninhado — o parser descartava o
// form interno no SSR e o upload nunca disparava. O FormData é montado à mão.
export function LogoUploadForm({
  uploadAction,
  logoUrl,
  fallbackLabel,
  fallbackColor,
}: {
  uploadAction: (formData: FormData) => void;
  logoUrl?: string | null;
  fallbackLabel: string;
  fallbackColor: string;
}) {
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<string | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const toastId = useRef<string | number | null>(null);

  // Libera o object URL do preview e o toast de progresso ao desmontar (a
  // action redireciona no fim, então o componente remonta com a logo nova).
  useEffect(() => {
    return () => {
      if (toastId.current !== null) toast.dismiss(toastId.current);
    };
  }, []);

  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  function selecionar(file: File) {
    if (!TIPOS_ACEITOS.includes(file.type)) {
      toast.error("Formato não suportado. Use PNG, JPG, WEBP ou SVG.");
      return;
    }
    if (file.size > TAMANHO_MAX) {
      toast.error("Imagem muito grande. O limite é 2MB.");
      return;
    }

    setPreview(URL.createObjectURL(file));
    setNomeArquivo(file.name);
    toastId.current = toast.loading("Enviando a logo…");

    const formData = new FormData();
    formData.append("logo", file);
    startTransition(() => uploadAction(formData));
  }

  const imagem = preview ?? logoUrl;

  return (
    <div className="flex items-center gap-4">
      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-black/10 bg-black/5 dark:bg-white/10">
        {imagem ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imagem} alt="logo" className="h-full w-full object-cover" />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-xl font-bold text-white"
            style={{ background: fallbackColor }}
          >
            {fallbackLabel.charAt(0)}
          </div>
        )}

        {pending && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-white">
            <Spinner className="h-5 w-5" />
          </div>
        )}
      </div>

      <div>
        <input
          type="file"
          accept={TIPOS_ACEITOS.join(",")}
          className="hidden"
          id="logo-upload-input"
          disabled={pending}
          onChange={(e) => {
            const file = e.target.files?.[0];
            // Zera o input para que reenviar o mesmo arquivo dispare onChange.
            e.target.value = "";
            if (file) selecionar(file);
          }}
        />
        <label
          htmlFor="logo-upload-input"
          aria-disabled={pending}
          aria-busy={pending}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition",
            "bg-[var(--primary)] text-[var(--primary-foreground)]",
            pending
              ? "pointer-events-none opacity-70"
              : "cursor-pointer hover:opacity-90 active:scale-[0.98]",
          )}
        >
          {pending && <Spinner />}
          {pending ? "Enviando…" : "Enviar imagem"}
        </label>
        <p className="mt-2 text-xs opacity-50">
          {pending && nomeArquivo ? nomeArquivo : "PNG/JPG/WEBP/SVG · até 2MB"}
        </p>
      </div>
    </div>
  );
}

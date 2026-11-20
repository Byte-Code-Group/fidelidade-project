"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Icon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormAlert } from "@/components/ui/form-alert";
import { confirmarCodigoMfa, desativarMfa, iniciarMfa } from "@/lib/auth-actions";

interface Cadastro {
  factorId: string;
  qrCode: string;
  secret: string;
}

function CampoCodigo({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Input
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      placeholder="000000"
      aria-label="Código de 6 dígitos"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
      className="max-w-[180px] text-center font-mono text-lg tracking-[0.4em]"
    />
  );
}

// Ativar/desativar a verificação em duas etapas por app autenticador (TOTP).
export function MfaSettings({ ativo }: { ativo: boolean }) {
  const [cadastro, setCadastro] = useState<Cadastro | null>(null);
  const [desativando, setDesativando] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const run = (fn: () => Promise<void>) => {
    setError("");
    startTransition(fn);
  };

  const comecar = () =>
    run(async () => {
      const r = await iniciarMfa();
      if (r.error || !r.factorId) return setError(r.error ?? "Não foi possível ativar agora.");
      setCadastro({ factorId: r.factorId, qrCode: r.qrCode!, secret: r.secret! });
    });

  const confirmar = () =>
    run(async () => {
      const r = await confirmarCodigoMfa(code, cadastro!.factorId);
      if (r.error) return setError(r.error);
      toast.success("Verificação em duas etapas ativada.");
      setCadastro(null);
      setCode("");
      router.refresh();
    });

  const desativar = () =>
    run(async () => {
      const r = await desativarMfa(code);
      if (r.error) return setError(r.error);
      toast.success("Verificação em duas etapas desativada.");
      setDesativando(false);
      setCode("");
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
            <Icon name="lock" className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold">Verificação em duas etapas</p>
            <p className="text-sm text-muted">
              Além da senha, o login pede um código do Google Authenticator, Microsoft Authenticator ou similar.
            </p>
          </div>
        </div>
        <Badge tone={ativo ? "success" : "neutral"}>{ativo ? "Ativa" : "Desativada"}</Badge>
      </div>

      {!ativo && !cadastro && (
        <Button type="button" onClick={comecar} disabled={pending}>
          {pending ? "Preparando…" : "Ativar verificação em duas etapas"}
        </Button>
      )}

      {cadastro && (
        <div className="animate-rise space-y-4 rounded-2xl border border-line p-4">
          <p className="text-sm">
            1. Abra o app autenticador e escaneie o QR code. Sem câmera, digite a chave manualmente.
          </p>
          <div className="flex flex-wrap items-center gap-5">
            {/* eslint-disable-next-line @next/next/no-img-element -- QR vem como data URL do GoTrue */}
            <img src={cadastro.qrCode} alt="QR code para o app autenticador" className="h-44 w-44 rounded-xl bg-white p-2" />
            <div className="min-w-0 space-y-1">
              <p className="text-xs text-muted">Chave manual</p>
              <code className="block break-all rounded-lg bg-surface-2 px-3 py-2 font-mono text-sm">{cadastro.secret}</code>
            </div>
          </div>
          <p className="text-sm">2. Digite o código de 6 dígitos que aparece no app.</p>
          <div className="flex flex-wrap items-center gap-2">
            <CampoCodigo value={code} onChange={setCode} />
            <Button type="button" onClick={confirmar} disabled={pending || code.length !== 6}>
              {pending ? "Confirmando…" : "Confirmar e ativar"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setCadastro(null)} disabled={pending}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {ativo && !desativando && (
        <Button type="button" variant="outline" onClick={() => setDesativando(true)}>
          Desativar
        </Button>
      )}

      {ativo && desativando && (
        <div className="animate-rise space-y-3 rounded-2xl border border-line p-4">
          <p className="text-sm">Para desativar, digite o código atual do app autenticador.</p>
          <div className="flex flex-wrap items-center gap-2">
            <CampoCodigo value={code} onChange={setCode} />
            <Button type="button" onClick={desativar} disabled={pending || code.length !== 6}>
              {pending ? "Desativando…" : "Confirmar desativação"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setDesativando(false)} disabled={pending}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <FormAlert>{error}</FormAlert>
    </div>
  );
}

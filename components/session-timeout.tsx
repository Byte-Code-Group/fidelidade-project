"use client";

import { useEffect, useRef } from "react";
import {
  ABSOLUTE_TIMEOUT_MS,
  IDLE_TIMEOUT_MS,
} from "@/lib/session-limits";

const EVENTOS = [
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "pointerdown",
] as const;

// Espelha no browser os limites que o middleware aplica: quando o tempo
// estoura com a aba aberta (sem nenhuma navegação para o middleware ver),
// recarrega a página — aí o middleware derruba a sessão e leva pro login.
//
// Quem decide de fato é sempre o servidor; aqui é só o gatilho do refresh.
export function SessionTimeout({ startedAt }: { startedAt: number }) {
  // Só preenchido no efeito — Date.now() em render é impuro.
  const ultimaAtividade = useRef(0);

  useEffect(() => {
    ultimaAtividade.current = Date.now();
    let timer: ReturnType<typeof setTimeout>;

    const expirar = () => {
      // Reload → middleware vê o cookie estourado, desloga e redireciona.
      window.location.reload();
    };

    const agendar = () => {
      clearTimeout(timer);
      const restanteInatividade =
        IDLE_TIMEOUT_MS - (Date.now() - ultimaAtividade.current);
      const restanteTotal = ABSOLUTE_TIMEOUT_MS - (Date.now() - startedAt);
      const restante = Math.min(restanteInatividade, restanteTotal);

      if (restante <= 0) {
        expirar();
        return;
      }
      // setTimeout satura perto de 2^31 ms — os limites aqui são bem menores.
      timer = setTimeout(expirar, restante);
    };

    const registrarAtividade = () => {
      ultimaAtividade.current = Date.now();
      agendar();
    };

    // Aba em background congela timers: ao voltar, confere o tempo real.
    const aoVoltar = () => {
      if (document.visibilityState === "visible") agendar();
    };

    for (const evento of EVENTOS) {
      window.addEventListener(evento, registrarAtividade, { passive: true });
    }
    document.addEventListener("visibilitychange", aoVoltar);
    agendar();

    return () => {
      clearTimeout(timer);
      for (const evento of EVENTOS) {
        window.removeEventListener(evento, registrarAtividade);
      }
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [startedAt]);

  return null;
}

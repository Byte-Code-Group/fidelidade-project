"use client";

import { useCallback, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

// O atributo data-theme no <html> é a fonte da verdade: o script inline em
// app/layout.tsx já o define antes da primeira pintura (evita flash). Ler o
// DOM via useSyncExternalStore dispensa o useEffect + setState que causava
// render em cascata, e hidrata sem mismatch por causa do server snapshot.
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

/**
 * Tema atual + toggle persistido em localStorage.
 *
 * @param storageKey chave do localStorage (o painel usa "theme", o portal do
 *   cliente usa "portal-theme" — temas independentes).
 * @param fallback tema usado na renderização do servidor e quando não há nada
 *   salvo ainda.
 */
export function useTheme(
  storageKey: string,
  fallback: Theme = "light",
): [Theme, () => void] {
  const getSnapshot = useCallback((): Theme => {
    const attr = document.documentElement.getAttribute("data-theme");
    if (attr === "light" || attr === "dark") return attr;
    const stored = localStorage.getItem(storageKey);
    return stored === "light" || stored === "dark" ? stored : fallback;
  }, [storageKey, fallback]);

  const getServerSnapshot = useCallback((): Theme => fallback, [fallback]);

  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    localStorage.setItem(storageKey, next);
    // Dispara o MutationObserver, que propaga o novo tema pra todos os hooks.
    document.documentElement.setAttribute("data-theme", next);
  }, [theme, storageKey]);

  return [theme, toggle];
}

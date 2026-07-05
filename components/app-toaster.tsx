"use client";

import { useEffect, useState } from "react";
import { Toaster } from "sonner";

// Toaster theme="system" só segue prefers-color-scheme, ignorando o toggle
// manual (data-theme na <html>). Aqui a gente observa o atributo direto.
export function AppToaster() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const root = document.documentElement;
    const read = () =>
      setTheme(root.getAttribute("data-theme") === "dark" ? "dark" : "light");

    read();

    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return <Toaster richColors position="top-right" theme={theme} />;
}

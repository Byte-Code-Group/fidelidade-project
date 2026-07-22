"use client";

import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { platformSignUp } from "@/app/(platform)/conta/actions";

// Regex simples de e-mail (suficiente p/ feedback ao usuário; o Supabase
// valida de forma definitiva no servidor).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function CadastroForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    confirm?: string;
    terms?: string;
  }>({});

  function validate() {
    const next: typeof errors = {};
    if (!EMAIL_RE.test(email.trim())) next.email = "Digite um e-mail válido.";
    if (password.length < 6) next.password = "Mínimo de 6 caracteres.";
    if (confirm !== password) next.confirm = "As senhas não coincidem.";
    if (!terms) next.terms = "Você precisa aceitar os termos.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    // Bloqueia o envio (server action) se a validação de cliente falhar.
    if (!validate()) e.preventDefault();
  }

  return (
    <form action={platformSignUp} onSubmit={onSubmit} noValidate className="flex flex-col gap-[18px]">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-[13px] font-semibold text-gray-700">
          Nome completo
        </label>
        <Input id="name" name="name" required autoComplete="name" placeholder="Seu nome completo" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-[13px] font-semibold text-gray-700">
          E-mail
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="voce@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() =>
            setErrors((p) => ({
              ...p,
              email: email && !EMAIL_RE.test(email.trim()) ? "Digite um e-mail válido." : undefined,
            }))
          }
          aria-invalid={!!errors.email}
        />
        {errors.email && <p className="text-[13px] text-red-600">{errors.email}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-[13px] font-semibold text-gray-700">
          Senha
        </label>
        <PasswordInput
          id="password"
          name="password"
          required
          autoComplete="new-password"
          placeholder="Mín. 6 caracteres"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!errors.password}
        />
        {errors.password && <p className="text-[13px] text-red-600">{errors.password}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirm" className="text-[13px] font-semibold text-gray-700">
          Confirmar senha
        </label>
        <PasswordInput
          id="confirm"
          name="confirm"
          required
          autoComplete="new-password"
          placeholder="Repita a senha"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onBlur={() =>
            setErrors((p) => ({
              ...p,
              confirm: confirm && confirm !== password ? "As senhas não coincidem." : undefined,
            }))
          }
          aria-invalid={!!errors.confirm}
        />
        {errors.confirm && <p className="text-[13px] text-red-600">{errors.confirm}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label className="flex items-start gap-2 text-[13px] leading-relaxed text-gray-500">
          <input
            type="checkbox"
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span>
            Concordo com os{" "}
            <a href="#" className="font-medium text-blue-600 hover:underline">
              Termos de Uso
            </a>{" "}
            e a{" "}
            <a href="#" className="font-medium text-blue-600 hover:underline">
              Política de Privacidade
            </a>
            .
          </span>
        </label>
        {errors.terms && <p className="text-[13px] text-red-600">{errors.terms}</p>}
      </div>

      <button
        type="submit"
        className="mt-1 w-full rounded-lg bg-blue-600 py-3.5 text-[15px] font-semibold text-white transition hover:bg-blue-700"
      >
        Criar conta e continuar
      </button>
    </form>
  );
}

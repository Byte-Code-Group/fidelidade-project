"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Input } from "@/components/ui/input";
import {
  formatCpf,
  formatCpfCnpj,
  formatPhone,
  isValidCpf,
  isValidCpfCnpj,
  isValidPhone,
} from "@/lib/masks";

type MaskedInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
  mask: "cpf-cnpj" | "cpf" | "phone";
};

const maskFormatters = {
  "cpf-cnpj": formatCpfCnpj,
  cpf: formatCpf,
  phone: formatPhone,
};

const maskValidators = {
  "cpf-cnpj": isValidCpfCnpj,
  cpf: isValidCpf,
  phone: isValidPhone,
};

const maskMessages = {
  "cpf-cnpj": "CPF/CNPJ inválido.",
  cpf: "CPF inválido.",
  phone: "Telefone inválido.",
};

export function MaskedInput({ mask, defaultValue, required, ...props }: MaskedInputProps) {
  const format = maskFormatters[mask];
  const validate = maskValidators[mask];
  const [value, setValue] = useState(format(String(defaultValue ?? "")));
  const [touched, setTouched] = useState(false);

  const invalid = touched && value.length > 0 && !validate(value);

  return (
    <div>
      <Input
        {...props}
        required={required}
        value={value}
        onChange={(e) => setValue(format(e.target.value))}
        onBlur={() => setTouched(true)}
        aria-invalid={invalid}
        className={invalid ? "border-red-500 focus:border-red-500" : props.className}
      />
      {invalid && (
        <p className="mt-1 text-xs text-red-500">{maskMessages[mask]}</p>
      )}
    </div>
  );
}

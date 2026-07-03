"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Input } from "@/components/ui/input";
import { formatCpfCnpj, formatPhone, isValidCpfCnpj, isValidPhone } from "@/lib/masks";

type MaskedInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
  mask: "cpf-cnpj" | "phone";
};

const maskFormatters = {
  "cpf-cnpj": formatCpfCnpj,
  phone: formatPhone,
};

const maskValidators = {
  "cpf-cnpj": isValidCpfCnpj,
  phone: isValidPhone,
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
        <p className="mt-1 text-xs text-red-500">
          {mask === "cpf-cnpj" ? "CPF/CNPJ inválido." : "Telefone inválido."}
        </p>
      )}
    </div>
  );
}

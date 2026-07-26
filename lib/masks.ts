export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function formatCpfCnpj(value: string): string {
  const digits = onlyDigits(value).slice(0, 14);

  if (digits.length <= 11) {
    return digits
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
  }

  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

export function formatPhone(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }

  return digits
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

// dd/mm/aaaa. Converte também um valor ISO (aaaa-mm-dd) que tenha sido salvo
// antes, quando o campo usava <input type="date">.
export function formatDate(value: string): string {
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;

  const digits = onlyDigits(value).slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)]
    .filter(Boolean)
    .join("/");
}

export function isValidDate(value: string): boolean {
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return false;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) {
    return false;
  }
  const dt = new Date(year, month - 1, day);
  return (
    dt.getDate() === day &&
    dt.getMonth() === month - 1 &&
    dt.getFullYear() === year
  );
}

// HH:MM em 24h. <input type="time"> segue o idioma do NAVEGADOR (vira AM/PM
// em quem usa inglês, mesmo com lang="pt-BR" na página), por isso a hora é
// digitada como texto mascarado — ver components/ui/time-input.tsx.
export function formatTime24(value: string): string {
  const digits = onlyDigits(value).slice(0, 4);
  if (digits.length <= 1) return digits;

  // Começou com 3–9: não existe hora assim, quem digitou 8-3-0 quis 08:30 —
  // o 1º dígito vira a hora e o ":" entra mais cedo. Um "24"/"25" digitado
  // por engano fica como está e o campo acusa inválido.
  if (Number(digits[0]) > 2) {
    return `0${digits[0]}:${digits.slice(1, 3)}`;
  }
  if (digits.length === 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

/**
 * Completa o que o usuário digitou pela metade: "8" → 08:00, "830" → 08:30,
 * "1 30" → 01:30. Devolve "" quando não dá pra montar uma hora válida.
 */
export function normalizeTime24(value: string): string {
  // "09:30", o "08:3" ainda pela metade (minuto conta como dezena) e o
  // "09:30:00" que vem do `time` do Postgres.
  const comSeparador = value.trim().match(/^(\d{1,2}):(\d{1,2})(?::\d{2})?$/);
  const digits = comSeparador
    ? comSeparador[1].padStart(2, "0") + comSeparador[2].padEnd(2, "0")
    : onlyDigits(value);
  if (digits.length === 0) return "";

  const [h, m] =
    digits.length <= 2
      ? [digits, "0"]
      : [digits.slice(0, digits.length - 2), digits.slice(-2)];

  const hora = Number(h);
  const minuto = Number(m);
  if (!Number.isInteger(hora) || hora > 23) return "";
  if (!Number.isInteger(minuto) || minuto > 59) return "";

  return `${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}`;
}

export function isValidTime24(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function formatCpf(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

function isValidCpfDigits(digits: string): boolean {
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;

  const calcCheckDigit = (base: string, factor: number) => {
    let total = 0;
    for (const digit of base) {
      total += Number(digit) * factor--;
    }
    const rest = total % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const digit1 = calcCheckDigit(digits.slice(0, 9), 10);
  const digit2 = calcCheckDigit(digits.slice(0, 10), 11);

  return digit1 === Number(digits[9]) && digit2 === Number(digits[10]);
}

export function isValidCpf(value: string): boolean {
  return isValidCpfDigits(onlyDigits(value));
}

function isValidCnpj(digits: string): boolean {
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false;

  const calcCheckDigit = (base: string) => {
    const factors = base.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let total = 0;
    for (let i = 0; i < base.length; i++) {
      total += Number(base[i]) * factors[i];
    }
    const rest = total % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const digit1 = calcCheckDigit(digits.slice(0, 12));
  const digit2 = calcCheckDigit(digits.slice(0, 13));

  return digit1 === Number(digits[12]) && digit2 === Number(digits[13]);
}

export function isValidCpfCnpj(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length === 11) return isValidCpfDigits(digits);
  if (digits.length === 14) return isValidCnpj(digits);
  return false;
}

export function isValidPhone(value: string): boolean {
  const digits = onlyDigits(value);
  return digits.length === 10 || digits.length === 11;
}

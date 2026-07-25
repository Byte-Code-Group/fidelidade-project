// Fusos oferecidos na configuração da agenda. Lista curta de propósito: são os
// fusos do Brasil, onde o produto opera.
export const TIMEZONES = [
  { value: "America/Sao_Paulo", label: "Brasília, São Paulo (GMT-3)" },
  { value: "America/Bahia", label: "Salvador (GMT-3)" },
  { value: "America/Fortaleza", label: "Fortaleza, Recife (GMT-3)" },
  { value: "America/Belem", label: "Belém (GMT-3)" },
  { value: "America/Manaus", label: "Manaus, Cuiabá (GMT-4)" },
  { value: "America/Porto_Velho", label: "Porto Velho, Boa Vista (GMT-4)" },
  { value: "America/Rio_Branco", label: "Rio Branco (GMT-5)" },
  { value: "America/Noronha", label: "Fernando de Noronha (GMT-2)" },
] as const;

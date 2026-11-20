// Espera o React hidratar o elemento: antes disso o submit é nativo (ignora
// onSubmit) e inputs controlados são zerados na hidratação.
export function waitHydrated(selector: string | JQuery<HTMLElement>) {
  const el = typeof selector === "string" ? cy.get(selector) : cy.wrap(selector);
  el.should(($e) => {
    expect(Object.keys($e[0]).some((k) => k.startsWith("__reactProps"))).to.eq(true);
  });
}

// Preenche os campos obrigatórios vazios de um form com valores válidos.
export function fillRequired(form: JQuery<HTMLElement>, title: string) {
  waitHydrated(form);
  form.find("input[required], textarea[required], select[required]").each((_, el) => {
    const input = el as HTMLInputElement;
    if (input.value || input.type === "hidden") return;
    const name = input.name ?? "";
    if (el.tagName === "SELECT") {
      const opt = (el as HTMLSelectElement).querySelector("option:not([value=''])") as HTMLOptionElement | null;
      if (opt) cy.wrap(el).select(opt.value);
      return;
    }
    let v = "1";
    if (input.type === "email") v = `e2e+${Date.now()}@teste.com`;
    else if (input.type === "date") v = "2000-01-15";
    else if (input.type === "time") v = "10:00";
    else if (input.type === "number" || input.inputMode === "numeric" || input.inputMode === "decimal") v = "10";
    else if (input.type === "tel" || /phone|telefone/i.test(name)) v = "11987654321";
    else if (input.placeholder?.includes("000.000.000")) v = "52998224725";
    else if (name === "title" || name === "name" || name === "full_name") v = title;
    else v = "Teste E2E";
    cy.wrap(el).type(v, { delay: 0 });
  });
}

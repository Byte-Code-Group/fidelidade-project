describe("customização do portal", () => {
  before(() => cy.task("seedOwner"));
  beforeEach(() => {
    cy.login("painel");
    cy.viewport(1280, 900);
    cy.visit("/painel/customizacao");
    // Só aparece depois de o efeito de montagem ler o form.
    cy.contains("Tudo salvo").should("be.visible");
    cy.get("form[action] [data-panel]").should("have.length", 5);
    cy.wait(1500);
  });

  const aba = (nome: string) => cy.get('nav[aria-label="Seções da customização"]').contains("button", nome).click();

  it("atualiza a prévia, avisa e descarta", () => {
    cy.get('input[name="primary_color"]').invoke("val").then((original) => {
      const cor = original === "#be123c" ? "Roxo" : "Vinho";
      cy.contains("button", cor).click();
      cy.contains("Alterações não salvas").should("be.visible");
      cy.contains("button", "Descartar").click();
      cy.contains("Tudo salvo").should("be.visible");
      cy.get('input[name="primary_color"]').should("have.value", original);
    });
    aba("Assistente");
    cy.get('input[name="ai_name"]').clear().type("Assistente Prévia");
    cy.get("aside[aria-label='Prévia do portal']").should("contain", "Assistente Prévia");
  });

  it("salva select e texto sem perder os valores", () => {
    aba("Fidelidade");
    cy.get('[name="loyalty_frequency"]').invoke("val").then((original) => {
      const novo = original === "weekly" ? "monthly" : "weekly";
      cy.get('[name="loyalty_frequency"]').select(novo);
      cy.contains("button", "Salvar alterações").click();
      cy.contains("Alterações salvas.", { timeout: 20000 }).should("be.visible");
      cy.contains("Tudo salvo").should("be.visible");
      cy.reload();
      aba("Fidelidade");
      cy.get('[name="loyalty_frequency"]').should("have.value", novo);
      cy.wait(1500);
      cy.get('[name="loyalty_frequency"]').select(String(original));
      cy.contains("button", "Salvar alterações").click();
      cy.contains("Alterações salvas.", { timeout: 20000 }).should("be.visible");
    });
  });

  it("abre a aba do campo inválido ao salvar", () => {
    aba("Fidelidade");
    cy.get('[name="loyalty_goal"]').clear();
    aba("Contato");
    cy.contains("button", "Salvar alterações").click();
    cy.get('[name="loyalty_goal"]').should("be.visible");
  });

  it("mostra na prévia o cadastro do cliente", () => {
    aba("Cadastro");
    cy.get("aside[aria-label='Prévia do portal']")
      .should("contain", "Dados do cadastro")
      .and("contain", "Nome completo")
      .and("contain", "WhatsApp");
  });

  it("cabe no celular", () => {
    cy.viewport(390, 844);
    cy.document().then((d) => expect(d.documentElement.scrollWidth).to.be.at.most(390));
    aba("Negócio");
    cy.get('input[name="business_name"]').should("be.visible");
  });
});

export {};

import { fillRequired } from "../support/fill";

describe("portal — fluxos de escrita", () => {
  beforeEach(() => cy.login("portal"));

  it("salva o perfil", () => {
    cy.visit("/p/oraldents/perfil");
    cy.contains("button", "Salvar alterações")
      .closest("form")
      .then((form) => {
        fillRequired(form, "Maria Silva");
        cy.wrap(form).contains("button", "Salvar alterações").click();
      });
    cy.contains("[data-sonner-toast]", "Alterações salvas", { timeout: 15000 });
  });

  it("resgata um prêmio e debita os pontos", () => {
    cy.task("setDemoPoints", 1000);
    cy.visit("/p/oraldents/loja");
    cy.contains("1000");
    cy.contains("button", "Resgatar").first().click();
    cy.contains("[data-sonner-toast]", "Resgate solicitado", { timeout: 15000 });
    cy.contains("1000").should("not.exist");
  });

  it("aparece no histórico do painel como resgate pendente", () => {
    cy.task("seedOwner");
    cy.login("painel");
    cy.visit("/painel/resgates");
    cy.contains("Maria Silva");
  });
});

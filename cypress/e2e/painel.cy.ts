const PAGES = [
  "/painel",
  "/painel/agenda",
  "/painel/agenda/configuracoes",
  "/painel/assinatura",
  "/painel/campanhas",
  "/painel/clientes",
  "/painel/clientes/novo",
  "/painel/conexoes",
  "/painel/customizacao",
  "/painel/documentos",
  "/painel/loja",
  "/painel/missoes",
  "/painel/planos",
  "/painel/resgates",
  "/painel/validacoes",
  "/conta/planos",
];

describe("painel do dono", () => {
  before(() => cy.task("seedOwner"));
  beforeEach(() => cy.login("painel"));

  PAGES.forEach((path) => {
    it(`abre ${path}`, () => {
      cy.visit(path);
      cy.location("pathname").should("eq", path);
      cy.assertPageOk();
    });
  });

  it("abre detalhe e edição de cliente", () => {
    cy.task("firstId", "users").then((id) => {
      if (!id) return;
      cy.visit(`/painel/clientes/${id}`);
      cy.assertPageOk();
      cy.visit(`/painel/clientes/${id}/editar`);
      cy.assertPageOk();
    });
  });

  it("abre detalhe de modelo de documento", () => {
    cy.task("firstId", "document_templates").then((id) => {
      if (!id) return;
      cy.visit(`/painel/documentos/${id}`);
      cy.assertPageOk();
    });
  });
});

export {};

const PAGES = [
  "/",
  "/conta/login",
  "/conta/cadastro",
  "/conta/esqueci-senha",
  "/conta/redefinir-senha",
  "/superadmin/login",
  "/superadmin/esqueci-senha",
  "/superadmin/redefinir-senha",
  "/p/oraldents",
  "/p/oraldents/login",
  "/p/oraldents/cadastro",
  "/p/oraldents/esqueci-senha",
  "/p/oraldents/redefinir-senha",
];

describe("páginas públicas", () => {
  PAGES.forEach((path) => {
    it(`abre ${path}`, () => {
      cy.visit(path);
      cy.assertPageOk();
    });
  });

  it("rota inexistente mostra 404", () => {
    cy.visit("/nao-existe-xyz", { failOnStatusCode: false });
    cy.contains("Página não encontrada");
  });

  it("login do painel com senha errada mostra erro e fica no login", () => {
    cy.visit("/conta/login");
    cy.get('input[name="email"]').type("dono@oraldents.com.br");
    cy.get('input[name="password"]').type("errada");
    cy.get('form button[type="submit"]').click();
    cy.location("pathname").should("eq", "/conta/login");
    cy.get("[data-sonner-toast]").should("exist");
  });

  it("áreas protegidas redirecionam pro login", () => {
    cy.visit("/painel");
    cy.location("pathname").should("eq", "/conta/login");
    cy.visit("/superadmin");
    cy.location("pathname").should("eq", "/superadmin/login");
    cy.visit("/p/oraldents/perfil");
    cy.location("pathname").should("contain", "/login");
  });
});

export {};

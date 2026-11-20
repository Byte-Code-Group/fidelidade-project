import { fillRequired } from "../support/fill";

const stamp = Date.now();

function createViaToggle(path: string, toggle: string, successToast: string) {
  const title = `E2E ${successToast} ${stamp}`;
  cy.visit(path);
  // Ancorado: linhas existentes também são <summary> e podem conter o texto.
  cy.contains("summary", new RegExp(`^\\s*\\${toggle}\\s*$`)).as("toggle").click();
  cy.get("@toggle")
    .parent()
    .find("form")
    .first()
    .then((form) => {
      fillRequired(form, title);
      cy.wrap(form).find('button[type="submit"]').click();
    });
  cy.contains("[data-sonner-toast]", successToast, { timeout: 15000 });
  cy.contains(title).should("exist");
}

describe("painel — fluxos de escrita", () => {
  before(() => cy.task("seedOwner"));
  beforeEach(() => cy.login("painel"));

  it("cria missão", () => createViaToggle("/painel/missoes", "+ Nova missão", "Missão criada"));
  it("cria prêmio", () => createViaToggle("/painel/loja", "+ Novo prêmio", "Prêmio criado"));
  it("cria plano", () => createViaToggle("/painel/planos", "+ Novo plano", "Plano criado"));

  it("cadastra cliente e abre a ficha", () => {
    const name = `Cliente E2E ${stamp}`;
    cy.visit("/painel/clientes/novo");
    cy.get('input[name="full_name"]').type(name);
    cy.get('input[name="full_name"]').closest("form").then((form) => fillRequired(form, name));
    cy.contains("button", "Cadastrar cliente").click();
    cy.location("pathname", { timeout: 20000 }).should("match", /^\/painel\/clientes\/[0-9a-f-]{36}$/);
    cy.contains(name);
    cy.assertPageOk();
  });

  it("busca o cliente na lista", () => {
    cy.visit("/painel/clientes");
    cy.get('input[placeholder^="Buscar"]').type("ORAL-0001");
    cy.contains("Maria Silva");
  });
});

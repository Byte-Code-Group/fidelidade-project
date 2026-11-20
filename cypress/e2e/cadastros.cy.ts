import { waitHydrated } from "../support/fill";

const stamp = Date.now();

describe("cadastros", () => {
  it("dono cria conta, configura o negócio e chega na escolha de plano", () => {
    cy.visit("/conta/cadastro");
    waitHydrated('input[name="name"]');
    cy.get('input[name="name"]').type("Dono E2E");
    cy.get('input[name="email"]').type(`dono+${stamp}@teste.com`);
    cy.get('input[name="password"]').type(`Fidel-${stamp}-ok`);
    cy.get('input[name="confirm"]').type(`Fidel-${stamp}-ok`);
    cy.get("#terms").check();
    cy.get('form button[type="submit"]').click();
    cy.location("pathname", { timeout: 20000 }).should("match", /^\/(painel|conta\/configurar)/);
    cy.assertPageOk();

    cy.visit("/conta/configurar");
    waitHydrated('input[name="business_name"]');
    cy.get('input[name="business_name"]').type(`Negócio E2E ${stamp}`);
    cy.get('select[name="segment"]').select("academia");
    cy.get('input[name="owner_cpf_cnpj"]').type("52998224725");
    cy.get('input[name="phone"]').type("11987654321");
    cy.get('input[name="business_name"]').closest("form").find('button[type="submit"]').click();
    cy.location("pathname", { timeout: 20000 }).should("eq", "/conta/planos");
    cy.assertPageOk();
  });

  it("cliente se cadastra no portal e cai na carteirinha", () => {
    cy.visit("/p/oraldents/cadastro");
    waitHydrated('input[name="full_name"]');
    cy.get('input[name="full_name"]').type("Cliente Portal E2E");
    cy.get('input[name="email"]').type(`cliente+${stamp}@teste.com`);
    cy.get('input[name="password"]').type(`Fidel-${stamp}-ok`);
    cy.get('input[name="full_name"]').closest("form").find('button[type="submit"]').click();
    cy.location("pathname", { timeout: 20000 }).should("not.contain", "cadastro");
    cy.contains("Cliente Portal E2E");
    cy.contains(/ORALDE-[A-Z0-9]{6}/);
  });
});

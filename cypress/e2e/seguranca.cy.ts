import { waitHydrated } from "../support/fill";

const stamp = Date.now();

function entrar(path: string, email: string, senha: string) {
  cy.visit(path);
  waitHydrated('input[name="email"]');
  cy.get('input[name="email"]').clear().type(email);
  cy.get('input[name="password"]').clear().type(senha, { log: false });
  cy.get('form button[type="submit"]').click();
}

describe("segurança do login", () => {
  it("bloqueia a conta depois de 5 senhas erradas", () => {
    const email = `ninguem+${stamp}@teste.com`;
    for (let i = 0; i < 5; i++) {
      entrar("/conta/login", email, `errada-${i}`);
      cy.contains("[data-sonner-toast]", "E-mail ou senha incorretos", { timeout: 15000 });
    }
    entrar("/conta/login", email, "errada-final");
    cy.contains("[data-sonner-toast]", "Muitas tentativas", { timeout: 15000 });
  });

  it("recusa senha curta no cadastro do portal", () => {
    cy.visit("/p/oraldents/cadastro");
    waitHydrated('input[name="full_name"]');
    cy.get('input[name="full_name"]').type("Senha Curta");
    cy.get('input[name="email"]').type(`curta+${stamp}@teste.com`);
    cy.get('input[name="password"]').type("abc12");
    cy.get('input[name="full_name"]').closest("form").find('button[type="submit"]').click();
    cy.contains("pelo menos 8 caracteres", { timeout: 15000 });
  });

  it("conta de um negócio não entra no portal de outro", () => {
    cy.task("otherTenantSlug").then((slug) => {
      if (!slug) return;
      entrar(`/p/${slug}/login`, "paciente@oraldents.com.br", "senha123");
      cy.contains("não está cadastrada neste negócio", { timeout: 15000 });
    });
  });

  it("verificação em duas etapas: ativa, exige código no login e desativa", () => {
    const email = `mfa+${stamp}@oraldents.com.br`;
    const senha = "Senha-E2E-forte-2026";
    cy.task("createOwner", email);

    entrar("/conta/login", email, senha);
    cy.location("pathname", { timeout: 20000 }).should("match", /^\/painel/);

    cy.visit("/painel/seguranca");
    waitHydrated("button:contains('Ativar verificação')");
    cy.contains("button", "Ativar verificação em duas etapas").click();
    cy.get("code", { timeout: 15000 })
      .invoke("text")
      .then((secret) => {
        cy.task("totp", secret.trim(), { timeout: 40000 }).then((code) => {
          cy.get('input[aria-label="Código de 6 dígitos"]').type(String(code));
          cy.contains("button", "Confirmar e ativar").click();
        });
        cy.contains("[data-sonner-toast]", "ativada", { timeout: 15000 });

        // Novo login: a senha sozinha não entra mais.
        cy.clearAllCookies();
        entrar("/conta/login", email, senha);
        cy.location("pathname", { timeout: 20000 }).should("eq", "/conta/verificar");
        cy.visit("/painel/clientes");
        cy.location("pathname").should("eq", "/conta/verificar");
        // Trocar senha também exige o código antes (o GoTrue recusa em aal1).
        cy.visit("/conta/redefinir-senha");
        cy.location("search").should("contain", "next=/conta/redefinir-senha");
        cy.visit("/conta/verificar");

        waitHydrated('input[name="code"]');
        cy.get('input[name="code"]').type("000000");
        cy.contains("button", "Verificar").click();
        cy.contains("Código inválido", { timeout: 15000 });

        cy.task("totp", secret.trim(), { timeout: 40000 }).then((code) => {
          cy.get('input[name="code"]').type(String(code));
          cy.contains("button", "Verificar").click();
        });
        cy.location("pathname", { timeout: 20000 }).should("eq", "/painel");

        cy.visit("/painel/seguranca");
        cy.contains("Ativa");
        waitHydrated("button:contains('Desativar')");
        cy.contains("button", "Desativar").click();
        cy.task("totp", secret.trim(), { timeout: 40000 }).then((code) => {
          cy.get('input[aria-label="Código de 6 dígitos"]').type(String(code));
          cy.contains("button", "Confirmar desativação").click();
        });
        cy.contains("[data-sonner-toast]", "desativada", { timeout: 15000 });
      });
  });
});

export {};

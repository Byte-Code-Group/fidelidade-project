declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      login(area: "painel" | "portal" | "superadmin"): Chainable<void>;
      assertPageOk(): Chainable<void>;
    }
  }
}

const AREAS = {
  painel: { path: "/conta/login", email: "dono@oraldents.com.br" },
  portal: { path: "/p/oraldents/login", email: "paciente@oraldents.com.br" },
  superadmin: { path: "/superadmin/login", email: "admin@plataforma.com" },
} as const;

Cypress.Commands.add("login", (area) => {
  const a = AREAS[area];
  cy.session(area, () => {
    cy.visit(a.path);
    cy.get('input[name="email"]').type(a.email);
    cy.get('input[name="password"]').type("senha123", { log: false });
    cy.get('form button[type="submit"]').click();
    // Portal em modo /p/<slug> volta pra "/" (o cookie resolve o tenant), então
    // confere a área pelo botão de sair, não pela URL.
    cy.location("pathname", { timeout: 20000 }).should("not.contain", "/login");
    cy.contains("Sair").should("exist");
  });
});

// Página renderizou sem cair em error boundary / 404.
Cypress.Commands.add("assertPageOk", () => {
  cy.get("body").should("be.visible");
  cy.contains("Algo deu errado").should("not.exist");
  cy.contains("Página não encontrada").should("not.exist");
  cy.contains("Application error").should("not.exist");
});

// O runner do Cypress injeta um <script> com espaço em branco no <head>; o nó de
// texto quebra a hidratação do root layout (Chrome normal hidrata limpo) e o
// React re-renderiza a página, apagando o que o teste já digitou. Remove o nó
// antes do React hidratar.
Cypress.on("window:before:load", (win) => {
  const obs = new win.MutationObserver(() => {
    win.document.head?.childNodes.forEach((n) => {
      if (n.nodeType === 3 && !n.textContent?.trim()) n.remove();
    });
  });
  obs.observe(win.document, { childList: true, subtree: true });
  win.addEventListener("DOMContentLoaded", () => obs.disconnect());
});

// "<Componente> cannot have a negative time stamp": performance.measure das perf
// tracks do React 19.2 em dev, quando um render é abortado por redirect. Não
// existe no build de produção.
Cypress.on("uncaught:exception", (err) => !/negative time stamp/.test(err.message));

export {};

const PAGES = [
  "",
  "/agendamentos",
  "/atendente",
  "/checkin",
  "/documentos",
  "/engajamento",
  "/historico",
  "/loja",
  "/parcerias",
  "/perfil",
  "/planos",
  "/tratamentos",
];

describe("portal do cliente", () => {
  beforeEach(() => cy.login("portal"));

  PAGES.forEach((p) => {
    it(`abre /p/oraldents${p}`, () => {
      cy.visit(`/p/oraldents${p}`);
      cy.location("pathname").should("not.contain", "/login");
      cy.assertPageOk();
    });
  });
});

export {};

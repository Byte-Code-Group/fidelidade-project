const TENANT = "00000000-0000-0000-0000-000000000001";
const PAGES = [
  "/superadmin",
  "/superadmin/empresas",
  "/superadmin/faturamento",
  "/superadmin/relatorios",
  "/superadmin/seguranca",
  "/superadmin/templates",
  "/superadmin/templates/odonto",
  "/superadmin/demo/odonto",
  "/superadmin/tenants/new",
  ...[
    "",
    "/agenda",
    "/checkin",
    "/clients",
    "/documentos",
    "/missions",
    "/partnerships",
    "/plans",
    "/profile-fields",
    "/redemptions",
    "/rewards",
    "/tratamentos",
    "/validations",
  ].map((p) => `/superadmin/tenants/${TENANT}${p}`),
];

describe("superadmin", () => {
  beforeEach(() => cy.login("superadmin"));

  PAGES.forEach((path) => {
    it(`abre ${path}`, () => {
      cy.visit(path);
      cy.location("pathname").should("not.contain", "/login");
      cy.assertPageOk();
    });
  });
});

export {};

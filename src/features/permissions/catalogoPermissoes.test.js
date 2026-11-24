import { PERMS_GRUPOS, PERMS_PADRAO, PERMS_SEM_EFEITO, gruposVisiveis, userHasPerm } from "./permissions";

const todasChaves = PERMS_GRUPOS.flatMap(g => g.items.map(i => i.key));

test("toda permissão sem efeito existe no catálogo", () => {
  for (const k of PERMS_SEM_EFEITO) expect(todasChaves).toContain(k);
});

test("o Admin não mostra permissão sem efeito, e grupo vazio some", () => {
  const visiveis = gruposVisiveis().flatMap(g => g.items.map(i => i.key));
  for (const k of PERMS_SEM_EFEITO) expect(visiveis).not.toContain(k);
  expect(visiveis).toContain("criarRNC");
  // Ligadas na v3.40.0 (fornecedores/IPC) e v3.41.0 (auditorias/clientes): todas no Admin.
  const outras = gruposVisiveis().find(g => g.grupo === "Outras áreas").items.map(i => i.key);
  expect(outras).toEqual(["editarFornecedores", "criarAuditorias", "editarClientes", "editarIPC", "editarIPCProdutos"]);
});

test("esconder não apaga: as chaves seguem nos padrões de cada papel", () => {
  for (const papel of Object.keys(PERMS_PADRAO)) {
    for (const k of PERMS_SEM_EFEITO) expect(k in PERMS_PADRAO[papel]).toBe(true);
  }
});

test("conta desativada não tem permissão para designação", () => {
  expect(userHasPerm({ role: "admin" }, "assinarRevisorAprovador")).toBe(true);
  expect(userHasPerm({ role: "admin", ativo: false }, "assinarRevisorAprovador")).toBe(false);
});

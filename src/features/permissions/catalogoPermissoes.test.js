import { PERMS_GRUPOS, PERMS_PADRAO, PERMS_SEM_EFEITO, gruposVisiveis } from "./permissions";

const todasChaves = PERMS_GRUPOS.flatMap(g => g.items.map(i => i.key));

test("toda permissão sem efeito existe no catálogo", () => {
  for (const k of PERMS_SEM_EFEITO) expect(todasChaves).toContain(k);
});

test("o Admin não mostra permissão sem efeito, e grupo vazio some", () => {
  const visiveis = gruposVisiveis().flatMap(g => g.items.map(i => i.key));
  for (const k of PERMS_SEM_EFEITO) expect(visiveis).not.toContain(k);
  expect(gruposVisiveis().map(g => g.grupo)).not.toContain("Outras áreas");
  expect(visiveis).toContain("criarRNC");
});

test("esconder não apaga: as chaves seguem nos padrões de cada papel", () => {
  for (const papel of Object.keys(PERMS_PADRAO)) {
    for (const k of PERMS_SEM_EFEITO) expect(k in PERMS_PADRAO[papel]).toBe(true);
  }
});

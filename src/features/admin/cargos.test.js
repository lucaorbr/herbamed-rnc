import {
  normCargo, slugCargo, novoCargoId, cargosAtivos, acharCargoPorNome,
  cargoDoUsuario, cargosParaImportar, usuariosDoCargo, pendentesDeMigracao, usuariosParaVincular,
} from "./cargos";

const cat = [
  { id: "analista-de-cq", nome: "Analista de CQ", ativo: true },
  { id: "operador-de-envase", nome: "Operador de Envase", ativo: true },
  { id: "estagiario", nome: "Estagiário", ativo: false },
];

describe("normCargo", () => {
  it("agrupa grafias equivalentes", () => {
    const esperado = "analista de cq";
    expect(normCargo("Analista de CQ")).toBe(esperado);
    expect(normCargo("  ANALISTA   DE  CQ ")).toBe(esperado);
    expect(normCargo("analista de cq")).toBe(esperado);
  });
  it("remove acento", () => {
    expect(normCargo("Estagiário")).toBe(normCargo("estagiario"));
    expect(normCargo("Técnico de Produção")).toBe("tecnico de producao");
  });
  it("tolera vazio", () => {
    expect(normCargo(null)).toBe("");
    expect(normCargo(undefined)).toBe("");
  });
});

describe("slugCargo / novoCargoId", () => {
  it("gera id legível", () => {
    expect(slugCargo("Analista de Controle de Qualidade")).toBe("analista-de-controle-de-qualidade");
  });
  it("descarta pontuação e acento", () => {
    expect(slugCargo("Técnico C.Q. (Sênior)")).toBe("tecnico-c-q-senior");
  });
  it("nunca devolve id vazio", () => {
    expect(slugCargo("!!!")).toBe("cargo");
    expect(slugCargo("")).toBe("cargo");
  });
  it("sufixa em caso de colisão", () => {
    expect(novoCargoId("Analista de CQ", cat)).toBe("analista-de-cq-2");
    expect(novoCargoId("Analista de CQ", [...cat, { id: "analista-de-cq-2" }])).toBe("analista-de-cq-3");
  });
  it("usa o slug direto quando está livre", () => {
    expect(novoCargoId("Supervisor", cat)).toBe("supervisor");
  });
});

describe("cargosAtivos", () => {
  it("filtra inativos", () => {
    expect(cargosAtivos(cat).map(c => c.id)).toEqual(["analista-de-cq", "operador-de-envase"]);
  });
  it("trata ativo ausente como ativo (compatibilidade)", () => {
    expect(cargosAtivos([{ id: "x", nome: "X" }])).toHaveLength(1);
  });
});

describe("acharCargoPorNome", () => {
  it("acha ignorando caixa e acento", () => {
    expect(acharCargoPorNome("ANALISTA DE CQ", cat)?.id).toBe("analista-de-cq");
    expect(acharCargoPorNome("estagiario", cat)?.id).toBe("estagiario");
  });
  it("nome vazio não casa com nada", () => {
    expect(acharCargoPorNome("", cat)).toBeNull();
  });
});

describe("cargoDoUsuario — os quatro estados da migração", () => {
  it("catalogo: cargoId válido usa o nome do catálogo, não o rótulo guardado", () => {
    const u = { cargoId: "analista-de-cq", cargo: "Nome Velho Desatualizado" };
    expect(cargoDoUsuario(u, cat)).toEqual({ id: "analista-de-cq", nome: "Analista de CQ", origem: "catalogo" });
  });
  it("orfao: cargoId aponta para cargo excluído — cai no rótulo guardado", () => {
    const u = { cargoId: "cargo-que-sumiu", cargo: "Auxiliar" };
    expect(cargoDoUsuario(u, cat)).toEqual({ id: "cargo-que-sumiu", nome: "Auxiliar", origem: "orfao" });
  });
  it("legado: só texto livre", () => {
    expect(cargoDoUsuario({ cargo: "Operador" }, cat)).toEqual({ id: null, nome: "Operador", origem: "legado" });
  });
  it("null: sem cargo nenhum", () => {
    expect(cargoDoUsuario({ cargo: "   " }, cat)).toBeNull();
    expect(cargoDoUsuario({}, cat)).toBeNull();
    expect(cargoDoUsuario(null, cat)).toBeNull();
  });
  it("cargo inativo ainda resolve (quem já ocupa não perde o vínculo)", () => {
    expect(cargoDoUsuario({ cargoId: "estagiario" }, cat)?.nome).toBe("Estagiário");
  });
});

describe("cargosParaImportar", () => {
  const users = [
    { cargo: "Analista de CQ" },                       // já existe no catálogo
    { cargo: "Auxiliar de Produção" },
    { cargo: "auxiliar de producao" },                 // mesma coisa, outra grafia
    { cargo: "  AUXILIAR DE PRODUÇÃO  " },             // idem
    { cargo: "Almoxarife" },
    { cargoId: "operador-de-envase", cargo: "Operador de Envase" }, // já migrado
    { cargo: "" },
    {},
  ];
  it("deduplica por grafia equivalente e conta ocorrências", () => {
    const r = cargosParaImportar(users, cat);
    expect(r).toEqual([
      { nome: "Auxiliar de Produção", quantidade: 3 },
      { nome: "Almoxarife", quantidade: 1 },
    ]);
  });
  it("mantém a primeira grafia vista como canônica", () => {
    expect(cargosParaImportar(users, cat)[0].nome).toBe("Auxiliar de Produção");
  });
  it("ignora quem já tem cargoId e quem já existe no catálogo", () => {
    expect(cargosParaImportar(users, cat).map(c => c.nome)).not.toContain("Analista de CQ");
    expect(cargosParaImportar(users, cat).map(c => c.nome)).not.toContain("Operador de Envase");
  });
  it("catálogo vazio devolve tudo que é texto livre", () => {
    expect(cargosParaImportar(users, []).map(c => c.nome)).toContain("Analista de CQ");
  });
  it("nada a importar quando todos estão migrados", () => {
    expect(cargosParaImportar([{ cargoId: "analista-de-cq" }], cat)).toEqual([]);
    expect(cargosParaImportar([], cat)).toEqual([]);
  });
});

describe("usuariosParaVincular — o furo do cargo que já existe no catálogo", () => {
  it("pega quem tem texto livre casando com cargo existente", () => {
    const users = [{ id: "1", cargo: "ANALISTA  DE cq" }, { id: "2", cargo: "Analista de CQ" }];
    const r = usuariosParaVincular(users, cat);
    expect(r).toHaveLength(2);
    expect(r.every(x => x.cargo.id === "analista-de-cq")).toBe(true);
  });
  it("ignora quem já tem cargoId", () => {
    expect(usuariosParaVincular([{ id: "1", cargoId: "analista-de-cq", cargo: "Analista de CQ" }], cat)).toEqual([]);
  });
  it("ignora texto sem correspondência — esse precisa virar cargo novo antes", () => {
    expect(usuariosParaVincular([{ id: "1", cargo: "Cargo Inexistente" }], cat)).toEqual([]);
  });
  it("casa também com cargo inativo (o vínculo é histórico, não uma escolha nova)", () => {
    expect(usuariosParaVincular([{ id: "1", cargo: "estagiario" }], cat)).toHaveLength(1);
  });
  it("complementa cargosParaImportar: juntos cobrem todo pendente de migração", () => {
    const users = [
      { id: "1", cargo: "Analista de CQ" },   // vincular (já existe)
      { id: "2", cargo: "Almoxarife" },       // importar (não existe)
      { id: "3", cargoId: "analista-de-cq" }, // já migrado
    ];
    const cobertos = usuariosParaVincular(users, cat).length + cargosParaImportar(users, cat).reduce((n, c) => n + c.quantidade, 0);
    expect(cobertos).toBe(pendentesDeMigracao(users));
  });
});

describe("usuariosDoCargo / pendentesDeMigracao", () => {
  const users = [
    { id: "1", cargoId: "analista-de-cq" },
    { id: "2", cargoId: "analista-de-cq" },
    { id: "3", cargoId: "operador-de-envase" },
    { id: "4", cargo: "Almoxarife" },
    { id: "5" },
  ];
  it("lista quem ocupa o cargo — base da herança da Fase 2", () => {
    expect(usuariosDoCargo(users, "analista-de-cq").map(u => u.id)).toEqual(["1", "2"]);
  });
  it("cargoId ausente não varre a lista inteira", () => {
    expect(usuariosDoCargo(users, null)).toEqual([]);
    expect(usuariosDoCargo(users, "")).toEqual([]);
  });
  it("conta só quem tem texto livre sem cargoId", () => {
    expect(pendentesDeMigracao(users)).toBe(1);
    expect(pendentesDeMigracao([])).toBe(0);
  });
});

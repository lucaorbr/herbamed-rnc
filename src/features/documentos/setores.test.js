import {
  exigidosDoDocumento, localDaPessoa, pessoaEmSetores, montarMatriz, exigidosSemLogin,
} from "./treinamento";

// Catálogo hierárquico Área → Setor, reusado da distribuição de cópias físicas:
// o setor que recebe a cópia controlada é onde as pessoas trabalham.
const AREAS = [
  { id: "PRO", label: "Produção", ativo: true, setores: [
    { id: "PRO-ENC", nome: "Encapsulamento", ativo: true },
    { id: "PRO-COMP", nome: "Compressão",    ativo: true },
    { id: "PRO-ENV",  nome: "Envase",        ativo: true },
  ]},
  { id: "CQ", label: "Controle de Qualidade", ativo: true, setores: [
    { id: "CQ-FQ", nome: "Físico-químico", ativo: true },
  ]},
];

const CARGOS = [
  { id: "auxiliar-de-producao", nome: "Auxiliar de Produção", ativo: true },
  { id: "supervisor",           nome: "Supervisor de Produção", ativo: true },
  { id: "analista-cq",          nome: "Analista de CQ", ativo: true },
];

// O cenário real da Herbamed hoje: encapsulamento, compressão e envase são TODOS
// "Auxiliar de Produção". O cargo não discrimina — quem separa é o setor.
const PESSOAS = [
  { id: "p1", nome: "Ana",   cargoId: "auxiliar-de-producao", setorId: "PRO-ENC",  ativo: true },
  { id: "p2", nome: "Bruno", cargoId: "auxiliar-de-producao", setorId: "PRO-ENC",  ativo: true },
  { id: "p3", nome: "Caio",  cargoId: "auxiliar-de-producao", setorId: "PRO-COMP", ativo: true },
  { id: "p4", nome: "Dora",  cargoId: "auxiliar-de-producao", setorId: "PRO-ENV",  ativo: true },
  { id: "p5", nome: "Elis",  cargoId: "supervisor",           setorId: "PRO-ENC",  ativo: true },
  { id: "p6", nome: "Fábio", cargoId: "analista-cq",          setorId: "CQ-FQ",    ativo: true },
  { id: "p7", nome: "Gina",  cargoId: "auxiliar-de-producao", setorId: null,       ativo: true }, // sem setor
];

const doc = (treinamento) => ({ id: "D1", codigo: "POP-001", versao: "01", status: "Vigente", treinamento: { exigido: true, modo: "presencial", prazoDias: 30, desdeEm: "2026-01-01", ...treinamento } });
const nomes = (r) => r.map(e => e.userName).sort();

describe("localDaPessoa", () => {
  it("resolve setor e área pelo catálogo", () => {
    expect(localDaPessoa(PESSOAS[0], AREAS)).toEqual({ setorId: "PRO-ENC", setorNome: "Encapsulamento", areaId: "PRO", areaNome: "Produção" });
  });
  it("sem setorId devolve null", () => {
    expect(localDaPessoa(PESSOAS[6], AREAS)).toBeNull();
  });
  it("setorId fora do catálogo não quebra — cai no rótulo guardado", () => {
    const r = localDaPessoa({ setorId: "FANTASMA", setor: "Setor Antigo" }, AREAS);
    expect(r).toMatchObject({ setorId: "FANTASMA", setorNome: "Setor Antigo", areaId: null });
  });
});

describe("pessoaEmSetores — área alcança os setores filhos", () => {
  it("vincular o SETOR alcança só ele", () => {
    expect(pessoaEmSetores(PESSOAS[0], ["PRO-ENC"], AREAS)).toBe(true);
    expect(pessoaEmSetores(PESSOAS[2], ["PRO-ENC"], AREAS)).toBe(false);
  });
  it("vincular a ÁREA alcança todos os setores dela", () => {
    expect(pessoaEmSetores(PESSOAS[0], ["PRO"], AREAS)).toBe(true);
    expect(pessoaEmSetores(PESSOAS[2], ["PRO"], AREAS)).toBe(true);
    expect(pessoaEmSetores(PESSOAS[5], ["PRO"], AREAS)).toBe(false);
  });
  it("lista vazia não alcança ninguém", () => {
    expect(pessoaEmSetores(PESSOAS[0], [], AREAS)).toBe(false);
  });
  it("quem não tem setor não é alcançado por filtro de setor", () => {
    expect(pessoaEmSetores(PESSOAS[6], ["PRO"], AREAS)).toBe(false);
  });
});

describe("exigidosDoDocumento — só cargos (comportamento anterior preservado)", () => {
  it("pega todos do cargo, em qualquer setor", () => {
    const r = exigidosDoDocumento(doc({ cargos: ["auxiliar-de-producao"] }), PESSOAS, CARGOS, AREAS);
    expect(nomes(r)).toEqual(["Ana", "Bruno", "Caio", "Dora", "Gina"]);
  });
  it("documento sem `setores` funciona como antes — nada quebra", () => {
    const semCampo = doc({ cargos: ["analista-cq"] });
    delete semCampo.treinamento.setores;
    expect(nomes(exigidosDoDocumento(semCampo, PESSOAS, CARGOS, AREAS))).toEqual(["Fábio"]);
  });
});

describe("exigidosDoDocumento — só setores", () => {
  it("pega todo mundo do setor, em qualquer cargo", () => {
    const r = exigidosDoDocumento(doc({ setores: ["PRO-ENC"] }), PESSOAS, CARGOS, AREAS);
    expect(nomes(r)).toEqual(["Ana", "Bruno", "Elis"]); // inclui o supervisor
  });
  it("vincular a área inteira pega os três setores de produção", () => {
    const r = exigidosDoDocumento(doc({ setores: ["PRO"] }), PESSOAS, CARGOS, AREAS);
    expect(nomes(r)).toEqual(["Ana", "Bruno", "Caio", "Dora", "Elis"]);
  });
  it("marca a origem como setor", () => {
    const r = exigidosDoDocumento(doc({ setores: ["CQ"] }), PESSOAS, CARGOS, AREAS);
    expect(r[0]).toMatchObject({ userName: "Fábio", origem: "setor" });
  });
});

describe("exigidosDoDocumento — INTERSEÇÃO quando cargo e setor estão preenchidos", () => {
  it("resolve o caso real: auxiliar QUE TRABALHA no encapsulamento", () => {
    const r = exigidosDoDocumento(doc({ cargos: ["auxiliar-de-producao"], setores: ["PRO-ENC"] }), PESSOAS, CARGOS, AREAS);
    expect(nomes(r)).toEqual(["Ana", "Bruno"]);
  });
  it("exclui o mesmo cargo em OUTRO setor", () => {
    const r = exigidosDoDocumento(doc({ cargos: ["auxiliar-de-producao"], setores: ["PRO-ENC"] }), PESSOAS, CARGOS, AREAS);
    expect(nomes(r)).not.toContain("Caio"); // auxiliar, mas da compressão
    expect(nomes(r)).not.toContain("Dora"); // auxiliar, mas do envase
  });
  it("exclui OUTRO cargo no mesmo setor", () => {
    const r = exigidosDoDocumento(doc({ cargos: ["auxiliar-de-producao"], setores: ["PRO-ENC"] }), PESSOAS, CARGOS, AREAS);
    expect(nomes(r)).not.toContain("Elis"); // supervisor do encapsulamento
  });
  it("interseção com área: auxiliares de toda a produção", () => {
    const r = exigidosDoDocumento(doc({ cargos: ["auxiliar-de-producao"], setores: ["PRO"] }), PESSOAS, CARGOS, AREAS);
    expect(nomes(r)).toEqual(["Ana", "Bruno", "Caio", "Dora"]); // Gina fica fora: sem setor
  });
  it("marca a origem como cargo+setor", () => {
    const r = exigidosDoDocumento(doc({ cargos: ["auxiliar-de-producao"], setores: ["PRO-ENC"] }), PESSOAS, CARGOS, AREAS);
    expect(r[0].origem).toBe("cargo+setor");
  });
  it("combinação que não casa com ninguém devolve vazio", () => {
    const r = exigidosDoDocumento(doc({ cargos: ["analista-cq"], setores: ["PRO-ENC"] }), PESSOAS, CARGOS, AREAS);
    expect(r).toEqual([]);
  });
});

describe("exceções nominais somam por fora da regra", () => {
  it("entra mesmo sem casar cargo nem setor", () => {
    const r = exigidosDoDocumento(doc({ cargos: ["auxiliar-de-producao"], setores: ["PRO-ENC"], pessoasExtra: ["p6"] }), PESSOAS, CARGOS, AREAS);
    expect(nomes(r)).toEqual(["Ana", "Bruno", "Fábio"]);
    expect(r.find(e => e.userName === "Fábio").origem).toBe("extra");
  });
  it("não duplica quem já entrou pela regra", () => {
    const r = exigidosDoDocumento(doc({ setores: ["PRO-ENC"], pessoasExtra: ["p1"] }), PESSOAS, CARGOS, AREAS);
    expect(r.filter(e => e.userName === "Ana")).toHaveLength(1);
    expect(r.find(e => e.userName === "Ana").origem).toBe("setor");
  });
  it("sem cargo e sem setor, só os nominais são exigidos", () => {
    const r = exigidosDoDocumento(doc({ pessoasExtra: ["p3"] }), PESSOAS, CARGOS, AREAS);
    expect(nomes(r)).toEqual(["Caio"]);
  });
});

describe("integração com o resto da matriz", () => {
  it("desligado continua fora, mesmo casando cargo e setor", () => {
    const comDesligado = [...PESSOAS, { id: "p8", nome: "Hugo", cargoId: "auxiliar-de-producao", setorId: "PRO-ENC", ativo: false }];
    const r = exigidosDoDocumento(doc({ cargos: ["auxiliar-de-producao"], setores: ["PRO-ENC"] }), comDesligado, CARGOS, AREAS);
    expect(nomes(r)).toEqual(["Ana", "Bruno"]);
  });

  it("montarMatriz conta as exigências da regra combinada", () => {
    const m = montarMatriz({
      docs: [doc({ cargos: ["auxiliar-de-producao"], setores: ["PRO-ENC"] })],
      pessoas: PESSOAS, evidencias: [], catalogoCargos: CARGOS, catalogoAreas: AREAS, hoje: "2026-08-06",
    });
    expect(m.resumo.total).toBe(2);
    expect(m.linhas.map(l => l.userName).sort()).toEqual(["Ana", "Bruno"]);
  });

  it("a linha da matriz traz o nome do setor resolvido, não o id", () => {
    const m = montarMatriz({
      docs: [doc({ setores: ["PRO-ENC"] })],
      pessoas: PESSOAS, evidencias: [], catalogoCargos: CARGOS, catalogoAreas: AREAS, hoje: "2026-08-06",
    });
    expect(m.linhas[0].setor).toBe("Encapsulamento");
    expect(m.linhas[0].areaNome).toBe("Produção");
  });

  it("aviso de sem-login continua valendo com filtro de setor", () => {
    const semLogin = [{ id: "p9", nome: "Ivo", cargoId: "auxiliar-de-producao", setorId: "PRO-ENC", ativo: true, userId: null }];
    const d = doc({ modo: "leitura", setores: ["PRO-ENC"] });
    expect(exigidosSemLogin(d, semLogin, CARGOS, AREAS).map(e => e.userName)).toEqual(["Ivo"]);
  });
});

describe("transição quando o RH desmembrar os cargos", () => {
  // Hoje o documento filtra por [Auxiliar de Produção] + [Encapsulamento].
  // Quando o RH criar "Operador de Encapsulamento" e mover as pessoas, o filtro
  // de cargo deixa de casar e o documento resolve para ZERO — silenciosamente.
  // Este teste fixa esse comportamento para que o aviso de tela tenha o que pegar.
  it("desmembrar o cargo sem atualizar o documento zera a exigência", () => {
    const depois = PESSOAS.map(p =>
      p.setorId === "PRO-ENC" && p.cargoId === "auxiliar-de-producao"
        ? { ...p, cargoId: "operador-de-encapsulamento" } : p);
    const d = doc({ cargos: ["auxiliar-de-producao"], setores: ["PRO-ENC"] });
    expect(exigidosDoDocumento(d, depois, CARGOS, AREAS)).toEqual([]);
  });

  it("com o filtro só por setor, o desmembramento não afeta nada", () => {
    const depois = PESSOAS.map(p =>
      p.setorId === "PRO-ENC" && p.cargoId === "auxiliar-de-producao"
        ? { ...p, cargoId: "operador-de-encapsulamento" } : p);
    const d = doc({ setores: ["PRO-ENC"] });
    expect(nomes(exigidosDoDocumento(d, depois, CARGOS, AREAS))).toEqual(["Ana", "Bruno", "Elis"]);
  });
});

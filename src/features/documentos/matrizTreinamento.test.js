import {
  documentoExigeTreinamento, exigidosDoDocumento, indexarEvidencias, statusCelula,
  montarMatriz, pendentesDoUsuario, planoMigracaoTreinamento, chaveEvidencia,
  somarMeses, vencimentoDaEvidencia, filaDeReciclagem,
} from "./treinamento";

const cargos = [
  { id: "analista-cq", nome: "Analista de CQ", ativo: true },
  { id: "operador", nome: "Operador", ativo: true },
];
const users = [
  { id: "u1", name: "Ana",  setor: "CQ",  cargoId: "analista-cq" },
  { id: "u2", name: "Beto", setor: "CQ",  cargoId: "analista-cq" },
  { id: "u3", name: "Caio", setor: "PRO", cargoId: "operador" },
  { id: "u4", name: "Dara", setor: "ADM" },                       // sem cargo
];
const doc = (over = {}) => ({
  id: "D1", codigo: "POP-001", titulo: "POP", versao: "02", status: "Vigente",
  atualizadoEm: "2026-07-01",
  treinamento: { exigido: true, modo: "leitura", cargos: ["analista-cq"], pessoasExtra: [], prazoDias: 30, desdeEm: "2026-07-01" },
  ...over,
});
const ev = (over = {}) => ({ docId: "D1", versao: "02", userId: "u1", ts: 1, ...over });

describe("documentoExigeTreinamento — só documento vigente exige", () => {
  it("vigente e exigido", () => expect(documentoExigeTreinamento(doc())).toBe(true));
  it("em revisão não exige — não se treina em rascunho", () => {
    expect(documentoExigeTreinamento(doc({ status: "Em Revisão" }))).toBe(false);
    expect(documentoExigeTreinamento(doc({ status: "Rascunho" }))).toBe(false);
    expect(documentoExigeTreinamento(doc({ status: "Obsoleto" }))).toBe(false);
  });
  it("sem exigência configurada", () => {
    expect(documentoExigeTreinamento(doc({ treinamento: { exigido: false } }))).toBe(false);
    expect(documentoExigeTreinamento(doc({ treinamento: undefined }))).toBe(false);
  });
});

describe("exigidosDoDocumento — herança por cargo", () => {
  it("todo mundo do cargo entra, sem lista nominal", () => {
    expect(exigidosDoDocumento(doc(), users, cargos).map(e => e.userId)).toEqual(["u1", "u2"]);
  });
  it("resolve o nome do cargo pelo catálogo", () => {
    expect(exigidosDoDocumento(doc(), users, cargos)[0].cargoNome).toBe("Analista de CQ");
  });
  it("quem não tem cargo não herda nada", () => {
    expect(exigidosDoDocumento(doc(), users, cargos).map(e => e.userId)).not.toContain("u4");
  });
  it("exceção nominal entra além do cargo", () => {
    const d = doc({ treinamento: { ...doc().treinamento, pessoasExtra: ["u3"] } });
    const r = exigidosDoDocumento(d, users, cargos);
    expect(r.map(e => e.userId).sort()).toEqual(["u1", "u2", "u3"]);
    expect(r.find(e => e.userId === "u3").origem).toBe("extra");
  });
  it("não duplica quem já entrou pelo cargo", () => {
    const d = doc({ treinamento: { ...doc().treinamento, pessoasExtra: ["u1"] } });
    const r = exigidosDoDocumento(d, users, cargos);
    expect(r.filter(e => e.userId === "u1")).toHaveLength(1);
    expect(r.find(e => e.userId === "u1").origem).toBe("cargo");
  });
  it("pessoaExtra inexistente é ignorada", () => {
    const d = doc({ treinamento: { ...doc().treinamento, pessoasExtra: ["fantasma"] } });
    expect(exigidosDoDocumento(d, users, cargos).map(e => e.userId)).toEqual(["u1", "u2"]);
  });
  it("novo contratado no cargo já nasce exigido — sem tocar no documento", () => {
    const comNovato = [...users, { id: "u9", name: "Novato", cargoId: "analista-cq" }];
    expect(exigidosDoDocumento(doc(), comNovato, cargos).map(e => e.userId)).toContain("u9");
  });
});

describe("statusCelula", () => {
  const indice = indexarEvidencias([ev()]);
  it("com evidência da versão vigente: treinado", () => {
    expect(statusCelula({ doc: doc(), userId: "u1", indice, hoje: "2026-08-05" }).status).toBe("treinado");
  });
  it("sem evidência, dentro do prazo: pendente", () => {
    const d = doc({ treinamento: { ...doc().treinamento, desdeEm: "2026-08-01" } });
    expect(statusCelula({ doc: d, userId: "u2", indice, hoje: "2026-08-05" }).status).toBe("pendente");
  });
  it("sem evidência, prazo estourado: atrasado", () => {
    const r = statusCelula({ doc: doc(), userId: "u2", indice, hoje: "2026-08-05" });
    expect(r.status).toBe("atrasado");
    expect(r.dias).toBe(35);
  });
  it("evidência de OUTRA versão não conta — a revisão reabre sozinha", () => {
    const ind = indexarEvidencias([ev({ versao: "01" })]);
    expect(statusCelula({ doc: doc(), userId: "u1", indice: ind, hoje: "2026-08-05" }).status).toBe("atrasado");
  });
  it("prazo customizado do documento é respeitado", () => {
    const d = doc({ treinamento: { ...doc().treinamento, prazoDias: 90 } });
    expect(statusCelula({ doc: d, userId: "u2", indice, hoje: "2026-08-05" }).status).toBe("pendente");
  });
});

describe("indexarEvidencias", () => {
  it("mantém a evidência mais recente em caso de duplicata", () => {
    const i = indexarEvidencias([ev({ ts: 1, obs: "velha" }), ev({ ts: 9, obs: "nova" })]);
    expect(i.get(chaveEvidencia("D1", "02", "u1")).obs).toBe("nova");
  });
  it("ignora registro sem docId ou userId", () => {
    expect(indexarEvidencias([{ versao: "02" }, null]).size).toBe(0);
  });
});

describe("montarMatriz", () => {
  const docs = [doc(), doc({ id: "D2", codigo: "POP-002", treinamento: { ...doc().treinamento, cargos: ["operador"] } })];
  const base = { docs, pessoas: users, catalogoCargos: cargos, hoje: "2026-08-05" };

  it("colunas só com documentos que exigem treinamento", () => {
    const m = montarMatriz({ ...base, docs: [...docs, doc({ id: "D3", status: "Rascunho" })], evidencias: [] });
    expect(m.colunas.map(c => c.id)).toEqual(["D1", "D2"]);
  });
  it("linhas só de quem tem alguma exigência", () => {
    const m = montarMatriz({ ...base, evidencias: [] });
    expect(m.linhas.map(l => l.userId).sort()).toEqual(["u1", "u2", "u3"]);
  });
  it("conta treinado, pendente e atrasado", () => {
    const m = montarMatriz({ ...base, evidencias: [ev()] });
    expect(m.resumo.total).toBe(3);
    expect(m.resumo.treinado).toBe(1);
    expect(m.resumo.atrasado).toBe(2);
  });
  it("conformidade em porcentagem", () => {
    expect(montarMatriz({ ...base, evidencias: [ev()] }).resumo.conformidade).toBe(33);
    expect(montarMatriz({ ...base, evidencias: [] }).resumo.conformidade).toBe(0);
  });
  it("matriz vazia é 100% conforme, não 0%", () => {
    expect(montarMatriz({ ...base, docs: [], evidencias: [] }).resumo.conformidade).toBe(100);
  });
  it("agrupa por cargo na ordenação", () => {
    const m = montarMatriz({ ...base, evidencias: [] });
    expect(m.linhas.map(l => l.cargoNome)).toEqual(["Analista de CQ", "Analista de CQ", "Operador"]);
  });
});

describe("pendentesDoUsuario", () => {
  const docs = [doc(), doc({ id: "D2", codigo: "POP-002" })];
  it("lista o que a pessoa deve", () => {
    const r = pendentesDoUsuario({ docs, pessoas: users, evidencias: [], catalogoCargos: cargos, userId: "u1", hoje: "2026-08-05" });
    expect(r).toHaveLength(2);
  });
  it("some da lista ao registrar a evidência", () => {
    const r = pendentesDoUsuario({ docs, pessoas: users, evidencias: [ev(), ev({ docId: "D2" })], catalogoCargos: cargos, userId: "u1", hoje: "2026-08-05" });
    expect(r).toEqual([]);
  });
  it("quem não é exigido não tem pendência", () => {
    expect(pendentesDoUsuario({ docs, pessoas: users, evidencias: [], catalogoCargos: cargos, userId: "u4", hoje: "2026-08-05" })).toEqual([]);
  });
});

describe("planoMigracaoTreinamento", () => {
  const docLegado = {
    id: "L1", codigo: "POP-L", versao: "02", status: "Vigente", atualizadoEm: "2026-06-01",
    treinamentoObrigatorio: true,
    leituraObrigatoria: { atribuido: true, designados: [
      { userId: "u1", userName: "Ana",  confirmou: true,  confirmedoEm: "2026-06-10T10:00:00Z" },
      { userId: "u2", userName: "Beto", confirmou: false, confirmedoEm: null },
    ]},
  };
  const treinos = { L1: [
    { userId: "u3", userName: "Caio", versao: "02", dataRealizacao: "2026-06-11" },
    { userId: "u4", userName: "Dara", versao: "01", dataRealizacao: "2026-01-05" }, // versão antiga
    { userId: "u2", userName: "Beto", dataRealizacao: "2026-02-02" },               // sem versão (legado)
  ]};
  const plano = () => planoMigracaoTreinamento({ docs: [docLegado], treinosPorDoc: treinos, evidencias: [] });

  it("confirmação de leitura vira evidência", () => {
    expect(plano().evidencias.find(e => e.userId === "u1"))
      .toMatchObject({ modo: "leitura", versao: "02", dataRealizacao: "2026-06-10", origem: "migracao" });
  });
  it("quem não confirmou não vira evidência", () => {
    expect(plano().evidencias.filter(e => e.userId === "u2" && e.modo === "leitura")).toHaveLength(0);
  });
  it("treinamento presencial da versão vigente vira evidência", () => {
    expect(plano().evidencias.find(e => e.userId === "u3")).toMatchObject({ modo: "presencial", versao: "02" });
  });
  it("registro de versão antiga ou sem versão NÃO migra — não se presume atual", () => {
    expect(plano().evidencias.map(e => e.userId)).not.toContain("u4");
    expect(plano().evidencias.filter(e => e.userId === "u2")).toHaveLength(0);
  });
  it("designados viram pessoasExtra — não dá para inferir cargo do passado", () => {
    expect(plano().patches[0].treinamento)
      .toMatchObject({ exigido: true, modo: "leitura", cargos: [], pessoasExtra: ["u1", "u2"] });
  });
  it("é idempotente: rodar de novo não duplica evidência", () => {
    const p1 = plano();
    const p2 = planoMigracaoTreinamento({ docs: [docLegado], treinosPorDoc: treinos, evidencias: p1.evidencias });
    expect(p2.evidencias).toEqual([]);
    expect(p2.jaMigrados).toBe(2);
  });
  it("documento já migrado não recebe patch de novo", () => {
    const jaTem = { ...docLegado, treinamento: { exigido: true, modo: "leitura", cargos: ["analista-cq"] } };
    expect(planoMigracaoTreinamento({ docs: [jaTem], treinosPorDoc: treinos, evidencias: [] }).patches).toEqual([]);
  });
  it("documento sem nenhum controle antigo é ignorado", () => {
    expect(planoMigracaoTreinamento({ docs: [{ id: "X", versao: "01" }], treinosPorDoc: {}, evidencias: [] }))
      .toEqual({ evidencias: [], patches: [], jaMigrados: 0 });
  });
});

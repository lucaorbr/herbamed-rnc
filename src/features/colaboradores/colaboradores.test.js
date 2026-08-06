import {
  normMatricula, normNome, temLogin, colaboradoresAtivos, novoColaborador,
  planoMigracaoColaboradores, planoImportacaoColaboradores, parseCSVColaboradores, normData,
} from "./colaboradores";
import { exigidosDoDocumento, statusCelula, indexarEvidencias, exigidosSemLogin, montarMatriz } from "../documentos/treinamento";

const CARGOS = [
  { id: "operador-de-encapsulamento", nome: "Operador de Encapsulamento", ativo: true },
  { id: "analista-de-cq",             nome: "Analista de CQ",             ativo: true },
];

const doc = (over = {}) => ({
  id: "d1", codigo: "POP-001", titulo: "Higienização", versao: "02", status: "Vigente",
  treinamento: { exigido: true, modo: "presencial", cargos: ["operador-de-encapsulamento"], pessoasExtra: [], prazoDias: 30, desdeEm: "2026-01-01" },
  ...over,
});

describe("normalização", () => {
  it("matrícula ignora pontuação, caixa e zeros à esquerda", () => {
    expect(normMatricula("00123")).toBe("123");
    expect(normMatricula(" mat-123 ")).toBe("MAT123");
    expect(normMatricula("123")).toBe(normMatricula("0123"));
  });

  it("matrícula de zeros não vira string vazia", () => {
    expect(normMatricula("000")).toBe("0");
  });

  it("matrícula ausente é string vazia", () => {
    expect(normMatricula(null)).toBe("");
    expect(normMatricula(undefined)).toBe("");
  });

  it("nome colapsa acento e caixa", () => {
    expect(normNome("Otávio  LINS")).toBe(normNome("otavio lins"));
  });

  it("data aceita dd/mm/aaaa e ISO", () => {
    expect(normData("05/03/2024")).toBe("2024-03-05");
    expect(normData("2024-03-05")).toBe("2024-03-05");
    expect(normData("")).toBeNull();
    expect(normData("qualquer coisa")).toBeNull();
  });
});

describe("temLogin / ativos", () => {
  it("distingue quem tem conta de quem não tem", () => {
    expect(temLogin({ userId: "u1" })).toBe(true);
    expect(temLogin({ userId: null })).toBe(false);
    expect(temLogin(null)).toBe(false);
  });

  it("colaboradoresAtivos exclui desligado, mantém quem não tem o campo", () => {
    const l = [{ id: "a" }, { id: "b", ativo: true }, { id: "c", ativo: false }];
    expect(colaboradoresAtivos(l).map(c => c.id)).toEqual(["a", "b"]);
  });
});

describe("planoMigracaoColaboradores", () => {
  const users = [
    { id: "u1", name: "Natália", cargoId: "analista-de-cq", setor: "Qualidade" },
    { id: "u2", name: "Otávio",  cargoId: "analista-de-cq", setor: "Qualidade" },
    { id: "u3", name: "Sem Cargo" },
  ];

  it("PRESERVA o id do usuário — é o que mantém a evidência antiga válida", () => {
    const { novos } = planoMigracaoColaboradores({ users, colaboradores: [], catalogoCargos: CARGOS });
    expect(novos.map(c => c.id)).toEqual(["u1", "u2"]);
    expect(novos.every(c => c.id === c.userId)).toBe(true);
  });

  it("usuário sem cargo não migra, mas é reportado", () => {
    const { novos, semCargo } = planoMigracaoColaboradores({ users, colaboradores: [], catalogoCargos: CARGOS });
    expect(novos.some(c => c.id === "u3")).toBe(false);
    expect(semCargo).toEqual([{ id: "u3", nome: "Sem Cargo" }]);
  });

  it("é idempotente — rodar de novo não recria ninguém", () => {
    const primeira = planoMigracaoColaboradores({ users, colaboradores: [], catalogoCargos: CARGOS });
    const segunda = planoMigracaoColaboradores({ users, colaboradores: primeira.novos, catalogoCargos: CARGOS });
    expect(segunda.novos).toHaveLength(0);
    expect(segunda.jaMigrados).toBe(2);
  });

  it("traz o rótulo do cargo do catálogo", () => {
    const { novos } = planoMigracaoColaboradores({ users, colaboradores: [], catalogoCargos: CARGOS });
    expect(novos[0].cargoNome).toBe("Analista de CQ");
  });

  it("evidência antiga continua resolvendo depois da migração", () => {
    // A invariante central da Fase 6: nenhuma evidência foi reescrita.
    const { novos } = planoMigracaoColaboradores({ users, colaboradores: [], catalogoCargos: CARGOS });
    const d = doc({ treinamento: { ...doc().treinamento, cargos: ["analista-de-cq"] } });
    const ev = { id: "e1", docId: "d1", versao: "02", userId: "u1", dataRealizacao: "2026-02-01", ts: 1 };
    const cel = statusCelula({ doc: d, userId: "u1", indice: indexarEvidencias([ev]), hoje: "2026-08-06" });
    expect(cel.status).toBe("treinado");
    expect(exigidosDoDocumento(d, novos, CARGOS).map(e => e.userId)).toEqual(["u1", "u2"]);
  });
});

describe("planoImportacaoColaboradores", () => {
  const existentes = [
    novoColaborador({ id: "c1", nome: "Adriana Moreira", matricula: "100", cargoId: "operador-de-encapsulamento", cargoNome: "Operador de Encapsulamento" }),
  ];

  it("cria quem não existe", () => {
    const r = planoImportacaoColaboradores({
      linhas: [{ nome: "Bruno Cardoso", matricula: "200", cargo: "Operador de Encapsulamento" }],
      colaboradores: existentes, catalogoCargos: CARGOS,
    });
    expect(r.criar).toHaveLength(1);
    expect(r.criar[0].nome).toBe("Bruno Cardoso");
    expect(r.atualizar).toHaveLength(0);
  });

  it("reimportar a mesma planilha atualiza em vez de duplicar", () => {
    const linhas = [{ nome: "Adriana Moreira", matricula: "100", cargo: "Analista de CQ" }];
    const r = planoImportacaoColaboradores({ linhas, colaboradores: existentes, catalogoCargos: CARGOS });
    expect(r.criar).toHaveLength(0);
    expect(r.atualizar).toHaveLength(1);
    expect(r.atualizar[0].id).toBe("c1");
    expect(r.atualizar[0].campos.cargoId).toBe("analista-de-cq");
  });

  it("casa por matrícula mesmo com zeros à esquerda e grafia diferente do nome", () => {
    const r = planoImportacaoColaboradores({
      linhas: [{ nome: "ADRIANA M.", matricula: "0100", cargo: "Analista de CQ" }],
      colaboradores: existentes, catalogoCargos: CARGOS,
    });
    expect(r.atualizar).toHaveLength(1);
    expect(r.atualizar[0].id).toBe("c1");
  });

  it("sem matrícula, casa por nome normalizado", () => {
    const r = planoImportacaoColaboradores({
      linhas: [{ nome: "adriana  moreira", cargo: "Analista de CQ" }],
      colaboradores: existentes, catalogoCargos: CARGOS,
    });
    expect(r.atualizar).toHaveLength(1);
    expect(r.atualizar[0].id).toBe("c1");
  });

  it("nome ambíguo vira conflito — não adivinha a pessoa", () => {
    const doisIguais = [
      novoColaborador({ id: "c1", nome: "João Silva", matricula: "1" }),
      novoColaborador({ id: "c2", nome: "joao silva", matricula: "2" }),
    ];
    const r = planoImportacaoColaboradores({
      linhas: [{ nome: "João Silva", cargo: "Analista de CQ" }],
      colaboradores: doisIguais, catalogoCargos: CARGOS,
    });
    expect(r.criar).toHaveLength(0);
    expect(r.atualizar).toHaveLength(0);
    expect(r.conflitos).toHaveLength(1);
    expect(r.conflitos[0].motivo).toMatch(/matrícula/i);
  });

  it("matrícula repetida dentro do próprio arquivo vira conflito", () => {
    const r = planoImportacaoColaboradores({
      linhas: [
        { nome: "A", matricula: "500", cargo: "Analista de CQ" },
        { nome: "B", matricula: "500", cargo: "Analista de CQ" },
      ],
      colaboradores: [], catalogoCargos: CARGOS,
    });
    expect(r.criar).toHaveLength(1);
    expect(r.conflitos).toHaveLength(1);
  });

  it("cargo fora do catálogo não cadastra em silêncio", () => {
    const r = planoImportacaoColaboradores({
      linhas: [{ nome: "Carlos", matricula: "300", cargo: "Cargo Inventado" }],
      colaboradores: [], catalogoCargos: CARGOS,
    });
    expect(r.criar).toHaveLength(0);
    expect(r.ignorados).toHaveLength(1);
    expect(r.cargosDesconhecidos).toEqual(["Cargo Inventado"]);
  });

  it("linha sem nome é ignorada", () => {
    const r = planoImportacaoColaboradores({ linhas: [{ nome: "  ", matricula: "9" }], colaboradores: [], catalogoCargos: CARGOS });
    expect(r.ignorados[0].motivo).toMatch(/sem nome/);
  });

  it("não muta a lista de colaboradores recebida", () => {
    const antes = JSON.parse(JSON.stringify(existentes));
    planoImportacaoColaboradores({ linhas: [{ nome: "Adriana Moreira", matricula: "100" }], colaboradores: existentes, catalogoCargos: CARGOS });
    expect(existentes).toEqual(antes);
  });
});

describe("parseCSVColaboradores", () => {
  it("lê cabeçalho com acento, caixa e separador ;", () => {
    const csv = "Nome;Matrícula;Cargo;Setor;Admissão\nAdriana Moreira;100;Operador de Encapsulamento;Produção;05/03/2024";
    expect(parseCSVColaboradores(csv)).toEqual([
      { nome: "Adriana Moreira", matricula: "100", cargo: "Operador de Encapsulamento", setor: "Produção", dataAdmissao: "2024-03-05" },
    ]);
  });

  it("aceita separador vírgula", () => {
    const csv = "nome,matricula,cargo\nBruno,200,Analista de CQ";
    expect(parseCSVColaboradores(csv)[0]).toMatchObject({ nome: "Bruno", matricula: "200" });
  });

  it("sem coluna de nome não interpreta nada", () => {
    expect(parseCSVColaboradores("cargo;setor\nx;y")).toEqual([]);
  });

  it("arquivo vazio devolve lista vazia", () => {
    expect(parseCSVColaboradores("")).toEqual([]);
    expect(parseCSVColaboradores(null)).toEqual([]);
  });
});

describe("matriz lendo colaboradores", () => {
  const pessoas = [
    novoColaborador({ id: "p1", nome: "Adriana", cargoId: "operador-de-encapsulamento", userId: null }),
    novoColaborador({ id: "p2", nome: "Bruno",   cargoId: "operador-de-encapsulamento", userId: "u9" }),
  ];

  it("operador SEM login entra na matriz — o ponto inteiro da Fase 6", () => {
    expect(exigidosDoDocumento(doc(), pessoas, CARGOS).map(e => e.userId)).toEqual(["p1", "p2"]);
  });

  it("marca quem tem login, para o modo leitura saber", () => {
    const ex = exigidosDoDocumento(doc(), pessoas, CARGOS);
    expect(ex.find(e => e.userId === "p1").temLogin).toBe(false);
    expect(ex.find(e => e.userId === "p2").temLogin).toBe(true);
  });

  it("desligado sai da exigência", () => {
    const comDesligado = [...pessoas, novoColaborador({ id: "p3", nome: "Carla", cargoId: "operador-de-encapsulamento" })];
    comDesligado[2].ativo = false;
    expect(exigidosDoDocumento(doc(), comDesligado, CARGOS).map(e => e.userId)).toEqual(["p1", "p2"]);
  });

  it("evidência de desligado permanece gravada — só sai do cálculo", () => {
    const desligado = [{ ...pessoas[0], ativo: false }];
    const ev = { id: "e", docId: "d1", versao: "02", userId: "p1", dataRealizacao: "2026-02-01", ts: 1 };
    const m = montarMatriz({ docs: [doc()], pessoas: desligado, evidencias: [ev], catalogoCargos: CARGOS, hoje: "2026-08-06" });
    expect(m.linhas).toHaveLength(0);
    expect(indexarEvidencias([ev]).size).toBe(1);
  });

  it("exigidosSemLogin acusa a pendência impossível no modo leitura", () => {
    const leitura = doc({ treinamento: { ...doc().treinamento, modo: "leitura" } });
    expect(exigidosSemLogin(leitura, pessoas, CARGOS).map(e => e.userId)).toEqual(["p1"]);
  });

  it("modo presencial não gera esse aviso", () => {
    expect(exigidosSemLogin(doc(), pessoas, CARGOS)).toEqual([]);
  });
});

describe("prazo respeita a data de admissão", () => {
  const d = doc({ treinamento: { ...doc().treinamento, desdeEm: "2024-01-01", prazoDias: 30 } });
  const indice = indexarEvidencias([]);

  it("novo contratado NÃO nasce atrasado", () => {
    const cel = statusCelula({ doc: d, userId: "p1", indice, hoje: "2026-08-06", admissao: "2026-08-01" });
    expect(cel.status).toBe("pendente");
    expect(cel.dias).toBe(5);
  });

  it("quem já estava na casa conta desde a vigência da versão", () => {
    const cel = statusCelula({ doc: d, userId: "p1", indice, hoje: "2026-08-06", admissao: "2020-01-01" });
    expect(cel.status).toBe("atrasado");
  });

  it("contratado há mais tempo que o prazo fica atrasado", () => {
    const cel = statusCelula({ doc: d, userId: "p1", indice, hoje: "2026-08-06", admissao: "2026-05-01" });
    expect(cel.status).toBe("atrasado");
  });

  it("sem data de admissão, comportamento anterior é preservado", () => {
    const cel = statusCelula({ doc: d, userId: "p1", indice, hoje: "2026-08-06" });
    expect(cel.status).toBe("atrasado");
  });
});

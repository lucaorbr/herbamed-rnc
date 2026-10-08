import { casaFornecedor, escolhaAoSair, filtrarFornecedores, normalizarBusca, sugestoesDoMaterial } from "./fornecedorBuscaLogic";

const FORN = [
  { id: 1, nome: "Distribuidora Brasil Ltda", cnpj: "12.345.678/0001-90" },
  { id: 2, nome: "Sul Química Comercial", cnpj: "98.765.432/0001-10" },
  { id: 3, nome: "Brasil Extratos", cnpj: "" },
  { id: 4, nome: "Embalagens Paraná" },
];

describe("casaFornecedor", () => {
  test("acha por palavra do meio do nome, não só a primeira", () => {
    expect(casaFornecedor(FORN[0], "brasil")).toBe(true);
    expect(casaFornecedor(FORN[0], "ltda")).toBe(true);
  });
  test("várias palavras em qualquer ordem", () => {
    expect(casaFornecedor(FORN[1], "quimica sul")).toBe(true);
    expect(casaFornecedor(FORN[1], "quimica norte")).toBe(false);
  });
  test("ignora acento e maiúscula", () => {
    expect(casaFornecedor(FORN[1], "QUÍMICA")).toBe(true);
    expect(casaFornecedor(FORN[3], "parana")).toBe(true);
  });
  test("CNPJ com ou sem pontuação", () => {
    expect(casaFornecedor(FORN[0], "12345678")).toBe(true);
    expect(casaFornecedor(FORN[0], "12.345")).toBe(true);
    expect(casaFornecedor(FORN[3], "123")).toBe(false);
  });
  test("termo vazio casa tudo", () => {
    expect(casaFornecedor(FORN[2], "  ")).toBe(true);
  });
});

describe("filtrarFornecedores", () => {
  test("quem começa com o termo vem primeiro", () => {
    expect(filtrarFornecedores(FORN, "brasil").map(f => f.id)).toEqual([3, 1]);
  });
  test("sem termo mantém a lista", () => {
    expect(filtrarFornecedores(FORN, "")).toHaveLength(4);
  });
});

describe("sugestoesDoMaterial", () => {
  const mat = { id: 10, nome: "Psyllium", fornecedorPadrao: "Brasil Extratos", fichasTecnicas: [{ fornecedorNome: "Embalagens Paraná" }, { fornecedorNome: "Outro" }] };
  const analises = [
    { materialId: 10, fornecedor: "Sul Química Comercial", criadoTs: 1, dataRecebimento: "2026-01-05" },
    { materialId: 10, fornecedor: "Distribuidora Brasil Ltda", criadoTs: 3, dataRecebimento: "2026-09-12" },
    { materialId: 10, fornecedor: "Brasil Extratos", criadoTs: 2 },
    { materialId: 99, fornecedor: "Fornecedor de outro material", criadoTs: 5 },
  ];

  test("padrão, depois análises mais recentes, depois fichas — sem repetir", () => {
    const r = sugestoesDoMaterial(mat, analises, FORN);
    expect(r.map(x => x.fornecedor.id)).toEqual([3, 1, 2, 4]);
    expect(r[0].motivo).toBe("Fornecedor padrão");
    expect(r[1].motivo).toBe("Última análise em 12/09/2026");
    expect(r[3].motivo).toBe("Ficha técnica");
  });
  test("fornecedor fora da lista de ativos não é sugerido", () => {
    const r = sugestoesDoMaterial(mat, analises, FORN.filter(f => f.id !== 1));
    expect(r.map(x => x.fornecedor.id)).not.toContain(1);
  });
  test("'Vários' não vira sugestão; casa análise antiga pelo nome do material", () => {
    const m2 = { id: 11, nome: "Cápsula", fornecedorPadrao: "Vários" };
    const r = sugestoesDoMaterial(m2, [{ materialNome: "Cápsula", fornecedor: "Sul Química Comercial" }], FORN);
    expect(r.map(x => x.fornecedor.id)).toEqual([2]);
  });
  test("sem material, sem sugestão", () => {
    expect(sugestoesDoMaterial(null, analises, FORN)).toEqual([]);
  });
});

test("normalizarBusca", () => {
  expect(normalizarBusca("  Química ")).toBe("quimica");
});

describe("escolha ao sair do campo", () => {
  const ops = [{ value: "Brasil Química Ltda", label: "Brasil Química Ltda" }, { value: "Brasil Embalagens", label: "Brasil Embalagens" }];
  test("nome exato escolhe, mesmo com outras opções", () => {
    expect(escolhaAoSair(ops, "brasil quimica ltda")?.value).toBe("Brasil Química Ltda");
  });
  test("uma opção só escolhe; várias não", () => {
    expect(escolhaAoSair([ops[1]], "emb")?.value).toBe("Brasil Embalagens");
    expect(escolhaAoSair(ops, "brasil")).toBeNull();
  });
  test("sem texto não escolhe nada", () => {
    expect(escolhaAoSair([ops[0]], "  ")).toBeNull();
  });
});

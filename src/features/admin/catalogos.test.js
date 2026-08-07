import {
  FAMILIAS, CATALOGOS, acharCatalogo, catalogosDaFamilia,
  chaveDoItem, contarUsos, usoDoItem, resumoCatalogo, podeExcluirItem,
} from "./catalogos";

const docs = [
  {
    id: "POP-PRO-002", depto: "PRO", tipo: "PO",
    treinamento: { exigido: true, cargos: ["operador-de-encapsulamento"], setores: ["PRO-ENC"] },
    distribuicaoFisica: [{ areaId: "PRO", setorId: "PRO-ENC" }],
  },
  {
    id: "POP-PRO-003", depto: "PRO", tipo: "PO",
    treinamento: { exigido: true, cargos: ["operador-de-compressao"], setores: ["PRO-COMP"] },
  },
  { id: "IT-LIM-001", depto: "LIM", tipo: "IT" },
];

const colaboradores = [
  { id: "1", cargoId: "operador-de-encapsulamento", setorId: "PRO-ENC", ativo: true },
  { id: "2", cargoId: "operador-de-encapsulamento", setorId: "PRO-ENC", ativo: true },
  { id: "3", cargoId: "almoxarife", setorId: "ALM-REC", ativo: false }, // desligado não conta
];

const desvios = [
  { num: 1, tipo: "BPF", setor: "Compressão" },
  { num: 2, tipo: "bpf", setor: "compressao" }, // mesma coisa com outra grafia
  { num: 3, tipo: "Processo", setor: "Envase 1" },
];

const revalidacoes = [
  { id: "r1", tipoRevalidacao: "Material Gráfico" },
  { id: "r2" }, // sem tipo cai no padrão
];

describe("metadados", () => {
  it("todo catálogo pertence a uma família declarada", () => {
    const familias = new Set(FAMILIAS.map(f => f.id));
    for (const c of CATALOGOS) expect(familias.has(c.familia)).toBe(true);
  });
  it("todo catálogo diz onde é usado", () => {
    for (const c of CATALOGOS) {
      expect(c.usadoEm.length).toBeGreaterThan(0);
      expect(c.resumo.length).toBeGreaterThan(0);
    }
  });
  it("ids são únicos e localizáveis", () => {
    expect(new Set(CATALOGOS.map(c => c.id)).size).toBe(CATALOGOS.length);
    expect(acharCatalogo("cargos")?.titulo).toBe("Cargos");
    expect(acharCatalogo("inexistente")).toBeNull();
  });
  it("as famílias cobrem todos os catálogos, sem sobra", () => {
    const somados = FAMILIAS.flatMap(f => catalogosDaFamilia(f.id));
    expect(somados.length).toBe(CATALOGOS.length);
  });
});

describe("chaveDoItem", () => {
  it("usa o código nos catálogos que gravam id no registro", () => {
    expect(chaveDoItem("deptos", { id: "PRO", label: "Produção" })).toBe("PRO");
    expect(chaveDoItem("cargos", { id: "almoxarife", nome: "Almoxarife" })).toBe("almoxarife");
    expect(chaveDoItem("distribuicao", { id: "PRO-ENC", nome: "Encapsulamento" })).toBe("PRO-ENC");
  });
  it("usa o nome normalizado nos catálogos que gravam o nome no registro", () => {
    expect(chaveDoItem("setores", { nome: "Compressão" })).toBe("compressao");
    expect(chaveDoItem("desvios", { nome: "BPF" })).toBe("bpf");
  });
  it("tolera item vazio", () => {
    expect(chaveDoItem("deptos", null)).toBe("");
  });
});

describe("contarUsos", () => {
  const usos = contarUsos({ docs, desvios, revalidacoes, colaboradores });

  it("conta documentos por departamento e por tipo", () => {
    expect(usos.deptos.PRO).toBe(2);
    expect(usos.deptos.LIM).toBe(1);
    expect(usos.tipos.PO).toBe(2);
    expect(usos.tipos.IT).toBe(1);
  });

  it("soma o cargo nas duas pontas: documento que o exige e pessoa que o ocupa", () => {
    // 1 documento exige + 2 colaboradores ativos ocupam
    expect(usos.cargos["operador-de-encapsulamento"]).toBe(3);
  });

  it("não conta colaborador desligado", () => {
    expect(usos.cargos["almoxarife"]).toBeUndefined();
    expect(usos.distribuicao["ALM-REC"]).toBeUndefined();
  });

  it("conta setor pelas três origens: exigência, cópia física e local de trabalho", () => {
    // PRO-ENC: 1 exigência + 1 cópia entregue + 2 colaboradores
    expect(usos.distribuicao["PRO-ENC"]).toBe(4);
    expect(usos.distribuicao["PRO-COMP"]).toBe(1);
  });

  it("agrupa grafias equivalentes nos catálogos por nome", () => {
    expect(usos.desvios["bpf"]).toBe(2);
    expect(usos.setores["compressao"]).toBe(2);
  });

  it("revalidação sem tipo cai no padrão, como a tela mostra", () => {
    expect(usos.reval[chaveDoItem("reval", { nome: "Material Gráfico" })]).toBe(2);
  });

  it("sem registros carregados devolve vazio, não zero fabricado", () => {
    const vazio = contarUsos({});
    expect(vazio.deptos).toEqual({});
    expect(vazio.cargos).toEqual({});
  });
});

describe("usoDoItem / resumoCatalogo", () => {
  const usos = contarUsos({ docs, desvios, revalidacoes, colaboradores });

  it("resolve o uso de um item pelo catálogo certo", () => {
    expect(usoDoItem(usos, "deptos", { id: "PRO" })).toBe(2);
    expect(usoDoItem(usos, "setores", { nome: "Compressão" })).toBe(2);
    expect(usoDoItem(usos, "setores", { nome: "Rotulagem" })).toBe(0);
  });

  it("resume ativos, total e registros dependentes", () => {
    const itens = [{ id: "PRO", ativo: true }, { id: "LIM", ativo: true }, { id: "OBS", ativo: false }];
    expect(resumoCatalogo("deptos", itens, usos)).toEqual({ ativos: 2, total: 3, registros: 3 });
  });
});

describe("podeExcluirItem", () => {
  const usos = contarUsos({ docs, desvios, revalidacoes, colaboradores });

  it("barra exclusão de item em uso e diz quantos registros dependem", () => {
    expect(podeExcluirItem(usos, "deptos", { id: "PRO" })).toEqual({ pode: false, usos: 2 });
  });

  it("libera item que ninguém usa", () => {
    expect(podeExcluirItem(usos, "deptos", { id: "NOVO" })).toEqual({ pode: true, usos: 0 });
  });
});

import {
  normSetor, setoresDaHierarquia, usosNosDesvios, planoFusao, novoSetorId, aplicarDecisoes,
} from "./fusaoSetores";
import { setoresDesvioAtivos } from "./DesviosTabs";

// Hierarquia Área › Setor — a mesma do catálogo de distribuição de cópias.
const AREAS = [
  { id: "PRO", label: "Produção", ativo: true, setores: [
    { id: "PRO-ENC", nome: "Encapsulamento 1", ativo: true },
    { id: "PRO-COMP", nome: "Compressão",      ativo: true },
    { id: "PRO-OFF",  nome: "Envase 9",        ativo: false },
  ]},
  { id: "SGQ", label: "Qualidade", ativo: true, setores: [
    { id: "SGQ-CQ", nome: "Qualidade", ativo: true },
  ]},
  { id: "OLD", label: "Área desativada", ativo: false, setores: [
    { id: "OLD-X", nome: "Setor fantasma", ativo: true },
  ]},
];

const CAT_LEGADO = [
  { nome: "Encapsulamento 1", ativo: true },
  { nome: "Mistura 1",        ativo: true },
  { nome: "Envase 4 (Sachê)", ativo: true },
  { nome: "Setor aposentado", ativo: false },
  { nome: "Outros",           ativo: true },
];

const desvio = (id, setor, extra = {}) => ({ id, setor, desc: "x", ...extra });

describe("setoresDaHierarquia — só o que está ativo dos dois lados", () => {
  it("ignora setor inativo e área inativa", () => {
    const nomes = setoresDaHierarquia(AREAS).map(x => x.nome);
    expect(nomes).toEqual(["Encapsulamento 1", "Compressão", "Qualidade"]);
  });

  it("carrega a área junto, para a tela mostrar de onde o setor vem", () => {
    const enc = setoresDaHierarquia(AREAS).find(x => x.setorId === "PRO-ENC");
    expect(enc).toMatchObject({ areaId: "PRO", areaLabel: "Produção" });
  });
});

describe("usosNosDesvios", () => {
  it("agrupa grafias equivalentes e conta os usos", () => {
    const usos = usosNosDesvios([
      desvio("1", "Mistura 1"),
      desvio("2", "mistura 1 "),
      desvio("3", "MISTURA 1"),
    ]);
    expect(usos.get("mistura 1").usos).toBe(3);
    expect(usos.get("mistura 1").ids).toEqual(["1", "2", "3"]);
  });

  it("deixa 'Outros' de fora — é caso da reclassificação, não da fusão", () => {
    const usos = usosNosDesvios([desvio("1", "Outros", { setorOutro: "Pátio" })]);
    expect(usos.size).toBe(0);
  });
});

describe("planoFusao", () => {
  const desvios = [
    desvio("1", "Mistura 1"), desvio("2", "Mistura 1"),
    desvio("3", "Encapsulamento 1"),
    desvio("4", "Setor que sumiu do catálogo"),
  ];

  it("marca como vinculado o que já existe na hierarquia", () => {
    const { itens } = planoFusao({ catalogoSetoresDesvio: CAT_LEGADO, catalogoAreas: AREAS, desvios });
    const enc = itens.find(x => x.chave === "encapsulamento 1");
    expect(enc.status).toBe("vinculado");
    expect(enc.destino.setorId).toBe("PRO-ENC");
  });

  it("marca como pendente o que não existe na hierarquia", () => {
    const { itens } = planoFusao({ catalogoSetoresDesvio: CAT_LEGADO, catalogoAreas: AREAS, desvios });
    expect(itens.find(x => x.chave === "mistura 1").status).toBe("pendente");
    expect(itens.find(x => x.chave === "envase 4 (sache)").status).toBe("pendente");
  });

  it("inclui setor que já saiu do catálogo mas segue carimbado em desvios", () => {
    // É justamente esse que ficaria órfão no filtro sem ninguém perceber.
    const { itens } = planoFusao({ catalogoSetoresDesvio: CAT_LEGADO, catalogoAreas: AREAS, desvios });
    const orfao = itens.find(x => x.chave === "setor que sumiu do catalogo");
    expect(orfao).toBeTruthy();
    expect(orfao.origens).toEqual(["desvios"]);
    expect(orfao.usos).toBe(1);
  });

  it("ignora item já desativado no catálogo antigo e o 'Outros'", () => {
    const { itens } = planoFusao({ catalogoSetoresDesvio: CAT_LEGADO, catalogoAreas: AREAS, desvios: [] });
    expect(itens.some(x => x.chave === "setor aposentado")).toBe(false);
    expect(itens.some(x => x.chave === "outros")).toBe(false);
  });

  it("ordena pendentes primeiro e, entre eles, os mais usados", () => {
    const { itens } = planoFusao({ catalogoSetoresDesvio: CAT_LEGADO, catalogoAreas: AREAS, desvios });
    expect(itens[0].chave).toBe("mistura 1"); // 2 usos, pendente
    expect(itens[itens.length - 1].status).toBe("vinculado");
  });

  it("resume o que falta decidir e quantos desvios dependem disso", () => {
    const { resumo } = planoFusao({ catalogoSetoresDesvio: CAT_LEGADO, catalogoAreas: AREAS, desvios });
    expect(resumo.vinculados).toBe(1);          // Encapsulamento 1
    expect(resumo.pendentes).toBe(3);           // Mistura 1, Envase 4 (Sachê), Setor que sumiu
    expect(resumo.desviosAfetados).toBe(3);     // 2 + 0 + 1
  });
});

describe("novoSetorId", () => {
  it("deriva da área e do nome, sem acento nem espaço", () => {
    expect(novoSetorId("PRO", "Envase 4 (Sachê)")).toBe("PRO-envase-4-sache");
  });
  it("desempata quando o id já existe", () => {
    expect(novoSetorId("PRO", "Mistura 1", ["PRO-mistura-1"])).toBe("PRO-mistura-1-2");
  });
});

describe("aplicarDecisoes", () => {
  const desvios = [desvio("1", "Mistura 1"), desvio("2", "Mistura 1"), desvio("3", "Envase 4 (Sachê)")];
  const plano = () => planoFusao({ catalogoSetoresDesvio: CAT_LEGADO, catalogoAreas: AREAS, desvios });

  it("criar: acrescenta o setor na área e NÃO reescreve desvio nenhum", () => {
    // O nome gravado no desvio continua valendo — reescrever seria mexer em
    // registro emitido sem necessidade.
    const { itens } = plano();
    const r = aplicarDecisoes({
      itens, decisoes: { "mistura 1": { acao: "criar", areaId: "PRO" } },
      catalogoAreas: AREAS, desvios,
    });
    const pro = r.catalogoAreas.find(a => a.id === "PRO");
    expect(pro.setores.map(x => x.nome)).toContain("Mistura 1");
    expect(r.desviosParaSalvar).toEqual([]);
    expect(r.criados).toHaveLength(1);
  });

  it("mapear: reescreve o setor dos desvios e registra no histórico", () => {
    const { itens } = plano();
    const r = aplicarDecisoes({
      itens, decisoes: { "mistura 1": { acao: "mapear", setorId: "PRO-COMP" } },
      catalogoAreas: AREAS, desvios, usuario: "Fulana", data: "2026-08-10",
    });
    expect(r.desviosParaSalvar).toHaveLength(2);
    expect(r.desviosParaSalvar[0].setor).toBe("Compressão");
    expect(r.desviosParaSalvar[0].historico[0]).toMatchObject({ data: "2026-08-10", resp: "Fulana" });
    expect(r.desviosParaSalvar[0].historico[0].acao).toContain("Mistura 1");
    expect(r.desviosParaSalvar[0].historico[0].acao).toContain("Compressão");
    expect(r.catalogoMudou).toBe(false);
  });

  it("preserva o histórico que o desvio já tinha", () => {
    const comHist = [{ ...desvio("1", "Mistura 1"), historico: [{ data: "2026-01-01", acao: "Registrado", resp: "X" }] }];
    const { itens } = planoFusao({ catalogoSetoresDesvio: [], catalogoAreas: AREAS, desvios: comHist });
    const r = aplicarDecisoes({
      itens, decisoes: { "mistura 1": { acao: "mapear", setorId: "PRO-COMP" } },
      catalogoAreas: AREAS, desvios: comHist,
    });
    expect(r.desviosParaSalvar[0].historico).toHaveLength(2);
    expect(r.desviosParaSalvar[0].historico[0].acao).toBe("Registrado");
  });

  it("item sem decisão não é tocado — migração parcial é permitida", () => {
    const { itens } = plano();
    const r = aplicarDecisoes({ itens, decisoes: {}, catalogoAreas: AREAS, desvios });
    expect(r.desviosParaSalvar).toEqual([]);
    expect(r.catalogoMudou).toBe(false);
    expect(r.catalogoAreas).toBe(AREAS); // mesma referência: nada a gravar
  });

  it("não duplica setor de mesmo nome já presente na área escolhida", () => {
    const { itens } = planoFusao({ catalogoSetoresDesvio: [{ nome: "compressao", ativo: true }], catalogoAreas: AREAS, desvios: [] });
    // "compressao" casa com "Compressão" pela normalização, então nem é pendente.
    expect(itens.find(x => x.chave === "compressao").status).toBe("vinculado");
  });

  it("mapear para setor de mesmo nome não gera reescrita", () => {
    const itens = [{ chave: "compressao", nome: "Compressao", status: "pendente", usos: 1, ids: ["9"] }];
    const r = aplicarDecisoes({
      itens, decisoes: { compressao: { acao: "mapear", setorId: "PRO-COMP" } },
      catalogoAreas: AREAS, desvios: [desvio("9", "Compressao")],
    });
    expect(r.desviosParaSalvar).toEqual([]);
    expect(r.mapeados).toHaveLength(1);
  });

  it("normSetor colapsa acento, caixa e espaço", () => {
    expect(normSetor("  ENVASE 4 (Sachê) ")).toBe("envase 4 (sache)");
  });
});


describe("setoresDesvioAtivos — união durante a transição", () => {
  const areas = [{ id: "PRO", label: "Produção", ativo: true, setores: [
    { id: "PRO-ENC", nome: "Encapsulamento 1", ativo: true },
  ]}];
  const legado = [{ nome: "Encapsulamento 1", ativo: true }, { nome: "Mistura 1", ativo: true }, { nome: "Outros", ativo: true }];

  it("não perde setor que só existe no catálogo antigo", () => {
    const lista = setoresDesvioAtivos(areas, legado);
    expect(lista).toContain("Mistura 1");
    expect(lista).toContain("Encapsulamento 1");
  });

  it("não duplica o que existe nos dois", () => {
    const lista = setoresDesvioAtivos(areas, legado);
    expect(lista.filter(x => x === "Encapsulamento 1")).toHaveLength(1);
  });

  it("colapsa para a hierarquia quando o legado não acrescenta nada", () => {
    const lista = setoresDesvioAtivos(areas, [{ nome: "encapsulamento 1", ativo: true }]);
    expect(lista).toEqual(["Encapsulamento 1", "Outros"]);
  });

  it("'Outros' é sempre o último e aparece uma vez só", () => {
    const lista = setoresDesvioAtivos(areas, legado);
    expect(lista[lista.length - 1]).toBe("Outros");
    expect(lista.filter(x => x === "Outros")).toHaveLength(1);
  });

  it("cai na semente quando não há hierarquia nem catálogo", () => {
    expect(setoresDesvioAtivos([], [])).toContain("Compressão");
  });

  it("ignora setor desativado no legado", () => {
    const lista = setoresDesvioAtivos(areas, [{ nome: "Setor morto", ativo: false }]);
    expect(lista).not.toContain("Setor morto");
  });
});

import { assunto, dataEncerramentoRnc, montarApresentacao, paginar } from "./apresentacaoLogic";

const HOJE = "2026-10-30";

describe("assunto", () => {
  it("pega a primeira linha preenchida e corta", () => {
    expect(assunto("\n  Cápsula úmida  \n(lucas, 01/10)")).toBe("Cápsula úmida");
    expect(assunto("x".repeat(100), 10)).toBe("xxxxxxxxx…");
    expect(assunto(undefined)).toBe("");
  });
});

describe("dataEncerramentoRnc", () => {
  it("usa a eficácia, senão a última entrada do histórico, e só em RNC encerrada", () => {
    expect(dataEncerramentoRnc({ status: "Eficaz", eficacia: { registradoEm: "2026-10-28T13:00:00Z" } })).toBe("2026-10-28");
    expect(dataEncerramentoRnc({ status: "Encerrada", historico: [{ data: "2026-10-01" }, { data: "2026-10-29" }] })).toBe("2026-10-29");
    expect(dataEncerramentoRnc({ status: "Em andamento", historico: [{ data: "2026-10-29" }] })).toBeNull();
  });
});

describe("paginar", () => {
  it("divide e mantém uma página vazia para lista vazia", () => {
    expect(paginar([1, 2, 3], 2)).toEqual([[1, 2], [3]]);
    expect(paginar([], 2)).toEqual([[]]);
  });
});

describe("montarApresentacao", () => {
  const rncs = [
    { id: "a", num: "NC-1", status: "Aberta", data: "2026-10-29", prazoAC: "2026-10-20", resp: "Ana", desc: "Lote sem rótulo" },
    { id: "b", num: "NC-2", status: "Em andamento", data: "2026-09-01", prazoAC: "2026-11-20", resp: "Ana", desc: "Umidade",
      w2h: [{ what: "Trocar MP", who: "Produção", when: "2026-10-25", status: "Pendente" },
            { what: "Treinar", who: "RH", when: "2026-11-03", status: "Em andamento" },
            { what: "Longe", who: "RH", when: "2026-12-30", status: "Pendente" },
            { what: "Feita", who: "RH", when: "2026-10-01", status: "Concluída" }] },
    { id: "c", num: "NC-3", status: "Eficaz", data: "2026-08-01", prazoAC: "2026-09-01", eficacia: { registradoEm: "2026-10-27T10:00:00Z" } },
    { id: "d", num: "NC-4", status: "Aberta", data: "2026-10-20", prazoAC: "2026-11-30", resp: "Bruno" },
  ];
  const desvios = [
    { num: "DEV-1", status: "Registrado", dataRegistro: "2026-10-01", setor: "Envase", impacto: "Maior" },
    { num: "DEV-2", status: "Registrado", dataRegistro: "2026-10-28", setor: "Outros", setorOutro: "Pátio" },
    { num: "DEV-3", status: "Encerrado", dataRegistro: "2026-10-10", encerradoEm: "2026-10-26", setor: "Envase" },
    { num: "DEV-4", status: "Convertido em RNC", dataRegistro: "2026-10-18", convertidoEm: "2026-10-19", setor: "Mistura" },
  ];
  const a = montarApresentacao({ rncs, desvios, hoje: HOJE });

  it("recorta a semana em 7 dias terminando hoje e a anterior colada antes", () => {
    expect(a.semana).toEqual({ de: "2026-10-24", ate: HOJE });
    expect(a.anterior).toEqual({ de: "2026-10-17", ate: "2026-10-23" });
  });

  it("conta RNCs e desvios da semana, da anterior e em aberto", () => {
    expect(a.resumo.rnc).toMatchObject({ abertas: 1, encerradas: 1, emAberto: 3, vencidas: 1, anterior: { abertas: 1, encerradas: 0 } });
    expect(a.resumo.desvio).toMatchObject({ registrados: 1, triados: 1, emAberto: 2, atrasados: 1, anterior: { registrados: 1, triados: 1 } });
  });

  it("lista as RNCs vencidas com os dias de atraso e a etapa", () => {
    expect(a.rncsVencidas).toHaveLength(1);
    expect(a.rncsVencidas[0]).toMatchObject({ num: "NC-1", diasAtraso: 10, resp: "Ana", etapa: "Contenção e disposição" });
  });

  it("agrupa as demais ativas por responsável, sem as vencidas", () => {
    expect(a.rncsPorResponsavel.map(g => [g.resp, g.itens.map(i => i.num)])).toEqual([["Ana", ["NC-2"]], ["Bruno", ["NC-4"]]]);
  });

  it("traz só desvio aberto acima da meta de triagem", () => {
    expect(a.desviosAtrasados.map(d => [d.num, d.dias])).toEqual([["DEV-1", 29]]);
  });

  it("lista ações CAPA em aberto vencidas ou vencendo em 7 dias, de RNC ativa", () => {
    expect(a.acoesCapa.map(x => [x.acao, x.vencida, x.diasAtraso])).toEqual([["Trocar MP", true, 5], ["Treinar", false, 0]]);
  });

  it("soma desvios por setor (abertos e últimos 30 dias), com o texto de Outros", () => {
    expect(a.desviosPorSetor).toEqual([
      { setor: "Envase", abertos: 1, ultimos30: 2 },
      { setor: "Pátio", abertos: 1, ultimos30: 1 },
      { setor: "Mistura", abertos: 0, ultimos30: 1 },
    ]);
  });
});

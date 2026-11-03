import { contagem, pareto, tendenciaMensal } from "./indicadoresRncLogic";

describe("tendenciaMensal", () => {
  const rncs = [
    { data: "2026-09-03", sev: "Menor", status: "Em andamento" },
    { data: "2026-09-20", sev: "Crítica", status: "Em andamento" },
    { data: "2026-10-01", sev: "Maior", status: "Eficaz", eficacia: { registradoEm: "2026-10-25T10:00:00Z" } },
  ];
  const antiga = { data: "2026-05-10", sev: "Menor", status: "Encerrada", historico: [{ data: "2026-09-15" }] };

  it("separa as abertas do mês por severidade", () => {
    const [set, out] = tendenciaMensal(rncs, rncs, ["2026-09", "2026-10"]);
    expect(set).toMatchObject({ _key: "2026-09", Menor: 1, Maior: 0, "Crítica": 1, total: 2 });
    expect(out).toMatchObject({ Menor: 0, Maior: 1, "Crítica": 0, total: 1 });
  });

  it("conta a encerrada no mês do encerramento, mesmo aberta antes do período", () => {
    const [set, out] = tendenciaMensal(rncs, [...rncs, antiga], ["2026-09", "2026-10"]);
    expect(set["Encerradas"]).toBe(1);
    expect(out["Encerradas"]).toBe(1);
    expect(set.total).toBe(2);
  });

  it("mês sem nada sai zerado, não some", () => {
    const r = tendenciaMensal([], [], ["2026-08"]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ Menor: 0, Maior: 0, "Crítica": 0, Encerradas: 0, total: 0 });
  });
});

describe("contagem", () => {
  it("ordena do maior para o menor e ignora chave vazia", () => {
    const r = contagem([{ s: "A" }, { s: "B" }, { s: "B" }, { s: "" }], x => x.s);
    expect(r).toEqual([{ name: "B", value: 2 }, { name: "A", value: 1 }]);
  });
});

describe("pareto", () => {
  it("calcula % e acumulado e marca os que somam até 80%", () => {
    const r = pareto([{ name: "A", value: 6 }, { name: "B", value: 2 }, { name: "C", value: 1 }, { name: "D", value: 1 }]);
    expect(r.map(x => x.acum)).toEqual([60, 80, 90, 100]);
    expect(r.map(x => x.dentro80)).toEqual([true, true, false, false]);
  });

  it("o primeiro fica sempre destacado, mesmo passando de 80%", () => {
    expect(pareto([{ name: "A", value: 9 }, { name: "B", value: 1 }])[0].dentro80).toBe(true);
  });

  it("lista vazia não quebra", () => {
    expect(pareto([])).toEqual([]);
  });
});

import { compareValues, sortRows, proximoSort } from "./tableLogic";

describe("compareValues", () => {
  test("compara números", () => {
    expect(compareValues(1, 2)).toBeLessThan(0);
    expect(compareValues(2, 1)).toBeGreaterThan(0);
    expect(compareValues(5, 5)).toBe(0);
  });

  test("compara strings com sensibilidade numérica (RNC-0002 < RNC-0010)", () => {
    expect(compareValues("RNC-0002", "RNC-0010")).toBeLessThan(0);
  });

  test("compara datas ISO como string", () => {
    expect(compareValues("2026-01-05", "2026-02-01")).toBeLessThan(0);
  });

  test("vazio sempre vai para o fim, nas duas direções", () => {
    expect(compareValues("", "a")).toBeGreaterThan(0);
    expect(compareValues("a", "")).toBeLessThan(0);
    expect(compareValues(null, undefined)).toBe(0);
  });
});

describe("sortRows", () => {
  const columns = [
    { key: "nome" },
    { key: "qtd" },
    { key: "calc", accessor: r => r.a + r.b },
  ];
  const rows = [
    { nome: "Carlos", qtd: 3, a: 1, b: 1 },
    { nome: "Ana", qtd: 10, a: 5, b: 5 },
    { nome: "Bruno", qtd: 1, a: 0, b: 1 },
  ];

  test("ordena asc por coluna simples", () => {
    const r = sortRows(rows, columns, "nome", "asc");
    expect(r.map(x => x.nome)).toEqual(["Ana", "Bruno", "Carlos"]);
  });

  test("ordena desc por coluna simples", () => {
    const r = sortRows(rows, columns, "nome", "desc");
    expect(r.map(x => x.nome)).toEqual(["Carlos", "Bruno", "Ana"]);
  });

  test("ordena por coluna numérica", () => {
    const r = sortRows(rows, columns, "qtd", "asc");
    expect(r.map(x => x.qtd)).toEqual([1, 3, 10]);
  });

  test("ordena por accessor derivado", () => {
    const r = sortRows(rows, columns, "calc", "desc");
    expect(r.map(x => x.nome)).toEqual(["Ana", "Carlos", "Bruno"]);
  });

  test("sem sortCol devolve a lista original, sem clonar ordem", () => {
    expect(sortRows(rows, columns, null, "asc")).toBe(rows);
  });

  test("coluna inexistente devolve a lista original", () => {
    expect(sortRows(rows, columns, "inexistente", "asc")).toBe(rows);
  });

  test("não muta o array original", () => {
    const copia = [...rows];
    sortRows(rows, columns, "nome", "asc");
    expect(rows).toEqual(copia);
  });
});

describe("proximoSort", () => {
  test("clicar em coluna nova começa em asc", () => {
    expect(proximoSort("nome", "desc", "qtd")).toEqual({ sortCol: "qtd", sortDir: "asc" });
  });

  test("clicar na mesma coluna alterna a direção", () => {
    expect(proximoSort("nome", "asc", "nome")).toEqual({ sortCol: "nome", sortDir: "desc" });
    expect(proximoSort("nome", "desc", "nome")).toEqual({ sortCol: "nome", sortDir: "asc" });
  });
});

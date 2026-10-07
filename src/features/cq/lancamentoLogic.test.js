import { conformidadeDaTecla, paradasDoEnsaio, proximaParada, resumoResultados } from "./lancamentoLogic";

const RES = [
  { nome: "Umidade", tipo: "numero" },
  { nome: "Aspecto", tipo: "conforme" },
  { nome: "Cor", tipo: "texto" },
];

describe("paradasDoEnsaio", () => {
  test("ensaio de valor tem valor e conformidade; ensaio conforme só conformidade", () => {
    expect(paradasDoEnsaio(RES[0])).toEqual(["res", "conf"]);
    expect(paradasDoEnsaio(RES[1])).toEqual(["conf"]);
  });
});

describe("proximaParada", () => {
  test("valor → conformidade do mesmo ensaio", () => {
    expect(proximaParada(RES, 0, "res")).toEqual({ idx: 0, campo: "conf" });
  });
  test("conformidade → valor do próximo; pula o valor de ensaio do tipo conforme", () => {
    expect(proximaParada(RES, 0, "conf")).toEqual({ idx: 1, campo: "conf" });
    expect(proximaParada(RES, 1, "conf")).toEqual({ idx: 2, campo: "res" });
  });
  test("volta com passo -1", () => {
    expect(proximaParada(RES, 2, "res", -1)).toEqual({ idx: 1, campo: "conf" });
  });
  test("fim e início da tabela devolvem null", () => {
    expect(proximaParada(RES, 2, "conf")).toBeNull();
    expect(proximaParada(RES, 0, "res", -1)).toBeNull();
  });
  test("parada inexistente devolve null", () => {
    expect(proximaParada(RES, 1, "res")).toBeNull();
  });
});

describe("conformidadeDaTecla", () => {
  test.each([["c", true], ["C", true], ["+", true], ["n", false], ["N", false], ["-", false], ["Backspace", null], ["Delete", null]])("%s", (k, v) => {
    expect(conformidadeDaTecla(k)).toBe(v);
  });
  test("outra tecla não é de conformidade", () => {
    expect(conformidadeDaTecla("x")).toBeUndefined();
    expect(conformidadeDaTecla("Enter")).toBeUndefined();
  });
});

describe("resumoResultados", () => {
  test("conta lançados, conformes, N.C. e pendentes", () => {
    const r = resumoResultados([
      { resultado: "5,2", conforme: true },
      { resultado: "", conforme: false },
      { resultado: "  ", conforme: null },
      { resultado: "ok", conforme: null },
    ]);
    expect(r).toEqual({ total: 4, lancados: 3, conformes: 1, naoConformes: 1, pendentes: 1 });
  });
  test("lista vazia", () => {
    expect(resumoResultados([])).toEqual({ total: 0, lancados: 0, conformes: 0, naoConformes: 0, pendentes: 0 });
  });
});

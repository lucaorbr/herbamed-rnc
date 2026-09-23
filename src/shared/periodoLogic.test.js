import {
  dataIso, dentroDoPeriodo, filtrarPorPeriodo, inicioMesesAtras, mesesDoPeriodo,
  periodoAnterior, resolverPeriodo, rotuloPeriodo, ultimosMeses,
} from "./periodoLogic";
import { taxaEficaciaRNC } from "../core/status";

const HOJE = "2026-09-23";

describe("resolverPeriodo — atalhos", () => {
  test.each([
    ["7d",  "2026-09-16"],
    ["15d", "2026-09-08"],
    ["mes", "2026-09-01"],
    ["3m",  "2026-07-01"],
    ["6m",  "2026-04-01"],
    ["12m", "2025-10-01"],
    ["ano", "2026-01-01"],
  ])("%s começa em %s e termina hoje", (preset, de) => {
    expect(resolverPeriodo({ preset }, { hoje: HOJE })).toMatchObject({ de, ate: HOJE, todo: false });
  });

  test("todo o histórico começa na data mais antiga dos registros", () => {
    const p = resolverPeriodo({ preset: "tudo" }, { hoje: HOJE, datas: ["2025-03-10", "", null, "2024-11-02T10:00:00Z", "2026-01-01"] });
    expect(p).toMatchObject({ de: "2024-11-02", ate: HOJE, todo: true });
  });

  test("todo o histórico sem registros vira só hoje", () => {
    expect(resolverPeriodo({ preset: "tudo" }, { hoje: HOJE })).toMatchObject({ de: HOJE, ate: HOJE });
  });

  test("preset desconhecido cai em 12 meses", () => {
    expect(resolverPeriodo({ preset: "xyz" }, { hoje: HOJE })).toMatchObject({ preset: "12m", de: "2025-10-01" });
  });
});

describe("resolverPeriodo — personalizado", () => {
  test("usa as duas datas informadas", () => {
    expect(resolverPeriodo({ preset: "personalizado", de: "2026-02-10", ate: "2026-05-20" }, { hoje: HOJE }))
      .toMatchObject({ de: "2026-02-10", ate: "2026-05-20", todo: false });
  });

  test("datas invertidas são trocadas, não viram período vazio", () => {
    expect(resolverPeriodo({ preset: "personalizado", de: "2026-05-20", ate: "2026-02-10" }, { hoje: HOJE }))
      .toMatchObject({ de: "2026-02-10", ate: "2026-05-20" });
  });

  test("sem fim vai até hoje; sem início começa no registro mais antigo", () => {
    expect(resolverPeriodo({ preset: "personalizado", de: "2026-06-01", ate: "" }, { hoje: HOJE })).toMatchObject({ ate: HOJE });
    expect(resolverPeriodo({ preset: "personalizado", ate: "2026-06-01" }, { hoje: HOJE, datas: ["2025-01-15"] })).toMatchObject({ de: "2025-01-15" });
  });
});

describe("virada de mês nos dias 29–31 (bug do setMonth)", () => {
  test("31/10 menos 1 mês é setembro, não outubro de novo", () => {
    expect(inicioMesesAtras("2026-10-31", 1)).toBe("2026-09-01");
  });
  test("31/03 volta 1 mês para fevereiro", () => {
    expect(inicioMesesAtras("2026-03-31", 1)).toBe("2026-02-01");
  });
  test("ultimosMeses num dia 31 não repete nem pula mês", () => {
    expect(ultimosMeses(6, "2026-10-31")).toEqual(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
  });
  test("atravessa a virada do ano", () => {
    expect(ultimosMeses(3, "2026-01-31")).toEqual(["2025-11", "2025-12", "2026-01"]);
  });
});

describe("dentroDoPeriodo / filtrarPorPeriodo", () => {
  const per = { de: "2026-03-01", ate: "2026-03-31" };
  test("inclusivo nas duas pontas", () => {
    expect(dentroDoPeriodo("2026-03-01", per)).toBe(true);
    expect(dentroDoPeriodo("2026-03-31", per)).toBe(true);
    expect(dentroDoPeriodo("2026-04-01", per)).toBe(false);
    expect(dentroDoPeriodo("2026-02-28", per)).toBe(false);
  });
  test("aceita timestamp ISO e ignora vazio", () => {
    expect(dentroDoPeriodo("2026-03-31T23:59:00", per)).toBe(true);
    expect(dentroDoPeriodo("", per)).toBe(false);
    expect(dentroDoPeriodo(undefined, per)).toBe(false);
  });
  test("filtra pela data escolhida pela tela", () => {
    const lista = [{ id: 1, d: "2026-03-05" }, { id: 2, d: "2026-04-05" }, { id: 3 }];
    expect(filtrarPorPeriodo(lista, per, x => x.d).map(x => x.id)).toEqual([1]);
  });
});

describe("dataIso", () => {
  test("texto inválido vira vazio", () => {
    expect(dataIso("23/09/2026")).toBe("");
    expect(dataIso("abc")).toBe("");
  });
});

describe("periodoAnterior", () => {
  test("mesma duração em dias, colado antes do início", () => {
    expect(periodoAnterior({ de: "2026-03-01", ate: "2026-03-31" })).toEqual({ de: "2026-01-29", ate: "2026-02-28" });
  });
  test("todo o histórico não tem anterior", () => {
    expect(periodoAnterior({ de: "2024-01-01", ate: HOJE, todo: true })).toBeNull();
  });
});

describe("mesesDoPeriodo", () => {
  test("todos os meses tocados, terminando no mês do fim (não no mês de hoje)", () => {
    expect(mesesDoPeriodo({ de: "2025-11-15", ate: "2026-02-03" })).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
  test("período longo fica com os últimos `max` meses", () => {
    const m = mesesDoPeriodo({ de: "2020-01-01", ate: "2026-09-23" }, 24);
    expect(m).toHaveLength(24);
    expect(m[23]).toBe("2026-09");
    expect(m[0]).toBe("2024-10");
  });
  test("período dentro de um mês só → 1 mês", () => {
    expect(mesesDoPeriodo({ de: "2026-09-01", ate: "2026-09-23" })).toEqual(["2026-09"]);
  });
});

test("rotuloPeriodo", () => {
  expect(rotuloPeriodo({ de: "2026-02-10", ate: "2026-05-20" })).toBe("10/02/2026 a 20/05/2026");
});

describe("taxaEficaciaRNC", () => {
  const r = status => ({ status });
  test("divide pelas encerradas, não pelo total", () => {
    const rncs = [r("Eficaz"), r("Eficaz"), r("Eficaz"), r("Ineficaz"), r("Aberta"), r("Em andamento")];
    expect(taxaEficaciaRNC(rncs)).toEqual({ eficazes: 3, encerradas: 4, taxa: 75 });
  });
  test("'Encerrada' por disposição fica no denominador sem contar como eficaz", () => {
    expect(taxaEficaciaRNC([r("Eficaz"), r("Encerrada")]).taxa).toBe(50);
  });
  test("sem nenhuma encerrada a taxa é null, não 0%", () => {
    expect(taxaEficaciaRNC([r("Aberta")]).taxa).toBeNull();
    expect(taxaEficaciaRNC([]).taxa).toBeNull();
  });
});

import { historicoDaNova, patchSucessora, podeAbrirVinculada, prefillDaIneficaz } from "./rncVinculadaLogic";

const ineficaz = () => ({
  id: "a1", num: "1111261", status: "Ineficaz", tipo: "Matéria-prima", sev: "Maior", produto: "Calcivitam", lote: "L77", nf: "NF 9", setor: "Produção",
  desc: "Cápsulas úmidas no lote 77", ishikawa: { root: "MP trocada sem teste" },
  eficacia: { resultado: "Ineficaz", data: "2026-11-10", obs: "Lote 80 também úmido" }, historico: [{ acao: "RNC aberta" }],
});

describe("podeAbrirVinculada", () => {
  test("só Ineficaz sem sucessora", () => {
    expect(podeAbrirVinculada(ineficaz())).toBe(true);
    expect(podeAbrirVinculada({ ...ineficaz(), status: "Eficaz" })).toBe(false);
    expect(podeAbrirVinculada({ ...ineficaz(), rncSucessora: { id: "b2" } })).toBe(false);
  });
});

describe("prefillDaIneficaz", () => {
  test("traz identificação, tipo de origem e o vínculo", () => {
    const p = prefillDaIneficaz(ineficaz());
    expect(p).toMatchObject({ tipoRnc: "interna", produto: "Calcivitam", lote: "L77", nf: "NF 9", sev: "Maior", origemRnc: "a1", origemRncNum: "1111261" });
  });
  test("a descrição diz por que foi ineficaz e repete a original", () => {
    const { desc } = prefillDaIneficaz(ineficaz());
    expect(desc).toContain("RNC 1111261 foi encerrada como Ineficaz em 10/11/2026");
    expect(desc).toContain("Resultado da verificação: Lote 80 também úmido");
    expect(desc).toContain("Causa raiz tratada na 1111261: MP trocada sem teste");
    expect(desc.endsWith("Cápsulas úmidas no lote 77")).toBe(true);
    expect(desc).not.toMatch(/\n\n\n/);
  });
  test("externa: vem o fornecedor e o recebimento não conforme", () => {
    const r = { ...ineficaz(), tipoRnc: "externa", fornecedor: "Fornecedor X", ishikawa: {}, eficacia: {}, verificacaoRecebimento: { resultado: "Não conforme", lote: "L90", data: "2026-11-05", obs: "umidade 9%" } };
    const p = prefillDaIneficaz(r);
    expect(p.tipoRnc).toBe("externa");
    expect(p.fornecedor).toBe("Fornecedor X");
    expect(p.desc).toContain("em 05/11/2026");
    expect(p.desc).toContain("Recebimento seguinte (lote L90) não conforme: umidade 9%");
  });
});

describe("vínculo nas duas", () => {
  test("a nova registra a origem", () => {
    expect(historicoDaNova({ num: "1111261" }, "Lucas", "2026-11-11", "10:00")).toEqual({ data: "2026-11-11", hora: "10:00", acao: "Aberta a partir da RNC 1111261 (ineficaz)", resp: "Lucas", tipo: "vinculo" });
  });
  test("a antiga ganha a sucessora e uma entrada no histórico, sem mexer no resto", () => {
    const p = patchSucessora(ineficaz(), { id: "b2", num: "1111262" }, "Lucas", "2026-11-11", "10:00");
    expect(Object.keys(p).sort()).toEqual(["historico", "rncSucessora"]);
    expect(p.rncSucessora).toEqual({ id: "b2", num: "1111262", em: "2026-11-11", por: "Lucas" });
    expect(p.historico.map(h => h.acao)).toEqual(["RNC aberta", "Nova RNC 1111262 aberta a partir desta (ineficaz)"]);
  });
});

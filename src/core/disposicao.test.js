import { DISPOSICOES_ATIVAS, dispMeta, errosDisposicao, rotuloDisposicao } from "./status";

describe("disposição do material", () => {
  it("\"Liberar (uso normal)\" não é mais oferecida, mas o rótulo antigo continua legível", () => {
    expect(DISPOSICOES_ATIVAS.map(d => d.key)).not.toContain("liberar");
    expect(rotuloDisposicao({ decisao: "liberar" })).toBe("Liberar (uso normal)");
  });
  it("oferece \"Outros\" e concessão", () => {
    const keys = DISPOSICOES_ATIVAS.map(d => d.key);
    expect(keys).toContain("outros");
    expect(keys).toContain("concessao");
  });
  it("nenhuma decisão exige assinatura do RT", () => {
    expect(DISPOSICOES_ATIVAS.some(d => d.libera || d.exigeRT)).toBe(false);
  });
  it("\"Outros\" exige descrever a decisão", () => {
    expect(errosDisposicao({ decisao: "outros", justificativa: "ok", outro: " " })).toHaveLength(1);
    expect(errosDisposicao({ decisao: "outros", justificativa: "ok", outro: "Doação" })).toEqual([]);
  });
  it("justificativa segue obrigatória e decisão retirada é recusada", () => {
    expect(errosDisposicao({ decisao: "segregar", justificativa: "" })).toHaveLength(1);
    expect(errosDisposicao({ decisao: "liberar", justificativa: "x" })).toHaveLength(1);
    expect(errosDisposicao({ decisao: "", justificativa: "x" })).toHaveLength(1);
  });
  it("rótulo de \"Outros\" mostra o texto escrito", () => {
    expect(rotuloDisposicao({ decisao: "outros", outro: "Uso em lote piloto" })).toBe("Outros — Uso em lote piloto");
    expect(rotuloDisposicao({ decisao: "outros" })).toBe("Outros");
    expect(rotuloDisposicao(null)).toBe("");
    expect(dispMeta("concessao").label).toBe("Liberar sob concessão");
  });
});

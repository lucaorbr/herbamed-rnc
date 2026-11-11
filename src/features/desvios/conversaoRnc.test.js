import { anexosParaRnc } from "./conversaoRnc";

describe("anexosParaRnc", () => {
  it("copia os anexos do desvio marcando a origem", () => {
    const d = { num: "DV-2026-0007", anexos: [{ url: "/api/files/1", nome: "foto.jpg" }, { url: "/api/files/2", nome: "laudo.pdf" }] };
    expect(anexosParaRnc(d)).toEqual([
      { url: "/api/files/1", nome: "foto.jpg", origemDesvio: "DV-2026-0007" },
      { url: "/api/files/2", nome: "laudo.pdf", origemDesvio: "DV-2026-0007" },
    ]);
  });
  it("não altera o desvio original", () => {
    const d = { num: "DV-1", anexos: [{ url: "a" }] };
    anexosParaRnc(d);
    expect(d.anexos[0].origemDesvio).toBeUndefined();
  });
  it("desvio sem anexo devolve lista vazia", () => {
    expect(anexosParaRnc({ num: "DV-1" })).toEqual([]);
    expect(anexosParaRnc(null)).toEqual([]);
  });
});

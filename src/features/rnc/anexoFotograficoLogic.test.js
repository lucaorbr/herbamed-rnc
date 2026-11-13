import { ehImagem, figurasDaRnc, gruposPorEtapa, nomesComFigura } from "./anexoFotograficoLogic";

const img = (id, extra = {}) => ({ name: `${id}.jpg`, url: `/api/files/${id}`, type: "image/jpeg", ...extra });
const pdf = id => ({ name: `${id}.pdf`, url: `/api/files/${id}`, type: "application/pdf" });

describe("anexo fotográfico do PDF da RNC", () => {
  it("reconhece imagem pelo tipo ou, sem tipo, pela extensão", () => {
    expect(ehImagem(img("a"))).toBe(true);
    expect(ehImagem({ name: "foto.PNG" })).toBe(true);
    expect(ehImagem(pdf("b"))).toBe(false);
    expect(ehImagem({ name: "x.svg", type: "image/svg+xml" })).toBe(false);
  });

  it("numera só as imagens, na ordem das etapas, sem repetir a mesma foto", () => {
    const rnc = {
      anexos: [img("r1"), pdf("laudo")],
      investigacao: [{ anexos: [img("i1"), img("r1")], em: "2026-11-01", por: "Ana" }],
      w2h: [{ evidencias: [img("c1")], who: "Bia" }],
    };
    const f = figurasDaRnc(rnc);
    expect(f.map(x => [x.n, x.anexo.name, x.etapa])).toEqual([
      [1, "r1.jpg", "Registro"], [2, "i1.jpg", "Investigação"], [3, "c1.jpg", "Ação CAPA #1"],
    ]);
    expect(gruposPorEtapa(f).map(g => [g.etapa, g.figuras.length])).toEqual([["Registro", 1], ["Investigação", 1], ["Ação CAPA #1", 1]]);
  });

  it("marca a figura na lista de anexos do corpo; não-imagem fica só com o nome", () => {
    const rnc = { anexos: [img("r1"), pdf("laudo")] };
    expect(nomesComFigura(rnc.anexos, figurasDaRnc(rnc))).toBe("r1.jpg (Figura 1), laudo.pdf");
  });

  it("RNC sem fotos não gera figura", () => {
    expect(figurasDaRnc({ anexos: [pdf("x")] })).toEqual([]);
    expect(figurasDaRnc({})).toEqual([]);
  });
});

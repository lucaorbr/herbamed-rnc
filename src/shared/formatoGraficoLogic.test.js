import { FORMATOS, chaveFormato, formatoValido } from "./formatoGraficoLogic";

describe("formato do gráfico", () => {
  it("tem os três formatos, nesta ordem", () => {
    expect(FORMATOS.map(f => f.id)).toEqual(["empilhado", "lado", "linhas"]);
  });

  it("valor gravado válido é mantido", () => {
    expect(formatoValido("lado")).toBe("lado");
    expect(formatoValido("linhas", "empilhado")).toBe("linhas");
  });

  it("valor ausente ou estranho cai no padrão do gráfico", () => {
    expect(formatoValido(null)).toBe("empilhado");
    expect(formatoValido("pizza", "linhas")).toBe("linhas");
  });

  it("cada gráfico tem a própria chave", () => {
    expect(chaveFormato("desvios-tendencia")).not.toBe(chaveFormato("rnc-tendencia"));
  });
});

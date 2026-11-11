import { SEVERIDADES_RNC, SEVMETA } from "./status";

describe("severidade da RNC", () => {
  it("oferece só Maior e Menor", () => {
    expect(SEVERIDADES_RNC).toEqual(["Maior", "Menor"]);
  });
  it("RNC antiga com Crítica continua tendo cor para exibir", () => {
    expect(SEVMETA["Crítica"]).toBeTruthy();
  });
});

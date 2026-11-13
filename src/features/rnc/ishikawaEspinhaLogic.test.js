import { CORES_PDF, causasForaDoDesenho, MAX_POR_OSSO, espinhaSvg, layoutEspinha, quebrarTexto, temCausasIshikawa } from "./ishikawaEspinhaLogic";

const mede = (t) => String(t).length * 7;
const causasDe = layout => layout.elementos.filter(e => e.papel === "causa");

describe("quebrarTexto", () => {
  test("quebra por palavra dentro da largura", () => {
    expect(quebrarTexto("aaa bbb ccc", 50, mede, 500, 12, 3)).toEqual(["aaa bbb", "ccc"]);
  });
  test("corta com reticências além do máximo de linhas", () => {
    const l = quebrarTexto("aaa bbb ccc ddd eee", 50, mede, 500, 12, 2);
    expect(l).toHaveLength(2);
    expect(l[1].endsWith("…")).toBe(true);
  });
  test("palavra maior que a largura não some", () => {
    expect(quebrarTexto("encapsuladora", 20, mede, 500, 12, 2)).toEqual(["encapsuladora"]);
  });
});

describe("layoutEspinha", () => {
  test("desenha cada causa com categoria e marca a aprofundada", () => {
    const l = layoutEspinha({ efeito: "Cápsulas úmidas", causes: { mao: ["Treino"], material: ["MP úmida"] }, whyCausa: "MP úmida" }, mede);
    const cs = causasDe(l);
    expect(cs.map(c => [c.categoria, c.causa, c.marcada])).toEqual([["Mão de obra", "Treino", false], ["Material", "MP úmida", true]]);
    expect(cs[1].filhos.some(f => f.papel === "texto-sel")).toBe(true);
  });
  test("categoria vazia mostra 'nenhuma causa' e rótulo vazado", () => {
    const l = layoutEspinha({ causes: { mao: ["x"] } }, mede);
    expect(l.elementos.filter(e => e.texto === "nenhuma causa")).toHaveLength(5);
    expect(l.elementos.filter(e => e.papel === "rotulo-vazio")).toHaveLength(5);
  });
  test(`mais de ${MAX_POR_OSSO} causas: a última posição vira "+N na lista"`, () => {
    const l = layoutEspinha({ causes: { metodo: ["a", "b", "c", "d", "e", "f", "g"] } }, mede);
    expect(causasDe(l)).toHaveLength(MAX_POR_OSSO - 1);
    expect(l.elementos.some(e => e.texto === "+3 na lista")).toBe(true);
  });
  test("causas em branco são ignoradas", () => {
    expect(causasDe(layoutEspinha({ causes: { mao: ["", "  ", "ok"] } }, mede)).map(c => c.causa)).toEqual(["ok"]);
  });
  test("o texto da causa não passa do osso vizinho", () => {
    const longa = "Causa com um texto bem comprido que precisaria quebrar em várias linhas para caber";
    const l = layoutEspinha({ causes: { maquina: [longa] } }, mede);
    const ramo = causasDe(l)[0].filhos.find(f => f.papel === "ramo");
    expect(ramo.attrs.x2 - ramo.attrs.x1).toBeLessThanOrEqual(230 + 18);
  });
});

describe("espinhaSvg (PDF)", () => {
  test("sem causa levantada não desenha", () => {
    expect(espinhaSvg({ causes: {} })).toBe("");
    expect(temCausasIshikawa({ causes: { mao: [" "] } })).toBe(false);
  });
  test("gera SVG com o texto escapado e as cores do PDF", () => {
    const svg = espinhaSvg({ efeito: "A < B", causes: { mao: ["Falta & treino"] }, whyCausa: "Falta & treino" });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("A &lt; B");
    expect(svg).toContain("Falta &amp; treino");
    expect(svg).toContain(CORES_PDF.sel);
  });
});

describe("causas fora do desenho (lista no PDF)", () => {
  it("lista por extenso a categoria com mais causas do que cabem no osso", () => {
    const causes = { mao: ["a1", "a2", "a3", "a4", "a5", "a6"], maquina: ["m1"] };
    expect(causasForaDoDesenho({ causes })).toEqual([{ categoria: "Mão de obra", causas: ["a1", "a2", "a3", "a4", "a5", "a6"] }]);
  });
  it("lista a categoria cuja causa saiu cortada com reticências", () => {
    const longa = "Operador não conferiu a identificação do lote na etapa de pesagem porque a etiqueta estava ilegível e o procedimento não previa dupla checagem do material recebido";
    expect(causasForaDoDesenho({ causes: { metodo: [longa] } })).toEqual([{ categoria: "Método", causas: [longa] }]);
  });
  it("tudo cabendo no desenho, não lista nada", () => {
    expect(causasForaDoDesenho({ causes: { mao: ["Falta de treino"] } })).toEqual([]);
    expect(causasForaDoDesenho({})).toEqual([]);
  });
});

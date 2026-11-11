import { comCausaCapaNaAbertura, errosCausaCapaNaAbertura } from "./ferramentasLogic";

const base = () => ({ status: "Aberta", desc: "Cápsulas úmidas no lote 12\nmais detalhes", historico: [{ acao: "RNC aberta" }], ishikawa: { efeito: "", whys: [], root: "" }, w2h: [], modoPrazo: "definicao", prazoAC: "" });
const analise = { efeito: "", whys: ["a", "b", "c", "", ""], root: "MP trocada" };
const acao = { id: "1", tipo: "Corretiva", what: "Trocar MP", who: "Ana", when: "2026-12-10", status: "Pendente" };

describe("errosCausaCapaNaAbertura", () => {
  test("nada preenchido não trava", () => {
    expect(errosCausaCapaNaAbertura({ whys: [] }, [])).toEqual([]);
  });
  test("ação CAPA sem análise completa é recusada", () => {
    expect(errosCausaCapaNaAbertura({ whys: ["a", "b"], root: "x" }, [acao])[0]).toMatch(/3 porquês e a causa raiz/);
    expect(errosCausaCapaNaAbertura({ whys: ["a", "b", "c"], root: "" }, [acao])).toHaveLength(1);
  });
  test("com análise completa valida as ações", () => {
    expect(errosCausaCapaNaAbertura(analise, [acao])).toEqual([]);
    expect(errosCausaCapaNaAbertura(analise, [{ ...acao, who: "" }])).toEqual(["Ação #1: falta quem."]);
  });
});

describe("comCausaCapaNaAbertura", () => {
  test("sem nada preenchido devolve o draft igual", () => {
    const d = base();
    expect(comCausaCapaNaAbertura(d, "Lucas", "2026-11-11", "10:00")).toBe(d);
  });
  test("só a análise: histórico, efeito e Em andamento", () => {
    const r = comCausaCapaNaAbertura({ ...base(), ishikawa: analise }, "Lucas", "2026-11-11", "10:00");
    expect(r.ishikawa.efeito).toBe("Cápsulas úmidas no lote 12");
    expect(r.status).toBe("Em andamento");
    expect(r.historico.map(h => h.acao)).toEqual(["RNC aberta", "Análise de causa registrada na abertura", "Status alterado -> Em andamento (análise de causa na abertura)"]);
    expect(r.historico[1].detalhes).toContain("Causa raiz definida");
    expect(r.w2h).toEqual([]);
  });
  test("análise + CAPA: prazo vem das ações e o prazo deixa de estar em definição", () => {
    const r = comCausaCapaNaAbertura({ ...base(), ishikawa: analise, w2h: [acao] }, "Lucas", "2026-11-11", "10:00");
    expect(r.prazoAC).toBe("2026-12-10");
    expect(r.modoPrazo).toBe("definido");
    expect(r.historico.map(h => h.acao)).toContain("CAPA — 1 ação(ões)");
    expect(r.historico.slice(1).every(h => h.hora === "10:00" && h.resp === "Lucas")).toBe(true);
    expect(r.historico.at(-1).acao).toMatch(/análise de causa e plano CAPA na abertura/);
  });
  test("status escolhido diferente de Aberta é mantido", () => {
    const r = comCausaCapaNaAbertura({ ...base(), status: "Em andamento", ishikawa: analise }, "Lucas", "2026-11-11", "10:00");
    expect(r.historico.some(h => h.tipo === "status")).toBe(false);
  });
});

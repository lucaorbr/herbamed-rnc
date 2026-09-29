import {
  porquesPreenchidos, rncEditavelNasFerramentas, errosDasAcoesCapa, prazoGeralCapa,
  patchSalvarCapa, podeRegistrarEficacia, partirDaRespostaFornecedor,
} from "./ferramentasLogic";

const whys3 = ["a", "b", "c", "", ""];
const completa = {
  status: "Em andamento",
  ishikawa: { whys: whys3, root: "POP sem conferência" },
  w2h: [{ id: "1", what: "Revisar POP", who: "Ana", when: "2026-10-10", status: "Concluída" }],
};

describe("rncEditavelNasFerramentas", () => {
  test("RNC ativa pode ser tratada", () => {
    expect(rncEditavelNasFerramentas({ status: "Aberta" })).toBe(true);
    expect(rncEditavelNasFerramentas({ status: "Pendente verificação" })).toBe(true);
  });
  test("RNC encerrada é registro fechado", () => {
    ["Eficaz", "Ineficaz", "Encerrada"].forEach(status =>
      expect(rncEditavelNasFerramentas({ status })).toBe(false));
    expect(rncEditavelNasFerramentas(null)).toBe(false);
  });
});

describe("errosDasAcoesCapa", () => {
  test("ação ativa sem o quê/quem/quando é apontada", () => {
    expect(errosDasAcoesCapa([{ what: "", who: " ", when: "", status: "Pendente" }]))
      .toEqual(["Ação #1: falta o quê, quem, quando."]);
  });
  test("ação concluída ou cancelada não é cobrada", () => {
    expect(errosDasAcoesCapa([{ status: "Cancelada" }, { status: "Concluída" }])).toEqual([]);
  });
});

describe("prazoGeralCapa", () => {
  test("usa o prazo mais tardio das ações ativas", () => {
    expect(prazoGeralCapa([
      { when: "2026-10-01", status: "Pendente" },
      { when: "2026-12-01", status: "Concluída" },
      { when: "2026-11-01", status: "Em andamento" },
    ])).toBe("2026-11-01");
    expect(prazoGeralCapa([])).toBe("");
  });
});

describe("patchSalvarCapa", () => {
  test("um único patch preserva as duas entradas de histórico, com autor", () => {
    const r = { historico: [{ acao: "Criou" }], w2h: [{ id: "1", what: "X", when: "2026-10-01" }] };
    const acts = [{ id: "1", what: "X", who: "Ana", when: "2026-10-20", status: "Pendente" }];
    const p = patchSalvarCapa(r, acts, "Lucas", "2026-09-29");
    expect(p.w2h).toBe(acts);
    expect(p.prazoAC).toBe("2026-10-20");
    expect(p.historico.map(h => h.acao)).toEqual(["Criou", "CAPA — 1 ação(ões)", "Prazo geral calculado pelas ações CAPA"]);
    expect(p.historico.slice(1).every(h => h.resp === "Lucas")).toBe(true);
    expect(p.historico[2].detalhes).toContain('Ação "X": prazo 2026-10-01 → 2026-10-20');
  });
});

describe("podeRegistrarEficacia", () => {
  test("ciclo completo libera Eficaz", () => {
    expect(podeRegistrarEficacia(completa, "Eficaz")).toEqual({ ok: true, motivos: [] });
  });
  test("RNC sem nenhuma ação CAPA não fecha (era o furo)", () => {
    const r = { ...completa, w2h: [] };
    const res = podeRegistrarEficacia(r, "Eficaz");
    expect(res.ok).toBe(false);
    expect(res.motivos).toContain("É preciso ao menos uma ação CAPA concluída.");
  });
  test("sem 5 porquês ou sem causa raiz não fecha", () => {
    const r = { ...completa, ishikawa: { whys: ["a", "", "", "", ""], root: "" } };
    const res = podeRegistrarEficacia(r, "Ineficaz");
    expect(res.ok).toBe(false);
    expect(res.motivos.length).toBe(2);
  });
  test("ação em aberto impede fechar", () => {
    const r = { ...completa, w2h: [...completa.w2h, { id: "2", status: "Pendente" }] };
    expect(podeRegistrarEficacia(r, "Eficaz").motivos).toContain("Há 1 ação(ões) CAPA ainda em aberto.");
  });
  test("todas canceladas não bastam: precisa de ao menos uma concluída", () => {
    const r = { ...completa, w2h: [{ id: "1", status: "Cancelada" }] };
    expect(podeRegistrarEficacia(r, "Eficaz").ok).toBe(false);
  });
  test("'Pendente verificação' sempre pode ser registrado", () => {
    expect(podeRegistrarEficacia({ status: "Aberta" }, "Pendente verificação").ok).toBe(true);
  });
  test("porquesPreenchidos ignora espaços", () => {
    expect(porquesPreenchidos({ ishikawa: { whys: ["a", " ", "b"] } })).toBe(2);
  });
});

describe("partirDaRespostaFornecedor", () => {
  const resp = { porques: ["f1", "f2", ""], causaRaiz: "raiz do fornecedor" };
  test("preenche só os porquês vazios e a raiz vazia", () => {
    const r = partirDaRespostaFornecedor(["q1", "", "", "", ""], "", resp);
    expect(r.whys).toEqual(["q1", "f1", "f2", "", ""]);
    expect(r.root).toBe("raiz do fornecedor");
    expect(r.aproveitou).toBe(true);
  });
  test("nunca sobrescreve o que a Qualidade já escreveu", () => {
    const r = partirDaRespostaFornecedor(["q1", "q2", "q3", "q4", "q5"], "raiz nossa", resp);
    expect(r.whys).toEqual(["q1", "q2", "q3", "q4", "q5"]);
    expect(r.root).toBe("raiz nossa");
    expect(r.aproveitou).toBe(false);
  });
});

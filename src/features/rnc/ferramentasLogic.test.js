import {
  porquesPreenchidos, rncEditavelNasFerramentas, errosDasAcoesCapa, prazoGeralCapa,
  patchSalvarCapa, podeRegistrarEficacia, partirDaRespostaFornecedor, etapasDaRnc, rncTemMaterial,
  resumoAnaliseCausa, filaAnaliseCausa,
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

describe("etapasDaRnc", () => {
  const estados = r => Object.fromEntries(etapasDaRnc(r).map(e => [e.id, e.estado]));
  test("RNC recém-aberta: registro feito, contenção é a próxima, CAPA e eficácia bloqueadas", () => {
    expect(estados({ status: "Aberta", desc: "x", tipo: "Processo" })).toEqual({
      registro: "concluida", contencao: "atual", causa: "pendente", capa: "bloqueada", eficacia: "bloqueada",
    });
  });
  test("contenção sem disposição não conclui a etapa quando há material", () => {
    const e = estados({ status: "Em andamento", desc: "x", contencao: "segregado", lote: "L1" });
    expect(e.contencao).toBe("atual");
    expect(estados({ status: "Em andamento", desc: "x", contencao: "segregado", lote: "L1", disposicao: { decisao: "segregar" } }).contencao).toBe("concluida");
  });
  test("com causa raiz, a CAPA destrava e vira a próxima", () => {
    const e = estados({ status: "Em andamento", desc: "x", contencao: "c", tipo: "Processo", ishikawa: { whys: whys3, root: "r" } });
    expect(e.causa).toBe("concluida");
    expect(e.capa).toBe("atual");
    expect(e.eficacia).toBe("bloqueada");
  });
  test("ciclo completo e verificado: tudo concluído", () => {
    const e = estados({ ...completa, status: "Eficaz", desc: "x", contencao: "c", tipo: "Processo" });
    expect(Object.values(e).every(v => v === "concluida")).toBe(true);
  });
  test("encerrada por disposição dispensa CAPA e eficácia", () => {
    const e = estados({ status: "Encerrada", desc: "x", contencao: "c", lote: "L1", disposicao: { decisao: "concessao" } });
    expect(e.capa).toBe("dispensada");
    expect(e.eficacia).toBe("dispensada");
  });
  test("bloqueio traz o motivo", () => {
    const capa = etapasDaRnc({ status: "Aberta", desc: "x" }).find(e => e.id === "capa");
    expect(capa.motivo).toMatch(/causa raiz/);
  });
  test("rncTemMaterial pelo tipo ou por lote/produto", () => {
    expect(rncTemMaterial({ tipo: "Matéria-prima" })).toBe(true);
    expect(rncTemMaterial({ tipo: "Processo", lote: " L1 " })).toBe(true);
    expect(rncTemMaterial({ tipo: "Processo" })).toBe(false);
  });
});

describe("resumoAnaliseCausa", () => {
  test("primeira análise: causas, porquês e causa raiz definida", () => {
    const d = resumoAnaliseCausa({}, { causes: { metodo: ["a", "b"] }, whys: whys3, root: "POP", whyCausa: "b" });
    expect(d).toEqual(["Ishikawa: 0 → 2 causa(s) levantada(s)", "5 Porquês: 3 de 5 preenchido(s) (antes 0)", "Causa raiz definida", "Causa aprofundada: b"]);
  });
  test("troca de causa raiz guarda o texto anterior", () => {
    const d = resumoAnaliseCausa({ whys: whys3, root: "antiga" }, { whys: whys3, root: "nova" });
    expect(d).toEqual(['Causa raiz alterada — antes: "antiga"']);
  });
  test("nada mudou → sem detalhes", () => {
    const x = { causes: { mao: ["a"] }, whys: whys3, root: "r", whyCausa: "a" };
    expect(resumoAnaliseCausa(x, { ...x })).toEqual([]);
  });
});

describe("filaAnaliseCausa", () => {
  test("só RNC ativa sem análise completa, ordenada pelo prazo da análise", () => {
    const rncs = [
      { id: "a", status: "Aberta", prazoCausa: "2026-10-10" },
      { id: "b", status: "Em andamento", prazoCausa: "2026-10-01" },
      { id: "c", status: "Aberta" },
      { id: "d", status: "Eficaz" },
      { id: "e", status: "Em andamento", ishikawa: { whys: whys3, root: "r" } },
    ];
    expect(filaAnaliseCausa(rncs).map(r => r.id)).toEqual(["b", "a", "c"]);
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

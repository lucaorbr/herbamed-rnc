import {
  porquesPreenchidos, rncEditavelNasFerramentas, errosDasAcoesCapa, prazoGeralCapa,
  patchSalvarCapa, podeRegistrarEficacia, partirDaRespostaFornecedor, etapasDaRnc, rncTemMaterial,
  resumoAnaliseCausa, filaAnaliseCausa, resumoCapa, acaoRemovivel, filaCapa, contagemCapa, acaoAnterior, travaEficacia, patchEficacia, filaEficacia, etapaParaContinuar, novoRegistroInvestigacao, patchInvestigacao,
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

describe("resumoCapa", () => {
  test("registra inclusão, mudança de status, evidência e remoção", () => {
    const antes = [{ id: "1", what: "Revisar POP", status: "Pendente", evidencias: [] }, { id: "2", what: "Treinar", status: "Pendente" }];
    const depois = [
      { id: "1", what: "Revisar POP", status: "Concluída", evidencias: [{ name: "pop.pdf" }] },
      { id: "3", what: "Auditar linha", tipo: "Preventiva", who: "Ana", status: "Pendente" },
    ];
    expect(resumoCapa(antes, depois)).toEqual([
      'Ação "Revisar POP": Pendente → Concluída',
      'Ação "Revisar POP": 1 evidência(s) anexada(s)',
      'Ação incluída: "Auditar linha" (Preventiva, Ana)',
      'Ação removida: "Treinar"',
    ]);
  });
  test("patchSalvarCapa leva o resumo no histórico", () => {
    const p = patchSalvarCapa({ w2h: [] }, [{ id: "1", what: "X", who: "Ana", when: "2026-10-01", status: "Pendente" }], "Lucas", "2026-09-30");
    expect(p.historico[0].detalhes).toEqual(['Ação incluída: "X" (Corretiva, Ana)']);
  });
});

describe("acaoRemovivel", () => {
  test("só a ação ainda não salva pode ser apagada", () => {
    const r = { w2h: [{ id: "1" }] };
    expect(acaoRemovivel(r, { id: "1" })).toBe(false);
    expect(acaoRemovivel(r, { id: "2" })).toBe(true);
    expect(acaoRemovivel({}, { id: "1" })).toBe(true);
  });
});

describe("filaCapa", () => {
  const causa = { ishikawa: { whys: whys3, root: "raiz" } };
  test("só RNC ativa com causa completa e plano por fazer; sem plano primeiro, depois pelo prazo", () => {
    const rncs = [
      { id: "prazo-longe", status: "Em andamento", ...causa, w2h: [{ id: "a", when: "2026-12-01", status: "Pendente" }] },
      { id: "sem-plano", status: "Em andamento", ...causa, w2h: [] },
      { id: "prazo-perto", status: "Em andamento", ...causa, w2h: [{ id: "a", when: "2026-10-05", status: "Em andamento" }, { id: "b", when: "2026-09-01", status: "Concluída" }] },
      { id: "tudo-fechado", status: "Em andamento", ...causa, w2h: [{ id: "a", status: "Concluída" }] },
      { id: "sem-causa", status: "Em andamento", w2h: [] },
      { id: "encerrada", status: "Eficaz", ...causa, w2h: [] },
    ];
    expect(filaCapa(rncs).map(r => r.id)).toEqual(["sem-plano", "prazo-perto", "prazo-longe"]);
  });
});

describe("contagemCapa", () => {
  test("conta concluídas, abertas, vencidas e o próximo prazo em aberto", () => {
    const r = { w2h: [
      { status: "Concluída", when: "2026-01-01" },
      { status: "Pendente", when: "2026-09-01" },
      { status: "Em andamento", when: "2026-10-10" },
      { status: "Cancelada", when: "2026-02-01" },
    ] };
    expect(contagemCapa(r, "2026-09-30")).toEqual({ total: 4, concluidas: 1, abertas: 2, vencidas: 1, proximoPrazo: "2026-09-01" });
  });
});

describe("ações antigas sem id", () => {
  // Era o defeito: undefined === undefined casava toda ação antiga com a primeira.
  const antes = [{ what: "A", status: "Concluída", when: "2026-09-01" }, { what: "B", status: "Pendente", when: "2026-09-10" }];
  test("casam pela posição", () => {
    const depois = [{ ...antes[0] }, { ...antes[1], status: "Concluída", when: "2026-09-20" }, { id: "n1", what: "C", who: "Ana", status: "Pendente" }];
    expect(acaoAnterior(antes, depois[1], 1)).toBe(antes[1]);
    expect(resumoCapa(antes, depois)).toEqual(['Ação "B": Pendente → Concluída', 'Ação incluída: "C" (Corretiva, Ana)']);
    const p = patchSalvarCapa({ w2h: antes }, depois, "Lucas", "2026-09-30");
    expect(p.historico.at(-1).detalhes).toContain('Ação "B": prazo 2026-09-10 → 2026-09-20');
    expect(p.historico.at(-1).detalhes.some(d => d.startsWith('Ação "A"'))).toBe(false);
  });
  test("não se removem", () => {
    expect(acaoRemovivel({ w2h: antes }, antes[0])).toBe(false);
  });
});

describe("travaEficacia", () => {
  test("ciclo completo sem material libera Eficaz", () => {
    expect(travaEficacia(completa, "Eficaz").ok).toBe(true);
  });
  test("RNC com material exige disposição só para Eficaz", () => {
    const r = { ...completa, lote: "L-01" };
    expect(travaEficacia(r, "Eficaz").motivos.some(m => m.includes("disposição"))).toBe(true);
    expect(travaEficacia(r, "Ineficaz").ok).toBe(true);
    expect(travaEficacia({ ...r, disposicao: { decisao: "liberar" } }, "Eficaz").ok).toBe(true);
  });
  test("Pendente verificação nunca trava", () => {
    expect(travaEficacia({ status: "Aberta", lote: "L" }, "Pendente verificação").ok).toBe(true);
  });
});

describe("patchEficacia", () => {
  test("status, autoria e histórico com o que foi verificado", () => {
    const r = { historico: [{ acao: "Criou" }], eficacia: { resultado: "Pendente verificação", anexos: [] } };
    const f = { criterio: "3 lotes sem desvio", data: "2026-10-01", resp: "Ana", resultado: "Eficaz", anexos: [{ name: "rel.pdf" }] };
    const p = patchEficacia(r, f, "Lucas", "2026-10-01T10:00:00Z", "2026-10-01", "10:00:00");
    expect(p.status).toBe("Eficaz");
    expect(p.eficacia).toMatchObject({ criterio: "3 lotes sem desvio", registradoPor: "Lucas", registradoEm: "2026-10-01T10:00:00Z" });
    const h = p.historico.at(-1);
    expect(h).toMatchObject({ acao: "Eficácia: Eficaz", resp: "Lucas", tipo: "eficacia" });
    expect(h.detalhes).toEqual([
      "Critério: 3 lotes sem desvio",
      "Data da verificação: 2026-10-01",
      "Verificação indicada como responsabilidade de Ana",
      "1 anexo(s) incluído(s)",
      "Resultado anterior: Pendente verificação",
    ]);
  });
});

describe("filaEficacia", () => {
  test("CAPA concluída ou já agendada, ativas, pelo prazo de eficácia", () => {
    const rncs = [
      { ...completa, id: "longe", prazoEfic: "2026-12-01" },
      { ...completa, id: "perto", prazoEfic: "2026-10-05" },
      { id: "agendada", status: "Pendente verificação", prazoEfic: "2026-11-01" },
      { ...completa, id: "capa-aberta", w2h: [{ id: "1", status: "Pendente" }] },
      { ...completa, id: "fechada", status: "Eficaz" },
    ];
    expect(filaEficacia(rncs).map(r => r.id)).toEqual(["perto", "agendada", "longe"]);
  });
});

describe("etapaParaContinuar", () => {
  test("a próxima a fazer", () => {
    expect(etapaParaContinuar({ status: "Aberta", desc: "x" }).id).toBe("contencao");
  });
  test("sem etapa atual, a bloqueada (com motivo)", () => {
    const r = { status: "Em andamento", desc: "x", contencao: "feito", ishikawa: { whys: ["a"], root: "" } };
    // causa ainda aberta vira a atual; se ela estivesse feita e a CAPA aberta, seria a CAPA
    expect(etapaParaContinuar(r).id).toBe("causa");
    const semAtual = { ...completa, desc: "x", contencao: "feito", w2h: [{ id: "1", what: "a", who: "b", when: "2026-10-01", status: "Pendente" }] };
    expect(etapaParaContinuar(semAtual).id).toBe("capa");
  });
  test("RNC encerrada não tem para onde continuar", () => {
    expect(etapaParaContinuar({ ...completa, status: "Eficaz" })).toBeNull();
  });
});

describe("investigação", () => {
  test("texto é obrigatório", () => {
    expect(novoRegistroInvestigacao("  ", [], "Lucas", "2026-09-30T10:00:00Z").erro).toBeTruthy();
  });
  test("acrescenta sem mexer nos anteriores e registra no histórico", () => {
    const antigo = { id: "a", texto: "Umidade fórmula antiga: 3,1%", por: "Ana", em: "2026-09-29T09:00:00Z", anexos: [] };
    const r = { investigacao: [antigo], historico: [{ acao: "Criou" }] };
    const { registro } = novoRegistroInvestigacao("Umidade fórmula nova: 1,2%", [{ name: "laudo.pdf" }], "Lucas", "2026-09-30T10:00:00Z");
    const p = patchInvestigacao(r, registro, "2026-09-30", "10:00:00");
    expect(p.investigacao[0]).toBe(antigo);
    expect(p.investigacao[1]).toMatchObject({ texto: "Umidade fórmula nova: 1,2%", por: "Lucas", em: "2026-09-30T10:00:00Z" });
    expect(p.historico.at(-1)).toMatchObject({ acao: "Investigação registrada", resp: "Lucas", tipo: "investigacao", detalhes: ["Umidade fórmula nova: 1,2%", "1 anexo(s)"] });
  });
});

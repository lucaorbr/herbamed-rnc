import {
  prazoSac, normLote, contagemPorLote, mesmoLote, errosDoRegistro, errosDoEncerramento,
  avisosDoEncerramento, descParaRNC, novaResposta, META_RESPOSTA_DIAS,
  etapaAmostra, errosDaAvaliacao, novaAvaliacao, kpisSac, contarPor, lotesRecorrentes, porMesClassificacao, mediana, diasPrimeiraResposta,
} from "./sacLogic";

describe("prazoSac", () => {
  it("conta os dias desde o contato e marca atraso depois da meta", () => {
    expect(prazoSac({ status: "Aberto", dataContato: "2026-09-01" }, "2026-09-05")).toEqual({ dias: 4, atrasado: false });
    expect(prazoSac({ status: "Em análise", dataContato: "2026-09-01" }, "2026-09-20").atrasado).toBe(true);
    expect(prazoSac({ status: "Aberto", dataContato: "2026-09-01" }, `2026-09-0${1 + META_RESPOSTA_DIAS}`).atrasado).toBe(false);
  });
  it("atendimento encerrado não tem prazo", () => {
    expect(prazoSac({ status: "Encerrado", dataContato: "2020-01-01" })).toBeNull();
  });
});

describe("lote", () => {
  it("normaliza grafias do mesmo lote", () => {
    expect(normLote(" l-2025/001 ")).toBe(normLote("L2025001"));
    expect(normLote("")).toBe("");
  });
  it("conta e lista atendimentos do mesmo lote", () => {
    const at = [
      { id: "1", lote: "L-01", createdAt: 1 }, { id: "2", lote: "l01", createdAt: 3 },
      { id: "3", lote: "L-02", createdAt: 2 }, { id: "4", lote: "" },
    ];
    expect(contagemPorLote(at).get("L01")).toBe(2);
    expect(contagemPorLote(at).has("")).toBe(false);
    expect(mesmoLote(at[0], at).map(x => x.id)).toEqual(["2"]);
    expect(mesmoLote(at[3], at)).toEqual([]);
  });
});

describe("errosDoRegistro", () => {
  const ok = { consumidorNome: "Maria", consumidorTelefone: "11 9999", produto: "Ômega 3", relato: "Cápsula vazando" };
  it("aceita o registro mínimo", () => {
    expect(errosDoRegistro(ok)).toEqual({});
  });
  it("exige telefone OU e-mail, não os dois", () => {
    expect(errosDoRegistro({ ...ok, consumidorTelefone: "", consumidorEmail: "m@x.com" })).toEqual({});
    expect(errosDoRegistro({ ...ok, consumidorTelefone: "" })).toHaveProperty("consumidorTelefone");
  });
  it("reação relatada exige descrição", () => {
    expect(errosDoRegistro({ ...ok, teveReacao: "Sim" })).toHaveProperty("reacaoDesc");
  });
});

describe("encerramento", () => {
  const resp = [{ id: "r1" }];
  it("exige classificação, resposta e conclusão", () => {
    expect(errosDoEncerramento({}, "")).toHaveLength(3);
    expect(errosDoEncerramento({ classificacao: "Dúvida", respostas: resp }, "Respondido")).toEqual([]);
  });
  it("evento adverso exige avaliação técnica e decisão sobre notificação", () => {
    const a = { classificacao: "Evento adverso", respostas: resp };
    expect(errosDoEncerramento(a, "ok")).toHaveLength(2);
    expect(errosDoEncerramento({ ...a, avaliacao: { resultado: "Improcedente" }, notificacaoVigilancia: { decisao: "Não notificado" } }, "ok")).toEqual([]);
  });
  it("queixa técnica exige avaliação; dúvida não", () => {
    expect(errosDoEncerramento({ classificacao: "Queixa técnica", respostas: resp }, "ok")).toHaveLength(1);
    expect(errosDoEncerramento({ classificacao: "Queixa técnica", respostas: resp, avaliacao: { resultado: "Procedente" } }, "ok")).toEqual([]);
  });
  it("avisa quando a amostra pedida ainda não chegou", () => {
    const a = { classificacao: "Dúvida", amostra: { solicitada: { em: "2026-09-10T10:00:00Z" } } };
    expect(avisosDoEncerramento(a, null)[0]).toContain("2026-09-10");
    expect(avisosDoEncerramento({ ...a, amostra: { ...a.amostra, recebida: { em: "2026-09-12" } } }, null)).toEqual([]);
  });
  it("avisa — sem travar — RNC em aberto e queixa técnica sem RNC", () => {
    expect(avisosDoEncerramento({ classificacao: "Queixa técnica" }, null)).toHaveLength(1);
    expect(avisosDoEncerramento({ classificacao: "Queixa técnica", rncId: "x" }, { num: "NC-1", status: "Em andamento" })).toHaveLength(1);
    expect(avisosDoEncerramento({ classificacao: "Queixa técnica", rncId: "x" }, { num: "NC-1", status: "Eficaz" })).toEqual([]);
  });
});

describe("descParaRNC e novaResposta", () => {
  it("leva o relato e a reação para a RNC", () => {
    const t = descParaRNC({ num: "SAC-2026-0001", relato: "Gosto estranho", teveReacao: "Sim", reacaoDesc: "Náusea" });
    expect(t).toContain("SAC-2026-0001");
    expect(t).toContain("Gosto estranho");
    expect(t).toContain("Náusea");
  });
  it("carimba autor e momento da resposta", () => {
    const r = novaResposta({ texto: "  Enviaremos troca  ", meio: "E-mail" }, { name: "Ana" }, new Date("2026-10-01T10:00:00Z"));
    expect(r).toMatchObject({ texto: "Enviaremos troca", meio: "E-mail", por: "Ana", em: "2026-10-01T10:00:00.000Z" });
  });
});

describe("amostra e avaliação", () => {
  it("acompanha a amostra: não pedida → aguardando → recebida", () => {
    expect(etapaAmostra({})).toBe("nao_solicitada");
    expect(etapaAmostra({ amostra: { solicitada: {} } })).toBe("aguardando");
    expect(etapaAmostra({ amostra: { solicitada: {}, recebida: {} } })).toBe("recebida");
  });
  it("avaliação exige resultado válido e parecer", () => {
    expect(errosDaAvaliacao({})).toHaveLength(2);
    expect(errosDaAvaliacao({ resultado: "Talvez", parecer: "x" })).toHaveLength(1);
    expect(errosDaAvaliacao({ resultado: "Procedente", parecer: "Cápsula fora do peso" })).toEqual([]);
  });
  it("avaliação carimba autor", () => {
    const av = novaAvaliacao({ resultado: "Procedente", parecer: " ok " }, { name: "Ana" }, new Date("2026-10-01T10:00:00Z"));
    expect(av).toMatchObject({ resultado: "Procedente", parecer: "ok", por: "Ana", amostraConsumidor: "Não" });
  });
});

describe("indicadores", () => {
  const lista = [
    { num: "S1", dataContato: "2026-09-01", classificacao: "Queixa técnica", lote: "L1", canal: "Telefone", respostas: [{ data: "2026-09-03" }], status: "Encerrado", encerradoEm: "2026-09-10", avaliacao: { resultado: "Procedente" }, rncId: "r" },
    { num: "S2", dataContato: "2026-09-05", classificacao: "Queixa técnica", lote: "l-1", canal: "E-mail", respostas: [{ data: "2026-09-20" }], avaliacao: { resultado: "Improcedente" } },
    { num: "S3", dataContato: "2026-10-01", classificacao: "Evento adverso", teveReacao: "Sim", canal: "Telefone" },
    { num: "S4", dataContato: "2026-10-02" },
  ];
  it("calcula taxas só sobre quem tem o dado", () => {
    const k = kpisSac(lista);
    expect(k).toMatchObject({ total: 4, queixas: 2, eventos: 1, reacoes: 1, avaliadas: 2, procedentes: 1, taxaProcedencia: 50, respondidos: 2, taxaNoPrazo: 50, medianaEncerramento: 9, comRnc: 1 });
    expect(kpisSac([]).taxaProcedencia).toBeNull();
  });
  it("primeira resposta e mediana", () => {
    expect(diasPrimeiraResposta(lista[0])).toBe(2);
    expect(diasPrimeiraResposta(lista[2])).toBeNull();
    expect(mediana([5, 1, 3])).toBe(3);
    expect(mediana([1, 2])).toBe(1.5);
  });
  it("conta por canal e agrupa lotes recorrentes", () => {
    expect(contarPor(lista, a => a.canal)[0]).toEqual({ nome: "Telefone", qtd: 2 });
    expect(contarPor(lista, a => a.canal).find(x => x.nome === "Não informado").qtd).toBe(1);
    expect(lotesRecorrentes(lista)).toEqual([expect.objectContaining({ qtd: 2, procedentes: 1, nums: ["S1", "S2"] })]);
  });
  it("monta a série mensal por classificação", () => {
    const r = porMesClassificacao(lista, ["2026-09", "2026-10"]);
    expect(r[0]).toMatchObject({ mes: "2026-09", total: 2, "Queixa técnica": 2 });
    expect(r[1]).toMatchObject({ total: 2, "Evento adverso": 1, "A classificar": 1 });
  });
});

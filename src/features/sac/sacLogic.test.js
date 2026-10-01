import {
  prazoSac, normLote, contagemPorLote, mesmoLote, errosDoRegistro, errosDoEncerramento,
  avisosDoEncerramento, descParaRNC, novaResposta, META_RESPOSTA_DIAS,
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
  it("evento adverso exige a decisão sobre notificação", () => {
    const a = { classificacao: "Evento adverso", respostas: resp };
    expect(errosDoEncerramento(a, "ok")).toHaveLength(1);
    expect(errosDoEncerramento({ ...a, notificacaoVigilancia: { decisao: "Não notificado" } }, "ok")).toEqual([]);
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

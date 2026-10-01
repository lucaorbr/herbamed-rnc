import {
  prazoSac, normLote, contagemPorLote, mesmoLote, errosDoRegistro, errosDoEncerramento,
  avisosDoEncerramento, descParaRNC, novaResposta, META_RESPOSTA_DIAS,
  etapaAmostra, errosDaAvaliacao, novaAvaliacao, kpisSac, contarPor, contarSetores, lotesRecorrentes,
  porMesClassificacao, mediana, diasPrimeiraResposta, mascaraDoc, mascaraCep, faltasEndereco,
  novoEncaminhamento, comRetorno, exigeAvaliacao, podeFinalizarNaRecepcao, comAndamento, SETOR_QUALIDADE,
} from "./sacLogic";

const ana = { name: "Ana" };
const endereco = { consumidorCEP: "13010-100", consumidorLogradouro: "Rua A", consumidorNumero: "10", consumidorBairro: "Centro", consumidorCidade: "Campinas", consumidorUF: "SP" };

describe("prazoSac e status", () => {
  it("conta os dias desde o contato e marca atraso depois da meta", () => {
    expect(prazoSac({ status: "Em aberto", dataContato: "2026-09-01" }, "2026-09-05")).toEqual({ dias: 4, atrasado: false });
    expect(prazoSac({ status: "Em andamento", dataContato: "2026-09-01" }, "2026-09-20").atrasado).toBe(true);
    expect(prazoSac({ status: "Em aberto", dataContato: "2026-09-01" }, `2026-09-0${1 + META_RESPOSTA_DIAS}`).atrasado).toBe(false);
  });
  it("finalizado não tem prazo", () => {
    expect(prazoSac({ status: "Finalizado", dataContato: "2020-01-01" })).toBeNull();
  });
  it("primeiro ato tira de Em aberto e não mexe nos outros", () => {
    expect(comAndamento({ status: "Em aberto" }).status).toBe("Em andamento");
    expect(comAndamento({ status: "Finalizado" }).status).toBe("Finalizado");
  });
});

describe("máscaras e endereço", () => {
  it("formata CPF, CNPJ e CEP", () => {
    expect(mascaraDoc("12345678901")).toBe("123.456.789-01");
    expect(mascaraDoc("12345678000199")).toBe("12.345.678/0001-99");
    expect(mascaraCep("13010100")).toBe("13010-100");
  });
  it("aponta o que falta no endereço", () => {
    expect(faltasEndereco(endereco)).toEqual([]);
    expect(faltasEndereco({ ...endereco, consumidorCEP: "1301", consumidorBairro: "" })).toEqual(["CEP", "bairro"]);
  });
});

describe("lote", () => {
  it("normaliza grafias do mesmo lote", () => {
    expect(normLote(" l-2025/001 ")).toBe(normLote("L2025001"));
  });
  it("conta e lista atendimentos do mesmo lote", () => {
    const at = [{ id: "1", lote: "L-01", createdAt: 1 }, { id: "2", lote: "l01", createdAt: 3 }, { id: "3", lote: "L-02" }, { id: "4", lote: "" }];
    expect(contagemPorLote(at).get("L01")).toBe(2);
    expect(mesmoLote(at[0], at).map(x => x.id)).toEqual(["2"]);
    expect(mesmoLote(at[3], at)).toEqual([]);
  });
});

describe("errosDoRegistro — os campos * da ficha", () => {
  const ok = { classificacao: "Dúvida", consumidorNome: "Maria", consumidorTelefone: "(11) 99999-0000", consumidorCidade: "Campinas", consumidorUF: "SP", produto: "Ômega 3", relato: "Como tomar?" };
  it("aceita o registro mínimo, sem endereço", () => {
    expect(errosDoRegistro(ok)).toEqual({});
  });
  it("exige tipo, telefone, cidade e UF", () => {
    expect(Object.keys(errosDoRegistro({ ...ok, classificacao: "", consumidorTelefone: "123", consumidorCidade: "", consumidorUF: "" })))
      .toEqual(["classificacao", "consumidorTelefone", "consumidorCidade", "consumidorUF"]);
  });
  it("CEP é opcional, mas se vier tem 8 dígitos", () => {
    expect(errosDoRegistro({ ...ok, consumidorCEP: "1301" })).toHaveProperty("consumidorCEP");
  });
  it("reação, encaminhamento e finalizar no contato pedem o complemento", () => {
    expect(errosDoRegistro({ ...ok, teveReacao: "Sim" })).toHaveProperty("reacaoDesc");
    expect(errosDoRegistro({ ...ok, encaminhar: "Sim" })).toHaveProperty("setor");
    expect(Object.keys(errosDoRegistro({ ...ok, finalizarAgora: true }))).toEqual(["orientacao", "solucao"]);
  });
});

describe("encaminhamento e quem finaliza", () => {
  const enc = novoEncaminhamento({ setor: SETOR_QUALIDADE, data: "2026-10-01", motivo: " x " }, ana, new Date("2026-10-01T10:00:00Z"));
  it("encaminhamento nasce sem retorno e recebe o retorno uma vez", () => {
    expect(enc).toMatchObject({ setor: SETOR_QUALIDADE, motivo: "x", por: "Ana", retorno: null });
    expect(comRetorno(enc, { texto: "ok", data: "2026-10-02" }, ana).retorno).toMatchObject({ texto: "ok", data: "2026-10-02", por: "Ana" });
  });
  it("ir para a Qualidade passa a exigir avaliação técnica", () => {
    expect(exigeAvaliacao({ classificacao: "Reclamação" })).toBe(false);
    expect(exigeAvaliacao({ classificacao: "Reclamação", encaminhamentos: [enc] })).toBe(true);
    expect(exigeAvaliacao({ classificacao: "Reação adversa" })).toBe(true);
  });
  it("recepção só finaliza dúvida, sugestão ou elogio sem reação e sem Qualidade", () => {
    expect(podeFinalizarNaRecepcao({ classificacao: "Dúvida" })).toBe(true);
    expect(podeFinalizarNaRecepcao({ classificacao: "Dúvida", teveReacao: "Sim" })).toBe(false);
    expect(podeFinalizarNaRecepcao({ classificacao: "Dúvida", encaminhamentos: [enc] })).toBe(false);
    expect(podeFinalizarNaRecepcao({ classificacao: "Reclamação" })).toBe(false);
  });
});

describe("encerramento", () => {
  const resp = [{ id: "r1" }];
  it("exige tipo, resposta e solução", () => {
    expect(errosDoEncerramento({}, {})).toHaveLength(3);
    expect(errosDoEncerramento({ classificacao: "Dúvida", respostas: resp }, { solucao: "Orientação prestada" })).toEqual([]);
  });
  it("\"Outra\" pede descrição; troca e reenvio pedem endereço completo", () => {
    const a = { classificacao: "Troca / Devolução", respostas: resp };
    expect(errosDoEncerramento(a, { solucao: "Outra" })).toHaveLength(1);
    expect(errosDoEncerramento(a, { solucao: "Troca do produto" })[0]).toContain("CEP");
    expect(errosDoEncerramento({ ...a, ...endereco }, { solucao: "Troca do produto" })).toEqual([]);
    expect(errosDoEncerramento(a, { solucao: "Reembolso" })).toEqual([]);
  });
  it("reação adversa exige avaliação e decisão sobre notificação", () => {
    const a = { classificacao: "Reação adversa", respostas: resp };
    expect(errosDoEncerramento(a, { solucao: "Orientação prestada" })).toHaveLength(2);
    expect(errosDoEncerramento({ ...a, avaliacao: { resultado: "Improcedente" }, notificacaoVigilancia: { decisao: "Não notificado" } }, { solucao: "Orientação prestada" })).toEqual([]);
  });
  it("avisa — sem travar — RNC aberta, amostra a caminho, setor sem retorno e procedente sem RNC", () => {
    expect(avisosDoEncerramento({ rncId: "x" }, { num: "NC-1", status: "Em andamento" })).toHaveLength(1);
    expect(avisosDoEncerramento({ amostra: { solicitada: { em: "2026-09-10T10:00:00Z" } } }, null)[0]).toContain("2026-09-10");
    expect(avisosDoEncerramento({ encaminhamentos: [{ setor: "Financeiro", data: "2026-10-01", retorno: null }] }, null)[0]).toContain("Financeiro");
    expect(avisosDoEncerramento({ avaliacao: { resultado: "Procedente" } }, null)).toHaveLength(1);
    expect(avisosDoEncerramento({ avaliacao: { resultado: "Improcedente" }, encaminhamentos: [{ setor: SETOR_QUALIDADE, retorno: null }] }, null)).toEqual([]);
    expect(avisosDoEncerramento({}, null)).toEqual([]);
  });
});

describe("amostra e avaliação", () => {
  it("acompanha a amostra: não pedida → aguardando → recebida", () => {
    expect(etapaAmostra({})).toBe("nao_solicitada");
    expect(etapaAmostra({ amostra: { solicitada: {} } })).toBe("aguardando");
    expect(etapaAmostra({ amostra: { recebida: {} } })).toBe("recebida");
  });
  it("avaliação exige resultado válido e parecer, e carimba autor", () => {
    expect(errosDaAvaliacao({})).toHaveLength(2);
    expect(errosDaAvaliacao({ resultado: "Talvez", parecer: "x" })).toHaveLength(1);
    expect(novaAvaliacao({ resultado: "Procedente", parecer: " ok " }, ana)).toMatchObject({ parecer: "ok", por: "Ana", amostraConsumidor: "Não" });
  });
});

describe("descParaRNC e novaResposta", () => {
  it("leva o relato e a reação para a RNC", () => {
    const t = descParaRNC({ num: "SAC-2026-0001", relato: "Gosto estranho", teveReacao: "Sim", reacaoDesc: "Náusea" });
    expect(t).toContain("SAC-2026-0001");
    expect(t).toContain("Náusea");
  });
  it("carimba autor e momento da resposta", () => {
    const r = novaResposta({ texto: "  Troca enviada  ", meio: "E-mail" }, ana, new Date("2026-10-01T10:00:00Z"));
    expect(r).toMatchObject({ texto: "Troca enviada", meio: "E-mail", por: "Ana", em: "2026-10-01T10:00:00.000Z" });
  });
});

describe("indicadores", () => {
  const lista = [
    { num: "S1", dataContato: "2026-09-01", classificacao: "Reclamação", lote: "L1", canal: "Telefone", respostas: [{ data: "2026-09-03" }], status: "Finalizado", encerradoEm: "2026-09-10", solucao: "Troca do produto", avaliacao: { resultado: "Procedente" }, rncId: "r", encaminhamentos: [{ setor: SETOR_QUALIDADE }, { setor: SETOR_QUALIDADE }] },
    { num: "S2", dataContato: "2026-09-05", classificacao: "Reclamação", lote: "l-1", canal: "E-mail", respostas: [{ data: "2026-09-20" }], avaliacao: { resultado: "Improcedente" }, encaminhamentos: [{ setor: "Logística / Entregas" }] },
    { num: "S3", dataContato: "2026-10-01", classificacao: "Reação adversa", teveReacao: "Sim", canal: "Telefone" },
    { num: "S4", dataContato: "2026-10-02", classificacao: "Dúvida" },
  ];
  it("calcula taxas só sobre quem tem o dado", () => {
    expect(kpisSac(lista)).toMatchObject({ total: 4, reclamacoes: 2, reacoesAdversas: 1, reacoes: 1, avaliadas: 2, procedentes: 1, taxaProcedencia: 50, respondidos: 2, taxaNoPrazo: 50, medianaEncerramento: 9, comRnc: 1 });
    expect(kpisSac([]).taxaProcedencia).toBeNull();
  });
  it("primeira resposta e mediana", () => {
    expect(diasPrimeiraResposta(lista[0])).toBe(2);
    expect(diasPrimeiraResposta(lista[2])).toBeNull();
    expect(mediana([5, 1, 3])).toBe(3);
    expect(mediana([1, 2])).toBe(1.5);
  });
  it("conta por canal, solução e setor (setor uma vez por atendimento)", () => {
    expect(contarPor(lista, a => a.canal)[0]).toEqual({ nome: "Telefone", qtd: 2 });
    expect(contarPor(lista, a => a.solucao).find(x => x.nome === "Troca do produto").qtd).toBe(1);
    expect(contarSetores(lista)).toEqual([{ nome: SETOR_QUALIDADE, qtd: 1 }, { nome: "Logística / Entregas", qtd: 1 }]);
  });
  it("agrupa lotes recorrentes e monta a série mensal", () => {
    expect(lotesRecorrentes(lista)).toEqual([expect.objectContaining({ lote: "L1", qtd: 2, procedentes: 1, nums: ["S1", "S2"] })]);
    const r = porMesClassificacao(lista, ["2026-09", "2026-10"]);
    expect(r[0]).toMatchObject({ mes: "2026-09", total: 2, "Reclamação": 2 });
    expect(r[1]).toMatchObject({ total: 2, "Reação adversa": 1, "Dúvida": 1 });
  });
});

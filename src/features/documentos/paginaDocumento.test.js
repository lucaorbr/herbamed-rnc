import { abaInicial, itensDaFaixa, pendenciasPorAba } from "./paginaDocumento";

describe("página do documento — abas", () => {
  test("rascunho sem PDF ou sem controle de registro marca a aba Documento", () => {
    expect(pendenciasPorAba({ doc: { status: "Rascunho" } }).documento).toBe(true);
    expect(pendenciasPorAba({ doc: { status: "Rascunho", arquivo: {} }, faltaRegistro: true }).documento).toBe(true);
    expect(pendenciasPorAba({ doc: { status: "Rascunho", arquivo: {} } }).documento).toBe(false);
    expect(pendenciasPorAba({ doc: { status: "Vigente" } }).documento).toBe(false);
  });

  test("assinatura que espera por mim abre em Assinaturas", () => {
    const p = pendenciasPorAba({ doc: { status: "Aguardando Aprovação" }, minhaAssinatura: true });
    expect(p.assinaturas).toBe(true);
    expect(abaInicial(p)).toBe("assinaturas");
  });

  test("distribuição só pesa para quem pode distribuir", () => {
    const doc = { status: "Vigente", recolhaPendente: [{ setor: "X" }] };
    expect(pendenciasPorAba({ doc, podeDistribuir: false }).distribuicao).toBe(false);
    expect(abaInicial(pendenciasPorAba({ doc, podeDistribuir: true }))).toBe("distribuicao");
    expect(abaInicial(pendenciasPorAba({ doc: { status: "Vigente" }, podeDistribuir: true, semDistribuicao: true }))).toBe("distribuicao");
  });

  test("sem pendência abre em Documento", () => {
    expect(abaInicial(pendenciasPorAba({ doc: { status: "Vigente", arquivo: {} } }))).toBe("documento");
  });
});

describe("faixa de próxima ação", () => {
  const ids = (c) => itensDaFaixa(c).map(i => i.id);

  test("documento sem nada pendente não mostra faixa", () => {
    expect(itensDaFaixa({ status: "Vigente" })).toEqual([]);
  });

  test("assinar vem antes de ler e de distribuir", () => {
    expect(ids({ status: "Aguardando Aprovação", podeAssAprov: true, leituraPendente: true, podeDistribuir: true, semDistribuicao: true }))
      .toEqual(["assinar_aprovador", "ler", "distribuir"]);
  });

  test("recusa em aberto vem antes da reassinatura do elaborador", () => {
    expect(ids({ status: "Rascunho", apontamentosAbertos: 2, podeAssElab: true })).toEqual(["corrigir_recusa", "assinar_elaborador"]);
  });

  test("recusas anteriores são informação na rodada seguinte, depois das ações", () => {
    const itens = itensDaFaixa({ status: "Em Revisão", podeAssRev: true, recusasAnteriores: 1 });
    expect(itens.map(i => [i.id, i.tipo])).toEqual([["assinar_revisor", "acao"], ["recusas_anteriores", "info"]]);
  });

  test("revisão periódica: até 30 dias é ação (se pode revisar); até 90 é aviso", () => {
    expect(ids({ status: "Vigente", diasRev: 10, podeIniciarRevisao: true })).toEqual(["revisao_periodica"]);
    expect(ids({ status: "Vigente", diasRev: 10, podeIniciarRevisao: false })).toEqual(["revisao_proxima"]);
    expect(ids({ status: "Vigente", diasRev: 60 })).toEqual(["revisao_proxima"]);
    expect(itensDaFaixa({ status: "Vigente", diasRev: -3, podeIniciarRevisao: true })[0].tom).toBe("vermelho");
  });

  test("informações sozinhas também aparecem", () => {
    expect(ids({ status: "Aguardando Vigência", vigenciaAgendada: true })).toEqual(["vigencia_agendada"]);
    expect(ids({ status: "Vigente", revisaoRegistrada: true, diasRev: 200 })).toEqual(["revisao_registrada"]);
  });

  test("distribuição e recolha só para quem pode distribuir", () => {
    expect(ids({ status: "Vigente", semDistribuicao: true, recolhas: 2 })).toEqual([]);
    expect(ids({ status: "Vigente", podeDistribuir: true, semDistribuicao: true, recolhas: 2 })).toEqual(["distribuir", "recolher"]);
  });
});

test("revisão nova (Em Revisão, sem assinaturas) também pede a assinatura do Elaborador", () => {
  expect(itensDaFaixa({ status: "Em Revisão", podeAssElab: true }).map(i => i.id)).toEqual(["assinar_elaborador"]);
  expect(itensDaFaixa({ status: "Vigente", podeAssElab: true })).toEqual([]);
});

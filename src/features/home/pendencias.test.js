import {
  montarPendencias, ordenarPendencias, resumoPendencias, URGENCIA,
  pendenciasDeRNC, pendenciasDeDesvio, pendenciasDeLaudo, pendenciasDeIPC,
  pendenciasDeTreinamento, pendenciasDeDocumento,
} from "./pendencias";

const HOJE = "2026-08-17";

describe("pendenciasDeRNC", () => {
  const rncs = [
    { id: 1, num: "NC-2026-T09", status: "Aberta",  prazoAC: "2026-07-15", resp: "Lucas", desc: "Antessala" },
    { id: 2, num: "NC-2026-T08", status: "Aberta",  prazoAC: "2026-09-30", resp: "Lucas", data: "2026-08-01" },
    { id: 3, num: "NC-2026-T07", status: "Eficaz",  prazoAC: "2026-01-01", resp: "Lucas" },
    { id: 4, num: "NC-2026-T06", status: "Aberta",  prazoAC: "2026-08-01", resp: "Outra" },
  ];

  it("traz a RNC com prazo vencido como crítica, com os dias de atraso", () => {
    const p = pendenciasDeRNC({ rncs, userName: "Lucas", hoje: HOJE });
    const venc = p.find(x => x.id === "rnc-venc-1");
    expect(venc).toMatchObject({ urgencia: URGENCIA.CRITICO, minha: true, dias: 33 });
    expect(venc.titulo).toContain("NC-2026-T09");
  });

  it("RNC já encerrada não vira pendência, mesmo com prazo antigo", () => {
    const p = pendenciasDeRNC({ rncs, userName: "Lucas", hoje: HOJE });
    expect(p.some(x => x.id.includes("-3"))).toBe(false);
  });

  it("RNC vencida de outra pessoa aparece, mas não como minha", () => {
    const p = pendenciasDeRNC({ rncs, userName: "Lucas", hoje: HOJE });
    expect(p.find(x => x.id === "rnc-venc-4")).toMatchObject({ minha: false, urgencia: URGENCIA.CRITICO });
  });

  it("RNC minha e no prazo entra como atenção, não como crítica", () => {
    const p = pendenciasDeRNC({ rncs, userName: "Lucas", hoje: HOJE });
    expect(p.find(x => x.id === "rnc-minha-2")).toMatchObject({ minha: true, urgencia: URGENCIA.ATENCAO });
  });

  it("sem usuário informado, nada é marcado como meu", () => {
    const p = pendenciasDeRNC({ rncs, userName: "", hoje: HOJE });
    expect(p.every(x => x.minha === false)).toBe(true);
  });
});

describe("pendenciasDeDesvio", () => {
  const desvios = [
    { id: 1, num: "DEV-01", status: "Registrado", dataRegistro: "2026-08-01", desc: "Parado há tempo" },
    { id: 2, num: "DEV-02", status: "Registrado", dataRegistro: "2026-08-15", desc: "Recente" },
    { id: 3, num: "DEV-03", status: "Encerrado",  dataRegistro: "2026-01-01" },
  ];

  it("desvio parado além da meta de triagem vira crítico", () => {
    const p = pendenciasDeDesvio({ desvios, hoje: HOJE });
    expect(p.find(x => x.id === "desvio-1")).toMatchObject({ urgencia: URGENCIA.CRITICO, dias: 16 });
  });

  it("dentro da meta é só atenção", () => {
    const p = pendenciasDeDesvio({ desvios, hoje: HOJE });
    expect(p.find(x => x.id === "desvio-2")).toMatchObject({ urgencia: URGENCIA.ATENCAO, dias: 2 });
  });

  it("desvio já triado não aparece", () => {
    expect(pendenciasDeDesvio({ desvios, hoje: HOJE }).some(x => x.id === "desvio-3")).toBe(false);
  });

  it("respeita meta diferente da padrão", () => {
    const p = pendenciasDeDesvio({ desvios, hoje: HOJE, meta: 30 });
    expect(p.every(x => x.urgencia === URGENCIA.ATENCAO)).toBe(true);
  });

  // Regressão: a primeira versão lia `d.data`, campo que o desvio NÃO tem — todo
  // desvio saía com dias 0 e nunca virava crítico, e os testes não pegavam porque
  // as fixtures inventavam o campo. Este teste usa o desvio como ele é gravado de
  // verdade (só `dataRegistro`/`dataOcorrencia`) e falha se alguém voltar ao `data`.
  it("lê a data do desvio real, sem campo `data`", () => {
    const real = [{ id: 9, num: "DEV-09", status: "Registrado", dataOcorrencia: "2026-07-20", dataRegistro: "2026-08-01" }];
    expect(pendenciasDeDesvio({ desvios: real, hoje: HOJE })[0]).toMatchObject({ dias: 16, urgencia: URGENCIA.CRITICO });
  });

  it("quem não pode ver desvios não recebe a pendência", () => {
    expect(pendenciasDeDesvio({ desvios, hoje: HOJE, podeVerDesvios: false })).toEqual([]);
  });

  it("cai para dataOcorrencia quando não há dataRegistro", () => {
    const semRegistro = [{ id: 10, num: "DEV-10", status: "Registrado", dataOcorrencia: "2026-08-01" }];
    expect(pendenciasDeDesvio({ desvios: semRegistro, hoje: HOJE })[0].dias).toBe(16);
  });
});

describe("pendenciasDeLaudo", () => {
  // O RT só assina DEPOIS do analista, então `assinaturaAnalista` faz parte da
  // condição — sem ela o laudo não está esperando por ele.
  const laudos = [
    { id: 1, num: "L-01", status: "Emitido", assinaturaAnalista: { nome: "Analista" }, assinaturaRT: null },
    { id: 2, num: "L-02", status: "Emitido", assinaturaAnalista: { nome: "Analista" }, assinaturaRT: { nome: "RT" } },
    { id: 3, num: "L-03", status: "Rascunho", assinaturaAnalista: null, assinaturaRT: null },
  ];

  it("agrupa numa linha só e conta os que esperam assinatura", () => {
    const p = pendenciasDeLaudo({ laudos, podeAssinar: true });
    expect(p).toHaveLength(1);
    expect(p[0].titulo).toContain("1 laudo");
    expect(p[0].minha).toBe(true);
  });

  it("rascunho não conta — ainda não foi emitido", () => {
    expect(pendenciasDeLaudo({ laudos, podeAssinar: true })[0].detalhe).toBe("L-01");
  });

  it("laudo sem assinatura do analista não conta — o RT ainda não pode assinar", () => {
    const soAnalistaPendente = [{ id: 4, num: "L-04", status: "Emitido", assinaturaAnalista: null, assinaturaRT: null }];
    expect(pendenciasDeLaudo({ laudos: soAnalistaPendente, podeAssinar: true })).toEqual([]);
  });

  it("quem não assina laudo não vê a pendência", () => {
    expect(pendenciasDeLaudo({ laudos, podeAssinar: false })).toEqual([]);
  });

  it("nada esperando, nada na lista", () => {
    expect(pendenciasDeLaudo({ laudos: [laudos[1]], podeAssinar: true })).toEqual([]);
  });
});

describe("pendenciasDeIPC", () => {
  it("agrupa as liberações pendentes numa linha", () => {
    const p = pendenciasDeIPC({ ipc: [{ status: "Pendente" }, { status: "Pendente" }, { status: "Liberado" }] });
    expect(p[0].titulo).toContain("2 liberação");
  });

  it("sem pendência, sem linha", () => {
    expect(pendenciasDeIPC({ ipc: [{ status: "Liberado" }] })).toEqual([]);
  });
});

describe("pendenciasDeTreinamento", () => {
  const pendentesTreino = [
    { doc: { id: "d1", codigo: "POP-001", titulo: "Higienização" }, status: "atrasado", dias: 40 },
    { doc: { id: "d2", codigo: "POP-002", titulo: "Encapsuladora" }, status: "vencido", dias: 12 },
    { doc: { id: "d3", codigo: "POP-003", titulo: "Envase" }, status: "pendente", dias: 3 },
  ];

  it("atrasado e reciclagem vencida são críticos; pendente é atenção", () => {
    const p = pendenciasDeTreinamento({ pendentesTreino });
    expect(p.map(x => x.urgencia)).toEqual([URGENCIA.CRITICO, URGENCIA.CRITICO, URGENCIA.ATENCAO]);
  });

  it("distingue reciclagem vencida de nunca treinado — são ações diferentes", () => {
    const p = pendenciasDeTreinamento({ pendentesTreino });
    expect(p[0].titulo).toContain("treinamento pendente");
    expect(p[1].titulo).toContain("reciclagem vencida");
  });

  it("treinamento é sempre pendência da própria pessoa", () => {
    expect(pendenciasDeTreinamento({ pendentesTreino }).every(x => x.minha)).toBe(true);
  });
});

describe("pendenciasDeDocumento", () => {
  it("só notificação não lida vira pendência", () => {
    const p = pendenciasDeDocumento({
      docNotifs: [
        { id: 1, titulo: "Assinar POP-001", mensagem: "Você é o revisor", lida: false, criada_em: "2026-08-10" },
        { id: 2, titulo: "Já vista", lida: true },
      ],
      hoje: HOJE,
    });
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ minha: true, dias: 7, tab: "gestao-docs" });
  });
});

describe("ordenarPendencias", () => {
  it("o que é meu vem primeiro — a tela responde 'precisa de MIM'", () => {
    const lista = [
      { id: "a", minha: false, urgencia: URGENCIA.CRITICO, dias: 100 },
      { id: "b", minha: true,  urgencia: URGENCIA.ATENCAO, dias: 1 },
    ];
    expect(ordenarPendencias(lista).map(x => x.id)).toEqual(["b", "a"]);
  });

  it("dentro do que é meu, crítico antes de atenção", () => {
    const lista = [
      { id: "a", minha: true, urgencia: URGENCIA.ATENCAO, dias: 50 },
      { id: "b", minha: true, urgencia: URGENCIA.CRITICO, dias: 1 },
    ];
    expect(ordenarPendencias(lista).map(x => x.id)).toEqual(["b", "a"]);
  });

  it("mesma urgência: quem espera há mais tempo vem antes", () => {
    const lista = [
      { id: "a", minha: true, urgencia: URGENCIA.CRITICO, dias: 5 },
      { id: "b", minha: true, urgencia: URGENCIA.CRITICO, dias: 30 },
    ];
    expect(ordenarPendencias(lista).map(x => x.id)).toEqual(["b", "a"]);
  });

  it("empate total resolve pelo id — a lista não dança entre renders", () => {
    const lista = [
      { id: "z", minha: true, urgencia: URGENCIA.CRITICO, dias: 5 },
      { id: "a", minha: true, urgencia: URGENCIA.CRITICO, dias: 5 },
    ];
    expect(ordenarPendencias(lista).map(x => x.id)).toEqual(["a", "z"]);
  });

  it("não muta a lista recebida", () => {
    const lista = [{ id: "a", minha: false }, { id: "b", minha: true }];
    ordenarPendencias(lista);
    expect(lista.map(x => x.id)).toEqual(["a", "b"]);
  });
});

describe("montarPendencias", () => {
  const ctx = {
    hoje: HOJE, userName: "Lucas", podeAssinar: true,
    rncs: [{ id: 1, num: "NC-01", status: "Aberta", prazoAC: "2026-06-01", resp: "Outra" }],
    desvios: [{ id: 1, num: "DEV-01", status: "Registrado", dataRegistro: "2026-08-16" }],
    laudos: [{ id: 1, num: "L-01", status: "Emitido", assinaturaAnalista: { nome: "Analista" }, assinaturaRT: null }],
    ipc: [{ status: "Pendente" }],
    pendentesTreino: [{ doc: { id: "d1", codigo: "POP-001" }, status: "atrasado", dias: 40 }],
    docNotifs: [{ id: 9, titulo: "Assinar POP-002", lida: false, criada_em: "2026-08-15" }],
  };

  it("junta todas as fontes numa lista só", () => {
    const p = montarPendencias(ctx);
    expect(p.map(x => x.fonte).sort()).toEqual(
      ["desvio", "documento", "ipc", "laudo", "rnc", "treinamento"]
    );
  });

  it("o topo da lista é meu e crítico", () => {
    const p = montarPendencias(ctx);
    expect(p[0]).toMatchObject({ minha: true, urgencia: URGENCIA.CRITICO, fonte: "treinamento" });
  });

  it("cada pendência sabe para onde levar", () => {
    expect(montarPendencias(ctx).every(x => typeof x.tab === "string" && x.tab)).toBe(true);
  });

  it("contexto vazio devolve lista vazia, sem quebrar", () => {
    expect(montarPendencias({ hoje: HOJE })).toEqual([]);
    expect(montarPendencias()).toEqual([]);
  });

  it("resume o que a tela mostra no cabeçalho", () => {
    expect(resumoPendencias(montarPendencias(ctx))).toEqual({ total: 6, criticas: 2, minhas: 3 });
  });
});

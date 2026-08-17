import {
  proxNumSessao, novaSessao, presentesDaSessao, podeEncerrar,
  evidenciasDaSessao, sessoesDoDocumento, STATUS_SESSAO,
  SITUACAO, situacaoParticipante, definirSituacao, contagemSituacoes,
  motivoEmDia, comAnexos, semAnexo, pendenteDigitalizacao,
} from "./sessoes";
import { indexarEvidencias, chaveEvidencia, statusCelula } from "./treinamento";

const doc = (over = {}) => ({
  id: "d1", codigo: "PRO-001", titulo: "Higienização", versao: "02", status: "Vigente",
  treinamento: { exigido: true, modo: "presencial", cargos: ["analista-cq"], pessoasExtra: [], prazoDias: 30, desdeEm: "2026-01-01" },
  ...over,
});

const exigidos = [
  { userId: "u1", userName: "Ana",  cargoNome: "Analista de CQ", setor: "Qualidade" },
  { userId: "u2", userName: "Beto", cargoNome: "Analista de CQ", setor: "Qualidade" },
  { userId: "u3", userName: "Caio", cargoNome: "Analista de CQ", setor: "Qualidade" },
];

const instrutor = { id: "i9", name: "Dra. Elis", cargo: "Coordenadora de Qualidade" };

// Sessão pronta para assinar — os testes de trava mexem em cima desta base.
const sessaoValida = (over = {}) => {
  const s = novaSessao({ doc: doc(), instrutor, exigidos, num: "TRN-2026-01", hoje: "2026-08-06" });
  return {
    ...s, cargaHoraria: "2",
    participantes: s.participantes.map(p => (p.userId === "u1" ? definirSituacao(p, SITUACAO.PRESENTE) : p)),
    ...over,
  };
};

describe("proxNumSessao", () => {
  it("começa em 01 quando não há sessão no ano", () => {
    expect(proxNumSessao([], 2026)).toBe("TRN-2026-01");
  });

  it("continua a partir do maior número do ano", () => {
    const s = [{ num: "TRN-2026-01" }, { num: "TRN-2026-03" }, { num: "TRN-2026-02" }];
    expect(proxNumSessao(s, 2026)).toBe("TRN-2026-04");
  });

  it("numera por ano — vira o ano e recomeça", () => {
    const s = [{ num: "TRN-2025-07" }, { num: "TRN-2025-08" }];
    expect(proxNumSessao(s, 2026)).toBe("TRN-2026-01");
    expect(proxNumSessao(s, 2025)).toBe("TRN-2025-09");
  });

  it("ignora numeração malformada em vez de quebrar", () => {
    const s = [{ num: "TRN-2026-01" }, { num: "TRN-2026-xx" }, { num: null }, {}];
    expect(proxNumSessao(s, 2026)).toBe("TRN-2026-02");
  });
});

describe("novaSessao", () => {
  it("pré-carrega os participantes a partir de quem o documento exige", () => {
    const s = novaSessao({ doc: doc(), instrutor, exigidos, num: "TRN-2026-01", hoje: "2026-08-06" });
    expect(s.participantes.map(p => p.userId)).toEqual(["u1", "u2", "u3"]);
    expect(s.participantes[0]).toMatchObject({ userName: "Ana", cargoNome: "Analista de CQ", setor: "Qualidade" });
  });

  it("ninguém nasce presente — presença se confere na sala", () => {
    const s = novaSessao({ doc: doc(), instrutor, exigidos, hoje: "2026-08-06" });
    expect(s.participantes.every(p => p.presente === false)).toBe(true);
    expect(presentesDaSessao(s)).toEqual([]);
  });

  it("marca quem já treinou como aviso, sem tirar da lista", () => {
    const s = novaSessao({ doc: doc(), instrutor, exigidos, hoje: "2026-08-06", jaTreinados: ["u2"] });
    expect(s.participantes.map(p => p.jaTreinado)).toEqual([false, true, false]);
    expect(s.participantes).toHaveLength(3);
  });

  it("quem já está em dia nasce DISPENSADO, não ausente — não foi convocado, não faltou", () => {
    const s = novaSessao({ doc: doc(), instrutor, exigidos, hoje: "2026-08-06", jaTreinados: ["u2"] });
    expect(s.participantes.map(situacaoParticipante))
      .toEqual([SITUACAO.AUSENTE, SITUACAO.DISPENSADO, SITUACAO.AUSENTE]);
  });

  it("a dispensa automática já vem com motivo e validade — dispensa sem motivo não fecha", () => {
    const s = novaSessao({
      doc: doc(), instrutor, exigidos, hoje: "2026-08-06",
      jaTreinados: ["u2"], validadeTreino: { u2: "2027-01-31" },
    });
    expect(s.participantes[1].motivoDispensa).toBe("Treinamento válido, em dia até 31/01/2027");
  });

  it("sem validade informada, o motivo da dispensa não inventa data", () => {
    const s = novaSessao({ doc: doc(), instrutor, exigidos, hoje: "2026-08-06", jaTreinados: ["u2"] });
    expect(s.participantes[1].motivoDispensa).toBe("Treinamento válido, em dia");
  });

  it("nasce sem anexo — a folha física é digitalizada depois da sala", () => {
    const s = novaSessao({ doc: doc(), instrutor, exigidos, hoje: "2026-08-06" });
    expect(s.anexos).toEqual([]);
  });

  it("carimba documento e versão — sessão vale para UMA revisão", () => {
    const s = novaSessao({ doc: doc({ versao: "05" }), instrutor, exigidos, hoje: "2026-08-06" });
    expect(s).toMatchObject({ docId: "d1", docCodigo: "PRO-001", versao: "05" });
  });

  it("pré-preenche o conteúdo com o próprio documento", () => {
    const s = novaSessao({ doc: doc(), instrutor, exigidos, hoje: "2026-08-06" });
    expect(s.conteudo).toBe("PRO-001 — Higienização");
  });

  it("nasce Planejada e sem assinatura", () => {
    const s = novaSessao({ doc: doc(), instrutor, exigidos, hoje: "2026-08-06" });
    expect(s.status).toBe(STATUS_SESSAO.PLANEJADA);
    expect(s.assinaturaInstrutor).toBeNull();
  });

  it("grava o instrutor com cargo — a lista precisa dizer quem ministrou", () => {
    const s = novaSessao({ doc: doc(), instrutor, exigidos, hoje: "2026-08-06" });
    expect(s.instrutor).toEqual({ userId: "i9", nome: "Dra. Elis", cargo: "Coordenadora de Qualidade" });
  });

  it("não muta a lista de exigidos recebida", () => {
    const orig = JSON.parse(JSON.stringify(exigidos));
    const s = novaSessao({ doc: doc(), instrutor, exigidos, hoje: "2026-08-06" });
    s.participantes[0].presente = true;
    expect(exigidos).toEqual(orig);
  });
});

describe("situacaoParticipante / definirSituacao", () => {
  it("lê a situação de três estados quando ela existe", () => {
    expect(situacaoParticipante({ situacao: SITUACAO.DISPENSADO })).toBe(SITUACAO.DISPENSADO);
    expect(situacaoParticipante({ situacao: SITUACAO.PRESENTE })).toBe(SITUACAO.PRESENTE);
  });

  it("cai no booleano antigo para sessão gravada antes dos três estados", () => {
    // Registro já assinado não se reescreve — a leitura é que se adapta.
    expect(situacaoParticipante({ presente: true })).toBe(SITUACAO.PRESENTE);
    expect(situacaoParticipante({ presente: false })).toBe(SITUACAO.AUSENTE);
    expect(situacaoParticipante({})).toBe(SITUACAO.AUSENTE);
  });

  it("ignora valor de situação desconhecido em vez de confiar nele", () => {
    expect(situacaoParticipante({ situacao: "sei-la", presente: true })).toBe(SITUACAO.PRESENTE);
  });

  it("mantém `presente` como espelho de situacao — é o que gera evidência", () => {
    const p = { userId: "u1" };
    expect(definirSituacao(p, SITUACAO.PRESENTE).presente).toBe(true);
    expect(definirSituacao(p, SITUACAO.AUSENTE).presente).toBe(false);
    expect(definirSituacao(p, SITUACAO.DISPENSADO).presente).toBe(false);
  });

  it("guarda o motivo só enquanto dispensado — sair da dispensa limpa o motivo", () => {
    const disp = definirSituacao({ userId: "u1" }, SITUACAO.DISPENSADO, "Férias / afastamento");
    expect(disp.motivoDispensa).toBe("Férias / afastamento");
    expect(definirSituacao(disp, SITUACAO.PRESENTE).motivoDispensa).toBe("");
  });

  it("não muta o participante recebido", () => {
    const p = { userId: "u1", presente: false };
    definirSituacao(p, SITUACAO.PRESENTE);
    expect(p.presente).toBe(false);
  });

  it("conta os três estados, tolerando o registro antigo", () => {
    const sessao = { participantes: [
      { situacao: SITUACAO.PRESENTE }, { presente: true },
      { situacao: SITUACAO.AUSENTE }, { situacao: SITUACAO.DISPENSADO },
    ] };
    expect(contagemSituacoes(sessao)).toEqual({ presente: 2, ausente: 1, dispensado: 1, total: 4 });
  });

  it("dispensado não é presente — não gera evidência de treinamento", () => {
    const s = sessaoValida();
    const comDispensa = {
      ...s,
      participantes: s.participantes.map(p => (p.userId === "u2"
        ? definirSituacao(p, SITUACAO.DISPENSADO, "Treinamento válido, em dia") : p)),
    };
    expect(presentesDaSessao(comDispensa).map(p => p.userId)).toEqual(["u1"]);
    expect(evidenciasDaSessao({ sessao: comDispensa, doc: doc() }).map(e => e.userId)).toEqual(["u1"]);
  });

  it("motivoEmDia carrega a validade quando ela existe", () => {
    expect(motivoEmDia("2027-01-31")).toBe("Treinamento válido, em dia até 31/01/2027");
    expect(motivoEmDia(null)).toBe("Treinamento válido, em dia");
  });
});

describe("anexo da lista digitalizada", () => {
  it("carimba quem anexou e quando, e registra no histórico", () => {
    const s = comAnexos(sessaoValida(), [{ name: "lista.pdf", url: "/f/1" }], "Dra. Elis");
    expect(s.anexos).toHaveLength(1);
    expect(s.anexos[0]).toMatchObject({ name: "lista.pdf", anexadoPor: "Dra. Elis" });
    expect(s.anexos[0].anexadoEm).toBeTruthy();
    expect(s.historico.at(-1).acao).toContain("lista.pdf");
  });

  it("acrescenta sem apagar o que já estava anexado", () => {
    const um = comAnexos(sessaoValida(), [{ name: "a.pdf", url: "/f/a" }], "Elis");
    const dois = comAnexos(um, [{ name: "b.pdf", url: "/f/b" }], "Elis");
    expect(dois.anexos.map(a => a.name)).toEqual(["a.pdf", "b.pdf"]);
  });

  it("anexar em sessão ENCERRADA é permitido — a folha é digitalizada depois", () => {
    const encerrada = sessaoValida({ status: STATUS_SESSAO.REALIZADA });
    expect(comAnexos(encerrada, [{ name: "lista.pdf", url: "/f/1" }], "Elis").anexos).toHaveLength(1);
  });

  it("remover anexo de sessão encerrada NÃO acontece — em BPF não se apaga registro", () => {
    const encerrada = comAnexos(sessaoValida({ status: STATUS_SESSAO.REALIZADA }), [{ name: "x.pdf", url: "/f/x" }], "Elis");
    expect(semAnexo(encerrada, 0).anexos).toHaveLength(1);
  });

  it("remove anexo enquanto a sessão não foi assinada", () => {
    const rascunho = comAnexos(sessaoValida(), [{ name: "x.pdf", url: "/f/x" }], "Elis");
    expect(semAnexo(rascunho, 0).anexos).toHaveLength(0);
  });

  it("pendência de digitalização só existe depois de encerrada", () => {
    expect(pendenteDigitalizacao(sessaoValida())).toBe(false);
    const encerrada = sessaoValida({ status: STATUS_SESSAO.REALIZADA });
    expect(pendenteDigitalizacao(encerrada)).toBe(true);
    expect(pendenteDigitalizacao(comAnexos(encerrada, [{ name: "x.pdf", url: "/f/x" }], "Elis"))).toBe(false);
  });

  it("não muta a sessão recebida", () => {
    const s = sessaoValida();
    comAnexos(s, [{ name: "x.pdf", url: "/f/x" }], "Elis");
    expect(s.anexos).toEqual([]);
  });
});

describe("podeEncerrar", () => {
  it("aceita a sessão completa com ao menos um presente", () => {
    expect(podeEncerrar(sessaoValida())).toEqual({ ok: true, erro: "" });
  });

  it("barra sem ninguém presente", () => {
    const s = sessaoValida();
    const vazia = { ...s, participantes: s.participantes.map(p => definirSituacao(p, SITUACAO.AUSENTE)) };
    expect(podeEncerrar(vazia).ok).toBe(false);
    expect(podeEncerrar(vazia).erro).toMatch(/presente/i);
  });

  it("barra dispensa sem motivo — não se sabe depois por que a pessoa não treinou", () => {
    const s = sessaoValida();
    const semMotivo = {
      ...s,
      participantes: s.participantes.map(p => (p.userId === "u2"
        ? { ...definirSituacao(p, SITUACAO.DISPENSADO), motivoDispensa: "  " } : p)),
    };
    expect(podeEncerrar(semMotivo).ok).toBe(false);
    expect(podeEncerrar(semMotivo).erro).toMatch(/motivo/i);
    expect(podeEncerrar(semMotivo).erro).toContain("Beto");
  });

  it("aceita dispensa com motivo", () => {
    const s = sessaoValida();
    const comMotivo = {
      ...s,
      participantes: s.participantes.map(p => (p.userId === "u2"
        ? definirSituacao(p, SITUACAO.DISPENSADO, "Férias / afastamento") : p)),
    };
    expect(podeEncerrar(comMotivo).ok).toBe(true);
  });

  it("NÃO exige a lista digitalizada para encerrar — a digitalizadora não está na sala", () => {
    expect(podeEncerrar(sessaoValida({ anexos: [] })).ok).toBe(true);
  });

  it("barra sem carga horária", () => {
    expect(podeEncerrar(sessaoValida({ cargaHoraria: "  " })).ok).toBe(false);
  });

  it("barra sem data", () => {
    expect(podeEncerrar(sessaoValida({ data: "" })).ok).toBe(false);
  });

  it("barra sem conteúdo ministrado", () => {
    expect(podeEncerrar(sessaoValida({ conteudo: "" })).ok).toBe(false);
  });

  it("barra sem instrutor", () => {
    expect(podeEncerrar(sessaoValida({ instrutor: null })).ok).toBe(false);
  });

  it("barra sessão já encerrada — não se assina duas vezes", () => {
    expect(podeEncerrar(sessaoValida({ status: STATUS_SESSAO.REALIZADA })).ok).toBe(false);
  });
});

describe("evidenciasDaSessao", () => {
  it("gera evidência só para os presentes", () => {
    const s = sessaoValida();
    const evs = evidenciasDaSessao({ sessao: s, doc: doc(), registradoPor: "Dra. Elis" });
    expect(evs.map(e => e.userId)).toEqual(["u1"]);
  });

  it("ausente não gera evidência", () => {
    const s = sessaoValida();
    const evs = evidenciasDaSessao({ sessao: s, doc: doc() });
    expect(evs.some(e => e.userId === "u2" || e.userId === "u3")).toBe(false);
  });

  it("carimba a versão do documento — evidência vale para UMA revisão", () => {
    const evs = evidenciasDaSessao({ sessao: sessaoValida(), doc: doc({ versao: "07" }) });
    expect(evs[0].versao).toBe("07");
  });

  it("grava modo presencial e vincula a sessão", () => {
    const evs = evidenciasDaSessao({ sessao: sessaoValida(), doc: doc(), registradoPor: "Dra. Elis" });
    expect(evs[0]).toMatchObject({
      modo: "presencial", sessaoId: expect.any(String), sessaoNum: "TRN-2026-01",
      instrutor: "Dra. Elis", origem: "sessao", registradoPor: "Dra. Elis",
    });
  });

  it("usa a data da sessão como data de realização", () => {
    const evs = evidenciasDaSessao({ sessao: sessaoValida({ data: "2026-03-15" }), doc: doc() });
    expect(evs[0].dataRealizacao).toBe("2026-03-15");
  });

  it("é idempotente: reencerrar não duplica evidência da mesma sessão", () => {
    const s = sessaoValida();
    const primeira = evidenciasDaSessao({ sessao: s, doc: doc(), evidenciasExistentes: [] });
    const segunda = evidenciasDaSessao({ sessao: s, doc: doc(), evidenciasExistentes: primeira });
    expect(primeira).toHaveLength(1);
    expect(segunda).toHaveLength(0);
  });

  it("usa id determinístico — regravar sobrescreve em vez de criar outro registro", () => {
    const s = sessaoValida();
    const a = evidenciasDaSessao({ sessao: s, doc: doc() });
    const b = evidenciasDaSessao({ sessao: s, doc: doc() });
    expect(a[0].id).toBe(b[0].id);
    expect(a[0].id).toBe(`${s.id}-u1`);
  });

  it("NÃO barra quem está com reciclagem vencida — é justamente quem precisa treinar de novo", () => {
    // Evidência antiga, da MESMA versão e da mesma pessoa, mas de outra sessão.
    const antiga = {
      id: "velha", docId: "d1", versao: "02", userId: "u1", modo: "presencial",
      dataRealizacao: "2025-01-10", sessaoId: "sess-antiga", ts: 1,
    };
    const s = sessaoValida();
    const evs = evidenciasDaSessao({ sessao: s, doc: doc(), evidenciasExistentes: [antiga] });
    expect(evs).toHaveLength(1);
    expect(evs[0].userId).toBe("u1");
    expect(evs[0].dataRealizacao).toBe("2026-08-06");
  });

  it("a evidência nova vence a antiga no índice — reciclagem volta a valer", () => {
    const d = doc({ treinamento: { ...doc().treinamento, reciclagemMeses: 12 } });
    const antiga = {
      id: "velha", docId: "d1", versao: "02", userId: "u1",
      modo: "presencial", dataRealizacao: "2025-01-10", sessaoId: "sess-antiga", ts: 1,
    };
    expect(statusCelula({ doc: d, userId: "u1", indice: indexarEvidencias([antiga]), hoje: "2026-08-06" }).status)
      .toBe("vencido");

    const nova = evidenciasDaSessao({ sessao: sessaoValida(), doc: d, evidenciasExistentes: [antiga] })[0];
    const indice = indexarEvidencias([antiga, nova]);
    expect(indice.get(chaveEvidencia("d1", "02", "u1")).id).toBe(nova.id);
    expect(statusCelula({ doc: d, userId: "u1", indice, hoje: "2026-08-06" }).status).toBe("treinado");
  });

  it("evidência de outra sessão não bloqueia esta", () => {
    const outra = { id: "x", userId: "u1", sessaoId: "sess-outra", ts: 1 };
    const evs = evidenciasDaSessao({ sessao: sessaoValida(), doc: doc(), evidenciasExistentes: [outra] });
    expect(evs).toHaveLength(1);
  });

  it("registra instrutor, carga horária e local nas observações", () => {
    const s = sessaoValida({ local: "Sala 2" });
    const evs = evidenciasDaSessao({ sessao: s, doc: doc() });
    expect(evs[0].obs).toContain("TRN-2026-01");
    expect(evs[0].obs).toContain("Dra. Elis");
    expect(evs[0].obs).toContain("Sala 2");
  });

  it("não muta a sessão recebida", () => {
    const s = sessaoValida();
    const antes = JSON.parse(JSON.stringify(s));
    evidenciasDaSessao({ sessao: s, doc: doc() });
    expect(s).toEqual(antes);
  });

  it("o instrutor pode constar como participante da própria sessão", () => {
    // Decisão do projeto: quem ministra pode ser exigido no mesmo documento
    // (supervisor que treina a equipe num POP que ele também segue).
    const comInstrutor = [...exigidos, { userId: "i9", userName: "Dra. Elis", cargoNome: "Coordenadora de Qualidade", setor: "Qualidade" }];
    const s = novaSessao({ doc: doc(), instrutor, exigidos: comInstrutor, num: "TRN-2026-01", hoje: "2026-08-06" });
    const marcada = {
      ...s, cargaHoraria: "2",
      participantes: s.participantes.map(p => (p.userId === "i9" ? definirSituacao(p, SITUACAO.PRESENTE) : p)),
    };
    expect(podeEncerrar(marcada).ok).toBe(true);
    expect(evidenciasDaSessao({ sessao: marcada, doc: doc() }).map(e => e.userId)).toEqual(["i9"]);
  });
});

describe("sessoesDoDocumento", () => {
  const ss = [
    { id: "a", num: "TRN-2026-01", docId: "d1", versao: "01" },
    { id: "b", num: "TRN-2026-02", docId: "d1", versao: "02" },
    { id: "c", num: "TRN-2026-03", docId: "d2", versao: "01" },
  ];

  it("filtra pelo documento", () => {
    expect(sessoesDoDocumento(ss, "d1").map(s => s.id).sort()).toEqual(["a", "b"]);
  });

  it("filtra pela versão quando informada — sessão da revisão anterior não conta", () => {
    expect(sessoesDoDocumento(ss, "d1", "02").map(s => s.id)).toEqual(["b"]);
  });

  it("ordena da mais recente para a mais antiga", () => {
    expect(sessoesDoDocumento(ss, "d1").map(s => s.num)).toEqual(["TRN-2026-02", "TRN-2026-01"]);
  });

  it("devolve lista vazia para documento sem sessão", () => {
    expect(sessoesDoDocumento(ss, "zzz")).toEqual([]);
  });
});

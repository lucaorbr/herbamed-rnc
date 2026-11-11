import {
  tipoRnc, somarDias, PRAZO_RESPOSTA_FORNECEDOR_DIAS, errosAberturaPorTipo, ultimaRespostaEm, complementoAberto, temRespostaValida,
  respostaAtrasada, patchPlanilhaRespondida, patchPedirComplemento, patchAceitarResposta, patchConverterEmInterna,
  travaEncerramentoExterna, patchEncerrarExterna, novaReuniaoInterna, patchReuniaoInterna, evidenciasDaRnc,
} from "./tipoRncLogic";
import { etapasDaRnc, filaAnaliseCausa, filaCapa, filaEficacia, travaEficacia } from "./ferramentasLogic";

const ext = (x = {}) => ({ tipoRnc: "externa", status: "Em andamento", desc: "umidade alta", tipo: "Matéria-prima", fornecedor: "F", nf: "1", lote: "L1", historico: [], ...x });
const resp = (em = "2026-11-05T10:00:00.000Z") => ({ respostaFornecedor: { causaRaiz: "secagem", respondidoEm: em } });

describe("tipo da RNC", () => {
  test("RNC sem o campo é interna (todas as anteriores)", () => {
    expect(tipoRnc({})).toBe("interna");
    expect(tipoRnc({ tipoRnc: "externa" })).toBe("externa");
  });
  test("somarDias soma dias do calendário, virando mês", () => {
    expect(somarDias("2026-11-20", 15)).toBe("2026-12-05");
    expect(somarDias("", 15)).toBe("");
  });
  test("prazo de resposta do fornecedor: 7 dias corridos, inclusive no fim de semana", () => {
    expect(PRAZO_RESPOSTA_FORNECEDOR_DIAS).toBe(7);
    expect(somarDias("2026-11-27", PRAZO_RESPOSTA_FORNECEDOR_DIAS)).toBe("2026-12-04");
  });
  test("abertura: a pergunta é obrigatória e a externa exige fornecedor, NF e lote", () => {
    expect(errosAberturaPorTipo({})).toHaveLength(1);
    expect(errosAberturaPorTipo({ tipoRnc: "interna" })).toEqual([]);
    expect(errosAberturaPorTipo({ tipoRnc: "externa", fornecedor: "F" })).toHaveLength(2);
    expect(errosAberturaPorTipo({ tipoRnc: "externa", fornecedor: "F", nf: "1", lote: "L" })).toEqual([]);
  });
});

describe("resposta do fornecedor", () => {
  test("vale a mais recente entre link e planilha", () => {
    const r = ext({ ...resp("2026-11-05T10:00:00Z"), respostasPlanilha: [{ em: "2026-11-07T10:00:00Z", anexos: [{}] }] });
    expect(ultimaRespostaEm(r)).toBe("2026-11-07T10:00:00Z");
  });
  test("pedido de complemento faz voltar a aguardar até chegar resposta mais nova", () => {
    const r = ext({ ...resp("2026-11-05T10:00:00Z"), complementoFornecedor: { motivo: "falta laudo", pedidoEm: "2026-11-06T10:00:00Z" } });
    expect(complementoAberto(r)).toBe(true);
    expect(temRespostaValida(r)).toBe(false);
    const depois = { ...r, respostaFornecedor: { respondidoEm: "2026-11-08T10:00:00Z" } };
    expect(complementoAberto(depois)).toBe(false);
    expect(temRespostaValida(depois)).toBe(true);
  });
  test("prazo vencido só conta enquanto se espera resposta", () => {
    expect(respostaAtrasada(ext({ prazoRespostaFornecedor: "2026-11-01" }), "2026-11-10")).toBe(true);
    expect(respostaAtrasada(ext({ prazoRespostaFornecedor: "2026-11-01", ...resp() }), "2026-11-10")).toBe(false);
    expect(respostaAtrasada({ prazoRespostaFornecedor: "2026-11-01" }, "2026-11-10")).toBe(false);
  });
  test("planilha respondida acrescenta e registra no histórico", () => {
    const { patch } = patchPlanilhaRespondida(ext({ respostasPlanilha: [{ id: "a" }] }), [{ name: "resp.xlsx" }], "Ana", "2026-11-07T10:00:00Z", "2026-11-07", "10:00");
    expect(patch.respostasPlanilha).toHaveLength(2);
    expect(patch.historico[0].detalhes).toEqual(["resp.xlsx"]);
    expect(patchPlanilhaRespondida(ext(), [], "Ana").erro).toBeTruthy();
  });
  test("pedir complemento exige motivo e derruba a avaliação", () => {
    expect(patchPedirComplemento(ext(), " ", "Ana").erro).toBeTruthy();
    const { patch } = patchPedirComplemento(ext({ avaliacaoFornecedor: { resultado: "aceita" } }), "falta laudo", "Ana", "2026-11-06T10:00:00Z", "d", "h");
    expect(patch.avaliacaoFornecedor).toBeNull();
    expect(patch.status).toBeUndefined(); // já estava Em andamento
    expect(patchPedirComplemento(ext({ status: "Aberta" }), "x", "Ana", "t", "d", "h").patch.status).toBe("Em andamento");
    expect(patch.complementoFornecedor.motivo).toBe("falta laudo");
    expect(patch.complementosFornecedor).toHaveLength(1);
  });
  test("só aceita quando há resposta válida", () => {
    expect(patchAceitarResposta(ext(), "", "Ana").erro).toBeTruthy();
    expect(patchAceitarResposta(ext(resp()), "ok", "Ana", "t", "d", "h").patch.avaliacaoFornecedor.resultado).toBe("aceita");
  });
  test("converter em interna exige motivo", () => {
    expect(patchConverterEmInterna(ext(), "", "Ana").erro).toBeTruthy();
    expect(patchConverterEmInterna(ext(), "armazenagem nossa", "Ana", "d", "h").patch.tipoRnc).toBe("interna");
  });
});

describe("encerramento da externa", () => {
  const pronta = ext({ ...resp(), avaliacaoFornecedor: { resultado: "aceita" }, disposicao: { decisao: "devolver" } });
  const verif = { data: "2026-12-01", resultado: "Conforme", lote: "L2" };
  test("trava: resposta aceita, verificação e disposição", () => {
    expect(travaEncerramentoExterna(ext(), verif).motivos[0]).toMatch(/resposta do fornecedor/);
    expect(travaEncerramentoExterna({ ...pronta, avaliacaoFornecedor: null }, verif).motivos[0]).toMatch(/Aceite/);
    expect(travaEncerramentoExterna(pronta, { resultado: "Conforme" }).ok).toBe(false);
    expect(travaEncerramentoExterna({ ...pronta, disposicao: null }, verif).motivos[0]).toMatch(/disposição/);
    expect(travaEncerramentoExterna(pronta, verif).ok).toBe(true);
  });
  test("Conforme vira Eficaz e preenche a eficácia; Não conforme vira Ineficaz", () => {
    const { patch } = patchEncerrarExterna(pronta, verif, "Ana", "t", "d", "h");
    expect(patch.status).toBe("Eficaz");
    expect(patch.eficacia.resultado).toBe("Eficaz");
    expect(patch.verificacaoRecebimento.lote).toBe("L2");
    expect(patch.historico.at(-1).detalhes).toContain("Data: 01/12/2026");
    expect(patchEncerrarExterna(pronta, { ...verif, resultado: "Não conforme" }, "Ana", "t", "d", "h").patch.status).toBe("Ineficaz");
  });
  test("a RAC (travaEficacia) usa a trava da externa", () => {
    expect(travaEficacia(pronta, "Eficaz").ok).toBe(false);
    expect(travaEficacia({ ...pronta, verificacaoRecebimento: verif }, "Eficaz").ok).toBe(true);
  });
});

describe("etapas e filas por tipo", () => {
  test("externa tem 4 etapas e a avaliação espera a resposta", () => {
    const e = etapasDaRnc(ext({ contencao: "segregado", disposicao: { decisao: "devolver" } }));
    expect(e.map(x => x.id)).toEqual(["registro", "contencao", "resposta", "avaliacao"]);
    expect(e.find(x => x.id === "resposta").estado).toBe("atual");
    expect(e.find(x => x.id === "avaliacao").estado).toBe("bloqueada");
  });
  test("externa não entra nas filas de análise de causa, CAPA e eficácia", () => {
    const whys = ["a", "b", "c"];
    const r = ext({ ishikawa: { whys, root: "x" }, w2h: [{ status: "Concluída" }] });
    expect(filaAnaliseCausa([ext()])).toEqual([]);
    expect(filaCapa([{ ...r, w2h: [] }])).toEqual([]);
    expect(filaEficacia([r])).toEqual([]);
  });
});

describe("reuniões internas e evidências", () => {
  test("reunião exige data, participantes e decisão", () => {
    expect(novaReuniaoInterna({}, "Ana", "t").erros).toHaveLength(3);
    const { reuniao } = novaReuniaoInterna({ data: "2026-11-07", participantes: "Q, P", decidido: "testar cápsula" }, "Ana", "t");
    const p = patchReuniaoInterna({ reunioesInternas: [{ id: "x" }] }, reuniao, "d", "h");
    expect(p.reunioesInternas).toHaveLength(2);
    expect(p.historico[0].acao).toMatch(/2026-11-07/);
  });
  test("evidências juntam os anexos de todas as etapas", () => {
    const r = {
      anexos: [{ name: "foto" }], investigacao: [{ anexos: [{ name: "laudo" }] }],
      reunioesInternas: [{ data: "2026-11-07", anexos: [{ name: "ata" }] }],
      w2h: [{ evidencias: [{ name: "ev" }] }], eficacia: { anexos: [{ name: "ef" }] },
    };
    expect(evidenciasDaRnc(r).map(x => `${x.etapa}:${x.anexo.name}`)).toEqual([
      "Registro:foto", "Investigação:laudo", "Reunião interna:ata", "Ação CAPA #1:ev", "Eficácia:ef",
    ]);
  });
});

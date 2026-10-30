// Apresentação semanal da Qualidade: o que vai em cada slide, calculado direto das RNCs
// e dos desvios. Puro e testável; quem desenha o PowerPoint é gerarPptx.js.
//
// Tudo se refere ao período escolhido na tela (o mesmo filtro de datas do Relatórios):
// entram só as RNCs e os desvios REGISTRADOS dentro dele, e as listas mostram a situação
// de hoje desses registros. Sem período, vale a janela de 7 dias terminando hoje.
import { rncAtiva, rncEncerrada } from "../../core/status";
import { contagemCapa, etapaParaContinuar } from "../rnc/ferramentasLogic";
import { META_TRIAGEM_DIAS, triagemStatus } from "../desvios/triagem";
import { dataIso, diasEntre, periodoAnterior, somarDias } from "../../shared/periodoLogic";

export const LINHAS_POR_SLIDE = 8;
export const DIAS_ACAO_VENCENDO = 7;

const dentro = (iso, per) => !!iso && iso >= per.de && iso <= per.ate;

/** Primeira linha da descrição, cortada. A descrição é append-only: o original vem antes. */
export function assunto(texto, max = 90) {
  const linha = String(texto || "").split("\n").map(s => s.trim()).find(Boolean) || "";
  return linha.length > max ? linha.slice(0, max - 1).trimEnd() + "…" : linha;
}

/**
 * Quando a RNC foi encerrada. Não há campo próprio: Eficaz/Ineficaz gravam a hora em
 * `eficacia.registradoEm`; para os demais (e registro antigo) vale a última entrada do
 * histórico, que é o ato que a encerrou.
 */
export function dataEncerramentoRnc(r) {
  if (!rncEncerrada(r?.status)) return null;
  const hist = r.historico || [];
  return dataIso(r.eficacia?.registradoEm) || dataIso(hist[hist.length - 1]?.data) || null;
}

const dataTriagem = d =>
  d.status === "Encerrado" ? dataIso(d.encerradoEm) : d.status === "Convertido em RNC" ? dataIso(d.convertidoEm) : null;

export const setorDoDesvio = d => (d.setor === "Outros" ? (d.setorOutro || "").trim() || "Outros" : d.setor || "Sem setor");

/** Divide uma lista em páginas de `n` itens. Lista vazia vira uma página vazia. */
export function paginar(lista, n = LINHAS_POR_SLIDE) {
  if (!lista.length) return [[]];
  const pags = [];
  for (let i = 0; i < lista.length; i += n) pags.push(lista.slice(i, i + n));
  return pags;
}

const dataRegistroDesvio = d => dataIso(d.dataRegistro || d.dataOcorrencia);

export function montarApresentacao({ rncs: todasRncs = [], desvios: todosDesvios = [], hoje, periodo }) {
  const per = periodo ? { de: periodo.de, ate: periodo.ate } : { de: somarDias(hoje, -6), ate: hoje };
  const anterior = periodoAnterior(periodo || per);
  const rncs = todasRncs.filter(r => dentro(dataIso(r.data), per));
  const desvios = todosDesvios.filter(d => dentro(dataRegistroDesvio(d), per));
  const ativas = rncs.filter(r => rncAtiva(r.status));
  const vencida = r => !!r.prazoAC && r.prazoAC < hoje;

  // Abertas/registrados contam pela data de registro; encerradas/triados pela data em que
  // o fato aconteceu, valendo também para registro mais antigo fechado dentro do período.
  const contaRnc = p => ({
    abertas: todasRncs.filter(r => dentro(dataIso(r.data), p)).length,
    encerradas: todasRncs.filter(r => dentro(dataEncerramentoRnc(r), p)).length,
  });
  const contaDesvio = p => ({
    registrados: todosDesvios.filter(d => dentro(dataRegistroDesvio(d), p)).length,
    triados: todosDesvios.filter(d => dentro(dataTriagem(d), p)).length,
  });

  const desviosAbertos = desvios.filter(d => d.status === "Registrado");
  const desviosAtrasados = desviosAbertos
    .map(d => ({ d, st: triagemStatus(d, hoje) }))
    .filter(x => x.st.atrasado)
    .sort((a, b) => b.st.dias - a.st.dias)
    .map(({ d, st }) => ({
      num: d.num || "—", setor: setorDoDesvio(d), tipo: d.tipo === "Outros" ? (d.tipoOutro || "Outros") : (d.tipo || "—"),
      impacto: d.impacto || "—", dias: st.dias, assunto: assunto(d.desc),
    }));

  const itemRnc = r => ({
    num: r.num || "—", assunto: assunto(r.desc), resp: r.resp || "Sem responsável", setor: r.setor || "—",
    sev: r.sev || "—", prazo: r.prazoAC || "", etapa: etapaParaContinuar(r)?.label || "—",
    diasAtraso: vencida(r) ? diasEntre(r.prazoAC, hoje) : 0,
    capa: contagemCapa(r, hoje),
  });

  const rncsVencidas = ativas.filter(vencida).map(itemRnc).sort((a, b) => b.diasAtraso - a.diasAtraso);

  const grupos = {};
  ativas.filter(r => !vencida(r)).map(itemRnc).forEach(i => { (grupos[i.resp] = grupos[i.resp] || []).push(i); });
  const rncsPorResponsavel = Object.entries(grupos)
    .map(([resp, itens]) => ({ resp, itens: itens.sort((a, b) => (a.prazo || "9999") < (b.prazo || "9999") ? -1 : 1) }))
    .sort((a, b) => b.itens.length - a.itens.length || a.resp.localeCompare(b.resp));

  const limiteAcao = somarDias(hoje, DIAS_ACAO_VENCENDO);
  const acoesCapa = ativas
    .flatMap(r => (r.w2h || [])
      .filter(a => a.status !== "Concluída" && a.status !== "Cancelada" && a.when && a.when <= limiteAcao)
      .map(a => ({
        rnc: r.num || "—", acao: assunto(a.what, 80) || "—", resp: a.who || "Sem responsável", prazo: a.when,
        vencida: a.when < hoje, diasAtraso: a.when < hoje ? diasEntre(a.when, hoje) : 0,
      })))
    .sort((a, b) => (a.prazo < b.prazo ? -1 : a.prazo > b.prazo ? 1 : a.resp.localeCompare(b.resp)));

  const setores = {};
  desvios.forEach(d => {
    const s = setorDoDesvio(d);
    setores[s] = setores[s] || { setor: s, abertos: 0, registrados: 0 };
    setores[s].registrados++;
    if (d.status === "Registrado") setores[s].abertos++;
  });
  const desviosPorSetor = Object.values(setores)
    .sort((a, b) => b.registrados - a.registrados || b.abertos - a.abertos || a.setor.localeCompare(b.setor))
    .slice(0, 10);

  return {
    hoje, periodo: per, anterior,
    resumo: {
      rnc: { ...contaRnc(per), anterior: anterior && contaRnc(anterior), emAberto: ativas.length, vencidas: rncsVencidas.length },
      desvio: { ...contaDesvio(per), anterior: anterior && contaDesvio(anterior), emAberto: desviosAbertos.length, atrasados: desviosAtrasados.length },
    },
    rncsVencidas, rncsPorResponsavel, desviosAtrasados, desviosPorSetor, acoesCapa,
    metaTriagem: META_TRIAGEM_DIAS,
  };
}

// RNC interna × externa (v3.29.0, sessão 4 do plano da reunião de 11/11/2026).
//
// Externa: a não conformidade veio de um fornecedor. Quem investiga e propõe o plano é
// o fornecedor (pelo link público ou pela planilha); a Qualidade cobra, avalia a resposta
// e verifica no recebimento seguinte. Interna: a Herbamed investiga, registra reuniões
// internas, faz o plano CAPA e verifica a eficácia, como sempre foi.
//
// `rnc.tipoRnc` = "externa" | "interna". RNC sem o campo (todas as anteriores a esta
// versão) é INTERNA: já tem todas as etapas. Nada é migrado.
//
// Só funções puras — a tela e o servidor não moram aqui.

const cheio = v => typeof v === "string" ? v.trim().length > 0 : !!v;

export const TIPOS_RNC = ["externa", "interna"];
export const ROTULO_TIPO_RNC = { externa: "Externa", interna: "Interna" };
export const PRAZO_RESPOSTA_FORNECEDOR_DIAS = 15;

export const tipoRnc = r => (r?.tipoRnc === "externa" ? "externa" : "interna");
export const rncExterna = r => tipoRnc(r) === "externa";

// A RNC "toca material/lote" quando o tipo é de material OU quando há produto/lote
// preenchido. Só nesses casos a disposição é obrigatória antes de encerrar.
const TIPOS_MATERIAL = ["Matéria-prima", "Material de embalagem", "Insumo", "Produto acabado"];
export function rncTemMaterial(r) {
  return !!(r && (TIPOS_MATERIAL.includes(r.tipo) || (r.lote || "").trim() || (r.produto || "").trim()));
}

/** Data (YYYY-MM-DD) somando dias corridos, sem fuso: o prazo é um dia do calendário. */
export function somarDias(isoData, dias) {
  const [a, m, d] = String(isoData || "").slice(0, 10).split("-").map(Number);
  if (!a || !m || !d) return "";
  const dt = new Date(Date.UTC(a, m - 1, d + dias));
  return dt.toISOString().slice(0, 10);
}

/** O que a abertura exige a mais de uma RNC externa (fornecedor, NF e lote). */
export function errosAberturaPorTipo(f) {
  if (!TIPOS_RNC.includes(f?.tipoRnc)) return ["Responda se a não conformidade veio de um fornecedor."];
  if (f.tipoRnc !== "externa") return [];
  const e = [];
  if (!cheio(f.fornecedor)) e.push("RNC externa: informe o fornecedor.");
  if (!cheio(f.nf)) e.push("RNC externa: informe a nota fiscal.");
  if (!cheio(f.lote)) e.push("RNC externa: informe o lote.");
  return e;
}

// ── Resposta do fornecedor ───────────────────────────────────────────────────────
// Ela chega por dois caminhos: o link público grava `respostaFornecedor` (servidor) e a
// planilha respondida entra em `respostasPlanilha[]` (anexo, append-only). A Qualidade
// pode pedir complemento (`complementoFornecedor`): a partir daí a RNC volta a aguardar
// até chegar uma resposta mais nova que o pedido, por qualquer um dos caminhos.

const ts = v => (v ? new Date(v).getTime() || 0 : 0);

/** Momento da resposta mais recente do fornecedor (ISO) ou null. */
export function ultimaRespostaEm(r) {
  const datas = [r?.respostaFornecedor?.respondidoEm, ...(r?.respostasPlanilha || []).map(p => p.em)].filter(Boolean);
  if (!datas.length) return null;
  return datas.reduce((a, b) => (ts(b) > ts(a) ? b : a));
}

/** Há pedido de complemento ainda não atendido? */
export function complementoAberto(r) {
  const pedido = r?.complementoFornecedor?.pedidoEm;
  if (!pedido) return false;
  return ts(pedido) > ts(ultimaRespostaEm(r));
}

/** A Qualidade tem uma resposta do fornecedor para avaliar (e não está esperando outra). */
export const temRespostaValida = r => !!ultimaRespostaEm(r) && !complementoAberto(r);

/** Prazo de resposta vencido (só conta enquanto se espera resposta). */
export function respostaAtrasada(r, hoje) {
  if (!rncExterna(r) || temRespostaValida(r)) return false;
  return !!r?.prazoRespostaFornecedor && r.prazoRespostaFornecedor < hoje;
}

/** Patch para anexar a planilha respondida (acrescenta, nunca substitui). */
export function patchPlanilhaRespondida(r, anexos, autor, agoraIso, data, hora) {
  if (!(anexos || []).length) return { erro: "Anexe a planilha respondida pelo fornecedor." };
  const reg = { id: `pl-${agoraIso}-${Math.random().toString(36).slice(2, 7)}`, anexos, por: autor, em: agoraIso };
  return {
    patch: {
      respostasPlanilha: [...(r?.respostasPlanilha || []), reg],
      historico: [...(r?.historico || []), {
        data, hora, acao: "Resposta do fornecedor anexada (planilha)", resp: autor, tipo: "fornecedor",
        detalhes: anexos.map(a => a.name).filter(Boolean),
      }],
    },
  };
}

/** Patch de "pedir complemento": a avaliação anterior cai e a RNC volta a aguardar. */
export function patchPedirComplemento(r, motivo, autor, agoraIso, data, hora) {
  const m = (motivo || "").trim();
  if (!m) return { erro: "Diga ao fornecedor o que falta na resposta." };
  return {
    patch: {
      complementoFornecedor: { motivo: m, pedidoPor: autor, pedidoEm: agoraIso },
      complementosFornecedor: [...(r?.complementosFornecedor || []), { motivo: m, pedidoPor: autor, pedidoEm: agoraIso }],
      avaliacaoFornecedor: null,
      historico: [...(r?.historico || []), { data, hora, acao: "Complemento pedido ao fornecedor", resp: autor, tipo: "fornecedor", detalhes: [m] }],
    },
  };
}

/** Patch de "aceitar resposta". */
export function patchAceitarResposta(r, obs, autor, agoraIso, data, hora) {
  if (!temRespostaValida(r)) return { erro: "Não há resposta do fornecedor para aceitar." };
  const o = (obs || "").trim();
  return {
    patch: {
      avaliacaoFornecedor: { resultado: "aceita", obs: o, por: autor, em: agoraIso },
      historico: [...(r?.historico || []), { data, hora, acao: "Resposta do fornecedor aceita", resp: autor, tipo: "fornecedor", detalhes: o ? [o] : [] }],
    },
  };
}

/** Patch de "a causa é nossa": a RNC vira interna e ganha as etapas da Herbamed. */
export function patchConverterEmInterna(r, motivo, autor, data, hora) {
  const m = (motivo || "").trim();
  if (!m) return { erro: "Explique por que a causa é interna." };
  return {
    patch: {
      tipoRnc: "interna",
      historico: [...(r?.historico || []), { data, hora, acao: "RNC convertida de externa para interna", resp: autor, tipo: "tipo", detalhes: [m] }],
    },
  };
}

export const RESULTADOS_VERIFICACAO = ["Conforme", "Não conforme"];

/**
 * Trava do encerramento da externa (etapa 4). `verificacao` é a que se está registrando;
 * sem ela (ex.: a RAC aprovando), vale a gravada na RNC.
 */
export function travaEncerramentoExterna(r, verificacao = r?.verificacaoRecebimento) {
  const m = [];
  if (!temRespostaValida(r)) m.push("Aguarde a resposta do fornecedor (etapa 3).");
  else if (r?.avaliacaoFornecedor?.resultado !== "aceita") m.push("Aceite a resposta do fornecedor antes de encerrar.");
  if (!verificacao || !RESULTADOS_VERIFICACAO.includes(verificacao.resultado) || !cheio(verificacao.data)) {
    m.push("Registre a verificação no recebimento seguinte: data e resultado.");
  }
  if (verificacao?.resultado === "Conforme" && rncTemMaterial(r) && !r?.disposicao?.decisao) {
    m.push("A RNC envolve material/lote: registre a disposição do material (etapa 2).");
  }
  return { ok: m.length === 0, motivos: m };
}

/**
 * Patch do encerramento da externa. O resultado da verificação vira o status (Conforme →
 * Eficaz, Não conforme → Ineficaz) e também preenche `eficacia`, para indicadores, PDF e
 * taxa de eficácia continuarem lendo do mesmo lugar.
 */
export function patchEncerrarExterna(r, verificacao, autor, agoraIso, data, hora) {
  const t = travaEncerramentoExterna(r, verificacao);
  if (!t.ok) return { erro: t.motivos.join(" ") };
  const status = verificacao.resultado === "Conforme" ? "Eficaz" : "Ineficaz";
  const v = { lote: (verificacao.lote || "").trim(), data: verificacao.data, resultado: verificacao.resultado, obs: (verificacao.obs || "").trim(), anexos: verificacao.anexos || [], por: autor, em: agoraIso };
  return {
    patch: {
      verificacaoRecebimento: v,
      status,
      eficacia: {
        ...(r?.eficacia || {}),
        criterio: "Verificação no recebimento seguinte do fornecedor",
        data: v.data, resultado: status, evidencias: [v.lote && `Lote verificado: ${v.lote}`, v.obs].filter(Boolean).join(" · "),
        anexos: v.anexos, registradoPor: autor, registradoEm: agoraIso,
      },
      historico: [...(r?.historico || []), {
        data, hora, acao: `RNC encerrada — recebimento seguinte ${v.resultado.toLowerCase()} (${status})`, resp: autor, tipo: "eficacia",
        detalhes: [v.lote && `Lote verificado: ${v.lote}`, `Data: ${v.data}`, v.obs].filter(Boolean),
      }],
    },
  };
}

// ── Reuniões internas (interna, etapa 4) ─────────────────────────────────────────
// Registro curto de cada conversa da equipe sobre a RNC. Append-only como a
// investigação: corrige-se registrando outra. Não trava nada.

export function novaReuniaoInterna(f, autor, agoraIso) {
  const e = [];
  if (!cheio(f?.data)) e.push("Informe a data da reunião.");
  if (!cheio(f?.participantes)) e.push("Informe quem participou.");
  if (!cheio(f?.decidido)) e.push("Registre o que foi decidido.");
  if (e.length) return { erros: e };
  return {
    reuniao: {
      id: `reu-${agoraIso}-${Math.random().toString(36).slice(2, 7)}`,
      data: f.data, local: (f.local || "").trim(), participantes: f.participantes.trim(), decidido: f.decidido.trim(),
      anexos: f.anexos || [], por: autor, em: agoraIso,
    },
  };
}

export function patchReuniaoInterna(r, reuniao, data, hora) {
  return {
    reunioesInternas: [...(r?.reunioesInternas || []), reuniao],
    historico: [...(r?.historico || []), {
      data, hora, acao: `Reunião interna registrada (${reuniao.data})`, resp: reuniao.por, tipo: "reuniao_interna",
      detalhes: [`Participantes: ${reuniao.participantes}`, reuniao.decidido.length > 140 ? `${reuniao.decidido.slice(0, 140)}…` : reuniao.decidido],
    }],
  };
}

// ── Evidências: todos os anexos da RNC num lugar só ──────────────────────────────

export function evidenciasDaRnc(r) {
  const out = [];
  const add = (lista, etapa, data, por) => (lista || []).filter(Boolean).forEach(a => out.push({ anexo: a, etapa, data: data || a.anexadoEm || "", por: por || a.anexadoPor || "" }));
  add(r?.anexos, "Registro", r?.data, r?.criadoPor);
  (r?.respostasPlanilha || []).forEach(p => add(p.anexos, "Resposta do fornecedor", p.em, p.por));
  (r?.investigacao || []).forEach(i => add(i.anexos, "Investigação", i.em, i.por));
  (r?.reunioesInternas || []).forEach(x => add(x.anexos, "Reunião interna", x.data, x.por));
  (r?.w2h || []).forEach((a, i) => add(Array.isArray(a.evidencias) ? a.evidencias : [], `Ação CAPA #${i + 1}`, a.when, a.who));
  if (r?.verificacaoRecebimento) add(r.verificacaoRecebimento.anexos, "Verificação no recebimento", r.verificacaoRecebimento.data, r.verificacaoRecebimento.por);
  else add(r?.eficacia?.anexos, "Eficácia", r?.eficacia?.data, r?.eficacia?.registradoPor);
  return out;
}

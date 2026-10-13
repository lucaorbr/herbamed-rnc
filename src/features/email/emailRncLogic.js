// Texto do e-mail de notificação da RNC. Puro e testável: o modal só chama e mostra.
//
// Texto puro, sem alinhar colunas com espaços: o Outlook mostra em fonte proporcional
// e o alinhamento entortava. Cada e-mail começa pelo que aconteceu no evento (o que
// mudou) e depois traz a situação da RNC, com o link para abrir a ficha na etapa certa.
import { dispMeta, rncAtiva } from "../../core/status";
import { fmt } from "../../core/utils";
import { MIN_PORQUES, contagemCapa, porquesPreenchidos } from "../rnc/ferramentasLogic";

const cheio = v => typeof v === "string" && v.trim() !== "";
const hojeIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const EVENTOS = {
  abertura: { titulo: "Nova não conformidade registrada", etapa: "resumo" },
  status: { titulo: "Atualização de status", etapa: "resumo" },
  ishikawa: { titulo: "Análise de causa atualizada", etapa: "causa" },
  "5w2h": { titulo: "Plano CAPA atualizado", etapa: "capa" },
  eficacia: { titulo: "Verificação de eficácia registrada", etapa: "eficacia" },
  manual: { titulo: "Notificação de não conformidade", etapa: "resumo" },
};

const RODAPE = "Herbamed · Sistema de Gestão da Qualidade\nMensagem enviada pelo SGQ.";

/** Acrescenta um bloco ao corpo antes do rodapé (ou no fim, se o rodapé foi apagado na edição). */
export function comBlocoAntesDoRodape(body, bloco) {
  const i = body.lastIndexOf(RODAPE);
  return i < 0 ? `${body}\n\n${bloco}` : `${body.slice(0, i)}${bloco}\n\n${body.slice(i)}`;
}

/** Endereço da ficha da RNC na etapa do evento (mesmo formato de `urlComAba`). */
export function linkDaFicha(origem, rnc, etapa) {
  if (!origem || !rnc?.id) return "";
  const p = new URLSearchParams({ aba: "rnc", rnc: String(rnc.id) });
  if (etapa && etapa !== "resumo") p.set("etapa", etapa);
  return `${origem}/?${p.toString()}`;
}

const secao = (titulo, linhas) => {
  const corpo = linhas.filter(l => l !== null && l !== undefined && l !== false);
  return corpo.length ? `${titulo.toUpperCase()}\n${"-".repeat(titulo.length)}\n${corpo.join("\n")}` : "";
};

const analiseCompleta = r => porquesPreenchidos(r) >= MIN_PORQUES && cheio(r?.ishikawa?.root);

function linhasAnalise(r) {
  const whys = (r?.ishikawa?.whys || []).map((w, i) => cheio(w) ? `${i + 1}. Por quê? ${w.trim()}` : null).filter(Boolean);
  const invest = (r?.investigacao || []).map(i => `- ${String(i.texto || "").trim()}${i.por ? ` (${i.por})` : ""}`);
  return [
    invest.length ? "Investigação:" : null, ...invest,
    invest.length && whys.length ? "" : null,
    whys.length ? "5 Porquês:" : null, ...whys,
    cheio(r?.ishikawa?.root) ? `\nCausa raiz: ${r.ishikawa.root.trim()}` : null,
  ];
}

function linhaAcao(a, i, hoje) {
  const aberta = a.status !== "Concluída" && a.status !== "Cancelada";
  const vencida = aberta && a.when && a.when < hoje;
  return `${i + 1}. [${a.tipo || "Corretiva"}] ${String(a.what || "").trim() || "(sem descrição)"}\n` +
    `   Responsável: ${a.who || "—"} · Prazo: ${fmt(a.when)} · Situação: ${a.status || "Pendente"}${vencida ? " (VENCIDA)" : ""}`;
}

function linhasCapa(r, hoje) {
  const acts = r?.w2h || [];
  if (!acts.length) return [];
  const c = contagemCapa(r, hoje);
  return [
    `${c.total} ação(ões): ${c.concluidas} concluída(s), ${c.abertas} em aberto${c.vencidas ? `, ${c.vencidas} vencida(s)` : ""}.`,
    "",
    ...acts.map((a, i) => linhaAcao(a, i, hoje)),
  ];
}

function linhasEficacia(r) {
  const e = r?.eficacia;
  if (!e?.resultado) return [];
  return [
    `Resultado: ${e.resultado}`,
    cheio(e.criterio) ? `Critério: ${e.criterio.trim()}` : null,
    e.data ? `Data da verificação: ${fmt(e.data)}` : null,
    cheio(e.obs) ? `Observação: ${e.obs.trim()}` : null,
    e.registradoPor ? `Registrado por: ${e.registradoPor}` : null,
  ];
}

function linhasDisposicao(r) {
  const d = r?.disposicao;
  if (!d?.decisao) return [];
  return [
    `Decisão: ${dispMeta(d.decisao)?.label || d.decisao}`,
    cheio(d.justificativa) ? `Justificativa: ${d.justificativa.trim()}` : null,
    `Por: ${d.por || "—"} · Data: ${fmt(d.data)}`,
  ];
}

/** O que aconteceu neste evento — o primeiro bloco do e-mail. */
function destaqueDoEvento(r, evento, hoje) {
  switch (evento) {
    case "abertura":
      return "Uma nova não conformidade foi registrada e aguarda tratamento.";
    case "status":
      return `O status da RNC passou para: ${r.status}.`;
    case "ishikawa": {
      if (analiseCompleta(r)) return "A análise de causa foi concluída. O plano CAPA está liberado.";
      const faltam = [
        porquesPreenchidos(r) < MIN_PORQUES && `${MIN_PORQUES - porquesPreenchidos(r)} porquê(s)`,
        !cheio(r?.ishikawa?.root) && "a causa raiz",
      ].filter(Boolean).join(" e ");
      return `A análise de causa foi atualizada e segue em andamento (faltam ${faltam}).`;
    }
    case "5w2h": {
      const c = contagemCapa(r, hoje);
      return `O plano CAPA foi atualizado: ${c.total} ação(ões), ${c.abertas} em aberto${c.vencidas ? `, ${c.vencidas} vencida(s)` : ""}.`;
    }
    case "eficacia":
      return r?.eficacia?.resultado === "Pendente verificação"
        ? `A verificação de eficácia foi agendada${r.eficacia.data ? ` para ${fmt(r.eficacia.data)}` : ""}.`
        : `A verificação de eficácia foi registrada como ${String(r?.eficacia?.resultado || "").toUpperCase()}. A RNC está encerrada.`;
    default:
      return "Segue a situação atual da não conformidade.";
  }
}

/**
 * Assunto e corpo do e-mail da RNC para o evento.
 * `origem` (ex.: window.location.origin) monta o link da ficha; sem ela não há link.
 */
export function buildEmail(rnc, evento, { origem = "", hoje = hojeIso() } = {}) {
  const r = rnc || {};
  const ev = EVENTOS[evento] || EVENTOS.manual;
  const pfx = r.sev === "Crítica" ? "[CRÍTICA] " : r.sev === "Maior" ? "[MAIOR] " : "";
  const subject = pfx + [r.num || "RNC", ev.titulo, r.produto || r.tipo].filter(Boolean).join(" | ");
  const link = linkDaFicha(origem, r, ev.etapa);
  const vencido = d => d && d < hoje && rncAtiva(r.status) ? " (VENCIDO)" : "";

  // O bloco do evento vai primeiro; o mesmo assunto não se repete na situação abaixo.
  const blocoEvento = {
    ishikawa: secao("Análise de causa", linhasAnalise(r)),
    "5w2h": secao("Plano CAPA", linhasCapa(r, hoje)),
    eficacia: secao("Verificação de eficácia", linhasEficacia(r)),
  }[evento] || "";

  const partes = [
    "Prezado(a),",
    destaqueDoEvento(r, evento, hoje),
    [
      `RNC ${r.num || "—"} · ${r.status || "—"} · Severidade ${r.sev || "—"}`,
      link ? `Abrir no SGQ: ${link}` : null,
    ].filter(Boolean).join("\n"),
    blocoEvento,
    secao("Dados da não conformidade", [
      `Tipo: ${r.tipo || "—"}`,
      `Data de abertura: ${fmt(r.data)}`,
      `Produto/Material: ${r.produto || "—"}`,
      r.lote ? `Lote: ${r.lote}` : null,
      r.qtd ? `Quantidade afetada: ${r.qtd}` : null,
      r.fornecedor ? `Fornecedor: ${r.fornecedor}` : null,
      `Setor: ${r.setor || "—"}`,
      `Detectado por: ${r.detector || "—"}`,
      `Responsável: ${r.resp || "—"}`,
    ]),
    secao("Descrição", [
      String(r.desc || "—").trim(),
      cheio(r.ref) ? `\nReferência: ${r.ref.trim()}` : null,
      cheio(r.evidencia) ? `Evidências: ${r.evidencia.trim()}` : null,
    ]),
    cheio(r.contencao) ? secao("Ação de contenção", [
      r.contencao.trim(),
      `Responsável: ${r.respCont || "—"} · Data: ${fmt(r.dataContencao)}`,
    ]) : "",
    secao("Disposição do material", linhasDisposicao(r)),
    evento !== "ishikawa" && analiseCompleta(r) ? secao("Causa raiz", [r.ishikawa.root.trim()]) : "",
    evento !== "5w2h" ? secao("Plano CAPA", linhasCapa(r, hoje)) : "",
    evento !== "eficacia" ? secao("Verificação de eficácia", linhasEficacia(r)) : "",
    rncAtiva(r.status) ? secao("Prazos", [
      analiseCompleta(r)
        ? `Análise de causa: concluída${r.prazoCausa ? ` (prazo era ${fmt(r.prazoCausa)})` : ""}`
        : `Análise de causa: ${fmt(r.prazoCausa)}${vencido(r.prazoCausa)}`,
      `Ação corretiva: ${fmt(r.prazoAC)}${vencido(r.prazoAC)}`,
      `Verificação de eficácia: ${fmt(r.prazoEfic)}${vencido(r.prazoEfic)}`,
    ]) : "",
    RODAPE,
  ];
  return { subject, body: partes.filter(p => cheio(p)).join("\n\n") };
}

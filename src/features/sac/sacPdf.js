// PDFs do SAC: o registro completo do atendimento (uso interno) e a carta de
// resposta ao consumidor. Ambos no "rosto" padrão do sistema (`buildPDFShell`).
import { fmt } from "../../core/utils";
import { buildPDFShell, openPDFWindow } from "../pdf/pdfExports";
import { enderecoTexto } from "./sacLogic";

// O texto vem do consumidor e de quem atende: escapa antes de ir para o HTML.
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const txt = (v) => `<div style="white-space:pre-wrap">${esc(v) || "—"}</div>`;
const campo = (l, v) => `<div class="field"><div class="flabel">${esc(l)}</div><div class="fval">${esc(v) || "—"}</div></div>`;
const dataHora = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR") : "—");

export function buildSacHTML(a, rnc = null) {
  const respostas = (a.respostas || []).map(r => `
    <tr><td style="white-space:nowrap">${fmt(r.data)}</td><td>${esc(r.meio)}</td><td>${txt(r.texto)}</td><td>${esc(r.por)}</td></tr>`).join("");
  const av = a.avaliacao;
  const am = a.amostra || {};
  const encaminhamentos = (a.encaminhamentos || []).map(e => `
    <tr><td style="white-space:nowrap">${fmt(e.data)}</td><td>${esc(e.setor)}${e.motivo ? `<div style="color:#666">${esc(e.motivo)}</div>` : ""}</td>
    <td>${e.retorno ? `${fmt(e.retorno.data)} — ${txt(e.retorno.texto)}` : "<em>aguardando retorno</em>"}</td></tr>`).join("");
  const historico = (a.historico || []).map(h => `
    <tr><td style="white-space:nowrap">${fmt(h.data)} ${esc(h.hora || "")}</td><td>${esc(h.acao)}${(h.detalhes || []).map(d => `<div style="color:#666">• ${esc(d)}</div>`).join("")}</td><td>${esc(h.resp)}</td></tr>`).join("");

  const corpo = `
  <div class="section">
    <div class="stitle">1. Atendimento</div>
    <div class="grid3">
      ${campo("Nº protocolo", a.num)}
      ${campo("Data / horário", `${fmt(a.dataContato)}${a.horaContato ? " " + a.horaContato : ""}`)}
      ${campo("Atendente", a.registradoPor)}
      ${campo("Canal", a.canal)}
      ${campo("Tipo", a.classificacao)}
      ${campo("Status", a.status)}
    </div>
  </div>
  <div class="section">
    <div class="stitle">2. Cliente</div>
    <div class="grid3">
      ${campo("Nome completo", a.consumidorNome)}
      ${campo("CPF / CNPJ", a.consumidorDoc)}
      ${campo("Telefone / WhatsApp", a.consumidorTelefone)}
      ${campo("E-mail", a.consumidorEmail)}
      ${campo("Cidade / UF", [a.consumidorCidade, a.consumidorUF].filter(Boolean).join(" / "))}
    </div>
    ${a.consumidorLogradouro || a.consumidorCEP ? `<div class="field" style="margin-top:8px"><div class="flabel">Endereço</div>${txt(enderecoTexto(a))}</div>` : ""}
  </div>
  <div class="section">
    <div class="stitle">3. Produto</div>
    <div class="grid3">
      ${campo("Suplemento", a.produto)}
      ${campo("Lote", a.lote)}
      ${campo("Validade", a.validade)}
      ${campo("Nº pedido / NF", a.nf)}
      ${campo("Local de compra", a.localCompra)}
      ${campo("Ainda tem o produto?", a.temAmostra || "Não informado")}
    </div>
  </div>
  <div class="section no-break">
    <div class="stitle">4. Relato do cliente</div>
    <div class="field">${txt(a.relato)}</div>
    ${a.teveReacao === "Sim" ? `<div class="box-red" style="margin-top:8px"><strong>Reação relatada após o consumo:</strong>${txt(a.reacaoDesc)}</div>` : ""}
  </div>
  ${am.solicitada ? `
  <div class="section no-break">
    <div class="stitle">Amostra do cliente</div>
    <div class="grid2">
      ${campo("Pedida em", `${dataHora(am.solicitada.em)} por ${am.solicitada.por || "—"}`)}
      ${campo("Recebida em", am.recebida ? `${fmt(am.recebida.em)} por ${am.recebida.por || "—"}` : "Aguardando")}
    </div>
    ${am.solicitada.instrucoes ? `<div class="field" style="margin-top:8px"><div class="flabel">Instruções ao cliente</div>${txt(am.solicitada.instrucoes)}</div>` : ""}
    ${am.recebida?.condicao ? `<div class="field" style="margin-top:8px"><div class="flabel">Condição na chegada</div>${txt(am.recebida.condicao)}</div>` : ""}
  </div>` : ""}
  ${av ? `
  <div class="section no-break">
    <div class="stitle">Avaliação técnica</div>
    <div class="grid3">
      ${campo("Resultado", av.resultado)}
      ${campo("Amostra do cliente analisada", av.amostraConsumidor)}
      ${campo("Amostra de retenção analisada", av.amostraRetencao)}
    </div>
    <div class="field" style="margin-top:8px"><div class="flabel">Parecer</div>${txt(av.parecer)}</div>
    <div style="font-size:10px;color:#666;margin-top:4px">Registrado por ${esc(av.por)} em ${dataHora(av.em)}${(av.anexos || []).length ? ` · ${av.anexos.length} anexo(s)` : ""}</div>
  </div>` : ""}
  ${a.notificacaoVigilancia ? `
  <div class="section no-break">
    <div class="stitle">Notificação à vigilância sanitária</div>
    <div class="field">${esc(a.notificacaoVigilancia.decisao)} — ${a.notificacaoVigilancia.decisao === "Notificado"
      ? `em ${fmt(a.notificacaoVigilancia.data)}, protocolo ${esc(a.notificacaoVigilancia.protocolo)}`
      : esc(a.notificacaoVigilancia.justificativa)} (registrado por ${esc(a.notificacaoVigilancia.por)})</div>
  </div>` : ""}
  ${a.rncNum ? `
  <div class="section">
    <div class="stitle">Investigação</div>
    <div class="field">RNC ${esc(a.rncNum)}${rnc ? ` — situação atual: ${esc(rnc.status)}` : ""}</div>
  </div>` : ""}
  <div class="section">
    <div class="stitle">5. Orientação dada ao cliente</div>
    ${respostas ? `<table><thead><tr><th>Data</th><th>Meio</th><th>Orientação / resposta</th><th>Por</th></tr></thead><tbody>${respostas}</tbody></table>` : `<div class="field">Nenhuma orientação registrada.</div>`}
  </div>
  <div class="section">
    <div class="stitle">6. Encaminhamento / retorno do setor</div>
    ${encaminhamentos ? `<table><thead><tr><th>Data</th><th>Setor</th><th>Retorno</th></tr></thead><tbody>${encaminhamentos}</tbody></table>` : `<div class="field">Não encaminhado.</div>`}
  </div>
  ${a.status === "Finalizado" ? `
  <div class="section no-break">
    <div class="stitle">7. Encerramento</div>
    <div class="box-green"><strong>Solução aplicada:</strong> ${esc(a.solucao) || "—"}${a.conclusao ? txt(a.conclusao) : ""}<div style="font-size:10px;color:#666;margin-top:4px">Finalizado por ${esc(a.encerradoPor)} em ${fmt(a.encerradoEm)}</div></div>
  </div>` : ""}
  <div class="section">
    <div class="stitle">Histórico</div>
    <table><thead><tr><th>Quando</th><th>O quê</th><th>Por</th></tr></thead><tbody>${historico}</tbody></table>
  </div>`;

  return buildPDFShell({
    titulo: "Ficha SAC",
    numero: a.num,
    meta: `${a.classificacao || "—"} · ${a.status}`,
    rodapeEsq: "Herbamed® · SGQ · SAC · Contém dados pessoais — uso interno",
    corpo,
  });
}

export function exportSacPDF(a, rnc = null) {
  openPDFWindow(`${a.num} — Herbamed®`, buildSacHTML(a, rnc));
}

/** Carta ao consumidor com o texto de uma resposta registrada. */
export function buildCartaHTML(a, resposta) {
  const hoje = new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
  const ref = [a.produto, a.lote && `lote ${a.lote}`].filter(Boolean).join(", ");
  const corpo = `
  <div style="font-size:13.5px;line-height:1.7;max-width:165mm">
    <p style="text-align:right;margin-bottom:24px">${esc(hoje)}</p>
    <p style="margin-bottom:4px"><strong>${esc(a.consumidorNome)}</strong></p>
    ${[a.consumidorCidade, a.consumidorUF].filter(Boolean).length ? `<p style="margin-bottom:18px">${esc([a.consumidorCidade, a.consumidorUF].filter(Boolean).join(" / "))}</p>` : `<p style="margin-bottom:18px"></p>`}
    <p style="margin-bottom:18px"><strong>Ref.: atendimento ${esc(a.num)}${ref ? ` — ${esc(ref)}` : ""}</strong></p>
    <p style="margin-bottom:14px">Prezado(a) ${esc(a.consumidorNome)},</p>
    <p style="margin-bottom:14px">Agradecemos o seu contato com o Serviço de Atendimento ao Consumidor da Herbamed em ${fmt(a.dataContato)}.</p>
    <div style="margin-bottom:14px;white-space:pre-wrap">${esc(resposta.texto)}</div>
    <p style="margin-bottom:14px">Permanecemos à disposição para qualquer esclarecimento, informando o número do atendimento acima.</p>
    <p style="margin-top:30px">Atenciosamente,</p>
    <p style="margin-top:40px"><strong>Serviço de Atendimento ao Consumidor</strong><br/>Herbamed®</p>
  </div>`;
  return buildPDFShell({
    titulo: "Resposta ao Consumidor",
    subtitulo: "Serviço de Atendimento ao Consumidor",
    numero: a.num,
    rodapeEsq: "Herbamed® · Serviço de Atendimento ao Consumidor",
    corpo,
  });
}

export function exportCartaPDF(a, resposta) {
  openPDFWindow(`Carta ${a.num} — Herbamed®`, buildCartaHTML(a, resposta));
}

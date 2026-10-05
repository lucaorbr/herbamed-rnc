import React, { useEffect, useState } from "react";
import { createElectronicSignature } from "../../firebase";
import { SEVMETA, SMETA, TIPOC, rncAtiva, rncEncerrada } from "../../core/status";
import { useTheme } from "../../core/theme";
import { fmt, past, sigCodigo, tod } from "../../core/utils";
import { useS } from "../../shared/styles";
import { AnexosUpload } from "../../shared/AnexosUpload";
import { Badge, F, Inp, SecTitle, Sel, SevB, TA } from "../../shared/ui";
import { CampoHistoricoEdicao, CampoHistoricoLeitura } from "../../shared/CampoHistorico";
import { acrescentarAoCampo, campoVazio, resumoAcrescimo } from "../../shared/campoHistoricoLogic";
import { AssinaturaModal, exportRNCPDF } from "../pdf/pdfExports";
import { exportFormularioFornecedor } from "./formularioFornecedor";
import { DISPOSICOES, andamentoPatch, dispMeta } from "./RncTabs";
import { AnaliseCausaEditor } from "./AnaliseCausa";
import { Investigacao } from "./Investigacao";
import { PlanoCapaEditor } from "./PlanoCapa";
import { EficaciaEditor } from "./Eficacia";
import { ofertaNotificar } from "../email/ofertaNotificar";
import { ETAPAS, etapasDaRnc, porquesPreenchidos, rncEditavelNasFerramentas, rncTemMaterial } from "./ferramentasLogic";

// Ficha da RNC — página própria com as etapas em abas (onda 2 da ficha única).
// Substitui o modal da lista: a lógica (edição append-only, disposição com assinatura
// do RT, status, assinaturas, formulário do fornecedor) veio de lá sem mudar as regras.
// As etapas 3 (análise de causa, onda 3), 4 (plano CAPA, onda 4) e 5 (eficácia e
// encerramento, onda 5) também editam aqui mesmo — não há mais ferramenta solta.

const CATS_ISHIKAWA = [["mao", "Mão de obra"], ["maquina", "Máquina"], ["metodo", "Método"], ["material", "Material"], ["medicao", "Medição"], ["meioamb", "Meio ambiente"]];
const ICONE_ESTADO = { concluida: "✓", bloqueada: "🔒", dispensada: "—" };

export function RncFicha({ rncId, etapa = "resumo", setEtapa, rncs, user, toast_, setTab, openEmail, doUpdateRNC, doDeleteRNC, isViewer, isAdmin, perm }) {
  const T = useTheme(); const s = useS();
  const vivo = rncs.find(x => x.id === rncId) || null;
  // Cópia local: mostra a gravação na hora (a lista só relê o servidor a cada 5 s) e é
  // substituída pela versão do servidor a cada leitura — assim a ficha também reflete
  // o que outras pessoas gravaram.
  const [r, setR] = useState(vivo);
  useEffect(() => { if (vivo) setR(vivo); }, [vivo]);

  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({});
  // Descrição e contenção são append-only: aqui se digita só o ACRÉSCIMO.
  const [addDesc, setAddDesc] = useState("");
  const [addCont, setAddCont] = useState("");
  const [assinaturaModal, setAssinaturaModal] = useState(false);
  const [dispForm, setDispForm] = useState(false);
  const [dispDec, setDispDec] = useState("");
  const [dispJust, setDispJust] = useState("");
  const [dispSign, setDispSign] = useState(null);
  useEffect(() => { setEditing(false); setDispForm(false); setDispDec(""); setDispJust(""); setDispSign(null); }, [rncId]);

  if (!r) {
    return (
      <div style={s.card}>
        <div style={{ fontSize: 14, color: T.text2, marginBottom: 12 }}>{rncs.length ? "RNC não encontrada — pode ter sido excluída ou o link está incorreto." : "Carregando RNC…"}</div>
        <button style={s.btn} onClick={() => setTab("lista")}>← Voltar aos registros</button>
      </div>
    );
  }

  // Grava e já mostra; se o servidor recusar, doUpdateRNC avisa e interrompe.
  const gravar = async (patch) => { await doUpdateRNC(r.id, patch); setR(p => ({ ...p, ...patch })); };
  const agoraHora = () => new Date().toLocaleTimeString("pt-BR");

  const canEdit = !isViewer && (isAdmin || r.criadoPor === user.name || r.detector === user.name);
  const canDispor = !isViewer && (isAdmin || (perm && perm("analisarRNC")));
  const podeRT = ["rt", "admin", "keyuser"].includes(user?.role);
  const emTratamento = rncEditavelNasFerramentas(r);
  const etapas = etapasDaRnc(r);

  const updStatus = async (status) => {
    const h = { data: tod(), hora: agoraHora(), acao: `Status alterado -> ${status}`, resp: user.name, tipo: "status" };
    const historico = [...(r.historico || []), h];
    await gravar({ status, historico });
    toast_(`Status atualizado para ${status}.`, "green", ofertaNotificar({ ...r, status, historico }, "status", openEmail));
  };

  const assinarRT = async () => {
    if (!podeRT) { alert("Apenas o Responsável Técnico pode assinar RNCs."); return; }
    if (!window.confirm(`Confirma assinatura como RT na RNC ${r.num}?`)) return;
    const password = window.prompt("Confirme sua senha para assinar como RT:");
    if (!password) return;
    let ass;
    try { ass = await createElectronicSignature({ password, contexto: `RNC|${r.num || r.id || ""}`, papel: "Responsavel Tecnico" }); }
    catch { alert("Senha incorreta. Assinatura cancelada."); return; }
    const h = { data: tod(), hora: agoraHora(), acao: "RNC aprovada pelo RT", resp: user.name, tipo: "rt" };
    await gravar({ assinaturaRT: ass, historico: [...(r.historico || []), h] });
    toast_("RNC aprovada pelo RT!", "green");
  };

  const gravarDisposicao = async (decisao, justificativa, assinaturaRT) => {
    const meta = dispMeta(decisao);
    const disposicao = { decisao, justificativa: (justificativa || "").trim(), data: tod(), por: user.name, assinaturaRT: assinaturaRT || null };
    const h = {
      data: tod(), hora: agoraHora(),
      acao: `Disposição do material: ${meta?.label || decisao}${assinaturaRT ? " (assinada pelo RT)" : ""}`,
      detalhes: [disposicao.justificativa].filter(Boolean), resp: user.name, tipo: "disposicao",
    };
    await gravar({ disposicao, historico: [...(r.historico || []), h] });
    setDispForm(false); setDispDec(""); setDispJust("");
    toast_("Disposição do material registrada.", "green");
  };

  // Encerramento leve: resolvida pela disposição, sem ciclo de eficácia (status "Encerrada").
  const encerrarPorDisposicao = async () => {
    if (!r.disposicao?.decisao) { alert("Registre a disposição do material antes de encerrar."); return; }
    const pend = (r.w2h || []).filter(a => a.status !== "Concluída" && a.status !== "Cancelada");
    const aviso = pend.length > 0 ? `\n\nAtenção: há ${pend.length} ação(ões) de CAPA pendente(s) — o encerramento por disposição dispensa o ciclo de eficácia.` : "";
    if (!window.confirm(`Encerrar a RNC ${r.num} como resolvida por disposição do material (${dispMeta(r.disposicao.decisao)?.label})?\n\nA RNC vai para o status "Encerrada", sem passar pela verificação de eficácia.${aviso}`)) return;
    const h = { data: tod(), hora: agoraHora(), acao: `RNC encerrada por disposição do material (${dispMeta(r.disposicao.decisao)?.label})`, resp: user.name, tipo: "status" };
    await gravar({ status: "Encerrada", historico: [...(r.historico || []), h] });
    toast_("RNC encerrada por disposição.", "green");
  };

  const submitDisposicao = () => {
    if (!dispDec) { alert("Selecione a decisão de disposição."); return; }
    if (!dispJust.trim()) { alert("A justificativa técnica da disposição é obrigatória."); return; }
    if (dispMeta(dispDec)?.libera) {
      if (!(isAdmin || (perm && perm("aprovarRNC")))) { alert("Liberar material não conforme exige assinatura do RT (permissão \"Aprovar como RT\")."); return; }
      setDispSign({ decisao: dispDec, justificativa: dispJust });
    } else {
      gravarDisposicao(dispDec, dispJust, null);
    }
  };

  const startEdit = (etapaDestino) => {
    setEditData({
      produto: r.produto || "", fornecedor: r.fornecedor || "",
      lote: r.lote || "", nf: r.nf || "", qtd: r.qtd || "", ref: r.ref || "", evidencia: r.evidencia || "",
      tipo: r.tipo || "Matéria-prima", sev: r.sev || "Maior", setor: r.setor || "",
      resp: r.resp || "", prazoCausa: r.prazoCausa || "", prazoAC: r.prazoAC || "",
      prazoEfic: r.prazoEfic || "", respCont: r.respCont || "",
    });
    setAddDesc(""); setAddCont("");
    setEditing(true);
    if (etapaDestino) setEtapa(etapaDestino);
  };

  const saveEdit = async () => {
    if (campoVazio(r.desc) && campoVazio(addDesc)) { alert("Descrição é obrigatória."); return; }
    // ⚠️ `campos` TEM DE COBRIR TUDO QUE O FORMULÁRIO EDITA: com o retorno de "nada
    // mudou" logo abaixo, um campo esquecido aqui descarta a edição em silêncio.
    const alterados = [];
    const campos = { produto: "Produto", fornecedor: "Fornecedor", lote: "Lote", nf: "Nota Fiscal", qtd: "Quantidade", ref: "Referência", evidencia: "Evidências", setor: "Setor", sev: "Severidade", tipo: "Tipo", resp: "Responsável", respCont: "Responsável da contenção", prazoCausa: "Prazo da análise de causa", prazoAC: "Prazo AC", prazoEfic: "Prazo Eficácia" };
    Object.entries(campos).forEach(([k, label]) => {
      if ((r[k] || "") !== (editData[k] || "")) alterados.push(`${label}: "${r[k] || "—"}" → "${editData[k] || "—"}"`);
    });
    if (!campoVazio(addDesc)) alterados.push(`Descrição — acréscimo: "${resumoAcrescimo(addDesc)}"`);
    if (!campoVazio(addCont)) alterados.push(`Ação de contenção — acréscimo: "${resumoAcrescimo(addCont)}"`);
    if (!alterados.length) { setEditing(false); return; }

    const agora = new Date();
    const h = { data: tod(), hora: agora.toLocaleTimeString("pt-BR"), acao: `RNC editada — ${alterados.length} campo(s) alterado(s)`, detalhes: alterados, resp: user.name, tipo: "edicao" };
    let historico = [...(r.historico || []), h];
    const patch = { ...editData };
    if (!campoVazio(addDesc)) patch.desc = acrescentarAoCampo(r.desc, addDesc, user, agora);
    if (!campoVazio(addCont)) patch.contencao = acrescentarAoCampo(r.contencao, addCont, user, agora);
    // Contenção registrada agora (estava vazia) = 1º ato de tratamento -> Em andamento.
    const ap = !campoVazio(addCont) && campoVazio(r.contencao) ? andamentoPatch(r, "contenção registrada", user.name) : null;
    if (ap) { patch.status = ap.status; historico = [...historico, ap.hEntry]; }
    patch.historico = historico;
    await gravar(patch);
    setEditing(false); setAddDesc(""); setAddCont("");
    toast_(ap ? "RNC atualizada — status movido para Em andamento." : "RNC atualizada com sucesso!", "green");
  };

  const excluir = async () => {
    if (!window.confirm(`Excluir a RNC ${r.num} permanentemente?`)) return;
    await doDeleteRNC(r.id);
    toast_("RNC excluída.", "red");
    setTab("lista");
  };

  const formularioFornecedor = async () => {
    try {
      await exportFormularioFornecedor(r);
      const ap = andamentoPatch(r, "encaminhado ao fornecedor", user.name);
      if (ap) await gravar({ status: ap.status, historico: [...(r.historico || []), ap.hEntry] });
      toast_(ap ? "Formulário gerado — status movido para Em andamento." : "Formulário do fornecedor gerado!", "green");
    } catch (e) { toast_("Erro ao gerar formulário: " + e.message, "red"); }
  };

  // ── Peças de apresentação ────────────────────────────────────────────────────
  const rot = { fontSize: 10, color: T.text3, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 };
  const caixa = { background: T.surf, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14, marginBottom: 14 };
  const vazio = txt => <div style={{ fontSize: 12, color: T.text3, fontStyle: "italic" }}>{txt}</div>;
  const ed = (k, v) => setEditData(p => ({ ...p, [k]: v }));

  const dadosBloco = () => {
    const itens = [["Tipo", r.tipo], ["Setor", r.setor], ["Produto", r.produto], ["Fornecedor", r.fornecedor], ["Lote", r.lote], ["Nota Fiscal", r.nf], ["Qtd.", r.qtd], ["Referência", r.ref], ["Evidências", r.evidencia]].filter(([, v]) => v);
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10, marginBottom: 14 }}>
        {itens.map(([k, v]) => (
          <div key={k} style={{ background: T.surf, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px" }}>
            <div style={rot}>{k}</div><div style={{ fontSize: 13 }}>{v}</div>
          </div>
        ))}
      </div>
    );
  };

  const anexosBloco = () => r.anexos?.length > 0 ? (
    <div style={{ marginBottom: 14 }}>
      <div style={rot}>📎 Anexos ({r.anexos.length})</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {r.anexos.map((a, i) => (
          <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: T.surf, border: `1px solid ${T.border2}`, borderRadius: 8, color: T.accent, textDecoration: "none", fontSize: 12 }}>
            {a.type?.includes("image") ? "🖼️" : a.type?.includes("pdf") ? "📄" : "📎"} {a.name}
          </a>
        ))}
      </div>
    </div>
  ) : null;

  const disposicaoBloco = (interativa) => {
    if (!(r.disposicao?.decisao || rncTemMaterial(r) || (interativa && canDispor))) return null;
    const meta = dispMeta(r.disposicao?.decisao);
    return (
      <div style={{ marginBottom: 14 }}>
        <div style={rot}>📦 Disposição do material</div>
        {r.disposicao?.decisao ? (
          <div style={{ ...caixa, borderColor: `${meta?.cor || T.border}55` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: meta?.cor || T.text, padding: "3px 12px", borderRadius: 20, background: `${meta?.cor || T.text3}18` }}>{meta?.label || r.disposicao.decisao}</span>
              <span style={{ fontSize: 11, color: T.text3 }}>por {r.disposicao.por} · {fmt(r.disposicao.data)}</span>
            </div>
            {r.disposicao.justificativa && <div style={{ fontSize: 13, lineHeight: 1.5 }}>{r.disposicao.justificativa}</div>}
            {r.disposicao.assinaturaRT && (
              <div style={{ fontSize: 11, color: T.accent, fontWeight: 600, marginTop: 8 }}>
                ✅ Liberação assinada pelo RT: {r.disposicao.assinaturaRT.nome} · {r.disposicao.assinaturaRT.timestamp ? new Date(r.disposicao.assinaturaRT.timestamp).toLocaleString("pt-BR") : r.disposicao.assinaturaRT.dataHora}
              </div>
            )}
            {interativa && canDispor && !dispForm && (
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <button onClick={() => { setDispForm(true); setDispDec(r.disposicao.decisao); setDispJust(r.disposicao.justificativa || ""); }} style={{ ...s.btn, fontSize: 11, padding: "5px 10px" }}>Alterar disposição</button>
                {rncAtiva(r.status) && <button onClick={encerrarPorDisposicao} style={{ ...s.btn, fontSize: 11, padding: "5px 10px", color: T.accent, borderColor: `${T.accent}44`, background: T.accentDim }}>Encerrar RNC (resolvida por disposição)</button>}
              </div>
            )}
          </div>
        ) : rncTemMaterial(r) && (
          <div style={{ fontSize: 12, color: T.yellow, background: `${T.yellow}14`, border: `1px solid ${T.yellow}44`, borderRadius: 8, padding: "8px 12px", marginBottom: 10 }}>
            ⚠️ RNC envolve material/lote — registre a disposição antes de encerrar como Eficaz.
          </div>
        )}
        {interativa && canDispor && (dispForm || !r.disposicao?.decisao) && (
          <div style={{ ...s.card, marginTop: 10 }}>
            <F lbl="Decisão de disposição" ch={
              <Sel value={dispDec} onChange={e => setDispDec(e.target.value)}>
                <option value="">— Selecione —</option>
                {DISPOSICOES.map(d => <option key={d.key} value={d.key}>{d.label}{d.libera ? " (exige RT)" : ""}</option>)}
              </Sel>
            } />
            <F lbl="Justificativa técnica" tip="Por que esta é a decisão correta para o lote? Ex.: liberado sob concessão porque o desvio de rótulo não afeta a identificação nem a segurança." ch={
              <TA rows={3} value={dispJust} onChange={e => setDispJust(e.target.value)} placeholder="Justificativa da disposição do lote..." />
            } />
            {dispMeta(dispDec)?.libera && <div style={{ fontSize: 11, color: T.text3, marginBottom: 8 }}>🔏 Liberar material não conforme exige assinatura eletrônica do RT ao registrar.</div>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              {dispForm && <button style={s.btn} onClick={() => { setDispForm(false); setDispDec(""); setDispJust(""); }}>Cancelar</button>}
              <button style={s.btnA} onClick={submitDisposicao}>{dispMeta(dispDec)?.libera ? "🔏 Assinar e registrar" : "Registrar disposição"}</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const causaBloco = () => {
    const ishi = r.ishikawa || {};
    const causas = CATS_ISHIKAWA.filter(([k]) => ishi.causes?.[k]?.length);
    const whys = (ishi.whys || []).map((w, i) => [i, w]).filter(([, w]) => w?.trim());
    if (!causas.length && !whys.length && !ishi.root) return vazio("Análise de causa ainda não registrada.");
    return (
      <div>
        {ishi.efeito && <div style={{ fontSize: 12, color: T.text2, marginBottom: 10 }}>Efeito analisado: <b style={{ color: T.text }}>{ishi.efeito}</b></div>}
        {causas.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8, marginBottom: 12 }}>
            {causas.map(([k, label]) => (
              <div key={k} style={{ background: T.surf, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 10px" }}>
                <div style={rot}>{label}</div>
                {ishi.causes[k].map((c, i) => <div key={i} style={{ fontSize: 12, marginBottom: 2 }}>• {c}</div>)}
              </div>
            ))}
          </div>
        )}
        {whys.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={rot}>5 Porquês{ishi.whyCausa ? ` — causa aprofundada: ${ishi.whyCausa}` : ""}</div>
            {whys.map(([i, w]) => <div key={i} style={{ fontSize: 13, marginBottom: 4 }}><b style={{ color: T.accent }}>{i + 1}.</b> {w}</div>)}
          </div>
        )}
        {ishi.root && <div style={{ ...caixa, background: T.accentDim, borderColor: `${T.accent}40` }}><div style={{ ...rot, color: T.accent }}>🎯 Causa raiz</div><div style={{ fontSize: 13, fontWeight: 500 }}>{ishi.root}</div></div>}
      </div>
    );
  };

  const capaBloco = () => {
    const acts = r.w2h || [];
    if (!acts.length) return vazio("Nenhuma ação CAPA registrada.");
    const cor = { "Pendente": T.yellow, "Em andamento": T.blue, "Concluída": T.accent, "Cancelada": T.red };
    return (
      <div>
        {acts.map((a, i) => {
          const vencida = a.when && past(a.when) && a.status !== "Concluída" && a.status !== "Cancelada";
          const ev = Array.isArray(a.evidencias) ? a.evidencias.length : 0;
          return (
            <div key={a.id || i} style={{ ...caixa, padding: "10px 14px", marginBottom: 8, borderColor: vencida ? `${T.red}66` : T.border }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>#{i + 1} {a.what || "(sem descrição)"}</div>
                <span style={{ fontSize: 11, fontWeight: 700, color: cor[a.status] || T.text2 }}>{a.status}</span>
              </div>
              <div style={{ fontSize: 12, color: T.text2, marginTop: 4 }}>
                {a.tipo || "Corretiva"} · {a.who || "sem responsável"} · prazo {a.when ? fmt(a.when) : "—"}{vencida ? " · ⚠ vencida" : ""} · {ev ? `${ev} evidência(s)` : "sem evidência anexada"}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const eficaciaBloco = () => {
    const ef = r.eficacia;
    if (!ef?.resultado && !ef?.criterio) return vazio("Verificação de eficácia ainda não registrada.");
    return (
      <div>
        {ef.resultado && <div style={{ marginBottom: 10 }}><Badge s={ef.resultado === "Pendente verificação" ? "Pendente verificação" : ef.resultado} /></div>}
        {ef.criterio && <div style={{ marginBottom: 10 }}><div style={rot}>Critério</div><div style={{ fontSize: 13 }}>{ef.criterio}</div></div>}
        {ef.evidencias && <div style={{ marginBottom: 10 }}><div style={rot}>Evidências</div><div style={{ fontSize: 13 }}>{ef.evidencias}</div></div>}
        {ef.anexos?.length > 0 && <div style={{ marginBottom: 10 }}><div style={rot}>Anexos</div>{ef.anexos.map((a, i) => <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: T.accent, marginRight: 10 }}>📎 {a.name}</a>)}</div>}
        {ef.obs && <div style={{ marginBottom: 10 }}><div style={rot}>Lições aprendidas</div><div style={{ fontSize: 13 }}>{ef.obs}</div></div>}
        <div style={{ fontSize: 11, color: T.text3 }}>
          {ef.data ? `Verificação em ${fmt(ef.data)}` : ""}{ef.resp ? ` · responsável: ${ef.resp}` : ""}{ef.registradoPor ? ` · registrado por ${ef.registradoPor}` : ""}
        </div>
      </div>
    );
  };

  const respostaFornecedorBloco = () => {
    const rf = r.respostaFornecedor;
    if (!rf) return null;
    const plano = rf.planoAcao || {};
    const linhasPlano = [["O quê?", plano.oQue], ["Por quê?", plano.porQue], ["Como?", plano.como], ["Quem?", plano.quem], ["Onde?", plano.onde], ["Quando?", plano.quando], ["Quanto?", plano.quanto]].filter(([, v]) => v);
    return (
      <div style={{ ...caixa, borderColor: `${T.accent}33` }}>
        <div style={{ ...rot, color: T.accent }}>🔗 Resposta do fornecedor · {rf.respondidoEm ? new Date(rf.respondidoEm).toLocaleString("pt-BR") : ""}</div>
        {rf.porques?.some(p => p?.trim()) && <div style={{ marginBottom: 8 }}>{rf.porques.filter(p => p?.trim()).map((p, i) => <div key={i} style={{ fontSize: 12, marginBottom: 2 }}><b>{i + 1}.</b> {p}</div>)}</div>}
        {rf.causaRaiz && <div style={{ fontSize: 12, marginBottom: 8 }}><b>Causa raiz:</b> {rf.causaRaiz}</div>}
        {linhasPlano.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 4, fontSize: 12, marginBottom: 8 }}>{linhasPlano.map(([k, v]) => <React.Fragment key={k}><div style={{ fontWeight: 600 }}>{k}</div><div>{v}</div></React.Fragment>)}</div>}
        {rf.observacoes && <div style={{ fontSize: 12 }}><b>Observações:</b> {rf.observacoes}</div>}
        {emTratamento && !isViewer && <div style={{ fontSize: 11, color: T.text3, marginTop: 8 }}>O botão "Usar resposta do fornecedor", nos 5 Porquês acima, copia esta análise para os campos ainda vazios.</div>}
      </div>
    );
  };

  const historicoBloco = () => !r.historico?.length ? vazio("Sem histórico.") : (
    <div style={{ borderLeft: `2px solid ${T.border2}`, paddingLeft: "1.25rem", marginLeft: ".5rem" }}>
      {[...r.historico].reverse().map((h, i) => (
        <div key={i} style={{ position: "relative", marginBottom: 10, padding: "10px 14px", background: T.surf, border: `1px solid ${h.tipo === "edicao" ? T.accent + "33" : T.border}`, borderRadius: 8 }}>
          <div style={{ position: "absolute", left: "-1.6rem", top: "1rem", width: 8, height: 8, borderRadius: "50%", background: h.tipo === "edicao" ? T.accent : h.tipo === "status" ? T.yellow : T.text3, border: `2px solid ${T.bg}` }} />
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{h.acao}</div>
            <div style={{ fontSize: 11, color: T.text3, whiteSpace: "nowrap" }}>{fmt(h.data)}{h.hora ? ` · ${h.hora}` : ""}</div>
          </div>
          <div style={{ fontSize: 11, color: T.text2 }}>por {h.resp}</div>
          {h.detalhes?.length > 0 && <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 6, marginTop: 6 }}>{h.detalhes.map((d, j) => <div key={j} style={{ fontSize: 11, color: T.text3, marginBottom: 2 }}>• {d}</div>)}</div>}
        </div>
      ))}
    </div>
  );

  const botoesEdicaoBloco = () => (
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
      <button style={s.btn} onClick={() => setEditing(false)}>Cancelar edição</button>
      <button style={s.btnA} onClick={saveEdit}>💾 Salvar alterações</button>
    </div>
  );

  const avisoEdicaoBloco = () => (
    <div style={{ background: T.accentDim, border: `1px solid ${T.accent}33`, borderRadius: 10, padding: "10px 14px", marginBottom: "1rem", fontSize: 12, color: T.accent }}>
      Modo edição — as alterações do Registro e da Contenção são salvas juntas e ficam no histórico.
    </div>
  );

  // ── Conteúdo de cada aba ─────────────────────────────────────────────────────
  const conteudo = {
    resumo: (
      <div>
        <div style={caixa}><div style={rot}>Descrição</div><CampoHistoricoLeitura valor={r.desc} /></div>
        {dadosBloco()}
        {r.contencao && <div style={{ ...caixa, borderColor: `${T.orange}40` }}><div style={{ ...rot, color: T.orange }}>⚡ Contenção</div><CampoHistoricoLeitura valor={r.contencao} compacto /></div>}
        {disposicaoBloco(false)}
        {(r.investigacao || []).length > 0 && <div style={{ marginBottom: 14 }}><div style={rot}>Investigação</div>{r.investigacao.map((reg, i) => <div key={reg.id || i} style={{ fontSize: 13, whiteSpace: "pre-wrap", marginBottom: 6 }}><span style={{ fontSize: 11, color: T.text3 }}>#{i + 1} · {reg.por}{reg.anexos?.length ? ` · ${reg.anexos.length} anexo(s)` : ""} — </span>{reg.texto}</div>)}</div>}
        <div style={{ marginBottom: 14 }}><div style={rot}>Análise de causa</div>{causaBloco()}</div>
        <div style={{ marginBottom: 14 }}><div style={rot}>Plano CAPA</div>{capaBloco()}</div>
        <div style={{ marginBottom: 14 }}><div style={rot}>Verificação de eficácia</div>{eficaciaBloco()}</div>
        {anexosBloco()}
      </div>
    ),
    registro: editing ? (
      <div>
        {avisoEdicaoBloco()}
        <div style={{ ...s.card, marginBottom: "1rem" }}>
          <SecTitle icon="📝" ch="Identificação" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
            <F lbl="Tipo" ch={<Sel value={editData.tipo} onChange={e => ed("tipo", e.target.value)}>{Object.keys(TIPOC).map(x => <option key={x}>{x}</option>)}</Sel>} />
            <F lbl="Severidade" tip="Crítica: risco à segurança do produto ou paciente. Maior: impacto significativo na qualidade. Menor: desvio leve sem impacto direto ao produto." ch={<Sel value={editData.sev} onChange={e => ed("sev", e.target.value)}>{Object.keys(SEVMETA).map(x => <option key={x}>{x}</option>)}</Sel>} />
            <F lbl="Setor" ch={<Inp value={editData.setor} onChange={e => ed("setor", e.target.value)} />} />
            <F lbl="Produto / Material" ch={<Inp value={editData.produto} onChange={e => ed("produto", e.target.value)} />} />
            <F lbl="Fornecedor" ch={<Inp value={editData.fornecedor} onChange={e => ed("fornecedor", e.target.value)} />} />
            <F lbl="Nº do lote" ch={<Inp value={editData.lote} onChange={e => ed("lote", e.target.value)} />} />
            <F lbl="Nº da Nota Fiscal" ch={<Inp value={editData.nf} onChange={e => ed("nf", e.target.value)} />} />
            <F lbl="Quantidade afetada" ch={<Inp value={editData.qtd} onChange={e => ed("qtd", e.target.value)} />} />
            <F lbl="Referência normativa" ch={<Inp value={editData.ref} onChange={e => ed("ref", e.target.value)} />} />
          </div>
          <F lbl="Evidências" ch={<Inp value={editData.evidencia} onChange={e => ed("evidencia", e.target.value)} />} />
        </div>
        <div style={{ ...s.card, marginBottom: "1rem" }}>
          <SecTitle icon="📋" ch="Descrição" />
          <F lbl="Descrição da não conformidade" ch={<CampoHistoricoEdicao valorSalvo={r.desc} adicao={addDesc} setAdicao={setAddDesc} rows={4} placeholder="Ex.: reinspeção do lote confirmou 3% das unidades fora do padrão." />} />
        </div>
        <div style={{ ...s.card, marginBottom: "1rem" }}>
          <SecTitle icon="🗓️" ch="Responsável e prazos" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
            <F lbl="Responsável análise" ch={<Inp value={editData.resp} onChange={e => ed("resp", e.target.value)} />} />
            <F lbl="Prazo análise de causa" ch={<Inp type="date" value={editData.prazoCausa} onChange={e => ed("prazoCausa", e.target.value)} />} />
            <F lbl="Prazo ação corretiva" ch={<Inp type="date" value={editData.prazoAC} onChange={e => ed("prazoAC", e.target.value)} />} />
            <F lbl="Prazo eficácia" ch={<Inp type="date" value={editData.prazoEfic} onChange={e => ed("prazoEfic", e.target.value)} />} />
          </div>
        </div>
        {botoesEdicaoBloco()}
      </div>
    ) : (
      <div>
        <div style={caixa}><div style={rot}>Descrição</div><CampoHistoricoLeitura valor={r.desc} /></div>
        {dadosBloco()}
        {anexosBloco()}
        {canEdit && <div style={{ textAlign: "right" }}><button style={s.btnA} onClick={() => startEdit()}>✏️ Editar registro</button></div>}
      </div>
    ),
    contencao: (
      <div>
        {editing ? (
          <div style={{ ...s.card, marginBottom: "1rem" }}>
            {avisoEdicaoBloco()}
            <SecTitle icon="⚡" ch="Ação de contenção" />
            <F lbl="Ação realizada" tip="Ação imediata de contenção já executada. Ex: lote bloqueado e segregado na quarentena." ch={<CampoHistoricoEdicao valorSalvo={r.contencao} adicao={addCont} setAdicao={setAddCont} rows={3} placeholder="Ex.: lote transferido da quarentena para área de segregação definitiva." />} />
            <F lbl="Responsável pela contenção" ch={<Inp value={editData.respCont} onChange={e => ed("respCont", e.target.value)} />} />
            {botoesEdicaoBloco()}
          </div>
        ) : (
          <div style={caixa}>
            <div style={{ ...rot, color: T.orange }}>⚡ Ação de contenção{r.respCont ? ` · ${r.respCont}` : ""}</div>
            {r.contencao ? <CampoHistoricoLeitura valor={r.contencao} compacto /> : vazio("Nenhuma ação de contenção registrada.")}
            {canEdit && <div style={{ textAlign: "right", marginTop: 10 }}><button style={s.btn} onClick={() => startEdit()}>{r.contencao ? "Acrescentar à contenção" : "Registrar contenção"}</button></div>}
          </div>
        )}
        {disposicaoBloco(!isViewer)}
      </div>
    ),
    causa: (!isViewer && emTratamento) ? (
      <div>
        <Investigacao r={r} user={user} toast_={toast_} gravar={gravar} podeRegistrar />
        <AnaliseCausaEditor key={r.id} r={r} user={user} toast_={toast_} openEmail={openEmail} gravar={gravar} />
        <div style={{ marginTop: 16 }}>{respostaFornecedorBloco()}</div>
      </div>
    ) : (
      <div>
        <Investigacao r={r} user={user} toast_={toast_} gravar={gravar} podeRegistrar={false} />
        {causaBloco()}
        {respostaFornecedorBloco()}
      </div>
    ),
    capa: (!isViewer && emTratamento && etapas.find(e => e.id === "capa")?.estado !== "bloqueada")
      ? <PlanoCapaEditor key={r.id} r={r} user={user} toast_={toast_} openEmail={openEmail} gravar={gravar} />
      : capaBloco(),
    eficacia: (!isViewer && emTratamento)
      ? <EficaciaEditor key={r.id} r={r} user={user} toast_={toast_} openEmail={openEmail} gravar={gravar} />
      : eficaciaBloco(),
    historico: historicoBloco(),
  };

  const estadoDe = id => etapas.find(e => e.id === id);
  const abas = [
    { id: "resumo", label: "Resumo" },
    ...ETAPAS.map((e, i) => ({ ...estadoDe(e.id), id: e.id, label: `${i + 1} ${e.label}` })),
    { id: "historico", label: `Histórico (${(r.historico || []).length})` },
  ];
  const abaAtual = abas.find(a => a.id === etapa) || abas[0];
  const bloqueio = abaAtual.estado === "bloqueada" || abaAtual.estado === "dispensada" ? abaAtual.motivo : null;

  const prazoLinha = (label, d, ativo = true) => {
    const vencido = d && past(d) && ativo && rncAtiva(r.status);
    return <div><div style={rot}>{label}</div><div style={{ fontSize: 13, color: vencido ? T.red : T.text, fontWeight: vencido ? 600 : 400 }}>{d ? fmt(d) : "—"}{vencido ? " · vencido" : ""}</div></div>;
  };

  return (
    <div>
      <style>{`
        .ficha-grid{display:grid;grid-template-columns:minmax(0,1fr) 270px;gap:16px;align-items:start}
        @media(max-width:960px){.ficha-grid{grid-template-columns:minmax(0,1fr)}}
        .ficha-aba:hover{color:${T.text}!important}
      `}</style>

      {/* Cabeçalho */}
      <button onClick={() => setTab("lista")} style={{ background: "none", border: "none", color: T.text2, cursor: "pointer", fontFamily: "inherit", fontSize: 12, padding: 0, marginBottom: 8 }}>← Registros de Não Conformidades</button>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{r.num}</div>
          <div style={{ fontSize: 12, color: T.text2, marginTop: 2 }}>{r.tipo} · aberta em {fmt(r.data)} por {r.detector || r.criadoPor || "—"}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <SevB s={r.sev} /><Badge s={r.status} />
        </div>
      </div>

      {/* Abas = etapas */}
      <div role="tablist" style={{ display: "flex", gap: 2, borderBottom: `1px solid ${T.border2}`, overflowX: "auto", marginBottom: 16 }}>
        {abas.map(a => {
          const ativa = a.id === abaAtual.id;
          const cor = a.estado === "concluida" ? T.accent : a.estado === "bloqueada" || a.estado === "dispensada" ? T.text3 : ativa ? T.text : T.text2;
          return (
            <button key={a.id} role="tab" aria-selected={ativa} className="ficha-aba" title={a.motivo || ""} onClick={() => setEtapa(a.id)}
              style={{ background: "none", border: "none", borderBottom: `2px solid ${ativa ? T.accent : "transparent"}`, padding: "10px 12px", cursor: "pointer", fontFamily: "inherit", fontSize: 13, whiteSpace: "nowrap", color: cor, fontWeight: ativa ? 600 : 400, marginBottom: -1 }}>
              {ICONE_ESTADO[a.estado] ? `${ICONE_ESTADO[a.estado]} ` : ""}{a.label}{a.estado === "atual" ? " •" : ""}
            </button>
          );
        })}
      </div>

      <div className="ficha-grid">
        <div style={{ minWidth: 0 }}>
          {bloqueio && <div style={{ fontSize: 12, color: T.text2, background: T.surf, border: `1px dashed ${T.border2}`, borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>🔒 {bloqueio}</div>}
          {!emTratamento && ["causa", "capa", "eficacia"].includes(abaAtual.id) && (
            <div style={{ fontSize: 12, color: T.text2, marginBottom: 12 }}>RNC encerrada — registro fechado, somente leitura.</div>
          )}
          {conteudo[abaAtual.id]}
        </div>

        {/* Painel lateral: o que se consulta enquanto se preenche */}
        <aside style={{ ...s.card, display: "flex", flexDirection: "column", gap: 12, fontSize: 13 }}>
          <div><div style={rot}>Responsável</div><div>{r.resp || "—"}</div></div>
          {r.setor && <div><div style={rot}>Setor</div><div>{r.setor}</div></div>}
          {(r.produto || r.lote) && <div><div style={rot}>Produto · lote</div><div>{[r.produto, r.lote].filter(Boolean).join(" · ")}</div></div>}
          {r.fornecedor && <div><div style={rot}>Fornecedor</div><div>{r.fornecedor}{r.nf ? ` · NF ${r.nf}` : ""}</div></div>}
          {prazoLinha("Prazo análise de causa", r.prazoCausa, porquesPreenchidos(r) < 3)}
          {prazoLinha("Prazo ação corretiva", r.prazoAC)}
          {prazoLinha("Prazo eficácia", r.prazoEfic)}

          <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
            <div style={rot}>Assinaturas</div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>{r.assinaturaElaborador ? `✅ Elaborador: ${r.assinaturaElaborador.nome}` : "Elaborador: não assinada"}</div>
            {r.assinaturaRT ? (
              <div style={{ fontSize: 12 }}>
                ✅ RT: {r.assinaturaRT.nome}{r.assinaturaRT.cargo ? ` · ${r.assinaturaRT.cargo}` : ""}
                <div style={{ fontSize: 10, color: T.text3 }}>{r.assinaturaRT.timestamp ? new Date(r.assinaturaRT.timestamp).toLocaleString("pt-BR") : r.assinaturaRT.dataHora} · Cód. {sigCodigo(r.assinaturaRT, `RNC|${r.num || r.id || ""}`)}</div>
              </div>
            ) : r.sev === "Crítica" ? (
              podeRT ? <button onClick={assinarRT} style={{ ...s.btnA, fontSize: 11, padding: "5px 10px" }}>✍️ Aprovar como RT</button>
                : <div style={{ fontSize: 12, color: T.yellow }}>⏳ Aguardando aprovação do RT</div>
            ) : null}
          </div>

          {!isViewer && emTratamento && (
            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
              <div style={rot}>Status</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {Object.keys(SMETA).filter(st => !rncEncerrada(st)).map(st => (
                  <button key={st} onClick={() => st !== r.status && updStatus(st)} style={{ padding: "4px 10px", borderRadius: 20, border: `1px solid ${r.status === st ? SMETA[st].c + "55" : T.border}`, background: r.status === st ? SMETA[st].bg : T.surf, color: r.status === st ? SMETA[st].c : T.text2, cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600 }}>{st}</button>
                ))}
              </div>
              <div style={{ fontSize: 10, color: T.text3, marginTop: 6, lineHeight: 1.5 }}>Eficaz e Ineficaz só pela etapa 5; Encerrada, pela disposição do material.</div>
            </div>
          )}

          <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
            <button style={s.btn} onClick={() => exportRNCPDF(r)}>📄 Exportar/Imprimir PDF</button>
            {!isViewer && <button style={s.btn} onClick={() => openEmail(r, "manual")}>✉️ Notificar</button>}
            {!isViewer && r.fornecedor && <button style={s.btn} onClick={formularioFornecedor}>📋 Formulário p/ fornecedor</button>}
            {!r.assinaturaElaborador && (isAdmin || r.criadoPor === user.name) && <button style={s.btn} onClick={() => setAssinaturaModal(true)}>✍️ Assinar como elaborador</button>}
            {(isAdmin || (perm && perm("excluirRNC"))) && <button style={s.btnD} onClick={excluir}>🗑️ Excluir</button>}
          </div>
        </aside>
      </div>

      {assinaturaModal && (
        <AssinaturaModal
          user={user}
          titulo={`RNC ${r.num} — assinatura do elaborador`}
          contexto={`RNC|${r.num || r.id || ""}`}
          papel="Elaborador"
          onClose={() => setAssinaturaModal(false)}
          onConfirm={async (ass) => {
            const h = { data: tod(), hora: agoraHora(), acao: "Assinatura do elaborador registrada", resp: user.name, tipo: "assinatura" };
            await gravar({ assinaturaElaborador: ass, historico: [...(r.historico || []), h] });
            setAssinaturaModal(false);
            toast_("Assinatura do elaborador registrada na RNC.", "green");
          }}
        />
      )}
      {dispSign && (
        <AssinaturaModal
          user={user}
          titulo={`RNC ${r.num} — disposição: ${dispMeta(dispSign.decisao)?.label}`}
          contexto={`RNC-DISP|${r.num || r.id || ""}`}
          papel="Responsavel Tecnico"
          onClose={() => setDispSign(null)}
          onConfirm={async (ass) => { await gravarDisposicao(dispSign.decisao, dispSign.justificativa, ass); setDispSign(null); }}
        />
      )}
    </div>
  );
}

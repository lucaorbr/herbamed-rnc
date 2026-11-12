import React, { useEffect, useState } from "react";
import { abrirAnexo } from "../../shared/abrirArquivo";
import { useTheme } from "../../core/theme";
import { fmt, tod } from "../../core/utils";
import { useS } from "../../shared/styles";
import { AnexosUpload } from "../../shared/AnexosUpload";
import { F, Inp, SecTitle, Sel, TA } from "../../shared/ui";
import {
  RESULTADOS_VERIFICACAO, complementoAberto, patchAceitarResposta, patchConverterEmInterna, patchEncerrarExterna,
  patchPedirComplemento, patchPlanilhaRespondida, respostaAtrasada, temRespostaValida, travaEncerramentoExterna, ultimaRespostaEm,
} from "./tipoRncLogic";

// Etapas 3 e 4 da RNC EXTERNA (v3.29.0). O fornecedor faz a análise de causa e o plano;
// a Qualidade cobra, avalia a resposta e verifica no recebimento seguinte.

const quando = iso => { try { return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); } catch { return iso || ""; } };
const agora = () => ({ iso: new Date().toISOString(), data: tod(), hora: new Date().toLocaleTimeString("pt-BR") });

function linkAnexo(a, j, T) {
  return <a key={j} href={a.url} onClick={e => abrirAnexo(e, a)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: T.accent, marginRight: 10 }}>📎 {a.name}</a>;
}

/** Uma resposta pelo link público (atual ou arquivada). */
export function RespostaLink({ rf, titulo, compacta }) {
  const T = useTheme();
  const plano = rf?.planoAcao || {};
  const linhas = [["O quê?", plano.oQue], ["Por quê?", plano.porQue], ["Como?", plano.como], ["Quem?", plano.quem], ["Onde?", plano.onde], ["Quando?", plano.quando ? fmt(plano.quando) : ""], ["Quanto?", plano.quanto]].filter(([, v]) => v);
  const rot = { fontSize: 10, color: T.text3, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 4 };
  return (
    <div style={{ background: T.surf, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px", marginBottom: 8, opacity: compacta ? .8 : 1 }}>
      <div style={rot}>{titulo} · {quando(rf?.respondidoEm)}</div>
      {rf?.porques?.some(p => p?.trim()) && <div style={{ marginBottom: 6 }}>{rf.porques.filter(p => p?.trim()).map((p, i) => <div key={i} style={{ fontSize: 12, marginBottom: 2 }}><b>{i + 1}.</b> {p}</div>)}</div>}
      {rf?.causaRaiz && <div style={{ fontSize: 13, marginBottom: 6 }}><b>Causa raiz:</b> {rf.causaRaiz}</div>}
      {linhas.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 3, fontSize: 12, marginBottom: 6 }}>{linhas.map(([k, v]) => <React.Fragment key={k}><div style={{ fontWeight: 600 }}>{k}</div><div>{v}</div></React.Fragment>)}</div>}
      {rf?.observacoes && <div style={{ fontSize: 12 }}><b>Observações:</b> {rf.observacoes}</div>}
    </div>
  );
}

/** Etapa 3 — Resposta do fornecedor. */
export function RespostaFornecedorEtapa({ r, user, toast_, gravar, podeAgir, openEmail, formularioFornecedor }) {
  const T = useTheme(); const s = useS();
  const [links, setLinks] = useState(null);
  const [planilha, setPlanilha] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const hoje = tod();

  useEffect(() => {
    let vivo = true;
    fetch(`/api/rnc-supplier/por-rnc/${encodeURIComponent(r.id)}`, { credentials: "include" })
      .then(x => x.ok ? x.json() : [])
      .then(l => { if (vivo) setLinks(Array.isArray(l) ? l : []); })
      .catch(() => { if (vivo) setLinks([]); });
    return () => { vivo = false; };
  }, [r.id, r.respostaFornecedor?.respondidoEm]);

  const anexarPlanilha = async () => {
    const a = agora();
    const { patch, erro } = patchPlanilhaRespondida(r, planilha, user.name, a.iso, a.data, a.hora);
    if (erro) { alert(erro); return; }
    setSalvando(true);
    try { await gravar(patch); setPlanilha([]); toast_("Planilha respondida anexada.", "green"); } catch { /* já avisado */ }
    setSalvando(false);
  };

  const atrasada = respostaAtrasada(r, hoje);
  const aguardando = !temRespostaValida(r);
  const rot = { fontSize: 10, color: T.text3, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 };

  return (
    <div>
      <div style={{ ...s.card, marginBottom: 14, borderColor: atrasada ? `${T.red}66` : T.border }}>
        <SecTitle icon="⏳" ch="Situação" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, fontSize: 13 }}>
          <div><div style={rot}>Prazo de resposta</div><span style={{ color: atrasada ? T.red : T.text, fontWeight: atrasada ? 700 : 400 }}>{r.prazoRespostaFornecedor ? fmt(r.prazoRespostaFornecedor) : "—"}{atrasada ? " · vencido" : ""}</span></div>
          <div><div style={rot}>Situação</div>{aguardando ? (complementoAberto(r) ? "Aguardando complemento" : "Aguardando resposta") : `Respondida em ${quando(ultimaRespostaEm(r))}`}</div>
          <div><div style={rot}>Avaliação</div>{r.avaliacaoFornecedor?.resultado === "aceita" ? `Aceita por ${r.avaliacaoFornecedor.por}` : "—"}</div>
        </div>
        {complementoAberto(r) && (
          <div style={{ fontSize: 12, background: `${T.yellow}14`, border: `1px solid ${T.yellow}44`, borderRadius: 8, padding: "8px 12px", marginTop: 10 }}>
            Complemento pedido em {quando(r.complementoFornecedor.pedidoEm)} por {r.complementoFornecedor.pedidoPor}: {r.complementoFornecedor.motivo}
          </div>
        )}
        {podeAgir && aguardando && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          <button style={s.btn} onClick={() => openEmail(r, "manual")}>✉️ {atrasada ? "Cobrar fornecedor" : "Enviar link ao fornecedor"}</button>
        </div>}
      </div>

      <div style={{ ...s.card, marginBottom: 14 }}>
        <SecTitle icon="🔗" ch="Pelo link público" />
        {links === null ? <div style={{ fontSize: 12, color: T.text3 }}>Carregando…</div>
          : !links.length ? <div style={{ fontSize: 12, color: T.text3 }}>Nenhum link gerado. Use "Enviar link ao fornecedor": o link vai no e-mail.</div>
          : links.map(l => (
            <div key={l.token} style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", fontSize: 12, padding: "6px 0", borderBottom: `1px dashed ${T.border}` }}>
              <span>Gerado em {quando(l.criado_em)} por {l.criado_por || "—"} · válido até {fmt(String(l.expires_at).slice(0, 10))}</span>
              <span style={{ color: l.respondido_em ? T.accent : T.text3 }}>{l.respondido_em ? `respondido em ${quando(l.respondido_em)}` : "sem resposta"}</span>
            </div>
          ))}
        {r.respostaFornecedor && <div style={{ marginTop: 10 }}><RespostaLink rf={r.respostaFornecedor} titulo="Resposta atual" /></div>}
        {(r.respostasFornecedorAnteriores || []).length > 0 && (
          <details style={{ marginTop: 6 }}><summary style={{ fontSize: 12, color: T.text2, cursor: "pointer" }}>Respostas anteriores ({r.respostasFornecedorAnteriores.length})</summary>
            <div style={{ marginTop: 8 }}>{[...r.respostasFornecedorAnteriores].reverse().map((rf, i) => <RespostaLink key={i} rf={rf} titulo="Resposta substituída" compacta />)}</div>
          </details>
        )}
      </div>

      <div style={{ ...s.card, marginBottom: 14 }}>
        <SecTitle icon="📗" ch="Pela planilha" />
        <div style={{ fontSize: 12, color: T.text2, marginBottom: 8 }}>Para fornecedor que prefere responder por e-mail: gere a planilha preenchida, envie e anexe aqui a que voltar.</div>
        {(r.respostasPlanilha || []).map((p, i) => (
          <div key={p.id || i} style={{ fontSize: 12, padding: "6px 0", borderBottom: `1px dashed ${T.border}` }}>
            <span style={{ color: T.text3 }}>Anexada em {quando(p.em)} por {p.por} — </span>{(p.anexos || []).map((a, j) => linkAnexo(a, j, T))}
          </div>
        ))}
        {podeAgir && (
          <div style={{ marginTop: 10 }}>
            <button style={{ ...s.btn, marginBottom: 10 }} onClick={formularioFornecedor}>📋 Gerar planilha para o fornecedor</button>
            <AnexosUpload inputId={`planilha-forn-${r.id}`} anexos={planilha} setAnexos={n => setPlanilha(prev => typeof n === "function" ? n(prev) : n)} />
            {planilha.length > 0 && <div style={{ textAlign: "right", marginTop: 8 }}><button style={{ ...s.btnA, opacity: salvando ? .6 : 1 }} disabled={salvando} onClick={anexarPlanilha}>📎 Anexar como resposta do fornecedor</button></div>}
          </div>
        )}
      </div>
    </div>
  );
}

/** Etapa 4 — Avaliação da resposta e encerramento pela verificação no recebimento seguinte. */
export function AvaliacaoExternaEtapa({ r, user, toast_, gravar, podeAgir, ativa }) {
  const T = useTheme(); const s = useS();
  const [obs, setObs] = useState("");
  const [modo, setModo] = useState(null); // "complemento" | "interna"
  const [motivo, setMotivo] = useState("");
  const [v, setV] = useState({ lote: "", data: tod(), resultado: "", obs: "", anexos: [] });
  const [confirmar, setConfirmar] = useState(false);
  const temResp = temRespostaValida(r);
  const aceita = r.avaliacaoFornecedor?.resultado === "aceita";

  const aplicar = async (res, msg) => {
    if (res.erro) { alert(res.erro); return; }
    try { await gravar(res.patch); toast_(msg, "green"); setModo(null); setMotivo(""); setObs(""); } catch { /* já avisado */ }
  };
  const a = () => agora();

  const encerrar = async () => {
    const t = travaEncerramentoExterna(r, v);
    if (!t.ok) { alert(t.motivos.join("\n")); setConfirmar(false); return; }
    const x = a();
    const res = patchEncerrarExterna(r, v, user.name, x.iso, x.data, x.hora);
    await aplicar(res, `RNC encerrada como ${res.patch?.status}.`);
    setConfirmar(false);
  };

  if (!ativa) {
    const vr = r.verificacaoRecebimento;
    return (
      <div style={s.card}>
        <SecTitle icon="✅" ch="Avaliação e encerramento" />
        <div style={{ fontSize: 13 }}>{aceita ? `Resposta aceita por ${r.avaliacaoFornecedor.por} em ${quando(r.avaliacaoFornecedor.em)}.` : "Resposta não avaliada."}</div>
        {vr ? <div style={{ fontSize: 13, marginTop: 8 }}>Recebimento seguinte: <b>{vr.resultado}</b> em {fmt(vr.data)}{vr.lote ? ` · lote ${vr.lote}` : ""}{vr.obs ? ` — ${vr.obs}` : ""} · registrado por {vr.por}</div> : null}
        {vr?.anexos?.length > 0 && <div style={{ marginTop: 6 }}>{vr.anexos.map((an, j) => linkAnexo(an, j, T))}</div>}
      </div>
    );
  }

  return (
    <div>
      <div style={{ ...s.card, marginBottom: 14 }}>
        <SecTitle icon="🧐" ch="Avaliar a resposta do fornecedor" />
        {!temResp ? <div style={{ fontSize: 12, color: T.text3 }}>Aguardando a resposta do fornecedor (etapa 3).</div>
          : aceita ? <div style={{ fontSize: 13 }}>✅ Aceita por {r.avaliacaoFornecedor.por} em {quando(r.avaliacaoFornecedor.em)}{r.avaliacaoFornecedor.obs ? ` — ${r.avaliacaoFornecedor.obs}` : ""}</div>
          : podeAgir && (
            <>
              <F lbl="Observação (opcional)" ch={<Inp value={obs} onChange={e => setObs(e.target.value)} placeholder="Ex.: plano de ação adequado; secagem do lote revista." />} />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={s.btnA} onClick={() => { const x = a(); aplicar(patchAceitarResposta(r, obs, user.name, x.iso, x.data, x.hora), "Resposta do fornecedor aceita."); }}>✅ Aceitar resposta</button>
                <button style={s.btn} onClick={() => setModo("complemento")}>↩️ Pedir complemento</button>
              </div>
            </>
          )}
        {podeAgir && temResp && aceita && <div style={{ marginTop: 8 }}><button style={{ ...s.btn, fontSize: 11 }} onClick={() => setModo("complemento")}>↩️ Pedir complemento mesmo assim</button></div>}
        {podeAgir && <div style={{ marginTop: 10 }}><button style={{ ...s.btn, fontSize: 11 }} onClick={() => setModo("interna")}>⇄ A causa é nossa: converter em interna</button></div>}

        {modo && (
          <div style={{ marginTop: 12, borderTop: `1px dashed ${T.border2}`, paddingTop: 10 }}>
            <F lbl={modo === "complemento" ? "O que falta na resposta? (o fornecedor vê este texto no link)" : "Por que a causa é interna?"} ch={
              <TA rows={3} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder={modo === "complemento" ? "Ex.: enviar o laudo de umidade do lote e a evidência da ação no secador." : "Ex.: a umidade subiu na nossa armazenagem; o laudo do fornecedor estava conforme."} />
            } />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button style={s.btn} onClick={() => { setModo(null); setMotivo(""); }}>Cancelar</button>
              <button style={s.btnA} onClick={() => {
                const x = a();
                if (modo === "complemento") aplicar(patchPedirComplemento(r, motivo, user.name, x.iso, x.data, x.hora), "Complemento pedido. O mesmo link do fornecedor volta a aceitar resposta.");
                else aplicar(patchConverterEmInterna(r, motivo, user.name, x.data, x.hora), "RNC convertida em interna. As etapas da Herbamed foram liberadas.");
              }}>{modo === "complemento" ? "Pedir complemento" : "Converter em interna"}</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ ...s.card, marginBottom: 14, opacity: aceita ? 1 : .6 }}>
        <SecTitle icon="📦" ch="Verificação no recebimento seguinte" />
        <div style={{ fontSize: 12, color: T.text3, marginBottom: 10 }}>Encerra a RNC: recebimento conforme fecha como Eficaz; não conforme, como Ineficaz.</div>
        {podeAgir && aceita ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12 }}>
              <F lbl="Lote verificado" ch={<Inp value={v.lote} onChange={e => setV(p => ({ ...p, lote: e.target.value }))} placeholder="Lote do novo recebimento" />} />
              <F lbl="Data da verificação *" ch={<Inp type="date" value={v.data} onChange={e => setV(p => ({ ...p, data: e.target.value }))} />} />
              <F lbl="Resultado *" ch={<Sel value={v.resultado} onChange={e => setV(p => ({ ...p, resultado: e.target.value }))}><option value="">— Selecione —</option>{RESULTADOS_VERIFICACAO.map(x => <option key={x}>{x}</option>)}</Sel>} />
            </div>
            <F lbl="Observação" ch={<Inp value={v.obs} onChange={e => setV(p => ({ ...p, obs: e.target.value }))} placeholder="Ex.: umidade 4,1% no RA-2026-340." />} />
            <AnexosUpload inputId={`verif-${r.id}`} anexos={v.anexos} setAnexos={n => setV(p => ({ ...p, anexos: typeof n === "function" ? n(p.anexos) : n }))} />
            <div style={{ textAlign: "right", marginTop: 10 }}>
              {!confirmar
                ? <button style={s.btnA} onClick={() => setConfirmar(true)}>Encerrar RNC</button>
                : <span style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <span style={{ fontSize: 12, color: T.text2 }}>Encerrar como {v.resultado === "Não conforme" ? "Ineficaz" : "Eficaz"}? Depois disso a RNC fica só para leitura.</span>
                    <button style={s.btn} onClick={() => setConfirmar(false)}>Voltar</button>
                    <button style={s.btnA} onClick={encerrar}>Confirmar</button>
                  </span>}
            </div>
          </>
        ) : <div style={{ fontSize: 12, color: T.text3 }}>{aceita ? "Sem permissão para encerrar." : "Libera depois que a resposta do fornecedor for aceita."}</div>}
      </div>
    </div>
  );
}

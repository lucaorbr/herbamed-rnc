import React, { useEffect, useState } from "react";
import { useTheme } from "../../core/theme";
import { fmt, tod } from "../../core/utils";
import { incrementSacCounter } from "../../firebase";
import { useS } from "../../shared/styles";
import { F, G2, G3, Inp, MaskedInp, SecTitle, Sel, TA } from "../../shared/ui";
import { CampoHistoricoEdicao, CampoHistoricoLeitura } from "../../shared/CampoHistorico";
import { acrescentarAoCampo, campoVazio, resumoAcrescimo } from "../../shared/campoHistoricoLogic";
import { AnexosUpload } from "../../shared/AnexosUpload";
import { Table } from "../../shared/Table";
import {
  CANAIS_SAC, CLASSIFICACOES_SAC, SETORES_SAC, SETOR_QUALIDADE, SOLUCOES_SAC, SOLUCOES_COM_ENDERECO, STATUS_SAC,
  SAC_SMETA, META_RESPOSTA_DIAS, LIMITE_RECORRENCIA_LOTE,
  classificacaoSac, finalizado, comAndamento, prazoSac, contagemPorLote, mesmoLote, normLote, relatouReacao,
  mascaraDoc, mascaraCep, faltasEndereco, enderecoTexto,
  novoEncaminhamento, comRetorno, retornosPendentes, exigeAvaliacao, podeFinalizarNaRecepcao,
  errosDoRegistro, errosDoEncerramento, avisosDoEncerramento, novaResposta, descParaRNC, entradaHistorico,
  RESULTADOS_AVALIACAO, etapaAmostra, errosDaAvaliacao, novaAvaliacao,
} from "./sacLogic";
import { exportCartaPDF, exportSacPDF } from "./sacPdf";
import { SacIndicadores } from "./SacIndicadores";

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const agoraHora = () => new Date().toTimeString().slice(0, 5);

export function SacTab({ view = "lista", ...props }) {
  if (view === "novo") return <NovoSacForm {...props} />;
  if (view === "indicadores") return <SacIndicadores atendimentos={props.atendimentos} />;
  return <SacLista {...props} />;
}

function SacBadge({ status }) {
  const m = SAC_SMETA[status] || SAC_SMETA[STATUS_SAC.ABERTO];
  return <span title={m.dica} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, textTransform: "uppercase", background: m.bg, color: m.c, whiteSpace: "nowrap" }}>
    <span style={{ width: 5, height: 5, borderRadius: "50%", background: m.c, display: "inline-block" }} />{status}
  </span>;
}

function TipoChip({ c }) {
  const T = useTheme();
  if (!c) return <span style={{ fontSize: 11, color: T.text3 }}>—</span>;
  const cor = c === "Reação adversa" ? T.red : c === "Reclamação" ? "#ff8c42" : T.text2;
  return <span style={{ fontSize: 11, fontWeight: 700, color: cor, whiteSpace: "nowrap" }}>{c}</span>;
}

function PrazoChip({ a }) {
  const T = useTheme();
  const p = prazoSac(a);
  if (!p) return <span style={{ color: T.text3 }}>—</span>;
  const cor = p.dias > META_RESPOSTA_DIAS * 2 ? T.red : p.atrasado ? T.yellow : T.text2;
  return <span title={`Aberto há ${p.dias} dia(s) — meta de resposta: ${META_RESPOSTA_DIAS} dias`} style={{ fontSize: 11, fontWeight: 700, color: cor, whiteSpace: "nowrap" }}>
    {p.atrasado && "⚠️ "}{p.dias}d{p.atrasado ? " · atrasado" : ""}
  </span>;
}

// ── Lista ──
function SacLista({ user, toast_, setTab, atendimentos = [], rncs = [], doSaveSac, doDeleteSac, perm, isAdmin, setRncPrefill, abrirRnc }) {
  const T = useTheme(); const s = useS();
  const [busca, setBusca] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fTipo, setFTipo] = useState("");
  const [fSetor, setFSetor] = useState("");
  const [selId, setSelId] = useState(null);
  const [selLocal, setSelLocal] = useState(null);

  // Cópia local do aberto: a lista só relê o servidor a cada 5 s, e quem acabou de
  // gravar precisa ver o resultado na hora. A leitura seguinte assume de novo.
  const daLista = atendimentos.find(a => a.id === selId) || null;
  const sel = selLocal && daLista && (daLista.historico || []).length < (selLocal.historico || []).length ? selLocal : (daLista || selLocal);
  useEffect(() => { if (!selId) setSelLocal(null); }, [selId]);

  const porLote = contagemPorLote(atendimentos);

  const filtrados = atendimentos
    .filter(a => !fStatus || a.status === fStatus)
    .filter(a => !fTipo || a.classificacao === fTipo)
    .filter(a => !fSetor || (a.encaminhamentos || []).some(e => e.setor === fSetor))
    .filter(a => {
      if (!busca.trim()) return true;
      const q = busca.toLowerCase();
      return [a.num, a.consumidorNome, a.consumidorDoc, a.produto, a.lote, a.nf, a.relato, a.consumidorTelefone, a.consumidorEmail]
        .some(x => String(x || "").toLowerCase().includes(q));
    });

  const abertos = atendimentos.filter(a => !finalizado(a));
  const kpis = [
    { l: "Em aberto", n: atendimentos.filter(a => a.status === STATUS_SAC.ABERTO).length, c: SAC_SMETA["Em aberto"].c },
    { l: "Em andamento", n: atendimentos.filter(a => a.status === STATUS_SAC.ANDAMENTO).length, c: SAC_SMETA["Em andamento"].c },
    { l: `Atrasados (> ${META_RESPOSTA_DIAS} dias)`, n: abertos.filter(a => prazoSac(a)?.atrasado).length, c: "#ff8c42" },
    { l: "Reação relatada, em aberto", n: abertos.filter(relatouReacao).length, c: "#ff4f6a" },
  ];

  const colunas = [
    { key: "num", label: "Nº", render: a => <span style={{ fontWeight: 700, color: T.accent }}>{relatouReacao(a) && <span title="Cliente relatou reação">🚨 </span>}{a.num}</span> },
    { key: "dataContato", label: "Data", render: a => <span style={{ whiteSpace: "nowrap" }}>{fmt(a.dataContato)}{a.horaContato ? ` ${a.horaContato}` : ""}</span> },
    { key: "consumidorNome", label: "Cliente" },
    { key: "produto", label: "Suplemento", maxWidth: 180 },
    { key: "lote", label: "Lote", render: a => {
      const n = porLote.get(normLote(a.lote)) || 0;
      return <span>{a.lote || "—"}{n > 1 && <span title={`${n} atendimentos citam este lote`} style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, color: n >= LIMITE_RECORRENCIA_LOTE ? "#ff4f6a" : "#ff8c42" }}>×{n}</span>}</span>;
    } },
    { key: "classificacao", label: "Tipo", render: a => <TipoChip c={a.classificacao} /> },
    { key: "setor", label: "Encaminhado", sortable: false, render: a => {
      const setores = [...new Set((a.encaminhamentos || []).map(e => e.setor))];
      return setores.length ? <span style={{ fontSize: 11 }}>{setores.join(", ")}{retornosPendentes(a).length > 0 && <span title="Aguardando retorno do setor" style={{ color: "#ff8c42" }}> ⏳</span>}</span> : <span style={{ color: T.text3 }}>—</span>;
    } },
    { key: "status", label: "Status", render: a => <SacBadge status={a.status} /> },
    { key: "prazo", label: "Dias", sortable: false, render: a => <PrazoChip a={a} /> },
  ];

  const salvar = async (upd, msg) => {
    try {
      await doSaveSac(upd);
      setSelLocal(upd);
      if (msg) toast_(msg, "green");
      return true;
    } catch (e) {
      toast_(`Não foi possível gravar: ${e.message}`, "red");
      return false;
    }
  };

  const abrirRncDoSac = (a) => {
    setRncPrefill({
      produto: a.produto || "",
      lote: a.lote || "",
      nf: a.nf || "",
      tipo: "Produto acabado",
      setor: "SAC",
      detector: `${a.registradoPor || ""} — atendimento ${a.num}`,
      sev: a.classificacao === "Reação adversa" ? "Crítica" : "Maior",
      desc: descParaRNC(a),
      origemSacDoc: a,
    });
    setSelId(null);
    setTab("nova");
    toast_("Abrindo RNC com os dados do atendimento...", "green");
  };

  const excluir = async (a) => {
    if (!window.confirm(`Excluir o atendimento ${a.num}? Use só para registro duplicado ou feito por engano.`)) return;
    try {
      await doDeleteSac(a.id);
      setSelId(null);
      toast_(`${a.num} excluído.`, "green");
    } catch (e) { toast_(`Não foi possível excluir: ${e.message}`, "red"); }
  };

  return (
    <div>
      <div className="kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
        {kpis.map(({ l, n, c }) => (
          <div key={l} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: n ? c : T.text3 }}>{n}</div>
            <div style={{ fontSize: 11, color: T.text2, fontWeight: 500 }}>{l}</div>
          </div>
        ))}
      </div>

      <div style={{ ...s.card, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "2 1 240px" }}>
            <F lbl="Buscar" ch={<Inp placeholder="Nº, cliente, CPF, suplemento, lote, NF..." value={busca} onChange={e => setBusca(e.target.value)} />} />
          </div>
          <div style={{ flex: "1 1 140px" }}>
            <F lbl="Status" ch={<Sel value={fStatus} onChange={e => setFStatus(e.target.value)}><option value="">Todos</option>{Object.keys(SAC_SMETA).map(x => <option key={x}>{x}</option>)}</Sel>} />
          </div>
          <div style={{ flex: "1 1 150px" }}>
            <F lbl="Tipo" ch={<Sel value={fTipo} onChange={e => setFTipo(e.target.value)}><option value="">Todos</option>{CLASSIFICACOES_SAC.map(c => <option key={c.id}>{c.id}</option>)}</Sel>} />
          </div>
          <div style={{ flex: "1 1 170px" }}>
            <F lbl="Encaminhado para" ch={<Sel value={fSetor} onChange={e => setFSetor(e.target.value)}><option value="">Todos</option>{SETORES_SAC.map(x => <option key={x}>{x}</option>)}</Sel>} />
          </div>
          {perm("registrarSAC") && (
            <button onClick={() => setTab("novo-sac")} style={{ ...s.btnA, padding: "9px 16px", marginBottom: 14 }}>+ Novo atendimento</button>
          )}
        </div>
      </div>

      <Table
        columns={colunas}
        rows={filtrados}
        rowKey={a => a.id}
        onRowClick={a => { setSelLocal(null); setSelId(a.id); }}
        rowAccent={a => relatouReacao(a) && !finalizado(a) ? "#ff4f6a" : undefined}
        sortColDefault="num"
        sortDirDefault="desc"
        perPage={15}
        emptyIcon="📞"
        emptyTitle="Nenhum atendimento registrado ainda."
      />

      {sel && (
        <SacDetalhe
          a={sel}
          atendimentos={atendimentos}
          rncs={rncs}
          user={user}
          perm={perm}
          isAdmin={isAdmin}
          salvar={salvar}
          onClose={() => setSelId(null)}
          onAbrirRnc={abrirRncDoSac}
          onVerRnc={id => { setSelId(null); abrirRnc && abrirRnc(id); }}
          onExcluir={excluir}
        />
      )}
    </div>
  );
}

function Linha({ l, v }) {
  const T = useTheme();
  if (!v && v !== 0) return null;
  return (
    <div style={{ marginBottom: 6, display: "flex", gap: 8 }}>
      <div style={{ fontSize: 11, color: T.text3, fontWeight: 600, minWidth: 140 }}>{l}</div>
      <div style={{ fontSize: 13, color: T.text, whiteSpace: "pre-wrap", flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{v}</div>
    </div>
  );
}

function Bloco({ titulo, children, acao }) {
  const T = useTheme();
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
        <div style={{ fontSize: 10, color: T.text3, fontWeight: 700, textTransform: "uppercase" }}>{titulo}</div>
        {acao}
      </div>
      {children}
    </div>
  );
}

function Aviso({ cor, children }) {
  return <div style={{ background: cor + "14", border: `1px solid ${cor}55`, borderRadius: 10, padding: "10px 14px", marginBottom: 10, fontSize: 12.5, color: cor, lineHeight: 1.5 }}>{children}</div>;
}

function Anexos({ lista = [] }) {
  const T = useTheme();
  if (!lista.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
      {lista.map((x, i) => (
        <a key={i} href={x.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: T.accent, textDecoration: "none", background: T.surf, border: `1px solid ${T.border}`, borderRadius: 8, padding: "5px 10px" }}>📎 {x.name}</a>
      ))}
    </div>
  );
}

// ── Detalhe ──
function SacDetalhe({ a, atendimentos, rncs, user, perm, isAdmin, salvar, onClose, onAbrirRnc, onVerRnc, onExcluir }) {
  const T = useTheme(); const s = useS();
  const podeTratar = perm("tratarSAC");
  const podeRegistrar = perm("registrarSAC");
  const aberto = !finalizado(a);
  const podeAtender = aberto && (podeTratar || podeRegistrar);
  const podeFinalizar = aberto && (podeTratar || (podeRegistrar && podeFinalizarNaRecepcao(a)));
  const [editando, setEditando] = useState(false);
  const [modal, setModal] = useState(null); // "resposta" | "finalizar"
  const [tipo, setTipo] = useState(a.classificacao || "");
  const [notif, setNotif] = useState({ decisao: "", data: tod(), protocolo: "", justificativa: "" });

  useEffect(() => { setTipo(a.classificacao || ""); setEditando(false); setModal(null); }, [a.id]); // eslint-disable-line

  useEffect(() => {
    const esc = e => { if (e.key === "Escape" && !modal) onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [modal, onClose]);

  // Todo ato depois do registro tira o atendimento de "Em aberto".
  const salvarAto = (upd, msg) => salvar(comAndamento(upd), msg);

  const rnc = a.rncId ? rncs.find(r => r.id === a.rncId) : null;
  const doLote = mesmoLote(a, atendimentos);
  const prazo = prazoSac(a);
  const cl = classificacaoSac(a.classificacao);

  const salvarTipo = async () => {
    if (!tipo || tipo === a.classificacao) return;
    await salvarAto({
      ...a, classificacao: tipo,
      historico: [...(a.historico || []), entradaHistorico(`Tipo corrigido pela Qualidade: ${a.classificacao || "—"} → ${tipo}`, user)],
    }, "Tipo de manifestação corrigido.");
  };

  const salvarNotificacao = async () => {
    if (!notif.decisao) return;
    if (notif.decisao === "Notificado" && !notif.protocolo.trim()) { alert("Informe o protocolo da notificação."); return; }
    if (notif.decisao === "Não notificado" && !notif.justificativa.trim()) { alert("Justifique por que não foi notificado."); return; }
    const reg = { ...notif, por: user.name, em: new Date().toISOString() };
    const det = notif.decisao === "Notificado" ? [`Protocolo: ${notif.protocolo}`, `Data: ${fmt(notif.data)}`] : [`Justificativa: ${notif.justificativa}`];
    await salvarAto({
      ...a, notificacaoVigilancia: reg,
      historico: [...(a.historico || []), entradaHistorico(`Vigilância sanitária: ${notif.decisao}`, user, det)],
    }, "Decisão sobre a notificação registrada.");
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "#000a", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.bg, border: `1px solid ${T.border2}`, borderRadius: 14, maxWidth: 760, width: "100%", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 20px 60px #000a" }}>
        <div style={{ padding: "1.1rem 1.5rem", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, position: "sticky", top: 0, background: T.bg, zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: T.accent }}>{a.num}</span>
            <SacBadge status={a.status} />
            <TipoChip c={a.classificacao} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => exportSacPDF(a, rnc)} title="Ficha completa do atendimento" style={{ ...s.btn, fontSize: 11, padding: "6px 12px" }}>📄 PDF</button>
            {podeAtender && !editando && (
              <button onClick={() => setEditando(true)} style={{ ...s.btn, fontSize: 11, padding: "6px 12px" }}>✏️ Editar</button>
            )}
            <button onClick={onClose} aria-label="Fechar" style={{ background: "none", border: "none", color: T.text3, cursor: "pointer", fontSize: 22, fontFamily: "inherit" }}>✕</button>
          </div>
        </div>

        <div style={{ padding: "1.2rem 1.5rem" }}>
          {relatouReacao(a) && (
            <Aviso cor="#ff4f6a">🚨 <strong>O cliente relatou que alguém passou mal após o consumo.</strong>
              {aberto && a.classificacao !== "Reação adversa" && <> Trate como prioridade e avalie o tipo <strong>Reação adversa</strong>.</>}
            </Aviso>
          )}
          {doLote.length > 0 && (
            <Aviso cor={doLote.length + 1 >= LIMITE_RECORRENCIA_LOTE ? "#ff4f6a" : "#ff8c42"}>
              {doLote.length + 1 >= LIMITE_RECORRENCIA_LOTE ? "⚠️ " : ""}<strong>{doLote.length + 1} atendimentos citam o lote {a.lote}</strong>
              {doLote.length + 1 >= LIMITE_RECORRENCIA_LOTE ? " — avalie se o lote precisa de investigação ampla ou recolhimento." : "."}
              <div style={{ marginTop: 4, color: T.text2 }}>{doLote.slice(0, 5).map(x => `${x.num} (${x.classificacao || "—"})`).join(" · ")}</div>
            </Aviso>
          )}
          {prazo?.atrasado && (
            <Aviso cor="#ff8c42">Aberto há {prazo.dias} dias — a meta para responder o cliente é {META_RESPOSTA_DIAS} dias.</Aviso>
          )}

          {editando
            ? <EdicaoSac a={a} user={user} salvar={salvar} onFim={() => setEditando(false)} />
            : <LeituraSac a={a} />}

          {podeTratar && aberto && !editando && (
            <Bloco titulo="🧭 Tipo de manifestação (correção pela Qualidade)">
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 220px" }}>
                  <Sel value={tipo} onChange={e => setTipo(e.target.value)}>
                    <option value="">Selecione...</option>
                    {CLASSIFICACOES_SAC.map(c => <option key={c.id}>{c.id}</option>)}
                  </Sel>
                  {classificacaoSac(tipo)?.dica && <div style={{ fontSize: 11, color: T.text3, marginTop: 4 }}>{classificacaoSac(tipo).dica}</div>}
                </div>
                <button style={{ ...s.btnA, opacity: tipo && tipo !== a.classificacao ? 1 : .5 }} disabled={!tipo || tipo === a.classificacao} onClick={salvarTipo}>Corrigir tipo</button>
              </div>
            </Bloco>
          )}

          {!editando && <EncaminhamentosBloco key={`enc-${a.id}`} a={a} user={user} podeAtender={podeAtender} salvarAto={salvarAto} />}

          {cl?.vigilancia && (
            <Bloco titulo="🏥 Notificação à vigilância sanitária">
              {a.notificacaoVigilancia ? (
                <div style={{ fontSize: 13, color: T.text }}>
                  <strong>{a.notificacaoVigilancia.decisao}</strong>
                  {a.notificacaoVigilancia.decisao === "Notificado"
                    ? ` em ${fmt(a.notificacaoVigilancia.data)} — protocolo ${a.notificacaoVigilancia.protocolo}`
                    : ` — ${a.notificacaoVigilancia.justificativa}`}
                  <div style={{ fontSize: 11, color: T.text3, marginTop: 2 }}>registrado por {a.notificacaoVigilancia.por}</div>
                </div>
              ) : podeTratar && aberto ? (
                <div>
                  <div style={{ fontSize: 12, color: T.text2, marginBottom: 8 }}>Registre se a reação foi notificada à vigilância sanitária e, se não, por quê.</div>
                  <G3 ch={<>
                    <F lbl="Decisão" ch={<Sel value={notif.decisao} onChange={e => setNotif(p => ({ ...p, decisao: e.target.value }))}><option value="">Selecione...</option><option>Notificado</option><option>Não notificado</option></Sel>} />
                    {notif.decisao === "Notificado" && <F lbl="Data" ch={<Inp type="date" value={notif.data} onChange={e => setNotif(p => ({ ...p, data: e.target.value }))} />} />}
                    {notif.decisao === "Notificado" && <F lbl="Protocolo" ch={<Inp value={notif.protocolo} onChange={e => setNotif(p => ({ ...p, protocolo: e.target.value }))} />} />}
                  </>} />
                  {notif.decisao === "Não notificado" && <F lbl="Justificativa" ch={<TA rows={2} value={notif.justificativa} onChange={e => setNotif(p => ({ ...p, justificativa: e.target.value }))} placeholder="Ex.: reação não relacionada ao produto após avaliação..." />} />}
                  {notif.decisao && <div style={{ textAlign: "right" }}><button style={s.btnA} onClick={salvarNotificacao}>Registrar decisão</button></div>}
                </div>
              ) : <div style={{ fontSize: 12, color: T.text3 }}>Ainda não registrada (Qualidade).</div>}
            </Bloco>
          )}

          {!editando && (cl?.investigar || a.amostra || a.temAmostra === "Sim") && (
            <AmostraBloco key={`am-${a.id}`} a={a} user={user} perm={perm} salvarAto={salvarAto} aberto={aberto} />
          )}
          {!editando && (cl?.investigar || exigeAvaliacao(a) || a.avaliacao) && (
            <AvaliacaoBloco key={`av-${a.id}`} a={a} user={user} podeTratar={podeTratar} salvarAto={salvarAto} aberto={aberto} />
          )}

          {(a.rncId || (cl?.investigar && podeTratar && aberto)) && (
            <Bloco titulo="🔗 RNC (investigação)">
              {a.rncId ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 13, color: T.text }}>
                  <strong>{a.rncNum}</strong>
                  <span style={{ color: T.text2 }}>{rnc ? rnc.status : "—"}</span>
                  <button style={{ ...s.btn, fontSize: 11, padding: "5px 10px" }} onClick={() => onVerRnc(a.rncId)}>Abrir RNC</button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: T.text2, flex: 1 }}>Problema no produto: a investigação (causa, ações, eficácia) é feita numa RNC, que já abre com os dados deste atendimento.</span>
                  <button onClick={() => onAbrirRnc(a)} style={{ padding: "9px 14px", background: "#ff8c42", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700 }}>↗ Abrir RNC</button>
                </div>
              )}
            </Bloco>
          )}

          <Bloco titulo={`💬 Orientações e respostas ao cliente (${(a.respostas || []).length})`}
            acao={podeAtender && !editando && <button style={{ ...s.btnA, fontSize: 11, padding: "6px 12px" }} onClick={() => setModal("resposta")}>+ Registrar</button>}>
            {(a.respostas || []).length === 0
              ? <div style={{ fontSize: 12, color: T.text3 }}>Nenhuma orientação registrada ainda.</div>
              : <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {a.respostas.map(r => (
                  <div key={r.id} style={{ background: T.surf, borderLeft: `3px solid ${T.accent}`, borderRadius: "0 8px 8px 0", padding: "8px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                      <div style={{ fontSize: 11, color: T.text3 }}>{fmt(r.data)} · {r.meio} · por {r.por}</div>
                      <button onClick={() => exportCartaPDF(a, r)} title="Gerar carta ao cliente com este texto" style={{ ...s.btn, fontSize: 10, padding: "3px 9px" }}>✉️ Carta</button>
                    </div>
                    <div style={{ fontSize: 13, color: T.text, whiteSpace: "pre-wrap", marginTop: 3 }}>{r.texto}</div>
                  </div>
                ))}
              </div>}
          </Bloco>

          {finalizado(a) && (
            <Bloco titulo="✅ Encerramento">
              <Linha l="Solução aplicada" v={a.solucao} />
              {a.conclusao && <div style={{ fontSize: 13, color: T.text, whiteSpace: "pre-wrap", marginBottom: 4 }}>{a.conclusao}</div>}
              <div style={{ fontSize: 11, color: T.text3 }}>Finalizado por {a.encerradoPor} em {fmt(a.encerradoEm)}</div>
            </Bloco>
          )}

          <div style={{ marginTop: 16, paddingTop: 10, borderTop: `1px solid ${T.border}`, fontSize: 11, color: T.text3 }}>
            Atendente: <strong style={{ color: T.text2 }}>{a.registradoPor}</strong> · registrado em {fmt(a.dataRegistro)}
          </div>

          {a.historico?.length > 0 && (
            <details style={{ marginTop: 12 }}>
              <summary style={{ fontSize: 10, color: T.text3, fontWeight: 700, textTransform: "uppercase", cursor: "pointer" }}>🕓 Histórico ({a.historico.length})</summary>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                {[...a.historico].reverse().map((h, i) => (
                  <div key={i} style={{ background: T.surf, borderLeft: `3px solid ${T.border2}`, borderRadius: "0 8px 8px 0", padding: "8px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, color: T.text }}>{h.acao}</span>
                      <span style={{ fontSize: 10, color: T.text3 }}>{fmt(h.data)}{h.hora ? ` · ${h.hora}` : ""}</span>
                    </div>
                    <div style={{ fontSize: 10, color: T.text3, marginTop: 2 }}>por {h.resp}</div>
                    {h.detalhes?.length > 0 && <div style={{ marginTop: 4, fontSize: 11, color: T.text2 }}>{h.detalhes.map((d, j) => <div key={j}>• {d}</div>)}</div>}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>

        {podeAtender && !editando && (
          <div style={{ padding: "0.9rem 1.5rem", borderTop: `1px solid ${T.border}`, display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center", position: "sticky", bottom: 0, background: T.bg }}>
            {isAdmin && a.status === STATUS_SAC.ABERTO
              ? <button onClick={() => onExcluir(a)} style={{ background: "none", border: "none", color: "#ff4f6a", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>Excluir atendimento</button>
              : <span />}
            {podeFinalizar
              ? <button onClick={() => setModal("finalizar")} style={{ padding: "10px 20px", background: "#2ab84a", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700 }}>✓ Finalizar atendimento</button>
              : <span style={{ fontSize: 11, color: T.text3 }}>A finalização deste tipo é feita pela Qualidade.</span>}
          </div>
        )}
      </div>

      {modal === "resposta" && <RespostaModal a={a} user={user} salvarAto={salvarAto} onClose={() => setModal(null)} />}
      {modal === "finalizar" && <FinalizarModal a={a} rnc={rnc} user={user} salvar={salvar} onClose={() => setModal(null)} />}
    </div>
  );
}

// Encaminhamento a um setor (seção 6 da ficha). Fica registrado e o retorno do
// setor entra uma vez — quem recebeu a resposta do setor anota aqui.
function EncaminhamentosBloco({ a, user, podeAtender, salvarAto }) {
  const T = useTheme(); const s = useS();
  const lista = a.encaminhamentos || [];
  const [novo, setNovo] = useState(null); // { setor, data, motivo }
  const [retornoDe, setRetornoDe] = useState(null); // id do encaminhamento
  const [ret, setRet] = useState({ texto: "", data: tod() });

  const encaminhar = async () => {
    if (!novo.setor) { alert("Escolha o setor."); return; }
    const enc = novoEncaminhamento(novo, user);
    if (await salvarAto({
      ...a, encaminhamentos: [...lista, enc],
      historico: [...(a.historico || []), entradaHistorico(`Encaminhado para ${enc.setor}`, user, enc.motivo ? [enc.motivo] : null)],
    }, `Encaminhado para ${enc.setor}.`)) setNovo(null);
  };

  const registrarRetorno = async (enc) => {
    if (!ret.texto.trim()) { alert("Escreva o retorno do setor."); return; }
    const atualizado = comRetorno(enc, ret, user);
    if (await salvarAto({
      ...a, encaminhamentos: lista.map(e => (e.id === enc.id ? atualizado : e)),
      historico: [...(a.historico || []), entradaHistorico(`Retorno do setor ${enc.setor}`, user, [resumoAcrescimo(ret.texto)])],
    }, "Retorno do setor registrado.")) { setRetornoDe(null); setRet({ texto: "", data: tod() }); }
  };

  return (
    <Bloco titulo={`↪️ Encaminhamento / retorno do setor (${lista.length})`}
      acao={podeAtender && !novo && <button style={{ ...s.btn, fontSize: 11, padding: "6px 12px" }} onClick={() => setNovo({ setor: "", data: tod(), motivo: "" })}>+ Encaminhar</button>}>
      {lista.length === 0 && !novo && <div style={{ fontSize: 12, color: T.text3 }}>Não encaminhado.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {lista.map(e => (
          <div key={e.id} style={{ background: T.surf, borderLeft: `3px solid ${e.retorno ? "#2ab84a" : "#ff8c42"}`, borderRadius: "0 8px 8px 0", padding: "8px 12px" }}>
            <div style={{ fontSize: 13, color: T.text }}><strong>{e.setor}</strong> <span style={{ fontSize: 11, color: T.text3 }}>· {fmt(e.data)} · por {e.por}</span></div>
            {e.motivo && <div style={{ fontSize: 12, color: T.text2, whiteSpace: "pre-wrap" }}>{e.motivo}</div>}
            {e.retorno ? (
              <div style={{ marginTop: 6, fontSize: 12.5, color: T.text, whiteSpace: "pre-wrap" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#2ab84a", textTransform: "uppercase" }}>Retorno {fmt(e.retorno.data)}</span>{"\n"}{e.retorno.texto}
                <div style={{ fontSize: 10, color: T.text3 }}>anotado por {e.retorno.por}</div>
              </div>
            ) : retornoDe === e.id ? (
              <div style={{ marginTop: 8 }}>
                <G2 ch={<>
                  <F lbl="Data do retorno" ch={<Inp type="date" value={ret.data} max={tod()} onChange={ev => setRet(p => ({ ...p, data: ev.target.value }))} />} />
                  <span />
                </>} />
                <F lbl="Resposta / parecer do setor" ch={<TA rows={3} value={ret.texto} onChange={ev => setRet(p => ({ ...p, texto: ev.target.value }))} />} />
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button style={s.btn} onClick={() => setRetornoDe(null)}>Cancelar</button>
                  <button style={s.btnA} onClick={() => registrarRetorno(e)}>Registrar retorno</button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "#ff8c42" }}>⏳ aguardando retorno</span>
                {podeAtender && <button style={{ ...s.btn, fontSize: 10, padding: "3px 9px" }} onClick={() => { setRetornoDe(e.id); setRet({ texto: "", data: tod() }); }}>Registrar retorno</button>}
              </div>
            )}
          </div>
        ))}
      </div>
      {novo && (
        <div style={{ marginTop: 8 }}>
          <G2 ch={<>
            <F lbl="Setor *" ch={<Sel value={novo.setor} onChange={e => setNovo(p => ({ ...p, setor: e.target.value }))}><option value="">Selecione...</option>{SETORES_SAC.map(x => <option key={x}>{x}</option>)}</Sel>} />
            <F lbl="Data do encaminhamento" ch={<Inp type="date" value={novo.data} max={tod()} onChange={e => setNovo(p => ({ ...p, data: e.target.value }))} />} />
          </>} />
          <F lbl="O que o setor precisa ver" ch={<TA rows={2} value={novo.motivo} onChange={e => setNovo(p => ({ ...p, motivo: e.target.value }))} placeholder="Ex.: confirmar se o pedido 1234 foi entregue..." />} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button style={s.btn} onClick={() => setNovo(null)}>Cancelar</button>
            <button style={s.btnA} onClick={encaminhar}>Encaminhar</button>
          </div>
        </div>
      )}
    </Bloco>
  );
}

// Amostra do cliente: a Qualidade pede, a recepção (ou a Qualidade) registra a
// chegada. Pedir amostra exige endereço completo — é para lá que vai a coleta.
function AmostraBloco({ a, user, perm, salvarAto, aberto }) {
  const T = useTheme(); const s = useS();
  const etapa = etapaAmostra(a);
  const am = a.amostra || {};
  const [pedindo, setPedindo] = useState(false);
  const [instrucoes, setInstrucoes] = useState("");
  const [end, setEnd] = useState(() => enderecoDe(a));
  const [recebendo, setRecebendo] = useState(false);
  const [rec, setRec] = useState({ em: tod(), condicao: "" });
  const [anexosRec, setAnexosRec] = useState([]);
  const podePedir = aberto && perm("tratarSAC");
  const podeReceber = aberto && (perm("tratarSAC") || perm("registrarSAC"));
  const faltas = faltasEndereco({ ...a, ...end });

  const pedir = async () => {
    if (faltas.length) { alert(`Para pedir a amostra, complete o endereço: ${faltas.join(", ")}.`); return; }
    const solicitada = { em: new Date().toISOString(), por: user.name, instrucoes: instrucoes.trim() };
    if (await salvarAto({
      ...a, ...end, amostra: { ...am, solicitada },
      historico: [...(a.historico || []), entradaHistorico("Amostra pedida ao cliente", user, solicitada.instrucoes ? [resumoAcrescimo(solicitada.instrucoes)] : null)],
    }, "Pedido de amostra registrado.")) setPedindo(false);
  };

  const receber = async () => {
    if (!rec.em) { alert("Informe a data de chegada."); return; }
    const recebida = { em: rec.em, por: user.name, condicao: rec.condicao.trim(), anexos: anexosRec, registradoEm: new Date().toISOString() };
    if (await salvarAto({
      ...a, amostra: { ...am, recebida },
      historico: [...(a.historico || []), entradaHistorico("Amostra do cliente recebida", user, [`Chegada: ${fmt(rec.em)}`, rec.condicao.trim() && `Condição: ${rec.condicao.trim()}`].filter(Boolean))],
    }, "Chegada da amostra registrada.")) setRecebendo(false);
  };

  return (
    <Bloco titulo="📦 Amostra do cliente">
      {etapa === "nao_solicitada" && !pedindo && !recebendo && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: T.text2, flex: 1 }}>
            {a.temAmostra === "Sim" ? "O cliente ainda tem o produto." : "Nenhuma amostra pedida."} Para analisar, peça que envie a embalagem com o restante do produto.
          </span>
          {podePedir && <button style={s.btnA} onClick={() => setPedindo(true)}>Pedir amostra</button>}
          {podeReceber && <button style={s.btn} onClick={() => setRecebendo(true)} title="O cliente mandou sem ser pedido">Registrar chegada</button>}
        </div>
      )}
      {pedindo && (
        <div>
          {faltas.length > 0 && <Aviso cor="#ff8c42">A coleta vai para o endereço do cliente — complete: {faltas.join(", ")}.</Aviso>}
          <EnderecoCampos f={end} set={(k, v) => setEnd(p => ({ ...p, [k]: v }))} comCidade />
          <F lbl="Instruções passadas ao cliente" tip="Como enviar, se a empresa paga o frete, prazo." ch={
            <TA rows={3} value={instrucoes} onChange={e => setInstrucoes(e.target.value)} placeholder="Ex.: logística reversa pelos Correios, código enviado por WhatsApp..." />
          } />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button style={s.btn} onClick={() => setPedindo(false)}>Cancelar</button>
            <button style={s.btnA} onClick={pedir}>Registrar pedido</button>
          </div>
        </div>
      )}
      {am.solicitada && (
        <div style={{ fontSize: 13, color: T.text, marginBottom: 6 }}>
          Pedida em <strong>{fmt(String(am.solicitada.em).slice(0, 10))}</strong> por {am.solicitada.por}.
          {am.solicitada.instrucoes && <div style={{ fontSize: 12, color: T.text2, whiteSpace: "pre-wrap", marginTop: 2 }}>{am.solicitada.instrucoes}</div>}
        </div>
      )}
      {etapa === "aguardando" && !recebendo && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "#ff8c42", flex: 1 }}>⏳ Aguardando a amostra chegar.</span>
          {podeReceber && <button style={s.btnA} onClick={() => setRecebendo(true)}>Registrar chegada</button>}
        </div>
      )}
      {recebendo && (
        <div>
          <G2 ch={<>
            <F lbl="Data de chegada" ch={<Inp type="date" value={rec.em} max={tod()} onChange={e => setRec(p => ({ ...p, em: e.target.value }))} />} />
            <F lbl="Condição na chegada" ch={<Inp value={rec.condicao} onChange={e => setRec(p => ({ ...p, condicao: e.target.value }))} placeholder="Ex.: frasco aberto, 40 cápsulas restantes" />} />
          </>} />
          <F lbl="📎 Fotos da amostra recebida" ch={<AnexosUpload anexos={anexosRec} setAnexos={setAnexosRec} inputId="sac-amostra-anexo" />} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button style={s.btn} onClick={() => setRecebendo(false)}>Cancelar</button>
            <button style={s.btnA} onClick={receber}>Registrar chegada</button>
          </div>
        </div>
      )}
      {am.recebida && (
        <div style={{ fontSize: 13, color: T.text }}>
          {!am.solicitada && <div style={{ fontSize: 12, color: T.text2 }}>Enviada pelo cliente sem pedido.</div>}
          ✅ Recebida em <strong>{fmt(am.recebida.em)}</strong> (registrado por {am.recebida.por}).
          {am.recebida.condicao && <div style={{ fontSize: 12, color: T.text2 }}>Condição: {am.recebida.condicao}</div>}
          <Anexos lista={am.recebida.anexos} />
        </div>
      )}
    </Bloco>
  );
}

// Avaliação técnica: a reclamação tinha fundamento? Gravada uma vez só.
function AvaliacaoBloco({ a, user, podeTratar, salvarAto, aberto }) {
  const T = useTheme(); const s = useS();
  const av = a.avaliacao;
  const [f, setF] = useState({ resultado: "", parecer: "", amostraConsumidor: "Não", amostraRetencao: "Sim" });
  const [anexos, setAnexos] = useState([]);
  const [abrir, setAbrir] = useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const gravar = async () => {
    const erros = errosDaAvaliacao(f);
    if (erros.length) { alert(erros.join("\n")); return; }
    if (!window.confirm(`Registrar a avaliação como "${f.resultado}"? Depois de gravada ela não pode ser alterada.`)) return;
    const nova = novaAvaliacao({ ...f, anexos }, user);
    await salvarAto({
      ...a, avaliacao: nova,
      historico: [...(a.historico || []), entradaHistorico(`Avaliação técnica: ${nova.resultado}`, user, [resumoAcrescimo(nova.parecer)])],
    }, "Avaliação técnica registrada.");
  };

  const cor = av?.resultado === "Procedente" ? "#ff4f6a" : av?.resultado === "Improcedente" ? "#2ab84a" : "#ffd166";

  return (
    <Bloco titulo={`🔬 Avaliação técnica${exigeAvaliacao(a) && !av ? " — obrigatória para finalizar" : ""}`}>
      {av ? (
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: cor }}>{av.resultado}</div>
          <div style={{ fontSize: 12, color: T.text2, margin: "2px 0 6px" }}>Amostra do cliente analisada: {av.amostraConsumidor} · Amostra de retenção analisada: {av.amostraRetencao}</div>
          <div style={{ fontSize: 13, color: T.text, whiteSpace: "pre-wrap" }}>{av.parecer}</div>
          <Anexos lista={av.anexos} />
          <div style={{ fontSize: 11, color: T.text3, marginTop: 4 }}>por {av.por} em {new Date(av.em).toLocaleString("pt-BR")}</div>
        </div>
      ) : !podeTratar || !aberto ? (
        <div style={{ fontSize: 12, color: T.text3 }}>Ainda não registrada (Qualidade).</div>
      ) : !abrir ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: T.text2, flex: 1 }}>Depois de analisar a amostra do cliente e/ou a de retenção do lote, registre se a reclamação procede.</span>
          <button style={s.btnA} onClick={() => { set("amostraConsumidor", etapaAmostra(a) === "recebida" ? "Sim" : "Não"); setAbrir(true); }}>Registrar avaliação</button>
        </div>
      ) : (
        <div>
          <G3 ch={<>
            <F lbl="Resultado *" ch={<Sel value={f.resultado} onChange={e => set("resultado", e.target.value)}><option value="">Selecione...</option>{RESULTADOS_AVALIACAO.map(r => <option key={r.id}>{r.id}</option>)}</Sel>} />
            <F lbl="Amostra do cliente analisada?" ch={<Sel value={f.amostraConsumidor} onChange={e => set("amostraConsumidor", e.target.value)}><option>Sim</option><option>Não</option></Sel>} />
            <F lbl="Amostra de retenção analisada?" ch={<Sel value={f.amostraRetencao} onChange={e => set("amostraRetencao", e.target.value)}><option>Sim</option><option>Não</option></Sel>} />
          </>} />
          {RESULTADOS_AVALIACAO.find(r => r.id === f.resultado) && <div style={{ fontSize: 11, color: T.text3, marginTop: -8, marginBottom: 10 }}>{RESULTADOS_AVALIACAO.find(r => r.id === f.resultado).dica}</div>}
          <F lbl="Parecer técnico *" ch={<TA rows={4} value={f.parecer} onChange={e => set("parecer", e.target.value)} placeholder="O que foi analisado, resultados e conclusão. Ex.: retenção do lote L-045 com umidade 6,8% (espec. ≤ 5%)..." />} />
          <F lbl="📎 Laudos e fotos" ch={<AnexosUpload anexos={anexos} setAnexos={setAnexos} inputId="sac-avaliacao-anexo" />} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button style={s.btn} onClick={() => setAbrir(false)}>Cancelar</button>
            <button style={s.btnA} onClick={gravar}>Registrar avaliação</button>
          </div>
        </div>
      )}
    </Bloco>
  );
}

function LeituraSac({ a }) {
  const T = useTheme();
  return (
    <>
      <Bloco titulo="1. Atendimento">
        <Linha l="Data / horário" v={`${fmt(a.dataContato)}${a.horaContato ? ` às ${a.horaContato}` : ""}`} />
        <Linha l="Canal" v={a.canal} />
        <Linha l="Tipo" v={a.classificacao} />
      </Bloco>
      <Bloco titulo="2. Cliente">
        <Linha l="Nome" v={a.consumidorNome} />
        <Linha l="CPF / CNPJ" v={a.consumidorDoc} />
        <Linha l="Telefone / WhatsApp" v={a.consumidorTelefone} />
        <Linha l="E-mail" v={a.consumidorEmail} />
        <Linha l="Endereço" v={enderecoTexto(a)} />
      </Bloco>
      <Bloco titulo="3. Produto">
        <Linha l="Suplemento" v={a.produto} />
        <Linha l="Lote" v={a.lote} />
        <Linha l="Validade" v={a.validade} />
        <Linha l="Nº pedido / NF" v={a.nf} />
        <Linha l="Local de compra" v={a.localCompra} />
        <Linha l="Ainda tem o produto?" v={a.temAmostra} />
      </Bloco>
      <Bloco titulo="4. Relato do cliente">
        <CampoHistoricoLeitura valor={a.relato} compacto />
      </Bloco>
      {a.teveReacao && a.teveReacao !== "Não" && (
        <Bloco titulo="🩺 Reação após o consumo">
          <Linha l="Alguém passou mal?" v={a.teveReacao} />
          {a.reacaoDesc && <CampoHistoricoLeitura valor={a.reacaoDesc} compacto />}
        </Bloco>
      )}
      {a.anexos?.length > 0 && (
        <Bloco titulo={`📎 Anexos (${a.anexos.length})`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {a.anexos.map((x, i) => (
              <a key={i} href={x.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: T.accent, textDecoration: "none", background: T.surf, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px" }}>📎 {x.name}</a>
            ))}
          </div>
        </Bloco>
      )}
    </>
  );
}

const CAMPOS_EDITAVEIS = {
  dataContato: "Data", horaContato: "Horário", canal: "Canal",
  consumidorNome: "Nome", consumidorDoc: "CPF/CNPJ", consumidorTelefone: "Telefone", consumidorEmail: "E-mail",
  consumidorCEP: "CEP", consumidorLogradouro: "Logradouro", consumidorNumero: "Número", consumidorComplemento: "Complemento",
  consumidorBairro: "Bairro", consumidorReferencia: "Ponto de referência", consumidorCidade: "Cidade", consumidorUF: "UF",
  produto: "Suplemento", lote: "Lote", validade: "Validade", nf: "Nº pedido / NF", localCompra: "Local de compra", temAmostra: "Ainda tem o produto",
};
const CAMPOS_ENDERECO_EDIT = ["consumidorCEP", "consumidorLogradouro", "consumidorNumero", "consumidorComplemento", "consumidorBairro", "consumidorReferencia", "consumidorCidade", "consumidorUF"];
const enderecoDe = (a) => Object.fromEntries(CAMPOS_ENDERECO_EDIT.map(k => [k, a[k] || ""]));

function EdicaoSac({ a, user, salvar, onFim }) {
  const T = useTheme(); const s = useS();
  const [f, setF] = useState(() => Object.fromEntries(Object.keys(CAMPOS_EDITAVEIS).map(k => [k, a[k] || ""])));
  const [addRelato, setAddRelato] = useState("");
  const [novosAnexos, setNovosAnexos] = useState([]);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const gravar = async () => {
    const det = Object.entries(CAMPOS_EDITAVEIS)
      .filter(([k]) => (a[k] || "") !== (f[k] || ""))
      .map(([k, l]) => `${l}: "${a[k] || "—"}" → "${f[k] || "—"}"`);
    if (!campoVazio(addRelato)) det.push(`Relato — acréscimo: "${resumoAcrescimo(addRelato)}"`);
    if (novosAnexos.length) det.push(`Anexos incluídos: ${novosAnexos.map(x => x.name).join(", ")}`);
    if (!det.length) { onFim(); return; }
    const erros = errosDoRegistro({ ...a, ...f });
    ["relato", "reacaoDesc", "setor", "orientacao", "solucao"].forEach(k => delete erros[k]);
    if (Object.keys(erros).length) { alert(Object.values(erros).join("\n")); return; }
    const upd = { ...a, ...f, historico: [...(a.historico || []), entradaHistorico(`Atendimento editado — ${det.length} alteração(ões)`, user, det)] };
    if (!campoVazio(addRelato)) upd.relato = acrescentarAoCampo(a.relato, addRelato, user, new Date());
    if (novosAnexos.length) upd.anexos = [...(a.anexos || []), ...novosAnexos];
    if (await salvar(upd, `${a.num} atualizado.`)) onFim();
  };

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ background: T.accentDim, border: `1px solid ${T.accent}33`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: T.accent }}>
        ✏️ Modo edição — as alterações ficam registradas no histórico do atendimento.
      </div>
      <CamposFicha f={f} set={set} />
      <F lbl="4. Relato do cliente" tip="O que já foi registrado não se altera. Para corrigir ou complementar, escreva o acréscimo." ch={
        <CampoHistoricoEdicao valorSalvo={a.relato} adicao={addRelato} setAdicao={setAddRelato} rows={3} placeholder="Ex.: cliente ligou de novo e informou que..." />
      } />
      <F lbl="📎 Incluir anexos" ch={<AnexosUpload anexos={novosAnexos} setAnexos={setNovosAnexos} inputId="sac-edit-anexo" />} />
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button style={s.btn} onClick={onFim}>Cancelar</button>
        <button style={s.btnA} onClick={gravar}>💾 Salvar alterações</button>
      </div>
    </div>
  );
}

// Endereço da ficha. `comCidade` inclui cidade/UF (no registro elas ficam junto do telefone).
function EnderecoCampos({ f, set, err = {}, comCidade = false }) {
  return (
    <>
      <G3 ch={<>
        <F lbl="CEP" err={err.consumidorCEP} ch={<Inp value={f.consumidorCEP} onChange={e => set("consumidorCEP", mascaraCep(e.target.value))} placeholder="00000-000" inputMode="numeric" />} />
        <F lbl="Logradouro (Rua / Av.)" ch={<Inp value={f.consumidorLogradouro} onChange={e => set("consumidorLogradouro", e.target.value)} />} />
        <F lbl="Número" ch={<Inp value={f.consumidorNumero} onChange={e => set("consumidorNumero", e.target.value)} />} />
      </>} />
      <G3 ch={<>
        <F lbl="Complemento" ch={<Inp value={f.consumidorComplemento} onChange={e => set("consumidorComplemento", e.target.value)} />} />
        <F lbl="Bairro" ch={<Inp value={f.consumidorBairro} onChange={e => set("consumidorBairro", e.target.value)} />} />
        <F lbl="Ponto de referência" ch={<Inp value={f.consumidorReferencia} onChange={e => set("consumidorReferencia", e.target.value)} />} />
      </>} />
      {comCidade && (
        <G2 ch={<>
          <F lbl="Cidade" ch={<Inp value={f.consumidorCidade} onChange={e => set("consumidorCidade", e.target.value)} />} />
          <F lbl="UF" ch={<Sel value={f.consumidorUF} onChange={e => set("consumidorUF", e.target.value)}><option value="">—</option>{UFS.map(u => <option key={u}>{u}</option>)}</Sel>} />
        </>} />
      )}
    </>
  );
}

// Seções 1 a 3 da ficha: atendimento, cliente e produto. Mesmos campos no registro e na edição.
function CamposFicha({ f, set, err = {}, comTipo = false }) {
  const T = useTheme();
  const tipo = classificacaoSac(f.classificacao);
  return (
    <>
      <SecTitle icon="📞" ch="1. Atendimento" />
      <G3 ch={<>
        <F lbl="Data *" ch={<Inp type="date" value={f.dataContato} max={tod()} onChange={e => set("dataContato", e.target.value)} />} />
        <F lbl="Horário" ch={<Inp type="time" value={f.horaContato} onChange={e => set("horaContato", e.target.value)} />} />
        <F lbl="Canal *" ch={<Sel value={f.canal} onChange={e => set("canal", e.target.value)}>{CANAIS_SAC.map(c => <option key={c}>{c}</option>)}</Sel>} />
      </>} />
      {comTipo && (
        <F lbl="Tipo *" err={err.classificacao} ch={
          <div>
            <Sel value={f.classificacao} onChange={e => set("classificacao", e.target.value)}>
              <option value="">Selecione...</option>
              {CLASSIFICACOES_SAC.map(c => <option key={c.id}>{c.id}</option>)}
            </Sel>
            {tipo?.dica && <div style={{ fontSize: 11, color: T.text3, marginTop: 4 }}>{tipo.dica}</div>}
          </div>
        } />
      )}

      <SecTitle icon="👤" ch="2. Cliente" />
      <G3 ch={<>
        <F lbl="Nome completo *" err={err.consumidorNome} ch={<Inp value={f.consumidorNome} onChange={e => set("consumidorNome", e.target.value)} />} />
        <F lbl="CPF / CNPJ" ch={<Inp value={f.consumidorDoc} onChange={e => set("consumidorDoc", mascaraDoc(e.target.value))} inputMode="numeric" />} />
        <F lbl="Telefone / WhatsApp *" err={err.consumidorTelefone} ch={<MaskedInp mask="telefone" value={f.consumidorTelefone} onChange={e => set("consumidorTelefone", e.target.value)} placeholder="(00) 00000-0000" />} />
      </>} />
      <G3 ch={<>
        <F lbl="E-mail" ch={<Inp type="email" value={f.consumidorEmail} onChange={e => set("consumidorEmail", e.target.value)} />} />
        <F lbl="Cidade *" err={err.consumidorCidade} ch={<Inp value={f.consumidorCidade} onChange={e => set("consumidorCidade", e.target.value)} />} />
        <F lbl="UF *" err={err.consumidorUF} ch={<Sel value={f.consumidorUF} onChange={e => set("consumidorUF", e.target.value)}><option value="">—</option>{UFS.map(u => <option key={u}>{u}</option>)}</Sel>} />
      </>} />
      <div style={{ fontSize: 11, color: T.text3, margin: "-4px 0 8px" }}>Endereço: obrigatório só quando houver troca, reenvio ou coleta de amostra — pode ficar para depois.</div>
      <EnderecoCampos f={f} set={set} err={err} />

      <SecTitle icon="📦" ch="3. Produto" />
      <G3 ch={<>
        <F lbl="Suplemento *" err={err.produto} ch={<Inp value={f.produto} onChange={e => set("produto", e.target.value)} placeholder="Nome como está na embalagem" />} />
        <F lbl="Lote" tip="Está impresso na embalagem, perto da validade. É o dado mais importante para investigar." ch={<Inp value={f.lote} onChange={e => set("lote", e.target.value)} />} />
        <F lbl="Validade" ch={<Inp value={f.validade} onChange={e => set("validade", e.target.value)} placeholder="Ex.: 08/2027" />} />
      </>} />
      <G3 ch={<>
        <F lbl="Nº pedido / NF" ch={<Inp value={f.nf} onChange={e => set("nf", e.target.value)} />} />
        <F lbl="Local de compra" ch={<Inp value={f.localCompra} onChange={e => set("localCompra", e.target.value)} placeholder="Site, marketplace, loja..." />} />
        <F lbl="Ainda tem o produto?" tip="Se tiver, a Qualidade pode pedir que envie para análise." ch={<Sel value={f.temAmostra} onChange={e => set("temAmostra", e.target.value)}><option value="">Não informado</option><option>Sim</option><option>Não</option></Sel>} />
      </>} />
    </>
  );
}

// ── Registro (recepção) — a ficha inteira, de cima a baixo ──
function NovoSacForm({ user, toast_, setTab, doSaveSac }) {
  const T = useTheme(); const s = useS();
  const [f, setF] = useState({
    dataContato: tod(), horaContato: agoraHora(), canal: "Telefone", classificacao: "",
    consumidorNome: "", consumidorDoc: "", consumidorTelefone: "", consumidorEmail: "",
    consumidorCEP: "", consumidorLogradouro: "", consumidorNumero: "", consumidorComplemento: "", consumidorBairro: "", consumidorReferencia: "",
    consumidorCidade: "", consumidorUF: "",
    produto: "", lote: "", validade: "", nf: "", localCompra: "", temAmostra: "",
    relato: "", teveReacao: "Não", reacaoDesc: "",
    orientacao: "", encaminhar: "Não", setor: "", motivoEnc: "",
    finalizarAgora: false, solucao: "",
  });
  const [anexos, setAnexos] = useState([]);
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const set = (k, v) => setF(p => {
    const n = { ...p, [k]: v };
    // Reclamação e reação adversa vão para a Qualidade por padrão (pode trocar).
    if (k === "classificacao") {
      const inv = classificacaoSac(v)?.investigar;
      n.encaminhar = inv ? "Sim" : "Não";
      n.setor = inv ? SETOR_QUALIDADE : "";
    }
    if (k === "teveReacao" && v === "Sim") { n.encaminhar = "Sim"; n.setor = n.setor || SETOR_QUALIDADE; }
    return n;
  });
  const erros = tentou ? errosDoRegistro(f) : {};

  // Finalizar no próprio contato: só o que não precisa da Qualidade.
  const encaminhamentosPrevistos = f.encaminhar === "Sim" && f.setor ? [{ setor: f.setor }] : [];
  const podeFinalizarAgora = podeFinalizarNaRecepcao({ ...f, encaminhamentos: encaminhamentosPrevistos }) && f.encaminhar === "Não";
  useEffect(() => { if (!podeFinalizarAgora && f.finalizarAgora) setF(p => ({ ...p, finalizarAgora: false })); }, [podeFinalizarAgora, f.finalizarAgora]);

  const registrar = async () => {
    setTentou(true);
    if (Object.keys(errosDoRegistro(f)).length) { toast_("Faltam informações — veja os campos em vermelho.", "red"); return; }
    setSalvando(true);
    try {
      const num = await incrementSacCounter();
      const agora = new Date();
      const { orientacao, encaminhar, setor, motivoEnc, finalizarAgora, solucao, ...dados } = f;
      const respostas = orientacao.trim() ? [novaResposta({ data: f.dataContato, meio: f.canal, texto: orientacao }, user, agora)] : [];
      const encaminhamentos = encaminhar === "Sim" ? [novoEncaminhamento({ setor, data: f.dataContato, motivo: motivoEnc }, user, agora)] : [];
      const hist = [entradaHistorico("Atendimento registrado", user, [`Tipo: ${f.classificacao}`, f.teveReacao === "Sim" && "Cliente relatou reação após o consumo"].filter(Boolean), agora)];
      if (respostas.length) hist.push(entradaHistorico(`Orientação ao cliente (${f.canal})`, user, [resumoAcrescimo(orientacao)], agora));
      if (encaminhamentos.length) hist.push(entradaHistorico(`Encaminhado para ${setor}`, user, motivoEnc.trim() ? [motivoEnc.trim()] : null, agora));
      const status = finalizarAgora ? STATUS_SAC.FINALIZADO : (respostas.length || encaminhamentos.length ? STATUS_SAC.ANDAMENTO : STATUS_SAC.ABERTO);
      if (finalizarAgora) hist.push(entradaHistorico("Atendimento finalizado no primeiro contato", user, [`Solução: ${solucao}`], agora));
      const at = {
        id: `sac-${agora.getTime()}`,
        num,
        ...dados,
        consumidorNome: f.consumidorNome.trim(),
        relato: f.relato.trim(),
        reacaoDesc: f.teveReacao === "Sim" ? f.reacaoDesc.trim() : "",
        anexos, respostas, encaminhamentos,
        status,
        ...(finalizarAgora ? { solucao, conclusao: "", encerradoPor: user.name, encerradoEm: tod() } : {}),
        registradoPor: user.name,
        dataRegistro: tod(),
        createdAt: agora.getTime(),
        historico: hist,
      };
      await doSaveSac(at);
      toast_(`${num} ${finalizarAgora ? "registrado e finalizado" : "registrado"}!`, "green");
      setTab("sac");
    } catch (e) {
      toast_(`Erro ao registrar: ${e.message}`, "red");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div>
      <div style={s.card}>
        <div style={{ fontSize: 12, color: T.text3, marginBottom: 14, lineHeight: 1.5 }}>
          Mesma ficha da planilha. Campos com * são obrigatórios. Atendente e número de protocolo são preenchidos automaticamente.
        </div>
        <CamposFicha f={f} set={set} err={erros} comTipo />

        <SecTitle icon="📝" ch="4. Relato do cliente *" />
        <F lbl="O que aconteceu e o que o cliente espera como solução" err={erros.relato} ch={
          <TA rows={4} value={f.relato} onChange={e => set("relato", e.target.value)} placeholder="Ex.: abriu o frasco e 3 cápsulas estavam quebradas; quer a troca do produto." />
        } />
        <F lbl="Alguém passou mal ou teve reação depois de consumir?" ch={
          <Sel value={f.teveReacao} onChange={e => set("teveReacao", e.target.value)}><option>Não</option><option>Sim</option><option>Não sabe</option></Sel>
        } />
        {f.teveReacao === "Sim" && (
          <>
            <Aviso cor="#ff4f6a">🚨 Este atendimento vai em destaque para a Qualidade. Se possível, avise a Qualidade também por telefone.</Aviso>
            <F lbl="O que a pessoa sentiu? *" err={erros.reacaoDesc} tip="Sintomas, quando começaram, se procurou atendimento médico." ch={
              <TA rows={3} value={f.reacaoDesc} onChange={e => set("reacaoDesc", e.target.value)} placeholder="Ex.: dor de estômago 1h depois de tomar; não procurou médico..." />
            } />
          </>
        )}

        <SecTitle icon="💬" ch="5. Orientação dada ao cliente" />
        <F lbl="Orientação dada e ações tomadas no primeiro contato" err={erros.orientacao} ch={
          <TA rows={3} value={f.orientacao} onChange={e => set("orientacao", e.target.value)} placeholder="Ex.: orientado a guardar o frasco; informado que a Qualidade vai retornar em até 7 dias." />
        } />

        <SecTitle icon="↪️" ch="6. Encaminhamento" />
        <G3 ch={<>
          <F lbl="Encaminhado? *" ch={<Sel value={f.encaminhar} onChange={e => set("encaminhar", e.target.value)}><option>Não</option><option>Sim</option></Sel>} />
          {f.encaminhar === "Sim" && <F lbl="Setor *" err={erros.setor} ch={<Sel value={f.setor} onChange={e => set("setor", e.target.value)}><option value="">Selecione...</option>{SETORES_SAC.map(x => <option key={x}>{x}</option>)}</Sel>} />}
          {f.encaminhar === "Sim" && <F lbl="O que o setor precisa ver" ch={<Inp value={f.motivoEnc} onChange={e => set("motivoEnc", e.target.value)} />} />}
        </>} />

        <F lbl="📎 Fotos, nota fiscal e documentos" ch={<AnexosUpload anexos={anexos} setAnexos={setAnexos} inputId="sac-anexo-input" />} />

        {podeFinalizarAgora && (
          <div style={{ background: T.surf, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px", marginTop: 6 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: T.text, cursor: "pointer" }}>
              <input type="checkbox" checked={f.finalizarAgora} onChange={e => set("finalizarAgora", e.target.checked)} />
              <strong>7. Resolvido neste contato — finalizar agora</strong>
            </label>
            {f.finalizarAgora && (
              <div style={{ marginTop: 10, maxWidth: 320 }}>
                <F lbl="Solução aplicada *" err={erros.solucao} ch={<Sel value={f.solucao} onChange={e => set("solucao", e.target.value)}><option value="">Selecione...</option>{SOLUCOES_SAC.filter(x => !SOLUCOES_COM_ENDERECO.includes(x)).map(x => <option key={x}>{x}</option>)}</Sel>} />
              </div>
            )}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
        <button onClick={() => setTab("sac")} style={{ ...s.btn, padding: "11px 20px" }}>Cancelar</button>
        <button onClick={registrar} disabled={salvando} style={{ padding: "11px 24px", background: "#2ab84a", color: "#fff", border: "none", borderRadius: 8, cursor: salvando ? "default" : "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, opacity: salvando ? .6 : 1 }}>
          {salvando ? "Registrando..." : f.finalizarAgora ? "Registrar e finalizar" : "Registrar atendimento"}
        </button>
      </div>
    </div>
  );
}

function ModalBase({ titulo, sub, onClose, children }) {
  const T = useTheme();
  return (
    <div onClick={e => { e.stopPropagation(); onClose(); }} style={{ position: "fixed", inset: 0, background: "#000a", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.bg, border: `1px solid ${T.border2}`, borderRadius: 14, maxWidth: 620, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px #000a", padding: "1.5rem" }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: T.text, marginBottom: 4 }}>{titulo}</div>
        {sub && <div style={{ fontSize: 12, color: T.text3, marginBottom: 16 }}>{sub}</div>}
        {children}
      </div>
    </div>
  );
}

function RespostaModal({ a, user, salvarAto, onClose }) {
  const s = useS();
  const [r, setR] = useState({ data: tod(), meio: CANAIS_SAC.includes(a.canal) ? a.canal : "Telefone", texto: "" });
  const [salvando, setSalvando] = useState(false);
  const gravar = async () => {
    if (!r.texto.trim()) { alert("Escreva o que foi dito ao cliente."); return; }
    setSalvando(true);
    const nova = novaResposta(r, user);
    const ok = await salvarAto({
      ...a,
      respostas: [...(a.respostas || []), nova],
      historico: [...(a.historico || []), entradaHistorico(`Orientação / resposta ao cliente (${nova.meio})`, user, [resumoAcrescimo(nova.texto)])],
    }, "Registrado.");
    setSalvando(false);
    if (ok) onClose();
  };
  return (
    <ModalBase titulo={`Orientação / resposta ao cliente — ${a.num}`} sub="Depois de gravada, não se altera. Um novo contato entra abaixo do anterior." onClose={onClose}>
      <G2 ch={<>
        <F lbl="Data" ch={<Inp type="date" value={r.data} max={tod()} onChange={e => setR(p => ({ ...p, data: e.target.value }))} />} />
        <F lbl="Meio" ch={<Sel value={r.meio} onChange={e => setR(p => ({ ...p, meio: e.target.value }))}>{CANAIS_SAC.map(c => <option key={c}>{c}</option>)}</Sel>} />
      </>} />
      <F lbl="O que foi dito ao cliente *" ch={<TA rows={5} value={r.texto} onChange={e => setR(p => ({ ...p, texto: e.target.value }))} placeholder="Ex.: informamos que o lote está em análise e enviaremos um produto novo..." />} />
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button style={s.btn} onClick={onClose}>Cancelar</button>
        <button style={s.btnA} disabled={salvando} onClick={gravar}>{salvando ? "Gravando..." : "Registrar"}</button>
      </div>
    </ModalBase>
  );
}

// Seção 7 da ficha: solução aplicada. Troca e reenvio pedem o endereço completo,
// que pode ser completado aqui mesmo.
function FinalizarModal({ a, rnc, user, salvar, onClose }) {
  const T = useTheme(); const s = useS();
  const [solucao, setSolucao] = useState("");
  const [detalhe, setDetalhe] = useState("");
  const [end, setEnd] = useState(() => enderecoDe(a));
  const [salvando, setSalvando] = useState(false);
  const comEnd = { ...a, ...end };
  const precisaEnd = SOLUCOES_COM_ENDERECO.includes(solucao);
  const pendencias = errosDoEncerramento(comEnd, { solucao, detalhe });
  const avisos = avisosDoEncerramento(a, rnc);

  const gravar = async () => {
    if (pendencias.length) return;
    setSalvando(true);
    const ok = await salvar({
      ...(precisaEnd ? comEnd : a),
      status: STATUS_SAC.FINALIZADO,
      solucao,
      conclusao: detalhe.trim(),
      encerradoPor: user.name,
      encerradoEm: tod(),
      historico: [...(a.historico || []), entradaHistorico("Atendimento finalizado", user, [`Solução: ${solucao}`, detalhe.trim() && resumoAcrescimo(detalhe)].filter(Boolean))],
    }, `${a.num} finalizado.`);
    setSalvando(false);
    if (ok) onClose();
  };

  return (
    <ModalBase titulo={`Finalizar ${a.num}`} sub="Finalizado, o atendimento fica fechado para alteração." onClose={onClose}>
      {avisos.map(av => (
        <div key={av} style={{ background: "#ffd16618", border: "1px solid #ffd16666", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 12.5, color: T.text }}>⚠️ {av}</div>
      ))}
      <G2 ch={<>
        <F lbl="Solução aplicada *" ch={<Sel value={solucao} onChange={e => setSolucao(e.target.value)}><option value="">Selecione...</option>{SOLUCOES_SAC.map(x => <option key={x}>{x}</option>)}</Sel>} />
        <span />
      </>} />
      {precisaEnd && <EnderecoCampos f={end} set={(k, v) => setEnd(p => ({ ...p, [k]: v }))} comCidade />}
      <F lbl={solucao === "Outra" ? "Descreva a solução *" : "Observação"} ch={
        <TA rows={3} value={detalhe} onChange={e => setDetalhe(e.target.value)} placeholder="Ex.: produto trocado, código de rastreio BR123..." />
      } />
      {pendencias.length > 0 && solucao && (
        <div style={{ background: "#ff4f6a14", border: "1px solid #ff4f6a55", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 12.5, color: "#ff4f6a" }}>
          <strong>Antes de finalizar:</strong>
          {pendencias.map(p => <div key={p}>• {p}</div>)}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button style={s.btn} onClick={onClose}>Cancelar</button>
        <button onClick={gravar} disabled={salvando || pendencias.length > 0} style={{ padding: "9px 20px", background: "#2ab84a", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, opacity: salvando || pendencias.length ? .5 : 1 }}>
          {salvando ? "Finalizando..." : "✓ Finalizar"}
        </button>
      </div>
    </ModalBase>
  );
}

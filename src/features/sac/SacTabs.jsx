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
  CANAIS_SAC, CLASSIFICACOES_SAC, SAC_SMETA, META_RESPOSTA_DIAS, LIMITE_RECORRENCIA_LOTE,
  classificacaoSac, prazoSac, contagemPorLote, mesmoLote, normLote, relatouReacao,
  errosDoRegistro, errosDoEncerramento, avisosDoEncerramento, novaResposta, descParaRNC, entradaHistorico,
} from "./sacLogic";

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export function SacTab({ view = "lista", ...props }) {
  if (view === "novo") return <NovoSacForm {...props} />;
  return <SacLista {...props} />;
}

function SacBadge({ status }) {
  const m = SAC_SMETA[status] || SAC_SMETA["Aberto"];
  return <span title={m.dica} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, textTransform: "uppercase", background: m.bg, color: m.c, whiteSpace: "nowrap" }}>
    <span style={{ width: 5, height: 5, borderRadius: "50%", background: m.c, display: "inline-block" }} />{status}
  </span>;
}

function ClassifChip({ c }) {
  const T = useTheme();
  if (!c) return <span style={{ fontSize: 11, color: T.text3 }}>a classificar</span>;
  const cor = c === "Evento adverso" ? T.red : c === "Queixa técnica" ? "#ff8c42" : T.text2;
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
  const [fClassif, setFClassif] = useState("");
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
    .filter(a => !fClassif || (fClassif === "__sem" ? !a.classificacao : a.classificacao === fClassif))
    .filter(a => {
      if (!busca.trim()) return true;
      const q = busca.toLowerCase();
      return [a.num, a.consumidorNome, a.produto, a.lote, a.relato, a.consumidorTelefone, a.consumidorEmail].some(x => String(x || "").toLowerCase().includes(q));
    });

  const abertos = atendimentos.filter(a => a.status !== "Encerrado");
  const kpis = [
    { l: "Aguardando classificação", n: atendimentos.filter(a => a.status === "Aberto").length, c: "#4fc3f7" },
    { l: "Em análise", n: atendimentos.filter(a => a.status === "Em análise").length, c: "#ffd166" },
    { l: `Atrasados (> ${META_RESPOSTA_DIAS} dias)`, n: abertos.filter(a => prazoSac(a)?.atrasado).length, c: "#ff8c42" },
    { l: "Reação relatada, em aberto", n: abertos.filter(relatouReacao).length, c: "#ff4f6a" },
  ];

  const colunas = [
    { key: "num", label: "Nº", render: a => <span style={{ fontWeight: 700, color: T.accent }}>{relatouReacao(a) && <span title="Consumidor relatou reação">🚨 </span>}{a.num}</span> },
    { key: "dataContato", label: "Contato", render: a => fmt(a.dataContato) },
    { key: "consumidorNome", label: "Consumidor" },
    { key: "produto", label: "Produto", maxWidth: 200 },
    { key: "lote", label: "Lote", render: a => {
      const n = porLote.get(normLote(a.lote)) || 0;
      return <span>{a.lote || "—"}{n > 1 && <span title={`${n} atendimentos citam este lote`} style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, color: n >= LIMITE_RECORRENCIA_LOTE ? "#ff4f6a" : "#ff8c42" }}>×{n}</span>}</span>;
    } },
    { key: "classificacao", label: "Classificação", render: a => <ClassifChip c={a.classificacao} /> },
    { key: "status", label: "Status", render: a => <SacBadge status={a.status} /> },
    { key: "prazo", label: "Prazo", sortable: false, render: a => <PrazoChip a={a} /> },
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
      sev: a.classificacao === "Evento adverso" ? "Crítica" : "Maior",
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
            <F lbl="Buscar" ch={<Inp placeholder="Nº, consumidor, produto, lote, relato..." value={busca} onChange={e => setBusca(e.target.value)} />} />
          </div>
          <div style={{ flex: "1 1 150px" }}>
            <F lbl="Status" ch={<Sel value={fStatus} onChange={e => setFStatus(e.target.value)}><option value="">Todos</option>{Object.keys(SAC_SMETA).map(x => <option key={x}>{x}</option>)}</Sel>} />
          </div>
          <div style={{ flex: "1 1 170px" }}>
            <F lbl="Classificação" ch={<Sel value={fClassif} onChange={e => setFClassif(e.target.value)}><option value="">Todas</option><option value="__sem">A classificar</option>{CLASSIFICACOES_SAC.map(c => <option key={c.id}>{c.id}</option>)}</Sel>} />
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
        rowAccent={a => relatouReacao(a) && a.status !== "Encerrado" ? "#ff4f6a" : undefined}
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
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

// ── Detalhe / triagem ──
function SacDetalhe({ a, atendimentos, rncs, user, perm, isAdmin, salvar, onClose, onAbrirRnc, onVerRnc, onExcluir }) {
  const T = useTheme(); const s = useS();
  const podeTratar = perm("tratarSAC");
  const aberto = a.status !== "Encerrado";
  const podeEditar = aberto && (podeTratar || a.registradoPor === user.name);
  const [editando, setEditando] = useState(false);
  const [modal, setModal] = useState(null); // "resposta" | "encerrar"
  const [classif, setClassif] = useState(a.classificacao || "");
  const [notif, setNotif] = useState({ decisao: "", data: tod(), protocolo: "", justificativa: "" });

  useEffect(() => { setClassif(a.classificacao || ""); setEditando(false); setModal(null); }, [a.id]);

  useEffect(() => {
    const esc = e => { if (e.key === "Escape" && !modal) onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [modal, onClose]);

  const rnc = a.rncId ? rncs.find(r => r.id === a.rncId) : null;
  const doLote = mesmoLote(a, atendimentos);
  const prazo = prazoSac(a);
  const cl = classificacaoSac(a.classificacao);

  const salvarClassificacao = async () => {
    if (!classif || classif === a.classificacao) return;
    const acao = a.classificacao ? `Classificação alterada: ${a.classificacao} → ${classif}` : `Classificado como ${classif}`;
    await salvar({
      ...a,
      classificacao: classif,
      status: a.status === "Aberto" ? "Em análise" : a.status,
      historico: [...(a.historico || []), entradaHistorico(acao, user)],
    }, `${a.num}: ${acao.toLowerCase()}.`);
  };

  const salvarNotificacao = async () => {
    if (!notif.decisao) return;
    if (notif.decisao === "Notificado" && !notif.protocolo.trim()) { alert("Informe o protocolo da notificação."); return; }
    if (notif.decisao === "Não notificado" && !notif.justificativa.trim()) { alert("Justifique por que não foi notificado."); return; }
    const reg = { ...notif, por: user.name, em: new Date().toISOString() };
    const det = notif.decisao === "Notificado" ? [`Protocolo: ${notif.protocolo}`, `Data: ${fmt(notif.data)}`] : [`Justificativa: ${notif.justificativa}`];
    await salvar({
      ...a,
      notificacaoVigilancia: reg,
      historico: [...(a.historico || []), entradaHistorico(`Vigilância sanitária: ${notif.decisao}`, user, det)],
    }, "Decisão sobre a notificação registrada.");
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "#000a", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.bg, border: `1px solid ${T.border2}`, borderRadius: 14, maxWidth: 720, width: "100%", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 20px 60px #000a" }}>
        <div style={{ padding: "1.1rem 1.5rem", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, position: "sticky", top: 0, background: T.bg, zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: T.accent }}>{a.num}</span>
            <SacBadge status={a.status} />
            <ClassifChip c={a.classificacao} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {podeEditar && !editando && (
              <button onClick={() => setEditando(true)} style={{ ...s.btn, fontSize: 11, padding: "6px 12px" }}>✏️ Editar</button>
            )}
            <button onClick={onClose} aria-label="Fechar" style={{ background: "none", border: "none", color: T.text3, cursor: "pointer", fontSize: 22, fontFamily: "inherit" }}>✕</button>
          </div>
        </div>

        <div style={{ padding: "1.2rem 1.5rem" }}>
          {relatouReacao(a) && (
            <Aviso cor="#ff4f6a">🚨 <strong>O consumidor relatou que alguém passou mal após o consumo.</strong>
              {aberto && a.classificacao !== "Evento adverso" && <> Trate como prioridade e avalie a classificação como <strong>Evento adverso</strong>.</>}
            </Aviso>
          )}
          {doLote.length > 0 && (
            <Aviso cor={doLote.length + 1 >= LIMITE_RECORRENCIA_LOTE ? "#ff4f6a" : "#ff8c42"}>
              {doLote.length + 1 >= LIMITE_RECORRENCIA_LOTE ? "⚠️ " : ""}<strong>{doLote.length + 1} atendimentos citam o lote {a.lote}</strong>
              {doLote.length + 1 >= LIMITE_RECORRENCIA_LOTE ? " — avalie se o lote precisa de investigação ampla ou recolhimento." : "."}
              <div style={{ marginTop: 4, color: T.text2 }}>{doLote.slice(0, 5).map(x => `${x.num} (${x.classificacao || "a classificar"})`).join(" · ")}</div>
            </Aviso>
          )}
          {prazo?.atrasado && (
            <Aviso cor="#ff8c42">Aberto há {prazo.dias} dias — a meta para responder o consumidor é {META_RESPOSTA_DIAS} dias.</Aviso>
          )}

          {editando
            ? <EdicaoSac a={a} user={user} salvar={salvar} onFim={() => setEditando(false)} />
            : <LeituraSac a={a} />}

          {/* Triagem */}
          {podeTratar && aberto && !editando && (
            <Bloco titulo="🧭 Classificação (Qualidade)">
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 220px" }}>
                  <Sel value={classif} onChange={e => setClassif(e.target.value)}>
                    <option value="">Selecione...</option>
                    {CLASSIFICACOES_SAC.map(c => <option key={c.id}>{c.id}</option>)}
                  </Sel>
                  {classificacaoSac(classif)?.dica && <div style={{ fontSize: 11, color: T.text3, marginTop: 4 }}>{classificacaoSac(classif).dica}</div>}
                </div>
                <button style={{ ...s.btnA, opacity: classif && classif !== a.classificacao ? 1 : .5 }} disabled={!classif || classif === a.classificacao} onClick={salvarClassificacao}>Salvar classificação</button>
              </div>
            </Bloco>
          )}

          {/* Evento adverso → decisão sobre notificação */}
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
                  <div style={{ fontSize: 12, color: T.text2, marginBottom: 8 }}>Registre se o evento foi notificado à vigilância sanitária e, se não, por quê.</div>
                  <G3 ch={<>
                    <F lbl="Decisão" ch={<Sel value={notif.decisao} onChange={e => setNotif(p => ({ ...p, decisao: e.target.value }))}><option value="">Selecione...</option><option>Notificado</option><option>Não notificado</option></Sel>} />
                    {notif.decisao === "Notificado" && <F lbl="Data" ch={<Inp type="date" value={notif.data} onChange={e => setNotif(p => ({ ...p, data: e.target.value }))} />} />}
                    {notif.decisao === "Notificado" && <F lbl="Protocolo" ch={<Inp value={notif.protocolo} onChange={e => setNotif(p => ({ ...p, protocolo: e.target.value }))} />} />}
                  </>} />
                  {notif.decisao === "Não notificado" && <F lbl="Justificativa" ch={<TA rows={2} value={notif.justificativa} onChange={e => setNotif(p => ({ ...p, justificativa: e.target.value }))} placeholder="Ex.: reação não relacionada ao produto após avaliação..." />} />}
                  {notif.decisao && <div style={{ textAlign: "right" }}><button style={s.btnA} onClick={salvarNotificacao}>Registrar decisão</button></div>}
                </div>
              ) : <div style={{ fontSize: 12, color: T.text3 }}>Ainda não registrada.</div>}
            </Bloco>
          )}

          {/* RNC */}
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

          {/* Respostas */}
          <Bloco titulo={`💬 Respostas ao consumidor (${(a.respostas || []).length})`}
            acao={podeTratar && aberto && !editando && <button style={{ ...s.btnA, fontSize: 11, padding: "6px 12px" }} onClick={() => setModal("resposta")}>+ Registrar resposta</button>}>
            {(a.respostas || []).length === 0
              ? <div style={{ fontSize: 12, color: T.text3 }}>Nenhuma resposta registrada ainda.</div>
              : <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {a.respostas.map(r => (
                  <div key={r.id} style={{ background: T.surf, borderLeft: `3px solid ${T.accent}`, borderRadius: "0 8px 8px 0", padding: "8px 12px" }}>
                    <div style={{ fontSize: 11, color: T.text3 }}>{fmt(r.data)} · {r.meio} · por {r.por}</div>
                    <div style={{ fontSize: 13, color: T.text, whiteSpace: "pre-wrap", marginTop: 3 }}>{r.texto}</div>
                  </div>
                ))}
              </div>}
          </Bloco>

          {a.status === "Encerrado" && (
            <Bloco titulo="✅ Conclusão">
              <div style={{ fontSize: 13, color: T.text, whiteSpace: "pre-wrap" }}>{a.conclusao}</div>
              <div style={{ fontSize: 11, color: T.text3, marginTop: 4 }}>Encerrado por {a.encerradoPor} em {fmt(a.encerradoEm)}</div>
            </Bloco>
          )}

          <div style={{ marginTop: 16, paddingTop: 10, borderTop: `1px solid ${T.border}`, fontSize: 11, color: T.text3 }}>
            Registrado por <strong style={{ color: T.text2 }}>{a.registradoPor}</strong> em {fmt(a.dataRegistro)}
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

        {podeTratar && aberto && !editando && (
          <div style={{ padding: "0.9rem 1.5rem", borderTop: `1px solid ${T.border}`, display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center", position: "sticky", bottom: 0, background: T.bg }}>
            {isAdmin && a.status === "Aberto"
              ? <button onClick={() => onExcluir(a)} style={{ background: "none", border: "none", color: "#ff4f6a", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>Excluir atendimento</button>
              : <span />}
            <button onClick={() => setModal("encerrar")} style={{ padding: "10px 20px", background: "#2ab84a", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700 }}>✓ Encerrar atendimento</button>
          </div>
        )}
      </div>

      {modal === "resposta" && <RespostaModal a={a} user={user} salvar={salvar} onClose={() => setModal(null)} />}
      {modal === "encerrar" && <EncerrarSacModal a={a} rnc={rnc} user={user} salvar={salvar} onClose={() => setModal(null)} />}
    </div>
  );
}

function LeituraSac({ a }) {
  const T = useTheme();
  return (
    <>
      <Bloco titulo="📞 Contato">
        <Linha l="Data do contato" v={fmt(a.dataContato)} />
        <Linha l="Canal" v={a.canal} />
        <Linha l="Consumidor" v={a.consumidorNome} />
        <Linha l="Telefone" v={a.consumidorTelefone} />
        <Linha l="E-mail" v={a.consumidorEmail} />
        <Linha l="Cidade / UF" v={[a.consumidorCidade, a.consumidorUF].filter(Boolean).join(" / ")} />
      </Bloco>
      <Bloco titulo="📦 Produto">
        <Linha l="Produto" v={a.produto} />
        <Linha l="Lote" v={a.lote} />
        <Linha l="Validade" v={a.validade} />
        <Linha l="Nota fiscal" v={a.nf} />
        <Linha l="Local de compra" v={a.localCompra} />
        <Linha l="Ainda tem o produto?" v={a.temAmostra} />
      </Bloco>
      <Bloco titulo="📝 Relato do consumidor">
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
  dataContato: "Data do contato", canal: "Canal", consumidorNome: "Consumidor", consumidorTelefone: "Telefone",
  consumidorEmail: "E-mail", consumidorCidade: "Cidade", consumidorUF: "UF", produto: "Produto", lote: "Lote",
  validade: "Validade", nf: "Nota fiscal", localCompra: "Local de compra", temAmostra: "Ainda tem o produto",
};

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
    delete erros.relato; delete erros.reacaoDesc;
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
      <CamposContatoProduto f={f} set={set} />
      <F lbl="Relato do consumidor" tip="O que já foi registrado não se altera. Para corrigir ou complementar, escreva o acréscimo." ch={
        <CampoHistoricoEdicao valorSalvo={a.relato} adicao={addRelato} setAdicao={setAddRelato} rows={3} placeholder="Ex.: consumidor ligou de novo e informou que..." />
      } />
      <F lbl="📎 Incluir anexos" ch={<AnexosUpload anexos={novosAnexos} setAnexos={setNovosAnexos} inputId="sac-edit-anexo" />} />
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button style={s.btn} onClick={onFim}>Cancelar</button>
        <button style={s.btnA} onClick={gravar}>💾 Salvar alterações</button>
      </div>
    </div>
  );
}

// Contato + produto: mesmos campos no registro e na edição.
function CamposContatoProduto({ f, set, err = {} }) {
  return (
    <>
      <SecTitle icon="📞" ch="Contato" />
      <G3 ch={<>
        <F lbl="Data do contato" ch={<Inp type="date" value={f.dataContato} max={tod()} onChange={e => set("dataContato", e.target.value)} />} />
        <F lbl="Canal" ch={<Sel value={f.canal} onChange={e => set("canal", e.target.value)}>{CANAIS_SAC.map(c => <option key={c}>{c}</option>)}</Sel>} />
        <F lbl="Nome do consumidor *" err={err.consumidorNome} ch={<Inp value={f.consumidorNome} onChange={e => set("consumidorNome", e.target.value)} />} />
      </>} />
      <G2 ch={<>
        <F lbl="Telefone" err={err.consumidorTelefone} tip="Telefone ou e-mail: ao menos um, para dar o retorno." ch={<MaskedInp mask="telefone" value={f.consumidorTelefone} onChange={e => set("consumidorTelefone", e.target.value)} placeholder="(00) 00000-0000" />} />
        <F lbl="E-mail" ch={<Inp type="email" value={f.consumidorEmail} onChange={e => set("consumidorEmail", e.target.value)} />} />
      </>} />
      <G2 ch={<>
        <F lbl="Cidade" ch={<Inp value={f.consumidorCidade} onChange={e => set("consumidorCidade", e.target.value)} />} />
        <F lbl="UF" ch={<Sel value={f.consumidorUF} onChange={e => set("consumidorUF", e.target.value)}><option value="">—</option>{UFS.map(u => <option key={u}>{u}</option>)}</Sel>} />
      </>} />

      <SecTitle icon="📦" ch="Produto" />
      <G3 ch={<>
        <F lbl="Produto *" err={err.produto} ch={<Inp value={f.produto} onChange={e => set("produto", e.target.value)} placeholder="Nome como está na embalagem" />} />
        <F lbl="Lote" tip="Está impresso na embalagem, perto da validade. É o dado mais importante para investigar." ch={<Inp value={f.lote} onChange={e => set("lote", e.target.value)} />} />
        <F lbl="Validade" ch={<Inp value={f.validade} onChange={e => set("validade", e.target.value)} placeholder="Ex.: 08/2027" />} />
      </>} />
      <G3 ch={<>
        <F lbl="Nota fiscal (nº)" ch={<Inp value={f.nf} onChange={e => set("nf", e.target.value)} />} />
        <F lbl="Local de compra" ch={<Inp value={f.localCompra} onChange={e => set("localCompra", e.target.value)} placeholder="Farmácia, loja, site..." />} />
        <F lbl="Ainda tem o produto?" tip="Se tiver, a Qualidade pode pedir que envie para análise." ch={<Sel value={f.temAmostra} onChange={e => set("temAmostra", e.target.value)}><option value="">Não informado</option><option>Sim</option><option>Não</option></Sel>} />
      </>} />
    </>
  );
}

// ── Registro (recepção) ──
function NovoSacForm({ user, toast_, setTab, doSaveSac }) {
  const T = useTheme(); const s = useS();
  const [f, setF] = useState({
    dataContato: tod(), canal: "Telefone", consumidorNome: "", consumidorTelefone: "", consumidorEmail: "",
    consumidorCidade: "", consumidorUF: "", produto: "", lote: "", validade: "", nf: "", localCompra: "", temAmostra: "",
    relato: "", teveReacao: "Não", reacaoDesc: "",
  });
  const [anexos, setAnexos] = useState([]);
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const erros = tentou ? errosDoRegistro(f) : {};

  const registrar = async () => {
    setTentou(true);
    if (Object.keys(errosDoRegistro(f)).length) { toast_("Faltam informações — veja os campos em vermelho.", "red"); return; }
    setSalvando(true);
    try {
      const num = await incrementSacCounter();
      const agora = new Date();
      const at = {
        id: `sac-${agora.getTime()}`,
        num,
        ...f,
        consumidorNome: f.consumidorNome.trim(),
        relato: f.relato.trim(),
        reacaoDesc: f.teveReacao === "Sim" ? f.reacaoDesc.trim() : "",
        anexos,
        respostas: [],
        status: "Aberto",
        classificacao: "",
        registradoPor: user.name,
        dataRegistro: tod(),
        createdAt: agora.getTime(),
        historico: [entradaHistorico("Atendimento registrado", user, f.teveReacao === "Sim" ? ["Consumidor relatou reação após o consumo"] : null, agora)],
      };
      await doSaveSac(at);
      toast_(`${num} registrado!`, "green");
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
          Registre o contato do consumidor como ele chegou. A Qualidade classifica, responde e, se for problema no produto, abre a investigação.
          Quem registra e a data de registro são preenchidos automaticamente.
        </div>
        <CamposContatoProduto f={f} set={set} err={erros} />

        <SecTitle icon="📝" ch="O que aconteceu" />
        <F lbl="Relato do consumidor *" err={erros.relato} tip="Escreva com as palavras do consumidor: o que notou, quando, quantas unidades." ch={
          <TA rows={4} value={f.relato} onChange={e => set("relato", e.target.value)} placeholder="Ex.: abriu o frasco e 3 cápsulas estavam quebradas e grudadas..." />
        } />
        <F lbl="Alguém passou mal ou teve reação depois de consumir?" ch={
          <Sel value={f.teveReacao} onChange={e => set("teveReacao", e.target.value)}><option>Não</option><option>Sim</option><option>Não sabe</option></Sel>
        } />
        {f.teveReacao === "Sim" && (
          <>
            <div style={{ background: "#ff4f6a14", border: "1px solid #ff4f6a55", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 12.5, color: "#ff4f6a" }}>
              🚨 Este atendimento vai aparecer em destaque para a Qualidade. Se possível, avise a Qualidade também por telefone.
            </div>
            <F lbl="O que a pessoa sentiu? *" err={erros.reacaoDesc} tip="Sintomas, quando começaram, se procurou atendimento médico." ch={
              <TA rows={3} value={f.reacaoDesc} onChange={e => set("reacaoDesc", e.target.value)} placeholder="Ex.: dor de estômago 1h depois de tomar; não procurou médico..." />
            } />
          </>
        )}
        <F lbl="📎 Fotos, nota fiscal e documentos" ch={<AnexosUpload anexos={anexos} setAnexos={setAnexos} inputId="sac-anexo-input" />} />
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
        <button onClick={() => setTab("sac")} style={{ ...s.btn, padding: "11px 20px" }}>Cancelar</button>
        <button onClick={registrar} disabled={salvando} style={{ padding: "11px 24px", background: "#2ab84a", color: "#fff", border: "none", borderRadius: 8, cursor: salvando ? "default" : "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, opacity: salvando ? .6 : 1 }}>{salvando ? "Registrando..." : "Registrar atendimento"}</button>
      </div>
    </div>
  );
}

function ModalBase({ titulo, sub, onClose, children }) {
  const T = useTheme();
  return (
    <div onClick={e => { e.stopPropagation(); onClose(); }} style={{ position: "fixed", inset: 0, background: "#000a", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.bg, border: `1px solid ${T.border2}`, borderRadius: 14, maxWidth: 560, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px #000a", padding: "1.5rem" }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: T.text, marginBottom: 4 }}>{titulo}</div>
        {sub && <div style={{ fontSize: 12, color: T.text3, marginBottom: 16 }}>{sub}</div>}
        {children}
      </div>
    </div>
  );
}

function RespostaModal({ a, user, salvar, onClose }) {
  const s = useS();
  const [r, setR] = useState({ data: tod(), meio: a.canal && CANAIS_SAC.includes(a.canal) ? a.canal : "Telefone", texto: "" });
  const [salvando, setSalvando] = useState(false);
  const gravar = async () => {
    if (!r.texto.trim()) { alert("Escreva o que foi respondido ao consumidor."); return; }
    setSalvando(true);
    const nova = novaResposta(r, user);
    const ok = await salvar({
      ...a,
      respostas: [...(a.respostas || []), nova],
      historico: [...(a.historico || []), entradaHistorico(`Resposta ao consumidor (${nova.meio})`, user, [resumoAcrescimo(nova.texto)])],
    }, "Resposta registrada.");
    setSalvando(false);
    if (ok) onClose();
  };
  return (
    <ModalBase titulo={`Resposta ao consumidor — ${a.num}`} sub="Depois de gravada, a resposta não se altera. Uma nova resposta entra abaixo da anterior." onClose={onClose}>
      <G2 ch={<>
        <F lbl="Data" ch={<Inp type="date" value={r.data} max={tod()} onChange={e => setR(p => ({ ...p, data: e.target.value }))} />} />
        <F lbl="Meio" ch={<Sel value={r.meio} onChange={e => setR(p => ({ ...p, meio: e.target.value }))}>{CANAIS_SAC.map(c => <option key={c}>{c}</option>)}</Sel>} />
      </>} />
      <F lbl="O que foi respondido *" ch={<TA rows={5} value={r.texto} onChange={e => setR(p => ({ ...p, texto: e.target.value }))} placeholder="Ex.: informamos que o lote está em análise e enviaremos um produto novo..." />} />
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button style={s.btn} onClick={onClose}>Cancelar</button>
        <button style={s.btnA} disabled={salvando} onClick={gravar}>{salvando ? "Gravando..." : "Registrar resposta"}</button>
      </div>
    </ModalBase>
  );
}

function EncerrarSacModal({ a, rnc, user, salvar, onClose }) {
  const T = useTheme(); const s = useS();
  const [conclusao, setConclusao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const pendencias = errosDoEncerramento(a, conclusao || "x");
  const avisos = avisosDoEncerramento(a, rnc);
  const gravar = async () => {
    const erros = errosDoEncerramento(a, conclusao);
    if (erros.length) { alert(erros.join("\n")); return; }
    setSalvando(true);
    const ok = await salvar({
      ...a,
      status: "Encerrado",
      conclusao: conclusao.trim(),
      encerradoPor: user.name,
      encerradoEm: tod(),
      historico: [...(a.historico || []), entradaHistorico("Atendimento encerrado", user, [resumoAcrescimo(conclusao)])],
    }, `${a.num} encerrado.`);
    setSalvando(false);
    if (ok) onClose();
  };
  return (
    <ModalBase titulo={`Encerrar ${a.num}`} sub="Encerrado, o atendimento fica fechado para alteração." onClose={onClose}>
      {pendencias.length > 0 && (
        <div style={{ background: "#ff4f6a14", border: "1px solid #ff4f6a55", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 12.5, color: "#ff4f6a" }}>
          <strong>Antes de encerrar:</strong>
          {pendencias.map(p => <div key={p}>• {p}</div>)}
        </div>
      )}
      {avisos.map(av => (
        <div key={av} style={{ background: "#ffd16618", border: "1px solid #ffd16666", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 12.5, color: T.text }}>⚠️ {av}</div>
      ))}
      <F lbl="Conclusão *" tip="O desfecho em uma ou duas frases: o que se concluiu e o que foi feito pelo consumidor." ch={
        <TA rows={4} value={conclusao} onChange={e => setConclusao(e.target.value)} placeholder="Ex.: queixa procedente, lote investigado na NC-..., produto substituído." />
      } />
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button style={s.btn} onClick={onClose}>Cancelar</button>
        <button onClick={gravar} disabled={salvando || pendencias.length > 0} style={{ padding: "9px 20px", background: "#2ab84a", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, opacity: salvando || pendencias.length ? .5 : 1 }}>
          {salvando ? "Encerrando..." : "✓ Encerrar"}
        </button>
      </div>
    </ModalBase>
  );
}

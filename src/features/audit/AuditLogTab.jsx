import React, { useState, useEffect } from "react";
import { subscribeCollection } from "../../firebase";
import { useTheme } from "../../core/theme";
import { useS } from "../../shared/styles";
import { usePagination } from "../../shared/ui";
import { Inp, Pagination, SecTitle, Sel } from "../../shared/ui";

export function AuditLogTab({ user }) {
  const T = useTheme(); const s = useS();
  const [logs,     setLogs]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filtroCol,  setFiltroCol]  = useState("todos");
  const [filtroAcao, setFiltroAcao] = useState("todos");
  const [filtroUser, setFiltroUser] = useState("");
  const [busca,      setBusca]      = useState("");
  const [sel,        setSel]        = useState(null);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim,    setDataFim]    = useState("");

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 3000);
    let unsub;
    try {
      unsub = subscribeCollection("audit_log", list => {
        clearTimeout(t);
        setLogs(list.sort((a,b) => (b.ts||0) - (a.ts||0)));
        setLoading(false);
      });
    } catch(e) {
      clearTimeout(t);
      setLoading(false);
      console.warn("[AuditLog]", e);
    }
    return () => { clearTimeout(t); unsub && unsub(); };
  }, []);

  const ACOES = [...new Set(logs.map(l => l.acao).filter(Boolean))].sort();
  const USERS = [...new Set(logs.map(l => l.usuario).filter(Boolean))].sort();

  const filtrados = logs.filter(l => {
    if (filtroCol  !== "todos" && l.colecao  !== filtroCol)  return false;
    if (filtroAcao !== "todos" && l.acao     !== filtroAcao) return false;
    if (filtroUser && l.usuario !== filtroUser)               return false;
    if (busca && !`${l.docNome||""} ${l.docId||""} ${l.usuario||""}`.toLowerCase().includes(busca.toLowerCase())) return false;
    if (dataInicio && l.data < dataInicio) return false;
    if (dataFim    && l.data > dataFim + "T23:59:59") return false;
    return true;
  });

  const { paginated: pgLogs, page: pgN, total: pgT, setPage: setPgN } = usePagination(filtrados, 25);

  const ACAO_COR = {
    "Criou RNC":           "#2ab84a", "Criou Documento":     "#2ab84a",
    "Editou RNC":          "#4fc3f7", "Editou Documento":    "#4fc3f7",
    "Excluiu RNC":         "#ff4f6a", "Excluiu Documento":   "#ff4f6a",
    "Assinou como Elaborador": "#a78bfa", "Assinou como Revisor": "#ffd166",
    "Assinou como Aprovador":  "#2ab84a",
    "Nova Revisão":        "#ff8c42", "Marcou como Obsoleto": "#ff4f6a",
    "Registrou Treinamento": "#5dd4b0",
    // CQ Análises
    "Criou Análise CQ":    "#2ab84a", "Editou Análise CQ":    "#4fc3f7", "Excluiu Análise CQ":    "#ff4f6a",
    // CQ Materiais
    "Criou Material CQ":   "#2ab84a", "Editou Material CQ":   "#4fc3f7", "Excluiu Material CQ":   "#ff4f6a",
    // Fornecedores
    "Criou Fornecedor":    "#2ab84a", "Editou Fornecedor":    "#4fc3f7", "Excluiu Fornecedor":    "#ff4f6a",
    // Auditorias
    "Criou Auditoria":     "#2ab84a", "Editou Auditoria":     "#4fc3f7", "Excluiu Auditoria":     "#ff4f6a",
    // FMEA
    "Criou item FMEA":     "#2ab84a", "Editou item FMEA":     "#4fc3f7", "Excluiu item FMEA":     "#ff4f6a",
    "Gerou FMEA por IA":   "#a78bfa",
    // Laudos
    "Criou Laudo":         "#2ab84a", "Editou Laudo":         "#4fc3f7", "Excluiu Laudo":         "#ff4f6a",
    "Assinou Laudo (Analista)": "#a78bfa", "Assinou Laudo (RT)": "#ffd166",
    // Usuários / Sessões
    "Criou Usuário":       "#2ab84a", "Editou Usuário":       "#4fc3f7", "Excluiu Usuário":       "#ff4f6a",
    "Login":               "#5dd4b0", "Logout Manual":        "#ff8c42", "Logout por Inatividade": "#ffd166",
  };

  const corAcao = (acao) => {
    for (const [key, cor] of Object.entries(ACAO_COR)) {
      if (acao?.includes(key)) return cor;
    }
    return T.text3;
  };

  const fmtDataHora = (iso) => {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" });
    } catch { return iso; }
  };

  const exportCSV = () => {
    const header = ["Data/Hora","Usuário","E-mail","Ação","Coleção","Documento","ID"];
    const rows = filtrados.map(l => [
      fmtDataHora(l.data), l.usuario, l.email, l.acao,
      l.colecao === "rncs" ? "RNCs" : l.colecao === "gestao_docs" ? "Gestão de Docs" : l.colecao === "cq_analises" ? "CQ Análises" : l.colecao === "cq_materiais" ? "CQ Materiais" : l.colecao === "fornecedores" ? "Fornecedores" : l.colecao === "homologacoes" ? "Homologações" : l.colecao === "auditorias" ? "Auditorias" : l.colecao === "fmea" ? "FMEA" : l.colecao === "laudos" ? "Laudos" : l.colecao === "usuarios" ? "Usuários" : l.colecao || "—",
      l.docNome, l.docId
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v||"").replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `auditoria_${new Date().toISOString().split("T")[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  if (sel) return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
        <button style={s.btn} onClick={()=>setSel(null)}>← Voltar</button>
        <h2 style={{ fontSize:16, fontWeight:700, color:T.text, margin:0 }}>Detalhe do Registro</h2>
      </div>
      <div style={s.card}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:10, marginBottom:16 }}>
          {[
            ["Data/Hora",  fmtDataHora(sel.data)],
            ["Usuário",    sel.usuario],
            ["E-mail",     sel.email],
            ["Ação",       sel.acao],
            ["Coleção",    sel.colecao === "rncs" ? "RNCs" : sel.colecao === "gestao_docs" ? "Gestão de Docs" : sel.colecao === "cq_analises" ? "CQ Análises" : sel.colecao === "cq_materiais" ? "CQ Materiais" : sel.colecao === "fornecedores" ? "Fornecedores" : sel.colecao === "homologacoes" ? "Homologações" : sel.colecao === "auditorias" ? "Auditorias" : sel.colecao === "fmea" ? "FMEA" : sel.colecao === "laudos" ? "Laudos" : sel.colecao === "usuarios" ? "Usuários / Sessões" : sel.colecao || "—"],
            ["Documento",  sel.docNome],
            ["ID",         sel.docId],
          ].map(([k,v]) => (
            <div key={k} style={{ background:T.surf, borderRadius:8, padding:"8px 12px" }}>
              <div style={{ fontSize:10, color:T.text3, fontWeight:700, textTransform:"uppercase", marginBottom:2 }}>{k}</div>
              <div style={{ fontSize:12, color:T.text, fontWeight:600, wordBreak:"break-all" }}>{v||"—"}</div>
            </div>
          ))}
        </div>
        <span style={{ padding:"4px 12px", borderRadius:20, fontSize:11, fontWeight:700, background:corAcao(sel.acao)+"22", color:corAcao(sel.acao) }}>{sel.acao}</span>
      </div>
      {(sel.dadosAntes || sel.dadosDepois) && (
        <div style={s.card}>
          <SecTitle icon="🔍" ch="Dados Alterados" />
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            {["dadosAntes","dadosDepois"].map(campo => (
              <div key={campo}>
                <div style={{ fontSize:11, fontWeight:700, color:campo==="dadosAntes"?T.red||"#ff4f6a":T.accent, textTransform:"uppercase", marginBottom:6 }}>
                  {campo==="dadosAntes" ? "⬅️ Antes" : "➡️ Depois"}
                </div>
                <pre style={{ background:T.surf, border:`1px solid ${T.border}`, borderRadius:8, padding:"10px 12px", fontSize:10, color:T.text2, overflow:"auto", maxHeight:300, whiteSpace:"pre-wrap", wordBreak:"break-all", margin:0 }}>
                  {sel[campo] ? JSON.stringify(JSON.parse(sel[campo]), null, 2) : "—"}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div>
      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))", gap:10, marginBottom:16 }}>
        {[
          { label:"Total",         value:logs.length,                                    icon:"📋", color:T.text2 },
          { label:"RNCs",          value:logs.filter(l=>l.colecao==="rncs").length,      icon:"🔴", color:"#ff4f6a" },
          { label:"CQ Análises",   value:logs.filter(l=>l.colecao==="cq_analises").length,icon:"🧪", color:"#5dd4b0" },
          { label:"Exclusões",     value:logs.filter(l=>l.acao?.includes("Excluiu")).length,icon:"🗑️", color:"#ff8c42" },
          { label:"Sessões",       value:logs.filter(l=>l.colecao==="usuarios" && (l.acao==="Login"||l.acao?.includes("Logout"))).length, icon:"🔐", color:"#a78bfa" },
          { label:"Hoje",          value:logs.filter(l=>l.data?.startsWith(new Date().toISOString().split("T")[0])).length, icon:"📅", color:T.blue||"#4fc3f7" },
        ].map(stat => (
          <div key={stat.label} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:"12px 14px", textAlign:"center" }}>
            <div style={{ fontSize:20, marginBottom:4 }}>{stat.icon}</div>
            <div style={{ fontSize:22, fontWeight:800, color:stat.color }}>{stat.value}</div>
            <div style={{ fontSize:10, color:T.text3, fontWeight:600, textTransform:"uppercase" }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:12, alignItems:"center" }}>
        <div style={{ position:"relative" }}>
          <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:T.text3, fontSize:13 }}>🔍</span>
          <input placeholder="Buscar documento, usuário..." value={busca} onChange={e=>setBusca(e.target.value)} style={{ ...s.inp, paddingLeft:30, width:200, fontSize:12 }} />
        </div>
        <Sel value={filtroCol} onChange={e=>setFiltroCol(e.target.value)}>
          <option value="todos">Todas as coleções</option>
          <option value="rncs">RNCs</option>
          <option value="gestao_docs">Gestão de Docs</option>
          <option value="cq_analises">CQ Análises</option>
          <option value="cq_materiais">CQ Materiais</option>
          <option value="fornecedores">Fornecedores</option>
          <option value="homologacoes">Homologações</option>
          <option value="auditorias">Auditorias</option>
          <option value="fmea">FMEA</option>
          <option value="laudos">Laudos</option>
          <option value="usuarios">Usuários / Sessões</option>
        </Sel>
        <Sel value={filtroAcao} onChange={e=>setFiltroAcao(e.target.value)}>
          <option value="todos">Todas as ações</option>
          {ACOES.map(a => <option key={a} value={a}>{a}</option>)}
        </Sel>
        <Sel value={filtroUser} onChange={e=>setFiltroUser(e.target.value)}>
          <option value="">Todos os usuários</option>
          {USERS.map(u => <option key={u} value={u}>{u}</option>)}
        </Sel>
        <Inp type="date" value={dataInicio} onChange={e=>setDataInicio(e.target.value)} sx={{ fontSize:11, width:130 }} />
        <Inp type="date" value={dataFim}    onChange={e=>setDataFim(e.target.value)}    sx={{ fontSize:11, width:130 }} />
        <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
          <button style={{ ...s.btn, fontSize:11 }} onClick={()=>{ setFiltroCol("todos"); setFiltroAcao("todos"); setFiltroUser(""); setBusca(""); setDataInicio(""); setDataFim(""); }}>Limpar</button>
          <button style={{ ...s.btnA, fontSize:11 }} onClick={exportCSV}>⬇️ CSV</button>
        </div>
      </div>

      <div style={{ fontSize:11, color:T.text3, marginBottom:8 }}>{filtrados.length} registro(s) encontrado(s)</div>

      {loading ? (
        <div style={{ textAlign:"center", padding:"3rem", color:T.text2 }}>Carregando trilha de auditoria...</div>
      ) : filtrados.length === 0 ? (
        <div style={{ textAlign:"center", padding:"3rem", color:T.text3 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🛡️</div>
          <div>{logs.length === 0 ? "Nenhuma ação registrada ainda." : "Nenhum resultado para os filtros."}</div>
        </div>
      ) : (
        <>
        {pgLogs.map(l => (
          <div key={l.id} onClick={()=>setSel(l)} className="rnc-row"
            style={{ background:T.card, border:`1px solid ${T.border}`, borderLeft:`3px solid ${corAcao(l.acao)}`, borderRadius:10, padding:"10px 14px", marginBottom:6, cursor:"pointer", display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
            <div style={{ width:36, height:36, borderRadius:8, background:corAcao(l.acao)+"20", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>
              {l.colecao==="rncs" ? "🔴" : l.colecao==="gestao_docs" ? "🗂️" : l.colecao==="cq_analises" ? "🧪" : l.colecao==="cq_materiais" ? "📦" : l.colecao==="fornecedores" ? "🏭" : l.colecao==="auditorias" ? "🔍" : l.colecao==="fmea" ? "⚠️" : l.colecao==="laudos" ? "📋" : l.colecao==="usuarios" ? "👤" : "📌"}
            </div>
            <div style={{ flex:1, minWidth:150 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                <span style={{ fontSize:11, padding:"2px 8px", borderRadius:12, background:corAcao(l.acao)+"22", color:corAcao(l.acao), fontWeight:700 }}>{l.acao}</span>
                <span style={{ fontSize:13, fontWeight:600, color:T.text }}>{l.docNome}</span>
              </div>
              <div style={{ fontSize:11, color:T.text2, marginTop:2 }}>
                {l.usuario} · {l.email} · {fmtDataHora(l.data)}
              </div>
            </div>
            <div style={{ fontSize:10, color:T.text3, background:T.surf, padding:"2px 8px", borderRadius:8, flexShrink:0 }}>
              {l.colecao === "rncs" ? "RNC" : "Doc"}
            </div>
          </div>
        ))}
        <Pagination page={pgN} total={pgT} setPage={setPgN}/>
        </>
      )}
    </div>
  );
}

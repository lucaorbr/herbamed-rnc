import React, { useState, useEffect } from "react";
import { createElectronicSignature, incrementCounter, peekDailyCounter, subscribeCollection } from "../../firebase";
import { SEVMETA, SMETA, TIPOC } from "../../core/status";
import { useFormal, useTheme } from "../../core/theme";
import { fmt, genNum, past, sigCodigo, tod } from "../../core/utils";
import { exportRNCPDF } from "../pdf/pdfExports";
import { askClaude } from "../../services/aiClient";
import { isExternalStorageUrl, uploadStoredFile } from "../../services/localFileStorage";
import { useS } from "../../shared/styles";
import { usePagination } from "../../shared/ui";
import { Badge, Divider, F, G2, G3, Inp, Pagination, SecTitle, Sel, SevB, StatusBadge, TA } from "../../shared/ui";
import { AIPanel } from "../ai/AIPanel";
import { AssinaturaModal } from "../pdf/pdfExports";

export function HomeTab({ rncs, user, setTab }) {
  const formal = useFormal();
  const [ipcPendentes, setIpcPendentes] = useState(0);
  const [laudosPendentes, setLaudosPendentes] = useState(0);
  useEffect(() => {
    const u1 = subscribeCollection("ipc_registros", list => setIpcPendentes(list.filter(r=>r.status==="Pendente").length));
    const u2 = subscribeCollection("laudos", list => setLaudosPendentes(list.filter(l=>!l.assinaturaRT&&l.status!=="Rascunho").length));
    return () => { u1&&u1(); u2&&u2(); };
  }, []);
  const T = useTheme(); const s = useS();
  const [slide, setSlide] = useState(0);
  const STORE_URL = "https://www.lojaherbamed.com.br/";

  const BANNERS = [
    { src: "/banner1.png", alt: "Novos Lançamentos Herbamed" },
    { src: "/banner2.png", alt: "FlexiGold — Colágeno Tipo II" },
    { src: "/banner3.png", alt: "Os Favoritos da Gio" },
    { src: "/banner4.png", alt: "O Melhor da Suplementação" },
  ];

  // Auto-slide
  useEffect(() => {
    const t = setInterval(() => setSlide(s => (s + 1) % BANNERS.length), 4500);
    return () => clearInterval(t);
  }, []);

  // Stats
  const abertas   = rncs.filter(x => x.status === "Aberta").length;
  const vencidas  = rncs.filter(x => x.prazoAC && x.prazoAC < tod() && x.status !== "Eficaz" && x.status !== "Ineficaz").length;
  const eficazes  = rncs.filter(x => x.status === "Eficaz").length;
  const criticas  = rncs.filter(x => x.sev === "Crítica" && x.status !== "Eficaz").length;
  const taxaEf    = rncs.length > 0 ? Math.round(eficazes / rncs.length * 100) : 0;
  const minhas    = rncs.filter(x => x.resp === user.name && x.status !== "Eficaz" && x.status !== "Ineficaz");
  const recentes  = [...rncs].sort((a, b) => (b.createdAt||0) - (a.createdAt||0)).slice(0, 5);

  // Saudação
  const hora = new Date().getHours();
  const saud = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

  return (
    <div>
      <style>{`
        @keyframes slideLeft{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)}}
        @keyframes fadeUp2{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        .banner-dot:hover{transform:scale(1.3);}
        .action-card:hover{transform:translateY(-3px);box-shadow:0 8px 28px rgba(0,0,0,.3)!important;}
        .rnc-item-home:hover{background:${T.card2}!important;}
      `}</style>

      {/* ── HERO — Boas vindas + KPIs ── */}
      <div style={{ background:`linear-gradient(135deg,${T.surf} 0%,${T.card} 100%)`, padding:"2rem 2rem 1.5rem", borderBottom:`1px solid ${T.border}` }}>
        <div style={{ marginBottom:"1.5rem" }}>
          <div style={{ animation:"fadeUp2 .4s ease" }}>
            <div style={{ fontSize:11, color:T.text3, textTransform:"uppercase", letterSpacing:".1em", marginBottom:6 }}>{saud},</div>
            <div style={{ fontSize:26, fontWeight:800, color:T.text, lineHeight:1.2, marginBottom:6 }}>
              {user.name.split(" ")[0]}{!formal && " 👋"}
            </div>
            <div style={{ fontSize:13, color:T.text2, lineHeight:1.5 }}>
              {abertas > 0
                ? <>Você tem <span style={{ color:"#ff4f6a", fontWeight:700 }}>{abertas} RNC{abertas > 1 ? "s" : ""} aberta{abertas > 1 ? "s" : ""}</span> aguardando ação.</>
                : vencidas > 0
                ? <>⚠️ <span style={{ color:T.yellow, fontWeight:700 }}>{vencidas} prazo{vencidas > 1 ? "s" : ""} vencido{vencidas > 1 ? "s" : ""}</span> — ação urgente necessária.</>
                : <span style={{ color:T.accent, fontWeight:500 }}>✓ Tudo em dia! Nenhuma pendência crítica.</span>
              }
            </div>
          </div>
        </div>

        {/* KPI pills */}
        <div className="home-kpis">
          {[
            { l:"Total RNCs",    n:rncs.length,  c:T.accent,  icon:"📋", action:()=>setTab("lista") },
            { l:"Abertas",       n:abertas,       c:"#ff4f6a", icon:"🔴", action:()=>setTab("lista") },
            { l:"Críticas",      n:criticas,      c:"#ff8c42", icon:"⚡", action:()=>setTab("lista") },
            { l:"Taxa Eficácia", n:`${taxaEf}%`,  c:taxaEf>=70?T.accent:"#ff8c42", icon:"✅", action:()=>setTab("dashboard") },
            { l:"Prazos Vencidos",n:vencidas,     c:vencidas>0?"#ffd166":T.text3, icon:"⏰", action:()=>setTab("lista") },
          ].map(({ l, n, c, icon, action }) => (
            <div key={l} onClick={action} className="action-card" style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:12, padding:"12px 14px", cursor:"pointer", transition:"all .2s", boxShadow:`0 2px 12px rgba(0,0,0,.2)` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                <span style={{ fontSize:18 }}>{icon}</span>
                <span style={{ fontSize:22, fontWeight:800, color:c }}>{n}</span>
              </div>
              <div style={{ fontSize:11, color:T.text2, fontWeight:500 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="home-body" style={{ padding:"1.5rem" }}>

        {/* LEFT */}
        <div>
          {/* Ações rápidas */}
          <div style={{ marginBottom:"1.5rem" }}>
            <div style={{ fontSize:12, fontWeight:700, color:T.text3, textTransform:"uppercase", letterSpacing:".08em", marginBottom:10 }}>Ações rápidas</div>
            <div className="home-actions">
              {[
                { icon:"➕", svg:<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>, label:"Nova RNC",    color:"#2ab84a", action:()=>setTab("nova") },
                { icon:"📊", svg:<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>, label:"Dashboard",   color:"#4fc3f7", action:()=>setTab("dashboard") },
                { icon:"📑", svg:<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>, label:"Relatórios",  color:"#a78bfa", action:()=>setTab("relatorios") },
                { icon:"📋", svg:<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2"/></svg>, label:"Ver Registros",color:"#ff8c42",action:()=>setTab("lista") },
              ].map(({ icon, svg, label, color, action }) => (
                <button key={label} onClick={action} className="action-card" style={{ background:T.card, border:`1px solid ${color}22`, borderRadius:12, padding:"1rem", cursor:"pointer", fontFamily:"inherit", textAlign:"center", transition:"all .2s", boxShadow:`0 0 20px ${color}10` }}>
                  <div style={{ fontSize:28, marginBottom:6, color, display:"flex", alignItems:"center", justifyContent:"center" }}>{formal ? svg : icon}</div>
                  <div style={{ fontSize:12, fontWeight:600, color:T.text }}>{label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Minha fila */}
          <div style={{ ...s.card, marginBottom:"1.5rem" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
              <div style={{ fontSize:13, fontWeight:700, color:T.text }}>{formal ? "" : "👤 "}Minha fila de trabalho</div>
              <span style={{ fontSize:11, color:T.text3 }}>{minhas.length} pendente(s)</span>
            </div>
            {minhas.length === 0 ? (
              <div style={{ textAlign:"center", padding:"1.5rem", color:T.text3, fontSize:13 }}>
                <div style={{ fontSize:32, marginBottom:8, opacity:.4 }}>✅</div>
                Nenhuma RNC pendente atribuída a você!
              </div>
            ) : minhas.slice(0, 4).map(r => (
              <div key={r.id} className="rnc-item-home" onClick={() => setTab("lista")} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 12px", borderRadius:10, marginBottom:6, background:T.surf, border:`1px solid ${T.border}`, borderLeft:`3px solid ${SMETA[r.status]?.dot||T.accent}`, cursor:"pointer", transition:"all .15s" }}>
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                    <span style={{ fontSize:11, fontWeight:700, color:T.accent }}>{r.num}</span>
                    <SevB s={r.sev} />
                    <Badge s={r.status} />
                  </div>
                  <div style={{ fontSize:12, color:T.text2 }}>{r.desc?.substring(0, 55)}...</div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0, marginLeft:12 }}>
                  {r.prazoAC && <div style={{ fontSize:10, color:past(r.prazoAC)?"#ff4f6a":T.text3, fontWeight:past(r.prazoAC)?700:400 }}>{past(r.prazoAC)?"⚠ VENCIDO":fmt(r.prazoAC)}</div>}
                </div>
              </div>
            ))}
            {minhas.length > 4 && <div style={{ fontSize:11, color:T.accent, textAlign:"center", cursor:"pointer", marginTop:4 }} onClick={() => setTab("lista")}>Ver todas ({minhas.length}) →</div>}
          </div>

          {/* Atividade recente */}
          <div style={s.card}>
            <div style={{ fontSize:13, fontWeight:700, color:T.text, marginBottom:"1rem" }}>{formal ? "" : "🕐 "}Atividade recente</div>
            {recentes.length === 0 ? (
              <div style={{ textAlign:"center", padding:"1.5rem", color:T.text3, fontSize:13 }}>Nenhuma RNC registrada ainda.</div>
            ) : recentes.map(r => (
              <div key={r.id} className="rnc-item-home" onClick={() => setTab("lista")} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 12px", borderRadius:8, marginBottom:5, cursor:"pointer", transition:"background .15s" }}>
                <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                  <span style={{ width:6, height:6, borderRadius:"50%", background:SMETA[r.status]?.dot||T.accent, display:"inline-block", flexShrink:0 }} />
                  <div>
                    <span style={{ fontSize:11, fontWeight:700, color:T.accent, marginRight:8 }}>{r.num}</span>
                    <span style={{ fontSize:12, color:T.text }}>{r.desc?.substring(0, 45)}...</span>
                  </div>
                </div>
                <div style={{ display:"flex", gap:8, alignItems:"center", flexShrink:0 }}>
                  <Badge s={r.status} />
                  <span style={{ fontSize:10, color:T.text3 }}>{fmt(r.data)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — sidebar */}
        <div>
          {/* Saúde do sistema */}
          <div style={{ ...s.card, marginBottom:"1rem" }}>
            <div style={{ fontSize:13, fontWeight:700, color:T.text, marginBottom:"1rem" }}>{formal ? "" : "🩺 "}Saúde do sistema</div>
            {[
              { l:"RNCs em dia",     ok:vencidas===0,  val:vencidas===0?"✓ Nenhuma vencida":`${vencidas} vencida(s)` },
              { l:"Situações críticas", ok:criticas===0, val:criticas===0?"✓ Nenhuma crítica":`${criticas} crítica(s)` },
              { l:"Taxa de eficácia",ok:taxaEf>=70,    val:`${taxaEf}%${taxaEf>=70?" ✓":""}`},
              { l:"Sem responsável", ok:rncs.filter(x=>!x.resp&&x.status!=="Eficaz").length===0, val:rncs.filter(x=>!x.resp&&x.status!=="Eficaz").length===0?"✓ Todas atribuídas":`${rncs.filter(x=>!x.resp&&x.status!=="Eficaz").length} sem responsável` },
              { l:"IPC — Liberações pendentes", ok:ipcPendentes===0, val:ipcPendentes===0?"✓ Nenhuma pendente":`${ipcPendentes} pendente(s)`, link:"ipc" },
              { l:"Laudos aguardando RT", ok:laudosPendentes===0, val:laudosPendentes===0?"✓ Todos assinados":`${laudosPendentes} aguardando assinatura`, link:"laudos" },
            ].map(({ l, ok, val, link }) => (
              <div key={l} onClick={link&&!ok?()=>setTab(link):undefined} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${T.border}`, cursor:link&&!ok?"pointer":"default" }}>
                <span style={{ fontSize:12, color:T.text2 }}>{l}</span>
                <span style={{ fontSize:12, fontWeight:600, color:ok?T.accent:"#ff4f6a" }}>{val}{link&&!ok?" →":""}</span>
              </div>
            ))}
          </div>

          {/* Status rápido */}
          <div style={{ ...s.card, marginBottom:"1rem" }}>
            <div style={{ fontSize:13, fontWeight:700, color:T.text, marginBottom:"1rem" }}>📊 Por status</div>
            {Object.entries(SMETA).map(([st, m]) => {
              const n = rncs.filter(x => x.status === st).length;
              if (!n) return null;
              return <div key={st} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <Badge s={st} />
                <span style={{ fontSize:14, fontWeight:700, color:m.c }}>{n}</span>
              </div>;
            })}
          </div>
        </div>
      </div>

      {/* ── CARROSSEL DE BANNERS ── */}
      <div style={{ margin:"0 1.5rem 1.5rem", borderRadius:16, overflow:"hidden", position:"relative", boxShadow:`0 8px 40px rgba(0,0,0,.4)` }}>
        {/* Slides */}
        <div style={{ position:"relative", height:0, paddingBottom:"28%", overflow:"hidden", background:"#000" }}>
          {BANNERS.map((b, i) => (
            <a key={i} href={STORE_URL} target="_blank" rel="noopener noreferrer" style={{ position:"absolute", inset:0, display:"block", opacity: i === slide ? 1 : 0, transition:"opacity .7s ease", cursor:"pointer" }}>
              <img src={b.src} alt={b.alt} style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"center", display:"block" }} />
            </a>
          ))}
        </div>

        {/* Controls */}
        <button onClick={() => setSlide(s => (s - 1 + BANNERS.length) % BANNERS.length)} style={{ position:"absolute", left:16, top:"50%", transform:"translateY(-50%)", background:"rgba(0,0,0,.5)", border:"none", color:"#fff", borderRadius:"50%", width:36, height:36, cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(4px)" }}>‹</button>
        <button onClick={() => setSlide(s => (s + 1) % BANNERS.length)} style={{ position:"absolute", right:16, top:"50%", transform:"translateY(-50%)", background:"rgba(0,0,0,.5)", border:"none", color:"#fff", borderRadius:"50%", width:36, height:36, cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(4px)" }}>›</button>

        {/* Dots */}
        <div style={{ position:"absolute", bottom:12, left:"50%", transform:"translateX(-50%)", display:"flex", gap:6 }}>
          {BANNERS.map((_, i) => (
            <button key={i} className="banner-dot" onClick={() => setSlide(i)} style={{ width: i === slide ? 24 : 8, height:8, borderRadius:4, border:"none", background: i === slide ? "#fff" : "rgba(255,255,255,.4)", cursor:"pointer", padding:0, transition:"all .3s" }} />
          ))}
        </div>

        {/* Label */}
        <div style={{ position:"absolute", bottom:12, right:16, background:"rgba(0,0,0,.5)", color:"rgba(255,255,255,.7)", fontSize:10, padding:"3px 10px", borderRadius:20, backdropFilter:"blur(4px)" }}>
          Clique para visitar a loja →
        </div>
      </div>
    </div>
  );
}

export function ListaTab({ rncs, user, users, toast_, setTab, openEmail, doUpdateRNC, doDeleteRNC, isViewer, isAdmin, perm }) {
  const T = useTheme(); const s = useS();
  const [q, setQ] = useState("");
  const [fSt, setFSt] = useState("");
  const [fTp, setFTp] = useState("");
  const [sel, setSel] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [assinaturaModal, setAssinaturaModal] = useState(null);

  const list = rncs.filter(r =>
    (!q || [r.desc, r.produto, r.num, r.fornecedor].some(x => x?.toLowerCase().includes(q.toLowerCase()))) &&
    (!fSt || r.status === fSt) && (!fTp || r.tipo === fTp)
  );

  // Verificar se usuário pode editar esta RNC
  const canEdit = (r) => {
    if (isViewer) return false;
    if (isAdmin) return true;
    return r.criadoPor === user.name || r.detector === user.name;
  };

  const updStatus = async (id, status) => {
    const r = rncs.find(x => x.id === id);
    const h = { data: tod(), hora: new Date().toLocaleTimeString("pt-BR"), acao: `Status alterado -> ${status}`, resp: user.name, tipo: "status" };
    await doUpdateRNC(id, { status, historico: [...(r?.historico || []), h] });
    setSel(p => p ? { ...p, status, historico: [...(p.historico || []), h] } : null);
    toast_("Status atualizado!", "green");
    const updated = { ...r, status, historico: [...(r?.historico || []), h] };
    openEmail(updated, "status");
  };

  const assinarRTRNC = async (r) => {
    if (user?.role !== "rt" && user?.role !== "admin" && user?.role !== "keyuser") { alert("Apenas o Responsavel Tecnico pode assinar RNCs."); return; }
    if (!window.confirm(`Confirma assinatura como RT na RNC ${r.num}?`)) return;
    const password = window.prompt("Confirme sua senha para assinar como RT:");
    if (!password) return;
    let ass;
    try {
      ass = await createElectronicSignature({ password, contexto:`RNC|${r.num||r.id||""}`, papel:"Responsavel Tecnico" });
    } catch {
      alert("Senha incorreta. Assinatura cancelada.");
      return;
    }
    const h = { data: tod(), hora: new Date().toLocaleTimeString("pt-BR"), acao: "RNC aprovada pelo RT", resp: user.name, tipo: "rt" };
    const updated = { ...r, assinaturaRT: ass, historico: [...(r.historico||[]), h] };
    await doUpdateRNC(r.id, { assinaturaRT: ass, historico: updated.historico });
    setSel(updated);
    toast_("RNC aprovada pelo RT!", "green");
  };

  const startEdit = (r) => {
    setEditData({
      desc: r.desc || "", produto: r.produto || "", fornecedor: r.fornecedor || "",
      lote: r.lote || "", qtd: r.qtd || "", ref: r.ref || "", evidencia: r.evidencia || "",
      tipo: r.tipo || "Matéria-prima", sev: r.sev || "Maior", setor: r.setor || "",
      resp: r.resp || "", prazoCausa: r.prazoCausa || "", prazoAC: r.prazoAC || "",
      prazoEfic: r.prazoEfic || "", contencao: r.contencao || "", respCont: r.respCont || "",
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!editData.desc?.trim()) { alert("Descrição é obrigatória."); return; }
    const r = rncs.find(x => x.id === sel.id);

    // Detectar campos alterados para o histórico
    const alterados = [];
    const campos = { desc: "Descrição", produto: "Produto", fornecedor: "Fornecedor", lote: "Lote", qtd: "Quantidade", ref: "Referência", sev: "Severidade", tipo: "Tipo", resp: "Responsável", prazoAC: "Prazo AC", prazoEfic: "Prazo Eficácia", contencao: "Ação de Contenção" };
    Object.entries(campos).forEach(([k, label]) => {
      if ((r[k] || "") !== (editData[k] || "")) {
        alterados.push(`${label}: "${r[k] || "—"}" → "${editData[k] || "—"}"`);
      }
    });

    const h = {
      data: tod(),
      hora: new Date().toLocaleTimeString("pt-BR"),
      acao: `RNC editada — ${alterados.length} campo(s) alterado(s)`,
      detalhes: alterados,
      resp: user.name,
      tipo: "edicao"
    };

    const updated = { ...editData, historico: [...(r?.historico || []), h] };
    await doUpdateRNC(sel.id, updated);
    setSel(p => ({ ...p, ...editData, historico: [...(p.historico || []), h] }));
    setEditing(false);
    toast_("RNC atualizada com sucesso!", "green");
  };

  const del = async id => {
    if (!confirm("Excluir esta RNC permanentemente?")) return;
    await doDeleteRNC(id); setSel(null); toast_("RNC excluída.", "red");
  };

  const [sortCol, setSortCol] = useState("data");
  const [sortDir, setSortDir] = useState("desc");

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const sorted = [...list].sort((a, b) => {
    const va = a[sortCol] || ""; const vb = b[sortCol] || "";
    return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
  });
  const {paginated:_rncs,page:_pgRNC,total:_totRNC,setPage:_setPgRNC} = usePagination(sorted, 20);

  // Steps de progresso da RNC
  const getRNCStep = (r) => {
    if (r.status === "Eficaz" || r.status === "Ineficaz") return 4;
    if (r.eficacia?.resultado) return 4;
    if (r.w2h?.length > 0) return 3;
    if (r.ishikawa?.root) return 2;
    return 1;
  };

  const STEPS = ["Abertura", "Análise", "CAPA", "Eficácia"];

  const thStyle = (col) => ({
    padding:"10px 14px", textAlign:"left", fontSize:11, fontWeight:700, color: sortCol===col?T.accent:T.text3,
    textTransform:"uppercase", letterSpacing:".06em", cursor:"pointer", userSelect:"none",
    borderBottom:`1px solid ${T.border}`, background:T.surf, whiteSpace:"nowrap",
  });

  return (
    <div>
      {/* Filtros */}
      <div style={{ display:"flex", gap:10, marginBottom:"1rem", flexWrap:"wrap" }}>
        <Inp placeholder="🔍 Buscar por número, produto, descrição..." value={q} onChange={e=>setQ(e.target.value)} sx={{ flex:1, minWidth:220 }} />
        <Sel value={fSt} onChange={e=>setFSt(e.target.value)} sx={{ width:"auto", minWidth:165 }}>
          <option value="">Todos os status</option>{Object.keys(SMETA).map(x=><option key={x}>{x}</option>)}
        </Sel>
        <Sel value={fTp} onChange={e=>setFTp(e.target.value)} sx={{ width:"auto", minWidth:155 }}>
          <option value="">Todos os tipos</option>{Object.keys(TIPOC).map(x=><option key={x}>{x}</option>)}
        </Sel>
      </div>

      {/* Tabela enterprise */}
      {sorted.length === 0 ? (
        <div style={{ textAlign:"center", padding:"4rem 2rem", color:T.text3, background:T.card, borderRadius:14, border:`1px solid ${T.border}` }}>
          <div style={{ fontSize:48, marginBottom:"1rem", opacity:.3 }}>📋</div>
          <div style={{ fontSize:14, color:T.text2, marginBottom:6 }}>Nenhuma RNC encontrada</div>
          <div style={{ fontSize:12 }}>{isViewer?"Nenhuma não conformidade registrada.":"Clique em \"+ Nova RNC\" para começar."}</div>
        </div>
      ) : (
        <>
        <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr>
                <th className="th-sort" style={thStyle("num")} onClick={()=>toggleSort("num")}>Nº {sortCol==="num"?(sortDir==="asc"?"↑":"↓"):"↕"}</th>
                <th style={{...thStyle("status"),cursor:"default"}}>Status / Progresso</th>
                <th className="th-sort" style={thStyle("desc")} onClick={()=>toggleSort("desc")}>Descrição</th>
                <th className="th-sort" style={thStyle("tipo")} onClick={()=>toggleSort("tipo")}>Tipo</th>
                <th className="th-sort" style={thStyle("sev")} onClick={()=>toggleSort("sev")}>Sev.</th>
                <th className="th-sort" style={thStyle("resp")} onClick={()=>toggleSort("resp")}>Responsável</th>
                <th className="th-sort" style={thStyle("data")} onClick={()=>toggleSort("data")}>Data {sortCol==="data"?(sortDir==="asc"?"↑":"↓"):"↕"}</th>
                <th className="th-sort" style={thStyle("prazoAC")} onClick={()=>toggleSort("prazoAC")}>Prazo AC</th>
              </tr>
            </thead>
            <tbody>
              {_rncs.map((r, idx) => {
                const step = getRNCStep(r);
                const vencido = past(r.prazoAC) && r.status !== "Eficaz" && r.status !== "Ineficaz";
                return (
                  <tr key={r.id} className="rnc-row" onClick={()=>{setSel(r);setEditing(false);}} style={{ background: idx%2===0?T.card:T.surf, borderLeft:`3px solid ${SMETA[r.status]?.dot||T.accent}`, cursor:"pointer", transition:"background .15s" }}>
                    <td style={{ padding:"10px 14px", fontSize:11, fontWeight:700, color:T.accent, whiteSpace:"nowrap" }}>{r.num}</td>
                    <td style={{ padding:"10px 14px", minWidth:180 }}>
                      <Badge s={r.status} />
                      {/* Mini steps */}
                      <div style={{ display:"flex", gap:2, marginTop:5 }}>
                        {STEPS.map((st,i)=>(
                          <div key={st} title={st} style={{ flex:1, height:3, borderRadius:2, background: i<step?T.accent:T.border, transition:"background .3s" }} />
                        ))}
                      </div>
                    </td>
                    <td style={{ padding:"10px 14px", fontSize:13, maxWidth:240, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.desc}</td>
                    <td style={{ padding:"10px 14px", fontSize:11, color:T.text2, whiteSpace:"nowrap" }}>
                      <span style={{ display:"inline-block", width:6, height:6, borderRadius:"50%", background:TIPOC[r.tipo]||T.accent, marginRight:4 }} />
                      {r.tipo}
                    </td>
                    <td style={{ padding:"10px 14px" }}><SevB s={r.sev} /></td>
                    <td style={{ padding:"10px 14px", fontSize:12, color:T.text2, whiteSpace:"nowrap" }}>{r.resp||"—"}</td>
                    <td style={{ padding:"10px 14px", fontSize:12, color:T.text2, whiteSpace:"nowrap" }}>{fmt(r.data)}</td>
                    <td style={{ padding:"10px 14px", fontSize:12, whiteSpace:"nowrap", color: vencido?T.red:T.text2, fontWeight: vencido?600:400 }}>
                      {vencido?"⚠ ":""}{r.prazoAC?fmt(r.prazoAC):"—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ padding:"10px 14px", borderTop:`1px solid ${T.border}`, fontSize:11, color:T.text3, display:"flex", justifyContent:"space-between" }}>
            <span>{sorted.length} registro(s) encontrado(s)</span>
            <span>Clique em uma linha para ver detalhes</span>
          </div>
        </div>
        <Pagination page={_pgRNC} total={_totRNC} setPage={_setPgRNC}/>
      </>
      )}

      {/* MODAL */}
      {sel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.82)", backdropFilter: "blur(6px)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }} onClick={e => e.target === e.currentTarget && setSel(null)}>
          <div style={{ background: T.card2, border: `1px solid ${T.border2}`, borderRadius: 18, padding: "2rem 2.5rem", maxWidth: 1200, width: "100%", maxHeight: "94vh", overflowY: "auto", boxShadow: "0 32px 80px #000a" }}>

            {/* Header do modal */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{sel.num}</div>
                <div style={{ fontSize: 12, color: T.text2, marginTop: 2 }}>{sel.tipo} · {fmt(sel.data)} · {sel.detector || "—"}</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <SevB s={sel.sev} /><Badge s={sel.status} />
                {sel.assinaturaRT ? (
                  <span style={{ fontSize:10, padding:"3px 10px", borderRadius:20, background:"#2ab84a18", color:"#2ab84a", fontWeight:700, display:"flex", alignItems:"center", gap:4 }}>
                    ✅ RT: {sel.assinaturaRT.nome} · {sel.assinaturaRT.dataHora}
                  </span>
                ) : (sel.sev === "Crítica" && (user?.role === "rt" || user?.role === "admin" || user?.role === "keyuser")) ? (
                  <button onClick={() => assinarRTRNC(sel)} style={{ ...s.btnA, fontSize:10, padding:"3px 12px" }}>
                    ✍️ Aprovar como RT
                  </button>
                ) : sel.sev === "Crítica" && !sel.assinaturaRT ? (
                  <span style={{ fontSize:10, padding:"3px 10px", borderRadius:20, background:"#ffd16618", color:"#ffd166", fontWeight:700 }}>⏳ Aguardando aprovação RT</span>
                ) : null}
                {canEdit(sel) && !editing && (
                  <button onClick={() => startEdit(sel)} style={{ ...s.btn, fontSize: 11, padding: "6px 12px", color: T.accent, borderColor: T.accent + "33", background: T.accentDim }}><span className="btn-emoji">✏️ </span>Editar</button>
                )}
                <button onClick={() => setSel(null)} style={{ background: T.border, border: "none", color: T.text2, cursor: "pointer", borderRadius: 8, padding: "6px 10px", fontSize: 16, fontFamily: "inherit" }}>✕</button>
              </div>
            </div>

            {/* Steps de progresso */}
            <div style={{ display:"flex", gap:0, marginBottom:"1.25rem", background:T.surf, borderRadius:10, padding:"12px 16px", border:`1px solid ${T.border}` }}>
              {["Abertura","Análise de Causa","Plano de Ação","Verificação"].map((st,i)=>{
                const step = getRNCStep(sel);
                const done = i < step;
                const active = i === step - 1;
                return (
                  <div key={st} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", position:"relative" }}>
                    {i > 0 && <div style={{ position:"absolute", left:"-50%", top:13, width:"100%", height:2, background: done?T.accent:T.border, zIndex:0 }} />}
                    <div style={{ width:28, height:28, borderRadius:"50%", background: done?`linear-gradient(135deg,${T.accent},${T.accent2})`:T.border, color: done?"#fff":T.text3, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, zIndex:1, border: active?`2px solid ${T.accent}`:"none", boxShadow: active?`0 0 10px ${T.accentGlow}`:"none" }}>
                      {done && i < step-1 ? "✓" : i+1}
                    </div>
                    <div style={{ fontSize:10, color: done?T.accent:T.text3, marginTop:4, fontWeight: active?600:400, textAlign:"center" }}>{st}</div>
                  </div>
                );
              })}
            </div>
            {editing ? (
              <div>
                <div style={{ background: T.accentDim, border: `1px solid ${T.accent}33`, borderRadius: 10, padding: "10px 14px", marginBottom: "1rem", fontSize: 12, color: T.accent, display: "flex", alignItems: "center", gap: 8 }}>
                  ✏️ <span>Modo edição ativo — todas as alterações serão registradas no histórico</span>
                </div>
                <div style={{ ...s.card, marginBottom: "1rem" }}>
                  <SecTitle icon="📝" ch="Identificação" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <F lbl="Tipo" ch={<Sel value={editData.tipo} onChange={e => setEditData(p => ({ ...p, tipo: e.target.value }))}>{Object.keys(TIPOC).map(x => <option key={x}>{x}</option>)}</Sel>} />
                    <F lbl="Severidade" tip="Crítica: risco à segurança do produto ou paciente. Maior: impacto significativo na qualidade. Menor: desvio leve sem impacto direto ao produto." ch={<Sel value={editData.sev} onChange={e => setEditData(p => ({ ...p, sev: e.target.value }))}>{Object.keys(SEVMETA).map(x => <option key={x}>{x}</option>)}</Sel>} />
                    <F lbl="Setor" tip="Setor onde a não conformidade foi identificada. Ex: Controle de Qualidade, Produção, Logística." ch={<Inp value={editData.setor} onChange={e => setEditData(p => ({ ...p, setor: e.target.value }))} />} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <F lbl="Produto / Material" tip="Nome do produto acabado ou matéria-prima envolvida. Seja específico. Ex: Calcivitam D3 Cápsula 60un ou Celulose Microcristalina." ch={<Inp value={editData.produto} onChange={e => setEditData(p => ({ ...p, produto: e.target.value }))} />} />
                    <F lbl="Fornecedor" tip="Fornecedor relacionado à NC. Preencha apenas se a origem for de matéria-prima ou material de embalagem de terceiros." ch={<Inp value={editData.fornecedor} onChange={e => setEditData(p => ({ ...p, fornecedor: e.target.value }))} />} />
                    <F lbl="Nº do lote" tip="Número do lote afetado conforme registrado no sistema de rastreabilidade. Essencial para eventual recall ou bloqueio de lote." ch={<Inp value={editData.lote} onChange={e => setEditData(p => ({ ...p, lote: e.target.value }))} />} />
                    <F lbl="Quantidade afetada" tip="Quantidade de unidades, kg ou litros afetados pela não conformidade. Ex: 500 cápsulas, 20kg, 2 tambores." ch={<Inp value={editData.qtd} onChange={e => setEditData(p => ({ ...p, qtd: e.target.value }))} />} />
                  </div>
                  <F lbl="Referência normativa" tip="Norma, especificação ou procedimento que define o padrão que foi descumprido. Ex: PO-CQ-003, RDC 658/2022, Especificação Técnica ETE-001." ch={<Inp value={editData.ref} onChange={e => setEditData(p => ({ ...p, ref: e.target.value }))} />} />
                  <F lbl="Evidências" ch={<Inp value={editData.evidencia} onChange={e => setEditData(p => ({ ...p, evidencia: e.target.value }))} />} />
                </div>
                <div style={{ ...s.card, marginBottom: "1rem" }}>
                  <SecTitle icon="📋" ch="Descrição" />
                  <F lbl="Descrição da não conformidade" tip="Descreva objetivamente o que foi encontrado fora do padrão. Ex: Cápsulas do lote 2024-001 apresentaram coloração amarelada em 3% das unidades, diferente do padrão bege estabelecido na especificação." ch={<TA rows={4} value={editData.desc} onChange={e => setEditData(p => ({ ...p, desc: e.target.value }))} />} />
                </div>
                <div style={{ ...s.card, marginBottom: "1rem" }}>
                  <SecTitle icon="⚡" ch="Ação de contenção" />
                  <F lbl="Ação realizada" tip="Descreva a ação imediata de contenção já executada. Ex: Lote bloqueado e segregado na área de quarentena. Produção suspensa até investigação." ch={<TA rows={3} value={editData.contencao} onChange={e => setEditData(p => ({ ...p, contencao: e.target.value }))} />} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <F lbl="Responsável" tip="Nome do responsável por verificar e atestar a eficácia da ação corretiva. Geralmente o RT ou coordenador de qualidade." tip="Nome do responsável pela ação corretiva e pelo encerramento desta RNC. Geralmente coordenador ou supervisor do setor." ch={<Inp value={editData.respCont} onChange={e => setEditData(p => ({ ...p, respCont: e.target.value }))} />} />
                  </div>
                </div>
                <div style={{ ...s.card, marginBottom: "1rem" }}>
                  <SecTitle icon="🗓️" ch="Prazos" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <F lbl="Responsável análise" ch={<Inp value={editData.resp} onChange={e => setEditData(p => ({ ...p, resp: e.target.value }))} />} />
                    <F lbl="Prazo ação corretiva" tip="Data limite para execução de todas as ações do plano 5W2H." ch={<Inp type="date" value={editData.prazoAC} onChange={e => setEditData(p => ({ ...p, prazoAC: e.target.value }))} />} />
                    <F lbl="Prazo eficácia" tip="Data em que será verificado se a ação corretiva foi eficaz e o problema não voltou." ch={<Inp type="date" value={editData.prazoEfic} onChange={e => setEditData(p => ({ ...p, prazoEfic: e.target.value }))} />} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button style={s.btn} onClick={() => setEditing(false)}>Cancelar edição</button>
                  <button style={s.btnA} onClick={saveEdit}>💾 Salvar alterações</button>
                </div>
              </div>
            ) : (
              /* MODO VISUALIZAÇÃO */
              <div>
                <div style={{ background: T.surf, borderRadius: 10, padding: 14, marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: T.text3, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>Descrição</div>
                  <div style={{ fontSize: 14, lineHeight: 1.6 }}>{sel.desc}</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  {[["Produto", sel.produto], ["Fornecedor", sel.fornecedor], ["Lote", sel.lote], ["Qtd.", sel.qtd], ["Responsável", sel.resp], ["Setor", sel.setor], ["Prazo AC", fmt(sel.prazoAC)], ["Prazo Eficácia", fmt(sel.prazoEfic)], ["Referência", sel.ref], ["Evidências", sel.evidencia]].filter(([, v]) => v).map(([k, v]) => (
                    <div key={k} style={{ background: T.surf, borderRadius: 8, padding: "10px 12px" }}>
                      <div style={{ fontSize: 10, color: T.text3, textTransform: "uppercase", fontWeight: 700, marginBottom: 3 }}>{k}</div>
                      <div style={{ fontSize: 13 }}>{v}</div>
                    </div>
                  ))}
                </div>
                {sel.contencao && <div style={{ background: "#ff8c4212", border: "1px solid #ff8c4230", borderRadius: 10, padding: 14, marginBottom: 14 }}><div style={{ fontSize: 10, color: "#ff8c42", fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>⚡ Contenção</div><div style={{ fontSize: 13 }}>{sel.contencao}</div></div>}
                {sel.ishikawa?.root && <div style={{ background: T.accentDim, border: `1px solid ${T.accent}30`, borderRadius: 10, padding: 14, marginBottom: 14 }}><div style={{ fontSize: 10, color: T.accent, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>🎯 Causa raiz</div><div style={{ fontSize: 13, fontWeight: 500 }}>{sel.ishikawa.root}</div></div>}

                {/* Anexos */}
                {sel.anexos?.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 10, color: T.text3, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>📎 Anexos ({sel.anexos.length})</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {sel.anexos.map((a, i) => (
                        <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: T.surf, border: `1px solid ${T.border2}`, borderRadius: 8, color: T.accent, textDecoration: "none", fontSize: 12 }}>
                          {a.type?.includes("image") ? "🖼️" : a.type?.includes("pdf") ? "📄" : "📎"} {a.name}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Alterar status — só para não visualizadores */}
                {!isViewer && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 10, color: T.text3, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Alterar status</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {Object.keys(SMETA).map(st => <button key={st} onClick={() => updStatus(sel.id, st)} style={{ padding: "6px 12px", borderRadius: 20, border: `1px solid ${sel.status === st ? SMETA[st].c + "55" : T.border}`, background: sel.status === st ? SMETA[st].bg : T.surf, color: sel.status === st ? SMETA[st].c : T.text2, cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600 }}>{st}</button>)}
                    </div>
                  </div>
                )}

                {/* Histórico de versões */}
                {sel.historico?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, color: T.text3, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>📜 Histórico de versões</div>
                    <div style={{ borderLeft: `2px solid ${T.border2}`, paddingLeft: "1.25rem", marginLeft: ".5rem" }}>
                      {[...sel.historico].reverse().map((h, i) => (
                        <div key={i} style={{ position: "relative", marginBottom: 10, padding: "10px 14px", background: T.surf, border: `1px solid ${h.tipo === "edicao" ? T.accent + "33" : T.border}`, borderRadius: 8 }}>
                          <div style={{ position: "absolute", left: "-1.6rem", top: "1rem", width: 8, height: 8, borderRadius: "50%", background: h.tipo === "edicao" ? T.accent : h.tipo === "status" ? "#ffd166" : T.text3, border: `2px solid ${T.bg}`, boxShadow: h.tipo === "edicao" ? `0 0 6px ${T.accentGlow}` : "none" }} />
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: h.detalhes?.length ? 6 : 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{h.acao}</div>
                            <div style={{ fontSize: 10, color: T.text3, whiteSpace: "nowrap", marginLeft: 8 }}>{fmt(h.data)}{h.hora ? ` · ${h.hora}` : ""}</div>
                          </div>
                          <div style={{ fontSize: 11, color: T.text2, marginBottom: h.detalhes?.length ? 6 : 0 }}>por {h.resp}</div>
                          {h.detalhes?.length > 0 && (
                            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 6, marginTop: 4 }}>
                              {h.detalhes.map((d, j) => (
                                <div key={j} style={{ fontSize: 11, color: T.text3, marginBottom: 2 }}>• {d}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {sel.assinaturaRT && (
                  <div style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", background:"#2ab84a0a", border:"1px solid #2ab84a25", borderRadius:10, marginBottom:10 }}>
                    <div style={{ width:36, height:36, borderRadius:8, background:"#2ab84a18", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>✅</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:"#2ab84a" }}>Aprovado pelo Responsável Técnico</div>
                      <div style={{ fontSize:11, color:T.text2 }}>{sel.assinaturaRT.nome}{sel.assinaturaRT.cargo ? ` · ${sel.assinaturaRT.cargo}` : ""}{(sel.assinaturaRT.registroProfissional||sel.assinaturaRT.crf) ? ` · Registro profissional: ${sel.assinaturaRT.registroProfissional||sel.assinaturaRT.crf}` : ""}</div>
                      <div style={{ fontSize:10, color:T.text3 }}>✔ Assinado eletronicamente em {sel.assinaturaRT.timestamp?new Date(sel.assinaturaRT.timestamp).toLocaleString("pt-BR"):sel.assinaturaRT.dataHora}</div>
                      <div style={{ fontSize:9, color:T.text3, fontFamily:"monospace", marginTop:2 }}>Cód.: {sigCodigo(sel.assinaturaRT, `RNC|${sel.num||sel.id||""}`)}</div>
                    </div>
                  </div>
                )}

                {sel.respostaFornecedor && (
                  <div style={{ ...s.card, background: `linear-gradient(135deg, #1a7a3c0a, #1a7a3c05)`, border: `1px solid #1a7a3c25` }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
                      <div style={{ fontSize:18 }}>🔗</div>
                      <SecTitle ch="Resposta do Fornecedor" />
                    </div>
                    <div style={{ background: T.surf, borderRadius:8, padding:"12px 14px", marginBottom:12, fontSize:11, color:T.text2 }}>
                      Respondido em {new Date(sel.respostaFornecedor.respondidoEm).toLocaleString("pt-BR")}
                    </div>
                    {sel.respostaFornecedor.porques?.length > 0 && (
                      <div style={{ marginBottom:12 }}>
                        <div style={{ fontSize:11, fontWeight:700, color:T.accent, textTransform:"uppercase", marginBottom:6 }}>5 Porquês</div>
                        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                          {sel.respostaFornecedor.porques.map((p, i) => (
                            <div key={i} style={{ display:"flex", gap:8, fontSize:12, color:T.text }}>
                              <span style={{ fontWeight:700, color:T.accent, minWidth:20 }}>{i+1}.</span>
                              <span>{p}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {sel.respostaFornecedor.causaRaiz && (
                      <div style={{ marginBottom:12, padding:"10px 12px", background:T.accentDim, border:`1px solid ${T.accent}33`, borderRadius:6 }}>
                        <div style={{ fontSize:10, fontWeight:700, color:T.accent, textTransform:"uppercase", marginBottom:4 }}>Causa raiz identificada</div>
                        <div style={{ fontSize:12, color:T.text, lineHeight:1.5 }}>{sel.respostaFornecedor.causaRaiz}</div>
                      </div>
                    )}
                    {sel.respostaFornecedor.planoAcao && Object.keys(sel.respostaFornecedor.planoAcao).some(k => sel.respostaFornecedor.planoAcao[k]) && (
                      <div style={{ marginBottom:12 }}>
                        <div style={{ fontSize:11, fontWeight:700, color:T.accent, textTransform:"uppercase", marginBottom:6 }}>Plano de Ação Proposto</div>
                        <div style={{ display:"grid", gridTemplateColumns:"120px 1fr", gap:8, fontSize:11, color:T.text2 }}>
                          {sel.respostaFornecedor.planoAcao.oQue && <>
                            <div style={{ fontWeight:600, color:T.text }}>O quê?</div>
                            <div>{sel.respostaFornecedor.planoAcao.oQue}</div>
                          </>}
                          {sel.respostaFornecedor.planoAcao.porQue && <>
                            <div style={{ fontWeight:600, color:T.text }}>Por quê?</div>
                            <div>{sel.respostaFornecedor.planoAcao.porQue}</div>
                          </>}
                          {sel.respostaFornecedor.planoAcao.como && <>
                            <div style={{ fontWeight:600, color:T.text }}>Como?</div>
                            <div>{sel.respostaFornecedor.planoAcao.como}</div>
                          </>}
                          {sel.respostaFornecedor.planoAcao.quem && <>
                            <div style={{ fontWeight:600, color:T.text }}>Quem?</div>
                            <div>{sel.respostaFornecedor.planoAcao.quem}</div>
                          </>}
                          {sel.respostaFornecedor.planoAcao.onde && <>
                            <div style={{ fontWeight:600, color:T.text }}>Onde?</div>
                            <div>{sel.respostaFornecedor.planoAcao.onde}</div>
                          </>}
                          {sel.respostaFornecedor.planoAcao.quando && <>
                            <div style={{ fontWeight:600, color:T.text }}>Quando?</div>
                            <div>{sel.respostaFornecedor.planoAcao.quando}</div>
                          </>}
                          {sel.respostaFornecedor.planoAcao.quanto && <>
                            <div style={{ fontWeight:600, color:T.text }}>Quanto?</div>
                            <div>{sel.respostaFornecedor.planoAcao.quanto}</div>
                          </>}
                        </div>
                      </div>
                    )}
                    {sel.respostaFornecedor.observacoes && (
                      <div>
                        <div style={{ fontSize:11, fontWeight:700, color:T.accent, textTransform:"uppercase", marginBottom:6 }}>Observações</div>
                        <div style={{ fontSize:12, color:T.text, lineHeight:1.5 }}>{sel.respostaFornecedor.observacoes}</div>
                      </div>
                    )}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: "1.25rem", borderTop: `1px solid ${T.border}`, paddingTop: "1rem" }}>
                  {(isAdmin || (perm && perm("excluirRNC"))) && <button style={s.btnD} onClick={() => del(sel.id)}><span className="btn-emoji">🗑️ </span>Excluir</button>}
                  <button style={{ ...s.btn, color: "#ff8c42", borderColor: "#ff8c4233", background: "#ff8c4212", display: "flex", alignItems: "center", gap: 6 }} onClick={() => setAssinaturaModal(sel)}>📄 Assinar e exportar PDF</button>
                  {!isViewer && <button style={{ ...s.btn, color: T.accent, borderColor: T.accent + "33", background: T.accentDim, display: "flex", alignItems: "center", gap: 6 }} onClick={() => openEmail(sel, "manual")}>✉️ Notificar</button>}
                  {canEdit(sel) && <button style={{ ...s.btn, color: T.accent, borderColor: T.accent + "33", background: T.accentDim }} onClick={() => startEdit(sel)}><span className="btn-emoji">✏️ </span>Editar</button>}
                  <button style={s.btn} onClick={() => setSel(null)}>Fechar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {assinaturaModal && (
        <AssinaturaModal
          user={user}
          titulo={`RNC ${assinaturaModal.num}`}
          contexto={`RNC|${assinaturaModal.num||assinaturaModal.id||""}`}
          papel="Responsavel pela analise"
          onClose={()=>setAssinaturaModal(null)}
          onConfirm={(ass)=>{ exportRNCPDF(assinaturaModal, ass); setAssinaturaModal(null); toast_("PDF gerado com assinatura!", "green"); }}
        />
      )}
    </div>
  );
}

export async function uploadAttachment(file) {
  return uploadStoredFile(file);
}

export function openCOA(coa) {
  if (!coa?.url) return;
  if (isExternalStorageUrl(coa.url)) {
    alert("Este arquivo ainda aponta para armazenamento externo antigo. Remova e anexe novamente para salvar no PostgreSQL local do SGQ.");
    return;
  }
  const url = coa.url;
  window.open(url, "_blank", "noopener,noreferrer");
}

export function AnexosUpload({ anexos, setAnexos, inputId = "anexo-input" }) {
  const T = useTheme(); const s = useS();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");

  const handleFiles = async (files) => {
    if (!files.length) return;
    setUploading(true);
    const novos = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 10 * 1024 * 1024) { alert(`${file.name} é maior que 10MB.`); continue; }
      setProgress(`Enviando ${i + 1}/${files.length}: ${file.name}...`);
      try {
        const result = await uploadAttachment(file);
        novos.push(result);
      } catch (e) { alert(`Erro ao enviar ${file.name}: ${e.message}`); }
    }
    setAnexos(p => [...p, ...novos]);
    setUploading(false);
    setProgress("");
  };

  const removeAnexo = (i) => setAnexos(p => p.filter((_, j) => j !== i));

  const getIcon = (type) => {
    if (type?.includes("image")) return "🖼️";
    if (type?.includes("pdf")) return "📄";
    if (type?.includes("word") || type?.includes("doc")) return "📝";
    if (type?.includes("excel") || type?.includes("sheet")) return "📊";
    return "📎";
  };

  const fmtSize = (bytes) => {
    if (!bytes) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div>
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = T.accent; }}
        onDragLeave={e => { e.currentTarget.style.borderColor = T.border2; }}
        onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = T.border2; handleFiles(Array.from(e.dataTransfer.files)); }}
        style={{ border: `2px dashed ${T.border2}`, borderRadius: 10, padding: "1.5rem", textAlign: "center", cursor: "pointer", transition: "border-color .2s", marginBottom: 12 }}
        onClick={() => document.getElementById(inputId).click()}
      >
        <div style={{ fontSize: 28, marginBottom: 8 }}>📎</div>
        <div style={{ fontSize: 13, color: T.text2, fontWeight: 500 }}>
          {uploading ? <span style={{ color: T.accent }}>{progress}</span> : "Clique ou arraste arquivos aqui"}
        </div>
        <div style={{ fontSize: 11, color: T.text3, marginTop: 4 }}>Fotos, PDFs, documentos — até 10MB por arquivo</div>
        <input id={inputId} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" style={{ display: "none" }} onChange={e => handleFiles(Array.from(e.target.files))} />
      </div>

      {/* Lista de anexos */}
      {anexos.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {anexos.map((a, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, background: T.surf, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px" }}>
              <span style={{ fontSize: 20 }}>{getIcon(a.type)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</div>
                <div style={{ fontSize: 10, color: T.text3 }}>{fmtSize(a.size)}</div>
              </div>
              <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: T.accent, textDecoration: "none", fontWeight: 600, padding: "4px 10px", background: T.accentDim, borderRadius: 6 }}>Ver</a>
              <button onClick={() => removeAnexo(i)} style={{ background: "none", border: "none", color: T.text3, cursor: "pointer", fontSize: 16, padding: "0 4px", fontFamily: "inherit" }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function NovaTab({ user, toast_, setTab, openEmail, doSaveRNC, doSaveDesvio, fornecedores = [], rncPrefill = null, setRncPrefill }) {
  const s = useS(); const T = useTheme();
  const [f, setF] = useState({ data: tod(), status: "Aberta", tipo: "Matéria-prima", sev: "Maior", produto: "", fornecedor: "", setor: "", detector: "", desc: "", lote: "", qtd: "", ref: "", evidencia: "", contencao: "", respCont: "", dataContencao: "", resp: "", prazoCausa: "", prazoAC: "", prazoEfic: "", origemAnalise: "" });
  const [origemDesvio, setOrigemDesvio] = useState(null);
  const [anexos, setAnexos] = useState([]);
  const [ishikawa, setIshikawa] = useState({ efeito: "", causes: { mao: [], maquina: [], metodo: [], material: [], medicao: [], meioamb: [] }, whys: [], root: "", whyCausa: "" });
  const [w2h, setW2h] = useState([]);
  const [fornSearch, setFornSearch] = useState("");
  const [fornOpen, setFornOpen] = useState(false);
  const [numPreview, setNumPreview] = useState("...");
  const [novaAba, setNovaAba] = useState("ident");

  useEffect(() => {
    peekDailyCounter().then(n => setNumPreview(n)).catch(() => setNumPreview("—"));
  }, []);

  useEffect(() => {
    if (!rncPrefill) return;
    setF(p => ({ ...p,
      produto: rncPrefill.produto || "",
      fornecedor: rncPrefill.fornecedor || "",
      lote: rncPrefill.lote || "",
      detector: rncPrefill.detector || "",
      setor: rncPrefill.setor || p.setor,
      sev: rncPrefill.sev || p.sev,
      desc: rncPrefill.desc || p.desc,
      tipo: rncPrefill.tipo || p.tipo,
      origemAnalise: rncPrefill.origemAnalise || "",
    }));
    if (rncPrefill.origemDesvioDoc) setOrigemDesvio(rncPrefill.origemDesvioDoc);
    setIshikawa(p => ({ ...p, whys: ["", "", "", "", ""] }));
    if (setRncPrefill) setRncPrefill(null);
  }, [rncPrefill]);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const fornAtivos = fornecedores.filter(x => x.status !== "Inativo" && x.status !== "Bloqueado");
  const fornFiltrados = fornAtivos.filter(x => x.nome.toLowerCase().includes(fornSearch.toLowerCase()));

  const handleAIApply = (result) => {
    if (result.type === "ishikawa") {
      setIshikawa(p => ({ ...p, efeito: result.data.efeito || p.efeito, causes: { mao: result.data.mao || [], maquina: result.data.maquina || [], metodo: result.data.metodo || [], material: result.data.material || [], medicao: result.data.medicao || [], meioamb: result.data.meioamb || [] } }));
      toast_("Causas do Ishikawa aplicadas!", "green");
    } else if (result.type === "5porques") {
      setIshikawa(p => ({ ...p, whys: result.data.porques || [], root: result.data.raiz || "", whyCausa: result.data.causa || "" }));
      toast_("5 Porquês aplicados!", "green");
    } else if (result.type === "5w2h") {
      setW2h(result.data.acoes || []);
      toast_("Plano 5W2H aplicado!", "green");
    } else if (result.type === "eficacia") {
      set("prazoEfic", "");
      toast_("Critério de eficácia sugerido — copie para o campo!", "green");
    }
  };

  const salvar = async () => {
    try {
    if (!f.desc.trim())        { alert("Preencha a descrição da não conformidade."); return; }
    if (!f.sev)                 { alert("Selecione a severidade (Crítica / Maior / Menor)."); return; }
    if (!f.resp.trim())         { alert("Informe o responsável pela ação corretiva."); return; }
    if (!f.prazoAC)             { alert("Defina o prazo para ação corretiva."); return; }
    const nc = await incrementCounter();
    const rnc = { id: String(Date.now()), num: genNum(nc), ...f, origemAnalise: f.origemAnalise || null, origemDesvio: origemDesvio?.id || null, origemDesvioNum: origemDesvio?.num || null, anexos, ishikawa, w2h, eficacia: { criterio: "", data: "", resp: "", evidencias: "", resultado: "", obs: "" }, historico: [{ data: tod(), acao: "RNC aberta", resp: user.name }], criadoPor: user.name, createdAt: Date.now(), assinaturaRT: null };
    await doSaveRNC(rnc);
    // Vínculo bidirecional: marca o desvio de origem como convertido e grava o nº da RNC.
    if (origemDesvio && doSaveDesvio) {
      await doSaveDesvio({ ...origemDesvio, status: "Convertido em RNC", convertidoPor: user.name, convertidoEm: tod(), rncId: rnc.id, rncNum: rnc.num,
        historico: [...(origemDesvio.historico || []), { data: tod(), acao: `Convertido em RNC ${rnc.num}`, resp: user.name }] });
      setOrigemDesvio(null);
    }
    toast_(`${rnc.num} registrada!`, "green");
    openEmail(rnc, "abertura");
    setTab("lista");
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const rncPreview = { ...f, ishikawa, w2h };

  return (
    <div>
      {/* ── Abas do formulário ── */}
      <div style={{ display:"flex", gap:6, marginBottom:16, flexWrap:"wrap" }}>
        {[["ident","🪪 Identificação"],["desc","📝 Descrição"],["contencao","⚡ Contenção"],["prazos","🗓️ Prazos"]].map(([k,l])=>(
          <button key={k} onClick={()=>setNovaAba(k)}
            style={{ padding:"8px 18px", borderRadius:8, border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:600,
              background:novaAba===k?T.accent:T.surf, color:novaAba===k?"#fff":T.text2, transition:"all .15s" }}>
            {l}
          </button>
        ))}
      </div>

      {novaAba==="ident" && (
      <div style={{ ...s.card }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
          <SecTitle icon="🪪" ch="Identificação" />
          <span style={{ fontSize:13, fontWeight:600, color:"#6366f1", background:"#eef2ff", border:"1px solid #c7d2fe", borderRadius:8, padding:"4px 12px" }}>
            Nº previsto: {numPreview}
          </span>
        </div>
        <G3 ch={<><F lbl="Data de abertura" tip="Data em que a não conformidade foi detectada. Use a data real da ocorrência, não a data de registro." ch={<Inp type="date" value={f.data} onChange={e => set("data", e.target.value)} />} /><F lbl="Status" tip="Estado atual da RNC. Novas RNCs iniciam como Aberta. O status evolui conforme o tratamento avança." ch={<Sel value={f.status} onChange={e => set("status", e.target.value)}>{Object.keys(SMETA).map(x => <option key={x}>{x}</option>)}</Sel>} /><F lbl="Severidade" tip="Crítica: risco à segurança do produto ou paciente. Maior: impacto significativo na qualidade. Menor: desvio leve sem impacto direto ao produto." ch={<Sel value={f.sev} onChange={e => set("sev", e.target.value)}>{Object.keys(SEVMETA).map(x => <option key={x}>{x}</option>)}</Sel>} /></>} />
        <G3 ch={<>
          <F lbl="Tipo de não conformidade" tip="Classifique a origem da NC. Ex: Matéria-prima (insumo fora do padrão), Processo (falha na fabricação), Produto acabado (produto final com desvio)." ch={
            <div>
              <Sel value={f.tipo} onChange={e => set("tipo", e.target.value)}>
                {Object.keys(TIPOC).map(x => <option key={x}>{x}</option>)}
              </Sel>
              {f.tipo === "Outros" && (
                <Inp
                  placeholder="Descreva o tipo..."
                  value={f.tipoOutros || ""}
                  onChange={e => set("tipoOutros", e.target.value)}
                  sx={{ marginTop: 8 }}
                />
              )}
            </div>
          } />
          <F lbl="Setor" tip="Setor onde a não conformidade foi identificada. Ex: Controle de Qualidade, Produção, Logística." ch={<Inp value={f.setor} onChange={e => set("setor", e.target.value)} />} />
          <F lbl="Detectado por" tip="Nome completo do colaborador que identificou a não conformidade." ch={<Inp value={f.detector} onChange={e => set("detector", e.target.value)} />} />
        </>} />
        <G2 ch={<><F lbl="Produto / Material" tip="Nome do produto ou matéria-prima envolvida. Ex: Calcivitam D3 Cápsula 60un ou Celulose Microcristalina." ch={<Inp placeholder="Ex: Nome do produto — Lote XXXX" value={f.produto} onChange={e => set("produto", e.target.value)} />} />
          <F lbl="Fornecedor" tip="Fornecedor relacionado à NC. Preencha se a origem for matéria-prima ou material de embalagem de terceiros." ch={
            <div style={{ position:"relative" }}>
              <div style={{ display:"flex", gap:6 }}>
                <Inp
                  placeholder={fornAtivos.length > 0 ? "Selecionar ou digitar fornecedor..." : "Digite o fornecedor..."}
                  value={f.fornecedor}
                  onChange={e => { set("fornecedor", e.target.value); setFornSearch(e.target.value); setFornOpen(true); }}
                  onFocus={() => setFornOpen(true)}
                />
                {fornAtivos.length > 0 && (
                  <button onClick={() => setFornOpen(o => !o)} style={{ ...s.btn, padding:"8px 10px", fontSize:12, flexShrink:0 }}>▾</button>
                )}
              </div>
              {fornOpen && fornFiltrados.length > 0 && (
                <div style={{ position:"absolute", top:"calc(100%+4px)", left:0, right:0, background:T.card2, border:`1px solid ${T.border2}`, borderRadius:10, boxShadow:"0 8px 24px rgba(0,0,0,.4)", zIndex:200, maxHeight:180, overflowY:"auto" }}>
                  {fornFiltrados.map(forn => (
                    <div key={forn.id} onClick={() => { set("fornecedor", forn.nome); setFornOpen(false); setFornSearch(""); }} style={{ padding:"9px 14px", cursor:"pointer", fontSize:13, color:T.text, borderBottom:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span>{forn.nome}</span>
                      <span style={{ fontSize:10, color:T.text3 }}>{forn.categoria}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          } />
        </>} />
      </div>
      )}

      {novaAba==="desc" && (<>
      <div style={s.card}>
        <SecTitle icon="📝" ch="Descrição" />
        <F lbl="Descrição da não conformidade" tip="Descreva objetivamente o que foi encontrado fora do padrão. Ex: Cápsulas do lote 2024-001 apresentaram coloração amarelada em 3% das unidades." ch={<TA rows={4} placeholder="Descreva o problema observado, local, data e impacto..." value={f.desc} onChange={e => set("desc", e.target.value)} />} />
        <G3 ch={<><F lbl="Nº do lote" tip="Número do lote afetado conforme registrado no sistema de rastreabilidade. Essencial para eventual recall ou bloqueio de lote." ch={<Inp placeholder="Ex: LOTE-2025-XXX" value={f.lote} onChange={e => set("lote", e.target.value)} />} /><F lbl="Quantidade afetada" tip="Quantidade de unidades, kg ou litros afetados. Ex: 500 cápsulas, 20kg, 2 tambores." ch={<Inp placeholder="Ex: 100 kg / 500 unidades" value={f.qtd} onChange={e => set("qtd", e.target.value)} />} /><F lbl="Referência normativa" tip="Norma ou procedimento que define o padrão descumprido. Ex: PO-CQ-003, RDC 658/2022, Especificação Técnica ETE-001." ch={<Inp placeholder="Ex: Farmacopeia Brasileira / Especificação interna" value={f.ref} onChange={e => set("ref", e.target.value)} />} /></>} />
        <F lbl="Evidências (descrição)" tip="Descreva as evidências coletadas. Ex: Foto registrada, amostra retida, laudo de análise nº 123. Anexe os arquivos abaixo." ch={<Inp value={f.evidencia} onChange={e => set("evidencia", e.target.value)} placeholder="Ex: Laudo de análise, registro fotográfico, relatório..." />} />
        <F lbl="📎 Anexos (fotos, laudos, documentos)" tip="Adicione fotos, laudos ou documentos que comprovem a não conformidade. Formatos aceitos: JPG, PNG, PDF." ch={<AnexosUpload anexos={anexos} setAnexos={setAnexos} />} />
      </div>

      {/* AI PANEL */}
      {f.desc.trim().length > 20 && (
        <AIPanel rnc={rncPreview} onApply={handleAIApply} />
      )}
      </>)}

      {novaAba==="contencao" && (
      <div style={s.card}>
        <SecTitle icon="⚡" ch="Ação de contenção" />
        <F lbl="Ação realizada" tip="Descreva a ação imediata de contenção já executada. Ex: Lote bloqueado e segregado na área de quarentena. Produção suspensa até investigação." ch={<TA rows={3} value={f.contencao} onChange={e => set("contencao", e.target.value)} />} />
        <G2 ch={<><F lbl="Responsável" tip="Nome do responsável pela execução da ação de contenção." ch={<Inp value={f.respCont} onChange={e => set("respCont", e.target.value)} />} /><F lbl="Data" tip="Data em que a ação de contenção foi executada." ch={<Inp type="date" value={f.dataContencao} onChange={e => set("dataContencao", e.target.value)} />} /></>} />
      </div>
      )}

      {novaAba==="prazos" && (
      <div style={s.card}>
        <SecTitle icon="🗓️" ch="Prazos e responsabilidades" />
        <G3 ch={<><F lbl="Responsável pela análise" tip="Nome do responsável por conduzir a análise de causa raiz (Ishikawa + 5 Porquês) e elaborar o plano de ação corretiva." ch={<Inp value={f.resp} onChange={e => set("resp", e.target.value)} />} /><F lbl="Prazo — análise de causa" tip="Data limite para conclusão da análise de causa raiz (Ishikawa + 5 Porquês). Recomendado: até 15 dias após a abertura." ch={<Inp type="date" value={f.prazoCausa} onChange={e => set("prazoCausa", e.target.value)} />} /><F lbl="Prazo — ação corretiva" tip="Data limite para execução de todas as ações do plano 5W2H. Recomendado: até 30 dias após a análise de causa." ch={<Inp type="date" value={f.prazoAC} onChange={e => set("prazoAC", e.target.value)} />} /></>} />
        <F lbl="Prazo — verificação de eficácia" tip="Data em que será verificado se a ação corretiva foi eficaz e o problema não voltou. Recomendado: 90 dias após a ação corretiva." ch={<Inp type="date" value={f.prazoEfic} onChange={e => set("prazoEfic", e.target.value)} sx={{ maxWidth: 300 }} />} />
      </div>
      )}

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingBottom: ".5rem" }}>
        <button style={s.btn} onClick={() => setTab("lista")}>Cancelar</button>
        <button style={s.btnA} onClick={salvar}>Salvar RNC →</button>
      </div>
    </div>
  );
}

export function IshikawaTab({ rncs, toast_, openEmail, doUpdateRNC }) {
  const T = useTheme(); const s = useS();
  const [sid, setSid] = useState("");
  const [efeito, setEfeito] = useState("");
  const [causes, setCauses] = useState({ mao: [], maquina: [], metodo: [], material: [], medicao: [], meioamb: [] });
  const [inps, setInps] = useState({ mao: "", maquina: "", metodo: "", material: "", medicao: "", meioamb: "" });
  const [wCausa, setWCausa] = useState(""); const [whys, setWhys] = useState(["", "", "", "", ""]); const [root, setRoot] = useState("");
  const r = rncs.find(x => x.id === sid);
  useEffect(() => { if (!r) return; setEfeito(r.ishikawa?.efeito || r.desc?.substring(0, 60) || ""); setCauses(r.ishikawa?.causes || { mao: [], maquina: [], metodo: [], material: [], medicao: [], meioamb: [] }); setWhys(r.ishikawa?.whys?.length ? r.ishikawa.whys : ["", "", "", "", ""]); setRoot(r.ishikawa?.root || ""); setWCausa(r.ishikawa?.whyCausa || ""); }, [sid]);
  const addC = cat => { const v = inps[cat]?.trim(); if (!v) return; setCauses(p => ({ ...p, [cat]: [...p[cat], v] })); setInps(p => ({ ...p, [cat]: "" })); };
  const remC = (cat, i) => setCauses(p => ({ ...p, [cat]: p[cat].filter((_, j) => j !== i) }));
  const [ishiAiLoading, setIshiAiLoading] = React.useState(false);
  const [porquesAiLoading, setPorquesAiLoading] = React.useState(false);
  const gerarPorquesIA = async () => {
    if (!r) { alert("Selecione uma RNC primeiro."); return; }
    if (!wCausa) { alert("Selecione a causa a aprofundar primeiro."); return; }
    setPorquesAiLoading(true);
    try {
      const res = await fetch("/api/claude", { method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ model:"claude-sonnet-4-5", max_tokens:800,
          messages:[{ role:"user", content:`Você é especialista em qualidade farmacêutica. Gere a análise dos 5 Porquês para a causa abaixo em uma indústria nutracêutica.

Problema: ${r.desc||""}
Causa a aprofundar: ${wCausa}
Produto: ${r.produto||""}

Responda APENAS em JSON sem markdown:
{"porques":["Por que 1?","Por que 2?","Por que 3?","Por que 4?","Por que 5?"],"causaRaiz":"causa raiz fundamental identificada"}` }]})});
      const data = await res.json();
      const txt = data.content?.[0]?.text || "";
      const parsed = JSON.parse(txt.replace(/```json|```/g,"").trim());
      if (parsed.porques?.length) setWhys(parsed.porques.slice(0,5).concat(Array(5).fill("")).slice(0,5));
      if (parsed.causaRaiz) setRoot(parsed.causaRaiz);
      toast_("5 Porquês gerados pela IA! Revise e ajuste.", "green");
    } catch(e) { toast_("Erro ao gerar com IA.", "red"); }
    setPorquesAiLoading(false);
  };
  const gerarIshikawaIA = async () => {
    if (!r) { alert("Selecione uma RNC primeiro."); return; }
    const desc = efeito || r.desc || r.ishikawa?.efeito || "";
    if (!desc) { alert("Preencha o campo Efeito primeiro."); return; }
    setIshiAiLoading(true);
    try {
      const res = await fetch("/api/claude", { method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ model:"claude-sonnet-4-5", max_tokens:1500,
          messages:[{ role:"user", content:`Você é especialista em qualidade farmacêutica (BPF, ANVISA). Para o problema abaixo, sugira causas potenciais para o diagrama de Ishikawa em uma indústria nutracêutica.

Problema: ${desc}
Produto: ${r.produto||""}
Tipo de NC: ${r.tipo||""}

Responda APENAS em JSON sem markdown:
{"mao":["causa1","causa2"],"maquina":["causa1","causa2"],"metodo":["causa1","causa2"],"material":["causa1","causa2"],"medicao":["causa1","causa2"],"meioamb":["causa1","causa2"]}` }]})});
      const data = await res.json();
      const txt = data.content?.[0]?.text || "";
      const parsed = JSON.parse(txt.replace(/\`\`\`json|\`\`\`/g,"").trim());
      setCauses(p => ({
        mao:     [...(p.mao||[]),     ...(parsed.mao||[])],
        maquina: [...(p.maquina||[]), ...(parsed.maquina||[])],
        metodo:  [...(p.metodo||[]),  ...(parsed.metodo||[])],
        material:[...(p.material||[]),...(parsed.material||[])],
        medicao: [...(p.medicao||[]), ...(parsed.medicao||[])],
        meioamb: [...(p.meioamb||[]), ...(parsed.meioamb||[])],
      }));
      toast_("Causas geradas pela IA! Revise e ajuste conforme necessário.", "green");
    } catch(e) { toast_("Erro ao gerar com IA.", "red"); }
    setIshiAiLoading(false);
  };

  const saveI = async () => { if (!r) return; const ishi = { ...r.ishikawa, efeito, causes }; await doUpdateRNC(r.id, { ishikawa: ishi, historico: [...(r.historico || []), { data: tod(), acao: "Ishikawa atualizado", resp: "—" }] }); toast_("Ishikawa salvo!", "green"); openEmail({ ...r, ishikawa: ishi }, "ishikawa"); };
  const saveW = async () => { if (!r) return; const ishi = { ...r.ishikawa, whys, root, whyCausa: wCausa }; await doUpdateRNC(r.id, { ishikawa: ishi, historico: [...(r.historico || []), { data: tod(), acao: "5 Porquês atualizado", resp: "—" }] }); toast_("5 Porquês salvos!", "green"); openEmail({ ...r, ishikawa: ishi }, "ishikawa"); };
  const CATS = [["mao", "👤 Mão de obra", T.blue], ["maquina", "⚙️ Máquina", T.orange], ["metodo", "📋 Método", T.accent], ["material", "📦 Material", T.yellow], ["medicao", "📏 Medição", T.purple], ["meioamb", "🌿 Meio ambiente", "#5dd4b0"]];
  return (
    <div>
      <div style={s.card}><SecTitle ch="Selecionar RNC" /><Sel value={sid} onChange={e => setSid(e.target.value)} sx={{ fontSize: 14, padding: "10px 14px" }}><option value="">— Selecione uma RNC —</option>{rncs.map(r => <option key={r.id} value={r.id}>{r.num} — {r.desc?.substring(0, 55)}</option>)}</Sel></div>
      {r && <>
        <div style={s.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}><SecTitle icon="🐟" ch="Diagrama de Ishikawa — 6M" /><span style={{ fontSize: 11, color: T.text3 }}>Clique em uma causa → usar nos 5 Porquês</span></div>
          <F lbl="Efeito / Problema central" tip="Descreva o problema que será analisado — copie exatamente a descrição da não conformidade. Ex: Cápsulas do lote 2024-001 com coloração fora do padrão." ch={<Inp value={efeito} onChange={e => setEfeito(e.target.value)} sx={{ fontSize: 15, fontWeight: 500, color: T.orange }} />} />
          <div style={{ background:`linear-gradient(135deg,${T.accentDim},${T.card2||T.card})`, border:`1px solid ${T.accent}33`, borderRadius:12, padding:"12px 14px", marginBottom:12, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:32, height:32, borderRadius:8, background:T.accent, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🤖</div>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:T.text }}>Assistente IA — Ishikawa</div>
                <div style={{ fontSize:11, color:T.text2 }}>Sugere causas potenciais por categoria com base na descrição da RNC</div>
              </div>
            </div>
            <button style={{ ...s.btnA, opacity:ishiAiLoading?.6:1, fontSize:11 }} onClick={gerarIshikawaIA} disabled={ishiAiLoading}>
              {ishiAiLoading ? "⟳ Gerando..." : "🤖 Gerar causas com IA"}
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: "1rem" }}>
            {CATS.map(([cat, label, color]) => (
              <div key={cat} style={{ background: T.surf, border: `1px solid ${T.border}`, borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}><Inp placeholder="Adicionar causa..." value={inps[cat]} onChange={e => setInps(p => ({ ...p, [cat]: e.target.value }))} onKeyDown={e => e.key === "Enter" && addC(cat)} sx={{ flex: 1, fontSize: 12 }} /><button style={{ ...s.btnA, padding: "6px 12px" }} onClick={() => addC(cat)}>+</button></div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{causes[cat]?.map((c, i) => <span key={i} onClick={() => setWCausa(c)} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: T.card2, border: `1px solid ${T.border2}`, borderRadius: 20, padding: "3px 10px", fontSize: 11, color: T.text2, cursor: "pointer" }}>{c}<span onClick={ev => { ev.stopPropagation(); remC(cat, i); }} style={{ color: T.text3, marginLeft: 2 }}>✕</span></span>)}</div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "right" }}><button style={s.btnA} onClick={saveI}>Salvar Ishikawa ✓</button></div>
        </div>
        <div style={s.card}>
          <SecTitle icon="🔍" ch="Análise dos 5 Porquês" />
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8, flexWrap:"wrap", gap:8 }}>
            <div style={{ fontSize:12, color:T.text2 }}>Selecione a causa e gere a análise automaticamente</div>
            <button style={{ ...s.btnA, opacity:porquesAiLoading?.6:1, fontSize:11 }} onClick={gerarPorquesIA} disabled={porquesAiLoading}>
              {porquesAiLoading ? "⟳ Gerando..." : "🤖 Gerar 5 Porquês com IA"}
            </button>
          </div>
          <F lbl="Causa a aprofundar" tip="Após preencher as categorias abaixo, selecione a causa mais provável para aprofundar com os 5 Porquês." ch={<Inp value={wCausa} onChange={e => setWCausa(e.target.value)} sx={{ color: T.yellow, fontWeight: 500 }} />} />
          {["Por quê ocorreu?", "Por quê isso aconteceu?", "Por quê essa causa existe?", "Por quê não foi controlado?", "Por quê não foi evitado?"].map((q, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ minWidth: 30, height: 30, borderRadius: "50%", background: `linear-gradient(135deg,${T.accent},${T.accent2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: "#fff", flexShrink: 0, boxShadow: `0 0 10px ${T.accentGlow}` }}>{i + 1}</div>
              <Inp placeholder={q} value={whys[i]} onChange={e => { const n = [...whys]; n[i] = e.target.value; setWhys(n); }} sx={{ flex: 1 }} />
              {i < 4 && <span style={{ color: T.text3, fontSize: 18 }}>↓</span>}
            </div>
          ))}
          <Divider />
          <F lbl="🎯 Causa raiz identificada" tip="Conclusão da análise — a causa fundamental que, se eliminada, evita que o problema se repita. Deve ser específica e acionável." ch={<TA rows={2} value={root} onChange={e => setRoot(e.target.value)} sx={{ borderColor: T.accent, color: T.accent }} placeholder="Conclusão: a causa raiz é..." />} />
          <div style={{ textAlign: "right" }}><button style={s.btnA} onClick={saveW}>Salvar análise →</button></div>
        </div>
      </>}
    </div>
  );
}

export function CAPATab({ rncs, user, toast_, openEmail, doUpdateRNC }) {
  const T = useTheme(); const s = useS();
  const [sid, setSid] = useState(""); const [acts, setActs] = useState([]);
  const r = rncs.find(x => x.id === sid);

  useEffect(() => {
    if (!r) return;
    const loaded = JSON.parse(JSON.stringify(r.w2h || []));
    // migração: se ação tem evidencia (string) mas não evidencias (array), inicializa array vazio
    setActs(loaded.map(a => ({ ...a, tipo: a.tipo || "Corretiva", evidencias: a.evidencias || [] })));
  }, [sid]);

  const add = () => setActs(p => [...p, { id: String(Date.now() + Math.random()), tipo: "Corretiva", what: "", why: "", who: user.name, where: "", when: "", how: "", howMuch: "", status: "Pendente", evidencias: [] }]);
  const upd = (i, k, v) => setActs(p => p.map((a, j) => j === i ? { ...a, [k]: v } : a));
  const del = i => setActs(p => p.filter((_, j) => j !== i));

  const [w2hAiLoading, setW2hAiLoading] = React.useState(false);
  const gerarW2HIA = async () => {
    if (!r) { alert("Selecione uma RNC primeiro."); return; }
    const causaRaiz = r.ishikawa?.root || r.ishikawa?.whyCausa || r.desc || "";
    if (!causaRaiz) { alert("Preencha a causa raiz no Ishikawa primeiro."); return; }
    setW2hAiLoading(true);
    try {
      const res = await fetch("/api/claude", { method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ model:"claude-sonnet-4-5", max_tokens:2000,
          messages:[{ role:"user", content:`Você é especialista em qualidade farmacêutica (BPF, ANVISA RDC 658/2022). Crie um plano de ação corretiva CAPA (Corrective and Preventive Action) para a não conformidade abaixo.

Problema: ${r.desc||""}
Causa raiz: ${causaRaiz}
Produto: ${r.produto||""}
Setor: ${r.setor||""}
Severidade: ${r.sev||""}

Gere de 3 a 5 ações. Para cada uma, defina se é "Corretiva" (elimina a causa da NC atual) ou "Preventiva" (evita que NC potencial ocorra).
Responda APENAS em JSON sem markdown:
[{"tipo":"Corretiva","what":"o que fazer","why":"por que","who":"responsável (cargo)","where":"local","when":"prazo ex: 15 dias","how":"como executar passo a passo","howMuch":"esforço estimado","status":"Pendente"}]` }]})});
      const data = await res.json();
      const txt = data.content?.[0]?.text || "";
      const parsed = JSON.parse(txt.replace(/\`\`\`json|\`\`\`/g,"").trim());
      setActs(p => [...p, ...parsed.map(a => ({ ...a, id: String(Date.now() + Math.random()), evidencias: [] }))]);
      toast_("Plano CAPA gerado pela IA! Revise e ajuste os responsáveis e prazos.", "green");
    } catch(e) { toast_("Erro ao gerar com IA.", "red"); }
    setW2hAiLoading(false);
  };

  // trava: exige ao menos 3 dos 5 porquês preenchidos
  const whysOk = (r?.ishikawa?.whys || []).filter(w => w?.trim()).length >= 3;

  const save = async () => {
    if (!r) return;
    if (!whysOk) { alert("Preencha ao menos 3 dos 5 Porquês antes de salvar o plano CAPA."); return; }
    await doUpdateRNC(r.id, { w2h: acts, historico: [...(r.historico || []), { data: tod(), acao: `CAPA — ${acts.length} ação(ões)`, resp: user.name }] });
    toast_("CAPA salvo!", "green");
    openEmail({ ...r, w2h: acts }, "5w2h");
  };

  const sc = { "Pendente": T.yellow, "Em andamento": T.blue, "Concluída": T.accent, "Cancelada": "#ff4f6a" };
  const tipoColor = { "Corretiva": T.accent, "Preventiva": T.purple || "#8b5cf6" };
  const hoje = tod();

  const concluidas = acts.filter(a => a.status === "Concluída" || a.status === "Cancelada").length;
  const total = acts.length;

  return (
    <div>
      <div style={s.card}><SecTitle ch="Selecionar RNC" /><Sel value={sid} onChange={e => setSid(e.target.value)} sx={{ fontSize: 14, padding: "10px 14px" }}><option value="">— Selecione uma RNC —</option>{rncs.map(r => <option key={r.id} value={r.id}>{r.num} — {r.desc?.substring(0, 55)}</option>)}</Sel></div>
      {r && <div style={s.card}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, flexWrap:"wrap", gap:8 }}>
          <SecTitle icon="📋" ch="Plano CAPA — Ações Corretivas e Preventivas" />
          {total > 0 && (
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ fontSize:12, color:T.text2 }}>{concluidas}/{total} concluídas</div>
              <div style={{ width:120, height:6, background:T.border, borderRadius:3, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${total > 0 ? (concluidas/total)*100 : 0}%`, background: concluidas === total ? T.accent : T.blue, borderRadius:3, transition:"width .3s" }} />
              </div>
            </div>
          )}
        </div>

        {/* Aviso se 5 Porquês incompletos */}
        {!whysOk && (
          <div style={{ background:"#ff4f6a18", border:"1px solid #ff4f6a44", borderRadius:8, padding:"10px 14px", marginBottom:12, fontSize:12, color:"#ff4f6a" }}>
            Para salvar o plano CAPA, complete ao menos 3 dos 5 Porquês na aba de Análise de Causa (Ishikawa).
          </div>
        )}

        {acts.length === 0 && <div style={{ textAlign: "center", padding: "1.5rem", color: T.text3, fontSize: 13, border: `1px dashed ${T.border2}`, borderRadius: 10 }}>Nenhuma ação. Clique em "+ Adicionar" ou use a IA.</div>}
        {acts.map((a, i) => {
          const vencida = a.when && a.when < hoje && a.status !== "Concluída" && a.status !== "Cancelada";
          const evArr = Array.isArray(a.evidencias) ? a.evidencias : [];
          return (
            <div key={a.id || i} style={{ background: T.surf, border: `1px solid ${vencida ? "#ff4f6a88" : T.border}`, borderRadius: 8, padding: "1rem", marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, flexWrap:"wrap", gap:6 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.accent, textTransform: "uppercase" }}>Ação #{i + 1}</span>
                  <select value={a.tipo || "Corretiva"} onChange={e => upd(i, "tipo", e.target.value)}
                    style={{ ...s.inp, width:"auto", fontSize:10, padding:"3px 8px", fontWeight:700, color: tipoColor[a.tipo || "Corretiva"], border:`1px solid ${tipoColor[a.tipo || "Corretiva"]}55` }}>
                    <option>Corretiva</option>
                    <option>Preventiva</option>
                  </select>
                  {vencida && <span style={{ fontSize:10, color:"#ff4f6a", fontWeight:700 }}>PRAZO VENCIDO</span>}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <select value={a.status} onChange={e => upd(i, "status", e.target.value)} style={{ ...s.inp, width: "auto", minWidth: 130, fontSize: 11, padding: "4px 8px", color: sc[a.status] || T.text }}>{["Pendente", "Em andamento", "Concluída", "Cancelada"].map(x => <option key={x}>{x}</option>)}</select>
                  <button style={s.btnD} onClick={() => del(i)}>✕ Remover</button>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <F lbl="O quê?" tip="Descreva a ação a executar. Use verbos de ação. Ex: Revisar e atualizar o PO-CQ-003." ch={<Inp placeholder="Ação a executar" value={a.what} onChange={e => upd(i, "what", e.target.value)} />} />
                <F lbl="Por quê?" tip="Justifique conectando com a causa raiz identificada." ch={<Inp placeholder="Justificativa" value={a.why} onChange={e => upd(i, "why", e.target.value)} />} />
                <F lbl="Quem?" tip="Responsável pela execução — nome específico, não setor." ch={<Inp value={a.who} onChange={e => upd(i, "who", e.target.value)} />} />
                <F lbl="Onde?" tip="Local de execução. Ex: Linha de produção 2, Lab. CQ." ch={<Inp value={a.where} onChange={e => upd(i, "where", e.target.value)} />} />
                <F lbl="Quando?" tip="Data limite. Alinhada com o prazo de ação corretiva da RNC." ch={<Inp type="date" value={a.when} onChange={e => upd(i, "when", e.target.value)} />} />
                <F lbl="Custo/Esforço" tip="Estimativa de recursos. Ex: 4h de trabalho, R$ 500." ch={<Inp value={a.howMuch} onChange={e => upd(i, "howMuch", e.target.value)} />} />
                <div style={{ gridColumn: "span 2" }}><F lbl="Como?" tip="Passo a passo de execução." ch={<TA rows={2} value={a.how} onChange={e => upd(i, "how", e.target.value)} />} /></div>
                <div style={{ gridColumn: "span 2" }}>
                  <F lbl="Evidências de execução" tip="Anexe arquivos que comprovem a conclusão: foto, relatório, registro de treinamento." ch={
                    <div>
                      {/* legado: exibe evidencia (string) de ações antigas */}
                      {typeof a.evidencia === "string" && a.evidencia && !evArr.length && (
                        <div style={{ fontSize:11, color:T.text2, background:T.card2, border:`1px solid ${T.border}`, borderRadius:6, padding:"6px 10px", marginBottom:8 }}>
                          Registro anterior: {a.evidencia}
                        </div>
                      )}
                      <AnexosUpload
                        inputId={`capa-ev-${i}`}
                        anexos={evArr}
                        setAnexos={novos => upd(i, "evidencias", typeof novos === "function" ? novos(evArr) : novos)}
                      />
                      {a.status === "Concluída" && !evArr.length && !(a.evidencia) && (
                        <div style={{ fontSize:10, color:"#ff4f6a", marginTop:4 }}>Ação concluída — anexe ao menos um arquivo como evidência.</div>
                      )}
                    </div>
                  } />
                </div>
              </div>
            </div>
          );
        })}
        <div style={{ background:`linear-gradient(135deg,${T.accentDim},${T.card2||T.card})`, border:`1px solid ${T.accent}33`, borderRadius:12, padding:"12px 14px", marginBottom:8, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:T.accent, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🤖</div>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:T.text }}>Assistente IA — CAPA</div>
              <div style={{ fontSize:11, color:T.text2 }}>Gera o plano corretivo/preventivo baseado na causa raiz do Ishikawa</div>
            </div>
          </div>
          <button style={{ ...s.btnA, opacity:w2hAiLoading?.6:1, fontSize:11 }} onClick={gerarW2HIA} disabled={w2hAiLoading}>
            {w2hAiLoading ? "⟳ Gerando..." : "🤖 Gerar plano com IA"}
          </button>
        </div>
        <button style={{ ...s.btn, width: "100%", borderStyle: "dashed", color: T.text3, marginTop: 6 }} onClick={add}>+ Adicionar nova ação</button>
        <div style={{ textAlign: "right", marginTop: "1rem" }}><button style={s.btnA} onClick={save}>Salvar e notificar →</button></div>
      </div>}
    </div>
  );
}

// alias de retrocompatibilidade — importações antigas do W2HTab continuam funcionando
export const W2HTab = CAPATab;

export function EficaciaTab({ rncs, toast_, openEmail, doUpdateRNC }) {
  const T = useTheme(); const s = useS();
  const [sid, setSid] = useState(""); const [f, setF] = useState({ criterio: "", data: "", resp: "", evidencias: "", resultado: "", obs: "" });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const r = rncs.find(x => x.id === sid);
  useEffect(() => { if (!r) return; setF({ criterio: r.eficacia?.criterio || "", data: r.eficacia?.data || "", resp: r.eficacia?.resp || "", evidencias: r.eficacia?.evidencias || "", resultado: r.eficacia?.resultado || "", obs: r.eficacia?.obs || "" }); }, [sid]);

  const [eficAiLoading, setEficAiLoading] = React.useState(false);
  const gerarEficaciaIA = async () => {
    if (!r) { alert("Selecione uma RNC primeiro."); return; }
    setEficAiLoading(true);
    try {
      const res = await fetch("/api/claude", { method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ model:"claude-sonnet-4-5", max_tokens:800,
          messages:[{ role:"user", content:`Você é especialista em qualidade farmacêutica. Sugira um critério de verificação de eficácia e lições aprendidas para esta NC.

Problema: ${r.desc||""}
Causa raiz: ${r.ishikawa?.root||r.ishikawa?.whyCausa||""}
Ações executadas: ${(r.w2h||[]).map(a=>a.what).join("; ")}
Severidade: ${r.sev||""}

Responda APENAS em JSON sem markdown:
{"criterio":"critério objetivo e mensurável","obs":"lições aprendidas e recomendações sistêmicas"}` }]})});
      const data = await res.json();
      const txt = data.content?.[0]?.text || "";
      const parsed = JSON.parse(txt.replace(/```json|```/g,"").trim());
      setF(p => ({ ...p, criterio: parsed.criterio||p.criterio, obs: parsed.obs||p.obs }));
      toast_("Critério gerado pela IA! Ajuste conforme necessário.", "green");
    } catch(e) { toast_("Erro ao gerar com IA.", "red"); }
    setEficAiLoading(false);
  };

  const save = async () => {
    if (!r) return;
    const ns = f.resultado === "Eficaz" ? "Eficaz" : f.resultado === "Ineficaz" ? "Ineficaz" : "Pendente verificação";
    await doUpdateRNC(r.id, { eficacia: f, status: ns, historico: [...(r.historico || []), { data: tod(), acao: `Eficácia: ${f.resultado}`, resp: f.resp || "—" }] });
    toast_("Verificação registrada!", "green");
    openEmail({ ...r, eficacia: f, status: ns }, "eficacia");
  };
  return (
    <div>
      <div style={s.card}><SecTitle ch="Selecionar RNC" /><Sel value={sid} onChange={e => setSid(e.target.value)} sx={{ fontSize: 14, padding: "10px 14px" }}><option value="">— Selecione uma RNC —</option>{rncs.map(r => <option key={r.id} value={r.id}>{r.num} — {r.desc?.substring(0, 55)}</option>)}</Sel></div>
      {r && <div style={s.card}>
        <SecTitle icon="✅" ch="Verificação de eficácia" />
        {/* IA Button */}
        <div style={{ background:`linear-gradient(135deg,${T.accentDim},${T.card2||T.card})`, border:`1px solid ${T.accent}33`, borderRadius:12, padding:"12px 14px", marginBottom:12, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:`linear-gradient(135deg,${T.accent},${T.accent})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🤖</div>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:T.text }}>Assistente IA — Eficácia</div>
              <div style={{ fontSize:11, color:T.text2 }}>Sugere critério de verificação e lições aprendidas com base nas ações executadas</div>
            </div>
          </div>
          <button style={{ ...s.btnA, opacity:eficAiLoading?.6:1, fontSize:11 }} onClick={gerarEficaciaIA} disabled={eficAiLoading}>
            {eficAiLoading ? "⟳ Gerando..." : "🤖 Gerar critério com IA"}
          </button>
        </div>
        <F lbl="Critério de verificação" tip="Defina como será verificado se a ação corretiva resolveu o problema. Ex: Ausência de reclamações do mesmo tipo nos próximos 90 dias, ou lote seguinte aprovado em 100% das análises." ch={<TA rows={3} value={f.criterio} onChange={e => set("criterio", e.target.value)} placeholder="Ex: Ausência de telescopia em 3 lotes consecutivos; Cp ≥ 1,33" />} />
        <G2 ch={<><F lbl="Data da verificação" tip="Data em que a verificação de eficácia foi ou será realizada. Deve coincidir com o prazo de eficácia definido na RNC." ch={<Inp type="date" value={f.data} onChange={e => set("data", e.target.value)} />} /><F lbl="Responsável" ch={<Inp value={f.resp} onChange={e => set("resp", e.target.value)} />} /></>} />
        <F lbl="Evidências coletadas" tip="Descreva as evidências que comprovam que a ação foi eficaz. Ex: Análise dos lotes subsequentes sem desvios, relatório de auditoria interna, registros de treinamento." ch={<TA rows={3} value={f.evidencias} onChange={e => set("evidencias", e.target.value)} />} />
        {/* trava: bloqueia resultado se há ações CAPA pendentes */}
        {(() => {
          const acoesPendentes = (r.w2h || []).filter(a => a.status !== "Concluída" && a.status !== "Cancelada");
          return acoesPendentes.length > 0 ? (
            <div style={{ background:"#ff4f6a18", border:"1px solid #ff4f6a44", borderRadius:8, padding:"10px 14px", marginBottom:12, fontSize:12, color:"#ff4f6a" }}>
              Existem {acoesPendentes.length} ação(ões) CAPA ainda pendente(s) ou em andamento. Conclua ou cancele todas as ações antes de registrar o resultado de eficácia.
              <ul style={{ margin:"6px 0 0 16px", padding:0 }}>{acoesPendentes.map((a,i) => <li key={i}>{a.what || `Ação ${i+1}`} — {a.status}</li>)}</ul>
            </div>
          ) : null;
        })()}
        <F lbl="Resultado da verificação" tip="Eficaz: o problema não se repetiu e as ações foram suficientes. Ineficaz: o problema persistiu — uma nova RNC deverá ser aberta com análise de causa complementar." ch={
          <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap", opacity: (r.w2h||[]).some(a => a.status !== "Concluída" && a.status !== "Cancelada") ? 0.4 : 1, pointerEvents: (r.w2h||[]).some(a => a.status !== "Concluída" && a.status !== "Cancelada") ? "none" : "auto" }}>
            {[["Eficaz", T.accent, "Causa raiz eliminada"], ["Ineficaz", "#ff4f6a", "NC recorreu, reabrir"], ["Pendente verificação", T.yellow, "Aguardando dados"]].map(([v, color, desc]) => (
              <label key={v} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "10px 16px", background: f.resultado === v ? `${color}18` : T.surf, border: `1px solid ${f.resultado === v ? color + "55" : T.border}`, borderRadius: 8, flex: 1, minWidth: 150 }}>
                <input type="radio" name="efic_r" value={v} checked={f.resultado === v} onChange={() => set("resultado", v)} style={{ accentColor: color }} />
                <div><div style={{ fontWeight: 600, color, fontSize: 12 }}>{v}</div><div style={{ fontSize: 10, color: T.text3 }}>{desc}</div></div>
              </label>
            ))}
          </div>
        } />
        <F lbl="Lições aprendidas / Observações finais" tip="Registre o aprendizado gerado por esta NC. O que pode ser melhorado no sistema para evitar recorrências? Este campo alimenta a análise de tendência." ch={<TA rows={3} value={f.obs} onChange={e => set("obs", e.target.value)} />} />
        <div style={{ textAlign: "right" }}><button style={s.btnA} onClick={save}>Registrar e notificar ✓</button></div>
      </div>}
    </div>
  );
}

export function DashTab({ rncs }) {
  const T = useTheme(); const s = useS();
  const [dashTab, setDashTab] = useState("kpis");

  const tot = rncs.length;
  const ef = rncs.filter(x=>x.status==="Eficaz").length;
  const ab = rncs.filter(x=>x.status==="Aberta").length;
  const venc = rncs.filter(r=>r.prazoAC&&r.prazoAC<tod()&&r.status!=="Eficaz"&&r.status!=="Ineficaz");
  const critica = rncs.filter(x=>x.sev==="Crítica").length;
  const taxaEf = tot>0?Math.round(ef/tot*100):0;

  // Tempo médio resolução
  const resolvidas = rncs.filter(x=>x.status==="Eficaz"&&x.data&&x.eficacia?.data);
  const tempoMedio = resolvidas.length>0?Math.round(resolvidas.reduce((a,r)=>{
    const d1=new Date(r.data);const d2=new Date(r.eficacia.data);
    return a+(d2-d1)/(1000*60*60*24);
  },0)/resolvidas.length):null;

  // Reincidência (mesma causa raiz)
  const causas = {};
  rncs.filter(x=>x.ishikawa?.root).forEach(r=>{ causas[r.ishikawa.root]=(causas[r.ishikawa.root]||0)+1; });
  const reincidentes = Object.values(causas).filter(v=>v>1).length;

  // Por tipo (Pareto)
  const bT={},bS={},bF={};
  rncs.forEach(r=>{
    bT[r.tipo]=(bT[r.tipo]||0)+1;
    bS[r.status]=(bS[r.status]||0)+1;
    if(r.fornecedor)bF[r.fornecedor]=(bF[r.fornecedor]||0)+1;
  });

  // PDCA — agrupar RNCs por fase
  const pdcaFases = {
    P: rncs.filter(x=>x.status==="Aberta"||x.status==="Em andamento").filter(x=>!x.ishikawa?.root),
    D: rncs.filter(x=>x.ishikawa?.root&&(!x.w2h||x.w2h.length===0)),
    C: rncs.filter(x=>x.w2h?.length>0&&x.status==="Pendente verificação"),
    A: rncs.filter(x=>x.status==="Eficaz"),
  };

  // Pareto acumulado
  const paretoData = Object.entries(bT).sort((a,b)=>b[1]-a[1]);
  const paretoTotal = paretoData.reduce((s,[,n])=>s+n,0);
  let acum=0;
  const paretoAcum = paretoData.map(([k,n])=>{ acum+=n; return [k,n,Math.round(acum/paretoTotal*100)]; });

  // Matriz GUT das RNCs abertas
  const gutRncs = rncs.filter(x=>x.status==="Aberta"||x.status==="Em andamento").map(r=>({
    ...r,
    G: r.sev==="Crítica"?5:r.sev==="Maior"?3:1,
    U: past(r.prazoAC)?5:r.prazoAC?3:2,
    T: r.sev==="Crítica"?5:r.sev==="Maior"?3:2,
    gut: (r.sev==="Crítica"?5:r.sev==="Maior"?3:1)*(past(r.prazoAC)?5:r.prazoAC?3:2)*(r.sev==="Crítica"?5:r.sev==="Maior"?3:2)
  })).sort((a,b)=>b.gut-a.gut);

  const DASH_TABS=[
    {id:"kpis",icon:"📈",label:"KPIs"},
    {id:"pareto",icon:"📊",label:"Pareto"},
    {id:"gut",icon:"🎯",label:"Matriz GUT"},
    {id:"pdca",icon:"🔄",label:"PDCA"},
  ];

  return (
    <div>
      {/* Sub-navegação */}
      <div style={{ display:"flex", gap:4, marginBottom:"1rem", background:T.surf, border:`1px solid ${T.border}`, borderRadius:10, padding:4 }}>
        {DASH_TABS.map(dt=>(
          <button key={dt.id} onClick={()=>setDashTab(dt.id)} style={{ flex:1, padding:"7px 10px", border:dashTab===dt.id?`1px solid ${T.accent}33`:"1px solid transparent", background:dashTab===dt.id?T.accentDim:"transparent", color:dashTab===dt.id?T.accent:T.text2, cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:dashTab===dt.id?600:400, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}>
            {dt.icon} {dt.label}
          </button>
        ))}
      </div>

      {/* ── KPIs ── */}
      {dashTab==="kpis"&&(
        <>
          {/* Cards principais */}
          <div className="kpi-grid" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:"1rem" }}>
            {[
              {l:"Taxa de Eficácia",n:`${taxaEf}%`,c:taxaEf>=70?T.accent:"#ff8c42",sub:`${ef}/${tot} RNCs resolvidas`,icon:"✅",trend:taxaEf>=70?"↑ Bom":"↓ Atenção"},
              {l:"RNCs Abertas",n:ab,c:ab>0?"#ff4f6a":T.accent,sub:"Requerem ação",icon:"📋",trend:ab===0?"✓ Limpo":"⚠ Pendente"},
              {l:"Tempo Médio Resolução",n:tempoMedio?`${tempoMedio}d`:"N/D",c:T.blue,sub:"Da abertura à eficácia",icon:"⏱️",trend:tempoMedio&&tempoMedio<=30?"↑ Eficiente":tempoMedio?"↓ Avaliar":"—"},
              {l:"Causa Raiz Reincidente",n:reincidentes,c:reincidentes>0?"#ff8c42":T.accent,sub:"Mesma causa em +1 RNC",icon:"🔄",trend:reincidentes===0?"✓ Sem reincidência":"⚠ Atenção"},
            ].map(({l,n,c,sub,icon,trend})=>(
              <div key={l} style={{ background:T.card, border:`1px solid ${c}22`, borderRadius:14, padding:"1.1rem", position:"relative", overflow:"hidden", boxShadow:`0 0 20px ${c}10` }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                  <span style={{ fontSize:22, opacity:.5 }}>{icon}</span>
                  <span style={{ fontSize:10, fontWeight:600, color:c, background:`${c}18`, padding:"2px 8px", borderRadius:20 }}>{trend}</span>
                </div>
                <div style={{ fontSize:30, fontWeight:800, color:c, lineHeight:1, marginBottom:4 }}>{n}</div>
                <div style={{ fontSize:11, fontWeight:700, color:T.text, marginBottom:2 }}>{l}</div>
                <div style={{ fontSize:10, color:T.text3 }}>{sub}</div>
                <div style={{ position:"absolute", bottom:-12, right:-12, width:60, height:60, borderRadius:"50%", background:c, opacity:.05 }}/>
              </div>
            ))}
          </div>

          {/* KPIs secundários */}
          <div className="kpi-grid" style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10, marginBottom:"1rem" }}>
            {[
              ["Total RNCs",tot,T.accent],
              ["Críticas",critica,"#ff4f6a"],
              ["Vencidas",venc.length,"#ffd166"],
              ["Eficazes",ef,T.accent],
              ["Ineficazes",rncs.filter(x=>x.status==="Ineficaz").length,"#ff8c42"],
            ].map(([l,n,c])=>(
              <div key={l} style={{ background:T.surf, border:`1px solid ${T.border}`, borderRadius:10, padding:"10px 14px", textAlign:"center" }}>
                <div style={{ fontSize:22, fontWeight:700, color:c }}>{n}</div>
                <div style={{ fontSize:10, color:T.text3, textTransform:"uppercase", letterSpacing:".04em", marginTop:2 }}>{l}</div>
              </div>
            ))}
          </div>

          {/* Barras por status e tipo */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
            {[["Por Status",bS,Object.fromEntries(Object.keys(SMETA).map(k=>[k,SMETA[k].dot]))],["Por Tipo",bT,TIPOC]].map(([title,data,cm])=>(
              <div key={title} style={{ ...s.card }}>
                <SecTitle ch={title}/>
                {Object.entries(data).sort((a,b)=>b[1]-a[1]).map(([k,n])=>{
                  const max=Math.max(...Object.values(data),1);
                  return <div key={k} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                    <div style={{ minWidth:130, fontSize:12, color:T.text2 }}>{k}</div>
                    <div style={{ flex:1, height:7, background:T.surf, borderRadius:4, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${Math.round(n/max*100)}%`, background:cm[k]||T.accent, borderRadius:4, transition:"width .6s" }}/>
                    </div>
                    <div style={{ minWidth:20, fontSize:12, fontWeight:700, color:T.text2, textAlign:"right" }}>{n}</div>
                  </div>;
                })}
              </div>
            ))}
          </div>

          {/* Vencidas */}
          {venc.length>0&&<div style={{ ...s.card, marginTop:14 }}>
            <SecTitle icon="⚠️" ch="Prazos de ação corretiva vencidos"/>
            {venc.map(r=>(
              <div key={r.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", background:"#ff4f6a12", border:"1px solid #ff4f6a30", borderRadius:10, marginBottom:8 }}>
                <div><div style={{ fontSize:13, fontWeight:600, color:"#ff4f6a" }}>{r.num}</div><div style={{ fontSize:12, color:T.text2, marginTop:2 }}>{r.desc?.substring(0,55)}...</div></div>
                <div style={{ textAlign:"right" }}><div style={{ fontSize:11, color:"#ff4f6a", fontWeight:700 }}>VENCIDO</div><div style={{ fontSize:11, color:T.text3 }}>{fmt(r.prazoAC)}</div></div>
              </div>
            ))}
          </div>}
        </>
      )}

      {/* ── PARETO ── */}
      {dashTab==="pareto"&&(
        <div>
          <div style={{ ...s.card, marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:600, color:T.text, marginBottom:4 }}>Gráfico de Pareto — Tipos de Não Conformidade</div>
            <div style={{ fontSize:11, color:T.text2, marginBottom:"1rem", paddingBottom:".75rem", borderBottom:`1px solid ${T.border}` }}>
              Identifica quais tipos de NC representam 80% dos problemas. Foque nos primeiros itens da lista.
            </div>
            {paretoAcum.length===0?<div style={{ color:T.text3, fontSize:13, textAlign:"center", padding:"2rem" }}>Sem dados.</div>:
            paretoAcum.map(([k,n,acPct],i)=>{
              const maxN=paretoAcum[0][1];
              const is80=acPct<=80;
              return <div key={k} style={{ marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ width:20, height:20, borderRadius:"50%", background:is80?T.accent:T.border, color:is80?"#fff":T.text3, display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, flexShrink:0 }}>{i+1}</span>
                    <span style={{ fontSize:13, color:T.text, fontWeight:is80?600:400 }}>{k}</span>
                    {is80&&<span style={{ fontSize:9, background:T.accentDim, color:T.accent, padding:"1px 6px", borderRadius:20, fontWeight:700 }}>80%</span>}
                  </div>
                  <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                    <span style={{ fontSize:11, color:T.text3 }}>Acum: {acPct}%</span>
                    <span style={{ fontSize:14, fontWeight:700, color:is80?T.accent:T.text2 }}>{n}</span>
                  </div>
                </div>
                <div style={{ height:10, background:T.surf, borderRadius:5, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${Math.round(n/maxN*100)}%`, background:is80?`linear-gradient(to right,${T.accent},${T.accent2})`:T.border, borderRadius:5, transition:"width .6s", boxShadow:is80?`0 0 8px ${T.accentGlow}`:""  }}/>
                </div>
              </div>;
            })}
            <div style={{ marginTop:"1rem", padding:"10px 14px", background:`${T.accent}12`, border:`1px solid ${T.accent}22`, borderRadius:8, fontSize:12, color:T.text2 }}>
              💡 <b style={{ color:T.accent }}>Regra 80/20:</b> Os tipos destacados em verde representam ~80% das não conformidades. Priorize ações preventivas nessas categorias para o maior impacto.
            </div>
          </div>

          {/* Pareto por Fornecedor */}
          <div style={s.card}>
            <div style={{ fontSize:13, fontWeight:600, color:T.text, marginBottom:4 }}>Pareto — Fornecedores com maior incidência</div>
            <div style={{ fontSize:11, color:T.text2, marginBottom:"1rem", paddingBottom:".75rem", borderBottom:`1px solid ${T.border}` }}>
              Fornecedores que mais geram não conformidades.
            </div>
            {Object.keys(bF).length===0?<div style={{ color:T.text3, fontSize:13, textAlign:"center", padding:"2rem" }}>Nenhum fornecedor identificado nas RNCs.</div>:
            Object.entries(bF).sort((a,b)=>b[1]-a[1]).map(([f,n],i)=>{
              const maxN=Math.max(...Object.values(bF));
              return <div key={f} style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10 }}>
                <span style={{ width:22, height:22, borderRadius:"50%", background:i===0?"#ff4f6a22":T.border, color:i===0?"#ff4f6a":T.text3, display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, flexShrink:0 }}>{i+1}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, color:T.text, fontWeight:500, marginBottom:4 }}>{f}{i===0&&<span style={{ marginLeft:6, fontSize:9, color:"#ff4f6a", background:"#ff4f6a18", padding:"1px 6px", borderRadius:20, fontWeight:700 }}>MAIOR INCIDÊNCIA</span>}</div>
                  <div style={{ height:7, background:T.surf, borderRadius:4, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${Math.round(n/maxN*100)}%`, background:i===0?"#ff4f6a":T.accent, borderRadius:4 }}/>
                  </div>
                </div>
                <span style={{ fontSize:15, fontWeight:700, color:i===0?"#ff4f6a":T.accent, minWidth:24 }}>{n}</span>
              </div>;
            })}
          </div>
        </div>
      )}

      {/* ── MATRIZ GUT ── */}
      {dashTab==="gut"&&(
        <div>
          <div style={{ ...s.card, marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:600, color:T.text, marginBottom:4 }}>Matriz GUT — Priorização de RNCs</div>
            <div style={{ fontSize:11, color:T.text2, marginBottom:"1rem", paddingBottom:".75rem", borderBottom:`1px solid ${T.border}` }}>
              Classifica automaticamente as RNCs abertas por Gravidade × Urgência × Tendência. Maior pontuação = maior prioridade.
            </div>
            <div style={{ display:"flex", gap:10, marginBottom:"1rem" }}>
              {[["G","Gravidade","Impacto no processo/produto"],["U","Urgência","Necessidade de ação imediata"],["T","Tendência","Propensão a piorar"]].map(([l,t,d])=>(
                <div key={l} style={{ flex:1, background:T.surf, borderRadius:10, padding:"10px 14px", border:`1px solid ${T.border}` }}>
                  <div style={{ fontSize:20, fontWeight:800, color:T.accent, lineHeight:1 }}>{l}</div>
                  <div style={{ fontSize:12, fontWeight:600, color:T.text, marginTop:2 }}>{t}</div>
                  <div style={{ fontSize:10, color:T.text3 }}>{d}</div>
                </div>
              ))}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, color:T.text3, padding:"0 8px" }}>×</div>
              <div style={{ flex:1, background:T.accentDim, border:`1px solid ${T.accent}33`, borderRadius:10, padding:"10px 14px" }}>
                <div style={{ fontSize:20, fontWeight:800, color:T.accent, lineHeight:1 }}>GUT</div>
                <div style={{ fontSize:12, fontWeight:600, color:T.text, marginTop:2 }}>Pontuação</div>
                <div style={{ fontSize:10, color:T.text2 }}>G×U×T (1-125)</div>
              </div>
            </div>

            {gutRncs.length===0?<div style={{ color:T.text3, fontSize:13, textAlign:"center", padding:"2rem" }}>Nenhuma RNC aberta ou em andamento.</div>:
            gutRncs.map((r,i)=>{
              const gutColor=r.gut>=75?"#ff4f6a":r.gut>=27?"#ff8c42":"#ffd166";
              const prioridade=r.gut>=75?"🔴 ALTA":r.gut>=27?"🟠 MÉDIA":"🟡 BAIXA";
              return <div key={r.id} style={{ background:T.surf, border:`1px solid ${r.gut>=75?"#ff4f6a33":T.border}`, borderRadius:10, padding:"12px 16px", marginBottom:8, display:"flex", alignItems:"center", gap:14 }}>
                <div style={{ width:40, height:40, borderRadius:10, background:`${gutColor}22`, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", flexShrink:0 }}>
                  <div style={{ fontSize:16, fontWeight:800, color:gutColor, lineHeight:1 }}>{r.gut}</div>
                  <div style={{ fontSize:8, color:T.text3 }}>GUT</div>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                    <span style={{ fontSize:11, fontWeight:700, color:T.accent }}>{r.num}</span>
                    <SevB s={r.sev}/>
                    <span style={{ fontSize:10, fontWeight:600, color:gutColor }}>{prioridade}</span>
                  </div>
                  <div style={{ fontSize:12, color:T.text, marginBottom:4 }}>{r.desc?.substring(0,70)}...</div>
                  <div style={{ fontSize:10, color:T.text2 }}>
                    G={r.G} · U={r.U} · T={r.T} · Resp: {r.resp||"—"}{past(r.prazoAC)?" · ⚠ VENCIDO":""}
                  </div>
                </div>
                <div style={{ textAlign:"center", flexShrink:0 }}>
                  <div style={{ fontSize:10, color:T.text3 }}>Prioridade</div>
                  <div style={{ fontSize:18, fontWeight:700, color:gutColor }}>#{i+1}</div>
                </div>
              </div>;
            })}
            <div style={{ marginTop:"1rem", padding:"10px 14px", background:`${T.accent}12`, border:`1px solid ${T.accent}22`, borderRadius:8, fontSize:12, color:T.text2 }}>
              💡 <b style={{ color:T.accent }}>Como usar:</b> Resolva as RNCs na ordem do ranking GUT. As pontuações são calculadas automaticamente com base na severidade e prazo de cada RNC.
            </div>
          </div>
        </div>
      )}

      {/* ── PDCA ── */}
      {dashTab==="pdca"&&(
        <div>
          <div style={{ ...s.card, marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:600, color:T.text, marginBottom:4 }}>Ciclo PDCA — Visão do Ciclo de Melhoria</div>
            <div style={{ fontSize:11, color:T.text2, marginBottom:"1rem", paddingBottom:".75rem", borderBottom:`1px solid ${T.border}` }}>
              Mostra em qual fase do ciclo PDCA cada RNC se encontra atualmente.
            </div>

            {/* PDCA wheel visual */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:"1.5rem" }}>
              {[
                {l:"P — Plan",sub:"Planejar",desc:"Abertas sem análise de causa",color:"#4fc3f7",rncs_:pdcaFases.P,icon:"📋"},
                {l:"D — Do",sub:"Executar",desc:"Causa identificada, aguardando 5W2H",color:"#ffd166",rncs_:pdcaFases.D,icon:"⚙️"},
                {l:"C — Check",sub:"Verificar",desc:"Plano executado, em verificação",color:"#ff8c42",rncs_:pdcaFases.C,icon:"🔍"},
                {l:"A — Act",sub:"Agir",desc:"Ação eficaz — padronizar",color:"#2ab84a",rncs_:pdcaFases.A,icon:"✅"},
              ].map(({l,sub,desc,color,rncs_,icon})=>(
                <div key={l} style={{ background:T.surf, border:`1px solid ${color}33`, borderRadius:12, padding:"1rem", position:"relative", overflow:"hidden" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                    <div>
                      <div style={{ fontSize:16, fontWeight:800, color, lineHeight:1 }}>{l}</div>
                      <div style={{ fontSize:11, color:T.text2, marginTop:2 }}>{sub} — {desc}</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:28, fontWeight:800, color }}>{rncs_.length}</div>
                      <div style={{ fontSize:9, color:T.text3 }}>RNC(s)</div>
                    </div>
                  </div>
                  {rncs_.length>0&&(
                    <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                      {rncs_.slice(0,3).map(r=>(
                        <div key={r.id} style={{ fontSize:11, color:T.text2, background:T.card, borderRadius:6, padding:"4px 8px", display:"flex", justifyContent:"space-between" }}>
                          <span style={{ fontWeight:600, color }}>{r.num}</span>
                          <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:160 }}>{r.desc?.substring(0,35)}...</span>
                        </div>
                      ))}
                      {rncs_.length>3&&<div style={{ fontSize:10, color:T.text3, textAlign:"center" }}>+{rncs_.length-3} mais</div>}
                    </div>
                  )}
                  <div style={{ position:"absolute", bottom:-16, right:-16, width:60, height:60, borderRadius:"50%", background:color, opacity:.08 }}/>
                </div>
              ))}
            </div>

            {/* Fluxo visual */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"12px 0", borderTop:`1px solid ${T.border}` }}>
              {[["P","📋","#4fc3f7"],["D","⚙️","#ffd166"],["C","🔍","#ff8c42"],["A","✅","#2ab84a"]].map(([l,icon,c],i)=>(
                <React.Fragment key={l}>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                    <div style={{ width:44, height:44, borderRadius:"50%", background:`${c}22`, border:`2px solid ${c}55`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>{icon}</div>
                    <span style={{ fontSize:12, fontWeight:700, color:c }}>{l}</span>
                  </div>
                  {i<3&&<div style={{ fontSize:20, color:T.text3, fontWeight:300 }}>→</div>}
                </React.Fragment>
              ))}
              <div style={{ fontSize:16, color:T.text3 }}>↻</div>
            </div>

            <div style={{ marginTop:"1rem", padding:"10px 14px", background:`${T.accent}12`, border:`1px solid ${T.accent}22`, borderRadius:8, fontSize:12, color:T.text2 }}>
              💡 <b style={{ color:T.accent }}>Ciclo PDCA:</b> RNCs sem análise de causa estão em P. Após Ishikawa/5 Porquês vão para D. Após 5W2H executado vão para C. Quando eficaz, chegam em A — padronize a solução.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function RelatoriosTab({ rncs, users, user, toast_ }) {
  const T = useTheme(); const s = useS();
  const [periodo, setPeriodo] = useState("mensal");
  const [respFiltro, setRespFiltro] = useState("");
  const [dataInicio, setDataInicio] = useState(() => { const d=new Date(); d.setDate(1); return d.toISOString().split("T")[0]; });
  const [dataFim, setDataFim] = useState(() => new Date().toISOString().split("T")[0]);
  const [enviando, setEnviando] = useState(false);
  const [emailDest, setEmailDest] = useState(user.email);
  const [aiResumo, setAiResumo] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [activeSection, setActiveSection] = useState("resumo");

  const aplicarPeriodo = (p) => {
    setPeriodo(p);
    const hoje = new Date(); let inicio = new Date();
    if (p==="semanal") inicio.setDate(hoje.getDate()-7);
    else if (p==="quinzenal") inicio.setDate(hoje.getDate()-15);
    else if (p==="mensal") inicio.setDate(1);
    else if (p==="trimestral") { inicio.setMonth(hoje.getMonth()-3); inicio.setDate(1); }
    setDataInicio(inicio.toISOString().split("T")[0]);
    setDataFim(hoje.toISOString().split("T")[0]);
  };

  const filtered = rncs.filter(r => r.data >= dataInicio && r.data <= dataFim && (!respFiltro || r.resp === respFiltro));
  const resps = [...new Set(rncs.map(r=>r.resp).filter(Boolean))].sort();

  const total = filtered.length;
  const abertas = filtered.filter(x=>x.status==="Aberta").length;
  const emAndamento = filtered.filter(x=>x.status==="Em andamento").length;
  const eficaz = filtered.filter(x=>x.status==="Eficaz").length;
  const ineficaz = filtered.filter(x=>x.status==="Ineficaz").length;
  const pendente = filtered.filter(x=>x.status==="Pendente verificação").length;
  const critica = filtered.filter(x=>x.sev==="Crítica").length;
  const maior = filtered.filter(x=>x.sev==="Maior").length;
  const menor = filtered.filter(x=>x.sev==="Menor").length;
  const vencidas = filtered.filter(x=>x.prazoAC&&x.prazoAC<tod()&&x.status!=="Eficaz"&&x.status!=="Ineficaz").length;
  const taxaEficacia = total>0?Math.round(eficaz/total*100):0;
  const taxaAberto = total>0?Math.round((abertas+emAndamento)/total*100):0;

  // Por responsável
  const porResp = {};
  filtered.forEach(r=>{ const k=r.resp||"Não atribuído"; if(!porResp[k])porResp[k]=[]; porResp[k].push(r); });

  // Por tipo
  const porTipo = {};
  filtered.forEach(r=>{ porTipo[r.tipo]=(porTipo[r.tipo]||0)+1; });

  // Por fornecedor
  const porForn = {};
  filtered.forEach(r=>{ if(r.fornecedor){porForn[r.fornecedor]=(porForn[r.fornecedor]||0)+1;} });

  // Tempo médio resolução (dias)
  const resolvidas = filtered.filter(x=>x.status==="Eficaz"&&x.data&&x.eficacia?.data);
  const tempoMedio = resolvidas.length>0 ? Math.round(resolvidas.reduce((acc,r)=>{
    const d1=new Date(r.data); const d2=new Date(r.eficacia.data);
    return acc+(d2-d1)/(1000*60*60*24);
  },0)/resolvidas.length) : null;

  const gerarResumoIA = async () => {
    setLoadingAI(true); setAiResumo("");
    try {
      const txt = await askClaude(`Você é especialista em gestão da qualidade. Gere um resumo executivo conciso e profissional em português.

PERÍODO: ${fmt(dataInicio)} a ${fmt(dataFim)}
FILTRO: ${respFiltro||"Todos os responsáveis"}
TOTAL: ${total} | ABERTAS: ${abertas} | EFICAZES: ${eficaz} | CRÍTICAS: ${critica} | VENCIDAS: ${vencidas}
TAXA DE EFICÁCIA: ${taxaEficacia}%
TEMPO MÉDIO RESOLUÇÃO: ${tempoMedio?`${tempoMedio} dias`:"N/D"}
TIPOS MAIS FREQUENTES: ${Object.entries(porTipo).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>`${k}(${v})`).join(", ")}
FORNECEDORES COM MAIS NCs: ${Object.entries(porForn).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>`${k}(${v})`).join(", ")||"N/D"}

Gere 2 parágrafos: 1) análise dos números, 2) recomendações práticas. Seja direto e objetivo.`);
      setAiResumo(txt);
    } catch { setAiResumo("Erro ao gerar análise."); }
    setLoadingAI(false);
  };

  const enviarEmail = async () => {
    if(!emailDest){alert("Informe o e-mail.");return;}
    setEnviando(true);
    const corpo = `SGQ HERBAMED® — RELATÓRIO DE NÃO CONFORMIDADES
${"═".repeat(50)}
Período: ${fmt(dataInicio)} a ${fmt(dataFim)}
Filtro: ${respFiltro||"Todos os responsáveis"}
Gerado em: ${new Date().toLocaleString("pt-BR")} por ${user.name}

${"─".repeat(50)}
INDICADORES GERAIS
${"─".repeat(50)}
Total de RNCs:        ${total}
Abertas:              ${abertas}
Em andamento:         ${emAndamento}
Eficazes:             ${eficaz} (${taxaEficacia}%)
Ineficazes:           ${ineficaz}
Críticas:             ${critica}
Prazos vencidos:      ${vencidas}
Tempo médio resolução:${tempoMedio?`${tempoMedio} dias`:"N/D"}

${"─".repeat(50)}
POR RESPONSÁVEL
${"─".repeat(50)}
${Object.entries(porResp).sort((a,b)=>b[1].length-a[1].length).map(([r,list])=>{
  const ab=list.filter(x=>x.status==="Aberta").length;
  const ef=list.filter(x=>x.status==="Eficaz").length;
  const vc=list.filter(x=>x.prazoAC&&x.prazoAC<tod()&&x.status!=="Eficaz").length;
  return `${r}\n  Total: ${list.length} | Abertas: ${ab} | Eficazes: ${ef}${vc>0?` | ⚠ ${vc} vencida(s)`:""}`;
}).join("\n\n")}

${"─".repeat(50)}
TIPOS MAIS FREQUENTES
${"─".repeat(50)}
${Object.entries(porTipo).sort((a,b)=>b[1]-a[1]).map(([t,n])=>`${t}: ${n}`).join("\n")}

${aiResumo?`${"─".repeat(50)}\nANÁLISE EXECUTIVA — IA\n${"─".repeat(50)}\n${aiResumo}\n`:""}
${"─".repeat(50)}
DETALHAMENTO DAS RNCs
${"─".repeat(50)}
${filtered.map(r=>`${r.num} | ${r.status} | ${r.sev} | ${r.resp||"—"}
  Produto: ${r.produto||"—"} | Fornecedor: ${r.fornecedor||"—"}
  ${r.desc?.substring(0,100)}...`).join("\n\n")}

${"═".repeat(50)}
Herbamed® · Sistema de Gestão da Qualidade`;

    try {
      const res = await fetch("https://api.emailjs.com/api/v1.0/email/send",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ service_id:"service_gxhicii", template_id:"template_4jl73wq", user_id:"z2VxJ1dYjwrRp8Nh4",
          template_params:{ to_email:emailDest, to_name:emailDest, from_name:`${user.name} · Herbamed® SGQ`,
            subject:`📊 Relatório SGQ — ${fmt(dataInicio)} a ${fmt(dataFim)}${respFiltro?` · ${respFiltro}`:""}`,
            message:corpo, reply_to:user.email }})
      });
      if(res.ok) toast_("Relatório enviado!","green"); else toast_("Erro ao enviar.","red");
    } catch { toast_("Erro ao enviar.","red"); }
    setEnviando(false);
  };

  const SECTIONS = [
    { id:"resumo", icon:"📊", label:"Resumo" },
    { id:"responsavel", icon:"👤", label:"Por Responsável" },
    { id:"tipos", icon:"📦", label:"Por Tipo" },
    { id:"fornecedores", icon:"🏭", label:"Fornecedores" },
    { id:"detalhe", icon:"📋", label:"Detalhamento" },
  ];

  return (
    <div>
      {/* HEADER DO RELATÓRIO */}
      <div style={{ background:`linear-gradient(135deg,${T.card},${T.card2})`, border:`1px solid ${T.border}`, borderRadius:14, padding:"1.25rem", marginBottom:"1rem" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12 }}>
          <div>
            <div style={{ fontSize:18, fontWeight:700, color:T.text, marginBottom:4 }}>Relatório de Não Conformidades</div>
            <div style={{ fontSize:12, color:T.text2 }}>Herbamed® · Sistema de Gestão da Qualidade</div>
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <button onClick={()=>window.print()} style={{ ...s.btn, display:"flex", alignItems:"center", gap:6, fontSize:11 }}>🖨️ Imprimir / PDF</button>
            <button onClick={enviarEmail} disabled={enviando} style={{ ...s.btnA, display:"flex", alignItems:"center", gap:6, fontSize:11, opacity:enviando?.6:1 }}>
              {enviando?"Enviando...":"✉️ Enviar por e-mail"}
            </button>
          </div>
        </div>

        {/* Filtros inline */}
        <div style={{ display:"flex", gap:8, marginTop:"1rem", flexWrap:"wrap", alignItems:"center" }}>
          <div style={{ display:"flex", gap:4 }}>
            {["semanal","quinzenal","mensal","trimestral"].map(p=>(
              <button key={p} onClick={()=>aplicarPeriodo(p)} style={{ padding:"5px 12px", borderRadius:20, border:`1px solid ${periodo===p?T.accent+"55":T.border}`, background:periodo===p?T.accentDim:T.surf, color:periodo===p?T.accent:T.text2, cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:periodo===p?600:400, textTransform:"capitalize" }}>{p}</button>
            ))}
          </div>
          <Inp type="date" value={dataInicio} onChange={e=>{setDataInicio(e.target.value);setPeriodo("personalizado");}} sx={{ width:140, fontSize:12 }}/>
          <span style={{ color:T.text3, fontSize:12 }}>até</span>
          <Inp type="date" value={dataFim} onChange={e=>{setDataFim(e.target.value);setPeriodo("personalizado");}} sx={{ width:140, fontSize:12 }}/>
          <Sel value={respFiltro} onChange={e=>setRespFiltro(e.target.value)} sx={{ width:"auto", minWidth:180, fontSize:12 }}>
            <option value="">Todos os responsáveis</option>
            {resps.map(r=><option key={r}>{r}</option>)}
          </Sel>
          <Inp placeholder="E-mail para envio" value={emailDest} onChange={e=>setEmailDest(e.target.value)} sx={{ width:220, fontSize:12 }}/>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="kpi-grid" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:"1rem" }}>
        {[
          { l:"Total no período", n:total, c:T.accent, sub:"RNCs registradas", icon:"📋" },
          { l:"Taxa de eficácia", n:`${taxaEficacia}%`, c:taxaEficacia>=70?T.accent:"#ff8c42", sub:`${eficaz} de ${total} resolvidas`, icon:"✅" },
          { l:"Pendentes", n:abertas+emAndamento, c:"#ffd166", sub:`${taxaAberto}% ainda abertas`, icon:"⏳" },
          { l:"Prazo vencido", n:vencidas, c:vencidas>0?"#ff4f6a":T.text3, sub:vencidas>0?"Ação urgente necessária":"Todos em dia", icon:vencidas>0?"⚠️":"✓" },
        ].map(({l,n,c,sub,icon})=>(
          <div key={l} style={{ background:T.card, border:`1px solid ${c}22`, borderRadius:14, padding:"1.1rem", position:"relative", overflow:"hidden", boxShadow:`0 0 20px ${c}10` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <div style={{ fontSize:28, fontWeight:800, color:c, lineHeight:1, marginBottom:4 }}>{n}</div>
                <div style={{ fontSize:11, fontWeight:700, color:T.text, marginBottom:2 }}>{l}</div>
                <div style={{ fontSize:10, color:T.text3 }}>{sub}</div>
              </div>
              <span style={{ fontSize:24, opacity:.4 }}>{icon}</span>
            </div>
            <div style={{ position:"absolute", bottom:-12, right:-12, width:60, height:60, borderRadius:"50%", background:c, opacity:.06 }}/>
          </div>
        ))}
      </div>

      {/* BARRA EXTRA — tempo médio + severidade */}
      <div className="kpi-grid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12, marginBottom:"1rem" }}>
        {[
          { l:"Críticas", n:critica, c:"#ff4f6a" },
          { l:"Maiores", n:maior, c:"#ff8c42" },
          { l:"Menores", n:menor, c:"#a78bfa" },
          { l:"Tempo médio resolução", n:tempoMedio?`${tempoMedio}d`:"N/D", c:T.blue },
        ].map(({l,n,c})=>(
          <div key={l} style={{ background:T.surf, border:`1px solid ${T.border}`, borderRadius:10, padding:"10px 14px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ fontSize:12, color:T.text2, fontWeight:500 }}>{l}</div>
            <div style={{ fontSize:18, fontWeight:700, color:c }}>{n}</div>
          </div>
        ))}
      </div>

      {/* ANÁLISE IA */}
      <div style={{ background:`linear-gradient(135deg,${T.accentDim},${T.card2})`, border:`1px solid ${T.accent}33`, borderRadius:14, padding:"1.1rem", marginBottom:"1rem" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:`linear-gradient(135deg,${T.accent},${T.accent2})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🤖</div>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:T.text }}>Análise Executiva — Claude IA</div>
              <div style={{ fontSize:11, color:T.text2 }}>Resumo inteligente baseado nos dados do período</div>
            </div>
          </div>
          <button style={{ ...s.btnA, fontSize:11, display:"flex", alignItems:"center", gap:6, opacity:loadingAI?.6:1 }} onClick={gerarResumoIA} disabled={loadingAI}>
            {loadingAI?<><span style={{ animation:"spin 1s linear infinite", display:"inline-block" }}>⟳</span> Analisando...</>:"✨ Gerar análise"}
          </button>
        </div>
        {aiResumo&&<div style={{ marginTop:"1rem", background:T.surf, borderRadius:10, padding:"1rem", fontSize:13, color:T.text, lineHeight:1.75, borderLeft:`3px solid ${T.accent}` }}>{aiResumo}</div>}
      </div>

      {/* NAVEGAÇÃO DE SEÇÕES */}
      <div style={{ display:"flex", gap:4, marginBottom:"1rem", background:T.surf, border:`1px solid ${T.border}`, borderRadius:10, padding:4 }}>
        {SECTIONS.map(sec=>(
          <button key={sec.id} onClick={()=>setActiveSection(sec.id)} style={{ flex:1, padding:"7px 10px", border:"none", background:activeSection===sec.id?T.accentDim:"transparent", color:activeSection===sec.id?T.accent:T.text2, cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:activeSection===sec.id?600:400, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", gap:5, border:activeSection===sec.id?`1px solid ${T.accent}33`:"1px solid transparent" }}>
            {sec.icon} {sec.label}
          </button>
        ))}
      </div>

      {/* SEÇÃO: RESUMO VISUAL */}
      {activeSection==="resumo"&&(
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          {/* Status */}
          <div style={{ ...s.card }}>
            <SecTitle icon="🎯" ch="Distribuição por status" />
            {Object.entries(SMETA).map(([st,m])=>{
              const n=filtered.filter(x=>x.status===st).length;
              if(!n) return null;
              const pct=Math.round(n/total*100);
              return <div key={st} style={{ marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}><span style={{ width:8, height:8, borderRadius:"50%", background:m.dot, display:"inline-block" }}/><span style={{ fontSize:12, color:T.text2 }}>{st}</span></div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}><span style={{ fontSize:11, color:T.text3 }}>{pct}%</span><span style={{ fontSize:13, fontWeight:700, color:m.c }}>{n}</span></div>
                </div>
                <div style={{ height:6, background:T.surf, borderRadius:3, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${pct}%`, background:m.dot, borderRadius:3, transition:"width .6s ease" }}/>
                </div>
              </div>;
            })}
          </div>
          {/* Severidade */}
          <div style={{ ...s.card }}>
            <SecTitle icon="⚡" ch="Distribuição por severidade" />
            {[["Crítica","#ff4f6a",critica],["Maior","#ff8c42",maior],["Menor","#a78bfa",menor]].map(([l,c,n])=>{
              const pct=total>0?Math.round(n/total*100):0;
              return <div key={l} style={{ marginBottom:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                  <span style={{ fontSize:12, color:T.text2, fontWeight:500 }}>{l}</span>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}><span style={{ fontSize:11, color:T.text3 }}>{pct}%</span><span style={{ fontSize:13, fontWeight:700, color:c }}>{n}</span></div>
                </div>
                <div style={{ height:8, background:T.surf, borderRadius:4, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${pct}%`, background:c, borderRadius:4, transition:"width .6s ease", boxShadow:`0 0 8px ${c}50` }}/>
                </div>
              </div>;
            })}
            <div style={{ marginTop:"1rem", padding:"10px 14px", background:T.surf, borderRadius:10, display:"flex", justifyContent:"space-between" }}>
              <span style={{ fontSize:12, color:T.text2 }}>Eficácia geral do período</span>
              <span style={{ fontSize:16, fontWeight:700, color:taxaEficacia>=70?T.accent:"#ff8c42" }}>{taxaEficacia}%</span>
            </div>
          </div>
        </div>
      )}

      {/* SEÇÃO: POR RESPONSÁVEL */}
      {activeSection==="responsavel"&&(
        <div style={s.card}>
          <SecTitle icon="👤" ch={`Desempenho por responsável — ${Object.keys(porResp).length} pessoa(s)`} />
          {Object.keys(porResp).length===0?<div style={{ color:T.text3, fontSize:13, textAlign:"center", padding:"2rem" }}>Nenhuma RNC no período.</div>:
          Object.entries(porResp).sort((a,b)=>b[1].length-a[1].length).map(([resp,list])=>{
            const ab=list.filter(x=>x.status==="Aberta").length;
            const ef=list.filter(x=>x.status==="Eficaz").length;
            const vc=list.filter(x=>x.prazoAC&&x.prazoAC<tod()&&x.status!=="Eficaz").length;
            const taxa=list.length>0?Math.round(ef/list.length*100):0;
            const max=Math.max(...Object.values(porResp).map(l=>l.length),1);
            return <div key={resp} style={{ background:T.surf, border:`1px solid ${T.border}`, borderRadius:12, padding:"1rem", marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:40, height:40, borderRadius:"50%", background:`linear-gradient(135deg,${T.accent},${T.accent2})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:700, color:"#fff" }}>{resp[0]}</div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:T.text }}>{resp}</div>
                    <div style={{ fontSize:11, color:T.text2, marginTop:2 }}>
                      {list.length} RNC(s) · {ab} aberta(s) · {ef} eficaz(es) · Taxa: <span style={{ color:taxa>=70?T.accent:"#ff8c42", fontWeight:600 }}>{taxa}%</span>
                      {vc>0&&<span style={{ color:"#ff4f6a", fontWeight:600 }}> · ⚠ {vc} vencida(s)</span>}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize:28, fontWeight:800, color:T.accent }}>{list.length}</div>
              </div>
              {/* Mini status pills */}
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:8 }}>
                {Object.entries(SMETA).map(([st,m])=>{
                  const n=list.filter(x=>x.status===st).length;
                  if(!n) return null;
                  return <span key={st} style={{ padding:"2px 8px", borderRadius:20, fontSize:10, fontWeight:600, background:m.bg, color:m.c }}>{st}: {n}</span>;
                })}
              </div>
              <div style={{ height:5, background:T.card, borderRadius:3, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${Math.round(list.length/max*100)}%`, background:`linear-gradient(to right,${T.accent},${T.accent2})`, borderRadius:3 }}/>
              </div>
            </div>;
          })}
        </div>
      )}

      {/* SEÇÃO: POR TIPO */}
      {activeSection==="tipos"&&(
        <div style={s.card}>
          <SecTitle icon="📦" ch="Distribuição por tipo de não conformidade" />
          {Object.keys(porTipo).length===0?<div style={{ color:T.text3, fontSize:13, textAlign:"center", padding:"2rem" }}>Nenhuma RNC no período.</div>:
          Object.entries(porTipo).sort((a,b)=>b[1]-a[1]).map(([tipo,n],idx)=>{
            const max=Math.max(...Object.values(porTipo),1);
            const pct=Math.round(n/total*100);
            const color=TIPOC[tipo]||T.accent;
            return <div key={tipo} style={{ display:"flex", alignItems:"center", gap:14, marginBottom:12 }}>
              <div style={{ minWidth:24, width:24, height:24, borderRadius:"50%", background:`${color}22`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color, flexShrink:0 }}>{idx+1}</div>
              <div style={{ minWidth:180, fontSize:13, color:T.text, fontWeight:500 }}>{tipo}</div>
              <div style={{ flex:1, height:10, background:T.surf, borderRadius:5, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${Math.round(n/max*100)}%`, background:color, borderRadius:5, transition:"width .6s ease", boxShadow:`0 0 8px ${color}40` }}/>
              </div>
              <div style={{ minWidth:40, display:"flex", flexDirection:"column", alignItems:"flex-end" }}>
                <span style={{ fontSize:14, fontWeight:700, color }}>{n}</span>
                <span style={{ fontSize:10, color:T.text3 }}>{pct}%</span>
              </div>
            </div>;
          })}
        </div>
      )}

      {/* SEÇÃO: FORNECEDORES */}
      {activeSection==="fornecedores"&&(
        <div style={s.card}>
          <SecTitle icon="🏭" ch="Não conformidades por fornecedor" />
          {Object.keys(porForn).length===0?
            <div style={{ color:T.text3, fontSize:13, textAlign:"center", padding:"2rem" }}>Nenhuma RNC com fornecedor identificado no período.</div>:
          Object.entries(porForn).sort((a,b)=>b[1]-a[1]).map(([forn,n],idx)=>{
            const max=Math.max(...Object.values(porForn),1);
            const pct=Math.round(n/total*100);
            const isTop=idx===0;
            return <div key={forn} style={{ background:isTop?"#ff4f6a0a":T.surf, border:`1px solid ${isTop?"#ff4f6a22":T.border}`, borderRadius:10, padding:"10px 14px", marginBottom:8, display:"flex", alignItems:"center", gap:14 }}>
              <div style={{ minWidth:28, width:28, height:28, borderRadius:"50%", background:isTop?"#ff4f6a22":T.border, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:isTop?"#ff4f6a":T.text2, flexShrink:0 }}>{idx+1}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:T.text, marginBottom:4 }}>{forn}{isTop&&<span style={{ marginLeft:8, fontSize:10, color:"#ff4f6a", fontWeight:700 }}>⚠ MAIOR INCIDÊNCIA</span>}</div>
                <div style={{ height:6, background:T.card, borderRadius:3, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${Math.round(n/max*100)}%`, background:isTop?"#ff4f6a":T.accent, borderRadius:3 }}/>
                </div>
              </div>
              <div style={{ textAlign:"right", flexShrink:0 }}>
                <div style={{ fontSize:18, fontWeight:700, color:isTop?"#ff4f6a":T.accent }}>{n}</div>
                <div style={{ fontSize:10, color:T.text3 }}>{pct}% do total</div>
              </div>
            </div>;
          })}
        </div>
      )}

      {/* SEÇÃO: DETALHAMENTO */}
      {activeSection==="detalhe"&&(
        <div style={s.card}>
          <SecTitle icon="📋" ch={`Detalhamento completo — ${filtered.length} RNC(s)`} />
          {filtered.length===0?<div style={{ color:T.text3, fontSize:13, textAlign:"center", padding:"2rem" }}>Nenhuma RNC no período.</div>:
          filtered.map(r=>(
            <div key={r.id} style={{ background:T.surf, border:`1px solid ${T.border}`, borderLeft:`3px solid ${SMETA[r.status]?.dot||T.accent}`, borderRadius:10, padding:"12px 16px", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <span style={{ fontSize:11, fontWeight:700, color:T.accent }}>{r.num}</span>
                  <SevB s={r.sev}/>
                  <Badge s={r.status}/>
                  {past(r.prazoAC)&&r.status!=="Eficaz"&&<span style={{ fontSize:10, color:"#ff4f6a", fontWeight:700, background:"#ff4f6a18", padding:"2px 8px", borderRadius:20 }}>⚠ VENCIDO</span>}
                  {r.respostaFornecedor&&<span style={{ fontSize:10, color:"#1a7a3c", fontWeight:700, background:"#1a7a3c18", padding:"2px 8px", borderRadius:20 }}>✓ RESPOSTA FORNECEDOR</span>}
                </div>
                <span style={{ fontSize:11, color:T.text3 }}>{fmt(r.data)}</span>
              </div>
              <div style={{ fontSize:13, color:T.text, marginBottom:6, lineHeight:1.5 }}>{r.desc?.substring(0,120)}{r.desc?.length>120?"...":""}</div>
              <div style={{ display:"flex", gap:16, fontSize:11, color:T.text2 }}>
                {r.produto&&<span>📦 {r.produto}</span>}
                {r.fornecedor&&<span>🏭 {r.fornecedor}</span>}
                {r.resp&&<span>👤 {r.resp}</span>}
                {r.prazoAC&&<span>📅 Prazo: {fmt(r.prazoAC)}</span>}
                {r.ishikawa?.root&&<span style={{ color:T.accent }}>🎯 C.R.: {r.ishikawa.root.substring(0,40)}...</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { createElectronicSignature, subscribeCollection } from "../../firebase";
import { SEVMETA, SMETA, TIPOC, rncAtiva, rncEncerrada, taxaEficaciaRNC, tipoCor } from "../../core/status";
import { FiltroPeriodo, SituacaoAtual, usePeriodo } from "../../shared/FiltroPeriodo";
import { filtrarPorPeriodo, resolverPeriodo } from "../../shared/periodoLogic";
import { useFormal, useTheme } from "../../core/theme";
import { fmt, past, sigCodigo, tod } from "../../core/utils";
import { exportRNCPDF } from "../pdf/pdfExports";
import { exportFormularioFornecedor } from "./formularioFornecedor";
import { enviarEmail } from "../email/enviarEmail";
import { askClaude } from "../../services/aiClient";
import { isExternalStorageUrl } from "../../services/localFileStorage";
import { useS } from "../../shared/styles";
// AnexosUpload nasceu aqui e virou compartilhado (Desvios e lista de presença dos
// treinamentos usam o mesmo). Reexportado para não quebrar quem importa de RncTabs.
import { AnexosUpload, uploadAttachment } from "../../shared/AnexosUpload";
import { Badge, Divider, F, G2, G3, Inp, SecTitle, Sel, SevB, StatusBadge, TA } from "../../shared/ui";
import { CampoHistoricoEdicao, CampoHistoricoLeitura } from "../../shared/CampoHistorico";
import { acrescentarAoCampo, campoVazio, resumoAcrescimo } from "../../shared/campoHistoricoLogic";
import { Table } from "../../shared/Table";
import { AIPanel } from "../ai/AIPanel";
import { AssinaturaModal } from "../pdf/pdfExports";
import { rncEditavelNasFerramentas, errosDasAcoesCapa, patchSalvarCapa, podeRegistrarEficacia, partirDaRespostaFornecedor, rncTemMaterial } from "./ferramentasLogic";

// Regra única do fluxo: a RNC sai de "Aberta" -> "Em andamento" automaticamente no
// primeiro ato de tratamento (encaminhar ao fornecedor, registrar contenção ou iniciar
// a análise de causa). Como o responsável é obrigatório já na abertura, ele não serve de
// gatilho — "Aberta" significa "registrada, tratamento ainda não começou".
// Devolve o patch a mesclar no doUpdateRNC (status + entrada de histórico); null se a RNC
// já saiu de "Aberta".
export function andamentoPatch(r, motivo, autor) {
  if (!r || r.status !== "Aberta") return null;
  return {
    status: "Em andamento",
    hEntry: { data: tod(), hora: new Date().toLocaleTimeString("pt-BR"), acao: `Status alterado -> Em andamento (${motivo})`, resp: autor || "—", tipo: "status" },
  };
}

// Matriz GUT — fonte única da priorização de RNCs. A Matriz GUT do DashTab e a pauta
// da Reunião de Análise Crítica precisam concordar sobre o que é prioritário, então a
// fórmula mora aqui e não dentro de cada tela.
export function calcGut(r) {
  const g = r.sev === "Crítica" ? 5 : r.sev === "Maior" ? 3 : 1;
  const u = past(r.prazoAC) ? 5 : r.prazoAC ? 3 : 2;
  const t = r.sev === "Crítica" ? 5 : r.sev === "Maior" ? 3 : 2;
  return { ...r, G: g, U: u, T: t, gut: g * u * t };
}

export const gutRank = (rncs) =>
  rncs.filter(x => x.status === "Aberta" || x.status === "Em andamento").map(calcGut).sort((a, b) => b.gut - a.gut);

// Disposição do material/lote (padrão farma / SE Suite). `libera` marca as decisões que
// liberam material NÃO CONFORME para uso — por isso exigem assinatura do RT (segregação:
// quem libera NC ≠ quem detectou). As demais gravam só justificativa + autor.
export const DISPOSICOES = [
  { key: "liberar",    label: "Liberar (uso normal)",    libera: true,  cor: "#2ab84a" },
  { key: "concessao",  label: "Liberar sob concessão",   libera: true,  cor: "#ffd166" },
  { key: "segregar",   label: "Segregar / Quarentena",   libera: false, cor: "#4fc3f7" },
  { key: "retrabalho", label: "Retrabalho / Reprocesso", libera: false, cor: "#a78bfa" },
  { key: "reprovar",   label: "Reprovar / Descartar",    libera: false, cor: "#ff4f6a" },
  { key: "devolver",   label: "Devolver ao fornecedor",  libera: false, cor: "#ff8c42" },
];
export const dispMeta = (key) => DISPOSICOES.find(d => d.key === key) || null;

// rncTemMaterial mora em ferramentasLogic (regra pura, testável); reexportada aqui
// porque ReunioesTab e outros já importam daqui.
export { rncTemMaterial };

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
  const vencidas  = rncs.filter(x => x.prazoAC && x.prazoAC < tod() && rncAtiva(x.status)).length;
  const criticas  = rncs.filter(x => x.sev === "Crítica" && rncAtiva(x.status)).length;
  const taxaEf    = taxaEficaciaRNC(rncs).taxa;
  const minhas    = rncs.filter(x => x.resp === user.name && rncAtiva(x.status));
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
            { l:"Taxa Eficácia", n:taxaEf===null?"—":`${taxaEf}%`,  c:taxaEf===null?T.text3:taxaEf>=70?T.accent:"#ff8c42", icon:"✅", action:()=>setTab("dashboard") },
            { l:"Prazos Vencidos",n:vencidas,     c:vencidas>0?"#ffd166":T.text3, icon:"⏰", action:()=>setTab("lista") },
          ].map(({ l, n, c, icon, action }) => (
            <div key={l} onClick={action} className="action-card" style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:12, padding:"12px 14px", cursor:"pointer", transition:"all .2s", boxShadow: T.light ? "0 1px 2px rgba(23,35,27,.06)" : "0 2px 12px rgba(0,0,0,.2)" }}>
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
              { l:"Taxa de eficácia",ok:taxaEf===null||taxaEf>=70, val:taxaEf===null?"— sem RNC encerrada":`${taxaEf}%${taxaEf>=70?" ✓":""}`},
              { l:"Sem responsável", ok:rncs.filter(x=>!x.resp&&rncAtiva(x.status)).length===0, val:rncs.filter(x=>!x.resp&&rncAtiva(x.status)).length===0?"✓ Todas atribuídas":`${rncs.filter(x=>!x.resp&&rncAtiva(x.status)).length} sem responsável` },
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

export function ListaTab({ rncs, isViewer, abrirRnc }) {
  const T = useTheme(); const s = useS();
  const [q, setQ] = useState("");
  const [fSt, setFSt] = useState("");
  const [fTp, setFTp] = useState("");
  const list = rncs.filter(r =>
    (!q || [r.desc, r.produto, r.num, r.fornecedor].some(x => x?.toLowerCase().includes(q.toLowerCase()))) &&
    (!fSt || r.status === fSt) && (!fTp || r.tipo === fTp)
  );

  // Steps de progresso da RNC
  const getRNCStep = (r) => {
    if (r.status === "Eficaz" || r.status === "Ineficaz") return 4;
    if (r.eficacia?.resultado) return 4;
    if (r.w2h?.length > 0) return 3;
    if (r.ishikawa?.root) return 2;
    return 1;
  };

  const STEPS = ["Abertura", "Análise", "CAPA", "Eficácia"];

  const colunasRNC = [
    { key: "num", label: "Nº", render: r => <span style={{ color: T.accent, fontWeight: 700, fontSize: 11 }}>{r.num}</span> },
    { key: "status", label: "Status / Progresso", sortable: false, render: r => (
      <div style={{ minWidth: 180 }}>
        <Badge s={r.status} />
        <div style={{ display: "flex", gap: 2, marginTop: 5 }}>
          {STEPS.map((st, i) => (
            <div key={st} title={st} style={{ flex: 1, height: 3, borderRadius: 2, background: i < getRNCStep(r) ? T.accent : T.border, transition: "background .3s" }} />
          ))}
        </div>
      </div>
    ) },
    { key: "desc", label: "Descrição", maxWidth: 240, nowrap: true, render: r => r.desc },
    { key: "tipo", label: "Tipo", render: r => (
      <><span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: tipoCor(r.tipo, T), marginRight: 4 }} />{r.tipo}</>
    ) },
    { key: "sev", label: "Sev.", render: r => <SevB s={r.sev} /> },
    { key: "resp", label: "Responsável", render: r => r.resp || "—" },
    { key: "data", label: "Data", render: r => fmt(r.data) },
    { key: "prazoAC", label: "Prazo AC", render: r => {
      const vencido = past(r.prazoAC) && rncAtiva(r.status);
      return <span style={{ color: vencido ? T.red : T.text2, fontWeight: vencido ? 600 : 400 }}>{vencido ? "⚠ " : ""}{r.prazoAC ? fmt(r.prazoAC) : "—"}</span>;
    } },
  ];

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
      {list.length > 0 && (
        <div style={{ fontSize:11, color:T.text3, marginBottom:6 }}>{list.length} registro(s) encontrado(s) · clique em uma linha para ver detalhes</div>
      )}
      <Table
        columns={colunasRNC}
        rows={list}
        rowKey={r => r.id}
        onRowClick={r => abrirRnc(r.id)}
        rowAccent={r => SMETA[r.status]?.dot || T.accent}
        sortColDefault="data"
        sortDirDefault="desc"
        perPage={20}
        emptyIcon="📋"
        emptyTitle="Nenhuma RNC encontrada"
        emptySubtitle={isViewer ? "Nenhuma não conformidade registrada." : "Clique em \"+ Nova RNC\" para começar."}
      />

    </div>
  );
}

export { AnexosUpload, uploadAttachment };

export function openCOA(coa) {
  if (!coa?.url) return;
  if (isExternalStorageUrl(coa.url)) {
    alert("Este arquivo ainda aponta para armazenamento externo antigo. Remova e anexe novamente para salvar no PostgreSQL local do SGQ.");
    return;
  }
  const url = coa.url;
  window.open(url, "_blank", "noopener,noreferrer");
}

export function NovaTab({ user, toast_, setTab, openEmail, doSaveRNC, doSaveDesvio, fornecedores = [], rncPrefill = null, setRncPrefill }) {
  const s = useS(); const T = useTheme();
  const [f, setF] = useState({ data: tod(), status: "Aberta", tipo: "Matéria-prima", sev: "Maior", produto: "", fornecedor: "", setor: "", detector: "", desc: "", lote: "", nf: "", qtd: "", ref: "", evidencia: "", contencao: "", respCont: "", dataContencao: "", resp: "", prazoCausa: "", prazoAC: "", prazoEfic: "", origemAnalise: "" });
  const modoPrazo = f.modoPrazo || "definicao";
  const [origemDesvio, setOrigemDesvio] = useState(null);
  const [anexos, setAnexos] = useState([]);
  const [ishikawa, setIshikawa] = useState({ efeito: "", causes: { mao: [], maquina: [], metodo: [], material: [], medicao: [], meioamb: [] }, whys: [], root: "", whyCausa: "" });
  const [w2h, setW2h] = useState([]);
  const [fornSearch, setFornSearch] = useState("");
  const [fornOpen, setFornOpen] = useState(false);
  const [novaAba, setNovaAba] = useState("ident");
  const [assinaturaModal, setAssinaturaModal] = useState(false);
  const [draftId] = useState(() => globalThis.crypto?.randomUUID?.() || `rnc-${Date.now()}-${Math.random().toString(36).slice(2)}`);


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

  // A RNC nasce assinada pelo elaborador (quem a registra). salvar() só valida e abre o
  // modal de assinatura; o contador só é consumido quando a assinatura é confirmada
  // (em finalizarSalvar), evitando "queimar" número se o elaborador desistir de assinar.
  const salvar = () => {
    if (!f.desc.trim())        { alert("Preencha a descrição da não conformidade."); return; }
    if (modoPrazo === "definicao") {
      if (!f.justificativaPrazo?.trim()) { alert("Informe a justificativa para o prazo em definicao."); return; }
      if (!f.proximaReavaliacao) { alert("Defina a proxima data de reavaliacao."); return; }
      f.prazoAC = "2099-12-31";
    }
    if (!f.sev)                 { alert("Selecione a severidade (Crítica / Maior / Menor)."); return; }
    if (!f.resp.trim())         { alert("Informe o responsável pela ação corretiva."); return; }
    if (!f.prazoAC)             { alert("Defina o prazo para ação corretiva."); return; }
    setAssinaturaModal(true);
  };

  const finalizarSalvar = async (assinaturaElaborador) => {
    try {
      const draft = { id: draftId, ...f, origemAnalise: f.origemAnalise || null, origemDesvio: origemDesvio?.id || null, origemDesvioNum: origemDesvio?.num || null, anexos, ishikawa, w2h, eficacia: { criterio: "", data: "", resp: "", evidencias: "", resultado: "", obs: "" }, historico: [{ data: tod(), acao: "RNC aberta", resp: user.name }, { data: tod(), hora: new Date().toLocaleTimeString("pt-BR"), acao: "Assinatura do elaborador registrada", resp: user.name, tipo: "assinatura" }], criadoPor: user.name, createdAt: Date.now(), assinaturaElaborador, assinaturaRT: null };
      if (modoPrazo === "definicao") {
        draft.prazoAC = "";
        draft.historico.push({ data:tod(), acao:"Prazo de acao corretiva em definicao", detalhes:[`Justificativa: ${f.justificativaPrazo}`, `Reavaliar em: ${f.proximaReavaliacao}`], resp:user.name, tipo:"prazo_em_definicao" });
      }
      const rnc = await doSaveRNC(draft);
      setAssinaturaModal(false);
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
            Nº atribuído ao salvar
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
        <G3 ch={<><F lbl="Nº do lote" tip="Número do lote afetado conforme registrado no sistema de rastreabilidade. Essencial para eventual recall ou bloqueio de lote." ch={<Inp placeholder="Ex: LOTE-2025-XXX" value={f.lote} onChange={e => set("lote", e.target.value)} />} /><F lbl="Nº da Nota Fiscal" tip="Nota Fiscal de entrada do material (quando aplicável). Amarra o lote reprovado à entrada para eventual devolução/recusa ao fornecedor." ch={<Inp placeholder="Ex: NF 12345" value={f.nf} onChange={e => set("nf", e.target.value)} />} /><F lbl="Quantidade afetada" tip="Quantidade de unidades, kg ou litros afetados. Ex: 500 cápsulas, 20kg, 2 tambores." ch={<Inp placeholder="Ex: 100 kg / 500 unidades" value={f.qtd} onChange={e => set("qtd", e.target.value)} />} /></>} />
        <F lbl="Referência normativa" tip="Norma ou procedimento que define o padrão descumprido. Ex: PO-CQ-003, RDC 658/2022, Especificação Técnica ETE-001." ch={<Inp placeholder="Ex: Farmacopeia Brasileira / Especificação interna" value={f.ref} onChange={e => set("ref", e.target.value)} />} />
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
        <div style={{marginBottom:12,padding:10,border:`1px solid ${T.border}`,borderRadius:8}}>
          <F lbl="Planejamento do prazo" ch={<select value={modoPrazo} onChange={e=>set("modoPrazo",e.target.value)} style={{...s.inp,width:"100%"}}><option value="definicao">Prazo em definicao</option><option value="definido">Prazo definido</option></select>} />
          {modoPrazo==="definicao" && <><F lbl="Justificativa" ch={<TA rows={2} value={f.justificativaPrazo||""} onChange={e=>set("justificativaPrazo",e.target.value)} />} /><F lbl="Proxima reavaliacao" ch={<Inp type="date" value={f.proximaReavaliacao||""} onChange={e=>set("proximaReavaliacao",e.target.value)} />} /></>}
        </div>
        <G3 ch={<><F lbl="Responsável pela análise" tip="Nome do responsável por conduzir a análise de causa raiz (Ishikawa + 5 Porquês) e elaborar o plano de ação corretiva." ch={<Inp value={f.resp} onChange={e => set("resp", e.target.value)} />} /><F lbl="Prazo — análise de causa" tip="Data limite para conclusão da análise de causa raiz (Ishikawa + 5 Porquês). Recomendado: até 15 dias após a abertura." ch={<Inp type="date" value={f.prazoCausa} onChange={e => set("prazoCausa", e.target.value)} />} /><F lbl="Prazo — ação corretiva" tip="Data limite para execução de todas as ações do plano 5W2H. Recomendado: até 30 dias após a análise de causa." ch={<Inp type="date" value={f.prazoAC} onChange={e => set("prazoAC", e.target.value)} />} /></>} />
        <F lbl="Prazo — verificação de eficácia" tip="Data em que será verificado se a ação corretiva foi eficaz e o problema não voltou. Recomendado: 90 dias após a ação corretiva." ch={<Inp type="date" value={f.prazoEfic} onChange={e => set("prazoEfic", e.target.value)} sx={{ maxWidth: 300 }} />} />
      </div>
      )}

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingBottom: ".5rem" }}>
        <button style={s.btn} onClick={() => setTab("lista")}>Cancelar</button>
        <button style={s.btnA} onClick={salvar}>Assinar e salvar RNC →</button>
      </div>

      {assinaturaModal && (
        <AssinaturaModal
          user={user}
          titulo="Nova RNC — assinatura do elaborador"
          contexto={`RNC|${draftId}`}
          papel="Elaborador"
          onClose={() => setAssinaturaModal(false)}
          onConfirm={finalizarSalvar}
        />
      )}
    </div>
  );
}

// IshikawaTab saiu na onda 3: a análise de causa é editada dentro da ficha da RNC
// (AnaliseCausa.jsx), e a entrada do menu virou a fila FilaAnaliseCausa.

export function CAPATab({ rncs, user, toast_, openEmail, doUpdateRNC, rncIdInicial = "" }) {
  const T = useTheme(); const s = useS();
  const [sid, setSid] = useState(rncIdInicial); const [acts, setActs] = useState([]);
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
    if (!causaRaiz) { alert("Registre a causa raiz na etapa 3 da RNC (Análise de causa) primeiro."); return; }
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

  // Valida ANTES de gravar e grava num patch só. Antes gravava primeiro (ação sem
  // responsável/prazo ficava salva mesmo com o alerta) e fazia uma segunda gravação a
  // partir do histórico antigo, apagando a entrada "CAPA — n ações" da primeira.
  const save = async () => {
    if (!rncEditavelNasFerramentas(r)) return;
    if (!whysOk) { alert("Preencha ao menos 3 dos 5 Porquês antes de salvar o plano CAPA."); return; }
    const erros = errosDasAcoesCapa(acts);
    if (erros.length) { alert("Nada foi salvo. Corrija antes:\n\n" + erros.join("\n")); return; }
    await doUpdateRNC(r.id, patchSalvarCapa(r, acts, user.name, tod()));
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
      <div style={s.card}><SecTitle ch="Selecionar RNC" /><Sel value={sid} onChange={e => setSid(e.target.value)} sx={{ fontSize: 14, padding: "10px 14px" }}><option value="">— Selecione uma RNC em tratamento —</option>{rncs.filter(rncEditavelNasFerramentas).map(r => <option key={r.id} value={r.id}>{r.num} — {r.desc?.substring(0, 55)}</option>)}</Sel></div>
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
            Para salvar o plano CAPA, complete ao menos 3 dos 5 Porquês na etapa 3 da RNC (Análise de causa).
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

export function EficaciaTab({ rncs, user, toast_, openEmail, doUpdateRNC, rncIdInicial = "" }) {
  const T = useTheme(); const s = useS();
  const [sid, setSid] = useState(rncIdInicial); const [f, setF] = useState({ criterio: "", data: "", resp: "", evidencias: "", anexos: [], resultado: "", obs: "" });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const r = rncs.find(x => x.id === sid);
  useEffect(() => { if (!r) return; setF({ criterio: r.eficacia?.criterio || "", data: r.eficacia?.data || "", resp: r.eficacia?.resp || user?.name || "", evidencias: r.eficacia?.evidencias || "", anexos: r.eficacia?.anexos || [], resultado: r.eficacia?.resultado || "", obs: r.eficacia?.obs || "" }); }, [sid]);
  // O que ainda impede fechar a RNC (Eficaz/Ineficaz). "Pendente verificação" nunca é travado.
  const travaFechar = r ? podeRegistrarEficacia(r, "Eficaz") : { ok: true, motivos: [] };

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
    if (!rncEditavelNasFerramentas(r)) return;
    if (!f.resultado) { alert("Escolha o resultado da verificação."); return; }
    // Trava do ciclo completo — antes, RNC sem nenhuma ação CAPA passava.
    const trava = podeRegistrarEficacia(r, f.resultado);
    if (!trava.ok) { alert("Ainda não dá para fechar esta RNC:\n\n" + trava.motivos.join("\n")); return; }
    // Trava: RNC de material/lote não fecha como Eficaz sem disposição registrada.
    if (f.resultado === "Eficaz" && rncTemMaterial(r) && !r.disposicao?.decisao) {
      alert("Esta RNC envolve material/lote. Registre a Disposição do material (aba Registros → abra a RNC) antes de encerrar como Eficaz.");
      return;
    }
    const ns = f.resultado === "Eficaz" ? "Eficaz" : f.resultado === "Ineficaz" ? "Ineficaz" : "Pendente verificação";
    // `resp` é quem a pessoa indicou como verificador; o histórico registra quem gravou.
    const eficacia = { ...f, registradoPor: user?.name || "—", registradoEm: new Date().toISOString() };
    await doUpdateRNC(r.id, { eficacia, status: ns, historico: [...(r.historico || []), { data: tod(), acao: `Eficácia: ${f.resultado}`, resp: user?.name || "—", ...(f.resp && f.resp !== user?.name ? { detalhes: [`Verificação indicada como responsabilidade de ${f.resp}`] } : {}) }] });
    toast_("Verificação registrada!", "green");
    openEmail({ ...r, eficacia: f, status: ns }, "eficacia");
  };
  return (
    <div>
      <div style={s.card}><SecTitle ch="Selecionar RNC" /><Sel value={sid} onChange={e => setSid(e.target.value)} sx={{ fontSize: 14, padding: "10px 14px" }}><option value="">— Selecione uma RNC em tratamento —</option>{rncs.filter(rncEditavelNasFerramentas).map(r => <option key={r.id} value={r.id}>{r.num} — {r.desc?.substring(0, 55)}</option>)}</Sel></div>
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
        <F lbl="Anexos da verificação" tip="Arquivos que comprovam a verificação: relatório de análise dos lotes seguintes, registro de auditoria, fotos." ch={
          <AnexosUpload inputId="eficacia-anexos" anexos={f.anexos || []} setAnexos={novos => setF(p => ({ ...p, anexos: typeof novos === "function" ? novos(p.anexos || []) : novos }))} />
        } />
        {/* trava: Eficaz/Ineficaz fecham a RNC e exigem o ciclo completo */}
        {!travaFechar.ok && (
          <div style={{ background:`${T.red}14`, border:`1px solid ${T.red}44`, borderRadius:8, padding:"10px 14px", marginBottom:12, fontSize:12, color:T.red }}>
            Para registrar Eficaz ou Ineficaz, falta:
            <ul style={{ margin:"6px 0 0 16px", padding:0 }}>{travaFechar.motivos.map((m,i) => <li key={i}>{m}</li>)}</ul>
            <div style={{ marginTop:6, color:T.text2 }}>"Pendente verificação" pode ser registrado a qualquer momento.</div>
          </div>
        )}
        <F lbl="Resultado da verificação" tip="Eficaz: o problema não se repetiu e as ações foram suficientes. Ineficaz: o problema persistiu — uma nova RNC deverá ser aberta com análise de causa complementar." ch={
          <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
            {[["Eficaz", T.accent, "Causa raiz eliminada"], ["Ineficaz", "#ff4f6a", "NC recorreu, reabrir"], ["Pendente verificação", T.yellow, "Aguardando dados"]].map(([v, color, desc]) => {
              const travado = v !== "Pendente verificação" && !travaFechar.ok;
              return (
              <label key={v} style={{ display: "flex", alignItems: "center", gap: 8, cursor: travado ? "not-allowed" : "pointer", opacity: travado ? .45 : 1, padding: "10px 16px", background: f.resultado === v ? `${color}18` : T.surf, border: `1px solid ${f.resultado === v ? color + "55" : T.border}`, borderRadius: 8, flex: 1, minWidth: 150 }}>
                <input type="radio" name="efic_r" value={v} checked={f.resultado === v} disabled={travado} onChange={() => set("resultado", v)} style={{ accentColor: color }} />
                <div><div style={{ fontWeight: 600, color, fontSize: 12 }}>{v}</div><div style={{ fontSize: 10, color: T.text3 }}>{desc}</div></div>
              </label>
              );
            })}
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
  const [selPeriodo, setSelPeriodo] = usePeriodo("rnc-dashboard", "12m");

  // Duas famílias de número nesta tela:
  // - do PERÍODO: RNCs abertas (campo `data`) dentro do filtro — total, eficácia,
  //   tempo médio, reincidência, Pareto;
  // - da SITUAÇÃO ATUAL: abertas agora, vencidas, GUT e PDCA — "vencidas em março"
  //   não quer dizer nada, então essas olham todas as RNCs e dizem isso na tela.
  const todas = rncs;
  const periodo = resolverPeriodo(selPeriodo, { datas: todas.map(r => r.data) });
  const doPer = filtrarPorPeriodo(todas, periodo, r => r.data);

  const tot = doPer.length;
  const { eficazes: ef, encerradas, taxa: taxaEf } = taxaEficaciaRNC(doPer);
  const ab = todas.filter(x=>x.status==="Aberta").length;
  const venc = todas.filter(r=>r.prazoAC&&r.prazoAC<tod()&&rncAtiva(r.status));
  const critica = doPer.filter(x=>x.sev==="Crítica").length;

  // Tempo médio resolução
  const resolvidas = doPer.filter(x=>x.status==="Eficaz"&&x.data&&x.eficacia?.data);
  const tempoMedio = resolvidas.length>0?Math.round(resolvidas.reduce((a,r)=>{
    const d1=new Date(r.data);const d2=new Date(r.eficacia.data);
    return a+(d2-d1)/(1000*60*60*24);
  },0)/resolvidas.length):null;

  // Reincidência (mesma causa raiz)
  const causas = {};
  doPer.filter(x=>x.ishikawa?.root).forEach(r=>{ causas[r.ishikawa.root]=(causas[r.ishikawa.root]||0)+1; });
  const reincidentes = Object.values(causas).filter(v=>v>1).length;

  // Por tipo (Pareto)
  const bT={},bS={},bF={};
  doPer.forEach(r=>{
    bT[r.tipo]=(bT[r.tipo]||0)+1;
    bS[r.status]=(bS[r.status]||0)+1;
    if(r.fornecedor)bF[r.fornecedor]=(bF[r.fornecedor]||0)+1;
  });

  // PDCA — agrupar RNCs por fase
  const pdcaFases = {
    P: todas.filter(x=>x.status==="Aberta"||x.status==="Em andamento").filter(x=>!x.ishikawa?.root),
    D: todas.filter(x=>x.ishikawa?.root&&(!x.w2h||x.w2h.length===0)),
    C: todas.filter(x=>x.w2h?.length>0&&x.status==="Pendente verificação"),
    A: todas.filter(x=>x.status==="Eficaz"),
  };

  // Pareto acumulado
  const paretoData = Object.entries(bT).sort((a,b)=>b[1]-a[1]);
  const paretoTotal = paretoData.reduce((s,[,n])=>s+n,0);
  let acum=0;
  const paretoAcum = paretoData.map(([k,n])=>{ acum+=n; return [k,n,Math.round(acum/paretoTotal*100)]; });

  // Matriz GUT das RNCs abertas
  const gutRncs = gutRank(todas);
  const comPeriodo = dashTab==="kpis" || dashTab==="pareto";

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

      {comPeriodo
        ? <FiltroPeriodo sel={selPeriodo} onChange={setSelPeriodo} periodo={periodo}>
            <span style={{ fontSize:12, color:T.text3 }}>{tot} RNC(s) abertas no período</span>
          </FiltroPeriodo>
        : <div style={{ marginBottom:12 }}><SituacaoAtual>Situação atual de todas as RNCs — esta visão independe do período</SituacaoAtual></div>}

      {/* ── KPIs ── */}
      {dashTab==="kpis"&&(
        <>
          {/* Cards principais */}
          <div className="kpi-grid" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:"1rem" }}>
            {[
              {l:"Taxa de Eficácia",n:taxaEf===null?"—":`${taxaEf}%`,c:taxaEf===null?T.text3:taxaEf>=70?T.accent:"#ff8c42",sub:`${ef} eficaz(es) de ${encerradas} encerrada(s)`,icon:"✅",trend:taxaEf===null?"Sem encerradas":taxaEf>=70?"↑ Bom":"↓ Atenção"},
              {l:"RNCs Abertas",n:ab,c:ab>0?"#ff4f6a":T.accent,sub:"Hoje — independe do período",icon:"📋",trend:ab===0?"✓ Limpo":"⚠ Pendente"},
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
              ["Total no período",tot,T.accent],
              ["Críticas",critica,"#ff4f6a"],
              ["Vencidas hoje",venc.length,"#ffd166"],
              ["Eficazes",ef,T.accent],
              ["Ineficazes",doPer.filter(x=>x.status==="Ineficaz").length,"#ff8c42"],
            ].map(([l,n,c])=>(
              <div key={l} style={{ background:T.surf, border:`1px solid ${T.border}`, borderRadius:10, padding:"10px 14px", textAlign:"center" }}>
                <div style={{ fontSize:22, fontWeight:700, color:c }}>{n}</div>
                <div style={{ fontSize:10, color:T.text3, textTransform:"uppercase", letterSpacing:".04em", marginTop:2 }}>{l}</div>
              </div>
            ))}
          </div>

          {/* Barras por status e tipo */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
            {[["Por Status",bS,Object.fromEntries(Object.keys(SMETA).map(k=>[k,SMETA[k].dot]))],["Por Tipo",bT,Object.fromEntries(Object.keys(TIPOC).map(k=>[k,tipoCor(k,T)]))]].map(([title,data,cm])=>(
              <div key={title} style={{ ...s.card }}>
                <SecTitle ch={title}/>
                {Object.keys(data).length===0&&<div style={{ color:T.text3, fontSize:12, textAlign:"center", padding:"1rem" }}>Nenhuma RNC no período.</div>}
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
            <div style={{ marginTop:-6, marginBottom:10 }}><SituacaoAtual /></div>
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
  const [selPeriodo, setSelPeriodo] = usePeriodo("rnc-relatorios", "mes");
  const [respFiltro, setRespFiltro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [emailDest, setEmailDest] = useState(user.email);
  const [aiResumo, setAiResumo] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [activeSection, setActiveSection] = useState("resumo");

  // Mesmo filtro de período dos painéis (periodoLogic). As datas eram calculadas com
  // toISOString(), que é UTC: depois das 21h o "hoje" do relatório já era amanhã.
  const periodo = resolverPeriodo(selPeriodo, { datas: rncs.map(r => r.data) });
  const dataInicio = periodo.de, dataFim = periodo.ate;

  const filtered = filtrarPorPeriodo(rncs, periodo, r => r.data).filter(r => !respFiltro || r.resp === respFiltro);
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
  const vencidas = filtered.filter(x=>x.prazoAC&&x.prazoAC<tod()&&rncAtiva(x.status)).length;
  const { encerradas, taxa: taxaEficacia } = taxaEficaciaRNC(filtered);
  const txtEficacia = taxaEficacia===null ? "—" : `${taxaEficacia}%`;
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
TAXA DE EFICÁCIA (eficazes ÷ encerradas): ${txtEficacia}
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
Eficazes:             ${eficaz} (${txtEficacia} das ${encerradas} encerradas)
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
  const vc=list.filter(x=>x.prazoAC&&x.prazoAC<tod()&&rncAtiva(x.status)).length;
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
      await enviarEmail({
        para:[emailDest],
        assunto:`📊 Relatório SGQ — ${fmt(dataInicio)} a ${fmt(dataFim)}${respFiltro?` · ${respFiltro}`:""}`,
        corpo, evento:"relatorio_rnc",
      });
      toast_("Relatório enviado!","green");
    } catch(e) { toast_("Erro ao enviar: "+e.message,"red"); }
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
          <div style={{ flexBasis:"100%", marginBottom:-8 }}>
            <FiltroPeriodo sel={selPeriodo} onChange={setSelPeriodo} periodo={periodo} presets={["7d","15d","mes","3m","12m"]} />
          </div>
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
          { l:"Taxa de eficácia", n:txtEficacia, c:taxaEficacia===null?T.text3:taxaEficacia>=70?T.accent:"#ff8c42", sub:`${eficaz} eficaz(es) de ${encerradas} encerrada(s)`, icon:"✅" },
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
              <span style={{ fontSize:16, fontWeight:700, color:taxaEficacia===null?T.text3:taxaEficacia>=70?T.accent:"#ff8c42" }}>{txtEficacia}</span>
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
            const vc=list.filter(x=>x.prazoAC&&x.prazoAC<tod()&&rncAtiva(x.status)).length;
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
            const color=tipoCor(tipo,T);
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
                  {past(r.prazoAC)&&rncAtiva(r.status)&&<span style={{ fontSize:10, color:"#ff4f6a", fontWeight:700, background:"#ff4f6a18", padding:"2px 8px", borderRadius:20 }}>⚠ VENCIDO</span>}
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

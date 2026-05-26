import React, { useState } from "react";
import { auth } from "../../firebase";
import { useTheme } from "../../core/theme";
import { fmt, past, sigCodigo } from "../../core/utils";
import { useS } from "../../shared/styles";
import { F, Inp } from "../../shared/ui";

export const PDF_CSS = `
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#1a1a1a;background:#fff;}
  .page{width:210mm;min-height:297mm;padding:14mm;margin:0 auto;}
  .header{display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;border-bottom:3px solid #1a7a3c;margin-bottom:18px;}
  .logo{font-family:Georgia,serif;font-size:20px;font-weight:700;color:#1a7a3c;letter-spacing:1px;}
  .logo-sub{font-size:10px;color:#666;margin-top:2px;}
  .doc-num{font-size:18px;font-weight:700;color:#1a7a3c;text-align:right;}
  .doc-date{font-size:11px;color:#666;text-align:right;margin-top:2px;}
  .section{margin-bottom:16px;}
  .stitle{font-size:10px;font-weight:700;color:#1a7a3c;text-transform:uppercase;letter-spacing:.08em;border-bottom:2px solid #1a7a3c;padding-bottom:4px;margin-bottom:10px;}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
  .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;}
  .field{background:#f8f9fa;border:1px solid #e8e8e8;border-radius:5px;padding:7px 10px;}
  .flabel{font-size:9px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px;}
  .fval{font-size:12px;color:#1a1a1a;font-weight:500;}
  .badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;}
  .box-green{background:#f0f9f0;border:1px solid #c8e6c9;border-radius:7px;padding:10px 12px;}
  .box-orange{background:#fff8f0;border:1px solid #ffe0b2;border-radius:7px;padding:10px 12px;}
  .box-red{background:#fff0f0;border:1px solid #ffcdd2;border-radius:7px;padding:10px 12px;}
  table{width:100%;border-collapse:collapse;font-size:11px;}
  th{background:#1a7a3c;color:#fff;font-weight:700;padding:7px 8px;text-align:left;}
  td{padding:6px 8px;border-bottom:1px solid #eee;vertical-align:middle;}
  tr:nth-child(even)td{background:#f8faf8;}
  .footer{margin-top:20px;padding-top:10px;border-top:2px solid #1a7a3c;display:flex;justify-content:space-between;font-size:10px;color:#666;}
  .sign-row{display:flex;gap:40px;margin-top:24px;padding-top:12px;border-top:1px solid #ccc;}
  .sign-box{flex:1;text-align:center;}
  .sign-line{border-top:1px solid #333;padding-top:6px;margin-top:30px;font-size:11px;}
  @media print{body{background:#fff!important;}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}}
`;

export function openPDFWindow(title, html) {
  const win = window.open("","_blank");
  win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/><title>${title}</title><style>${PDF_CSS}</style></head><body>${html}<script>window.onload=()=>window.print();<\/script></body></html>`);
  win.document.close();
}

export function AssinaturaModal({ user, onConfirm, onClose, titulo }) {
  const T = useTheme(); const s = useS();
  const [senha, setSenha] = useState("");
  const [cargo, setCargo] = useState(user.setor || "Analista de Controle de Qualidade");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const confirmar = async () => {
    if (!senha.trim()) { setErr("Digite sua senha para assinar."); return; }
    setLoading(true); setErr("");
    try {
      const { signInWithEmailAndPassword } = await import("firebase/auth");
      const { auth } = await import("../../firebase");
      await signInWithEmailAndPassword(auth, user.email, senha);
      onConfirm({
        nome: user.name,
        cargo,
        email: user.email,
        assinaturaImg: user.assinatura || null,
        data: new Date().toLocaleDateString("pt-BR"),
        hora: new Date().toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" }),
        timestamp: new Date().toISOString(),
      });
    } catch { setErr("Senha incorreta. Tente novamente."); }
    setLoading(false);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.85)", backdropFilter:"blur(8px)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}>
      <div style={{ background:T.card2, border:`1px solid ${T.border2}`, borderRadius:18, padding:"1.75rem", maxWidth:420, width:"100%", boxShadow:"0 32px 80px #000a" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:"1.5rem" }}>
          <div style={{ width:44, height:44, borderRadius:12, background:T.accentDim, border:`1px solid ${T.accent}33`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>📝</div>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:T.text }}>Assinatura Eletrônica</div>
            <div style={{ fontSize:11, color:T.text2, marginTop:2 }}>{titulo}</div>
          </div>
        </div>

        <div style={{ background:T.surf, border:`1px solid ${T.border}`, borderRadius:10, padding:"12px 14px", marginBottom:"1rem" }}>
          <div style={{ fontSize:11, color:T.text3, marginBottom:6, textTransform:"uppercase", letterSpacing:".06em", fontWeight:600 }}>Será registrado no documento:</div>
          {user.assinatura && (
            <img src={user.assinatura} alt="Assinatura" style={{ height:56, maxWidth:220, objectFit:"contain", background:"#fff", padding:4, borderRadius:4, display:"block", marginBottom:8 }} />
          )}
          <div style={{ fontSize:13, color:T.text, fontWeight:600 }}>{user.name}</div>
          <div style={{ fontSize:12, color:T.text2 }}>{cargo}</div>
          <div style={{ fontSize:11, color:T.text3, marginTop:4 }}>
            {new Date().toLocaleDateString("pt-BR")} às {new Date().toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" })}
          </div>
          {!user.assinatura && <div style={{ fontSize:11, color:"#ff8c42", marginTop:6 }}>⚠ Nenhuma assinatura cadastrada — será gerado apenas com nome e data.</div>}
        </div>

        <F lbl="Cargo / Função" ch={<Inp value={cargo} onChange={e=>setCargo(e.target.value)} placeholder="Ex: Analista de CQ" />} />
        <F lbl="Confirme sua senha *" ch={<Inp type="password" value={senha} onChange={e=>setSenha(e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&confirmar()} />} />

        {err && <div style={{ background:"#ff4f6a18", border:"1px solid #ff4f6a33", borderRadius:8, padding:"8px 12px", fontSize:12, color:"#ff4f6a", marginBottom:12 }}>{err}</div>}

        <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:"1rem" }}>
          <button style={s.btn} onClick={onClose}>Cancelar</button>
          <button style={{ ...s.btnA, opacity:loading?.6:1, minWidth:140, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }} onClick={confirmar} disabled={loading}>
            {loading ? <><span style={{ animation:"spin 1s linear infinite", display:"inline-block" }}>⟳</span> Verificando...</> : "Assinar documento"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function exportRNCPDF(rnc, assinatura = null) {
  const win = window.open("", "_blank");
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<title>RNC ${rnc.num} — Herbamed®</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#1a1a1a;background:#fff;padding:0;}
  .page{width:210mm;min-height:297mm;padding:16mm 14mm;margin:0 auto;}
  .header{display:flex;justify-content:space-between;align-items:center;padding-bottom:12px;border-bottom:3px solid #1a7a3c;margin-bottom:20px;}
  .logo-area{display:flex;align-items:center;gap:12px;}
  .logo-text{font-family:Georgia,serif;font-size:22px;font-weight:700;color:#1a7a3c;letter-spacing:1px;}
  .logo-sub{font-size:10px;color:#666;margin-top:2px;}
  .rnc-num{font-size:20px;font-weight:700;color:#1a7a3c;text-align:right;}
  .rnc-date{font-size:11px;color:#666;text-align:right;margin-top:2px;}
  .badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;}
  .badge-aberta{background:#ff4f6a18;color:#cc2244;border:1px solid #ff4f6a40;}
  .badge-eficaz{background:#22c97a18;color:#1a7a3c;border:1px solid #22c97a40;}
  .badge-andamento{background:#ffd16618;color:#8a6000;border:1px solid #ffd16640;}
  .badge-pendente{background:#4f9eff18;color:#1a4a8a;border:1px solid #4f9eff40;}
  .badge-ineficaz{background:#ff4f6a18;color:#cc2244;border:1px solid #ff4f6a40;}
  .sev-critica{background:#ff4f6a18;color:#cc2244;border:1px solid #ff4f6a40;}
  .sev-maior{background:#ff8c4218;color:#7a3c00;border:1px solid #ff8c4240;}
  .sev-menor{background:#a78bfa18;color:#4a2a8a;border:1px solid #a78bfa40;}
  .section{margin-bottom:18px;}
  .section-title{font-size:10px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px;padding-bottom:5px;border-bottom:1px solid #e0e0e0;display:flex;align-items:center;gap:6px;}
  .section-title::before{content:'';display:inline-block;width:3px;height:12px;background:#1a7a3c;border-radius:2px;}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
  .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;}
  .field{background:#f8f9fa;border:1px solid #e8e8e8;border-radius:6px;padding:8px 10px;}
  .field-label{font-size:9px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px;}
  .field-value{font-size:12px;color:#1a1a1a;font-weight:500;}
  .desc-box{background:#f0f9f0;border:1px solid #c8e6c9;border-radius:8px;padding:12px;font-size:13px;line-height:1.7;color:#1a1a1a;}
  .contencao-box{background:#fff8f0;border:1px solid #ffe0b2;border-radius:8px;padding:12px;font-size:13px;line-height:1.7;}
  .causa-box{background:#e8f5e9;border:2px solid #1a7a3c;border-radius:8px;padding:12px;font-size:13px;font-weight:600;color:#1a4a1a;}
  .step{display:flex;align-items:center;gap:8px;margin-bottom:8px;}
  .step-num{width:24px;height:24px;border-radius:50%;background:#1a7a3c;color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;}
  .step-text{font-size:12px;color:#333;}
  .hist-item{padding:8px 10px;border-left:3px solid #1a7a3c;background:#f8f9fa;margin-bottom:6px;border-radius:0 6px 6px 0;}
  .hist-date{font-size:10px;color:#888;margin-bottom:2px;}
  .hist-acao{font-size:12px;color:#1a1a1a;}
  .footer{margin-top:24px;padding-top:12px;border-top:2px solid #1a7a3c;display:flex;justify-content:space-between;align-items:center;}
  .footer-left{font-size:10px;color:#666;}
  .footer-right{font-size:10px;color:#666;text-align:right;}
  .progress-bar{display:flex;gap:4px;margin-top:8px;}
  .progress-step{flex:1;height:6px;border-radius:3px;}
  .w2h-item{background:#f8f9fa;border:1px solid #e8e8e8;border-radius:6px;padding:10px;margin-bottom:8px;}
  .w2h-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px;}
  @media print{body{background:#fff!important;}.page{padding:10mm 12mm;}}
</style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div class="header">
    <div class="logo-area">
      <div>
        <div class="logo-text">🌿 HERBAMED®</div>
        <div class="logo-sub">Sistema de Gestão da Qualidade — SGQ</div>
      </div>
    </div>
    <div>
      <div class="rnc-num">${rnc.num}</div>
      <div class="rnc-date">Aberta em ${fmt(rnc.data)} por ${rnc.detector||"—"}</div>
      <div style="text-align:right;margin-top:4px;">
        <span class="badge badge-${rnc.status==="Eficaz"?"eficaz":rnc.status==="Em andamento"?"andamento":rnc.status==="Pendente verificação"?"pendente":rnc.status==="Ineficaz"?"ineficaz":"aberta"}">${rnc.status}</span>
        &nbsp;
        <span class="badge sev-${rnc.sev==="Crítica"?"critica":rnc.sev==="Maior"?"maior":"menor"}">${rnc.sev}</span>
      </div>
    </div>
  </div>

  <!-- PROGRESSO -->
  <div class="section">
    <div class="section-title">Progresso da RNC</div>
    <div class="progress-bar">
      ${["Abertura","Análise de Causa","Plano de Ação","Verificação de Eficácia"].map((st,i)=>{
        const step = rnc.status==="Eficaz"||rnc.eficacia?.resultado?4:rnc.w2h?.length>0?3:rnc.ishikawa?.root?2:1;
        return `<div class="progress-step" style="background:${i<step?"#1a7a3c":"#e0e0e0"};"></div>`;
      }).join("")}
    </div>
    <div style="display:flex;gap:4px;margin-top:4px;">
      ${["Abertura","Análise","5W2H","Eficácia"].map((st,i)=>{
        const step = rnc.status==="Eficaz"?4:rnc.w2h?.length>0?3:rnc.ishikawa?.root?2:1;
        return `<div style="flex:1;font-size:9px;color:${i<step?"#1a7a3c":"#aaa"};text-align:center;font-weight:${i<step?700:400};">${st}</div>`;
      }).join("")}
    </div>
  </div>

  <!-- IDENTIFICAÇÃO -->
  <div class="section">
    <div class="section-title">Identificação</div>
    <div class="grid3">
      <div class="field"><div class="field-label">Tipo</div><div class="field-value">${rnc.tipo||"—"}</div></div>
      <div class="field"><div class="field-label">Setor</div><div class="field-value">${rnc.setor||"—"}</div></div>
      <div class="field"><div class="field-label">Detectado por</div><div class="field-value">${rnc.detector||"—"}</div></div>
    </div>
    <div class="grid3" style="margin-top:8px;">
      <div class="field"><div class="field-label">Produto / Material</div><div class="field-value">${rnc.produto||"—"}</div></div>
      <div class="field"><div class="field-label">Fornecedor</div><div class="field-value">${rnc.fornecedor||"—"}</div></div>
      <div class="field"><div class="field-label">Nº do Lote</div><div class="field-value">${rnc.lote||"—"}</div></div>
    </div>
    <div class="grid3" style="margin-top:8px;">
      <div class="field"><div class="field-label">Qtd. Afetada</div><div class="field-value">${rnc.qtd||"—"}</div></div>
      <div class="field"><div class="field-label">Referência Normativa</div><div class="field-value">${rnc.ref||"—"}</div></div>
      <div class="field"><div class="field-label">Responsável pela Análise</div><div class="field-value">${rnc.resp||"—"}</div></div>
    </div>
  </div>

  <!-- DESCRIÇÃO -->
  <div class="section">
    <div class="section-title">Descrição da Não Conformidade</div>
    <div class="desc-box">${rnc.desc||"—"}</div>
    ${rnc.evidencia?`<div style="margin-top:8px;font-size:11px;color:#666;"><strong>Evidências:</strong> ${rnc.evidencia}</div>`:""}
  </div>

  <!-- CONTENÇÃO -->
  ${rnc.contencao?`
  <div class="section">
    <div class="section-title">⚡ Ação de Contenção</div>
    <div class="contencao-box">${rnc.contencao}</div>
    <div style="margin-top:6px;font-size:11px;color:#666;">
      Responsável: <strong>${rnc.respCont||"—"}</strong> &nbsp;|&nbsp; Data: <strong>${fmt(rnc.dataContencao)}</strong>
    </div>
  </div>`:""}

  <!-- PRAZOS -->
  <div class="section">
    <div class="section-title">Prazos</div>
    <div class="grid3">
      <div class="field"><div class="field-label">Análise de Causa</div><div class="field-value">${fmt(rnc.prazoCausa)}</div></div>
      <div class="field"><div class="field-label">Ação Corretiva</div><div class="field-value" style="color:${past(rnc.prazoAC)&&rnc.status!=="Eficaz"?"#cc2244":"inherit"}">${fmt(rnc.prazoAC)}${past(rnc.prazoAC)&&rnc.status!=="Eficaz"?" ⚠":""}  </div></div>
      <div class="field"><div class="field-label">Verificação Eficácia</div><div class="field-value">${fmt(rnc.prazoEfic)}</div></div>
    </div>
  </div>

  <!-- ISHIKAWA / 5 PORQUÊS -->
  ${rnc.ishikawa?.root?`
  <div class="section">
    <div class="section-title">🐟 Análise de Causa — Ishikawa / 5 Porquês</div>
    ${rnc.ishikawa.whys?.filter(w=>w).length>0?`
    <div style="margin-bottom:10px;">
      ${rnc.ishikawa.whys.filter(w=>w).map((w,i)=>`
        <div class="step">
          <div class="step-num">${i+1}</div>
          <div class="step-text">${w}</div>
        </div>`).join("")}
    </div>`:""}
    <div class="causa-box">🎯 Causa Raiz: ${rnc.ishikawa.root}</div>
  </div>`:""}

  <!-- 5W2H -->
  ${rnc.w2h?.length>0?`
  <div class="section">
    <div class="section-title">📌 Plano de Ação 5W2H</div>
    ${rnc.w2h.map((a,i)=>`
      <div class="w2h-item">
        <div style="font-size:12px;font-weight:700;color:#1a7a3c;margin-bottom:6px;">Ação #${i+1}: ${a.what||"—"}</div>
        <div class="w2h-grid">
          <div><span style="font-size:9px;color:#888;font-weight:700;">POR QUÊ</span><br/><span style="font-size:11px;">${a.why||"—"}</span></div>
          <div><span style="font-size:9px;color:#888;font-weight:700;">QUEM</span><br/><span style="font-size:11px;">${a.who||"—"}</span></div>
          <div><span style="font-size:9px;color:#888;font-weight:700;">ONDE</span><br/><span style="font-size:11px;">${a.where||"—"}</span></div>
          <div><span style="font-size:9px;color:#888;font-weight:700;">QUANDO</span><br/><span style="font-size:11px;">${fmt(a.when)}</span></div>
          <div style="grid-column:span 2;"><span style="font-size:9px;color:#888;font-weight:700;">COMO</span><br/><span style="font-size:11px;">${a.how||"—"}</span></div>
        </div>
        <div style="margin-top:6px;"><span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:${a.status==="Concluída"?"#22c97a18":a.status==="Em andamento"?"#ffd16618":"#f0f0f0"};color:${a.status==="Concluída"?"#1a7a3c":a.status==="Em andamento"?"#8a6000":"#666"};">${a.status||"Pendente"}</span></div>
      </div>`).join("")}
  </div>`:""}

  <!-- EFICÁCIA -->
  ${rnc.eficacia?.resultado?`
  <div class="section">
    <div class="section-title">✅ Verificação de Eficácia</div>
    <div class="grid2">
      <div class="field"><div class="field-label">Resultado</div><div class="field-value" style="color:${rnc.eficacia.resultado==="Eficaz"?"#1a7a3c":"#cc2244"};font-weight:700;">${rnc.eficacia.resultado}</div></div>
      <div class="field"><div class="field-label">Data da Verificação</div><div class="field-value">${fmt(rnc.eficacia.data)}</div></div>
    </div>
    ${rnc.eficacia.criterio?`<div style="margin-top:8px;font-size:12px;color:#333;"><strong>Critério:</strong> ${rnc.eficacia.criterio}</div>`:""}
    ${rnc.eficacia.obs?`<div style="margin-top:6px;font-size:12px;color:#333;"><strong>Lições aprendidas:</strong> ${rnc.eficacia.obs}</div>`:""}
  </div>`:""}

  <!-- HISTÓRICO -->
  ${rnc.historico?.length>0?`
  <div class="section">
    <div class="section-title">📜 Histórico de Versões</div>
    ${[...rnc.historico].reverse().slice(0,6).map(h=>`
      <div class="hist-item">
        <div class="hist-date">${fmt(h.data)}${h.hora?" · "+h.hora:""} · ${h.resp||"—"}</div>
        <div class="hist-acao">${h.acao}</div>
        ${h.detalhes?.length>0?`<div style="margin-top:4px;">${h.detalhes.map(d=>`<div style="font-size:10px;color:#888;">• ${d}</div>`).join("")}</div>`:""}
      </div>`).join("")}
  </div>`:""}

  <!-- ASSINATURA -->
  <div style="display:flex;gap:40px;margin-top:24px;padding-top:12px;border-top:1px solid #ccc;">
    <div style="flex:1;text-align:center;">
      ${assinatura ? `
        <div style="border-top:1px solid #333;padding-top:6px;font-size:11px;text-align:left;">
          <strong>${assinatura.nome}</strong><br/>
          ${assinatura.cargo}<br/>
          ${assinatura.email?`<span style="color:#777;font-size:10px;">${assinatura.email}</span><br/>`:""}
          <span style="color:#666;font-size:10px;">✔ Assinado eletronicamente em ${assinatura.data} às ${assinatura.hora}</span><br/>
          <span style="color:#999;font-size:9px;font-family:monospace;">Cód. verificação: ${sigCodigo(assinatura, `RNC|${rnc.num||rnc.id||""}`)}</span>
        </div>
      ` : `<div style="border-top:1px solid #333;padding-top:6px;margin-top:56px;font-size:11px;">______________________<br/>Responsável pela análise</div>`}
    </div>
    <div style="flex:1;text-align:center;">
      <div style="border-top:1px solid #333;padding-top:6px;margin-top:56px;font-size:11px;">
        ______________________<br/>Gerente de Qualidade
      </div>
    </div>
  </div>

  <!-- ASSINATURA RT -->
  ${rnc.assinaturaRT ? `
  <div style="margin-top:16px;padding:12px 16px;border:1px solid #2ab84a33;border-radius:8px;background:#f6fff8;display:flex;align-items:center;gap:16px;">
    <div style="flex:1;">
      <div style="font-size:10px;color:#2ab84a;font-weight:bold;text-transform:uppercase;margin-bottom:4px;">✅ Aprovado pelo Responsável Técnico</div>
      <div style="font-size:12px;font-weight:bold;">${rnc.assinaturaRT.nome}${rnc.assinaturaRT.crf ? " · " + rnc.assinaturaRT.crf : ""}</div>
      ${rnc.assinaturaRT.email?`<div style="font-size:10px;color:#777;">${rnc.assinaturaRT.email}</div>`:""}
      <div style="font-size:11px;color:#666;">✔ Assinado eletronicamente em ${rnc.assinaturaRT.timestamp?new Date(rnc.assinaturaRT.timestamp).toLocaleString("pt-BR"):rnc.assinaturaRT.dataHora}</div>
      <div style="font-size:9px;color:#999;font-family:monospace;margin-top:2px;">Cód. verificação: ${sigCodigo(rnc.assinaturaRT, `RNC|${rnc.num||rnc.id||""}`)}</div>
    </div>` : rnc.sev === "Crítica" ? `
  <div style="margin-top:12px;padding:10px 14px;border:1px solid #ffd16633;border-radius:8px;background:#fffbf0;font-size:11px;color:#b8860b;">
    ⏳ RNC Crítica — Aprovação do Responsável Técnico pendente
  </div>` : ""}

  <!-- FOOTER -->
  <div class="footer">
    <div class="footer-left">
      <strong>Herbamed® · Sistema de Gestão da Qualidade</strong><br/>
      "Fornecendo Saúde. Cultivando Qualidade de Vida."
    </div>
    <div class="footer-right">
      Documento gerado em ${new Date().toLocaleString("pt-BR")}<br/>
      ${rnc.num} · Confidencial
    </div>
  </div>

</div>
<script>window.onload=()=>window.print();</script>
</body></html>`;
  win.document.write(html);
  win.document.close();
}

export function exportFMEAPDF(items) {
  const rpnColor = (r) => r>=100?"#cc2244":r>=50?"#8a4000":r>=25?"#8a6000":"#1a7a3c";
  const rpnLabel = (r) => r>=100?"CRÍTICO":r>=50?"ALTO":r>=25?"MÉDIO":"BAIXO";
  const sorted = [...items].sort((a,b)=>(b.S*b.O*b.D)-(a.S*a.O*a.D));
  openPDFWindow("FMEA — Herbamed®", `
<div class="page">
  <div class="header">
    <div><div class="logo">🌿 HERBAMED®</div><div class="logo-sub">FMEA — Análise de Modo e Efeito de Falha</div></div>
    <div><div class="doc-date">Gerado em ${new Date().toLocaleDateString("pt-BR")}</div></div>
  </div>
  <div class="section">
    <div class="stitle">Análise de Riscos — ${sorted.length} item(s)</div>
    <table>
      <thead><tr><th>Processo</th><th>Modo de Falha</th><th>Efeito</th><th>Causa</th><th>S</th><th>O</th><th>D</th><th>RPN</th><th>Prioridade</th><th>Ação</th><th>Resp.</th><th>Status</th></tr></thead>
      <tbody>
        ${sorted.map(item=>{
          const rpn=item.S*item.O*item.D;
          return `<tr>
            <td>${item.processo||"—"}</td><td><strong>${item.modoFalha||"—"}</strong></td>
            <td>${item.efeito||"—"}</td><td>${item.causa||"—"}</td>
            <td style="text-align:center;font-weight:700">${item.S}</td>
            <td style="text-align:center;font-weight:700">${item.O}</td>
            <td style="text-align:center;font-weight:700">${item.D}</td>
            <td style="text-align:center;font-weight:800;color:${rpnColor(rpn)}">${rpn}</td>
            <td><span style="font-weight:700;color:${rpnColor(rpn)}">${rpnLabel(rpn)}</span></td>
            <td>${item.acao||"—"}</td><td>${item.resp||"—"}</td><td>${item.status||"—"}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  </div>
  <div class="section">
    <div class="grid3">
      <div class="field"><div class="flabel">Total de itens</div><div class="fval">${sorted.length}</div></div>
      <div class="field"><div class="flabel">Itens críticos (RPN≥100)</div><div class="fval" style="color:#cc2244">${sorted.filter(x=>x.S*x.O*x.D>=100).length}</div></div>
      <div class="field"><div class="flabel">Itens altos (RPN 50-99)</div><div class="fval" style="color:#8a4000">${sorted.filter(x=>x.S*x.O*x.D>=50&&x.S*x.O*x.D<100).length}</div></div>
    </div>
  </div>
  <div class="footer">
    <div>Herbamed® · Sistema de Gestão da Qualidade · FMEA</div>
    <div>Gerado em ${new Date().toLocaleString("pt-BR")} · Documento confidencial</div>
  </div>
</div>`);
}

export function exportAuditoriaPDF(a) {
  const statusColor = { "Não conformidade":"#cc2244", "Observação":"#8a6000", "Oportunidade de melhoria":"#1a7a3c", "Ponto positivo":"#1a7a3c" };
  openPDFWindow(`${a.titulo} — Herbamed®`, `
<div class="page">
  <div class="header">
    <div><div class="logo">🌿 HERBAMED®</div><div class="logo-sub">Relatório de Auditoria ${a.tipo}</div></div>
    <div><div class="doc-date">Planejado em ${fmt(a.dataPlano)}</div>${a.dataPrev?`<div class="doc-date">Execução: ${fmt(a.dataPrev)}</div>`:""}</div>
  </div>
  <div class="section">
    <div class="stitle">Identificação</div>
    <div class="grid2">
      <div class="field"><div class="flabel">Título</div><div class="fval">${a.titulo}</div></div>
      <div class="field"><div class="flabel">Tipo</div><div class="fval">${a.tipo}</div></div>
      <div class="field"><div class="flabel">Área auditada</div><div class="fval">${a.area||"—"}</div></div>
      <div class="field"><div class="flabel">Auditor(es)</div><div class="fval">${a.auditores||"—"}</div></div>
      <div class="field"><div class="flabel">Status</div><div class="fval">${a.status}</div></div>
    </div>
  </div>
  ${a.objetivo?`<div class="section"><div class="stitle">Objetivo</div><div class="box-green">${a.objetivo}</div></div>`:""}
  ${a.escopo?`<div class="section"><div class="stitle">Escopo</div><div class="box-green">${a.escopo}</div></div>`:""}
  ${a.achados?.length>0?`
  <div class="section">
    <div class="stitle">Achados (${a.achados.length})</div>
    <table>
      <thead><tr><th>#</th><th>Tipo</th><th>Descrição</th><th>Referência</th><th>Ação Corretiva</th><th>Responsável</th><th>Prazo</th><th>Status</th></tr></thead>
      <tbody>
        ${a.achados.map((ach,i)=>`<tr>
          <td style="text-align:center">${i+1}</td>
          <td><span style="font-weight:700;color:${statusColor[ach.tipo]||"#333"}">${ach.tipo}</span></td>
          <td>${ach.desc||"—"}</td>
          <td>${ach.ref||"—"}</td>
          <td>${ach.acao||"—"}</td>
          <td>${ach.resp||"—"}</td>
          <td>${fmt(ach.prazo)}</td>
          <td>${ach.status||"—"}</td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div>`:""}
  <div class="sign-row">
    <div class="sign-box"><div class="sign-line">${a.auditores||"Auditor"}<br/>Auditor</div></div>
    <div class="sign-box"><div class="sign-line">______________________<br/>Responsável da Área</div></div>
    <div class="sign-box"><div class="sign-line">______________________<br/>Gerente de Qualidade</div></div>
  </div>
  <div class="footer">
    <div>Herbamed® · Sistema de Gestão da Qualidade · Auditoria</div>
    <div>Gerado em ${new Date().toLocaleString("pt-BR")} · Documento confidencial</div>
  </div>
</div>`);
}

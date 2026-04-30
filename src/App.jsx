import React, { useState, useEffect, useCallback, createContext, useContext } from "react";
import { auth, loginUser, logoutUser, getUser, saveUser, createAuthUser,
         deleteUser as fbDeleteUser, updateUser, getAllUsers,
         saveRNC, updateRNC, deleteRNC as fbDeleteRNC, subscribeRNCs,
         incrementCounter } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";

/* ─── THEME SYSTEM ──────────────────────────────────────────────────────────── */
const THEMES = {
  herbamed: {
    name: "🌿 Herbamed Verde",
    bg: "#0a110c", surf: "#101a12", card: "#141f16", card2: "#192118",
    accent: "#2ab84a", accent2: "#1a7a3c", accentDim: "#2ab84a18",
    accentGlow: "#2ab84a40", text: "#eef4ef", text2: "#7a9c7e", text3: "#3d5c42",
    border: "rgba(42,184,74,0.1)", border2: "rgba(42,184,74,0.2)",
    red: "#ff4f6a", yellow: "#ffd166", blue: "#4fc3f7", orange: "#ff8c42", purple: "#a78bfa",
  },
  dark: {
    name: "🌑 Dark Premium",
    bg: "#090910", surf: "#0f0f1a", card: "#141422", card2: "#1a1a2a",
    accent: "#4f9eff", accent2: "#1a3a5e", accentDim: "#4f9eff18",
    accentGlow: "#4f9eff40", text: "#eeeef8", text2: "#7878a0", text3: "#44445a",
    border: "rgba(255,255,255,0.07)", border2: "rgba(255,255,255,0.13)",
    red: "#ff4f6a", yellow: "#ffd166", blue: "#4f9eff", orange: "#ff8c42", purple: "#a78bfa",
  },
  light: {
    name: "☀️ Light Claro",
    bg: "#f4f7f4", surf: "#ffffff", card: "#ffffff", card2: "#f0f5f1",
    accent: "#1a7a3c", accent2: "#145c2e", accentDim: "#1a7a3c15",
    accentGlow: "#1a7a3c30", text: "#1a2e1e", text2: "#4a6b50", text3: "#8aaa8e",
    border: "rgba(0,0,0,0.08)", border2: "rgba(0,0,0,0.14)",
    red: "#e53935", yellow: "#f9a825", blue: "#1565c0", orange: "#e65100", purple: "#6a1b9a",
  },
  ocean: {
    name: "🌊 Ocean Blue",
    bg: "#060d18", surf: "#0a1628", card: "#0d1f38", card2: "#112240",
    accent: "#00d4ff", accent2: "#0077aa", accentDim: "#00d4ff18",
    accentGlow: "#00d4ff35", text: "#e8f4fd", text2: "#6b9ab8", text3: "#2d5a78",
    border: "rgba(0,212,255,0.1)", border2: "rgba(0,212,255,0.18)",
    red: "#ff5252", yellow: "#ffd740", blue: "#00d4ff", orange: "#ff6e40", purple: "#b388ff",
  },
  slate: {
    name: "🩶 Slate Gray",
    bg: "#0f1117", surf: "#161b22", card: "#1c2128", card2: "#21262d",
    accent: "#58a6ff", accent2: "#1f4080", accentDim: "#58a6ff18",
    accentGlow: "#58a6ff35", text: "#e6edf3", text2: "#7d8590", text3: "#3d444d",
    border: "rgba(255,255,255,0.08)", border2: "rgba(255,255,255,0.15)",
    red: "#ff7b72", yellow: "#e3b341", blue: "#58a6ff", orange: "#ffa657", purple: "#d2a8ff",
  },
};

const ThemeCtx = createContext(null);
const useTheme = () => useContext(ThemeCtx);

/* ─── UTILS ─────────────────────────────────────────────────────────────────── */
const tod = () => new Date().toISOString().split("T")[0];
const fmt = d => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "—";
const past = d => d && d < tod();
const genNum = c => `RNC-${new Date().getFullYear()}-${String(c).padStart(3, "0")}`;

const SMETA = {
  "Aberta":              { c: "#ff4f6a", bg: "#ff4f6a18", dot: "#ff4f6a" },
  "Em andamento":        { c: "#ffd166", bg: "#ffd16618", dot: "#ffd166" },
  "Pendente verificação":{ c: "#4fc3f7", bg: "#4fc3f718", dot: "#4fc3f7" },
  "Eficaz":              { c: "#2ab84a", bg: "#2ab84a18", dot: "#2ab84a" },
  "Ineficaz":            { c: "#ff4f6a", bg: "#ff4f6a18", dot: "#ff4f6a" },
};
const SEVMETA = {
  "Crítica": { c: "#ff4f6a", bg: "#ff4f6a18" },
  "Maior":   { c: "#ff8c42", bg: "#ff8c4218" },
  "Menor":   { c: "#a78bfa", bg: "#a78bfa18" },
};
const TIPOC = {
  "Matéria-prima": "#4fc3f7", "Produto acabado": "#2ab84a",
  "Processo": "#ffd166", "Equipamento": "#ff8c42",
  "Documentação": "#a78bfa", "Ambiental": "#5dd4b0",
};

/* ─── STYLED HELPERS ─────────────────────────────────────────────────────────── */
function useS() {
  const T = useTheme();
  return {
    app: { fontFamily: "'DM Sans', system-ui, sans-serif", background: T.bg, color: T.text, minHeight: "100vh", fontSize: 14 },
    card: { background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "1.25rem", marginBottom: "1rem" },
    inp: { width: "100%", padding: "9px 12px", background: T.surf, border: `1px solid ${T.border2}`, borderRadius: 8, color: T.text, fontFamily: "inherit", fontSize: 13, outline: "none" },
    lbl: { fontSize: 12, color: T.text2, display: "block", marginBottom: 5, fontWeight: 500 },
    btn: { padding: "8px 18px", border: `1px solid ${T.border2}`, borderRadius: 8, background: T.surf, color: T.text2, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 500 },
    btnA: { padding: "9px 20px", border: `1px solid ${T.accent}33`, borderRadius: 8, background: T.accentDim, color: T.accent, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, boxShadow: `0 2px 12px ${T.accentDim}` },
    btnD: { padding: "7px 14px", border: "1px solid #ff4f6a22", borderRadius: 8, background: "#ff4f6a18", color: "#ff4f6a", cursor: "pointer", fontFamily: "inherit", fontSize: 12 },
  };
}

function F({ lbl, ch }) { const s = useS(); return <div style={{ marginBottom: 14 }}><label style={s.lbl}>{lbl}</label>{ch}</div>; }
function Inp({ sx, ...p }) { const s = useS(); return <input style={{ ...s.inp, ...sx }} {...p} />; }
function Sel({ sx, children, ...p }) { const s = useS(); return <select style={{ ...s.inp, ...sx }} {...p}>{children}</select>; }
function TA({ sx, ...p }) { const s = useS(); return <textarea style={{ ...s.inp, minHeight: 72, resize: "vertical", ...sx }} {...p} />; }
function G2({ ch }) { return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>{ch}</div>; }
function G3({ ch }) { return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>{ch}</div>; }
function Divider() { const T = useTheme(); return <div style={{ height: 1, background: T.border, margin: "1rem 0" }} />; }

function SecTitle({ icon, ch }) {
  const T = useTheme();
  return <div style={{ fontSize: 10, fontWeight: 700, color: T.text3, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: "1rem", display: "flex", alignItems: "center", gap: 6 }}>
    <span style={{ display: "block", width: 3, height: 13, background: `linear-gradient(to bottom,${T.accent},${T.accent2})`, borderRadius: 2 }} />
    {icon && <span>{icon}</span>}{ch}
  </div>;
}

function Badge({ s: status }) {
  const m = SMETA[status] || SMETA["Aberta"];
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, textTransform: "uppercase", background: m.bg, color: m.c }}>
    <span style={{ width: 5, height: 5, borderRadius: "50%", background: m.dot, display: "inline-block" }} />{status}
  </span>;
}
function SevB({ s }) { return <span style={{ display: "inline-flex", padding: "2px 9px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: SEVMETA[s]?.bg, color: SEVMETA[s]?.c, border: `1px solid ${SEVMETA[s]?.c}22` }}>{s}</span>; }

function Toast({ msg, color, onDone }) {
  const T = useTheme();
  const cols = { green: [T.accent, T.accentDim, T.accentGlow], red: ["#ff4f6a", "#ff4f6a18", "#ff4f6a30"], blue: [T.blue, "#4fc3f718", "#4fc3f730"] };
  const [c, bg, border] = cols[color] || cols.blue;
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, []);
  return <div style={{ position: "fixed", bottom: "1.5rem", right: "1.5rem", background: bg, color: c, border: `1px solid ${border}`, borderRadius: 14, padding: "12px 20px", fontSize: 13, fontWeight: 500, zIndex: 9999, boxShadow: "0 8px 32px #0008", fontFamily: "inherit", maxWidth: 340 }}>✓ {msg}</div>;
}

/* ─── HERBAMED LOGO SVG ─────────────────────────────────────────────────────── */
function HerbamedLogo({ size = 32, white = false }) {
  const color = white ? "#ffffff" : "#1a7a3c";
  return (
    <svg width={size * 3.2} height={size} viewBox="0 0 160 50" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(2,5)">
        <path d="M8 28 C4 20, 4 10, 10 6 C10 6, 8 18, 18 22 C14 24, 10 26, 8 28Z" fill={color} />
        <path d="M18 28 C22 18, 20 8, 14 4 C14 4, 20 14, 12 22 C14 24, 16 26, 18 28Z" fill={color} opacity="0.7" />
      </g>
      <text x="36" y="36" fontFamily="Georgia, serif" fontWeight="700" fontSize="22" fill={color} letterSpacing="1">HERBAMED</text>
      <text x="155" y="20" fontFamily="Georgia, serif" fontSize="10" fill={color}>®</text>
    </svg>
  );
}

/* ─── EMAIL BUILDER ──────────────────────────────────────────────────────────── */
function buildEmail(rnc, evento) {
  const sev = { Crítica: "🔴 CRÍTICA", Maior: "🟠 MAIOR", Menor: "🟡 MENOR" }[rnc.sev] || rnc.sev;
  const evLabel = {
    abertura: "NOVA NÃO CONFORMIDADE REGISTRADA",
    status: "ATUALIZAÇÃO DE STATUS",
    ishikawa: "ANÁLISE DE CAUSA CONCLUÍDA",
    "5w2h": "PLANO DE AÇÃO 5W2H ATUALIZADO",
    eficacia: "VERIFICAÇÃO DE EFICÁCIA REGISTRADA",
    manual: "NOTIFICAÇÃO DE NÃO CONFORMIDADE",
  }[evento] || "ATUALIZAÇÃO";
  const pfx = rnc.sev === "Crítica" ? "🔴 [CRÍTICO] " : rnc.sev === "Maior" ? "🟠 [IMPORTANTE] " : "🟡 ";
  const subject = `${pfx}${evLabel} | ${rnc.num} — ${rnc.produto || rnc.tipo}`;
  const body = `Prezado(a),

Este é um comunicado automático do Sistema de Gestão da Qualidade da Herbamed®.
Evento: ${evLabel}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 DADOS DA NÃO CONFORMIDADE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Número:           ${rnc.num}
Status:           ${rnc.status}
Severidade:       ${sev}
Tipo:             ${rnc.tipo}
Data abertura:    ${fmt(rnc.data)}
Produto/Material: ${rnc.produto || "—"}
Fornecedor:       ${rnc.fornecedor || "—"}
Lote:             ${rnc.lote || "—"}
Qtd. afetada:     ${rnc.qtd || "—"}
Setor:            ${rnc.setor || "—"}
Detectado por:    ${rnc.detector || "—"}
Responsável:      ${rnc.resp || "—"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 DESCRIÇÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${rnc.desc}
${rnc.ref ? `\nReferência: ${rnc.ref}` : ""}${rnc.evidencia ? `\nEvidências: ${rnc.evidencia}` : ""}
${rnc.contencao ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚡ AÇÃO DE CONTENÇÃO\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${rnc.contencao}\nResponsável: ${rnc.respCont || "—"} | Data: ${fmt(rnc.dataContencao)}` : ""}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🗓️ PRAZOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Análise de causa:     ${fmt(rnc.prazoCausa)}
Ação corretiva:       ${fmt(rnc.prazoAC)}${past(rnc.prazoAC) && rnc.status !== "Eficaz" ? " ⚠ VENCIDO" : ""}
Verificação eficácia: ${fmt(rnc.prazoEfic)}
${rnc.ishikawa?.root ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎯 CAUSA RAIZ\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${rnc.ishikawa.root}` : ""}${rnc.eficacia?.resultado ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ EFICÁCIA: ${rnc.eficacia.resultado.toUpperCase()}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${rnc.eficacia.obs || ""}` : ""}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Herbamed® · Sistema de Gestão da Qualidade
"Fornecendo Saúde. Cultivando Qualidade de Vida."`;
  return { subject, body };
}

/* ─── EMAIL MODAL ────────────────────────────────────────────────────────────── */
function EmailModal({ rnc, users, currentUser, evento, onClose, onSent }) {
  const T = useTheme(); const s = useS();
  const tpl = buildEmail(rnc, evento);
  const [to, setTo] = useState([]);
  const [subject, setSubject] = useState(tpl.subject);
  const [body, setBody] = useState(tpl.body);
  const [extra, setExtra] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [step, setStep] = useState(1);

  const toggle = email => setTo(p => p.includes(email) ? p.filter(x => x !== email) : [...p, email]);
  const addExtra = () => { if (!extra.includes("@")) return; setTo(p => [...new Set([...p, extra])]); setExtra(""); };

  const send = async () => {
    if (!to.length) { setErr("Selecione ao menos um destinatário."); return; }
    setSending(true); setErr("");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 500,
          mcp_servers: [{ type: "url", url: "https://gmailmcp.googleapis.com/mcp/v1", name: "gmail" }],
          messages: [{ role: "user", content: `Send this email via Gmail:\nTO: ${to.join(", ")}\nSUBJECT: ${subject}\nBODY:\n${body}\n\nReply only: SENT_OK` }]
        })
      });
      const data = await res.json();
      const txt = data.content?.map(b => b.text || "").join("") || "";
      if (txt.includes("SENT_OK") || txt.toLowerCase().includes("sent")) {
        onSent(`E-mail enviado para ${to.length} destinatário(s)!`);
      } else setErr("Não foi possível confirmar o envio. Tente novamente.");
    } catch (e) { setErr("Erro: " + e.message); }
    setSending(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", backdropFilter: "blur(8px)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div style={{ background: T.card2, border: `1px solid ${T.border2}`, borderRadius: 18, width: "100%", maxWidth: 740, maxHeight: "92vh", overflowY: "auto", boxShadow: `0 40px 100px #000d, 0 0 60px ${T.accentGlow}` }}>
        <div style={{ padding: "1.25rem 1.75rem", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: T.accentDim, border: `1px solid ${T.accent}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>✉️</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Notificar por e-mail</div>
              <div style={{ fontSize: 11, color: T.text2, marginTop: 2 }}>{rnc.num} · {rnc.produto || rnc.tipo}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            {[1, 2].map(n => (
              <div key={n} style={{ display: "flex", alignItems: "center", gap: 6, cursor: n < step ? "pointer" : "default" }} onClick={() => n < step && setStep(n)}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", background: step === n ? `linear-gradient(135deg,${T.accent},${T.accent2})` : step > n ? T.accentDim : T.border, color: step === n ? "#fff" : step > n ? T.accent : T.text3, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{step > n ? "✓" : n}</div>
                <span style={{ fontSize: 11, color: step === n ? T.text : T.text3, fontWeight: step === n ? 600 : 400 }}>{n === 1 ? "Destinatários" : "E-mail"}</span>
                {n < 2 && <span style={{ color: T.text3 }}>›</span>}
              </div>
            ))}
            <button onClick={onClose} style={{ background: T.border, border: "none", color: T.text2, cursor: "pointer", borderRadius: 8, padding: "6px 12px", fontSize: 16, fontFamily: "inherit" }}>✕</button>
          </div>
        </div>

        <div style={{ padding: "1.5rem 1.75rem" }}>
          {step === 1 && (
            <>
              <SecTitle icon="👥" ch="Quem deve receber?" />
              <div style={{ ...s.card, padding: "1rem", marginBottom: "1rem" }}>
                <div style={{ fontSize: 11, color: T.text3, marginBottom: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>Usuários do sistema</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {users.map(u => (
                    <button key={u.email} onClick={() => toggle(u.email)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 20, border: `1px solid ${to.includes(u.email) ? T.accent + "55" : T.border2}`, background: to.includes(u.email) ? T.accentDim : T.surf, color: to.includes(u.email) ? T.accent : T.text2, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 500 }}>
                      <div style={{ width: 26, height: 26, borderRadius: "50%", background: to.includes(u.email) ? `linear-gradient(135deg,${T.accent},${T.accent2})` : T.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: to.includes(u.email) ? "#fff" : T.text2, flexShrink: 0 }}>{u.name?.[0] || "?"}</div>
                      <div style={{ textAlign: "left" }}>
                        <div style={{ lineHeight: 1.2 }}>{u.name}</div>
                        <div style={{ fontSize: 10, color: T.text3 }}>{u.setor}</div>
                      </div>
                      {to.includes(u.email) && <span style={{ color: T.accent }}>✓</span>}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ ...s.card, padding: "1rem", marginBottom: "1rem" }}>
                <div style={{ fontSize: 11, color: T.text3, marginBottom: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>E-mail externo</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Inp placeholder="email@empresa.com.br" value={extra} onChange={e => setExtra(e.target.value)} onKeyDown={e => e.key === "Enter" && addExtra()} sx={{ flex: 1 }} />
                  <button style={{ ...s.btn, padding: "8px 14px" }} onClick={addExtra}>+ Adicionar</button>
                </div>
              </div>
              <div style={{ background: to.length ? T.accentDim : T.border, border: `1px solid ${to.length ? T.accent + "33" : T.border}`, borderRadius: 8, padding: "10px 14px", marginBottom: "1rem", fontSize: 12, color: to.length ? T.accent : T.text3 }}>
                {to.length ? `✓ ${to.length} destinatário(s): ${to.join(", ")}` : "Nenhum destinatário selecionado."}
              </div>
              {err && <div style={{ background: "#ff4f6a18", border: "1px solid #ff4f6a30", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#ff4f6a", marginBottom: 12 }}>{err}</div>}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button style={s.btn} onClick={onClose}>Cancelar</button>
                <button style={{ ...s.btnA, opacity: to.length ? 1 : .4 }} onClick={() => { if (!to.length) { setErr("Selecione ao menos um."); return; } setErr(""); setStep(2); }}>Revisar e-mail →</button>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <div style={{ background: T.accentDim, border: `1px solid ${T.accent}25`, borderRadius: 8, padding: "10px 14px", marginBottom: "1rem", fontSize: 12, color: T.accent }}>
                💡 E-mail será enviado via <b>Gmail</b>. Edite antes de enviar se necessário.
              </div>
              <div style={{ ...s.card, padding: "1rem", marginBottom: "1rem", fontSize: 12, color: T.text2 }}>
                <span style={{ color: T.text3, fontWeight: 600 }}>Para: </span>
                {to.map(e => <span key={e} style={{ background: T.accentDim, border: `1px solid ${T.accent}25`, borderRadius: 20, padding: "2px 9px", marginRight: 4, color: T.accent }}>{e}</span>)}
              </div>
              <F lbl="Assunto" ch={<Inp value={subject} onChange={e => setSubject(e.target.value)} sx={{ fontWeight: 500 }} />} />
              <F lbl="Corpo do e-mail" ch={<textarea value={body} onChange={e => setBody(e.target.value)} style={{ ...s.inp, minHeight: 320, fontFamily: "monospace", fontSize: 12, lineHeight: 1.75, resize: "vertical" }} />} />
              {err && <div style={{ background: "#ff4f6a18", border: "1px solid #ff4f6a30", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#ff4f6a", marginBottom: 12 }}>{err}</div>}
              <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
                <button style={s.btn} onClick={() => setStep(1)}>← Destinatários</button>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={s.btn} onClick={onClose}>Cancelar</button>
                  <button style={{ ...s.btnA, opacity: sending ? .6 : 1, minWidth: 150, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={send} disabled={sending}>
                    {sending ? <><span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span> Enviando...</> : "✉️ Enviar agora"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

/* ─── THEME PICKER ───────────────────────────────────────────────────────────── */
function ThemePicker({ current, onChange }) {
  const T = useTheme(); const s = useS();
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button style={{ ...s.btn, padding: "6px 12px", fontSize: 11, display: "flex", alignItems: "center", gap: 6 }} onClick={() => setOpen(o => !o)}>
        🎨 {THEMES[current].name}
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", background: T.card2, border: `1px solid ${T.border2}`, borderRadius: 12, padding: 8, zIndex: 500, minWidth: 200, boxShadow: "0 16px 48px #0008" }}>
          {Object.entries(THEMES).map(([key, th]) => (
            <button key={key} onClick={() => { onChange(key); setOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", border: "none", background: current === key ? T.accentDim : "transparent", color: current === key ? T.accent : T.text2, cursor: "pointer", fontFamily: "inherit", fontSize: 12, borderRadius: 8, fontWeight: current === key ? 600 : 400 }}>
              <span style={{ width: 12, height: 12, borderRadius: "50%", background: th.accent, display: "inline-block", boxShadow: `0 0 6px ${th.accent}` }} />
              {th.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── LOGIN ──────────────────────────────────────────────────────────────────── */
function Login({ onLogin }) {
  const T = useTheme(); const s = useS();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const login = async () => {
    if (!email || !pw) { setErr("Preencha e-mail e senha."); return; }
    setLoading(true); setErr("");
    try {
      const cred = await loginUser(email, pw);
      const userData = await getUser(cred.user.uid);
      if (userData) onLogin({ ...userData, uid: cred.user.uid });
      else setErr("Usuário não encontrado no sistema.");
    } catch { setErr("E-mail ou senha incorretos."); }
    setLoading(false);
  };
  return (
    <div style={{ ...s.app, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: `radial-gradient(ellipse at 30% 40%, ${T.accentDim} 0%, ${T.bg} 60%)` }}>
      <div style={{ width: "100%", maxWidth: 420, padding: "0 1rem" }}>
        {/* Logo area */}
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})`, borderRadius: 20, padding: "16px 28px", marginBottom: "1.25rem", boxShadow: `0 0 40px ${T.accentGlow}` }}>
            <HerbamedLogo size={28} white />
          </div>
          <div style={{ fontSize: 13, color: T.text2, fontStyle: "italic" }}>Fornecendo Saúde. Cultivando Qualidade de Vida.</div>
          <div style={{ fontSize: 11, color: T.text3, marginTop: 6 }}>Sistema de Registro de Não Conformidades</div>
        </div>
        <div style={{ ...s.card, background: `linear-gradient(160deg,${T.card},${T.card2})`, boxShadow: `0 0 40px ${T.accentDim}, 0 24px 60px #0008` }}>
          <SecTitle ch="Acesso ao sistema" />
          <F lbl="E-mail" ch={<Inp type="email" placeholder="seu@herbamed.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && login()} />} />
          <F lbl="Senha" ch={<Inp type="password" placeholder="••••••••" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === "Enter" && login()} />} />
          {err && <div style={{ background: "#ff4f6a18", border: "1px solid #ff4f6a30", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#ff4f6a", marginBottom: 14 }}>{err}</div>}
          <button style={{ ...s.btnA, width: "100%", padding: "11px", fontSize: 13, opacity: loading ? .7 : 1 }} onClick={login} disabled={loading}>
            {loading ? "Entrando..." : "Entrar →"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── MAIN APP ───────────────────────────────────────────────────────────────── */
export default function App() {
  const [themeKey, setThemeKey] = useState(() => localStorage.getItem("hm_theme") || "herbamed");
  const T = THEMES[themeKey];
  const changeTheme = key => { setThemeKey(key); localStorage.setItem("hm_theme", key); };

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tab, setTab] = useState("lista");
  const [rncs, setRncs] = useState([]);
  const [users, setUsers] = useState([]);
  const [toast, setToast] = useState(null);
  const [emailCtx, setEmailCtx] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async fbUser => {
      if (fbUser) {
        const ud = await getUser(fbUser.uid);
        if (ud) setUser({ ...ud, uid: fbUser.uid });
        else setUser(null);
      } else setUser(null);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeRNCs(setRncs);
    getAllUsers().then(setUsers);
    return unsub;
  }, [user]);

  const toast_ = useCallback((msg, color = "green") => setToast({ msg, color, key: Date.now() }), []);
  const openEmail = useCallback((rnc, evento) => setEmailCtx({ rnc, evento }), []);

  const doSaveRNC = useCallback(async (rnc) => { await saveRNC(rnc.id, rnc); }, []);
  const doUpdateRNC = useCallback(async (id, data) => { await updateRNC(id, data); }, []);
  const doDeleteRNC = useCallback(async (id) => { await fbDeleteRNC(id); }, []);

  if (authLoading) return (
    <ThemeCtx.Provider value={T}>
      <div style={{ background: T.bg, color: T.text, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 48, height: 48, border: `3px solid ${T.accent}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 1rem" }} />
          <div style={{ color: T.text2, fontSize: 13 }}>Carregando sistema...</div>
        </div>
        <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      </div>
    </ThemeCtx.Provider>
  );

  if (!user) return <ThemeCtx.Provider value={T}><Login onLogin={setUser} /></ThemeCtx.Provider>;

  const TABS = [
    ["lista", "📋 Registros"], ["nova", "+ Nova RNC"],
    ["ishikawa", "🐟 Ishikawa / 5 Porquês"], ["5w2h", "📌 5W2H"],
    ["eficacia", "✅ Eficácia"], ["dashboard", "📊 Dashboard"],
    ...(user.role === "admin" ? [["admin", "⚙️ Admin"]] : []),
  ];

  return (
    <ThemeCtx.Provider value={T}>
      <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: T.bg, color: T.text, minHeight: "100vh", fontSize: 14 }}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

        {/* HEADER */}
        <div style={{ background: `linear-gradient(135deg, ${T.surf} 0%, ${T.card} 100%)`, borderBottom: `1px solid ${T.border2}`, padding: "0 1.75rem", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 100, backdropFilter: "blur(12px)", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ background: `linear-gradient(135deg,${T.accent},${T.accent2})`, borderRadius: 10, padding: "6px 12px", boxShadow: `0 0 16px ${T.accentGlow}` }}>
              <HerbamedLogo size={22} white />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>Registro de Não Conformidades</div>
              <div style={{ fontSize: 10, color: T.text3 }}>Gestão da Qualidade · Herbamed®</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            {[["Total", rncs.length, T.accent], ["Abertas", rncs.filter(x => x.status === "Aberta").length, "#ff4f6a"], ["Eficazes", rncs.filter(x => x.status === "Eficaz").length, T.accent]].map(([l, n, c]) => (
              <div key={l} style={{ textAlign: "right" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: c, lineHeight: 1 }}>{n}</div>
                <div style={{ fontSize: 9, color: T.text3, textTransform: "uppercase", letterSpacing: ".06em" }}>{l}</div>
              </div>
            ))}
            <div style={{ width: 1, height: 28, background: T.border }} />
            <ThemePicker current={themeKey} onChange={changeTheme} />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{user.name}</div>
              <div style={{ fontSize: 10, color: T.text3 }}>{user.setor} · {user.role === "admin" ? <span style={{ color: T.accent }}>Admin</span> : "Usuário"}</div>
            </div>
            <button style={{ background: "#ff4f6a18", border: "1px solid #ff4f6a22", borderRadius: 8, color: "#ff4f6a", cursor: "pointer", fontFamily: "inherit", fontSize: 11, padding: "6px 12px" }} onClick={() => { logoutUser(); setUser(null); }}>Sair</button>
          </div>
        </div>

        <div style={{ maxWidth: 980, margin: "0 auto", padding: "1.5rem" }}>
          {/* TABS */}
          <div style={{ display: "flex", gap: 2, background: T.surf, border: `1px solid ${T.border}`, borderRadius: 14, padding: 4, marginBottom: "1.5rem", flexWrap: "wrap" }}>
            {TABS.map(([t, l]) => (
              <button key={t} onClick={() => setTab(t)} style={{ padding: "8px 16px", border: "none", background: tab === t ? T.accentDim : "transparent", color: tab === t ? T.accent : T.text2, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: tab === t ? 600 : 400, borderRadius: 10, boxShadow: tab === t ? `0 0 12px ${T.accentGlow}` : "none", transition: "all .2s", border: tab === t ? `1px solid ${T.accent}33` : "1px solid transparent" }}>{l}</button>
            ))}
          </div>

          {tab === "lista"     && <ListaTab rncs={rncs} user={user} users={users} toast_={toast_} setTab={setTab} openEmail={openEmail} doUpdateRNC={doUpdateRNC} doDeleteRNC={doDeleteRNC} />}
          {tab === "nova"      && <NovaTab rncs={rncs} user={user} toast_={toast_} setTab={setTab} openEmail={openEmail} doSaveRNC={doSaveRNC} />}
          {tab === "ishikawa"  && <IshikawaTab rncs={rncs} toast_={toast_} openEmail={openEmail} doUpdateRNC={doUpdateRNC} />}
          {tab === "5w2h"      && <W2HTab rncs={rncs} user={user} toast_={toast_} openEmail={openEmail} doUpdateRNC={doUpdateRNC} />}
          {tab === "eficacia"  && <EficaciaTab rncs={rncs} toast_={toast_} openEmail={openEmail} doUpdateRNC={doUpdateRNC} />}
          {tab === "dashboard" && <DashTab rncs={rncs} />}
          {tab === "admin" && user.role === "admin" && <AdminTab users={users} setUsers={setUsers} toast_={toast_} currentUser={user} />}
        </div>

        {emailCtx && <EmailModal rnc={emailCtx.rnc} users={users} currentUser={user} evento={emailCtx.evento} onClose={() => setEmailCtx(null)} onSent={msg => { toast_(msg, "green"); setEmailCtx(null); }} />}
        {toast && <Toast key={toast.key} msg={toast.msg} color={toast.color} onDone={() => setToast(null)} />}
      </div>
    </ThemeCtx.Provider>
  );
}

/* ─── LISTA TAB ──────────────────────────────────────────────────────────────── */
function ListaTab({ rncs, user, users, toast_, setTab, openEmail, doUpdateRNC, doDeleteRNC }) {
  const T = useTheme(); const s = useS();
  const [q, setQ] = useState(""); const [fSt, setFSt] = useState(""); const [fTp, setFTp] = useState(""); const [sel, setSel] = useState(null);
  const list = rncs.filter(r => (!q || [r.desc, r.produto, r.num, r.fornecedor].some(x => x?.toLowerCase().includes(q.toLowerCase()))) && (!fSt || r.status === fSt) && (!fTp || r.tipo === fTp));
  const updStatus = async (id, status) => {
    const h = { data: tod(), acao: `Status → ${status}`, resp: user.name };
    await doUpdateRNC(id, { status, historico: [...(sel?.historico || []), h] });
    setSel(p => p ? { ...p, status, historico: [...(p.historico || []), h] } : null);
    toast_("Status atualizado!", "green");
    const updated = { ...rncs.find(r => r.id === id), status, historico: [...(rncs.find(r => r.id === id)?.historico || []), h] };
    openEmail(updated, "status");
  };
  const del = async id => {
    if (!confirm("Excluir esta RNC permanentemente?")) return;
    await doDeleteRNC(id); setSel(null); toast_("RNC excluída.", "red");
  };
  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: "1.25rem", flexWrap: "wrap" }}>
        <Inp placeholder="🔍 Buscar descrição, produto, lote..." value={q} onChange={e => setQ(e.target.value)} sx={{ flex: 1, minWidth: 220 }} />
        <Sel value={fSt} onChange={e => setFSt(e.target.value)} sx={{ width: "auto", minWidth: 165 }}>
          <option value="">Todos os status</option>{Object.keys(SMETA).map(x => <option key={x}>{x}</option>)}
        </Sel>
        <Sel value={fTp} onChange={e => setFTp(e.target.value)} sx={{ width: "auto", minWidth: 155 }}>
          <option value="">Todos os tipos</option>{Object.keys(TIPOC).map(x => <option key={x}>{x}</option>)}
        </Sel>
        <button style={s.btnA} onClick={() => setTab("nova")}>+ Nova RNC</button>
      </div>
      {list.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem 2rem", color: T.text3 }}>
          <div style={{ fontSize: 48, marginBottom: "1rem", opacity: .3 }}>📋</div>
          <div style={{ fontSize: 14, color: T.text2, marginBottom: 6 }}>Nenhuma RNC encontrada</div>
          <div style={{ fontSize: 12 }}>Clique em "+ Nova RNC" para começar.</div>
        </div>
      ) : list.map(r => (
        <div key={r.id} onClick={() => setSel(r)} style={{ background: T.card, border: `1px solid ${T.border}`, borderLeft: `3px solid ${SMETA[r.status]?.dot || T.accent}`, borderRadius: 14, padding: "1rem 1.25rem", marginBottom: ".75rem", cursor: "pointer", transition: "all .2s" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.accent, letterSpacing: ".06em" }}>{r.num}</span>
            <div style={{ display: "flex", gap: 8 }}><SevB s={r.sev} /><Badge s={r.status} /></div>
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{r.desc?.substring(0, 95)}{r.desc?.length > 95 ? "..." : ""}</div>
          <div style={{ fontSize: 11, color: T.text2 }}>{r.tipo} · {r.produto || "—"} · {fmt(r.data)} · {r.resp || "—"}{past(r.prazoAC) && r.status !== "Eficaz" && r.status !== "Ineficaz" ? <span style={{ color: "#ff4f6a", fontWeight: 600 }}> ⚠ PRAZO VENCIDO</span> : ""}</div>
        </div>
      ))}

      {sel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.82)", backdropFilter: "blur(6px)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }} onClick={e => e.target === e.currentTarget && setSel(null)}>
          <div style={{ background: T.card2, border: `1px solid ${T.border2}`, borderRadius: 18, padding: "1.75rem", maxWidth: 720, width: "100%", maxHeight: "88vh", overflowY: "auto", boxShadow: "0 32px 80px #000a" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
              <div><div style={{ fontSize: 22, fontWeight: 700 }}>{sel.num}</div><div style={{ fontSize: 12, color: T.text2, marginTop: 2 }}>{sel.tipo} · {fmt(sel.data)} · {sel.detector || "—"}</div></div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}><SevB s={sel.sev} /><Badge s={sel.status} /><button onClick={() => setSel(null)} style={{ background: T.border, border: "none", color: T.text2, cursor: "pointer", borderRadius: 8, padding: "6px 10px", fontSize: 16, fontFamily: "inherit" }}>✕</button></div>
            </div>
            <div style={{ background: T.surf, borderRadius: 10, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: T.text3, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>Descrição</div>
              <div style={{ fontSize: 14, lineHeight: 1.6 }}>{sel.desc}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              {[["Produto", sel.produto], ["Fornecedor", sel.fornecedor], ["Lote", sel.lote], ["Qtd.", sel.qtd], ["Responsável", sel.resp], ["Prazo AC", fmt(sel.prazoAC)], ["Prazo Eficácia", fmt(sel.prazoEfic)], ["Evidências", sel.evidencia]].filter(([, v]) => v).map(([k, v]) => (
                <div key={k} style={{ background: T.surf, borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontSize: 10, color: T.text3, textTransform: "uppercase", fontWeight: 700, marginBottom: 3 }}>{k}</div>
                  <div style={{ fontSize: 13 }}>{v}</div>
                </div>
              ))}
            </div>
            {sel.contencao && <div style={{ background: "#ff8c4212", border: "1px solid #ff8c4230", borderRadius: 10, padding: 14, marginBottom: 14 }}><div style={{ fontSize: 10, color: "#ff8c42", fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>⚡ Contenção</div><div style={{ fontSize: 13 }}>{sel.contencao}</div></div>}
            {sel.ishikawa?.root && <div style={{ background: T.accentDim, border: `1px solid ${T.accent}30`, borderRadius: 10, padding: 14, marginBottom: 14 }}><div style={{ fontSize: 10, color: T.accent, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>🎯 Causa raiz</div><div style={{ fontSize: 13, fontWeight: 500 }}>{sel.ishikawa.root}</div></div>}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: T.text3, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Alterar status</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {Object.keys(SMETA).map(st => <button key={st} onClick={() => updStatus(sel.id, st)} style={{ padding: "6px 12px", borderRadius: 20, border: `1px solid ${sel.status === st ? SMETA[st].c + "55" : T.border}`, background: sel.status === st ? SMETA[st].bg : T.surf, color: sel.status === st ? SMETA[st].c : T.text2, cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600 }}>{st}</button>)}
              </div>
            </div>
            {sel.historico?.length > 0 && (
              <div>
                <div style={{ fontSize: 10, color: T.text3, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Histórico</div>
                <div style={{ borderLeft: `2px solid ${T.border2}`, paddingLeft: "1.25rem", marginLeft: ".5rem" }}>
                  {[...sel.historico].reverse().map((h, i) => (
                    <div key={i} style={{ position: "relative", marginBottom: 10, padding: "8px 12px", background: T.surf, border: `1px solid ${T.border}`, borderRadius: 8 }}>
                      <div style={{ position: "absolute", left: "-1.6rem", top: "1rem", width: 8, height: 8, borderRadius: "50%", background: T.accent, border: `2px solid ${T.bg}` }} />
                      <div style={{ fontSize: 10, color: T.text3, marginBottom: 2 }}>{fmt(h.data)} · {h.resp}</div>
                      <div style={{ fontSize: 13 }}>{h.acao}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: "1.25rem", borderTop: `1px solid ${T.border}`, paddingTop: "1rem" }}>
              {user?.role === "admin" && <button style={s.btnD} onClick={() => del(sel.id)}>Excluir</button>}
              <button style={{ ...s.btn, color: T.accent, borderColor: T.accent + "33", background: T.accentDim, display: "flex", alignItems: "center", gap: 6 }} onClick={() => openEmail(sel, "manual")}>✉️ Notificar</button>
              <button style={s.btn} onClick={() => setSel(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── NOVA TAB ───────────────────────────────────────────────────────────────── */
function NovaTab({ user, toast_, setTab, openEmail, doSaveRNC }) {
  const s = useS();
  const [f, setF] = useState({ data: tod(), status: "Aberta", tipo: "Matéria-prima", sev: "Maior", produto: "", fornecedor: "", setor: user.setor || "", detector: user.name, desc: "", lote: "", qtd: "", ref: "", evidencia: "", contencao: "", respCont: "", dataContencao: "", resp: user.name, prazoCausa: "", prazoAC: "", prazoEfic: "" });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const salvar = async () => {
    if (!f.desc.trim()) { alert("Preencha a descrição."); return; }
    const nc = await incrementCounter();
    const rnc = { id: String(Date.now()), num: genNum(nc), ...f, ishikawa: { efeito: "", causes: { mao: [], maquina: [], metodo: [], material: [], medicao: [], meioamb: [] }, whys: [], root: "", whyCausa: "" }, w2h: [], eficacia: { criterio: "", data: "", resp: "", evidencias: "", resultado: "", obs: "" }, historico: [{ data: tod(), acao: "RNC aberta", resp: user.name }], criadoPor: user.name, createdAt: Date.now() };
    await doSaveRNC(rnc);
    toast_(`${rnc.num} registrada!`, "green");
    openEmail(rnc, "abertura");
    setTab("lista");
  };
  return (
    <div>
      <div style={{ ...s.card }}>
        <SecTitle icon="🪪" ch="Identificação" />
        <G3 ch={<><F lbl="Data de abertura" ch={<Inp type="date" value={f.data} onChange={e => set("data", e.target.value)} />} /><F lbl="Status" ch={<Sel value={f.status} onChange={e => set("status", e.target.value)}>{Object.keys(SMETA).map(x => <option key={x}>{x}</option>)}</Sel>} /><F lbl="Severidade" ch={<Sel value={f.sev} onChange={e => set("sev", e.target.value)}>{Object.keys(SEVMETA).map(x => <option key={x}>{x}</option>)}</Sel>} /></>} />
        <G3 ch={<><F lbl="Tipo" ch={<Sel value={f.tipo} onChange={e => set("tipo", e.target.value)}>{Object.keys(TIPOC).map(x => <option key={x}>{x}</option>)}</Sel>} /><F lbl="Setor" ch={<Inp value={f.setor} onChange={e => set("setor", e.target.value)} />} /><F lbl="Detectado por" ch={<Inp value={f.detector} onChange={e => set("detector", e.target.value)} />} /></>} />
        <G2 ch={<><F lbl="Produto / Material" ch={<Inp placeholder="Ex: Psyllium em pó — Lote 2025-047" value={f.produto} onChange={e => set("produto", e.target.value)} />} /><F lbl="Fornecedor" ch={<Inp placeholder="Ex: R&E Importadora" value={f.fornecedor} onChange={e => set("fornecedor", e.target.value)} />} /></>} />
      </div>
      <div style={s.card}>
        <SecTitle icon="📝" ch="Descrição" />
        <F lbl="Descrição da não conformidade" ch={<TA rows={4} placeholder="O que foi observado, onde, quando e qual o impacto..." value={f.desc} onChange={e => set("desc", e.target.value)} />} />
        <G3 ch={<><F lbl="Nº do lote" ch={<Inp value={f.lote} onChange={e => set("lote", e.target.value)} />} /><F lbl="Quantidade afetada" ch={<Inp value={f.qtd} onChange={e => set("qtd", e.target.value)} />} /><F lbl="Referência normativa" ch={<Inp value={f.ref} onChange={e => set("ref", e.target.value)} />} /></>} />
        <F lbl="Evidências" ch={<Inp value={f.evidencia} onChange={e => set("evidencia", e.target.value)} />} />
      </div>
      <div style={s.card}>
        <SecTitle icon="⚡" ch="Ação de contenção" />
        <F lbl="Ação realizada" ch={<TA rows={3} value={f.contencao} onChange={e => set("contencao", e.target.value)} />} />
        <G2 ch={<><F lbl="Responsável" ch={<Inp value={f.respCont} onChange={e => set("respCont", e.target.value)} />} /><F lbl="Data" ch={<Inp type="date" value={f.dataContencao} onChange={e => set("dataContencao", e.target.value)} />} /></>} />
      </div>
      <div style={s.card}>
        <SecTitle icon="🗓️" ch="Prazos e responsabilidades" />
        <G3 ch={<><F lbl="Responsável pela análise" ch={<Inp value={f.resp} onChange={e => set("resp", e.target.value)} />} /><F lbl="Prazo — análise de causa" ch={<Inp type="date" value={f.prazoCausa} onChange={e => set("prazoCausa", e.target.value)} />} /><F lbl="Prazo — ação corretiva" ch={<Inp type="date" value={f.prazoAC} onChange={e => set("prazoAC", e.target.value)} />} /></>} />
        <F lbl="Prazo — verificação de eficácia" ch={<Inp type="date" value={f.prazoEfic} onChange={e => set("prazoEfic", e.target.value)} sx={{ maxWidth: 300 }} />} />
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingBottom: ".5rem" }}>
        <button style={s.btn} onClick={() => setTab("lista")}>Cancelar</button>
        <button style={s.btnA} onClick={salvar}>Salvar RNC →</button>
      </div>
    </div>
  );
}

/* ─── ISHIKAWA TAB ───────────────────────────────────────────────────────────── */
function IshikawaTab({ rncs, toast_, openEmail, doUpdateRNC }) {
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
  const saveI = async () => { if (!r) return; const ishi = { ...r.ishikawa, efeito, causes }; await doUpdateRNC(r.id, { ishikawa: ishi, historico: [...(r.historico || []), { data: tod(), acao: "Ishikawa atualizado", resp: "—" }] }); toast_("Ishikawa salvo!", "green"); openEmail({ ...r, ishikawa: ishi }, "ishikawa"); };
  const saveW = async () => { if (!r) return; const ishi = { ...r.ishikawa, whys, root, whyCausa: wCausa }; await doUpdateRNC(r.id, { ishikawa: ishi, historico: [...(r.historico || []), { data: tod(), acao: "5 Porquês atualizado", resp: "—" }] }); toast_("5 Porquês salvos!", "green"); openEmail({ ...r, ishikawa: ishi }, "ishikawa"); };
  const CATS = [["mao", "👤 Mão de obra", T.blue], ["maquina", "⚙️ Máquina", T.orange], ["metodo", "📋 Método", T.accent], ["material", "📦 Material", T.yellow], ["medicao", "📏 Medição", T.purple], ["meioamb", "🌿 Meio ambiente", "#5dd4b0"]];
  return (
    <div>
      <div style={s.card}><SecTitle ch="Selecionar RNC" /><Sel value={sid} onChange={e => setSid(e.target.value)} sx={{ fontSize: 14, padding: "10px 14px" }}><option value="">— Selecione uma RNC —</option>{rncs.map(r => <option key={r.id} value={r.id}>{r.num} — {r.desc?.substring(0, 55)}</option>)}</Sel></div>
      {r && <>
        <div style={s.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}><SecTitle icon="🐟" ch="Diagrama de Ishikawa — 6M" /><span style={{ fontSize: 11, color: T.text3 }}>Clique em uma causa → usar nos 5 Porquês</span></div>
          <F lbl="Efeito / Problema central" ch={<Inp value={efeito} onChange={e => setEfeito(e.target.value)} sx={{ fontSize: 15, fontWeight: 500, color: T.orange }} />} />
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
          <F lbl="Causa a aprofundar" ch={<Inp value={wCausa} onChange={e => setWCausa(e.target.value)} sx={{ color: T.yellow, fontWeight: 500 }} />} />
          {["Por quê ocorreu?", "Por quê isso aconteceu?", "Por quê essa causa existe?", "Por quê não foi controlado?", "Por quê não foi evitado?"].map((q, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ minWidth: 30, height: 30, borderRadius: "50%", background: `linear-gradient(135deg,${T.accent},${T.accent2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: "#fff", flexShrink: 0, boxShadow: `0 0 10px ${T.accentGlow}` }}>{i + 1}</div>
              <Inp placeholder={q} value={whys[i]} onChange={e => { const n = [...whys]; n[i] = e.target.value; setWhys(n); }} sx={{ flex: 1 }} />
              {i < 4 && <span style={{ color: T.text3, fontSize: 18 }}>↓</span>}
            </div>
          ))}
          <Divider />
          <F lbl="🎯 Causa raiz identificada" ch={<TA rows={2} value={root} onChange={e => setRoot(e.target.value)} sx={{ borderColor: T.accent, color: T.accent }} placeholder="Conclusão: a causa raiz é..." />} />
          <div style={{ textAlign: "right" }}><button style={s.btnA} onClick={saveW}>Salvar análise →</button></div>
        </div>
      </>}
    </div>
  );
}

/* ─── 5W2H TAB ───────────────────────────────────────────────────────────────── */
function W2HTab({ rncs, user, toast_, openEmail, doUpdateRNC }) {
  const T = useTheme(); const s = useS();
  const [sid, setSid] = useState(""); const [acts, setActs] = useState([]);
  const r = rncs.find(x => x.id === sid);
  useEffect(() => { if (!r) return; setActs(JSON.parse(JSON.stringify(r.w2h || []))); }, [sid]);
  const add = () => setActs(p => [...p, { what: "", why: "", who: user.name, where: "", when: "", how: "", howMuch: "", status: "Pendente" }]);
  const upd = (i, k, v) => setActs(p => p.map((a, j) => j === i ? { ...a, [k]: v } : a));
  const del = i => setActs(p => p.filter((_, j) => j !== i));
  const save = async () => { if (!r) return; await doUpdateRNC(r.id, { w2h: acts, historico: [...(r.historico || []), { data: tod(), acao: `5W2H — ${acts.length} ação(ões)`, resp: user.name }] }); toast_("5W2H salvo!", "green"); openEmail({ ...r, w2h: acts }, "5w2h"); };
  const sc = { "Pendente": T.yellow, "Em andamento": T.blue, "Concluída": T.accent, "Cancelada": "#ff4f6a" };
  return (
    <div>
      <div style={s.card}><SecTitle ch="Selecionar RNC" /><Sel value={sid} onChange={e => setSid(e.target.value)} sx={{ fontSize: 14, padding: "10px 14px" }}><option value="">— Selecione uma RNC —</option>{rncs.map(r => <option key={r.id} value={r.id}>{r.num} — {r.desc?.substring(0, 55)}</option>)}</Sel></div>
      {r && <div style={s.card}>
        <SecTitle icon="📌" ch="Plano de ação 5W2H" />
        {acts.length === 0 && <div style={{ textAlign: "center", padding: "1.5rem", color: T.text3, fontSize: 13, border: `1px dashed ${T.border2}`, borderRadius: 10 }}>Nenhuma ação. Clique em "+ Adicionar".</div>}
        {acts.map((a, i) => (
          <div key={i} style={{ background: T.surf, border: `1px solid ${T.border}`, borderRadius: 8, padding: "1rem", marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.accent, textTransform: "uppercase" }}>Ação #{i + 1}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <select value={a.status} onChange={e => upd(i, "status", e.target.value)} style={{ ...s.inp, width: "auto", minWidth: 130, fontSize: 11, padding: "4px 8px", color: sc[a.status] || T.text }}>{["Pendente", "Em andamento", "Concluída", "Cancelada"].map(x => <option key={x}>{x}</option>)}</select>
                <button style={s.btnD} onClick={() => del(i)}>✕ Remover</button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <F lbl="O quê?" ch={<Inp placeholder="Ação a executar" value={a.what} onChange={e => upd(i, "what", e.target.value)} />} />
              <F lbl="Por quê?" ch={<Inp placeholder="Justificativa" value={a.why} onChange={e => upd(i, "why", e.target.value)} />} />
              <F lbl="Quem?" ch={<Inp value={a.who} onChange={e => upd(i, "who", e.target.value)} />} />
              <F lbl="Onde?" ch={<Inp value={a.where} onChange={e => upd(i, "where", e.target.value)} />} />
              <F lbl="Quando?" ch={<Inp type="date" value={a.when} onChange={e => upd(i, "when", e.target.value)} />} />
              <F lbl="Custo/Esforço" ch={<Inp value={a.howMuch} onChange={e => upd(i, "howMuch", e.target.value)} />} />
              <div style={{ gridColumn: "span 2" }}><F lbl="Como?" ch={<TA rows={2} value={a.how} onChange={e => upd(i, "how", e.target.value)} />} /></div>
            </div>
          </div>
        ))}
        <button style={{ ...s.btn, width: "100%", borderStyle: "dashed", color: T.text3, marginTop: 6 }} onClick={add}>+ Adicionar nova ação</button>
        <div style={{ textAlign: "right", marginTop: "1rem" }}><button style={s.btnA} onClick={save}>Salvar e notificar →</button></div>
      </div>}
    </div>
  );
}

/* ─── EFICÁCIA TAB ───────────────────────────────────────────────────────────── */
function EficaciaTab({ rncs, toast_, openEmail, doUpdateRNC }) {
  const T = useTheme(); const s = useS();
  const [sid, setSid] = useState(""); const [f, setF] = useState({ criterio: "", data: "", resp: "", evidencias: "", resultado: "", obs: "" });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const r = rncs.find(x => x.id === sid);
  useEffect(() => { if (!r) return; setF({ criterio: r.eficacia?.criterio || "", data: r.eficacia?.data || "", resp: r.eficacia?.resp || "", evidencias: r.eficacia?.evidencias || "", resultado: r.eficacia?.resultado || "", obs: r.eficacia?.obs || "" }); }, [sid]);
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
        <F lbl="Critério de verificação" ch={<TA rows={3} value={f.criterio} onChange={e => set("criterio", e.target.value)} placeholder="Ex: Ausência de telescopia em 3 lotes consecutivos; Cp ≥ 1,33" />} />
        <G2 ch={<><F lbl="Data da verificação" ch={<Inp type="date" value={f.data} onChange={e => set("data", e.target.value)} />} /><F lbl="Responsável" ch={<Inp value={f.resp} onChange={e => set("resp", e.target.value)} />} /></>} />
        <F lbl="Evidências coletadas" ch={<TA rows={3} value={f.evidencias} onChange={e => set("evidencias", e.target.value)} />} />
        <F lbl="Resultado da verificação" ch={
          <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
            {[["Eficaz", T.accent, "Causa raiz eliminada"], ["Ineficaz", "#ff4f6a", "NC recorreu, reabrir"], ["Pendente verificação", T.yellow, "Aguardando dados"]].map(([v, color, desc]) => (
              <label key={v} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "10px 16px", background: f.resultado === v ? `${color}18` : T.surf, border: `1px solid ${f.resultado === v ? color + "55" : T.border}`, borderRadius: 8, flex: 1, minWidth: 150 }}>
                <input type="radio" name="efic_r" value={v} checked={f.resultado === v} onChange={() => set("resultado", v)} style={{ accentColor: color }} />
                <div><div style={{ fontWeight: 600, color, fontSize: 12 }}>{v}</div><div style={{ fontSize: 10, color: T.text3 }}>{desc}</div></div>
              </label>
            ))}
          </div>
        } />
        <F lbl="Lições aprendidas / Observações finais" ch={<TA rows={3} value={f.obs} onChange={e => set("obs", e.target.value)} />} />
        <div style={{ textAlign: "right" }}><button style={s.btnA} onClick={save}>Registrar e notificar ✓</button></div>
      </div>}
    </div>
  );
}

/* ─── DASHBOARD ──────────────────────────────────────────────────────────────── */
function DashTab({ rncs }) {
  const T = useTheme(); const s = useS();
  const bS = {}, bT = {}, bV = {};
  rncs.forEach(r => { bS[r.status] = (bS[r.status] || 0) + 1; bT[r.tipo] = (bT[r.tipo] || 0) + 1; bV[r.sev] = (bV[r.sev] || 0) + 1; });
  const venc = rncs.filter(r => r.prazoAC && r.prazoAC < tod() && r.status !== "Eficaz" && r.status !== "Ineficaz");
  const tot = rncs.length, ef = rncs.filter(x => x.status === "Eficaz").length;
  const sCols = Object.fromEntries(Object.keys(SMETA).map(k => [k, SMETA[k].dot]));
  function Bar({ data, cm, title, insight }) {
    const max = Math.max(...Object.values(data), 1);
    return <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "1.25rem", marginBottom: "1rem" }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{title}</div>
      <div style={{ fontSize: 11, color: T.text2, marginBottom: "1rem", paddingBottom: ".75rem", borderBottom: `1px solid ${T.border}`, marginTop: 4 }}>{insight}</div>
      {Object.keys(data).length === 0 ? <div style={{ color: T.text3, fontSize: 13 }}>Sem dados.</div> :
        Object.entries(data).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ minWidth: 150, fontSize: 12, color: T.text2, fontWeight: 500 }}>{k}</div>
            <div style={{ flex: 1, height: 8, background: T.surf, borderRadius: 4, overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.round(n / max * 100)}%`, background: cm[k] || T.accent, borderRadius: 4, transition: "width .6s ease", boxShadow: `0 0 8px ${cm[k] || T.accent}60` }} /></div>
            <div style={{ minWidth: 24, fontSize: 12, color: T.text2, fontWeight: 700, textAlign: "right" }}>{n}</div>
          </div>
        ))}
    </div>;
  }
  const ts = Object.entries(bS).sort((a, b) => b[1] - a[1])[0];
  const tt = Object.entries(bT).sort((a, b) => b[1] - a[1])[0];
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14, marginBottom: "1.25rem" }}>
        {[["Total", tot, T.accent, "Todos os registros"], ["Abertas", rncs.filter(x => x.status === "Aberta").length, "#ff4f6a", "Requerem ação"], ["Eficazes", ef, T.accent, `${tot > 0 ? Math.round(ef / tot * 100) : 0}% resolução`], ["Vencidas", venc.length, T.orange, "Prazo AC expirado"]].map(([l, n, c, sub]) => (
          <div key={l} style={{ background: T.card, border: `1px solid ${c}22`, borderRadius: 14, padding: "1.25rem", boxShadow: `0 0 20px ${c}15`, position: "relative", overflow: "hidden" }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: c, lineHeight: 1, marginBottom: 4 }}>{n}</div>
            <div style={{ fontSize: 11, color: T.text2, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>{l}</div>
            <div style={{ fontSize: 10, color: T.text3, marginTop: 2 }}>{sub}</div>
            <div style={{ position: "absolute", bottom: -16, right: -16, width: 70, height: 70, borderRadius: "50%", background: c, opacity: .06 }} />
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Bar data={bS} cm={sCols} title="Por status" insight={ts ? `"${ts[0]}" lidera com ${ts[1]} RNC${ts[1] > 1 ? "s" : ""}.` : "Sem dados."} />
        <Bar data={bT} cm={TIPOC} title="Por tipo" insight={tt ? `"${tt[0]}" — ${tt[1]} ocorrência${tt[1] > 1 ? "s" : ""}.` : "Sem dados."} />
      </div>
      <Bar data={bV} cm={{ Crítica: "#ff4f6a", Maior: T.orange, Menor: T.purple }} title="Por severidade" insight={(bV.Crítica || 0) > 0 ? `⚠ ${bV.Crítica} RNC crítica(s) — prioridade máxima.` : "Nenhuma RNC crítica registrada."} />
      <div style={s.card}>
        <SecTitle icon="⚠️" ch="Prazos de ação corretiva vencidos" />
        {venc.length === 0 ? <div style={{ color: T.text3, fontSize: 13 }}>Nenhum prazo vencido.</div> : venc.map(r => (
          <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#ff4f6a12", border: "1px solid #ff4f6a30", borderRadius: 10, marginBottom: 8 }}>
            <div><div style={{ fontSize: 13, fontWeight: 600, color: "#ff4f6a" }}>{r.num}</div><div style={{ fontSize: 12, color: T.text2, marginTop: 2 }}>{r.desc?.substring(0, 55)}...</div></div>
            <div style={{ textAlign: "right" }}><div style={{ fontSize: 11, color: "#ff4f6a", fontWeight: 700 }}>VENCIDO</div><div style={{ fontSize: 11, color: T.text3 }}>{fmt(r.prazoAC)}</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── ADMIN TAB ──────────────────────────────────────────────────────────────── */
function AdminTab({ users, setUsers, toast_, currentUser }) {
  const T = useTheme(); const s = useS();
  const [nu, setNu] = useState({ name: "", email: "", pw: "Herbamed@2025", role: "user", setor: "" });
  const [editing, setEditing] = useState(null); // uid being edited
  const [editData, setEditData] = useState({});
  const set = (k, v) => setNu(p => ({ ...p, [k]: v }));

  const addUser = async () => {
    if (!nu.name || !nu.email || !nu.pw) { alert("Nome, e-mail e senha são obrigatórios."); return; }
    if (users.find(u => u.email === nu.email)) { alert("E-mail já cadastrado."); return; }
    try {
      const cred = await createAuthUser(nu.email, nu.pw);
      const userData = { name: nu.name, email: nu.email, role: nu.role, setor: nu.setor };
      await saveUser(cred.user.uid, userData);
      const newUsers = [...users, { ...userData, id: cred.user.uid }];
      setUsers(newUsers);
      setNu({ name: "", email: "", pw: "Herbamed@2025", role: "user", setor: "" });
      toast_("Usuário criado com sucesso!", "green");
    } catch (e) { toast_("Erro: " + e.message, "red"); }
  };

  const startEdit = (u) => { setEditing(u.id); setEditData({ name: u.name, setor: u.setor, role: u.role }); };
  const saveEdit = async (uid) => {
    await updateUser(uid, editData);
    setUsers(users.map(u => u.id === uid ? { ...u, ...editData } : u));
    setEditing(null);
    toast_("Usuário atualizado!", "green");
  };
  const delUser = async (uid) => {
    if (uid === currentUser.uid) { alert("Você não pode excluir seu próprio usuário."); return; }
    if (!confirm("Remover este usuário do sistema?")) return;
    await fbDeleteUser(uid);
    setUsers(users.filter(u => u.id !== uid));
    toast_("Usuário removido.", "red");
  };

  return (
    <div>
      <div style={s.card}>
        <SecTitle icon="👥" ch={`Usuários do sistema (${users.length})`} />
        {users.map(u => (
          <div key={u.id} style={{ background: T.surf, border: `1px solid ${T.border}`, borderRadius: 10, marginBottom: 10, overflow: "hidden" }}>
            {editing === u.id ? (
              <div style={{ padding: "1rem" }}>
                <G3 ch={<>
                  <F lbl="Nome" ch={<Inp value={editData.name} onChange={e => setEditData(p => ({ ...p, name: e.target.value }))} />} />
                  <F lbl="Setor" ch={<Inp value={editData.setor} onChange={e => setEditData(p => ({ ...p, setor: e.target.value }))} />} />
                  <F lbl="Perfil" ch={<Sel value={editData.role} onChange={e => setEditData(p => ({ ...p, role: e.target.value }))}><option value="user">Usuário</option><option value="admin">Admin</option></Sel>} />
                </>} />
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button style={s.btn} onClick={() => setEditing(null)}>Cancelar</button>
                  <button style={s.btnA} onClick={() => saveEdit(u.id)}>Salvar alterações</button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px" }}>
                <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: u.role === "admin" ? `linear-gradient(135deg,${T.accent},${T.accent2})` : T.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: u.role === "admin" ? "#fff" : T.text2, flexShrink: 0 }}>{u.name?.[0] || "?"}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: T.text2 }}>{u.email} · {u.setor || "—"}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ display: "inline-flex", padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: u.role === "admin" ? T.accentDim : T.border, color: u.role === "admin" ? T.accent : T.text2 }}>{u.role === "admin" ? "Admin" : "Usuário"}</span>
                  <button style={{ ...s.btn, padding: "6px 12px", fontSize: 11 }} onClick={() => startEdit(u)}>✏️ Editar</button>
                  {u.id !== currentUser.uid && <button style={{ ...s.btnD, padding: "6px 12px", fontSize: 11 }} onClick={() => delUser(u.id)}>🗑️ Remover</button>}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={s.card}>
        <SecTitle icon="➕" ch="Adicionar novo usuário" />
        <div style={{ background: T.accentDim, border: `1px solid ${T.accent}25`, borderRadius: 8, padding: "10px 14px", marginBottom: "1rem", fontSize: 12, color: T.accent }}>
          💡 O usuário receberá acesso ao sistema com e-mail e senha definidos abaixo. Recomende trocar a senha no primeiro acesso.
        </div>
        <G2 ch={<>
          <F lbl="Nome completo" ch={<Inp placeholder="Ex: Ana Lima" value={nu.name} onChange={e => set("name", e.target.value)} />} />
          <F lbl="E-mail" ch={<Inp type="email" placeholder="ana@herbamed.com" value={nu.email} onChange={e => set("email", e.target.value)} />} />
          <F lbl="Senha inicial" ch={<Inp value={nu.pw} onChange={e => set("pw", e.target.value)} />} />
          <F lbl="Setor" ch={<Inp placeholder="Ex: Produção" value={nu.setor} onChange={e => set("setor", e.target.value)} />} />
          <F lbl="Perfil de acesso" ch={<Sel value={nu.role} onChange={e => set("role", e.target.value)}><option value="user">Usuário</option><option value="admin">Admin</option></Sel>} />
        </>} />
        <div style={{ textAlign: "right", marginTop: 6 }}><button style={s.btnA} onClick={addUser}>Criar usuário ✓</button></div>
      </div>
    </div>
  );
}

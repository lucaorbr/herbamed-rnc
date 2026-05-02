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
  "Matéria-prima":       "#4fc3f7",
  "Material de embalagem":"#22d3ee",
  "Insumo":              "#818cf8",
  "Produto acabado":     "#2ab84a",
  "Processo":            "#ffd166",
  "Equipamento":         "#ff8c42",
  "Documentação":        "#a78bfa",
  "Ambiental":           "#5dd4b0",
  "Outros":              "#94a3b8",
};

/* ─── CLAUDE AI HELPER ───────────────────────────────────────────────────────── */
async function askClaude(prompt) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: prompt }]
    })
  });
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

/* ─── AI PANEL COMPONENT ─────────────────────────────────────────────────────── */
function AIPanel({ rnc, onApply }) {
  const T = useTheme(); const s = useS();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [type, setType] = useState("");

  const run = async (aiType) => {
    setLoading(true); setType(aiType); setResult(null);
    try {
      let prompt = "";
      if (aiType === "ishikawa") {
        prompt = `Você é um especialista em qualidade industrial. Analise esta não conformidade e sugira causas para o diagrama de Ishikawa (6M).

NÃO CONFORMIDADE: ${rnc.desc}
PRODUTO: ${rnc.produto || "—"}
FORNECEDOR: ${rnc.fornecedor || "—"}
TIPO: ${rnc.tipo}

Responda APENAS em JSON válido, sem markdown, sem explicações:
{
  "mao": ["causa 1", "causa 2"],
  "maquina": ["causa 1", "causa 2"],
  "metodo": ["causa 1", "causa 2"],
  "material": ["causa 1", "causa 2"],
  "medicao": ["causa 1", "causa 2"],
  "meioamb": ["causa 1", "causa 2"],
  "efeito": "descrição resumida do problema"
}`;
      } else if (aiType === "5porques") {
        prompt = `Você é um especialista em qualidade. Faça a análise dos 5 Porquês para esta não conformidade.

NÃO CONFORMIDADE: ${rnc.desc}
PRODUTO: ${rnc.produto || "—"}

Responda APENAS em JSON válido, sem markdown:
{
  "causa": "causa raiz inicial",
  "porques": ["resposta porquê 1", "resposta porquê 2", "resposta porquê 3", "resposta porquê 4", "resposta porquê 5"],
  "raiz": "causa raiz final identificada"
}`;
      } else if (aiType === "5w2h") {
        prompt = `Você é um especialista em qualidade. Crie um plano de ação 5W2H para corrigir esta não conformidade.

NÃO CONFORMIDADE: ${rnc.desc}
CAUSA RAIZ: ${rnc.ishikawa?.root || "não identificada"}
PRODUTO: ${rnc.produto || "—"}
RESPONSÁVEL: ${rnc.resp || "—"}

Responda APENAS em JSON válido, sem markdown:
{
  "acoes": [
    {
      "what": "o que fazer",
      "why": "por quê",
      "who": "quem",
      "where": "onde",
      "when": "prazo em dias (ex: 7 dias)",
      "how": "como fazer",
      "howMuch": "baixo/médio/alto",
      "status": "Pendente"
    }
  ]
}`;
      } else if (aiType === "eficacia") {
        prompt = `Você é um especialista em qualidade. Sugira critérios de verificação de eficácia para esta ação corretiva.

NÃO CONFORMIDADE: ${rnc.desc}
CAUSA RAIZ: ${rnc.ishikawa?.root || "não identificada"}
PRODUTO: ${rnc.produto || "—"}

Responda APENAS em JSON válido, sem markdown:
{
  "criterio": "descrição detalhada do critério de eficácia",
  "prazo": "prazo sugerido em dias",
  "evidencias": "quais evidências coletar para comprovar eficácia"
}`;
      } else if (aiType === "resumo") {
        prompt = `Você é um especialista em qualidade. Gere um resumo executivo profissional desta RNC para envio à diretoria.

NÃO CONFORMIDADE: ${rnc.num}
DESCRIÇÃO: ${rnc.desc}
PRODUTO: ${rnc.produto || "—"}
FORNECEDOR: ${rnc.fornecedor || "—"}
SEVERIDADE: ${rnc.sev}
STATUS: ${rnc.status}
CAUSA RAIZ: ${rnc.ishikawa?.root || "em análise"}

Responda APENAS em JSON válido, sem markdown:
{
  "resumo": "texto do resumo executivo profissional em português, 3-4 parágrafos"
}`;
      }

      const txt = await askClaude(prompt);
      const clean = txt.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setResult({ type: aiType, data: parsed });
    } catch (e) {
      setResult({ type: "erro", data: { msg: "Erro ao processar. Tente novamente." } });
    }
    setLoading(false);
  };

  const apply = () => { if (result && onApply) onApply(result); setResult(null); };

  const btns = [
    { id: "ishikawa",  icon: "🐟", label: "Sugerir causas\nIshikawa" },
    { id: "5porques",  icon: "🔍", label: "Analisar\n5 Porquês" },
    { id: "5w2h",      icon: "📌", label: "Gerar plano\n5W2H" },
    { id: "eficacia",  icon: "✅", label: "Critério de\nEficácia" },
    { id: "resumo",    icon: "📄", label: "Resumo\nExecutivo" },
  ];

  return (
    <div style={{ background: `linear-gradient(135deg, ${T.accentDim}, ${T.card2})`, border: `1px solid ${T.accent}33`, borderRadius: 14, padding: "1.25rem", marginBottom: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "1rem" }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg,${T.accent},${T.accent2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, boxShadow: `0 0 12px ${T.accentGlow}` }}>🤖</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Assistente de IA — Claude</div>
          <div style={{ fontSize: 11, color: T.text2 }}>Análise automática com inteligência artificial</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: "1rem" }}>
        {btns.map(b => (
          <button key={b.id} onClick={() => run(b.id)} disabled={loading} style={{ padding: "10px 6px", background: type === b.id && loading ? T.accentDim : T.surf, border: `1px solid ${T.border2}`, borderRadius: 10, color: T.text, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 500, textAlign: "center", lineHeight: 1.4, opacity: loading && type !== b.id ? .5 : 1, transition: "all .2s" }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{b.icon}</div>
            {b.label.split("\n").map((l, i) => <div key={i}>{l}</div>)}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px", background: T.surf, borderRadius: 8, fontSize: 13, color: T.accent }}>
          <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span>
          Analisando com IA...
        </div>
      )}

      {result && result.type !== "erro" && (
        <div style={{ background: T.surf, border: `1px solid ${T.border}`, borderRadius: 10, padding: "1rem" }}>
          <div style={{ fontSize: 11, color: T.accent, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>
            ✨ Resultado da análise
          </div>

          {result.type === "ishikawa" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {Object.entries({ mao: "👤 Mão de obra", maquina: "⚙️ Máquina", metodo: "📋 Método", material: "📦 Material", medicao: "📏 Medição", meioamb: "🌿 Meio ambiente" }).map(([k, l]) => (
                result.data[k]?.length > 0 && (
                  <div key={k} style={{ background: T.card, borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: T.accent, marginBottom: 6, textTransform: "uppercase" }}>{l}</div>
                    {result.data[k].map((c, i) => <div key={i} style={{ fontSize: 12, color: T.text2, marginBottom: 3 }}>• {c}</div>)}
                  </div>
                )
              ))}
            </div>
          )}

          {result.type === "5porques" && (
            <div>
              {result.data.porques?.map((p, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
                  <div style={{ minWidth: 24, height: 24, borderRadius: "50%", background: `linear-gradient(135deg,${T.accent},${T.accent2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ fontSize: 13, color: T.text2, paddingTop: 3 }}>{p}</div>
                </div>
              ))}
              <div style={{ marginTop: 10, padding: 10, background: T.accentDim, border: `1px solid ${T.accent}30`, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: T.accent, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>🎯 Causa raiz</div>
                <div style={{ fontSize: 13, color: T.text, fontWeight: 500 }}>{result.data.raiz}</div>
              </div>
            </div>
          )}

          {result.type === "5w2h" && (
            <div>
              {result.data.acoes?.map((a, i) => (
                <div key={i} style={{ background: T.card, borderRadius: 8, padding: 10, marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.accent, marginBottom: 6 }}>Ação #{i + 1}: {a.what}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                    {[["Por quê", a.why], ["Quem", a.who], ["Onde", a.where], ["Quando", a.when], ["Como", a.how], ["Custo", a.howMuch]].map(([k, v]) => (
                      <div key={k} style={{ fontSize: 11, color: T.text2 }}><span style={{ color: T.text3, fontWeight: 600 }}>{k}:</span> {v}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {result.type === "eficacia" && (
            <div>
              <div style={{ fontSize: 13, color: T.text, marginBottom: 8 }}>{result.data.criterio}</div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ fontSize: 12, color: T.text2 }}><span style={{ color: T.accent, fontWeight: 600 }}>Prazo:</span> {result.data.prazo}</div>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: T.text2 }}><span style={{ color: T.accent, fontWeight: 600 }}>Evidências:</span> {result.data.evidencias}</div>
            </div>
          )}

          {result.type === "resumo" && (
            <div style={{ fontSize: 13, color: T.text, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{result.data.resumo}</div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
            <button style={{ ...s.btn, fontSize: 11 }} onClick={() => setResult(null)}>Descartar</button>
            {result.type !== "resumo" && (
              <button style={{ ...s.btnA, fontSize: 11, display: "flex", alignItems: "center", gap: 6 }} onClick={apply}>
                ✓ Aplicar ao formulário
              </button>
            )}
          </div>
        </div>
      )}

      {result?.type === "erro" && (
        <div style={{ background: "#ff4f6a18", border: "1px solid #ff4f6a30", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#ff4f6a" }}>
          ⚠ {result.data.msg}
        </div>
      )}
    </div>
  );
}


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

/* ─── HERBAMED LOGO ──────────────────────────────────────────────────────────── */
function HerbamedLogo({ height = 32, white = false }) {
  return (
    <img
      src="/logo.png"
      alt="Herbamed"
      style={{
        height: height,
        width: "auto",
        display: "block",
        filter: white ? "brightness(0) invert(1)" : "none",
        objectFit: "contain",
      }}
    />
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
      // Envia um e-mail para cada destinatário via EmailJS
      const EMAILJS_SERVICE  = "service_gxhicii";
      const EMAILJS_TEMPLATE = "template_4jl73wq";
      const EMAILJS_KEY      = "z2VxJ1dYjwrRp8Nh4";

      for (const email of to) {
        const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            service_id:  EMAILJS_SERVICE,
            template_id: EMAILJS_TEMPLATE,
            user_id:     EMAILJS_KEY,
            template_params: {
              to_email:    email,
              to_name:     users.find(u => u.email === email)?.name || email,
              from_name:   `${currentUser.name} · Herbamed® Gestão da Qualidade`,
              subject:     subject,
              message:     body,
              reply_to:    currentUser.email,
            }
          })
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`Erro ao enviar para ${email}: ${txt}`);
        }
      }
      onSent(`E-mail enviado para ${to.length} destinatário(s)!`);
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
  const T = useTheme();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

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
    <div style={{ fontFamily:"'DM Sans',system-ui,sans-serif", display:"flex", minHeight:"100vh", background:"#050a06" }}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}
        .login-inp:focus{border-color:#2ab84a!important;box-shadow:0 0 0 3px rgba(42,184,74,0.15)!important;}
        .login-btn:hover{transform:translateY(-1px);box-shadow:0 8px 28px rgba(42,184,74,0.45)!important;}
      `}</style>

      {/* ── ESQUERDA — Banner ── */}
      <div style={{ flex:1, position:"relative", overflow:"hidden", display:"flex", flexDirection:"column" }}>
        {/* Banner com overlay */}
        <div style={{ position:"absolute", inset:0, backgroundImage:"url('/banner.jpg')", backgroundSize:"cover", backgroundPosition:"center center", filter:"brightness(0.85)" }} />
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom, rgba(5,30,15,0.2) 0%, rgba(5,20,10,0.5) 70%, rgba(5,15,8,0.85) 100%)" }} />
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(to right, transparent 60%, #0a110c 100%)" }} />

        {/* Content */}
        <div style={{ position:"relative", zIndex:1, display:"flex", flexDirection:"column", height:"100%", padding:"2.5rem" }}>
          {/* Top tag */}
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(42,184,74,0.15)", border:"1px solid rgba(42,184,74,0.3)", borderRadius:20, padding:"5px 14px", width:"fit-content", marginBottom:"auto" }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:"#2ab84a", animation:"pulse 2s infinite", display:"inline-block" }} />
            <span style={{ fontSize:11, fontWeight:600, color:"#2ab84a", textTransform:"uppercase", letterSpacing:".1em" }}>Sistema Online</span>
          </div>

          {/* Main text — bottom */}
          <div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", textTransform:"uppercase", letterSpacing:"4px", fontWeight:600, marginBottom:12 }}>Herbamed® · Qualidade</div>
            <div style={{ fontSize:42, fontWeight:800, color:"#ffffff", lineHeight:1.1, marginBottom:16, letterSpacing:"-.02em" }}>
              SGQ<br /><span style={{ color:"#2ab84a" }}>Herbamed</span>
            </div>
            <div style={{ fontSize:15, color:"rgba(255,255,255,0.55)", lineHeight:1.6, maxWidth:400, marginBottom:28 }}>
              Sistema de Gestão da Qualidade integrado com inteligência artificial para análise e resolução de não conformidades.
            </div>
            <div style={{ fontSize:13, color:"rgba(255,255,255,0.3)", fontStyle:"italic" }}>
              "Fornecendo Saúde. Cultivando Qualidade de Vida."
            </div>
          </div>
        </div>
      </div>

      {/* ── DIREITA — Formulário ── */}
      <div style={{ width:460, background:"#0a110c", display:"flex", flexDirection:"column", borderLeft:"1px solid rgba(42,184,74,0.12)", position:"relative", overflow:"hidden" }}>
        {/* Glow top */}
        <div style={{ position:"absolute", top:-80, right:-80, width:260, height:260, borderRadius:"50%", background:"radial-gradient(circle, rgba(42,184,74,0.12) 0%, transparent 70%)", pointerEvents:"none" }} />

        <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"center", padding:"3rem 2.75rem", position:"relative", zIndex:1 }}>

          {/* Logo */}
          <div style={{ marginBottom:"2.5rem", animation:"fadeUp .4s ease" }}>
            <div style={{ display:"inline-flex", background:"#fff", borderRadius:12, padding:"8px 20px", marginBottom:"1.5rem", boxShadow:"0 0 30px rgba(42,184,74,0.3)" }}>
              <HerbamedLogo height={32} white={false} />
            </div>
            <div style={{ fontSize:24, fontWeight:700, color:"#fff", letterSpacing:"-.02em", marginBottom:6 }}>
              Bem-vindo de volta
            </div>
            <div style={{ fontSize:13, color:"rgba(255,255,255,0.35)", lineHeight:1.5 }}>
              Entre com suas credenciais para acessar o SGQ Herbamed
            </div>
          </div>

          {/* Campos */}
          <div style={{ animation:"fadeUp .4s ease .1s both" }}>
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:11, color:"rgba(255,255,255,0.45)", fontWeight:700, textTransform:"uppercase", letterSpacing:".08em", display:"block", marginBottom:8 }}>E-mail corporativo</label>
              <input
                className="login-inp"
                type="email" placeholder="seu@herbamed.com.br" value={email}
                onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()}
                style={{ width:"100%", padding:"13px 16px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, color:"#fff", fontFamily:"inherit", fontSize:14, outline:"none", transition:"all .2s", boxSizing:"border-box" }}
              />
            </div>

            <div style={{ marginBottom:24 }}>
              <label style={{ fontSize:11, color:"rgba(255,255,255,0.45)", fontWeight:700, textTransform:"uppercase", letterSpacing:".08em", display:"block", marginBottom:8 }}>Senha</label>
              <div style={{ position:"relative" }}>
                <input
                  className="login-inp"
                  type={showPw?"text":"password"} placeholder="••••••••" value={pw}
                  onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()}
                  style={{ width:"100%", padding:"13px 44px 13px 16px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, color:"#fff", fontFamily:"inherit", fontSize:14, outline:"none", transition:"all .2s", boxSizing:"border-box" }}
                />
                <button onClick={()=>setShowPw(o=>!o)} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"rgba(255,255,255,0.3)", cursor:"pointer", fontSize:16, padding:0, fontFamily:"inherit" }}>
                  {showPw?"🙈":"👁️"}
                </button>
              </div>
            </div>

            {err && (
              <div style={{ background:"rgba(255,79,106,0.12)", border:"1px solid rgba(255,79,106,0.3)", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#ff4f6a", marginBottom:20, display:"flex", alignItems:"center", gap:8 }}>
                ⚠ {err}
              </div>
            )}

            <button
              className="login-btn"
              onClick={login} disabled={loading}
              style={{ width:"100%", padding:"14px", background:"linear-gradient(135deg,#2ab84a,#1a7a3c)", border:"none", borderRadius:10, color:"#fff", fontSize:14, fontWeight:700, cursor:loading?"not-allowed":"pointer", fontFamily:"inherit", opacity:loading?.7:1, boxShadow:"0 4px 20px rgba(42,184,74,0.35)", letterSpacing:".3px", transition:"all .2s" }}
            >
              {loading?<span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}><span style={{ animation:"spin 1s linear infinite", display:"inline-block" }}>⟳</span> Autenticando...</span>:"Entrar no SGQ →"}
            </button>
          </div>

          {/* Divider */}
          <div style={{ margin:"2rem 0", display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ flex:1, height:1, background:"rgba(255,255,255,0.06)" }} />
            <span style={{ fontSize:11, color:"rgba(255,255,255,0.2)" }}>acesso seguro</span>
            <div style={{ flex:1, height:1, background:"rgba(255,255,255,0.06)" }} />
          </div>

          {/* Security badges */}
          <div style={{ display:"flex", gap:8, justifyContent:"center" }}>
            {[["🔒","Firebase Auth"],["☁️","Cloud Seguro"],["🔐","Criptografado"]].map(([icon,label])=>(
              <div key={label} style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 10px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:20 }}>
                <span style={{ fontSize:11 }}>{icon}</span>
                <span style={{ fontSize:10, color:"rgba(255,255,255,0.3)", fontWeight:500 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding:"1.25rem 2.75rem", borderTop:"1px solid rgba(255,255,255,0.05)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:10, color:"rgba(255,255,255,0.18)" }}>© {new Date().getFullYear()} Herbamed®</div>
          <div style={{ fontSize:10, color:"rgba(255,255,255,0.18)" }}>SGQ v2.0 · Acesso restrito</div>
        </div>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rncs, setRncs] = useState([]);
  const [users, setUsers] = useState([]);
  const [toast, setToast] = useState(null);
  const [emailCtx, setEmailCtx] = useState(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);

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
          <div style={{ color: T.text2, fontSize: 13 }}>Carregando SGQ Herbamed...</div>
        </div>
        <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      </div>
    </ThemeCtx.Provider>
  );

  if (!user) return <ThemeCtx.Provider value={T}><Login onLogin={setUser} /></ThemeCtx.Provider>;

  const isViewer = user.role === "viewer";
  const isAdmin = user.role === "admin";

  // Notificações — RNCs com prazo vencido
  const notifs = rncs.filter(r => r.prazoAC && r.prazoAC < tod() && r.status !== "Eficaz" && r.status !== "Ineficaz");

  const MENU = [
    { id: "lista",     icon: "📋", label: "Registros",        badge: rncs.filter(x => x.status === "Aberta").length },
    ...(!isViewer ? [{ id: "nova", icon: "➕", label: "Nova RNC" }] : []),
    ...(!isViewer ? [{ id: "ishikawa", icon: "🐟", label: "Ishikawa / 5 Porquês" }] : []),
    ...(!isViewer ? [{ id: "5w2h", icon: "📌", label: "5W2H" }] : []),
    ...(!isViewer ? [{ id: "eficacia", icon: "✅", label: "Eficácia" }] : []),
    { id: "dashboard", icon: "📊", label: "Dashboard" },
    { id: "relatorios",icon: "📑", label: "Relatórios" },
    ...(isAdmin ? [{ id: "admin", icon: "⚙️", label: "Administração" }] : []),
  ];

  const PAGE_TITLES = {
    lista: "Registros de Não Conformidades",
    nova: "Nova Não Conformidade",
    ishikawa: "Ishikawa / 5 Porquês",
    "5w2h": "Plano de Ação 5W2H",
    eficacia: "Verificação de Eficácia",
    dashboard: "Dashboard",
    relatorios: "Relatórios",
    admin: "Administração",
  };

  return (
    <ThemeCtx.Provider value={T}>
      <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: T.bg, color: T.text, minHeight: "100vh", fontSize: 14, display: "flex", flexDirection: "column" }}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <style>{`
          @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
          @keyframes fadeIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
          @keyframes slideIn{from{transform:translateX(-100%)}to{transform:translateX(0)}}
          .menu-item:hover{background:${T.accentDim}!important;color:${T.accent}!important;}
          .rnc-row:hover{background:${T.card2}!important;}
          .th-sort:hover{color:${T.accent}!important;cursor:pointer;}
        `}</style>

        {/* ── TOP HEADER ── */}
        <div style={{ background: `linear-gradient(135deg,${T.surf},${T.card})`, borderBottom:`1px solid ${T.border2}`, height:60, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 1.5rem", position:"sticky", top:0, zIndex:200, backdropFilter:"blur(12px)", flexShrink:0 }}>

          {/* Left: toggle + logo */}
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <button onClick={() => setSidebarOpen(o=>!o)} style={{ background:"none", border:`1px solid ${T.border2}`, borderRadius:8, color:T.text2, cursor:"pointer", width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>
              {sidebarOpen ? "◀" : "▶"}
            </button>
            <div style={{ background:"#fff", borderRadius:9, padding:"4px 12px", boxShadow:`0 0 14px ${T.accentGlow}`, display:"flex", alignItems:"center" }}>
              <HerbamedLogo height={24} white={false} />
            </div>
            <div style={{ display:"flex", flexDirection:"column" }}>
              <span style={{ fontSize:13, fontWeight:700, color:T.text, lineHeight:1.2 }}>SGQ Herbamed®</span>
              <span style={{ fontSize:10, color:T.text3 }}>Sistema de Gestão da Qualidade</span>
            </div>
          </div>

          {/* Center: KPI pills */}
          <div style={{ display:"flex", gap:8 }}>
            {[
              ["Total RNCs", rncs.length, T.accent],
              ["Abertas", rncs.filter(x=>x.status==="Aberta").length, T.red],
              ["Eficazes", rncs.filter(x=>x.status==="Eficaz").length, T.accent],
              ["Vencidas", notifs.length, notifs.length>0?T.yellow:T.text3],
            ].map(([l,n,c])=>(
              <div key={l} style={{ background:T.surf, border:`1px solid ${T.border}`, borderRadius:20, padding:"4px 14px", display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:16, fontWeight:700, color:c }}>{n}</span>
                <span style={{ fontSize:10, color:T.text3, textTransform:"uppercase", letterSpacing:".04em" }}>{l}</span>
              </div>
            ))}
          </div>

          {/* Right: theme + notif + avatar */}
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <ThemePicker current={themeKey} onChange={changeTheme} />

            {/* Notifications bell */}
            <div style={{ position:"relative" }}>
              <button onClick={()=>{setNotifOpen(o=>!o);setAvatarOpen(false);}} style={{ background:notifs.length>0?"#ffd16618":"none", border:`1px solid ${notifs.length>0?"#ffd16633":T.border}`, borderRadius:8, color:notifs.length>0?T.yellow:T.text2, cursor:"pointer", width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, position:"relative" }}>
                🔔
                {notifs.length>0 && <span style={{ position:"absolute", top:2, right:2, width:14, height:14, borderRadius:"50%", background:T.red, color:"#fff", fontSize:8, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", border:`2px solid ${T.bg}` }}>{notifs.length}</span>}
              </button>
              {notifOpen && (
                <div style={{ position:"absolute", right:0, top:"calc(100%+8px)", width:320, background:T.card2, border:`1px solid ${T.border2}`, borderRadius:14, boxShadow:"0 16px 48px #0008", zIndex:500, animation:"fadeIn .15s ease" }}>
                  <div style={{ padding:"12px 16px", borderBottom:`1px solid ${T.border}`, fontSize:12, fontWeight:700, color:T.text, display:"flex", justifyContent:"space-between" }}>
                    🔔 Notificações <span style={{ color:T.text3, fontWeight:400 }}>{notifs.length} alerta(s)</span>
                  </div>
                  {notifs.length===0 ? (
                    <div style={{ padding:"1.5rem", textAlign:"center", color:T.text3, fontSize:13 }}>Nenhum alerta no momento ✓</div>
                  ) : notifs.map(r=>(
                    <div key={r.id} onClick={()=>{setTab("lista");setNotifOpen(false);}} style={{ padding:"10px 16px", borderBottom:`1px solid ${T.border}`, cursor:"pointer", transition:"background .15s" }}>
                      <div style={{ fontSize:12, fontWeight:600, color:T.red }}>{r.num} — Prazo vencido</div>
                      <div style={{ fontSize:11, color:T.text2, marginTop:2 }}>{r.desc?.substring(0,50)}...</div>
                      <div style={{ fontSize:10, color:T.text3, marginTop:2 }}>Prazo AC: {fmt(r.prazoAC)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Avatar dropdown */}
            <div style={{ position:"relative" }}>
              <button onClick={()=>{setAvatarOpen(o=>!o);setNotifOpen(false);}} style={{ display:"flex", alignItems:"center", gap:8, background:T.surf, border:`1px solid ${T.border2}`, borderRadius:10, padding:"5px 10px 5px 5px", cursor:"pointer", fontFamily:"inherit" }}>
                <div style={{ width:28, height:28, borderRadius:"50%", background:`linear-gradient(135deg,${T.accent},${T.accent2})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:"#fff", flexShrink:0 }}>
                  {user.name?.[0]||"?"}
                </div>
                <div style={{ textAlign:"left" }}>
                  <div style={{ fontSize:12, fontWeight:600, color:T.text, lineHeight:1.2 }}>{user.name}</div>
                  <div style={{ fontSize:10, color:T.text3 }}>{user.role==="admin"?"Admin":user.role==="viewer"?"Visualizador":"Usuário"}</div>
                </div>
                <span style={{ color:T.text3, fontSize:10 }}>▾</span>
              </button>
              {avatarOpen && (
                <div style={{ position:"absolute", right:0, top:"calc(100%+8px)", width:220, background:T.card2, border:`1px solid ${T.border2}`, borderRadius:12, boxShadow:"0 16px 48px #0008", zIndex:500, overflow:"hidden", animation:"fadeIn .15s ease" }}>
                  <div style={{ padding:"12px 16px", borderBottom:`1px solid ${T.border}` }}>
                    <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{user.name}</div>
                    <div style={{ fontSize:11, color:T.text2, marginTop:2 }}>{user.email}</div>
                    <div style={{ fontSize:10, color:T.text3, marginTop:2 }}>{user.setor}</div>
                  </div>
                  {isAdmin && (
                    <button onClick={()=>{setTab("admin");setAvatarOpen(false);}} style={{ width:"100%", padding:"10px 16px", background:"none", border:"none", color:T.text2, cursor:"pointer", fontFamily:"inherit", fontSize:12, textAlign:"left", display:"flex", alignItems:"center", gap:8 }}>
                      ⚙️ Administração
                    </button>
                  )}
                  <button onClick={()=>{logoutUser();setUser(null);}} style={{ width:"100%", padding:"10px 16px", background:"none", border:"none", color:T.red, cursor:"pointer", fontFamily:"inherit", fontSize:12, textAlign:"left", display:"flex", alignItems:"center", gap:8, borderTop:`1px solid ${T.border}` }}>
                    🚪 Sair do sistema
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── BODY: sidebar + content ── */}
        <div style={{ display:"flex", flex:1, overflow:"hidden" }} onClick={()=>{setNotifOpen(false);setAvatarOpen(false);}}>

          {/* SIDEBAR */}
          <div style={{ width:sidebarOpen?220:60, flexShrink:0, background:T.surf, borderRight:`1px solid ${T.border}`, display:"flex", flexDirection:"column", transition:"width .25s ease", overflow:"hidden", position:"sticky", top:60, height:"calc(100vh - 60px)" }}>
            <div style={{ padding:"8px 6px", flex:1, overflowY:"auto" }}>
              {MENU.map(item=>(
                <button key={item.id} className="menu-item" onClick={()=>setTab(item.id)} style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"10px 10px", border:"none", background: tab===item.id?T.accentDim:"transparent", color: tab===item.id?T.accent:T.text2, cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight: tab===item.id?600:400, borderRadius:10, marginBottom:2, transition:"all .15s", textAlign:"left", boxShadow: tab===item.id?`0 0 10px ${T.accentGlow}`:"none", border: tab===item.id?`1px solid ${T.accent}22`:"1px solid transparent", position:"relative", overflow:"hidden", whiteSpace:"nowrap" }}>
                  <span style={{ fontSize:16, flexShrink:0, width:20, textAlign:"center" }}>{item.icon}</span>
                  {sidebarOpen && <span style={{ flex:1, overflow:"hidden", textOverflow:"ellipsis" }}>{item.label}</span>}
                  {sidebarOpen && item.badge > 0 && (
                    <span style={{ background:T.red, color:"#fff", fontSize:9, fontWeight:700, borderRadius:10, padding:"1px 6px", flexShrink:0 }}>{item.badge}</span>
                  )}
                  {!sidebarOpen && item.badge > 0 && (
                    <span style={{ position:"absolute", top:4, right:4, width:8, height:8, borderRadius:"50%", background:T.red }} />
                  )}
                </button>
              ))}
            </div>

            {/* Sidebar footer */}
            {sidebarOpen && (
              <div style={{ padding:"12px 14px", borderTop:`1px solid ${T.border}`, fontSize:10, color:T.text3, lineHeight:1.6 }}>
                <div style={{ fontWeight:600, color:T.text2, marginBottom:2 }}>SGQ Herbamed®</div>
                <div>Sistema de Gestão da Qualidade</div>
                <div>v2.0 · {new Date().getFullYear()}</div>
              </div>
            )}
          </div>

          {/* MAIN CONTENT */}
          <div style={{ flex:1, overflowY:"auto", minWidth:0 }}>
            {/* Page header */}
            <div style={{ padding:"1.25rem 1.5rem .75rem", display:"flex", justifyContent:"space-between", alignItems:"center", borderBottom:`1px solid ${T.border}`, background:T.bg, position:"sticky", top:0, zIndex:50 }}>
              <div>
                <div style={{ fontSize:18, fontWeight:700, color:T.text }}>{PAGE_TITLES[tab]||tab}</div>
                <div style={{ fontSize:11, color:T.text3, marginTop:2 }}>
                  SGQ Herbamed® › {PAGE_TITLES[tab]||tab}
                </div>
              </div>
              {tab==="lista" && !isViewer && (
                <button style={{ padding:"8px 16px", border:`1px solid ${T.accent}33`, borderRadius:8, background:T.accentDim, color:T.accent, cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:600 }} onClick={()=>setTab("nova")}>
                  + Nova RNC
                </button>
              )}
            </div>

            <div style={{ padding:"1.5rem" }}>
              {tab==="lista"      && <ListaTab rncs={rncs} user={user} users={users} toast_={toast_} setTab={setTab} openEmail={openEmail} doUpdateRNC={doUpdateRNC} doDeleteRNC={doDeleteRNC} isViewer={isViewer} isAdmin={isAdmin} />}
              {tab==="nova"       && !isViewer && <NovaTab rncs={rncs} user={user} toast_={toast_} setTab={setTab} openEmail={openEmail} doSaveRNC={doSaveRNC} />}
              {tab==="ishikawa"   && !isViewer && <IshikawaTab rncs={rncs} toast_={toast_} openEmail={openEmail} doUpdateRNC={doUpdateRNC} user={user} isAdmin={isAdmin} />}
              {tab==="5w2h"       && !isViewer && <W2HTab rncs={rncs} user={user} toast_={toast_} openEmail={openEmail} doUpdateRNC={doUpdateRNC} isAdmin={isAdmin} />}
              {tab==="eficacia"   && !isViewer && <EficaciaTab rncs={rncs} toast_={toast_} openEmail={openEmail} doUpdateRNC={doUpdateRNC} user={user} isAdmin={isAdmin} />}
              {tab==="dashboard"  && <DashTab rncs={rncs} />}
              {tab==="relatorios" && <RelatoriosTab rncs={rncs} users={users} user={user} toast_={toast_} />}
              {tab==="admin"      && isAdmin && <AdminTab users={users} setUsers={setUsers} toast_={toast_} currentUser={user} />}
            </div>
          </div>
        </div>

        {emailCtx && <EmailModal rnc={emailCtx.rnc} users={users} currentUser={user} evento={emailCtx.evento} onClose={() => setEmailCtx(null)} onSent={msg => { toast_(msg, "green"); setEmailCtx(null); }} />}
        {toast && <Toast key={toast.key} msg={toast.msg} color={toast.color} onDone={() => setToast(null)} />}
      </div>
    </ThemeCtx.Provider>
  );
}

/* ─── LISTA TAB ──────────────────────────────────────────────────────────────── */
function ListaTab({ rncs, user, users, toast_, setTab, openEmail, doUpdateRNC, doDeleteRNC, isViewer, isAdmin }) {
  const T = useTheme(); const s = useS();
  const [q, setQ] = useState("");
  const [fSt, setFSt] = useState("");
  const [fTp, setFTp] = useState("");
  const [sel, setSel] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({});

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
    const h = { data: tod(), hora: new Date().toLocaleTimeString("pt-BR"), acao: `Status alterado → ${status}`, resp: user.name, tipo: "status" };
    await doUpdateRNC(id, { status, historico: [...(r?.historico || []), h] });
    setSel(p => p ? { ...p, status, historico: [...(p.historico || []), h] } : null);
    toast_("Status atualizado!", "green");
    const updated = { ...r, status, historico: [...(r?.historico || []), h] };
    openEmail(updated, "status");
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

  // Steps de progresso da RNC
  const getRNCStep = (r) => {
    if (r.status === "Eficaz" || r.status === "Ineficaz") return 4;
    if (r.eficacia?.resultado) return 4;
    if (r.w2h?.length > 0) return 3;
    if (r.ishikawa?.root) return 2;
    return 1;
  };

  const STEPS = ["Abertura", "Análise", "5W2H", "Eficácia"];

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
        <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, overflow:"hidden" }}>
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
              {sorted.map((r, idx) => {
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
      )}

      {/* MODAL */}
      {sel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.82)", backdropFilter: "blur(6px)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }} onClick={e => e.target === e.currentTarget && setSel(null)}>
          <div style={{ background: T.card2, border: `1px solid ${T.border2}`, borderRadius: 18, padding: "1.75rem", maxWidth: 760, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 32px 80px #000a" }}>

            {/* Header do modal */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{sel.num}</div>
                <div style={{ fontSize: 12, color: T.text2, marginTop: 2 }}>{sel.tipo} · {fmt(sel.data)} · {sel.detector || "—"}</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <SevB s={sel.sev} /><Badge s={sel.status} />
                {canEdit(sel) && !editing && (
                  <button onClick={() => startEdit(sel)} style={{ ...s.btn, fontSize: 11, padding: "6px 12px", color: T.accent, borderColor: T.accent + "33", background: T.accentDim }}>✏️ Editar</button>
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
                    <F lbl="Severidade" ch={<Sel value={editData.sev} onChange={e => setEditData(p => ({ ...p, sev: e.target.value }))}>{Object.keys(SEVMETA).map(x => <option key={x}>{x}</option>)}</Sel>} />
                    <F lbl="Setor" ch={<Inp value={editData.setor} onChange={e => setEditData(p => ({ ...p, setor: e.target.value }))} />} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <F lbl="Produto / Material" ch={<Inp value={editData.produto} onChange={e => setEditData(p => ({ ...p, produto: e.target.value }))} />} />
                    <F lbl="Fornecedor" ch={<Inp value={editData.fornecedor} onChange={e => setEditData(p => ({ ...p, fornecedor: e.target.value }))} />} />
                    <F lbl="Nº do lote" ch={<Inp value={editData.lote} onChange={e => setEditData(p => ({ ...p, lote: e.target.value }))} />} />
                    <F lbl="Quantidade afetada" ch={<Inp value={editData.qtd} onChange={e => setEditData(p => ({ ...p, qtd: e.target.value }))} />} />
                  </div>
                  <F lbl="Referência normativa" ch={<Inp value={editData.ref} onChange={e => setEditData(p => ({ ...p, ref: e.target.value }))} />} />
                  <F lbl="Evidências" ch={<Inp value={editData.evidencia} onChange={e => setEditData(p => ({ ...p, evidencia: e.target.value }))} />} />
                </div>
                <div style={{ ...s.card, marginBottom: "1rem" }}>
                  <SecTitle icon="📋" ch="Descrição" />
                  <F lbl="Descrição da não conformidade" ch={<TA rows={4} value={editData.desc} onChange={e => setEditData(p => ({ ...p, desc: e.target.value }))} />} />
                </div>
                <div style={{ ...s.card, marginBottom: "1rem" }}>
                  <SecTitle icon="⚡" ch="Ação de contenção" />
                  <F lbl="Ação realizada" ch={<TA rows={3} value={editData.contencao} onChange={e => setEditData(p => ({ ...p, contencao: e.target.value }))} />} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <F lbl="Responsável" ch={<Inp value={editData.respCont} onChange={e => setEditData(p => ({ ...p, respCont: e.target.value }))} />} />
                  </div>
                </div>
                <div style={{ ...s.card, marginBottom: "1rem" }}>
                  <SecTitle icon="🗓️" ch="Prazos" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <F lbl="Responsável análise" ch={<Inp value={editData.resp} onChange={e => setEditData(p => ({ ...p, resp: e.target.value }))} />} />
                    <F lbl="Prazo ação corretiva" ch={<Inp type="date" value={editData.prazoAC} onChange={e => setEditData(p => ({ ...p, prazoAC: e.target.value }))} />} />
                    <F lbl="Prazo eficácia" ch={<Inp type="date" value={editData.prazoEfic} onChange={e => setEditData(p => ({ ...p, prazoEfic: e.target.value }))} />} />
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

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: "1.25rem", borderTop: `1px solid ${T.border}`, paddingTop: "1rem" }}>
                  {isAdmin && <button style={s.btnD} onClick={() => del(sel.id)}>🗑️ Excluir</button>}
                  {!isViewer && <button style={{ ...s.btn, color: T.accent, borderColor: T.accent + "33", background: T.accentDim, display: "flex", alignItems: "center", gap: 6 }} onClick={() => openEmail(sel, "manual")}>✉️ Notificar</button>}
                  {canEdit(sel) && <button style={{ ...s.btn, color: T.accent, borderColor: T.accent + "33", background: T.accentDim }} onClick={() => startEdit(sel)}>✏️ Editar</button>}
                  <button style={s.btn} onClick={() => setSel(null)}>Fechar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── CLOUDINARY UPLOAD ──────────────────────────────────────────────────────── */
const CLOUD_NAME = "dswsg9w0w";
const UPLOAD_PRESET = "herbamed_rnc"; // será criado no Cloudinary

async function uploadToCloudinary(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", "herbamed-rnc");
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
    method: "POST", body: formData
  });
  const data = await res.json();
  if (data.secure_url) return { url: data.secure_url, name: file.name, type: file.type, size: file.size };
  throw new Error(data.error?.message || "Erro no upload");
}

function AnexosUpload({ anexos, setAnexos }) {
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
        const result = await uploadToCloudinary(file);
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
        onClick={() => document.getElementById("anexo-input").click()}
      >
        <div style={{ fontSize: 28, marginBottom: 8 }}>📎</div>
        <div style={{ fontSize: 13, color: T.text2, fontWeight: 500 }}>
          {uploading ? <span style={{ color: T.accent }}>{progress}</span> : "Clique ou arraste arquivos aqui"}
        </div>
        <div style={{ fontSize: 11, color: T.text3, marginTop: 4 }}>Fotos, PDFs, documentos — até 10MB por arquivo</div>
        <input id="anexo-input" type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" style={{ display: "none" }} onChange={e => handleFiles(Array.from(e.target.files))} />
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

/* ─── NOVA TAB ───────────────────────────────────────────────────────────────── */
function NovaTab({ user, toast_, setTab, openEmail, doSaveRNC }) {
  const s = useS();
  const [f, setF] = useState({ data: tod(), status: "Aberta", tipo: "Matéria-prima", sev: "Maior", produto: "", fornecedor: "", setor: user.setor || "", detector: user.name, desc: "", lote: "", qtd: "", ref: "", evidencia: "", contencao: "", respCont: "", dataContencao: "", resp: user.name, prazoCausa: "", prazoAC: "", prazoEfic: "" });
  const [anexos, setAnexos] = useState([]);
  const [ishikawa, setIshikawa] = useState({ efeito: "", causes: { mao: [], maquina: [], metodo: [], material: [], medicao: [], meioamb: [] }, whys: [], root: "", whyCausa: "" });
  const [w2h, setW2h] = useState([]);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

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
    if (!f.desc.trim()) { alert("Preencha a descrição."); return; }
    const nc = await incrementCounter();
    const rnc = { id: String(Date.now()), num: genNum(nc), ...f, anexos, ishikawa, w2h, eficacia: { criterio: "", data: "", resp: "", evidencias: "", resultado: "", obs: "" }, historico: [{ data: tod(), acao: "RNC aberta", resp: user.name }], criadoPor: user.name, createdAt: Date.now() };
    await doSaveRNC(rnc);
    toast_(`${rnc.num} registrada!`, "green");
    openEmail(rnc, "abertura");
    setTab("lista");
  };

  const rncPreview = { ...f, ishikawa, w2h };

  return (
    <div>
      <div style={{ ...s.card }}>
        <SecTitle icon="🪪" ch="Identificação" />
        <G3 ch={<><F lbl="Data de abertura" ch={<Inp type="date" value={f.data} onChange={e => set("data", e.target.value)} />} /><F lbl="Status" ch={<Sel value={f.status} onChange={e => set("status", e.target.value)}>{Object.keys(SMETA).map(x => <option key={x}>{x}</option>)}</Sel>} /><F lbl="Severidade" ch={<Sel value={f.sev} onChange={e => set("sev", e.target.value)}>{Object.keys(SEVMETA).map(x => <option key={x}>{x}</option>)}</Sel>} /></>} />
        <G3 ch={<>
          <F lbl="Tipo de não conformidade" ch={
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
          <F lbl="Setor" ch={<Inp value={f.setor} onChange={e => set("setor", e.target.value)} />} />
          <F lbl="Detectado por" ch={<Inp value={f.detector} onChange={e => set("detector", e.target.value)} />} />
        </>} />
        <G2 ch={<><F lbl="Produto / Material" ch={<Inp placeholder="Ex: Nome do produto — Lote XXXX" value={f.produto} onChange={e => set("produto", e.target.value)} />} /><F lbl="Fornecedor" ch={<Inp placeholder="Ex: Nome do fornecedor" value={f.fornecedor} onChange={e => set("fornecedor", e.target.value)} />} /></>} />
      </div>
      <div style={s.card}>
        <SecTitle icon="📝" ch="Descrição" />
        <F lbl="Descrição da não conformidade" ch={<TA rows={4} placeholder="Descreva o problema observado, local, data e impacto..." value={f.desc} onChange={e => set("desc", e.target.value)} />} />
        <G3 ch={<><F lbl="Nº do lote" ch={<Inp placeholder="Ex: LOTE-2025-XXX" value={f.lote} onChange={e => set("lote", e.target.value)} />} /><F lbl="Quantidade afetada" ch={<Inp placeholder="Ex: 100 kg / 500 unidades" value={f.qtd} onChange={e => set("qtd", e.target.value)} />} /><F lbl="Referência normativa" ch={<Inp placeholder="Ex: Farmacopeia Brasileira / Especificação interna" value={f.ref} onChange={e => set("ref", e.target.value)} />} /></>} />
        <F lbl="Evidências (descrição)" ch={<Inp value={f.evidencia} onChange={e => set("evidencia", e.target.value)} placeholder="Ex: Laudo de análise, registro fotográfico, relatório..." />} />
        <F lbl="📎 Anexos (fotos, laudos, documentos)" ch={<AnexosUpload anexos={anexos} setAnexos={setAnexos} />} />
      </div>

      {/* AI PANEL */}
      {f.desc.trim().length > 20 && (
        <AIPanel rnc={rncPreview} onApply={handleAIApply} />
      )}

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
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:"1rem" }}>
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
          <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10, marginBottom:"1rem" }}>
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

/* ─── RELATORIOS TAB ─────────────────────────────────────────────────────────── */
function RelatoriosTab({ rncs, users, user, toast_ }) {
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
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:"1rem" }}>
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
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12, marginBottom:"1rem" }}>
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

  // Calcular período automaticamente
  const aplicarPeriodo = (p) => {
    setPeriodo(p);
    const hoje = new Date();
    let inicio = new Date();
    if (p === "semanal") inicio.setDate(hoje.getDate() - 7);
    else if (p === "quinzenal") inicio.setDate(hoje.getDate() - 15);
    else if (p === "mensal") { inicio.setDate(1); }
    else if (p === "trimestral") { inicio.setMonth(hoje.getMonth() - 3); inicio.setDate(1); }
    setDataInicio(inicio.toISOString().split("T")[0]);
    setDataFim(hoje.toISOString().split("T")[0]);
  };

  // Filtrar RNCs
  const rncsFiltered = rncs.filter(r => {
    const noperiodo = r.data >= dataInicio && r.data <= dataFim;
    const noresp = !respFiltro || r.resp === respFiltro;
    const nostatus = !statusFiltro || r.status === statusFiltro;
    return noperiodo && noresp && nostatus;
  });

  // Estatísticas
  const stats = {
    total: rncsFiltered.length,
    abertas: rncsFiltered.filter(x => x.status === "Aberta").length,
    andamento: rncsFiltered.filter(x => x.status === "Em andamento").length,
    eficaz: rncsFiltered.filter(x => x.status === "Eficaz").length,
    ineficaz: rncsFiltered.filter(x => x.status === "Ineficaz").length,
    pendente: rncsFiltered.filter(x => x.status === "Pendente verificação").length,
    critica: rncsFiltered.filter(x => x.sev === "Crítica").length,
    maior: rncsFiltered.filter(x => x.sev === "Maior").length,
    menor: rncsFiltered.filter(x => x.sev === "Menor").length,
    vencidas: rncsFiltered.filter(x => x.prazoAC && x.prazoAC < tod() && x.status !== "Eficaz" && x.status !== "Ineficaz").length,
  };

  // Agrupar por responsável
  const porResp = {};
  rncsFiltered.forEach(r => {
    const resp = r.resp || "Não atribuído";
    if (!porResp[resp]) porResp[resp] = [];
    porResp[resp].push(r);
  });

  // Agrupar por tipo
  const porTipo = {};
  rncsFiltered.forEach(r => { porTipo[r.tipo] = (porTipo[r.tipo] || 0) + 1; });

  // Responsáveis únicos
  const resps = [...new Set(rncs.map(r => r.resp).filter(Boolean))].sort();

  // Gerar resumo com IA
  const gerarResumoIA = async () => {
    setLoadingAI(true); setAiResumo("");
    try {
      const txt = await askClaude(`Você é um especialista em qualidade. Gere um resumo executivo profissional em português para o relatório de não conformidades abaixo.

PERÍODO: ${fmt(dataInicio)} a ${fmt(dataFim)}
RESPONSÁVEL FILTRADO: ${respFiltro || "Todos"}
TOTAL DE RNCs: ${stats.total}
ABERTAS: ${stats.abertas}
EM ANDAMENTO: ${stats.andamento}
EFICAZES: ${stats.eficaz}
INEFICAZES: ${stats.ineficaz}
CRÍTICAS: ${stats.critica}
VENCIDAS: ${stats.vencidas}
TIPOS MAIS FREQUENTES: ${Object.entries(porTipo).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>`${k}(${v})`).join(", ")}

Gere um resumo executivo de 2-3 parágrafos com análise dos dados, pontos de atenção e recomendações. Seja objetivo e profissional.`);
      setAiResumo(txt);
    } catch { setAiResumo("Erro ao gerar resumo. Tente novamente."); }
    setLoadingAI(false);
  };

  // Enviar relatório por e-mail
  const enviarEmail = async () => {
    if (!emailDest) { alert("Informe o e-mail de destino."); return; }
    setEnviando(true);
    const corpo = `RELATÓRIO DE NÃO CONFORMIDADES — HERBAMED®
Período: ${fmt(dataInicio)} a ${fmt(dataFim)}
${respFiltro ? `Responsável: ${respFiltro}` : "Todos os responsáveis"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESUMO EXECUTIVO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total de RNCs: ${stats.total}
Abertas: ${stats.abertas} | Em andamento: ${stats.andamento}
Eficazes: ${stats.eficaz} | Ineficazes: ${stats.ineficaz}
Críticas: ${stats.critica} | Vencidas: ${stats.vencidas}

${aiResumo ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nANÁLISE IA\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${aiResumo}\n` : ""}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
POR RESPONSÁVEL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${Object.entries(porResp).map(([r, list]) => `${r}: ${list.length} RNC(s) — ${list.filter(x=>x.status==="Aberta").length} aberta(s)`).join("\n")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DETALHAMENTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${rncsFiltered.map(r => `${r.num} | ${r.status} | ${r.sev} | ${r.resp || "—"} | ${r.produto || r.tipo}
  ${r.desc?.substring(0,100)}...`).join("\n\n")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Herbamed® · Gestão da Qualidade
Gerado em: ${new Date().toLocaleString("pt-BR")}`;

    try {
      const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: "service_gxhicii",
          template_id: "template_4jl73wq",
          user_id: "z2VxJ1dYjwrRp8Nh4",
          template_params: {
            to_email: emailDest,
            to_name: emailDest,
            from_name: `${user.name} · Herbamed® Gestão da Qualidade`,
            subject: `📊 Relatório RNC — ${fmt(dataInicio)} a ${fmt(dataFim)}${respFiltro ? ` — ${respFiltro}` : ""}`,
            message: corpo,
            reply_to: user.email,
          }
        })
      });
      if (res.ok) toast_("Relatório enviado por e-mail!", "green");
      else toast_("Erro ao enviar e-mail.", "red");
    } catch { toast_("Erro ao enviar.", "red"); }
    setEnviando(false);
  };

  // Imprimir / PDF
  const imprimir = () => window.print();

  return (
    <div>
      {/* FILTROS */}
      <div style={s.card}>
        <SecTitle icon="📑" ch="Filtros do relatório" />
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          {["semanal", "quinzenal", "mensal", "trimestral", "personalizado"].map(p => (
            <button key={p} onClick={() => aplicarPeriodo(p)} style={{ padding: "7px 14px", borderRadius: 20, border: `1px solid ${periodo === p ? T.accent + "55" : T.border2}`, background: periodo === p ? T.accentDim : T.surf, color: periodo === p ? T.accent : T.text2, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: periodo === p ? 600 : 400, textTransform: "capitalize" }}>{p}</button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
          <F lbl="Data início" ch={<Inp type="date" value={dataInicio} onChange={e => { setDataInicio(e.target.value); setPeriodo("personalizado"); }} />} />
          <F lbl="Data fim" ch={<Inp type="date" value={dataFim} onChange={e => { setDataFim(e.target.value); setPeriodo("personalizado"); }} />} />
          <F lbl="Responsável" ch={<Sel value={respFiltro} onChange={e => setRespFiltro(e.target.value)}>
            <option value="">Todos os responsáveis</option>
            {resps.map(r => <option key={r}>{r}</option>)}
          </Sel>} />
          <F lbl="Status" ch={<Sel value={statusFiltro} onChange={e => setStatusFiltro(e.target.value)}>
            <option value="">Todos os status</option>
            {Object.keys(SMETA).map(s => <option key={s}>{s}</option>)}
          </Sel>} />
        </div>
      </div>

      {/* STATS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: "1rem" }}>
        {[["Total", stats.total, T.accent], ["Abertas", stats.abertas, "#ff4f6a"], ["Eficazes", stats.eficaz, T.accent], ["Críticas", stats.critica, "#ff8c42"], ["Vencidas", stats.vencidas, "#ffd166"]].map(([l, n, c]) => (
          <div key={l} style={{ background: T.card, border: `1px solid ${c}22`, borderRadius: 14, padding: "1rem", textAlign: "center", boxShadow: `0 0 16px ${c}15` }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: c, lineHeight: 1 }}>{n}</div>
            <div style={{ fontSize: 11, color: T.text2, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", marginTop: 4 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* POR RESPONSÁVEL */}
      <div style={s.card}>
        <SecTitle icon="👤" ch="Distribuição por responsável" />
        {Object.keys(porResp).length === 0 ? (
          <div style={{ color: T.text3, fontSize: 13, textAlign: "center", padding: "1rem" }}>Nenhuma RNC encontrada no período.</div>
        ) : Object.entries(porResp).sort((a, b) => b[1].length - a[1].length).map(([resp, list]) => {
          const max = Math.max(...Object.values(porResp).map(l => l.length), 1);
          const ab = list.filter(x => x.status === "Aberta").length;
          const ef = list.filter(x => x.status === "Eficaz").length;
          const venc = list.filter(x => x.prazoAC && x.prazoAC < tod() && x.status !== "Eficaz").length;
          return (
            <div key={resp} style={{ background: T.surf, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 16px", marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: `linear-gradient(135deg,${T.accent},${T.accent2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff" }}>{resp[0]}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{resp}</div>
                    <div style={{ fontSize: 11, color: T.text2 }}>{list.length} RNC(s) · {ab} aberta(s) · {ef} eficaz(es){venc > 0 ? ` · ⚠ ${venc} vencida(s)` : ""}</div>
                  </div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: T.accent }}>{list.length}</div>
              </div>
              <div style={{ height: 6, background: T.card, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.round(list.length / max * 100)}%`, background: `linear-gradient(to right,${T.accent},${T.accent2})`, borderRadius: 3 }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* GRÁFICO POR TIPO */}
      <div style={s.card}>
        <SecTitle icon="📊" ch="Distribuição por tipo" />
        {Object.entries(porTipo).sort((a, b) => b[1] - a[1]).map(([tipo, n]) => {
          const max = Math.max(...Object.values(porTipo), 1);
          return (
            <div key={tipo} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div style={{ minWidth: 160, fontSize: 12, color: T.text2, fontWeight: 500 }}>{tipo}</div>
              <div style={{ flex: 1, height: 8, background: T.surf, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.round(n / max * 100)}%`, background: TIPOC[tipo] || T.accent, borderRadius: 4, transition: "width .6s ease", boxShadow: `0 0 8px ${TIPOC[tipo] || T.accent}60` }} />
              </div>
              <div style={{ minWidth: 24, fontSize: 12, color: T.text2, fontWeight: 700 }}>{n}</div>
            </div>
          );
        })}
        {Object.keys(porTipo).length === 0 && <div style={{ color: T.text3, fontSize: 13, textAlign: "center", padding: "1rem" }}>Sem dados no período.</div>}
      </div>

      {/* RESUMO IA */}
      <div style={{ background: `linear-gradient(135deg, ${T.accentDim}, ${T.card2})`, border: `1px solid ${T.accent}33`, borderRadius: 14, padding: "1.25rem", marginBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: aiResumo ? "1rem" : 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg,${T.accent},${T.accent2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🤖</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Análise executiva com IA</div>
              <div style={{ fontSize: 11, color: T.text2 }}>Resumo inteligente gerado pelo Claude</div>
            </div>
          </div>
          <button style={{ ...s.btnA, display: "flex", alignItems: "center", gap: 6, opacity: loadingAI ? .6 : 1 }} onClick={gerarResumoIA} disabled={loadingAI}>
            {loadingAI ? <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span> Analisando...</> : "✨ Gerar análise"}
          </button>
        </div>
        {aiResumo && <div style={{ background: T.surf, borderRadius: 10, padding: "1rem", fontSize: 13, color: T.text, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{aiResumo}</div>}
      </div>

      {/* LISTAGEM DETALHADA */}
      <div style={s.card}>
        <SecTitle icon="📋" ch={`Detalhamento — ${rncsFiltered.length} RNC(s)`} />
        {rncsFiltered.length === 0 ? (
          <div style={{ color: T.text3, fontSize: 13, textAlign: "center", padding: "1.5rem" }}>Nenhuma RNC no período/filtro selecionado.</div>
        ) : rncsFiltered.map(r => (
          <div key={r.id} style={{ background: T.surf, border: `1px solid ${T.border}`, borderLeft: `3px solid ${SMETA[r.status]?.dot || T.accent}`, borderRadius: 10, padding: "10px 14px", marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: T.accent }}>{r.num}</span>
                <SevB s={r.sev} />
                <Badge s={r.status} />
              </div>
              <div style={{ fontSize: 11, color: T.text2 }}>{fmt(r.data)}</div>
            </div>
            <div style={{ fontSize: 13, color: T.text, marginBottom: 4 }}>{r.desc?.substring(0, 80)}...</div>
            <div style={{ fontSize: 11, color: T.text2 }}>
              {r.tipo} · {r.produto || "—"} · Resp: <b style={{ color: T.text }}>{r.resp || "—"}</b>
              {past(r.prazoAC) && r.status !== "Eficaz" ? <span style={{ color: "#ff4f6a", marginLeft: 8, fontWeight: 600 }}>⚠ PRAZO VENCIDO</span> : ""}
            </div>
          </div>
        ))}
      </div>

      {/* AÇÕES */}
      <div style={{ ...s.card, display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <F lbl="Enviar relatório por e-mail para:" ch={<Inp placeholder="email@herbamed.com.br" value={emailDest} onChange={e => setEmailDest(e.target.value)} />} />
        </div>
        <button style={{ ...s.btnA, display: "flex", alignItems: "center", gap: 6, opacity: enviando ? .6 : 1, marginBottom: 14 }} onClick={enviarEmail} disabled={enviando}>
          {enviando ? "Enviando..." : "✉️ Enviar por e-mail"}
        </button>
        <button style={{ ...s.btn, display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }} onClick={imprimir}>
          🖨️ Imprimir / PDF
        </button>
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
                  <F lbl="Perfil" ch={<Sel value={editData.role} onChange={e => setEditData(p => ({ ...p, role: e.target.value }))}>
                    <option value="admin">Admin — acesso total</option>
                    <option value="user">Usuário — cria e edita suas RNCs</option>
                    <option value="viewer">Visualizador — apenas leitura</option>
                  </Sel>} />
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
                  <span style={{ display: "inline-flex", padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: u.role === "admin" ? T.accentDim : u.role === "viewer" ? "#4fc3f718" : T.border, color: u.role === "admin" ? T.accent : u.role === "viewer" ? "#4fc3f7" : T.text2 }}>{u.role === "admin" ? "Admin" : u.role === "viewer" ? "👁️ Visualizador" : "Usuário"}</span>
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
          <F lbl="Perfil de acesso" ch={<Sel value={nu.role} onChange={e => set("role", e.target.value)}>
            <option value="user">Usuário — cria e edita suas RNCs</option>
            <option value="admin">Admin — acesso total</option>
            <option value="viewer">Visualizador — apenas leitura</option>
          </Sel>} />
        </>} />
        <div style={{ textAlign: "right", marginTop: 6 }}><button style={s.btnA} onClick={addUser}>Criar usuário ✓</button></div>
      </div>
    </div>
  );
}

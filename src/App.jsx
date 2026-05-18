import React, { useState, useEffect, useCallback, createContext, useContext } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RcTooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from "recharts";
import { auth, loginUser, logoutUser, getUser, saveUser, createAuthUser,
         deleteUser as fbDeleteUser, updateUser, getAllUsers,
         saveRNC, updateRNC, deleteRNC as fbDeleteRNC, subscribeRNCs,
         incrementCounter, peekDailyCounter, saveCollection, deleteFromCollection,
         subscribeCollection } from "./firebase";
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
    name: "☀️ Light Claro", light: true,
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
  midnight: {
    name: "🌙 Midnight",
    bg: "#0d0d1a", surf: "#12122a", card: "#16163a", card2: "#1a1a44",
    accent: "#9d7fff", accent2: "#5b3fc8", accentDim: "#9d7fff18",
    accentGlow: "#9d7fff40", text: "#e8e4ff", text2: "#8b87b8", text3: "#4a4680",
    border: "rgba(157,127,255,0.1)", border2: "rgba(157,127,255,0.2)",
    red: "#ff6b8a", yellow: "#ffd166", blue: "#7eb8ff", orange: "#ffaa5c", purple: "#c084fc",
  },
  macos: {
    name: "🍎 macOS", light: true,
    bg: "#f0f0f5", surf: "#ffffff", card: "#ffffff", card2: "#f5f5fa",
    accent: "#007aff", accent2: "#0055cc", accentDim: "#007aff12",
    accentGlow: "#007aff30", text: "#1c1c1e", text2: "#6e6e73", text3: "#aeaeb2",
    border: "rgba(0,0,0,0.08)", border2: "rgba(0,0,0,0.14)",
    red: "#ff3b30", yellow: "#ff9500", blue: "#007aff", orange: "#ff6b00", purple: "#af52de",
  },
  win2k: {
    name: "🖥️ Windows 2000", light: true,
    bg: "#008080", surf: "#d4d0c8", card: "#d4d0c8", card2: "#c0bdb5",
    accent: "#000080", accent2: "#00006a", accentDim: "#00008015",
    accentGlow: "#00008030", text: "#000000", text2: "#444444", text3: "#888888",
    border: "rgba(0,0,0,0.25)", border2: "rgba(0,0,0,0.4)",
    red: "#cc0000", yellow: "#ccaa00", blue: "#000080", orange: "#cc6600", purple: "#660066",
  },
  winxp: {
    name: "🪟 Windows XP", light: true,
    bg: "#236dcd", surf: "#ece9d8", card: "#ffffff", card2: "#f1efe2",
    accent: "#0a6ed1", accent2: "#084fa0", accentDim: "#0a6ed115",
    accentGlow: "#0a6ed130", text: "#000000", text2: "#444444", text3: "#888888",
    border: "rgba(0,0,0,0.15)", border2: "rgba(0,0,0,0.25)",
    red: "#cc0000", yellow: "#e6a817", blue: "#0a6ed1", orange: "#e6720a", purple: "#7b0099",
  },
};

const ThemeCtx = createContext(null);
const useTheme = () => useContext(ThemeCtx);
const FormalCtx = createContext(false);
const useFormal = () => useContext(FormalCtx);

// Remove emojis de strings quando modo formal ativo
function stripEmoji(str) {
  return String(str).replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{1F300}-\u{1FAFF}]/gu, "").replace(/\s+/g, " ").trim();
}

// Hook para retornar texto com ou sem emoji
function useFT() {
  const formal = useFormal();
  return (str) => (formal && typeof str === "string") ? stripEmoji(str) : str;
}

const MENU_SVG_ICONS = {
  "home": `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>`,
  "lista": `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2"/></svg>`,
  "nova": `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  "dashboard": `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`,
  "relatorios": `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  "cep": `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
  "fmea": `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  "nqa": `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  "cq-materiais": `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/></svg>`,
  "cq-analises": `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2h-4"/><polyline points="9 3 9 11 12 8 15 11 15 3"/></svg>`,
  "cq-dashboard": `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  "ipc": `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3h-8a2 2 0 00-2 2v2h12V5a2 2 0 00-2-2z"/></svg>`,
  "ipc-produtos": `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>`,
  "fornecedores": `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`,
  "auditorias": `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  "laudos": `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  "clientes": `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
  "admin": `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M5.34 17.66l-1.41 1.41M21 12h-2M5 12H3M17.66 17.66l1.41 1.41M4.93 4.93l1.41 1.41"/></svg>`,
  "ishikawa": `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="12" x2="9" y2="6"/><line x1="3" y1="12" x2="9" y2="18"/><line x1="9" y1="12" x2="15" y2="7"/><line x1="9" y1="12" x2="15" y2="17"/><line x1="15" y1="12" x2="19" y2="9"/><line x1="15" y1="12" x2="19" y2="15"/></svg>`,
  "5w2h": `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  "eficacia": `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>`,
  "fmea": `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  "dashboard": `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`,
  "cep": `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
  "relatorios": `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  "lista": `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2"/></svg>`,
  "nova": `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  "gestao-docs": `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="12" y1="10" x2="12" y2="16"/></svg>`,
  "audit-log": `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>`,
  "producao-processos": `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M7 8h2v6H7zM11 8h2v4h-2zM15 8h2v6h-2z"/></svg>`,
};


/* ─── UTILS ─────────────────────────────────────────────────────────────────── */
const tod = () => new Date().toISOString().split("T")[0];
const fmt = d => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "—";
const past = d => d && d < tod();
const genNum = c => String(c);

const applyMask = (tipo, val) => {
  const d = (val || "").replace(/\D/g, "");
  if (tipo === "cnpj") {
    const n = d.slice(0, 14);
    if (n.length <= 2)  return n;
    if (n.length <= 5)  return `${n.slice(0,2)}.${n.slice(2)}`;
    if (n.length <= 8)  return `${n.slice(0,2)}.${n.slice(2,5)}.${n.slice(5)}`;
    if (n.length <= 12) return `${n.slice(0,2)}.${n.slice(2,5)}.${n.slice(5,8)}/${n.slice(8)}`;
    return `${n.slice(0,2)}.${n.slice(2,5)}.${n.slice(5,8)}/${n.slice(8,12)}-${n.slice(12)}`;
  }
  if (tipo === "telefone") {
    const n = d.slice(0, 11);
    if (n.length <= 2)  return n.length ? `(${n}` : n;
    if (n.length <= 6)  return `(${n.slice(0,2)}) ${n.slice(2)}`;
    if (n.length <= 10) return `(${n.slice(0,2)}) ${n.slice(2,6)}-${n.slice(6)}`;
    return `(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`;
  }
  if (tipo === "cep") {
    const n = d.slice(0, 8);
    if (n.length <= 5) return n;
    return `${n.slice(0,5)}-${n.slice(5)}`;
  }
  return val;
};

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

/* ─── PAGINACAO ──────────────────────────────────────────────────────────────── */
function usePagination(items, perPage = 20) {
  const [page, setPage] = useState(1);
  const total = Math.ceil(items.length / perPage) || 1;
  const safePage = Math.min(page, total);
  const paginated = items.slice((safePage - 1) * perPage, safePage * perPage);
  useEffect(() => { setPage(1); }, [items.length]);
  return { paginated, page: safePage, total, setPage };
}

function Pagination({ page, total, setPage }) {
  const T = useTheme();
  if (total <= 1) return null;
  const pages = [];
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= page - 2 && i <= page + 2)) pages.push(i);
    else if (pages[pages.length - 1] !== "...") pages.push("...");
  }
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6, padding:"1rem 0", flexWrap:"wrap" }}>
      <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
        style={{ padding:"6px 12px", borderRadius:8, border:"1px solid "+T.border2, background:T.surf, color:page===1?T.text3:T.text2, cursor:page===1?"not-allowed":"pointer", fontSize:12, fontFamily:"inherit" }}>
        Ant.
      </button>
      {pages.map((p, i) => p === "..." ? (
        <span key={"e"+i} style={{ padding:"6px 4px", color:T.text3, fontSize:12 }}>...</span>
      ) : (
        <button key={p} onClick={() => setPage(p)}
          style={{ padding:"6px 10px", borderRadius:8, border:"1px solid "+(p===page?T.accent:T.border2), background:p===page?T.accentDim:T.surf, color:p===page?T.accent:T.text2, cursor:"pointer", fontSize:12, fontFamily:"inherit", fontWeight:p===page?700:400, minWidth:32 }}>
          {p}
        </button>
      ))}
      <button onClick={() => setPage(p => Math.min(total, p + 1))} disabled={page === total}
        style={{ padding:"6px 12px", borderRadius:8, border:"1px solid "+T.border2, background:T.surf, color:page===total?T.text3:T.text2, cursor:page===total?"not-allowed":"pointer", fontSize:12, fontFamily:"inherit" }}>
        Prox.
      </button>
      <span style={{ fontSize:11, color:T.text3, marginLeft:4 }}>Pag. {page} de {total}</span>
    </div>
  );
}


function Tooltip({ text }) {
  const T = useTheme();
  const [show, setShow] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (!show) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setShow(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [show]);

  return (
    <span ref={ref} style={{ position:"relative", display:"inline-flex", alignItems:"center", marginLeft:5, verticalAlign:"middle", flexShrink:0 }}>
      <span
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(v => !v)}
        style={{ width:15, height:15, borderRadius:"50%", background:T.accent+"22", border:`1px solid ${T.accent}44`, color:T.accent, fontSize:9, fontWeight:700, display:"inline-flex", alignItems:"center", justifyContent:"center", cursor:"pointer", userSelect:"none", lineHeight:1, flexShrink:0 }}>
        ?
      </span>
      {show && (
        <span style={{ position:"absolute", bottom:"calc(100% + 6px)", left:"50%", transform:"translateX(-50%)", background:T.card, border:`1px solid ${T.border}`, borderRadius:8, padding:"8px 12px", fontSize:11, color:T.text2, lineHeight:1.5, whiteSpace:"normal", width:220, boxShadow:"0 4px 16px #0004", zIndex:9999, pointerEvents:"none" }}>
          <span style={{ display:"block", marginBottom:3, color:T.accent, fontWeight:700, fontSize:10, textTransform:"uppercase" }}>💡 Ajuda</span>
          {text}
          <span style={{ position:"absolute", bottom:-5, left:"50%", transform:"translateX(-50%)", width:10, height:10, background:T.card, border:`1px solid ${T.border}`, borderRadius:1, rotate:"45deg", borderTop:"none", borderLeft:"none" }} />
        </span>
      )}
    </span>
  );
}

function F({ lbl, ch, tip }) { const s = useS(); return <div style={{ marginBottom: 14 }}><label style={{ ...s.lbl, display:"flex", alignItems:"center", flexWrap:"wrap", gap:2 }}>{lbl}{tip && <Tooltip text={tip}/>}</label>{ch}</div>; }
function Inp({ sx, ...p }) { const s = useS(); return <input style={{ ...s.inp, ...sx }} {...p} />; }
function MaskedInp({ mask, value, onChange, sx, ...p }) {
  const s = useS();
  const handleChange = (e) => {
    const masked = applyMask(mask, e.target.value);
    onChange({ ...e, target: { ...e.target, value: masked } });
  };
  return <input style={{ ...s.inp, ...sx }} value={value} onChange={handleChange} {...p} />;
}
function Sel({ sx, children, ...p }) { const T = useTheme(); const s = useS(); return <select style={{ ...s.inp, colorScheme: T.light ? "light" : "dark", background: T.surf, color: T.text, ...sx }} {...p}>{children}</select>; }
function TA({ sx, ...p }) { const s = useS(); return <textarea style={{ ...s.inp, minHeight: 72, resize: "vertical", ...sx }} {...p} />; }
function G2({ ch }) { return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>{ch}</div>; }
function G3({ ch }) { return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>{ch}</div>; }
function Divider() { const T = useTheme(); return <div style={{ height: 1, background: T.border, margin: "1rem 0" }} />; }

function SecTitle({ icon, ch }) {
  const T = useTheme();
  const formal = useFormal();
  return <div style={{ fontSize: 10, fontWeight: 700, color: T.text3, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: "1rem", display: "flex", alignItems: "center", gap: 6 }}>
    <span style={{ display: "block", width: 3, height: 13, background: `linear-gradient(to bottom,${T.accent},${T.accent2})`, borderRadius: 2 }} />
    {icon && !formal && <span>{icon}</span>}{ch}
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
    const validTo = to.filter(e => e && e.includes("@"));
    if (!validTo.length) { setErr("Nenhum destinatário com e-mail válido selecionado."); return; }
    setSending(true); setErr("");
    try {
      // Envia um e-mail para cada destinatário via EmailJS
      const EMAILJS_SERVICE  = "service_gxhicii";
      const EMAILJS_TEMPLATE = "template_4jl73wq";
      const EMAILJS_KEY      = "z2VxJ1dYjwrRp8Nh4";

      for (const email of validTo) {
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
      onSent(`E-mail enviado para ${validTo.length} destinatário(s)!`);
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
                💡 Você pode enviar automaticamente <b>ou</b> copiar o conteúdo e colar no seu e-mail.
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
                  {/* Botão copiar conteúdo */}
                  <button style={{ ...s.btn, color:"#ff8c42", borderColor:"#ff8c4233", background:"#ff8c4212", display:"flex", alignItems:"center", gap:6 }}
                    onClick={() => {
                      const texto = `Para: ${to.join(", ")}\nAssunto: ${subject}\n\n${body}`;
                      navigator.clipboard.writeText(texto).then(() => {
                        onSent("Conteúdo copiado! Cole no seu e-mail.");
                      }).catch(() => {
                        // fallback para navegadores antigos
                        const ta = document.createElement("textarea");
                        ta.value = texto;
                        document.body.appendChild(ta);
                        ta.select();
                        document.execCommand("copy");
                        document.body.removeChild(ta);
                        onSent("Conteúdo copiado! Cole no seu e-mail.");
                      });
                    }}>
                    📋 Copiar conteúdo
                  </button>
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
function ThemePicker({ current, onChange, formal, onToggleFormal }) {
  const T = useTheme(); const s = useS();
  const [open, setOpen] = useState(false);
  return (
    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
      {/* Toggle Modo Formal */}
      <button
        onClick={onToggleFormal}
        title={formal ? "Desativar Modo Formal" : "Ativar Modo Formal"}
        style={{ ...s.btn, padding:"6px 10px", fontSize:11, display:"flex", alignItems:"center", gap:5,
          background: formal ? T.accent : "transparent",
          color: formal ? (T.light?"#fff":"#fff") : T.text2,
          border: `1px solid ${formal ? T.accent : T.border2}`,
        }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3h-8a2 2 0 00-2 2v2h12V5a2 2 0 00-2-2z"/></svg>
        {formal ? "Formal ON" : "Formal"}
      </button>
      {/* Seletor de tema */}
      <div style={{ position: "relative" }}>
        <button style={{ ...s.btn, padding: "6px 12px", fontSize: 11, display: "flex", alignItems: "center", gap: 6 }} onClick={() => setOpen(o => !o)}>
          {formal ? "" : "🎨 "}{THEMES[current].name}
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
        <div style={{ position:"absolute", inset:0, backgroundImage:"url('https://res.cloudinary.com/dswsg9w0w/image/upload/2d2ff8b9-3439-4a2b-ab66-229769585268_dvsxdh')", backgroundSize:"cover", backgroundPosition:"center center", filter:"brightness(0.9)" }} />
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom, rgba(5,30,15,0.2) 0%, rgba(5,20,10,0.5) 70%, rgba(5,15,8,0.85) 100%)" }} />
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(to right, transparent 60%, #0a110c 100%)" }} />

        {/* Content */}
        <div style={{ position:"relative", zIndex:1, display:"flex", flexDirection:"column", justifyContent:"center", height:"100%", padding:"2.5rem" }}>
          {/* Top tag */}
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(42,184,74,0.15)", border:"1px solid rgba(42,184,74,0.3)", borderRadius:20, padding:"5px 14px", width:"fit-content", marginBottom:"2rem" }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:"#2ab84a", animation:"pulse 2s infinite", display:"inline-block" }} />
            <span style={{ fontSize:11, fontWeight:600, color:"#2ab84a", textTransform:"uppercase", letterSpacing:".1em" }}>Sistema Online</span>
          </div>

          {/* Main text */}
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

/* ─── SIDEBAR NAV ────────────────────────────────────────────────────────────── */
function SidebarGrupo({ grupo, tab, setTab, sidebarOpen, T, defaultOpen }) {
  const grupoAtivo = grupo.items.some(i => i.id === tab);
  const [open, setOpen] = useState(() => defaultOpen);
  const grupoBadge = grupo.items.reduce((s,i) => s + (i.badge||0), 0);
  const formal = useFormal();

  return (
    <div style={{ marginBottom:2 }}>
      {sidebarOpen ? (
        <button onClick={()=>setOpen(o=>!o)} style={{ width:"100%", display:"flex", alignItems:"center", gap:8, padding:"7px 8px", border:"none", background: grupoAtivo?`${T.accent}12`:"transparent", color: grupoAtivo?T.accent:T.text3, cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:700, borderRadius:8, textAlign:"left", textTransform:"uppercase", letterSpacing:".06em", transition:"all .15s", marginTop:4 }}>
          {!formal && <span style={{ fontSize:12, flexShrink:0 }}>{grupo.icon}</span>}
          <span style={{ flex:1 }}>{grupo.label}</span>
          {grupoBadge>0 && <span style={{ background:T.red, color:"#fff", fontSize:8, fontWeight:700, borderRadius:10, padding:"1px 5px" }}>{grupoBadge}</span>}
          <span style={{ fontSize:8, opacity:.4, transition:"transform .2s", display:"inline-block", transform:open?"rotate(180deg)":"rotate(0)" }}>▼</span>
        </button>
      ) : (
        <div style={{ height:1, background:T.border, margin:"4px 6px" }} />
      )}
      {(open || !sidebarOpen) && grupo.items.map(item=>(
        <button key={item.id} onClick={()=>setTab(item.id)} style={{ width:"100%", display:"flex", alignItems:"center", gap:8, padding: sidebarOpen?"7px 10px 7px 22px":"8px 10px", border: tab===item.id?`1px solid ${T.accent}22`:"1px solid transparent", background: tab===item.id?T.accentDim:"transparent", color: tab===item.id?T.accent:T.text2, cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight: tab===item.id?600:400, borderRadius:8, marginBottom:1, transition:"all .15s", textAlign:"left", boxShadow: tab===item.id?`0 0 8px ${T.accentGlow}`:"none", whiteSpace:"nowrap", overflow:"hidden", position:"relative" }}>
          {formal && MENU_SVG_ICONS[item.id]
            ? <span style={{ display:"flex", alignItems:"center", flexShrink:0, width:18, justifyContent:"center" }} dangerouslySetInnerHTML={{ __html: MENU_SVG_ICONS[item.id] }} />
            : <span style={{ fontSize:15, flexShrink:0, width:18, textAlign:"center" }}>{item.icon}</span>
          }
          {sidebarOpen && <span style={{ flex:1, overflow:"hidden", textOverflow:"ellipsis", fontSize:12 }}>{item.label}</span>}
          {sidebarOpen && (item.badge||0)>0 && <span style={{ background:T.red, color:"#fff", fontSize:8, fontWeight:700, borderRadius:10, padding:"1px 5px", flexShrink:0 }}>{item.badge}</span>}
          {!sidebarOpen && (item.badge||0)>0 && <span style={{ position:"absolute", top:3, right:3, width:6, height:6, borderRadius:"50%", background:T.red }} />}
        </button>
      ))}
    </div>
  );
}

function SidebarNav({ T, tab, setTab, sidebarOpen, rncs, isViewer, isAdmin }) {
  const GRUPOS = [
    { id:"principal", icon:"📋", label:"RNCs", items:[
      { id:"lista", icon:"📋", label:"Registros", badge: rncs.filter(x=>x.status==="Aberta").length },
      ...(!isViewer?[{ id:"nova", icon:"➕", label:"Nova RNC" }]:[]),
    ]},
    ...(!isViewer?[{ id:"qualidade", icon:"🔬", label:"Ferramentas da Qualidade", items:[
      { id:"ishikawa", icon:"🐟", label:"Ishikawa / 5 Porquês" },
      { id:"5w2h",     icon:"📌", label:"5W2H" },
      { id:"eficacia", icon:"✅", label:"Eficácia" },
      { id:"fmea",     icon:"⚠️", label:"FMEA" },
    ]}]:[]),
    { id:"cq", icon:"🧪", label:"Controle de Qualidade", items:[
      { id:"cq-materiais", icon:"🧪", label:"Entrada de Materiais" },
      { id:"cq-analises",  icon:"📋", label:"Análises" },
      { id:"cq-dashboard", icon:"📈", label:"Dashboard CQ" },
      { id:"nqa",          icon:"📐", label:"NQA / AQL" },
    ]},
    { id:"producao", icon:"🏗️", label:"Produção", items:[
      { id:"producao-processos", icon:"🏗️", label:"Controle de Processos" },
      { id:"ipc",                icon:"🏭", label:"Controle de Processo IPC" },
      { id:"ipc-produtos",       icon:"📦", label:"Produtos IPC" },
    ]},
    { id:"analise", icon:"📊", label:"Indicadores", items:[
      { id:"dashboard",  icon:"📊", label:"Dashboard" },
      { id:"cep",        icon:"📉", label:"CEP" },
      { id:"relatorios", icon:"📑", label:"Relatórios" },
    ]},
    { id:"cadastros", icon:"🏢", label:"Cadastros", items:[
      { id:"fornecedores", icon:"🏭", label:"Fornecedores" },
      { id:"clientes",     icon:"🏢", label:"Clientes Terceiros" },
      { id:"laudos",       icon:"📋", label:"Laudos Analíticos" },
    ]},
    { id:"gestao", icon:"🗂️", label:"Documentos & Gestão", items:[
      { id:"gestao-docs",  icon:"🗂️", label:"Gestão de Docs" },
      { id:"auditorias",   icon:"🔍", label:"Auditorias" },
      ...(isAdmin?[{ id:"audit-log", icon:"🛡️", label:"Trilha de Auditoria" }]:[]),
      ...(isAdmin?[{ id:"admin",     icon:"⚙️", label:"Administração" }]:[]),
    ]},
  ];

  return (
    <div style={{ width:sidebarOpen?220:60, flexShrink:0, background:T.surf, borderRight:`1px solid ${T.border}`, display:"flex", flexDirection:"column", transition:"width .25s ease", overflow:"hidden", position:"sticky", top:60, height:"calc(100vh - 60px)" }}>
      <div style={{ padding:"6px 6px", flex:1, overflowY:"auto" }}>
        {GRUPOS.map(grupo=>(
          <SidebarGrupo
            key={grupo.id}
            grupo={grupo}
            tab={tab}
            setTab={setTab}
            sidebarOpen={sidebarOpen}
            T={T}
            defaultOpen={grupo.id==="principal" || grupo.items.some(i=>i.id===tab)}
          />
        ))}
      </div>
      {sidebarOpen && (
        <div style={{ padding:"10px 14px", borderTop:`1px solid ${T.border}`, fontSize:10, color:T.text3 }}>
          <div style={{ fontWeight:600, color:T.text2, marginBottom:1 }}>SGQ Herbamed®</div>
          <div>v2.0 · {new Date().getFullYear()}</div>
        </div>
      )}
    </div>
  );
}

/* ─── MAIN APP ───────────────────────────────────────────────────────────────── */
export default function App() {
  const [themeKey, setThemeKey] = useState(() => localStorage.getItem("hm_theme") || "herbamed");
  const [formalMode, setFormalMode] = useState(() => localStorage.getItem("hm_formal") === "true");
  const T = THEMES[themeKey];
  const changeTheme = key => { setThemeKey(key); localStorage.setItem("hm_theme", key); };
  const toggleFormal = () => { const v = !formalMode; setFormalMode(v); localStorage.setItem("hm_formal", String(v)); };

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tab, setTab] = useState("home");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [rncs, setRncs] = useState([]);
  const [users, setUsers] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [toast, setToast] = useState(null);
  const [emailCtx, setEmailCtx] = useState(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);
  const [sessionWarning, setSessionWarning] = useState(false);
  const [sessionCountdown, setSessionCountdown] = useState(120);

  // ── AUTO-LOGOUT POR INATIVIDADE (15 minutos) ──
  useEffect(() => {
    if (!user) return;
    const TIMEOUT = 15 * 60 * 1000; // 15 min
    const WARNING = 13 * 60 * 1000; // aviso aos 13 min (2 min antes)
    let warningTimer, logoutTimer, countdownInterval;

    const resetTimers = () => {
      clearTimeout(warningTimer);
      clearTimeout(logoutTimer);
      clearInterval(countdownInterval);
      setSessionWarning(false);
      setSessionCountdown(120);

      warningTimer = setTimeout(() => {
        setSessionWarning(true);
        let cnt = 120;
        setSessionCountdown(cnt);
        countdownInterval = setInterval(() => {
          cnt -= 1;
          setSessionCountdown(cnt);
          if (cnt <= 0) clearInterval(countdownInterval);
        }, 1000);
      }, WARNING);

      logoutTimer = setTimeout(() => {
        logoutUser();
        setUser(null);
        setSessionWarning(false);
      }, TIMEOUT);
    };

    const events = ["mousemove","mousedown","keypress","scroll","touchstart","click"];
    events.forEach(e => window.addEventListener(e, resetTimers));
    resetTimers();

    return () => {
      clearTimeout(warningTimer);
      clearTimeout(logoutTimer);
      clearInterval(countdownInterval);
      events.forEach(e => window.removeEventListener(e, resetTimers));
    };
  }, [user]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async fbUser => {
      if (fbUser) {
        const ud = await getUser(fbUser.uid);
        if (ud) {
          const agora = new Date().toISOString();
          setUser({ ...ud, uid: fbUser.uid });
          // Grava ultimo acesso silenciosamente
          try { await saveUser(fbUser.uid, { ultimoAcesso: agora, online: true }); } catch(e) {}
        } else {
          // Firestore não retornou perfil — usa dados do Auth como fallback
          setUser({ uid: fbUser.uid, name: fbUser.displayName || fbUser.email, email: fbUser.email, role: "user" });
        }
      } else {
        // Marca offline ao sair
        if (auth.currentUser) {
          try { await saveUser(auth.currentUser.uid, { online: false }); } catch(e) {}
        }
        setUser(null);
      }
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeRNCs(setRncs);
    getAllUsers().then(setUsers);
    const unsubForn = subscribeCollection("fornecedores", (list) => {
      setFornecedores(list.sort((a,b) => (a.nome||"").localeCompare(b.nome||"")));
    });
    return () => { unsub(); unsubForn(); };
  }, [user]);

  // Alertas automáticos — verificar RNCs vencendo hoje ou já vencidas
  useEffect(() => {
    if (!user || !rncs.length) return;
    const hoje = tod();
    const amanha = new Date(); amanha.setDate(amanha.getDate() + 1);
    const amanhaStr = amanha.toISOString().split("T")[0];
    const vencendoHoje = rncs.filter(r => r.prazoAC === hoje && r.status !== "Eficaz" && r.status !== "Ineficaz" && r.resp === user.name);
    const vencendoAmanha = rncs.filter(r => r.prazoAC === amanhaStr && r.status !== "Eficaz" && r.status !== "Ineficaz" && r.resp === user.name);
    if (vencendoHoje.length > 0 || vencendoAmanha.length > 0) {
      const lastAlert = localStorage.getItem("hm_last_alert");
      if (lastAlert !== hoje) {
        localStorage.setItem("hm_last_alert", hoje);
        if (vencendoHoje.length > 0) {
          fetch("https://api.emailjs.com/api/v1.0/email/send", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              service_id: "service_gxhicii", template_id: "template_4jl73wq", user_id: "z2VxJ1dYjwrRp8Nh4",
              template_params: {
                to_email: user.email, to_name: user.name,
                from_name: "SGQ Herbamed® · Alertas Automáticos",
                subject: `⚠️ SGQ Herbamed — ${vencendoHoje.length} prazo(s) vencendo HOJE`,
                message: `Olá ${user.name},\n\nAs seguintes RNCs têm prazo de ação corretiva vencendo HOJE:\n\n${vencendoHoje.map(r => `• ${r.num} — ${r.desc?.substring(0, 60)}...\n  Prazo: ${fmt(r.prazoAC)}`).join("\n\n")}\n\n${vencendoAmanha.length > 0 ? `\nVencendo AMANHÃ:\n${vencendoAmanha.map(r => `• ${r.num} — ${r.desc?.substring(0, 60)}...`).join("\n")}\n\n` : ""}Acesse o sistema para tomar as ações necessárias.\n\nHerbamed® · Sistema de Gestão da Qualidade`,
                reply_to: user.email,
              }
            })
          }).catch(() => {});
        }
      }
    }
  }, [rncs, user]);

  // ── Heartbeat — atualiza online status a cada 2 minutos ──────────────────
  useEffect(() => {
    if (!user?.uid) return;
    const update = async () => {
      try { await saveUser(user.uid, { ultimoAcesso: new Date().toISOString(), online: true }); } catch(e) {}
    };
    update();
    const interval = setInterval(update, 2 * 60 * 1000);
    const handleUnload = () => {
      try { saveUser(user.uid, { online: false }); } catch(e) {}
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [user?.uid]);

  const toast_ = useCallback((msg, color = "green") => setToast({ msg, color, key: Date.now() }), []);

  // ── Auditoria ────────────────────────────────────────────────────────────
  const auditLog = useCallback(async (acao, colecao, docId, docNome, dadosAntes = null, dadosDepois = null) => {
    try {
      const entrada = {
        id: Date.now(),
        ts: Date.now(),
        data: new Date().toISOString(),
        usuario: user?.name || "—",
        email: user?.email || "—",
        userId: user?.uid || user?.id || "—",
        acao,
        colecao,
        docId: String(docId),
        docNome: docNome || String(docId),
        dadosAntes: dadosAntes ? JSON.stringify(dadosAntes).slice(0, 2000) : null,
        dadosDepois: dadosDepois ? JSON.stringify(dadosDepois).slice(0, 2000) : null,
      };
      await saveCollection("audit_log", String(entrada.id), entrada);
    } catch(e) {
      console.warn("[AuditLog] falha ao registrar:", e);
    }
  }, [user?.name, user?.email, user?.uid, user?.id]);

  // ── Verificação de permissões customizadas ───────────────────────────
  // Para usuários com permissoes salvas no Firestore, usa elas.
  // Para usuários antigos sem permissoes, cai no papel (role) como antes.
  const perm = (key) => {
    if (!user) return false;
    if (user.permissoes && key in user.permissoes) return !!user.permissoes[key];
    // fallback para papel
    const role = user.role;
    return PERMS_PADRAO[role] ? !!(PERMS_PADRAO[role][key]) : false;
  };

  const fbErr = (e) => {
    console.error("[Firebase]", e?.code, e?.message);
    const codes = {
      "unavailable":        "Sem conexao com o servidor. Verifique sua internet.",
      "permission-denied":  "Sem permissao para esta operacao.",
      "not-found":          "Registro nao encontrado.",
      "already-exists":     "Este registro ja existe.",
      "resource-exhausted": "Muitas requisicoes. Aguarde um momento.",
      "unauthenticated":    "Sessao expirada. Faca login novamente.",
      "deadline-exceeded":  "Tempo esgotado. Verifique sua conexao.",
    };
    return codes[e?.code] || "Erro ao salvar. Tente novamente.";
  };
  const openEmail = useCallback((rnc, evento) => setEmailCtx({ rnc, evento }), []);
  const doSaveRNC = useCallback(async (rnc) => {
    try {
      const isNew = !rncs.find(r => r.id === rnc.id);
      await saveRNC(rnc.id, rnc);
      await auditLog(isNew ? "Criou RNC" : "Editou RNC", "rncs", rnc.id, rnc.num || rnc.id, isNew ? null : rncs.find(r=>r.id===rnc.id), rnc);
    } catch(e) { console.error(e); }
  }, []);
  const doUpdateRNC = useCallback(async (id, data) => {
    try {
      const antes = rncs.find(r => r.id === id);
      await updateRNC(id, data);
      const acao = data.status ? `Status: ${data.status}` : data.ishikawa ? "Ishikawa atualizado" : data.w2h ? "5W2H atualizado" : data.eficacia ? "Eficácia registrada" : "Editou RNC";
      await auditLog(acao, "rncs", id, antes?.num || id, antes, data);
    } catch(e) { console.error(e); }
  }, []);
  const doDeleteRNC = useCallback(async (id) => {
    try {
      const antes = rncs.find(r => r.id === id);
      await fbDeleteRNC(id);
      await auditLog("Excluiu RNC", "rncs", id, antes?.num || id, antes, null);
    } catch(e) { console.error(e); }
  }, []);

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

  if (user.role === "exec") return (
    <ThemeCtx.Provider value={T}>
      <ExecutivoDashboard user={user} rncs={rncs} fornecedores={fornecedores} />
    </ThemeCtx.Provider>
  );

  const isViewer = user.role === "viewer";
  const isAdmin = user.role === "admin";

  // Notificações — RNCs com prazo vencido
  const notifs = rncs.filter(r => r.prazoAC && r.prazoAC < tod() && r.status !== "Eficaz" && r.status !== "Ineficaz");

  const MENU = [
    { id: "home",        icon: "🏠", label: "Home" },
    { id: "lista",       icon: "📋", label: "Registros", badge: rncs.filter(x => x.status === "Aberta").length },
    ...(!isViewer ? [{ id: "nova",       icon: "➕", label: "Nova RNC" }] : []),
    ...(!isViewer ? [{ id: "ishikawa",   icon: "🐟", label: "Ishikawa / 5 Porquês" }] : []),
    ...(!isViewer ? [{ id: "5w2h",       icon: "📌", label: "5W2H" }] : []),
    ...(!isViewer ? [{ id: "eficacia",   icon: "✅", label: "Eficácia" }] : []),
    ...(!isViewer ? [{ id: "fmea",       icon: "⚠️", label: "FMEA" }] : []),
    { id: "dashboard",   icon: "📊", label: "Dashboard" },
    { id: "relatorios",  icon: "📑", label: "Relatórios" },
    { id: "cep",         icon: "📉", label: "CEP" },
    { id: "fornecedores",icon: "🏭", label: "Fornecedores" },
    { id: "nqa",         icon: "📐", label: "NQA / AQL" },
    { id: "cq-materiais",icon: "🧪", label: "CQ — Materiais" },
    { id: "cq-analises", icon: "📋", label: "CQ — Análises" },
    { id: "auditorias",  icon: "🔍", label: "Auditorias" },
    { id: "ipc",          icon: "🏭", label: "Controle de Processo" },
    { id: "ipc-produtos",   icon: "📦", label: "IPC — Produtos" },
    ...(isAdmin ? [{ id: "admin", icon: "⚙️", label: "Administração" }] : []),
  ];

  const PAGE_TITLES = {
    home: "Home", lista: "Registros de Não Conformidades",
    nova: "Nova Não Conformidade", ishikawa: "Ishikawa / 5 Porquês",
    "5w2h": "Plano de Ação 5W2H", eficacia: "Verificação de Eficácia",
    fmea: "FMEA — Análise de Modo e Efeito de Falha",
    dashboard: "Dashboard", relatorios: "Relatórios",
    cep: "CEP — Controle Estatístico de Processo",
    fornecedores: "Cadastro de Fornecedores",
    nqa: "NQA / AQL — Cálculo de Amostragem ISO 2859-1",
    "cq-materiais": "CQ — Cadastro de Materiais",
    "cq-analises": "CQ — Fichas de Análise",
    "cq-dashboard": "CQ — Dashboard de Qualidade",
    auditorias: "Auditorias Internas",
    laudos: "Laudos Analíticos",
    "gestao-docs": "Gestão de Documentos — Lista Mestra",
    "audit-log": "Trilha de Auditoria — RNCs e Documentos",
    clientes: "Clientes Terceiros",
    ipc: "IPC — Controle de Processo",
    "ipc-produtos": "IPC — Produtos Cadastrados",
    "producao-processos": "Controle de Processos de Produção",
    admin: "Administração",
  };

  return (
    <ThemeCtx.Provider value={T}>
    <FormalCtx.Provider value={formalMode}>
      <div data-formal={formalMode ? "true" : "false"} style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: T.bg, color: T.text, minHeight: "100vh", fontSize: 14, display: "flex", flexDirection: "column" }}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <style>{`
          @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
          @keyframes fadeIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
          @keyframes slideIn{from{transform:translateX(-100%)}to{transform:translateX(0)}}
          .menu-item:hover{background:${T.accentDim}!important;color:${T.accent}!important;}
          ${formalMode ? `
            button .emoji-hide, span.emoji-hide { display: none !important; }
            [data-formal="true"] .btn-emoji { display: none !important; }
          ` : ""}
          .rnc-row:hover{background:${T.card2}!important;}
          .th-sort:hover{color:${T.accent}!important;cursor:pointer;}
          select option{background:${T.surf}!important;color:${T.text}!important;}
          select{background:${T.surf}!important;color:${T.text}!important;}
          @media(max-width:768px){
            .header-kpis{display:none!important;}
            .sidebar-desktop{display:none!important;}
            .header-theme{display:none!important;}
            .sidebar-nav{display:none!important;}
            .sidebar-nav.mobile-open{
              display:flex!important;
              width:270px!important;
              position:fixed!important;
              top:0!important;left:0!important;bottom:0!important;
              height:100vh!important;
              z-index:295!important;
              box-shadow:4px 0 32px rgba(0,0,0,.5)!important;
            }
          }
          @media(min-width:769px){
            .mobile-only{display:none!important;}
          }
          @media print{
            .top-header,.sidebar-nav,.session-warning,.no-print{display:none!important;}
            body{background:#fff!important;}
            *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
          }
        `}</style>

        {/* ── TOP HEADER ── */}
        <div className="top-header" style={{ background: `linear-gradient(135deg,${T.surf},${T.card})`, borderBottom:`1px solid ${T.border2}`, height:60, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 1.5rem", position:"sticky", top:0, zIndex:200, backdropFilter:"blur(12px)", flexShrink:0 }}>

          {/* Left: toggle + logo */}
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            {/* Mobile hamburger */}
            <button className="mobile-only" onClick={() => setMobileMenuOpen(o=>!o)} style={{ background:"none", border:`1px solid ${T.border2}`, borderRadius:8, color:T.text2, cursor:"pointer", width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>
              ☰
            </button>
            {/* Desktop toggle */}
            <button className="sidebar-desktop" onClick={() => setSidebarOpen(o=>!o)} style={{ background:"none", border:`1px solid ${T.border2}`, borderRadius:8, color:T.text2, cursor:"pointer", width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>
              {sidebarOpen ? "◀" : "▶"}
            </button>
            <div onClick={() => setTab("home")} style={{ background:"#fff", borderRadius:9, padding:"4px 12px", boxShadow:`0 0 14px ${T.accentGlow}`, display:"flex", alignItems:"center", cursor:"pointer" }} title="Ir para Home">
              <HerbamedLogo height={24} white={false} />
            </div>
            <div style={{ display:"flex", flexDirection:"column" }}>
              <span style={{ fontSize:13, fontWeight:700, color:T.text, lineHeight:1.2 }}>SGQ Herbamed®</span>
              <span style={{ fontSize:10, color:T.text3 }}>Sistema de Gestão da Qualidade</span>
            </div>
          </div>

          {/* Center: KPI pills */}
          <div className="header-kpis" style={{ display:"flex", gap:8 }}>
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
            <div className="header-theme"><ThemePicker current={themeKey} onChange={changeTheme} formal={formalMode} onToggleFormal={toggleFormal} /></div>

            {/* Presentation mode button — admin/keyuser/rt only */}
            {["admin","keyuser","rt"].includes(user.role) && (
              <button onClick={() => setPresentationMode(true)} title="Modo Apresentação" style={{ background: T.accentDim, border: `1px solid ${T.accent}44`, borderRadius: 8, color: T.accent, cursor: "pointer", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                📊
              </button>
            )}
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

          {/* Mobile overlay */}
          {mobileMenuOpen && (
            <div onClick={()=>setMobileMenuOpen(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.6)", zIndex:290, backdropFilter:"blur(2px)" }} />
          )}

          {/* SIDEBAR */}
          <div className={`sidebar-nav${mobileMenuOpen ? " mobile-open" : ""}`} style={{ width: sidebarOpen ? 220 : 60, flexShrink:0, background:T.surf, borderRight:`1px solid ${T.border}`, display:"flex", flexDirection:"column", transition:"width .25s ease", overflow:"hidden", position:"sticky", top:60, left:0, bottom:0, height:"calc(100vh - 60px)", zIndex:"auto" }}>
            <SidebarNav T={T} tab={tab} setTab={(t)=>{ setTab(t); setMobileMenuOpen(false); }} sidebarOpen={mobileMenuOpen ? true : sidebarOpen} rncs={rncs} isViewer={isViewer} isAdmin={isAdmin} />
          </div>

          {/* MAIN CONTENT */}
          <div style={{ flex:1, overflowY:"auto", minWidth:0 }}>
            {/* Page header — hidden on home */}
            {tab !== "home" && (
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
            )}

            <div style={{ padding: tab==="home" ? "0" : "1.5rem" }}>
              {tab==="home"       && <HomeTab rncs={rncs} user={user} setTab={setTab} />}
              {tab==="lista"      && <ListaTab rncs={rncs} user={user} users={users} toast_={toast_} setTab={setTab} openEmail={openEmail} doUpdateRNC={doUpdateRNC} doDeleteRNC={doDeleteRNC} isViewer={isViewer} isAdmin={isAdmin} perm={perm} />}
              {tab==="nova"       && !isViewer && perm("criarRNC") && <NovaTab rncs={rncs} user={user} toast_={toast_} setTab={setTab} openEmail={openEmail} doSaveRNC={doSaveRNC} fornecedores={fornecedores} />}
              {tab==="ishikawa"   && !isViewer && <IshikawaTab rncs={rncs} toast_={toast_} openEmail={openEmail} doUpdateRNC={doUpdateRNC} user={user} isAdmin={isAdmin} />}
              {tab==="5w2h"       && !isViewer && <W2HTab rncs={rncs} user={user} toast_={toast_} openEmail={openEmail} doUpdateRNC={doUpdateRNC} isAdmin={isAdmin} />}
              {tab==="eficacia"   && !isViewer && <EficaciaTab rncs={rncs} toast_={toast_} openEmail={openEmail} doUpdateRNC={doUpdateRNC} user={user} isAdmin={isAdmin} />}
              {tab==="fmea"       && !isViewer && <FMEATab user={user} toast_={toast_} doSaveRNC={doSaveRNC} />}
              {tab==="dashboard"  && <DashTab rncs={rncs} />}
              {tab==="relatorios" && <RelatoriosTab rncs={rncs} users={users} user={user} toast_={toast_} />}
              {tab==="cep"        && <CEPTab rncs={rncs} />}
              {tab==="fornecedores"  && <FornecedoresTab rncs={rncs} fornecedores={fornecedores} setFornecedores={setFornecedores} user={user} toast_={toast_} isAdmin={isAdmin} />}
              {tab==="nqa"          && <NQATab user={user} toast_={toast_} />}
              {tab==="cq"           && <CQTab user={user} toast_={toast_} fornecedores={fornecedores} doSaveRNC={doSaveRNC} setTab={setTab} />}
              {tab==="cq-materiais" && <CQMateriaisTab user={user} toast_={toast_} fornecedores={fornecedores} perm={perm} />}
              {tab==="cq-analises"  && <CQAnalisesTab user={user} toast_={toast_} fornecedores={fornecedores} setTab={setTab} perm={perm} />}
              {tab==="cq-dashboard" && <CQDashboardTab />}
              {tab==="auditorias"   && <AuditoriasTab user={user} toast_={toast_} users={users} rncs={rncs} />}
              {tab==="laudos"       && <LaudosTab user={user} toast_={toast_} users={users} />}
              {tab==="clientes"     && <ClientesTab user={user} toast_={toast_} />}
              {tab==="gestao-docs"  && <GestaoDocumentosTab user={user} toast_={toast_} users={users} auditLog={auditLog} perm={perm} />}
              {tab==="ipc"          && <IPCTab user={user} toast_={toast_} />}
              {tab==="ipc-produtos"  && <IPCProdutosTab user={user} toast_={toast_} />}
              {tab==="producao-processos" && <ProcessosProducaoTab user={user} toast_={toast_} />}
              {tab==="audit-log"    && isAdmin && <AuditLogTab user={user} />}
              {tab==="admin"        && isAdmin && <AdminTab users={users} setUsers={setUsers} toast_={toast_} currentUser={user} />}
            </div>
          </div>
        </div>

        {emailCtx && <EmailModal rnc={emailCtx.rnc} users={users} currentUser={user} evento={emailCtx.evento} onClose={() => setEmailCtx(null)} onSent={msg => { toast_(msg, "green"); setEmailCtx(null); }} />}
        {toast && <Toast key={toast.key} msg={toast.msg} color={toast.color} onDone={() => setToast(null)} />}

        {/* ── MODO APRESENTAÇÃO ── */}
        {presentationMode && (
          <div style={{ position:"fixed", inset:0, zIndex:9999, background:T.bg }}>
            <ExecutivoDashboard user={user} rncs={rncs} fornecedores={fornecedores} onClose={() => setPresentationMode(false)} />
          </div>
        )}

        {/* ── AVISO DE SESSÃO EXPIRANDO ── */}
        {sessionWarning && (
          <div style={{ position:"fixed", bottom:24, right:24, zIndex:9999, background:"#1a1a2a", border:"1px solid #ffd16655", borderRadius:14, padding:"16px 20px", boxShadow:"0 8px 32px rgba(0,0,0,.6)", maxWidth:320, animation:"fadeIn .3s ease" }}>
            <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
              <span style={{ fontSize:24, flexShrink:0 }}>⏱️</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, color:"#ffd166", marginBottom:4 }}>Sessão expirando!</div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,.7)", marginBottom:12, lineHeight:1.5 }}>
                  Sua sessão será encerrada por inatividade em{" "}
                  <strong style={{ color:"#ffd166" }}>
                    {Math.floor(sessionCountdown/60)}:{String(sessionCountdown%60).padStart(2,"0")}
                  </strong>
                </div>
                <button
                  onClick={()=>{ setSessionWarning(false); }}
                  style={{ width:"100%", padding:"8px", background:"linear-gradient(135deg,#2ab84a,#1a7a3c)", border:"none", borderRadius:8, color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}
                >
                  Continuar sessão →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </FormalCtx.Provider>
    </ThemeCtx.Provider>
  );
}

/* ─── HOME TAB ───────────────────────────────────────────────────────────────── */
function HomeTab({ rncs, user, setTab }) {
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
        <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10 }}>
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
      <div style={{ padding:"1.5rem", display:"grid", gridTemplateColumns:"1fr 340px", gap:"1.5rem" }}>

        {/* LEFT */}
        <div>
          {/* Ações rápidas */}
          <div style={{ marginBottom:"1.5rem" }}>
            <div style={{ fontSize:12, fontWeight:700, color:T.text3, textTransform:"uppercase", letterSpacing:".08em", marginBottom:10 }}>Ações rápidas</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
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

/* ─── LISTA TAB ──────────────────────────────────────────────────────────────── */
function ListaTab({ rncs, user, users, toast_, setTab, openEmail, doUpdateRNC, doDeleteRNC, isViewer, isAdmin, perm }) {
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
    const h = { data: tod(), hora: new Date().toLocaleTimeString("pt-BR"), acao: `Status alterado → ${status}`, resp: user.name, tipo: "status" };
    await doUpdateRNC(id, { status, historico: [...(r?.historico || []), h] });
    setSel(p => p ? { ...p, status, historico: [...(p.historico || []), h] } : null);

  const assinarRTRNC = async (r) => {
    if (!user?.assinatura) { alert("Você não possui assinatura cadastrada. Solicite ao administrador."); return; }
    if (user?.role !== "rt" && user?.role !== "admin" && user?.role !== "keyuser") { alert("Apenas o Responsável Técnico pode assinar RNCs."); return; }
    if (!window.confirm(`Confirma assinatura como RT na RNC ${r.num}?`)) return;
    const ass = { nome: user.name, crf: user.crf || "", img: user.assinatura, dataHora: `${tod()} ${new Date().toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" })}` };
    const h = { data: tod(), hora: new Date().toLocaleTimeString("pt-BR"), acao: "RNC aprovada pelo RT", resp: user.name, tipo: "rt" };
    const updated = { ...r, assinaturaRT: ass, historico: [...(r.historico||[]), h] };
    await doUpdateRNC(r.id, { assinaturaRT: ass, historico: updated.historico });
    setSel(updated);
    toast_("RNC aprovada pelo RT!", "green");
  };
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
  const {paginated:_rncs,page:_pgRNC,total:_totRNC,setPage:_setPgRNC} = usePagination(sorted, 20);

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
        <>
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
                      <div style={{ fontSize:11, color:T.text2 }}>{sel.assinaturaRT.nome}{sel.assinaturaRT.crf ? ` · ${sel.assinaturaRT.crf}` : ""} · {sel.assinaturaRT.dataHora}</div>
                    </div>
                    {sel.assinaturaRT.img && <img src={sel.assinaturaRT.img} alt="Assinatura RT" style={{ height:36, maxWidth:120, objectFit:"contain", background:"#fff", padding:4, borderRadius:4 }} />}
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
          onClose={()=>setAssinaturaModal(null)}
          onConfirm={(ass)=>{ exportRNCPDF(assinaturaModal, ass); setAssinaturaModal(null); toast_("PDF gerado com assinatura!", "green"); }}
        />
      )}
    </div>
  );
}

/* ─── CLOUDINARY UPLOAD ──────────────────────────────────────────────────────── */
const CLOUD_NAME = "dswsg9w0w";
const UPLOAD_PRESET = "herbamed_rnc";

async function uploadToCloudinary(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", "herbamed-rnc");
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
    method: "POST", body: formData
  });
  const data = await res.json();
  if (data.secure_url) {
    return { url: data.secure_url, name: file.name, type: file.type, size: file.size };
  }
  throw new Error(data.error?.message || "Erro no upload");
}

/* ─── SUPABASE STORAGE — PDFs ────────────────────────────────────────────────── */
const SUPABASE_URL = "https://zspipirhuzkwftidzrva.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzcGlwaXJodXprd2Z0aWR6cnZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MzA0MDcsImV4cCI6MjA5MzUwNjQwN30._bm_Mfu1JccgoKFEjd-mTqH8xaoTgw02Uo2x7zkEsMI";
const SUPABASE_BUCKET = "coa-pdfs";

async function uploadPdfToSupabase(file) {
  const ext = file.name.split(".").pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${fileName}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": file.type || "application/pdf",
      "x-upsert": "true"
    },
    body: file
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Erro no upload Supabase");
  }
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${fileName}`;
  return { url: publicUrl, name: file.name, type: file.type, size: file.size };
}

// Helper para abrir COA — Supabase serve PDFs inline, Cloudinary abre direto para imagens
function openCOA(coa) {
  if (!coa?.url) return;
  const url = coa.url.replace("/upload/fl_inline/", "/upload/");
  window.open(url, "_blank", "noopener,noreferrer");
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
function NovaTab({ user, toast_, setTab, openEmail, doSaveRNC, fornecedores = [] }) {
  const s = useS(); const T = useTheme();
  const [f, setF] = useState({ data: tod(), status: "Aberta", tipo: "Matéria-prima", sev: "Maior", produto: "", fornecedor: "", setor: "", detector: "", desc: "", lote: "", qtd: "", ref: "", evidencia: "", contencao: "", respCont: "", dataContencao: "", resp: "", prazoCausa: "", prazoAC: "", prazoEfic: "" });
  const [anexos, setAnexos] = useState([]);
  const [ishikawa, setIshikawa] = useState({ efeito: "", causes: { mao: [], maquina: [], metodo: [], material: [], medicao: [], meioamb: [] }, whys: [], root: "", whyCausa: "" });
  const [w2h, setW2h] = useState([]);
  const [fornSearch, setFornSearch] = useState("");
  const [fornOpen, setFornOpen] = useState(false);
  const [numPreview, setNumPreview] = useState("...");

  useEffect(() => {
    peekDailyCounter().then(n => setNumPreview(n)).catch(() => setNumPreview("—"));
  }, []);
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
    const rnc = { id: String(Date.now()), num: genNum(nc), ...f, anexos, ishikawa, w2h, eficacia: { criterio: "", data: "", resp: "", evidencias: "", resultado: "", obs: "" }, historico: [{ data: tod(), acao: "RNC aberta", resp: user.name }], criadoPor: user.name, createdAt: Date.now(), assinaturaRT: null };
    await doSaveRNC(rnc);
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

      <div style={s.card}>
        <SecTitle icon="⚡" ch="Ação de contenção" />
        <F lbl="Ação realizada" tip="Descreva a ação imediata de contenção já executada. Ex: Lote bloqueado e segregado na área de quarentena. Produção suspensa até investigação." ch={<TA rows={3} value={f.contencao} onChange={e => set("contencao", e.target.value)} />} />
        <G2 ch={<><F lbl="Responsável" tip="Nome do responsável pela execução da ação de contenção." ch={<Inp value={f.respCont} onChange={e => set("respCont", e.target.value)} />} /><F lbl="Data" tip="Data em que a ação de contenção foi executada." ch={<Inp type="date" value={f.dataContencao} onChange={e => set("dataContencao", e.target.value)} />} /></>} />
      </div>
      <div style={s.card}>
        <SecTitle icon="🗓️" ch="Prazos e responsabilidades" />
        <G3 ch={<><F lbl="Responsável pela análise" tip="Nome do responsável por conduzir a análise de causa raiz (Ishikawa + 5 Porquês) e elaborar o plano de ação corretiva." ch={<Inp value={f.resp} onChange={e => set("resp", e.target.value)} />} /><F lbl="Prazo — análise de causa" tip="Data limite para conclusão da análise de causa raiz (Ishikawa + 5 Porquês). Recomendado: até 15 dias após a abertura." ch={<Inp type="date" value={f.prazoCausa} onChange={e => set("prazoCausa", e.target.value)} />} /><F lbl="Prazo — ação corretiva" tip="Data limite para execução de todas as ações do plano 5W2H. Recomendado: até 30 dias após a análise de causa." ch={<Inp type="date" value={f.prazoAC} onChange={e => set("prazoAC", e.target.value)} />} /></>} />
        <F lbl="Prazo — verificação de eficácia" tip="Data em que será verificado se a ação corretiva foi eficaz e o problema não voltou. Recomendado: 90 dias após a ação corretiva." ch={<Inp type="date" value={f.prazoEfic} onChange={e => set("prazoEfic", e.target.value)} sx={{ maxWidth: 300 }} />} />
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

/* ─── 5W2H TAB ───────────────────────────────────────────────────────────────── */
function W2HTab({ rncs, user, toast_, openEmail, doUpdateRNC }) {
  const T = useTheme(); const s = useS();
  const [sid, setSid] = useState(""); const [acts, setActs] = useState([]);
  const r = rncs.find(x => x.id === sid);
  useEffect(() => { if (!r) return; setActs(JSON.parse(JSON.stringify(r.w2h || []))); }, [sid]);
  const add = () => setActs(p => [...p, { what: "", why: "", who: user.name, where: "", when: "", how: "", howMuch: "", status: "Pendente", evidencia: "" }]);
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
          messages:[{ role:"user", content:`Você é especialista em qualidade farmacêutica (BPF, ANVISA RDC 658/2022). Crie um plano de ação corretiva 5W2H para a não conformidade abaixo.

Problema: ${r.desc||""}
Causa raiz: ${causaRaiz}
Produto: ${r.produto||""}
Setor: ${r.setor||""}
Severidade: ${r.sev||""}

Responda APENAS em JSON sem markdown com array de 3 a 5 ações:
[{"what":"o que fazer","why":"por que","who":"responsável (cargo)","where":"local","when":"prazo ex: 15 dias","how":"como executar passo a passo","howMuch":"esforço estimado","status":"Pendente","evidencia":""}]` }]})});
      const data = await res.json();
      const txt = data.content?.[0]?.text || "";
      const parsed = JSON.parse(txt.replace(/\`\`\`json|\`\`\`/g,"").trim());
      setActs(p => [...p, ...parsed.map(a => ({ ...a, id: Date.now() + Math.random() }))]);
      toast_("Plano de ação gerado pela IA! Revise e ajuste os responsáveis e prazos.", "green");
    } catch(e) { toast_("Erro ao gerar com IA.", "red"); }
    setW2hAiLoading(false);
  };

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
              <F lbl="O quê?" tip="Descreva a ação corretiva a ser executada. Seja específico e use verbos de ação. Ex: Revisar e atualizar o PO-CQ-003 de controle de qualidade de cápsulas." ch={<Inp placeholder="Ação a executar" value={a.what} onChange={e => upd(i, "what", e.target.value)} />} />
              <F lbl="Por quê?" tip="Justifique por que esta ação é necessária. Conecte com a causa raiz identificada no Ishikawa." ch={<Inp placeholder="Justificativa" value={a.why} onChange={e => upd(i, "why", e.target.value)} />} />
              <F lbl="Quem?" tip="Nome do responsável pela execução desta ação. Deve ser uma pessoa específica, não um setor." ch={<Inp value={a.who} onChange={e => upd(i, "who", e.target.value)} />} />
              <F lbl="Onde?" tip="Local onde a ação será executada. Ex: Linha de produção 2, Laboratório de CQ, Almoxarifado." ch={<Inp value={a.where} onChange={e => upd(i, "where", e.target.value)} />} />
              <F lbl="Quando?" tip="Data limite para conclusão desta ação. Deve ser realista e alinhada com o prazo de ação corretiva definido na RNC." ch={<Inp type="date" value={a.when} onChange={e => upd(i, "when", e.target.value)} />} />
              <F lbl="Custo/Esforço" tip="Estimativa de custo ou esforço necessário para executar esta ação. Ex: 4 horas de trabalho, R$ 500, sem custo adicional." ch={<Inp value={a.howMuch} onChange={e => upd(i, "howMuch", e.target.value)} />} />
              <div style={{ gridColumn: "span 2" }}><F lbl="Como?" tip="Descreva passo a passo como a ação será executada. Quanto mais detalhado, mais fácil de executar e verificar." ch={<TA rows={2} value={a.how} onChange={e => upd(i, "how", e.target.value)} />} /></div>
              <div style={{ gridColumn: "span 2" }}>
                <F lbl="Evidência de execução" tip="Descreva ou registre a comprovação de que esta ação foi concluída. Ex: PO-CQ-003 revisado e aprovado pelo RT em 15/05/2025, registro de treinamento anexo." ch={
                  <div>
                    <Inp placeholder="Descreva a evidência (ex: foto anexada, relatório nº, registro de treinamento...)" value={a.evidencia||""} onChange={e => upd(i, "evidencia", e.target.value)} />
                    {a.evidencia && <div style={{ fontSize:10, color:T.accent, marginTop:4 }}>✓ Evidência registrada</div>}
                    {a.status === "Concluída" && !a.evidencia && <div style={{ fontSize:10, color:"#ff4f6a", marginTop:4 }}>⚠️ Ação concluída sem evidência — recomendado registrar comprovação</div>}
                  </div>
                } />
              </div>
            </div>
          </div>
        ))}
        <div style={{ background:`linear-gradient(135deg,${T.accentDim},${T.card2||T.card})`, border:`1px solid ${T.accent}33`, borderRadius:12, padding:"12px 14px", marginBottom:8, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:T.accent, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🤖</div>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:T.text }}>Assistente IA — 5W2H</div>
              <div style={{ fontSize:11, color:T.text2 }}>Gera o plano de ação completo baseado na causa raiz do Ishikawa</div>
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

/* ─── EFICÁCIA TAB ───────────────────────────────────────────────────────────── */
function EficaciaTab({ rncs, toast_, openEmail, doUpdateRNC }) {
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
        <F lbl="Resultado da verificação" tip="Eficaz: o problema não se repetiu e as ações foram suficientes. Ineficaz: o problema persistiu — uma nova RNC deverá ser aberta com análise de causa complementar." ch={
          <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
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

/* ─── PDF SHARED STYLES ──────────────────────────────────────────────────────── */
const PDF_CSS = `
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

function openPDFWindow(title, html) {
  const win = window.open("","_blank");
  win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/><title>${title}</title><style>${PDF_CSS}</style></head><body>${html}<script>window.onload=()=>window.print();<\/script></body></html>`);
  win.document.close();
}

/* ─── ASSINATURA ELETRÔNICA ──────────────────────────────────────────────────── */
function AssinaturaModal({ user, onConfirm, onClose, titulo }) {
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
      const { auth } = await import("./firebase");
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

/* ─── PDF EXPORT ─────────────────────────────────────────────────────────────── */
function exportRNCPDF(rnc, assinatura = null) {
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
        ${assinatura.assinaturaImg ? `<img src="${assinatura.assinaturaImg}" alt="Assinatura" style="height:56px;max-width:200px;object-fit:contain;display:block;margin:0 auto 4px;"/>` : `<div style="height:56px;"></div>`}
        <div style="border-top:1px solid #333;padding-top:6px;font-size:11px;">
          <strong>${assinatura.nome}</strong><br/>
          ${assinatura.cargo}<br/>
          <span style="color:#666;font-size:10px;">Assinado eletronicamente em ${assinatura.data} às ${assinatura.hora}</span>
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
      <div style="font-size:11px;color:#666;">Assinado em ${rnc.assinaturaRT.dataHora}</div>
    </div>
    ${rnc.assinaturaRT.img ? `<img src="${rnc.assinaturaRT.img}" style="height:44px;max-width:140px;object-fit:contain;"/>` : ""}
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

/* ─── FMEA PDF EXPORT ────────────────────────────────────────────────────────── */
function exportFMEAPDF(items) {
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

/* ─── FMEA TAB ───────────────────────────────────────────────────────────────── */
function FMEATab({ user, toast_ }) {
  const T = useTheme(); const s = useS();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [processo, setProcesso] = useState("");

  useEffect(() => {
    const unsub = subscribeCollection("fmea", (list) => {
      setItems(list.sort((a,b) => (b.id||0) - (a.id||0)));
      setLoading(false);
    });
    // Safety timeout — show empty if Firestore takes too long
    const t = setTimeout(() => setLoading(false), 3000);
    return () => { unsub(); clearTimeout(t); };
  }, []);

  const addItem = async () => {
    try {
    const novo = { id: Date.now(), processo: "", modoFalha: "", efeito: "", causa: "", S: 1, O: 1, D: 1, acao: "", resp: user.name, prazo: "", status: "Pendente", criadoPor: user.name };
    await saveCollection("fmea", String(novo.id), novo);
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const upd = async (id, k, v) => {
    try {
    const item = items.find(x => String(x.id) === String(id));
    if (item) await saveCollection("fmea", String(id), { ...item, [k]: v });
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const del = async (id) => {
    try {
    if (!confirm("Remover este item?")) return;
    await deleteFromCollection("fmea", String(id));
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const rpn = (item) => item.S * item.O * item.D;
  const rpnColor = (r) => r >= 100 ? "#ff4f6a" : r >= 50 ? "#ff8c42" : r >= 25 ? "#ffd166" : T.accent;
  const rpnLabel = (r) => r >= 100 ? "🔴 CRÍTICO" : r >= 50 ? "🟠 ALTO" : r >= 25 ? "🟡 MÉDIO" : "🟢 BAIXO";

  const gerarIA = async () => {
    if (!processo.trim()) { alert("Descreva o processo primeiro."); return; }
    setAiLoading(true);
    try {
      const txt = await askClaude(`Você é especialista em FMEA para indústria farmacêutica/suplementos. Gere uma análise FMEA para o processo abaixo.

PROCESSO: ${processo}
EMPRESA: Herbamed® (fabricante de suplementos alimentares)

Gere exatamente 5 modos de falha relevantes. Responda APENAS em JSON válido:
[
  {
    "processo": "${processo}",
    "modoFalha": "modo de falha específico",
    "efeito": "efeito no produto/cliente",
    "causa": "causa raiz provável",
    "S": 7,
    "O": 4,
    "D": 3,
    "acao": "ação preventiva recomendada"
  }
]
S=Severidade(1-10), O=Ocorrência(1-10), D=Detecção(1-10)`);
      const clean = txt.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      const novos = parsed.map(p => ({ id: Date.now() + Math.round(Math.random()*1000), resp: user.name, prazo: "", status: "Pendente", criadoPor: user.name, ...p, S: Number(p.S)||5, O: Number(p.O)||3, D: Number(p.D)||3 }));
      for (const item of novos) await saveCollection("fmea", String(item.id), item);
      toast_("FMEA gerado pela IA!", "green");
    } catch { toast_("Erro ao gerar. Tente novamente.", "red"); }
    setAiLoading(false);
  };

  const sorted = [...items].sort((a, b) => rpn(b) - rpn(a));

  return (
    <div>
      {/* Intro */}
      <div style={{ ...s.card, background:`linear-gradient(135deg,${T.card},${T.card2})`, marginBottom:"1rem" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12 }}>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:T.text, marginBottom:4 }}>⚠️ FMEA — Análise de Modo e Efeito de Falha</div>
            <div style={{ fontSize:12, color:T.text2, lineHeight:1.6, maxWidth:560 }}>
              Identifica e prioriza riscos <strong>antes</strong> que os problemas ocorram. O RPN (Risk Priority Number) = Severidade × Ocorrência × Detecção.
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            {items.length>0 && <button style={{ ...s.btn, color:"#ff8c42", borderColor:"#ff8c4233", background:"#ff8c4212" }} onClick={()=>exportFMEAPDF(items)}><span className="btn-emoji">📄 </span>Exportar PDF</button>}
            <button style={s.btnA} onClick={addItem}>+ Adicionar item</button>
          </div>
        </div>

        {/* Gerador IA */}
        <div style={{ marginTop:"1rem", padding:"1rem", background:T.accentDim, border:`1px solid ${T.accent}33`, borderRadius:10 }}>
          <div style={{ fontSize:12, fontWeight:700, color:T.accent, marginBottom:8 }}>🤖 Gerar FMEA com IA</div>
          <div style={{ display:"flex", gap:8 }}>
            <Inp placeholder="Descreva o processo (ex: Encapsulação de Psyllium em pó)" value={processo} onChange={e => setProcesso(e.target.value)} sx={{ flex: 1 }} />
            <button style={{ ...s.btnA, whiteSpace:"nowrap", opacity:aiLoading?.6:1, display:"flex", alignItems:"center", gap:6 }} onClick={gerarIA} disabled={aiLoading}>
              {aiLoading ? <><span style={{ animation:"spin 1s linear infinite", display:"inline-block" }}>⟳</span> Gerando...</> : "✨ Gerar"}
            </button>
          </div>
        </div>
      </div>

      {/* RPN Legend */}
      <div style={{ display:"flex", gap:8, marginBottom:"1rem", flexWrap:"wrap" }}>
        {[["🟢 BAIXO","RPN < 25","#2ab84a"],["🟡 MÉDIO","RPN 25-49","#ffd166"],["🟠 ALTO","RPN 50-99","#ff8c42"],["🔴 CRÍTICO","RPN ≥ 100","#ff4f6a"]].map(([l,sub,c])=>(
          <div key={l} style={{ background:T.surf, border:`1px solid ${c}33`, borderRadius:8, padding:"6px 12px", fontSize:11 }}>
            <span style={{ fontWeight:600, color:c }}>{l}</span>
            <span style={{ color:T.text3, marginLeft:6 }}>{sub}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      {loading ? <div style={{ textAlign:"center", padding:"3rem", color:T.text2 }}>Carregando...</div> :
       sorted.length === 0 ? (
        <div style={{ ...s.card, textAlign:"center", padding:"3rem" }}>
          <div style={{ fontSize:40, marginBottom:"1rem", opacity:.3 }}>⚠️</div>
          <div style={{ fontSize:14, color:T.text2, marginBottom:6 }}>Nenhum item FMEA cadastrado</div>
          <div style={{ fontSize:12, color:T.text3 }}>Clique em "+ Adicionar item" ou use o gerador de IA</div>
        </div>
      ) : (
        <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, overflow:"hidden", marginBottom:"1rem" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:T.surf }}>
                {[
                  ["Processo", "Etapa ou processo sendo analisado. Ex: Pesagem de MP, Encapsulamento, Rotulagem."],
                  ["Modo de Falha", "O que pode dar errado neste processo? Ex: Peso fora da especificação, cápsula mal fechada, rótulo invertido."],
                  ["Efeito", "Qual o impacto se o modo de falha ocorrer? Ex: Produto fora do padrão, recall, risco ao paciente."],
                  ["Causa", "Por que o modo de falha pode ocorrer? Ex: Balança descalibrada, falha do operador, matéria-prima fora do padrão."],
                  ["S", "Severidade (1-10): impacto do efeito. 1=mínimo, 10=catastrófico."],
                  ["O", "Ocorrência (1-10): probabilidade de a causa ocorrer. 1=improvável, 10=quase certo."],
                  ["D", "Detecção (1-10): capacidade de detectar a falha antes que chegue ao cliente. 1=detecção certa, 10=indetectável."],
                  ["RPN", "Número de Prioridade de Risco = S × O × D. Quanto maior, maior a prioridade de ação."],
                  ["Prioridade", "Classificação automática baseada no RPN: Crítico (>200), Alto (>120), Médio (>60), Baixo."],
                  ["Ação", "Ação recomendada para reduzir o RPN. Foque em reduzir Severidade, Ocorrência ou melhorar Detecção."],
                  ["Resp.", "Responsável pela execução da ação recomendada."],
                  ["Status", "Estado atual da ação: Pendente, Em andamento ou Concluída."],
                  ["", ""],
                ].map(([h, tip]) => (
                  <th key={h} style={{ padding:"10px 10px", fontSize:10, fontWeight:700, color:T.text3, textTransform:"uppercase", letterSpacing:".06em", textAlign:"left", borderBottom:`1px solid ${T.border}`, whiteSpace:"nowrap" }}>
                    <span style={{ display:"flex", alignItems:"center", gap:3 }}>{h}{tip && <Tooltip text={tip}/>}</span>
                  </th>
                ))}}
              </tr>
            </thead>
            <tbody>
              {sorted.map((item, idx) => {
                const r = rpn(item);
                const c = rpnColor(r);
                return (
                  <tr key={item.id} style={{ background: idx%2===0?T.card:T.surf, borderLeft:`3px solid ${c}` }}>
                    <td style={{ padding:"8px 10px" }}><Inp value={item.processo} onChange={e=>upd(item.id,"processo",e.target.value)} sx={{ fontSize:11, padding:"4px 6px" }}/></td>
                    <td style={{ padding:"8px 10px" }}><Inp value={item.modoFalha} onChange={e=>upd(item.id,"modoFalha",e.target.value)} sx={{ fontSize:11, padding:"4px 6px" }}/></td>
                    <td style={{ padding:"8px 10px" }}><Inp value={item.efeito} onChange={e=>upd(item.id,"efeito",e.target.value)} sx={{ fontSize:11, padding:"4px 6px" }}/></td>
                    <td style={{ padding:"8px 10px" }}><Inp value={item.causa} onChange={e=>upd(item.id,"causa",e.target.value)} sx={{ fontSize:11, padding:"4px 6px" }}/></td>
                    {["S","O","D"].map(k=>(
                      <td key={k} style={{ padding:"8px 6px" }}>
                        <select value={item[k]} onChange={e=>upd(item.id,k,Number(e.target.value))} style={{ ...s.inp, width:48, padding:"4px 6px", fontSize:12, textAlign:"center", fontWeight:700 }}>
                          {[1,2,3,4,5,6,7,8,9,10].map(n=><option key={n}>{n}</option>)}
                        </select>
                      </td>
                    ))}
                    <td style={{ padding:"8px 10px", textAlign:"center" }}>
                      <div style={{ fontSize:18, fontWeight:800, color:c, lineHeight:1 }}>{r}</div>
                    </td>
                    <td style={{ padding:"8px 6px", whiteSpace:"nowrap" }}>
                      <span style={{ fontSize:10, fontWeight:700, color:c, background:`${c}18`, padding:"3px 8px", borderRadius:20 }}>{rpnLabel(r)}</span>
                    </td>
                    <td style={{ padding:"8px 10px" }}><Inp value={item.acao} onChange={e=>upd(item.id,"acao",e.target.value)} sx={{ fontSize:11, padding:"4px 6px" }}/></td>
                    <td style={{ padding:"8px 10px" }}><Inp value={item.resp} onChange={e=>upd(item.id,"resp",e.target.value)} sx={{ fontSize:11, padding:"4px 6px", width:100 }}/></td>
                    <td style={{ padding:"8px 6px" }}>
                      <select value={item.status} onChange={e=>upd(item.id,"status",e.target.value)} style={{ ...s.inp, width:"auto", fontSize:11, padding:"4px 6px", color:item.status==="Concluída"?T.accent:item.status==="Em andamento"?T.yellow:T.text2 }}>
                        {["Pendente","Em andamento","Concluída"].map(x=><option key={x}>{x}</option>)}
                      </select>
                    </td>
                    <td style={{ padding:"8px 6px" }}>
                      <button style={s.btnD} onClick={()=>del(item.id)} title="Remover">✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ padding:"10px 14px", borderTop:`1px solid ${T.border}`, fontSize:11, color:T.text3, display:"flex", justifyContent:"space-between" }}>
            <span>{sorted.length} item(s) · {sorted.filter(x=>rpn(x)>=100).length} crítico(s) · {sorted.filter(x=>rpn(x)>=50&&rpn(x)<100).length} alto(s)</span>
            <span>S=Severidade · O=Ocorrência · D=Detecção · RPN=S×O×D</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── CEP TAB ────────────────────────────────────────────────────────────────── */
function CEPTab({ rncs }) {
  const T = useTheme(); const s = useS();
  const [metric, setMetric] = useState("rncs_mes");
  const [customData, setCustomData] = useState([{ label:"", value:"" },{ label:"", value:"" },{ label:"", value:"" }]);

  // Calcular dados de RNCs por mês (últimos 12 meses)
  const meses = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    const label = d.toLocaleDateString("pt-BR",{month:"short",year:"2-digit"});
    meses.push({ key, label });
  }

  const dadosMes = meses.map(m => ({
    label: m.label,
    value: rncs.filter(r => r.data?.startsWith(m.key)).length,
  }));

  const dadosEficacia = meses.map(m => ({
    label: m.label,
    value: rncs.filter(r => r.data?.startsWith(m.key) && r.status === "Eficaz").length,
  }));

  const activeData = metric === "custom" ? customData.map(x=>({...x,value:Number(x.value)||0})) : metric === "eficacia" ? dadosEficacia : dadosMes;
  const values = activeData.map(x => Number(x.value) || 0);
  const n = values.length;
  const mean = n > 0 ? values.reduce((a,b)=>a+b,0)/n : 0;
  const stdDev = n > 1 ? Math.sqrt(values.reduce((a,b)=>a+(b-mean)**2,0)/(n-1)) : 0;
  const UCL = mean + 3 * stdDev;
  const LCL = Math.max(0, mean - 3 * stdDev);
  const maxVal = Math.max(...values, UCL, 1);
  const outOfControl = values.filter(v => v > UCL || v < LCL).length;

  const barH = 200;
  const barW = Math.max(40, Math.floor(560 / Math.max(values.length, 1)));

  return (
    <div>
      <div style={{ ...s.card, marginBottom:"1rem" }}>
        <div style={{ fontSize:15, fontWeight:700, color:T.text, marginBottom:4 }}>📉 CEP — Controle Estatístico de Processo</div>
        <div style={{ fontSize:12, color:T.text2, lineHeight:1.6 }}>
          Monitora a variação do processo ao longo do tempo. Pontos fora dos limites UCL/LCL indicam causas especiais que requerem investigação.
        </div>
      </div>

      {/* Seletor de métrica */}
      <div style={{ display:"flex", gap:8, marginBottom:"1rem", flexWrap:"wrap" }}>
        {[["rncs_mes","📋 RNCs por Mês"],["eficacia","✅ Eficazes por Mês"],["custom","✏️ Dados Customizados"]].map(([id,label])=>(
          <button key={id} onClick={()=>setMetric(id)} style={{ padding:"7px 16px", borderRadius:20, border:`1px solid ${metric===id?T.accent+"55":T.border}`, background:metric===id?T.accentDim:T.surf, color:metric===id?T.accent:T.text2, cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:metric===id?600:400 }}>{label}</button>
        ))}
      </div>

      {/* Entrada de dados customizados */}
      {metric === "custom" && (
        <div style={{ ...s.card, marginBottom:"1rem" }}>
          <SecTitle ch="Inserir dados customizados" />
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:8 }}>
            {customData.map((d,i)=>(
              <div key={i} style={{ display:"flex", gap:4, alignItems:"center" }}>
                <Inp placeholder={`Label ${i+1}`} value={d.label} onChange={e=>setCustomData(p=>p.map((x,j)=>j===i?{...x,label:e.target.value}:x))} sx={{ width:80, fontSize:12 }}/>
                <Inp placeholder="Valor" type="number" value={d.value} onChange={e=>setCustomData(p=>p.map((x,j)=>j===i?{...x,value:e.target.value}:x))} sx={{ width:60, fontSize:12 }}/>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button style={s.btn} onClick={()=>setCustomData(p=>[...p,{label:"",value:""}])}>+ Adicionar ponto</button>
            {customData.length>3&&<button style={s.btnD} onClick={()=>setCustomData(p=>p.slice(0,-1))}>− Remover</button>}
          </div>
        </div>
      )}

      {/* Indicadores */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10, marginBottom:"1rem" }}>
        {[
          ["Média (X̄)", mean.toFixed(2), T.accent],
          ["Desvio Padrão (σ)", stdDev.toFixed(2), T.blue],
          ["UCL (+3σ)", UCL.toFixed(2), "#ff8c42"],
          ["LCL (-3σ)", LCL.toFixed(2), "#a78bfa"],
          ["Fora de Controle", outOfControl, outOfControl>0?"#ff4f6a":T.accent],
        ].map(([l,v,c])=>(
          <div key={l} style={{ background:T.surf, border:`1px solid ${T.border}`, borderRadius:10, padding:"10px 12px", textAlign:"center" }}>
            <div style={{ fontSize:18, fontWeight:700, color:c }}>{v}</div>
            <div style={{ fontSize:10, color:T.text3, marginTop:2 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Gráfico de controle */}
      <div style={{ ...s.card }}>
        <div style={{ fontSize:13, fontWeight:600, color:T.text, marginBottom:4 }}>
          Carta de Controle — {metric==="rncs_mes"?"RNCs por Mês":metric==="eficacia"?"Eficazes por Mês":"Dados Customizados"}
        </div>
        <div style={{ fontSize:11, color:T.text2, marginBottom:"1rem", paddingBottom:".75rem", borderBottom:`1px solid ${T.border}` }}>
          {outOfControl>0?<span style={{ color:"#ff4f6a", fontWeight:600 }}>⚠ {outOfControl} ponto(s) fora dos limites de controle — investigar causas especiais.</span>:<span style={{ color:T.accent }}>✓ Processo sob controle estatístico.</span>}
        </div>

        <div style={{ overflowX:"auto" }}>
          <svg width={Math.max(600, values.length*barW+80)} height={barH+80} style={{ display:"block" }}>
            {/* Grid lines */}
            {[0,.25,.5,.75,1].map((p,i)=>(
              <g key={i}>
                <line x1={50} y1={20+barH*(1-p)} x2={50+values.length*barW} y2={20+barH*(1-p)} stroke={T.border} strokeWidth={1} strokeDasharray="4,4"/>
                <text x={44} y={24+barH*(1-p)} textAnchor="end" fontSize={9} fill={T.text3}>{(maxVal*p).toFixed(1)}</text>
              </g>
            ))}

            {/* UCL line */}
            <line x1={50} y1={20+barH*(1-UCL/maxVal)} x2={50+values.length*barW} y2={20+barH*(1-UCL/maxVal)} stroke="#ff8c42" strokeWidth={1.5} strokeDasharray="6,3"/>
            <text x={55+values.length*barW} y={24+barH*(1-UCL/maxVal)} fontSize={9} fill="#ff8c42" fontWeight="700">UCL</text>

            {/* Mean line */}
            <line x1={50} y1={20+barH*(1-mean/maxVal)} x2={50+values.length*barW} y2={20+barH*(1-mean/maxVal)} stroke={T.accent} strokeWidth={2}/>
            <text x={55+values.length*barW} y={24+barH*(1-mean/maxVal)} fontSize={9} fill={T.accent} fontWeight="700">X̄</text>

            {/* LCL line */}
            {LCL > 0 && <>
              <line x1={50} y1={20+barH*(1-LCL/maxVal)} x2={50+values.length*barW} y2={20+barH*(1-LCL/maxVal)} stroke="#a78bfa" strokeWidth={1.5} strokeDasharray="6,3"/>
              <text x={55+values.length*barW} y={24+barH*(1-LCL/maxVal)} fontSize={9} fill="#a78bfa" fontWeight="700">LCL</text>
            </>}

            {/* Data bars + line */}
            {values.map((v,i)=>{
              const x = 50 + i*barW + barW/2;
              const y = 20 + barH*(1 - v/maxVal);
              const outCtrl = v > UCL || (LCL > 0 && v < LCL);
              return (
                <g key={i}>
                  <rect x={50+i*barW+4} y={y} width={barW-8} height={barH*(v/maxVal)} fill={outCtrl?`#ff4f6a22`:`${T.accent}22`} rx={3}/>
                  {i > 0 && <line x1={50+(i-1)*barW+barW/2} y1={20+barH*(1-values[i-1]/maxVal)} x2={x} y2={y} stroke={outCtrl?"#ff4f6a":T.accent} strokeWidth={1.5}/>}
                  <circle cx={x} cy={y} r={5} fill={outCtrl?"#ff4f6a":T.accent} stroke={T.bg} strokeWidth={2}/>
                  <text x={x} y={barH+30} textAnchor="middle" fontSize={9} fill={T.text3}>{activeData[i]?.label||i+1}</text>
                  <text x={x} y={y-8} textAnchor="middle" fontSize={9} fill={outCtrl?"#ff4f6a":T.text2} fontWeight={outCtrl?"700":"400"}>{v}</text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Legenda */}
        <div style={{ display:"flex", gap:16, marginTop:"1rem", flexWrap:"wrap" }}>
          {[["─","#ff8c42","UCL — Limite Superior de Controle"],["─",T.accent,"X̄ — Média"],["─","#a78bfa","LCL — Limite Inferior de Controle"],["●","#ff4f6a","Fora de controle"]].map(([sym,c,l])=>(
            <div key={l} style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:T.text2 }}>
              <span style={{ color:c, fontWeight:700 }}>{sym}</span>{l}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── FORNECEDORES TAB ───────────────────────────────────────────────────────── */
function FornecedoresTab({ rncs, fornecedores, setFornecedores, user, toast_, isAdmin }) {
  const T = useTheme(); const s = useS();
  const [sel, setSel] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [q, setQ] = useState("");
  const [catFiltro, setCatFiltro] = useState("");
  const [novoForn, setNovoForn] = useState({ nome:"", cnpj:"", categoria:"Matéria-prima", contato:"", email:"", telefone:"", cep:"", endereco:"", status:"Ativo", obs:"" });
  const [showNovo, setShowNovo] = useState(false);
  const [editData, setEditData] = useState({});

  const CATS = ["Matéria-prima","Material de embalagem","Insumo","Serviço","Outros"];
  const STATUS_FORN = { Ativo:"#2ab84a", Inativo:"#ffd166", Bloqueado:"#ff4f6a" };

  const addForn = async () => {
    try {
    if (!novoForn.nome.trim()) { alert("Nome é obrigatório."); return; }
    const id = String(Date.now());
    const novo = { ...novoForn, id, criadoEm: tod(), criadoPor: user.name };
    await saveCollection("fornecedores", id, novo);
    setNovoForn({ nome:"", cnpj:"", categoria:"Matéria-prima", contato:"", email:"", telefone:"", cep:"", endereco:"", status:"Ativo", obs:"" });
    setShowNovo(false);
    toast_("Fornecedor cadastrado!", "green");
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const saveEdit = async () => {
    try {
    await saveCollection("fornecedores", String(sel.id), { ...sel, ...editData });
    setSel(p => ({ ...p, ...editData }));
    setEditMode(false);
    toast_("Fornecedor atualizado!", "green");
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const delForn = async (id) => {
    try {
    if (!confirm("Excluir este fornecedor?")) return;
    await deleteFromCollection("fornecedores", String(id));
    setSel(null); toast_("Fornecedor removido.", "red");
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const list = fornecedores.filter(f =>
    (!q || f.nome.toLowerCase().includes(q.toLowerCase()) || f.cnpj?.includes(q)) &&
    (!catFiltro || f.categoria === catFiltro)
  );

  // RNCs por fornecedor
  const rncsForn = (nome) => rncs.filter(r => r.fornecedor === nome);
  const taxaForn = (nome) => {
    const rf = rncsForn(nome);
    const ef = rf.filter(x => x.status === "Eficaz").length;
    return rf.length > 0 ? Math.round(ef/rf.length*100) : null;
  };
  const riskLevel = (nome) => {
    const n = rncsForn(nome).length;
    const venc = rncsForn(nome).filter(x => x.prazoAC && x.prazoAC < tod() && x.status !== "Eficaz").length;
    if (venc > 0 || n >= 5) return { label:"Alto", color:"#ff4f6a" };
    if (n >= 3) return { label:"Médio", color:"#ff8c42" };
    if (n >= 1) return { label:"Baixo", color:"#ffd166" };
    return { label:"Sem NC", color:T.accent };
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", gap:10, marginBottom:"1rem", flexWrap:"wrap", alignItems:"center" }}>
        <Inp placeholder="🔍 Buscar por nome ou CNPJ..." value={q} onChange={e=>setQ(e.target.value)} sx={{ flex:1, minWidth:220 }}/>
        <Sel value={catFiltro} onChange={e=>setCatFiltro(e.target.value)} sx={{ width:"auto", minWidth:180 }}>
          <option value="">Todas as categorias</option>
          {CATS.map(c=><option key={c}>{c}</option>)}
        </Sel>
        {isAdmin && <button style={s.btnA} onClick={()=>setShowNovo(o=>!o)}>+ Novo Fornecedor</button>}
      </div>

      {/* Form novo fornecedor */}
      {showNovo && (
        <div style={{ ...s.card, marginBottom:"1rem", border:`1px solid ${T.accent}33` }}>
          <SecTitle icon="🏭" ch="Cadastrar novo fornecedor" />
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
            <F lbl="Nome *" ch={<Inp placeholder="Nome do fornecedor" value={novoForn.nome} onChange={e=>setNovoForn(p=>({...p,nome:e.target.value}))} />} />
            <F lbl="CNPJ" ch={<MaskedInp mask="cnpj" placeholder="00.000.000/0000-00" value={novoForn.cnpj} onChange={e=>setNovoForn(p=>({...p,cnpj:e.target.value}))} />} />
            <F lbl="Categoria" ch={<Sel value={novoForn.categoria} onChange={e=>setNovoForn(p=>({...p,categoria:e.target.value}))}>{CATS.map(c=><option key={c}>{c}</option>)}</Sel>} />
            <F lbl="Nome do contato" ch={<Inp placeholder="Responsável comercial" value={novoForn.contato} onChange={e=>setNovoForn(p=>({...p,contato:e.target.value}))} />} />
            <F lbl="E-mail" ch={<Inp type="email" placeholder="contato@fornecedor.com" value={novoForn.email} onChange={e=>setNovoForn(p=>({...p,email:e.target.value}))} />} />
            <F lbl="Telefone" ch={<MaskedInp mask="telefone" placeholder="(00) 00000-0000" value={novoForn.telefone} onChange={e=>setNovoForn(p=>({...p,telefone:e.target.value}))} />} />
            <F lbl="CEP" ch={<MaskedInp mask="cep" placeholder="00000-000" value={novoForn.cep||""} onChange={e=>setNovoForn(p=>({...p,cep:e.target.value}))} />} />
            <F lbl="Endereço" ch={<Inp placeholder="Rua, número, bairro, cidade" value={novoForn.endereco||""} onChange={e=>setNovoForn(p=>({...p,endereco:e.target.value}))} />} />
          </div>
          <F lbl="Observações" ch={<TA rows={2} placeholder="Informações adicionais..." value={novoForn.obs} onChange={e=>setNovoForn(p=>({...p,obs:e.target.value}))} />} />
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:8 }}>
            <button style={s.btn} onClick={()=>setShowNovo(false)}>Cancelar</button>
            <button style={s.btnA} onClick={addForn}>Cadastrar →</button>
          </div>
        </div>
      )}

      {/* Stats resumo */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:"1rem" }}>
        {[
          ["Total",       fornecedores.length,                                    T.accent],
          ["Ativos",      fornecedores.filter(x=>x.status==="Ativo").length,       T.accent],
          ["Bloqueados",  fornecedores.filter(x=>x.status==="Bloqueado").length,   "#ff4f6a"],
          ["Com NCs",     fornecedores.filter(x=>rncsForn(x.nome).length>0).length,"#ff8c42"],
        ].map(([l,n,c])=>(
          <div key={l} style={{ background:T.surf, border:`1px solid ${T.border}`, borderRadius:10, padding:"10px 14px", textAlign:"center" }}>
            <div style={{ fontSize:22, fontWeight:700, color:c }}>{n}</div>
            <div style={{ fontSize:11, color:T.text3, marginTop:2 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Lista */}
      {list.length === 0 ? (
        <div style={{ ...s.card, textAlign:"center", padding:"3rem" }}>
          <div style={{ fontSize:40, marginBottom:"1rem", opacity:.3 }}>🏭</div>
          <div style={{ fontSize:14, color:T.text2, marginBottom:6 }}>Nenhum fornecedor cadastrado</div>
          <div style={{ fontSize:12, color:T.text3 }}>Clique em "+ Novo Fornecedor" para começar</div>
        </div>
      ) : (
        <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:T.surf }}>
                {["Fornecedor","Categoria","Contato","Status","Risco","NCs","Taxa Eficácia",""].map(h=>(
                  <th key={h} style={{ padding:"10px 12px", fontSize:10, fontWeight:700, color:T.text3, textTransform:"uppercase", letterSpacing:".06em", textAlign:"left", borderBottom:`1px solid ${T.border}`, whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((f, idx) => {
                const risk = riskLevel(f.nome);
                const ncs = rncsForn(f.nome).length;
                const taxa = taxaForn(f.nome);
                return (
                  <tr key={f.id} onClick={()=>setSel(f)} style={{ background:idx%2===0?T.card:T.surf, cursor:"pointer", transition:"background .15s" }}>
                    <td style={{ padding:"10px 12px" }}>
                      <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{f.nome}</div>
                      {f.cnpj && <div style={{ fontSize:10, color:T.text3 }}>{f.cnpj}</div>}
                    </td>
                    <td style={{ padding:"10px 12px", fontSize:12, color:T.text2 }}>{f.categoria}</td>
                    <td style={{ padding:"10px 12px" }}>
                      <div style={{ fontSize:12, color:T.text2 }}>{f.contato||"—"}</div>
                      {f.email && <div style={{ fontSize:10, color:T.text3 }}>{f.email}</div>}
                    </td>
                    <td style={{ padding:"10px 12px" }}>
                      <span style={{ fontSize:11, fontWeight:600, color:STATUS_FORN[f.status]||T.text2, background:`${STATUS_FORN[f.status]||T.accent}18`, padding:"3px 10px", borderRadius:20 }}>{f.status}</span>
                    </td>
                    <td style={{ padding:"10px 12px" }}>
                      <span style={{ fontSize:11, fontWeight:600, color:risk.color, background:`${risk.color}18`, padding:"3px 10px", borderRadius:20 }}>{risk.label}</span>
                    </td>
                    <td style={{ padding:"10px 12px", fontSize:14, fontWeight:700, color:ncs>0?"#ff8c42":T.text3 }}>{ncs}</td>
                    <td style={{ padding:"10px 12px", fontSize:13, fontWeight:700, color:taxa===null?T.text3:taxa>=70?T.accent:"#ff8c42" }}>
                      {taxa !== null ? `${taxa}%` : "—"}
                    </td>
                    <td style={{ padding:"10px 8px" }}>
                      <button style={{ ...s.btn, padding:"4px 10px", fontSize:11 }} onClick={e=>{e.stopPropagation();setSel(f);}}>Ver</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ padding:"8px 14px", borderTop:`1px solid ${T.border}`, fontSize:11, color:T.text3 }}>
            {list.length} fornecedor(es) encontrado(s)
          </div>
        </div>
      )}

      {/* Modal detalhe do fornecedor */}
      {sel && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.82)", backdropFilter:"blur(6px)", zIndex:999, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }} onClick={e=>e.target===e.currentTarget&&setSel(null)}>
          <div style={{ background:T.card2, border:`1px solid ${T.border2}`, borderRadius:18, padding:"1.75rem", maxWidth:720, width:"100%", maxHeight:"90vh", overflowY:"auto", boxShadow:"0 32px 80px #000a" }}>

            {/* Header */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"1.25rem" }}>
              <div>
                <div style={{ fontSize:22, fontWeight:700 }}>{sel.nome}</div>
                <div style={{ fontSize:12, color:T.text2, marginTop:2 }}>{sel.categoria} · Cadastrado em {fmt(sel.criadoEm)} por {sel.criadoPor}</div>
              </div>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <span style={{ fontSize:11, fontWeight:600, color:STATUS_FORN[sel.status], background:`${STATUS_FORN[sel.status]}18`, padding:"4px 12px", borderRadius:20 }}>{sel.status}</span>
                {isAdmin && !editMode && <button onClick={()=>{setEditData({...sel});setEditMode(true);}} style={{ ...s.btn, fontSize:11, color:T.accent, borderColor:T.accent+"33", background:T.accentDim }}><span className="btn-emoji">✏️ </span>Editar</button>}
                <button onClick={()=>{setSel(null);setEditMode(false);}} style={{ background:T.border, border:"none", color:T.text2, cursor:"pointer", borderRadius:8, padding:"6px 10px", fontSize:16, fontFamily:"inherit" }}>✕</button>
              </div>
            </div>

            {editMode ? (
              <div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:12 }}>
                  <F lbl="Nome" ch={<Inp value={editData.nome} onChange={e=>setEditData(p=>({...p,nome:e.target.value}))} />} />
                  <F lbl="CNPJ" ch={<MaskedInp mask="cnpj" value={editData.cnpj||""} onChange={e=>setEditData(p=>({...p,cnpj:e.target.value}))} />} />
                  <F lbl="Categoria" ch={<Sel value={editData.categoria} onChange={e=>setEditData(p=>({...p,categoria:e.target.value}))}>{CATS.map(c=><option key={c}>{c}</option>)}</Sel>} />
                  <F lbl="Contato" ch={<Inp value={editData.contato||""} onChange={e=>setEditData(p=>({...p,contato:e.target.value}))} />} />
                  <F lbl="E-mail" ch={<Inp value={editData.email||""} onChange={e=>setEditData(p=>({...p,email:e.target.value}))} />} />
                  <F lbl="Telefone" ch={<MaskedInp mask="telefone" value={editData.telefone||""} onChange={e=>setEditData(p=>({...p,telefone:e.target.value}))} />} />
                  <F lbl="CEP" ch={<MaskedInp mask="cep" value={editData.cep||""} onChange={e=>setEditData(p=>({...p,cep:e.target.value}))} />} />
                  <F lbl="Endereço" ch={<Inp value={editData.endereco||""} onChange={e=>setEditData(p=>({...p,endereco:e.target.value}))} />} />
                  <F lbl="Status" ch={<Sel value={editData.status} onChange={e=>setEditData(p=>({...p,status:e.target.value}))}>{Object.keys(STATUS_FORN).map(x=><option key={x}>{x}</option>)}</Sel>} />
                </div>
                <F lbl="Observações" ch={<TA rows={3} value={editData.obs||""} onChange={e=>setEditData(p=>({...p,obs:e.target.value}))} />} />
                <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:12 }}>
                  <button style={s.btn} onClick={()=>setEditMode(false)}>Cancelar</button>
                  <button style={s.btnA} onClick={saveEdit}><span className="btn-emoji">💾 </span>Salvar</button>
                </div>
              </div>
            ) : (
              <div>
                {/* Dados */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:"1rem" }}>
                  {[["CNPJ",sel.cnpj],["Contato",sel.contato],["E-mail",sel.email],["Telefone",sel.telefone],["CEP",sel.cep],["Endereço",sel.endereco]].filter(([,v])=>v).map(([k,v])=>(
                    <div key={k} style={{ background:T.surf, borderRadius:8, padding:"10px 12px" }}>
                      <div style={{ fontSize:10, color:T.text3, fontWeight:700, textTransform:"uppercase", marginBottom:3 }}>{k}</div>
                      <div style={{ fontSize:13 }}>{v}</div>
                    </div>
                  ))}
                </div>
                {sel.obs && <div style={{ background:T.surf, borderRadius:8, padding:"10px 12px", marginBottom:"1rem", fontSize:13, color:T.text2 }}><b style={{ color:T.text3 }}>Obs:</b> {sel.obs}</div>}

                {/* Indicadores de risco */}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:"1rem" }}>
                  {[
                    ["Total NCs",   rncsForn(sel.nome).length, "#ff8c42"],
                    ["Abertas",     rncsForn(sel.nome).filter(x=>x.status==="Aberta").length, "#ff4f6a"],
                    ["Eficazes",    rncsForn(sel.nome).filter(x=>x.status==="Eficaz").length, T.accent],
                    ["Risco",       riskLevel(sel.nome).label, riskLevel(sel.nome).color],
                  ].map(([l,v,c])=>(
                    <div key={l} style={{ background:T.card, border:`1px solid ${c}22`, borderRadius:10, padding:"10px", textAlign:"center" }}>
                      <div style={{ fontSize:18, fontWeight:700, color:c }}>{v}</div>
                      <div style={{ fontSize:10, color:T.text3, marginTop:2 }}>{l}</div>
                    </div>
                  ))}
                </div>

                {/* Histórico de NCs */}
                <div style={{ marginBottom:"1rem" }}>
                  <div style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:8 }}>📋 Histórico de Não Conformidades</div>
                  {rncsForn(sel.nome).length === 0 ? (
                    <div style={{ color:T.text3, fontSize:12, padding:"1rem", textAlign:"center", background:T.surf, borderRadius:8 }}>✓ Nenhuma NC registrada para este fornecedor</div>
                  ) : [...rncsForn(sel.nome)].sort((a,b)=>b.createdAt-a.createdAt).map(r=>(
                    <div key={r.id} style={{ background:T.surf, border:`1px solid ${T.border}`, borderLeft:`3px solid ${SMETA[r.status]?.dot||T.accent}`, borderRadius:8, padding:"10px 12px", marginBottom:6 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                          <span style={{ fontSize:11, fontWeight:700, color:T.accent }}>{r.num}</span>
                          <SevB s={r.sev}/><Badge s={r.status}/>
                        </div>
                        <span style={{ fontSize:10, color:T.text3 }}>{fmt(r.data)}</span>
                      </div>
                      <div style={{ fontSize:12, color:T.text2 }}>{r.desc?.substring(0,70)}...</div>
                    </div>
                  ))}
                </div>

                <div style={{ display:"flex", gap:8, justifyContent:"flex-end", borderTop:`1px solid ${T.border}`, paddingTop:"1rem" }}>
                  {isAdmin && <button style={s.btnD} onClick={()=>delForn(sel.id)}><span className="btn-emoji">🗑️ </span>Excluir</button>}
                  <button style={s.btn} onClick={()=>setSel(null)}>Fechar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── NQA / AQL TAB ─────────────────────────────────────────────────────────── */
// Tabelas ISO 2859-1
const NQA_LETRAS = {
  2:     { I:"A", II:"A", III:"B", "S-1":"A", "S-2":"A", "S-3":"A", "S-4":"A" },
  8:     { I:"A", II:"B", III:"C", "S-1":"A", "S-2":"A", "S-3":"A", "S-4":"A" },
  15:    { I:"B", II:"C", III:"D", "S-1":"A", "S-2":"A", "S-3":"B", "S-4":"B" },
  25:    { I:"C", II:"D", III:"E", "S-1":"A", "S-2":"B", "S-3":"B", "S-4":"C" },
  50:    { I:"C", II:"E", III:"F", "S-1":"B", "S-2":"B", "S-3":"C", "S-4":"C" },
  90:    { I:"C", II:"F", III:"G", "S-1":"B", "S-2":"B", "S-3":"C", "S-4":"D" },
  150:   { I:"D", II:"G", III:"H", "S-1":"B", "S-2":"C", "S-3":"D", "S-4":"E" },
  280:   { I:"E", II:"H", III:"J", "S-1":"B", "S-2":"C", "S-3":"D", "S-4":"E" },
  500:   { I:"F", II:"J", III:"K", "S-1":"C", "S-2":"C", "S-3":"E", "S-4":"F" },
  1200:  { I:"G", II:"K", III:"L", "S-1":"C", "S-2":"D", "S-3":"E", "S-4":"G" },
  3200:  { I:"H", II:"L", III:"M", "S-1":"C", "S-2":"D", "S-3":"F", "S-4":"G" },
  10000: { I:"J", II:"M", III:"N", "S-1":"C", "S-2":"E", "S-3":"F", "S-4":"H" },
  35000: { I:"K", II:"N", III:"P", "S-1":"C", "S-2":"E", "S-3":"G", "S-4":"H" },
  150000:{ I:"L", II:"P", III:"Q", "S-1":"D", "S-2":"F", "S-3":"G", "S-4":"J" },
  500000:{ I:"M", II:"Q", III:"R", "S-1":"D", "S-2":"F", "S-3":"H", "S-4":"J" },
  999999:{ I:"N", II:"R", III:"S", "S-1":"D", "S-2":"G", "S-3":"H", "S-4":"K" },
};

// Tabela de amostragem simples normal (ISO 2859-1 Tabela II-A)
const NQA_AMOSTRAS = {
  A:  { n:2,   ac:{ "0.065":0,"0.1":0,"0.15":0,"0.25":0,"0.4":0,"0.65":0,"1.0":0,"1.5":0,"2.5":0,"4.0":0,"6.5":0,"10":0 }, re:{ "0.065":1,"0.1":1,"0.15":1,"0.25":1,"0.4":1,"0.65":1,"1.0":1,"1.5":1,"2.5":1,"4.0":1,"6.5":1,"10":1 } },
  B:  { n:3,   ac:{ "0.25":0,"0.4":0,"0.65":0,"1.0":0,"1.5":0,"2.5":0,"4.0":0,"6.5":0,"10":1 }, re:{ "0.25":1,"0.4":1,"0.65":1,"1.0":1,"1.5":1,"2.5":1,"4.0":1,"6.5":1,"10":2 } },
  C:  { n:5,   ac:{ "0.4":0,"0.65":0,"1.0":0,"1.5":0,"2.5":0,"4.0":0,"6.5":1,"10":1 }, re:{ "0.4":1,"0.65":1,"1.0":1,"1.5":1,"2.5":1,"4.0":1,"6.5":2,"10":2 } },
  D:  { n:8,   ac:{ "0.65":0,"1.0":0,"1.5":0,"2.5":0,"4.0":1,"6.5":1,"10":2 }, re:{ "0.65":1,"1.0":1,"1.5":1,"2.5":1,"4.0":2,"6.5":2,"10":3 } },
  E:  { n:13,  ac:{ "1.0":0,"1.5":0,"2.5":1,"4.0":1,"6.5":2,"10":3 }, re:{ "1.0":1,"1.5":1,"2.5":2,"4.0":2,"6.5":3,"10":4 } },
  F:  { n:20,  ac:{ "1.0":0,"1.5":1,"2.5":1,"4.0":2,"6.5":3,"10":5 }, re:{ "1.0":1,"1.5":2,"2.5":2,"4.0":3,"6.5":4,"10":6 } },
  G:  { n:32,  ac:{ "1.0":1,"1.5":1,"2.5":2,"4.0":3,"6.5":5,"10":7 }, re:{ "1.0":2,"1.5":2,"2.5":3,"4.0":4,"6.5":6,"10":8 } },
  H:  { n:50,  ac:{ "1.0":1,"1.5":2,"2.5":3,"4.0":5,"6.5":7,"10":10}, re:{ "1.0":2,"1.5":3,"2.5":4,"4.0":6,"6.5":8,"10":11} },
  J:  { n:80,  ac:{ "1.0":2,"1.5":3,"2.5":5,"4.0":7,"6.5":10,"10":14}, re:{ "1.0":3,"1.5":4,"2.5":6,"4.0":8,"6.5":11,"10":15} },
  K:  { n:125, ac:{ "1.0":3,"1.5":5,"2.5":7,"4.0":10,"6.5":14,"10":21}, re:{ "1.0":4,"1.5":6,"2.5":8,"4.0":11,"6.5":15,"10":22} },
  L:  { n:200, ac:{ "1.0":5,"1.5":7,"2.5":10,"4.0":14,"6.5":21}, re:{ "1.0":6,"1.5":8,"2.5":11,"4.0":15,"6.5":22} },
  M:  { n:315, ac:{ "1.0":7,"1.5":10,"2.5":14,"4.0":21}, re:{ "1.0":8,"1.5":11,"2.5":15,"4.0":22} },
  N:  { n:500, ac:{ "1.0":10,"1.5":14,"2.5":21}, re:{ "1.0":11,"1.5":15,"2.5":22} },
  P:  { n:800, ac:{ "1.0":14,"1.5":21}, re:{ "1.0":15,"1.5":22} },
  Q:  { n:1250,ac:{ "1.0":21}, re:{ "1.0":22} },
};

function getLetra(tam, nivel) {
  const limites = Object.keys(NQA_LETRAS).map(Number).sort((a,b)=>a-b);
  for (const l of limites) { if (tam <= l) return NQA_LETRAS[l][nivel]; }
  return "S";
}

function NQATab({ user, toast_ }) {
  const T = useTheme(); const s = useS();
  const [tam, setTam] = useState("");
  const [nivel, setNivel] = useState("II");
  const [nqa, setNqa] = useState("1.0");
  const [resultado, setResultado] = useState(null);
  const [historico, setHistorico] = useState([]);

  const calcular = () => {
    const n = parseInt(tam);
    if (!n || n < 2) { alert("Informe o tamanho do lote (mínimo 2)."); return; }
    const letra = getLetra(n, nivel);
    const tabela = NQA_AMOSTRAS[letra];
    if (!tabela) { alert("Letra fora da tabela. Verifique os parâmetros."); return; }
    const ac = tabela.ac[nqa];
    const re = tabela.re[nqa];
    if (ac === undefined) {
      setResultado({ letra, n: tabela.n, ac: "↑", re: "↑", obs: "Use plano de amostragem com letra maior ou reduza o NQA." });
    } else {
      const res = { letra, n: tabela.n, ac, re, lote: n, nivel, nqa, data: tod(), resp: user.name };
      setResultado(res);
      setHistorico(p => [res, ...p.slice(0, 9)]);
      toast_("Amostragem calculada!", "green");
    }
  };

  const NIVEIS_GERAIS = [
    { id:"I",   label:"Nível I",   desc:"Visual reduzido" },
    { id:"II",  label:"Nível II",  desc:"Visual normal (padrão)" },
    { id:"III", label:"Nível III", desc:"Visual reforçado" },
  ];
  const NIVEIS_ESPECIAIS = [
    { id:"S-1", label:"S-1", desc:"Amostra mínima" },
    { id:"S-2", label:"S-2", desc:"Amostra reduzida" },
    { id:"S-3", label:"S-3", desc:"Amostra normal" },
    { id:"S-4", label:"S-4", desc:"Amostra maior" },
  ];
  const NQAS = ["0.065","0.1","0.15","0.25","0.4","0.65","1.0","1.5","2.5","4.0","6.5","10"];
  const MATERIAL_NQA = [
    { tipo:"Inspeção visual geral",                    nivel:"II",  nqa:"1.0",  grupo:"Nível Geral (Visual)" },
    { tipo:"Inspeção visual rigorosa",                 nivel:"III", nqa:"0.65", grupo:"Nível Geral (Visual)" },
    { tipo:"Dimensional — embalagem primária",         nivel:"S-3", nqa:"1.5",  grupo:"Nível Especial" },
    { tipo:"Dimensional — embalagem secundária",       nivel:"S-2", nqa:"2.5",  grupo:"Nível Especial" },
    { tipo:"Físico-químico — MP crítica",              nivel:"S-2", nqa:"0.65", grupo:"Nível Especial" },
    { tipo:"Físico-químico — MP geral / excipiente",   nivel:"S-2", nqa:"1.0",  grupo:"Nível Especial" },
    { tipo:"Microbiológico — matéria-prima",           nivel:"S-1", nqa:"0.65", grupo:"Nível Especial" },
    { tipo:"Microbiológico — produto acabado",         nivel:"S-1", nqa:"1.0",  grupo:"Nível Especial" },
  ];

  return (
    <div>
      {/* Info card */}
      <div style={{ ...s.card, background:`linear-gradient(135deg,${T.card},${T.card2})`, marginBottom:"1rem" }}>
        <div style={{ fontSize:15, fontWeight:700, color:T.text, marginBottom:4 }}>📐 NQA / AQL — Cálculo de Amostragem ISO 2859-1</div>
        <div style={{ fontSize:12, color:T.text2, lineHeight:1.7, maxWidth:700 }}>
          O <strong>Nível de Qualidade Aceitável (NQA)</strong> define quantas unidades inspecionar em um lote recebido e quantos defeitos são toleráveis antes de reprovar o lote. Baseado na norma <strong>ISO 2859-1</strong> (equivalente ANSI/ASQ Z1.4).
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.5rem" }}>
        {/* Calculadora */}
        <div>
          <div style={s.card}>
            <SecTitle icon="🔢" ch="Calculadora de amostragem" />

            <F lbl="Tamanho do lote (unidades)" ch={
              <Inp type="number" placeholder="Ex: 5000" value={tam} onChange={e=>setTam(e.target.value)} onKeyDown={e=>e.key==="Enter"&&calcular()} />
            }/>

            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, color:T.text3, fontWeight:600, textTransform:"uppercase", letterSpacing:".06em", marginBottom:6 }}>Nível Geral — Inspeção Visual</div>
              <div style={{ display:"flex", gap:6, marginBottom:10 }}>
                {NIVEIS_GERAIS.map(n=>(
                  <button key={n.id} onClick={()=>setNivel(n.id)} style={{ flex:1, padding:"7px 6px", border:`1px solid ${nivel===n.id?T.accent+"55":T.border}`, background:nivel===n.id?T.accentDim:T.surf, color:nivel===n.id?T.accent:T.text2, cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:nivel===n.id?600:400, borderRadius:8, textAlign:"center" }}>
                    <div style={{ fontWeight:700 }}>{n.label}</div>
                    <div style={{ fontSize:9, marginTop:1, opacity:.7 }}>{n.desc}</div>
                  </button>
                ))}
              </div>
              <div style={{ fontSize:11, color:T.text3, fontWeight:600, textTransform:"uppercase", letterSpacing:".06em", marginBottom:6 }}>Nível Especial — Dimensional / Físico-químico / Microbiológico</div>
              <div style={{ display:"flex", gap:6 }}>
                {NIVEIS_ESPECIAIS.map(n=>(
                  <button key={n.id} onClick={()=>setNivel(n.id)} style={{ flex:1, padding:"7px 6px", border:`1px solid ${nivel===n.id?T.accent+"55":T.border}`, background:nivel===n.id?T.accentDim:T.surf, color:nivel===n.id?T.accent:T.text2, cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:nivel===n.id?600:400, borderRadius:8, textAlign:"center" }}>
                    <div style={{ fontWeight:700 }}>{n.label}</div>
                    <div style={{ fontSize:9, marginTop:1, opacity:.7 }}>{n.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <F lbl="NQA desejado (%)" ch={
              <Sel value={nqa} onChange={e=>setNqa(e.target.value)}>
                {NQAS.map(n=><option key={n} value={n}>{n}%{n==="1.0"?" (padrão farmacêutico)":""}</option>)}
              </Sel>
            }/>

            <button style={{ ...s.btnA, width:"100%", marginTop:8, fontSize:14, padding:"12px" }} onClick={calcular}>
              Calcular amostragem →
            </button>

            {/* Resultado */}
            {resultado && (
              <div style={{ marginTop:"1.25rem", background:T.accentDim, border:`1px solid ${T.accent}33`, borderRadius:12, padding:"1.25rem" }}>
                <div style={{ fontSize:12, color:T.accent, fontWeight:700, textTransform:"uppercase", letterSpacing:".06em", marginBottom:"1rem" }}>✅ Resultado</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
                  {[
                    ["Letra do código", resultado.letra, T.accent],
                    ["Tamanho da amostra", resultado.n, T.accent],
                    ["Nº de aceitação (Ac)", resultado.ac === "↑" ? "—" : resultado.ac, "#2ab84a"],
                    ["Nº de rejeição (Re)", resultado.re === "↑" ? "—" : resultado.re, "#ff4f6a"],
                  ].map(([l,v,c])=>(
                    <div key={l} style={{ background:T.surf, borderRadius:8, padding:"10px 12px" }}>
                      <div style={{ fontSize:10, color:T.text3, fontWeight:700, textTransform:"uppercase", marginBottom:4 }}>{l}</div>
                      <div style={{ fontSize:24, fontWeight:800, color:c }}>{v}</div>
                    </div>
                  ))}
                </div>
                {resultado.obs && <div style={{ fontSize:12, color:"#ff8c42", marginBottom:8 }}>⚠ {resultado.obs}</div>}
                <div style={{ fontSize:12, color:T.text2, lineHeight:1.7, background:T.surf, borderRadius:8, padding:"10px 12px" }}>
                  <strong>Como usar:</strong> Colete <strong style={{ color:T.accent }}>{resultado.n} amostras</strong> aleatórias do lote.<br/>
                  Se encontrar até <strong style={{ color:"#2ab84a" }}>{resultado.ac}</strong> defeito(s) → <span style={{ color:"#2ab84a", fontWeight:700 }}>APROVAR</span> o lote.<br/>
                  Se encontrar <strong style={{ color:"#ff4f6a" }}>{resultado.re}</strong> ou mais defeito(s) → <span style={{ color:"#ff4f6a", fontWeight:700 }}>REPROVAR</span> o lote.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tabela de referência + histórico */}
        <div>
          <div style={{ ...s.card, marginBottom:"1rem" }}>
            <SecTitle icon="📋" ch="Referência por tipo de análise" />
            {["Nível Geral (Visual)","Nível Especial"].map(grupo=>(
              <div key={grupo} style={{ marginBottom:12 }}>
                <div style={{ fontSize:10, fontWeight:700, color:T.accent, textTransform:"uppercase", letterSpacing:".06em", marginBottom:6, paddingBottom:4, borderBottom:`1px solid ${T.border}` }}>{grupo}</div>
                {MATERIAL_NQA.filter(m=>m.grupo===grupo).map((m,i)=>(
                  <div key={i} onClick={()=>{setNqa(m.nqa);setNivel(m.nivel);}} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 10px", background:T.surf, border:`1px solid ${T.border}`, borderRadius:8, marginBottom:5, cursor:"pointer", transition:"all .15s" }}>
                    <div style={{ fontSize:12, color:T.text }}>{m.tipo}</div>
                    <div style={{ display:"flex", gap:6, alignItems:"center", flexShrink:0 }}>
                      <span style={{ fontSize:10, color:T.text3 }}>Nível {m.nivel}</span>
                      <span style={{ fontSize:11, fontWeight:700, color:T.accent, background:T.accentDim, padding:"2px 8px", borderRadius:20 }}>NQA {m.nqa}%</span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            <div style={{ fontSize:11, color:T.text3, fontStyle:"italic" }}>💡 Clique para aplicar automaticamente</div>
          </div>

          {historico.length > 0 && (
            <div style={s.card}>
              <SecTitle icon="🕐" ch="Histórico de cálculos" />
              {historico.map((h,i)=>(
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 12px", background:T.surf, border:`1px solid ${T.border}`, borderRadius:8, marginBottom:6, fontSize:12 }}>
                  <div>
                    <span style={{ fontWeight:600, color:T.text }}>Lote: {h.lote} un.</span>
                    <span style={{ color:T.text3, marginLeft:8 }}>NQA {h.nqa}% · Nível {h.nivel}</span>
                  </div>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <span style={{ color:T.accent, fontWeight:700 }}>n={h.n}</span>
                    <span style={{ color:"#2ab84a" }}>Ac≤{h.ac}</span>
                    <span style={{ color:"#ff4f6a" }}>Re≥{h.re}</span>
                    <span style={{ color:T.text3, fontSize:10 }}>{fmt(h.data)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── CQ TAB — Fichas de Análise ─────────────────────────────────────────────── */
const ENSAIOS_PADRAO = {
  "Matéria-prima (pó)": [
    { nome:"Aspecto",              metodo:"Visual",          unidade:"—",   tipo:"texto",    espec:"Conforme padrão" },
    { nome:"Cor",                  metodo:"Visual",          unidade:"—",   tipo:"texto",    espec:"Conforme padrão" },
    { nome:"Odor",                 metodo:"Organoléptico",   unidade:"—",   tipo:"texto",    espec:"Característico" },
    { nome:"pH (solução 1%)",      metodo:"pHmetro",         unidade:"pH",  tipo:"numero",   espec:"5,0 – 7,0",  min:5.0, max:7.0 },
    { nome:"Umidade",              metodo:"Karl Fischer / IV",unidade:"%",  tipo:"numero",   espec:"≤ 5,0%",     min:0,   max:5.0 },
    { nome:"Densidade aparente",   metodo:"Proveta graduada",unidade:"g/mL",tipo:"numero",   espec:"Conforme EI", min:null,max:null },
    { nome:"Densidade compactada", metodo:"Proveta graduada",unidade:"g/mL",tipo:"numero",   espec:"Conforme EI", min:null,max:null },
    { nome:"Granulometria",        metodo:"Tamises",         unidade:"%",   tipo:"numero",   espec:"Conforme EI", min:null,max:null },
    { nome:"Identificação (CCD)",  metodo:"CCD / FTIR",      unidade:"—",   tipo:"conforme", espec:"Positivo" },
    { nome:"Metais pesados",       metodo:"ICP-MS",          unidade:"ppm", tipo:"numero",   espec:"≤ 10 ppm",   min:0,   max:10 },
  ],
  "Embalagem primária": [
    { nome:"Aspecto visual",       metodo:"Visual",          unidade:"—",   tipo:"conforme", espec:"Sem defeitos" },
    { nome:"Dimensões (altura)",   metodo:"Paquímetro",      unidade:"mm",  tipo:"numero",   espec:"Conforme EI", min:null,max:null },
    { nome:"Dimensões (diâmetro)", metodo:"Paquímetro",      unidade:"mm",  tipo:"numero",   espec:"Conforme EI", min:null,max:null },
    { nome:"Vedação / fechamento", metodo:"Teste de torque", unidade:"N.m", tipo:"conforme", espec:"Sem vazamento" },
    { nome:"Impressão / gravação", metodo:"Visual",          unidade:"—",   tipo:"conforme", espec:"Legível e correto" },
  ],
  "Embalagem secundária": [
    { nome:"Aspecto visual",       metodo:"Visual",          unidade:"—",   tipo:"conforme", espec:"Sem defeitos" },
    { nome:"Impressão / texto",    metodo:"Visual",          unidade:"—",   tipo:"conforme", espec:"Conforme aprovado" },
    { nome:"Dimensões",            metodo:"Paquímetro",      unidade:"mm",  tipo:"conforme", espec:"Conforme EI" },
    { nome:"Código de barras",     metodo:"Leitor",          unidade:"—",   tipo:"conforme", espec:"Leitura correta" },
  ],
  "Cápsula vazia": [
    { nome:"Aspecto visual",       metodo:"Visual",          unidade:"—",   tipo:"conforme", espec:"Sem defeitos" },
    { nome:"Peso médio",           metodo:"Balança analítica",unidade:"mg", tipo:"numero",   espec:"Conforme EI", min:null,max:null },
    { nome:"Umidade",              metodo:"Karl Fischer",    unidade:"%",   tipo:"numero",   espec:"12,0 – 16,0", min:12.0,max:16.0 },
    { nome:"Dimensões",            metodo:"Paquímetro",      unidade:"mm",  tipo:"numero",   espec:"Conforme EI", min:null,max:null },
    { nome:"Desintegração",        metodo:"Desintegrador",   unidade:"min", tipo:"numero",   espec:"≤ 15 min",    min:0,   max:15 },
  ],
  "Produto acabado": [
    { nome:"Aspecto",              metodo:"Visual",          unidade:"—",   tipo:"conforme", espec:"Conforme padrão" },
    { nome:"Peso médio",           metodo:"Balança analítica",unidade:"mg", tipo:"numero",   espec:"Conforme EI", min:null,max:null },
    { nome:"Variação de peso",     metodo:"Balança analítica",unidade:"%",  tipo:"numero",   espec:"≤ 5,0%",      min:0,   max:5.0 },
    { nome:"Desintegração",        metodo:"Desintegrador",   unidade:"min", tipo:"numero",   espec:"≤ 30 min",    min:0,   max:30 },
    { nome:"Dureza",               metodo:"Durômetro",       unidade:"N",   tipo:"numero",   espec:"Conforme EI", min:null,max:null },
    { nome:"Friabilidade",         metodo:"Friabilômetro",   unidade:"%",   tipo:"numero",   espec:"≤ 1,0%",      min:0,   max:1.0 },
    { nome:"Identificação (HPLC)", metodo:"HPLC",            unidade:"—",   tipo:"conforme", espec:"Positivo" },
    { nome:"Doseamento (HPLC)",    metodo:"HPLC",            unidade:"%",   tipo:"numero",   espec:"90,0 – 110,0",min:90,  max:110 },
  ],
};

function CQTab({ user, toast_, fornecedores, doSaveRNC, setTab }) {
  const T = useTheme(); const s = useS();
  const CQ_KEY = "cq_fichas";
  const [fichas, setFichas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("lista");
  const [selFicha, setSelFicha] = useState(null);

  const [form, setForm] = useState({ material:"", tipoPadrao:"Matéria-prima (pó)", fornecedor:"", lote:"", qtdRecebida:"", nf:"", dataRecebimento:tod(), dataAnalise:tod(), resp:user.name });
  const [ensaios, setEnsaios] = useState([]);
  const [coa, setCoa] = useState(null);
  const [coaUploading, setCoaUploading] = useState(false);
  const setF = (k,v) => setForm(p=>({...p,[k]:v}));

  useEffect(()=>{
    const unsub = subscribeCollection(CQ_KEY, (list) => {
      setFichas(list.sort((a,b) => (b.criadoTs||0) - (a.criadoTs||0)));
      setLoading(false);
    });
    const t = setTimeout(() => setLoading(false), 3000);
    return () => { unsub(); clearTimeout(t); };
  },[]);

  const salvarFichaDB = async (ficha) => {
    try {
    await saveCollection(CQ_KEY, String(ficha.id), ficha);
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const delFicha = async (id) => {
    try {
    if(!confirm("Excluir esta ficha?")) return;
    await deleteFromCollection(CQ_KEY, String(id));
    setSelFicha(null); setView("lista");
    toast_("Ficha excluída.", "red");
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const aplicarEnsaiosPadrao = (tipo) => {
    const lista = ENSAIOS_PADRAO[tipo] || [];
    setEnsaios(lista.map((e,i)=>({ ...e, id:i, resultado:"", conforme:null, obs:"", tipo:e.tipo||"numero", casas:e.casas!==undefined?e.casas:2, multiplos:e.multiplos||false })));
  };

  const updEnsaio = (id, k, v) => setEnsaios(p=>p.map(e=>e.id===id?{...e,[k]:v}:e));

  // Verificar conformidade automática para numérico
  const checkConf = (ensaio) => {
    if(ensaio.tipo==="conforme") return ensaio.conforme;
    if(ensaio.tipo==="numero") {
      const v = parseFloat(ensaio.resultado);
      if(isNaN(v)) return null;
      if(ensaio.min!==null && v < ensaio.min) return false;
      if(ensaio.max!==null && v > ensaio.max) return false;
      return true;
    }
    return ensaio.conforme;
  };

  const uploadCOA = async (file) => {
    if(!file) return;
    setCoaUploading(true);
    try {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      const result = isPdf ? await uploadPdfToSupabase(file) : await uploadToCloudinary(file);
      setCoa(result);
      toast_("COA anexado com sucesso!", "green");
    } catch { toast_("Erro ao enviar COA.", "red"); }
    setCoaUploading(false);
  };

  const conclusao = () => {
    if(ensaios.length===0) return null;
    const confs = ensaios.map(checkConf);
    if(confs.some(c=>c===false)) return "Reprovado";
    if(confs.some(c=>c===null)) return "Pendente";
    return "Aprovado";
  };

  const salvarFicha = async () => {
    if(!form.material.trim()) { alert("Informe o material."); return; }
    const conc = conclusao();
    const num = `RA-${new Date().getFullYear()}-${String(fichas.length+1).padStart(3,"0")}`;
    const ficha = { id:Date.now(), num, ...form, ensaios, coa, conclusao:conc, criadoPor:user.name, criadoEm:tod(), criadoTs:Date.now() };
    // Record edit history if editing existing analysis
    if (sel?._editando) {
      const hist = sel.historicoEdicoes || [];
      ficha.historicoEdicoes = [...hist, { data: tod(), dataHora: new Date().toLocaleString("pt-BR"), editor: user.name, obs: "Análise editada" }];
    }
    await salvarFichaDB(ficha);
    toast_(`${num} salva com sucesso!`, "green");
    if(conc==="Reprovado") {
      if(confirm(`Material REPROVADO! Deseja abrir uma RNC automaticamente?`)) {
        setTab("nova");
      }
    }
    setView("lista");
    setForm({ material:"", tipoPadrao:"Matéria-prima (pó)", fornecedor:"", lote:"", qtdRecebida:"", nf:"", dataRecebimento:tod(), dataAnalise:tod(), resp:user.name });
    setEnsaios([]); setCoa(null);
  };

  const exportRA = (ficha) => {
    const conc = ficha.conclusao;
    const concColor = conc==="Aprovado"?"#1a7a3c":conc==="Reprovado"?"#cc2244":"#8a6000";
    const win = window.open("","_blank");
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/>
<title>${ficha.num} — Herbamed®</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#1a1a1a;padding:0;}
  .page{width:210mm;padding:14mm;margin:0 auto;}
  .header{display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;border-bottom:3px solid #1a7a3c;margin-bottom:16px;}
  .logo{font-family:Georgia,serif;font-size:20px;font-weight:700;color:#1a7a3c;}
  .ra-num{font-size:18px;font-weight:700;color:#1a7a3c;text-align:right;}
  .section{margin-bottom:16px;}
  .section-title{font-size:10px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #e0e0e0;display:flex;align-items:center;gap:6px;}
  .section-title::before{content:'';display:inline-block;width:3px;height:11px;background:#1a7a3c;border-radius:2px;}
  .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
  .field{background:#f8f9fa;border:1px solid #e8e8e8;border-radius:5px;padding:7px 9px;}
  .field-label{font-size:9px;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:2px;}
  .field-value{font-size:12px;color:#1a1a1a;}
  table{width:100%;border-collapse:collapse;font-size:11px;}
  th{background:#f0f4f0;color:#333;font-weight:700;padding:7px 8px;text-align:left;border:1px solid #ddd;}
  td{padding:6px 8px;border:1px solid #eee;vertical-align:middle;}
  tr:nth-child(even)td{background:#f9fafb;}
  .conf{color:#1a7a3c;font-weight:700;}
  .nconf{color:#cc2244;font-weight:700;}
  .pend{color:#8a6000;font-weight:700;}
  .conclusao{padding:14px;border-radius:8px;text-align:center;font-size:16px;font-weight:800;background:${concColor}15;border:2px solid ${concColor};color:${concColor};margin:16px 0;}
  .footer{margin-top:20px;padding-top:10px;border-top:2px solid #1a7a3c;display:flex;justify-content:space-between;font-size:10px;color:#666;}
  @media print{body{background:#fff!important;}}
</style></head><body><div class="page">
<div style="background:#1a4a2e;padding:20px 24px;display:flex;justify-content:space-between;align-items:center;">
  <div style="display:flex;align-items:center;gap:12px;">
    <img src="https://res.cloudinary.com/dswsg9w0w/image/upload/484237672_1316151256653106_1151541448837719199_n1_zww2li" style="width:44px;height:44px;border-radius:6px;object-fit:cover;"/>
    <div>
      <div style="color:#fff;font-size:14px;font-weight:bold;">Herbamed Laboratório Nutracêutico LTDA</div>
      <div style="color:#9fd4b2;font-size:10px;">CNPJ: 14.829.598/0001-30</div>
    </div>
  </div>
  <div style="text-align:right;">
    <div style="color:#fff;font-size:13px;font-weight:bold;">Relatório de Análise</div>
    <div style="color:#9fd4b2;font-size:11px;">N° ${ficha.num} · ${fmt(ficha.dataAnalise)}</div>
  </div>
</div>
<div class="section">
  <div class="section-title">Identificação do Material</div>
  <div class="grid3">
    <div class="field"><div class="field-label">Material</div><div class="field-value">${ficha.material}</div></div>
    <div class="field"><div class="field-label">Tipo</div><div class="field-value">${ficha.tipoPadrao}</div></div>
    <div class="field"><div class="field-label">Fornecedor</div><div class="field-value">${ficha.fornecedor||"—"}</div></div>
    <div class="field"><div class="field-label">Nº do Lote</div><div class="field-value">${ficha.lote||"—"}</div></div>
    <div class="field"><div class="field-label">Qtd. Recebida</div><div class="field-value">${ficha.qtdRecebida||"—"}</div></div>
    <div class="field"><div class="field-label">Nota Fiscal</div><div class="field-value">${ficha.nf||"—"}</div></div>
    <div class="field"><div class="field-label">Data Recebimento</div><div class="field-value">${fmt(ficha.dataRecebimento)}</div></div>
    <div class="field"><div class="field-label">Data Análise</div><div class="field-value">${fmt(ficha.dataAnalise)}</div></div>
    <div class="field"><div class="field-label">Analista</div><div class="field-value">${ficha.resp}</div></div>
  </div>
</div>
<div class="section">
  <div class="section-title">Resultados das Análises</div>
  <table>
    <thead><tr><th>Ensaio</th><th>Método</th><th>Especificação</th><th>Resultado</th><th>Unidade</th><th>Situação</th><th>Obs.</th></tr></thead>
    <tbody>
      ${ficha.ensaios.map(e=>{
        const c = e.tipo==="numero"?(parseFloat(e.resultado)>=(e.min??-Infinity)&&parseFloat(e.resultado)<=(e.max??Infinity)?true:false):e.conforme;
        const sit = c===true?'<span class="conf">✓ Conforme</span>':c===false?'<span class="nconf">✗ Não conforme</span>':'<span class="pend">— Pendente</span>';
        return `<tr><td><strong>${e.nome}</strong></td><td>${e.metodo}</td><td>${e.espec}</td><td>${e.resultado||"—"}</td><td>${e.unidade}</td><td>${sit}</td><td>${e.obs||""}</td></tr>`;
      }).join("")}
    </tbody>
  </table>
</div>
<div class="conclusao">
  ${conc==="Aprovado"?"✅ APROVADO":conc==="Reprovado"?"❌ REPROVADO":"⏳ ANÁLISE PENDENTE"}
</div>
${ficha.coa?`<div class="section"><div class="section-title">COA do Fornecedor</div><p style="font-size:12px;color:#333;">Laudo do fornecedor disponível em: <a href="${ficha.coa.url}" target="_blank">${ficha.coa.name}</a></p></div>`:""}
<div style="display:flex;gap:40px;margin-top:24px;padding-top:12px;border-top:1px solid #ccc;">
  <div style="flex:1;text-align:center;">
    ${user.assinatura ? `<img src="${user.assinatura}" alt="Assinatura" style="height:56px;max-width:200px;object-fit:contain;display:block;margin:0 auto 4px;"/>` : `<div style="height:56px;"></div>`}
    <div style="border-top:1px solid #333;padding-top:6px;font-size:11px;">${ficha.resp}<br/>Analista de Controle de Qualidade<br/><span style="color:#666;font-size:10px;">Assinado eletronicamente em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</span></div>
  </div>
  <div style="flex:1;text-align:center;"><div style="border-top:1px solid #333;padding-top:6px;margin-top:30px;font-size:11px;">______________________<br/>Gerente de Qualidade</div></div>
</div>
<div style="padding:10px 24px;background:#f5f5f5;border-top:1px solid #eee;display:flex;justify-content:space-between;font-size:10px;color:#888;">
  <span>Herbamed Laboratório Nutracêutico LTDA · CNPJ: 14.829.598/0001-30</span>
  <span>Av Irene Meneghetti Longhini, 500 · Assis/SP - Brasil · CEP: 19816-370</span>
</div>
</div><script>window.onload=()=>window.print();</script></body></html>`;
    win.document.write(html);
    win.document.close();
  };

  if(loading) return <div style={{ textAlign:"center", padding:"3rem", color:T.text2 }}>Carregando...</div>;

  // ── NOVA FICHA ──
  if(view==="nova") {
    const conc = conclusao();
    return (
      <div>
        <div style={{ display:"flex", gap:10, marginBottom:"1rem", alignItems:"center" }}>
          <button style={s.btn} onClick={()=>setView("lista")}>← Voltar</button>
          <div style={{ fontSize:15, fontWeight:700, color:T.text }}>Nova Ficha de Análise</div>
        </div>

        {/* Dados do recebimento */}
        <div style={s.card}>
          <SecTitle icon="📦" ch="Dados do recebimento" />
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
            <F lbl="Material / Produto *" ch={<Inp placeholder="Ex: Psyllium em pó" value={form.material} onChange={e=>setF("material",e.target.value)} />} />
            <F lbl="Tipo de material" ch={
              <Sel value={form.tipoPadrao} onChange={e=>{ setF("tipoPadrao",e.target.value); aplicarEnsaiosPadrao(e.target.value); }}>
                {Object.keys(ENSAIOS_PADRAO).map(t=><option key={t}>{t}</option>)}
              </Sel>
            }/>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
            <F lbl="Fornecedor" ch={
              <Sel value={form.fornecedor} onChange={e=>setF("fornecedor",e.target.value)}>
                <option value="">Selecionar...</option>
                {fornecedores.filter(x=>x.status==="Ativo").map(f=><option key={f.id} value={f.nome}>{f.nome}</option>)}
                <option value="__outro">Outro (digitar)</option>
              </Sel>
            }/>
            {form.fornecedor==="__outro" && <F lbl="Nome do fornecedor" ch={<Inp value={form.fornecedorManual||""} onChange={e=>setF("fornecedorManual",e.target.value)} />} />}
            <F lbl="Nº do lote" ch={<Inp placeholder="Ex: LOT-2026-001" value={form.lote} onChange={e=>setF("lote",e.target.value)} />} />
            <F lbl="Qtd. recebida" ch={<Inp placeholder="Ex: 25 kg" value={form.qtdRecebida} onChange={e=>setF("qtdRecebida",e.target.value)} />} />
            <F lbl="Nota Fiscal" ch={<Inp placeholder="Ex: NF 12345" value={form.nf} onChange={e=>setF("nf",e.target.value)} />} />
            <F lbl="Data recebimento" ch={<Inp type="date" value={form.dataRecebimento} onChange={e=>setF("dataRecebimento",e.target.value)} />} />
            <F lbl="Data análise" ch={<Inp type="date" value={form.dataAnalise} onChange={e=>setF("dataAnalise",e.target.value)} />} />
            <F lbl="Analista responsável" ch={<Inp value={form.resp} onChange={e=>setF("resp",e.target.value)} />} />
          </div>
        </div>

        {/* Ensaios */}
        <div style={s.card}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
            <SecTitle icon="🔬" ch="Ensaios / Resultados" />
            <button style={s.btn} onClick={()=>aplicarEnsaiosPadrao(form.tipoPadrao)}>↺ Recarregar padrão</button>
          </div>

          {ensaios.length === 0 ? (
            <div style={{ textAlign:"center", padding:"2rem", color:T.text3, fontSize:13 }}>
              Selecione o tipo de material acima para carregar os ensaios padrão
            </div>
          ) : (
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ background:T.surf }}>
                    {["Ensaio","Método","Especificação","Resultado","Un.","Situação","Obs."].map(h=>(
                      <th key={h} style={{ padding:"8px 10px", fontSize:10, fontWeight:700, color:T.text3, textTransform:"uppercase", textAlign:"left", borderBottom:`1px solid ${T.border}`, whiteSpace:"nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ensaios.map((e,i)=>{
                    const c = checkConf(e);
                    return (
                      <tr key={e.id} style={{ background:i%2===0?T.card:T.surf }}>
                        <td style={{ padding:"8px 10px", fontSize:12, fontWeight:600, color:T.text, whiteSpace:"nowrap" }}>{e.nome}</td>
                        <td style={{ padding:"8px 10px", fontSize:11, color:T.text2 }}>{e.metodo}</td>
                        <td style={{ padding:"8px 10px", fontSize:11, color:T.text2 }}>{e.espec}</td>
                        <td style={{ padding:"8px 8px" }}>
                          {e.tipo==="conforme" ? (
                            <div style={{ display:"flex", gap:4 }}>
                              <button onClick={()=>updEnsaio(e.id,"conforme",true)} style={{ flex:1, padding:"5px", borderRadius:6, border:`1px solid ${e.conforme===true?"#2ab84a55":T.border}`, background:e.conforme===true?"#2ab84a22":"transparent", color:e.conforme===true?"#2ab84a":T.text2, cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:600 }}>✓ Conf.</button>
                              <button onClick={()=>updEnsaio(e.id,"conforme",false)} style={{ flex:1, padding:"5px", borderRadius:6, border:`1px solid ${e.conforme===false?"#ff4f6a55":T.border}`, background:e.conforme===false?"#ff4f6a22":"transparent", color:e.conforme===false?"#ff4f6a":T.text2, cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:600 }}>✗ N.C.</button>
                            </div>
                          ) : e.tipo==="texto" ? (
                            <Inp placeholder="Resultado..." value={e.resultado} onChange={ev=>updEnsaio(e.id,"resultado",ev.target.value)} sx={{ padding:"5px 8px", fontSize:12, width:110 }}/>
                          ) : (
                            <div>
                              <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                                <Inp
                                  placeholder={`0,${"0".repeat(e.casas||2)}`}
                                  value={e.resultado}
                                  onChange={ev=>updEnsaio(e.id,"resultado",ev.target.value)}
                                  onBlur={ev=>{ if(ev.target.value) updEnsaio(e.id,"resultado",fmtNum(ev.target.value,e.casas||2)); }}
                                  sx={{ padding:"5px 8px", fontSize:12, width:80 }}
                                />
                                {e.multiplos && (
                                  <button onClick={()=>toggleMultiplos(e.id)}
                                    title="Lançar múltiplos valores"
                                    style={{ padding:"4px 7px", borderRadius:6, border:`1px solid ${multiplosState[e.id]?.aberto?T.accent:T.border}`, background:multiplosState[e.id]?.aberto?T.accentDim:"transparent", color:multiplosState[e.id]?.aberto?T.accent:T.text3, cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:700 }}>
                                    Σ
                                  </button>
                                )}
                              </div>
                              {e.multiplos && multiplosState[e.id]?.aberto && (
                                <div style={{ marginTop:6, padding:"8px", background:T.card, border:`1px solid ${T.accent}33`, borderRadius:8 }}>
                                  <div style={{ fontSize:10, color:T.accent, fontWeight:700, textTransform:"uppercase", marginBottom:6 }}>Múltiplos valores — média automática</div>
                                  <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:6 }}>
                                    {(multiplosState[e.id]?.valores||["","","","",""]).map((v,vi)=>(
                                      <Inp key={vi} type="number" placeholder={`#${vi+1}`} value={v}
                                        onChange={ev=>updValorMultiplo(e.id,vi,ev.target.value)}
                                        sx={{ width:56, padding:"4px 6px", fontSize:11 }}/>
                                    ))}
                                    <button onClick={()=>setMultiplosState(p=>({...p,[e.id]:{...p[e.id],valores:[...(p[e.id]?.valores||[]),""]}}))}
                                      style={{ padding:"4px 8px", borderRadius:6, border:`1px solid ${T.border}`, background:"transparent", color:T.text3, cursor:"pointer", fontFamily:"inherit", fontSize:11 }}>+</button>
                                  </div>
                                  {(() => {
                                    const vals = multiplosState[e.id]?.valores||[];
                                    const nums = vals.map(v=>parseFloat(String(v).replace(",","."))).filter(n=>!isNaN(n));
                                    if (!nums.length) return null;
                                    const media = nums.reduce((a,b)=>a+b,0)/nums.length;
                                    const dp = Math.sqrt(nums.reduce((s,v)=>s+Math.pow(v-media,2),0)/nums.length);
                                    return (
                                      <div style={{ fontSize:11, color:T.text2, marginBottom:6 }}>
                                        <span style={{ fontWeight:700, color:T.accent }}>Média: {media.toFixed(e.casas||2).replace(".",",")} {e.unidade}</span>
                                        {nums.length>1 && <span style={{ color:T.text3, marginLeft:8 }}>DP: ±{dp.toFixed(e.casas||2).replace(".",",")}</span>}
                                        <span style={{ color:T.text3, marginLeft:8 }}>n={nums.length}</span>
                                      </div>
                                    );
                                  })()}
                                  <button onClick={()=>aplicarMedia(e.id,e.casas||2)}
                                    style={{ ...s.btnA, fontSize:11, padding:"4px 12px" }}>
                                    ✓ Aplicar média
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td style={{ padding:"8px 8px", fontSize:11, color:T.text3 }}>{e.unidade}</td>
                        <td style={{ padding:"8px 8px" }}>
                          {c===true?<span style={{ color:"#2ab84a", fontWeight:700, fontSize:11 }}>✓ Conf.</span>:c===false?<span style={{ color:"#ff4f6a", fontWeight:700, fontSize:11 }}>✗ N.C.</span>:<span style={{ color:T.text3, fontSize:11 }}>—</span>}
                        </td>
                        <td style={{ padding:"8px 8px" }}>
                          <Inp placeholder="obs..." value={e.obs||""} onChange={ev=>updEnsaio(e.id,"obs",ev.target.value)} sx={{ padding:"4px 6px", fontSize:11, width:100 }}/>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Conclusão em tempo real */}
          {ensaios.length > 0 && conc && (
            <div style={{ marginTop:"1rem", padding:"12px 16px", borderRadius:10, background:conc==="Aprovado"?"#2ab84a18":conc==="Reprovado"?"#ff4f6a18":"#ffd16618", border:`1px solid ${conc==="Aprovado"?"#2ab84a33":conc==="Reprovado"?"#ff4f6a33":"#ffd16633"}`, fontSize:14, fontWeight:700, color:conc==="Aprovado"?"#2ab84a":conc==="Reprovado"?"#ff4f6a":"#8a6000", textAlign:"center" }}>
              {conc==="Aprovado"?"✅ APROVADO — Todos os ensaios dentro da especificação":conc==="Reprovado"?"❌ REPROVADO — Um ou mais ensaios fora da especificação":"⏳ ANÁLISE PENDENTE — Preencha todos os resultados"}
            </div>
          )}
        </div>

        {/* COA do fornecedor */}
        <div style={s.card}>
          <SecTitle icon="📄" ch="COA do fornecedor (Laudo / Certificado de Análise)" />
          {coa ? (
            <div style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", background:T.surf, border:`1px solid ${T.border}`, borderRadius:8 }}>
              <span style={{ fontSize:24 }}>📄</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{coa.name}</div>
                <div style={{ fontSize:11, color:T.text3 }}>{coa.size ? (coa.size/1024).toFixed(1)+" KB" : ""}</div>
              </div>
              <button onClick={()=>openCOA(coa)} style={{ ...s.btn, fontSize:11, color:T.accent }}>Ver COA</button>
              <button style={s.btnD} onClick={()=>setCoa(null)}>✕</button>
            </div>
          ) : (
            <div style={{ border:`2px dashed ${T.border2}`, borderRadius:10, padding:"1.5rem", textAlign:"center", cursor:"pointer" }} onClick={()=>document.getElementById("coa-input").click()}>
              <div style={{ fontSize:28, marginBottom:6 }}>📎</div>
              <div style={{ fontSize:13, color:T.text2 }}>{coaUploading?"Enviando...":"Clique para anexar o COA do fornecedor"}</div>
              <div style={{ fontSize:11, color:T.text3, marginTop:4 }}>PDF, imagem — até 10MB</div>
              <input id="coa-input" type="file" accept=".pdf,image/*" style={{ display:"none" }} onChange={e=>uploadCOA(e.target.files[0])} />
            </div>
          )}
        </div>

        {/* Botões */}
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end", paddingBottom:"1rem" }}>
          <button style={s.btn} onClick={()=>setView("lista")}>Cancelar</button>
          <button style={s.btnA} onClick={salvarFicha}>💾 Salvar ficha de análise →</button>
        </div>
      </div>
    );
  }

  // ── LISTA ──
  return (
    <div>
      <div style={{ display:"flex", gap:10, marginBottom:"1rem", alignItems:"center" }}>
        <div style={{ fontSize:13, color:T.text2, flex:1 }}>{fichas.length} ficha(s) de análise registrada(s)</div>
        <button style={s.btnA} onClick={()=>{ setForm({ material:"", tipoPadrao:"Matéria-prima (pó)", fornecedor:"", lote:"", qtdRecebida:"", nf:"", dataRecebimento:tod(), dataAnalise:tod(), resp:user.name }); aplicarEnsaiosPadrao("Matéria-prima (pó)"); setView("nova"); }}>+ Nova Ficha de Análise</button>
      </div>

      {fichas.length === 0 ? (
        <div style={{ ...s.card, textAlign:"center", padding:"3rem" }}>
          <div style={{ fontSize:40, marginBottom:"1rem", opacity:.3 }}>🧪</div>
          <div style={{ fontSize:14, color:T.text2, marginBottom:6 }}>Nenhuma ficha de análise registrada</div>
          <div style={{ fontSize:12, color:T.text3 }}>Clique em "+ Nova Ficha de Análise" para começar</div>
        </div>
      ) : (
        <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:T.surf }}>
                {["Nº RA","Material","Fornecedor","Lote","Data Análise","Analista","Conclusão",""].map(h=>(
                  <th key={h} style={{ padding:"10px 12px", fontSize:10, fontWeight:700, color:T.text3, textTransform:"uppercase", textAlign:"left", borderBottom:`1px solid ${T.border}`, whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fichas.map((f,idx)=>{
                const cc = f.conclusao;
                const cColor = cc==="Aprovado"?"#2ab84a":cc==="Reprovado"?"#ff4f6a":"#ffd166";
                return (
                  <tr key={f.id} style={{ background:idx%2===0?T.card:T.surf, cursor:"pointer" }} onClick={()=>setSelFicha(f)}>
                    <td style={{ padding:"10px 12px", fontSize:12, fontWeight:700, color:T.accent }}>{f.num}</td>
                    <td style={{ padding:"10px 12px", fontSize:13, color:T.text }}>{f.material}</td>
                    <td style={{ padding:"10px 12px", fontSize:12, color:T.text2 }}>{f.fornecedor||"—"}</td>
                    <td style={{ padding:"10px 12px", fontSize:12, color:T.text2 }}>{f.lote||"—"}</td>
                    <td style={{ padding:"10px 12px", fontSize:12, color:T.text2 }}>{fmt(f.dataAnalise)}</td>
                    <td style={{ padding:"10px 12px", fontSize:12, color:T.text2 }}>{f.resp}</td>
                    <td style={{ padding:"10px 12px" }}>
                      <span style={{ fontSize:11, fontWeight:700, color:cColor, background:`${cColor}18`, padding:"3px 10px", borderRadius:20 }}>
                        {cc==="Aprovado"?"✅ Aprovado":cc==="Reprovado"?"❌ Reprovado":"⏳ Pendente"}
                      </span>
                    </td>
                    <td style={{ padding:"10px 8px", display:"flex", gap:4 }}>
                      <button style={{ ...s.btn, padding:"4px 8px", fontSize:11 }} onClick={e=>{e.stopPropagation();exportRA(f);}}><span className="btn-emoji">📄 </span>PDF</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal detalhe */}
      {selFicha && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.82)", backdropFilter:"blur(6px)", zIndex:999, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }} onClick={e=>e.target===e.currentTarget&&setSelFicha(null)}>
          <div style={{ background:T.card2, border:`1px solid ${T.border2}`, borderRadius:18, padding:"1.75rem", maxWidth:760, width:"100%", maxHeight:"90vh", overflowY:"auto", boxShadow:"0 32px 80px #000a" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"1rem" }}>
              <div>
                <div style={{ fontSize:20, fontWeight:700 }}>{selFicha.num}</div>
                <div style={{ fontSize:12, color:T.text2, marginTop:2 }}>{selFicha.material} · {selFicha.fornecedor||"—"} · {fmt(selFicha.dataAnalise)}</div>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button style={{ ...s.btn, fontSize:11, color:"#ff8c42", borderColor:"#ff8c4233", background:"#ff8c4212" }} onClick={()=>exportRA(selFicha)}><span className="btn-emoji">📄 </span>Exportar PDF</button>
                <button style={s.btnD} onClick={()=>delFicha(selFicha.id)}>🗑️</button>
                <button onClick={()=>setSelFicha(null)} style={{ background:T.border, border:"none", color:T.text2, cursor:"pointer", borderRadius:8, padding:"6px 10px", fontSize:16, fontFamily:"inherit" }}>✕</button>
              </div>
            </div>
            {/* Ensaios */}
            <div style={{ overflowX:"auto", marginBottom:"1rem" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead><tr style={{ background:T.surf }}>
                  {["Ensaio","Especificação","Resultado","Un.","Situação"].map(h=><th key={h} style={{ padding:"7px 10px", fontSize:10, fontWeight:700, color:T.text3, textTransform:"uppercase", textAlign:"left", borderBottom:`1px solid ${T.border}` }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {selFicha.ensaios.map((e,i)=>{
                    const c=e.tipo==="numero"?(parseFloat(e.resultado)>=(e.min??-Infinity)&&parseFloat(e.resultado)<=(e.max??Infinity)?true:false):e.conforme;
                    return <tr key={i} style={{ background:i%2===0?T.card:T.surf }}>
                      <td style={{ padding:"7px 10px", fontSize:12, fontWeight:600 }}>{e.nome}</td>
                      <td style={{ padding:"7px 10px", fontSize:11, color:T.text2 }}>{e.espec}</td>
                      <td style={{ padding:"7px 10px", fontSize:12 }}>{e.resultado||"—"}</td>
                      <td style={{ padding:"7px 10px", fontSize:11, color:T.text3 }}>{e.unidade}</td>
                      <td style={{ padding:"7px 10px" }}>{c===true?<span style={{ color:"#2ab84a", fontWeight:700 }}>✓ Conforme</span>:c===false?<span style={{ color:"#ff4f6a", fontWeight:700 }}>✗ N.C.</span>:<span style={{ color:T.text3 }}>—</span>}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ marginBottom:"1rem", padding:"10px 14px", background:T.surf, borderRadius:8, display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
              <span style={{ fontSize:20 }}>📄</span>
              {selFicha.coa ? (<>
                <span style={{ fontSize:13, color:T.text, flex:1 }}>COA: {selFicha.coa.name}</span>
                <button onClick={()=>openCOA(selFicha.coa)} style={{ ...s.btn, fontSize:11, color:T.accent }}>Ver COA</button>
                <button onClick={()=>document.getElementById("coa-reattach-ficha").click()} style={{ ...s.btn, fontSize:11 }}><span className="btn-emoji">🔄 </span>Trocar</button>
                <button onClick={async()=>{ if(!confirm("Remover COA desta análise?")) return; await saveCollection(CQ_KEY, String(selFicha.id), {...selFicha, coa:null}); setSelFicha({...selFicha, coa:null}); toast_("COA removido.","red"); }} style={{ ...s.btnD, fontSize:11 }}><span className="btn-emoji">🗑️ </span>Excluir</button>
              </>) : (<>
                <span style={{ fontSize:13, color:T.text3, flex:1 }}>Nenhum COA anexado</span>
                <button onClick={()=>document.getElementById("coa-reattach-ficha").click()} style={{ ...s.btnA, fontSize:11 }}><span className="btn-emoji">📎 </span>Anexar COA</button>
              </>)}
              <input id="coa-reattach-ficha" type="file" accept=".pdf,image/*" style={{ display:"none" }} onChange={async e=>{ const file=e.target.files[0]; if(!file) return; toast_("Enviando COA...","blue"); try { const isPdf=file.type==="application/pdf"||file.name.toLowerCase().endsWith(".pdf"); const r=isPdf?await uploadPdfToSupabase(file):await uploadToCloudinary(file); await saveCollection(CQ_KEY, String(selFicha.id), {...selFicha, coa:r}); setSelFicha({...selFicha, coa:r}); toast_("COA atualizado!","green"); } catch { toast_("Erro ao enviar COA.","red"); } }} />
            </div>
            <div style={{ padding:"12px 16px", borderRadius:10, background:selFicha.conclusao==="Aprovado"?"#2ab84a18":"#ff4f6a18", fontSize:14, fontWeight:700, color:selFicha.conclusao==="Aprovado"?"#2ab84a":"#ff4f6a", textAlign:"center" }}>
              {selFicha.conclusao==="Aprovado"?"✅ APROVADO":"❌ REPROVADO"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── CQ — ENSAIOS SUGERIDOS POR TIPO ───────────────────────────────────────── */
const ENSAIOS_SUGERIDOS = {
  "Matéria-prima (pó/granulado)": [
    { nome:"Aspecto",               espec:"Conforme padrão",      unidade:"—",      tipo:"conforme", casas:0, multiplos:false },
    { nome:"Cor",                   espec:"Conforme padrão",      unidade:"—",      tipo:"conforme", casas:0, multiplos:false },
    { nome:"Odor",                  espec:"Característico",       unidade:"—",      tipo:"conforme", casas:0, multiplos:false },
    { nome:"pH (solução 1%)",       espec:"",                     unidade:"pH",     tipo:"numero",   casas:2, multiplos:false },
    { nome:"Umidade",               espec:"",                     unidade:"%",      tipo:"numero",   casas:1, multiplos:false },
    { nome:"Densidade aparente",    espec:"",                     unidade:"g/mL",   tipo:"numero",   casas:3, multiplos:false },
    { nome:"Densidade compactada",  espec:"",                     unidade:"g/mL",   tipo:"numero",   casas:3, multiplos:false },
    { nome:"Granulometria",         espec:"",                     unidade:"%",      tipo:"numero",   casas:1, multiplos:false },
    { nome:"Identificação",         espec:"Positivo",             unidade:"—",      tipo:"conforme", casas:0, multiplos:false },
    { nome:"Contagem microbiana",   espec:"",                     unidade:"UFC/g",  tipo:"numero",   casas:0, multiplos:false },
  ],
  "Matéria-prima (óleo/líquido)": [
    { nome:"Aspecto",               espec:"Límpido, sem partículas", unidade:"—",       tipo:"conforme", casas:0, multiplos:false },
    { nome:"Cor",                   espec:"Conforme padrão",         unidade:"—",       tipo:"conforme", casas:0, multiplos:false },
    { nome:"Odor",                  espec:"Característico",          unidade:"—",       tipo:"conforme", casas:0, multiplos:false },
    { nome:"Densidade",             espec:"",                        unidade:"g/mL",    tipo:"numero",   casas:3, multiplos:false },
    { nome:"Viscosidade",           espec:"",                        unidade:"cP",      tipo:"numero",   casas:1, multiplos:false },
    { nome:"pH",                    espec:"",                        unidade:"pH",      tipo:"numero",   casas:2, multiplos:false },
    { nome:"Índice de acidez",      espec:"",                        unidade:"mg KOH/g",tipo:"numero",   casas:2, multiplos:false },
    { nome:"Índice de refração",    espec:"",                        unidade:"—",       tipo:"numero",   casas:4, multiplos:false },
    { nome:"Identificação",         espec:"Positivo",                unidade:"—",       tipo:"conforme", casas:0, multiplos:false },
    { nome:"Contagem microbiana",   espec:"",                        unidade:"UFC/mL",  tipo:"numero",   casas:0, multiplos:false },
  ],
  "Cápsula vazia": [
    { nome:"Aspecto visual",        espec:"Sem defeitos, sem deformações", unidade:"—",   tipo:"conforme", casas:0, multiplos:false },
    { nome:"Cor",                   espec:"Conforme padrão",               unidade:"—",   tipo:"conforme", casas:0, multiplos:false },
    { nome:"Comprimento",           espec:"",                              unidade:"mm",  tipo:"numero",   casas:2, multiplos:true  },
    { nome:"Diâmetro",              espec:"",                              unidade:"mm",  tipo:"numero",   casas:2, multiplos:true  },
    { nome:"Peso médio",            espec:"",                              unidade:"mg",  tipo:"numero",   casas:1, multiplos:true  },
    { nome:"Umidade",               espec:"12,0 – 16,0",                  unidade:"%",   tipo:"numero",   casas:1, multiplos:false },
    { nome:"Desintegração",         espec:"≤ 15 min",                     unidade:"min", tipo:"numero",   casas:1, multiplos:false },
  ],
  "Embalagem — Pote (plástico/vidro)": [
    { nome:"Aspecto visual",        espec:"Sem trincas, deformações ou manchas", unidade:"—",   tipo:"conforme", casas:0, multiplos:false },
    { nome:"Cor",                   espec:"Conforme padrão",                     unidade:"—",   tipo:"conforme", casas:0, multiplos:false },
    { nome:"Altura",                espec:"",                                    unidade:"mm",  tipo:"numero",   casas:2, multiplos:true  },
    { nome:"Diâmetro externo",      espec:"",                                    unidade:"mm",  tipo:"numero",   casas:2, multiplos:true  },
    { nome:"Diâmetro da boca",      espec:"",                                    unidade:"mm",  tipo:"numero",   casas:2, multiplos:true  },
    { nome:"Peso",                  espec:"",                                    unidade:"g",   tipo:"numero",   casas:2, multiplos:true  },
    { nome:"Capacidade volumétrica",espec:"",                                    unidade:"mL",  tipo:"numero",   casas:0, multiplos:false },
    { nome:"Vedação / Torque",      espec:"Sem vazamento",                       unidade:"N.m", tipo:"numero",   casas:2, multiplos:false },
    { nome:"Impressão / Gravação",  espec:"Legível e conforme",                  unidade:"—",   tipo:"conforme", casas:0, multiplos:false },
  ],
  "Embalagem — Tampa": [
    { nome:"Aspecto visual",        espec:"Sem defeitos",          unidade:"—",   tipo:"conforme", casas:0, multiplos:false },
    { nome:"Cor",                   espec:"Conforme padrão",       unidade:"—",   tipo:"conforme", casas:0, multiplos:false },
    { nome:"Diâmetro interno",      espec:"",                      unidade:"mm",  tipo:"numero",   casas:2, multiplos:true  },
    { nome:"Altura",                espec:"",                      unidade:"mm",  tipo:"numero",   casas:2, multiplos:true  },
    { nome:"Torque de fechamento",  espec:"",                      unidade:"N.m", tipo:"numero",   casas:2, multiplos:false },
    { nome:"Vedação",               espec:"Sem vazamento",         unidade:"—",   tipo:"conforme", casas:0, multiplos:false },
  ],
  "Embalagem — Caixa de papelão / Cartucho": [
    { nome:"Aspecto visual",        espec:"Sem manchas, rasgos ou defeitos", unidade:"—",    tipo:"conforme", casas:0, multiplos:false },
    { nome:"Impressão / Texto",     espec:"Conforme arte aprovada",          unidade:"—",    tipo:"conforme", casas:0, multiplos:false },
    { nome:"Código de barras",      espec:"Leitura correta",                 unidade:"—",    tipo:"conforme", casas:0, multiplos:false },
    { nome:"Altura",                espec:"",                                unidade:"mm",   tipo:"numero",   casas:2, multiplos:true  },
    { nome:"Largura",               espec:"",                                unidade:"mm",   tipo:"numero",   casas:2, multiplos:true  },
    { nome:"Profundidade",          espec:"",                                unidade:"mm",   tipo:"numero",   casas:2, multiplos:true  },
    { nome:"Gramatura",             espec:"",                                unidade:"g/m²", tipo:"numero",   casas:1, multiplos:false },
    { nome:"Espessura",             espec:"",                                unidade:"mm",   tipo:"numero",   casas:3, multiplos:true  },
    { nome:"Resistência",           espec:"Conforme especificação",          unidade:"—",    tipo:"conforme", casas:0, multiplos:false },
  ],
  "Embalagem — Rótulo": [
    { nome:"Aspecto visual",        espec:"Sem defeitos de impressão",  unidade:"—",    tipo:"conforme", casas:0, multiplos:false },
    { nome:"Impressão / Texto",     espec:"Conforme arte aprovada",     unidade:"—",    tipo:"conforme", casas:0, multiplos:false },
    { nome:"Código de barras",      espec:"Leitura correta",            unidade:"—",    tipo:"conforme", casas:0, multiplos:false },
    { nome:"Altura",                espec:"",                           unidade:"mm",   tipo:"numero",   casas:2, multiplos:true  },
    { nome:"Largura",               espec:"",                           unidade:"mm",   tipo:"numero",   casas:2, multiplos:true  },
    { nome:"Gramatura",             espec:"",                           unidade:"g/m²", tipo:"numero",   casas:1, multiplos:false },
    { nome:"Aderência",             espec:"Sem descolamento",           unidade:"—",    tipo:"conforme", casas:0, multiplos:false },
    { nome:"Cor (CMYK)",            espec:"Conforme aprovado",          unidade:"—",    tipo:"conforme", casas:0, multiplos:false },
  ],
  "Embalagem — Filme de sachê": [
    { nome:"Aspecto visual",        espec:"Sem furos, rasgos ou contaminação", unidade:"—",    tipo:"conforme", casas:0, multiplos:false },
    { nome:"Impressão",             espec:"Conforme arte aprovada",            unidade:"—",    tipo:"conforme", casas:0, multiplos:false },
    { nome:"Largura",               espec:"",                                  unidade:"mm",   tipo:"numero",   casas:2, multiplos:true  },
    { nome:"Espessura",             espec:"",                                  unidade:"µm",   tipo:"numero",   casas:3, multiplos:true  },
    { nome:"Gramatura",             espec:"",                                  unidade:"g/m²", tipo:"numero",   casas:1, multiplos:false },
    { nome:"Resistência ao calor",  espec:"Selagem íntegra",                   unidade:"—",    tipo:"conforme", casas:0, multiplos:false },
    { nome:"Resistência ao rasgo",  espec:"",                                  unidade:"N",    tipo:"numero",   casas:1, multiplos:false },
  ],
  "Produto acabado (cápsula/comprimido)": [
    { nome:"Aspecto",               espec:"Conforme padrão", unidade:"—",   tipo:"conforme", casas:0, multiplos:false },
    { nome:"Cor",                   espec:"Conforme padrão", unidade:"—",   tipo:"conforme", casas:0, multiplos:false },
    { nome:"Peso médio",            espec:"",                unidade:"mg",  tipo:"numero",   casas:1, multiplos:true  },
    { nome:"Variação de peso",      espec:"≤ 5,0%",         unidade:"%",   tipo:"numero",   casas:2, multiplos:false },
    { nome:"Desintegração",         espec:"≤ 30 min",        unidade:"min", tipo:"numero",   casas:1, multiplos:false },
    { nome:"Dureza",                espec:"",                unidade:"N",   tipo:"numero",   casas:1, multiplos:true  },
    { nome:"Friabilidade",          espec:"≤ 1,0%",         unidade:"%",   tipo:"numero",   casas:2, multiplos:false },
    { nome:"Doseamento",            espec:"",                unidade:"%",   tipo:"numero",   casas:1, multiplos:false },
  ],
  "Produto acabado (sachê/pó)": [
    { nome:"Aspecto",               espec:"Conforme padrão",    unidade:"—",   tipo:"conforme", casas:0, multiplos:false },
    { nome:"Cor",                   espec:"Conforme padrão",    unidade:"—",   tipo:"conforme", casas:0, multiplos:false },
    { nome:"Odor",                  espec:"Característico",     unidade:"—",   tipo:"conforme", casas:0, multiplos:false },
    { nome:"Peso médio",            espec:"",                   unidade:"g",   tipo:"numero",   casas:2, multiplos:true  },
    { nome:"Variação de peso",      espec:"≤ 5,0%",            unidade:"%",   tipo:"numero",   casas:2, multiplos:false },
    { nome:"pH",                    espec:"",                   unidade:"pH",  tipo:"numero",   casas:2, multiplos:false },
    { nome:"Umidade",               espec:"",                   unidade:"%",   tipo:"numero",   casas:1, multiplos:false },
    { nome:"Vedação da embalagem",  espec:"Sem vazamento",      unidade:"—",   tipo:"conforme", casas:0, multiplos:false },
  ],
};

/* ─── CQ MATERIAIS TAB ───────────────────────────────────────────────────────── */
function CQMateriaisTab({ user, toast_, fornecedores, perm }) {
  const T = useTheme(); const s = useS();
  const [materiais, setMateriais] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("lista"); // lista | novo | editar
  const [sel, setSel] = useState(null);
  const [form, setForm] = useState({ nome:"", tipo:"Matéria-prima (pó/granulado)", fornecedorPadrao:"", ref:"", obs:"" });
  const [ensaios, setEnsaios] = useState([]);
  const [templateSel, setTemplateSel] = useState("");
  const [fichasTecnicas, setFichasTecnicas] = useState([]);
  const [ftUploading, setFtUploading] = useState(null);
  const [filtroTipoLista, setFiltroTipoLista] = useState("Todos");
  const [pgMat, setPgMat] = useState(1);
  const PER_PAGE_MAT = 15;
  const matFiltrados = filtroTipoLista==="Todos" ? materiais : materiais.filter(m=>(m.tipo||"Outros")===filtroTipoLista);
  const totMatPg = Math.ceil(matFiltrados.length / PER_PAGE_MAT) || 1;
  const safePgMat = Math.min(pgMat, totMatPg);
  const matPg = matFiltrados.slice((safePgMat-1)*PER_PAGE_MAT, safePgMat*PER_PAGE_MAT);
  const setF = (k,v) => setForm(p=>({...p,[k]:v}));

  useEffect(()=>{
    const unsub = subscribeCollection("cq_materiais", list=>{
      setMateriais(list.sort((a,b)=>(a.nome||"").localeCompare(b.nome||"")));
      setLoading(false);
    });
    const unsubT = subscribeCollection("cq_templates", list=>{
      setTemplates(list.sort((a,b)=>(a.nome||"").localeCompare(b.nome||"")));
    });
    const t = setTimeout(()=>setLoading(false), 3000);
    return ()=>{ unsub(); unsubT(); clearTimeout(t); };
  },[]);

  const carregarTemplate = (tplId) => {
    if(!tplId) return;
    const tpl = templates.find(t=>String(t.id)===String(tplId));
    if(!tpl) return;
    if(ensaios.length > 0 && !confirm(`Substituir os ensaios atuais pelo template "${tpl.nome}"?`)) return;
    setF("tipo", tpl.tipo);
    setEnsaios((tpl.ensaios||[]).map((e,i)=>({ tipo:"numero", casas:2, multiplos:false, ...e, id:Date.now()+i })));
    setTemplateSel(tplId);
    toast_(`Template "${tpl.nome}" carregado!`, "green");
  };

  const salvarTemplate = async () => {
    if(ensaios.length===0) { alert("Adicione ensaios antes de salvar o template."); return; }
    const nomeTemplate = prompt("Nome do template:", `${form.tipo} — padrão`);
    if(!nomeTemplate || !nomeTemplate.trim()) return;
    try {
      const id = String(Date.now());
      await saveCollection("cq_templates", id, {
        id,
        nome: nomeTemplate.trim(),
        tipo: form.tipo,
        ensaios: ensaios.map((e,i)=>({
          id: i+1,
          nome: e.nome||"",
          espec: e.espec||"",
          unidade: e.unidade||"",
          ref: e.ref||"",
          tipo: e.tipo||"numero",
          casas: e.casas!==undefined?e.casas:2,
          multiplos: e.multiplos||false,
        })),
        criadoPor: user.name,
        criadoEm: tod(),
      });
      toast_(`Template "${nomeTemplate.trim()}" salvo!`, "green");
    } catch(e) {
      alert("Erro ao salvar template: " + e.message);
    }
  };

  const delTemplate = async (tpl) => {
    if(!confirm(`Excluir o template "${tpl.nome}"?`)) return;
    try {
      await deleteFromCollection("cq_templates", String(tpl.id));
      toast_("Template excluído.", "red");
    } catch(e) {
      toast_(fbErr(e), "red");
    }
  };

  const aplicarSugestoes = (tipo) => {
    const sugs = ENSAIOS_SUGERIDOS[tipo] || [];
    setEnsaios(sugs.map((e,i)=>({ tipo:"numero", casas:2, multiplos:false, ...e, id:i+1, ref:e.ref||"" })));
  };

  const addEnsaio = () => setEnsaios(p=>[...p, { id:Date.now(), nome:"", espec:"", unidade:"", ref:"", tipo:"numero", casas:2, multiplos:false }]);
  const updEnsaio = (id,k,v) => setEnsaios(p=>p.map(e=>e.id===id?{...e,[k]:v}:e));
  const delEnsaio = (id) => setEnsaios(p=>p.filter(e=>e.id!==id));

  const addLinhaFicha = () => setFichasTecnicas(p=>[...p, { id: Date.now(), fornecedorNome:"", url:"", nome:"", size:0, uploadedAt:"" }]);
  const updLinhaFicha = (id, k, v) => setFichasTecnicas(p=>p.map(f=>f.id===id?{...f,[k]:v}:f));
  const delLinhaFicha = (id) => setFichasTecnicas(p=>p.filter(f=>f.id!==id));
  const uploadFicha = async (id, file) => {
    if(!file) return;
    setFtUploading(id);
    try {
      const result = await uploadPdfToSupabase(file);
      updLinhaFicha(id, "url", result.url);
      updLinhaFicha(id, "nome", result.name);
      updLinhaFicha(id, "size", result.size);
      updLinhaFicha(id, "uploadedAt", tod());
      toast_("Ficha técnica anexada!", "green");
    } catch(e) {
      toast_("Erro no upload: " + e.message, "red");
    } finally { setFtUploading(null); }
  };

  const salvar = async () => {
    if(!form.nome.trim()) { alert("Nome é obrigatório."); return; }
    if(ensaios.length===0) { alert("Adicione ao menos um ensaio."); return; }
    try {
      const id = sel ? String(sel.id) : String(Date.now());
      // Limpar ensaios para garantir compatibilidade com Firestore
      const ensaiosLimpos = ensaios.map((e,i) => ({
        id: i+1,
        nome: e.nome||"",
        espec: e.espec||"",
        unidade: e.unidade||"",
        ref: e.ref||"",
        tipo: e.tipo||"numero",
        casas: e.casas !== undefined ? e.casas : 2,
        multiplos: e.multiplos||false,
      }));
      const material = {
        id,
        nome: form.nome,
        tipo: form.tipo,
        fornecedorPadrao: form.fornecedorPadrao||"",
        ref: form.ref||"",
        obs: form.obs||"",
        ensaios: ensaiosLimpos,
        fichasTecnicas: fichasTecnicas.filter(f=>f.url||f.fornecedorNome),
        criadoPor: user.name,
        criadoEm: tod(),
        atualizadoEm: tod(),
      };
      await saveCollection("cq_materiais", id, material);
      toast_(sel?"Material atualizado!":"Material cadastrado!", "green");
      setView("lista"); setSel(null);
      setForm({ nome:"", tipo:"Matéria-prima (pó/granulado)", fornecedorPadrao:"", ref:"", obs:"" });
      setEnsaios([]);
      setFichasTecnicas([]);
    } catch(e) {
      alert("Erro ao salvar: " + e.message);
      console.error(e);
    }
  };

  const editarMaterial = (m) => {
    setSel(m);
    setForm({ nome:m.nome, tipo:m.tipo, fornecedorPadrao:m.fornecedorPadrao||"", ref:m.ref||"", obs:m.obs||"" });
    setEnsaios((m.ensaios||[]).map(e=>({ tipo:"numero", casas:2, multiplos:false, ...e })));
    setFichasTecnicas((m.fichasTecnicas||[]).map(f=>({ id:Date.now()+Math.random(), ...f })));
    setView("editar");
  };

  const delMaterial = async (id) => {
    try {
    if(!confirm("Excluir este material e todos os seus ensaios?")) return;
    await deleteFromCollection("cq_materiais", String(id));
    toast_("Material excluído.", "red");
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  if(loading) return <div style={{ textAlign:"center", padding:"3rem", color:T.text2 }}>Carregando...</div>;

  if(view==="lista") {
    const tiposUnicos = ["Todos", ...Array.from(new Set(materiais.map(m=>m.tipo||"Outros"))).sort()];
    return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
        <div style={{ fontSize:13, color:T.text2 }}>{matFiltrados.length} material(is) {filtroTipoLista!=="Todos"?`em "${filtroTipoLista}"`:"cadastrado(s)"}</div>
        <button style={s.btnA} onClick={()=>{ setForm({ nome:"", tipo:"Matéria-prima (pó/granulado)", fornecedorPadrao:"", ref:"", obs:"" }); setEnsaios([]); setFichasTecnicas([]); setSel(null); setTemplateSel(""); setView("novo"); }}>+ Novo Material</button>
      </div>

      {materiais.length===0 ? (
        <div style={{ ...s.card, textAlign:"center", padding:"3rem" }}>
          <div style={{ fontSize:40, marginBottom:"1rem", opacity:.3 }}>🧪</div>
          <div style={{ fontSize:14, color:T.text2, marginBottom:6 }}>Nenhum material cadastrado</div>
          <div style={{ fontSize:12, color:T.text3 }}>Clique em "+ Novo Material" para começar</div>
        </div>
      ) : (
        <>
          {/* Filtro por tipo */}
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:12 }}>
            {tiposUnicos.map(t=>(
              <button key={t} onClick={()=>{ setFiltroTipoLista(t); setPgMat(1); }} style={{ padding:"4px 14px", fontSize:11, fontWeight:600, borderRadius:20, border:`1px solid ${filtroTipoLista===t?T.accent:T.border}`, background:filtroTipoLista===t?T.accentDim:"transparent", color:filtroTipoLista===t?T.accent:T.text2, cursor:"pointer", transition:"all .15s" }}>{t}</button>
            ))}
          </div>

          <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, overflow:"hidden" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead><tr style={{ background:T.surf }}>
                {["Material","Tipo","Fornecedor padrão","Ensaios","Referência",""].map(h=>(
                  <th key={h} style={{ padding:"10px 12px", fontSize:10, fontWeight:700, color:T.text3, textTransform:"uppercase", textAlign:"left", borderBottom:`1px solid ${T.border}`, whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {matPg.length===0 ? (
                  <tr><td colSpan={6} style={{ padding:"2rem", textAlign:"center", color:T.text3, fontSize:13 }}>Nenhum material nesta categoria.</td></tr>
                ) : matPg.map((m,i)=>(
                  <tr key={m.id} style={{ background:i%2===0?T.card:T.surf }}>
                    <td style={{ padding:"10px 12px", fontSize:13, fontWeight:600, color:T.text }}>{m.nome}</td>
                    <td style={{ padding:"10px 12px", fontSize:12, color:T.text2 }}>{m.tipo}</td>
                    <td style={{ padding:"10px 12px", fontSize:12, color:T.text2 }}>{m.fornecedorPadrao||"—"}</td>
                    <td style={{ padding:"10px 12px", fontSize:12, color:T.accent, fontWeight:700 }}>{m.ensaios?.length||0}</td>
                    <td style={{ padding:"10px 12px", fontSize:12, color:T.text2 }}>{m.ref||"—"}</td>
                    <td style={{ padding:"10px 8px", display:"flex", gap:6 }}>
                      <button style={{ ...s.btn, padding:"4px 10px", fontSize:11, color:T.accent, borderColor:T.accent+"33", background:T.accentDim }} onClick={()=>editarMaterial(m)}><span className="btn-emoji">✏️ </span>Editar</button>
                      <button style={{ ...s.btnD, padding:"4px 10px", fontSize:11 }} onClick={()=>delMaterial(m.id)}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={safePgMat} total={totMatPg} setPage={setPgMat} />
        </>
      )}
    </div>
  );}

  // Formulário novo/editar
  return (
    <div>
      <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:"1rem" }}>
        <button style={s.btn} onClick={()=>{ setView("lista"); setSel(null); }}>← Voltar</button>
        <div style={{ fontSize:15, fontWeight:700, color:T.text }}>{sel?"Editar material":"Novo material"}</div>
      </div>

      {/* Templates */}
      <div style={{ ...s.card, background: T.accentDim, border:`1px solid ${T.accent}33` }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, flex:1, minWidth:240 }}>
            <span style={{ fontSize:16 }}>📋</span>
            <span style={{ fontSize:13, fontWeight:700, color:T.accent }}>Carregar template</span>
            <Sel value={templateSel} onChange={e=>carregarTemplate(e.target.value)} sx={{ flex:1, maxWidth:320 }}>
              <option value="">Selecionar template...</option>
              {templates.map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}
            </Sel>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            {templates.length > 0 && templateSel && (
              <button style={{ ...s.btnD, fontSize:11, padding:"5px 10px" }} onClick={()=>{ const tpl=templates.find(t=>String(t.id)===String(templateSel)); if(tpl) delTemplate(tpl); }}>🗑️ Excluir template</button>
            )}
            <button style={{ ...s.btn, fontSize:11, padding:"5px 12px", color:T.accent, borderColor:T.accent+"44", background:"transparent" }} onClick={salvarTemplate}>💾 Salvar como template</button>
          </div>
        </div>
        {templates.length===0 && (
          <div style={{ fontSize:11, color:T.text3, marginTop:8 }}>Nenhum template salvo. Preencha os ensaios e clique em "Salvar como template" para reaproveitar nas próximas criações.</div>
        )}
      </div>

      {/* Dados gerais */}
      <div style={s.card}>
        <SecTitle icon="📦" ch="Dados do material" />
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <F lbl="Nome do material *" ch={<Inp placeholder="Ex: Psyllium em pó" value={form.nome} onChange={e=>setF("nome",e.target.value)} />} />
          <F lbl="Tipo de material" ch={
            <Sel value={form.tipo} onChange={e=>{ setF("tipo",e.target.value); if(!sel) aplicarSugestoes(e.target.value); }}>
              {Object.keys(ENSAIOS_SUGERIDOS).map(t=><option key={t}>{t}</option>)}
            </Sel>
          }/>
          <F lbl="Fornecedor padrão" ch={
            <Sel value={form.fornecedorPadrao} onChange={e=>setF("fornecedorPadrao",e.target.value)}>
              <option value="">Selecionar...</option>
              {fornecedores.filter(x=>x.status==="Ativo").map(f=><option key={f.id} value={f.nome}>{f.nome}</option>)}
              <option value="Vários">Vários fornecedores</option>
            </Sel>
          }/>
          <F lbl="Referência / Especificação interna" ch={<Inp placeholder="Ex: EI-MP-001, Farmacopeia Brasileira" value={form.ref} onChange={e=>setF("ref",e.target.value)} />} />
        </div>
        <F lbl="Observações" ch={<TA rows={2} value={form.obs} onChange={e=>setF("obs",e.target.value)} placeholder="Informações adicionais sobre o material..." />} />
      </div>

      {/* Ensaios */}
      <div style={s.card}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
          <SecTitle icon="🔬" ch={`Ensaios (${ensaios.length})`} />
          <div style={{ display:"flex", gap:8 }}>
            <button style={s.btn} onClick={()=>aplicarSugestoes(form.tipo)}>↺ Recarregar sugestões</button>
            <button style={s.btnA} onClick={addEnsaio}><span className="btn-emoji">+ </span>Adicionar ensaio</button>
          </div>
        </div>

        {ensaios.length===0 ? (
          <div style={{ textAlign:"center", padding:"2rem", color:T.text3, fontSize:13 }}>
            Selecione o tipo acima para carregar sugestões ou adicione manualmente
          </div>
        ) : (
          <div>
            {/* Header */}
            <div style={{ display:"grid", gridTemplateColumns:"2fr 2fr 1fr 1fr 120px 60px 36px", gap:6, padding:"6px 8px", fontSize:10, fontWeight:700, color:T.text3, textTransform:"uppercase", letterSpacing:".06em", marginBottom:4 }}>
              <span>Ensaio *</span><span>Especificação</span><span>Unidade</span><span>Referência</span><span>Tipo de resultado</span><span>Casas dec.</span><span></span>
            </div>
            {ensaios.map((e,i)=>(
              <div key={e.id} style={{ marginBottom:8, background:T.surf, borderRadius:8, border:`1px solid ${T.border}`, padding:"8px" }}>
                <div style={{ display:"grid", gridTemplateColumns:"2fr 2fr 1fr 1fr 120px 60px 36px", gap:6, alignItems:"center" }}>
                  <Inp placeholder="Ex: pH, Umidade, Aspecto..." value={e.nome} onChange={ev=>updEnsaio(e.id,"nome",ev.target.value)} sx={{ fontSize:12 }}/>
                  <Inp placeholder="Ex: 5,0–7,0 ou Conforme padrão" value={e.espec} onChange={ev=>updEnsaio(e.id,"espec",ev.target.value)} sx={{ fontSize:12 }}/>
                  <Inp placeholder="Ex: %, pH" value={e.unidade} onChange={ev=>updEnsaio(e.id,"unidade",ev.target.value)} sx={{ fontSize:12 }}/>
                  <Inp placeholder="Ex: EI-001" value={e.ref||""} onChange={ev=>updEnsaio(e.id,"ref",ev.target.value)} sx={{ fontSize:12 }}/>
                  <Sel value={e.tipo||"numero"} onChange={ev=>updEnsaio(e.id,"tipo",ev.target.value)} sx={{ fontSize:11, padding:"5px 6px" }}>
                    <option value="numero">🔢 Numérico</option>
                    <option value="conforme">✓/✗ Conforme</option>
                    <option value="texto">📝 Texto livre</option>
                  </Sel>
                  <Sel value={String(e.casas!==undefined?e.casas:2)} onChange={ev=>updEnsaio(e.id,"casas",parseInt(ev.target.value))} disabled={e.tipo!=="numero"} sx={{ fontSize:11, padding:"5px 6px", opacity:e.tipo!=="numero"?.4:1 }}>
                    <option value="0">0</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                  </Sel>
                  <button onClick={()=>delEnsaio(e.id)} style={{ background:"#ff4f6a18", border:"1px solid #ff4f6a33", color:"#ff4f6a", borderRadius:6, cursor:"pointer", width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontFamily:"inherit" }}>✕</button>
                </div>
                {e.tipo==="numero" && (
                  <div style={{ marginTop:6, display:"flex", alignItems:"center", gap:6, paddingLeft:2 }}>
                    <input type="checkbox" id={`mult-${e.id}`} checked={!!e.multiplos} onChange={ev=>updEnsaio(e.id,"multiplos",ev.target.checked)} style={{ accentColor:T.accent, width:14, height:14 }}/>
                    <label htmlFor={`mult-${e.id}`} style={{ fontSize:11, color:T.text2, cursor:"pointer" }}>Permite lançamento de múltiplos valores (calcula média automaticamente)</label>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fichas Técnicas */}
      <div style={s.card}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
          <SecTitle icon="📄" ch={`Fichas Técnicas (${fichasTecnicas.length})`} />
          <button style={s.btnA} onClick={addLinhaFicha}><span className="btn-emoji">+ </span>Adicionar ficha</button>
        </div>
        {fichasTecnicas.length===0 ? (
          <div style={{ textAlign:"center", padding:"1.5rem", color:T.text3, fontSize:13 }}>Nenhuma ficha técnica anexada. Clique em "+ Adicionar ficha" para começar.</div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {fichasTecnicas.map(f=>(
              <div key={f.id} style={{ display:"grid", gridTemplateColumns:"1fr 1fr auto auto", gap:8, alignItems:"center", background:T.surf, border:`1px solid ${T.border}`, borderRadius:8, padding:"8px 10px" }}>
                <Sel value={f.fornecedorNome} onChange={e=>updLinhaFicha(f.id,"fornecedorNome",e.target.value)} sx={{ fontSize:12 }}>
                  <option value="">Selecionar fornecedor...</option>
                  {fornecedores.filter(x=>x.status==="Ativo").map(forn=><option key={forn.id} value={forn.nome}>{forn.nome}</option>)}
                  <option value="Outro">Outro</option>
                </Sel>
                {f.url ? (
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ fontSize:12, color:T.accent, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }} title={f.nome}>📎 {f.nome}</span>
                    <button onClick={()=>window.open(f.url,"_blank","noopener,noreferrer")} style={{ ...s.btn, padding:"3px 8px", fontSize:11, color:T.accent, whiteSpace:"nowrap" }}>👁 Ver</button>
                  </div>
                ) : (
                  <label style={{ ...s.btn, padding:"5px 12px", fontSize:11, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:4 }}>
                    {ftUploading===f.id ? "Enviando..." : "📎 Anexar PDF"}
                    <input type="file" accept=".pdf,image/*" style={{ display:"none" }} disabled={ftUploading===f.id} onChange={e=>uploadFicha(f.id, e.target.files[0])} />
                  </label>
                )}
                {f.url ? (
                  <label style={{ ...s.btn, padding:"5px 10px", fontSize:11, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:4 }}>
                    {ftUploading===f.id ? "..." : "↺ Trocar"}
                    <input type="file" accept=".pdf,image/*" style={{ display:"none" }} disabled={ftUploading===f.id} onChange={e=>uploadFicha(f.id, e.target.files[0])} />
                  </label>
                ) : <div />}
                <button onClick={()=>delLinhaFicha(f.id)} style={{ background:"#ff4f6a18", border:"1px solid #ff4f6a33", color:"#ff4f6a", borderRadius:6, cursor:"pointer", width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontFamily:"inherit" }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display:"flex", gap:10, justifyContent:"flex-end", paddingBottom:"1rem" }}>
        <button style={s.btn} onClick={()=>{ setView("lista"); setSel(null); }}>Cancelar</button>
        <button style={s.btnA} onClick={salvar}><span className="btn-emoji">💾 </span>Salvar material →</button>
      </div>
    </div>
  );
}

/* ─── CQ ANALISES TAB ────────────────────────────────────────────────────────── */
function CQAnalisesTab({ user, toast_, fornecedores, setTab, perm }) {
  const T = useTheme(); const s = useS();
  const [materiais, setMateriais] = useState([]);
  const [analises, setAnalises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("lista");
  const [selAnalise, setSelAnalise] = useState(null);

  // Form
  const [matSel, setMatSel] = useState(null);
  const [form, setForm] = useState({ fornecedor:"", lote:"", qtdRecebida:"", nf:"", dataRecebimento:tod(), dataAnalise:tod(), resp:user.name, obs:"" });
  const [filtroTipo, setFiltroTipo] = useState("Todos");
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroConc, setFiltroConc] = useState("Todos");
  const [resultados, setResultados] = useState([]);
  const [coa, setCoa] = useState(null);
  const [coaUploading, setCoaUploading] = useState(false);
  const setF = (k,v) => setForm(p=>({...p,[k]:v}));

  useEffect(()=>{
    const u1 = subscribeCollection("cq_materiais", list=>{ setMateriais(list.sort((a,b)=>(a.nome||"").localeCompare(b.nome||""))); });
    const u2 = subscribeCollection("cq_analises", list=>{ setAnalises(list.sort((a,b)=>(b.criadoTs||0)-(a.criadoTs||0))); setLoading(false); });
    const t = setTimeout(()=>setLoading(false), 3000);
    return ()=>{ u1(); u2(); clearTimeout(t); };
  },[]);

  const selecionarMaterial = (mat) => {
    setMatSel(mat);
    setResultados((mat.ensaios||[]).map(e=>({ tipo:"numero", casas:2, multiplos:false, ...e, resultado:"", conforme:null, obs:"" })));
    if(mat.fornecedorPadrao && mat.fornecedorPadrao!=="Vários") setF("fornecedor", mat.fornecedorPadrao);
  };

  const updRes = (id,k,v) => setResultados(p=>p.map(r=>r.id===id?{...r,[k]:v}:r));

  const [multiplosState, setMultiplosState] = useState({});
  const toggleMultiplos = (id) => setMultiplosState(p=>({...p,[id]:{aberto:!p[id]?.aberto,valores:p[id]?.valores||["","","","",""]}}));
  const updValorMultiplo = (id,idx,val) => setMultiplosState(p=>({...p,[id]:{...p[id],valores:p[id].valores.map((v,i)=>i===idx?val:v)}}));
  const aplicarMedia = (id,casas) => { const vals=multiplosState[id]?.valores||[]; const media=calcMedia(vals,casas); if(media){updRes(id,"resultado",media);setMultiplosState(p=>({...p,[id]:{...p[id],aberto:false}}));} };

  const fmtNum = (val, casas) => {
    const n = parseFloat(String(val).replace(",","."));
    if (isNaN(n)) return val;
    return n.toFixed(casas).replace(".",",");
  };
  const calcMedia = (valores, casas) => {
    const nums = valores.map(v=>parseFloat(String(v).replace(",","."))).filter(n=>!isNaN(n));
    if (!nums.length) return "";
    return (nums.reduce((a,b)=>a+b,0)/nums.length).toFixed(casas).replace(".",",");
  };

  const uploadCOA = async (file) => {
    if(!file) return;
    setCoaUploading(true);
    try {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      const r = isPdf ? await uploadPdfToSupabase(file) : await uploadToCloudinary(file);
      setCoa(r); toast_("COA anexado!", "green");
    }
    catch { toast_("Erro ao enviar COA.", "red"); }
    setCoaUploading(false);
  };

  const getNCs = () => resultados.filter(r => r.conforme === false);

  const salvar = async () => {
    try {
    if(!matSel) { alert("Selecione o material."); return; }
    const ncs = getNCs();
    if(ncs.length > 0) {
      const confirma = window.confirm(
        `⚠️ ATENÇÃO!\n\n${ncs.length} ensaio(s) estão NÃO CONFORMES:\n${ncs.map(n=>`• ${n.nome}: ${n.resultado}`).join("\n")}\n\nDeseja salvar mesmo assim?`
      );
      if(!confirma) return;
    }
    const reprovado = ncs.length > 0;
    const num = `RA-${new Date().getFullYear()}-${String(analises.length+1).padStart(3,"0")}`;
    const analise = {
      id: Date.now(), num,
      materialId: matSel.id, materialNome: matSel.nome, materialTipo: matSel.tipo,
      ...form, resultados, coa,
      conclusao: reprovado ? "Reprovado" : resultados.some(r=>r.conforme===null&&r.resultado==="") ? "Pendente" : "Aprovado",
      criadoPor: user.name, criadoEm: tod(), criadoTs: Date.now()
    };
    await saveCollection("cq_analises", String(analise.id), analise);
    toast_(`${num} salva!`, "green");
    if(reprovado && window.confirm("Material REPROVADO! Deseja abrir uma RNC automaticamente?")) {
      setTab("nova");
    }
    setView("lista");
    setMatSel(null);
    setForm({ fornecedor:"", lote:"", qtdRecebida:"", nf:"", dataRecebimento:tod(), dataAnalise:tod(), resp:user.name, obs:"" });
    setResultados([]); setCoa(null);
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const editarAnalise = async (a) => {
    const isOwner = a.resp === user?.name || a.analista === user?.name;
    const canEdit = isOwner || ["admin","keyuser","rt"].includes(user?.role) || (perm && perm("editarAnalise"));
    if (!canEdit) { alert("Você não tem permissão para editar esta análise."); return; }
    // Load the material to get ensaio definitions
    const mat = materiais.find(m => m.id === a.matId || m.nome === a.materialNome);
    if (mat) {
      setMatSel(mat);
      const lista = mat.ensaios || [];
      setEnsaios(lista.map((e,i) => {
        const res = (a.resultados||[]).find(r => r.nome === e.nome || r.id === e.id) || {};
        return { ...e, id:i, resultado:res.resultado||"", conforme:res.conforme!=null?res.conforme:null, obs:res.obs||"", tipo:e.tipo||"numero", casas:e.casas!==undefined?e.casas:2, multiplos:e.multiplos||false };
      }));
    } else {
      setEnsaios((a.resultados||[]).map((r,i)=>({ ...r, id:i })));
    }
    setForm({ fornecedor:a.fornecedor||"", lote:a.lote||"", qtdRecebida:a.qtdRecebida||"", nf:a.nf||"", dataAnalise:a.dataAnalise||tod(), analista:a.analista||a.resp||user.name, obs:a.obs||"" });
    setCoa(a.coa||null);
    setSel({ ...a, _editando: true });
    setView("novo");
    setSelAnalise(null);
    toast_("Editando análise — salve para registrar as alterações.", "green");
  };

  const delAnalise = async (id) => {
    try {
    if(!confirm("Excluir esta análise?")) return;
    await deleteFromCollection("cq_analises", String(id));
    setSelAnalise(null); toast_("Análise excluída.", "red");
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const exportRA = (a) => {
    const concColor = a.conclusao==="Aprovado"?"#1a7a3c":a.conclusao==="Reprovado"?"#cc2244":"#8a6000";
    const win = window.open("","_blank");
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/>
<title>${a.num} — Herbamed®</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#1a1a1a;}
  .page{width:210mm;padding:14mm;margin:0 auto;}
  .header{display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;border-bottom:3px solid #1a7a3c;margin-bottom:16px;}
  .logo{font-family:Georgia,serif;font-size:20px;font-weight:700;color:#1a7a3c;}
  .section{margin-bottom:16px;}
  .stitle{font-size:10px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #e0e0e0;padding-bottom:4px;margin-bottom:8px;}
  .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;}
  .field{background:#f8f9fa;border:1px solid #e8e8e8;border-radius:5px;padding:7px 9px;}
  .flabel{font-size:9px;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:2px;}
  table{width:100%;border-collapse:collapse;font-size:11px;}
  th{background:#f0f4f0;color:#333;font-weight:700;padding:7px 8px;text-align:left;border:1px solid #ddd;}
  td{padding:6px 8px;border:1px solid #eee;vertical-align:middle;}
  .conf{color:#1a7a3c;font-weight:700;} .nconf{color:#cc2244;font-weight:700;} .pend{color:#888;}
  .conclusao{padding:14px;border-radius:8px;text-align:center;font-size:16px;font-weight:800;background:${concColor}15;border:2px solid ${concColor};color:${concColor};margin:16px 0;}
  .footer{margin-top:20px;padding-top:10px;border-top:2px solid #1a7a3c;display:flex;justify-content:space-between;font-size:10px;color:#666;}
  @media print{body{background:#fff!important;}}
</style></head><body><div class="page">
<div style="background:#1a4a2e;padding:20px 24px;display:flex;justify-content:space-between;align-items:center;">
  <div style="display:flex;align-items:center;gap:12px;">
    <img src="https://res.cloudinary.com/dswsg9w0w/image/upload/484237672_1316151256653106_1151541448837719199_n1_zww2li" style="width:44px;height:44px;border-radius:6px;object-fit:cover;"/>
    <div>
      <div style="color:#fff;font-size:14px;font-weight:bold;">Herbamed Laboratório Nutracêutico LTDA</div>
      <div style="color:#9fd4b2;font-size:10px;">CNPJ: 14.829.598/0001-30</div>
    </div>
  </div>
  <div style="text-align:right;">
    <div style="color:#fff;font-size:13px;font-weight:bold;">Relatório de Análise</div>
    <div style="color:#9fd4b2;font-size:11px;">N° ${a.num} · ${fmt(a.dataAnalise)}</div>
  </div>
</div>
<div class="section">
  <div class="stitle">Identificação</div>
  <div class="grid3">
    <div class="field"><div class="flabel">Material</div><div>${a.materialNome}</div></div>
    <div class="field"><div class="flabel">Tipo</div><div>${a.materialTipo}</div></div>
    <div class="field"><div class="flabel">Fornecedor</div><div>${a.fornecedor||"—"}</div></div>
    <div class="field"><div class="flabel">Lote</div><div>${a.lote||"—"}</div></div>
    <div class="field"><div class="flabel">Qtd. Recebida</div><div>${a.qtdRecebida||"—"}</div></div>
    <div class="field"><div class="flabel">Nota Fiscal</div><div>${a.nf||"—"}</div></div>
    <div class="field"><div class="flabel">Data Recebimento</div><div>${fmt(a.dataRecebimento)}</div></div>
    <div class="field"><div class="flabel">Data Análise</div><div>${fmt(a.dataAnalise)}</div></div>
    <div class="field"><div class="flabel">Analista</div><div>${a.resp}</div></div>
  </div>
</div>
<div class="section">
  <div class="stitle">Resultados das Análises</div>
  <table>
    <thead><tr><th>Ensaio</th><th>Especificação</th><th>Resultado</th><th>Unidade</th><th>Referência</th><th>Situação</th></tr></thead>
    <tbody>
      ${(a.resultados||[]).map(r=>`<tr>
        <td><strong>${r.nome}</strong></td>
        <td>${r.espec||"—"}</td>
        <td>${r.resultado||"—"}</td>
        <td>${r.unidade||"—"}</td>
        <td>${r.ref||"—"}</td>
        <td>${r.conforme===true?'<span class="conf">✓ Conforme</span>':r.conforme===false?'<span class="nconf">✗ N.C.</span>':'<span class="pend">—</span>'}</td>
      </tr>`).join("")}
    </tbody>
  </table>
</div>
${a.obs?`<div class="section"><div class="stitle">Observações</div><p>${a.obs}</p></div>`:""}
<div class="conclusao">${a.conclusao==="Aprovado"?"✅ APROVADO":a.conclusao==="Reprovado"?"❌ REPROVADO":"⏳ PENDENTE"}</div>
${a.coa?`<div class="section"><div class="stitle">COA do Fornecedor</div><p>Laudo: <a href="${a.coa.url}" target="_blank">${a.coa.name}</a></p></div>`:""}
<div style="display:flex;gap:40px;margin-top:24px;padding-top:12px;border-top:1px solid #ccc;">
  <div style="flex:1;text-align:center;">
    ${user.assinatura ? `<img src="${user.assinatura}" alt="Assinatura" style="height:56px;max-width:200px;object-fit:contain;display:block;margin:0 auto 4px;"/>` : `<div style="height:56px;"></div>`}
    <div style="border-top:1px solid #333;padding-top:6px;font-size:11px;">${a.resp}<br/>Analista de CQ<br/><span style="color:#666;font-size:10px;">Assinado eletronicamente em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</span></div>
  </div>
  <div style="flex:1;text-align:center;"><div style="border-top:1px solid #333;padding-top:6px;margin-top:30px;font-size:11px;">______________________<br/>Gerente de Qualidade</div></div>
</div>
<div style="padding:10px 24px;background:#f5f5f5;border-top:1px solid #eee;display:flex;justify-content:space-between;font-size:10px;color:#888;">
  <span>Herbamed Laboratório Nutracêutico LTDA · CNPJ: 14.829.598/0001-30</span>
  <span>Av Irene Meneghetti Longhini, 500 · Assis/SP - Brasil · CEP: 19816-370</span>
</div>
</div><script>window.onload=()=>window.print();</script></body></html>`;
    win.document.write(html); win.document.close();
  };

  const analiseFiltradas = analises.filter(a=>{
    const textoOk = !filtroTexto || (a.materialNome||"").toLowerCase().includes(filtroTexto.toLowerCase()) || (a.num||"").toLowerCase().includes(filtroTexto.toLowerCase()) || (a.lote||"").toLowerCase().includes(filtroTexto.toLowerCase());
    const concOk = filtroConc==="Todos" || a.conclusao===filtroConc;
    return textoOk && concOk;
  });
  const { paginated: analisePg, page: pgAn, total: totAn, setPage: setPgAn } = usePagination(analiseFiltradas, 15);

  if(loading) return <div style={{ textAlign:"center", padding:"3rem", color:T.text2 }}>Carregando...</div>;

  // ── NOVA ANÁLISE ──
  if(view==="nova") return (
    <div>
      <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:"1rem" }}>
        <button style={s.btn} onClick={()=>setView("lista")}>← Voltar</button>
        <div style={{ fontSize:15, fontWeight:700, color:T.text }}>Nova Ficha de Análise</div>
      </div>

      {/* Seleção do material */}
      <div style={s.card}>
        <SecTitle icon="📦" ch="Selecionar material" />
        {materiais.length===0 ? (
          <div style={{ color:T.text3, fontSize:13, padding:"1rem", textAlign:"center" }}>
            Nenhum material cadastrado. Cadastre um material em <strong>CQ — Materiais</strong> primeiro.
          </div>
        ) : ((() => {
          const tiposUnicos = ["Todos", ...Array.from(new Set(materiais.map(m=>m.tipo||"Outros"))).sort()];
          const matFiltrados = filtroTipo==="Todos" ? materiais : materiais.filter(m=>(m.tipo||"Outros")===filtroTipo);
          return (
            <>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:12 }}>
                {tiposUnicos.map(t=>(
                  <button key={t} onClick={()=>setFiltroTipo(t)} style={{ padding:"4px 12px", fontSize:11, fontWeight:600, borderRadius:20, border:`1px solid ${filtroTipo===t?T.accent:T.border}`, background:filtroTipo===t?T.accentDim:"transparent", color:filtroTipo===t?T.accent:T.text2, cursor:"pointer", transition:"all .15s" }}>{t}</button>
                ))}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
                {matFiltrados.map(m=>(
                  <div key={m.id} onClick={()=>selecionarMaterial(m)} style={{ padding:"12px", background: matSel?.id===m.id?T.accentDim:T.surf, border:`1px solid ${matSel?.id===m.id?T.accent+"55":T.border}`, borderRadius:10, cursor:"pointer", transition:"all .15s" }}>
                    <div style={{ fontSize:13, fontWeight:600, color:matSel?.id===m.id?T.accent:T.text }}>{m.nome}</div>
                    <div style={{ fontSize:11, color:T.text2, marginTop:2 }}>{m.tipo}</div>
                    <div style={{ fontSize:10, color:T.text3, marginTop:2 }}>{m.ensaios?.length||0} ensaios</div>
                  </div>
                ))}
                {matFiltrados.length===0 && <div style={{ gridColumn:"1/-1", textAlign:"center", color:T.text3, fontSize:13, padding:"1rem" }}>Nenhum material nesta categoria.</div>}
              </div>
            </>
          );
        })())}
      </div>

      {matSel && <>
        {/* Dados do recebimento */}
        <div style={s.card}>
          <SecTitle icon="🚚" ch="Dados do recebimento" />
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
            <F lbl="Fornecedor" ch={
              <Sel value={form.fornecedor} onChange={e=>setF("fornecedor",e.target.value)}>
                <option value="">Selecionar...</option>
                {fornecedores.filter(x=>x.status==="Ativo").map(f=><option key={f.id} value={f.nome}>{f.nome}</option>)}
                <option value="Outro">Outro</option>
              </Sel>
            }/>
            <F lbl="Nº do lote" ch={<Inp placeholder="Ex: LOT-2026-001" value={form.lote} onChange={e=>setF("lote",e.target.value)} />} />
            <F lbl="Qtd. recebida" ch={<Inp placeholder="Ex: 25 kg" value={form.qtdRecebida} onChange={e=>setF("qtdRecebida",e.target.value)} />} />
            <F lbl="Nota Fiscal" ch={<Inp placeholder="Ex: NF 12345" value={form.nf} onChange={e=>setF("nf",e.target.value)} />} />
            <F lbl="Data recebimento" ch={<Inp type="date" value={form.dataRecebimento} onChange={e=>setF("dataRecebimento",e.target.value)} />} />
            <F lbl="Data análise" ch={<Inp type="date" value={form.dataAnalise} onChange={e=>setF("dataAnalise",e.target.value)} />} />
            <F lbl="Analista" ch={<Inp value={form.resp} onChange={e=>setF("resp",e.target.value)} />} />
          </div>
        </div>

        {/* Resultados */}
        <div style={s.card}>
          <SecTitle icon="🔬" ch={`Resultados — ${matSel.nome}`} />
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead><tr style={{ background:T.surf }}>
                {["Ensaio","Especificação","Resultado (livre)","Un.","Referência","Conforme?","Obs."].map(h=>(
                  <th key={h} style={{ padding:"8px 10px", fontSize:10, fontWeight:700, color:T.text3, textTransform:"uppercase", textAlign:"left", borderBottom:`1px solid ${T.border}`, whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {resultados.map((r,i)=>(
                  <tr key={r.id} style={{ background:i%2===0?T.card:T.surf, borderLeft: r.conforme===false?"3px solid #ff4f6a":r.conforme===true?"3px solid #2ab84a":"3px solid transparent" }}>
                    <td style={{ padding:"8px 10px", fontSize:12, fontWeight:600, color:T.text, whiteSpace:"nowrap" }}>{r.nome}</td>
                    <td style={{ padding:"8px 10px", fontSize:11, color:T.text2 }}>{r.espec||"—"}</td>
                    <td style={{ padding:"8px 8px" }}>
                      {r.tipo==="conforme" ? (
                        <div style={{ display:"flex", gap:4 }}>
                          <button onClick={()=>updRes(r.id,"conforme",true)} style={{ flex:1, padding:"5px", borderRadius:6, border:`1px solid ${r.conforme===true?"#2ab84a55":T.border}`, background:r.conforme===true?"#2ab84a22":"transparent", color:r.conforme===true?"#2ab84a":T.text2, cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:600 }}>✓ Conf.</button>
                          <button onClick={()=>updRes(r.id,"conforme",false)} style={{ flex:1, padding:"5px", borderRadius:6, border:`1px solid ${r.conforme===false?"#ff4f6a55":T.border}`, background:r.conforme===false?"#ff4f6a22":"transparent", color:r.conforme===false?"#ff4f6a":T.text2, cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:600 }}>✗ N.C.</button>
                        </div>
                      ) : r.tipo==="texto" ? (
                        <Inp placeholder="Resultado..." value={r.resultado} onChange={e=>updRes(r.id,"resultado",e.target.value)} sx={{ padding:"5px 8px", fontSize:12, width:110 }}/>
                      ) : (
                        <div>
                          <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                            <Inp
                              placeholder={`0,${"0".repeat(r.casas||2)}`}
                              value={r.resultado}
                              onChange={e=>updRes(r.id,"resultado",e.target.value)}
                              onBlur={e=>{ if(e.target.value) updRes(r.id,"resultado",fmtNum(e.target.value,r.casas||2)); }}
                              sx={{ padding:"5px 8px", fontSize:12, width:80 }}
                            />
                            {r.multiplos && (
                              <button onClick={()=>toggleMultiplos(r.id)}
                                title="Lançar múltiplos valores"
                                style={{ padding:"4px 7px", borderRadius:6, border:`1px solid ${multiplosState[r.id]?.aberto?T.accent:T.border}`, background:multiplosState[r.id]?.aberto?T.accentDim:"transparent", color:multiplosState[r.id]?.aberto?T.accent:T.text3, cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:700 }}>
                                Σ
                              </button>
                            )}
                          </div>
                          {r.multiplos && multiplosState[r.id]?.aberto && (
                            <div style={{ marginTop:6, padding:"8px", background:T.card, border:`1px solid ${T.accent}33`, borderRadius:8 }}>
                              <div style={{ fontSize:10, color:T.accent, fontWeight:700, textTransform:"uppercase", marginBottom:6 }}>Múltiplos valores — média automática</div>
                              <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:6 }}>
                                {(multiplosState[r.id]?.valores||["","","","",""]).map((v,vi)=>(
                                  <Inp key={vi} type="number" placeholder={`#${vi+1}`} value={v}
                                    onChange={ev=>updValorMultiplo(r.id,vi,ev.target.value)}
                                    sx={{ width:56, padding:"4px 6px", fontSize:11 }}/>
                                ))}
                                <button onClick={()=>setMultiplosState(p=>({...p,[r.id]:{...p[r.id],valores:[...(p[r.id]?.valores||[]),""]}}))
                                } style={{ padding:"4px 8px", borderRadius:6, border:`1px solid ${T.border}`, background:"transparent", color:T.text3, cursor:"pointer", fontFamily:"inherit", fontSize:11 }}>+</button>
                              </div>
                              {(() => {
                                const vals = multiplosState[r.id]?.valores||[];
                                const nums = vals.map(v=>parseFloat(String(v).replace(",","."))).filter(n=>!isNaN(n));
                                if (!nums.length) return null;
                                const media = nums.reduce((a,b)=>a+b,0)/nums.length;
                                const dp = Math.sqrt(nums.reduce((s,v)=>s+Math.pow(v-media,2),0)/nums.length);
                                return (
                                  <div style={{ fontSize:11, color:T.text2, marginBottom:6 }}>
                                    <span style={{ fontWeight:700, color:T.accent }}>Média: {media.toFixed(r.casas||2).replace(".",",")} {r.unidade}</span>
                                    {nums.length>1 && <span style={{ color:T.text3, marginLeft:8 }}>DP: ±{dp.toFixed(r.casas||2).replace(".",",")}</span>}
                                    <span style={{ color:T.text3, marginLeft:8 }}>n={nums.length}</span>
                                  </div>
                                );
                              })()}
                              <button onClick={()=>aplicarMedia(r.id,r.casas||2)}
                                style={{ ...s.btnA, fontSize:11, padding:"4px 12px" }}>
                                ✓ Aplicar média
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={{ padding:"8px 8px", fontSize:11, color:T.text3 }}>{r.unidade||"—"}</td>
                    <td style={{ padding:"8px 8px", fontSize:11, color:T.text3 }}>{r.ref||"—"}</td>
                    <td style={{ padding:"8px 8px" }}>
                      <div style={{ display:"flex", gap:4 }}>
                        <button onClick={()=>updRes(r.id,"conforme",true)} style={{ padding:"4px 8px", borderRadius:6, border:`1px solid ${r.conforme===true?"#2ab84a55":T.border}`, background:r.conforme===true?"#2ab84a22":"transparent", color:r.conforme===true?"#2ab84a":T.text2, cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:600 }}>✓</button>
                        <button onClick={()=>updRes(r.id,"conforme",false)} style={{ padding:"4px 8px", borderRadius:6, border:`1px solid ${r.conforme===false?"#ff4f6a55":T.border}`, background:r.conforme===false?"#ff4f6a22":"transparent", color:r.conforme===false?"#ff4f6a":T.text2, cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:600 }}>✗</button>
                        <button onClick={()=>updRes(r.id,"conforme",null)} style={{ padding:"4px 6px", borderRadius:6, border:`1px solid ${T.border}`, background:"transparent", color:T.text3, cursor:"pointer", fontFamily:"inherit", fontSize:10 }}>—</button>
                      </div>
                    </td>
                    <td style={{ padding:"8px 8px" }}>
                      <Inp placeholder="obs..." value={r.obs||""} onChange={e=>updRes(r.id,"obs",e.target.value)} sx={{ fontSize:11, padding:"4px 6px", width:90 }}/>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Indicador de NCs */}
          {getNCs().length > 0 && (
            <div style={{ marginTop:"1rem", padding:"10px 14px", background:"#ff4f6a18", border:"1px solid #ff4f6a33", borderRadius:8, fontSize:12, color:"#ff4f6a", fontWeight:600 }}>
              ⚠️ {getNCs().length} ensaio(s) marcado(s) como NÃO CONFORME — será solicitada confirmação ao salvar
            </div>
          )}
        </div>

        {/* COA */}
        <div style={s.card}>
          <SecTitle icon="📄" ch="COA do fornecedor" />
          {coa ? (
            <div style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", background:T.surf, border:`1px solid ${T.border}`, borderRadius:8 }}>
              <span style={{ fontSize:24 }}>📄</span>
              <div style={{ flex:1 }}><div style={{ fontSize:13, fontWeight:600 }}>{coa.name}</div></div>
              <button onClick={()=>openCOA(coa)} style={{ ...s.btn, fontSize:11, color:T.accent }}>Ver COA</button>
              <button style={s.btnD} onClick={()=>setCoa(null)}>✕</button>
            </div>
          ) : (
            <div style={{ border:`2px dashed ${T.border2}`, borderRadius:10, padding:"1.5rem", textAlign:"center", cursor:"pointer" }} onClick={()=>document.getElementById("coa-up").click()}>
              <div style={{ fontSize:28, marginBottom:6 }}>📎</div>
              <div style={{ fontSize:13, color:T.text2 }}>{coaUploading?"Enviando...":"Clique para anexar o COA (PDF ou imagem)"}</div>
              <input id="coa-up" type="file" accept=".pdf,image/*" style={{ display:"none" }} onChange={e=>uploadCOA(e.target.files[0])} />
            </div>
          )}
        </div>

        <F lbl="Observações gerais" ch={<TA rows={2} value={form.obs} onChange={e=>setF("obs",e.target.value)} placeholder="Observações sobre o recebimento ou análise..." />} />

        <div style={{ display:"flex", gap:10, justifyContent:"flex-end", paddingBottom:"1rem", marginTop:"1rem" }}>
          <button style={s.btn} onClick={()=>setView("lista")}>Cancelar</button>
          <button style={s.btnA} onClick={salvar}>💾 Salvar análise →</button>
        </div>
      </>}
    </div>
  );

  // ── LISTA ──
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
        <div style={{ fontSize:13, color:T.text2 }}>{analiseFiltradas.length} de {analises.length} análise(s)</div>
        <button style={s.btnA} onClick={()=>{ setMatSel(null); setFiltroTipo("Todos"); setForm({ fornecedor:"", lote:"", qtdRecebida:"", nf:"", dataRecebimento:tod(), dataAnalise:tod(), resp:user.name, obs:"" }); setResultados([]); setCoa(null); setView("nova"); }}>+ Nova Análise</button>
      </div>

      {/* Filtros */}
      <div style={{ display:"flex", gap:10, marginBottom:"1rem", flexWrap:"wrap" }}>
        <input value={filtroTexto} onChange={e=>{ setFiltroTexto(e.target.value); setPgAn(1); }} placeholder="Buscar por material, RA ou lote..." style={{ flex:1, minWidth:200, padding:"7px 12px", fontSize:13, borderRadius:8, border:`1px solid ${T.border}`, background:T.surf, color:T.text, outline:"none" }} />
        {["Todos","Aprovado","Reprovado","Pendente"].map(c=>(
          <button key={c} onClick={()=>{ setFiltroConc(c); setPgAn(1); }} style={{ padding:"6px 14px", fontSize:12, fontWeight:600, borderRadius:20, border:`1px solid ${filtroConc===c?T.accent:T.border}`, background:filtroConc===c?T.accentDim:"transparent", color:filtroConc===c?T.accent:T.text2, cursor:"pointer", transition:"all .15s" }}>{c}</button>
        ))}
      </div>

      {analises.length===0 ? (
        <div style={{ ...s.card, textAlign:"center", padding:"3rem" }}>
          <div style={{ fontSize:40, marginBottom:"1rem", opacity:.3 }}>📋</div>
          <div style={{ fontSize:14, color:T.text2 }}>Nenhuma análise registrada</div>
        </div>
      ) : analiseFiltradas.length===0 ? (
        <div style={{ ...s.card, textAlign:"center", padding:"2rem" }}>
          <div style={{ fontSize:13, color:T.text2 }}>Nenhuma análise encontrada com os filtros aplicados.</div>
        </div>
      ) : (
        <>
        <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr style={{ background:T.surf }}>
              {["Nº RA","Material","Fornecedor","Lote","Data","Analista","Conclusão",""].map(h=>(
                <th key={h} style={{ padding:"10px 12px", fontSize:10, fontWeight:700, color:T.text3, textTransform:"uppercase", textAlign:"left", borderBottom:`1px solid ${T.border}`, whiteSpace:"nowrap" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {analisePg.map((a,i)=>{
                const cc = a.conclusao;
                const c = cc==="Aprovado"?"#2ab84a":cc==="Reprovado"?"#ff4f6a":"#ffd166";
                return (
                  <tr key={a.id} style={{ background:i%2===0?T.card:T.surf, cursor:"pointer" }} onClick={()=>setSelAnalise(a)}>
                    <td style={{ padding:"10px 12px", fontSize:12, fontWeight:700, color:T.accent }}>{a.num}</td>
                    <td style={{ padding:"10px 12px", fontSize:13, color:T.text }}>{a.materialNome}</td>
                    <td style={{ padding:"10px 12px", fontSize:12, color:T.text2 }}>{a.fornecedor||"—"}</td>
                    <td style={{ padding:"10px 12px", fontSize:12, color:T.text2 }}>{a.lote||"—"}</td>
                    <td style={{ padding:"10px 12px", fontSize:12, color:T.text2 }}>{fmt(a.dataAnalise)}</td>
                    <td style={{ padding:"10px 12px", fontSize:12, color:T.text2 }}>{a.resp}</td>
                    <td style={{ padding:"10px 12px" }}>
                      <span style={{ fontSize:11, fontWeight:700, color:c, background:`${c}18`, padding:"3px 10px", borderRadius:20 }}>
                        {cc==="Aprovado"?"✅ Aprovado":cc==="Reprovado"?"❌ Reprovado":"⏳ Pendente"}
                      </span>
                    </td>
                    <td style={{ padding:"10px 8px" }}>
                      <button style={{ ...s.btn, padding:"4px 8px", fontSize:11, color:"#ff8c42", borderColor:"#ff8c4233", background:"#ff8c4212" }} onClick={e=>{e.stopPropagation();exportRA(a);}}><span className="btn-emoji">📄 </span>PDF</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={pgAn} total={totAn} setPage={setPgAn} />
        </>
      )}

      {/* Modal detalhe */}
      {selAnalise && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.82)", backdropFilter:"blur(6px)", zIndex:999, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }} onClick={e=>e.target===e.currentTarget&&setSelAnalise(null)}>
          <div style={{ background:T.card2, border:`1px solid ${T.border2}`, borderRadius:18, padding:"1.75rem", maxWidth:760, width:"100%", maxHeight:"90vh", overflowY:"auto", boxShadow:"0 32px 80px #000a" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"1rem" }}>
              <div>
                <div style={{ fontSize:20, fontWeight:700 }}>{selAnalise.num} — {selAnalise.materialNome}</div>
                <div style={{ fontSize:12, color:T.text2, marginTop:2 }}>{selAnalise.fornecedor||"—"} · Lote: {selAnalise.lote||"—"} · {fmt(selAnalise.dataAnalise)} · {selAnalise.resp}</div>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button style={{ ...s.btn, fontSize:11, color:T.accent, borderColor:T.accent+"33", background:T.accentDim }} onClick={()=>editarAnalise(selAnalise)}><span className="btn-emoji">✏️ </span>Editar</button>
                <button style={{ ...s.btn, fontSize:11, color:"#ff8c42", borderColor:"#ff8c4233", background:"#ff8c4212" }} onClick={()=>exportRA(selAnalise)}><span className="btn-emoji">📄 </span>PDF</button>
                <button style={{ ...s.btnA, fontSize:11 }} onClick={()=>{ setTab("laudos"); setTimeout(()=>{ window._laudoPreFill = { produto:selAnalise.materialNome||"", lote:selAnalise.lote||"", tipo:"materia_prima", ensaios:(selAnalise.resultados||[]).map(r=>({ label:r.nome||r.ensaio||"", unidade:r.unidade||"", especificacao:r.especificacao||"", resultado:r.resultado||"", conforme:r.conforme, obs:r.obs||"" })) }; }, 300); }}><span className="btn-emoji">📋 </span>Gerar Laudo</button>
                <button style={s.btnD} onClick={()=>delAnalise(selAnalise.id)}>🗑️</button>
                <button onClick={()=>setSelAnalise(null)} style={{ background:T.border, border:"none", color:T.text2, cursor:"pointer", borderRadius:8, padding:"6px 10px", fontSize:16, fontFamily:"inherit" }}>✕</button>
              </div>
            </div>
            <div style={{ overflowX:"auto", marginBottom:"1rem" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead><tr style={{ background:T.surf }}>
                  {["Ensaio","Especificação","Resultado","Un.","Situação","Obs."].map(h=>(
                    <th key={h} style={{ padding:"7px 10px", fontSize:10, fontWeight:700, color:T.text3, textTransform:"uppercase", textAlign:"left", borderBottom:`1px solid ${T.border}` }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {(selAnalise.resultados||[]).map((r,i)=>(
                    <tr key={i} style={{ background:i%2===0?T.card:T.surf, borderLeft:r.conforme===false?"3px solid #ff4f6a":r.conforme===true?"3px solid #2ab84a":"3px solid transparent" }}>
                      <td style={{ padding:"7px 10px", fontSize:12, fontWeight:600 }}>{r.nome}</td>
                      <td style={{ padding:"7px 10px", fontSize:11, color:T.text2 }}>{r.espec||"—"}</td>
                      <td style={{ padding:"7px 10px", fontSize:12, fontWeight:500 }}>{r.resultado||"—"}</td>
                      <td style={{ padding:"7px 10px", fontSize:11, color:T.text3 }}>{r.unidade||"—"}</td>
                      <td style={{ padding:"7px 10px" }}>
                        {r.conforme===true?<span style={{ color:"#2ab84a", fontWeight:700 }}>✓ Conf.</span>:r.conforme===false?<span style={{ color:"#ff4f6a", fontWeight:700 }}>✗ N.C.</span>:<span style={{ color:T.text3 }}>—</span>}
                      </td>
                      <td style={{ padding:"7px 10px", fontSize:11, color:T.text2 }}>{r.obs||"—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginBottom:"1rem", padding:"10px 14px", background:T.surf, borderRadius:8, display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
              <span style={{ fontSize:20 }}>📄</span>
              {selAnalise.coa ? (<>
                <span style={{ fontSize:13, color:T.text, flex:1 }}>COA: {selAnalise.coa.name}</span>
                <button onClick={()=>openCOA(selAnalise.coa)} style={{ ...s.btn, fontSize:11, color:T.accent }}>Ver COA</button>
                <button onClick={()=>document.getElementById("coa-reattach-analise").click()} style={{ ...s.btn, fontSize:11 }}><span className="btn-emoji">🔄 </span>Trocar</button>
                <button onClick={async()=>{ if(!confirm("Remover COA desta análise?")) return; await saveCollection("cq_analises", String(selAnalise.id), {...selAnalise, coa:null}); setSelAnalise({...selAnalise, coa:null}); toast_("COA removido.","red"); }} style={{ ...s.btnD, fontSize:11 }}><span className="btn-emoji">🗑️ </span>Excluir</button>
              </>) : (<>
                <span style={{ fontSize:13, color:T.text3, flex:1 }}>Nenhum COA anexado</span>
                <button onClick={()=>document.getElementById("coa-reattach-analise").click()} style={{ ...s.btnA, fontSize:11 }}><span className="btn-emoji">📎 </span>Anexar COA</button>
              </>)}
              <input id="coa-reattach-analise" type="file" accept=".pdf,image/*" style={{ display:"none" }} onChange={async e=>{ const file=e.target.files[0]; if(!file) return; toast_("Enviando COA...","blue"); try { const isPdf=file.type==="application/pdf"||file.name.toLowerCase().endsWith(".pdf"); const r=isPdf?await uploadPdfToSupabase(file):await uploadToCloudinary(file); await saveCollection("cq_analises", String(selAnalise.id), {...selAnalise, coa:r}); setSelAnalise({...selAnalise, coa:r}); toast_("COA atualizado!","green"); } catch { toast_("Erro ao enviar COA.","red"); } }} />
            </div>
            {selAnalise.obs && <div style={{ marginBottom:"1rem", padding:"10px 14px", background:T.surf, borderRadius:8, fontSize:12, color:T.text2 }}><b>Obs:</b> {selAnalise.obs}</div>}
            {selAnalise.historicoEdicoes?.length > 0 && (
              <div style={{ marginBottom:"1rem", padding:"10px 14px", background:T.surf, border:`1px solid ${T.border}`, borderRadius:8 }}>
                <div style={{ fontSize:10, color:T.accent, fontWeight:700, textTransform:"uppercase", marginBottom:6 }}>Histórico de edições</div>
                {selAnalise.historicoEdicoes.map((h,i) => (
                  <div key={i} style={{ fontSize:11, color:T.text2, padding:"3px 0", borderBottom:i<selAnalise.historicoEdicoes.length-1?`1px solid ${T.border}`:"none" }}>
                    ✏️ {h.dataHora} — editado por <strong>{h.editor}</strong>
                  </div>
                ))}
              </div>
            )}
            <div style={{ padding:"12px 16px", borderRadius:10, fontSize:14, fontWeight:700, textAlign:"center", background:selAnalise.conclusao==="Aprovado"?"#2ab84a18":"#ff4f6a18", color:selAnalise.conclusao==="Aprovado"?"#2ab84a":"#ff4f6a" }}>
              {selAnalise.conclusao==="Aprovado"?"✅ APROVADO":"❌ REPROVADO"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── IPC — CONTROLE DE PROCESSO ────────────────────────────────────────────── */
function IPCTab({ user, toast_ }) {
  const T = useTheme(); const s = useS();
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("lista"); // lista | novo | detalhe
  const [sel, setSel] = useState(null);

  const AREAS = [
    {
      id: "po-encapsulamento",
      label: "Mistura Pó — Encapsulamento",
      icon: "🟤",
      salas: ["Mistura 1", "Mistura 2"],
      ensaios: [
        { id: "dens_ap",   label: "Densidade Aparente",    unidade: "g/mL" },
        { id: "dens_comp", label: "Densidade Compactada",  unidade: "g/mL" },
      ]
    },
    {
      id: "po-solavel",
      label: "Mistura Pó — Solúvel",
      icon: "🟡",
      salas: ["Mistura 1", "Mistura 2"],
      ensaios: [
        { id: "dens_ap",   label: "Densidade Aparente",    unidade: "g/mL" },
        { id: "dens_comp", label: "Densidade Compactada",  unidade: "g/mL" },
        { id: "sensorial", label: "Análise Sensorial",     unidade: "" },
      ]
    },
    {
      id: "liquido",
      label: "Mistura Líquido",
      icon: "🔵",
      salas: [],
      ensaios: [
        { id: "densidade",    label: "Densidade",      unidade: "g/mL" },
        { id: "sensorial",    label: "Análise Sensorial", unidade: "" },
        { id: "peso_liquido", label: "Peso Líquido",   unidade: "g" },
      ]
    },
  ];

  const [form, setForm] = useState({ area: "", sala: "", op: "", lote: "", produto: "", linha: "", resp: "", data: "", obs: "" });
  const [resultados, setResultados] = useState([]);
  const [filtroArea, setFiltroArea] = useState("todas");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroLinha, setFiltroLinha] = useState("todas");
  const [busca, setBusca] = useState("");
  const [produtos, setProdutos] = useState([]);
  const [showCadastroProd, setShowCadastroProd] = useState(false);
  const [formProd, setFormProd] = useState({ nome: "", linha: "", forma: "" });

  const LINHAS = [...new Set(produtos.map(p => p.linha).filter(Boolean))];
  const isAdmin = user?.role === "admin";

  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 3000);
    const unsub = subscribeCollection("ipc_registros", list => {
      clearTimeout(t);
      setRegistros(list.sort((a, b) => (b.criadoTs || 0) - (a.criadoTs || 0)));
      setLoading(false);
    });
    const unsubProd = subscribeCollection("ipc_produtos", list => {
      setProdutos(list.sort((a, b) => (a.nome||"").localeCompare(b.nome||"")));
    });
    return () => { clearTimeout(t); unsub && unsub(); unsubProd && unsubProd(); };
  }, []);

  const salvarProduto = async () => {
    try {
    if (!formProd.nome) { alert("Informe o nome do produto."); return; }
    if (!formProd.linha || formProd.linha === "__outro__") { alert("Informe a linha."); return; }
    const id = Date.now();
    await saveCollection("ipc_produtos", String(id), { id, ...formProd, criadoEm: tod() });
    setFormProd({ nome: "", linha: "", forma: "" });
    toast_("Produto cadastrado!", "green");
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const deletarProduto = async (id) => {
    try {
    if (!confirm("Excluir este produto?")) return;
    await deleteFromCollection("ipc_produtos", String(id));
    toast_("Produto excluído.", "red");
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const areaAtual = AREAS.find(a => a.id === form.area);

  const initResultados = (areaId) => {
    const area = AREAS.find(a => a.id === areaId);
    if (!area) return;
    setResultados(area.ensaios.map(e => ({ ...e, resultado: "", conforme: null, obs: "" })));
  };

  const setRes = (idx, k, v) => {
    setResultados(p => p.map((r, i) => i === idx ? { ...r, [k]: v } : r));
  };

  const calcStatus = () => {
    if (resultados.some(r => r.conforme === false)) return "Reprovado";
    if (resultados.every(r => r.resultado !== "")) return "Liberado";
    return "Pendente";
  };

  const salvar = async () => {
    try {
    if (!form.area) { alert("Selecione a área."); return; }
    if (!form.op)   { alert("Informe a OP."); return; }
    if (!form.produto) { alert("Informe o produto."); return; }
    const status = calcStatus();
    const reg = {
      id: sel ? sel.id : Date.now(),
      ...form,
      resultados,
      status,
      criadoPor: user.name,
      criadoEm: tod(),
      criadoTs: sel ? sel.criadoTs : Date.now(),
      atualizadoEm: tod(),
    };
    await saveCollection("ipc_registros", String(reg.id), reg);
    toast_(sel ? "Registro atualizado!" : "Registro salvo!", "green");
    setSel(null);
    setForm({ area: "", sala: "", op: "", lote: "", produto: "", resp: "", data: tod(), obs: "" });
    setResultados([]);
    setView("lista");
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const deletar = async (id) => {
    try {
    if (!confirm("Excluir este registro?")) return;
    await deleteFromCollection("ipc_registros", String(id));
    setSel(null); setView("lista");
    toast_("Registro excluído.", "red");
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const editar = (r) => {
    setSel(r);
    setForm({ area: r.area, sala: r.sala || "", op: r.op, produto: r.produto, resp: r.resp || "", data: r.data || tod(), obs: r.obs || "" });
    setResultados(r.resultados || []);
    setView("novo");
  };

  const statusColor = { "Liberado": T.accent, "Reprovado": T.red, "Pendente": T.yellow };
  const statusBg    = { "Liberado": T.accent+"18", "Reprovado": T.red+"18", "Pendente": T.yellow+"18" };
  const statusIcon  = { "Liberado": "✅", "Reprovado": "❌", "Pendente": "⏳" };

  const filtrados = registros
    .filter(r => filtroArea === "todas" || r.area === filtroArea)
    .filter(r => filtroStatus === "todos" || r.status === filtroStatus)
    .filter(r => filtroLinha === "todas" || r.linha === filtroLinha)
    .filter(r => !busca || r.op?.toLowerCase().includes(busca.toLowerCase()) || r.produto?.toLowerCase().includes(busca.toLowerCase()));

  const { paginated: filtradosPg, page: pgIPC, total: totIPC, setPage: setPgIPC } = usePagination(filtrados, 20);

  // ── FORM NOVO/EDITAR ──
  if (view === "novo") return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
        <button style={s.btn} onClick={() => { setView("lista"); setSel(null); setResultados([]); }}>← Voltar</button>
        <h2 style={{ fontSize:18, fontWeight:700, color:T.text, margin:0 }}>{sel ? "Editar Registro" : "Novo Registro IPC"}</h2>
      </div>

      <div style={s.card}>
        <SecTitle icon="🏭" ch="Identificação" />
        <G2 ch={<>
          <F lbl="Área *" ch={
            <Sel value={form.area} onChange={e => { setF("area", e.target.value); setF("sala", ""); initResultados(e.target.value); }}>
              <option value="">Selecione a área...</option>
              {AREAS.map(a => <option key={a.id} value={a.id}>{a.icon} {a.label}</option>)}
            </Sel>
          } />
          {areaAtual?.salas?.length > 0 && (
            <F lbl="Sala" ch={
              <Sel value={form.sala} onChange={e => setF("sala", e.target.value)}>
                <option value="">Selecione a sala...</option>
                {areaAtual.salas.map(s => <option key={s} value={s}>{s}</option>)}
              </Sel>
            } />
          )}
          <F lbl="OP *" ch={<Inp placeholder="Ex: OP-2025-001" value={form.op} onChange={e => setF("op", e.target.value)} />} />
          <F lbl="Lote" ch={<Inp placeholder="Ex: LOTE-2025-001" value={form.lote||""} onChange={e => setF("lote", e.target.value)} />} />
          <F lbl="Produto *" ch={
            <Sel value={form.produtoId||""} onChange={e => {
              const prod = produtos.find(p => String(p.id) === e.target.value);
              setF("produtoId", e.target.value);
              setF("produto", prod?.nome || "");
              setF("linha", prod?.linha || "");
            }}>
              <option value="">Selecione o produto...</option>
              {[...new Set(produtos.map(p=>p.linha))].map(linha => (
                <optgroup key={linha} label={`— ${linha} —`}>
                  {produtos.filter(p=>p.linha===linha).map(p => (
                    <option key={p.id} value={String(p.id)}>{p.nome}{p.forma?` (${p.forma})`:""}</option>
                  ))}
                </optgroup>
              ))}
            </Sel>
          } />
          {form.linha && <F lbl="Linha" ch={<div style={{ padding:"8px 10px", background:T.surf, borderRadius:8, fontSize:13, color:T.accent, fontWeight:600 }}>{form.linha}</div>} />}
          <F lbl="Responsável" ch={<Inp placeholder="Nome do operador" value={form.resp} onChange={e => setF("resp", e.target.value)} />} />
          <F lbl="Data" ch={<Inp type="date" value={form.data || tod()} onChange={e => setF("data", e.target.value)} />} />
        </>} />
        <F lbl="Observações" ch={<Inp placeholder="Observações gerais..." value={form.obs} onChange={e => setF("obs", e.target.value)} />} />
      </div>

      {resultados.length > 0 && (
        <div style={s.card}>
          <SecTitle icon="🔬" ch="Ensaios" />
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:T.surf }}>
                  {["Ensaio","Unidade","Resultado","Conforme?","Obs."].map(h=>(
                    <th key={h} style={{ padding:"8px 10px", fontSize:10, fontWeight:700, color:T.text3, textTransform:"uppercase", textAlign:"left", borderBottom:`1px solid ${T.border}`, whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resultados.map((r, i) => (
                  <tr key={r.id} style={{ background:i%2===0?T.card:T.surf, borderLeft: r.conforme===false?`3px solid ${T.red}`:r.conforme===true?`3px solid ${T.accent}`:"3px solid transparent" }}>
                    <td style={{ padding:"8px 10px", fontSize:12, fontWeight:600, color:T.text, whiteSpace:"nowrap" }}>{r.label}</td>
                    <td style={{ padding:"8px 10px", fontSize:11, color:T.text3 }}>{r.unidade||"—"}</td>
                    <td style={{ padding:"8px 8px" }}>
                      <Inp placeholder="Digite o resultado..." value={r.resultado} onChange={e => setRes(i, "resultado", e.target.value)} sx={{ fontSize:12, padding:"5px 8px" }} />
                    </td>
                    <td style={{ padding:"8px 8px" }}>
                      <div style={{ display:"flex", gap:4 }}>
                        <button onClick={()=>setRes(i,"conforme",true)} style={{ padding:"4px 8px", borderRadius:6, border:`1px solid ${r.conforme===true?T.accent+"55":T.border}`, background:r.conforme===true?T.accent+"22":"transparent", color:r.conforme===true?T.accent:T.text2, cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:600 }}>✓</button>
                        <button onClick={()=>setRes(i,"conforme",false)} style={{ padding:"4px 8px", borderRadius:6, border:`1px solid ${r.conforme===false?T.red+"55":T.border}`, background:r.conforme===false?T.red+"22":"transparent", color:r.conforme===false?T.red:T.text2, cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:600 }}>✗</button>
                        <button onClick={()=>setRes(i,"conforme",null)} style={{ padding:"4px 6px", borderRadius:6, border:`1px solid ${T.border}`, background:"transparent", color:T.text3, cursor:"pointer", fontFamily:"inherit", fontSize:10 }}>—</button>
                      </div>
                    </td>
                    <td style={{ padding:"8px 8px" }}>
                      <Inp placeholder="obs..." value={r.obs} onChange={e => setRes(i, "obs", e.target.value)} sx={{ fontSize:11, padding:"4px 6px", width:90 }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Indicador de progresso */}
          {resultados.length > 0 && (() => {
            const preenchidos = resultados.filter(r => r.resultado !== "").length;
            const total = resultados.length;
            const pct = Math.round((preenchidos/total)*100);
            return (
              <div style={{ marginTop:12, padding:"10px 14px", background:T.surf, borderRadius:10, border:`1px solid ${T.border}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                  <span style={{ fontSize:11, color:T.text2 }}>Progresso dos ensaios</span>
                  <span style={{ fontSize:11, fontWeight:700, color:pct===100?T.accent:T.text2 }}>{preenchidos}/{total} preenchidos</span>
                </div>
                <div style={{ height:6, background:T.border, borderRadius:10, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${pct}%`, background:pct===100?T.accent:T.yellow||"#f0c040", borderRadius:10, transition:"width 0.3s" }} />
                </div>
              </div>
            );
          })()}
          {resultados.some(r => r.resultado !== "") && (
            <div style={{ padding:"12px 16px", borderRadius:10, textAlign:"center", fontWeight:700, fontSize:15,
              background: statusBg[calcStatus()], color: statusColor[calcStatus()], border:`1px solid ${statusColor[calcStatus()]}33`, marginTop:8 }}>
              {statusIcon[calcStatus()]} {calcStatus() === "Liberado" ? "LIBERADO PARA PRÓXIMA ETAPA" : calcStatus() === "Reprovado" ? "REPROVADO — NÃO LIBERAR" : "ANÁLISE PENDENTE"}
            </div>
          )}
        </div>
      )}

      <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:4 }}>
        <button style={s.btn} onClick={() => { setView("lista"); setSel(null); setResultados([]); }}>Cancelar</button>
        <button style={s.btnA} onClick={salvar}>Salvar registro ✓</button>
      </div>
    </div>
  );

  // ── DETALHE ──
  if (view === "detalhe" && sel) {
    const area = AREAS.find(a => a.id === sel.area);
    return (
      <div>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
          <button style={s.btn} onClick={() => { setView("lista"); setSel(null); }}>← Voltar</button>
          <h2 style={{ fontSize:18, fontWeight:700, color:T.text, margin:0 }}>OP: {sel.op}{sel.lote && <span style={{ fontSize:13, color:T.text2, fontWeight:400, marginLeft:10 }}>Lote: {sel.lote}</span>}</h2>
          <span style={{ padding:"3px 12px", borderRadius:20, fontSize:11, fontWeight:700, background:statusBg[sel.status], color:statusColor[sel.status] }}>{statusIcon[sel.status]} {sel.status}</span>
        </div>
        <div style={s.card}>
          <SecTitle icon="🏭" ch="Identificação" />
          <G3 ch={<>
            <F lbl="Área" ch={<div style={{ padding:"8px 10px", background:T.surf, borderRadius:8, fontSize:13 }}>{area?.icon} {area?.label}</div>} />
            {sel.sala && <F lbl="Sala" ch={<div style={{ padding:"8px 10px", background:T.surf, borderRadius:8, fontSize:13 }}>{sel.sala}</div>} />}
            <F lbl="Produto" ch={<div style={{ padding:"8px 10px", background:T.surf, borderRadius:8, fontSize:13 }}>{sel.produto}</div>} />
            <F lbl="Data" ch={<div style={{ padding:"8px 10px", background:T.surf, borderRadius:8, fontSize:13 }}>{fmt(sel.data)}</div>} />
            <F lbl="Responsável" ch={<div style={{ padding:"8px 10px", background:T.surf, borderRadius:8, fontSize:13 }}>{sel.resp || "—"}</div>} />
            <F lbl="Criado por" ch={<div style={{ padding:"8px 10px", background:T.surf, borderRadius:8, fontSize:13 }}>{sel.criadoPor}</div>} />
          </>} />
          {sel.obs && <F lbl="Observações" ch={<div style={{ padding:"8px 10px", background:T.surf, borderRadius:8, fontSize:13, color:T.text2 }}>{sel.obs}</div>} />}
        </div>
        <div style={s.card}>
          <SecTitle icon="🔬" ch="Resultados dos Ensaios" />
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
            <thead>
              <tr style={{ background:T.surf }}>
                {["Ensaio","Unidade","Resultado","Situação","Obs."].map(h => (
                  <th key={h} style={{ padding:"8px 10px", textAlign:"left", fontSize:10, fontWeight:700, color:T.text3, textTransform:"uppercase", borderBottom:`1px solid ${T.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(sel.resultados||[]).map((r, i) => (
                <tr key={i} style={{ borderLeft: r.conforme===false ? `3px solid ${T.red}` : r.conforme===true ? `3px solid ${T.accent}` : `3px solid transparent`, background: i%2===0 ? T.card : T.surf }}>
                  <td style={{ padding:"8px 10px", fontWeight:600 }}>{r.label}</td>
                  <td style={{ padding:"8px 10px", color:T.text3 }}>{r.unidade||"—"}</td>
                  <td style={{ padding:"8px 10px" }}>{r.resultado||"—"}</td>
                  <td style={{ padding:"8px 10px" }}>
                    {r.conforme===true ? <span style={{ color:T.accent, fontWeight:700 }}>✓ Conforme</span>
                     : r.conforme===false ? <span style={{ color:T.red, fontWeight:700 }}>✗ N.C.</span>
                     : <span style={{ color:T.text3 }}>—</span>}
                  </td>
                  <td style={{ padding:"8px 10px", color:T.text2 }}>{r.obs||"—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding:"12px 16px", borderRadius:10, textAlign:"center", fontWeight:700, fontSize:15,
            background:statusBg[sel.status], color:statusColor[sel.status], border:`1px solid ${statusColor[sel.status]}33`, marginTop:12 }}>
            {statusIcon[sel.status]} {sel.status === "Liberado" ? "LIBERADO PARA PRÓXIMA ETAPA" : sel.status === "Reprovado" ? "REPROVADO — NÃO LIBERAR" : "ANÁLISE PENDENTE"}
          </div>
        </div>
        <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
          <button style={{ ...s.btnD, fontSize:12 }} onClick={() => deletar(sel.id)}><span className="btn-emoji">🗑️ </span>Excluir</button>
          <button style={{ ...s.btn, fontSize:12 }} onClick={() => editar(sel)}><span className="btn-emoji">✏️ </span>Editar</button>
        </div>
      </div>
    );
  }

  // ── LISTA ──
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, flexWrap:"wrap", gap:10 }}>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
          {/* Barra de busca */}
          <div style={{ position:"relative" }}>
            <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:T.text3, fontSize:13 }}>🔍</span>
            <input placeholder="Buscar OP ou produto..." value={busca} onChange={e => setBusca(e.target.value)}
              style={{ ...s.inp, paddingLeft:30, width:200, fontSize:12 }} />
          </div>
          <Sel value={filtroLinha} onChange={e => setFiltroLinha(e.target.value)}>
            <option value="todas">Todas as linhas</option>
            {LINHAS.map(l => <option key={l} value={l}>{l}</option>)}
          </Sel>
          <Sel value={filtroArea} onChange={e => setFiltroArea(e.target.value)}>
            <option value="todas">Todas as áreas</option>
            {AREAS.map(a => <option key={a.id} value={a.id}>{a.icon} {a.label}</option>)}
          </Sel>
          <Sel value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
            <option value="todos">Todos os status</option>
            <option value="Liberado">✅ Liberado</option>
            <option value="Reprovado">❌ Reprovado</option>
            <option value="Pendente">⏳ Pendente</option>
          </Sel>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button style={s.btnA} onClick={() => { setSel(null); setForm({ area:"", sala:"", op:"", produto:"", linha:"", resp:"", data:tod(), obs:"" }); setResultados([]); setView("novo"); }}>
            + Novo Registro IPC
          </button>
        </div>
      </div>

      {/* Painel de cadastro de produtos (admin) */}
      {showCadastroProd && isAdmin && (
        <div style={{ ...s.card, marginBottom:16 }}>
          <SecTitle icon="📦" ch="Cadastro de Produtos" />
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:12 }}>
            <Inp placeholder="Nome do produto *" value={formProd.nome} onChange={e => setFormProd(p=>({...p,nome:e.target.value}))} style={{ flex:2, minWidth:160 }} />
            <Inp placeholder="Linha (ex: Supra, Verde, Especial) *" value={formProd.linha} onChange={e => setFormProd(p=>({...p,linha:e.target.value}))} style={{ flex:1, minWidth:130 }} />
            <Inp placeholder="Forma (ex: Cápsula, Comprimido)" value={formProd.forma} onChange={e => setFormProd(p=>({...p,forma:e.target.value}))} style={{ flex:1, minWidth:130 }} />
            <button style={s.btnA} onClick={salvarProduto}>+ Adicionar</button>
          </div>
          {produtos.length > 0 && (
            <div style={{ maxHeight:200, overflowY:"auto" }}>
              {produtos.map(p => (
                <div key={p.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 10px", background:T.surf, borderRadius:8, marginBottom:4 }}>
                  <div style={{ flex:1, fontSize:12, color:T.text, fontWeight:600 }}>{p.nome}</div>
                  <span style={{ fontSize:11, padding:"2px 8px", borderRadius:12, background:T.accentDim, color:T.accent }}>{p.linha}</span>
                  {p.forma && <span style={{ fontSize:11, color:T.text2 }}>{p.forma}</span>}
                  <button onClick={() => deletarProduto(p.id)} style={{ ...s.btnD, fontSize:10, padding:"2px 8px" }}>🗑️</button>
                </div>
              ))}
            </div>
          )}
          {produtos.length === 0 && <div style={{ fontSize:12, color:T.text3, textAlign:"center", padding:"1rem" }}>Nenhum produto cadastrado ainda.</div>}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign:"center", padding:"3rem", color:T.text2 }}>Carregando...</div>
      ) : filtrados.length === 0 ? (
        <div style={{ textAlign:"center", padding:"3rem", color:T.text3 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🏭</div>
          <div style={{ fontSize:14 }}>Nenhum registro encontrado.</div>
          <div style={{ fontSize:12, marginTop:6 }}>Crie o primeiro registro de controle de processo!</div>
        </div>
      ) : (
        filtradosPg.map(r => {
          const area = AREAS.find(a => a.id === r.area);
          return (
            <div key={r.id} className="rnc-row" onClick={() => { setSel(r); setView("detalhe"); }}
              style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"12px 16px", marginBottom:8, cursor:"pointer", display:"flex", alignItems:"center", gap:12, flexWrap:"wrap", borderLeft:`3px solid ${statusColor[r.status]||T.border}` }}>
              <div style={{ fontSize:22 }}>{area?.icon||"🏭"}</div>
              <div style={{ flex:1, minWidth:150 }}>
                <div style={{ fontSize:13, fontWeight:700, color:T.text }}>OP: {r.op} — {r.produto}</div>
                <div style={{ fontSize:11, color:T.text2, marginTop:2 }}>{area?.label}{r.sala ? ` · ${r.sala}` : ""}{r.linha ? ` · ${r.linha}` : ""} · {fmt(r.data)}{r.resp ? ` · ${r.resp}` : ""}</div>
              </div>
              <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
                {(r.resultados||[]).map((res, i) => (
                  <span key={i} style={{ fontSize:10, padding:"2px 8px", borderRadius:20, background: res.conforme===true ? T.accent+"18" : res.conforme===false ? T.red+"18" : T.border, color: res.conforme===true ? T.accent : res.conforme===false ? T.red : T.text3 }}>
                    {res.label}: {res.resultado||"—"}
                  </span>
                ))}
              </div>
              <span style={{ padding:"4px 12px", borderRadius:20, fontSize:11, fontWeight:700, background:statusBg[r.status], color:statusColor[r.status], flexShrink:0 }}>
                {statusIcon[r.status]} {r.status}
              </span>
            </div>
          );
        })
      )}
      <Pagination page={pgIPC} total={totIPC} setPage={setPgIPC} />
    </div>
  );
}



/* ─── IPC PRODUTOS TAB ───────────────────────────────────────────────────────── */
function IPCProdutosTab({ user, toast_ }) {
  const T = useTheme(); const s = useS();
  const [produtos, setProdutos] = useState([]);
  const [formProd, setFormProd] = useState({ nome: "", linha: "", forma: "" });
  const [busca, setBusca] = useState("");
  const [filtroLinha, setFiltroLinha] = useState("todas");
  const isAdmin = user?.role === "admin" || user?.role === "keyuser";

  useEffect(() => {
    const unsub = subscribeCollection("ipc_produtos", list => {
      setProdutos(list.sort((a, b) => (a.linha||"").localeCompare(b.linha||"") || (a.nome||"").localeCompare(b.nome||"")));
    });
    return unsub;
  }, []);

  const salvarProduto = async () => {
    try {
    if (!formProd.nome) { alert("Informe o nome do produto."); return; }
    if (!formProd.linha) { alert("Informe a linha."); return; }
    const id = Date.now();
    await saveCollection("ipc_produtos", String(id), { id, ...formProd, criadoEm: tod() });
    setFormProd({ nome: "", linha: "", forma: "" });
    toast_("Produto cadastrado!", "green");
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const deletarProduto = async (id) => {
    try {
    if (!confirm("Excluir este produto?")) return;
    await deleteFromCollection("ipc_produtos", String(id));
    toast_("Produto excluído.", "red");
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const LINHAS = [...new Set(produtos.map(p => p.linha).filter(Boolean))];

  const filtrados = produtos
    .filter(p => filtroLinha === "todas" || p.linha === filtroLinha)
    .filter(p => !busca || p.nome?.toLowerCase().includes(busca.toLowerCase()) || p.linha?.toLowerCase().includes(busca.toLowerCase()));
  const {paginated:filtradosPg, page:pgIPC, total:totIPC, setPage:setPgIPC} = usePagination(filtrados, 20);

  return (
    <div>
      {/* Filtros */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16, alignItems:"center" }}>
        <div style={{ position:"relative" }}>
          <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:T.text3, fontSize:13 }}>🔍</span>
          <input placeholder="Buscar produto..." value={busca} onChange={e => setBusca(e.target.value)}
            style={{ ...s.inp, paddingLeft:30, width:200, fontSize:12 }} />
        </div>
        <Sel value={filtroLinha} onChange={e => setFiltroLinha(e.target.value)}>
          <option value="todas">Todas as linhas</option>
          {LINHAS.map(l => <option key={l} value={l}>{l}</option>)}
        </Sel>
        <div style={{ marginLeft:"auto", fontSize:12, color:T.text2 }}>{filtrados.length} produto(s)</div>
      </div>

      {/* Form cadastro — admin/keyuser */}
      {isAdmin && (
        <div style={s.card}>
          <SecTitle icon="➕" ch="Novo Produto" />
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <F lbl="Nome *" ch={<Inp placeholder="Ex: Vitamina B12" value={formProd.nome} onChange={e => setFormProd(p=>({...p,nome:e.target.value}))} />} />
            <F lbl="Linha *" ch={<>
              <Sel value={formProd.linha.startsWith("__outro__") ? "__outro__" : formProd.linha} onChange={e => setFormProd(p=>({...p, linha: e.target.value === "__outro__" ? "__outro__" : e.target.value}))}>
                <option value="">Selecione a linha...</option>
                {["Supra","Verde","Beauty","Especial","Terceiros"].map(l=><option key={l} value={l}>{l}</option>)}
                <option value="__outro__">Outros...</option>
              </Sel>
              {formProd.linha === "__outro__" && <Inp placeholder="Digite o nome da linha..." style={{marginTop:6}} onChange={e => setFormProd(p=>({...p, linha: e.target.value || "__outro__"}))} />}
            </>} />
            <F lbl="Forma farmacêutica" ch={<>
              <Sel value={formProd.forma.startsWith("__outro__") ? "__outro__" : formProd.forma} onChange={e => setFormProd(p=>({...p, forma: e.target.value === "__outro__" ? "__outro__" : e.target.value}))}>
                <option value="">Selecione a forma...</option>
                {["Cápsula","Comprimido Mastigável","Líquido","Sachê","Lata","Potes"].map(f=><option key={f} value={f}>{f}</option>)}
                <option value="__outro__">Outros...</option>
              </Sel>
              {formProd.forma === "__outro__" && <Inp placeholder="Digite a forma farmacêutica..." style={{marginTop:6}} onChange={e => setFormProd(p=>({...p, forma: e.target.value || "__outro__"}))} />}
            </>} />
          </div>
          <div style={{ display:"flex", justifyContent:"flex-end", marginTop:8 }}>
            <button style={s.btnA} onClick={salvarProduto}><span className="btn-emoji">+ </span>Cadastrar Produto</button>
          </div>
        </div>
      )}

      {/* Lista de produtos agrupada por linha */}
      {filtrados.length === 0 ? (
        <div style={{ textAlign:"center", padding:"3rem", color:T.text3 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>📦</div>
          <div style={{ fontSize:14 }}>Nenhum produto cadastrado ainda.</div>
          {isAdmin && <div style={{ fontSize:12, marginTop:6 }}>Cadastre os produtos acima para padronizar os lançamentos.</div>}
        </div>
      ) : (
        [...new Set(filtradosPg.map(p=>p.linha))].map(linha => {
          const prods = filtradosPg.filter(p => p.linha === linha);
          if (prods.length === 0) return null;
          return (
            <div key={linha} style={{ marginBottom:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:T.accent, textTransform:"uppercase", letterSpacing:2, marginBottom:8, padding:"4px 0", borderBottom:`1px solid ${T.border}` }}>
                📦 Linha {linha}
              </div>
              {prods.map(p => (
                <div key={p.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:T.card, border:`1px solid ${T.border}`, borderRadius:8, marginBottom:6 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{p.nome}</div>
                    {p.forma && <div style={{ fontSize:11, color:T.text2, marginTop:2 }}>{p.forma}</div>}
                  </div>
                  <span style={{ fontSize:11, padding:"3px 10px", borderRadius:12, background:T.accentDim, color:T.accent, fontWeight:600 }}>{p.linha}</span>
                  {isAdmin && (
                    <button onClick={() => deletarProduto(p.id)} style={{ ...s.btnD, fontSize:11, padding:"4px 10px" }}>🗑️</button>
                  )}
                </div>
              ))}
            </div>
          );
        })
      )}
      <Pagination page={pgIPC} total={totIPC} setPage={setPgIPC}/>
    </div>
  );
}

function ClientesTab({ user, toast_ }) {
  const T = useTheme(); const s = useS();
  const [clientes, setClientes] = useState([]);
  const [form, setForm] = useState({ nome:"", cnpj:"", contato:"", email:"", tel:"", cep:"", endereco:"", obs:"" });
  const [sel, setSel] = useState(null);
  const [busca, setBusca] = useState("");
  const isAdmin = user?.role === "admin" || user?.role === "keyuser";
  const setF = (k,v) => setForm(p=>({...p,[k]:v}));

  useEffect(() => {
    const unsub = subscribeCollection("clientes_terceiros", list => {
      setClientes(list.sort((a,b)=>(a.nome||"").localeCompare(b.nome||"")));
    });
    return unsub;
  }, []);

  const salvar = async () => {
    try {
    if (!form.nome) { alert("Informe o nome do cliente."); return; }
    const id = sel ? sel.id : Date.now();
    await saveCollection("clientes_terceiros", String(id), { id, ...form, atualizadoEm: tod() });
    toast_(sel ? "Cliente atualizado!" : "Cliente cadastrado!", "green");
    setForm({ nome:"", cnpj:"", contato:"", email:"", tel:"", cep:"", endereco:"", obs:"" });
    setSel(null);
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const deletar = async (id) => {
    try {
    if (!confirm("Excluir este cliente?")) return;
    await deleteFromCollection("clientes_terceiros", String(id));
    toast_("Cliente excluído.", "red");
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const editar = (c) => { setSel(c); setForm({ nome:c.nome||"", cnpj:c.cnpj||"", contato:c.contato||"", email:c.email||"", tel:c.tel||"", cep:c.cep||"", endereco:c.endereco||"", obs:c.obs||"" }); };

  const filtrados = clientes.filter(c => !busca || c.nome?.toLowerCase().includes(busca.toLowerCase()) || c.cnpj?.includes(busca));
  const {paginated:_cls,page:_pgC,total:_totC,setPage:_setPgC} = usePagination(filtrados, 20);

  return (
    <div>
      {isAdmin && (
        <div style={s.card}>
          <SecTitle icon="🏢" ch={sel ? "Editar Cliente" : "Novo Cliente"} />
          <G2 ch={<>
            <F lbl="Nome da empresa *" ch={<Inp placeholder="Ex: Suplementos XYZ Ltda" value={form.nome} onChange={e=>setF("nome",e.target.value)} />} />
            <F lbl="CNPJ" ch={<MaskedInp mask="cnpj" placeholder="00.000.000/0001-00" value={form.cnpj} onChange={e=>setF("cnpj",e.target.value)} />} />
            <F lbl="Contato" ch={<Inp placeholder="Nome do responsável" value={form.contato} onChange={e=>setF("contato",e.target.value)} />} />
            <F lbl="E-mail" ch={<Inp placeholder="contato@empresa.com.br" value={form.email} onChange={e=>setF("email",e.target.value)} />} />
            <F lbl="Telefone" ch={<MaskedInp mask="telefone" placeholder="(00) 00000-0000" value={form.tel} onChange={e=>setF("tel",e.target.value)} />} />
            <F lbl="CEP" ch={<MaskedInp mask="cep" placeholder="00000-000" value={form.cep} onChange={e=>setF("cep",e.target.value)} />} />
            <F lbl="Endereço" ch={<Inp placeholder="Rua, número, bairro, cidade" value={form.endereco} onChange={e=>setF("endereco",e.target.value)} />} />
            <F lbl="Observações" ch={<Inp placeholder="Obs..." value={form.obs} onChange={e=>setF("obs",e.target.value)} />} />
          </>} />
          <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:8 }}>
            {sel && <button style={s.btn} onClick={()=>{setSel(null);setForm({nome:"",cnpj:"",contato:"",email:"",tel:"",cep:"",endereco:"",obs:""});}}>Cancelar</button>}
            <button style={s.btnA} onClick={salvar}>{sel ? "Salvar alterações" : "+ Cadastrar Cliente"}</button>
          </div>
        </div>
      )}

      <div style={{ display:"flex", gap:8, marginBottom:12, alignItems:"center" }}>
        <div style={{ position:"relative", flex:1 }}>
          <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:T.text3, fontSize:13 }}>🔍</span>
          <input placeholder="Buscar cliente..." value={busca} onChange={e=>setBusca(e.target.value)} style={{ ...s.inp, paddingLeft:30, fontSize:12 }} />
        </div>
        <div style={{ fontSize:12, color:T.text2 }}>{filtrados.length} cliente(s)</div>
      </div>

      {filtrados.length === 0 ? (
        <div style={{ textAlign:"center", padding:"3rem", color:T.text3 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🏢</div>
          <div style={{ fontSize:14 }}>Nenhum cliente cadastrado.</div>
        </div>
      ) : (<>
      {_cls.map(c => (
        <div key={c.id} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"12px 16px", marginBottom:8, display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:40, height:40, borderRadius:"50%", background:T.accentDim, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:700, color:T.accent, flexShrink:0 }}>{c.nome?.[0]||"?"}</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:700, color:T.text }}>{c.nome}</div>
            <div style={{ fontSize:11, color:T.text2, marginTop:2 }}>{c.cnpj && `CNPJ: ${c.cnpj}`}{c.contato && ` · ${c.contato}`}{c.email && ` · ${c.email}`}</div>
          </div>
          {isAdmin && (
            <div style={{ display:"flex", gap:6 }}>
              <button onClick={()=>editar(c)} style={{ ...s.btn, fontSize:11, padding:"4px 10px" }}>✏️</button>
              <button onClick={()=>deletar(c.id)} style={{ ...s.btnD, fontSize:11, padding:"4px 10px" }}>🗑️</button>
            </div>
          )}
        </div>
      ))}
      <Pagination page={_pgC} total={_totC} setPage={_setPgC}/>
      </>
      )}
    </div>
  );
}

/* ─── LAUDOS ANALÍTICOS TAB ──────────────────────────────────────────────────── */
const LOGO_HERBAMED = "https://res.cloudinary.com/dswsg9w0w/image/upload/484237672_1316151256653106_1151541448837719199_n1_zww2li";
const HERBAMED_INFO = {
  nome: "Herbamed Laboratório Nutracêutico LTDA",
  cnpj: "14.829.598/0001-30",
  endereco: "Av Irene Meneghetti Longhini, 500, Água do Ayero",
  cidade: "Assis/SP - Brasil",
  cep: "19816-370",
};

function LaudosTab({ user, toast_, users }) {
  const T = useTheme(); const s = useS();
  const [laudos, setLaudos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [analises, setAnalises] = useState([]);
  const [ipcRegs, setIpcRegs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("lista");
  const [sel, setSel] = useState(null);

  const [form, setForm] = useState({ tipo:"produto_acabado", clienteId:"", produto:"", linha:"", lote:"", op:"", data:tod(), obs:"", armazenamento:`• Armazenar em local seco e fresco com temperatura de 15 a 30°C e umidade relativa de 30% a 80%.
• Armazenar o produto sobre palete ou paleteira, deixando espaço lateral de 15 cm em cada extremidade. Observar a altura máxima de empilhamento.`, ensaios:[] });
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [busca, setBusca] = useState("");

  const isRT = user?.role === "rt" || user?.role === "admin";
  const rtUsers = users?.filter(u => u.role === "rt") || [];

  const TIPOS = [
    { id:"produto_acabado", label:"Produto Acabado" },
    { id:"materia_prima",   label:"Matéria-Prima" },
    { id:"processo",        label:"Processo (IPC)" },
  ];

  // Capturar prefill vindo do CQ Análises
  useEffect(() => {
    if (window._laudoPreFill) {
      const pf = window._laudoPreFill;
      setForm(f => ({ ...f, ...pf }));
      setView("novo");
      delete window._laudoPreFill;
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 3000);
    const u1 = subscribeCollection("laudos", list => { clearTimeout(t); setLaudos(list.sort((a,b)=>(b.criadoTs||0)-(a.criadoTs||0))); setLoading(false); });
    const u2 = subscribeCollection("clientes_terceiros", list => setClientes(list.sort((a,b)=>(a.nome||"").localeCompare(b.nome||""))));
    const u3 = subscribeCollection("cq_analises", list => setAnalises(list));
    const u4 = subscribeCollection("ipc_registros", list => setIpcRegs(list));
    return () => { clearTimeout(t); u1&&u1(); u2&&u2(); u3&&u3(); u4&&u4(); };
  }, []);

  const setF = (k,v) => setForm(p=>({...p,[k]:v}));

  const clienteSel = clientes.find(c=>String(c.id)===String(form.clienteId));

  const importarEnsaios = () => {
    if (form.tipo === "processo") {
      const reg = ipcRegs.find(r => r.op === form.op || r.produto === form.produto);
      if (reg?.resultados?.length) {
        setF("ensaios", reg.resultados.map(r=>({ label:r.label, unidade:r.unidade||"", especificacao:"", resultado:r.resultado||"", conforme:r.conforme, obs:r.obs||"" })));
        toast_("Ensaios importados do IPC!", "green");
      } else toast_("Nenhum registro IPC encontrado para essa OP/produto.", "red");
    } else {
      const analise = analises.find(a => a.lote === form.lote || a.op === form.op);
      if (analise?.resultados?.length) {
        setF("ensaios", analise.resultados.map(r=>({ label:r.ensaio||r.label||"", unidade:r.unidade||"", especificacao:r.especificacao||"", resultado:r.resultado||"", conforme:r.conforme, obs:r.obs||"" })));
        toast_("Ensaios importados do CQ!", "green");
      } else toast_("Nenhuma análise CQ encontrada para esse lote/OP.", "red");
    }
  };

  const addEnsaio = () => setF("ensaios", [...(form.ensaios||[]), { label:"", unidade:"", especificacao:"", resultado:"", conforme:null, obs:"" }]);
  const setEnsaio = (i,k,v) => setF("ensaios", form.ensaios.map((e,idx)=>idx===i?{...e,[k]:v}:e));
  const delEnsaio = (i) => setF("ensaios", form.ensaios.filter((_,idx)=>idx!==i));

  const calcStatus = (ensaios) => {
    if (!ensaios?.length) return "Rascunho";
    if (ensaios.some(e=>e.conforme===false)) return "Reprovado";
    if (ensaios.every(e=>e.resultado)) return "Aprovado";
    return "Rascunho";
  };

  const salvar = async () => {
    try {
    if (!form.clienteId) { alert("Selecione o cliente."); return; }
    if (!form.produto) { alert("Informe o produto."); return; }
    const status = calcStatus(form.ensaios);
    // Gerar número sequencial LA-AAAA-NNN
    // Número sequencial: LA-AAAA-NNN baseado na contagem de laudos
    const ano = new Date().getFullYear();
    const numLaudo = sel ? sel.numLaudo : `LA-${ano}-${String(laudos.filter(l=>l.numLaudo?.startsWith(`LA-${ano}`)).length + 1).padStart(3,"0")}`;
    const id = sel ? sel.id : Date.now();
    const laudo = { id, numLaudo, ...form, status, assinaturaAnalista:null, assinaturaRT:null, criadoPor:user.name, criadoEm:tod(), criadoTs:sel?sel.criadoTs:Date.now(), atualizadoEm:tod() };
    await saveCollection("laudos", String(id), laudo);
    toast_(sel?"Laudo atualizado!":"Laudo criado!", "green");
    setView("lista"); setSel(null);
    setForm({ tipo:"produto_acabado", clienteId:"", produto:"", linha:"", lote:"", op:"", data:tod(), obs:"", armazenamento:`• Armazenar em local seco e fresco com temperatura de 15 a 30°C e umidade relativa de 30% a 80%.
• Armazenar o produto sobre palete ou paleteira, deixando espaço lateral de 15 cm em cada extremidade. Observar a altura máxima de empilhamento.`, ensaios:[] });
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const assinarAnalista = async (laudo) => {
    try {
    if (!user.assinatura) { toast_("Cadastre sua assinatura no perfil primeiro.", "red"); return; }
    await saveCollection("laudos", String(laudo.id), { ...laudo, assinaturaAnalista:{ nome:user.name, cargo:user.role==="rt"?"Responsável Técnico":"Analista de CQ", img:user.assinatura, dataHora:`${tod()} ${new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}` }});
    toast_("Laudo assinado!", "green");
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const assinarRT = async (laudo) => {
    try {
    if (!user.assinatura) { toast_("Cadastre sua assinatura no perfil primeiro.", "red"); return; }
    const novoStatus = calcStatus(laudo.ensaios) === "Aprovado" ? "Finalizado" : calcStatus(laudo.ensaios);
    await saveCollection("laudos", String(laudo.id), { ...laudo, status: novoStatus, assinaturaRT:{ nome:user.name, cargo:"Responsável Técnico", crf:user.crf||"", img:user.assinatura, dataHora:`${tod()} ${new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}` }});
    toast_("Laudo assinado como RT!", "green");
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const deletar = async (id) => {
    try {
    if (!confirm("Excluir este laudo?")) return;
    await deleteFromCollection("laudos", String(id));
    setView("lista"); setSel(null);
    toast_("Laudo excluído.", "red");
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const exportPDF = (laudo) => {
    const cliente = clientes.find(c=>String(c.id)===String(laudo.clienteId));
    const tipo = TIPOS.find(t=>t.id===laudo.tipo)?.label||laudo.tipo;
    const statusColor = laudo.status==="Aprovado"||laudo.status==="Finalizado" ? "#3b6d11" : laudo.status==="Reprovado" ? "#b71c1c" : "#666";
    const statusBg = laudo.status==="Aprovado"||laudo.status==="Finalizado" ? "#eaf3de" : laudo.status==="Reprovado" ? "#ffebee" : "#f5f5f5";
    const statusTxt = laudo.status==="Aprovado"||laudo.status==="Finalizado" ? "APROVADO — Produto em conformidade com as especificações" : laudo.status==="Reprovado" ? "REPROVADO — Um ou mais ensaios fora das especificações" : "RASCUNHO — Laudo em elaboração";

    const ensaiosHTML = (laudo.ensaios||[]).map((e,i)=>`
      <tr style="background:${i%2===0?"#fff":"#f9f9f9"}">
        <td style="padding:7px 10px;font-weight:600">${e.label||"—"}</td>
        <td style="padding:7px 10px;color:#666">${e.unidade||"—"}</td>
        <td style="padding:7px 10px;color:#666">${e.especificacao||"—"}</td>
        <td style="padding:7px 10px">${e.resultado||"—"}</td>
        <td style="padding:7px 10px;text-align:center"><span style="background:${e.conforme===true?"#eaf3de":e.conforme===false?"#ffebee":"#f5f5f5"};color:${e.conforme===true?"#3b6d11":e.conforme===false?"#b71c1c":"#666"};padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600">${e.conforme===true?"Conforme":e.conforme===false?"Não conforme":"—"}</span></td>
      </tr>`).join("");

    const assinaturaAnalistaHTML = laudo.assinaturaAnalista ? `
      <div style="text-align:center">
        <img src="${laudo.assinaturaAnalista.img}" style="height:50px;max-width:180px;object-fit:contain;display:block;margin:0 auto 4px"/>
        <div style="border-top:1px solid #ccc;padding-top:6px;font-size:11px">
          <strong>${laudo.assinaturaAnalista.nome}</strong><br/>
          ${laudo.assinaturaAnalista.cargo}<br/>
          <span style="color:#888;font-size:10px">Assinado eletronicamente em ${laudo.assinaturaAnalista.dataHora}</span>
        </div>
      </div>` : `<div style="text-align:center"><div style="height:50px"></div><div style="border-top:1px solid #ccc;padding-top:6px;font-size:11px">${laudo.criadoPor}<br/>Analista de CQ<br/><span style="color:#bbb;font-size:10px">Aguardando assinatura</span></div></div>`;

    const assinaturaRTHTML = laudo.assinaturaRT ? `
      <div style="text-align:center">
        <img src="${laudo.assinaturaRT.img}" style="height:50px;max-width:180px;object-fit:contain;display:block;margin:0 auto 4px"/>
        <div style="border-top:1px solid #ccc;padding-top:6px;font-size:11px">
          <strong>${laudo.assinaturaRT.nome}</strong><br/>
          Responsável Técnico<br/>
          ${laudo.assinaturaRT.crf?`<span style="color:#555;font-size:11px">${laudo.assinaturaRT.crf}</span><br/>`:""}
          <span style="color:#888;font-size:10px">Assinado eletronicamente em ${laudo.assinaturaRT.dataHora}</span>
        </div>
      </div>` : `<div style="text-align:center"><div style="height:50px;display:flex;align-items:flex-end;justify-content:center"><div style="border-bottom:1px solid #333;width:160px"></div></div><div style="border-top:1px solid #ccc;padding-top:6px;font-size:11px">Responsável Técnico<br/><span style="color:#bbb;font-size:10px">Aguardando assinatura</span></div></div>`;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:800px;margin:0 auto">
        <div style="background:#1a4a2e;padding:20px 24px;display:flex;justify-content:space-between;align-items:center">
          <div style="display:flex;align-items:center;gap:12px">
            <img src="${LOGO_HERBAMED}" style="width:44px;height:44px;border-radius:6px;object-fit:cover"/>
            <div>
              <div style="color:#fff;font-size:14px;font-weight:bold">${HERBAMED_INFO.nome}</div>
              <div style="color:#9fd4b2;font-size:10px">CNPJ: ${HERBAMED_INFO.cnpj}</div>
            </div>
          </div>
          <div style="text-align:right">
            <div style="color:#fff;font-size:13px;font-weight:bold">Laudo Analítico</div>
            <div style="color:#9fd4b2;font-size:11px">N° ${laudo.numLaudo}</div>
          </div>
        </div>
        <div style="padding:16px 24px;border-bottom:1px solid #eee;display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
          <div><div style="font-size:10px;color:#888;text-transform:uppercase;margin-bottom:3px">Cliente</div><div style="font-size:13px;font-weight:bold">${cliente?.nome||"—"}</div><div style="font-size:11px;color:#888">${cliente?.cnpj?"CNPJ: "+cliente.cnpj:""}</div></div>
          <div><div style="font-size:10px;color:#888;text-transform:uppercase;margin-bottom:3px">Produto</div><div style="font-size:13px;font-weight:bold">${laudo.produto}</div><div style="font-size:11px;color:#888">${laudo.linha||""}</div></div>
          <div><div style="font-size:10px;color:#888;text-transform:uppercase;margin-bottom:3px">Identificação</div><div style="font-size:13px;font-weight:bold">${laudo.op||laudo.lote||"—"}</div><div style="font-size:11px;color:#888">Lote: ${laudo.lote||"—"} · ${fmt(laudo.data)}</div></div>
        </div>
        <div style="padding:12px 24px;border-bottom:1px solid #eee"><span style="font-size:11px;padding:3px 10px;border-radius:20px;background:#e1f5ee;color:#0f6e56;font-weight:bold">${tipo}</span></div>
        <div style="padding:16px 24px">
          <div style="font-size:11px;font-weight:bold;color:#888;text-transform:uppercase;margin-bottom:10px">Resultados dos ensaios</div>
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead><tr style="background:#f5f5f5"><th style="padding:7px 10px;text-align:left;font-size:10px;color:#888;text-transform:uppercase">Ensaio</th><th style="padding:7px 10px;text-align:left;font-size:10px;color:#888;text-transform:uppercase">Unidade</th><th style="padding:7px 10px;text-align:left;font-size:10px;color:#888;text-transform:uppercase">Especificação</th><th style="padding:7px 10px;text-align:left;font-size:10px;color:#888;text-transform:uppercase">Resultado</th><th style="padding:7px 10px;text-align:center;font-size:10px;color:#888;text-transform:uppercase">Situação</th></tr></thead>
            <tbody>${ensaiosHTML}</tbody>
          </table>
        </div>
        <div style="margin:0 24px 16px;padding:10px 14px;background:${statusBg};border-left:3px solid ${statusColor};border-radius:4px">
          <div style="font-size:12px;font-weight:bold;color:${statusColor}">${statusTxt}</div>
        </div>
        ${laudo.obs?`<div style="margin:0 24px 16px;padding:10px 14px;background:#f9f9f9;border-radius:4px;font-size:12px;color:#555"><strong>Observações:</strong> ${laudo.obs}</div>`:""}
        ${laudo.armazenamento?`<div style="margin:0 24px 16px;padding:10px 14px;background:#e8f5e9;border-left:3px solid #2e7d32;border-radius:4px"><div style="font-size:11px;font-weight:bold;color:#2e7d32;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px">Condições de armazenamento</div><div style="font-size:11px;color:#333;white-space:pre-line">${laudo.armazenamento}</div></div>`:""}
        <div style="padding:16px 24px;border-top:1px solid #eee;display:grid;grid-template-columns:1fr 1fr;gap:24px">
          ${assinaturaAnalistaHTML}
          ${assinaturaRTHTML}
        </div>
        <div style="padding:10px 24px;background:#f5f5f5;border-top:1px solid #eee;display:flex;justify-content:space-between;font-size:10px;color:#888">
          <span>${HERBAMED_INFO.nome} · CNPJ: ${HERBAMED_INFO.cnpj}</span>
          <span>${HERBAMED_INFO.endereco} · ${HERBAMED_INFO.cidade} · CEP: ${HERBAMED_INFO.cep}</span>
        </div>
      </div>`;
    const win = window.open("","_blank");
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Laudo ${laudo.numLaudo}</title><style>@media print{body{margin:0}}</style></head><body>${html}<script>window.onload=()=>window.print();<\/script></body></html>`);
    win.document.close();
  };

  const statusColor = { "Aprovado":T.accent, "Finalizado":T.accent, "Reprovado":T.red, "Rascunho":T.text3 };
  const statusBg    = { "Aprovado":T.accent+"18", "Finalizado":T.accent+"18", "Reprovado":T.red+"18", "Rascunho":T.border };
  const statusIcon  = { "Aprovado":"✅", "Finalizado":"🏆", "Reprovado":"❌", "Rascunho":"📝" };

  const filtrados = laudos
    .filter(l => filtroStatus==="todos" || l.status===filtroStatus)
    .filter(l => !busca || l.produto?.toLowerCase().includes(busca.toLowerCase()) || l.numLaudo?.toLowerCase().includes(busca.toLowerCase()) || clientes.find(c=>String(c.id)===String(l.clienteId))?.nome?.toLowerCase().includes(busca.toLowerCase()));
  const {paginated:_lds,page:_pgL,total:_totL,setPage:_setPgL} = usePagination(filtrados, 20);

  // ── FORM ──
  if (view === "novo") return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
        <button style={s.btn} onClick={()=>{setView("lista");setSel(null);}}>← Voltar</button>
        <h2 style={{ fontSize:18, fontWeight:700, color:T.text, margin:0 }}>{sel?"Editar Laudo":"Novo Laudo Analítico"}</h2>
      </div>
      <div style={s.card}>
        <SecTitle icon="📋" ch="Identificação" />
        <G2 ch={<>
          <F lbl="Tipo de laudo *" ch={<Sel value={form.tipo} onChange={e=>setF("tipo",e.target.value)}>{TIPOS.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</Sel>} />
          <F lbl="Cliente *" ch={<Sel value={form.clienteId} onChange={e=>setF("clienteId",e.target.value)}><option value="">Selecione o cliente...</option>{clientes.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</Sel>} />
          <F lbl="Produto *" ch={<Inp placeholder="Nome do produto" value={form.produto} onChange={e=>setF("produto",e.target.value)} />} />
          <F lbl="Linha" ch={<Inp placeholder="Ex: Supra, Verde..." value={form.linha} onChange={e=>setF("linha",e.target.value)} />} />
          <F lbl="Lote" ch={<Inp placeholder="Número do lote" value={form.lote} onChange={e=>setF("lote",e.target.value)} />} />
          <F lbl="OP" ch={<Inp placeholder="Ordem de produção" value={form.op} onChange={e=>setF("op",e.target.value)} />} />
          <F lbl="Data" ch={<Inp type="date" value={form.data} onChange={e=>setF("data",e.target.value)} />} />
        </>} />
        <F lbl="Observações" ch={<Inp placeholder="Obs gerais do laudo..." value={form.obs} onChange={e=>setF("obs",e.target.value)} />} />
        <F lbl="Condições de armazenamento" ch={<TA rows={3} value={form.armazenamento} onChange={e=>setF("armazenamento",e.target.value)} />} />
      </div>

      <div style={s.card}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <SecTitle icon="🔬" ch="Ensaios" />
          <div style={{ display:"flex", gap:8 }}>
            <button style={{ ...s.btn, fontSize:11 }} onClick={importarEnsaios}>📥 Importar do {form.tipo==="processo"?"IPC":"CQ"}</button>
            <button style={{ ...s.btnA, fontSize:11 }} onClick={addEnsaio}><span className="btn-emoji">+ </span>Adicionar ensaio</button>
          </div>
        </div>
        {(form.ensaios||[]).length === 0 ? (
          <div style={{ textAlign:"center", padding:"1.5rem", color:T.text3, fontSize:12 }}>Nenhum ensaio adicionado. Use "Importar" ou "Adicionar ensaio".</div>
        ) : (
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:T.surf }}>
                  {["Ensaio","Unidade","Especificação","Resultado","Conforme?","Obs",""].map(h=>(
                    <th key={h} style={{ padding:"7px 8px", fontSize:10, fontWeight:700, color:T.text3, textTransform:"uppercase", textAlign:"left", borderBottom:`1px solid ${T.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {form.ensaios.map((e,i)=>(
                  <tr key={i} style={{ background:i%2===0?T.card:T.surf, borderLeft:e.conforme===false?`3px solid ${T.red}`:e.conforme===true?`3px solid ${T.accent}`:"3px solid transparent" }}>
                    <td style={{ padding:"6px 8px" }}><Inp value={e.label} onChange={ev=>setEnsaio(i,"label",ev.target.value)} placeholder="Nome..." sx={{ fontSize:11, padding:"4px 6px" }} /></td>
                    <td style={{ padding:"6px 8px" }}><Inp value={e.unidade} onChange={ev=>setEnsaio(i,"unidade",ev.target.value)} placeholder="g/mL..." sx={{ fontSize:11, padding:"4px 6px", width:60 }} /></td>
                    <td style={{ padding:"6px 8px" }}><Inp value={e.especificacao} onChange={ev=>setEnsaio(i,"especificacao",ev.target.value)} placeholder="Especificação..." sx={{ fontSize:11, padding:"4px 6px" }} /></td>
                    <td style={{ padding:"6px 8px" }}><Inp value={e.resultado} onChange={ev=>setEnsaio(i,"resultado",ev.target.value)} placeholder="Resultado..." sx={{ fontSize:11, padding:"4px 6px" }} /></td>
                    <td style={{ padding:"6px 8px" }}>
                      <div style={{ display:"flex", gap:3 }}>
                        <button onClick={()=>setEnsaio(i,"conforme",true)} style={{ padding:"3px 7px", borderRadius:5, border:`1px solid ${e.conforme===true?T.accent+"55":T.border}`, background:e.conforme===true?T.accent+"22":"transparent", color:e.conforme===true?T.accent:T.text2, cursor:"pointer", fontFamily:"inherit", fontSize:11 }}>✓</button>
                        <button onClick={()=>setEnsaio(i,"conforme",false)} style={{ padding:"3px 7px", borderRadius:5, border:`1px solid ${e.conforme===false?T.red+"55":T.border}`, background:e.conforme===false?T.red+"22":"transparent", color:e.conforme===false?T.red:T.text2, cursor:"pointer", fontFamily:"inherit", fontSize:11 }}>✗</button>
                        <button onClick={()=>setEnsaio(i,"conforme",null)} style={{ padding:"3px 5px", borderRadius:5, border:`1px solid ${T.border}`, background:"transparent", color:T.text3, cursor:"pointer", fontFamily:"inherit", fontSize:10 }}>—</button>
                      </div>
                    </td>
                    <td style={{ padding:"6px 8px" }}><Inp value={e.obs} onChange={ev=>setEnsaio(i,"obs",ev.target.value)} placeholder="obs..." sx={{ fontSize:11, padding:"4px 6px", width:80 }} /></td>
                    <td style={{ padding:"6px 8px" }}><button onClick={()=>delEnsaio(i)} style={{ ...s.btnD, fontSize:10, padding:"3px 7px" }}>🗑️</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
        <button style={s.btn} onClick={()=>{setView("lista");setSel(null);}}>Cancelar</button>
        <button style={s.btnA} onClick={salvar}>Salvar laudo ✓</button>
      </div>
    </div>
  );

  // ── DETALHE ──
  if (view === "detalhe" && sel) {
    const lSel = laudos.find(l=>l.id===sel.id)||sel;
    const cliente = clientes.find(c=>String(c.id)===String(lSel.clienteId));
    const tipo = TIPOS.find(t=>t.id===lSel.tipo)?.label||lSel.tipo;
    const podeAssinarAnalista = !lSel.assinaturaAnalista && (user.role!=="rt");
    const podeAssinarRT = !lSel.assinaturaRT && isRT;
    return (
      <div>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20, flexWrap:"wrap" }}>
          <button style={s.btn} onClick={()=>{setView("lista");setSel(null);}}>← Voltar</button>
          <h2 style={{ fontSize:18, fontWeight:700, color:T.text, margin:0 }}>N° {lSel.numLaudo}</h2>
          <span style={{ padding:"3px 12px", borderRadius:20, fontSize:11, fontWeight:700, background:statusBg[lSel.status], color:statusColor[lSel.status] }}>{statusIcon[lSel.status]} {lSel.status}</span>
          <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
            {podeAssinarAnalista && <button style={{ ...s.btnA, fontSize:12 }} onClick={()=>assinarAnalista(lSel)}><span className="btn-emoji">✍️ </span>Assinar como Analista</button>}
            {podeAssinarRT && <button style={{ ...s.btnA, fontSize:12, background:T.orange||"#ff9800" }} onClick={()=>assinarRT(lSel)}><span className="btn-emoji">🔬 </span>Assinar como RT</button>}
            <button style={{ ...s.btn, fontSize:12 }} onClick={()=>exportPDF(lSel)}><span className="btn-emoji">🖨️ </span>Exportar PDF</button>
            <button style={{ ...s.btn, fontSize:12 }} onClick={()=>{setSel(lSel);setForm({tipo:lSel.tipo,clienteId:lSel.clienteId,produto:lSel.produto,linha:lSel.linha||"",lote:lSel.lote||"",op:lSel.op||"",data:lSel.data,obs:lSel.obs||"",armazenamento:lSel.armazenamento||`• Armazenar em local seco e fresco com temperatura de 15 a 30°C e umidade relativa de 30% a 80%.
• Armazenar o produto sobre palete ou paleteira, deixando espaço lateral de 15 cm em cada extremidade. Observar a altura máxima de empilhamento.`,ensaios:lSel.ensaios||[]});setView("novo");}}><span className="btn-emoji">✏️ </span>Editar</button>
            <button style={{ ...s.btnD, fontSize:12 }} onClick={()=>deletar(lSel.id)}>🗑️</button>
          </div>
        </div>
        <div style={s.card}>
          <SecTitle icon="📋" ch="Identificação" />
          <G3 ch={<>
            <F lbl="Cliente" ch={<div style={{ padding:"8px 10px", background:T.surf, borderRadius:8, fontSize:13 }}>{cliente?.nome||"—"}</div>} />
            <F lbl="Tipo" ch={<div style={{ padding:"8px 10px", background:T.surf, borderRadius:8, fontSize:13 }}>{tipo}</div>} />
            <F lbl="Produto" ch={<div style={{ padding:"8px 10px", background:T.surf, borderRadius:8, fontSize:13 }}>{lSel.produto}{lSel.linha?` — ${lSel.linha}`:""}</div>} />
            <F lbl="Lote" ch={<div style={{ padding:"8px 10px", background:T.surf, borderRadius:8, fontSize:13 }}>{lSel.lote||"—"}</div>} />
            <F lbl="OP" ch={<div style={{ padding:"8px 10px", background:T.surf, borderRadius:8, fontSize:13 }}>{lSel.op||"—"}</div>} />
            <F lbl="Data" ch={<div style={{ padding:"8px 10px", background:T.surf, borderRadius:8, fontSize:13 }}>{fmt(lSel.data)}</div>} />
          </>} />
          {lSel.obs && <F lbl="Observações" ch={<div style={{ padding:"8px 10px", background:T.surf, borderRadius:8, fontSize:13, color:T.text2 }}>{lSel.obs}</div>} />}
          {lSel.armazenamento && <F lbl="Condições de armazenamento" ch={<div style={{ padding:"8px 10px", background:T.surf, borderRadius:8, fontSize:12, color:T.text2, whiteSpace:"pre-line" }}>{lSel.armazenamento}</div>} />}
        </div>
        <div style={s.card}>
          <SecTitle icon="🔬" ch="Ensaios" />
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
              <thead>
                <tr style={{ background:T.surf }}>
                  {["Ensaio","Unidade","Especificação","Resultado","Situação","Obs."].map(h=>(
                    <th key={h} style={{ padding:"7px 10px", textAlign:"left", fontSize:10, fontWeight:700, color:T.text3, textTransform:"uppercase", borderBottom:`1px solid ${T.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(lSel.ensaios||[]).map((e,i)=>(
                  <tr key={i} style={{ background:i%2===0?T.card:T.surf, borderLeft:e.conforme===false?`3px solid ${T.red}`:e.conforme===true?`3px solid ${T.accent}`:"3px solid transparent" }}>
                    <td style={{ padding:"8px 10px", fontWeight:600 }}>{e.label||"—"}</td>
                    <td style={{ padding:"8px 10px", color:T.text3 }}>{e.unidade||"—"}</td>
                    <td style={{ padding:"8px 10px", color:T.text2 }}>{e.especificacao||"—"}</td>
                    <td style={{ padding:"8px 10px" }}>{e.resultado||"—"}</td>
                    <td style={{ padding:"8px 10px" }}>{e.conforme===true?<span style={{ color:T.accent, fontWeight:700 }}>✓ Conforme</span>:e.conforme===false?<span style={{ color:T.red, fontWeight:700 }}>✗ N.C.</span>:<span style={{ color:T.text3 }}>—</span>}</td>
                    <td style={{ padding:"8px 10px", color:T.text2 }}>{e.obs||"—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding:"12px 16px", borderRadius:10, textAlign:"center", fontWeight:700, fontSize:14, background:statusBg[lSel.status], color:statusColor[lSel.status], border:`1px solid ${statusColor[lSel.status]}33`, marginTop:12 }}>
            {statusIcon[lSel.status]} {lSel.status==="Aprovado"||lSel.status==="Finalizado"?"APROVADO — Produto em conformidade":lSel.status==="Reprovado"?"REPROVADO — Ensaios fora das especificações":"RASCUNHO — Em elaboração"}
          </div>
        </div>
        <div style={s.card}>
          <SecTitle icon="✍️" ch="Assinaturas" />
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24 }}>
            <div style={{ textAlign:"center", padding:"1rem", background:T.surf, borderRadius:10, border:`1px solid ${T.border}` }}>
              <div style={{ fontSize:11, fontWeight:700, color:T.text3, textTransform:"uppercase", marginBottom:12 }}>Analista de CQ</div>
              {lSel.assinaturaAnalista ? (<>
                <img src={lSel.assinaturaAnalista.img} alt="Assinatura" style={{ height:50, maxWidth:180, objectFit:"contain", display:"block", margin:"0 auto 8px" }} />
                <div style={{ fontSize:12, fontWeight:600, color:T.text }}>{lSel.assinaturaAnalista.nome}</div>
                <div style={{ fontSize:11, color:T.text2 }}>{lSel.assinaturaAnalista.cargo}</div>
                <div style={{ fontSize:10, color:T.accent, marginTop:4 }}>✓ Assinado em {lSel.assinaturaAnalista.dataHora}</div>
              </>) : <div style={{ fontSize:12, color:T.text3, padding:"1rem" }}>Aguardando assinatura</div>}
            </div>
            <div style={{ textAlign:"center", padding:"1rem", background:T.surf, borderRadius:10, border:`1px solid ${T.border}` }}>
              <div style={{ fontSize:11, fontWeight:700, color:T.text3, textTransform:"uppercase", marginBottom:12 }}>Responsável Técnico</div>
              {lSel.assinaturaRT ? (<>
                <img src={lSel.assinaturaRT.img} alt="Assinatura" style={{ height:50, maxWidth:180, objectFit:"contain", display:"block", margin:"0 auto 8px" }} />
                <div style={{ fontSize:12, fontWeight:600, color:T.text }}>{lSel.assinaturaRT.nome}</div>
                <div style={{ fontSize:11, color:T.text2 }}>Responsável Técnico</div>
                {lSel.assinaturaRT.crf && <div style={{ fontSize:11, color:T.text2 }}>{lSel.assinaturaRT.crf}</div>}
                <div style={{ fontSize:10, color:T.accent, marginTop:4 }}>✓ Assinado em {lSel.assinaturaRT.dataHora}</div>
              </>) : <div style={{ fontSize:12, color:T.text3, padding:"1rem" }}>Aguardando assinatura do RT</div>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── LISTA ──
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, flexWrap:"wrap", gap:10 }}>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
          <div style={{ position:"relative" }}>
            <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:T.text3, fontSize:13 }}>🔍</span>
            <input placeholder="Buscar laudo, produto ou cliente..." value={busca} onChange={e=>setBusca(e.target.value)} style={{ ...s.inp, paddingLeft:30, width:220, fontSize:12 }} />
          </div>
          <Sel value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)}>
            <option value="todos">Todos os status</option>
            <option value="Rascunho">📝 Rascunho</option>
            <option value="Aprovado">✅ Aprovado</option>
            <option value="Reprovado">❌ Reprovado</option>
            <option value="Finalizado">🏆 Finalizado</option>
          </Sel>
        </div>
        <button style={s.btnA} onClick={()=>{setSel(null);setForm({tipo:"produto_acabado",clienteId:"",produto:"",linha:"",lote:"",op:"",data:tod(),obs:"",armazenamento:`• Armazenar em local seco e fresco com temperatura de 15 a 30°C e umidade relativa de 30% a 80%.
• Armazenar o produto sobre palete ou paleteira, deixando espaço lateral de 15 cm em cada extremidade. Observar a altura máxima de empilhamento.`,ensaios:[]});setView("novo");}}>
          + Novo Laudo
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign:"center", padding:"3rem", color:T.text2 }}>Carregando...</div>
      ) : filtrados.length === 0 ? (
        <div style={{ textAlign:"center", padding:"3rem", color:T.text3 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
          <div style={{ fontSize:14 }}>Nenhum laudo encontrado.</div>
          <div style={{ fontSize:12, marginTop:6 }}>Crie o primeiro laudo analítico!</div>
        </div>
      ) : (<>
      {_lds.map(l => {
        const cliente = clientes.find(c=>String(c.id)===String(l.clienteId));
        const tipo = TIPOS.find(t=>t.id===l.tipo)?.label||l.tipo;
        return (
          <div key={l.id} className="rnc-row" onClick={()=>{setSel(l);setView("detalhe");}}
            style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"12px 16px", marginBottom:8, cursor:"pointer", display:"flex", alignItems:"center", gap:12, flexWrap:"wrap", borderLeft:`3px solid ${statusColor[l.status]||T.border}` }}>
            <div style={{ fontSize:22 }}>📋</div>
            <div style={{ flex:1, minWidth:150 }}>
              <div style={{ fontSize:13, fontWeight:700, color:T.text }}>{l.numLaudo} — {l.produto}</div>
              <div style={{ fontSize:11, color:T.text2, marginTop:2 }}>{cliente?.nome||"—"} · {tipo} · {fmt(l.data)}</div>
            </div>
            <div style={{ display:"flex", gap:6, alignItems:"center" }}>
              {l.assinaturaAnalista && <span style={{ fontSize:10, padding:"2px 8px", borderRadius:12, background:T.accent+"18", color:T.accent }}>✍️ Analista</span>}
              {l.assinaturaRT && <span style={{ fontSize:10, padding:"2px 8px", borderRadius:12, background:"#ff980018", color:"#ff9800" }}>🔬 RT</span>}
            </div>
            <span style={{ padding:"4px 12px", borderRadius:20, fontSize:11, fontWeight:700, background:statusBg[l.status], color:statusColor[l.status], flexShrink:0 }}>
              {statusIcon[l.status]} {l.status}
            </span>
          </div>
        );
      })
      }<Pagination page={_pgL} total={_totL} setPage={_setPgL}/>
      </>
      )}
    </div>
  );
}


/* ─── AUDITORIA PDF EXPORT ───────────────────────────────────────────────────── */
function exportAuditoriaPDF(a) {
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

/* ─── AUDITORIAS TAB ─────────────────────────────────────────────────────────── */
function AuditoriasTab({ user, toast_, users, rncs }) {
  const T = useTheme(); const s = useS();
  const [auditorias, setAuditorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("lista");
  const [sel, setSel] = useState(null);
  const [form, setForm] = useState({ titulo:"", tipo:"Interna", area:"", auditores:"", dataPlano:tod(), dataPrev:"", status:"Planejada", objetivo:"", escopo:"" });
  const [achados, setAchados] = useState([]);
  const setF = (k,v) => setForm(p=>({...p,[k]:v}));

  useEffect(()=>{
    const unsub = subscribeCollection("auditorias", list=>{
      setAuditorias(list.sort((a,b)=>(b.criadoTs||0)-(a.criadoTs||0)));
      setLoading(false);
    });
    const t = setTimeout(()=>setLoading(false), 3000);
    return ()=>{ unsub(); clearTimeout(t); };
  },[]);

  const addAchado = () => setAchados(p=>[...p, { id:Date.now(), tipo:"Não conformidade", desc:"", ref:"", acao:"", resp:"", prazo:"", status:"Aberto" }]);
  const updAchado = (id,k,v) => setAchados(p=>p.map(a=>a.id===id?{...a,[k]:v}:a));
  const delAchado = (id) => setAchados(p=>p.filter(a=>a.id!==id));

  const salvar = async () => {
    try {
    if(!form.titulo.trim()) { alert("Informe o título da auditoria."); return; }
    const id = sel ? String(sel.id) : String(Date.now());
    const aud = { id, ...form, achados, criadoPor:user.name, criadoEm:tod(), criadoTs:Date.now() };
    await saveCollection("auditorias", id, aud);
    toast_(sel?"Auditoria atualizada!":"Auditoria criada!", "green");
    setView("lista"); setSel(null);
    setForm({ titulo:"", tipo:"Interna", area:"", auditores:"", dataPlano:tod(), dataPrev:"", status:"Planejada", objetivo:"", escopo:"" });
    setAchados([]);
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const del = async (id) => {
    try {
    if(!confirm("Excluir esta auditoria?")) return;
    await deleteFromCollection("auditorias", String(id));
    setSel(null); toast_("Auditoria excluída.", "red");
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const editAuditoria = (a) => {
    setSel(a);
    setForm({ titulo:a.titulo, tipo:a.tipo, area:a.area||"", auditores:a.auditores||"", dataPlano:a.dataPlano||tod(), dataPrev:a.dataPrev||"", status:a.status, objetivo:a.objetivo||"", escopo:a.escopo||"" });
    setAchados(a.achados||[]);
    setView("nova");
  };

  const STATUS_AUD = { Planejada:"#4fc3f7", "Em andamento":"#ffd166", Concluída:"#2ab84a", Cancelada:"#ff4f6a" };
  const TIPOS_ACHADO = ["Não conformidade","Observação","Oportunidade de melhoria","Ponto positivo"];

  const {paginated:_auds,page:_pgA,total:_totA,setPage:_setPgA} = usePagination(auditorias, 20);

  if(loading) return <div style={{ textAlign:"center", padding:"3rem", color:T.text2 }}>Carregando...</div>;
  if(view==="nova") return (
    <div>
      <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:"1rem" }}>
        <button style={s.btn} onClick={()=>{ setView("lista"); setSel(null); }}>← Voltar</button>
        <div style={{ fontSize:15, fontWeight:700, color:T.text }}>{sel?"Editar auditoria":"Nova auditoria"}</div>
      </div>

      <div style={s.card}>
        <SecTitle icon="🔍" ch="Planejamento da auditoria" />
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <F lbl="Título *" ch={<Inp placeholder="Ex: Auditoria CQ — Processo de Encapsulação" value={form.titulo} onChange={e=>setF("titulo",e.target.value)} />} />
          <F lbl="Tipo" ch={<Sel value={form.tipo} onChange={e=>setF("tipo",e.target.value)}><option>Interna</option><option>Externa</option><option>Fornecedor</option></Sel>} />
          <F lbl="Área / Setor auditado" ch={<Inp placeholder="Ex: Controle de Qualidade, Produção" value={form.area} onChange={e=>setF("area",e.target.value)} />} />
          <F lbl="Auditor(es)" ch={<Inp placeholder="Ex: Lucas Ribeiro, Maria Silva" value={form.auditores} onChange={e=>setF("auditores",e.target.value)} />} />
          <F lbl="Data do planejamento" ch={<Inp type="date" value={form.dataPlano} onChange={e=>setF("dataPlano",e.target.value)} />} />
          <F lbl="Data prevista de execução" ch={<Inp type="date" value={form.dataPrev} onChange={e=>setF("dataPrev",e.target.value)} />} />
          <F lbl="Status" ch={<Sel value={form.status} onChange={e=>setF("status",e.target.value)}>{Object.keys(STATUS_AUD).map(x=><option key={x}>{x}</option>)}</Sel>} />
        </div>
        <F lbl="Objetivo" ch={<TA rows={2} placeholder="Descreva o objetivo da auditoria..." value={form.objetivo} onChange={e=>setF("objetivo",e.target.value)} />} />
        <F lbl="Escopo" ch={<TA rows={2} placeholder="O que será auditado, processos, documentos..." value={form.escopo} onChange={e=>setF("escopo",e.target.value)} />} />
      </div>

      <div style={s.card}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
          <SecTitle icon="📝" ch={`Achados (${achados.length})`} />
          <button style={s.btnA} onClick={addAchado}>+ Adicionar achado</button>
        </div>
        {achados.length===0 ? (
          <div style={{ textAlign:"center", padding:"1.5rem", color:T.text3, fontSize:13 }}>Nenhum achado registrado ainda</div>
        ) : achados.map((a,i)=>(
          <div key={a.id} style={{ background:T.surf, border:`1px solid ${T.border}`, borderRadius:10, padding:"1rem", marginBottom:10 }}>
            <div style={{ display:"flex", gap:10, marginBottom:10, alignItems:"center" }}>
              <div style={{ fontSize:12, fontWeight:700, color:T.text3 }}>#{i+1}</div>
              <Sel value={a.tipo} onChange={e=>updAchado(a.id,"tipo",e.target.value)} sx={{ width:"auto", fontSize:12 }}>
                {TIPOS_ACHADO.map(t=><option key={t}>{t}</option>)}
              </Sel>
              <Sel value={a.status} onChange={e=>updAchado(a.id,"status",e.target.value)} sx={{ width:"auto", fontSize:12 }}>
                {["Aberto","Em tratamento","Fechado"].map(t=><option key={t}>{t}</option>)}
              </Sel>
              <button onClick={()=>delAchado(a.id)} style={{ marginLeft:"auto", background:"#ff4f6a18", border:"1px solid #ff4f6a33", color:"#ff4f6a", borderRadius:6, cursor:"pointer", padding:"4px 8px", fontSize:12, fontFamily:"inherit" }}>✕</button>
            </div>
            <F lbl="Descrição do achado" ch={<TA rows={2} placeholder="Descreva o que foi encontrado..." value={a.desc} onChange={e=>updAchado(a.id,"desc",e.target.value)} />} />
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:8 }}>
              <F lbl="Referência normativa" ch={<Inp placeholder="Ex: BPF item 5.2, ISO 9001 cl. 8.2" value={a.ref} onChange={e=>updAchado(a.id,"ref",e.target.value)} />} />
              <F lbl="Ação corretiva" ch={<Inp placeholder="Ação a ser tomada..." value={a.acao} onChange={e=>updAchado(a.id,"acao",e.target.value)} />} />
              <F lbl="Responsável" ch={<Inp value={a.resp} onChange={e=>updAchado(a.id,"resp",e.target.value)} />} />
              <F lbl="Prazo" ch={<Inp type="date" value={a.prazo} onChange={e=>updAchado(a.id,"prazo",e.target.value)} />} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", gap:10, justifyContent:"flex-end", paddingBottom:"1rem" }}>
        <button style={s.btn} onClick={()=>{ setView("lista"); setSel(null); }}>Cancelar</button>
        <button style={s.btnA} onClick={salvar}>💾 Salvar auditoria →</button>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
        <div style={{ fontSize:13, color:T.text2 }}>{auditorias.length} auditoria(s) registrada(s)</div>
        <button style={s.btnA} onClick={()=>{ setSel(null); setForm({ titulo:"", tipo:"Interna", area:"", auditores:"", dataPlano:tod(), dataPrev:"", status:"Planejada", objetivo:"", escopo:"" }); setAchados([]); setView("nova"); }}>+ Nova Auditoria</button>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:"1rem" }}>
        {Object.entries(STATUS_AUD).map(([st,c])=>(
          <div key={st} style={{ background:T.surf, border:`1px solid ${T.border}`, borderRadius:10, padding:"10px 14px", textAlign:"center" }}>
            <div style={{ fontSize:22, fontWeight:700, color:c }}>{auditorias.filter(a=>a.status===st).length}</div>
            <div style={{ fontSize:11, color:T.text3, marginTop:2 }}>{st}</div>
          </div>
        ))}
      </div>

      {auditorias.length===0 ? (
        <div style={{ ...s.card, textAlign:"center", padding:"3rem" }}>
          <div style={{ fontSize:40, marginBottom:"1rem", opacity:.3 }}>🔍</div>
          <div style={{ fontSize:14, color:T.text2 }}>Nenhuma auditoria registrada</div>
        </div>
      ) : (<>
      {_auds.map(a=>(
        <div key={a.id} style={{ background:T.card, border:`1px solid ${T.border}`, borderLeft:`3px solid ${STATUS_AUD[a.status]||T.accent}`, borderRadius:12, padding:"1rem 1.25rem", marginBottom:10 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:T.text, marginBottom:4 }}>{a.titulo}</div>
              <div style={{ fontSize:12, color:T.text2 }}>
                {a.tipo} · {a.area||"—"} · Auditor: {a.auditores||"—"}
                {a.dataPrev&&` · Prevista: ${fmt(a.dataPrev)}`}
              </div>
              {a.achados?.length>0 && (
                <div style={{ marginTop:6, display:"flex", gap:6 }}>
                  {TIPOS_ACHADO.slice(0,3).map(tp=>{
                    const n = a.achados.filter(x=>x.tipo===tp).length;
                    if(!n) return null;
                    const c = tp==="Não conformidade"?"#ff4f6a":tp==="Observação"?"#ffd166":"#2ab84a";
                    return <span key={tp} style={{ fontSize:10, fontWeight:600, color:c, background:`${c}18`, padding:"2px 8px", borderRadius:20 }}>{tp}: {n}</span>;
                  })}
                </div>
              )}
            </div>
            <div style={{ display:"flex", gap:8, alignItems:"center", flexShrink:0 }}>
              <span style={{ fontSize:11, fontWeight:600, color:STATUS_AUD[a.status], background:`${STATUS_AUD[a.status]}18`, padding:"3px 10px", borderRadius:20 }}>{a.status}</span>
              <button style={{ ...s.btn, padding:"4px 10px", fontSize:11, color:"#ff8c42", borderColor:"#ff8c4233", background:"#ff8c4212" }} onClick={()=>exportAuditoriaPDF(a)}><span className="btn-emoji">📄 </span>PDF</button>
              <button style={{ ...s.btn, padding:"4px 10px", fontSize:11, color:T.accent, borderColor:T.accent+"33", background:T.accentDim }} onClick={()=>editAuditoria(a)}><span className="btn-emoji">✏️ </span>Editar</button>
              <button style={{ ...s.btnD, padding:"4px 8px", fontSize:11 }} onClick={()=>del(a.id)}>🗑️</button>
            </div>
          </div>
        </div>
      ))}
      <Pagination page={_pgA} total={_totA} setPage={_setPgA}/>
      </>
      )}
    </div>
  );
}

/* ─── CQ DASHBOARD ───────────────────────────────────────────────────────────── */
function CQDashboardTab() {
  const T = useTheme(); const s = useS();
  const [analises, setAnalises] = useState([]);
  const [materiais, setMateriais] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodoMeses, setPeriodoMeses] = useState(6);

  useEffect(()=>{
    const u1 = subscribeCollection("cq_analises", list=>{ setAnalises(list); setLoading(false); });
    const u2 = subscribeCollection("cq_materiais", list=>{ setMateriais(list); });
    const t = setTimeout(()=>setLoading(false), 3000);
    return ()=>{ u1(); u2(); clearTimeout(t); };
  },[]);

  if(loading) return <div style={{ textAlign:"center", padding:"3rem", color:T.text2 }}>Carregando...</div>;

  // Filtrar por período
  const dataCorte = new Date();
  dataCorte.setMonth(dataCorte.getMonth() - periodoMeses);
  const cortStr = dataCorte.toISOString().split("T")[0];
  const filtered = analises.filter(a => (a.dataAnalise||a.criadoEm||"") >= cortStr);

  // Stats gerais
  const total = filtered.length;
  const aprovadas = filtered.filter(x=>x.conclusao==="Aprovado").length;
  const reprovadas = filtered.filter(x=>x.conclusao==="Reprovado").length;
  const pendentes = filtered.filter(x=>x.conclusao==="Pendente").length;
  const taxaAprov = total>0 ? Math.round(aprovadas/total*100) : 0;

  // Por material
  const porMaterial = {};
  filtered.forEach(a=>{
    const k = a.materialNome||"Desconhecido";
    if(!porMaterial[k]) porMaterial[k] = { total:0, aprovadas:0, reprovadas:0 };
    porMaterial[k].total++;
    if(a.conclusao==="Aprovado") porMaterial[k].aprovadas++;
    if(a.conclusao==="Reprovado") porMaterial[k].reprovadas++;
  });

  // Por fornecedor
  const porFornecedor = {};
  filtered.forEach(a=>{
    const k = a.fornecedor||"Não informado";
    if(!porFornecedor[k]) porFornecedor[k] = { total:0, aprovadas:0, reprovadas:0 };
    porFornecedor[k].total++;
    if(a.conclusao==="Aprovado") porFornecedor[k].aprovadas++;
    if(a.conclusao==="Reprovado") porFornecedor[k].reprovadas++;
  });

  // Evolução mensal
  const meses = [];
  for(let i=periodoMeses-1; i>=0; i--){
    const d = new Date(); d.setMonth(d.getMonth()-i);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    const label = d.toLocaleDateString("pt-BR",{month:"short",year:"2-digit"});
    const ms = filtered.filter(a=>(a.dataAnalise||"").startsWith(key));
    meses.push({ key, label, total:ms.length, aprov:ms.filter(x=>x.conclusao==="Aprovado").length, reprov:ms.filter(x=>x.conclusao==="Reprovado").length });
  }
  const maxMes = Math.max(...meses.map(m=>m.total), 1);

  return (
    <div>
      {/* Filtro de período */}
      <div style={{ display:"flex", gap:8, marginBottom:"1rem" }}>
        {[3,6,12].map(m=>(
          <button key={m} onClick={()=>setPeriodoMeses(m)} style={{ padding:"6px 16px", borderRadius:20, border:`1px solid ${periodoMeses===m?T.accent+"55":T.border}`, background:periodoMeses===m?T.accentDim:T.surf, color:periodoMeses===m?T.accent:T.text2, cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:periodoMeses===m?600:400 }}>
            Últimos {m} meses
          </button>
        ))}
        <div style={{ marginLeft:"auto", fontSize:12, color:T.text3, alignSelf:"center" }}>{total} análise(s) no período</div>
      </div>

      {/* KPI cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:"1.5rem" }}>
        {[
          { l:"Total de análises",  n:total,      c:T.accent,  icon:"📋", sub:"No período selecionado" },
          { l:"Taxa de aprovação",  n:`${taxaAprov}%`, c:taxaAprov>=80?T.accent:"#ff8c42", icon:"✅", sub:`${aprovadas} aprovadas` },
          { l:"Reprovadas",         n:reprovadas, c:reprovadas>0?"#ff4f6a":T.text3, icon:"❌", sub:"Requerem ação" },
          { l:"Pendentes",          n:pendentes,  c:"#ffd166", icon:"⏳", sub:"Análise incompleta" },
        ].map(({l,n,c,icon,sub})=>(
          <div key={l} style={{ background:T.card, border:`1px solid ${c}22`, borderRadius:14, padding:"1.1rem", position:"relative", overflow:"hidden", boxShadow:`0 0 16px ${c}10` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
              <span style={{ fontSize:22, opacity:.5 }}>{icon}</span>
            </div>
            <div style={{ fontSize:28, fontWeight:800, color:c, lineHeight:1, marginBottom:4 }}>{n}</div>
            <div style={{ fontSize:11, fontWeight:700, color:T.text, marginBottom:2 }}>{l}</div>
            <div style={{ fontSize:10, color:T.text3 }}>{sub}</div>
            <div style={{ position:"absolute", bottom:-12, right:-12, width:55, height:55, borderRadius:"50%", background:c, opacity:.06 }}/>
          </div>
        ))}
      </div>

      {/* Evolução mensal */}
      <div style={{ ...s.card, marginBottom:"1.5rem" }}>
        <SecTitle icon="📈" ch="Evolução mensal de análises" />
        <div style={{ display:"flex", alignItems:"flex-end", gap:8, height:120, paddingTop:8 }}>
          {meses.map((m,i)=>(
            <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
              <div style={{ fontSize:9, color:T.text3, marginBottom:2 }}>{m.total>0?m.total:""}</div>
              <div style={{ width:"100%", display:"flex", flexDirection:"column", justifyContent:"flex-end", height:90, gap:1 }}>
                {m.reprov>0 && <div style={{ width:"100%", height:`${Math.round(m.reprov/maxMes*85)}px`, background:"#ff4f6a", borderRadius:"3px 3px 0 0", minHeight:3 }}/>}
                {m.aprov>0  && <div style={{ width:"100%", height:`${Math.round(m.aprov/maxMes*85)}px`,  background:T.accent,   borderRadius: m.reprov>0?"0":"3px 3px 0 0", minHeight:3 }}/>}
                {m.total===0 && <div style={{ width:"100%", height:3, background:T.border, borderRadius:3 }}/>}
              </div>
              <div style={{ fontSize:9, color:T.text3, textAlign:"center", whiteSpace:"nowrap" }}>{m.label}</div>
            </div>
          ))}
        </div>
        <div style={{ display:"flex", gap:16, marginTop:8 }}>
          {[[T.accent,"Aprovadas"],["#ff4f6a","Reprovadas"]].map(([c,l])=>(
            <div key={l} style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:T.text2 }}>
              <span style={{ width:10, height:10, borderRadius:2, background:c, display:"inline-block" }}/>
              {l}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.5rem" }}>
        {/* Por material */}
        <div style={s.card}>
          <SecTitle icon="📦" ch="Índice de aprovação por material" />
          {Object.keys(porMaterial).length===0 ? (
            <div style={{ color:T.text3, fontSize:13, textAlign:"center", padding:"1.5rem" }}>Sem dados no período.</div>
          ) : Object.entries(porMaterial).sort((a,b)=>b[1].total-a[1].total).map(([mat,d])=>{
            const taxa = Math.round(d.aprovadas/d.total*100);
            const c = taxa>=80?T.accent:taxa>=50?"#ff8c42":"#ff4f6a";
            return (
              <div key={mat} style={{ marginBottom:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                  <span style={{ fontSize:12, color:T.text, fontWeight:500 }}>{mat}</span>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <span style={{ fontSize:10, color:T.text3 }}>{d.total} análise(s)</span>
                    <span style={{ fontSize:13, fontWeight:700, color:c }}>{taxa}%</span>
                  </div>
                </div>
                <div style={{ height:7, background:T.surf, borderRadius:4, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${taxa}%`, background:c, borderRadius:4, transition:"width .6s" }}/>
                </div>
                {d.reprovadas>0 && <div style={{ fontSize:10, color:"#ff4f6a", marginTop:3 }}>⚠ {d.reprovadas} reprovada(s)</div>}
              </div>
            );
          })}
        </div>

        {/* Por fornecedor */}
        <div style={s.card}>
          <SecTitle icon="🏭" ch="Índice de aprovação por fornecedor" />
          {Object.keys(porFornecedor).length===0 ? (
            <div style={{ color:T.text3, fontSize:13, textAlign:"center", padding:"1.5rem" }}>Sem dados no período.</div>
          ) : Object.entries(porFornecedor).sort((a,b)=>b[1].total-a[1].total).map(([forn,d])=>{
            const taxa = Math.round(d.aprovadas/d.total*100);
            const c = taxa>=80?T.accent:taxa>=50?"#ff8c42":"#ff4f6a";
            return (
              <div key={forn} style={{ marginBottom:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                  <span style={{ fontSize:12, color:T.text, fontWeight:500 }}>{forn}</span>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <span style={{ fontSize:10, color:T.text3 }}>{d.total} análise(s)</span>
                    <span style={{ fontSize:13, fontWeight:700, color:c }}>{taxa}%</span>
                  </div>
                </div>
                <div style={{ height:7, background:T.surf, borderRadius:4, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${taxa}%`, background:c, borderRadius:4, transition:"width .6s" }}/>
                </div>
                {d.reprovadas>0 && <div style={{ fontSize:10, color:"#ff4f6a", marginTop:3 }}>⚠ {d.reprovadas} reprovada(s)</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Últimas análises reprovadas */}
      {reprovadas > 0 && (
        <div style={{ ...s.card, marginTop:"1.5rem" }}>
          <SecTitle icon="❌" ch="Análises reprovadas no período" />
          {filtered.filter(x=>x.conclusao==="Reprovado").sort((a,b)=>(b.criadoTs||0)-(a.criadoTs||0)).map(a=>(
            <div key={a.id} style={{ background:"#ff4f6a0a", border:"1px solid #ff4f6a22", borderRadius:10, padding:"10px 14px", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <span style={{ fontSize:11, fontWeight:700, color:T.accent }}>{a.num}</span>
                  <span style={{ fontSize:12, fontWeight:600, color:T.text }}>{a.materialNome}</span>
                </div>
                <span style={{ fontSize:11, color:T.text3 }}>{fmt(a.dataAnalise)}</span>
              </div>
              <div style={{ fontSize:12, color:T.text2 }}>
                Fornecedor: {a.fornecedor||"—"} · Lote: {a.lote||"—"} · Analista: {a.resp}
              </div>
              {a.resultados?.filter(r=>r.conforme===false).length>0 && (
                <div style={{ marginTop:6, fontSize:11, color:"#ff4f6a" }}>
                  Ensaios NC: {a.resultados.filter(r=>r.conforme===false).map(r=>r.nome).join(", ")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


/* ─── PERMISSÕES POR PERFIL ─────────────────────────────────────────────────── */
const PERMS_GRUPOS = [
  { grupo: "RNCs", items: [
    { key: "criarRNC",           label: "Criar nova RNC" },
    { key: "editarRNCpropria",   label: "Editar RNC própria" },
    { key: "editarRNCtodas",     label: "Editar qualquer RNC" },
    { key: "analisarRNC",        label: "Ishikawa / 5W2H / Eficácia" },
    { key: "aprovarRNC",         label: "Aprovar como RT (RNC crítica)" },
    { key: "excluirRNC",         label: "Excluir RNC" },
  ]},
  { grupo: "Controle de Qualidade", items: [
    { key: "verCQMateriais",     label: "Visualizar CQ Materiais" },
    { key: "criarMaterialCQ",    label: "Criar / editar material CQ" },
    { key: "lancarAnalise",      label: "Lançar ficha de análise" },
    { key: "aprovarAnalise",     label: "Aprovar / reprovar análise" },
    { key: "editarAnalise",      label: "Editar análise aprovada" },
    { key: "verLaudos",          label: "Visualizar laudos" },
    { key: "criarLaudos",        label: "Criar / assinar laudos" },
  ]},
  { grupo: "Gestão de Documentos", items: [
    { key: "criarDocumento",          label: "Criar / editar documento" },
    { key: "assinarElaborador",       label: "Assinar como Elaborador" },
    { key: "assinarRevisorAprovador", label: "Assinar como Revisor / Aprovador" },
    { key: "excluirDocumento",        label: "Excluir documento" },
    { key: "registrarTreinamento",    label: "Registrar treinamento" },
  ]},
  { grupo: "Outras áreas", items: [
    { key: "editarFornecedores",  label: "Criar / editar Fornecedores" },
    { key: "criarAuditorias",     label: "Criar / editar Auditorias" },
    { key: "editarClientes",      label: "Criar / editar Clientes terceiros" },
    { key: "editarIPC",           label: "Lançar IPC — Controle de processo" },
    { key: "editarIPCProdutos",   label: "Gerenciar catálogo IPC Produtos" },
  ]},
];

const PERMS_PADRAO = {
  viewer: {
    criarRNC:false, editarRNCpropria:false, editarRNCtodas:false, analisarRNC:false, aprovarRNC:false, excluirRNC:false,
    verCQMateriais:true, criarMaterialCQ:false, lancarAnalise:false, aprovarAnalise:false, editarAnalise:false, verLaudos:true, criarLaudos:false,
    criarDocumento:false, assinarElaborador:false, assinarRevisorAprovador:false, excluirDocumento:false, registrarTreinamento:false,
    editarFornecedores:false, criarAuditorias:false, editarClientes:false, editarIPC:false, editarIPCProdutos:false,
  },
  user: {
    criarRNC:true, editarRNCpropria:true, editarRNCtodas:false, analisarRNC:true, aprovarRNC:false, excluirRNC:false,
    verCQMateriais:true, criarMaterialCQ:false, lancarAnalise:true, aprovarAnalise:false, editarAnalise:false, verLaudos:false, criarLaudos:false,
    criarDocumento:true, assinarElaborador:true, assinarRevisorAprovador:false, excluirDocumento:false, registrarTreinamento:false,
    editarFornecedores:false, criarAuditorias:false, editarClientes:false, editarIPC:true, editarIPCProdutos:false,
  },
  rt: {
    criarRNC:true, editarRNCpropria:true, editarRNCtodas:true, analisarRNC:true, aprovarRNC:true, excluirRNC:true,
    verCQMateriais:true, criarMaterialCQ:true, lancarAnalise:true, aprovarAnalise:true, editarAnalise:true, verLaudos:true, criarLaudos:true,
    criarDocumento:true, assinarElaborador:true, assinarRevisorAprovador:true, excluirDocumento:false, registrarTreinamento:true,
    editarFornecedores:true, criarAuditorias:true, editarClientes:true, editarIPC:true, editarIPCProdutos:false,
  },
  keyuser: {
    criarRNC:true, editarRNCpropria:true, editarRNCtodas:true, analisarRNC:true, aprovarRNC:true, excluirRNC:true,
    verCQMateriais:true, criarMaterialCQ:true, lancarAnalise:true, aprovarAnalise:true, editarAnalise:true, verLaudos:true, criarLaudos:true,
    criarDocumento:true, assinarElaborador:true, assinarRevisorAprovador:true, excluirDocumento:true, registrarTreinamento:true,
    editarFornecedores:true, criarAuditorias:true, editarClientes:true, editarIPC:true, editarIPCProdutos:true,
  },
  admin: {
    criarRNC:true, editarRNCpropria:true, editarRNCtodas:true, analisarRNC:true, aprovarRNC:true, excluirRNC:true,
    verCQMateriais:true, criarMaterialCQ:true, lancarAnalise:true, aprovarAnalise:true, editarAnalise:true, verLaudos:true, criarLaudos:true,
    criarDocumento:true, assinarElaborador:true, assinarRevisorAprovador:true, excluirDocumento:true, registrarTreinamento:true,
    editarFornecedores:true, criarAuditorias:true, editarClientes:true, editarIPC:true, editarIPCProdutos:true,
  },
  exec: {
    criarRNC:false, editarRNCpropria:false, editarRNCtodas:false, analisarRNC:false, aprovarRNC:false, excluirRNC:false,
    verCQMateriais:false, criarMaterialCQ:false, lancarAnalise:false, aprovarAnalise:false, editarAnalise:false, verLaudos:false, criarLaudos:false,
    criarDocumento:false, assinarElaborador:false, assinarRevisorAprovador:false, excluirDocumento:false, registrarTreinamento:false,
    editarFornecedores:false, criarAuditorias:false, editarClientes:false, editarIPC:false, editarIPCProdutos:false,
  },
};

/* ─── CONTROLE DE PRODUÇÃO ───────────────────────────────────────────────────── */

const CHECKLISTS_PRODUCAO = {
  "Checklist Pesagem": [
    "Temperatura e umidade da sala dentro dos parâmetros",
    "Limpeza da sala",
    "Sanitização da sala",
    "Limpeza de utensílios",
    "Conferência dos dados da OP com o quadro de produção",
    "Colaboradores utilizando EPIs",
    "Matérias-primas de acordo com a formulação descrita na OP",
    "Balanças calibradas, em local adequado, niveladas e isentas de sujidade",
    "Matérias-primas pesadas armazenadas e identificadas adequadamente em sacos plásticos",
  ],
  "Checklist Mistura": [
    "Temperatura e umidade da sala",
    "Limpeza e sanitização da sala",
    "Limpeza e sanitização do misturador",
    "Limpeza e sanitização dos utensílios",
    "Conferência dos dados da OP com o quadro de produção",
    "Colaboradores utilizando EPIs",
    "Aspectos das matérias-primas pesadas de acordo com a especificação",
    "Matérias-primas de acordo com a formulação descrita na OP",
    "Sequência de adição das matérias-primas no misturador conforme determinado na OP",
    "Mistura armazenada, identificada, lacrada hermeticamente em sacos plásticos e acondicionada em caixas box brancas devidamente higienizadas",
    "Amostra do lote enviada para análise sensorial e densidade no CQ",
  ],
  "Encapsulamento": [
    "Temperatura e umidade da sala",
    "Limpeza e sanitização da sala",
    "Limpeza e sanitização dos utensílios",
    "Limpeza e sanitização da encapsuladora",
    "Conferência dos dados da OP com o quadro de produção",
    "Conferência das cápsulas (tamanho e cor)",
    "Conferência das etiquetas (nome do produto, nº da OP, data de fabricação e validade)",
    "Matérias-primas de acordo com a formulação descrita na OP",
    "Cápsulas travadas?",
    "Cápsulas dentro da tolerância de 7,5%?",
    "Integridade das cápsulas (telescopia, amassamentos, riscadas, manchadas, com sujidades, abertas ou qualquer outra irregularidade)",
    "Cápsulas armazenadas corretamente: identificadas, lacradas hermeticamente em sacos plásticos e acondicionadas em caixas box brancas devidamente higienizadas",
  ],
};

const TIPOS_PROCESSO = ["Checklist Pesagem","Checklist Mistura","Encapsulamento","Seleção de Cápsulas"];
const TIPO_ICONS_P   = {"Checklist Pesagem":"⚖️","Checklist Mistura":"🥄","Encapsulamento":"💊","Seleção de Cápsulas":"🔍"};
const STATUS_P_COLORS = {"Rascunho":"#94a3b8","Enviado":"#ffd166","Validado":"#2ab84a"};
const REFUGO_PADRAO = {
  "Encapsulamento":      ["Telescopia","Vazia","Mal fechada","Manchas","Amassada","Riscada","Com sujidade","Aberta"],
  "Seleção de Cápsulas": ["Telescopia","Vazia","Mal fechada","Manchas","Amassada","Riscada","Com sujidade","Aberta"],
};

function initChecklist(tipo) {
  return (CHECKLISTS_PRODUCAO[tipo]||[]).map((item,i)=>({id:i,item,status:null,obs:""}));
}

function ConfigRefugoModal({ config, onClose, toast_ }) {
  const T = useTheme(); const s = useS();
  const [local, setLocal] = useState(()=>{
    const base = {};
    ["Encapsulamento","Seleção de Cápsulas"].forEach(t=>{
      base[t] = (config[t]||REFUGO_PADRAO[t]||[]).join("\n");
    });
    return base;
  });
  const salvar = async () => {
    for (const tipo of ["Encapsulamento","Seleção de Cápsulas"]) {
      const cats = local[tipo].split("\n").map(x=>x.trim()).filter(Boolean);
      await saveCollection("producao_config_refugo", tipo.replace(/\s/g,"_"), {tipo, categorias:cats});
    }
    toast_("Configuração salva!","green");
    onClose();
  };
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",backdropFilter:"blur(6px)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}>
      <div style={{background:T.card2,border:`1px solid ${T.border2}`,borderRadius:18,padding:"1.75rem",maxWidth:520,width:"100%",maxHeight:"85vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.5rem"}}>
          <div style={{fontSize:15,fontWeight:700,color:T.text}}>⚙️ Configurar Categorias de Refugo</div>
          <button style={s.btn} onClick={onClose}>✕</button>
        </div>
        {["Encapsulamento","Seleção de Cápsulas"].map(tipo=>(
          <div key={tipo} style={{marginBottom:"1.25rem"}}>
            <label style={s.lbl}>{TIPO_ICONS_P[tipo]} {tipo}</label>
            <textarea value={local[tipo]} onChange={e=>setLocal(p=>({...p,[tipo]:e.target.value}))} rows={6} placeholder="Uma categoria por linha"
              style={{...s.inp,resize:"vertical",fontFamily:"inherit",fontSize:13,width:"100%",boxSizing:"border-box"}} />
            <div style={{fontSize:11,color:T.text3,marginTop:4}}>"Outro" é sempre exibido automaticamente.</div>
          </div>
        ))}
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:"1rem"}}>
          <button style={s.btn} onClick={onClose}>Cancelar</button>
          <button style={s.btnA} onClick={salvar}>Salvar configuração</button>
        </div>
      </div>
    </div>
  );
}

function ProcessoFormModal({ processo, user, analisesCQ, ipcRegistros, configRefugo, onSave, onClose, toast_ }) {
  const T = useTheme(); const s = useS();
  const isEdicao = !!processo?.id;
  const [saving, setSaving] = useState(false);

  const mkRefugo = (tipo) => ({
    categorias: (configRefugo[tipo]||REFUGO_PADRAO[tipo]||[]).map(n=>({nome:n,qtd:""})),
    outroDesc:"", outroQtd:"", total:0,
  });

  const [form, setForm] = useState(()=>{
    if (isEdicao) return processo;
    const tipo = "Checklist Pesagem";
    return {
      tipo, op:"", produtoOrigem:"", produtoDestino:"",
      data:tod(), operador:user.name, pesoMinimo:"", pesoMaximo:"",
      status:"Rascunho", checklist:initChecklist(tipo),
      ambientais:[], amostragens:[],
      producao:{horaInicio:"",horaFim:"",qtdProduzida:"",unidade:"cápsulas"},
      refugo:mkRefugo(tipo), paradas:[], obs:"",
    };
  });

  const set = (k,v) => setForm(p=>({...p,[k]:v}));

  const changeTipo = (tipo) => setForm(p=>({...p, tipo, checklist:initChecklist(tipo), refugo:mkRefugo(tipo)}));

  const temChecklist  = ["Checklist Pesagem","Checklist Mistura","Encapsulamento"].includes(form.tipo);
  const temProducao   = ["Encapsulamento","Seleção de Cápsulas"].includes(form.tipo);
  const temAmostragem = form.tipo === "Encapsulamento";
  const temAmbientais = form.tipo === "Encapsulamento";
  const temRefugo     = ["Encapsulamento","Seleção de Cápsulas"].includes(form.tipo);

  const analise = analisesCQ.find(a=>a.op===form.op||a.num===form.op||a.lote===form.op);
  const cqStatus = analise ? analise.conclusao : null;

  const setChecklist = (id,field,val) => set("checklist",form.checklist.map(c=>c.id===id?{...c,[field]:val}:c));
  const addAmbiental = () => set("ambientais",[...(form.ambientais||[]),{id:Date.now(),hora:new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}),temp:"",umidade:""}]);
  const rmAmbiental  = (id) => set("ambientais",form.ambientais.filter(a=>a.id!==id));
  const setAmbiental = (id,k,v) => set("ambientais",form.ambientais.map(a=>a.id===id?{...a,[k]:v}:a));
  const addAmostragem = () => set("amostragens",[...(form.amostragens||[]),{id:Date.now(),hora:new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}),peso:"",integridadeOk:null,temDesvio:false,desvioDesc:""}]);
  const rmAmostragem  = (id) => set("amostragens",form.amostragens.filter(a=>a.id!==id));
  const setAmostragem = (id,k,v) => set("amostragens",form.amostragens.map(a=>a.id===id?{...a,[k]:v}:a));
  const addParada = () => set("paradas",[...(form.paradas||[]),{id:Date.now(),inicio:"",fim:"",motivo:""}]);
  const rmParada  = (id) => set("paradas",form.paradas.filter(p=>p.id!==id));
  const setParada = (id,k,v) => set("paradas",form.paradas.map(p=>p.id===id?{...p,[k]:v}:p));
  const setRefugoQtd = (nome,val) => set("refugo",{...form.refugo,categorias:form.refugo.categorias.map(c=>c.nome===nome?{...c,qtd:val}:c)});
  const totalRefugo = (form.refugo?.categorias||[]).reduce((s,c)=>s+(Number(c.qtd)||0),0)+(Number(form.refugo?.outroQtd)||0);

  const pesoOk = (peso) => {
    if (!form.pesoMinimo&&!form.pesoMaximo) return null;
    const p = Number(peso); if(!p) return null;
    return p>=Number(form.pesoMinimo)&&p<=Number(form.pesoMaximo);
  };

  const salvar = async (novoStatus) => {
    if (!form.op.trim()) { toast_("Informe a OP.","red"); return; }
    setSaving(true);
    try {
      const id = isEdicao ? String(processo.id) : String(Date.now());
      await saveCollection("producao_processos", id, {
        ...form, id, status:novoStatus||form.status,
        refugo:{...form.refugo,total:totalRefugo},
        criadoPor:form.criadoPor||user.name, criadoEm:form.criadoEm||tod(),
        criadoTs:form.criadoTs||Date.now(), atualizadoEm:tod(),
      });
      toast_(novoStatus==="Enviado"?"Enviado para validação! ✓":"Rascunho salvo.","green");
      onSave();
    } catch { toast_("Erro ao salvar.","red"); }
    setSaving(false);
  };

  const SecTitle = ({icon,label}) => (
    <div style={{display:"flex",alignItems:"center",gap:8,margin:"1.5rem 0 .75rem",paddingBottom:8,borderBottom:`1px solid ${T.border}`}}>
      <span style={{fontSize:16}}>{icon}</span>
      <span style={{fontSize:13,fontWeight:700,color:T.text,textTransform:"uppercase",letterSpacing:".06em"}}>{label}</span>
    </div>
  );

  const ncCount   = (form.checklist||[]).filter(c=>c.status==="NC").length;
  const semStatus = (form.checklist||[]).filter(c=>c.status===null).length;

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",backdropFilter:"blur(8px)",zIndex:2000,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"1rem",overflowY:"auto"}}>
      <div style={{background:T.card2,border:`1px solid ${T.border2}`,borderRadius:20,padding:"1.75rem",maxWidth:780,width:"100%",margin:"auto",boxShadow:"0 32px 80px #000c"}}>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.5rem"}}>
          <div>
            <div style={{fontSize:16,fontWeight:800,color:T.text}}>{TIPO_ICONS_P[form.tipo]||"📋"} {isEdicao?"Editar":"Novo"} Registro</div>
            <div style={{fontSize:11,color:T.text3,marginTop:2}}>Controle de Processos — SGQ Herbamed®</div>
          </div>
          <button style={s.btn} onClick={onClose}>✕</button>
        </div>

        <SecTitle icon="📋" label="Identificação" />
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 1rem"}}>
          <F lbl="Tipo de Processo *" ch={
            <Sel value={form.tipo} onChange={e=>changeTipo(e.target.value)} disabled={isEdicao}>
              {TIPOS_PROCESSO.map(t=><option key={t} value={t}>{TIPO_ICONS_P[t]} {t}</option>)}
            </Sel>}/>
          <F lbl="Nº da OP *" ch={<Inp value={form.op} onChange={e=>set("op",e.target.value)} placeholder="Ex: OP-2026-001"/>}/>
          <F lbl="Produto de Origem" ch={<Inp value={form.produtoOrigem} onChange={e=>set("produtoOrigem",e.target.value)} placeholder="Ex: Vitamina B12 Mistura"/>}/>
          <F lbl="Produto de Destino" ch={<Inp value={form.produtoDestino} onChange={e=>set("produtoDestino",e.target.value)} placeholder="Ex: Vitamina B12 Linha Verde"/>}/>
          <F lbl="Data" ch={<Inp type="date" value={form.data} onChange={e=>set("data",e.target.value)}/>}/>
          <F lbl="Operador" ch={<Inp value={form.operador} onChange={e=>set("operador",e.target.value)}/>}/>
          {form.tipo==="Encapsulamento" && <>
            <F lbl="Peso Mínimo (mg) — conforme OP" ch={<Inp type="number" value={form.pesoMinimo} onChange={e=>set("pesoMinimo",e.target.value)} placeholder="Ex: 420"/>}/>
            <F lbl="Peso Máximo (mg) — conforme OP" ch={<Inp type="number" value={form.pesoMaximo} onChange={e=>set("pesoMaximo",e.target.value)} placeholder="Ex: 480"/>}/>
          </>}
        </div>

        {form.op && form.tipo==="Encapsulamento" && (
          <div style={{padding:"10px 14px",borderRadius:10,marginBottom:8,background:cqStatus==="Aprovado"?"#2ab84a18":cqStatus==="Reprovado"?"#ff4f6a18":"#ffd16618",border:`1px solid ${cqStatus==="Aprovado"?"#2ab84a33":cqStatus==="Reprovado"?"#ff4f6a33":"#ffd16633"}`,fontSize:12}}>
            {cqStatus==="Aprovado"&&<span style={{color:"#2ab84a",fontWeight:700}}>✓ Análise CQ: Aprovada — OP liberada para encapsulamento</span>}
            {cqStatus==="Reprovado"&&<span style={{color:"#ff4f6a",fontWeight:700}}>✗ Análise CQ: Reprovada — OP bloqueada</span>}
            {!cqStatus&&<span style={{color:"#ffd166",fontWeight:700}}>⚠ Análise CQ não localizada para esta OP</span>}
          </div>
        )}

        {/* ── ANÁLISE IPC VINCULADA ── */}
        {(() => {
          if (form.tipo !== "Encapsulamento" || !form.op) return null;
          const ipc = (ipcRegistros||[]).find(r => r.op === form.op || r.lote === form.op);
          if (!ipc) return (
            <div style={{padding:"12px 14px",borderRadius:10,marginBottom:12,background:"#ffd16610",border:"1px solid #ffd16633",fontSize:12,color:"#ffd166"}}>
              ⚠ Nenhuma análise IPC localizada para a OP <strong>{form.op}</strong>. Lance a análise no módulo IPC — Controle de Processo antes de prosseguir.
            </div>
          );
          const statusColor = ipc.status==="Liberado"?"#2ab84a":ipc.status==="Reprovado"?"#ff4f6a":"#ffd166";
          return (
            <div style={{marginBottom:16,border:`1px solid ${statusColor}44`,borderRadius:12,overflow:"hidden"}}>
              <div style={{background:`${statusColor}18`,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{fontWeight:700,fontSize:13,color:statusColor}}>🏭 Análise IPC Vinculada — {ipc.status}</div>
                <div style={{fontSize:11,color:T.text3}}>{ipc.produto} · {fmt(ipc.data)} · {ipc.resp||ipc.criadoPor}</div>
              </div>
              <div style={{padding:"12px 14px",background:T.surf}}>
                {ipc.lote && <div style={{fontSize:11,color:T.text2,marginBottom:10}}>Lote: <strong>{ipc.lote}</strong></div>}
                {(ipc.resultados||[]).length > 0 ? (
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:8}}>
                    {(ipc.resultados||[]).map((r,i) => (
                      <div key={i} style={{background:T.card,border:`1px solid ${r.conforme===false?"#ff4f6a33":r.conforme===true?"#2ab84a22":T.border}`,borderRadius:8,padding:"8px 10px"}}>
                        <div style={{fontSize:10,color:T.text3,fontWeight:700,textTransform:"uppercase",marginBottom:3}}>{r.nome||r.ensaio}</div>
                        <div style={{fontSize:14,fontWeight:700,color:r.conforme===false?"#ff4f6a":r.conforme===true?"#2ab84a":T.text}}>
                          {r.resultado||"—"}{r.unidade?` ${r.unidade}`:""}
                        </div>
                        {r.especificacao && <div style={{fontSize:10,color:T.text3,marginTop:2}}>Esp: {r.especificacao}</div>}
                        {r.conforme===false && <div style={{fontSize:10,color:"#ff4f6a",marginTop:2}}>✗ Fora do padrão</div>}
                        {r.conforme===true  && <div style={{fontSize:10,color:"#2ab84a",marginTop:2}}>✓ Conforme</div>}
                        {r.obs && <div style={{fontSize:10,color:T.text3,marginTop:2,fontStyle:"italic"}}>{r.obs}</div>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{fontSize:12,color:T.text3}}>Sem resultados registrados nesta análise.</div>
                )}
                {ipc.obs && <div style={{fontSize:11,color:T.text2,marginTop:10,fontStyle:"italic"}}>Obs: {ipc.obs}</div>}
              </div>
            </div>
          );
        })()}

        {temChecklist && <>
          <SecTitle icon="☑️" label="Checklist de Verificação"/>
          {ncCount>0&&<div style={{background:"#ff4f6a18",border:"1px solid #ff4f6a33",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#ff4f6a",marginBottom:12}}>⚠ {ncCount} item(s) não conforme(s)</div>}
          {semStatus>0&&<div style={{background:"#ffd16618",border:"1px solid #ffd16633",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#ffd166",marginBottom:12}}>📋 {semStatus} item(s) sem avaliação</div>}
          {(form.checklist||[]).map(c=>(
            <div key={c.id} style={{display:"flex",flexDirection:"column",gap:6,padding:"10px 12px",background:T.surf,borderRadius:10,marginBottom:6,border:`1px solid ${c.status==="NC"?"#ff4f6a33":c.status==="C"?"#2ab84a22":T.border}`}}>
              <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                <div style={{flex:1,fontSize:13,color:T.text,lineHeight:1.5}}>{c.item}</div>
                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  {[["C","✓ C","#2ab84a"],["NC","✗ NC","#ff4f6a"],["NA","N/A","#94a3b8"]].map(([v,l,col])=>(
                    <button key={v} onClick={()=>setChecklist(c.id,"status",c.status===v?null:v)}
                      style={{padding:"4px 10px",borderRadius:6,border:`1px solid ${c.status===v?col:T.border2}`,background:c.status===v?col+"22":"transparent",color:c.status===v?col:T.text3,cursor:"pointer",fontSize:11,fontWeight:700}}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              {c.status==="NC"&&<Inp value={c.obs} onChange={e=>setChecklist(c.id,"obs",e.target.value)} placeholder="Descreva a não conformidade..." style={{fontSize:12}}/>}
            </div>
          ))}
        </>}

        {temAmbientais && <>
          <SecTitle icon="🌡️" label="Condições Ambientais"/>
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}>
            <button style={s.btnA} onClick={addAmbiental}>+ Adicionar aferição</button>
          </div>
          {(form.ambientais||[]).length===0&&<div style={{color:T.text3,fontSize:12,textAlign:"center",padding:16}}>Nenhuma aferição registrada.</div>}
          {(form.ambientais||[]).map(a=>(
            <div key={a.id} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr auto",gap:"0 8px",alignItems:"flex-end",background:T.surf,borderRadius:10,padding:"10px 12px",marginBottom:6,border:`1px solid ${T.border}`}}>
              <F lbl="Hora" ch={<Inp value={a.hora} onChange={e=>setAmbiental(a.id,"hora",e.target.value)} placeholder="08:30"/>}/>
              <F lbl="Temperatura (°C)" ch={<Inp type="number" value={a.temp} onChange={e=>setAmbiental(a.id,"temp",e.target.value)} placeholder="22.5"/>}/>
              <F lbl="Umidade (%)" ch={<Inp type="number" value={a.umidade} onChange={e=>setAmbiental(a.id,"umidade",e.target.value)} placeholder="55"/>}/>
              <button style={{...s.btnD,marginBottom:14}} onClick={()=>rmAmbiental(a.id)}>🗑️</button>
            </div>
          ))}
        </>}

        {temProducao && <>
          <SecTitle icon="⚙️" label="Dados de Produção"/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:"0 1rem"}}>
            <F lbl="Hora Início" ch={<Inp type="time" value={form.producao?.horaInicio} onChange={e=>set("producao",{...form.producao,horaInicio:e.target.value})}/>}/>
            <F lbl="Hora Fim" ch={<Inp type="time" value={form.producao?.horaFim} onChange={e=>set("producao",{...form.producao,horaFim:e.target.value})}/>}/>
            <F lbl="Qtd Produzida" ch={<Inp type="number" value={form.producao?.qtdProduzida} onChange={e=>set("producao",{...form.producao,qtdProduzida:e.target.value})}/>}/>
            <F lbl="Unidade" ch={
              <Sel value={form.producao?.unidade} onChange={e=>set("producao",{...form.producao,unidade:e.target.value})}>
                {["cápsulas","comprimidos","sachês","frascos","latas","kg","unidades"].map(u=><option key={u}>{u}</option>)}
              </Sel>}/>
          </div>
        </>}

        {temAmostragem && <>
          <SecTitle icon="🔬" label="Amostragens — Análise de Encapsulamento"/>
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}>
            <button style={s.btnA} onClick={addAmostragem}>+ Registrar amostragem</button>
          </div>
          {(form.amostragens||[]).length===0&&<div style={{color:T.text3,fontSize:12,textAlign:"center",padding:16}}>Nenhuma amostragem registrada.</div>}
          {(form.amostragens||[]).map(a=>{
            const ok = pesoOk(a.peso);
            return (
              <div key={a.id} style={{background:T.surf,border:`1px solid ${ok===false?"#ff4f6a33":ok===true?"#2ab84a22":T.border}`,borderRadius:10,padding:"12px 14px",marginBottom:8}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1.5fr 1fr 1fr auto",gap:"0 10px",alignItems:"flex-end"}}>
                  <F lbl="Hora" ch={<Inp value={a.hora} onChange={e=>setAmostragem(a.id,"hora",e.target.value)}/>}/>
                  <F lbl={`Peso (mg)${form.pesoMinimo?` [${form.pesoMinimo}–${form.pesoMaximo}]`:""}`} ch={
                    <div style={{position:"relative"}}>
                      <Inp type="number" value={a.peso} onChange={e=>setAmostragem(a.id,"peso",e.target.value)}/>
                      {ok===true&&<span style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",color:"#2ab84a",fontSize:14}}>✓</span>}
                      {ok===false&&<span style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",color:"#ff4f6a",fontSize:14}}>✗</span>}
                    </div>}/>
                  <F lbl="Integridade" ch={
                    <Sel value={a.integridadeOk===null?"":a.integridadeOk?"ok":"nok"} onChange={e=>setAmostragem(a.id,"integridadeOk",e.target.value===""?null:e.target.value==="ok")}>
                      <option value="">—</option>
                      <option value="ok">✓ Conforme</option>
                      <option value="nok">✗ Não conforme</option>
                    </Sel>}/>
                  <F lbl="Desvio?" ch={
                    <Sel value={a.temDesvio?"sim":"nao"} onChange={e=>setAmostragem(a.id,"temDesvio",e.target.value==="sim")}>
                      <option value="nao">Não</option>
                      <option value="sim">Sim</option>
                    </Sel>}/>
                  <button style={{...s.btnD,marginBottom:14}} onClick={()=>rmAmostragem(a.id)}>🗑️</button>
                </div>
                {a.temDesvio&&<Inp value={a.desvioDesc} onChange={e=>setAmostragem(a.id,"desvioDesc",e.target.value)} placeholder="Descreva o desvio encontrado..." style={{fontSize:12,marginTop:4}}/>}
                {ok===false&&<div style={{fontSize:11,color:"#ff4f6a",marginTop:4}}>⚠ Peso fora da tolerância definida na OP</div>}
              </div>
            );
          })}
        </>}

        {temRefugo && <>
          <SecTitle icon="⚠️" label="Registro de Refugo"/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 1rem"}}>
            {(form.refugo?.categorias||[]).map(c=>(
              <F key={c.nome} lbl={c.nome} ch={<Inp type="number" value={c.qtd} onChange={e=>setRefugoQtd(c.nome,e.target.value)} placeholder="0" min="0"/>}/>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 1rem"}}>
            <F lbl="Outro — descreva" ch={<Inp value={form.refugo?.outroDesc||""} onChange={e=>set("refugo",{...form.refugo,outroDesc:e.target.value})} placeholder="Categoria não listada"/>}/>
            <F lbl="Outro — quantidade" ch={<Inp type="number" value={form.refugo?.outroQtd||""} onChange={e=>set("refugo",{...form.refugo,outroQtd:e.target.value})} placeholder="0" min="0"/>}/>
          </div>
          <div style={{background:T.surf,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <span style={{fontSize:13,color:T.text2}}>Total de refugo:</span>
            <span style={{fontSize:18,fontWeight:800,color:totalRefugo>0?"#ff4f6a":T.accent}}>{totalRefugo} {form.producao?.unidade||"unidades"}</span>
          </div>
          {form.producao?.qtdProduzida&&totalRefugo>0&&(
            <div style={{fontSize:12,color:T.text3,textAlign:"right",marginBottom:8}}>
              % refugo: <strong style={{color:T.text}}>{((totalRefugo/(Number(form.producao.qtdProduzida)+totalRefugo))*100).toFixed(1)}%</strong>
              {" · "}% aproveitamento: <strong style={{color:T.accent}}>{(100-((totalRefugo/(Number(form.producao.qtdProduzida)+totalRefugo))*100)).toFixed(1)}%</strong>
            </div>
          )}
        </>}

        {temProducao && <>
          <SecTitle icon="⏸️" label="Paradas de Produção"/>
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}>
            <button style={s.btnA} onClick={addParada}>+ Registrar parada</button>
          </div>
          {(form.paradas||[]).length===0&&<div style={{color:T.text3,fontSize:12,textAlign:"center",padding:12}}>Sem paradas registradas.</div>}
          {(form.paradas||[]).map(p=>{
            const dur = p.inicio&&p.fim ? (()=>{ const [hi,mi]=(p.inicio||"00:00").split(":").map(Number); const [hf,mf]=(p.fim||"00:00").split(":").map(Number); const d=(hf*60+mf)-(hi*60+mi); return d>0?`${d} min`:null; })() : null;
            return (
              <div key={p.id} style={{display:"grid",gridTemplateColumns:"1fr 1fr 2fr auto",gap:"0 10px",alignItems:"flex-end",background:T.surf,borderRadius:10,padding:"10px 14px",marginBottom:6,border:`1px solid ${T.border}`}}>
                <F lbl="Início" ch={<Inp type="time" value={p.inicio} onChange={e=>setParada(p.id,"inicio",e.target.value)}/>}/>
                <F lbl={dur?`Fim (${dur})`:"Fim"} ch={<Inp type="time" value={p.fim} onChange={e=>setParada(p.id,"fim",e.target.value)}/>}/>
                <F lbl="Motivo" ch={<Inp value={p.motivo} onChange={e=>setParada(p.id,"motivo",e.target.value)} placeholder="Ex: Troca de lote, manutenção..."/>}/>
                <button style={{...s.btnD,marginBottom:14}} onClick={()=>rmParada(p.id)}>🗑️</button>
              </div>
            );
          })}
        </>}

        <SecTitle icon="💬" label="Observações"/>
        <textarea value={form.obs} onChange={e=>set("obs",e.target.value)} rows={3} placeholder="Observações gerais..." style={{...s.inp,resize:"vertical",fontFamily:"inherit",fontSize:13,width:"100%",boxSizing:"border-box"}}/>

        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:"1.5rem",flexWrap:"wrap"}}>
          <button style={s.btn} onClick={onClose}>Cancelar</button>
          <button style={{...s.btn,opacity:saving?.6:1}} onClick={()=>salvar("Rascunho")} disabled={saving}>💾 Salvar Rascunho</button>
          <button style={{...s.btnA,opacity:saving?.6:1}} onClick={()=>salvar("Enviado")} disabled={saving}>
            {saving?"Salvando…":"📤 Enviar para Validação"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProcessosProducaoTab({ user, toast_ }) {
  const T = useTheme(); const s = useS();
  const isAdmin = ["admin","keyuser","rt"].includes(user.role);
  const [processos, setProcessos]         = useState([]);
  const [analisesCQ, setAnalisesCQ]       = useState([]);
  const [ipcRegistros, setIpcRegistros]   = useState([]);
  const [configRefugo, setConfigRefugo]   = useState({});
  const [modal, setModal]                 = useState(null);
  const [configModal, setConfigModal]     = useState(false);
  const [assinaturaModal, setAssinaturaModal] = useState(null);
  const [loading, setLoading]             = useState(true);
  const [filtTipo, setFiltTipo]           = useState("");
  const [filtStatus, setFiltStatus]       = useState("");
  const [filtOp, setFiltOp]               = useState("");

  useEffect(()=>{
    const u1 = subscribeCollection("producao_processos", list=>{ setProcessos(list.sort((a,b)=>(b.criadoTs||0)-(a.criadoTs||0))); setLoading(false); });
    const u2 = subscribeCollection("cq_analises", list=>setAnalisesCQ(list));
    const u4 = subscribeCollection("ipc_registros", list=>setIpcRegistros(list));
    const u3 = subscribeCollection("producao_config_refugo", list=>{ const map={}; list.forEach(c=>{map[c.tipo]=c.categorias||[];}); setConfigRefugo(map); });
    return ()=>{ u1(); u2(); u3(); u4(); };
  },[]);

  const validar = async (processo, assinatura) => {
    await saveCollection("producao_processos", String(processo.id), {
      ...processo, status:"Validado",
      validacao:{ validadoPor:assinatura.nome, cargo:assinatura.cargo, email:assinatura.email, dataHora:assinatura.timestamp, obs:"" },
    });
    toast_("Processo validado! ✓","green");
    setAssinaturaModal(null);
  };

  const excluir = async (p) => {
    if (!confirm(`Excluir "${p.tipo} — ${p.op}"?`)) return;
    await deleteFromCollection("producao_processos", String(p.id));
    toast_("Registro excluído.","red");
  };

  const lista = processos.filter(p=>
    (!filtTipo||p.tipo===filtTipo)&&
    (!filtStatus||p.status===filtStatus)&&
    (!filtOp||(p.op||"").toLowerCase().includes(filtOp.toLowerCase()))
  );

  const canEdit  = (p) => p.status!=="Validado"&&(isAdmin||p.criadoPor===user.name);
  const canValid = (p) => p.status==="Enviado"&&isAdmin;

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.25rem",flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <Sel value={filtTipo} onChange={e=>setFiltTipo(e.target.value)} style={{minWidth:180}}>
            <option value="">Todos os tipos</option>
            {TIPOS_PROCESSO.map(t=><option key={t} value={t}>{TIPO_ICONS_P[t]} {t}</option>)}
          </Sel>
          <Sel value={filtStatus} onChange={e=>setFiltStatus(e.target.value)}>
            <option value="">Todos os status</option>
            {["Rascunho","Enviado","Validado"].map(st=><option key={st}>{st}</option>)}
          </Sel>
          <Inp value={filtOp} onChange={e=>setFiltOp(e.target.value)} placeholder="Buscar OP…" style={{width:160}}/>
        </div>
        <div style={{display:"flex",gap:8}}>
          {isAdmin&&<button style={s.btn} onClick={()=>setConfigModal(true)}>⚙️ Configurar Refugo</button>}
          <button style={s.btnA} onClick={()=>setModal("new")}>+ Novo Registro</button>
        </div>
      </div>

      {loading&&<div style={{textAlign:"center",color:T.text3,padding:40}}>Carregando…</div>}
      {!loading&&lista.length===0&&(
        <div style={{textAlign:"center",padding:60,color:T.text3}}>
          <div style={{fontSize:40,marginBottom:12}}>📋</div>
          <div style={{fontSize:15,fontWeight:600,color:T.text2}}>Nenhum registro encontrado</div>
          <div style={{fontSize:13,marginTop:6}}>Clique em "+ Novo Registro" para começar.</div>
        </div>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {lista.map(p=>{
          const ncCount = (p.checklist||[]).filter(c=>c.status==="NC").length;
          const foraCount = (p.amostragens||[]).filter(a=>{
            if(!p.pesoMinimo&&!p.pesoMaximo) return false;
            const v=Number(a.peso); return v&&(v<Number(p.pesoMinimo)||v>Number(p.pesoMaximo));
          }).length;
          return (
            <div key={p.id} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"14px 18px",display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
              <div style={{fontSize:28,flexShrink:0}}>{TIPO_ICONS_P[p.tipo]||"📋"}</div>
              <div style={{flex:1,minWidth:200}}>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <span style={{fontWeight:700,color:T.text,fontSize:14}}>{p.tipo}</span>
                  <span style={{background:STATUS_P_COLORS[p.status]+"22",color:STATUS_P_COLORS[p.status],border:`1px solid ${STATUS_P_COLORS[p.status]}44`,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>{p.status}</span>
                  {ncCount>0&&<span style={{background:"#ff4f6a18",color:"#ff4f6a",border:"1px solid #ff4f6a33",borderRadius:6,padding:"2px 8px",fontSize:11}}>⚠ {ncCount} NC</span>}
                  {foraCount>0&&<span style={{background:"#ff8c4218",color:"#ff8c42",border:"1px solid #ff8c4233",borderRadius:6,padding:"2px 8px",fontSize:11}}>⚠ {foraCount} peso(s) fora</span>}
                </div>
                <div style={{fontSize:12,color:T.text2,marginTop:4}}>
                  <strong>{p.op}</strong>{p.produtoDestino&&` → ${p.produtoDestino}`} · {fmt(p.data)} · {p.operador}
                </div>
                {p.status==="Validado"&&p.validacao&&(
                  <div style={{fontSize:11,color:"#2ab84a",marginTop:2}}>✓ Validado por {p.validacao.validadoPor} em {new Date(p.validacao.dataHora).toLocaleDateString("pt-BR")}</div>
                )}
              </div>
              <div style={{display:"flex",gap:6,flexShrink:0}}>
                {canEdit(p)&&<button style={s.btn} onClick={()=>setModal(p)}>✏️ Editar</button>}
                {canValid(p)&&<button style={{...s.btnA,fontSize:12}} onClick={()=>setAssinaturaModal(p)}>✅ Validar</button>}
                {isAdmin&&p.status!=="Validado"&&<button style={s.btnD} onClick={()=>excluir(p)}>🗑️</button>}
              </div>
            </div>
          );
        })}
      </div>

      {modal&&(
        <ProcessoFormModal processo={modal==="new"?null:modal} user={user} analisesCQ={analisesCQ}
          ipcRegistros={ipcRegistros}
          configRefugo={configRefugo} onSave={()=>setModal(null)} onClose={()=>setModal(null)} toast_={toast_}/>
      )}
      {configModal&&isAdmin&&(
        <ConfigRefugoModal config={configRefugo} onClose={()=>setConfigModal(false)} toast_={toast_}/>
      )}
      {assinaturaModal&&(
        <AssinaturaModal user={user} titulo={`Validar: ${assinaturaModal.tipo} — ${assinaturaModal.op}`}
          onConfirm={(assin)=>validar(assinaturaModal,assin)} onClose={()=>setAssinaturaModal(null)}/>
      )}
    </div>
  );
}

/* ─── EXECUTIVE DASHBOARD ────────────────────────────────────────────────────── */
function ExecutivoDashboard({ user, rncs, fornecedores, onClose }) {
  const T = useTheme();
  const [analises, setAnalises] = useState([]);
  const [docs, setDocs] = useState([]);
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    const unsub1 = subscribeCollection("cq_analises", list => setAnalises(list));
    const unsub2 = subscribeCollection("gestao_docs", list => setDocs(list));
    const timer = setInterval(() => setClock(new Date()), 1000);
    const onKey = e => { if (e.key === "Escape" && onClose) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { unsub1(); unsub2(); clearInterval(timer); window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  const hoje = tod();
  const mes = hoje.slice(0, 7);
  const d30 = new Date(); d30.setDate(d30.getDate() + 30);
  const d30str = d30.toISOString().split("T")[0];

  // ── KPIs ──
  const rncsAbertas     = rncs.filter(r => r.status === "Aberta").length;
  const rncsVencidas    = rncs.filter(r => r.prazoAC && r.prazoAC < hoje && r.status !== "Eficaz" && r.status !== "Ineficaz").length;
  const eficaz          = rncs.filter(r => r.status === "Eficaz").length;
  const ineficaz        = rncs.filter(r => r.status === "Ineficaz").length;
  const taxaEficacia    = eficaz + ineficaz > 0 ? Math.round(eficaz / (eficaz + ineficaz) * 100) : null;
  const docsVencendo    = docs.filter(d => d.proximaRevisao && d.proximaRevisao >= hoje && d.proximaRevisao <= d30str && d.status !== "Obsoleto").length;
  const reprovMes       = analises.filter(a => (a.conclusao === "Reprovado") && a.data && a.data.startsWith(mes)).length;

  // ── Gráfico 1: RNCs por mês (últimos 6 meses) ──
  const mesesLabels = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    mesesLabels.push(d.toISOString().slice(0, 7));
  }
  const rncsPorMes = mesesLabels.map(m => ({
    mes: new Date(m + "-01").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
    Abertas:  rncs.filter(r => r.data && r.data.startsWith(m)).length,
    Eficazes: rncs.filter(r => r.data && r.data.startsWith(m) && r.status === "Eficaz").length,
  }));

  // ── Gráfico 2: Top 5 fornecedores com mais RNCs ──
  const fornMap = {};
  rncs.forEach(r => {
    if (!r.fornecedor) return;
    fornMap[r.fornecedor] = (fornMap[r.fornecedor] || 0) + 1;
  });
  const topForn = Object.entries(fornMap)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([nome, qty]) => ({ nome: nome.length > 18 ? nome.slice(0, 16) + "…" : nome, RNCs: qty }));

  // ── Gráfico 3: Materiais com mais reprovações ──
  const matMap = {};
  analises.filter(a => a.conclusao === "Reprovado").forEach(a => {
    const k = a.materialNome || "N/D";
    matMap[k] = (matMap[k] || 0) + 1;
  });
  const topMat = Object.entries(matMap)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([nome, qty]) => ({ nome: nome.length > 18 ? nome.slice(0, 16) + "…" : nome, Reprovações: qty }));

  // ── Gráfico 4: Status documentos ──
  const docStatusMap = {};
  docs.forEach(d => { if (d.status) docStatusMap[d.status] = (docStatusMap[d.status] || 0) + 1; });
  const docStatusData = Object.entries(docStatusMap).map(([name, value]) => ({ name, value }));
  const PIE_COLORS = [T.accent, T.yellow, T.blue, T.red, T.orange, T.purple];

  const C = T;
  const fmtClock = d => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const fmtDate  = d => d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  const KpiCard = ({ icon, label, value, sub, color, big }) => (
    <div style={{ background: C.card, border: `1px solid ${color}33`, borderRadius: 16, padding: "1.2rem 1.4rem", display: "flex", flexDirection: "column", gap: 6, flex: 1, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -10, right: -10, fontSize: 52, opacity: 0.06 }}>{icon}</div>
      <div style={{ fontSize: 11, color: C.text3, textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: big ? 42 : 36, fontWeight: 800, color, lineHeight: 1 }}>{value ?? "—"}</div>
      {sub && <div style={{ fontSize: 11, color: C.text2 }}>{sub}</div>}
    </div>
  );

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: C.card2, border: `1px solid ${C.border2}`, borderRadius: 10, padding: "8px 14px", fontSize: 12 }}>
        <div style={{ color: C.text2, marginBottom: 4, fontWeight: 600 }}>{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color }}>{p.name}: <strong>{p.value}</strong></div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ background: C.bg, height: "100vh", display: "flex", flexDirection: "column", fontFamily: "'DM Sans', system-ui, sans-serif", color: C.text, overflow: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* ── HEADER ── */}
      <div style={{ background: `linear-gradient(135deg,${C.surf},${C.card})`, borderBottom: `1px solid ${C.border2}`, padding: "0 2rem", height: 68, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ background: "#fff", borderRadius: 10, padding: "4px 14px", boxShadow: `0 0 18px ${C.accentGlow}` }}>
            <HerbamedLogo height={26} white={false} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text, letterSpacing: "-.01em" }}>SGQ Herbamed®</div>
            <div style={{ fontSize: 10, color: C.accent, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".1em" }}>Dashboard Executivo</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: C.text, letterSpacing: "-.02em", lineHeight: 1 }}>{fmtClock(clock)}</div>
          <div style={{ fontSize: 11, color: C.text2, marginTop: 2, textTransform: "capitalize" }}>{fmtDate(clock)}</div>
        </div>
        {onClose ? (
          <button onClick={onClose} title="Fechar apresentação (ESC)" style={{ background:"none", border:`1px solid ${C.border2}`, borderRadius:8, color:C.text3, cursor:"pointer", fontSize:11, padding:"6px 14px", fontFamily:"inherit", display:"flex", alignItems:"center", gap:6 }}>
            ✕ Fechar
          </button>
        ) : (
          <button onClick={() => { logoutUser(); window.location.reload(); }} style={{ background:"none", border:`1px solid ${C.border2}`, borderRadius:8, color:C.text3, cursor:"pointer", fontSize:11, padding:"6px 12px", fontFamily:"inherit" }}>
            🚪 Sair
          </button>
        )}
      </div>

      {/* ── BODY ── */}
      <div style={{ flex: 1, padding: "1.2rem 1.5rem 1rem", display: "flex", flexDirection: "column", gap: "1rem", overflow: "auto" }}>

        {/* ── ROW 1: KPI CARDS ── */}
        <div style={{ display: "flex", gap: "1rem" }}>
          <KpiCard icon="📋" label="RNCs Abertas"   value={rncsAbertas}  color={rncsAbertas > 0 ? C.red : C.accent}   sub={`${rncs.length} total no sistema`} />
          <KpiCard icon="⚠️" label="Prazos Vencidos" value={rncsVencidas} color={rncsVencidas > 0 ? C.yellow : C.accent} sub="Ações corretivas em atraso" />
          <KpiCard icon="✅" label="Taxa de Eficácia" value={taxaEficacia !== null ? `${taxaEficacia}%` : "—"} color={taxaEficacia >= 80 ? C.accent : taxaEficacia !== null ? C.yellow : C.text3} sub={`${eficaz} eficaz · ${ineficaz} ineficaz`} />
          <KpiCard icon="🗂️" label="Docs p/ Revisão"  value={docsVencendo}  color={docsVencendo > 0 ? C.orange : C.accent} sub="Vencendo em 30 dias" />
          <KpiCard icon="🧪" label="Reprovações CQ"   value={reprovMes}     color={reprovMes > 0 ? C.red : C.accent}     sub="Análises reprovadas no mês" />
        </div>

        {/* ── ROW 2: CHARTS ── */}
        <div style={{ display: "flex", gap: "1rem", flex: 1 }}>

          {/* RNCs por mês */}
          <div style={{ flex: 2, background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "1.2rem 1.4rem", display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 4 }}>📊 RNCs por Mês</div>
            <div style={{ fontSize: 10, color: C.text3, marginBottom: 14 }}>Últimos 6 meses</div>
            <div style={{ flex: 1, minHeight: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rncsPorMes} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                  <XAxis dataKey="mes" tick={{ fill: C.text2, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: C.text2, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <RcTooltip content={<CustomTooltip />} cursor={{ fill: C.accentDim }} />
                  <Bar dataKey="Abertas"  fill={C.red}    radius={[5,5,0,0]} />
                  <Bar dataKey="Eficazes" fill={C.accent} radius={[5,5,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
              {[["Abertas", C.red], ["Eficazes", C.accent]].map(([l, c]) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.text2 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: c }} />{l}
                </div>
              ))}
            </div>
          </div>

          {/* Top Fornecedores */}
          <div style={{ flex: 1.2, background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "1.2rem 1.4rem", display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 4 }}>🏭 Top Fornecedores</div>
            <div style={{ fontSize: 10, color: C.text3, marginBottom: 14 }}>Por número de RNCs</div>
            {topForn.length === 0 ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: C.text3, fontSize: 12 }}>Sem dados</div>
            ) : (
              <div style={{ flex: 1, minHeight: 140 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topForn} layout="vertical" barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
                    <XAxis type="number" tick={{ fill: C.text2, fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="nome" tick={{ fill: C.text2, fontSize: 11 }} axisLine={false} tickLine={false} width={100} />
                    <RcTooltip content={<CustomTooltip />} cursor={{ fill: C.accentDim }} />
                    <Bar dataKey="RNCs" fill={C.orange} radius={[0,5,5,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* ── ROW 3: CHARTS ── */}
        <div style={{ display: "flex", gap: "1rem", flex: 1 }}>

          {/* Materiais Reprovados */}
          <div style={{ flex: 2, background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "1.2rem 1.4rem", display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 4 }}>🧪 Materiais com Mais Reprovações</div>
            <div style={{ fontSize: 10, color: C.text3, marginBottom: 14 }}>Histórico acumulado de análises reprovadas</div>
            {topMat.length === 0 ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: C.text3, fontSize: 12 }}>Sem reprovações registradas ✓</div>
            ) : (
              <div style={{ flex: 1, minHeight: 130 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topMat} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                    <XAxis dataKey="nome" tick={{ fill: C.text2, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: C.text2, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <RcTooltip content={<CustomTooltip />} cursor={{ fill: C.accentDim }} />
                    <Bar dataKey="Reprovações" fill={C.red} radius={[5,5,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Status Documentos */}
          <div style={{ flex: 1.2, background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "1.2rem 1.4rem", display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 4 }}>🗂️ Status dos Documentos</div>
            <div style={{ fontSize: 10, color: C.text3, marginBottom: 14 }}>{docs.length} documento(s) no sistema</div>
            {docStatusData.length === 0 ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: C.text3, fontSize: 12 }}>Nenhum documento</div>
            ) : (
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "1rem", minHeight: 130 }}>
                <div style={{ flex: 1, height: "100%" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={docStatusData} dataKey="value" cx="50%" cy="50%" innerRadius="40%" outerRadius="70%" paddingAngle={3}>
                        {docStatusData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <RcTooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
                  {docStatusData.map((d, i) => (
                    <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                      <span style={{ color: C.text2 }}>{d.name}</span>
                      <span style={{ color: C.text, fontWeight: 700, marginLeft: "auto", paddingLeft: 8 }}>{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", fontSize: 10, color: C.text3, paddingBottom: 4 }}>
          SGQ Herbamed® · Dados em tempo real · Atualizado às {fmtClock(clock)}
        </div>
      </div>
    </div>
  );
}

/* ─── ADMIN TAB ──────────────────────────────────────────────────────────────── */
function AdminTab({ users, setUsers, toast_, currentUser }) {
  const T = useTheme(); const s = useS();
  const [nu, setNu] = useState({ name:"", email:"", pw:"Herbamed@2025", role:"user", setor:"", crf:"" });
  const [nuPermissoes, setNuPermissoes] = useState({ ...PERMS_PADRAO["user"] });
  const [nuAssinatura, setNuAssinatura] = useState(null);
  const [nuAssinaturaUploading, setNuAssinaturaUploading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editData, setEditData] = useState({});
  const [editAssinatura, setEditAssinatura] = useState(null);
  const [editAssinaturaUploading, setEditAssinaturaUploading] = useState(false);
  const set = (k,v) => setNu(p=>({...p,[k]:v}));
  const setRole = (role) => { set("role", role); setNuPermissoes({ ...PERMS_PADRAO[role] }); };
  const togglePerm = (key) => setNuPermissoes(p => ({ ...p, [key]: !p[key] }));

  const uploadAssinatura = async (file, setImg, setLoading) => {
    if(!file) return;
    setLoading(true);
    try {
      const result = await uploadToCloudinary(file);
      setImg(result.url);
      toast_("Assinatura enviada!", "green");
    } catch { toast_("Erro ao enviar assinatura.", "red"); }
    setLoading(false);
  };

  const addUser = async () => {
    if(!nu.name||!nu.email||!nu.pw) { alert("Nome, e-mail e senha são obrigatórios."); return; }
    if(users.find(u=>u.email===nu.email)) { alert("E-mail já cadastrado."); return; }
    try {
      const cred = await createAuthUser(nu.email, nu.pw);
      const userData = { name:nu.name, email:nu.email, role:nu.role, setor:nu.setor, crf:nu.crf||"", permissoes:nuPermissoes, ...(nuAssinatura?{assinatura:nuAssinatura}:{}) };
      await saveUser(cred.user.uid, userData);
      setUsers([...users, { ...userData, id:cred.user.uid }]);
      setNu({ name:"", email:"", pw:"Herbamed@2025", role:"user", setor:"", crf:"" });
      setNuPermissoes({ ...PERMS_PADRAO["user"] });
      setNuAssinatura(null);
      toast_("Usuário criado com sucesso!", "green");
    } catch(e) { toast_("Erro: "+e.message, "red"); }
  };

  const startEdit = (u) => {
    setEditing(u.id);
    setEditData({ name:u.name, setor:u.setor||"", role:u.role, crf:u.crf||"" });
    setEditAssinatura(u.assinatura||null);
  };

  const saveEdit = async (uid) => {
    try {
    const data = { ...editData, ...(editAssinatura?{assinatura:editAssinatura}:{assinatura:null}) };
    await updateUser(uid, data);
    setUsers(users.map(u=>u.id===uid?{...u,...data}:u));
    setEditing(null);
    toast_("Usuário atualizado!", "green");
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const delUser = async (uid) => {
    if(uid===currentUser.uid) { alert("Você não pode excluir seu próprio usuário."); return; }
    if(!confirm("Remover este usuário do sistema?")) return;
    await fbDeleteUser(uid);
    setUsers(users.filter(u=>u.id!==uid));
    toast_("Usuário removido.", "red");
  };

  const {paginated:_usrs,page:_pgU,total:_totU,setPage:_setPgU} = usePagination(users||[], 20);
  return (
    <div>
      <div style={s.card}>
        <SecTitle icon="👥" ch={`Usuários do sistema (${users.length})`} />
        {_usrs.map(u=>(
          <div key={u.id} style={{ background:T.surf, border:`1px solid ${T.border}`, borderRadius:10, marginBottom:10, overflow:"hidden" }}>
            {editing===u.id ? (
              <div style={{ padding:"1rem" }}>
                <G3 ch={<>
                  <F lbl="Nome" ch={<Inp value={editData.name} onChange={e=>setEditData(p=>({...p,name:e.target.value}))} />} />
                  <F lbl="Setor" ch={<Inp value={editData.setor} onChange={e=>setEditData(p=>({...p,setor:e.target.value}))} />} />
                  {editData.role === "rt" && <F lbl="CRF" ch={<Inp placeholder="Ex: CRF-SP 12345" value={editData.crf||""} onChange={e=>setEditData(p=>({...p,crf:e.target.value}))} />} />}
                  <F lbl="Perfil" ch={<Sel value={editData.role} onChange={e=>setEditData(p=>({...p,role:e.target.value}))}>
                    <option value="admin">Admin — acesso total</option>
                    <option value="user">Usuário — cria e edita suas RNCs</option>
                    <option value="viewer">Visualizador — apenas leitura</option>
                    <option value="keyuser">Key User — edita qualquer RNC</option>
                    <option value="rt">RT — Responsável Técnico</option>
                    <option value="exec">Executivo — Dashboard gerencial</option>
                  </Sel>} />
                </>} />

                {/* Assinatura */}
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:11, color:T.text3, fontWeight:600, textTransform:"uppercase", letterSpacing:".06em", marginBottom:8 }}>Assinatura (opcional)</div>
                  {editAssinatura ? (
                    <div style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", background:T.card, border:`1px solid ${T.border}`, borderRadius:8 }}>
                      <img src={editAssinatura} alt="Assinatura" style={{ height:48, maxWidth:200, objectFit:"contain", background:"#fff", padding:4, borderRadius:4 }} />
                      <button style={s.btnD} onClick={()=>setEditAssinatura(null)}>Remover</button>
                    </div>
                  ) : (
                    <div style={{ border:`2px dashed ${T.border2}`, borderRadius:8, padding:"1rem", textAlign:"center", cursor:"pointer" }}
                      onClick={()=>document.getElementById(`edit-ass-${u.id}`).click()}>
                      <div style={{ fontSize:12, color:T.text3 }}>{editAssinaturaUploading?"Enviando...":"Clique para adicionar assinatura (PNG/JPG — fundo branco)"}</div>
                      <input id={`edit-ass-${u.id}`} type="file" accept="image/*" style={{ display:"none" }} onChange={e=>uploadAssinatura(e.target.files[0], setEditAssinatura, setEditAssinaturaUploading)} />
                    </div>
                  )}
                </div>

                <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
                  <button style={s.btn} onClick={()=>setEditing(null)}>Cancelar</button>
                  <button style={s.btnA} onClick={()=>saveEdit(u.id)}>Salvar alterações</button>
                </div>
              </div>
            ) : (
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 16px" }}>
                <div style={{ display:"flex", gap:14, alignItems:"center" }}>
                  <div style={{ width:40, height:40, borderRadius:"50%", background:u.role==="admin"?`linear-gradient(135deg,${T.accent},${T.accent2})`:T.border, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:700, color:u.role==="admin"?"#fff":T.text2, flexShrink:0 }}>{u.name?.[0]||"?"}</div>
                  <div>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{u.name}</div>
                      {u.assinatura && <span style={{ fontSize:10, color:T.accent, background:T.accentDim, padding:"1px 8px", borderRadius:20 }}>✓ Assinatura</span>}

                      {(() => {
                        const agora = Date.now();
                        const ultimo = u.ultimoAcesso ? new Date(u.ultimoAcesso).getTime() : null;
                        const diffMin = ultimo ? Math.floor((agora - ultimo) / 60000) : null;
                        const online = u.online && diffMin !== null && diffMin < 5;
                        const cor = online ? "#2ab84a" : diffMin !== null && diffMin < 60 ? "#ffd166" : "#888";
                        const bg  = online ? "#2ab84a18" : diffMin !== null && diffMin < 60 ? "#ffd16618" : "#88888818";
                        const dot = online ? "🟢" : diffMin !== null && diffMin < 60 ? "🟡" : "⚫";
                        const label = online ? "Online agora"
                          : diffMin === null ? "Nunca acessou"
                          : diffMin < 60 ? `Há ${diffMin} min`
                          : diffMin < 1440 ? `Há ${Math.floor(diffMin/60)}h`
                          : `Há ${Math.floor(diffMin/1440)}d`;
                        return (
                          <span style={{ fontSize:10, padding:"2px 8px", borderRadius:12, background:bg, color:cor, fontWeight:600, display:"inline-flex", alignItems:"center", gap:3, whiteSpace:"nowrap" }}>
                            {dot} {label}
                          </span>
                        );
                      })()}
                    </div>
                    <div style={{ fontSize:11, color:T.text2 }}>{u.email} · {u.setor||"—"}</div>
                  </div>
                </div>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <span style={{ display:"inline-flex", padding:"3px 10px", borderRadius:20, fontSize:10, fontWeight:700, background:u.role==="admin"?T.accentDim:u.role==="viewer"?"#4fc3f718":u.role==="rt"?"#ff980018":u.role==="keyuser"?"#9c27b018":T.border, color:u.role==="admin"?T.accent:u.role==="viewer"?"#4fc3f7":u.role==="rt"?"#ff9800":u.role==="keyuser"?"#9c27b0":T.text2 }}>
                    {u.role==="admin"?"Admin":u.role==="viewer"?"👁️ Visualizador":u.role==="rt"?"🔬 RT":u.role==="keyuser"?"⭐ Key User":"Usuário"}
                  </span>
                  <button style={{ ...s.btn, padding:"6px 12px", fontSize:11 }} onClick={()=>startEdit(u)}><span className="btn-emoji">✏️ </span>Editar</button>
                  {u.id!==currentUser.uid && <button style={{ ...s.btnD, padding:"6px 12px", fontSize:11 }} onClick={()=>delUser(u.id)}>🗑️ Remover</button>}
                </div>
              </div>
            )}
          </div>
        ))}
        <Pagination page={_pgU} total={_totU} setPage={_setPgU}/>
      </div>

      <div style={s.card}>
        <SecTitle icon="➕" ch="Adicionar novo usuário" />
        <div style={{ background:T.accentDim, border:`1px solid ${T.accent}25`, borderRadius:8, padding:"10px 14px", marginBottom:"1rem", fontSize:12, color:T.accent }}>
          💡 O usuário receberá acesso ao sistema com e-mail e senha definidos abaixo. Recomende trocar a senha no primeiro acesso.
        </div>
        <G2 ch={<>
          <F lbl="Nome completo" ch={<Inp placeholder="Ex: Ana Lima" value={nu.name} onChange={e=>set("name",e.target.value)} />} />
          <F lbl="E-mail" ch={<Inp type="email" placeholder="ana@herbamed.com" value={nu.email} onChange={e=>set("email",e.target.value)} />} />
          <F lbl="Senha inicial" ch={<Inp value={nu.pw} onChange={e=>set("pw",e.target.value)} />} />
          <F lbl="Setor" ch={<Inp placeholder="Ex: Produção" value={nu.setor} onChange={e=>set("setor",e.target.value)} />} />
          {nu.role === "rt" && <F lbl="CRF" ch={<Inp placeholder="Ex: CRF-SP 12345" value={nu.crf} onChange={e=>set("crf",e.target.value)} />} />}
          <F lbl="Perfil de acesso" tip="Selecione o perfil base — as permissões abaixo serão preenchidas automaticamente. Você pode ajustar individualmente." ch={<Sel value={nu.role} onChange={e=>setRole(e.target.value)}>
            <option value="user">Usuário — cria e edita suas RNCs</option>
            <option value="admin">Admin — acesso total</option>
            <option value="viewer">Visualizador — apenas leitura</option>
            <option value="keyuser">Key User — edita qualquer RNC</option>
            <option value="rt">RT — Responsável Técnico</option>
            <option value="exec">Executivo — Dashboard gerencial</option>
          </Sel>} />
        </>} />

        {/* Checklist de permissões */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, color:T.text3, fontWeight:600, textTransform:"uppercase", letterSpacing:".06em", marginBottom:8 }}>
            Permissões customizadas
          </div>
          <div style={{ fontSize:11, color:T.text2, marginBottom:10, padding:"8px 12px", background:T.accentDim, border:`1px solid ${T.accent}25`, borderRadius:8 }}>
            💡 Preenchido automaticamente pelo perfil selecionado. Ajuste individualmente se necessário. Usuários existentes não são afetados.
          </div>
          {PERMS_GRUPOS.map(grupo => (
            <div key={grupo.grupo} style={{ marginBottom:12 }}>
              <div style={{ fontSize:10, fontWeight:700, color:T.accent, textTransform:"uppercase", letterSpacing:".06em", marginBottom:6 }}>{grupo.grupo}</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:4 }}>
                {grupo.items.map(item => (
                  <label key={item.key} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 10px", background:nuPermissoes[item.key]?T.accentDim:T.surf, border:`1px solid ${nuPermissoes[item.key]?T.accent+"44":T.border}`, borderRadius:6, cursor:"pointer", transition:"all .15s" }}>
                    <input type="checkbox" checked={!!nuPermissoes[item.key]} onChange={()=>togglePerm(item.key)} style={{ accentColor:T.accent, width:14, height:14, flexShrink:0 }}/>
                    <span style={{ fontSize:11, color:nuPermissoes[item.key]?T.accent:T.text2, userSelect:"none" }}>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Assinatura opcional */}
        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:11, color:T.text3, fontWeight:600, textTransform:"uppercase", letterSpacing:".06em", marginBottom:8 }}>Assinatura (opcional)</div>
          <div style={{ fontSize:11, color:T.text3, marginBottom:8 }}>
            Escaneie ou fotografe a assinatura em papel branco e envie aqui. Será usada automaticamente nos PDFs gerados pelo usuário.
          </div>
          {nuAssinatura ? (
            <div style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", background:T.surf, border:`1px solid ${T.border}`, borderRadius:8 }}>
              <img src={nuAssinatura} alt="Assinatura" style={{ height:56, maxWidth:220, objectFit:"contain", background:"#fff", padding:4, borderRadius:4 }} />
              <button style={s.btnD} onClick={()=>setNuAssinatura(null)}>Remover</button>
            </div>
          ) : (
            <div style={{ border:`2px dashed ${T.border2}`, borderRadius:8, padding:"1rem", textAlign:"center", cursor:"pointer" }}
              onClick={()=>document.getElementById("nu-ass").click()}>
              <div style={{ fontSize:28, marginBottom:6, opacity:.4 }}>🖊️</div>
              <div style={{ fontSize:12, color:T.text2 }}>{nuAssinaturaUploading?"Enviando...":"Clique para adicionar assinatura"}</div>
              <div style={{ fontSize:11, color:T.text3, marginTop:4 }}>PNG ou JPG — fundo branco — até 2MB</div>
              <input id="nu-ass" type="file" accept="image/*" style={{ display:"none" }} onChange={e=>uploadAssinatura(e.target.files[0], setNuAssinatura, setNuAssinaturaUploading)} />
            </div>
          )}
        </div>

        <div style={{ textAlign:"right", marginTop:6 }}>
          <button style={s.btnA} onClick={addUser}>Criar usuário ✓</button>
        </div>
      </div>
    </div>
  );
}



/* ─── GESTÃO DE DOCUMENTOS — CONSTANTES ─────────────────────────────────────── */

/* ─── QUILL 2.0 RICH TEXT EDITOR ───────────────────────────────────────────── */
function QuillEditor({ value, onChange, placeholder, minHeight = 400 }) {
  const T = useTheme();
  const containerRef = React.useRef(null);
  const quillRef = React.useRef(null);
  const onChangeRef = React.useRef(onChange);
  const imgInputRef = React.useRef(null);
  onChangeRef.current = onChange;
  const [showHtml, setShowHtml] = React.useState(false);
  const [htmlInput, setHtmlInput] = React.useState("");
  const [imgUploading, setImgUploading] = React.useState(false);

  const applyHtml = () => {
    if (!htmlInput.trim()) return;
    if (quillRef.current) { quillRef.current.root.innerHTML = htmlInput; onChangeRef.current(htmlInput); }
    setShowHtml(false); setHtmlInput("");
  };

  const handleImageUpload = async (file) => {
    if (!file) return;
    setImgUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      if (quillRef.current && url) {
        const range = quillRef.current.getSelection(true);
        quillRef.current.insertEmbed(range ? range.index : 0, "image", url);
        const html = quillRef.current.root.innerHTML;
        onChangeRef.current(html);
      }
    } catch(e) { alert("Erro ao enviar imagem. Tente novamente."); }
    setImgUploading(false);
  };

  React.useEffect(() => {
    if (!containerRef.current || quillRef.current) return;
    if (!document.getElementById("quill-css")) {
      const link = document.createElement("link");
      link.id = "quill-css"; link.rel = "stylesheet";
      link.href = "https://cdn.jsdelivr.net/npm/quill@2/dist/quill.snow.css";
      document.head.appendChild(link);
    }
    const loadQuill = () => {
      if (window.Quill) { initQuill(); return; }
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/quill@2/dist/quill.js";
      script.onload = initQuill;
      document.head.appendChild(script);
    };
    const initQuill = () => {
      if (!containerRef.current || quillRef.current) return;
      const q = new window.Quill(containerRef.current, {
        theme: "snow",
        placeholder: placeholder || "Digite aqui...",
        modules: {
          toolbar: {
            container: [
              [{ header: [1, 2, 3, false] }],
              [{ size: ["small", false, "large", "huge"] }],
              ["bold", "italic", "underline", "strike"],
              [{ color: [] }, { background: [] }],
              [{ align: [] }],
              [{ list: "ordered" }, { list: "bullet" }, { indent: "-1" }, { indent: "+1" }],
              ["blockquote", "link", "image", "clean"],
            ],
            handlers: {
              image: () => { if (imgInputRef.current) imgInputRef.current.click(); }
            }
          },
        },
      });
      if (value) {
        const isHtml = value.includes("<") && value.includes(">");
        if (isHtml) { q.root.innerHTML = value; } else { q.setText(value); }
      }
      q.on("text-change", () => {
        const html = q.root.innerHTML;
        const empty = ["<p><br></p>","<p></p>",""].includes(html);
        onChangeRef.current(empty ? "" : html);
      });
      quillRef.current = q;
    };
    loadQuill();
    return () => { quillRef.current = null; };
  }, []);

  React.useEffect(() => {
    const q = quillRef.current;
    if (!q) return;
    const currentHtml = q.root.innerHTML;
    const isEmpty = ["<p><br></p>","<p></p>",""].includes(currentHtml);
    const incomingEmpty = !value || value === "";
    if (isEmpty && incomingEmpty) return;
    if (currentHtml !== value && document.activeElement !== q.root) {
      q.root.innerHTML = value || "";
    }
  }, [value]);

  return (
    <div style={{ border:"1px solid "+T.border, borderRadius:8, overflow:"hidden" }}>
      <input ref={imgInputRef} type="file" accept="image/*" style={{ display:"none" }}
        onChange={e=>{ if(e.target.files?.[0]) handleImageUpload(e.target.files[0]); e.target.value=""; }} />
      {imgUploading && <div style={{ padding:"6px 12px", background:T.accentDim, fontSize:11, color:T.accent }}>⏳ Enviando imagem...</div>}
      <style>{`
        .ql-toolbar.ql-snow { background:${T.surf}!important; border:none!important; border-bottom:1px solid ${T.border}!important; padding:6px 8px!important; flex-wrap:wrap!important; }
        .ql-container.ql-snow { background:${T.card}!important; border:none!important; }
        .ql-editor { color:${T.text}!important; font-family:Arial,sans-serif!important; font-size:13px!important; line-height:1.8!important; min-height:${minHeight}px!important; padding:16px 20px!important; }
        .ql-editor.ql-blank::before { color:${T.text3}!important; font-style:normal!important; }
        .ql-snow .ql-stroke { stroke:${T.text2}!important; }
        .ql-snow .ql-fill { fill:${T.text2}!important; }
        .ql-snow .ql-picker-label { color:${T.text2}!important; }
        .ql-snow .ql-picker-options { background:${T.card}!important; border-color:${T.border}!important; z-index:9999!important; }
        .ql-snow .ql-picker-item { color:${T.text}!important; }
        .ql-snow button:hover .ql-stroke, .ql-snow button.ql-active .ql-stroke { stroke:${T.accent}!important; }
        .ql-snow button:hover .ql-fill, .ql-snow button.ql-active .ql-fill { fill:${T.accent}!important; }
        .ql-editor table { border-collapse:collapse; width:100%; margin:10px 0; }
        .ql-editor td, .ql-editor th { border:1px solid ${T.border}; padding:6px 10px; min-width:60px; }
        .ql-editor th { background:${T.surf}; font-weight:bold; }
        .ql-editor blockquote { border-left:3px solid ${T.accent}; padding-left:12px; color:${T.text2}; margin:8px 0; }
        .ql-editor pre { background:${T.surf}; padding:10px 14px; border-radius:6px; font-size:12px; }
        .ql-editor h1 { font-size:20px; font-weight:700; margin:12px 0 6px; }
        .ql-editor h2 { font-size:16px; font-weight:700; margin:10px 0 4px; }
        .ql-editor h3 { font-size:14px; font-weight:700; margin:8px 0 4px; }
        .ql-editor ul, .ql-editor ol { padding-left:20px; margin:6px 0; }
        .ql-editor p { margin:4px 0; }
        .ql-editor img { max-width:100%; height:auto; border-radius:4px; margin:6px 0; }
      `}</style>
      <div ref={containerRef} />
      <div style={{ borderTop:"1px solid "+T.border, padding:"6px 10px", display:"flex", alignItems:"center", justifyContent:"flex-end", background:T.surf }}>
        <button onClick={()=>setShowHtml(v=>!v)} style={{ padding:"3px 10px", borderRadius:6, border:"1px solid "+T.border, background:showHtml?T.accentDim:"transparent", color:showHtml?T.accent:T.text3, cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:600 }}>
          {"</>"} Inserir HTML
        </button>
      </div>
      {showHtml && (
        <div style={{ borderTop:"1px solid "+T.border, padding:"10px 12px", background:T.surf }}>
          <div style={{ fontSize:11, color:T.text2, marginBottom:6 }}>Cole o HTML gerado (ex: wordtohtml.net). O conteúdo atual será <strong>substituído</strong>.</div>
          <textarea value={htmlInput} onChange={e=>setHtmlInput(e.target.value)} placeholder="<table><tr><td>...</td></tr></table>" style={{ width:"100%", minHeight:100, padding:"8px 10px", borderRadius:6, border:"1px solid "+T.border, background:T.card, color:T.text, fontSize:11, fontFamily:"monospace", resize:"vertical", boxSizing:"border-box" }} />
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:8 }}>
            <button onClick={()=>{setShowHtml(false);setHtmlInput("");}} style={{ padding:"5px 12px", borderRadius:6, border:"1px solid "+T.border, background:"transparent", color:T.text2, cursor:"pointer", fontFamily:"inherit", fontSize:11 }}>Cancelar</button>
            <button onClick={applyHtml} style={{ padding:"5px 14px", borderRadius:6, border:"none", background:T.accent, color:"#fff", cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:600 }}>Aplicar HTML ✓</button>
          </div>
        </div>
      )}
    </div>
  );
}

const HERBAMED_INFO_GD = {
  nome: "Herbamed Laboratório Nutracêutico LTDA",
  cnpj: "14.829.598/0001-30",
  endereco: "Av Irene Meneghetti Longhini, 500, Água do Ayero",
  cidade: "Assis/SP - Brasil",
  cep: "19816-370",
  logo: "https://res.cloudinary.com/dswsg9w0w/image/upload/484237672_1316151256653106_1151541448837719199_n1_zww2li",
};

const TIPOS_DOC_GD = [
  { id: "PO",  label: "Procedimento Operacional",  icon: "📋", cor: "#2ab84a" },
  { id: "IT",  label: "Instrução de Trabalho",      icon: "🔧", cor: "#4fc3f7" },
  { id: "MOP", label: "Manual Operacional",         icon: "📖", cor: "#a78bfa" },
  { id: "FO",  label: "Formulário",                icon: "📝", cor: "#ffd166" },
  { id: "ESP", label: "Especificação",              icon: "🧪", cor: "#ff8c42" },
  { id: "MAN", label: "Manual",                    icon: "📚", cor: "#ff4f6a" },
  { id: "ANX", label: "Anexo",                     icon: "📎", cor: "#5dd4b0" },
];

const DEPARTAMENTOS_GD = [
  { id: "SGQ", label: "Sistema de Gestão da Qualidade", cor: "#2ab84a" },
  { id: "CQ",  label: "Controle de Qualidade",          cor: "#4fc3f7" },
  { id: "PRD", label: "Produção",                       cor: "#ffd166" },
  { id: "LOG", label: "Logística",                      cor: "#ff8c42" },
  { id: "RH",  label: "Recursos Humanos",               cor: "#a78bfa" },
  { id: "COM", label: "Comercial",                      cor: "#ff4f6a" },
  { id: "ADM", label: "Administrativo",                 cor: "#5dd4b0" },
  { id: "P&D", label: "Pesquisa e Desenvolvimento",     cor: "#818cf8" },
];

const STATUS_DOC_GD = {
  "Rascunho":              { c: "#7a9c7e", bg: "#7a9c7e18", icon: "✏️" },
  "Em Revisão":            { c: "#ffd166", bg: "#ffd16618", icon: "🔄" },
  "Aguardando Aprovação":  { c: "#4fc3f7", bg: "#4fc3f718", icon: "⏳" },
  "Vigente":               { c: "#2ab84a", bg: "#2ab84a18", icon: "✅" },
  "Obsoleto":              { c: "#ff4f6a", bg: "#ff4f6a18", icon: "🗄️" },
};

const CAPITULOS_GD = [
  { id: "objetivo",         label: "1. Objetivo",                   placeholder: "Descreva o propósito deste documento..." },
  { id: "alcance",          label: "2. Alcance",                    placeholder: "Onde e a quem este documento se aplica..." },
  { id: "responsabilidades",label: "3. Responsabilidades",          placeholder: "Quem é responsável pelo quê..." },
  { id: "definicoes",       label: "4. Definições",                 placeholder: "Termos técnicos e abreviações usados..." },
  { id: "procedimento",     label: "5. Procedimento",               placeholder: "Descrição detalhada do processo..." },
  { id: "infComplementares",label: "6. Informações Complementares", placeholder: "Informações adicionais relevantes..." },
  { id: "referencias",      label: "7. Referências",                placeholder: "Normas, legislações e documentos relacionados..." },
  { id: "registros",        label: "8. Registros",                  placeholder: "Registros gerados por este procedimento..." },
  { id: "anexos",           label: "9. Anexos",                     placeholder: "Lista de anexos vinculados..." },
  { id: "historicoRevisoes", label: "10. Histórico de Revisões",    placeholder: "", special: true },
];

function gerarCodigoGD(tipo, depto, docs) {
  const prefix = `${tipo}-${depto}`;
  const existentes = docs.filter(d => d.codigo && d.codigo.startsWith(prefix)).length;
  return `${prefix}-${String(existentes + 1).padStart(3, "0")}`;
}

function calcProximaRevisaoGD(dataBase) {
  if (!dataBase) return null;
  const d = new Date(dataBase + "T12:00:00");
  d.setFullYear(d.getFullYear() + 3);
  return d.toISOString().split("T")[0];
}

function diasParaRevisaoGD(proximaRevisao) {
  if (!proximaRevisao) return null;
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const rev  = new Date(proximaRevisao + "T12:00:00");
  return Math.ceil((rev - hoje) / 86400000);
}

function BadgeStatusGD({ status }) {
  const T = useTheme();
  const m = STATUS_DOC_GD[status] || STATUS_DOC_GD["Rascunho"];
  return (
    <span style={{ padding:"3px 10px", borderRadius:20, fontSize:10, fontWeight:700, background:m.bg, color:m.c, whiteSpace:"nowrap" }}>
      {m.icon} {status}
    </span>
  );
}

function BadgeTipoGD({ tipo }) {
  const m = TIPOS_DOC_GD.find(t => t.id === tipo) || TIPOS_DOC_GD[0];
  return (
    <span style={{ padding:"3px 10px", borderRadius:6, fontSize:10, fontWeight:700, background:m.cor+"20", color:m.cor }}>
      {m.icon} {m.id}
    </span>
  );
}

function AlertaRevisaoGD({ doc }) {
  const dias = diasParaRevisaoGD(doc.proximaRevisao);
  if (!dias || dias > 90) return null;
  const vencido = dias <= 0;
  return (
    <span style={{ fontSize:10, padding:"2px 8px", borderRadius:12,
      background: vencido ? "#ff4f6a18" : "#ffd16618",
      color: vencido ? "#ff4f6a" : "#ffd166", fontWeight:700 }}>
      {vencido ? `⚠️ Vencido há ${Math.abs(dias)}d` : `⏰ Rev. em ${dias}d`}
    </span>
  );
}

/* ─── GESTÃO DE DOCUMENTOS — COMPONENTE PRINCIPAL ───────────────────────────── */
function GestaoDocumentosTab({ user, toast_, users, auditLog, perm }) {
  const T = useTheme();
  const s = useS();

  const [docs,      setDocs]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [view,      setView]      = useState("lista");
  const [sel,       setSel]       = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [buscaTxt,  setBuscaTxt]  = useState("");
  const [filtroTipo,   setFiltroTipo]   = useState("todos");
  const [filtroDepto,  setFiltroDepto]  = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [treinamentos, setTreinamentos] = useState([]);
  const [novoTreino,   setNovoTreino]   = useState({ userId:"", dataRealizacao:tod(), obs:"" });
  const [capituloAtivo, setCapituloAtivo] = useState("objetivo");
  const [novoMat, setNovoMat] = useState("");
  const entradaVazia = { versao:"", data:tod(), motivo:"", descricao:"", responsavel:user?.name||"", aprovador:"" };
  const [novaEntrada, setNovaEntrada] = useState(entradaVazia);
  const [editEntradaIdx, setEditEntradaIdx] = useState(null);
  const setE = (k,v) => setNovaEntrada(p=>({...p,[k]:v}));

  const formVazio = {
    tipo:"PO", depto:"SGQ", titulo:"", versao:"01",
    objetivo:"", alcance:"", responsabilidades:"", definicoes:"",
    procedimento:"", infComplementares:"N/A", referencias:"", registros:"", anexos:"N/A",
    etapas:[], materiais:[], obs:"", treinamentoObrigatorio:false, proximaRevisao:"",
    historicoRevisoes:[],
  };
  const [form, setForm] = useState(formVazio);
  const setF = (k,v) => setForm(p => ({...p,[k]:v}));
  const resetForm = () => { setForm(formVazio); setCapituloAtivo("objetivo"); };

  const isAdmin  = ["admin","keyuser","rt"].includes(user?.role) || (perm && (perm("criarDocumento")||perm("excluirDocumento")));
  const isViewer = user?.role === "viewer" && !(perm && perm("criarDocumento"));

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 3000);
    const unsub = subscribeCollection("gestao_docs", list => {
      clearTimeout(t);
      setDocs(list.sort((a,b) => (b.criadoTs||0)-(a.criadoTs||0)));
      setLoading(false);
    });
    return () => { clearTimeout(t); unsub && unsub(); };
  }, []);

  useEffect(() => {
    if (!sel) return;
    const unsub = subscribeCollection(`gestao_docs/${sel.id}/treinos`, list => {
      setTreinamentos(list.sort((a,b) => (b.ts||0)-(a.ts||0)));
    });
    return () => unsub && unsub();
  }, [sel?.id]);

  const salvar = async () => {
    try {
    if (!form.titulo.trim()) { alert("Informe o título."); return; }
    const id  = sel ? sel.id : Date.now();
    const codigo = sel ? sel.codigo : gerarCodigoGD(form.tipo, form.depto, docs);
    const proximaRevisao = sel?.proximaRevisao || calcProximaRevisaoGD(tod());
    let status = sel?.status || "Rascunho";
    const doc = {
      id, codigo, ...form, status, proximaRevisao,
      criadoEm:  sel?.criadoEm  || tod(),
      criadoTs:  sel?.criadoTs  || Date.now(),
      criadoPor: sel?.criadoPor || user?.name,
      atualizadoEm: tod(), atualizadoTs: Date.now(), atualizadoPor: user?.name,
      assinaturaElaborador: sel?.assinaturaElaborador || null,
      assinaturaRevisor:    sel?.assinaturaRevisor    || null,
      assinaturaAprovador:  sel?.assinaturaAprovador  || null,
      historicoRevisoes:    form.historicoRevisoes?.length ? form.historicoRevisoes : (sel?.historicoRevisoes || []),
    };
    await saveCollection("gestao_docs", String(id), doc);
    await auditLog(sel ? "Editou Documento" : "Criou Documento", "gestao_docs", id, `${codigo} — ${form.titulo}`, sel || null, doc);
    toast_(sel ? `${codigo} atualizado!` : `${codigo} criado!`, "green");
    setSel(doc); setView("detalhe");
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const assinar = async (doc, papel) => {
    try {
    const campo = papel==="elaborador" ? "assinaturaElaborador" : papel==="revisor" ? "assinaturaRevisor" : "assinaturaAprovador";
    const cargo = papel==="elaborador" ? "Elaborador" : papel==="revisor" ? "Revisor" : "Aprovador";
    if (!user?.assinatura) { alert("Você não possui assinatura cadastrada."); return; }
    if (!window.confirm(`Confirma assinatura como ${cargo}?`)) return;
    const updated = { ...doc, [campo]: { nome:user.name, cargo, crf:user.crf||"", img:user.assinatura, dataHora:`${tod()} ${new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}` } };
    const temE = papel==="elaborador" || !!doc.assinaturaElaborador;
    const temR = papel==="revisor"    || !!doc.assinaturaRevisor;
    const temA = papel==="aprovador"  || !!doc.assinaturaAprovador;
    if (temE && temR && temA) updated.status = "Vigente";
    else if (temE && temR)    updated.status = "Aguardando Aprovação";
    else if (temE)            updated.status = "Em Revisão";
    await saveCollection("gestao_docs", String(doc.id), updated);
    await auditLog(`Assinou como ${cargo}`, "gestao_docs", doc.id, `${doc.codigo} — ${doc.titulo}`, null, { status: updated.status, [campo]: updated[campo] });
    toast_(`Assinado como ${cargo}!`, "green");
    setSel(updated);
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const solicitarRevisao = async (doc) => {
    try {
    if (!window.confirm("Criar nova revisão? A versão atual será arquivada no histórico.")) return;
    const versaoAtual = doc.versao || "01";
    const novaVersao  = String(parseInt(versaoAtual,10)+1).padStart(2,"0");
    const motivo      = window.prompt("Motivo da revisão:", "") || "";
    const descricao   = window.prompt("Descrição das alterações realizadas:", "") || "";
    const aprovador   = window.prompt("Aprovador desta revisão:", "") || "";
    const historico   = [...(doc.historicoRevisoes||[]), {
      versao: versaoAtual,
      status: doc.status,
      data:   doc.atualizadoEm||doc.criadoEm,
      responsavel: doc.atualizadoPor||doc.criadoPor,
      motivo,
      descricao,
      aprovador,
    }];
    const updated = { ...doc, versao:novaVersao, status:"Em Revisão", assinaturaElaborador:null, assinaturaRevisor:null, assinaturaAprovador:null, historicoRevisoes:historico, proximaRevisao:calcProximaRevisaoGD(tod()), atualizadoEm:tod(), atualizadoTs:Date.now(), atualizadoPor:user?.name };
    await saveCollection("gestao_docs", String(doc.id), updated);
    await auditLog(`Nova Revisão — Rev.${novaVersao}`, "gestao_docs", doc.id, `${doc.codigo} — ${doc.titulo}`, { versao: versaoAtual, status: doc.status }, { versao: novaVersao, status: "Em Revisão" });
    toast_(`Revisão ${novaVersao} iniciada!`, "green");
    setSel(updated);
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const tornarObsoleto = async (doc) => {
    try {
    if (!window.confirm("Marcar como Obsoleto?")) return;
    const updated = { ...doc, status:"Obsoleto", atualizadoEm:tod(), atualizadoTs:Date.now(), atualizadoPor:user?.name };
    await saveCollection("gestao_docs", String(doc.id), updated);
    await auditLog("Marcou como Obsoleto", "gestao_docs", doc.id, `${doc.codigo} — ${doc.titulo}`, { status: doc.status }, { status: "Obsoleto" });
    toast_("Documento obsoleto.", "red");
    setSel(updated);
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const deletar = async (id) => {
    try {
    if (!window.confirm("Excluir permanentemente?")) return;
    await deleteFromCollection("gestao_docs", String(id));
    await auditLog("Excluiu Documento", "gestao_docs", id, sel?.codigo ? `${sel.codigo} — ${sel.titulo}` : String(id), sel || null, null);
    toast_("Excluído.", "red");
    setSel(null); setView("lista");
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const salvarTreino = async () => {
    try {
    if (!novoTreino.userId) { alert("Selecione o colaborador."); return; }
    const u = users?.find(x => x.id===novoTreino.userId);
    const t = { id:Date.now(), userId:novoTreino.userId, userName:u?.name||"—", userSetor:u?.setor||"—", dataRealizacao:novoTreino.dataRealizacao, obs:novoTreino.obs, registradoPor:user?.name, ts:Date.now() };
    await saveCollection(`gestao_docs/${sel.id}/treinos`, String(t.id), t);
    await auditLog("Registrou Treinamento", "gestao_docs", sel.id, `${sel.codigo} — ${sel.titulo}`, null, { colaborador: t.userName, data: t.dataRealizacao });
    toast_("Treinamento registrado!", "green");
    setNovoTreino({ userId:"", dataRealizacao:tod(), obs:"" });
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const gerarComIA = async () => {
    if (!form.titulo || !form.tipo) { alert("Preencha título e tipo antes de usar a IA."); return; }
    setAiLoading(true);
    try {
      const tipoLabel  = TIPOS_DOC_GD.find(t=>t.id===form.tipo)?.label || form.tipo;
      const deptoLabel = DEPARTAMENTOS_GD.find(d=>d.id===form.depto)?.label || form.depto;
      const prompt = `Você é especialista em qualidade farmacêutica (BPF, ANVISA RDC 658/2022, ISO 9001). Crie conteúdo completo para:\nTipo: ${tipoLabel}\nTítulo: ${form.titulo}\nDepartamento: ${deptoLabel}\nEmpresa: Herbamed Laboratório Nutracêutico LTDA\n\nResponda APENAS em JSON válido sem markdown:\n{"objetivo":"","alcance":"","responsabilidades":"","definicoes":"","procedimento":"","infComplementares":"","referencias":"","registros":"","etapas":[{"titulo":"","descricao":""}],"materiais":[""],"treinamentoObrigatorio":true}`;
      const res  = await fetch("/api/claude", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ model:"claude-sonnet-4-5", max_tokens:3000, messages:[{role:"user",content:prompt}] }) });
      const data = await res.json();
      const txt  = data.content?.[0]?.text || "";
      const parsed = JSON.parse(txt.replace(/```json|```/g,"").trim());
      setForm(f => ({ ...f, objetivo:parsed.objetivo||f.objetivo, alcance:parsed.alcance||f.alcance, responsabilidades:parsed.responsabilidades||f.responsabilidades, definicoes:parsed.definicoes||f.definicoes, procedimento:parsed.procedimento||f.procedimento, infComplementares:parsed.infComplementares||f.infComplementares, referencias:parsed.referencias||f.referencias, registros:parsed.registros||f.registros, materiais:parsed.materiais||f.materiais, etapas:(parsed.etapas||[]).map((e,i)=>({id:Date.now()+i,...e})), treinamentoObrigatorio:parsed.treinamentoObrigatorio??f.treinamentoObrigatorio }));
      toast_("Conteúdo gerado pela IA!", "green");
    } catch(e) { toast_("Erro ao gerar com IA.", "red"); }
    setAiLoading(false);
  };

  const exportPDF = (doc) => {
    const tipo  = TIPOS_DOC_GD.find(t=>t.id===doc.tipo);
    const cor   = tipo?.cor || "#2ab84a";
    const assHTML = (ass,label) => ass
      ? `<div style="text-align:center;padding:10px;border:1px solid #eee;border-radius:6px;"><div style="font-size:9px;color:#888;text-transform:uppercase;margin-bottom:4px;">${label}</div><img src="${ass.img}" style="height:36px;max-width:130px;object-fit:contain;display:block;margin:0 auto 4px;"/><div style="font-size:11px;font-weight:bold;">${ass.nome}</div>${ass.crf?`<div style="font-size:10px;color:#666;">${ass.crf}</div>`:""}<div style="font-size:9px;color:${cor};">✓ ${ass.dataHora}</div></div>`
      : `<div style="text-align:center;padding:10px;border:1px dashed #ddd;border-radius:6px;background:#fafafa;"><div style="font-size:9px;color:#888;text-transform:uppercase;">${label}</div><div style="font-size:11px;color:#ccc;padding:8px 0;">Aguardando</div></div>`;
    const caps = CAPITULOS_GD.filter(cap=>!cap.special).map(cap => `<div style="padding:8px 0;border-bottom:1px solid #f0f0f0;"><div style="font-size:9px;color:${cor};text-transform:uppercase;font-weight:bold;margin-bottom:4px;">${cap.label}</div><div style="font-size:11px;color:#333;line-height:1.7;white-space:pre-wrap;">${doc[cap.id]||"N/A"}</div></div>`).join("");
    const html = `<div style="font-family:Arial,sans-serif;max-width:800px;margin:0 auto;background:#fff;"><div style="background:linear-gradient(135deg,#1a4a2e,${cor});padding:14px 22px;display:flex;align-items:center;justify-content:space-between;"><div style="display:flex;align-items:center;gap:12px;"><img src="${HERBAMED_INFO_GD.logo}" style="width:40px;height:40px;border-radius:6px;object-fit:cover;"/><div><div style="color:#fff;font-size:13px;font-weight:bold;">${HERBAMED_INFO_GD.nome}</div><div style="color:#9fd4b2;font-size:10px;">CNPJ: ${HERBAMED_INFO_GD.cnpj}</div></div></div><div style="text-align:right;"><div style="color:#fff;font-size:12px;font-weight:bold;">${tipo?.label||doc.tipo}</div><div style="color:#9fd4b2;font-size:11px;">${doc.codigo} · Rev.${doc.versao}</div></div></div><div style="padding:12px 22px;border-bottom:2px solid ${cor}20;background:#f9fdf9;"><div style="font-size:15px;font-weight:bold;color:#1a4a2e;margin-bottom:4px;">${doc.titulo}</div><div style="font-size:11px;color:#666;">Departamento: ${doc.depto} · Elaborado: ${fmt(doc.criadoEm)} · Próx. revisão: ${fmt(doc.proximaRevisao)}</div></div><div style="padding:0 22px;">${caps}</div><div style="padding:14px 22px;border-top:2px solid ${cor}30;"><div style="font-size:9px;color:${cor};text-transform:uppercase;font-weight:bold;margin-bottom:8px;">Assinaturas</div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">${assHTML(doc.assinaturaElaborador,"Elaborador")}${assHTML(doc.assinaturaRevisor,"Revisor")}${assHTML(doc.assinaturaAprovador,"Aprovador")}</div></div><div style="padding:6px 22px;border-top:1px solid #eee;display:flex;justify-content:space-between;font-size:9px;color:#999;"><span>${HERBAMED_INFO_GD.nome}</span><span>Impresso em ${new Date().toLocaleString("pt-BR")} · Cópia Controlada</span></div></div>`;
    const win = window.open("","_blank");
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${doc.codigo}</title><style>@media print{body{margin:0}}</style></head><body>${html}<script>window.onload=()=>window.print();<\/script></body></html>`);
    win.document.close();
  };

  const filtrados = docs.filter(d => {
    if (filtroTipo   !== "todos" && d.tipo   !== filtroTipo)   return false;
    if (filtroDepto  !== "todos" && d.depto  !== filtroDepto)  return false;
    if (filtroStatus !== "todos" && d.status !== filtroStatus) return false;
    if (buscaTxt && !`${d.codigo||""} ${d.titulo||""}`.toLowerCase().includes(buscaTxt.toLowerCase())) return false;
    return true;
  });
  const {paginated:_gds,page:_pgGD,total:_totGD,setPage:_setPgGD} = usePagination(filtrados, 20);

  const totalVigente  = docs.filter(d=>d.status==="Vigente").length;
  const totalRevisao  = docs.filter(d=>["Em Revisão","Aguardando Aprovação"].includes(d.status)).length;
  const totalVencendo = docs.filter(d=>{ const dias=diasParaRevisaoGD(d.proximaRevisao); return dias!==null&&dias<=90&&d.status==="Vigente"; }).length;
  const totalObsoleto = docs.filter(d=>d.status==="Obsoleto").length;

  /* ── DETALHE ── */
  if (view==="detalhe" && sel) {
    const d = docs.find(x=>x.id===sel.id)||sel;
    const tipo  = TIPOS_DOC_GD.find(t=>t.id===d.tipo);
    const depto = DEPARTAMENTOS_GD.find(x=>x.id===d.depto);
    const diasRev = diasParaRevisaoGD(d.proximaRevisao);
    const podeAssElab  = !d.assinaturaElaborador && (isAdmin || d.criadoPor===user?.name);
    const podeAssRev   = d.assinaturaElaborador && !d.assinaturaRevisor && isAdmin;
    const podeAssAprov = d.assinaturaRevisor && !d.assinaturaAprovador && isAdmin;
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
          <button style={s.btn} onClick={()=>setView("lista")}>← Voltar</button>
          <div style={{flex:1}}>
            <div style={{fontSize:11,color:T.text3}}>{d.codigo} · Rev.{d.versao}</div>
            <div style={{fontSize:16,fontWeight:700,color:T.text}}>{d.titulo}</div>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {podeAssElab  && <button style={{...s.btnA,fontSize:11}} onClick={()=>assinar(d,"elaborador")}>✍️ Elaborador</button>}
            {podeAssRev   && <button style={{...s.btnA,fontSize:11,background:T.blue||"#4fc3f7"}} onClick={()=>assinar(d,"revisor")}>🔎 Revisor</button>}
            {podeAssAprov && <button style={{...s.btnA,fontSize:11,background:T.orange||"#ff9800"}} onClick={()=>assinar(d,"aprovador")}>✅ Aprovador</button>}
            {isAdmin && d.status==="Vigente" && <button style={{...s.btn,fontSize:11}} onClick={()=>solicitarRevisao(d)}>🔄 Nova Revisão</button>}
            {isAdmin && d.status==="Vigente" && <button style={{...s.btnD,fontSize:11}} onClick={()=>tornarObsoleto(d)}>🗄️ Obsoleto</button>}
            <button style={{...s.btn,fontSize:11}} onClick={()=>exportPDF(d)}>🖨️ PDF</button>
            {!isViewer && <button style={{...s.btn,fontSize:11}} onClick={()=>{ setSel(d); setForm({tipo:d.tipo,depto:d.depto,titulo:d.titulo,versao:d.versao,objetivo:d.objetivo||"",alcance:d.alcance||"",responsabilidades:d.responsabilidades||"",definicoes:d.definicoes||"",procedimento:d.procedimento||"",infComplementares:d.infComplementares||"N/A",referencias:d.referencias||"",registros:d.registros||"",anexos:d.anexos||"N/A",etapas:d.etapas||[],materiais:d.materiais||[],obs:d.obs||"",treinamentoObrigatorio:d.treinamentoObrigatorio||false,proximaRevisao:d.proximaRevisao||"",historicoRevisoes:d.historicoRevisoes||[]}); setView("novo"); }}>✏️ Editar</button>}
            {isAdmin && <button style={{...s.btnD,fontSize:11}} onClick={()=>deletar(d.id)}>🗑️</button>}
          </div>
        </div>
        {diasRev!==null && diasRev<=90 && d.status==="Vigente" && (
          <div style={{background:diasRev<=0?"#ff4f6a18":"#ffd16618",border:`1px solid ${diasRev<=0?"#ff4f6a":"#ffd166"}30`,borderRadius:10,padding:"10px 16px",marginBottom:12,fontSize:12,color:diasRev<=0?"#ff4f6a":"#ffd166",fontWeight:600}}>
            {diasRev<=0?`⚠️ Revisão vencida há ${Math.abs(diasRev)} dias!`:`⏰ Revisão necessária em ${diasRev} dias (${fmt(d.proximaRevisao)})`}
          </div>
        )}
        <div style={s.card}>
          <SecTitle icon="🗂️" ch="Identificação" />
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,marginBottom:12}}>
            {[["Código",d.codigo],["Versão",`Rev.${d.versao}`],["Tipo",tipo?.label||d.tipo],["Departamento",depto?.label||d.depto],["Elaborado por",d.criadoPor],["Data",fmt(d.criadoEm)],["Próx. revisão",fmt(d.proximaRevisao)],["Atualizado",fmt(d.atualizadoEm)]].map(([k,v])=>(
              <div key={k} style={{background:T.surf,borderRadius:8,padding:"8px 12px"}}>
                <div style={{fontSize:10,color:T.text3,fontWeight:700,textTransform:"uppercase",marginBottom:2}}>{k}</div>
                <div style={{fontSize:12,color:T.text,fontWeight:600}}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <BadgeTipoGD tipo={d.tipo} />
            <BadgeStatusGD status={d.status} />
            {d.treinamentoObrigatorio && <span style={{fontSize:10,padding:"3px 10px",borderRadius:20,background:(T.blue||"#4fc3f7")+"20",color:T.blue||"#4fc3f7",fontWeight:700}}>📚 Treinamento Obrigatório</span>}
          </div>
        </div>
        {d.materiais?.length>0 && (
          <div style={s.card}>
            <SecTitle icon="🧪" ch="Materiais e Equipamentos" />
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {d.materiais.map((m,i)=><span key={i} style={{fontSize:12,padding:"4px 12px",borderRadius:20,background:T.surf,border:`1px solid ${T.border}`,color:T.text}}>{m}</span>)}
            </div>
          </div>
        )}
        <div style={s.card}>
          <SecTitle icon="📑" ch="Conteúdo do Documento" />
          {CAPITULOS_GD.filter(cap=>!cap.special).map(cap=>(
            <div key={cap.id} style={{marginBottom:14}}>
              <div style={{fontSize:11,color:T.accent,fontWeight:700,textTransform:"uppercase",letterSpacing:".05em",marginBottom:5}}>{cap.label}</div>
              <div style={{padding:"10px 14px",background:T.surf,border:`1px solid ${T.border}`,borderRadius:8,fontSize:13,color:d[cap.id]&&d[cap.id]!=="N/A"?T.text:T.text3,lineHeight:1.7,fontStyle:(!d[cap.id]||d[cap.id]==="N/A")?"italic":"normal"}}
                dangerouslySetInnerHTML={{__html: d[cap.id]||"<em>N/A</em>"}} />
            </div>
          ))}
        </div>
        {d.etapas?.length>0 && (
          <div style={s.card}>
            <SecTitle icon="📋" ch="Etapas Detalhadas" />
            {d.etapas.map((e,i)=>(
              <div key={e.id||i} style={{display:"flex",gap:12,marginBottom:10,alignItems:"flex-start"}}>
                <div style={{width:28,height:28,borderRadius:"50%",background:T.accent,color:"#fff",fontSize:12,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{i+1}</div>
                <div style={{flex:1,background:T.surf,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 12px"}}>
                  {e.titulo&&<div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:3}}>{e.titulo}</div>}
                  <div style={{fontSize:12,color:T.text2,lineHeight:1.6}}>{e.descricao}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={s.card}>
          <SecTitle icon="✍️" ch="Assinaturas" />
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
            {[{campo:d.assinaturaElaborador,label:"Elaborador"},{campo:d.assinaturaRevisor,label:"Revisor"},{campo:d.assinaturaAprovador,label:"Aprovador"}].map(({campo,label})=>(
              <div key={label} style={{textAlign:"center",padding:"1rem",background:T.surf,borderRadius:10,border:`1px solid ${T.border}`}}>
                <div style={{fontSize:10,fontWeight:700,color:T.text3,textTransform:"uppercase",marginBottom:10}}>{label}</div>
                {campo?(<>
                  <img src={campo.img} alt="" style={{height:44,maxWidth:160,objectFit:"contain",display:"block",margin:"0 auto 6px"}}/>
                  <div style={{fontSize:12,fontWeight:600,color:T.text}}>{campo.nome}</div>
                  {campo.crf&&<div style={{fontSize:11,color:T.text2}}>{campo.crf}</div>}
                  <div style={{fontSize:10,color:T.accent,marginTop:4}}>✓ {campo.dataHora}</div>
                </>):(
                  <div style={{fontSize:12,color:T.text3,padding:"1rem 0"}}>Aguardando</div>
                )}
              </div>
            ))}
          </div>
        </div>
        {(d.historicoRevisoes?.length>0) && (
          <div style={s.card}>
            <SecTitle icon="🕐" ch="Histórico de Revisões" />
            <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead><tr style={{background:T.surf}}>
                {["Versão","Data","Motivo","Descrição das alterações","Responsável","Aprovador","Status"].map(h=><th key={h} style={{padding:"8px 10px",textAlign:"left",color:T.text3,fontWeight:700,fontSize:10,textTransform:"uppercase",borderBottom:`1px solid ${T.border}`,whiteSpace:"nowrap"}}>{h}</th>)}
              </tr></thead>
              <tbody>
                {d.historicoRevisoes.map((h,i)=>(
                  <tr key={i} style={{borderBottom:`1px solid ${T.border}`,background:i%2===0?T.bg:T.surf}}>
                    <td style={{padding:"8px 10px",color:T.text,fontWeight:600,whiteSpace:"nowrap"}}>Rev.{h.versao}</td>
                    <td style={{padding:"8px 10px",color:T.text2,whiteSpace:"nowrap"}}>{fmt(h.data)}</td>
                    <td style={{padding:"8px 10px",color:T.text2,maxWidth:140}}>{h.motivo||"—"}</td>
                    <td style={{padding:"8px 10px",color:T.text,maxWidth:280,lineHeight:1.5}}>{h.descricao||"—"}</td>
                    <td style={{padding:"8px 10px",color:T.text2,whiteSpace:"nowrap"}}>{h.responsavel||"—"}</td>
                    <td style={{padding:"8px 10px",color:T.text2,whiteSpace:"nowrap"}}>{h.aprovador||"—"}</td>
                    <td style={{padding:"8px 10px"}}>{h.status?<BadgeStatusGD status={h.status}/>:<span style={{color:T.text3,fontSize:11}}>—</span>}</td>
                  </tr>
                ))}
                <tr style={{background:T.accentDim}}>
                  <td style={{padding:"8px 10px",color:T.accent,fontWeight:700,whiteSpace:"nowrap"}}>Rev.{d.versao} (atual)</td>
                  <td style={{padding:"8px 10px",color:T.text2,whiteSpace:"nowrap"}}>{fmt(d.atualizadoEm)}</td>
                  <td style={{padding:"8px 10px",color:T.text3}} colSpan={3}>—</td>
                  <td style={{padding:"8px 10px",color:T.text2,whiteSpace:"nowrap"}}>{d.atualizadoPor}</td>
                  <td style={{padding:"8px 10px"}}><BadgeStatusGD status={d.status}/></td>
                </tr>
              </tbody>
            </table>
            </div>
          </div>
        )}
        {d.treinamentoObrigatorio && (
          <div style={s.card}>
            <SecTitle icon="📚" ch="Controle de Treinamentos" />
            <div style={{background:T.accentDim,border:`1px solid ${T.accent}25`,borderRadius:8,padding:"8px 14px",marginBottom:12,fontSize:12,color:T.accent}}>
              📋 Este documento requer treinamento formal dos colaboradores antes da execução.
            </div>
            {isAdmin && (
              <div style={{background:T.surf,border:`1px solid ${T.border}`,borderRadius:10,padding:"1rem",marginBottom:12}}>
                <div style={{fontSize:12,fontWeight:700,color:T.text,marginBottom:10}}>Registrar novo treinamento</div>
                <G2 ch={<>
                  <F lbl="Colaborador" ch={<Sel value={novoTreino.userId} onChange={e=>setNovoTreino(p=>({...p,userId:e.target.value}))}><option value="">Selecione...</option>{(users||[]).map(u=><option key={u.id} value={u.id}>{u.name} — {u.setor}</option>)}</Sel>} />
                  <F lbl="Data do treinamento" ch={<Inp type="date" value={novoTreino.dataRealizacao} onChange={e=>setNovoTreino(p=>({...p,dataRealizacao:e.target.value}))} />} />
                </>} />
                <F lbl="Observações" ch={<Inp placeholder="Ex: treinamento presencial..." value={novoTreino.obs} onChange={e=>setNovoTreino(p=>({...p,obs:e.target.value}))} />} />
                <div style={{textAlign:"right",marginTop:8}}><button style={s.btnA} onClick={salvarTreino}>Registrar ✓</button></div>
              </div>
            )}
            {treinamentos.length===0 ? (
              <div style={{textAlign:"center",padding:"1.5rem",color:T.text3,fontSize:12}}>Nenhum treinamento registrado.</div>
            ) : treinamentos.map(t=>(
              <div key={t.id} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 12px",background:T.surf,border:`1px solid ${T.border}`,borderRadius:8,marginBottom:6}}>
                <div style={{width:32,height:32,borderRadius:"50%",background:T.accent,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>📚</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600,color:T.text}}>{t.userName}</div>
                  <div style={{fontSize:11,color:T.text2}}>{t.userSetor} · {fmt(t.dataRealizacao)}</div>
                  {t.obs&&<div style={{fontSize:11,color:T.text3,marginTop:2}}>{t.obs}</div>}
                </div>
                <span style={{fontSize:10,color:T.accent,background:T.accentDim,padding:"2px 8px",borderRadius:12,fontWeight:700}}>✓ Treinado</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ── FORMULÁRIO ── */
  if (view==="novo") {
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
          <button style={s.btn} onClick={()=>{ if(sel)setView("detalhe"); else{setView("lista");resetForm();} }}>← Voltar</button>
          <h2 style={{fontSize:18,fontWeight:700,color:T.text,margin:0}}>{sel?`Editar — ${sel.codigo}`:"Novo Documento"}</h2>
        </div>
        <div style={{background:`linear-gradient(135deg,${T.accentDim},${T.card2})`,border:`1px solid ${T.accent}33`,borderRadius:14,padding:"1rem",marginBottom:"1rem",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:36,height:36,borderRadius:8,background:`linear-gradient(135deg,${T.accent},${T.accent2})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🤖</div>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:T.text}}>Assistente IA — Gerador de Documentos</div>
              <div style={{fontSize:11,color:T.text2}}>Gere conteúdo com IA ou importe um arquivo Word existente</div>
            </div>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <label style={{...s.btn,fontSize:11,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6,opacity:aiLoading?.6:1}}>
              📄 Importar Word
              <input type="file" accept=".docx" style={{display:"none"}} disabled={aiLoading}
                onChange={async(e)=>{
                  const file=e.target.files?.[0]; e.target.value="";
                  if(!file) return;
                  if(!form.tipo||!form.depto){alert("Selecione o tipo e departamento antes de importar.");return;}
                  setAiLoading(true);
                  try{
                    if(!window.mammoth){
                      await new Promise((res,rej)=>{
                        const s=document.createElement("script");
                        s.src="https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js";
                        s.onload=res;s.onerror=rej;document.head.appendChild(s);
                      });
                    }
                    const buf=await file.arrayBuffer();
                    const result=await window.mammoth.convertToHtml({arrayBuffer:buf});
                    const docHtml=result.value;
                    const tipoLabel=TIPOS_DOC_GD.find(t=>t.id===form.tipo)?.label||form.tipo;
                    const caps=CAPITULOS_GD.filter(c=>!c.special);
                    const capIds=caps.map(c=>c.id).join(", ");
                    const res=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},
                      body:JSON.stringify({model:"claude-sonnet-4-5",max_tokens:6000,
                        messages:[{role:"user",content:`Você é especialista em qualidade farmacêutica (BPF, ANVISA). O HTML abaixo é um documento Word convertido para ${tipoLabel}.

Distribua o conteúdo pelos capítulos: ${capIds}.
Mantenha a formatação HTML (tabelas, listas, negrito, etc).
Se um capítulo não existir no documento, coloque N/A.

Responda APENAS neste formato com delimitadores exatos (sem texto antes ou depois):
<objetivo>html aqui</objetivo>
<alcance>html aqui</alcance>
<responsabilidades>html aqui</responsabilidades>
<definicoes>html aqui</definicoes>
<procedimento>html aqui</procedimento>
<infComplementares>html aqui</infComplementares>
<referencias>html aqui</referencias>
<registros>html aqui</registros>
<anexos>html aqui</anexos>

Documento:
${docHtml.slice(0,9000)}`}]})
                    });
                    const data=await res.json();
                    const txt=data.content?.[0]?.text||"";
                    // Parse XML-style delimiters — muito mais robusto que JSON com HTML embutido
                    let imported=0;
                    caps.forEach(cap=>{
                      const re=new RegExp(`<${cap.id}>([\\s\\S]*?)<\\/${cap.id}>`,"i");
                      const m=txt.match(re);
                      if(m&&m[1]&&m[1].trim()&&m[1].trim()!=="N/A"){
                        setF(cap.id,m[1].trim());
                        imported++;
                      }
                    });
                    if(imported===0) throw new Error("Nenhum capítulo extraído. Verifique o arquivo.");
                    if(!form.titulo&&file.name) setF("titulo",file.name.replace(".docx","").replace(/_/g," "));
                    toast_(`Documento importado! ${imported} capítulo(s) preenchido(s).`,"green");
                  }catch(e){console.error(e);toast_("Erro ao importar: "+e.message,"red");}
                  setAiLoading(false);
                }}
              />
            </label>
            <button style={{...s.btnA,opacity:aiLoading?.6:1,fontSize:11}} onClick={gerarComIA} disabled={aiLoading}>
              {aiLoading?<><span style={{animation:"spin 1s linear infinite",display:"inline-block"}}>⟳</span> Aguarde...</>:"🤖 Gerar com IA"}
            </button>
          </div>
        </div>
        <div style={s.card}>
          <SecTitle icon="🗂️" ch="Identificação" />
          <G3 ch={<>
            <F lbl="Tipo" ch={<Sel value={form.tipo} onChange={e=>setF("tipo",e.target.value)}>{TIPOS_DOC_GD.map(t=><option key={t.id} value={t.id}>{t.icon} {t.label} ({t.id})</option>)}</Sel>} />
            <F lbl="Departamento" ch={<Sel value={form.depto} onChange={e=>setF("depto",e.target.value)}>{DEPARTAMENTOS_GD.map(d=><option key={d.id} value={d.id}>{d.id} — {d.label}</option>)}</Sel>} />
            <F lbl="Versão" ch={<Inp placeholder="01" value={form.versao} onChange={e=>setF("versao",e.target.value)} />} />
          </>} />
          <F lbl="Título do documento" ch={<Inp placeholder="Ex: Procedimento de Análise Microbiológica" value={form.titulo} onChange={e=>setF("titulo",e.target.value)} />} />
          {!sel && form.tipo && form.depto && <div style={{background:T.accentDim,border:`1px solid ${T.accent}25`,borderRadius:8,padding:"8px 12px",fontSize:12,color:T.accent,marginTop:4}}>💡 Código: <strong>{gerarCodigoGD(form.tipo,form.depto,docs)}</strong></div>}
          <div style={{display:"flex",alignItems:"center",gap:12,marginTop:10,padding:"10px 14px",background:T.surf,border:`1px solid ${T.border}`,borderRadius:8}}>
            <input type="checkbox" id="treino-gd" checked={form.treinamentoObrigatorio} onChange={e=>setF("treinamentoObrigatorio",e.target.checked)} style={{width:16,height:16,accentColor:T.accent}} />
            <label htmlFor="treino-gd" style={{fontSize:13,color:T.text,cursor:"pointer"}}>Treinamento obrigatório antes da execução</label>
          </div>
        </div>
        <div style={s.card}>
          <SecTitle icon="🧪" ch="Materiais e Equipamentos" />
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <Inp placeholder="Ex: Balança analítica, Pipeta..." value={novoMat} onChange={e=>setNovoMat(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();if(novoMat.trim()){setF("materiais",[...form.materiais,novoMat.trim()]);setNovoMat("");}}}} style={{flex:1}} />
            <button style={s.btnA} onClick={()=>{if(novoMat.trim()){setF("materiais",[...form.materiais,novoMat.trim()]);setNovoMat("");}}}>+ Add</button>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {form.materiais.map((m,i)=>(
              <span key={i} style={{fontSize:12,padding:"4px 10px",borderRadius:20,background:T.surf,border:`1px solid ${T.border}`,color:T.text,display:"flex",alignItems:"center",gap:6}}>
                {m}<button onClick={()=>setF("materiais",form.materiais.filter((_,idx)=>idx!==i))} style={{background:"none",border:"none",color:T.text3,cursor:"pointer",fontSize:12,padding:0}}>×</button>
              </span>
            ))}
          </div>
        </div>
        <div style={s.card}>
          <SecTitle icon="📑" ch="Capítulos Obrigatórios" />
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
            {CAPITULOS_GD.map(cap=>(
              <button key={cap.id} onClick={()=>setCapituloAtivo(cap.id)}
                style={{padding:"5px 12px",borderRadius:20,fontSize:11,fontWeight:600,border:`1px solid ${capituloAtivo===cap.id?T.accent:T.border}`,background:capituloAtivo===cap.id?T.accent:T.surf,color:capituloAtivo===cap.id?"#fff":( cap.special ? (form[cap.id]?.length>0?T.text:T.text3) : (form[cap.id]&&form[cap.id]!=="N/A"?T.text:T.text3) ),cursor:"pointer"}}>
                {(cap.special ? form[cap.id]?.length>0 : (form[cap.id]&&form[cap.id]!=="N/A"))?"✓ ":""}{cap.label.replace(/^\d+\.\s/,"")}
              </button>
            ))}
          </div>
          {CAPITULOS_GD.map(cap=>capituloAtivo===cap.id&&(
            <div key={cap.id}>
              <div style={{fontSize:12,fontWeight:700,color:T.accent,marginBottom:8}}>{cap.label}</div>
              {cap.special ? (
                /* ── Histórico de Revisões — UI estruturada ── */
                <div>
                  {/* Formulário de nova entrada */}
                  <div style={{background:T.surf,border:`1px solid ${T.border}`,borderRadius:10,padding:"1rem",marginBottom:14}}>
                    <div style={{fontSize:12,fontWeight:700,color:T.text,marginBottom:10}}>
                      {editEntradaIdx!==null ? "✏️ Editar entrada" : "➕ Nova entrada"}
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10,marginBottom:10}}>
                      <F lbl="Revisão (Rev.)" ch={<Inp placeholder="01" value={novaEntrada.versao} onChange={e=>setE("versao",e.target.value)} />} />
                      <F lbl="Data" ch={<Inp type="date" value={novaEntrada.data} onChange={e=>setE("data",e.target.value)} />} />
                      <F lbl="Responsável" ch={<Inp placeholder="Nome do responsável" value={novaEntrada.responsavel} onChange={e=>setE("responsavel",e.target.value)} />} />
                      <F lbl="Aprovador" ch={<Inp placeholder="Nome do aprovador" value={novaEntrada.aprovador} onChange={e=>setE("aprovador",e.target.value)} />} />
                    </div>
                    <F lbl="Motivo da revisão" ch={<Inp placeholder="Ex: Adequação regulatória, Melhoria de processo, Correção de erro..." value={novaEntrada.motivo} onChange={e=>setE("motivo",e.target.value)} />} />
                    <div style={{marginTop:8}}>
                      <F lbl="Descrição das alterações" ch={<textarea rows={3} placeholder="Descreva detalhadamente o que foi alterado nesta revisão..." value={novaEntrada.descricao} onChange={e=>setE("descricao",e.target.value)} style={{width:"100%",borderRadius:8,border:`1px solid ${T.border}`,padding:"8px 10px",fontSize:12,color:T.text,background:T.bg,resize:"vertical",fontFamily:"inherit",boxSizing:"border-box"}} />} />
                    </div>
                    <div style={{display:"flex",gap:8,marginTop:10}}>
                      <button style={s.btnA} onClick={()=>{
                        if(!novaEntrada.versao.trim()||!novaEntrada.data){alert("Preencha ao menos Revisão e Data.");return;}
                        const entry={...novaEntrada};
                        if(editEntradaIdx!==null){
                          const arr=[...(form.historicoRevisoes||[])];
                          arr[editEntradaIdx]=entry;
                          setF("historicoRevisoes",arr);
                          setEditEntradaIdx(null);
                        } else {
                          setF("historicoRevisoes",[...(form.historicoRevisoes||[]),entry]);
                        }
                        setNovaEntrada(entradaVazia);
                      }}>{editEntradaIdx!==null?"Salvar edição":"Adicionar entrada"}</button>
                      {editEntradaIdx!==null&&<button style={s.btn} onClick={()=>{setEditEntradaIdx(null);setNovaEntrada(entradaVazia);}}>Cancelar</button>}
                    </div>
                  </div>
                  {/* Tabela de entradas */}
                  {(form.historicoRevisoes||[]).length===0 ? (
                    <div style={{fontSize:12,color:T.text3,textAlign:"center",padding:"1rem",background:T.surf,borderRadius:8,border:`1px solid ${T.border}`}}>Nenhuma entrada registrada ainda.</div>
                  ) : (
                    <div style={{overflowX:"auto"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                        <thead><tr style={{background:T.surf}}>
                          {["Rev.","Data","Motivo","Descrição das alterações","Responsável","Aprovador",""].map((h,i)=>(
                            <th key={i} style={{padding:"8px 10px",textAlign:"left",color:T.text3,fontWeight:700,fontSize:10,textTransform:"uppercase",borderBottom:`1px solid ${T.border}`,whiteSpace:"nowrap"}}>{h}</th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {[...(form.historicoRevisoes||[])].map((h,i)=>(
                            <tr key={i} style={{borderBottom:`1px solid ${T.border}`,background:i%2===0?T.bg:T.surf}}>
                              <td style={{padding:"8px 10px",fontWeight:700,color:T.accent,whiteSpace:"nowrap"}}>Rev.{h.versao}</td>
                              <td style={{padding:"8px 10px",color:T.text2,whiteSpace:"nowrap"}}>{fmt(h.data)}</td>
                              <td style={{padding:"8px 10px",color:T.text2,maxWidth:150}}>{h.motivo||"—"}</td>
                              <td style={{padding:"8px 10px",color:T.text,maxWidth:280,lineHeight:1.5}}>{h.descricao||"—"}</td>
                              <td style={{padding:"8px 10px",color:T.text2,whiteSpace:"nowrap"}}>{h.responsavel||"—"}</td>
                              <td style={{padding:"8px 10px",color:T.text2,whiteSpace:"nowrap"}}>{h.aprovador||"—"}</td>
                              <td style={{padding:"8px 10px",whiteSpace:"nowrap"}}>
                                <button style={{...s.btn,fontSize:10,padding:"3px 8px",marginRight:4}} onClick={()=>{setNovaEntrada({...h});setEditEntradaIdx(i);}}>✏️</button>
                                <button style={{...s.btnD,fontSize:10,padding:"3px 8px"}} onClick={()=>{if(confirm("Remover esta entrada?"))setF("historicoRevisoes",(form.historicoRevisoes||[]).filter((_,idx)=>idx!==i));}}>🗑️</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div style={{display:"flex",gap:6,marginTop:12,justifyContent:"flex-end"}}>
                    {CAPITULOS_GD.indexOf(cap)>0&&<button style={{...s.btn,fontSize:11}} onClick={()=>setCapituloAtivo(CAPITULOS_GD[CAPITULOS_GD.indexOf(cap)-1].id)}>← Anterior</button>}
                  </div>
                </div>
              ) : (
              <>
              <QuillEditor value={form[cap.id]||""} onChange={v=>setF(cap.id,v)} placeholder={cap.placeholder} minHeight={400} />
              <div style={{display:"flex",gap:6,marginTop:8,justifyContent:"space-between",flexWrap:"wrap"}}>
                <div style={{display:"flex",gap:6}}>
                  <button style={{...s.btn,fontSize:11,opacity:aiLoading?.6:1}} disabled={aiLoading}
                    onClick={async()=>{
                      const txt=form[cap.id];
                      if(!txt){alert("Escreva algo primeiro.");return;}
                      setAiLoading(true);
                      try{
                        const res=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-5",max_tokens:1500,messages:[{role:"user",content:`Melhore a formatação do texto abaixo para um documento de qualidade farmacêutica (BPF). Use HTML com <p>, <strong>, <ul>, <li>, <ol>. Retorne APENAS o HTML sem markdown ou explicações.

Texto:
${txt}`}]})});
                        const data=await res.json();
                        const html=data.content?.[0]?.text||"";
                        if(html)setF(cap.id,html.replace(/\`\`\`html|\`\`\`/g,"").trim());
                        toast_("Formatação melhorada!","green");
                      }catch(e){toast_("Erro ao formatar.","red");}
                      setAiLoading(false);
                    }}>
                    {aiLoading?"⟳ ...":"✨ Melhorar formatação"}
                  </button>
                  <button style={{...s.btn,fontSize:11,opacity:aiLoading?.6:1}} disabled={aiLoading}
                    onClick={async()=>{
                      if(!form.titulo){alert("Preencha o título do documento.");return;}
                      setAiLoading(true);
                      try{
                        const res=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-5",max_tokens:1500,messages:[{role:"user",content:`Você é especialista em qualidade farmacêutica (BPF, ANVISA). Expanda e aprofunde o seguinte capítulo de um documento:

Documento: ${form.titulo}
Capítulo: ${cap.label}
Conteúdo atual: ${form[cap.id]||"(vazio)"}

Retorne APENAS o HTML expandido com <p>, <strong>, <ul>, <li>, <ol>. Sem markdown.`}]})});
                        const data=await res.json();
                        const html=data.content?.[0]?.text||"";
                        if(html)setF(cap.id,html.replace(/\`\`\`html|\`\`\`/g,"").trim());
                        toast_("Capítulo expandido!","green");
                      }catch(e){toast_("Erro ao expandir.","red");}
                      setAiLoading(false);
                    }}>
                    {aiLoading?"⟳ ...":"🔍 Expandir capítulo"}
                  </button>
                </div>
                <div style={{display:"flex",gap:6}}>
                  {CAPITULOS_GD.indexOf(cap)>0&&<button style={{...s.btn,fontSize:11}} onClick={()=>setCapituloAtivo(CAPITULOS_GD[CAPITULOS_GD.indexOf(cap)-1].id)}>← Anterior</button>}
                  {CAPITULOS_GD.indexOf(cap)<CAPITULOS_GD.length-1&&<button style={{...s.btnA,fontSize:11}} onClick={()=>setCapituloAtivo(CAPITULOS_GD[CAPITULOS_GD.indexOf(cap)+1].id)}>Próximo →</button>}
                </div>
              </div>
              </>
              )}
            </div>
          ))}
        </div>
        <div style={s.card}>
          <SecTitle icon="📋" ch="Etapas Detalhadas (opcional)" />
          {form.etapas.map((e,i)=>(
            <div key={e.id} style={{display:"flex",gap:8,marginBottom:10,alignItems:"flex-start"}}>
              <div style={{width:28,height:28,borderRadius:"50%",background:T.accent,color:"#fff",fontSize:12,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:6}}>{i+1}</div>
              <div style={{flex:1,background:T.surf,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 12px"}}>
                <Inp placeholder="Título da etapa" value={e.titulo} onChange={ev=>setF("etapas",form.etapas.map(x=>x.id===e.id?{...x,titulo:ev.target.value}:x))} style={{marginBottom:6}} />
                <TA rows={2} placeholder="Descrição..." value={e.descricao} onChange={ev=>setF("etapas",form.etapas.map(x=>x.id===e.id?{...x,descricao:ev.target.value}:x))} />
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:4,marginTop:4}}>
                {i>0&&<button style={{...s.btn,padding:"4px 8px",fontSize:11}} onClick={()=>{const arr=[...form.etapas];[arr[i-1],arr[i]]=[arr[i],arr[i-1]];setF("etapas",arr);}}>↑</button>}
                {i<form.etapas.length-1&&<button style={{...s.btn,padding:"4px 8px",fontSize:11}} onClick={()=>{const arr=[...form.etapas];[arr[i],arr[i+1]]=[arr[i+1],arr[i]];setF("etapas",arr);}}>↓</button>}
                <button style={{...s.btnD,padding:"4px 8px",fontSize:11}} onClick={()=>setF("etapas",form.etapas.filter(x=>x.id!==e.id))}>×</button>
              </div>
            </div>
          ))}
          <button style={s.btn} onClick={()=>setF("etapas",[...form.etapas,{id:Date.now(),titulo:"",descricao:""}])}>+ Adicionar etapa</button>
        </div>
        <div style={{textAlign:"right",marginBottom:"2rem"}}>
          <button style={{...s.btn,marginRight:8}} onClick={()=>{if(sel)setView("detalhe");else{setView("lista");resetForm();}}}>Cancelar</button>
          <button style={s.btnA} onClick={salvar}>Salvar documento ✓</button>
        </div>
      </div>
    );
  }

  /* ── ÁRVORE ── */
  if (view==="arvore") {
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
          <button style={s.btn} onClick={()=>setView("lista")}>← Voltar</button>
          <h2 style={{fontSize:18,fontWeight:700,color:T.text,margin:0}}>🌳 Árvore de Documentos</h2>
        </div>
        {DEPARTAMENTOS_GD.map(dep=>{
          const dd = docs.filter(d=>d.depto===dep.id);
          if (!dd.length) return null;
          return (
            <div key={dep.id} style={s.card}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                <div style={{width:10,height:10,borderRadius:"50%",background:dep.cor,flexShrink:0}}/>
                <div style={{fontSize:14,fontWeight:700,color:T.text}}>{dep.id} — {dep.label}</div>
                <span style={{fontSize:11,color:T.text3,background:T.surf,padding:"2px 8px",borderRadius:20,border:`1px solid ${T.border}`}}>{dd.length} doc{dd.length!==1?"s":""}</span>
              </div>
              <div style={{paddingLeft:20,borderLeft:`2px solid ${dep.cor}30`}}>
                {TIPOS_DOC_GD.map(tp=>{
                  const dt = dd.filter(d=>d.tipo===tp.id);
                  if (!dt.length) return null;
                  return (
                    <div key={tp.id} style={{marginBottom:10}}>
                      <div style={{fontSize:12,color:T.text2,fontWeight:600,marginBottom:6}}>{tp.icon} {tp.label}</div>
                      {dt.map(d=>(
                        <div key={d.id} onClick={()=>{setSel(d);setView("detalhe");}} className="rnc-row"
                          style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:T.surf,border:`1px solid ${T.border}`,borderRadius:8,marginBottom:4,cursor:"pointer"}}>
                          <div style={{fontSize:12,fontWeight:700,color:T.accent}}>{d.codigo}</div>
                          <div style={{flex:1,fontSize:12,color:T.text}}>{d.titulo}</div>
                          <BadgeStatusGD status={d.status}/>
                          <AlertaRevisaoGD doc={d}/>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {docs.length===0&&<div style={{textAlign:"center",padding:"3rem",color:T.text3}}><div style={{fontSize:40,marginBottom:12}}>🌳</div><div>Nenhum documento cadastrado.</div></div>}
      </div>
    );
  }

  /* ── LISTA MESTRA ── */
  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10,marginBottom:16}}>
        {[{label:"Vigentes",value:totalVigente,color:T.accent,icon:"✅"},{label:"Em Revisão",value:totalRevisao,color:T.yellow||"#ffd166",icon:"🔄"},{label:"Vencendo (90d)",value:totalVencendo,color:T.orange||"#ff8c42",icon:"⏰"},{label:"Obsoletos",value:totalObsoleto,color:T.red||"#ff4f6a",icon:"🗄️"},{label:"Total",value:docs.length,color:T.text2,icon:"📄"}].map(stat=>(
          <div key={stat.label} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"12px 14px",textAlign:"center"}}>
            <div style={{fontSize:22,marginBottom:4}}>{stat.icon}</div>
            <div style={{fontSize:22,fontWeight:800,color:stat.color}}>{stat.value}</div>
            <div style={{fontSize:10,color:T.text3,fontWeight:600,textTransform:"uppercase"}}>{stat.label}</div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          <div style={{position:"relative"}}>
            <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:T.text3,fontSize:13}}>🔍</span>
            <input placeholder="Buscar código ou título..." value={buscaTxt} onChange={e=>setBuscaTxt(e.target.value)} style={{...s.inp,paddingLeft:30,width:220,fontSize:12}} />
          </div>
          <Sel value={filtroTipo} onChange={e=>setFiltroTipo(e.target.value)}>
            <option value="todos">Todos os tipos</option>
            {TIPOS_DOC_GD.map(t=><option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
          </Sel>
          <Sel value={filtroDepto} onChange={e=>setFiltroDepto(e.target.value)}>
            <option value="todos">Todos os deptos</option>
            {DEPARTAMENTOS_GD.map(d=><option key={d.id} value={d.id}>{d.id}</option>)}
          </Sel>
          <Sel value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)}>
            <option value="todos">Todos os status</option>
            {Object.keys(STATUS_DOC_GD).map(st=><option key={st} value={st}>{STATUS_DOC_GD[st].icon} {st}</option>)}
          </Sel>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button style={s.btn} onClick={()=>setView("arvore")}>🌳 Árvore</button>
          {!isViewer&&<button style={s.btnA} onClick={()=>{setSel(null);resetForm();setView("novo");}}>+ Novo Documento</button>}
        </div>
      </div>
      {loading?(
        <div style={{textAlign:"center",padding:"3rem",color:T.text2}}>Carregando lista mestra...</div>
      ):filtrados.length===0?(
        <div style={{textAlign:"center",padding:"3rem",color:T.text3}}>
          <div style={{fontSize:40,marginBottom:12}}>🗂️</div>
          <div style={{fontSize:14}}>{docs.length===0?"Nenhum documento cadastrado.":"Nenhum resultado para os filtros."}</div>
          {docs.length===0&&<div style={{fontSize:12,marginTop:6}}>Crie o primeiro documento do sistema!</div>}
        </div>
      ):
      (<>
      {_gds.map(d=>{
        const tipo = TIPOS_DOC_GD.find(t=>t.id===d.tipo);
        return (
          <div key={d.id} className="rnc-row" onClick={()=>{setSel(d);setView("detalhe");}}
            style={{background:T.card,border:`1px solid ${T.border}`,borderLeft:`3px solid ${tipo?.cor||T.border}`,borderRadius:10,padding:"10px 14px",marginBottom:8,cursor:"pointer",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
            <div style={{width:38,height:38,borderRadius:8,background:(tipo?.cor||T.accent)+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{tipo?.icon||"📄"}</div>
            <div style={{flex:1,minWidth:150}}>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                <div style={{fontSize:12,fontWeight:700,color:tipo?.cor||T.accent}}>{d.codigo}</div>
                <div style={{fontSize:13,fontWeight:600,color:T.text}}>{d.titulo}</div>
              </div>
              <div style={{fontSize:11,color:T.text2,marginTop:2}}>
                {d.depto} · Rev.{d.versao} · {d.criadoPor} · {fmt(d.criadoEm)}
                {d.treinamentoObrigatorio&&<span style={{marginLeft:8,color:T.blue||"#4fc3f7"}}>📚</span>}
              </div>
            </div>
            <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
              <AlertaRevisaoGD doc={d}/>
              {d.assinaturaElaborador&&<span style={{fontSize:10,padding:"2px 6px",borderRadius:12,background:T.accent+"18",color:T.accent}}>✍️</span>}
              {d.assinaturaRevisor&&<span style={{fontSize:10,padding:"2px 6px",borderRadius:12,background:(T.blue||"#4fc3f7")+"18",color:T.blue||"#4fc3f7"}}>🔎</span>}
              {d.assinaturaAprovador&&<span style={{fontSize:10,padding:"2px 6px",borderRadius:12,background:(T.orange||"#ff9800")+"18",color:T.orange||"#ff9800"}}>✅</span>}
              <BadgeTipoGD tipo={d.tipo}/>
              <BadgeStatusGD status={d.status}/>
            </div>
          </div>
        );
      })
      }<Pagination page={_pgGD} total={_totGD} setPage={_setPgGD}/>
      </>
      )}
    </div>
  );
}

/* ─── TRILHA DE AUDITORIA ───────────────────────────────────────────────────── */
function AuditLogTab({ user }) {
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
      l.colecao === "rncs" ? "RNCs" : "Gestão de Docs",
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
            ["Coleção",    sel.colecao === "rncs" ? "RNCs" : "Gestão de Docs"],
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
          { label:"Documentos",    value:logs.filter(l=>l.colecao==="gestao_docs").length,icon:"🗂️", color:T.accent },
          { label:"Exclusões",     value:logs.filter(l=>l.acao?.includes("Excluiu")).length,icon:"🗑️", color:"#ff8c42" },
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
              {l.colecao==="rncs" ? "🔴" : "🗂️"}
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


import React, { createContext, useContext } from "react";

export const THEMES = {
  herbamed: {
    name: "🌿 Herbamed Verde",
    bg: "#0a110c", surf: "#101a12", card: "#141f16", card2: "#192118",
    accent: "#2ab84a", accent2: "#1a7a3c", accentDim: "#2ab84a18",
    accentGlow: "#2ab84a40", text: "#eef4ef", text2: "#7a9c7e", text3: "#3d5c42",
    border: "rgba(42,184,74,0.1)", border2: "rgba(42,184,74,0.2)",
    red: "#ff4f6a", yellow: "#ffd166", blue: "#4fc3f7", orange: "#ff8c42", purple: "#a78bfa",
    dataviz: ["#4fc3f7","#22d3ee","#818cf8","#2ab84a","#ffd166","#ff8c42","#a78bfa","#5dd4b0"],
  },
  papelQuente: {
    name: "📜 Papel Quente", light: true,
    bg: "#f7f4ee", surf: "#ffffff", card: "#ffffff", card2: "#f1ede3",
    accent: "#2f6f52", accent2: "#234f3c", accentDim: "#2f6f5216",
    accentGlow: "#2f6f5228", text: "#262019", text2: "#6b6152", text3: "#a89d89",
    border: "rgba(38,32,25,0.08)", border2: "rgba(38,32,25,0.14)",
    red: "#c1473f", yellow: "#b8862c", blue: "#3568a8", orange: "#b1652c", purple: "#7c5ea3",
    dataviz: ["#3568a8","#2f8f8a","#6a63c4","#a4527a","#b8862c","#c07a3e","#7c5ea3","#4c8f6b"],
  },
  tintaQuente: {
    name: "🔥 Tinta Quente",
    bg: "#17140f", surf: "#1d1a15", card: "#211e18", card2: "#27231c",
    accent: "#4fd18b", accent2: "#2a9b63", accentDim: "#4fd18b1a",
    accentGlow: "#4fd18b40", text: "#f2ede2", text2: "#a89f8c", text3: "#5e564a",
    border: "rgba(242,237,226,0.08)", border2: "rgba(242,237,226,0.14)",
    red: "#ff6b5c", yellow: "#f0c04f", blue: "#6fb8ff", orange: "#ffa257", purple: "#c79bff",
    dataviz: ["#6fb8ff","#5cc9c0","#9d8cff","#e08fb0","#f0c04f","#ffa257","#c79bff","#c9a15a"],
  },
  nevoaClara: {
    name: "🌫️ Névoa Clara", light: true,
    bg: "#f6f7f9", surf: "#ffffff", card: "#ffffff", card2: "#eef0f3",
    accent: "#0f9d78", accent2: "#0b7358", accentDim: "#0f9d7814",
    accentGlow: "#0f9d7828", text: "#14181c", text2: "#5b6570", text3: "#99a1ab",
    border: "rgba(15,23,31,0.07)", border2: "rgba(15,23,31,0.13)",
    red: "#e0393f", yellow: "#d99a1b", blue: "#2f7ee0", orange: "#e0762f", purple: "#8b5fe0",
    dataviz: ["#2f7ee0","#1fb0b8","#7c6fe0","#d1608f","#d99a1b","#e0762f","#8b5fe0","#5a8f6f"],
  },
  grafiteEsmeralda: {
    name: "💎 Grafite Esmeralda",
    bg: "#0c0e11", surf: "#101317", card: "#14171c", card2: "#191d23",
    accent: "#37e2a3", accent2: "#1fa876", accentDim: "#37e2a318",
    accentGlow: "#37e2a340", text: "#eef1f4", text2: "#838e99", text3: "#454c54",
    border: "rgba(255,255,255,0.06)", border2: "rgba(255,255,255,0.12)",
    red: "#ff6465", yellow: "#ffcf5c", blue: "#5aa6ff", orange: "#ff9d5c", purple: "#b18aff",
    dataviz: ["#5aa6ff","#42c2c2","#a68cff","#ff8fb3","#ffcf5c","#ff9d5c","#b18aff","#8fae8a"],
  },
  macos: {
    name: "🍎 macOS", light: true,
    bg: "#f0f0f5", surf: "#ffffff", card: "#ffffff", card2: "#f5f5fa",
    accent: "#007aff", accent2: "#0055cc", accentDim: "#007aff12",
    accentGlow: "#007aff30", text: "#1c1c1e", text2: "#6e6e73", text3: "#86868b",
    border: "rgba(0,0,0,0.08)", border2: "rgba(0,0,0,0.14)",
    red: "#ff3b30", yellow: "#ff9500", blue: "#007aff", orange: "#ff6b00", purple: "#af52de",
    dataviz: ["#4fc3f7","#22d3ee","#818cf8","#2ab84a","#ffd166","#ff8c42","#a78bfa","#5dd4b0"],
  },
  professional: {
    name: "💼 Professional", light: true,
    bg: "#f5f5f7", surf: "#ffffff", card: "#ffffff", card2: "#f9f9fb",
    accent: "#1a7a3c", accent2: "#145c2e", accentDim: "#1a7a3c15",
    accentGlow: "#1a7a3c30", text: "#1c1c1e", text2: "#6e6e73", text3: "#86868b",
    border: "rgba(0,0,0,0.08)", border2: "rgba(0,0,0,0.14)",
    red: "#d70015", yellow: "#f5a623", blue: "#0066cc", orange: "#ff6600", purple: "#7b3ff2",
    dataviz: ["#4fc3f7","#22d3ee","#818cf8","#2ab84a","#ffd166","#ff8c42","#a78bfa","#5dd4b0"],
  },
};

export const ThemeCtx = createContext(null);

export const useTheme = () => useContext(ThemeCtx);

export const FormalCtx = createContext(false);

export const useFormal = () => useContext(FormalCtx);

export function stripEmoji(str) {
  return String(str).replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{1F300}-\u{1FAFF}]/gu, "").replace(/\s+/g, " ").trim();
}

export function useFT() {
  const formal = useFormal();
  return (str) => (formal && typeof str === "string") ? stripEmoji(str) : str;
}

// Scrub container-specific: no modo Formal, remove emojis APENAS de elementos
// marcados com data-formal-scrubbable="true" (status badges, decoração).
// Identidade visual (tipo, depto, tabs, botões) preservada automaticamente.
// MutationObserver mantém sync conforme React re-renderiza.
const EMOJI_RE = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{1F300}-\u{1FAFF}\u{FE0F}\u{20E3}]/gu;

function scrubScrubbableContainers(root) {
  // Encontra todos os elementos com data-formal-scrubbable="true"
  const containers = root.querySelectorAll("[data-formal-scrubbable='true']");
  containers.forEach((container) => {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => {
        const p = n.parentNode;
        if (p && (p.nodeName === "SCRIPT" || p.nodeName === "STYLE" || p.nodeName === "TEXTAREA")) return NodeFilter.FILTER_REJECT;
        return EMOJI_RE.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    const alvos = [];
    let cur;
    while ((cur = walker.nextNode())) alvos.push(cur);
    alvos.forEach((n) => {
      const limpo = n.nodeValue
        .replace(EMOJI_RE, "")
        .replace(/ {2,}/g, " ")
        .trim();
      if (limpo !== n.nodeValue) n.nodeValue = limpo;
    });
  });
}

// Hook: liga/desliga scrub container-specific conforme o modo Formal.
export function useFormalDomScrub(formal) {
  React.useEffect(() => {
    if (!formal) return;
    let raf = 0;
    const run = () => { raf = 0; scrubScrubbableContainers(document.body); };
    const agendar = () => { if (!raf) raf = requestAnimationFrame(run); };
    scrubScrubbableContainers(document.body);
    const obs = new MutationObserver(agendar);
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => { obs.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, [formal]);
}

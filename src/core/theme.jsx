import React, { createContext, useContext } from "react";

export const THEMES = {
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

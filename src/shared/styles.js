import { useTheme } from "../core/theme";

export function useS() {
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

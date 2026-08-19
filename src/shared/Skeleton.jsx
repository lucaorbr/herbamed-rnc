import React from "react";
import { useTheme } from "../core/theme";

// Placeholders de carregamento (onda 8) — no formato real da tela em vez de um
// "Carregando..." solto. A animação de pulso mora em App.jsx (.skeleton-bar,
// já respeita prefers-reduced-motion); aqui só o layout.

function Bar({ w = "100%", h = 12, r = 6 }) {
  const T = useTheme();
  return <div className="skeleton-bar" style={{ width: w, height: h, borderRadius: r, background: T.border2, flexShrink: 0 }} />;
}

// Imita uma tabela/lista: cabeçalho + N linhas com colunas de largura variada,
// pra dar a sensação de conteúdo real chegando, não uma barra genérica.
export function TableSkeleton({ rows = 6, cols = 5 }) {
  const T = useTheme();
  const largura = (r, c) => (c === 0 ? 64 : `${38 + ((r + c) * 17) % 48}%`);
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 24, padding: "12px 16px", borderBottom: `1px solid ${T.border}`, background: T.surf }}>
        {Array.from({ length: cols }).map((_, c) => <Bar key={c} w={c === 0 ? 48 : 90} h={8} />)}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: "flex", alignItems: "center", gap: 24, padding: "13px 16px", borderBottom: r < rows - 1 ? `1px solid ${T.border}` : "none" }}>
          {Array.from({ length: cols }).map((_, c) => <Bar key={c} w={largura(r, c)} />)}
        </div>
      ))}
    </div>
  );
}

// Imita uma grade de cards (ex.: seleção de material) — N blocos com título e subtítulo.
export function CardGridSkeleton({ n = 6, cols = 3 }) {
  const T = useTheme();
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols},1fr)`, gap: 10 }}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} style={{ padding: 12, background: T.surf, border: `1px solid ${T.border}`, borderRadius: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <Bar w="70%" h={13} />
          <Bar w="40%" h={10} />
        </div>
      ))}
    </div>
  );
}

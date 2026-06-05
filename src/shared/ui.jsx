import React, { useState, useEffect } from "react";
import { SEVMETA, SMETA } from "../core/status";
import { THEMES, useFormal, useTheme } from "../core/theme";
import { applyMask } from "../core/utils";
import { useS } from "./styles";

export function usePagination(items, perPage = 20) {
  const [page, setPage] = useState(1);
  const total = Math.ceil(items.length / perPage) || 1;
  const safePage = Math.min(page, total);
  const paginated = items.slice((safePage - 1) * perPage, safePage * perPage);
  useEffect(() => { setPage(1); }, [items.length]);
  return { paginated, page: safePage, total, setPage };
}

export function Pagination({ page, total, setPage }) {
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

export function Tooltip({ text }) {
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

export function F({ lbl, ch, tip }) { const s = useS(); return <div style={{ marginBottom: 14 }}><label style={{ ...s.lbl, display:"flex", alignItems:"center", flexWrap:"wrap", gap:2 }}>{lbl}{tip && <Tooltip text={tip}/>}</label>{ch}</div>; }

export function Inp({ sx, ...p }) { const s = useS(); return <input style={{ ...s.inp, ...sx }} {...p} />; }

export function MaskedInp({ mask, value, onChange, sx, ...p }) {
  const s = useS();
  const handleChange = (e) => {
    const masked = applyMask(mask, e.target.value);
    onChange({ ...e, target: { ...e.target, value: masked } });
  };
  return <input style={{ ...s.inp, ...sx }} value={value} onChange={handleChange} {...p} />;
}

export function Sel({ sx, children, ...p }) { const T = useTheme(); const s = useS(); return <select style={{ ...s.inp, colorScheme: T.light ? "light" : "dark", background: T.surf, color: T.text, ...sx }} {...p}>{children}</select>; }

export function TA({ sx, ...p }) { const s = useS(); return <textarea style={{ ...s.inp, minHeight: 72, resize: "vertical", ...sx }} {...p} />; }

export function G2({ ch }) { return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>{ch}</div>; }

export function G3({ ch }) { return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>{ch}</div>; }

export function Divider() { const T = useTheme(); return <div style={{ height: 1, background: T.border, margin: "1rem 0" }} />; }

export function SecTitle({ icon, ch }) {
  const T = useTheme();
  const formal = useFormal();
  return <div style={{ fontSize: 10, fontWeight: 700, color: T.text3, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: "1rem", display: "flex", alignItems: "center", gap: 6 }}>
    <span style={{ display: "block", width: 3, height: 13, background: `linear-gradient(to bottom,${T.accent},${T.accent2})`, borderRadius: 2 }} />
    {icon && !formal && <span>{icon}</span>}{ch}
  </div>;
}

export function Badge({ s: status }) {
  const m = SMETA[status] || SMETA["Aberta"];
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, textTransform: "uppercase", background: m.bg, color: m.c }}>
    <span style={{ width: 5, height: 5, borderRadius: "50%", background: m.dot, display: "inline-block" }} />{status}
  </span>;
}

export function SevB({ s }) { return <span style={{ display: "inline-flex", padding: "2px 9px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: SEVMETA[s]?.bg, color: SEVMETA[s]?.c, border: `1px solid ${SEVMETA[s]?.c}22` }}>{s}</span>; }

export function Toast({ msg, color, onDone }) {
  const T = useTheme();
  const cols = { green: [T.accent, T.accentDim, T.accentGlow], red: ["#ff4f6a", "#ff4f6a18", "#ff4f6a30"], blue: [T.blue, "#4fc3f718", "#4fc3f730"] };
  const [c, bg, border] = cols[color] || cols.blue;
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, []);
  return <div style={{ position: "fixed", bottom: "1.5rem", right: "1.5rem", background: bg, color: c, border: `1px solid ${border}`, borderRadius: 14, padding: "12px 20px", fontSize: 13, fontWeight: 500, zIndex: 9999, boxShadow: "0 8px 32px #0008", fontFamily: "inherit", maxWidth: 340 }}>✓ {msg}</div>;
}

export function HerbamedLogo({ height = 32, white = false }) {
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

export function ThemePicker({ current, onChange, formal, onToggleFormal }) {
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

// ─── Componentes reutilizáveis ───

// StatusBadge: genérico para qualquer entidade (RNC, CQ, Documentos, etc.)
// Ex: <StatusBadge status="Vigente" statusMap={STATUS_DOC_GD} />
export function StatusBadge({ status, statusMap }) {
  const T = useTheme();
  const m = statusMap && statusMap[status] ? statusMap[status] : { bg: T.accentDim, c: T.accent, icon: "•" };
  return (
    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: m.bg, color: m.c, whiteSpace: "nowrap" }}>
      {m.icon ? `${m.icon} ` : ""}{status}
    </span>
  );
}

// DataTable: tabela genérica com alternância de cor, borders, etc.
// Ex: <DataTable headers={["Código","Título"]} rows={[{id:1,codigo:"PO-001",...}]} columns={["codigo","titulo"]} onRowClick={(r)=>...} />
export function DataTable({ headers, rows, columns, onRowClick, alternateColors = true }) {
  const T = useTheme();
  return (
    <div style={{ overflowX: "auto", marginBottom: 12 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: T.surf, borderBottom: `2px solid ${T.border}` }}>
            {headers.map((h, i) => (
              <th key={i} style={{ padding: "8px 10px", textAlign: "left", color: T.text3, fontWeight: 700, fontSize: 11, textTransform: "uppercase" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={r.id || idx} onClick={() => onRowClick?.(r)} style={{ borderBottom: `1px solid ${T.border}`, background: alternateColors && idx % 2 === 1 ? T.surf : T.bg, cursor: onRowClick ? "pointer" : "auto", transition: "background .15s" }}>
              {columns.map((col, i) => (
                <td key={i} style={{ padding: "8px 10px", color: T.text }}>
                  {r[col] || "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

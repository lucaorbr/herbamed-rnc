import React, { useMemo, useRef, useState } from "react";
import { useTheme } from "../core/theme";
import { usePagination, Pagination } from "./ui";
import { sortRows, proximoSort } from "./tableLogic";

const DENSITY_KEY = "sgq_table_densidade";
const DENSIDADES = {
  confortavel: { padY: 10, padX: 14, fontSize: 12 },
  compacta: { padY: 4, padX: 10, fontSize: 11.5 },
};

// Tabela compartilhada (onda 3, ondas 7) — junta num só lugar o que cada tela
// (RNC, Desvios, CQ...) reimplementava à parte: cabeçalho com ordenação por
// coluna, paginação, faixa colorida por linha, estado vazio, hover/foco visível
// e navegação por teclado. Pensada para listas de entidade (uma linha = um
// registro); a Matriz de Treinamento é um pivot pessoa×documento, um padrão
// diferente — fica de fora.
//
// Densidade é uma preferência do usuário, não da tela: guardada uma vez no
// localStorage e reaproveitada por qualquer <Table/> do sistema — quem tria
// 30 desvios por dia não quer reconfigurar compacta em cada lista.
//
// columns: [{ key, label, accessor?(row), render?(row), sortable=true,
//   align, nowrap=true, width, minWidth }]
export function Table({
  columns, rows, rowKey = (r) => r.id, onRowClick, rowAccent,
  perPage = 20, sortColDefault = null, sortDirDefault = "asc",
  emptyIcon = "📋", emptyTitle = "Nenhum registro encontrado", emptySubtitle,
}) {
  const T = useTheme();
  const [sortCol, setSortCol] = useState(sortColDefault);
  const [sortDir, setSortDir] = useState(sortDirDefault);
  const [densidade, setDensidade] = useState(() => localStorage.getItem(DENSITY_KEY) || "confortavel");
  const [hoverIdx, setHoverIdx] = useState(null);
  const [focusIdx, setFocusIdx] = useState(0);
  const [temFoco, setTemFoco] = useState(false);
  const rowRefs = useRef([]);

  const toggleSort = (col) => {
    if (col.sortable === false) return;
    const next = proximoSort(sortCol, sortDir, col.key);
    setSortCol(next.sortCol); setSortDir(next.sortDir);
  };

  const toggleDensidade = () => {
    const next = densidade === "confortavel" ? "compacta" : "confortavel";
    setDensidade(next);
    localStorage.setItem(DENSITY_KEY, next);
  };

  const sorted = useMemo(() => sortRows(rows, columns, sortCol, sortDir), [rows, columns, sortCol, sortDir]);
  const { paginated, page, total, setPage } = usePagination(sorted, perPage);
  const d = DENSIDADES[densidade];

  const thStyle = (col) => ({
    padding: `${d.padY}px ${d.padX}px`, textAlign: col.align || "left", fontSize: 11, fontWeight: 700,
    color: sortCol === col.key ? T.accent : T.text3, textTransform: "uppercase", letterSpacing: ".06em",
    cursor: col.sortable === false ? "default" : "pointer", userSelect: "none",
    borderBottom: `1px solid ${T.border}`, background: T.surf, whiteSpace: "nowrap",
    width: col.width, minWidth: col.minWidth,
  });

  // Roving tabindex: só a linha "ativa" entra no tab order; setas movem o
  // foco de verdade (chamando .focus() na próxima linha), Enter/Espaço abre —
  // o mesmo padrão de teclado de qualquer grid/listbox nativo.
  const onKeyDownRow = (e, idx) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.min(idx + 1, paginated.length - 1);
      setFocusIdx(next); rowRefs.current[next]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = Math.max(idx - 1, 0);
      setFocusIdx(prev); rowRefs.current[prev]?.focus();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onRowClick?.(paginated[idx]);
    }
  };

  if (rows.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "4rem 2rem", color: T.text3, background: T.card, borderRadius: 14, border: `1px solid ${T.border}` }}>
        <div style={{ fontSize: 48, marginBottom: "1rem", opacity: .3 }}>{emptyIcon}</div>
        <div style={{ fontSize: 14, color: T.text2, marginBottom: 6 }}>{emptyTitle}</div>
        {emptySubtitle && <div style={{ fontSize: 12 }}>{emptySubtitle}</div>}
      </div>
    );
  }

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflowX: "auto" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "6px 8px", borderBottom: `1px solid ${T.border}` }}>
        <button onClick={toggleDensidade} title="Alternar densidade das linhas"
          style={{ background: "transparent", border: `1px solid ${T.border2}`, borderRadius: 7, padding: "3px 9px",
            color: T.text3, fontSize: 10.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          {densidade === "confortavel" ? "☰ Confortável" : "☱ Compacta"}
        </button>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} style={thStyle(col)} onClick={() => toggleSort(col)}>
                {col.label}
                {col.sortable !== false && (
                  <span style={{ marginLeft: 4 }}>{sortCol === col.key ? (sortDir === "asc" ? "↑" : "↓") : "↕"}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paginated.map((r, idx) => {
            const cor = rowAccent?.(r);
            const emFoco = temFoco && focusIdx === idx;
            const realcada = hoverIdx === idx || emFoco;
            return (
              <tr key={rowKey(r)} ref={(el) => { rowRefs.current[idx] = el; }}
                tabIndex={idx === focusIdx ? 0 : -1}
                onFocus={() => { setFocusIdx(idx); setTemFoco(true); }}
                onBlur={() => setTemFoco(false)}
                onKeyDown={(e) => onKeyDownRow(e, idx)}
                onMouseEnter={() => setHoverIdx(idx)}
                onMouseLeave={() => setHoverIdx(null)}
                onClick={() => onRowClick?.(r)}
                style={{
                  background: realcada ? T.card2 : (idx % 2 === 0 ? T.card : T.surf),
                  borderLeft: cor ? `3px solid ${cor}` : undefined,
                  cursor: onRowClick ? "pointer" : "default", transition: "background .15s",
                  outline: emFoco ? `2px solid ${T.accent}` : "none", outlineOffset: -1,
                }}>
                {columns.map(col => (
                  <td key={col.key} style={{
                    padding: `${d.padY}px ${d.padX}px`, fontSize: d.fontSize, color: T.text, textAlign: col.align || "left",
                    whiteSpace: col.nowrap === false ? "normal" : "nowrap",
                    maxWidth: col.maxWidth, overflow: col.maxWidth ? "hidden" : undefined,
                    textOverflow: col.maxWidth ? "ellipsis" : undefined,
                  }}>
                    {col.render ? col.render(r) : (col.accessor ? col.accessor(r) : r[col.key]) ?? "—"}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <Pagination page={page} total={total} setPage={setPage} />
    </div>
  );
}

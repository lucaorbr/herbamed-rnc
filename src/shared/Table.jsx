import React, { useMemo, useState } from "react";
import { useTheme } from "../core/theme";
import { usePagination, Pagination } from "./ui";
import { sortRows, proximoSort } from "./tableLogic";

// Tabela compartilhada (onda 3) — junta num só lugar o que cada tela (RNC,
// Desvios, CQ...) reimplementava à parte: cabeçalho com ordenação por coluna,
// paginação, faixa colorida por linha e estado vazio. Pensada para listas de
// entidade (uma linha = um registro); a Matriz de Treinamento é um pivot
// pessoa×documento, um padrão diferente — fica de fora, é onda 4.
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

  const toggleSort = (col) => {
    if (col.sortable === false) return;
    const next = proximoSort(sortCol, sortDir, col.key);
    setSortCol(next.sortCol); setSortDir(next.sortDir);
  };

  const sorted = useMemo(() => sortRows(rows, columns, sortCol, sortDir), [rows, columns, sortCol, sortDir]);
  const { paginated, page, total, setPage } = usePagination(sorted, perPage);

  const thStyle = (col) => ({
    padding: "10px 14px", textAlign: col.align || "left", fontSize: 11, fontWeight: 700,
    color: sortCol === col.key ? T.accent : T.text3, textTransform: "uppercase", letterSpacing: ".06em",
    cursor: col.sortable === false ? "default" : "pointer", userSelect: "none",
    borderBottom: `1px solid ${T.border}`, background: T.surf, whiteSpace: "nowrap",
    width: col.width, minWidth: col.minWidth,
  });

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
            return (
              <tr key={rowKey(r)} onClick={() => onRowClick?.(r)}
                style={{
                  background: idx % 2 === 0 ? T.card : T.surf,
                  borderLeft: cor ? `3px solid ${cor}` : undefined,
                  cursor: onRowClick ? "pointer" : "default", transition: "background .15s",
                }}>
                {columns.map(col => (
                  <td key={col.key} style={{
                    padding: "10px 14px", fontSize: 12, color: T.text, textAlign: col.align || "left",
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

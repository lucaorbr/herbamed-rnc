// Lógica pura da tabela compartilhada (onda 3) — extraída para ser testável
// sem montar componente. `Table.jsx` só consome isto.

// Compara dois valores de célula. Números comparam como número; o resto vira
// string (datas ISO e códigos tipo "RNC-0007" ordenam certo como string).
// Vazio (null/undefined/"") sempre fica por último, nas duas direções — não
// faz sentido "maior" ou "menor" apontar linha sem dado para o topo.
export function compareValues(a, b) {
  const va = a ?? "";
  const vb = b ?? "";
  const vazioA = va === "";
  const vazioB = vb === "";
  if (vazioA && vazioB) return 0;
  if (vazioA) return 1;
  if (vazioB) return -1;
  if (typeof va === "number" && typeof vb === "number") return va - vb;
  return String(va).localeCompare(String(vb), "pt-BR", { numeric: true, sensitivity: "base" });
}

function valorDaColuna(row, col) {
  if (typeof col.accessor === "function") return col.accessor(row);
  return row[col.key];
}

export function sortRows(rows, columns, sortCol, sortDir) {
  if (!sortCol) return rows;
  const col = columns.find(c => c.key === sortCol);
  if (!col) return rows;
  const sinal = sortDir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => sinal * compareValues(valorDaColuna(a, col), valorDaColuna(b, col)));
}

// Clicar na mesma coluna alterna a direção; clicar em coluna nova começa em "asc".
export function proximoSort(sortCol, sortDir, colKey) {
  if (sortCol === colKey) return { sortCol, sortDir: sortDir === "asc" ? "desc" : "asc" };
  return { sortCol: colKey, sortDir: "asc" };
}

import React, { useState } from "react";
import { Bar, Line } from "recharts";
import { useTheme } from "../core/theme";
import { FORMATOS, chaveFormato, formatoValido } from "./formatoGraficoLogic";

/** Formato escolhido para um gráfico, lembrado no navegador da pessoa. */
export function useFormatoGrafico(grafico, padrao = "empilhado") {
  const [formato, setFormato] = useState(() => {
    try { return formatoValido(localStorage.getItem(chaveFormato(grafico)), padrao); }
    catch { return padrao; }
  });
  const mudar = v => {
    setFormato(v);
    try { localStorage.setItem(chaveFormato(grafico), v); } catch { /* sem armazenamento: só nesta visita */ }
  };
  return [formato, mudar];
}

/** Os três botões Empilhado / Lado a lado / Linhas, para o canto do gráfico. */
export function SeletorFormato({ formato, onChange }) {
  const T = useTheme();
  return (
    <div role="group" aria-label="Formato do gráfico" style={{ display: "inline-flex", gap: 2, background: T.surf, border: `1px solid ${T.border}`, borderRadius: 8, padding: 2 }}>
      {FORMATOS.map(f => {
        const ativo = f.id === formato;
        return (
          <button key={f.id} type="button" title={f.dica} aria-pressed={ativo} onClick={() => onChange(f.id)}
            style={{ padding: "4px 10px", border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontSize: 11,
              fontWeight: ativo ? 700 : 500, background: ativo ? T.card : "transparent", color: ativo ? T.accent : T.text2,
              boxShadow: ativo ? `0 1px 2px ${T.border2}` : "none" }}>
            {f.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Legenda abaixo do gráfico. `tipo`: "quad" (barra), "linha" (linha cheia) ou
 * "tracejada" — a tracejada separa as linhas de apoio das séries da categoria
 * quando o gráfico está em Linhas.
 */
export function LegendaSeries({ itens }) {
  const T = useTheme();
  return (
    <div style={{ display: "flex", gap: 16, marginTop: 6, flexWrap: "wrap" }}>
      {itens.map(({ label, cor, tipo }) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: T.text2 }}>
          {tipo === "quad"
            ? <div style={{ width: 10, height: 10, borderRadius: 2, background: cor }} />
            : <div style={{ width: 14, height: 0, borderTop: `3px ${tipo === "tracejada" ? "dashed" : "solid"} ${cor}` }} />}
          {label}
        </div>
      ))}
    </div>
  );
}

/**
 * As séries da categoria no formato pedido, para pôr dentro de um ComposedChart.
 * Devolve um array de elementos (o recharts lê os filhos diretos), não um componente:
 * componente próprio entre o gráfico e as barras faz o recharts não enxergá-las.
 * `series`: [{ chave, cor }] na ordem de baixo para cima da pilha.
 */
export function seriesNoFormato(formato, series, { corBorda, maxBarSize = 30 } = {}) {
  if (formato === "linhas") {
    return series.map(s => (
      <Line key={s.chave} type="monotone" dataKey={s.chave} stroke={s.cor} strokeWidth={2.5}
        dot={{ r: 4, fill: s.cor }} activeDot={{ r: 6 }} />
    ));
  }
  const empilhado = formato === "empilhado";
  return series.map((s, i) => (
    <Bar key={s.chave} dataKey={s.chave} fill={s.cor} maxBarSize={empilhado ? maxBarSize : Math.round(maxBarSize * 0.6)}
      stackId={empilhado ? "cat" : undefined} stroke={empilhado ? corBorda : undefined} strokeWidth={empilhado ? 1 : 0}
      radius={!empilhado ? [3, 3, 0, 0] : i === series.length - 1 ? [3, 3, 0, 0] : undefined} />
  ));
}

// Gráficos dos Indicadores de RNC, no mesmo estilo do Dashboard Executivo e dos
// Indicadores de Desvios (recharts). Arquivo próprio para ser carregado só quando a
// tela abre: o RncTabs vai na carga inicial e o recharts não precisa ir junto.

import React from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Line, Pie, PieChart,
  ReferenceLine, ResponsiveContainer, Tooltip as RcTooltip, XAxis, YAxis,
} from "recharts";
import { useTheme } from "../../core/theme";
import { SEVMETA, SMETA, tipoCor } from "../../core/status";
import { LegendaSeries, SeletorFormato, seriesNoFormato, useFormatoGrafico } from "../../shared/FormatoGrafico";
import { SEVERIDADES } from "./indicadoresRncLogic";

const COR_ENCERRADAS = "#2ab84a";

function Dica({ active, payload, label }) {
  const T = useTheme();
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: T.card2, border: `1px solid ${T.border2}`, borderRadius: 10, padding: "8px 14px", fontSize: 12 }}>
      {label != null && <div style={{ color: T.text2, marginBottom: 4, fontWeight: 600 }}>{label}</div>}
      {payload.map((p, i) => <div key={i} style={{ color: p.color || p.payload?.fill }}>{p.name}: <strong>{p.value}</strong></div>)}
    </div>
  );
}

function Cartao({ icon, titulo, sub, acao, children }) {
  const T = useTheme();
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "1rem 1.2rem", minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{icon} {titulo}</div>
          {sub && <div style={{ fontSize: 10, color: T.text3, marginTop: 2 }}>{sub}</div>}
        </div>
        {acao}
      </div>
      {children}
    </div>
  );
}

function SemDados({ altura = 220, texto = "Nenhuma RNC no período." }) {
  const T = useTheme();
  return <div style={{ height: altura, display: "flex", alignItems: "center", justifyContent: "center", color: T.text3, fontSize: 12 }}>{texto}</div>;
}

/** Abertas por mês, separadas por severidade, com a linha das encerradas no mês. */
export function TendenciaRnc({ dados }) {
  const T = useTheme();
  const [formato, setFormato] = useFormatoGrafico("rnc-tendencia", "linhas");
  const vazio = dados.every(d => d.total === 0 && d["Encerradas"] === 0);
  // "Crítica" saiu na v3.28.0: só aparece se houver RNC antiga com ela no período.
  const series = SEVERIDADES.filter(k => k !== "Crítica" || dados.some(d => d[k] > 0)).map(k => ({ chave: k, cor: SEVMETA[k].c }));
  return (
    <Cartao icon="📈" titulo="Tendência de RNCs por Severidade"
      sub={`RNCs abertas por mês (${formato === "empilhado" ? "empilhadas" : "separadas"} por severidade) · Tracejada: encerradas no mês`}
      acao={<SeletorFormato formato={formato} onChange={setFormato} />}>
      {vazio ? <SemDados altura={260} /> : (
        <>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dados}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                <XAxis dataKey="mes" tick={{ fill: T.text2, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: T.text2, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <RcTooltip content={<Dica />} cursor={{ fill: T.accentDim }} />
                {seriesNoFormato(formato, series, { corBorda: T.card })}
                <Line type="monotone" dataKey="Encerradas" stroke={COR_ENCERRADAS} strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3, fill: COR_ENCERRADAS }} activeDot={{ r: 5 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <LegendaSeries itens={[
            ...series.map(s => ({ label: s.chave, cor: s.cor, tipo: formato === "linhas" ? "linha" : "quad" })),
            { label: "Encerradas", cor: COR_ENCERRADAS, tipo: "tracejada" },
          ]} />
        </>
      )}
    </Cartao>
  );
}

/** Rosca das RNCs por status, com a legenda e a contagem ao lado. */
export function StatusRosca({ dados }) {
  const T = useTheme();
  const total = dados.reduce((s, d) => s + d.value, 0);
  const cor = nome => SMETA[nome]?.dot || T.accent;
  return (
    <Cartao icon="📊" titulo="RNCs por Status" sub={`${total} RNC(s) abertas no período`}>
      {dados.length === 0 ? <SemDados /> : (
        <div style={{ height: 220, display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ flex: 1, height: "100%", minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={dados} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="45%" outerRadius="78%" paddingAngle={3}>
                  {dados.map(d => <Cell key={d.name} fill={cor(d.name)} />)}
                </Pie>
                <RcTooltip content={<Dica />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7, flexShrink: 0 }}>
            {dados.map(d => (
              <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11 }}>
                <div style={{ width: 9, height: 9, borderRadius: 3, background: cor(d.name), flexShrink: 0 }} />
                <span style={{ color: T.text2 }}>{d.name}</span>
                <span style={{ color: T.text, fontWeight: 700, marginLeft: "auto", paddingLeft: 8 }}>{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Cartao>
  );
}

/** Barras horizontais por tipo de NC, cada uma na cor do tipo. */
export function BarrasPorTipo({ dados }) {
  const T = useTheme();
  const linhas = dados.map(d => ({ nome: d.name.length > 22 ? d.name.slice(0, 20) + "…" : d.name, full: d.name, RNCs: d.value }));
  return (
    <Cartao icon="🏷️" titulo="RNCs por Tipo" sub="No período">
      {linhas.length === 0 ? <SemDados /> : (
        <div style={{ height: Math.max(220, linhas.length * 34) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={linhas} layout="vertical" barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} horizontal={false} />
              <XAxis type="number" tick={{ fill: T.text2, fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="nome" tick={{ fill: T.text2, fontSize: 11 }} axisLine={false} tickLine={false} width={120} />
              <RcTooltip content={<Dica />} cursor={{ fill: T.accentDim }} />
              <Bar dataKey="RNCs" radius={[0, 5, 5, 0]}>
                {linhas.map(l => <Cell key={l.full} fill={tipoCor(l.full, T)} />)}
                <LabelList dataKey="RNCs" position="right" style={{ fill: T.text2, fontSize: 10, fontWeight: 700 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Cartao>
  );
}

function DicaPareto({ active, payload }) {
  const T = useTheme();
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: T.card2, border: `1px solid ${T.border2}`, borderRadius: 10, padding: "8px 14px", fontSize: 12 }}>
      <div style={{ color: T.text2, marginBottom: 4, fontWeight: 600 }}>{d.nome}</div>
      <div style={{ color: T.text }}>RNCs: <strong>{d.qtd}</strong> ({d.pct}%)</div>
      <div style={{ color: T.orange }}>Acumulado: <strong>{d.acum}%</strong></div>
    </div>
  );
}

/**
 * Pareto: barras com a quantidade (destacadas as que somam até 80%) e a linha do %
 * acumulado no eixo da direita, com a marca dos 80%.
 */
export function ParetoRnc({ icon, titulo, sub, dados, vazio }) {
  const T = useTheme();
  const linhas = dados.map(d => ({ ...d, rotulo: d.nome.length > 18 ? d.nome.slice(0, 16) + "…" : d.nome }));
  return (
    <Cartao icon={icon} titulo={titulo} sub={sub}>
      {linhas.length === 0 ? <SemDados altura={280} texto={vazio} /> : (
        <>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={linhas} margin={{ top: 18, right: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                <XAxis dataKey="rotulo" tick={{ fill: T.text2, fontSize: 10 }} angle={-30} textAnchor="end" height={62} axisLine={false} tickLine={false} interval={0} />
                <YAxis yAxisId="qtd" tick={{ fill: T.text2, fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis yAxisId="pct" orientation="right" unit="%" domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} tick={{ fill: T.text3, fontSize: 10 }} axisLine={false} tickLine={false} />
                <ReferenceLine yAxisId="pct" y={80} stroke={T.orange} strokeDasharray="4 4" strokeOpacity={0.6} label={{ value: "80%", position: "insideTopRight", fill: T.orange, fontSize: 10 }} />
                <RcTooltip content={<DicaPareto />} cursor={{ fill: T.accentDim }} />
                <Bar yAxisId="qtd" dataKey="qtd" name="RNCs" radius={[4, 4, 0, 0]} maxBarSize={44}>
                  {linhas.map(l => <Cell key={l.nome} fill={l.dentro80 ? T.accent : T.border2} />)}
                  <LabelList dataKey="qtd" position="top" style={{ fill: T.text2, fontSize: 10, fontWeight: 700 }} />
                </Bar>
                <Line yAxisId="pct" type="monotone" dataKey="acum" name="% acumulado" stroke={T.orange} strokeWidth={2} dot={{ r: 3, fill: T.orange }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <LegendaSeries itens={[
            { label: "Somam até 80%", cor: T.accent, tipo: "quad" },
            { label: "Demais", cor: T.border2, tipo: "quad" },
            { label: "% acumulado", cor: T.orange, tipo: "linha" },
          ]} />
        </>
      )}
    </Cartao>
  );
}

import React, { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip as RcTooltip, XAxis, YAxis,
} from "recharts";
import { useTheme } from "../../core/theme";
import { fmt, tod } from "../../core/utils";
import { DESVIO_SMETA } from "./DesviosTabs";

// Cores por impacto (mesma escala visual da RNC)
const IMPACTO_CORES = { "Crítica": "#ff4f6a", "Maior": "#ffd166", "Menor": "#4fc3f7" };

const PERIODOS = [
  { id: "6m",  label: "Últimos 6 meses",  meses: 6 },
  { id: "12m", label: "Últimos 12 meses", meses: 12 },
  { id: "ano", label: "Ano atual",        meses: null },
  { id: "tudo", label: "Todo o histórico", meses: null },
];

const setorDe = d => (d.setor === "Outros" ? (d.setorOutro || "Outros") : (d.setor || "—"));
const tipoDe  = d => (d.tipo === "Outros" ? (d.tipoOutro || "Outros") : (d.tipo || "—"));
const dataDe  = d => d.dataOcorrencia || d.dataRegistro || "";

// Dias entre duas datas YYYY-MM-DD
const diasEntre = (a, b) => {
  if (!a || !b) return null;
  const ms = new Date(b + "T12:00:00") - new Date(a + "T12:00:00");
  return Math.max(0, Math.round(ms / 86400000));
};

export function DesviosIndicadores({ desvios = [], setTab }) {
  const T = useTheme();
  const [periodo, setPeriodo] = useState("12m");

  // ── Filtro de período ──
  const { filtrados, meses } = useMemo(() => {
    const p = PERIODOS.find(x => x.id === periodo);
    let inicio = null;
    let nMeses;
    if (periodo === "ano") {
      inicio = `${new Date().getFullYear()}-01-01`;
      nMeses = new Date().getMonth() + 1;
    } else if (periodo === "tudo") {
      const datas = desvios.map(dataDe).filter(Boolean).sort();
      inicio = datas[0] || tod();
      const [ay, am] = inicio.split("-").map(Number);
      const agora = new Date();
      nMeses = Math.max(1, (agora.getFullYear() - ay) * 12 + (agora.getMonth() + 1 - am) + 1);
    } else {
      const d = new Date();
      d.setMonth(d.getMonth() - (p.meses - 1));
      inicio = `${d.toISOString().slice(0, 7)}-01`;
      nMeses = p.meses;
    }
    const lista = desvios.filter(d => dataDe(d) >= inicio);
    // Chaves YYYY-MM do período (limitado a 24 barras para não poluir o gráfico)
    nMeses = Math.min(nMeses, 24);
    const chaves = Array.from({ length: nMeses }, (_, i) => {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (nMeses - 1 - i));
      return d.toISOString().slice(0, 7);
    });
    return { filtrados: lista, meses: chaves };
  }, [desvios, periodo]);

  // ── KPIs ──
  const kpis = useMemo(() => {
    const total = filtrados.length;
    const abertos = filtrados.filter(d => d.status === "Registrado").length;
    const encerrados = filtrados.filter(d => d.status === "Encerrado").length;
    const convertidos = filtrados.filter(d => d.status === "Convertido em RNC").length;
    const criticos = filtrados.filter(d => d.impacto === "Crítica").length;
    const taxaRNC = total > 0 ? Math.round(convertidos / total * 100) : 0;

    // Tempo médio de triagem: registro → encerramento/conversão
    const triados = filtrados
      .map(d => {
        const fim = d.status === "Encerrado" ? d.encerradoEm : d.status === "Convertido em RNC" ? d.convertidoEm : null;
        return diasEntre(d.dataRegistro || dataDe(d), fim);
      })
      .filter(x => x !== null);
    const tempoMedio = triados.length > 0 ? Math.round(triados.reduce((s, x) => s + x, 0) / triados.length * 10) / 10 : null;

    return { total, abertos, encerrados, convertidos, criticos, taxaRNC, tempoMedio };
  }, [filtrados]);

  // ── Tendência mensal ──
  const tendencia = useMemo(() => meses.map(m => {
    const [ano, ms] = m.split("-").map(Number);
    const label = new Date(ano, ms - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: meses.length > 12 ? "2-digit" : undefined });
    const doMes = filtrados.filter(d => dataDe(d).startsWith(m));
    return {
      mes: label,
      "Registrados": doMes.length,
      "Encerrados": doMes.filter(d => d.status === "Encerrado").length,
      "Viraram RNC": doMes.filter(d => d.status === "Convertido em RNC").length,
    };
  }), [filtrados, meses]);

  // ── Por setor (top 8) ──
  const porSetor = useMemo(() => {
    const map = {};
    filtrados.forEach(d => { const s = setorDe(d); map[s] = (map[s] || 0) + 1; });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([nome, qtd]) => ({ nome: nome.length > 20 ? nome.slice(0, 18) + "…" : nome, Desvios: qtd }));
  }, [filtrados]);

  // ── Por tipo (pizza) ──
  const porTipo = useMemo(() => {
    const map = {};
    filtrados.forEach(d => { const t = tipoDe(d); map[t] = (map[t] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [filtrados]);
  const TIPO_CORES = ["#2ab84a", "#4fc3f7", "#ffd166", "#ff8c42", "#ff4f6a", "#a78bfa", "#f472b6", "#94a3b8"];

  // ── Por impacto ──
  const porImpacto = useMemo(() => ["Crítica", "Maior", "Menor"].map(imp => ({
    impacto: imp,
    Desvios: filtrados.filter(d => d.impacto === imp).length,
  })), [filtrados]);

  // ── Aging: abertos há mais tempo ──
  const aging = useMemo(() => desvios
    .filter(d => d.status === "Registrado")
    .map(d => ({ ...d, dias: diasEntre(d.dataRegistro || dataDe(d), tod()) ?? 0 }))
    .sort((a, b) => b.dias - a.dias)
    .slice(0, 6), [desvios]);

  // ── Export CSV ──
  const exportCSV = () => {
    const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const linhas = [
      ["Nº", "Data ocorrência", "Setor", "Tipo", "Impacto", "Status", "Descrição", "Registrado por", "Data registro", "Encerrado em", "Convertido em", "RNC vinculada"].join(";"),
      ...filtrados.map(d => [
        d.num, dataDe(d), setorDe(d), tipoDe(d), d.impacto, d.status, d.desc,
        d.registradoPor, d.dataRegistro, d.encerradoEm || "", d.convertidoEm || "", d.rncNum || "",
      ].map(esc).join(";")),
    ];
    const blob = new Blob(["﻿" + linhas.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `desvios_indicadores_${tod()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: T.card2, border: `1px solid ${T.border2}`, borderRadius: 10, padding: "8px 14px", fontSize: 12 }}>
        <div style={{ color: T.text2, marginBottom: 4, fontWeight: 600 }}>{label}</div>
        {payload.map((p, i) => <div key={i} style={{ color: p.color || p.payload?.fill }}>{p.name}: <strong>{p.value}</strong></div>)}
      </div>
    );
  };

  const card = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "1rem 1.2rem" };
  const cardTitle = (icon, titulo, sub) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{icon} {titulo}</div>
      {sub && <div style={{ fontSize: 10, color: T.text3, marginTop: 2 }}>{sub}</div>}
    </div>
  );
  const semDados = <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: T.text3, fontSize: 12 }}>Sem dados no período</div>;

  return (
    <div>
      {/* ── Filtro de período + export ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {PERIODOS.map(p => (
          <button key={p.id} onClick={() => setPeriodo(p.id)}
            style={{ padding: "7px 14px", borderRadius: 20, border: `1px solid ${periodo === p.id ? T.accent : T.border}`, background: periodo === p.id ? T.accentDim : "transparent", color: periodo === p.id ? T.accent : T.text2, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: periodo === p.id ? 700 : 400 }}>
            {p.label}
          </button>
        ))}
        <button onClick={exportCSV} style={{ marginLeft: "auto", padding: "7px 14px", borderRadius: 8, border: `1px solid ${T.border2}`, background: T.surf, color: T.text2, cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>
          ⬇ Exportar CSV
        </button>
      </div>

      {/* ── KPIs ── */}
      <div className="kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 10, marginBottom: 16 }}>
        {[
          { l: "Desvios no período", n: kpis.total, c: T.accent },
          { l: "Em aberto", n: kpis.abertos, c: DESVIO_SMETA["Registrado"].c },
          { l: "Encerrados", n: kpis.encerrados, c: DESVIO_SMETA["Encerrado"].c },
          { l: "Viraram RNC", n: `${kpis.convertidos} (${kpis.taxaRNC}%)`, c: DESVIO_SMETA["Convertido em RNC"].c },
          { l: "Impacto crítico", n: kpis.criticos, c: kpis.criticos > 0 ? "#ff4f6a" : T.text3 },
          { l: "Tempo médio de triagem", n: kpis.tempoMedio !== null ? `${kpis.tempoMedio}d` : "—", c: kpis.tempoMedio !== null && kpis.tempoMedio > 7 ? "#ffd166" : T.accent },
        ].map(({ l, n, c }) => (
          <div key={l} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: c }}>{n}</div>
            <div style={{ fontSize: 11, color: T.text2, fontWeight: 500 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* ── Tendência mensal ── */}
      <div style={{ ...card, marginBottom: 16 }}>
        {cardTitle("📈", "Tendência de Desvios", "Registrados × triados por mês de ocorrência")}
        <div style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={tendencia}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
              <XAxis dataKey="mes" tick={{ fill: T.text2, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: T.text2, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <RcTooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="Registrados" stroke={T.accent} strokeWidth={2.5} dot={{ r: 3, fill: T.accent }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="Encerrados" stroke={DESVIO_SMETA["Encerrado"].c} strokeWidth={2} dot={{ r: 3, fill: DESVIO_SMETA["Encerrado"].c }} />
              <Line type="monotone" dataKey="Viraram RNC" stroke={DESVIO_SMETA["Convertido em RNC"].c} strokeWidth={2} dot={{ r: 3, fill: DESVIO_SMETA["Convertido em RNC"].c }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
          {[["Registrados", T.accent], ["Encerrados", DESVIO_SMETA["Encerrado"].c], ["Viraram RNC", DESVIO_SMETA["Convertido em RNC"].c]].map(([l, c]) => (
            <div key={l} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: T.text2 }}>
              <div style={{ width: 10, height: 3, borderRadius: 2, background: c }} />{l}
            </div>
          ))}
        </div>
      </div>

      {/* ── Setor + Tipo + Impacto ── */}
      <div className="grid-3" style={{ marginBottom: 16 }}>
        {/* Por setor */}
        <div style={card}>
          {cardTitle("🏭", "Desvios por Setor", "Top 8 setores no período")}
          {porSetor.length === 0 ? semDados : (
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porSetor} layout="vertical" barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} horizontal={false} />
                  <XAxis type="number" tick={{ fill: T.text2, fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="nome" tick={{ fill: T.text2, fontSize: 10 }} axisLine={false} tickLine={false} width={105} />
                  <RcTooltip content={<CustomTooltip />} cursor={{ fill: T.accentDim }} />
                  <Bar dataKey="Desvios" fill={T.accent} radius={[0, 5, 5, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Por tipo */}
        <div style={card}>
          {cardTitle("🏷️", "Desvios por Tipo", "Distribuição no período")}
          {porTipo.length === 0 ? semDados : (
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", height: 220 }}>
              <div style={{ flex: 1, height: "100%" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={porTipo} dataKey="value" cx="50%" cy="50%" innerRadius="38%" outerRadius="72%" paddingAngle={3}>
                      {porTipo.map((d, i) => <Cell key={i} fill={TIPO_CORES[i % TIPO_CORES.length]} />)}
                    </Pie>
                    <RcTooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0, maxHeight: 220, overflowY: "auto" }}>
                {porTipo.map((d, i) => (
                  <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                    <div style={{ width: 9, height: 9, borderRadius: 3, background: TIPO_CORES[i % TIPO_CORES.length], flexShrink: 0 }} />
                    <span style={{ color: T.text2 }}>{d.name}</span>
                    <span style={{ color: T.text, fontWeight: 700, marginLeft: "auto", paddingLeft: 8 }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Por impacto */}
        <div style={card}>
          {cardTitle("⚡", "Desvios por Impacto", "Mesma escala de severidade da RNC")}
          {kpis.total === 0 ? semDados : (
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porImpacto} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                  <XAxis dataKey="impacto" tick={{ fill: T.text2, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: T.text2, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <RcTooltip content={<CustomTooltip />} cursor={{ fill: T.accentDim }} />
                  <Bar dataKey="Desvios" radius={[5, 5, 0, 0]}>
                    {porImpacto.map((d, i) => <Cell key={i} fill={IMPACTO_CORES[d.impacto]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ── Aging: abertos há mais tempo ── */}
      <div style={card}>
        {cardTitle("⏳", "Desvios em Aberto há Mais Tempo", "Aguardando triagem da Qualidade — independe do filtro de período")}
        {aging.length === 0 ? (
          <div style={{ padding: "1.5rem", textAlign: "center", color: T.accent, fontSize: 13, fontWeight: 600 }}>✅ Nenhum desvio aguardando triagem</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {aging.map(d => {
              const corDias = d.dias > 15 ? "#ff4f6a" : d.dias > 7 ? "#ffd166" : T.text2;
              return (
                <div key={d.id} onClick={() => setTab && setTab("desvios")}
                  style={{ background: T.surf, border: `1px solid ${T.border}`, borderLeft: `3px solid ${corDias}`, borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "center", gap: 12, cursor: setTab ? "pointer" : "default" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.accent, whiteSpace: "nowrap" }}>{d.num}</span>
                  <span style={{ fontSize: 11, color: T.text2, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.desc}</span>
                  <span style={{ fontSize: 10, color: T.text3, whiteSpace: "nowrap" }}>{setorDe(d)} · {fmt(dataDe(d))}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: corDias, whiteSpace: "nowrap", minWidth: 44, textAlign: "right" }}>{d.dias}d</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

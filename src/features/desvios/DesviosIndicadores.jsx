import React, { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Line,
  ResponsiveContainer, Tooltip as RcTooltip, XAxis, YAxis,
} from "recharts";
import { useTheme } from "../../core/theme";
import { fmt, tod } from "../../core/utils";
import { DESVIO_SMETA, SETORES_DESVIO, TIPOS_DESVIO, pedirFiltroDesvios } from "./DesviosTabs";

const VERDE_OK = "#2ab84a";

const PERIODOS = [
  { id: "6m",  label: "Últimos 6 meses",  meses: 6 },
  { id: "12m", label: "Últimos 12 meses", meses: 12 },
  { id: "ano", label: "Ano atual",        meses: null },
  { id: "tudo", label: "Todo o histórico", meses: null },
];

// Meta de triagem da Qualidade (dias corridos do registro até encerrar/converter)
const META_TRIAGEM_DIAS = 7;

const setorDe = d => (d.setor === "Outros" ? (d.setorOutro || "Outros") : (d.setor || "—"));
const tipoDe  = d => (d.tipo === "Outros" ? (d.tipoOutro || "Outros") : (d.tipo || "—"));
const dataDe  = d => d.dataOcorrencia || d.dataRegistro || "";

// Dias entre duas datas YYYY-MM-DD
const diasEntre = (a, b) => {
  if (!a || !b) return null;
  const ms = new Date(b + "T12:00:00") - new Date(a + "T12:00:00");
  return Math.max(0, Math.round(ms / 86400000));
};

// Data do fim da triagem (encerramento ou conversão); null se ainda aberto
const fimTriagem = d =>
  d.status === "Encerrado" ? d.encerradoEm : d.status === "Convertido em RNC" ? d.convertidoEm : null;

const diasTriagem = d => {
  const fim = fimTriagem(d);
  return fim ? diasEntre(d.dataRegistro || dataDe(d), fim) : null;
};

const mediana = arr => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2 * 10) / 10;
};

// Subtrai n meses de uma data YYYY-MM-DD, voltando ao dia 1 do mês resultante
const mesesAntes = (iso, n) => {
  const [y, m] = iso.split("-").map(Number);
  const d = new Date(y, m - 1 - n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

export function DesviosIndicadores({ desvios = [], setTab }) {
  const T = useTheme();
  const [periodo, setPeriodo] = useState("12m");

  // Cores de impacto vindas do tema (acompanham claro/escuro)
  const IMPACTO_CORES = { "Crítica": T.red, "Maior": T.yellow, "Menor": T.blue };

  // ── Filtro de período (+ janela anterior de mesmo tamanho, p/ comparativo) ──
  const { filtrados, anteriores, meses, temAnterior } = useMemo(() => {
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
    // Janela imediatamente anterior, de mesmo tamanho — para os deltas dos KPIs
    const prevInicio = mesesAntes(inicio, Math.min(nMeses, 24));
    const listaPrev = periodo === "tudo" ? [] : desvios.filter(d => {
      const dt = dataDe(d);
      return dt >= prevInicio && dt < inicio;
    });
    // Chaves YYYY-MM do período (limitado a 24 barras para não poluir o gráfico)
    nMeses = Math.min(nMeses, 24);
    const chaves = Array.from({ length: nMeses }, (_, i) => {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (nMeses - 1 - i));
      return d.toISOString().slice(0, 7);
    });
    return { filtrados: lista, anteriores: listaPrev, meses: chaves, temAnterior: periodo !== "tudo" };
  }, [desvios, periodo]);

  // ── KPIs (período atual + anterior) ──
  const kpis = useMemo(() => {
    const calc = lista => {
      const total = lista.length;
      const abertos = lista.filter(d => d.status === "Registrado").length;
      const encerrados = lista.filter(d => d.status === "Encerrado").length;
      const convertidos = lista.filter(d => d.status === "Convertido em RNC").length;
      const criticos = lista.filter(d => d.impacto === "Crítica").length;
      const taxaRNC = total > 0 ? Math.round(convertidos / total * 100) : 0;
      const triados = lista.map(diasTriagem).filter(x => x !== null);
      const med = mediana(triados);
      const slaOk = triados.filter(x => x <= META_TRIAGEM_DIAS).length;
      const sla = triados.length > 0 ? Math.round(slaOk / triados.length * 100) : null;
      const comAcao = total > 0 ? Math.round(lista.filter(d => d.acaoImediata === "Sim").length / total * 100) : null;
      return { total, abertos, encerrados, convertidos, criticos, taxaRNC, triados, med, sla, comAcao };
    };
    return { atual: calc(filtrados), prev: temAnterior ? calc(anteriores) : null };
  }, [filtrados, anteriores, temAnterior]);

  // ── Tendência mensal: empilhada por impacto + linhas de triagem ──
  const tendencia = useMemo(() => meses.map(m => {
    const [ano, ms] = m.split("-").map(Number);
    const label = new Date(ano, ms - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: meses.length > 12 ? "2-digit" : undefined });
    const doMes = filtrados.filter(d => dataDe(d).startsWith(m));
    return {
      mes: label,
      "Menor": doMes.filter(d => d.impacto === "Menor").length,
      "Maior": doMes.filter(d => d.impacto === "Maior").length,
      "Crítica": doMes.filter(d => d.impacto === "Crítica").length,
      "Encerrados": doMes.filter(d => d.status === "Encerrado").length,
      "Viraram RNC": doMes.filter(d => d.status === "Convertido em RNC").length,
      total: doMes.length,
    };
  }), [filtrados, meses]);

  // ── Pareto de tipos: barras em % do total + linha de % acumulado (eixo único) ──
  const pareto = useMemo(() => {
    const map = {};
    filtrados.forEach(d => { const t = tipoDe(d); map[t] = (map[t] || 0) + 1; });
    const total = filtrados.length || 1;
    let acum = 0;
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([nome, qtd]) => {
        const pct = qtd / total * 100;
        acum += pct;
        return { nome, qtd, pct: Math.round(pct * 10) / 10, acum: Math.round(Math.min(acum, 100) * 10) / 10 };
      });
  }, [filtrados]);

  // ── Por setor (top 8) ──
  const porSetor = useMemo(() => {
    const map = {};
    filtrados.forEach(d => { const s = setorDe(d); map[s] = (map[s] || 0) + 1; });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([nome, qtd]) => ({ nome: nome.length > 20 ? nome.slice(0, 18) + "…" : nome, full: nome, Desvios: qtd }));
  }, [filtrados]);

  // ── Matriz Setor × Tipo (recorrência) ──
  const matriz = useMemo(() => {
    const tipos = {};
    const setores = {};
    const celulas = {};
    filtrados.forEach(d => {
      const s = setorDe(d), t = tipoDe(d);
      setores[s] = (setores[s] || 0) + 1;
      tipos[t] = (tipos[t] || 0) + 1;
      celulas[`${s}|${t}`] = (celulas[`${s}|${t}`] || 0) + 1;
    });
    const linhas = Object.entries(setores).sort((a, b) => b[1] - a[1]).slice(0, 12);
    const colunas = Object.entries(tipos).sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, ...Object.values(celulas));
    return { linhas, colunas, celulas, max };
  }, [filtrados]);

  // ── SLA de triagem: distribuição por faixa de dias ──
  const slaFaixas = useMemo(() => {
    const faixas = [
      { label: "0–3 dias",  c: VERDE_OK, test: x => x <= 3 },
      { label: "4–7 dias",  c: VERDE_OK, test: x => x >= 4 && x <= 7 },
      { label: "8–15 dias", c: T.yellow, test: x => x >= 8 && x <= 15 },
      { label: "> 15 dias", c: T.red,    test: x => x > 15 },
    ];
    return faixas.map(f => ({ ...f, Desvios: kpis.atual.triados.filter(f.test).length }));
  }, [kpis, T]);

  // ── Aging: abertos há mais tempo (independe do período) ──
  const { aging, abertosTotal, abertos7, abertos15 } = useMemo(() => {
    const abertos = desvios
      .filter(d => d.status === "Registrado")
      .map(d => ({ ...d, dias: diasEntre(d.dataRegistro || dataDe(d), tod()) ?? 0 }))
      .sort((a, b) => b.dias - a.dias);
    return {
      aging: abertos.slice(0, 6),
      abertosTotal: abertos.length,
      abertos7: abertos.filter(d => d.dias > 7).length,
      abertos15: abertos.filter(d => d.dias > 15).length,
    };
  }, [desvios]);

  // ── Top produtos/lotes recorrentes ──
  const topProdutos = useMemo(() => {
    const map = {};
    filtrados.forEach(d => {
      const p = (d.produto || "").trim();
      if (!p) return;
      if (!map[p]) map[p] = { nome: p, qtd: 0, criticos: 0 };
      map[p].qtd += 1;
      if (d.impacto === "Crítica") map[p].criticos += 1;
    });
    return Object.values(map).sort((a, b) => b.qtd - a.qtd).slice(0, 5);
  }, [filtrados]);

  // ── Engajamento: quem mais registra ──
  const engajamento = useMemo(() => {
    const map = {};
    filtrados.forEach(d => {
      const r = (d.registradoPor || "").trim() || "—";
      map[r] = (map[r] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([nome, qtd]) => ({ nome, qtd }));
  }, [filtrados]);

  // ── Navegação: clique em gráfico → lista já filtrada ──
  const irParaLista = (filtro) => {
    if (!setTab) return;
    pedirFiltroDesvios(filtro);
    setTab("desvios");
  };
  const filtroSetor = s => (SETORES_DESVIO.includes(s) ? { setor: s } : { busca: s });
  const filtroTipo  = t => (TIPOS_DESVIO.includes(t) ? { tipo: t } : { busca: t });

  // ── Export CSV ──
  const exportCSV = () => {
    const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const linhas = [
      ["Nº", "Data ocorrência", "Setor", "Tipo", "Impacto", "Status", "Descrição", "Registrado por", "Data registro", "Ação imediata", "Encerrado em", "Convertido em", "RNC vinculada", "Dias até triagem"].join(";"),
      ...filtrados.map(d => [
        d.num, dataDe(d), setorDe(d), tipoDe(d), d.impacto, d.status, d.desc,
        d.registradoPor, d.dataRegistro, d.acaoImediata || "", d.encerradoEm || "", d.convertidoEm || "", d.rncNum || "",
        diasTriagem(d) ?? "",
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

  const ParetoTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div style={{ background: T.card2, border: `1px solid ${T.border2}`, borderRadius: 10, padding: "8px 14px", fontSize: 12 }}>
        <div style={{ color: T.text2, marginBottom: 4, fontWeight: 600 }}>{d.nome}</div>
        <div style={{ color: T.text }}>Desvios: <strong>{d.qtd}</strong> ({d.pct}%)</div>
        <div style={{ color: T.orange }}>Acumulado: <strong>{d.acum}%</strong></div>
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

  // Chip de variação vs período anterior. goodUp: subir é bom (verde) ou ruim (vermelho).
  const Delta = ({ cur, prev, goodUp = false, unit = "" }) => {
    if (prev === null || prev === undefined || cur === null || cur === undefined) return null;
    const diff = Math.round((cur - prev) * 10) / 10;
    if (diff === 0) return <span style={{ fontSize: 10, color: T.text3, fontWeight: 600 }}>= estável</span>;
    const bom = goodUp ? diff > 0 : diff < 0;
    const txt = unit === "%"
      ? `${diff > 0 ? "+" : ""}${diff} pp`
      : prev === 0 ? `+${cur}` : `${diff > 0 ? "+" : ""}${Math.round(diff / prev * 100)}%`;
    return (
      <span style={{ fontSize: 10, fontWeight: 700, color: bom ? VERDE_OK : T.red }}>
        {diff > 0 ? "▲" : "▼"} {txt}
      </span>
    );
  };

  const a = kpis.atual, p = kpis.prev;
  const slaCor = a.sla === null ? T.text3 : a.sla >= 80 ? VERDE_OK : a.sla >= 60 ? T.yellow : T.red;

  const tiles = [
    { l: "Desvios no período", n: a.total, c: T.accent, delta: p && <Delta cur={a.total} prev={p.total} /> },
    { l: "Em aberto", n: a.abertos, c: DESVIO_SMETA["Registrado"].c, click: { status: "Registrado" } },
    { l: "Encerrados", n: a.encerrados, c: DESVIO_SMETA["Encerrado"].c, delta: p && <Delta cur={a.encerrados} prev={p.encerrados} goodUp />, click: { status: "Encerrado" } },
    { l: "Viraram RNC", n: `${a.convertidos} (${a.taxaRNC}%)`, c: DESVIO_SMETA["Convertido em RNC"].c, delta: p && <Delta cur={a.convertidos} prev={p.convertidos} />, click: { status: "Convertido em RNC" } },
    { l: "Impacto crítico", n: a.criticos, c: a.criticos > 0 ? T.red : T.text3, delta: p && <Delta cur={a.criticos} prev={p.criticos} /> },
    { l: `Triagem ≤ ${META_TRIAGEM_DIAS} dias`, n: a.sla !== null ? `${a.sla}%` : "—", c: slaCor, delta: p && <Delta cur={a.sla} prev={p.sla} goodUp unit="%" /> },
    { l: "Mediana de triagem", n: a.med !== null ? `${a.med}d` : "—", c: a.med !== null && a.med > META_TRIAGEM_DIAS ? T.yellow : T.accent, delta: p && <Delta cur={a.med} prev={p.med} /> },
    { l: "Com ação imediata", n: a.comAcao !== null ? `${a.comAcao}%` : "—", c: T.accent, delta: p && <Delta cur={a.comAcao} prev={p.comAcao} goodUp unit="%" /> },
  ];

  return (
    <div>
      {/* ── Filtro de período + export ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {PERIODOS.map(pp => (
          <button key={pp.id} onClick={() => setPeriodo(pp.id)}
            style={{ padding: "7px 14px", borderRadius: 20, border: `1px solid ${periodo === pp.id ? T.accent : T.border}`, background: periodo === pp.id ? T.accentDim : "transparent", color: periodo === pp.id ? T.accent : T.text2, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: periodo === pp.id ? 700 : 400 }}>
            {pp.label}
          </button>
        ))}
        <button onClick={exportCSV} style={{ marginLeft: "auto", padding: "7px 14px", borderRadius: 8, border: `1px solid ${T.border2}`, background: T.surf, color: T.text2, cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>
          ⬇ Exportar CSV
        </button>
      </div>

      {/* ── KPIs com comparativo do período anterior ── */}
      <div className="kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
        {tiles.map(({ l, n, c, delta, click }) => (
          <div key={l} onClick={click ? () => irParaLista(click) : undefined}
            title={click ? "Ver na lista de desvios" : undefined}
            style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px", cursor: click ? "pointer" : "default" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: c }}>{n}</div>
              {delta}
            </div>
            <div style={{ fontSize: 11, color: T.text2, fontWeight: 500 }}>{l}</div>
          </div>
        ))}
      </div>
      {temAnterior && (
        <div style={{ fontSize: 10, color: T.text3, marginTop: -10, marginBottom: 16 }}>
          ▲▼ variação vs. período anterior de mesma duração
        </div>
      )}

      {/* ── Tendência mensal por impacto ── */}
      <div style={{ ...card, marginBottom: 16 }}>
        {cardTitle("📈", "Tendência de Desvios por Impacto", "Barras: registrados por mês de ocorrência, empilhados por severidade · Linhas: triagem no mês")}
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={tendencia}>
              <CartesianGrid stroke={T.border} vertical={false} />
              <XAxis dataKey="mes" tick={{ fill: T.text2, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: T.text2, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <RcTooltip content={<CustomTooltip />} cursor={{ fill: T.accentDim }} />
              <Bar dataKey="Menor" stackId="imp" fill={IMPACTO_CORES["Menor"]} stroke={T.card} strokeWidth={1} maxBarSize={30} />
              <Bar dataKey="Maior" stackId="imp" fill={IMPACTO_CORES["Maior"]} stroke={T.card} strokeWidth={1} maxBarSize={30} />
              <Bar dataKey="Crítica" stackId="imp" fill={IMPACTO_CORES["Crítica"]} stroke={T.card} strokeWidth={1} maxBarSize={30} radius={[3, 3, 0, 0]} />
              <Line type="monotone" dataKey="Encerrados" stroke={DESVIO_SMETA["Encerrado"].c} strokeWidth={2} dot={{ r: 3, fill: DESVIO_SMETA["Encerrado"].c }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="Viraram RNC" stroke={DESVIO_SMETA["Convertido em RNC"].c} strokeWidth={2} dot={{ r: 3, fill: DESVIO_SMETA["Convertido em RNC"].c }} activeDot={{ r: 5 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 6, flexWrap: "wrap" }}>
          {[["Menor", IMPACTO_CORES["Menor"], "quad"], ["Maior", IMPACTO_CORES["Maior"], "quad"], ["Crítica", IMPACTO_CORES["Crítica"], "quad"],
            ["Encerrados", DESVIO_SMETA["Encerrado"].c, "line"], ["Viraram RNC", DESVIO_SMETA["Convertido em RNC"].c, "line"]].map(([l, c, tipo]) => (
            <div key={l} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: T.text2 }}>
              <div style={{ width: 10, height: tipo === "quad" ? 10 : 3, borderRadius: 2, background: c }} />{l}
            </div>
          ))}
        </div>
      </div>

      {/* ── Pareto de tipos + Setores ── */}
      <div className="grid-2" style={{ marginBottom: 16 }}>
        {/* Pareto */}
        <div style={card}>
          {cardTitle("📊", "Pareto de Tipos", "Barras: % do total (nº de desvios no topo) · Linha: % acumulado — onde concentrar ação")}
          {pareto.length === 0 ? semDados : (
            <div style={{ height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={pareto} margin={{ top: 18 }}>
                  <CartesianGrid stroke={T.border} vertical={false} />
                  <XAxis dataKey="nome" tick={{ fill: T.text2, fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
                  <YAxis unit="%" domain={[0, 100]} tick={{ fill: T.text2, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <RcTooltip content={<ParetoTooltip />} cursor={{ fill: T.accentDim }} />
                  <Bar dataKey="pct" name="% do total" fill={T.accent} radius={[4, 4, 0, 0]} maxBarSize={44}
                    onClick={(e) => { const t = e?.nome ?? e?.payload?.nome; if (t) irParaLista(filtroTipo(t)); }}
                    cursor={setTab ? "pointer" : undefined}>
                    <LabelList dataKey="qtd" position="top" style={{ fill: T.text2, fontSize: 10, fontWeight: 700 }} />
                  </Bar>
                  <Line type="monotone" dataKey="acum" name="% acumulado" stroke={T.orange} strokeWidth={2} dot={{ r: 3, fill: T.orange }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Por setor */}
        <div style={card}>
          {cardTitle("🏭", "Desvios por Setor", "Top 8 setores no período — clique para ver na lista")}
          {porSetor.length === 0 ? semDados : (
            <div style={{ height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porSetor} layout="vertical" barCategoryGap="25%">
                  <CartesianGrid stroke={T.border} horizontal={false} />
                  <XAxis type="number" tick={{ fill: T.text2, fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="nome" tick={{ fill: T.text2, fontSize: 10 }} axisLine={false} tickLine={false} width={105} />
                  <RcTooltip content={<CustomTooltip />} cursor={{ fill: T.accentDim }} />
                  <Bar dataKey="Desvios" fill={T.accent} radius={[0, 4, 4, 0]}
                    onClick={(e) => { const s = e?.full ?? e?.payload?.full; if (s) irParaLista(filtroSetor(s)); }}
                    cursor={setTab ? "pointer" : undefined} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ── Matriz Setor × Tipo ── */}
      <div style={{ ...card, marginBottom: 16 }}>
        {cardTitle("🧭", "Recorrência: Setor × Tipo", "Onde e de que natureza os desvios se repetem — clique numa célula para ver os casos")}
        {matriz.linhas.length === 0 ? semDados : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "separate", borderSpacing: 2, fontSize: 11, minWidth: 480, width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", color: T.text3, fontWeight: 700, fontSize: 10, textTransform: "uppercase", padding: "4px 8px" }}>Setor</th>
                  {matriz.colunas.map(([t]) => (
                    <th key={t} style={{ color: T.text3, fontWeight: 700, fontSize: 10, padding: "4px 6px", whiteSpace: "nowrap" }}>{t}</th>
                  ))}
                  <th style={{ color: T.text3, fontWeight: 700, fontSize: 10, padding: "4px 8px" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {matriz.linhas.map(([s, totalSetor]) => (
                  <tr key={s}>
                    <td style={{ color: T.text2, fontWeight: 600, padding: "4px 8px", whiteSpace: "nowrap" }}>{s}</td>
                    {matriz.colunas.map(([t]) => {
                      const v = matriz.celulas[`${s}|${t}`] || 0;
                      const ratio = v / matriz.max;
                      const alpha = v === 0 ? 0 : 0.15 + 0.65 * ratio;
                      const bg = v === 0 ? "transparent" : T.accent + Math.round(alpha * 255).toString(16).padStart(2, "0");
                      const cor = ratio > 0.6 ? (T.light ? "#fff" : "#08130b") : v > 0 ? T.text : T.text3;
                      return (
                        <td key={t}
                          onClick={v > 0 && setTab ? () => irParaLista({ ...filtroSetor(s), ...filtroTipo(t) }) : undefined}
                          title={v > 0 ? `${s} × ${t}: ${v} desvio(s)` : undefined}
                          style={{ textAlign: "center", padding: "6px 4px", borderRadius: 6, background: bg, color: cor, fontWeight: v > 0 ? 700 : 400, cursor: v > 0 && setTab ? "pointer" : "default", minWidth: 42 }}>
                          {v || "·"}
                        </td>
                      );
                    })}
                    <td style={{ textAlign: "center", color: T.text, fontWeight: 800, padding: "4px 8px" }}>{totalSetor}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ color: T.text3, fontWeight: 700, padding: "4px 8px", fontSize: 10, textTransform: "uppercase" }}>Total</td>
                  {matriz.colunas.map(([t, totalTipo]) => (
                    <td key={t} style={{ textAlign: "center", color: T.text, fontWeight: 800, padding: "4px 6px" }}>{totalTipo}</td>
                  ))}
                  <td style={{ textAlign: "center", color: T.accent, fontWeight: 800, padding: "4px 8px" }}>{filtrados.length}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── SLA de triagem + Aging ── */}
      <div className="grid-2" style={{ marginBottom: 16 }}>
        {/* SLA */}
        <div style={card}>
          {cardTitle("⏱️", "Desempenho de Triagem", `Tempo do registro até encerrar/converter — meta: ${META_TRIAGEM_DIAS} dias`)}
          {a.triados.length === 0 ? semDados : (
            <>
              <div style={{ display: "flex", gap: 18, marginBottom: 8, flexWrap: "wrap" }}>
                {[
                  [`≤ ${META_TRIAGEM_DIAS} dias`, a.sla !== null ? `${a.sla}%` : "—", slaCor],
                  ["Mediana", a.med !== null ? `${a.med}d` : "—", T.text],
                  ["Triados", a.triados.length, T.text],
                ].map(([l, n, c]) => (
                  <div key={l}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: c }}>{n}</div>
                    <div style={{ fontSize: 10, color: T.text3 }}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{ height: 170 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={slaFaixas} barCategoryGap="28%">
                    <CartesianGrid stroke={T.border} vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: T.text2, fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
                    <YAxis tick={{ fill: T.text2, fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <RcTooltip content={<CustomTooltip />} cursor={{ fill: T.accentDim }} />
                    <Bar dataKey="Desvios" radius={[4, 4, 0, 0]} maxBarSize={44}>
                      {slaFaixas.map((f, i) => <Cell key={i} fill={f.c} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>

        {/* Aging */}
        <div style={card}>
          {cardTitle("⏳", "Desvios em Aberto há Mais Tempo", "Aguardando triagem da Qualidade — independe do filtro de período")}
          {abertosTotal > 0 && (
            <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              {[
                [`${abertosTotal} aberto${abertosTotal > 1 ? "s" : ""}`, DESVIO_SMETA["Registrado"].c],
                [`${abertos7} há > 7d`, abertos7 > 0 ? T.yellow : T.text3],
                [`${abertos15} há > 15d`, abertos15 > 0 ? T.red : T.text3],
              ].map(([l, c]) => (
                <span key={l} style={{ fontSize: 10, fontWeight: 700, color: c, background: T.surf, border: `1px solid ${T.border}`, borderRadius: 20, padding: "3px 10px" }}>{l}</span>
              ))}
            </div>
          )}
          {aging.length === 0 ? (
            <div style={{ padding: "1.5rem", textAlign: "center", color: T.accent, fontSize: 13, fontWeight: 600 }}>✅ Nenhum desvio aguardando triagem</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {aging.map(d => {
                const corDias = d.dias > 15 ? T.red : d.dias > 7 ? T.yellow : T.text2;
                return (
                  <div key={d.id} onClick={() => irParaLista({ busca: d.num })}
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

      {/* ── Produtos recorrentes + Engajamento ── */}
      <div className="grid-2">
        {/* Top produtos */}
        <div style={card}>
          {cardTitle("📦", "Produtos / Lotes Recorrentes", "Produto que repete desvio é sinal de revisão de processo — clique para ver os casos")}
          {topProdutos.length === 0 ? (
            <div style={{ padding: "1.2rem", textAlign: "center", color: T.text3, fontSize: 12 }}>Nenhum desvio com produto/lote informado no período</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {topProdutos.map(pr => (
                <div key={pr.nome} onClick={() => irParaLista({ busca: pr.nome })}
                  style={{ position: "relative", background: T.surf, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "center", gap: 10, cursor: setTab ? "pointer" : "default", overflow: "hidden" }}>
                  <div style={{ position: "absolute", inset: 0, width: `${pr.qtd / topProdutos[0].qtd * 100}%`, background: T.accentDim }} />
                  <span style={{ fontSize: 12, color: T.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", position: "relative" }}>{pr.nome}</span>
                  {pr.criticos > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: T.red, position: "relative", whiteSpace: "nowrap" }}>{pr.criticos} crítico{pr.criticos > 1 ? "s" : ""}</span>}
                  <span style={{ fontSize: 13, fontWeight: 800, color: T.accent, position: "relative", minWidth: 24, textAlign: "right" }}>{pr.qtd}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Engajamento */}
        <div style={card}>
          {cardTitle("🙌", "Engajamento no Registro", "Quem mais reporta fortalece a cultura de qualidade — reconhecimento, não cobrança")}
          {engajamento.length === 0 ? (
            <div style={{ padding: "1.2rem", textAlign: "center", color: T.text3, fontSize: 12 }}>Sem registros no período</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {engajamento.map((r, i) => (
                <div key={r.nome} style={{ background: T.surf, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 14 }}>{["🥇", "🥈", "🥉"][i] || "•"}</span>
                  <span style={{ fontSize: 12, color: T.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.nome}</span>
                  <span style={{ fontSize: 10, color: T.text3 }}>{a.total > 0 ? Math.round(r.qtd / a.total * 100) : 0}%</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: T.accent, minWidth: 24, textAlign: "right" }}>{r.qtd}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

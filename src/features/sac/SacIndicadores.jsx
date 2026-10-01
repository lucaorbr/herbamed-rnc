import React, { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RcTooltip, XAxis, YAxis } from "recharts";
import { useTheme } from "../../core/theme";
import { FiltroPeriodo, SituacaoAtual, usePeriodo } from "../../shared/FiltroPeriodo";
import { filtrarPorPeriodo, mesesDoPeriodo, periodoAnterior, resolverPeriodo } from "../../shared/periodoLogic";
import {
  CLASSIFICACOES_SAC, META_RESPOSTA_DIAS, LIMITE_RECORRENCIA_LOTE,
  dataRefSac, kpisSac, contarPor, lotesRecorrentes, porMesClassificacao, prazoSac, relatouReacao,
  diasPrimeiraResposta, diasAteEncerrar,
} from "./sacLogic";

// Cor fixa por classificação: o que pede ação (queixa, evento) em quente.
const COR_CLASSIF = {
  "Evento adverso": "#ff4f6a",
  "Queixa técnica": "#ff8c42",
  "Comercial": "#a78bfa",
  "Dúvida": "#4fc3f7",
  "Sugestão": "#5dd4b0",
  "Elogio": "#2ab84a",
  "A classificar": "#94a3b8",
};
const SERIES = [...CLASSIFICACOES_SAC.map(c => c.id).reverse(), "A classificar"];

export function SacIndicadores({ atendimentos = [] }) {
  const T = useTheme();
  const [sel, setSel] = usePeriodo("sac-indicadores", "12m");

  const { periodo, lista, anterior, meses } = useMemo(() => {
    const per = resolverPeriodo(sel, { datas: atendimentos.map(dataRefSac) });
    const ant = periodoAnterior(per);
    return {
      periodo: per,
      lista: filtrarPorPeriodo(atendimentos, per, dataRefSac),
      anterior: ant ? filtrarPorPeriodo(atendimentos, ant, dataRefSac) : null,
      meses: mesesDoPeriodo(per, 24),
    };
  }, [atendimentos, sel]);

  const k = useMemo(() => kpisSac(lista), [lista]);
  const kAnt = useMemo(() => (anterior ? kpisSac(anterior) : null), [anterior]);

  const serie = useMemo(() => porMesClassificacao(lista, meses).map(l => {
    const [ano, m] = l.mes.split("-").map(Number);
    return { ...l, rotulo: new Date(ano, m - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: meses.length > 12 ? "2-digit" : undefined }) };
  }), [lista, meses]);

  const porCanal = useMemo(() => contarPor(lista, a => a.canal), [lista]);
  const porProduto = useMemo(() => {
    const qualidade = lista.filter(a => ["Queixa técnica", "Evento adverso"].includes(a.classificacao));
    return contarPor(qualidade, a => a.produto).slice(0, 8).map(p => ({
      ...p,
      procedentes: qualidade.filter(a => (a.produto || "").trim() === p.nome && a.avaliacao?.resultado === "Procedente").length,
    }));
  }, [lista]);
  const lotes = useMemo(() => lotesRecorrentes(lista), [lista]);

  // Situação de hoje — independe do período.
  const abertos = atendimentos.filter(a => a.status !== "Encerrado");
  const hoje = {
    aClassificar: abertos.filter(a => a.status === "Aberto").length,
    atrasados: abertos.filter(a => prazoSac(a)?.atrasado).length,
    reacoes: abertos.filter(relatouReacao).length,
    amostrasAguardando: abertos.filter(a => a.amostra?.solicitada && !a.amostra?.recebida).length,
  };

  const exportCSV = () => {
    const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const cab = ["Nº", "Data contato", "Canal", "Produto", "Lote", "Classificação", "Status", "Reação relatada", "Avaliação", "RNC", "Dias até 1ª resposta", "Dias até encerrar", "Cidade", "UF"];
    // Sem nome, telefone e e-mail: o CSV sai da tela e circula — dado pessoal fica no sistema.
    const linhas = lista.map(a => [
      a.num, dataRefSac(a), a.canal, a.produto, a.lote, a.classificacao || "A classificar", a.status,
      relatouReacao(a) ? "Sim" : "Não", a.avaliacao?.resultado || "", a.rncNum || "",
      diasPrimeiraResposta(a) ?? "", diasAteEncerrar(a) ?? "", a.consumidorCidade, a.consumidorUF,
    ].map(esc).join(";"));
    const blob = new Blob(["﻿" + [cab.join(";"), ...linhas].join("\n")], { type: "text/csv;charset=utf-8" });
    const el = document.createElement("a");
    el.href = URL.createObjectURL(blob);
    el.download = `sac_indicadores_${periodo.de}_a_${periodo.ate}.csv`;
    el.click();
    URL.revokeObjectURL(el.href);
  };

  const Delta = ({ cur, prev, goodUp = false, unit = "" }) => {
    if (prev === null || prev === undefined || cur === null || cur === undefined) return null;
    const diff = Math.round((cur - prev) * 10) / 10;
    if (diff === 0) return <span style={{ fontSize: 10, color: T.text3, fontWeight: 600 }}>= estável</span>;
    const bom = goodUp ? diff > 0 : diff < 0;
    const txt = unit === "%" ? `${diff > 0 ? "+" : ""}${diff} pp` : `${diff > 0 ? "+" : ""}${diff}`;
    return <span style={{ fontSize: 10, fontWeight: 700, color: bom ? "#2ab84a" : T.red }}>{diff > 0 ? "▲" : "▼"} {txt}</span>;
  };

  const tiles = [
    { l: "Atendimentos no período", n: k.total, c: T.accent, d: kAnt && <Delta cur={k.total} prev={kAnt.total} /> },
    { l: "Queixas técnicas", n: k.queixas, c: "#ff8c42", d: kAnt && <Delta cur={k.queixas} prev={kAnt.queixas} /> },
    { l: "Eventos adversos", n: k.eventos, c: k.eventos ? "#ff4f6a" : T.text3, d: kAnt && <Delta cur={k.eventos} prev={kAnt.eventos} /> },
    { l: `Procedentes (de ${k.avaliadas} avaliada${k.avaliadas === 1 ? "" : "s"})`, n: k.taxaProcedencia !== null ? `${k.taxaProcedencia}%` : "—", c: T.accent, d: kAnt && <Delta cur={k.taxaProcedencia} prev={kAnt.taxaProcedencia} unit="%" /> },
    { l: `1ª resposta em até ${META_RESPOSTA_DIAS} dias`, n: k.taxaNoPrazo !== null ? `${k.taxaNoPrazo}%` : "—", c: k.taxaNoPrazo === null ? T.text3 : k.taxaNoPrazo >= 80 ? "#2ab84a" : k.taxaNoPrazo >= 60 ? T.yellow : T.red, d: kAnt && <Delta cur={k.taxaNoPrazo} prev={kAnt.taxaNoPrazo} goodUp unit="%" /> },
    { l: "Mediana até a 1ª resposta", n: k.medianaResposta !== null ? `${k.medianaResposta}d` : "—", c: T.accent },
    { l: "Mediana até encerrar", n: k.medianaEncerramento !== null ? `${k.medianaEncerramento}d` : "—", c: T.accent },
    { l: "Viraram RNC", n: k.comRnc, c: T.accent, d: kAnt && <Delta cur={k.comRnc} prev={kAnt.comRnc} /> },
  ];

  const card = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "1rem 1.2rem" };
  const titulo = (t, sub) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{t}</div>
      {sub && <div style={{ fontSize: 10, color: T.text3, marginTop: 2 }}>{sub}</div>}
    </div>
  );
  const vazio = <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: T.text3, fontSize: 12 }}>Sem dados no período</div>;
  const tip = { contentStyle: { background: T.card2, border: `1px solid ${T.border2}`, borderRadius: 10, fontSize: 12 }, labelStyle: { color: T.text2 } };

  return (
    <div>
      <FiltroPeriodo sel={sel} onChange={setSel} periodo={periodo}>
        <span style={{ fontSize: 12, color: T.text3 }}>{lista.length} atendimento(s) no período</span>
        <button onClick={exportCSV} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${T.border2}`, background: T.surf, color: T.text2, cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>⬇ Exportar CSV</button>
      </FiltroPeriodo>

      <div style={{ ...card, marginBottom: 16, display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>Agora <SituacaoAtual /></div>
        {[
          ["A classificar", hoje.aClassificar, "#4fc3f7"],
          [`Atrasados (> ${META_RESPOSTA_DIAS}d)`, hoje.atrasados, "#ff8c42"],
          ["Reação relatada em aberto", hoje.reacoes, "#ff4f6a"],
          ["Amostras aguardando chegada", hoje.amostrasAguardando, T.yellow],
        ].map(([l, n, c]) => (
          <div key={l} style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: n ? c : T.text3 }}>{n}</span>
            <span style={{ fontSize: 11, color: T.text2 }}>{l}</span>
          </div>
        ))}
      </div>

      <div className="kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 6 }}>
        {tiles.map(({ l, n, c, d }) => (
          <div key={l} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: c }}>{n}</div>{d}
            </div>
            <div style={{ fontSize: 11, color: T.text2, fontWeight: 500 }}>{l}</div>
          </div>
        ))}
      </div>
      {kAnt && <div style={{ fontSize: 10, color: T.text3, marginBottom: 16 }}>▲▼ variação vs. período anterior de mesma duração</div>}

      <div style={{ ...card, marginBottom: 16 }}>
        {titulo("📈 Atendimentos por mês e classificação", "Pela data do contato")}
        {lista.length === 0 ? vazio : (
          <>
            <div style={{ height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={serie}>
                  <CartesianGrid stroke={T.border} vertical={false} />
                  <XAxis dataKey="rotulo" tick={{ fill: T.text2, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: T.text2, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <RcTooltip {...tip} cursor={{ fill: T.accentDim }} />
                  {SERIES.map((sid, i) => (
                    <Bar key={sid} dataKey={sid} stackId="c" fill={COR_CLASSIF[sid]} stroke={T.card} strokeWidth={1} maxBarSize={32} radius={i === SERIES.length - 1 ? [3, 3, 0, 0] : 0} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 6, flexWrap: "wrap" }}>
              {SERIES.map(sid => (
                <div key={sid} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: T.text2 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: COR_CLASSIF[sid] }} />{sid}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div style={card}>
          {titulo("📦 Produtos com mais queixas", "Queixas técnicas e eventos adversos no período")}
          {porProduto.length === 0 ? vazio : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr style={{ color: T.text3, textAlign: "left" }}><th style={{ padding: "4px 6px" }}>Produto</th><th style={{ padding: "4px 6px", textAlign: "right" }}>Queixas</th><th style={{ padding: "4px 6px", textAlign: "right" }}>Procedentes</th></tr></thead>
              <tbody>
                {porProduto.map(p => (
                  <tr key={p.nome} style={{ borderTop: `1px solid ${T.border}`, color: T.text }}>
                    <td style={{ padding: "6px", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={p.nome}>{p.nome}</td>
                    <td style={{ padding: "6px", textAlign: "right", fontWeight: 700 }}>{p.qtd}</td>
                    <td style={{ padding: "6px", textAlign: "right", color: p.procedentes ? "#ff4f6a" : T.text3 }}>{p.procedentes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div style={card}>
          {titulo("📞 Por canal de contato")}
          {porCanal.length === 0 ? vazio : (
            <div style={{ height: Math.max(140, porCanal.length * 30) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porCanal} layout="vertical" margin={{ left: 10 }}>
                  <XAxis type="number" hide allowDecimals={false} />
                  <YAxis type="category" dataKey="nome" width={110} tick={{ fill: T.text2, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <RcTooltip {...tip} cursor={{ fill: T.accentDim }} />
                  <Bar dataKey="qtd" name="Atendimentos" fill={T.accent} radius={[0, 4, 4, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div style={card}>
        {titulo("🔁 Lotes citados em mais de um atendimento", `A partir de ${LIMITE_RECORRENCIA_LOTE} no mesmo lote, avalie investigação ampla ou recolhimento`)}
        {lotes.length === 0 ? <div style={{ fontSize: 12, color: T.text3, padding: "10px 0" }}>Nenhum lote repetido no período.</div> : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr style={{ color: T.text3, textAlign: "left" }}><th style={{ padding: "4px 6px" }}>Lote</th><th style={{ padding: "4px 6px" }}>Produto</th><th style={{ padding: "4px 6px", textAlign: "right" }}>Atendimentos</th><th style={{ padding: "4px 6px", textAlign: "right" }}>Procedentes</th><th style={{ padding: "4px 6px" }}>Nº</th></tr></thead>
            <tbody>
              {lotes.map(g => (
                <tr key={g.lote} style={{ borderTop: `1px solid ${T.border}`, color: T.text }}>
                  <td style={{ padding: "6px", fontWeight: 700, color: g.qtd >= LIMITE_RECORRENCIA_LOTE ? "#ff4f6a" : T.text }}>{g.qtd >= LIMITE_RECORRENCIA_LOTE && "⚠️ "}{g.lote}</td>
                  <td style={{ padding: "6px" }}>{g.produto}</td>
                  <td style={{ padding: "6px", textAlign: "right", fontWeight: 700 }}>{g.qtd}</td>
                  <td style={{ padding: "6px", textAlign: "right" }}>{g.procedentes}</td>
                  <td style={{ padding: "6px", color: T.text2, fontSize: 11 }}>{g.nums.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

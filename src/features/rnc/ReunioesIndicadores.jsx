import React, { useMemo } from "react";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RcTooltip, XAxis, YAxis,
} from "recharts";
import { useTheme } from "../../core/theme";
import { fmt } from "../../core/utils";
import { useS } from "../../shared/styles";
import { SecTitle, SevB, Tooltip } from "../../shared/ui";
import { LIMITE_EMPERRADA, rncsEmperradas, vezesNaPauta } from "./ReunioesTab";

// Fase 3 do RAC: a reunião passa a ter os mesmos 4 pilares que os Desvios já têm —
// aderência (o processo está sendo seguido?), quórum (quem devia estar, estava?),
// vazão (a fila anda?) e emperradas (o que não está andando, sinalizado). Tudo derivado
// das próprias reuniões — sem coleção nova, sem registro paralelo.

const seg = (m) => `${m}s. atrás`;

// Início (segunda-feira) da semana ISO de uma data YYYY-MM-DD.
function inicioSemana(iso) {
  const d = new Date(iso + "T12:00:00");
  const dia = d.getDay() || 7; // dom=0 -> 7
  d.setDate(d.getDate() - (dia - 1));
  return d.toISOString().split("T")[0];
}

export function ReunioesIndicadores({ rncs = [], reunioes = [] }) {
  const T = useTheme(); const s = useS();

  const encerradas = useMemo(() => reunioes.filter(r => r.status === "Encerrada"), [reunioes]);

  // ── KPIs ──
  const kpis = useMemo(() => {
    const totalItens = reunioes.reduce((n, r) => n + (r.pauta || []).length, 0);
    const itensDeliberados = reunioes.reduce((n, r) => n + (r.pauta || []).filter(i => i.itemStatus === "deliberado").length, 0);
    const aderencia = totalItens > 0 ? Math.round(itensDeliberados / totalItens * 100) : null;

    const quoruns = encerradas
      .filter(r => (r.participantes || []).length > 0)
      .map(r => r.participantes.filter(p => p.presente).length / r.participantes.length);
    const quorumMedio = quoruns.length > 0 ? Math.round(quoruns.reduce((a, b) => a + b, 0) / quoruns.length * 100) : null;

    const emperradas = rncsEmperradas(rncs, reunioes);

    return { totalItens, itensDeliberados, aderencia, quorumMedio, emperradas, reunioesRealizadas: encerradas.length };
  }, [reunioes, encerradas, rncs]);

  // ── Vazão semanal: itens deliberados por semana, últimas 12 semanas ──
  const vazao = useMemo(() => {
    const semanas = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (11 - i) * 7);
      return inicioSemana(d.toISOString().split("T")[0]);
    });
    const contagem = {};
    reunioes.forEach(r => (r.pauta || []).forEach(it => {
      if (it.itemStatus !== "deliberado" || !it.deliberadoEm) return;
      const sem = inicioSemana(it.deliberadoEm);
      contagem[sem] = (contagem[sem] || 0) + 1;
    }));
    return semanas.map(sem => ({
      sem, label: fmt(sem).slice(0, 5),
      "Itens deliberados": contagem[sem] || 0,
    }));
  }, [reunioes]);

  const KpiCard = ({ icon, label, value, sub, color, tip }) => (
    <div style={{ background: T.card, border: `1px solid ${color}33`, borderRadius: 14, padding: "12px 16px", flex: 1, minWidth: 160, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -6, right: -6, fontSize: 36, opacity: 0.08 }}>{icon}</div>
      <div style={{ fontSize: 10, color: T.text3, textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 600, display: "flex", alignItems: "center" }}>{label}{tip && <Tooltip text={tip} />}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1.3 }}>{value ?? "—"}</div>
      {sub && <div style={{ fontSize: 11, color: T.text2, marginTop: 2 }}>{sub}</div>}
    </div>
  );

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: T.card2, border: `1px solid ${T.border2}`, borderRadius: 10, padding: "8px 14px", fontSize: 12 }}>
        <div style={{ color: T.text2, marginBottom: 4, fontWeight: 600 }}>Semana de {label}</div>
        {payload.map((p, i) => <div key={i} style={{ color: p.color }}>{p.name}: <strong>{p.value}</strong></div>)}
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <KpiCard icon="🗓️" label="Reuniões realizadas" value={kpis.reunioesRealizadas} color={T.accent} sub={`${reunioes.length} agendada(s) ao todo`} tip="Quantas reuniões de análise crítica já foram encerradas com ata assinada, do total já agendado (inclui as ainda Agendadas ou Em andamento)." />
        <KpiCard icon="✅" label="Aderência da pauta" value={kpis.aderencia !== null ? `${kpis.aderencia}%` : "—"} color={kpis.aderencia >= 90 || kpis.aderencia === null ? T.accent : "#ff8c42"} sub={`${kpis.itensDeliberados} de ${kpis.totalItens} item(ns) deliberados`} tip="Percentual de itens de pauta, somando todas as reuniões (agendadas, em andamento e encerradas), que já receberam alguma deliberação. Um número baixo indica pauta acumulando sem decisão." />
        <KpiCard icon="👥" label="Quórum médio" value={kpis.quorumMedio !== null ? `${kpis.quorumMedio}%` : "—"} color={kpis.quorumMedio === null ? T.text3 : kpis.quorumMedio >= 70 ? T.accent : "#ff8c42"} sub="Presentes / convocados, reuniões encerradas" tip="Média, entre as reuniões já encerradas, do percentual de participantes marcados como 'presente' sobre o total de convocados. Não considera reuniões sem participantes cadastrados." />
        <KpiCard icon="🔁" label="RNCs emperradas" value={kpis.emperradas.length} color={kpis.emperradas.length > 0 ? "#ff4f6a" : T.accent} sub={`${LIMITE_EMPERRADA}+ passagens pela pauta sem sair`} tip={`RNCs que ainda pedem análise crítica e já passaram por ${LIMITE_EMPERRADA} ou mais reuniões encerradas sem sair da pauta — sinal de que o tratamento normal não está resolvendo. Mesmo critério do chip 🔁 na tela de Reuniões.`} />
      </div>

      <div style={s.card}>
        <SecTitle icon="📈" ch="Vazão semanal — itens deliberados" tip="Cada barra conta os itens de pauta deliberados naquela semana (data da deliberação, não da reunião). Uma fila saudável tem vazão estável ou crescente; barras caindo a zero indicam reuniões pausadas ou pauta represando." />
        <div style={{ fontSize: 11, color: T.text2, marginBottom: 10 }}>Últimas 12 semanas — sinaliza se a fila de análise crítica está andando ou represando.</div>
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={vazao}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: T.text2, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: T.text2, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <RcTooltip content={<CustomTooltip />} cursor={{ fill: T.accentDim }} />
              <Bar dataKey="Itens deliberados" fill={T.accent} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={s.card}>
        <SecTitle icon="🔁" ch={`RNCs emperradas na análise crítica (${kpis.emperradas.length})`} />
        {kpis.emperradas.length === 0
          ? <div style={{ color: T.text3, fontSize: 13, textAlign: "center", padding: "1rem" }}>Nenhuma RNC passou {LIMITE_EMPERRADA}+ vezes pela pauta sem sair. Fila saudável.</div>
          : kpis.emperradas.map(r => {
              const vezes = vezesNaPauta(r.id, reunioes) + 1;
              return (
                <div key={r.id} style={{ background: T.surf, border: "1px solid #ff4f6a33", borderLeft: "3px solid #ff4f6a", borderRadius: 8, padding: "10px 14px", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: T.accent }}>{r.num}</span>
                    <SevB s={r.sev} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#ff4f6a" }}>{vezes}ª passagem pela pauta</span>
                    <span style={{ marginLeft: "auto", fontSize: 10, color: T.text3 }}>{r.status}</span>
                  </div>
                  <div style={{ fontSize: 12, color: T.text }}>{r.desc?.slice(0, 90)}{r.desc?.length > 90 ? "…" : ""}</div>
                  <div style={{ fontSize: 10, color: T.text2, marginTop: 3 }}>Resp: {r.resp || "—"} · Prazo AC: {fmt(r.prazoAC)}</div>
                </div>
              );
            })
        }
      </div>
    </div>
  );
}

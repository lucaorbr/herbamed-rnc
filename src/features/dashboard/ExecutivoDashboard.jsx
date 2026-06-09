import React, { useState, useEffect } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip as RcTooltip, XAxis, YAxis, LineChart, Line,
} from "recharts";
import { logoutUser, subscribeCollection } from "../../firebase";
import { useTheme } from "../../core/theme";
import { tod } from "../../core/utils";
import { HerbamedLogo } from "../../shared/ui";

export function ExecutivoDashboard({ user, rncs, fornecedores, onClose }) {
  const T = useTheme();
  const [docs, setDocs] = useState([]);
  const [clock, setClock] = useState(new Date());
  const [mesSel, setMesSel] = useState(null);

  useEffect(() => {
    const unsub = subscribeCollection("gestao_docs", list => setDocs(list));
    const timer = setInterval(() => setClock(new Date()), 1000);
    const onKey = e => { if (e.key === "Escape" && onClose) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { unsub(); clearInterval(timer); window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  const hoje = tod();
  const d30 = new Date(); d30.setDate(d30.getDate() + 30);
  const d30str = d30.toISOString().split("T")[0];

  // ── KPIs principais ──
  const rncsAbertas    = rncs.filter(r => r.status === "Aberta").length;
  const rncsCriticas   = rncs.filter(r => r.sev === "Crítica" && r.status !== "Eficaz" && r.status !== "Ineficaz").length;
  const rncsVencidas   = rncs.filter(r => r.prazoAC && r.prazoAC < hoje && r.status !== "Eficaz" && r.status !== "Ineficaz").length;
  const eficaz         = rncs.filter(r => r.status === "Eficaz").length;
  const ineficaz       = rncs.filter(r => r.status === "Ineficaz").length;
  const taxaEficacia   = eficaz + ineficaz > 0 ? Math.round(eficaz / (eficaz + ineficaz) * 100) : null;
  const docsVencendo   = docs.filter(d => d.proximaRevisao && d.proximaRevisao >= hoje && d.proximaRevisao <= d30str && d.status !== "Obsoleto").length;
  const docsVigentes   = docs.filter(d => d.status === "Vigente").length;

  // Semáforo geral
  const situacao = rncsCriticas > 0 || rncsVencidas > 3
    ? { cor: "#ff4f6a", label: "Atenção Requerida", icon: "🔴" }
    : rncsVencidas > 0 || rncsAbertas > 5
    ? { cor: "#ffd166", label: "Monitoramento", icon: "🟡" }
    : { cor: "#2ab84a", label: "Sob Controle", icon: "🟢" };

  // ── Tendência RNCs por mês (últimos 6 meses) ──
  const meses6 = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
    return d.toISOString().slice(0, 7);
  });
  const tendencia = meses6.map(m => {
    const [ano, ms] = m.split("-").map(Number);
    const label = new Date(ano, ms - 1, 1).toLocaleDateString("pt-BR", { month: "short" });
    const abertas = rncs.filter(r => r.data && r.data.startsWith(m)).length;
    const eficazes = rncs.filter(r => r.eficacia?.data && r.eficacia.data.startsWith(m) && r.status === "Eficaz").length;
    return { _key: m, mes: label, "NC Abertas": abertas, "Encerradas Eficaz": eficazes };
  });

  // ── Top fornecedores com mais RNCs ──
  const fornMap = {};
  rncs.forEach(r => {
    if (!r.fornecedor || r.fornecedor === "—" || r.fornecedor === "-") return;
    fornMap[r.fornecedor] = (fornMap[r.fornecedor] || 0) + 1;
  });
  const topForn = Object.entries(fornMap)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([nome, qty]) => ({ nome: nome.length > 18 ? nome.slice(0, 16) + "…" : nome, RNCs: qty }));

  // ── Top causas raiz ──
  const causaMap = {};
  rncs.filter(r => r.ishikawa?.root).forEach(r => {
    const c = r.ishikawa.root.slice(0, 40);
    causaMap[c] = (causaMap[c] || 0) + 1;
  });
  const topCausas = Object.entries(causaMap)
    .sort((a, b) => b[1] - a[1]).slice(0, 4)
    .map(([causa, qty]) => ({ causa: causa.length > 30 ? causa.slice(0, 28) + "…" : causa, Ocorrências: qty }));

  // ── RNCs por status (pizza) ──
  const statusMap = {};
  rncs.forEach(r => { statusMap[r.status] = (statusMap[r.status] || 0) + 1; });
  const statusData = Object.entries(statusMap).map(([name, value]) => ({ name, value }));
  const STATUS_CORES = {
    "Aberta": "#ff4f6a", "Em andamento": "#ffd166",
    "Pendente verificação": "#4fc3f7", "Eficaz": "#2ab84a", "Ineficaz": "#ff8c42",
  };

  // RNCs críticas abertas
  const rncsCriticasLista = rncs.filter(r => r.sev === "Crítica" && r.status !== "Eficaz" && r.status !== "Ineficaz").slice(0, 4);

  // RNCs do mês selecionado
  const rncsMesSel = mesSel ? rncs.filter(r => r.data && r.data.startsWith(mesSel.key)) : [];

  const fmtClock = d => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const fmtDate  = d => d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const C = T;

  const KpiCard = ({ icon, label, value, sub, color, alert }) => (
    <div style={{ background: alert ? `${color}12` : C.card, border: `1px solid ${alert ? color + "55" : color + "33"}`, borderRadius: 16, padding: "1rem 1.2rem", display: "flex", flexDirection: "column", gap: 4, flex: 1, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -8, right: -8, fontSize: 48, opacity: 0.07 }}>{icon}</div>
      <div style={{ fontSize: 10, color: C.text3, textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 38, fontWeight: 800, color, lineHeight: 1 }}>{value ?? "—"}</div>
      {sub && <div style={{ fontSize: 11, color: C.text2 }}>{sub}</div>}
    </div>
  );

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: C.card2, border: `1px solid ${C.border2}`, borderRadius: 10, padding: "8px 14px", fontSize: 12 }}>
        <div style={{ color: C.text2, marginBottom: 4, fontWeight: 600 }}>{label}</div>
        {payload.map((p, i) => <div key={i} style={{ color: p.color }}>{p.name}: <strong>{p.value}</strong></div>)}
      </div>
    );
  };

  return (
    <div style={{ background: C.bg, height: "100vh", display: "flex", flexDirection: "column", fontFamily: "'DM Sans', system-ui, sans-serif", color: C.text, overflow: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* ── MODAL RNCs do mês ── */}
      {mesSel && (
        <div onClick={() => setMesSel(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background:C.card, border:`1px solid ${C.border2}`, borderRadius:18, width:"min(580px,92vw)", maxHeight:"80vh", display:"flex", flexDirection:"column", boxShadow:"0 24px 64px rgba(0,0,0,0.4)" }}>
            <div style={{ padding:"18px 22px 14px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <div style={{ fontSize:15, fontWeight:700, color:C.text }}>RNCs — {mesSel.label}</div>
                <div style={{ fontSize:11, color:C.text3, marginTop:2 }}>{rncsMesSel.length} registro(s)</div>
              </div>
              <button onClick={() => setMesSel(null)} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, color:C.text2, cursor:"pointer", fontSize:13, padding:"4px 12px", fontFamily:"inherit" }}>✕</button>
            </div>
            <div style={{ overflowY:"auto", padding:"12px 22px 18px" }}>
              {rncsMesSel.length === 0
                ? <div style={{ textAlign:"center", padding:"2rem", color:C.text3 }}>Nenhuma RNC neste mês.</div>
                : rncsMesSel.map(r => (
                  <div key={r.id} style={{ background:C.surf, border:`1px solid ${C.border}`, borderLeft:`3px solid ${STATUS_CORES[r.status]||C.text3}`, borderRadius:10, padding:"10px 14px", marginBottom:8 }}>
                    <div style={{ display:"flex", gap:8, marginBottom:4, alignItems:"center" }}>
                      <span style={{ fontSize:11, fontWeight:700, color:C.text }}>{r.num}</span>
                      <span style={{ fontSize:10, padding:"2px 8px", borderRadius:20, background:(STATUS_CORES[r.status]||C.text3)+"22", color:STATUS_CORES[r.status]||C.text3, fontWeight:600 }}>{r.status}</span>
                      <span style={{ fontSize:10, padding:"2px 8px", borderRadius:20, background:r.sev==="Crítica"?"#ff4f6a22":r.sev==="Maior"?"#ffd16622":"#aaa2", color:r.sev==="Crítica"?"#ff4f6a":r.sev==="Maior"?"#ffd166":C.text3, fontWeight:600 }}>{r.sev}</span>
                    </div>
                    <div style={{ fontSize:12, color:C.text2, marginBottom:3 }}>{r.desc?.slice(0, 80)}{r.desc?.length > 80 ? "…" : ""}</div>
                    <div style={{ display:"flex", gap:14, fontSize:10, color:C.text3 }}>
                      {r.resp && <span>👤 {r.resp}</span>}
                      {r.fornecedor && <span>🏭 {r.fornecedor}</span>}
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <div style={{ background: `linear-gradient(135deg,${C.surf},${C.card})`, borderBottom: `1px solid ${C.border2}`, padding: "0 2rem", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ background: "#fff", borderRadius: 10, padding: "4px 14px", boxShadow: `0 0 18px ${C.accentGlow}` }}>
            <HerbamedLogo height={24} white={false} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>SGQ Herbamed®</div>
            <div style={{ fontSize: 10, color: C.accent, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".1em" }}>Dashboard Executivo</div>
          </div>
          {/* Semáforo */}
          <div style={{ marginLeft: 24, display:"flex", alignItems:"center", gap:8, padding:"6px 14px", background:`${situacao.cor}15`, border:`1px solid ${situacao.cor}44`, borderRadius:20 }}>
            <span style={{ fontSize:14 }}>{situacao.icon}</span>
            <span style={{ fontSize:12, fontWeight:700, color:situacao.cor }}>{situacao.label}</span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: C.text, letterSpacing: "-.02em", lineHeight: 1 }}>{fmtClock(clock)}</div>
          <div style={{ fontSize: 10, color: C.text2, marginTop: 2, textTransform: "capitalize" }}>{fmtDate(clock)}</div>
        </div>
        <button onClick={onClose || (() => {})} title="Fechar (ESC)" style={{ background:"none", border:`1px solid ${C.border2}`, borderRadius:8, color:C.text3, cursor:"pointer", fontSize:11, padding:"6px 14px", fontFamily:"inherit" }}>
          ✕ Fechar
        </button>
      </div>

      {/* ── BODY ── */}
      <div style={{ flex: 1, padding: "1rem 1.5rem .8rem", display: "flex", flexDirection: "column", gap: ".8rem", overflow: "hidden" }}>

        {/* ── ROW 1: KPI CARDS ── */}
        <div style={{ display: "flex", gap: ".8rem", flexShrink: 0 }}>
          <KpiCard icon="📋" label="RNCs Abertas"    value={rncsAbertas}   color={rncsAbertas > 0 ? C.yellow : C.accent}   sub={`${rncs.length} total no sistema`} alert={rncsAbertas > 5} />
          <KpiCard icon="🔴" label="NC Críticas Ativas" value={rncsCriticas}  color={rncsCriticas > 0 ? "#ff4f6a" : C.accent} sub="Severidade crítica em aberto"  alert={rncsCriticas > 0} />
          <KpiCard icon="⏰" label="Prazos Vencidos"  value={rncsVencidas}  color={rncsVencidas > 0 ? C.orange : C.accent}  sub="Ações corretivas em atraso"    alert={rncsVencidas > 0} />
          <KpiCard icon="✅" label="Taxa de Eficácia" value={taxaEficacia !== null ? `${taxaEficacia}%` : "—"} color={taxaEficacia >= 80 ? C.accent : taxaEficacia !== null ? C.yellow : C.text3} sub={`${eficaz} eficaz · ${ineficaz} ineficaz`} />
          <KpiCard icon="🗂️" label="Docs Vigentes"   value={docsVigentes}  color={C.accent}                                sub={`${docsVencendo > 0 ? `⚠ ${docsVencendo} vencendo em 30d` : "Revisões em dia"}`} alert={docsVencendo > 0} />
        </div>

        {/* ── ROW 2 ── */}
        <div style={{ display: "flex", gap: ".8rem", flex: 1, minHeight: 0 }}>

          {/* Tendência de RNCs */}
          <div style={{ flex: 2, background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "1rem 1.2rem", display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 2 }}>📈 Tendência de Não Conformidades</div>
            <div style={{ fontSize: 10, color: C.text3, marginBottom: 10 }}>Últimos 6 meses — clique no mês para detalhes</div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={tendencia} style={{ cursor: "pointer" }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                  <XAxis dataKey="mes" tick={{ fill: C.text2, fontSize: 11 }} axisLine={false} tickLine={false}
                    onClick={d => { const e = tendencia.find(m => m.mes === d.value); if (e) setMesSel({ key: e._key, label: e.mes }); }}
                  />
                  <YAxis tick={{ fill: C.text2, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <RcTooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="NC Abertas" stroke="#ff4f6a" strokeWidth={2.5} dot={{ r: 4, fill: "#ff4f6a" }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="Encerradas Eficaz" stroke={C.accent} strokeWidth={2.5} dot={{ r: 4, fill: C.accent }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
              {[["NC Abertas", "#ff4f6a"], ["Encerradas Eficaz", C.accent]].map(([l, c]) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.text2 }}>
                  <div style={{ width: 10, height: 3, borderRadius: 2, background: c }} />{l}
                </div>
              ))}
            </div>
          </div>

          {/* RNCs por status */}
          <div style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "1rem 1.2rem", display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 2 }}>📊 RNCs por Status</div>
            <div style={{ fontSize: 10, color: C.text3, marginBottom: 10 }}>{rncs.length} registros totais</div>
            {statusData.length === 0
              ? <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:C.text3, fontSize:12 }}>Sem dados</div>
              : <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "1rem", minHeight: 0 }}>
                  <div style={{ flex: 1, height: "100%" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={statusData} dataKey="value" cx="50%" cy="50%" innerRadius="38%" outerRadius="68%" paddingAngle={3}>
                          {statusData.map((d, i) => <Cell key={i} fill={STATUS_CORES[d.name] || T.accent} />)}
                        </Pie>
                        <RcTooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7, flexShrink: 0 }}>
                    {statusData.map(d => (
                      <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11 }}>
                        <div style={{ width: 9, height: 9, borderRadius: 3, background: STATUS_CORES[d.name] || T.accent, flexShrink: 0 }} />
                        <span style={{ color: C.text2 }}>{d.name}</span>
                        <span style={{ color: C.text, fontWeight: 700, marginLeft: "auto", paddingLeft: 8 }}>{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
            }
          </div>
        </div>

        {/* ── ROW 3 ── */}
        <div style={{ display: "flex", gap: ".8rem", flex: 1, minHeight: 0 }}>

          {/* Top Fornecedores com mais RNCs */}
          <div style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "1rem 1.2rem", display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 2 }}>🏭 Fornecedores com Mais RNCs</div>
            <div style={{ fontSize: 10, color: C.text3, marginBottom: 10 }}>Top 5 por número de não conformidades</div>
            {topForn.length === 0
              ? <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:C.text3, fontSize:12 }}>Sem dados</div>
              : <div style={{ flex: 1, minHeight: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topForn} layout="vertical" barCategoryGap="25%">
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
                      <XAxis type="number" tick={{ fill: C.text2, fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="nome" tick={{ fill: C.text2, fontSize: 11 }} axisLine={false} tickLine={false} width={110} />
                      <RcTooltip content={<CustomTooltip />} cursor={{ fill: C.accentDim }} />
                      <Bar dataKey="RNCs" fill={C.orange} radius={[0, 5, 5, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
            }
          </div>

          {/* Top causas raiz */}
          <div style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "1rem 1.2rem", display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 2 }}>🎯 Top Causas Raiz Recorrentes</div>
            <div style={{ fontSize: 10, color: C.text3, marginBottom: 10 }}>Identificadas via análise de Ishikawa / 5 Porquês</div>
            {topCausas.length === 0
              ? <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:C.text3, fontSize:12 }}>Nenhuma causa raiz identificada ainda</div>
              : <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, justifyContent: "center" }}>
                  {topCausas.map((c, i) => (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <div style={{ minWidth: 22, height: 22, borderRadius: "50%", background: `linear-gradient(135deg,${T.accent},${T.accent2||T.accent})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"#fff", flexShrink:0 }}>{i+1}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:11, color:C.text, fontWeight:500, marginBottom:3 }}>{c.causa}</div>
                        <div style={{ height:4, background:C.border, borderRadius:2 }}>
                          <div style={{ height:"100%", width:`${(c.Ocorrências / topCausas[0].Ocorrências) * 100}%`, background:T.accent, borderRadius:2 }} />
                        </div>
                      </div>
                      <div style={{ fontSize:12, fontWeight:700, color:T.accent, minWidth:24, textAlign:"right" }}>{c.Ocorrências}x</div>
                    </div>
                  ))}
                </div>
            }
          </div>

          {/* RNCs Críticas em Aberto */}
          <div style={{ flex: 1, background: rncsCriticas > 0 ? "#ff4f6a08" : C.card, border: `1px solid ${rncsCriticas > 0 ? "#ff4f6a33" : C.border}`, borderRadius: 16, padding: "1rem 1.2rem", display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: rncsCriticas > 0 ? "#ff4f6a" : C.text, marginBottom: 2 }}>🔴 NCs Críticas em Aberto</div>
            <div style={{ fontSize: 10, color: C.text3, marginBottom: 10 }}>Requerem ação imediata</div>
            {rncsCriticasLista.length === 0
              ? <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:C.accent, fontSize:13, gap:6 }}>
                  <div style={{ fontSize:28 }}>✅</div>
                  <div style={{ fontWeight:600 }}>Nenhuma NC crítica ativa</div>
                </div>
              : <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                  {rncsCriticasLista.map(r => (
                    <div key={r.id} style={{ background:C.surf, border:"1px solid #ff4f6a33", borderLeft:"3px solid #ff4f6a", borderRadius:8, padding:"8px 10px" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
                        <span style={{ fontSize:11, fontWeight:700, color:"#ff4f6a" }}>{r.num}</span>
                        <span style={{ fontSize:10, color:C.text3 }}>{r.status}</span>
                      </div>
                      <div style={{ fontSize:11, color:C.text2, lineHeight:1.4 }}>{r.desc?.slice(0, 55)}{r.desc?.length > 55 ? "…" : ""}</div>
                      {r.resp && <div style={{ fontSize:10, color:C.text3, marginTop:3 }}>👤 {r.resp}</div>}
                    </div>
                  ))}
                </div>
            }
          </div>
        </div>

        <div style={{ textAlign: "center", fontSize: 10, color: C.text3, flexShrink: 0 }}>
          SGQ Herbamed® · Dados em tempo real · Atualizado às {fmtClock(clock)}
        </div>
      </div>
    </div>
  );
}

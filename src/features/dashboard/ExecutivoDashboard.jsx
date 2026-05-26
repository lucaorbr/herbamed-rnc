import React, { useState, useEffect } from "react";
import { logoutUser, subscribeCollection } from "../../firebase";
import { useTheme } from "../../core/theme";
import { tod } from "../../core/utils";
import { HerbamedLogo } from "../../shared/ui";

export function ExecutivoDashboard({ user, rncs, fornecedores, onClose }) {
  const T = useTheme();
  const [analises, setAnalises] = useState([]);
  const [docs, setDocs] = useState([]);
  const [clock, setClock] = useState(new Date());
  const [mesSel, setMesSel] = useState(null); // { key: "2026-05", label: "mai. de 26" }

  useEffect(() => {
    const unsub1 = subscribeCollection("cq_analises", list => setAnalises(list));
    const unsub2 = subscribeCollection("gestao_docs", list => setDocs(list));
    const timer = setInterval(() => setClock(new Date()), 1000);
    const onKey = e => { if (e.key === "Escape" && onClose) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { unsub1(); unsub2(); clearInterval(timer); window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  const hoje = tod();
  const mes = hoje.slice(0, 7);
  const d30 = new Date(); d30.setDate(d30.getDate() + 30);
  const d30str = d30.toISOString().split("T")[0];

  // ── KPIs ──
  const rncsAbertas     = rncs.filter(r => r.status === "Aberta").length;
  const rncsVencidas    = rncs.filter(r => r.prazoAC && r.prazoAC < hoje && r.status !== "Eficaz" && r.status !== "Ineficaz").length;
  const eficaz          = rncs.filter(r => r.status === "Eficaz").length;
  const ineficaz        = rncs.filter(r => r.status === "Ineficaz").length;
  const taxaEficacia    = eficaz + ineficaz > 0 ? Math.round(eficaz / (eficaz + ineficaz) * 100) : null;
  const docsVencendo    = docs.filter(d => d.proximaRevisao && d.proximaRevisao >= hoje && d.proximaRevisao <= d30str && d.status !== "Obsoleto").length;
  const reprovMes       = analises.filter(a => (a.conclusao === "Reprovado") && a.data && a.data.startsWith(mes)).length;

  // ── Gráfico 1: RNCs por mês (últimos 6 meses) ──
  const mesesLabels = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    mesesLabels.push(d.toISOString().slice(0, 7));
  }
  const rncsPorMes = mesesLabels.map(m => {
    const [ano, mes_] = m.split("-").map(Number);
    const label = new Date(ano, mes_ - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
    return {
      _key: m,
      mes: label,
      Abertas:  rncs.filter(r => r.data && r.data.startsWith(m)).length,
      Eficazes: rncs.filter(r => r.data && r.data.startsWith(m) && r.status === "Eficaz").length,
    };
  });

  // ── Gráfico 2: Top 5 fornecedores com mais RNCs ──
  const fornMap = {};
  rncs.forEach(r => {
    if (!r.fornecedor) return;
    fornMap[r.fornecedor] = (fornMap[r.fornecedor] || 0) + 1;
  });
  const topForn = Object.entries(fornMap)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([nome, qty]) => ({ nome: nome.length > 18 ? nome.slice(0, 16) + "…" : nome, RNCs: qty }));

  // ── Gráfico 3: Materiais com mais reprovações ──
  const matMap = {};
  analises.filter(a => a.conclusao === "Reprovado").forEach(a => {
    const k = a.materialNome || "N/D";
    matMap[k] = (matMap[k] || 0) + 1;
  });
  const topMat = Object.entries(matMap)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([nome, qty]) => ({ nome: nome.length > 18 ? nome.slice(0, 16) + "…" : nome, Reprovações: qty }));

  // ── Gráfico 4: Status documentos ──
  const docStatusMap = {};
  docs.forEach(d => { if (d.status) docStatusMap[d.status] = (docStatusMap[d.status] || 0) + 1; });
  const docStatusData = Object.entries(docStatusMap).map(([name, value]) => ({ name, value }));
  const PIE_COLORS = [T.accent, T.yellow, T.blue, T.red, T.orange, T.purple];

  const C = T;
  const fmtClock = d => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const fmtDate  = d => d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  const KpiCard = ({ icon, label, value, sub, color, big }) => (
    <div style={{ background: C.card, border: `1px solid ${color}33`, borderRadius: 16, padding: "1.2rem 1.4rem", display: "flex", flexDirection: "column", gap: 6, flex: 1, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -10, right: -10, fontSize: 52, opacity: 0.06 }}>{icon}</div>
      <div style={{ fontSize: 11, color: C.text3, textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: big ? 42 : 36, fontWeight: 800, color, lineHeight: 1 }}>{value ?? "—"}</div>
      {sub && <div style={{ fontSize: 11, color: C.text2 }}>{sub}</div>}
    </div>
  );

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: C.card2, border: `1px solid ${C.border2}`, borderRadius: 10, padding: "8px 14px", fontSize: 12 }}>
        <div style={{ color: C.text2, marginBottom: 4, fontWeight: 600 }}>{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color }}>{p.name}: <strong>{p.value}</strong></div>
        ))}
      </div>
    );
  };

  // RNCs do mês selecionado
  const rncsMesSel = mesSel ? rncs.filter(r => r.data && r.data.startsWith(mesSel.key)) : [];
  const STATUS_COR = { "Aberta":"#ff4f6a","Em Análise":"#ffd166","Aguardando AC":"#ff8c42","AC Implementada":"#4fc3f7","Eficaz":"#2ab84a","Ineficaz":"#ff4f6a" };

  return (
    <div style={{ background: C.bg, height: "100vh", display: "flex", flexDirection: "column", fontFamily: "'DM Sans', system-ui, sans-serif", color: C.text, overflow: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* ── MODAL RNCs do mês ── */}
      {mesSel && (
        <div onClick={() => setMesSel(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background:C.card, border:`1px solid ${C.border2}`, borderRadius:18, width:"min(580px,92vw)", maxHeight:"80vh", display:"flex", flexDirection:"column", boxShadow:"0 24px 64px rgba(0,0,0,0.4)" }}>
            {/* Header modal */}
            <div style={{ padding:"18px 22px 14px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <div style={{ fontSize:15, fontWeight:700, color:C.text }}>📊 RNCs — {mesSel.label.charAt(0).toUpperCase() + mesSel.label.slice(1)}</div>
                <div style={{ fontSize:11, color:C.text3, marginTop:2 }}>{rncsMesSel.length} registro(s) encontrado(s)</div>
              </div>
              <button onClick={() => setMesSel(null)} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, color:C.text2, cursor:"pointer", fontSize:13, padding:"4px 12px", fontFamily:"inherit" }}>✕ Fechar</button>
            </div>
            {/* Lista */}
            <div style={{ overflowY:"auto", padding:"12px 22px 18px" }}>
              {rncsMesSel.length === 0 ? (
                <div style={{ textAlign:"center", padding:"2rem", color:C.text3 }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>📭</div>
                  <div>Nenhuma RNC registrada neste mês.</div>
                </div>
              ) : rncsMesSel.map(r => (
                <div key={r.id} style={{ background:C.surf, border:`1px solid ${C.border}`, borderLeft:`3px solid ${STATUS_COR[r.status]||C.text3}`, borderRadius:10, padding:"10px 14px", marginBottom:8 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                    <span style={{ fontSize:11, fontWeight:700, color:C.text }}>{r.num || r.id}</span>
                    <span style={{ fontSize:10, padding:"2px 8px", borderRadius:20, background:(STATUS_COR[r.status]||C.text3)+"22", color:STATUS_COR[r.status]||C.text3, fontWeight:600 }}>{r.status}</span>
                    {r.tipo && <span style={{ fontSize:10, color:C.text3 }}>{r.tipo}</span>}
                  </div>
                  <div style={{ fontSize:12, color:C.text2, marginBottom:3 }}>{r.desc || r.descricao || "—"}</div>
                  <div style={{ display:"flex", gap:14, fontSize:10, color:C.text3 }}>
                    {r.resp && <span>👤 {r.resp}</span>}
                    {r.fornecedor && <span>🏭 {r.fornecedor}</span>}
                    {r.data && <span>📅 {r.data}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <div style={{ background: `linear-gradient(135deg,${C.surf},${C.card})`, borderBottom: `1px solid ${C.border2}`, padding: "0 2rem", height: 68, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ background: "#fff", borderRadius: 10, padding: "4px 14px", boxShadow: `0 0 18px ${C.accentGlow}` }}>
            <HerbamedLogo height={26} white={false} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text, letterSpacing: "-.01em" }}>SGQ Herbamed®</div>
            <div style={{ fontSize: 10, color: C.accent, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".1em" }}>Dashboard Executivo</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: C.text, letterSpacing: "-.02em", lineHeight: 1 }}>{fmtClock(clock)}</div>
          <div style={{ fontSize: 11, color: C.text2, marginTop: 2, textTransform: "capitalize" }}>{fmtDate(clock)}</div>
        </div>
        {onClose ? (
          <button onClick={onClose} title="Fechar apresentação (ESC)" style={{ background:"none", border:`1px solid ${C.border2}`, borderRadius:8, color:C.text3, cursor:"pointer", fontSize:11, padding:"6px 14px", fontFamily:"inherit", display:"flex", alignItems:"center", gap:6 }}>
            ✕ Fechar
          </button>
        ) : (
          <button onClick={() => { logoutUser(); window.location.reload(); }} style={{ background:"none", border:`1px solid ${C.border2}`, borderRadius:8, color:C.text3, cursor:"pointer", fontSize:11, padding:"6px 12px", fontFamily:"inherit" }}>
            🚪 Sair
          </button>
        )}
      </div>

      {/* ── BODY ── */}
      <div style={{ flex: 1, padding: "1.2rem 1.5rem 1rem", display: "flex", flexDirection: "column", gap: "1rem", overflow: "auto" }}>

        {/* ── ROW 1: KPI CARDS ── */}
        <div style={{ display: "flex", gap: "1rem" }}>
          <KpiCard icon="📋" label="RNCs Abertas"   value={rncsAbertas}  color={rncsAbertas > 0 ? C.red : C.accent}   sub={`${rncs.length} total no sistema`} />
          <KpiCard icon="⚠️" label="Prazos Vencidos" value={rncsVencidas} color={rncsVencidas > 0 ? C.yellow : C.accent} sub="Ações corretivas em atraso" />
          <KpiCard icon="✅" label="Taxa de Eficácia" value={taxaEficacia !== null ? `${taxaEficacia}%` : "—"} color={taxaEficacia >= 80 ? C.accent : taxaEficacia !== null ? C.yellow : C.text3} sub={`${eficaz} eficaz · ${ineficaz} ineficaz`} />
          <KpiCard icon="🗂️" label="Docs p/ Revisão"  value={docsVencendo}  color={docsVencendo > 0 ? C.orange : C.accent} sub="Vencendo em 30 dias" />
          <KpiCard icon="🧪" label="Reprovações CQ"   value={reprovMes}     color={reprovMes > 0 ? C.red : C.accent}     sub="Análises reprovadas no mês" />
        </div>

        {/* ── ROW 2: CHARTS ── */}
        <div style={{ display: "flex", gap: "1rem", flex: 1 }}>

          {/* RNCs por mês */}
          <div style={{ flex: 2, background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "1.2rem 1.4rem", display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 4 }}>📊 RNCs por Mês</div>
            <div style={{ fontSize: 10, color: C.text3, marginBottom: 14 }}>Últimos 6 meses</div>
            <div style={{ flex: 1, minHeight: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rncsPorMes} barCategoryGap="30%" style={{ cursor: "pointer" }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                  <XAxis dataKey="mes" tick={{ fill: C.text2, fontSize: 11 }} axisLine={false} tickLine={false}
                    onClick={(data) => {
                      const entry = rncsPorMes.find(m => m.mes === data.value);
                      if (entry) setMesSel({ key: entry._key, label: entry.mes });
                    }}
                    style={{ cursor: "pointer" }}
                  />
                  <YAxis tick={{ fill: C.text2, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <RcTooltip content={<CustomTooltip />} cursor={{ fill: C.accentDim }} />
                  <Bar dataKey="Abertas"  fill={C.red}    radius={[5,5,0,0]}
                    onClick={(data) => { if (data._key) setMesSel({ key: data._key, label: data.mes }); }}
                  />
                  <Bar dataKey="Eficazes" fill={C.accent} radius={[5,5,0,0]}
                    onClick={(data) => { if (data._key) setMesSel({ key: data._key, label: data.mes }); }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 8, alignItems: "center" }}>
              {[["Abertas", C.red], ["Eficazes", C.accent]].map(([l, c]) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.text2 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: c }} />{l}
                </div>
              ))}
              <div style={{ marginLeft: "auto", fontSize: 10, color: C.text3 }}>Clique no mês para ver detalhes</div>
            </div>
          </div>

          {/* Top Fornecedores */}
          <div style={{ flex: 1.2, background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "1.2rem 1.4rem", display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 4 }}>🏭 Top Fornecedores</div>
            <div style={{ fontSize: 10, color: C.text3, marginBottom: 14 }}>Por número de RNCs</div>
            {topForn.length === 0 ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: C.text3, fontSize: 12 }}>Sem dados</div>
            ) : (
              <div style={{ flex: 1, minHeight: 140 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topForn} layout="vertical" barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
                    <XAxis type="number" tick={{ fill: C.text2, fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="nome" tick={{ fill: C.text2, fontSize: 11 }} axisLine={false} tickLine={false} width={100} />
                    <RcTooltip content={<CustomTooltip />} cursor={{ fill: C.accentDim }} />
                    <Bar dataKey="RNCs" fill={C.orange} radius={[0,5,5,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* ── ROW 3: CHARTS ── */}
        <div style={{ display: "flex", gap: "1rem", flex: 1 }}>

          {/* Materiais Reprovados */}
          <div style={{ flex: 2, background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "1.2rem 1.4rem", display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 4 }}>🧪 Materiais com Mais Reprovações</div>
            <div style={{ fontSize: 10, color: C.text3, marginBottom: 14 }}>Histórico acumulado de análises reprovadas</div>
            {topMat.length === 0 ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: C.text3, fontSize: 12 }}>Sem reprovações registradas ✓</div>
            ) : (
              <div style={{ flex: 1, minHeight: 130 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topMat} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                    <XAxis dataKey="nome" tick={{ fill: C.text2, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: C.text2, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <RcTooltip content={<CustomTooltip />} cursor={{ fill: C.accentDim }} />
                    <Bar dataKey="Reprovações" fill={C.red} radius={[5,5,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Status Documentos */}
          <div style={{ flex: 1.2, background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "1.2rem 1.4rem", display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 4 }}>🗂️ Status dos Documentos</div>
            <div style={{ fontSize: 10, color: C.text3, marginBottom: 14 }}>{docs.length} documento(s) no sistema</div>
            {docStatusData.length === 0 ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: C.text3, fontSize: 12 }}>Nenhum documento</div>
            ) : (
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "1rem", minHeight: 130 }}>
                <div style={{ flex: 1, height: "100%" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={docStatusData} dataKey="value" cx="50%" cy="50%" innerRadius="40%" outerRadius="70%" paddingAngle={3}>
                        {docStatusData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <RcTooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
                  {docStatusData.map((d, i) => (
                    <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                      <span style={{ color: C.text2 }}>{d.name}</span>
                      <span style={{ color: C.text, fontWeight: 700, marginLeft: "auto", paddingLeft: 8 }}>{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", fontSize: 10, color: C.text3, paddingBottom: 4 }}>
          SGQ Herbamed® · Dados em tempo real · Atualizado às {fmtClock(clock)}
        </div>
      </div>
    </div>
  );
}

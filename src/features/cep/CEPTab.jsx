import React, { useState } from "react";
import { useTheme } from "../../core/theme";
import { useS } from "../../shared/styles";
import { Inp, SecTitle } from "../../shared/ui";

export function CEPTab({ rncs }) {
  const T = useTheme(); const s = useS();
  const [metric, setMetric] = useState("rncs_mes");
  const [customData, setCustomData] = useState([{ label:"", value:"" },{ label:"", value:"" },{ label:"", value:"" }]);

  // Calcular dados de RNCs por mês (últimos 12 meses)
  const meses = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    const label = d.toLocaleDateString("pt-BR",{month:"short",year:"2-digit"});
    meses.push({ key, label });
  }

  const dadosMes = meses.map(m => ({
    label: m.label,
    value: rncs.filter(r => r.data?.startsWith(m.key)).length,
  }));

  const dadosEficacia = meses.map(m => ({
    label: m.label,
    value: rncs.filter(r => r.data?.startsWith(m.key) && r.status === "Eficaz").length,
  }));

  const activeData = metric === "custom" ? customData.map(x=>({...x,value:Number(x.value)||0})) : metric === "eficacia" ? dadosEficacia : dadosMes;
  const values = activeData.map(x => Number(x.value) || 0);
  const n = values.length;
  const mean = n > 0 ? values.reduce((a,b)=>a+b,0)/n : 0;
  const stdDev = n > 1 ? Math.sqrt(values.reduce((a,b)=>a+(b-mean)**2,0)/(n-1)) : 0;
  const UCL = mean + 3 * stdDev;
  const LCL = Math.max(0, mean - 3 * stdDev);
  const maxVal = Math.max(...values, UCL, 1);
  const outOfControl = values.filter(v => v > UCL || v < LCL).length;

  const barH = 200;
  const barW = Math.max(40, Math.floor(560 / Math.max(values.length, 1)));

  return (
    <div>
      <div style={{ ...s.card, marginBottom:"1rem" }}>
        <div style={{ fontSize:15, fontWeight:700, color:T.text, marginBottom:4 }}>📉 CEP — Controle Estatístico de Processo</div>
        <div style={{ fontSize:12, color:T.text2, lineHeight:1.6 }}>
          Monitora a variação do processo ao longo do tempo. Pontos fora dos limites UCL/LCL indicam causas especiais que requerem investigação.
        </div>
      </div>

      {/* Seletor de métrica */}
      <div style={{ display:"flex", gap:8, marginBottom:"1rem", flexWrap:"wrap" }}>
        {[["rncs_mes","📋 RNCs por Mês"],["eficacia","✅ Eficazes por Mês"],["custom","✏️ Dados Customizados"]].map(([id,label])=>(
          <button key={id} onClick={()=>setMetric(id)} style={{ padding:"7px 16px", borderRadius:20, border:`1px solid ${metric===id?T.accent+"55":T.border}`, background:metric===id?T.accentDim:T.surf, color:metric===id?T.accent:T.text2, cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:metric===id?600:400 }}>{label}</button>
        ))}
      </div>

      {/* Entrada de dados customizados */}
      {metric === "custom" && (
        <div style={{ ...s.card, marginBottom:"1rem" }}>
          <SecTitle ch="Inserir dados customizados" />
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:8 }}>
            {customData.map((d,i)=>(
              <div key={i} style={{ display:"flex", gap:4, alignItems:"center" }}>
                <Inp placeholder={`Label ${i+1}`} value={d.label} onChange={e=>setCustomData(p=>p.map((x,j)=>j===i?{...x,label:e.target.value}:x))} sx={{ width:80, fontSize:12 }}/>
                <Inp placeholder="Valor" type="number" value={d.value} onChange={e=>setCustomData(p=>p.map((x,j)=>j===i?{...x,value:e.target.value}:x))} sx={{ width:60, fontSize:12 }}/>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button style={s.btn} onClick={()=>setCustomData(p=>[...p,{label:"",value:""}])}>+ Adicionar ponto</button>
            {customData.length>3&&<button style={s.btnD} onClick={()=>setCustomData(p=>p.slice(0,-1))}>− Remover</button>}
          </div>
        </div>
      )}

      {/* Indicadores */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10, marginBottom:"1rem" }}>
        {[
          ["Média (X̄)", mean.toFixed(2), T.accent],
          ["Desvio Padrão (σ)", stdDev.toFixed(2), T.blue],
          ["UCL (+3σ)", UCL.toFixed(2), "#ff8c42"],
          ["LCL (-3σ)", LCL.toFixed(2), "#a78bfa"],
          ["Fora de Controle", outOfControl, outOfControl>0?"#ff4f6a":T.accent],
        ].map(([l,v,c])=>(
          <div key={l} style={{ background:T.surf, border:`1px solid ${T.border}`, borderRadius:10, padding:"10px 12px", textAlign:"center" }}>
            <div style={{ fontSize:18, fontWeight:700, color:c }}>{v}</div>
            <div style={{ fontSize:10, color:T.text3, marginTop:2 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Gráfico de controle */}
      <div style={{ ...s.card }}>
        <div style={{ fontSize:13, fontWeight:600, color:T.text, marginBottom:4 }}>
          Carta de Controle — {metric==="rncs_mes"?"RNCs por Mês":metric==="eficacia"?"Eficazes por Mês":"Dados Customizados"}
        </div>
        <div style={{ fontSize:11, color:T.text2, marginBottom:"1rem", paddingBottom:".75rem", borderBottom:`1px solid ${T.border}` }}>
          {outOfControl>0?<span style={{ color:"#ff4f6a", fontWeight:600 }}>⚠ {outOfControl} ponto(s) fora dos limites de controle — investigar causas especiais.</span>:<span style={{ color:T.accent }}>✓ Processo sob controle estatístico.</span>}
        </div>

        <div style={{ overflowX:"auto" }}>
          <svg width={Math.max(600, values.length*barW+80)} height={barH+80} style={{ display:"block" }}>
            {/* Grid lines */}
            {[0,.25,.5,.75,1].map((p,i)=>(
              <g key={i}>
                <line x1={50} y1={20+barH*(1-p)} x2={50+values.length*barW} y2={20+barH*(1-p)} stroke={T.border} strokeWidth={1} strokeDasharray="4,4"/>
                <text x={44} y={24+barH*(1-p)} textAnchor="end" fontSize={9} fill={T.text3}>{(maxVal*p).toFixed(1)}</text>
              </g>
            ))}

            {/* UCL line */}
            <line x1={50} y1={20+barH*(1-UCL/maxVal)} x2={50+values.length*barW} y2={20+barH*(1-UCL/maxVal)} stroke="#ff8c42" strokeWidth={1.5} strokeDasharray="6,3"/>
            <text x={55+values.length*barW} y={24+barH*(1-UCL/maxVal)} fontSize={9} fill="#ff8c42" fontWeight="700">UCL</text>

            {/* Mean line */}
            <line x1={50} y1={20+barH*(1-mean/maxVal)} x2={50+values.length*barW} y2={20+barH*(1-mean/maxVal)} stroke={T.accent} strokeWidth={2}/>
            <text x={55+values.length*barW} y={24+barH*(1-mean/maxVal)} fontSize={9} fill={T.accent} fontWeight="700">X̄</text>

            {/* LCL line */}
            {LCL > 0 && <>
              <line x1={50} y1={20+barH*(1-LCL/maxVal)} x2={50+values.length*barW} y2={20+barH*(1-LCL/maxVal)} stroke="#a78bfa" strokeWidth={1.5} strokeDasharray="6,3"/>
              <text x={55+values.length*barW} y={24+barH*(1-LCL/maxVal)} fontSize={9} fill="#a78bfa" fontWeight="700">LCL</text>
            </>}

            {/* Data bars + line */}
            {values.map((v,i)=>{
              const x = 50 + i*barW + barW/2;
              const y = 20 + barH*(1 - v/maxVal);
              const outCtrl = v > UCL || (LCL > 0 && v < LCL);
              return (
                <g key={i}>
                  <rect x={50+i*barW+4} y={y} width={barW-8} height={barH*(v/maxVal)} fill={outCtrl?`#ff4f6a22`:`${T.accent}22`} rx={3}/>
                  {i > 0 && <line x1={50+(i-1)*barW+barW/2} y1={20+barH*(1-values[i-1]/maxVal)} x2={x} y2={y} stroke={outCtrl?"#ff4f6a":T.accent} strokeWidth={1.5}/>}
                  <circle cx={x} cy={y} r={5} fill={outCtrl?"#ff4f6a":T.accent} stroke={T.bg} strokeWidth={2}/>
                  <text x={x} y={barH+30} textAnchor="middle" fontSize={9} fill={T.text3}>{activeData[i]?.label||i+1}</text>
                  <text x={x} y={y-8} textAnchor="middle" fontSize={9} fill={outCtrl?"#ff4f6a":T.text2} fontWeight={outCtrl?"700":"400"}>{v}</text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Legenda */}
        <div style={{ display:"flex", gap:16, marginTop:"1rem", flexWrap:"wrap" }}>
          {[["─","#ff8c42","UCL — Limite Superior de Controle"],["─",T.accent,"X̄ — Média"],["─","#a78bfa","LCL — Limite Inferior de Controle"],["●","#ff4f6a","Fora de controle"]].map(([sym,c,l])=>(
            <div key={l} style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:T.text2 }}>
              <span style={{ color:c, fontWeight:700 }}>{sym}</span>{l}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

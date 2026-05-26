import React, { useState } from "react";
import { useTheme } from "../../core/theme";
import { fmt, tod } from "../../core/utils";
import { useS } from "../../shared/styles";
import { F, Inp, SecTitle, Sel } from "../../shared/ui";

export const NQA_LETRAS = {
  2:     { I:"A", II:"A", III:"B", "S-1":"A", "S-2":"A", "S-3":"A", "S-4":"A" },
  8:     { I:"A", II:"B", III:"C", "S-1":"A", "S-2":"A", "S-3":"A", "S-4":"A" },
  15:    { I:"B", II:"C", III:"D", "S-1":"A", "S-2":"A", "S-3":"B", "S-4":"B" },
  25:    { I:"C", II:"D", III:"E", "S-1":"A", "S-2":"B", "S-3":"B", "S-4":"C" },
  50:    { I:"C", II:"E", III:"F", "S-1":"B", "S-2":"B", "S-3":"C", "S-4":"C" },
  90:    { I:"C", II:"F", III:"G", "S-1":"B", "S-2":"B", "S-3":"C", "S-4":"D" },
  150:   { I:"D", II:"G", III:"H", "S-1":"B", "S-2":"C", "S-3":"D", "S-4":"E" },
  280:   { I:"E", II:"H", III:"J", "S-1":"B", "S-2":"C", "S-3":"D", "S-4":"E" },
  500:   { I:"F", II:"J", III:"K", "S-1":"C", "S-2":"C", "S-3":"E", "S-4":"F" },
  1200:  { I:"G", II:"K", III:"L", "S-1":"C", "S-2":"D", "S-3":"E", "S-4":"G" },
  3200:  { I:"H", II:"L", III:"M", "S-1":"C", "S-2":"D", "S-3":"F", "S-4":"G" },
  10000: { I:"J", II:"M", III:"N", "S-1":"C", "S-2":"E", "S-3":"F", "S-4":"H" },
  35000: { I:"K", II:"N", III:"P", "S-1":"C", "S-2":"E", "S-3":"G", "S-4":"H" },
  150000:{ I:"L", II:"P", III:"Q", "S-1":"D", "S-2":"F", "S-3":"G", "S-4":"J" },
  500000:{ I:"M", II:"Q", III:"R", "S-1":"D", "S-2":"F", "S-3":"H", "S-4":"J" },
  999999:{ I:"N", II:"R", III:"S", "S-1":"D", "S-2":"G", "S-3":"H", "S-4":"K" },
};

export const NQA_AMOSTRAS = {
  A:  { n:2,   ac:{ "0.065":0,"0.1":0,"0.15":0,"0.25":0,"0.4":0,"0.65":0,"1.0":0,"1.5":0,"2.5":0,"4.0":0,"6.5":0,"10":0 }, re:{ "0.065":1,"0.1":1,"0.15":1,"0.25":1,"0.4":1,"0.65":1,"1.0":1,"1.5":1,"2.5":1,"4.0":1,"6.5":1,"10":1 } },
  B:  { n:3,   ac:{ "0.25":0,"0.4":0,"0.65":0,"1.0":0,"1.5":0,"2.5":0,"4.0":0,"6.5":0,"10":1 }, re:{ "0.25":1,"0.4":1,"0.65":1,"1.0":1,"1.5":1,"2.5":1,"4.0":1,"6.5":1,"10":2 } },
  C:  { n:5,   ac:{ "0.4":0,"0.65":0,"1.0":0,"1.5":0,"2.5":0,"4.0":0,"6.5":1,"10":1 }, re:{ "0.4":1,"0.65":1,"1.0":1,"1.5":1,"2.5":1,"4.0":1,"6.5":2,"10":2 } },
  D:  { n:8,   ac:{ "0.65":0,"1.0":0,"1.5":0,"2.5":0,"4.0":1,"6.5":1,"10":2 }, re:{ "0.65":1,"1.0":1,"1.5":1,"2.5":1,"4.0":2,"6.5":2,"10":3 } },
  E:  { n:13,  ac:{ "1.0":0,"1.5":0,"2.5":1,"4.0":1,"6.5":2,"10":3 }, re:{ "1.0":1,"1.5":1,"2.5":2,"4.0":2,"6.5":3,"10":4 } },
  F:  { n:20,  ac:{ "1.0":0,"1.5":1,"2.5":1,"4.0":2,"6.5":3,"10":5 }, re:{ "1.0":1,"1.5":2,"2.5":2,"4.0":3,"6.5":4,"10":6 } },
  G:  { n:32,  ac:{ "1.0":1,"1.5":1,"2.5":2,"4.0":3,"6.5":5,"10":7 }, re:{ "1.0":2,"1.5":2,"2.5":3,"4.0":4,"6.5":6,"10":8 } },
  H:  { n:50,  ac:{ "1.0":1,"1.5":2,"2.5":3,"4.0":5,"6.5":7,"10":10}, re:{ "1.0":2,"1.5":3,"2.5":4,"4.0":6,"6.5":8,"10":11} },
  J:  { n:80,  ac:{ "1.0":2,"1.5":3,"2.5":5,"4.0":7,"6.5":10,"10":14}, re:{ "1.0":3,"1.5":4,"2.5":6,"4.0":8,"6.5":11,"10":15} },
  K:  { n:125, ac:{ "1.0":3,"1.5":5,"2.5":7,"4.0":10,"6.5":14,"10":21}, re:{ "1.0":4,"1.5":6,"2.5":8,"4.0":11,"6.5":15,"10":22} },
  L:  { n:200, ac:{ "1.0":5,"1.5":7,"2.5":10,"4.0":14,"6.5":21}, re:{ "1.0":6,"1.5":8,"2.5":11,"4.0":15,"6.5":22} },
  M:  { n:315, ac:{ "1.0":7,"1.5":10,"2.5":14,"4.0":21}, re:{ "1.0":8,"1.5":11,"2.5":15,"4.0":22} },
  N:  { n:500, ac:{ "1.0":10,"1.5":14,"2.5":21}, re:{ "1.0":11,"1.5":15,"2.5":22} },
  P:  { n:800, ac:{ "1.0":14,"1.5":21}, re:{ "1.0":15,"1.5":22} },
  Q:  { n:1250,ac:{ "1.0":21}, re:{ "1.0":22} },
};

export function getLetra(tam, nivel) {
  const limites = Object.keys(NQA_LETRAS).map(Number).sort((a,b)=>a-b);
  for (const l of limites) { if (tam <= l) return NQA_LETRAS[l][nivel]; }
  return "S";
}

export function NQATab({ user, toast_ }) {
  const T = useTheme(); const s = useS();
  const [tam, setTam] = useState("");
  const [nivel, setNivel] = useState("II");
  const [nqa, setNqa] = useState("1.0");
  const [resultado, setResultado] = useState(null);
  const [historico, setHistorico] = useState([]);

  const calcular = () => {
    const n = parseInt(tam);
    if (!n || n < 2) { alert("Informe o tamanho do lote (mínimo 2)."); return; }
    const letra = getLetra(n, nivel);
    const tabela = NQA_AMOSTRAS[letra];
    if (!tabela) { alert("Letra fora da tabela. Verifique os parâmetros."); return; }
    const ac = tabela.ac[nqa];
    const re = tabela.re[nqa];
    if (ac === undefined) {
      setResultado({ letra, n: tabela.n, ac: "↑", re: "↑", obs: "Use plano de amostragem com letra maior ou reduza o NQA." });
    } else {
      const res = { letra, n: tabela.n, ac, re, lote: n, nivel, nqa, data: tod(), resp: user.name };
      setResultado(res);
      setHistorico(p => [res, ...p.slice(0, 9)]);
      toast_("Amostragem calculada!", "green");
    }
  };

  const NIVEIS_GERAIS = [
    { id:"I",   label:"Nível I",   desc:"Visual reduzido" },
    { id:"II",  label:"Nível II",  desc:"Visual normal (padrão)" },
    { id:"III", label:"Nível III", desc:"Visual reforçado" },
  ];
  const NIVEIS_ESPECIAIS = [
    { id:"S-1", label:"S-1", desc:"Amostra mínima" },
    { id:"S-2", label:"S-2", desc:"Amostra reduzida" },
    { id:"S-3", label:"S-3", desc:"Amostra normal" },
    { id:"S-4", label:"S-4", desc:"Amostra maior" },
  ];
  const NQAS = ["0.065","0.1","0.15","0.25","0.4","0.65","1.0","1.5","2.5","4.0","6.5","10"];
  const MATERIAL_NQA = [
    { tipo:"Inspeção visual geral",                    nivel:"II",  nqa:"1.0",  grupo:"Nível Geral (Visual)" },
    { tipo:"Inspeção visual rigorosa",                 nivel:"III", nqa:"0.65", grupo:"Nível Geral (Visual)" },
    { tipo:"Dimensional — embalagem primária",         nivel:"S-3", nqa:"1.5",  grupo:"Nível Especial" },
    { tipo:"Dimensional — embalagem secundária",       nivel:"S-2", nqa:"2.5",  grupo:"Nível Especial" },
    { tipo:"Físico-químico — MP crítica",              nivel:"S-2", nqa:"0.65", grupo:"Nível Especial" },
    { tipo:"Físico-químico — MP geral / excipiente",   nivel:"S-2", nqa:"1.0",  grupo:"Nível Especial" },
    { tipo:"Microbiológico — matéria-prima",           nivel:"S-1", nqa:"0.65", grupo:"Nível Especial" },
    { tipo:"Microbiológico — produto acabado",         nivel:"S-1", nqa:"1.0",  grupo:"Nível Especial" },
  ];

  return (
    <div>
      {/* Info card */}
      <div style={{ ...s.card, background:`linear-gradient(135deg,${T.card},${T.card2})`, marginBottom:"1rem" }}>
        <div style={{ fontSize:15, fontWeight:700, color:T.text, marginBottom:4 }}>📐 NQA / AQL — Cálculo de Amostragem ISO 2859-1</div>
        <div style={{ fontSize:12, color:T.text2, lineHeight:1.7, maxWidth:700 }}>
          O <strong>Nível de Qualidade Aceitável (NQA)</strong> define quantas unidades inspecionar em um lote recebido e quantos defeitos são toleráveis antes de reprovar o lote. Baseado na norma <strong>ISO 2859-1</strong> (equivalente ANSI/ASQ Z1.4).
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.5rem" }}>
        {/* Calculadora */}
        <div>
          <div style={s.card}>
            <SecTitle icon="🔢" ch="Calculadora de amostragem" />

            <F lbl="Tamanho do lote (unidades)" ch={
              <Inp type="number" placeholder="Ex: 5000" value={tam} onChange={e=>setTam(e.target.value)} onKeyDown={e=>e.key==="Enter"&&calcular()} />
            }/>

            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, color:T.text3, fontWeight:600, textTransform:"uppercase", letterSpacing:".06em", marginBottom:6 }}>Nível Geral — Inspeção Visual</div>
              <div style={{ display:"flex", gap:6, marginBottom:10 }}>
                {NIVEIS_GERAIS.map(n=>(
                  <button key={n.id} onClick={()=>setNivel(n.id)} style={{ flex:1, padding:"7px 6px", border:`1px solid ${nivel===n.id?T.accent+"55":T.border}`, background:nivel===n.id?T.accentDim:T.surf, color:nivel===n.id?T.accent:T.text2, cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:nivel===n.id?600:400, borderRadius:8, textAlign:"center" }}>
                    <div style={{ fontWeight:700 }}>{n.label}</div>
                    <div style={{ fontSize:9, marginTop:1, opacity:.7 }}>{n.desc}</div>
                  </button>
                ))}
              </div>
              <div style={{ fontSize:11, color:T.text3, fontWeight:600, textTransform:"uppercase", letterSpacing:".06em", marginBottom:6 }}>Nível Especial — Dimensional / Físico-químico / Microbiológico</div>
              <div style={{ display:"flex", gap:6 }}>
                {NIVEIS_ESPECIAIS.map(n=>(
                  <button key={n.id} onClick={()=>setNivel(n.id)} style={{ flex:1, padding:"7px 6px", border:`1px solid ${nivel===n.id?T.accent+"55":T.border}`, background:nivel===n.id?T.accentDim:T.surf, color:nivel===n.id?T.accent:T.text2, cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:nivel===n.id?600:400, borderRadius:8, textAlign:"center" }}>
                    <div style={{ fontWeight:700 }}>{n.label}</div>
                    <div style={{ fontSize:9, marginTop:1, opacity:.7 }}>{n.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <F lbl="NQA desejado (%)" ch={
              <Sel value={nqa} onChange={e=>setNqa(e.target.value)}>
                {NQAS.map(n=><option key={n} value={n}>{n}%{n==="1.0"?" (padrão farmacêutico)":""}</option>)}
              </Sel>
            }/>

            <button style={{ ...s.btnA, width:"100%", marginTop:8, fontSize:14, padding:"12px" }} onClick={calcular}>
              Calcular amostragem →
            </button>

            {/* Resultado */}
            {resultado && (
              <div style={{ marginTop:"1.25rem", background:T.accentDim, border:`1px solid ${T.accent}33`, borderRadius:12, padding:"1.25rem" }}>
                <div style={{ fontSize:12, color:T.accent, fontWeight:700, textTransform:"uppercase", letterSpacing:".06em", marginBottom:"1rem" }}>✅ Resultado</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
                  {[
                    ["Letra do código", resultado.letra, T.accent],
                    ["Tamanho da amostra", resultado.n, T.accent],
                    ["Nº de aceitação (Ac)", resultado.ac === "↑" ? "—" : resultado.ac, "#2ab84a"],
                    ["Nº de rejeição (Re)", resultado.re === "↑" ? "—" : resultado.re, "#ff4f6a"],
                  ].map(([l,v,c])=>(
                    <div key={l} style={{ background:T.surf, borderRadius:8, padding:"10px 12px" }}>
                      <div style={{ fontSize:10, color:T.text3, fontWeight:700, textTransform:"uppercase", marginBottom:4 }}>{l}</div>
                      <div style={{ fontSize:24, fontWeight:800, color:c }}>{v}</div>
                    </div>
                  ))}
                </div>
                {resultado.obs && <div style={{ fontSize:12, color:"#ff8c42", marginBottom:8 }}>⚠ {resultado.obs}</div>}
                <div style={{ fontSize:12, color:T.text2, lineHeight:1.7, background:T.surf, borderRadius:8, padding:"10px 12px" }}>
                  <strong>Como usar:</strong> Colete <strong style={{ color:T.accent }}>{resultado.n} amostras</strong> aleatórias do lote.<br/>
                  Se encontrar até <strong style={{ color:"#2ab84a" }}>{resultado.ac}</strong> defeito(s) → <span style={{ color:"#2ab84a", fontWeight:700 }}>APROVAR</span> o lote.<br/>
                  Se encontrar <strong style={{ color:"#ff4f6a" }}>{resultado.re}</strong> ou mais defeito(s) → <span style={{ color:"#ff4f6a", fontWeight:700 }}>REPROVAR</span> o lote.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tabela de referência + histórico */}
        <div>
          <div style={{ ...s.card, marginBottom:"1rem" }}>
            <SecTitle icon="📋" ch="Referência por tipo de análise" />
            {["Nível Geral (Visual)","Nível Especial"].map(grupo=>(
              <div key={grupo} style={{ marginBottom:12 }}>
                <div style={{ fontSize:10, fontWeight:700, color:T.accent, textTransform:"uppercase", letterSpacing:".06em", marginBottom:6, paddingBottom:4, borderBottom:`1px solid ${T.border}` }}>{grupo}</div>
                {MATERIAL_NQA.filter(m=>m.grupo===grupo).map((m,i)=>(
                  <div key={i} onClick={()=>{setNqa(m.nqa);setNivel(m.nivel);}} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 10px", background:T.surf, border:`1px solid ${T.border}`, borderRadius:8, marginBottom:5, cursor:"pointer", transition:"all .15s" }}>
                    <div style={{ fontSize:12, color:T.text }}>{m.tipo}</div>
                    <div style={{ display:"flex", gap:6, alignItems:"center", flexShrink:0 }}>
                      <span style={{ fontSize:10, color:T.text3 }}>Nível {m.nivel}</span>
                      <span style={{ fontSize:11, fontWeight:700, color:T.accent, background:T.accentDim, padding:"2px 8px", borderRadius:20 }}>NQA {m.nqa}%</span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            <div style={{ fontSize:11, color:T.text3, fontStyle:"italic" }}>💡 Clique para aplicar automaticamente</div>
          </div>

          {historico.length > 0 && (
            <div style={s.card}>
              <SecTitle icon="🕐" ch="Histórico de cálculos" />
              {historico.map((h,i)=>(
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 12px", background:T.surf, border:`1px solid ${T.border}`, borderRadius:8, marginBottom:6, fontSize:12 }}>
                  <div>
                    <span style={{ fontWeight:600, color:T.text }}>Lote: {h.lote} un.</span>
                    <span style={{ color:T.text3, marginLeft:8 }}>NQA {h.nqa}% · Nível {h.nivel}</span>
                  </div>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <span style={{ color:T.accent, fontWeight:700 }}>n={h.n}</span>
                    <span style={{ color:"#2ab84a" }}>Ac≤{h.ac}</span>
                    <span style={{ color:"#ff4f6a" }}>Re≥{h.re}</span>
                    <span style={{ color:T.text3, fontSize:10 }}>{fmt(h.data)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from "react";
import { saveCollection, deleteFromCollection, subscribeCollection } from "../../firebase";
import { useTheme } from "../../core/theme";
import { exportFMEAPDF } from "../pdf/pdfExports";
import { askClaude } from "../../services/aiClient";
import { useS } from "../../shared/styles";
import { Inp, Tooltip } from "../../shared/ui";

export function FMEATab({ user, toast_, auditLog }) {
  const T = useTheme(); const s = useS();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [processo, setProcesso] = useState("");

  useEffect(() => {
    const unsub = subscribeCollection("fmea", (list) => {
      setItems(list.sort((a,b) => (b.id||0) - (a.id||0)));
      setLoading(false);
    });
    // Safety timeout — show empty if Firestore takes too long
    const t = setTimeout(() => setLoading(false), 3000);
    return () => { unsub(); clearTimeout(t); };
  }, []);

  const addItem = async () => {
    try {
    const novo = { id: Date.now(), processo: "", modoFalha: "", efeito: "", causa: "", S: 1, O: 1, D: 1, acao: "", resp: user.name, prazo: "", status: "Pendente", criadoPor: user.name };
    await saveCollection("fmea", String(novo.id), novo);
    await auditLog("Criou item FMEA", "fmea", String(novo.id), novo.processo || String(novo.id), null, { processo: novo.processo, modoFalha: novo.modoFalha });
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const fmeaDebounceRef = useRef({});
  const upd = async (id, k, v) => {
    try {
    const item = items.find(x => String(x.id) === String(id));
    if (item) {
      await saveCollection("fmea", String(id), { ...item, [k]: v });
      // Debounce: agrupa edições do mesmo item em 2s para não poluir log
      const key = String(id);
      if (fmeaDebounceRef.current[key]) clearTimeout(fmeaDebounceRef.current[key]);
      fmeaDebounceRef.current[key] = setTimeout(async () => {
        await auditLog("Editou item FMEA", "fmea", String(id), item.processo || String(id), null, { [k]: v });
        delete fmeaDebounceRef.current[key];
      }, 2000);
    }
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const del = async (id) => {
    try {
    if (!confirm("Remover este item?")) return;
    const antes = items.find(x => String(x.id) === String(id));
    await deleteFromCollection("fmea", String(id));
    await auditLog("Excluiu item FMEA", "fmea", String(id), antes?.processo || String(id), antes, null);
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const rpn = (item) => item.S * item.O * item.D;
  const rpnColor = (r) => r >= 100 ? "#ff4f6a" : r >= 50 ? "#ff8c42" : r >= 25 ? "#ffd166" : T.accent;
  const rpnLabel = (r) => r >= 100 ? "🔴 CRÍTICO" : r >= 50 ? "🟠 ALTO" : r >= 25 ? "🟡 MÉDIO" : "🟢 BAIXO";

  const gerarIA = async () => {
    if (!processo.trim()) { alert("Descreva o processo primeiro."); return; }
    setAiLoading(true);
    try {
      const txt = await askClaude(`Você é especialista em FMEA para indústria farmacêutica/suplementos. Gere uma análise FMEA para o processo abaixo.

PROCESSO: ${processo}
EMPRESA: Herbamed® (fabricante de suplementos alimentares)

Gere exatamente 5 modos de falha relevantes. Responda APENAS em JSON válido:
[
  {
    "processo": "${processo}",
    "modoFalha": "modo de falha específico",
    "efeito": "efeito no produto/cliente",
    "causa": "causa raiz provável",
    "S": 7,
    "O": 4,
    "D": 3,
    "acao": "ação preventiva recomendada"
  }
]
S=Severidade(1-10), O=Ocorrência(1-10), D=Detecção(1-10)`);
      const clean = txt.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      const novos = parsed.map(p => ({ id: Date.now() + Math.round(Math.random()*1000), resp: user.name, prazo: "", status: "Pendente", criadoPor: user.name, ...p, S: Number(p.S)||5, O: Number(p.O)||3, D: Number(p.D)||3 }));
      for (const item of novos) await saveCollection("fmea", String(item.id), item);
      await auditLog("Gerou FMEA por IA", "fmea", "lote", processo, null, { quantidade: novos.length, processo });
      toast_("FMEA gerado pela IA!", "green");
    } catch { toast_("Erro ao gerar. Tente novamente.", "red"); }
    setAiLoading(false);
  };

  const sorted = [...items].sort((a, b) => rpn(b) - rpn(a));

  return (
    <div>
      {/* Intro */}
      <div style={{ ...s.card, background:`linear-gradient(135deg,${T.card},${T.card2})`, marginBottom:"1rem" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12 }}>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:T.text, marginBottom:4 }}>⚠️ FMEA — Análise de Modo e Efeito de Falha</div>
            <div style={{ fontSize:12, color:T.text2, lineHeight:1.6, maxWidth:560 }}>
              Identifica e prioriza riscos <strong>antes</strong> que os problemas ocorram. O RPN (Risk Priority Number) = Severidade × Ocorrência × Detecção.
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            {items.length>0 && <button style={{ ...s.btn, color:"#ff8c42", borderColor:"#ff8c4233", background:"#ff8c4212" }} onClick={()=>exportFMEAPDF(items)}><span className="btn-emoji">📄 </span>Exportar PDF</button>}
            <button style={s.btnA} onClick={addItem}>+ Adicionar item</button>
          </div>
        </div>

        {/* Gerador IA */}
        <div style={{ marginTop:"1rem", padding:"1rem", background:T.accentDim, border:`1px solid ${T.accent}33`, borderRadius:10 }}>
          <div style={{ fontSize:12, fontWeight:700, color:T.accent, marginBottom:8 }}>🤖 Gerar FMEA com IA</div>
          <div style={{ display:"flex", gap:8 }}>
            <Inp placeholder="Descreva o processo (ex: Encapsulação de Psyllium em pó)" value={processo} onChange={e => setProcesso(e.target.value)} sx={{ flex: 1 }} />
            <button style={{ ...s.btnA, whiteSpace:"nowrap", opacity:aiLoading?.6:1, display:"flex", alignItems:"center", gap:6 }} onClick={gerarIA} disabled={aiLoading}>
              {aiLoading ? <><span style={{ animation:"spin 1s linear infinite", display:"inline-block" }}>⟳</span> Gerando...</> : "✨ Gerar"}
            </button>
          </div>
        </div>
      </div>

      {/* RPN Legend */}
      <div style={{ display:"flex", gap:8, marginBottom:"1rem", flexWrap:"wrap" }}>
        {[["🟢 BAIXO","RPN < 25","#2ab84a"],["🟡 MÉDIO","RPN 25-49","#ffd166"],["🟠 ALTO","RPN 50-99","#ff8c42"],["🔴 CRÍTICO","RPN ≥ 100","#ff4f6a"]].map(([l,sub,c])=>(
          <div key={l} style={{ background:T.surf, border:`1px solid ${c}33`, borderRadius:8, padding:"6px 12px", fontSize:11 }}>
            <span style={{ fontWeight:600, color:c }}>{l}</span>
            <span style={{ color:T.text3, marginLeft:6 }}>{sub}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      {loading ? <div style={{ textAlign:"center", padding:"3rem", color:T.text2 }}>Carregando...</div> :
       sorted.length === 0 ? (
        <div style={{ ...s.card, textAlign:"center", padding:"3rem" }}>
          <div style={{ fontSize:40, marginBottom:"1rem", opacity:.3 }}>⚠️</div>
          <div style={{ fontSize:14, color:T.text2, marginBottom:6 }}>Nenhum item FMEA cadastrado</div>
          <div style={{ fontSize:12, color:T.text3 }}>Clique em "+ Adicionar item" ou use o gerador de IA</div>
        </div>
      ) : (
        <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, overflow:"hidden", marginBottom:"1rem" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:T.surf }}>
                {[
                  ["Processo", "Etapa ou processo sendo analisado. Ex: Pesagem de MP, Encapsulamento, Rotulagem."],
                  ["Modo de Falha", "O que pode dar errado neste processo? Ex: Peso fora da especificação, cápsula mal fechada, rótulo invertido."],
                  ["Efeito", "Qual o impacto se o modo de falha ocorrer? Ex: Produto fora do padrão, recall, risco ao paciente."],
                  ["Causa", "Por que o modo de falha pode ocorrer? Ex: Balança descalibrada, falha do operador, matéria-prima fora do padrão."],
                  ["S", "Severidade (1-10): impacto do efeito. 1=mínimo, 10=catastrófico."],
                  ["O", "Ocorrência (1-10): probabilidade de a causa ocorrer. 1=improvável, 10=quase certo."],
                  ["D", "Detecção (1-10): capacidade de detectar a falha antes que chegue ao cliente. 1=detecção certa, 10=indetectável."],
                  ["RPN", "Número de Prioridade de Risco = S × O × D. Quanto maior, maior a prioridade de ação."],
                  ["Prioridade", "Classificação automática baseada no RPN: Crítico (>200), Alto (>120), Médio (>60), Baixo."],
                  ["Ação", "Ação recomendada para reduzir o RPN. Foque em reduzir Severidade, Ocorrência ou melhorar Detecção."],
                  ["Resp.", "Responsável pela execução da ação recomendada."],
                  ["Status", "Estado atual da ação: Pendente, Em andamento ou Concluída."],
                  ["", ""],
                ].map(([h, tip]) => (
                  <th key={h} style={{ padding:"10px 10px", fontSize:10, fontWeight:700, color:T.text3, textTransform:"uppercase", letterSpacing:".06em", textAlign:"left", borderBottom:`1px solid ${T.border}`, whiteSpace:"nowrap" }}>
                    <span style={{ display:"flex", alignItems:"center", gap:3 }}>{h}{tip && <Tooltip text={tip}/>}</span>
                  </th>
                ))}}
              </tr>
            </thead>
            <tbody>
              {sorted.map((item, idx) => {
                const r = rpn(item);
                const c = rpnColor(r);
                return (
                  <tr key={item.id} style={{ background: idx%2===0?T.card:T.surf, borderLeft:`3px solid ${c}` }}>
                    <td style={{ padding:"8px 10px" }}><Inp value={item.processo} onChange={e=>upd(item.id,"processo",e.target.value)} sx={{ fontSize:11, padding:"4px 6px" }}/></td>
                    <td style={{ padding:"8px 10px" }}><Inp value={item.modoFalha} onChange={e=>upd(item.id,"modoFalha",e.target.value)} sx={{ fontSize:11, padding:"4px 6px" }}/></td>
                    <td style={{ padding:"8px 10px" }}><Inp value={item.efeito} onChange={e=>upd(item.id,"efeito",e.target.value)} sx={{ fontSize:11, padding:"4px 6px" }}/></td>
                    <td style={{ padding:"8px 10px" }}><Inp value={item.causa} onChange={e=>upd(item.id,"causa",e.target.value)} sx={{ fontSize:11, padding:"4px 6px" }}/></td>
                    {["S","O","D"].map(k=>(
                      <td key={k} style={{ padding:"8px 6px" }}>
                        <select value={item[k]} onChange={e=>upd(item.id,k,Number(e.target.value))} style={{ ...s.inp, width:48, padding:"4px 6px", fontSize:12, textAlign:"center", fontWeight:700 }}>
                          {[1,2,3,4,5,6,7,8,9,10].map(n=><option key={n}>{n}</option>)}
                        </select>
                      </td>
                    ))}
                    <td style={{ padding:"8px 10px", textAlign:"center" }}>
                      <div style={{ fontSize:18, fontWeight:800, color:c, lineHeight:1 }}>{r}</div>
                    </td>
                    <td style={{ padding:"8px 6px", whiteSpace:"nowrap" }}>
                      <span style={{ fontSize:10, fontWeight:700, color:c, background:`${c}18`, padding:"3px 8px", borderRadius:20 }}>{rpnLabel(r)}</span>
                    </td>
                    <td style={{ padding:"8px 10px" }}><Inp value={item.acao} onChange={e=>upd(item.id,"acao",e.target.value)} sx={{ fontSize:11, padding:"4px 6px" }}/></td>
                    <td style={{ padding:"8px 10px" }}><Inp value={item.resp} onChange={e=>upd(item.id,"resp",e.target.value)} sx={{ fontSize:11, padding:"4px 6px", width:100 }}/></td>
                    <td style={{ padding:"8px 6px" }}>
                      <select value={item.status} onChange={e=>upd(item.id,"status",e.target.value)} style={{ ...s.inp, width:"auto", fontSize:11, padding:"4px 6px", color:item.status==="Concluída"?T.accent:item.status==="Em andamento"?T.yellow:T.text2 }}>
                        {["Pendente","Em andamento","Concluída"].map(x=><option key={x}>{x}</option>)}
                      </select>
                    </td>
                    <td style={{ padding:"8px 6px" }}>
                      <button style={s.btnD} onClick={()=>del(item.id)} title="Remover">✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ padding:"10px 14px", borderTop:`1px solid ${T.border}`, fontSize:11, color:T.text3, display:"flex", justifyContent:"space-between" }}>
            <span>{sorted.length} item(s) · {sorted.filter(x=>rpn(x)>=100).length} crítico(s) · {sorted.filter(x=>rpn(x)>=50&&rpn(x)<100).length} alto(s)</span>
            <span>S=Severidade · O=Ocorrência · D=Detecção · RPN=S×O×D</span>
          </div>
        </div>
      )}
    </div>
  );
}

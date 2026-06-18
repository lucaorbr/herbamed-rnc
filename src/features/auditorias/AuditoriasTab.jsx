import React, { useState, useEffect } from "react";
import { saveCollection, deleteFromCollection, subscribeCollection } from "../../firebase";
import { useTheme } from "../../core/theme";
import { fmt, tod } from "../../core/utils";
import { exportAuditoriaPDF } from "../pdf/pdfExports";
import { useS } from "../../shared/styles";
import { usePagination } from "../../shared/ui";
import { F, Inp, Pagination, SecTitle, Sel, TA } from "../../shared/ui";

export function AuditoriasTab({ user, toast_, users, rncs, auditLog }) {
  const T = useTheme(); const s = useS();
  const [auditorias, setAuditorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("lista");
  const [sel, setSel] = useState(null);
  const [form, setForm] = useState({ titulo:"", tipo:"Interna", area:"", auditores:"", dataPlano:tod(), dataPrev:"", status:"Planejada", objetivo:"", escopo:"" });
  const [achados, setAchados] = useState([]);
  const setF = (k,v) => setForm(p=>({...p,[k]:v}));

  useEffect(()=>{
    const unsub = subscribeCollection("auditorias", list=>{
      setAuditorias(list.sort((a,b)=>(b.criadoTs||0)-(a.criadoTs||0)));
      setLoading(false);
    });
    const t = setTimeout(()=>setLoading(false), 3000);
    return ()=>{ unsub(); clearTimeout(t); };
  },[]);

  const addAchado = () => setAchados(p=>[...p, { id:Date.now(), tipo:"Não conformidade", desc:"", ref:"", acao:"", resp:"", prazo:"", status:"Aberto" }]);
  const updAchado = (id,k,v) => setAchados(p=>p.map(a=>a.id===id?{...a,[k]:v}:a));
  const delAchado = (id) => setAchados(p=>p.filter(a=>a.id!==id));

  const salvar = async () => {
    try {
    if(!form.titulo.trim()) { alert("Informe o título da auditoria."); return; }
    const id = sel ? String(sel.id) : String(Date.now());
    const aud = { id, ...form, achados, criadoPor:user.name, criadoEm:tod(), criadoTs:Date.now() };
    await saveCollection("auditorias", id, aud);
    await auditLog(sel ? "Editou Auditoria" : "Criou Auditoria", "auditorias", id, aud.titulo, sel || null, { titulo: aud.titulo, tipo: aud.tipo, status: aud.status, area: aud.area });
    toast_(sel?"Auditoria atualizada!":"Auditoria criada!", "green");
    setView("lista"); setSel(null);
    setForm({ titulo:"", tipo:"Interna", area:"", auditores:"", dataPlano:tod(), dataPrev:"", status:"Planejada", objetivo:"", escopo:"" });
    setAchados([]);
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const del = async (id) => {
    try {
    if(!confirm("Excluir esta auditoria?")) return;
    const antesAud = auditorias.find(a => String(a.id) === String(id));
    await deleteFromCollection("auditorias", String(id));
    await auditLog("Excluiu Auditoria", "auditorias", String(id), antesAud?.titulo || String(id), antesAud, null);
    setSel(null); toast_("Auditoria excluída.", "red");
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const editAuditoria = (a) => {
    setSel(a);
    setForm({ titulo:a.titulo, tipo:a.tipo, area:a.area||"", auditores:a.auditores||"", dataPlano:a.dataPlano||tod(), dataPrev:a.dataPrev||"", status:a.status, objetivo:a.objetivo||"", escopo:a.escopo||"" });
    setAchados(a.achados||[]);
    setView("nova");
  };

  const STATUS_AUD = { Planejada:"#4fc3f7", "Em andamento":"#ffd166", Concluída:"#2ab84a", Cancelada:"#ff4f6a" };
  const TIPOS_ACHADO = ["Não conformidade","Observação","Oportunidade de melhoria","Ponto positivo"];

  const {paginated:_auds,page:_pgA,total:_totA,setPage:_setPgA} = usePagination(auditorias, 20);

  if(loading) return <div style={{ textAlign:"center", padding:"3rem", color:T.text2 }}>Carregando...</div>;
  if(view==="nova") return (
    <div>
      <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:"1rem" }}>
        <button style={s.btn} onClick={()=>{ setView("lista"); setSel(null); }}>← Voltar</button>
        <div style={{ fontSize:15, fontWeight:700, color:T.text }}>{sel?"Editar auditoria":"Nova auditoria"}</div>
      </div>

      <div style={s.card}>
        <SecTitle icon="🔍" ch="Planejamento da auditoria" />
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <F lbl="Título *" ch={<Inp placeholder="Ex: Auditoria CQ — Processo de Encapsulação" value={form.titulo} onChange={e=>setF("titulo",e.target.value)} />} />
          <F lbl="Tipo" ch={<Sel value={form.tipo} onChange={e=>setF("tipo",e.target.value)}><option>Interna</option><option>Externa</option><option>Fornecedor</option></Sel>} />
          <F lbl="Área / Setor auditado" ch={<Inp placeholder="Ex: Controle de Qualidade, Produção" value={form.area} onChange={e=>setF("area",e.target.value)} />} />
          <F lbl="Auditor(es)" ch={<Inp placeholder="Ex: Lucas Ribeiro, Maria Silva" value={form.auditores} onChange={e=>setF("auditores",e.target.value)} />} />
          <F lbl="Data do planejamento" ch={<Inp type="date" value={form.dataPlano} onChange={e=>setF("dataPlano",e.target.value)} />} />
          <F lbl="Data prevista de execução" ch={<Inp type="date" value={form.dataPrev} onChange={e=>setF("dataPrev",e.target.value)} />} />
          <F lbl="Status" ch={<Sel value={form.status} onChange={e=>setF("status",e.target.value)}>{Object.keys(STATUS_AUD).map(x=><option key={x}>{x}</option>)}</Sel>} />
        </div>
        <F lbl="Objetivo" ch={<TA rows={2} placeholder="Descreva o objetivo da auditoria..." value={form.objetivo} onChange={e=>setF("objetivo",e.target.value)} />} />
        <F lbl="Escopo" ch={<TA rows={2} placeholder="O que será auditado, processos, documentos..." value={form.escopo} onChange={e=>setF("escopo",e.target.value)} />} />
      </div>

      <div style={s.card}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
          <SecTitle icon="📝" ch={`Achados (${achados.length})`} />
          <button style={s.btnA} onClick={addAchado}>+ Adicionar achado</button>
        </div>
        {achados.length===0 ? (
          <div style={{ textAlign:"center", padding:"1.5rem", color:T.text3, fontSize:13 }}>Nenhum achado registrado ainda</div>
        ) : achados.map((a,i)=>(
          <div key={a.id} style={{ background:T.surf, border:`1px solid ${T.border}`, borderRadius:10, padding:"1rem", marginBottom:10 }}>
            <div style={{ display:"flex", gap:10, marginBottom:10, alignItems:"center" }}>
              <div style={{ fontSize:12, fontWeight:700, color:T.text3 }}>#{i+1}</div>
              <Sel value={a.tipo} onChange={e=>updAchado(a.id,"tipo",e.target.value)} sx={{ width:"auto", fontSize:12 }}>
                {TIPOS_ACHADO.map(t=><option key={t}>{t}</option>)}
              </Sel>
              <Sel value={a.status} onChange={e=>updAchado(a.id,"status",e.target.value)} sx={{ width:"auto", fontSize:12 }}>
                {["Aberto","Em tratamento","Fechado"].map(t=><option key={t}>{t}</option>)}
              </Sel>
              <button onClick={()=>delAchado(a.id)} style={{ marginLeft:"auto", background:"#ff4f6a18", border:"1px solid #ff4f6a33", color:"#ff4f6a", borderRadius:6, cursor:"pointer", padding:"4px 8px", fontSize:12, fontFamily:"inherit" }}>✕</button>
            </div>
            <F lbl="Descrição do achado" ch={<TA rows={2} placeholder="Descreva o que foi encontrado..." value={a.desc} onChange={e=>updAchado(a.id,"desc",e.target.value)} />} />
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:8 }}>
              <F lbl="Referência normativa" ch={<Inp placeholder="Ex: BPF item 5.2, ISO 9001 cl. 8.2" value={a.ref} onChange={e=>updAchado(a.id,"ref",e.target.value)} />} />
              <F lbl="Ação corretiva" ch={<Inp placeholder="Ação a ser tomada..." value={a.acao} onChange={e=>updAchado(a.id,"acao",e.target.value)} />} />
              <F lbl="Responsável" ch={<Inp value={a.resp} onChange={e=>updAchado(a.id,"resp",e.target.value)} />} />
              <F lbl="Prazo" ch={<Inp type="date" value={a.prazo} onChange={e=>updAchado(a.id,"prazo",e.target.value)} />} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", gap:10, justifyContent:"flex-end", paddingBottom:"1rem" }}>
        <button style={s.btn} onClick={()=>{ setView("lista"); setSel(null); }}>Cancelar</button>
        <button style={s.btnA} onClick={salvar}>💾 Salvar auditoria →</button>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
        <div style={{ fontSize:13, color:T.text2 }}>{auditorias.length} auditoria(s) registrada(s)</div>
        <button style={s.btnA} onClick={()=>{ setSel(null); setForm({ titulo:"", tipo:"Interna", area:"", auditores:"", dataPlano:tod(), dataPrev:"", status:"Planejada", objetivo:"", escopo:"" }); setAchados([]); setView("nova"); }}>+ Nova Auditoria</button>
      </div>

      {/* Stats */}
      <div className="kpi-grid" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:"1rem" }}>
        {Object.entries(STATUS_AUD).map(([st,c])=>(
          <div key={st} style={{ background:T.surf, border:`1px solid ${T.border}`, borderRadius:10, padding:"10px 14px", textAlign:"center" }}>
            <div style={{ fontSize:22, fontWeight:700, color:c }}>{auditorias.filter(a=>a.status===st).length}</div>
            <div style={{ fontSize:11, color:T.text3, marginTop:2 }}>{st}</div>
          </div>
        ))}
      </div>

      {auditorias.length===0 ? (
        <div style={{ ...s.card, textAlign:"center", padding:"3rem" }}>
          <div style={{ fontSize:40, marginBottom:"1rem", opacity:.3 }}>🔍</div>
          <div style={{ fontSize:14, color:T.text2 }}>Nenhuma auditoria registrada</div>
        </div>
      ) : (<>
      {_auds.map(a=>(
        <div key={a.id} style={{ background:T.card, border:`1px solid ${T.border}`, borderLeft:`3px solid ${STATUS_AUD[a.status]||T.accent}`, borderRadius:12, padding:"1rem 1.25rem", marginBottom:10 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:T.text, marginBottom:4 }}>{a.titulo}</div>
              <div style={{ fontSize:12, color:T.text2 }}>
                {a.tipo} · {a.area||"—"} · Auditor: {a.auditores||"—"}
                {a.dataPrev&&` · Prevista: ${fmt(a.dataPrev)}`}
              </div>
              {a.achados?.length>0 && (
                <div style={{ marginTop:6, display:"flex", gap:6 }}>
                  {TIPOS_ACHADO.slice(0,3).map(tp=>{
                    const n = a.achados.filter(x=>x.tipo===tp).length;
                    if(!n) return null;
                    const c = tp==="Não conformidade"?"#ff4f6a":tp==="Observação"?"#ffd166":"#2ab84a";
                    return <span key={tp} style={{ fontSize:10, fontWeight:600, color:c, background:`${c}18`, padding:"2px 8px", borderRadius:20 }}>{tp}: {n}</span>;
                  })}
                </div>
              )}
            </div>
            <div style={{ display:"flex", gap:8, alignItems:"center", flexShrink:0 }}>
              <span style={{ fontSize:11, fontWeight:600, color:STATUS_AUD[a.status], background:`${STATUS_AUD[a.status]}18`, padding:"3px 10px", borderRadius:20 }}>{a.status}</span>
              <button style={{ ...s.btn, padding:"4px 10px", fontSize:11, color:"#ff8c42", borderColor:"#ff8c4233", background:"#ff8c4212" }} onClick={()=>exportAuditoriaPDF(a)}><span className="btn-emoji">📄 </span>PDF</button>
              <button style={{ ...s.btn, padding:"4px 10px", fontSize:11, color:T.accent, borderColor:T.accent+"33", background:T.accentDim }} onClick={()=>editAuditoria(a)}><span className="btn-emoji">✏️ </span>Editar</button>
              <button style={{ ...s.btnD, padding:"4px 8px", fontSize:11 }} onClick={()=>del(a.id)}>🗑️</button>
            </div>
          </div>
        </div>
      ))}
      <Pagination page={_pgA} total={_totA} setPage={_setPgA}/>
      </>
      )}
    </div>
  );
}

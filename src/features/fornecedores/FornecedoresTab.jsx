import React, { useState } from "react";
import { saveCollection, deleteFromCollection } from "../../firebase";
import { SMETA, rncAtiva } from "../../core/status";
import { useTheme } from "../../core/theme";
import { fmt, tod } from "../../core/utils";
import { useS } from "../../shared/styles";
import { Badge, F, Inp, MaskedInp, SecTitle, Sel, SevB, TA } from "../../shared/ui";

export function FornecedoresTab({ rncs, fornecedores, homologacoes = [], setFornecedores, user, toast_, isAdmin, auditLog }) {
  const T = useTheme(); const s = useS();
  const [sel, setSel] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [q, setQ] = useState("");
  const [catFiltro, setCatFiltro] = useState("");
  const [novoForn, setNovoForn] = useState({ nome:"", cnpj:"", categoria:"Matéria-prima", contato:"", email:"", telefone:"", cep:"", endereco:"", status:"Ativo", obs:"" });
  const [showNovo, setShowNovo] = useState(false);
  const [editData, setEditData] = useState({});

  const CATS = ["Matéria-prima","Material de embalagem","Insumo","Serviço","Outros"];
  const STATUS_FORN = { Ativo:"#2ab84a", Inativo:"#ffd166", Bloqueado:"#ff4f6a" };

  const addForn = async () => {
    try {
    if (!novoForn.nome.trim()) { alert("Nome é obrigatório."); return; }
    const id = String(Date.now());
    const novo = { ...novoForn, id, criadoEm: tod(), criadoPor: user.name };
    await saveCollection("fornecedores", id, novo);
    await auditLog("Criou Fornecedor", "fornecedores", id, novo.nome, null, { nome: novo.nome, cnpj: novo.cnpj, categoria: novo.categoria, status: novo.status });
    setNovoForn({ nome:"", cnpj:"", categoria:"Matéria-prima", contato:"", email:"", telefone:"", cep:"", endereco:"", status:"Ativo", obs:"" });
    setShowNovo(false);
    toast_("Fornecedor cadastrado!", "green");
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const saveEdit = async () => {
    try {
    await saveCollection("fornecedores", String(sel.id), { ...sel, ...editData });
    await auditLog("Editou Fornecedor", "fornecedores", String(sel.id), sel.nome, sel, { ...sel, ...editData });
    setSel(p => ({ ...p, ...editData }));
    setEditMode(false);
    toast_("Fornecedor atualizado!", "green");
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const delForn = async (id) => {
    try {
    if (!confirm("Excluir este fornecedor?")) return;
    const antesF = fornecedores.find(f => String(f.id) === String(id));
    await deleteFromCollection("fornecedores", String(id));
    await auditLog("Excluiu Fornecedor", "fornecedores", String(id), antesF?.nome || String(id), antesF, null);
    setSel(null); toast_("Fornecedor removido.", "red");
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const list = fornecedores.filter(f =>
    (!q || f.nome.toLowerCase().includes(q.toLowerCase()) || f.cnpj?.includes(q)) &&
    (!catFiltro || f.categoria === catFiltro)
  );

  // RNCs por fornecedor
  const rncsForn = (nome) => rncs.filter(r => r.fornecedor === nome);
  const homsForn = fornecedor => homologacoes.filter(h => String(h.fornecedorId || "") === String(fornecedor.id) || (!h.fornecedorId && h.fornecedorNome === fornecedor.nome));
  const taxaForn = (nome) => {
    const rf = rncsForn(nome);
    const ef = rf.filter(x => x.status === "Eficaz").length;
    return rf.length > 0 ? Math.round(ef/rf.length*100) : null;
  };
  const riskLevel = (nome) => {
    const n = rncsForn(nome).length;
    const venc = rncsForn(nome).filter(x => x.prazoAC && x.prazoAC < tod() && rncAtiva(x.status)).length;
    if (venc > 0 || n >= 5) return { label:"Alto", color:"#ff4f6a" };
    if (n >= 3) return { label:"Médio", color:"#ff8c42" };
    if (n >= 1) return { label:"Baixo", color:"#ffd166" };
    return { label:"Sem NC", color:T.accent };
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", gap:10, marginBottom:"1rem", flexWrap:"wrap", alignItems:"center" }}>
        <Inp placeholder="🔍 Buscar por nome ou CNPJ..." value={q} onChange={e=>setQ(e.target.value)} sx={{ flex:1, minWidth:220 }}/>
        <Sel value={catFiltro} onChange={e=>setCatFiltro(e.target.value)} sx={{ width:"auto", minWidth:180 }}>
          <option value="">Todas as categorias</option>
          {CATS.map(c=><option key={c}>{c}</option>)}
        </Sel>
        {isAdmin && <button style={s.btnA} onClick={()=>setShowNovo(o=>!o)}>+ Novo Fornecedor</button>}
      </div>

      {/* Form novo fornecedor */}
      {showNovo && (
        <div style={{ ...s.card, marginBottom:"1rem", border:`1px solid ${T.accent}33` }}>
          <SecTitle icon="🏭" ch="Cadastrar novo fornecedor" />
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
            <F lbl="Nome *" ch={<Inp placeholder="Nome do fornecedor" value={novoForn.nome} onChange={e=>setNovoForn(p=>({...p,nome:e.target.value}))} />} />
            <F lbl="CNPJ" ch={<MaskedInp mask="cnpj" placeholder="00.000.000/0000-00" value={novoForn.cnpj} onChange={e=>setNovoForn(p=>({...p,cnpj:e.target.value}))} />} />
            <F lbl="Categoria" ch={<Sel value={novoForn.categoria} onChange={e=>setNovoForn(p=>({...p,categoria:e.target.value}))}>{CATS.map(c=><option key={c}>{c}</option>)}</Sel>} />
            <F lbl="Nome do contato" ch={<Inp placeholder="Responsável comercial" value={novoForn.contato} onChange={e=>setNovoForn(p=>({...p,contato:e.target.value}))} />} />
            <F lbl="E-mail" ch={<Inp type="email" placeholder="contato@fornecedor.com" value={novoForn.email} onChange={e=>setNovoForn(p=>({...p,email:e.target.value}))} />} />
            <F lbl="Telefone" ch={<MaskedInp mask="telefone" placeholder="(00) 00000-0000" value={novoForn.telefone} onChange={e=>setNovoForn(p=>({...p,telefone:e.target.value}))} />} />
            <F lbl="CEP" ch={<MaskedInp mask="cep" placeholder="00000-000" value={novoForn.cep||""} onChange={e=>setNovoForn(p=>({...p,cep:e.target.value}))} />} />
            <F lbl="Endereço" ch={<Inp placeholder="Rua, número, bairro, cidade" value={novoForn.endereco||""} onChange={e=>setNovoForn(p=>({...p,endereco:e.target.value}))} />} />
          </div>
          <F lbl="Observações" ch={<TA rows={2} placeholder="Informações adicionais..." value={novoForn.obs} onChange={e=>setNovoForn(p=>({...p,obs:e.target.value}))} />} />
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:8 }}>
            <button style={s.btn} onClick={()=>setShowNovo(false)}>Cancelar</button>
            <button style={s.btnA} onClick={addForn}>Cadastrar →</button>
          </div>
        </div>
      )}

      {/* Stats resumo */}
      <div className="kpi-grid" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:"1rem" }}>
        {[
          ["Total",       fornecedores.length,                                    T.accent],
          ["Ativos",      fornecedores.filter(x=>x.status==="Ativo").length,       T.accent],
          ["Bloqueados",  fornecedores.filter(x=>x.status==="Bloqueado").length,   "#ff4f6a"],
          ["Com NCs",     fornecedores.filter(x=>rncsForn(x.nome).length>0).length,"#ff8c42"],
        ].map(([l,n,c])=>(
          <div key={l} style={{ background:T.surf, border:`1px solid ${T.border}`, borderRadius:10, padding:"10px 14px", textAlign:"center" }}>
            <div style={{ fontSize:22, fontWeight:700, color:c }}>{n}</div>
            <div style={{ fontSize:11, color:T.text3, marginTop:2 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Lista */}
      {list.length === 0 ? (
        <div style={{ ...s.card, textAlign:"center", padding:"3rem" }}>
          <div style={{ fontSize:40, marginBottom:"1rem", opacity:.3 }}>🏭</div>
          <div style={{ fontSize:14, color:T.text2, marginBottom:6 }}>Nenhum fornecedor cadastrado</div>
          <div style={{ fontSize:12, color:T.text3 }}>Clique em "+ Novo Fornecedor" para começar</div>
        </div>
      ) : (
        <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:T.surf }}>
                {["Fornecedor","Categoria","Contato","Status","Risco","NCs","Taxa Eficácia",""].map(h=>(
                  <th key={h} style={{ padding:"10px 12px", fontSize:10, fontWeight:700, color:T.text3, textTransform:"uppercase", letterSpacing:".06em", textAlign:"left", borderBottom:`1px solid ${T.border}`, whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((f, idx) => {
                const risk = riskLevel(f.nome);
                const ncs = rncsForn(f.nome).length;
                const taxa = taxaForn(f.nome);
                return (
                  <tr key={f.id} onClick={()=>setSel(f)} style={{ background:idx%2===0?T.card:T.surf, cursor:"pointer", transition:"background .15s" }}>
                    <td style={{ padding:"10px 12px" }}>
                      <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{f.nome}</div>
                      {f.cnpj && <div style={{ fontSize:10, color:T.text3 }}>{f.cnpj}</div>}
                    </td>
                    <td style={{ padding:"10px 12px", fontSize:12, color:T.text2 }}>{f.categoria}</td>
                    <td style={{ padding:"10px 12px" }}>
                      <div style={{ fontSize:12, color:T.text2 }}>{f.contato||"—"}</div>
                      {f.email && <div style={{ fontSize:10, color:T.text3 }}>{f.email}</div>}
                    </td>
                    <td style={{ padding:"10px 12px" }}>
                      <span style={{ fontSize:11, fontWeight:600, color:STATUS_FORN[f.status]||T.text2, background:`${STATUS_FORN[f.status]||T.accent}18`, padding:"3px 10px", borderRadius:20 }}>{f.status}</span>
                    </td>
                    <td style={{ padding:"10px 12px" }}>
                      <span style={{ fontSize:11, fontWeight:600, color:risk.color, background:`${risk.color}18`, padding:"3px 10px", borderRadius:20 }}>{risk.label}</span>
                    </td>
                    <td style={{ padding:"10px 12px", fontSize:14, fontWeight:700, color:ncs>0?"#ff8c42":T.text3 }}>{ncs}</td>
                    <td style={{ padding:"10px 12px", fontSize:13, fontWeight:700, color:taxa===null?T.text3:taxa>=70?T.accent:"#ff8c42" }}>
                      {taxa !== null ? `${taxa}%` : "—"}
                    </td>
                    <td style={{ padding:"10px 8px" }}>
                      <button style={{ ...s.btn, padding:"4px 10px", fontSize:11 }} onClick={e=>{e.stopPropagation();setSel(f);}}>Ver</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ padding:"8px 14px", borderTop:`1px solid ${T.border}`, fontSize:11, color:T.text3 }}>
            {list.length} fornecedor(es) encontrado(s)
          </div>
        </div>
      )}

      {/* Modal detalhe do fornecedor */}
      {sel && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.82)", backdropFilter:"blur(6px)", zIndex:999, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }} onClick={e=>e.target===e.currentTarget&&setSel(null)}>
          <div style={{ background:T.card2, border:`1px solid ${T.border2}`, borderRadius:18, padding:"1.75rem", maxWidth:720, width:"100%", maxHeight:"90vh", overflowY:"auto", boxShadow:"0 32px 80px #000a" }}>

            {/* Header */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"1.25rem" }}>
              <div>
                <div style={{ fontSize:22, fontWeight:700 }}>{sel.nome}</div>
                <div style={{ fontSize:12, color:T.text2, marginTop:2 }}>{sel.categoria} · Cadastrado em {fmt(sel.criadoEm)} por {sel.criadoPor}</div>
              </div>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <span style={{ fontSize:11, fontWeight:600, color:STATUS_FORN[sel.status], background:`${STATUS_FORN[sel.status]}18`, padding:"4px 12px", borderRadius:20 }}>{sel.status}</span>
                {isAdmin && !editMode && <button onClick={()=>{setEditData({...sel});setEditMode(true);}} style={{ ...s.btn, fontSize:11, color:T.accent, borderColor:T.accent+"33", background:T.accentDim }}><span className="btn-emoji">✏️ </span>Editar</button>}
                <button onClick={()=>{setSel(null);setEditMode(false);}} style={{ background:T.border, border:"none", color:T.text2, cursor:"pointer", borderRadius:8, padding:"6px 10px", fontSize:16, fontFamily:"inherit" }}>✕</button>
              </div>
            </div>

            {editMode ? (
              <div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:12 }}>
                  <F lbl="Nome" ch={<Inp value={editData.nome} onChange={e=>setEditData(p=>({...p,nome:e.target.value}))} />} />
                  <F lbl="CNPJ" ch={<MaskedInp mask="cnpj" value={editData.cnpj||""} onChange={e=>setEditData(p=>({...p,cnpj:e.target.value}))} />} />
                  <F lbl="Categoria" ch={<Sel value={editData.categoria} onChange={e=>setEditData(p=>({...p,categoria:e.target.value}))}>{CATS.map(c=><option key={c}>{c}</option>)}</Sel>} />
                  <F lbl="Contato" ch={<Inp value={editData.contato||""} onChange={e=>setEditData(p=>({...p,contato:e.target.value}))} />} />
                  <F lbl="E-mail" ch={<Inp value={editData.email||""} onChange={e=>setEditData(p=>({...p,email:e.target.value}))} />} />
                  <F lbl="Telefone" ch={<MaskedInp mask="telefone" value={editData.telefone||""} onChange={e=>setEditData(p=>({...p,telefone:e.target.value}))} />} />
                  <F lbl="CEP" ch={<MaskedInp mask="cep" value={editData.cep||""} onChange={e=>setEditData(p=>({...p,cep:e.target.value}))} />} />
                  <F lbl="Endereço" ch={<Inp value={editData.endereco||""} onChange={e=>setEditData(p=>({...p,endereco:e.target.value}))} />} />
                  <F lbl="Status" ch={<Sel value={editData.status} onChange={e=>setEditData(p=>({...p,status:e.target.value}))}>{Object.keys(STATUS_FORN).map(x=><option key={x}>{x}</option>)}</Sel>} />
                </div>
                <F lbl="Observações" ch={<TA rows={3} value={editData.obs||""} onChange={e=>setEditData(p=>({...p,obs:e.target.value}))} />} />
                <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:12 }}>
                  <button style={s.btn} onClick={()=>setEditMode(false)}>Cancelar</button>
                  <button style={s.btnA} onClick={saveEdit}><span className="btn-emoji">💾 </span>Salvar</button>
                </div>
              </div>
            ) : (
              <div>
                {/* Dados */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:"1rem" }}>
                  {[["CNPJ",sel.cnpj],["Contato",sel.contato],["E-mail",sel.email],["Telefone",sel.telefone],["CEP",sel.cep],["Endereço",sel.endereco]].filter(([,v])=>v).map(([k,v])=>(
                    <div key={k} style={{ background:T.surf, borderRadius:8, padding:"10px 12px" }}>
                      <div style={{ fontSize:10, color:T.text3, fontWeight:700, textTransform:"uppercase", marginBottom:3 }}>{k}</div>
                      <div style={{ fontSize:13 }}>{v}</div>
                    </div>
                  ))}
                </div>
                {sel.obs && <div style={{ background:T.surf, borderRadius:8, padding:"10px 12px", marginBottom:"1rem", fontSize:13, color:T.text2 }}><b style={{ color:T.text3 }}>Obs:</b> {sel.obs}</div>}

                {/* Indicadores de risco */}
                <div className="kpi-grid" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:"1rem" }}>
                  {[
                    ["Total NCs",   rncsForn(sel.nome).length, "#ff8c42"],
                    ["Abertas",     rncsForn(sel.nome).filter(x=>x.status==="Aberta").length, "#ff4f6a"],
                    ["Eficazes",    rncsForn(sel.nome).filter(x=>x.status==="Eficaz").length, T.accent],
                    ["Risco",       riskLevel(sel.nome).label, riskLevel(sel.nome).color],
                  ].map(([l,v,c])=>(
                    <div key={l} style={{ background:T.card, border:`1px solid ${c}22`, borderRadius:10, padding:"10px", textAlign:"center" }}>
                      <div style={{ fontSize:18, fontWeight:700, color:c }}>{v}</div>
                      <div style={{ fontSize:10, color:T.text3, marginTop:2 }}>{l}</div>
                    </div>
                  ))}
                </div>

                {/* Escopos homologados para este fornecedor */}
                <div style={{ marginBottom:"1rem" }}>
                  <div style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:8 }}>✅ Escopos de Homologação</div>
                  {homsForn(sel).length === 0 ? (
                    <div style={{ color:T.text3, fontSize:12, padding:"1rem", textAlign:"center", background:T.surf, borderRadius:8 }}>Nenhuma homologação registrada para este fornecedor</div>
                  ) : homsForn(sel).map(h => (
                    <div key={h.id} style={{ display:"flex", justifyContent:"space-between", gap:10, background:T.surf, border:`1px solid ${T.border}`, borderRadius:8, padding:"9px 11px", marginBottom:6 }}>
                      <div><div style={{fontSize:11,fontWeight:700,color:T.accent}}>{h.num}</div><div style={{fontSize:12,color:T.text2}}>{h.itemNome} · {h.categoria}</div></div>
                      <span style={{fontSize:10,fontWeight:700,color:h.status==="Homologada"?T.accent:h.status==="Reprovada"?"#ff4f6a":"#ffb300"}}>{h.status}</span>
                    </div>
                  ))}
                </div>

                {/* Histórico de NCs */}
                <div style={{ marginBottom:"1rem" }}>
                  <div style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:8 }}>📋 Histórico de Não Conformidades</div>
                  {rncsForn(sel.nome).length === 0 ? (
                    <div style={{ color:T.text3, fontSize:12, padding:"1rem", textAlign:"center", background:T.surf, borderRadius:8 }}>✓ Nenhuma NC registrada para este fornecedor</div>
                  ) : [...rncsForn(sel.nome)].sort((a,b)=>b.createdAt-a.createdAt).map(r=>(
                    <div key={r.id} style={{ background:T.surf, border:`1px solid ${T.border}`, borderLeft:`3px solid ${SMETA[r.status]?.dot||T.accent}`, borderRadius:8, padding:"10px 12px", marginBottom:6 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                          <span style={{ fontSize:11, fontWeight:700, color:T.accent }}>{r.num}</span>
                          <SevB s={r.sev}/><Badge s={r.status}/>
                        </div>
                        <span style={{ fontSize:10, color:T.text3 }}>{fmt(r.data)}</span>
                      </div>
                      <div style={{ fontSize:12, color:T.text2 }}>{r.desc?.substring(0,70)}...</div>
                    </div>
                  ))}
                </div>

                <div style={{ display:"flex", gap:8, justifyContent:"flex-end", borderTop:`1px solid ${T.border}`, paddingTop:"1rem" }}>
                  {isAdmin && <button style={s.btnD} onClick={()=>delForn(sel.id)}><span className="btn-emoji">🗑️ </span>Excluir</button>}
                  <button style={s.btn} onClick={()=>setSel(null)}>Fechar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { saveCollection, deleteFromCollection, subscribeCollection } from "../../firebase";
import { useTheme } from "../../core/theme";
import { fmt, tod } from "../../core/utils";
import { useS } from "../../shared/styles";
import { usePagination } from "../../shared/ui";
import { F, G2, G3, Inp, Pagination, SecTitle, Sel } from "../../shared/ui";

export function IPCTab({ user, toast_ }) {
  const T = useTheme(); const s = useS();
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("lista"); // lista | novo | detalhe
  const [sel, setSel] = useState(null);

  const AREAS = [
    {
      id: "po-encapsulamento",
      label: "Mistura Pó — Encapsulamento",
      icon: "🟤",
      salas: ["Mistura 1", "Mistura 2"],
      ensaios: [
        { id: "dens_ap",   label: "Densidade Aparente",    unidade: "g/mL" },
        { id: "dens_comp", label: "Densidade Compactada",  unidade: "g/mL" },
      ]
    },
    {
      id: "po-solavel",
      label: "Mistura Pó — Solúvel",
      icon: "🟡",
      salas: ["Mistura 1", "Mistura 2"],
      ensaios: [
        { id: "dens_ap",   label: "Densidade Aparente",    unidade: "g/mL" },
        { id: "dens_comp", label: "Densidade Compactada",  unidade: "g/mL" },
        { id: "sensorial", label: "Análise Sensorial",     unidade: "" },
      ]
    },
    {
      id: "liquido",
      label: "Mistura Líquido",
      icon: "🔵",
      salas: [],
      ensaios: [
        { id: "densidade",    label: "Densidade",      unidade: "g/mL" },
        { id: "sensorial",    label: "Análise Sensorial", unidade: "" },
        { id: "peso_liquido", label: "Peso Líquido",   unidade: "g" },
      ]
    },
  ];

  const [form, setForm] = useState({ area: "", sala: "", op: "", lote: "", produto: "", linha: "", resp: "", data: "", obs: "" });
  const [resultados, setResultados] = useState([]);
  const [filtroArea, setFiltroArea] = useState("todas");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroLinha, setFiltroLinha] = useState("todas");
  const [busca, setBusca] = useState("");
  const [produtos, setProdutos] = useState([]);
  const [showCadastroProd, setShowCadastroProd] = useState(false);
  const [formProd, setFormProd] = useState({ nome: "", linha: "", forma: "" });

  const LINHAS = [...new Set(produtos.map(p => p.linha).filter(Boolean))];
  const isAdmin = user?.role === "admin";

  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 3000);
    const unsub = subscribeCollection("ipc_registros", list => {
      clearTimeout(t);
      setRegistros(list.sort((a, b) => (b.criadoTs || 0) - (a.criadoTs || 0)));
      setLoading(false);
    });
    const unsubProd = subscribeCollection("ipc_produtos", list => {
      setProdutos(list.sort((a, b) => (a.nome||"").localeCompare(b.nome||"")));
    });
    return () => { clearTimeout(t); unsub && unsub(); unsubProd && unsubProd(); };
  }, []);

  const salvarProduto = async () => {
    try {
    if (!formProd.nome) { alert("Informe o nome do produto."); return; }
    if (!formProd.linha || formProd.linha === "__outro__") { alert("Informe a linha."); return; }
    const id = Date.now();
    await saveCollection("ipc_produtos", String(id), { id, ...formProd, criadoEm: tod() });
    setFormProd({ nome: "", linha: "", forma: "" });
    toast_("Produto cadastrado!", "green");
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const deletarProduto = async (id) => {
    try {
    if (!confirm("Excluir este produto?")) return;
    await deleteFromCollection("ipc_produtos", String(id));
    toast_("Produto excluído.", "red");
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const areaAtual = AREAS.find(a => a.id === form.area);

  const initResultados = (areaId) => {
    const area = AREAS.find(a => a.id === areaId);
    if (!area) return;
    setResultados(area.ensaios.map(e => ({ ...e, resultado: "", conforme: null, obs: "" })));
  };

  const setRes = (idx, k, v) => {
    setResultados(p => p.map((r, i) => i === idx ? { ...r, [k]: v } : r));
  };

  const calcStatus = () => {
    if (resultados.some(r => r.conforme === false)) return "Reprovado";
    if (resultados.every(r => r.resultado !== "")) return "Liberado";
    return "Pendente";
  };

  const salvar = async () => {
    try {
    if (!form.area) { alert("Selecione a área."); return; }
    if (!form.op)   { alert("Informe a OP."); return; }
    if (!form.produto) { alert("Informe o produto."); return; }
    const status = calcStatus();
    const reg = {
      id: sel ? sel.id : Date.now(),
      ...form,
      resultados,
      status,
      criadoPor: user.name,
      criadoEm: tod(),
      criadoTs: sel ? sel.criadoTs : Date.now(),
      atualizadoEm: tod(),
    };
    await saveCollection("ipc_registros", String(reg.id), reg);
    toast_(sel ? "Registro atualizado!" : "Registro salvo!", "green");
    setSel(null);
    setForm({ area: "", sala: "", op: "", lote: "", produto: "", resp: "", data: tod(), obs: "" });
    setResultados([]);
    setView("lista");
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const deletar = async (id) => {
    try {
    if (!confirm("Excluir este registro?")) return;
    await deleteFromCollection("ipc_registros", String(id));
    setSel(null); setView("lista");
    toast_("Registro excluído.", "red");
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const editar = (r) => {
    setSel(r);
    setForm({ area: r.area, sala: r.sala || "", op: r.op, produto: r.produto, resp: r.resp || "", data: r.data || tod(), obs: r.obs || "" });
    setResultados(r.resultados || []);
    setView("novo");
  };

  const statusColor = { "Liberado": T.accent, "Reprovado": T.red, "Pendente": T.yellow };
  const statusBg    = { "Liberado": T.accent+"18", "Reprovado": T.red+"18", "Pendente": T.yellow+"18" };
  const statusIcon  = { "Liberado": "✅", "Reprovado": "❌", "Pendente": "⏳" };

  const filtrados = registros
    .filter(r => filtroArea === "todas" || r.area === filtroArea)
    .filter(r => filtroStatus === "todos" || r.status === filtroStatus)
    .filter(r => filtroLinha === "todas" || r.linha === filtroLinha)
    .filter(r => !busca || r.op?.toLowerCase().includes(busca.toLowerCase()) || r.produto?.toLowerCase().includes(busca.toLowerCase()));

  const { paginated: filtradosPg, page: pgIPC, total: totIPC, setPage: setPgIPC } = usePagination(filtrados, 20);

  // ── FORM NOVO/EDITAR ──
  if (view === "novo") return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
        <button style={s.btn} onClick={() => { setView("lista"); setSel(null); setResultados([]); }}>← Voltar</button>
        <h2 style={{ fontSize:18, fontWeight:700, color:T.text, margin:0 }}>{sel ? "Editar Registro" : "Novo Registro IPC"}</h2>
      </div>

      <div style={s.card}>
        <SecTitle icon="🏭" ch="Identificação" />
        <G2 ch={<>
          <F lbl="Área *" ch={
            <Sel value={form.area} onChange={e => { setF("area", e.target.value); setF("sala", ""); initResultados(e.target.value); }}>
              <option value="">Selecione a área...</option>
              {AREAS.map(a => <option key={a.id} value={a.id}>{a.icon} {a.label}</option>)}
            </Sel>
          } />
          {areaAtual?.salas?.length > 0 && (
            <F lbl="Sala" ch={
              <Sel value={form.sala} onChange={e => setF("sala", e.target.value)}>
                <option value="">Selecione a sala...</option>
                {areaAtual.salas.map(s => <option key={s} value={s}>{s}</option>)}
              </Sel>
            } />
          )}
          <F lbl="OP *" ch={<Inp placeholder="Ex: OP-2025-001" value={form.op} onChange={e => setF("op", e.target.value)} />} />
          <F lbl="Lote" ch={<Inp placeholder="Ex: LOTE-2025-001" value={form.lote||""} onChange={e => setF("lote", e.target.value)} />} />
          <F lbl="Produto *" ch={
            <Sel value={form.produtoId||""} onChange={e => {
              const prod = produtos.find(p => String(p.id) === e.target.value);
              setF("produtoId", e.target.value);
              setF("produto", prod?.nome || "");
              setF("linha", prod?.linha || "");
            }}>
              <option value="">Selecione o produto...</option>
              {[...new Set(produtos.map(p=>p.linha))].map(linha => (
                <optgroup key={linha} label={`— ${linha} —`}>
                  {produtos.filter(p=>p.linha===linha).map(p => (
                    <option key={p.id} value={String(p.id)}>{p.nome}{p.forma?` (${p.forma})`:""}</option>
                  ))}
                </optgroup>
              ))}
            </Sel>
          } />
          {form.linha && <F lbl="Linha" ch={<div style={{ padding:"8px 10px", background:T.surf, borderRadius:8, fontSize:13, color:T.accent, fontWeight:600 }}>{form.linha}</div>} />}
          <F lbl="Responsável" ch={<Inp placeholder="Nome do operador" value={form.resp} onChange={e => setF("resp", e.target.value)} />} />
          <F lbl="Data" ch={<Inp type="date" value={form.data || tod()} onChange={e => setF("data", e.target.value)} />} />
        </>} />
        <F lbl="Observações" ch={<Inp placeholder="Observações gerais..." value={form.obs} onChange={e => setF("obs", e.target.value)} />} />
      </div>

      {resultados.length > 0 && (
        <div style={s.card}>
          <SecTitle icon="🔬" ch="Ensaios" />
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:T.surf }}>
                  {["Ensaio","Unidade","Resultado","Conforme?","Obs."].map(h=>(
                    <th key={h} style={{ padding:"8px 10px", fontSize:10, fontWeight:700, color:T.text3, textTransform:"uppercase", textAlign:"left", borderBottom:`1px solid ${T.border}`, whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resultados.map((r, i) => (
                  <tr key={r.id} style={{ background:i%2===0?T.card:T.surf, borderLeft: r.conforme===false?`3px solid ${T.red}`:r.conforme===true?`3px solid ${T.accent}`:"3px solid transparent" }}>
                    <td style={{ padding:"8px 10px", fontSize:12, fontWeight:600, color:T.text, whiteSpace:"nowrap" }}>{r.label}</td>
                    <td style={{ padding:"8px 10px", fontSize:11, color:T.text3 }}>{r.unidade||"—"}</td>
                    <td style={{ padding:"8px 8px" }}>
                      <Inp placeholder="Digite o resultado..." value={r.resultado} onChange={e => setRes(i, "resultado", e.target.value)} sx={{ fontSize:12, padding:"5px 8px" }} />
                    </td>
                    <td style={{ padding:"8px 8px" }}>
                      <div style={{ display:"flex", gap:4 }}>
                        <button onClick={()=>setRes(i,"conforme",true)} style={{ padding:"4px 8px", borderRadius:6, border:`1px solid ${r.conforme===true?T.accent+"55":T.border}`, background:r.conforme===true?T.accent+"22":"transparent", color:r.conforme===true?T.accent:T.text2, cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:600 }}>✓</button>
                        <button onClick={()=>setRes(i,"conforme",false)} style={{ padding:"4px 8px", borderRadius:6, border:`1px solid ${r.conforme===false?T.red+"55":T.border}`, background:r.conforme===false?T.red+"22":"transparent", color:r.conforme===false?T.red:T.text2, cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:600 }}>✗</button>
                        <button onClick={()=>setRes(i,"conforme",null)} style={{ padding:"4px 6px", borderRadius:6, border:`1px solid ${T.border}`, background:"transparent", color:T.text3, cursor:"pointer", fontFamily:"inherit", fontSize:10 }}>—</button>
                      </div>
                    </td>
                    <td style={{ padding:"8px 8px" }}>
                      <Inp placeholder="obs..." value={r.obs} onChange={e => setRes(i, "obs", e.target.value)} sx={{ fontSize:11, padding:"4px 6px", width:90 }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Indicador de progresso */}
          {resultados.length > 0 && (() => {
            const preenchidos = resultados.filter(r => r.resultado !== "").length;
            const total = resultados.length;
            const pct = Math.round((preenchidos/total)*100);
            return (
              <div style={{ marginTop:12, padding:"10px 14px", background:T.surf, borderRadius:10, border:`1px solid ${T.border}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                  <span style={{ fontSize:11, color:T.text2 }}>Progresso dos ensaios</span>
                  <span style={{ fontSize:11, fontWeight:700, color:pct===100?T.accent:T.text2 }}>{preenchidos}/{total} preenchidos</span>
                </div>
                <div style={{ height:6, background:T.border, borderRadius:10, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${pct}%`, background:pct===100?T.accent:T.yellow||"#f0c040", borderRadius:10, transition:"width 0.3s" }} />
                </div>
              </div>
            );
          })()}
          {resultados.some(r => r.resultado !== "") && (
            <div style={{ padding:"12px 16px", borderRadius:10, textAlign:"center", fontWeight:700, fontSize:15,
              background: statusBg[calcStatus()], color: statusColor[calcStatus()], border:`1px solid ${statusColor[calcStatus()]}33`, marginTop:8 }}>
              {statusIcon[calcStatus()]} {calcStatus() === "Liberado" ? "LIBERADO PARA PRÓXIMA ETAPA" : calcStatus() === "Reprovado" ? "REPROVADO — NÃO LIBERAR" : "ANÁLISE PENDENTE"}
            </div>
          )}
        </div>
      )}

      <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:4 }}>
        <button style={s.btn} onClick={() => { setView("lista"); setSel(null); setResultados([]); }}>Cancelar</button>
        <button style={s.btnA} onClick={salvar}>Salvar registro ✓</button>
      </div>
    </div>
  );

  // ── DETALHE ──
  if (view === "detalhe" && sel) {
    const area = AREAS.find(a => a.id === sel.area);
    return (
      <div>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
          <button style={s.btn} onClick={() => { setView("lista"); setSel(null); }}>← Voltar</button>
          <h2 style={{ fontSize:18, fontWeight:700, color:T.text, margin:0 }}>OP: {sel.op}{sel.lote && <span style={{ fontSize:13, color:T.text2, fontWeight:400, marginLeft:10 }}>Lote: {sel.lote}</span>}</h2>
          <span style={{ padding:"3px 12px", borderRadius:20, fontSize:11, fontWeight:700, background:statusBg[sel.status], color:statusColor[sel.status] }}>{statusIcon[sel.status]} {sel.status}</span>
        </div>
        <div style={s.card}>
          <SecTitle icon="🏭" ch="Identificação" />
          <G3 ch={<>
            <F lbl="Área" ch={<div style={{ padding:"8px 10px", background:T.surf, borderRadius:8, fontSize:13 }}>{area?.icon} {area?.label}</div>} />
            {sel.sala && <F lbl="Sala" ch={<div style={{ padding:"8px 10px", background:T.surf, borderRadius:8, fontSize:13 }}>{sel.sala}</div>} />}
            <F lbl="Produto" ch={<div style={{ padding:"8px 10px", background:T.surf, borderRadius:8, fontSize:13 }}>{sel.produto}</div>} />
            <F lbl="Data" ch={<div style={{ padding:"8px 10px", background:T.surf, borderRadius:8, fontSize:13 }}>{fmt(sel.data)}</div>} />
            <F lbl="Responsável" ch={<div style={{ padding:"8px 10px", background:T.surf, borderRadius:8, fontSize:13 }}>{sel.resp || "—"}</div>} />
            <F lbl="Criado por" ch={<div style={{ padding:"8px 10px", background:T.surf, borderRadius:8, fontSize:13 }}>{sel.criadoPor}</div>} />
          </>} />
          {sel.obs && <F lbl="Observações" ch={<div style={{ padding:"8px 10px", background:T.surf, borderRadius:8, fontSize:13, color:T.text2 }}>{sel.obs}</div>} />}
        </div>
        <div style={s.card}>
          <SecTitle icon="🔬" ch="Resultados dos Ensaios" />
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
            <thead>
              <tr style={{ background:T.surf }}>
                {["Ensaio","Unidade","Resultado","Situação","Obs."].map(h => (
                  <th key={h} style={{ padding:"8px 10px", textAlign:"left", fontSize:10, fontWeight:700, color:T.text3, textTransform:"uppercase", borderBottom:`1px solid ${T.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(sel.resultados||[]).map((r, i) => (
                <tr key={i} style={{ borderLeft: r.conforme===false ? `3px solid ${T.red}` : r.conforme===true ? `3px solid ${T.accent}` : `3px solid transparent`, background: i%2===0 ? T.card : T.surf }}>
                  <td style={{ padding:"8px 10px", fontWeight:600 }}>{r.label}</td>
                  <td style={{ padding:"8px 10px", color:T.text3 }}>{r.unidade||"—"}</td>
                  <td style={{ padding:"8px 10px" }}>{r.resultado||"—"}</td>
                  <td style={{ padding:"8px 10px" }}>
                    {r.conforme===true ? <span style={{ color:T.accent, fontWeight:700 }}>✓ Conforme</span>
                     : r.conforme===false ? <span style={{ color:T.red, fontWeight:700 }}>✗ N.C.</span>
                     : <span style={{ color:T.text3 }}>—</span>}
                  </td>
                  <td style={{ padding:"8px 10px", color:T.text2 }}>{r.obs||"—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding:"12px 16px", borderRadius:10, textAlign:"center", fontWeight:700, fontSize:15,
            background:statusBg[sel.status], color:statusColor[sel.status], border:`1px solid ${statusColor[sel.status]}33`, marginTop:12 }}>
            {statusIcon[sel.status]} {sel.status === "Liberado" ? "LIBERADO PARA PRÓXIMA ETAPA" : sel.status === "Reprovado" ? "REPROVADO — NÃO LIBERAR" : "ANÁLISE PENDENTE"}
          </div>
        </div>
        <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
          <button style={{ ...s.btnD, fontSize:12 }} onClick={() => deletar(sel.id)}><span className="btn-emoji">🗑️ </span>Excluir</button>
          <button style={{ ...s.btn, fontSize:12 }} onClick={() => editar(sel)}><span className="btn-emoji">✏️ </span>Editar</button>
        </div>
      </div>
    );
  }

  // ── LISTA ──
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, flexWrap:"wrap", gap:10 }}>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
          {/* Barra de busca */}
          <div style={{ position:"relative" }}>
            <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:T.text3, fontSize:13 }}>🔍</span>
            <input placeholder="Buscar OP ou produto..." value={busca} onChange={e => setBusca(e.target.value)}
              style={{ ...s.inp, paddingLeft:30, width:200, fontSize:12 }} />
          </div>
          <Sel value={filtroLinha} onChange={e => setFiltroLinha(e.target.value)}>
            <option value="todas">Todas as linhas</option>
            {LINHAS.map(l => <option key={l} value={l}>{l}</option>)}
          </Sel>
          <Sel value={filtroArea} onChange={e => setFiltroArea(e.target.value)}>
            <option value="todas">Todas as áreas</option>
            {AREAS.map(a => <option key={a.id} value={a.id}>{a.icon} {a.label}</option>)}
          </Sel>
          <Sel value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
            <option value="todos">Todos os status</option>
            <option value="Liberado">✅ Liberado</option>
            <option value="Reprovado">❌ Reprovado</option>
            <option value="Pendente">⏳ Pendente</option>
          </Sel>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button style={s.btnA} onClick={() => { setSel(null); setForm({ area:"", sala:"", op:"", produto:"", linha:"", resp:"", data:tod(), obs:"" }); setResultados([]); setView("novo"); }}>
            + Novo Registro IPC
          </button>
        </div>
      </div>

      {/* Painel de cadastro de produtos (admin) */}
      {showCadastroProd && isAdmin && (
        <div style={{ ...s.card, marginBottom:16 }}>
          <SecTitle icon="📦" ch="Cadastro de Produtos" />
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:12 }}>
            <Inp placeholder="Nome do produto *" value={formProd.nome} onChange={e => setFormProd(p=>({...p,nome:e.target.value}))} style={{ flex:2, minWidth:160 }} />
            <Inp placeholder="Linha (ex: Supra, Verde, Especial) *" value={formProd.linha} onChange={e => setFormProd(p=>({...p,linha:e.target.value}))} style={{ flex:1, minWidth:130 }} />
            <Inp placeholder="Forma (ex: Cápsula, Comprimido)" value={formProd.forma} onChange={e => setFormProd(p=>({...p,forma:e.target.value}))} style={{ flex:1, minWidth:130 }} />
            <button style={s.btnA} onClick={salvarProduto}>+ Adicionar</button>
          </div>
          {produtos.length > 0 && (
            <div style={{ maxHeight:200, overflowY:"auto" }}>
              {produtos.map(p => (
                <div key={p.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 10px", background:T.surf, borderRadius:8, marginBottom:4 }}>
                  <div style={{ flex:1, fontSize:12, color:T.text, fontWeight:600 }}>{p.nome}</div>
                  <span style={{ fontSize:11, padding:"2px 8px", borderRadius:12, background:T.accentDim, color:T.accent }}>{p.linha}</span>
                  {p.forma && <span style={{ fontSize:11, color:T.text2 }}>{p.forma}</span>}
                  <button onClick={() => deletarProduto(p.id)} style={{ ...s.btnD, fontSize:10, padding:"2px 8px" }}>🗑️</button>
                </div>
              ))}
            </div>
          )}
          {produtos.length === 0 && <div style={{ fontSize:12, color:T.text3, textAlign:"center", padding:"1rem" }}>Nenhum produto cadastrado ainda.</div>}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign:"center", padding:"3rem", color:T.text2 }}>Carregando...</div>
      ) : filtrados.length === 0 ? (
        <div style={{ textAlign:"center", padding:"3rem", color:T.text3 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🏭</div>
          <div style={{ fontSize:14 }}>Nenhum registro encontrado.</div>
          <div style={{ fontSize:12, marginTop:6 }}>Crie o primeiro registro de controle de processo!</div>
        </div>
      ) : (
        filtradosPg.map(r => {
          const area = AREAS.find(a => a.id === r.area);
          return (
            <div key={r.id} className="rnc-row" onClick={() => { setSel(r); setView("detalhe"); }}
              style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"12px 16px", marginBottom:8, cursor:"pointer", display:"flex", alignItems:"center", gap:12, flexWrap:"wrap", borderLeft:`3px solid ${statusColor[r.status]||T.border}` }}>
              <div style={{ fontSize:22 }}>{area?.icon||"🏭"}</div>
              <div style={{ flex:1, minWidth:150 }}>
                <div style={{ fontSize:13, fontWeight:700, color:T.text }}>OP: {r.op} — {r.produto}</div>
                <div style={{ fontSize:11, color:T.text2, marginTop:2 }}>{area?.label}{r.sala ? ` · ${r.sala}` : ""}{r.linha ? ` · ${r.linha}` : ""} · {fmt(r.data)}{r.resp ? ` · ${r.resp}` : ""}</div>
              </div>
              <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
                {(r.resultados||[]).map((res, i) => (
                  <span key={i} style={{ fontSize:10, padding:"2px 8px", borderRadius:20, background: res.conforme===true ? T.accent+"18" : res.conforme===false ? T.red+"18" : T.border, color: res.conforme===true ? T.accent : res.conforme===false ? T.red : T.text3 }}>
                    {res.label}: {res.resultado||"—"}
                  </span>
                ))}
              </div>
              <span style={{ padding:"4px 12px", borderRadius:20, fontSize:11, fontWeight:700, background:statusBg[r.status], color:statusColor[r.status], flexShrink:0 }}>
                {statusIcon[r.status]} {r.status}
              </span>
            </div>
          );
        })
      )}
      <Pagination page={pgIPC} total={totIPC} setPage={setPgIPC} />
    </div>
  );
}

export function IPCProdutosTab({ user, toast_ }) {
  const T = useTheme(); const s = useS();
  const [produtos, setProdutos] = useState([]);
  const [formProd, setFormProd] = useState({ nome: "", linha: "", forma: "" });
  const [busca, setBusca] = useState("");
  const [filtroLinha, setFiltroLinha] = useState("todas");
  const isAdmin = user?.role === "admin" || user?.role === "keyuser";

  useEffect(() => {
    const unsub = subscribeCollection("ipc_produtos", list => {
      setProdutos(list.sort((a, b) => (a.linha||"").localeCompare(b.linha||"") || (a.nome||"").localeCompare(b.nome||"")));
    });
    return unsub;
  }, []);

  const salvarProduto = async () => {
    try {
    if (!formProd.nome) { alert("Informe o nome do produto."); return; }
    if (!formProd.linha) { alert("Informe a linha."); return; }
    const id = Date.now();
    await saveCollection("ipc_produtos", String(id), { id, ...formProd, criadoEm: tod() });
    setFormProd({ nome: "", linha: "", forma: "" });
    toast_("Produto cadastrado!", "green");
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const deletarProduto = async (id) => {
    try {
    if (!confirm("Excluir este produto?")) return;
    await deleteFromCollection("ipc_produtos", String(id));
    toast_("Produto excluído.", "red");
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const LINHAS = [...new Set(produtos.map(p => p.linha).filter(Boolean))];

  const filtrados = produtos
    .filter(p => filtroLinha === "todas" || p.linha === filtroLinha)
    .filter(p => !busca || p.nome?.toLowerCase().includes(busca.toLowerCase()) || p.linha?.toLowerCase().includes(busca.toLowerCase()));
  const {paginated:filtradosPg, page:pgIPC, total:totIPC, setPage:setPgIPC} = usePagination(filtrados, 20);

  return (
    <div>
      {/* Filtros */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16, alignItems:"center" }}>
        <div style={{ position:"relative" }}>
          <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:T.text3, fontSize:13 }}>🔍</span>
          <input placeholder="Buscar produto..." value={busca} onChange={e => setBusca(e.target.value)}
            style={{ ...s.inp, paddingLeft:30, width:200, fontSize:12 }} />
        </div>
        <Sel value={filtroLinha} onChange={e => setFiltroLinha(e.target.value)}>
          <option value="todas">Todas as linhas</option>
          {LINHAS.map(l => <option key={l} value={l}>{l}</option>)}
        </Sel>
        <div style={{ marginLeft:"auto", fontSize:12, color:T.text2 }}>{filtrados.length} produto(s)</div>
      </div>

      {/* Form cadastro — admin/keyuser */}
      {isAdmin && (
        <div style={s.card}>
          <SecTitle icon="➕" ch="Novo Produto" />
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <F lbl="Nome *" ch={<Inp placeholder="Ex: Vitamina B12" value={formProd.nome} onChange={e => setFormProd(p=>({...p,nome:e.target.value}))} />} />
            <F lbl="Linha *" ch={<>
              <Sel value={formProd.linha.startsWith("__outro__") ? "__outro__" : formProd.linha} onChange={e => setFormProd(p=>({...p, linha: e.target.value === "__outro__" ? "__outro__" : e.target.value}))}>
                <option value="">Selecione a linha...</option>
                {["Supra","Verde","Beauty","Especial","Terceiros"].map(l=><option key={l} value={l}>{l}</option>)}
                <option value="__outro__">Outros...</option>
              </Sel>
              {formProd.linha === "__outro__" && <Inp placeholder="Digite o nome da linha..." style={{marginTop:6}} onChange={e => setFormProd(p=>({...p, linha: e.target.value || "__outro__"}))} />}
            </>} />
            <F lbl="Forma farmacêutica" ch={<>
              <Sel value={formProd.forma.startsWith("__outro__") ? "__outro__" : formProd.forma} onChange={e => setFormProd(p=>({...p, forma: e.target.value === "__outro__" ? "__outro__" : e.target.value}))}>
                <option value="">Selecione a forma...</option>
                {["Cápsula","Comprimido Mastigável","Líquido","Sachê","Lata","Potes"].map(f=><option key={f} value={f}>{f}</option>)}
                <option value="__outro__">Outros...</option>
              </Sel>
              {formProd.forma === "__outro__" && <Inp placeholder="Digite a forma farmacêutica..." style={{marginTop:6}} onChange={e => setFormProd(p=>({...p, forma: e.target.value || "__outro__"}))} />}
            </>} />
          </div>
          <div style={{ display:"flex", justifyContent:"flex-end", marginTop:8 }}>
            <button style={s.btnA} onClick={salvarProduto}><span className="btn-emoji">+ </span>Cadastrar Produto</button>
          </div>
        </div>
      )}

      {/* Lista de produtos agrupada por linha */}
      {filtrados.length === 0 ? (
        <div style={{ textAlign:"center", padding:"3rem", color:T.text3 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>📦</div>
          <div style={{ fontSize:14 }}>Nenhum produto cadastrado ainda.</div>
          {isAdmin && <div style={{ fontSize:12, marginTop:6 }}>Cadastre os produtos acima para padronizar os lançamentos.</div>}
        </div>
      ) : (
        [...new Set(filtradosPg.map(p=>p.linha))].map(linha => {
          const prods = filtradosPg.filter(p => p.linha === linha);
          if (prods.length === 0) return null;
          return (
            <div key={linha} style={{ marginBottom:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:T.accent, textTransform:"uppercase", letterSpacing:2, marginBottom:8, padding:"4px 0", borderBottom:`1px solid ${T.border}` }}>
                📦 Linha {linha}
              </div>
              {prods.map(p => (
                <div key={p.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:T.card, border:`1px solid ${T.border}`, borderRadius:8, marginBottom:6 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{p.nome}</div>
                    {p.forma && <div style={{ fontSize:11, color:T.text2, marginTop:2 }}>{p.forma}</div>}
                  </div>
                  <span style={{ fontSize:11, padding:"3px 10px", borderRadius:12, background:T.accentDim, color:T.accent, fontWeight:600 }}>{p.linha}</span>
                  {isAdmin && (
                    <button onClick={() => deletarProduto(p.id)} style={{ ...s.btnD, fontSize:11, padding:"4px 10px" }}>🗑️</button>
                  )}
                </div>
              ))}
            </div>
          );
        })
      )}
      <Pagination page={pgIPC} total={totIPC} setPage={setPgIPC}/>
    </div>
  );
}

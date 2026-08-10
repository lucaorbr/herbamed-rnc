// Configuração do módulo Revalidações — Tipos de Revalidação.
//
// Saiu de Admin → Catálogos pelo mesmo motivo dos outros: é uma lista usada só
// por este módulo. Não usa o `CatalogoSimples` porque o item aqui não é só
// nome + ativo: cada tipo carrega a flag de material gráfico e o
// checklist-semente que o formulário copia ao ser escolhido.

import React, { useState, useEffect } from "react";
import { saveCollection } from "../../firebase";
import { useTheme } from "../../core/theme";
import { useS } from "../../shared/styles";
import { SecTitle } from "../../shared/ui";
import { TIPOS_REVALIDACAO_SEED } from "./RevalidacaoTabs";

export function ConfiguracaoRevalidacaoTab({
  catalogoTiposRevalidacao = [],
  isAdmin = false, toast_ = () => {}, auditLog = async () => {}, setTab,
}) {
  const T = useTheme(); const s = useS();

  const mkTipos = (cat) => cat && cat.length > 0
    ? cat.map(t => ({ nome:t.nome, ativo:t.ativo!==false, grafico:!!t.grafico, checklist:Array.isArray(t.checklist)?t.checklist:[] }))
    : TIPOS_REVALIDACAO_SEED.map(t => ({ nome:t.nome, ativo:true, grafico:!!t.grafico, checklist:[...(t.checklist||[])] }));

  const [lista, setLista] = useState(() => mkTipos(catalogoTiposRevalidacao));
  const [editIdx, setEditIdx] = useState(null);
  const [editNome, setEditNome] = useState("");
  const [novo, setNovo] = useState("");
  const [expandIdx, setExpandIdx] = useState(null);
  const [novoItem, setNovoItem] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setLista(mkTipos(catalogoTiposRevalidacao)); }, [catalogoTiposRevalidacao.length]);

  const persist = async (next) => {
    if (!isAdmin) return;
    if (next.some(t => !String(t.nome||"").trim())) { toast_("Todos os tipos precisam de um nome.", "red"); return; }
    setLista(next);
    setSaving(true);
    try {
      await saveCollection("configuracoes", "catalogo_tipos_revalidacao", { items: next });
      await auditLog("Atualizou Catálogo de Tipos de Revalidação", "configuracoes", "catalogo_tipos_revalidacao", "Catálogo", null, { total: next.length });
      toast_("Catálogo de tipos de revalidação salvo!", "green");
    } catch(e) { toast_("Erro ao salvar catálogo.", "red"); console.error(e); }
    setSaving(false);
  };

  const adicionar = () => {
    const nome = novo.trim();
    if (!nome) return;
    if (lista.some(t=>t.nome.toLowerCase()===nome.toLowerCase())) { toast_("Esse tipo já existe.", "red"); return; }
    setNovo("");
    persist([...lista, { nome, ativo:true, grafico:false, checklist:[] }]);
  };

  const btnMini = { ...s.btn, fontSize:11, padding:"4px 10px" };

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
        <button style={s.btn} onClick={()=>setTab("revalidacao")}>← Voltar</button>
        <h2 style={{ fontSize:18, fontWeight:700, color:T.text, margin:0 }}>⚙️ Configuração de Revalidações</h2>
      </div>

      <div style={s.card}>
        <SecTitle icon="⚙️" ch="Tipos de Revalidação" />

        <div style={{ fontSize:11, color:T.text3, marginBottom:14 }}>
          Cada tipo carrega seu próprio <strong>checklist-semente</strong> ao ser escolhido no
          formulário. Marque <strong>Material gráfico</strong> nos tipos de embalagem impressa
          (cartucho, rótulo, bula) para exibir os campos específicos (categoria do material,
          nº de arte, comparação visual). Apenas tipos ativos aparecem no formulário. Use 📋 para
          editar o checklist e ✏️ para renomear. As alterações são salvas automaticamente e
          <strong> não</strong> alteram revalidações já registradas.
        </div>

        {!isAdmin && (
          <div style={{ background:"#ffd16618", border:"1px solid #ffd16644", borderRadius:10, padding:"10px 14px", marginBottom:14, fontSize:12, color:T.text2 }}>
            🔒 Somente leitura — apenas administradores alteram esta lista.
          </div>
        )}

        {isAdmin && (
          <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
            <input placeholder="Nome do tipo (ex: Método Analítico)" value={novo}
              onChange={e=>setNovo(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter") adicionar(); }}
              style={{ ...s.inp, flex:1, fontSize:12 }} />
            <button style={s.btnA} onClick={adicionar}>+ Adicionar</button>
          </div>
        )}

        <div style={{ display:"flex", flexDirection:"column", gap:6, maxHeight:520, overflowY:"auto" }}>
          {lista.map((t, i)=>(
            <div key={i} style={{ background:T.surf, border:`1px solid ${T.border}`, borderRadius:8, padding:"7px 10px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                {editIdx===i ? (<>
                  <input value={editNome} autoFocus
                    onChange={e=>setEditNome(e.target.value)}
                    onKeyDown={e=>{ if(e.key==="Escape") setEditIdx(null); }}
                    style={{ ...s.inp, flex:1, fontSize:12 }} />
                  <button style={s.btnA} onClick={()=>{
                    const nome = editNome.trim();
                    if (!nome) return;
                    if (lista.some((x,j)=>j!==i && x.nome.toLowerCase()===nome.toLowerCase())) { toast_("Esse tipo já existe.", "red"); return; }
                    setEditIdx(null);
                    persist(lista.map((x,j)=>j===i?{ ...x, nome }:x));
                  }}>✓</button>
                  <button style={s.btn} onClick={()=>setEditIdx(null)}>✕</button>
                </>) : (<>
                  <span style={{ flex:1, fontSize:12, color:T.text, fontWeight:600, minWidth:0 }}>{t.nome}</span>
                  {t.grafico && <span style={{ fontSize:10, padding:"2px 8px", borderRadius:12, background:T.accent+"22", color:T.accent, fontWeight:700 }}>Gráfico</span>}
                  <span style={{ fontSize:10, color:T.text3 }}>{(t.checklist||[]).length} itens</span>
                  <span style={{ fontSize:10, padding:"2px 8px", borderRadius:12, background:t.ativo?T.accent+"22":"#ff4f6a22", color:t.ativo?T.accent:"#ff4f6a", fontWeight:700 }}>
                    {t.ativo?"Ativo":"Inativo"}
                  </span>
                  <button style={btnMini} title="Editar checklist" onClick={()=>{ setExpandIdx(expandIdx===i?null:i); setNovoItem(""); }}>📋</button>
                  {isAdmin && (<>
                    <button style={btnMini} onClick={()=>{ setEditIdx(i); setEditNome(t.nome); }}>✏️</button>
                    <button style={btnMini} onClick={()=>persist(lista.map((x,j)=>j===i?{...x,ativo:!x.ativo}:x))}>
                      {t.ativo?"🔒 Desativar":"🔓 Ativar"}
                    </button>
                    <button style={{ ...btnMini, color:"#ff4f6a" }}
                      title="Excluir tipo de revalidação do catálogo"
                      onClick={()=>{ if(window.confirm(`Excluir o tipo de revalidação "${t.nome}" do catálogo?\n\nRevalidações já registradas com este tipo não são afetadas. Prefira desativar se o tipo já foi usado.`)) { if(expandIdx===i) setExpandIdx(null); persist(lista.filter((_,j)=>j!==i)); } }}>🗑️</button>
                  </>)}
                </>)}
              </div>

              {/* Editor de checklist + flag gráfico (expandido) */}
              {expandIdx===i && editIdx!==i && (
                <div style={{ marginTop:8, paddingTop:8, borderTop:`1px solid ${T.border}` }}>
                  <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:T.text2, cursor:isAdmin?"pointer":"default", marginBottom:10 }}>
                    <input type="checkbox" checked={!!t.grafico} disabled={!isAdmin}
                      onChange={e=>persist(lista.map((x,j)=>j===i?{...x,grafico:e.target.checked}:x))}
                      style={{ width:15, height:15, accentColor:T.accent }} />
                    Material gráfico (exibe categoria, nº de arte e comparação visual)
                  </label>
                  <div style={{ fontSize:10, color:T.text3, fontWeight:700, textTransform:"uppercase", marginBottom:6 }}>Checklist-semente</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:4, marginBottom:8 }}>
                    {(t.checklist||[]).length===0 && <div style={{ fontSize:11, color:T.text3, fontStyle:"italic" }}>Sem itens. Adicione abaixo (opcional).</div>}
                    {(t.checklist||[]).map((item, k)=>(
                      <div key={k} style={{ display:"flex", alignItems:"center", gap:8, background:T.card, border:`1px solid ${T.border}`, borderRadius:6, padding:"5px 8px" }}>
                        <span style={{ flex:1, fontSize:12, color:T.text }}>{item}</span>
                        {isAdmin && (
                          <button style={{ ...s.btn, fontSize:11, padding:"2px 8px", color:"#ff4f6a" }} title="Remover item"
                            onClick={()=>persist(lista.map((x,j)=>j===i?{...x,checklist:x.checklist.filter((_,z)=>z!==k)}:x))}>🗑️</button>
                        )}
                      </div>
                    ))}
                  </div>
                  {isAdmin && (
                    <div style={{ display:"flex", gap:8 }}>
                      <input placeholder="Novo item do checklist" value={novoItem}
                        onChange={e=>setNovoItem(e.target.value)}
                        onKeyDown={e=>{ if(e.key==="Enter") document.getElementById("tr-item-add")?.click(); }}
                        style={{ ...s.inp, flex:1, fontSize:12 }} />
                      <button id="tr-item-add" style={s.btnA} onClick={()=>{
                        const item = novoItem.trim();
                        if (!item) return;
                        if ((t.checklist||[]).some(x=>x.toLowerCase()===item.toLowerCase())) { toast_("Esse item já existe no checklist.", "red"); return; }
                        setNovoItem("");
                        persist(lista.map((x,j)=>j===i?{...x,checklist:[...(x.checklist||[]),item]}:x));
                      }}>+ Item</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ textAlign:"right", marginTop:12 }}>
          <button style={{ ...s.btnA, opacity:(!isAdmin||saving)?0.6:1 }} disabled={!isAdmin||saving} onClick={()=>persist(lista)}>
            {saving?"Salvando...":"💾 Salvar tipos de revalidação"}
          </button>
        </div>
      </div>
    </div>
  );
}

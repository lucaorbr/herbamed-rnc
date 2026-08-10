// Configuração do módulo Documentos — Tipos de Documento e Departamentos.
//
// Estes dois catálogos moravam em Admin → Catálogos, lado a lado com listas de
// outros módulos. Duas consequências: a tela do Admin acumulava sete listas de
// assuntos diferentes, e "Departamentos" (organograma, dono do documento)
// ficava encostado em "Setores de Desvio" e "Áreas e Setores" (locais físicos),
// como se fossem a mesma coisa. Ambos são usados só por Documentos, então é
// aqui que eles pertencem — cada módulo configura o próprio vocabulário, como
// no SE Suite.
//
// ⚠️ Prazo de revisão: existiam DOIS campos para a mesma coisa. O daqui gravava
// `prazoRevisaoAnos` no catálogo e **ninguém lia**; quem valia era a grade
// separada em Admin → Configurações, que grava `configuracoes/tipos_revisao`.
// Editar o prazo no catálogo não surtia efeito nenhum. Agora é um campo só, que
// escreve nos dois lugares de uma vez: `tipos_revisao` continua sendo a fonte
// lida por `prazoRevisaoTipo`, e o `prazoRevisaoAnos` do catálogo passa a ser o
// fallback dos tipos criados à mão (que não existem na semente e por isso caíam
// nos 3 anos padrão).

import React, { useState, useEffect } from "react";
import { saveCollection } from "../../firebase";
import { useTheme } from "../../core/theme";
import { useS } from "../../shared/styles";
import { SecTitle } from "../../shared/ui";
import { TIPOS_DOC_GD, DEPARTAMENTOS_GD, prazoRevisaoTipo } from "./tiposDoc";

const ABAS = [
  ["tipos",  "📄 Tipos de Documento"],
  ["deptos", "🏛️ Departamentos"],
];

export function ConfiguracaoDocumentosTab({
  catalogoDeptos = [], catalogoTipos = [], tiposRevisao = {},
  isAdmin = false, toast_ = () => {}, auditLog = async () => {}, onVoltar,
}) {
  const T = useTheme(); const s = useS();

  const mkDefaultDeptos = (cat) => cat && cat.length > 0 ? [...cat] : DEPARTAMENTOS_GD.map(d => ({ ...d, ativo:true }));
  const mkDefaultTipos  = (cat) => cat && cat.length > 0 ? [...cat] : TIPOS_DOC_GD.map(t => ({ ...t, prazoRevisaoAnos:t.prazoRevisaoAnos??2, semCapa:!!t.semCapa, semMarcaDagua:!!t.semMarcaDagua, ativo:true }));

  const [aba, setAba] = useState("tipos");

  const [listaDeptos, setListaDeptos] = useState(() => mkDefaultDeptos(catalogoDeptos));
  const [editDeptoIdx, setEditDeptoIdx] = useState(null);
  const [editDeptoData, setEditDeptoData] = useState({ id:"", label:"" });
  const [novoDepto, setNovoDepto] = useState({ id:"", label:"" });
  const [savingDeptos, setSavingDeptos] = useState(false);

  const [listaTipos, setListaTipos] = useState(() => mkDefaultTipos(catalogoTipos));
  const [editTipoIdx, setEditTipoIdx] = useState(null);
  const [editTipoData, setEditTipoData] = useState({ id:"", label:"", prazoRevisaoAnos:"2", semCapa:false, semMarcaDagua:false });
  const [novoTipo, setNovoTipo] = useState({ id:"", label:"", prazoRevisaoAnos:"2", semCapa:false, semMarcaDagua:false });
  const [savingTipos, setSavingTipos] = useState(false);

  useEffect(() => { setListaDeptos(mkDefaultDeptos(catalogoDeptos)); }, [catalogoDeptos.length]);
  useEffect(() => { setListaTipos(mkDefaultTipos(catalogoTipos));    }, [catalogoTipos.length]);

  /** Prazo em vigor hoje para o tipo — o mesmo número que o cálculo da próxima revisão usa. */
  const prazoEmVigor = (tipoId) => prazoRevisaoTipo(tipoId, tiposRevisao, listaTipos);

  const persistDeptos = async (lista) => {
    if (!isAdmin) return;
    if (lista.some(d => !String(d.id||"").trim() || !String(d.label||"").trim())) { toast_("Todos os departamentos precisam de código e nome.", "red"); return; }
    setSavingDeptos(true);
    try {
      await saveCollection("configuracoes", "catalogo_departamentos", { items: lista });
      await auditLog("Atualizou Catálogo de Departamentos", "configuracoes", "catalogo_departamentos", "Catálogo", null, { total: lista.length });
      toast_("Catálogo de departamentos salvo!", "green");
    } catch(e) { toast_("Erro ao salvar catálogo.", "red"); console.error(e); }
    setSavingDeptos(false);
  };

  /**
   * Persiste a lista recebida (não a do state, que pode estar desatualizada num
   * mesmo tick). `prazoPatch` é `{ [tipoId]: anos }` e vai para `tipos_revisao`,
   * mantendo o campo único em sincronia nos dois documentos.
   */
  const persistTipos = async (lista, prazoPatch = null) => {
    if (!isAdmin) return;
    if (lista.some(t => !String(t.id||"").trim() || !String(t.label||"").trim())) { toast_("Todos os tipos precisam de código e descrição.", "red"); return; }
    setSavingTipos(true);
    try {
      await saveCollection("configuracoes", "catalogo_tipos_doc", { items: lista });
      await auditLog("Atualizou Catálogo de Tipos de Documento", "configuracoes", "catalogo_tipos_doc", "Catálogo", null, { total: lista.length });
      if (prazoPatch && Object.keys(prazoPatch).length) {
        const { id: _ignora, ...atual } = tiposRevisao || {};
        const payload = { ...atual, ...prazoPatch };
        await saveCollection("configuracoes", "tipos_revisao", payload);
        await auditLog("Alterou Prazo de Revisão por Tipo", "configuracoes", "tipos_revisao", "Prazos de revisão por tipo de documento", tiposRevisao || {}, payload);
      }
      toast_("Tipos de documento salvos!", "green");
    } catch(e) { toast_("Erro ao salvar catálogo.", "red"); console.error(e); }
    setSavingTipos(false);
  };

  const linha = { display:"flex", alignItems:"center", gap:8, padding:"7px 10px", background:T.surf, border:`1px solid ${T.border}`, borderRadius:8 };
  const chipAtivo = (ativo) => ({ fontSize:10, padding:"2px 8px", borderRadius:12, background:ativo?T.accent+"22":"#ff4f6a22", color:ativo?T.accent:"#ff4f6a", fontWeight:700 });

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
        {onVoltar && <button style={s.btn} onClick={onVoltar}>← Voltar</button>}
        <h2 style={{ fontSize:18, fontWeight:700, color:T.text, margin:0 }}>⚙️ Configuração de Documentos</h2>
      </div>

      <div style={s.card}>
        <SecTitle icon="⚙️" ch="Configuração" />

        <div style={{ fontSize:11, color:T.text3, marginBottom:14 }}>
          Listas que alimentam os formulários da Gestão de Documentos. As alterações são salvas
          automaticamente e valem para <strong>novos</strong> documentos e novas revisões —
          documentos já emitidos não são reescritos.
        </div>

        <div style={{ display:"flex", gap:6, marginBottom:16, flexWrap:"wrap" }}>
          {ABAS.map(([k,l])=>(
            <button key={k} onClick={()=>setAba(k)}
              style={{ padding:"6px 16px", borderRadius:8, border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:600,
                background:aba===k?T.accent:T.surf, color:aba===k?"#fff":T.text2, transition:"all .15s" }}>
              {l}
            </button>
          ))}
        </div>

        {!isAdmin && (
          <div style={{ background:"#ffd16618", border:"1px solid #ffd16644", borderRadius:10, padding:"10px 14px", marginBottom:14, fontSize:12, color:T.text2 }}>
            🔒 Somente leitura — apenas administradores alteram estas listas.
          </div>
        )}

        {/* ── TIPOS DE DOCUMENTO ── */}
        {aba==="tipos" && (<>
          <div style={{ fontSize:11, color:T.text3, marginBottom:10 }}>
            Código (ex: PO, IT), descrição e prazo de revisão periódica em anos. Apenas tipos ativos
            aparecem nos formulários. O prazo aqui é o que o sistema usa para calcular a próxima
            revisão dos documentos criados a partir de agora.
            <br/><strong>Modelo Formulário</strong> (sem capa + sem marca d'água): para documentos impressos/xerocados, como formulários que acompanham OPs.
          </div>

          {/* Adicionar novo */}
          <div style={{ display:"flex", gap:8, marginBottom:6, flexWrap:"wrap", alignItems:"center" }}>
            <input placeholder="Código (ex: POP)" maxLength={6} value={novoTipo.id} disabled={!isAdmin}
              onChange={e=>setNovoTipo(p=>({...p,id:e.target.value.toUpperCase()}))}
              style={{ ...s.inp, width:90, fontSize:12 }} />
            <input placeholder="Descrição" value={novoTipo.label} disabled={!isAdmin}
              onChange={e=>setNovoTipo(p=>({...p,label:e.target.value}))}
              style={{ ...s.inp, flex:1, fontSize:12 }} />
            <input type="number" min="1" step="1" placeholder="Prazo (anos)" value={novoTipo.prazoRevisaoAnos} disabled={!isAdmin}
              onChange={e=>setNovoTipo(p=>({...p,prazoRevisaoAnos:e.target.value}))}
              style={{ ...s.inp, width:80, fontSize:12 }} />
            <button style={{ ...s.btnA, opacity:isAdmin?1:0.6 }} disabled={!isAdmin} onClick={()=>{
              if (!novoTipo.id.trim() || !novoTipo.label.trim()) return;
              if (listaTipos.find(t=>t.id===novoTipo.id)) { toast_("Código já existe.", "red"); return; }
              const prazo = Number(novoTipo.prazoRevisaoAnos);
              const anos = Number.isFinite(prazo)&&prazo>0 ? prazo : 2;
              const id = novoTipo.id.trim();
              const next = [...listaTipos, { id, label:novoTipo.label.trim(), prazoRevisaoAnos:anos, semCapa:!!novoTipo.semCapa, semMarcaDagua:!!novoTipo.semMarcaDagua, ativo:true }];
              setListaTipos(next);
              setNovoTipo({ id:"", label:"", prazoRevisaoAnos:"2", semCapa:false, semMarcaDagua:false });
              persistTipos(next, { [id]: anos });
            }}>+ Adicionar</button>
          </div>

          {/* Flags do modelo */}
          <div style={{ display:"flex", gap:16, marginBottom:14, flexWrap:"wrap", alignItems:"center", paddingLeft:2 }}>
            <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:T.text2, cursor:"pointer" }}>
              <input type="checkbox" checked={!!novoTipo.semCapa} disabled={!isAdmin} onChange={e=>setNovoTipo(p=>({...p,semCapa:e.target.checked}))} style={{ width:15, height:15, accentColor:T.accent }} />
              Sem capa
            </label>
            <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:T.text2, cursor:"pointer" }}>
              <input type="checkbox" checked={!!novoTipo.semMarcaDagua} disabled={!isAdmin} onChange={e=>setNovoTipo(p=>({...p,semMarcaDagua:e.target.checked}))} style={{ width:15, height:15, accentColor:T.accent }} />
              Sem marca d'água
            </label>
          </div>

          {/* Lista */}
          <div style={{ display:"flex", flexDirection:"column", gap:4, maxHeight:420, overflowY:"auto" }}>
            {listaTipos.map((t, i)=>(
              <div key={i} style={linha}>
                {editTipoIdx===i ? (<>
                  <input value={editTipoData.id} maxLength={6}
                    onChange={e=>setEditTipoData(p=>({...p,id:e.target.value.toUpperCase()}))}
                    style={{ ...s.inp, width:80, fontSize:12 }} />
                  <input value={editTipoData.label}
                    onChange={e=>setEditTipoData(p=>({...p,label:e.target.value}))}
                    style={{ ...s.inp, flex:1, fontSize:12 }} />
                  <input type="number" min="1" step="1" title="Prazo de revisão periódica (anos)" value={editTipoData.prazoRevisaoAnos}
                    onChange={e=>setEditTipoData(p=>({...p,prazoRevisaoAnos:e.target.value}))}
                    style={{ ...s.inp, width:70, fontSize:12 }} />
                  <label title="Sem capa" style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, color:T.text2, cursor:"pointer" }}>
                    <input type="checkbox" checked={!!editTipoData.semCapa} onChange={e=>setEditTipoData(p=>({...p,semCapa:e.target.checked}))} style={{ width:14, height:14, accentColor:T.accent }} />S/capa
                  </label>
                  <label title="Sem marca d'água" style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, color:T.text2, cursor:"pointer" }}>
                    <input type="checkbox" checked={!!editTipoData.semMarcaDagua} onChange={e=>setEditTipoData(p=>({...p,semMarcaDagua:e.target.checked}))} style={{ width:14, height:14, accentColor:T.accent }} />S/marca
                  </label>
                  <button style={s.btnA} onClick={()=>{
                    if (!editTipoData.id.trim() || !editTipoData.label.trim()) return;
                    const prazo = Number(editTipoData.prazoRevisaoAnos);
                    const anos = Number.isFinite(prazo)&&prazo>0 ? prazo : 2;
                    const id = editTipoData.id.trim();
                    const next = listaTipos.map((x,j)=>j===i?{ ...x, id, label:editTipoData.label.trim(), prazoRevisaoAnos:anos, semCapa:!!editTipoData.semCapa, semMarcaDagua:!!editTipoData.semMarcaDagua }:x);
                    setListaTipos(next);
                    setEditTipoIdx(null);
                    persistTipos(next, { [id]: anos });
                  }}>✓</button>
                  <button style={s.btn} onClick={()=>setEditTipoIdx(null)}>✕</button>
                </>) : (<>
                  <span style={{ fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:6, background:T.accentDim, color:T.accent, minWidth:44, textAlign:"center" }}>{t.id}</span>
                  <span style={{ flex:1, fontSize:12, color:T.text, minWidth:0 }}>{t.label}</span>
                  {(t.semCapa || t.semMarcaDagua) && (
                    <span style={{ fontSize:10, padding:"2px 8px", borderRadius:12, background:"#a78bfa22", color:"#a78bfa", fontWeight:700 }}
                      title={`${t.semCapa?"sem capa":""}${t.semCapa&&t.semMarcaDagua?" + ":""}${t.semMarcaDagua?"sem marca d'água":""}`}>
                      📝 Formulário
                    </span>
                  )}
                  <span style={{ fontSize:11, color:T.text3 }} title="Prazo de revisão periódica em vigor">
                    revisar a cada {prazoEmVigor(t.id)} ano{prazoEmVigor(t.id)!==1?"s":""}
                  </span>
                  <span style={chipAtivo(t.ativo)}>{t.ativo?"Ativo":"Inativo"}</span>
                  {isAdmin && (<>
                    <button style={{ ...s.btn, fontSize:11, padding:"4px 10px" }} onClick={()=>{ setEditTipoIdx(i); setEditTipoData({ id:t.id, label:t.label, prazoRevisaoAnos:String(prazoEmVigor(t.id)), semCapa:!!t.semCapa, semMarcaDagua:!!t.semMarcaDagua }); }}>✏️</button>
                    <button style={{ ...s.btn, fontSize:11, padding:"4px 10px" }} onClick={()=>{ const next=listaTipos.map((x,j)=>j===i?{...x,ativo:!x.ativo}:x); setListaTipos(next); persistTipos(next); }}>
                      {t.ativo?"🔒 Desativar":"🔓 Ativar"}
                    </button>
                    <button style={{ ...s.btn, fontSize:11, padding:"4px 10px", color:"#ff4f6a" }}
                      title="Excluir tipo do catálogo"
                      onClick={()=>{ if(confirm(`Excluir o tipo "${t.id} — ${t.label}" do catálogo?\n\nDocumentos já criados com este tipo não são afetados, mas perdem o rótulo amigável. Prefira desativar se o tipo já foi usado.`)) { const next=listaTipos.filter((_,j)=>j!==i); setListaTipos(next); persistTipos(next); } }}>🗑️</button>
                  </>)}
                </>)}
              </div>
            ))}
          </div>
          <div style={{ textAlign:"right", marginTop:12 }}>
            <button style={{ ...s.btnA, opacity:(!isAdmin||savingTipos)?0.6:1 }} disabled={!isAdmin||savingTipos} onClick={()=>persistTipos(listaTipos)}>
              {savingTipos?"Salvando...":"💾 Salvar tipos de documento"}
            </button>
          </div>
        </>)}

        {/* ── DEPARTAMENTOS ── */}
        {aba==="deptos" && (<>
          <div style={{ fontSize:11, color:T.text3, marginBottom:10 }}>
            Código (máx 5 letras maiúsculas) + nome completo. A sigla entra no código do documento
            (ex: <code>PO-SGQ-001</code>), então mudá-la depois não renomeia o que já foi emitido.
            <br/>É o <strong>departamento responsável</strong> pelo documento, uma posição no
            organograma — não o local físico. Para local de trabalho e destino de cópia impressa,
            use <strong>Admin → Estrutura da empresa → Áreas e Setores</strong>.
          </div>

          {/* Adicionar novo */}
          <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
            <input placeholder="Código (ex: SGQ)" maxLength={5} value={novoDepto.id} disabled={!isAdmin}
              onChange={e=>setNovoDepto(p=>({...p,id:e.target.value.toUpperCase()}))}
              style={{ ...s.inp, width:90, fontSize:12 }} />
            <input placeholder="Nome completo" value={novoDepto.label} disabled={!isAdmin}
              onChange={e=>setNovoDepto(p=>({...p,label:e.target.value}))}
              style={{ ...s.inp, flex:1, fontSize:12 }} />
            <button style={{ ...s.btnA, opacity:isAdmin?1:0.6 }} disabled={!isAdmin} onClick={()=>{
              if (!novoDepto.id.trim() || !novoDepto.label.trim()) return;
              if (listaDeptos.find(d=>d.id===novoDepto.id)) { toast_("Código já existe.", "red"); return; }
              const next = [...listaDeptos, { id:novoDepto.id.trim(), label:novoDepto.label.trim(), ativo:true }];
              setListaDeptos(next);
              setNovoDepto({ id:"", label:"" });
              persistDeptos(next);
            }}>+ Adicionar</button>
          </div>

          {/* Lista */}
          <div style={{ display:"flex", flexDirection:"column", gap:4, maxHeight:420, overflowY:"auto" }}>
            {listaDeptos.map((d, i)=>(
              <div key={i} style={linha}>
                {editDeptoIdx===i ? (<>
                  <input value={editDeptoData.id} maxLength={5}
                    onChange={e=>setEditDeptoData(p=>({...p,id:e.target.value.toUpperCase()}))}
                    style={{ ...s.inp, width:80, fontSize:12 }} />
                  <input value={editDeptoData.label}
                    onChange={e=>setEditDeptoData(p=>({...p,label:e.target.value}))}
                    style={{ ...s.inp, flex:1, fontSize:12 }} />
                  <button style={s.btnA} onClick={()=>{
                    if (!editDeptoData.id.trim() || !editDeptoData.label.trim()) return;
                    const next = listaDeptos.map((x,j)=>j===i?{ ...x, id:editDeptoData.id.trim(), label:editDeptoData.label.trim() }:x);
                    setListaDeptos(next);
                    setEditDeptoIdx(null);
                    persistDeptos(next);
                  }}>✓</button>
                  <button style={s.btn} onClick={()=>setEditDeptoIdx(null)}>✕</button>
                </>) : (<>
                  <span style={{ fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:6, background:T.accentDim, color:T.accent, minWidth:44, textAlign:"center" }}>{d.id}</span>
                  <span style={{ flex:1, fontSize:12, color:T.text, minWidth:0 }}>{d.label}</span>
                  <span style={chipAtivo(d.ativo)}>{d.ativo?"Ativo":"Inativo"}</span>
                  {isAdmin && (<>
                    <button style={{ ...s.btn, fontSize:11, padding:"4px 10px" }} onClick={()=>{ setEditDeptoIdx(i); setEditDeptoData({ id:d.id, label:d.label }); }}>✏️</button>
                    <button style={{ ...s.btn, fontSize:11, padding:"4px 10px" }} onClick={()=>{ const next=listaDeptos.map((x,j)=>j===i?{...x,ativo:!x.ativo}:x); setListaDeptos(next); persistDeptos(next); }}>
                      {d.ativo?"🔒 Desativar":"🔓 Ativar"}
                    </button>
                    <button style={{ ...s.btn, fontSize:11, padding:"4px 10px", color:"#ff4f6a" }}
                      title="Excluir departamento do catálogo"
                      onClick={()=>{ if(confirm(`Excluir o departamento "${d.id} — ${d.label}" do catálogo?\n\nDocumentos já criados com este departamento não são afetados, mas perdem o rótulo amigável. Prefira desativar se já foi usado.`)) { const next=listaDeptos.filter((_,j)=>j!==i); setListaDeptos(next); persistDeptos(next); } }}>🗑️</button>
                  </>)}
                </>)}
              </div>
            ))}
          </div>
          <div style={{ textAlign:"right", marginTop:12 }}>
            <button style={{ ...s.btnA, opacity:(!isAdmin||savingDeptos)?0.6:1 }} disabled={!isAdmin||savingDeptos} onClick={()=>persistDeptos(listaDeptos)}>
              {savingDeptos?"Salvando...":"💾 Salvar departamentos"}
            </button>
          </div>
        </>)}
      </div>
    </div>
  );
}

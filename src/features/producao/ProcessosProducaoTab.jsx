import React, { useState, useEffect } from "react";
import { saveCollection, deleteFromCollection, subscribeCollection } from "../../firebase";
import { useTheme } from "../../core/theme";
import { fmt, tod } from "../../core/utils";
import { useS } from "../../shared/styles";
import { F, Inp, Sel } from "../../shared/ui";
import { AssinaturaModal } from "../pdf/pdfExports";

export const CHECKLISTS_PRODUCAO = {
  "Checklist Pesagem": [
    "Temperatura e umidade da sala dentro dos parâmetros",
    "Limpeza da sala",
    "Sanitização da sala",
    "Limpeza de utensílios",
    "Conferência dos dados da OP com o quadro de produção",
    "Colaboradores utilizando EPIs",
    "Matérias-primas de acordo com a formulação descrita na OP",
    "Balanças calibradas, em local adequado, niveladas e isentas de sujidade",
    "Matérias-primas pesadas armazenadas e identificadas adequadamente em sacos plásticos",
  ],
  "Checklist Mistura": [
    "Temperatura e umidade da sala",
    "Limpeza e sanitização da sala",
    "Limpeza e sanitização do misturador",
    "Limpeza e sanitização dos utensílios",
    "Conferência dos dados da OP com o quadro de produção",
    "Colaboradores utilizando EPIs",
    "Aspectos das matérias-primas pesadas de acordo com a especificação",
    "Matérias-primas de acordo com a formulação descrita na OP",
    "Sequência de adição das matérias-primas no misturador conforme determinado na OP",
    "Mistura armazenada, identificada, lacrada hermeticamente em sacos plásticos e acondicionada em caixas box brancas devidamente higienizadas",
    "Amostra do lote enviada para análise sensorial e densidade no CQ",
  ],
  "Encapsulamento": [
    "Temperatura e umidade da sala",
    "Limpeza e sanitização da sala",
    "Limpeza e sanitização dos utensílios",
    "Limpeza e sanitização da encapsuladora",
    "Conferência dos dados da OP com o quadro de produção",
    "Conferência das cápsulas (tamanho e cor)",
    "Conferência das etiquetas (nome do produto, nº da OP, data de fabricação e validade)",
    "Matérias-primas de acordo com a formulação descrita na OP",
    "Cápsulas travadas?",
    "Cápsulas dentro da tolerância de 7,5%?",
    "Integridade das cápsulas (telescopia, amassamentos, riscadas, manchadas, com sujidades, abertas ou qualquer outra irregularidade)",
    "Cápsulas armazenadas corretamente: identificadas, lacradas hermeticamente em sacos plásticos e acondicionadas em caixas box brancas devidamente higienizadas",
  ],
};

export const TIPOS_PROCESSO = ["Checklist Pesagem","Checklist Mistura","Encapsulamento","Seleção de Cápsulas"];

export const TIPO_ICONS_P   = {"Checklist Pesagem":"⚖️","Checklist Mistura":"🥄","Encapsulamento":"💊","Seleção de Cápsulas":"🔍"};

export const STATUS_P_COLORS = {"Rascunho":"#94a3b8","Enviado":"#ffd166","Validado":"#2ab84a"};

export const REFUGO_PADRAO = {
  "Encapsulamento":      ["Telescopia","Vazia","Mal fechada","Manchas","Amassada","Riscada","Com sujidade","Aberta"],
  "Seleção de Cápsulas": ["Telescopia","Vazia","Mal fechada","Manchas","Amassada","Riscada","Com sujidade","Aberta"],
};

export function initChecklist(tipo) {
  return (CHECKLISTS_PRODUCAO[tipo]||[]).map((item,i)=>({id:i,item,status:null,obs:""}));
}

export function ConfigRefugoModal({ config, onClose, toast_ }) {
  const T = useTheme(); const s = useS();
  const [local, setLocal] = useState(()=>{
    const base = {};
    ["Encapsulamento","Seleção de Cápsulas"].forEach(t=>{
      base[t] = (config[t]||REFUGO_PADRAO[t]||[]).join("\n");
    });
    return base;
  });
  const salvar = async () => {
    for (const tipo of ["Encapsulamento","Seleção de Cápsulas"]) {
      const cats = local[tipo].split("\n").map(x=>x.trim()).filter(Boolean);
      await saveCollection("producao_config_refugo", tipo.replace(/\s/g,"_"), {tipo, categorias:cats});
    }
    toast_("Configuração salva!","green");
    onClose();
  };
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",backdropFilter:"blur(6px)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}>
      <div style={{background:T.card2,border:`1px solid ${T.border2}`,borderRadius:18,padding:"1.75rem",maxWidth:520,width:"100%",maxHeight:"85vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.5rem"}}>
          <div style={{fontSize:15,fontWeight:700,color:T.text}}>⚙️ Configurar Categorias de Refugo</div>
          <button style={s.btn} onClick={onClose}>✕</button>
        </div>
        {["Encapsulamento","Seleção de Cápsulas"].map(tipo=>(
          <div key={tipo} style={{marginBottom:"1.25rem"}}>
            <label style={s.lbl}>{TIPO_ICONS_P[tipo]} {tipo}</label>
            <textarea value={local[tipo]} onChange={e=>setLocal(p=>({...p,[tipo]:e.target.value}))} rows={6} placeholder="Uma categoria por linha"
              style={{...s.inp,resize:"vertical",fontFamily:"inherit",fontSize:13,width:"100%",boxSizing:"border-box"}} />
            <div style={{fontSize:11,color:T.text3,marginTop:4}}>"Outro" é sempre exibido automaticamente.</div>
          </div>
        ))}
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:"1rem"}}>
          <button style={s.btn} onClick={onClose}>Cancelar</button>
          <button style={s.btnA} onClick={salvar}>Salvar configuração</button>
        </div>
      </div>
    </div>
  );
}

export function ProcessoFormModal({ processo, user, analisesCQ, ipcRegistros, configRefugo, onSave, onClose, toast_ }) {
  const T = useTheme(); const s = useS();
  const isEdicao = !!processo?.id;
  const [saving, setSaving] = useState(false);

  const mkRefugo = (tipo) => ({
    categorias: (configRefugo[tipo]||REFUGO_PADRAO[tipo]||[]).map(n=>({nome:n,qtd:""})),
    outroDesc:"", outroQtd:"", total:0,
  });

  const [form, setForm] = useState(()=>{
    if (isEdicao) return processo;
    const tipo = "Checklist Pesagem";
    return {
      tipo, op:"", produtoOrigem:"", produtoDestino:"",
      data:tod(), operador:user.name, pesoMinimo:"", pesoMaximo:"",
      status:"Rascunho", checklist:initChecklist(tipo),
      ambientais:[], amostragens:[],
      producao:{horaInicio:"",horaFim:"",qtdProduzida:"",unidade:"cápsulas"},
      refugo:mkRefugo(tipo), paradas:[], obs:"",
    };
  });

  const set = (k,v) => setForm(p=>({...p,[k]:v}));

  const changeTipo = (tipo) => setForm(p=>({...p, tipo, checklist:initChecklist(tipo), refugo:mkRefugo(tipo)}));

  const temChecklist  = ["Checklist Pesagem","Checklist Mistura","Encapsulamento"].includes(form.tipo);
  const temProducao   = ["Encapsulamento","Seleção de Cápsulas"].includes(form.tipo);
  const temAmostragem = form.tipo === "Encapsulamento";
  const temAmbientais = form.tipo === "Encapsulamento";
  const temRefugo     = ["Encapsulamento","Seleção de Cápsulas"].includes(form.tipo);

  const analise = analisesCQ.find(a=>a.op===form.op||a.num===form.op||a.lote===form.op);
  const cqStatus = analise ? analise.conclusao : null;

  const setChecklist = (id,field,val) => set("checklist",form.checklist.map(c=>c.id===id?{...c,[field]:val}:c));
  const addAmbiental = () => set("ambientais",[...(form.ambientais||[]),{id:Date.now(),hora:new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}),temp:"",umidade:""}]);
  const rmAmbiental  = (id) => set("ambientais",form.ambientais.filter(a=>a.id!==id));
  const setAmbiental = (id,k,v) => set("ambientais",form.ambientais.map(a=>a.id===id?{...a,[k]:v}:a));
  const addAmostragem = () => set("amostragens",[...(form.amostragens||[]),{id:Date.now(),hora:new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}),peso:"",integridadeOk:null,temDesvio:false,desvioDesc:""}]);
  const rmAmostragem  = (id) => set("amostragens",form.amostragens.filter(a=>a.id!==id));
  const setAmostragem = (id,k,v) => set("amostragens",form.amostragens.map(a=>a.id===id?{...a,[k]:v}:a));
  const addParada = () => set("paradas",[...(form.paradas||[]),{id:Date.now(),inicio:"",fim:"",motivo:""}]);
  const rmParada  = (id) => set("paradas",form.paradas.filter(p=>p.id!==id));
  const setParada = (id,k,v) => set("paradas",form.paradas.map(p=>p.id===id?{...p,[k]:v}:p));
  const setRefugoQtd = (nome,val) => set("refugo",{...form.refugo,categorias:form.refugo.categorias.map(c=>c.nome===nome?{...c,qtd:val}:c)});
  const totalRefugo = (form.refugo?.categorias||[]).reduce((s,c)=>s+(Number(c.qtd)||0),0)+(Number(form.refugo?.outroQtd)||0);

  const pesoOk = (peso) => {
    if (!form.pesoMinimo&&!form.pesoMaximo) return null;
    const p = Number(peso); if(!p) return null;
    return p>=Number(form.pesoMinimo)&&p<=Number(form.pesoMaximo);
  };

  const salvar = async (novoStatus) => {
    if (!form.op.trim()) { toast_("Informe a OP.","red"); return; }
    setSaving(true);
    try {
      const id = isEdicao ? String(processo.id) : String(Date.now());
      await saveCollection("producao_processos", id, {
        ...form, id, status:novoStatus||form.status,
        refugo:{...form.refugo,total:totalRefugo},
        criadoPor:form.criadoPor||user.name, criadoEm:form.criadoEm||tod(),
        criadoTs:form.criadoTs||Date.now(), atualizadoEm:tod(),
      });
      toast_(novoStatus==="Enviado"?"Enviado para validação! ✓":"Rascunho salvo.","green");
      onSave();
    } catch { toast_("Erro ao salvar.","red"); }
    setSaving(false);
  };

  const SecTitle = ({icon,label}) => (
    <div style={{display:"flex",alignItems:"center",gap:8,margin:"1.5rem 0 .75rem",paddingBottom:8,borderBottom:`1px solid ${T.border}`}}>
      <span style={{fontSize:16}}>{icon}</span>
      <span style={{fontSize:13,fontWeight:700,color:T.text,textTransform:"uppercase",letterSpacing:".06em"}}>{label}</span>
    </div>
  );

  const ncCount   = (form.checklist||[]).filter(c=>c.status==="NC").length;
  const semStatus = (form.checklist||[]).filter(c=>c.status===null).length;

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",backdropFilter:"blur(8px)",zIndex:2000,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"1rem",overflowY:"auto"}}>
      <div style={{background:T.card2,border:`1px solid ${T.border2}`,borderRadius:20,padding:"1.75rem",maxWidth:780,width:"100%",margin:"auto",boxShadow:"0 32px 80px #000c"}}>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.5rem"}}>
          <div>
            <div style={{fontSize:16,fontWeight:800,color:T.text}}>{TIPO_ICONS_P[form.tipo]||"📋"} {isEdicao?"Editar":"Novo"} Registro</div>
            <div style={{fontSize:11,color:T.text3,marginTop:2}}>Controle de Processos — SGQ Herbamed®</div>
          </div>
          <button style={s.btn} onClick={onClose}>✕</button>
        </div>

        <SecTitle icon="📋" label="Identificação" />
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 1rem"}}>
          <F lbl="Tipo de Processo *" ch={
            <Sel value={form.tipo} onChange={e=>changeTipo(e.target.value)} disabled={isEdicao}>
              {TIPOS_PROCESSO.map(t=><option key={t} value={t}>{TIPO_ICONS_P[t]} {t}</option>)}
            </Sel>}/>
          <F lbl="Nº da OP *" ch={<Inp value={form.op} onChange={e=>set("op",e.target.value)} placeholder="Ex: OP-2026-001"/>}/>
          <F lbl="Produto de Origem" ch={<Inp value={form.produtoOrigem} onChange={e=>set("produtoOrigem",e.target.value)} placeholder="Ex: Vitamina B12 Mistura"/>}/>
          <F lbl="Produto de Destino" ch={<Inp value={form.produtoDestino} onChange={e=>set("produtoDestino",e.target.value)} placeholder="Ex: Vitamina B12 Linha Verde"/>}/>
          <F lbl="Data" ch={<Inp type="date" value={form.data} onChange={e=>set("data",e.target.value)}/>}/>
          <F lbl="Operador" ch={<Inp value={form.operador} onChange={e=>set("operador",e.target.value)}/>}/>
          {form.tipo==="Encapsulamento" && <>
            <F lbl="Peso Mínimo (mg) — conforme OP" ch={<Inp type="number" value={form.pesoMinimo} onChange={e=>set("pesoMinimo",e.target.value)} placeholder="Ex: 420"/>}/>
            <F lbl="Peso Máximo (mg) — conforme OP" ch={<Inp type="number" value={form.pesoMaximo} onChange={e=>set("pesoMaximo",e.target.value)} placeholder="Ex: 480"/>}/>
          </>}
        </div>

        {form.op && form.tipo==="Encapsulamento" && (
          <div style={{padding:"10px 14px",borderRadius:10,marginBottom:8,background:cqStatus==="Aprovado"?"#2ab84a18":cqStatus==="Reprovado"?"#ff4f6a18":"#ffd16618",border:`1px solid ${cqStatus==="Aprovado"?"#2ab84a33":cqStatus==="Reprovado"?"#ff4f6a33":"#ffd16633"}`,fontSize:12}}>
            {cqStatus==="Aprovado"&&<span style={{color:"#2ab84a",fontWeight:700}}>✓ Análise CQ: Aprovada — OP liberada para encapsulamento</span>}
            {cqStatus==="Reprovado"&&<span style={{color:"#ff4f6a",fontWeight:700}}>✗ Análise CQ: Reprovada — OP bloqueada</span>}
            {!cqStatus&&<span style={{color:"#ffd166",fontWeight:700}}>⚠ Análise CQ não localizada para esta OP</span>}
          </div>
        )}

        {/* ── ANÁLISE IPC VINCULADA ── */}
        {(() => {
          if (form.tipo !== "Encapsulamento" || !form.op) return null;
          const ipc = (ipcRegistros||[]).find(r => r.op === form.op || r.lote === form.op);
          if (!ipc) return (
            <div style={{padding:"12px 14px",borderRadius:10,marginBottom:12,background:"#ffd16610",border:"1px solid #ffd16633",fontSize:12,color:"#ffd166"}}>
              ⚠ Nenhuma análise IPC localizada para a OP <strong>{form.op}</strong>. Lance a análise no módulo IPC — Análise de Mistura antes de prosseguir.
            </div>
          );
          const statusColor = ipc.status==="Liberado"?"#2ab84a":ipc.status==="Reprovado"?"#ff4f6a":"#ffd166";
          return (
            <div style={{marginBottom:16,border:`1px solid ${statusColor}44`,borderRadius:12,overflow:"hidden"}}>
              <div style={{background:`${statusColor}18`,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{fontWeight:700,fontSize:13,color:statusColor}}>🏭 Análise IPC Vinculada — {ipc.status}</div>
                <div style={{fontSize:11,color:T.text3}}>{ipc.produto} · {fmt(ipc.data)} · {ipc.resp||ipc.criadoPor}</div>
              </div>
              <div style={{padding:"12px 14px",background:T.surf}}>
                {ipc.lote && <div style={{fontSize:11,color:T.text2,marginBottom:10}}>Lote: <strong>{ipc.lote}</strong></div>}
                {(ipc.resultados||[]).length > 0 ? (
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:8}}>
                    {(ipc.resultados||[]).map((r,i) => (
                      <div key={i} style={{background:T.card,border:`1px solid ${r.conforme===false?"#ff4f6a33":r.conforme===true?"#2ab84a22":T.border}`,borderRadius:8,padding:"8px 10px"}}>
                        <div style={{fontSize:10,color:T.text3,fontWeight:700,textTransform:"uppercase",marginBottom:3}}>{r.nome||r.ensaio}</div>
                        <div style={{fontSize:14,fontWeight:700,color:r.conforme===false?"#ff4f6a":r.conforme===true?"#2ab84a":T.text}}>
                          {r.resultado||"—"}{r.unidade?` ${r.unidade}`:""}
                        </div>
                        {r.especificacao && <div style={{fontSize:10,color:T.text3,marginTop:2}}>Esp: {r.especificacao}</div>}
                        {r.conforme===false && <div style={{fontSize:10,color:"#ff4f6a",marginTop:2}}>✗ Fora do padrão</div>}
                        {r.conforme===true  && <div style={{fontSize:10,color:"#2ab84a",marginTop:2}}>✓ Conforme</div>}
                        {r.obs && <div style={{fontSize:10,color:T.text3,marginTop:2,fontStyle:"italic"}}>{r.obs}</div>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{fontSize:12,color:T.text3}}>Sem resultados registrados nesta análise.</div>
                )}
                {ipc.obs && <div style={{fontSize:11,color:T.text2,marginTop:10,fontStyle:"italic"}}>Obs: {ipc.obs}</div>}
              </div>
            </div>
          );
        })()}

        {temChecklist && <>
          <SecTitle icon="☑️" label="Checklist de Verificação"/>
          {ncCount>0&&<div style={{background:"#ff4f6a18",border:"1px solid #ff4f6a33",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#ff4f6a",marginBottom:12}}>⚠ {ncCount} item(s) não conforme(s)</div>}
          {semStatus>0&&<div style={{background:"#ffd16618",border:"1px solid #ffd16633",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#ffd166",marginBottom:12}}>📋 {semStatus} item(s) sem avaliação</div>}
          {(form.checklist||[]).map(c=>(
            <div key={c.id} style={{display:"flex",flexDirection:"column",gap:6,padding:"10px 12px",background:T.surf,borderRadius:10,marginBottom:6,border:`1px solid ${c.status==="NC"?"#ff4f6a33":c.status==="C"?"#2ab84a22":T.border}`}}>
              <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                <div style={{flex:1,fontSize:13,color:T.text,lineHeight:1.5}}>{c.item}</div>
                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  {[["C","✓ C","#2ab84a"],["NC","✗ NC","#ff4f6a"],["NA","N/A","#94a3b8"]].map(([v,l,col])=>(
                    <button key={v} onClick={()=>setChecklist(c.id,"status",c.status===v?null:v)}
                      style={{padding:"4px 10px",borderRadius:6,border:`1px solid ${c.status===v?col:T.border2}`,background:c.status===v?col+"22":"transparent",color:c.status===v?col:T.text3,cursor:"pointer",fontSize:11,fontWeight:700}}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              {c.status==="NC"&&<Inp value={c.obs} onChange={e=>setChecklist(c.id,"obs",e.target.value)} placeholder="Descreva a não conformidade..." style={{fontSize:12}}/>}
            </div>
          ))}
        </>}

        {temAmbientais && <>
          <SecTitle icon="🌡️" label="Condições Ambientais"/>
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}>
            <button style={s.btnA} onClick={addAmbiental}>+ Adicionar aferição</button>
          </div>
          {(form.ambientais||[]).length===0&&<div style={{color:T.text3,fontSize:12,textAlign:"center",padding:16}}>Nenhuma aferição registrada.</div>}
          {(form.ambientais||[]).map(a=>(
            <div key={a.id} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr auto",gap:"0 8px",alignItems:"flex-end",background:T.surf,borderRadius:10,padding:"10px 12px",marginBottom:6,border:`1px solid ${T.border}`}}>
              <F lbl="Hora" ch={<Inp value={a.hora} onChange={e=>setAmbiental(a.id,"hora",e.target.value)} placeholder="08:30"/>}/>
              <F lbl="Temperatura (°C)" ch={<Inp type="number" value={a.temp} onChange={e=>setAmbiental(a.id,"temp",e.target.value)} placeholder="22.5"/>}/>
              <F lbl="Umidade (%)" ch={<Inp type="number" value={a.umidade} onChange={e=>setAmbiental(a.id,"umidade",e.target.value)} placeholder="55"/>}/>
              <button style={{...s.btnD,marginBottom:14}} onClick={()=>rmAmbiental(a.id)}>🗑️</button>
            </div>
          ))}
        </>}

        {temProducao && <>
          <SecTitle icon="⚙️" label="Dados de Produção"/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:"0 1rem"}}>
            <F lbl="Hora Início" ch={<Inp type="time" value={form.producao?.horaInicio} onChange={e=>set("producao",{...form.producao,horaInicio:e.target.value})}/>}/>
            <F lbl="Hora Fim" ch={<Inp type="time" value={form.producao?.horaFim} onChange={e=>set("producao",{...form.producao,horaFim:e.target.value})}/>}/>
            <F lbl="Qtd Produzida" ch={<Inp type="number" value={form.producao?.qtdProduzida} onChange={e=>set("producao",{...form.producao,qtdProduzida:e.target.value})}/>}/>
            <F lbl="Unidade" ch={
              <Sel value={form.producao?.unidade} onChange={e=>set("producao",{...form.producao,unidade:e.target.value})}>
                {["cápsulas","comprimidos","sachês","frascos","latas","kg","unidades"].map(u=><option key={u}>{u}</option>)}
              </Sel>}/>
          </div>
        </>}

        {temAmostragem && <>
          <SecTitle icon="🔬" label="Amostragens — Análise de Encapsulamento"/>
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}>
            <button style={s.btnA} onClick={addAmostragem}>+ Registrar amostragem</button>
          </div>
          {(form.amostragens||[]).length===0&&<div style={{color:T.text3,fontSize:12,textAlign:"center",padding:16}}>Nenhuma amostragem registrada.</div>}
          {(form.amostragens||[]).map(a=>{
            const ok = pesoOk(a.peso);
            return (
              <div key={a.id} style={{background:T.surf,border:`1px solid ${ok===false?"#ff4f6a33":ok===true?"#2ab84a22":T.border}`,borderRadius:10,padding:"12px 14px",marginBottom:8}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1.5fr 1fr 1fr auto",gap:"0 10px",alignItems:"flex-end"}}>
                  <F lbl="Hora" ch={<Inp value={a.hora} onChange={e=>setAmostragem(a.id,"hora",e.target.value)}/>}/>
                  <F lbl={`Peso (mg)${form.pesoMinimo?` [${form.pesoMinimo}–${form.pesoMaximo}]`:""}`} ch={
                    <div style={{position:"relative"}}>
                      <Inp type="number" value={a.peso} onChange={e=>setAmostragem(a.id,"peso",e.target.value)}/>
                      {ok===true&&<span style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",color:"#2ab84a",fontSize:14}}>✓</span>}
                      {ok===false&&<span style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",color:"#ff4f6a",fontSize:14}}>✗</span>}
                    </div>}/>
                  <F lbl="Integridade" ch={
                    <Sel value={a.integridadeOk===null?"":a.integridadeOk?"ok":"nok"} onChange={e=>setAmostragem(a.id,"integridadeOk",e.target.value===""?null:e.target.value==="ok")}>
                      <option value="">—</option>
                      <option value="ok">✓ Conforme</option>
                      <option value="nok">✗ Não conforme</option>
                    </Sel>}/>
                  <F lbl="Desvio?" ch={
                    <Sel value={a.temDesvio?"sim":"nao"} onChange={e=>setAmostragem(a.id,"temDesvio",e.target.value==="sim")}>
                      <option value="nao">Não</option>
                      <option value="sim">Sim</option>
                    </Sel>}/>
                  <button style={{...s.btnD,marginBottom:14}} onClick={()=>rmAmostragem(a.id)}>🗑️</button>
                </div>
                {a.temDesvio&&<Inp value={a.desvioDesc} onChange={e=>setAmostragem(a.id,"desvioDesc",e.target.value)} placeholder="Descreva o desvio encontrado..." style={{fontSize:12,marginTop:4}}/>}
                {ok===false&&<div style={{fontSize:11,color:"#ff4f6a",marginTop:4}}>⚠ Peso fora da tolerância definida na OP</div>}
              </div>
            );
          })}
        </>}

        {temRefugo && <>
          <SecTitle icon="⚠️" label="Registro de Refugo"/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 1rem"}}>
            {(form.refugo?.categorias||[]).map(c=>(
              <F key={c.nome} lbl={c.nome} ch={<Inp type="number" value={c.qtd} onChange={e=>setRefugoQtd(c.nome,e.target.value)} placeholder="0" min="0"/>}/>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 1rem"}}>
            <F lbl="Outro — descreva" ch={<Inp value={form.refugo?.outroDesc||""} onChange={e=>set("refugo",{...form.refugo,outroDesc:e.target.value})} placeholder="Categoria não listada"/>}/>
            <F lbl="Outro — quantidade" ch={<Inp type="number" value={form.refugo?.outroQtd||""} onChange={e=>set("refugo",{...form.refugo,outroQtd:e.target.value})} placeholder="0" min="0"/>}/>
          </div>
          <div style={{background:T.surf,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <span style={{fontSize:13,color:T.text2}}>Total de refugo:</span>
            <span style={{fontSize:18,fontWeight:800,color:totalRefugo>0?"#ff4f6a":T.accent}}>{totalRefugo} {form.producao?.unidade||"unidades"}</span>
          </div>
          {form.producao?.qtdProduzida&&totalRefugo>0&&(
            <div style={{fontSize:12,color:T.text3,textAlign:"right",marginBottom:8}}>
              % refugo: <strong style={{color:T.text}}>{((totalRefugo/(Number(form.producao.qtdProduzida)+totalRefugo))*100).toFixed(1)}%</strong>
              {" · "}% aproveitamento: <strong style={{color:T.accent}}>{(100-((totalRefugo/(Number(form.producao.qtdProduzida)+totalRefugo))*100)).toFixed(1)}%</strong>
            </div>
          )}
        </>}

        {temProducao && <>
          <SecTitle icon="⏸️" label="Paradas de Produção"/>
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}>
            <button style={s.btnA} onClick={addParada}>+ Registrar parada</button>
          </div>
          {(form.paradas||[]).length===0&&<div style={{color:T.text3,fontSize:12,textAlign:"center",padding:12}}>Sem paradas registradas.</div>}
          {(form.paradas||[]).map(p=>{
            const dur = p.inicio&&p.fim ? (()=>{ const [hi,mi]=(p.inicio||"00:00").split(":").map(Number); const [hf,mf]=(p.fim||"00:00").split(":").map(Number); const d=(hf*60+mf)-(hi*60+mi); return d>0?`${d} min`:null; })() : null;
            return (
              <div key={p.id} style={{display:"grid",gridTemplateColumns:"1fr 1fr 2fr auto",gap:"0 10px",alignItems:"flex-end",background:T.surf,borderRadius:10,padding:"10px 14px",marginBottom:6,border:`1px solid ${T.border}`}}>
                <F lbl="Início" ch={<Inp type="time" value={p.inicio} onChange={e=>setParada(p.id,"inicio",e.target.value)}/>}/>
                <F lbl={dur?`Fim (${dur})`:"Fim"} ch={<Inp type="time" value={p.fim} onChange={e=>setParada(p.id,"fim",e.target.value)}/>}/>
                <F lbl="Motivo" ch={<Inp value={p.motivo} onChange={e=>setParada(p.id,"motivo",e.target.value)} placeholder="Ex: Troca de lote, manutenção..."/>}/>
                <button style={{...s.btnD,marginBottom:14}} onClick={()=>rmParada(p.id)}>🗑️</button>
              </div>
            );
          })}
        </>}

        <SecTitle icon="💬" label="Observações"/>
        <textarea value={form.obs} onChange={e=>set("obs",e.target.value)} rows={3} placeholder="Observações gerais..." style={{...s.inp,resize:"vertical",fontFamily:"inherit",fontSize:13,width:"100%",boxSizing:"border-box"}}/>

        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:"1.5rem",flexWrap:"wrap"}}>
          <button style={s.btn} onClick={onClose}>Cancelar</button>
          <button style={{...s.btn,opacity:saving?.6:1}} onClick={()=>salvar("Rascunho")} disabled={saving}>💾 Salvar Rascunho</button>
          <button style={{...s.btnA,opacity:saving?.6:1}} onClick={()=>salvar("Enviado")} disabled={saving}>
            {saving?"Salvando…":"📤 Enviar para Validação"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProcessosProducaoTab({ user, toast_ }) {
  const T = useTheme(); const s = useS();
  const isAdmin = ["admin","keyuser","rt"].includes(user.role);
  const [processos, setProcessos]         = useState([]);
  const [analisesCQ, setAnalisesCQ]       = useState([]);
  const [ipcRegistros, setIpcRegistros]   = useState([]);
  const [configRefugo, setConfigRefugo]   = useState({});
  const [modal, setModal]                 = useState(null);
  const [configModal, setConfigModal]     = useState(false);
  const [assinaturaModal, setAssinaturaModal] = useState(null);
  const [loading, setLoading]             = useState(true);
  const [filtTipo, setFiltTipo]           = useState("");
  const [filtStatus, setFiltStatus]       = useState("");
  const [filtOp, setFiltOp]               = useState("");

  useEffect(()=>{
    const u1 = subscribeCollection("producao_processos", list=>{ setProcessos(list.sort((a,b)=>(b.criadoTs||0)-(a.criadoTs||0))); setLoading(false); });
    const u2 = subscribeCollection("cq_analises", list=>setAnalisesCQ(list));
    const u4 = subscribeCollection("ipc_registros", list=>setIpcRegistros(list));
    const u3 = subscribeCollection("producao_config_refugo", list=>{ const map={}; list.forEach(c=>{map[c.tipo]=c.categorias||[];}); setConfigRefugo(map); });
    return ()=>{ u1(); u2(); u3(); u4(); };
  },[]);

  const validar = async (processo, assinatura) => {
    await saveCollection("producao_processos", String(processo.id), {
      ...processo, status:"Validado",
      validacao:{ ...assinatura, validadoPor:assinatura.nome, cargo:assinatura.cargo, email:assinatura.email, setor:assinatura.setor, registroProfissional:assinatura.registroProfissional||assinatura.crf||"", dataHora:assinatura.timestamp, obs:"" },
    });
    toast_("Processo validado! ✓","green");
    setAssinaturaModal(null);
  };

  const excluir = async (p) => {
    if (!confirm(`Excluir "${p.tipo} — ${p.op}"?`)) return;
    await deleteFromCollection("producao_processos", String(p.id));
    toast_("Registro excluído.","red");
  };

  const lista = processos.filter(p=>
    (!filtTipo||p.tipo===filtTipo)&&
    (!filtStatus||p.status===filtStatus)&&
    (!filtOp||(p.op||"").toLowerCase().includes(filtOp.toLowerCase()))
  );

  const canEdit  = (p) => p.status!=="Validado"&&(isAdmin||p.criadoPor===user.name);
  const canValid = (p) => p.status==="Enviado"&&isAdmin;

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.25rem",flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <Sel value={filtTipo} onChange={e=>setFiltTipo(e.target.value)} style={{minWidth:180}}>
            <option value="">Todos os tipos</option>
            {TIPOS_PROCESSO.map(t=><option key={t} value={t}>{TIPO_ICONS_P[t]} {t}</option>)}
          </Sel>
          <Sel value={filtStatus} onChange={e=>setFiltStatus(e.target.value)}>
            <option value="">Todos os status</option>
            {["Rascunho","Enviado","Validado"].map(st=><option key={st}>{st}</option>)}
          </Sel>
          <Inp value={filtOp} onChange={e=>setFiltOp(e.target.value)} placeholder="Buscar OP…" style={{width:160}}/>
        </div>
        <div style={{display:"flex",gap:8}}>
          {isAdmin&&<button style={s.btn} onClick={()=>setConfigModal(true)}>⚙️ Configurar Refugo</button>}
          <button style={s.btnA} onClick={()=>setModal("new")}>+ Novo Registro</button>
        </div>
      </div>

      {loading&&<div style={{textAlign:"center",color:T.text3,padding:40}}>Carregando…</div>}
      {!loading&&lista.length===0&&(
        <div style={{textAlign:"center",padding:60,color:T.text3}}>
          <div style={{fontSize:40,marginBottom:12}}>📋</div>
          <div style={{fontSize:15,fontWeight:600,color:T.text2}}>Nenhum registro encontrado</div>
          <div style={{fontSize:13,marginTop:6}}>Clique em "+ Novo Registro" para começar.</div>
        </div>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {lista.map(p=>{
          const ncCount = (p.checklist||[]).filter(c=>c.status==="NC").length;
          const foraCount = (p.amostragens||[]).filter(a=>{
            if(!p.pesoMinimo&&!p.pesoMaximo) return false;
            const v=Number(a.peso); return v&&(v<Number(p.pesoMinimo)||v>Number(p.pesoMaximo));
          }).length;
          return (
            <div key={p.id} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"14px 18px",display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
              <div style={{fontSize:28,flexShrink:0}}>{TIPO_ICONS_P[p.tipo]||"📋"}</div>
              <div style={{flex:1,minWidth:200}}>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <span style={{fontWeight:700,color:T.text,fontSize:14}}>{p.tipo}</span>
                  <span style={{background:STATUS_P_COLORS[p.status]+"22",color:STATUS_P_COLORS[p.status],border:`1px solid ${STATUS_P_COLORS[p.status]}44`,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>{p.status}</span>
                  {ncCount>0&&<span style={{background:"#ff4f6a18",color:"#ff4f6a",border:"1px solid #ff4f6a33",borderRadius:6,padding:"2px 8px",fontSize:11}}>⚠ {ncCount} NC</span>}
                  {foraCount>0&&<span style={{background:"#ff8c4218",color:"#ff8c42",border:"1px solid #ff8c4233",borderRadius:6,padding:"2px 8px",fontSize:11}}>⚠ {foraCount} peso(s) fora</span>}
                </div>
                <div style={{fontSize:12,color:T.text2,marginTop:4}}>
                  <strong>{p.op}</strong>{p.produtoDestino&&` → ${p.produtoDestino}`} · {fmt(p.data)} · {p.operador}
                </div>
                {p.status==="Validado"&&p.validacao&&(
                  <div style={{fontSize:11,color:"#2ab84a",marginTop:2}}>✓ Validado por {p.validacao.validadoPor} em {new Date(p.validacao.dataHora).toLocaleDateString("pt-BR")}</div>
                )}
              </div>
              <div style={{display:"flex",gap:6,flexShrink:0}}>
                {canEdit(p)&&<button style={s.btn} onClick={()=>setModal(p)}>✏️ Editar</button>}
                {canValid(p)&&<button style={{...s.btnA,fontSize:12}} onClick={()=>setAssinaturaModal(p)}>✅ Validar</button>}
                {isAdmin&&p.status!=="Validado"&&<button style={s.btnD} onClick={()=>excluir(p)}>🗑️</button>}
              </div>
            </div>
          );
        })}
      </div>

      {modal&&(
        <ProcessoFormModal processo={modal==="new"?null:modal} user={user} analisesCQ={analisesCQ}
          ipcRegistros={ipcRegistros}
          configRefugo={configRefugo} onSave={()=>setModal(null)} onClose={()=>setModal(null)} toast_={toast_}/>
      )}
      {configModal&&isAdmin&&(
        <ConfigRefugoModal config={configRefugo} onClose={()=>setConfigModal(false)} toast_={toast_}/>
      )}
      {assinaturaModal&&(
        <AssinaturaModal user={user} titulo={`Validar: ${assinaturaModal.tipo} — ${assinaturaModal.op}`}
          contexto={`PRODUCAO|${assinaturaModal.id||assinaturaModal.op||""}`}
          papel="Validador do processo"
          onConfirm={(assin)=>validar(assinaturaModal,assin)} onClose={()=>setAssinaturaModal(null)}/>
      )}
    </div>
  );
}

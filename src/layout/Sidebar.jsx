import React, { useState } from "react";
import { useFormal } from "../core/theme";
import { MENU_SVG_ICONS } from "./menuIcons";

export function SidebarGrupo({ grupo, tab, setTab, sidebarOpen, T, defaultOpen }) {
  const grupoAtivo = grupo.items.some(i => i.id === tab);
  const [open, setOpen] = useState(() => defaultOpen);
  const grupoBadge = grupo.items.reduce((s,i) => s + (i.badge||0), 0);
  const formal = useFormal();

  return (
    <div style={{ marginBottom:2 }}>
      {sidebarOpen ? (
        <button onClick={()=>setOpen(o=>!o)} style={{ width:"100%", display:"flex", alignItems:"center", gap:8, padding:"7px 8px", border:"none", background: grupoAtivo?`${T.accent}12`:"transparent", color: grupoAtivo?T.accent:T.text3, cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:700, borderRadius:8, textAlign:"left", textTransform:"uppercase", letterSpacing:".06em", transition:"all .15s", marginTop:4 }}>
          {!formal && <span style={{ fontSize:12, flexShrink:0 }}>{grupo.icon}</span>}
          <span style={{ flex:1 }}>{grupo.label}</span>
          {grupoBadge>0 && <span style={{ background:T.red, color:"#fff", fontSize:8, fontWeight:700, borderRadius:10, padding:"1px 5px" }}>{grupoBadge}</span>}
          <span style={{ fontSize:8, opacity:.4, transition:"transform .2s", display:"inline-block", transform:open?"rotate(180deg)":"rotate(0)" }}>▼</span>
        </button>
      ) : (
        <div style={{ height:1, background:T.border, margin:"4px 6px" }} />
      )}
      {(open || !sidebarOpen) && grupo.items.map(item=>(
        <button key={item.id} onClick={()=>setTab(item.id)} style={{ width:"100%", display:"flex", alignItems:"center", gap:8, padding: sidebarOpen?"7px 10px 7px 22px":"8px 10px", border: tab===item.id?`1px solid ${T.accent}22`:"1px solid transparent", background: tab===item.id?T.accentDim:"transparent", color: tab===item.id?T.accent:T.text2, cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight: tab===item.id?600:400, borderRadius:8, marginBottom:1, transition:"all .15s", textAlign:"left", boxShadow: tab===item.id?`0 0 8px ${T.accentGlow}`:"none", whiteSpace:"nowrap", overflow:"hidden", position:"relative" }}>
          {formal && MENU_SVG_ICONS[item.id]
            ? <span style={{ display:"flex", alignItems:"center", flexShrink:0, width:18, justifyContent:"center" }} dangerouslySetInnerHTML={{ __html: MENU_SVG_ICONS[item.id] }} />
            : <span style={{ fontSize:15, flexShrink:0, width:18, textAlign:"center" }}>{item.icon}</span>
          }
          {sidebarOpen && <span style={{ flex:1, overflow:"hidden", textOverflow:"ellipsis", fontSize:12 }}>{item.label}</span>}
          {sidebarOpen && (item.badge||0)>0 && <span style={{ background:T.red, color:"#fff", fontSize:8, fontWeight:700, borderRadius:10, padding:"1px 5px", flexShrink:0 }}>{item.badge}</span>}
          {!sidebarOpen && (item.badge||0)>0 && <span style={{ position:"absolute", top:3, right:3, width:6, height:6, borderRadius:"50%", background:T.red }} />}
        </button>
      ))}
    </div>
  );
}

export function SidebarNav({ T, tab, setTab, sidebarOpen, rncs, isViewer, isAdmin }) {
  const GRUPOS = [
    { id:"principal", icon:"📋", label:"RNCs", items:[
      { id:"lista", icon:"📋", label:"Registros", badge: rncs.filter(x=>x.status==="Aberta").length },
      ...(!isViewer?[{ id:"nova", icon:"➕", label:"Nova RNC" }]:[]),
    ]},
    ...(!isViewer?[{ id:"qualidade", icon:"🔬", label:"Ferramentas da Qualidade", items:[
      { id:"ishikawa", icon:"🐟", label:"Ishikawa / 5 Porquês" },
      { id:"5w2h",     icon:"📌", label:"5W2H" },
      { id:"eficacia", icon:"✅", label:"Eficácia" },
      { id:"fmea",     icon:"⚠️", label:"FMEA" },
    ]}]:[]),
    { id:"cq", icon:"🧪", label:"Controle de Qualidade", items:[
      { id:"cq-materiais", icon:"🧪", label:"Entrada de Materiais" },
      { id:"cq-analises",  icon:"📋", label:"Análises" },
      { id:"cq-dashboard", icon:"📈", label:"Dashboard CQ" },
      { id:"nqa",          icon:"📐", label:"NQA / AQL" },
    ]},
    { id:"producao", icon:"🏗️", label:"Produção", items:[
      { id:"producao-processos", icon:"🏗️", label:"Controle de Processos" },
      { id:"ipc",                icon:"🏭", label:"Controle de Processo IPC" },
      { id:"ipc-produtos",       icon:"📦", label:"Produtos IPC" },
    ]},
    { id:"analise", icon:"📊", label:"Indicadores", items:[
      { id:"dashboard",  icon:"📊", label:"Dashboard" },
      { id:"cep",        icon:"📉", label:"CEP" },
      { id:"relatorios", icon:"📑", label:"Relatórios" },
    ]},
    { id:"cadastros", icon:"🏢", label:"Cadastros", items:[
      { id:"fornecedores", icon:"🏭", label:"Fornecedores" },
      { id:"clientes",     icon:"🏢", label:"Clientes Terceiros" },
      { id:"laudos",       icon:"📋", label:"Laudos Analíticos" },
    ]},
    { id:"gestao", icon:"🗂️", label:"Documentos & Gestão", items:[
      { id:"gestao-docs",  icon:"🗂️", label:"Gestão de Docs" },
      { id:"auditorias",   icon:"🔍", label:"Auditorias" },
      ...(isAdmin?[{ id:"audit-log", icon:"🛡️", label:"Trilha de Auditoria" }]:[]),
      ...(isAdmin?[{ id:"admin",     icon:"⚙️", label:"Administração" }]:[]),
    ]},
  ];

  return (
    <div style={{ width:sidebarOpen?220:60, flexShrink:0, background:T.surf, borderRight:`1px solid ${T.border}`, display:"flex", flexDirection:"column", transition:"width .25s ease", overflow:"hidden", position:"sticky", top:60, height:"calc(100vh - 60px)" }}>
      <div style={{ padding:"6px 6px", flex:1, overflowY:"auto" }}>
        {GRUPOS.map(grupo=>(
          <SidebarGrupo
            key={grupo.id}
            grupo={grupo}
            tab={tab}
            setTab={setTab}
            sidebarOpen={sidebarOpen}
            T={T}
            defaultOpen={grupo.id==="principal" || grupo.items.some(i=>i.id===tab)}
          />
        ))}
      </div>
      {sidebarOpen && (
        <div style={{ padding:"10px 14px", borderTop:`1px solid ${T.border}`, fontSize:10, color:T.text3 }}>
          <div style={{ fontWeight:600, color:T.text2, marginBottom:1 }}>SGQ Herbamed®</div>
          <div>v2.0 · {new Date().getFullYear()}</div>
        </div>
      )}
    </div>
  );
}

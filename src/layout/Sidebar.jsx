import React, { useState } from "react";
import { useFormal } from "../core/theme";
import { APP_VERSION_LABEL } from "../config/appVersion";
import { MENU_SVG_ICONS } from "./menuIcons";
import { montarGrupos } from "./navegacao";

// Botão de item (folha do menu). padLeft controla o recuo — subitens de um
// subgrupo recebem um recuo maior para deixar clara a hierarquia.
function ItemBtn({ item, tab, setTab, sidebarOpen, T, formal, padLeft = 22 }) {
  return (
    <button onClick={()=>setTab(item.id)} style={{ width:"100%", display:"flex", alignItems:"center", gap:8, padding: sidebarOpen?`7px 10px 7px ${padLeft}px`:"8px 10px", border: tab===item.id?`1px solid ${T.accent}22`:"1px solid transparent", background: tab===item.id?T.accentDim:"transparent", color: tab===item.id?T.accent:T.text2, cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight: tab===item.id?600:400, borderRadius:8, marginBottom:1, transition:"all .15s", textAlign:"left", boxShadow: tab===item.id?`0 0 8px ${T.accentGlow}`:"none", whiteSpace:"nowrap", overflow:"hidden", position:"relative" }}>
      {formal && MENU_SVG_ICONS[item.id]
        ? <span style={{ display:"flex", alignItems:"center", flexShrink:0, width:18, justifyContent:"center" }} dangerouslySetInnerHTML={{ __html: MENU_SVG_ICONS[item.id] }} />
        : <span style={{ fontSize:15, flexShrink:0, width:18, textAlign:"center" }}>{item.icon}</span>
      }
      {sidebarOpen && <span style={{ flex:1, overflow:"hidden", textOverflow:"ellipsis", fontSize:12 }}>{item.label}</span>}
      {sidebarOpen && (item.badge||0)>0 && <span style={{ background:T.red, color:"#fff", fontSize:8, fontWeight:700, borderRadius:10, padding:"1px 5px", flexShrink:0 }}>{item.badge}</span>}
      {!sidebarOpen && (item.badge||0)>0 && <span style={{ position:"absolute", top:3, right:3, width:6, height:6, borderRadius:"50%", background:T.red }} />}
    </button>
  );
}

// Subgrupo colapsável dentro de um grupo (3º nível). Cabeçalho só abre/fecha;
// os subitens navegam. Ex.: "Revalidações" dentro de "Controle de Qualidade".
function SidebarSubgrupo({ item, tab, setTab, sidebarOpen, T, formal, defaultOpen }) {
  const subAtivo = item.subItems.some(si => si.id === tab);
  const [open, setOpen] = useState(() => defaultOpen);
  const subBadge = item.subItems.reduce((s,si) => s + (si.badge||0), 0);

  // Recolhida (só ícones): sem cabeçalho colapsável — mostra os subitens direto.
  if (!sidebarOpen) {
    return <>{item.subItems.map(si => <ItemBtn key={si.id} item={si} tab={tab} setTab={setTab} sidebarOpen={sidebarOpen} T={T} formal={formal} />)}</>;
  }

  return (
    <div>
      <button onClick={()=>setOpen(o=>!o)} style={{ width:"100%", display:"flex", alignItems:"center", gap:8, padding:"7px 10px 7px 22px", border: subAtivo?`1px solid ${T.accent}22`:"1px solid transparent", background: subAtivo?`${T.accent}10`:"transparent", color: subAtivo?T.accent:T.text2, cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:600, borderRadius:8, marginBottom:1, transition:"all .15s", textAlign:"left", whiteSpace:"nowrap", overflow:"hidden" }}>
        {formal && MENU_SVG_ICONS[item.id]
          ? <span style={{ display:"flex", alignItems:"center", flexShrink:0, width:18, justifyContent:"center" }} dangerouslySetInnerHTML={{ __html: MENU_SVG_ICONS[item.id] }} />
          : <span style={{ fontSize:15, flexShrink:0, width:18, textAlign:"center" }}>{item.icon}</span>
        }
        <span style={{ flex:1, overflow:"hidden", textOverflow:"ellipsis" }}>{item.label}</span>
        {subBadge>0 && <span style={{ background:T.red, color:"#fff", fontSize:8, fontWeight:700, borderRadius:10, padding:"1px 5px", flexShrink:0 }}>{subBadge}</span>}
        <span style={{ fontSize:8, opacity:.4, transition:"transform .2s", display:"inline-block", transform:open?"rotate(180deg)":"rotate(0)" }}>▼</span>
      </button>
      {open && item.subItems.map(si => <ItemBtn key={si.id} item={si} tab={tab} setTab={setTab} sidebarOpen={sidebarOpen} T={T} formal={formal} padLeft={38} />)}
    </div>
  );
}

export function SidebarGrupo({ grupo, tab, setTab, sidebarOpen, T, defaultOpen }) {
  const grupoAtivo = grupo.items.some(i => i.id === tab || (i.subItems && i.subItems.some(si => si.id === tab)));
  const [open, setOpen] = useState(() => defaultOpen);
  const grupoBadge = grupo.items.reduce((s,i) => s + (i.badge||0) + ((i.subItems||[]).reduce((a,si)=>a+(si.badge||0),0)), 0);
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
        item.subItems
          ? <SidebarSubgrupo key={item.id} item={item} tab={tab} setTab={setTab} sidebarOpen={sidebarOpen} T={T} formal={formal} defaultOpen={item.subItems.some(si=>si.id===tab)} />
          : <ItemBtn key={item.id} item={item} tab={tab} setTab={setTab} sidebarOpen={sidebarOpen} T={T} formal={formal} />
      ))}
    </div>
  );
}

export function SidebarNav({ T, tab, setTab, sidebarOpen, rncs, desvios = [], isViewer, isAdmin, perm = () => true }) {
  // A estrutura do menu mora em `navegacao.js` — a barra lateral e a barra de abas
  // leem a mesma fonte, para tela nova aparecer nas duas sem ninguém lembrar.
  const GRUPOS = montarGrupos({ rncs, desvios, isViewer, isAdmin, perm });

  return (
    <div style={{ width:"100%", height:"100%", flexShrink:0, background:T.surf, display:"flex", flexDirection:"column", transition:"width .25s ease", overflow:"hidden" }}>
      <div style={{ padding:"6px 6px", flex:1, overflowY:"auto" }}>
        {GRUPOS.map(grupo=>(
          <SidebarGrupo
            key={grupo.id}
            grupo={grupo}
            tab={tab}
            setTab={setTab}
            sidebarOpen={sidebarOpen}
            T={T}
            defaultOpen={grupo.id==="principal" || grupo.items.some(i=>i.id===tab || (i.subItems && i.subItems.some(si=>si.id===tab)))}
          />
        ))}
      </div>
      {sidebarOpen && (
        <div style={{ padding:"10px 14px", borderTop:`1px solid ${T.border}`, fontSize:10, color:T.text3 }}>
          <div style={{ fontWeight:600, color:T.text2, marginBottom:1 }}>SGQ Herbamed®</div>
          <div>{APP_VERSION_LABEL} � {new Date().getFullYear()}</div>
        </div>
      )}
    </div>
  );
}

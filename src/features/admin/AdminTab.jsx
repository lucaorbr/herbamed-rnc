import React, { useState, useEffect } from "react";
import { saveUser, createAuthUser, deleteUser as fbDeleteUser, updateUser, saveCollection, adminResetPassword } from "../../firebase";
import { useTheme } from "../../core/theme";
import { PERMS_GRUPOS, PERMS_PADRAO } from "../permissions/permissions";
import { useS } from "../../shared/styles";
import { usePagination } from "../../shared/ui";
import { deleteUser } from "../../firebase";
import { F, G2, G3, Inp, Pagination, SecTitle, Sel } from "../../shared/ui";
import { TIPOS_DOC_GD, DEPARTAMENTOS_GD, prazoRevisaoTipo } from "../documentos/GestaoDocumentosTab";
import { TIPOS_DESVIO, SETORES_DESVIO } from "../desvios/DesviosTabs";

export function AdminTab({ users, setUsers, toast_, currentUser, auditLog, config = {}, tiposRevisao = {}, catalogoDeptos = [], catalogoTipos = [], catalogoTiposDesvio = [], catalogoSetoresDesvio = [] }) {
  const T = useTheme(); const s = useS();
  const isAdmin = ["admin","keyuser","rt"].includes(currentUser?.role);

  // Prazo de revisão por tipo de documento (configuracoes/tipos_revisao)
  const prazosFromCfg = () => Object.fromEntries(TIPOS_DOC_GD.map(t => [t.id, String(prazoRevisaoTipo(t.id, tiposRevisao))]));
  const [prazos, setPrazos] = useState(prazosFromCfg);
  const [savingPrazos, setSavingPrazos] = useState(false);
  useEffect(() => { setPrazos(prazosFromCfg()); }, [tiposRevisao]);

  const salvarPrazosRevisao = async () => {
    if (!isAdmin) { toast_("Apenas administradores podem alterar configurações.", "red"); return; }
    const payload = {};
    for (const t of TIPOS_DOC_GD) {
      const n = Number(prazos[t.id]);
      if (!Number.isFinite(n) || n <= 0) { toast_(`Prazo inválido para ${t.id} — informe um número de anos maior que zero.`, "red"); return; }
      payload[t.id] = n;
    }
    setSavingPrazos(true);
    try {
      await saveCollection("configuracoes", "tipos_revisao", payload);
      await auditLog("Alterou Prazo de Revisão por Tipo", "configuracoes", "tipos_revisao", "Prazos de revisão por tipo de documento", tiposRevisao || {}, payload);
      toast_("Prazos de revisão salvos!", "green");
    } catch(e) { toast_("Erro ao salvar prazos de revisão.", "red"); console.error(e); }
    setSavingPrazos(false);
  };

  const toggleAprovadorDif = async () => {
    if (!isAdmin) { toast_("Apenas administradores podem alterar configurações.", "red"); return; }
    const novo = !config?.aprovadorDiferenteAnalista;
    try {
      const { id, ...rest } = config || {};
      await saveCollection("configuracoes", "geral", { ...rest, aprovadorDiferenteAnalista: novo });
      await auditLog("Alterou Configuração da Qualidade", "configuracoes", "geral", "Aprovador ≠ Analista (CQ)", { aprovadorDiferenteAnalista: !novo }, { aprovadorDiferenteAnalista: novo });
      toast_(novo ? "Regra ativada: aprovador deve ser diferente do analista." : "Regra desativada.", "green");
    } catch(e) { toast_("Erro ao salvar configuração.", "red"); console.error(e); }
  };
  // ── Catálogos ─────────────────────────────────────────────────────────────
  const mkDefaultDeptos = (cat) => cat && cat.length > 0 ? [...cat] : DEPARTAMENTOS_GD.map(d => ({ ...d, ativo:true }));
  const mkDefaultTipos  = (cat) => cat && cat.length > 0 ? [...cat] : TIPOS_DOC_GD.map(t => ({ ...t, prazoRevisaoAnos:t.prazoRevisaoAnos??2, semCapa:!!t.semCapa, semMarcaDagua:!!t.semMarcaDagua, ativo:true }));
  const mkDefaultTiposDesvio = (cat) => cat && cat.length > 0 ? [...cat] : TIPOS_DESVIO.map(nome => ({ nome, ativo:true }));
  const mkDefaultSetoresDesvio = (cat) => cat && cat.length > 0 ? [...cat] : SETORES_DESVIO.map(nome => ({ nome, ativo:true }));

  const [abaAdmin, setAbaAdmin] = useState("usuarios");
  const [catAba, setCatAba] = useState("deptos");
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
  const [listaTiposDesvio, setListaTiposDesvio] = useState(() => mkDefaultTiposDesvio(catalogoTiposDesvio));
  const [editTdIdx, setEditTdIdx] = useState(null);
  const [editTdNome, setEditTdNome] = useState("");
  const [novoTd, setNovoTd] = useState("");
  const [savingTd, setSavingTd] = useState(false);
  const [listaSetoresDesvio, setListaSetoresDesvio] = useState(() => mkDefaultSetoresDesvio(catalogoSetoresDesvio));
  const [editSdIdx, setEditSdIdx] = useState(null);
  const [editSdNome, setEditSdNome] = useState("");
  const [novoSd, setNovoSd] = useState("");
  const [savingSd, setSavingSd] = useState(false);

  useEffect(() => { setListaDeptos(mkDefaultDeptos(catalogoDeptos)); }, [catalogoDeptos.length]);
  useEffect(() => { setListaTipos(mkDefaultTipos(catalogoTipos));   }, [catalogoTipos.length]);
  useEffect(() => { setListaTiposDesvio(mkDefaultTiposDesvio(catalogoTiposDesvio)); }, [catalogoTiposDesvio.length]);
  useEffect(() => { setListaSetoresDesvio(mkDefaultSetoresDesvio(catalogoSetoresDesvio)); }, [catalogoSetoresDesvio.length]);

  const persistDeptos = async (lista) => {
    if (!isAdmin) return;
    if (lista.some(d => !d.id.trim() || !d.label.trim())) { toast_("Todos os departamentos precisam de código e nome.", "red"); return; }
    setSavingDeptos(true);
    try {
      await saveCollection("configuracoes", "catalogo_departamentos", { items: lista });
      await auditLog("Atualizou Catálogo de Departamentos", "configuracoes", "catalogo_departamentos", "Catálogo", null, { total: lista.length });
      toast_("Catálogo de departamentos salvo!", "green");
    } catch(e) { toast_("Erro ao salvar catálogo.", "red"); }
    setSavingDeptos(false);
  };
  const salvarCatDeptos = () => persistDeptos(listaDeptos);

  // Persiste a lista recebida (não a do state, que pode estar desatualizada num mesmo tick).
  const persistTipos = async (lista) => {
    if (!isAdmin) return;
    if (lista.some(t => !t.id.trim() || !t.label.trim())) { toast_("Todos os tipos precisam de código e descrição.", "red"); return; }
    setSavingTipos(true);
    try {
      await saveCollection("configuracoes", "catalogo_tipos_doc", { items: lista });
      await auditLog("Atualizou Catálogo de Tipos de Documento", "configuracoes", "catalogo_tipos_doc", "Catálogo", null, { total: lista.length });
      toast_("Catálogo de tipos de documento salvo!", "green");
    } catch(e) { toast_("Erro ao salvar catálogo.", "red"); }
    setSavingTipos(false);
  };
  const salvarCatTipos = () => persistTipos(listaTipos);

  // Catálogo de tipos de desvio (configuracoes/catalogo_tipos_desvio) — só nome + ativo.
  const persistTiposDesvio = async (lista) => {
    if (!isAdmin) return;
    if (lista.some(t => !t.nome.trim())) { toast_("Todos os tipos de desvio precisam de um nome.", "red"); return; }
    setSavingTd(true);
    try {
      await saveCollection("configuracoes", "catalogo_tipos_desvio", { items: lista });
      await auditLog("Atualizou Catálogo de Tipos de Desvio", "configuracoes", "catalogo_tipos_desvio", "Catálogo", null, { total: lista.length });
      toast_("Catálogo de tipos de desvio salvo!", "green");
    } catch(e) { toast_("Erro ao salvar catálogo.", "red"); }
    setSavingTd(false);
  };

  // Catálogo de setores de desvio (configuracoes/catalogo_setores_desvio) — só nome + ativo.
  const persistSetoresDesvio = async (lista) => {
    if (!isAdmin) return;
    if (lista.some(sx => !sx.nome.trim())) { toast_("Todos os setores precisam de um nome.", "red"); return; }
    setSavingSd(true);
    try {
      await saveCollection("configuracoes", "catalogo_setores_desvio", { items: lista });
      await auditLog("Atualizou Catálogo de Setores de Desvio", "configuracoes", "catalogo_setores_desvio", "Catálogo", null, { total: lista.length });
      toast_("Catálogo de setores de desvio salvo!", "green");
    } catch(e) { toast_("Erro ao salvar catálogo.", "red"); }
    setSavingSd(false);
  };

  const [nu, setNu] = useState({ name:"", email:"", pw:"Herbamed@2025", role:"user", setor:"", crf:"", cargo:"" });
  const [nuPermissoes, setNuPermissoes] = useState({ ...PERMS_PADRAO["user"] });
  const [editing, setEditing] = useState(null);
  const [editData, setEditData] = useState({});
  const [editPerms, setEditPerms] = useState({});
  const set = (k,v) => setNu(p=>({...p,[k]:v}));
  const setRole = (role) => { set("role", role); setNuPermissoes({ ...PERMS_PADRAO[role] }); };
  const togglePerm = (key) => setNuPermissoes(p => ({ ...p, [key]: !p[key] }));
  const toggleEditPerm = (key) => setEditPerms(p => ({ ...p, [key]: !p[key] }));

  const addUser = async () => {
    if(!nu.name||!nu.email||!nu.pw) { alert("Nome, e-mail e senha são obrigatórios."); return; }
    if(users.find(u=>u.email===nu.email)) { alert("E-mail já cadastrado."); return; }
    try {
      const cred = await createAuthUser(nu.email, nu.pw);
      const userData = { name:nu.name, email:nu.email, role:nu.role, setor:nu.setor, crf:nu.crf||"", cargo:nu.cargo||"", permissoes:nuPermissoes };
      const savedUser = await saveUser(cred.user.uid, userData);
      await auditLog("Criou Usuário", "usuarios", cred.user.uid, `${userData.name} (${userData.email})`, null, { name: userData.name, email: userData.email, role: userData.role, setor: userData.setor });
      setUsers([...users, savedUser]);
      setNu({ name:"", email:"", pw:"Herbamed@2025", role:"user", setor:"", crf:"", cargo:"" });
      setNuPermissoes({ ...PERMS_PADRAO["user"] });
      toast_("Usuário criado com sucesso!", "green");
    } catch(e) { toast_("Erro: "+e.message, "red"); }
  };

  const startEdit = (u) => {
    setEditing(u.id);
    setEditData({ name:u.name, setor:u.setor||"", role:u.role, crf:u.crf||"", cargo:u.cargo||"" });
    // Merge: default do perfil + perms armazenadas (as armazenadas prevalecem)
    setEditPerms({ ...(PERMS_PADRAO[u.role]||{}), ...(u.permissoes||{}) });
  };

  const saveEdit = async (uid) => {
    try {
    const data = { ...editData, permissoes: editPerms };
    const antesU = users.find(u => u.id === uid);
    await updateUser(uid, data);
    await auditLog("Editou Usuário", "usuarios", uid, `${data.name || antesU?.name} (${antesU?.email || uid})`, antesU ? { name: antesU.name, role: antesU.role, setor: antesU.setor } : null, { name: data.name, role: data.role, setor: data.setor });
    setUsers(users.map(u=>u.id===uid?{...u,...data}:u));
    setEditing(null);
    toast_("Usuário atualizado!", "green");
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const delUser = async (uid) => {
    if(uid===currentUser.uid) { alert("Você não pode excluir seu próprio usuário."); return; }
    if(!confirm("Remover este usuário do sistema?")) return;
    const antesD = users.find(u => u.id === uid);
    await auditLog("Excluiu Usuário", "usuarios", uid, antesD ? `${antesD.name} (${antesD.email})` : uid, antesD, null);
    await fbDeleteUser(uid);
    setUsers(users.filter(u=>u.id!==uid));
    toast_("Usuário removido.", "red");
  };

  const resetSenha = async (uid, nome) => {
    if(!confirm(`Resetar senha de "${nome}" para Herba@123?\nO usuário precisará trocar no próximo login.`)) return;
    try {
      await adminResetPassword(uid);
      await auditLog("Reset de Senha", "usuarios", uid, nome, null, { senhaTemporaria: true });
      toast_(`Senha de ${nome} resetada para Herba@123.`, "green");
    } catch(e) { toast_("Erro ao resetar senha: " + e.message, "red"); }
  };

  const {paginated:_usrs,page:_pgU,total:_totU,setPage:_setPgU} = usePagination(users||[], 20);
  return (
    <div>
      {/* ── Abas principais ── */}
      <div style={{ display:"flex", gap:6, marginBottom:16 }}>
        {[["usuarios","👥 Usuários"],["config","⚙️ Configurações"],["catalogos","🗂️ Catálogos"]].map(([k,l])=>(
          <button key={k} onClick={()=>setAbaAdmin(k)}
            style={{ padding:"8px 18px", borderRadius:8, border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:600,
              background:abaAdmin===k?T.accent:T.surf, color:abaAdmin===k?"#fff":T.text2, transition:"all .15s" }}>
            {l}
          </button>
        ))}
      </div>

      {abaAdmin==="usuarios" && (<>
      <div style={s.card}>
        <SecTitle icon="👥" ch={`Usuários do sistema (${users.length})`} />
        {_usrs.map(u=>(
          <div key={u.id} style={{ background:T.surf, border:`1px solid ${T.border}`, borderRadius:10, marginBottom:10, overflow:"hidden" }}>
            {editing===u.id ? (
              <div style={{ padding:"1rem" }}>
                <G3 ch={<>
                  <F lbl="Nome" ch={<Inp value={editData.name} onChange={e=>setEditData(p=>({...p,name:e.target.value}))} />} />
                  <F lbl="Setor" ch={<Inp value={editData.setor} onChange={e=>setEditData(p=>({...p,setor:e.target.value}))} />} />
                  <F lbl="Registro profissional (CRF/CRQ/CREA...)" ch={<Inp placeholder="Ex: CRQ-IV 12345" value={editData.crf||""} onChange={e=>setEditData(p=>({...p,crf:e.target.value}))} />} />
                  <F lbl="Cargo" ch={<Inp placeholder="Ex: Analista de Controle de Qualidade" value={editData.cargo||""} onChange={e=>setEditData(p=>({...p,cargo:e.target.value}))} />} />
                  <F lbl="Perfil" ch={<Sel value={editData.role} onChange={e=>setEditData(p=>({...p,role:e.target.value}))}>
                    <option value="admin">Admin — acesso total</option>
                    <option value="user">Usuário — cria e edita suas RNCs</option>
                    <option value="viewer">Visualizador — apenas leitura</option>
                    <option value="keyuser">Key User — edita qualquer RNC</option>
                    <option value="rt">RT — Responsável Técnico</option>
                    <option value="exec">Executivo — Dashboard gerencial</option>
                  </Sel>} />
                </>} />

                {/* Permissões do usuário editado — editáveis por admin */}
                <div style={{ marginTop:14, marginBottom:10 }}>
                  <div style={{ fontSize:11, color:T.text3, fontWeight:600, textTransform:"uppercase", letterSpacing:".06em", marginBottom:8 }}>Permissões</div>
                  {PERMS_GRUPOS.map(grupo => (
                    <div key={grupo.grupo} style={{ marginBottom:10 }}>
                      <div style={{ fontSize:10, fontWeight:700, color:T.accent, textTransform:"uppercase", letterSpacing:".06em", marginBottom:4 }}>{grupo.grupo}</div>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:3 }}>
                        {grupo.items.map(item => (
                          <label key={item.key} style={{ display:"flex", alignItems:"center", gap:7, padding:"5px 9px", background:editPerms[item.key]?T.accentDim:T.surf, border:`1px solid ${editPerms[item.key]?T.accent+"44":T.border}`, borderRadius:6, cursor:"pointer", transition:"all .15s" }}>
                            <input type="checkbox" checked={!!editPerms[item.key]} onChange={()=>toggleEditPerm(item.key)} style={{ accentColor:T.accent, width:13, height:13, flexShrink:0 }}/>
                            <span style={{ fontSize:11, color:editPerms[item.key]?T.accent:T.text2, userSelect:"none" }}>{item.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
                  <button style={s.btn} onClick={()=>setEditing(null)}>Cancelar</button>
                  <button style={s.btnA} onClick={()=>saveEdit(u.id)}>Salvar alterações</button>
                </div>
              </div>
            ) : (
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 16px" }}>
                <div style={{ display:"flex", gap:14, alignItems:"center" }}>
                  <div style={{ width:40, height:40, borderRadius:"50%", background:u.role==="admin"?`linear-gradient(135deg,${T.accent},${T.accent2})`:T.border, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:700, color:u.role==="admin"?"#fff":T.text2, flexShrink:0 }}>{(u.name||u.email)?.[0]?.toUpperCase()||"?"}</div>
                  <div>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{u.name||u.email||"(sem nome)"}</div>
                      {u.assinatura && <span style={{ fontSize:10, color:T.accent, background:T.accentDim, padding:"1px 8px", borderRadius:20 }}>✓ Assinatura</span>}

                      {(() => {
                        const agora = Date.now();
                        const ultimo = u.ultimoAcesso ? new Date(u.ultimoAcesso).getTime() : null;
                        const diffMin = ultimo ? Math.floor((agora - ultimo) / 60000) : null;
                        const online = u.online && diffMin !== null && diffMin < 5;
                        const cor = online ? "#2ab84a" : diffMin !== null && diffMin < 60 ? "#ffd166" : "#888";
                        const bg  = online ? "#2ab84a18" : diffMin !== null && diffMin < 60 ? "#ffd16618" : "#88888818";
                        const dot = online ? "🟢" : diffMin !== null && diffMin < 60 ? "🟡" : "⚫";
                        const label = online ? "Online agora"
                          : diffMin === null ? "Nunca acessou"
                          : diffMin < 60 ? `Há ${diffMin} min`
                          : diffMin < 1440 ? `Há ${Math.floor(diffMin/60)}h`
                          : `Há ${Math.floor(diffMin/1440)}d`;
                        return (
                          <span style={{ fontSize:10, padding:"2px 8px", borderRadius:12, background:bg, color:cor, fontWeight:600, display:"inline-flex", alignItems:"center", gap:3, whiteSpace:"nowrap" }}>
                            {dot} {label}
                          </span>
                        );
                      })()}
                    </div>
                    <div style={{ fontSize:11, color:T.text2 }}>{u.email} · {u.setor||"—"}</div>
                  </div>
                </div>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <span style={{ display:"inline-flex", padding:"3px 10px", borderRadius:20, fontSize:10, fontWeight:700, background:u.role==="admin"?T.accentDim:u.role==="viewer"?"#4fc3f718":u.role==="rt"?"#ff980018":u.role==="keyuser"?"#9c27b018":T.border, color:u.role==="admin"?T.accent:u.role==="viewer"?"#4fc3f7":u.role==="rt"?"#ff9800":u.role==="keyuser"?"#9c27b0":T.text2 }}>
                    {u.role==="admin"?"Admin":u.role==="viewer"?"👁️ Visualizador":u.role==="rt"?"🔬 RT":u.role==="keyuser"?"⭐ Key User":"Usuário"}
                  </span>
                  <button style={{ ...s.btn, padding:"6px 12px", fontSize:11 }} onClick={()=>startEdit(u)}><span className="btn-emoji">✏️ </span>Editar</button>
                  {u.id!==currentUser.uid && <button style={{ ...s.btn, padding:"6px 12px", fontSize:11 }} onClick={()=>resetSenha(u.id, u.name||u.email)} title="Resetar senha para Herba@123">🔄 Resetar senha</button>}
                  {u.id!==currentUser.uid && <button style={{ ...s.btnD, padding:"6px 12px", fontSize:11 }} onClick={()=>delUser(u.id)}>🗑️ Remover</button>}
                </div>
              </div>
            )}
          </div>
        ))}
        <Pagination page={_pgU} total={_totU} setPage={_setPgU}/>
      </div>

      <div style={s.card}>
        <SecTitle icon="➕" ch="Adicionar novo usuário" />
        <div style={{ background:T.accentDim, border:`1px solid ${T.accent}25`, borderRadius:8, padding:"10px 14px", marginBottom:"1rem", fontSize:12, color:T.accent }}>
          💡 O usuário receberá acesso ao sistema com e-mail e senha definidos abaixo. Recomende trocar a senha no primeiro acesso.
        </div>
        <G2 ch={<>
          <F lbl="Nome completo" ch={<Inp placeholder="Ex: Ana Lima" value={nu.name} onChange={e=>set("name",e.target.value)} />} />
          <F lbl="E-mail" ch={<Inp type="email" placeholder="ana@herbamed.com" value={nu.email} onChange={e=>set("email",e.target.value)} />} />
          <F lbl="Senha inicial" ch={<Inp value={nu.pw} onChange={e=>set("pw",e.target.value)} />} />
          <F lbl="Setor" ch={<Inp placeholder="Ex: Produção" value={nu.setor} onChange={e=>set("setor",e.target.value)} />} />
          <F lbl="Registro profissional (CRF/CRQ/CREA...)" ch={<Inp placeholder="Ex: CRQ-IV 12345" value={nu.crf} onChange={e=>set("crf",e.target.value)} />} />
          <F lbl="Cargo" ch={<Inp placeholder="Ex: Analista de Controle de Qualidade" value={nu.cargo} onChange={e=>set("cargo",e.target.value)} />} />
          <F lbl="Perfil de acesso" tip="Selecione o perfil base — as permissões abaixo serão preenchidas automaticamente. Você pode ajustar individualmente." ch={<Sel value={nu.role} onChange={e=>setRole(e.target.value)}>
            <option value="user">Usuário — cria e edita suas RNCs</option>
            <option value="admin">Admin — acesso total</option>
            <option value="viewer">Visualizador — apenas leitura</option>
            <option value="keyuser">Key User — edita qualquer RNC</option>
            <option value="rt">RT — Responsável Técnico</option>
            <option value="exec">Executivo — Dashboard gerencial</option>
          </Sel>} />
        </>} />

        {/* Checklist de permissões */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, color:T.text3, fontWeight:600, textTransform:"uppercase", letterSpacing:".06em", marginBottom:8 }}>
            Permissões customizadas
          </div>
          <div style={{ fontSize:11, color:T.text2, marginBottom:10, padding:"8px 12px", background:T.accentDim, border:`1px solid ${T.accent}25`, borderRadius:8 }}>
            💡 Preenchido automaticamente pelo perfil selecionado. Ajuste individualmente se necessário. Usuários existentes não são afetados.
          </div>
          {PERMS_GRUPOS.map(grupo => (
            <div key={grupo.grupo} style={{ marginBottom:12 }}>
              <div style={{ fontSize:10, fontWeight:700, color:T.accent, textTransform:"uppercase", letterSpacing:".06em", marginBottom:6 }}>{grupo.grupo}</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:4 }}>
                {grupo.items.map(item => (
                  <label key={item.key} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 10px", background:nuPermissoes[item.key]?T.accentDim:T.surf, border:`1px solid ${nuPermissoes[item.key]?T.accent+"44":T.border}`, borderRadius:6, cursor:"pointer", transition:"all .15s" }}>
                    <input type="checkbox" checked={!!nuPermissoes[item.key]} onChange={()=>togglePerm(item.key)} style={{ accentColor:T.accent, width:14, height:14, flexShrink:0 }}/>
                    <span style={{ fontSize:11, color:nuPermissoes[item.key]?T.accent:T.text2, userSelect:"none" }}>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign:"right", marginTop:6 }}>
          <button style={s.btnA} onClick={addUser}>Criar usuário ✓</button>
        </div>
      </div>
      </>)}

      {abaAdmin==="config" && (<>
      <div style={s.card}>
        <SecTitle icon="⚙️" ch="Configurações da Qualidade" />
        <div style={{ display:"flex", alignItems:"center", gap:14, padding:"12px 14px", background:T.surf, border:`1px solid ${T.border}`, borderRadius:10 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:600, color:T.text }}>Exigir que o aprovador da disposição seja diferente do analista que executou</div>
            <div style={{ fontSize:11, color:T.text3, marginTop:3 }}>Aplica-se apenas às análises de Controle de Qualidade (CQ). A segregação de funções dos documentos continua sempre exigida.</div>
          </div>
          <button
            onClick={toggleAprovadorDif}
            disabled={!isAdmin}
            title={config?.aprovadorDiferenteAnalista ? "Clique para desativar" : "Clique para ativar"}
            style={{ flexShrink:0, width:52, height:28, borderRadius:20, border:"none", cursor:isAdmin?"pointer":"not-allowed", background:config?.aprovadorDiferenteAnalista?T.accent:T.border, position:"relative", transition:"background .2s", padding:0 }}>
            <span style={{ position:"absolute", top:3, left:config?.aprovadorDiferenteAnalista?27:3, width:22, height:22, borderRadius:"50%", background:"#fff", transition:"left .2s", boxShadow:"0 1px 3px rgba(0,0,0,.3)" }} />
          </button>
          <span style={{ flexShrink:0, fontSize:12, fontWeight:700, color:config?.aprovadorDiferenteAnalista?T.accent:T.text3, minWidth:64, textAlign:"left" }}>
            {config?.aprovadorDiferenteAnalista ? "Ativado" : "Desativado"}
          </span>
        </div>

        <div style={{ marginTop:18 }}>
          <div style={{ fontSize:13, fontWeight:700, color:T.text, marginBottom:3 }}>Prazo de Revisão por Tipo de Documento</div>
          <div style={{ fontSize:11, color:T.text3, marginBottom:12 }}>Prazo padrão de revisão periódica (em anos) aplicado ao calcular a próxima revisão de novos documentos e de novas revisões.</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:10 }}>
            {TIPOS_DOC_GD.map(t => (
              <div key={t.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", background:T.surf, border:`1px solid ${T.border}`, borderRadius:10 }}>
                <span style={{ fontSize:18 }}>{t.icon}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:T.text }}>{t.id}</div>
                  <div style={{ fontSize:10, color:T.text3, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{t.label}</div>
                </div>
                <input type="number" min="1" step="1" value={prazos[t.id] ?? ""} disabled={!isAdmin}
                  onChange={e=>setPrazos(p=>({ ...p, [t.id]: e.target.value }))}
                  style={{ width:54, padding:"6px 8px", borderRadius:8, border:`1px solid ${T.border}`, background:T.card, color:T.text, fontSize:13, textAlign:"center" }} />
                <span style={{ fontSize:11, color:T.text3 }}>anos</span>
              </div>
            ))}
          </div>
          <button onClick={salvarPrazosRevisao} disabled={!isAdmin||savingPrazos}
            style={{ ...s.btnA, marginTop:12, opacity:(!isAdmin||savingPrazos)?0.6:1, cursor:(!isAdmin||savingPrazos)?"not-allowed":"pointer" }}>
            {savingPrazos ? "Salvando..." : "💾 Salvar prazos de revisão"}
          </button>
        </div>
      </div>
      </>)}

      {abaAdmin==="catalogos" && (<>
      {/* ── CATÁLOGOS DE DOCUMENTOS ── */}
      <div style={s.card}>
        <SecTitle icon="🗂️" ch="Catálogos" />
        {/* Tabs */}
        <div style={{ display:"flex", gap:6, marginBottom:16, flexWrap:"wrap" }}>
          {[["deptos","🏛️ Departamentos"],["tipos","📄 Tipos de Documento"],["desvios","⚠️ Tipos de Desvio"],["setores","🏭 Setores de Desvio"]].map(([k,l])=>(
            <button key={k} onClick={()=>setCatAba(k)}
              style={{ padding:"6px 16px", borderRadius:8, border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:600,
                background:catAba===k?T.accent:T.surf, color:catAba===k?"#fff":T.text2, transition:"all .15s" }}>
              {l}
            </button>
          ))}
        </div>

        {/* ── ABA DEPARTAMENTOS ── */}
        {catAba==="deptos" && (<>
          <div style={{ fontSize:11, color:T.text3, marginBottom:10 }}>
            Código (máx 5 letras maiúsculas) + nome completo. Apenas departamentos ativos aparecem nos formulários. As alterações são salvas automaticamente.
          </div>
          {/* Adicionar novo */}
          <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
            <input placeholder="Código (ex: SGQ)" maxLength={5} value={novoDepto.id}
              onChange={e=>setNovoDepto(p=>({...p,id:e.target.value.toUpperCase()}))}
              style={{ ...s.inp, width:90, fontSize:12 }} />
            <input placeholder="Nome completo" value={novoDepto.label}
              onChange={e=>setNovoDepto(p=>({...p,label:e.target.value}))}
              style={{ ...s.inp, flex:1, fontSize:12 }} />
            <button style={s.btnA} onClick={()=>{
              if (!novoDepto.id.trim() || !novoDepto.label.trim()) return;
              if (listaDeptos.find(d=>d.id===novoDepto.id)) { toast_("Código já existe.", "red"); return; }
              const next = [...listaDeptos, { id:novoDepto.id.trim(), label:novoDepto.label.trim(), ativo:true }];
              setListaDeptos(next);
              setNovoDepto({ id:"", label:"" });
              persistDeptos(next);
            }}>+ Adicionar</button>
          </div>
          {/* Lista */}
          <div style={{ display:"flex", flexDirection:"column", gap:4, maxHeight:380, overflowY:"auto" }}>
            {listaDeptos.map((d, i)=>(
              <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 10px", background:T.surf, border:`1px solid ${T.border}`, borderRadius:8 }}>
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
                  <span style={{ flex:1, fontSize:12, color:T.text }}>{d.label}</span>
                  <span style={{ fontSize:10, padding:"2px 8px", borderRadius:12, background:d.ativo?T.accent+"22":"#ff4f6a22", color:d.ativo?T.accent:"#ff4f6a", fontWeight:700 }}>
                    {d.ativo?"Ativo":"Inativo"}
                  </span>
                  <button style={{ ...s.btn, fontSize:11, padding:"4px 10px" }} onClick={()=>{ setEditDeptoIdx(i); setEditDeptoData({ id:d.id, label:d.label }); }}>✏️</button>
                  <button style={{ ...s.btn, fontSize:11, padding:"4px 10px" }} onClick={()=>{ const next=listaDeptos.map((x,j)=>j===i?{...x,ativo:!x.ativo}:x); setListaDeptos(next); persistDeptos(next); }}>
                    {d.ativo?"🔒 Desativar":"🔓 Ativar"}
                  </button>
                  <button style={{ ...s.btn, fontSize:11, padding:"4px 10px", color:"#ff4f6a" }}
                    title="Excluir departamento do catálogo"
                    onClick={()=>{ if(confirm(`Excluir o departamento "${d.id} — ${d.label}" do catálogo?\n\nDocumentos já criados com este departamento não são afetados, mas perdem o rótulo amigável. Prefira desativar se já foi usado.`)) { const next=listaDeptos.filter((_,j)=>j!==i); setListaDeptos(next); persistDeptos(next); } }}>🗑️</button>
                </>)}
              </div>
            ))}
          </div>
          <div style={{ textAlign:"right", marginTop:12 }}>
            <button style={{ ...s.btnA, opacity:(!isAdmin||savingDeptos)?0.6:1 }} disabled={!isAdmin||savingDeptos} onClick={salvarCatDeptos}>
              {savingDeptos?"Salvando...":"💾 Salvar departamentos"}
            </button>
          </div>
        </>)}

        {/* ── ABA TIPOS DE DOCUMENTO ── */}
        {catAba==="tipos" && (<>
          <div style={{ fontSize:11, color:T.text3, marginBottom:10 }}>
            Código (ex: PO, IT), descrição e prazo de revisão em anos. Apenas tipos ativos aparecem nos formulários. As alterações são salvas automaticamente.
            <br/><strong>Modelo Formulário</strong> (sem capa + sem marca d'água): para documentos impressos/xerocados, como formulários que acompanham OPs.
          </div>
          {/* Adicionar novo */}
          <div style={{ display:"flex", gap:8, marginBottom:6, flexWrap:"wrap", alignItems:"center" }}>
            <input placeholder="Código (ex: POP)" maxLength={6} value={novoTipo.id}
              onChange={e=>setNovoTipo(p=>({...p,id:e.target.value.toUpperCase()}))}
              style={{ ...s.inp, width:90, fontSize:12 }} />
            <input placeholder="Descrição" value={novoTipo.label}
              onChange={e=>setNovoTipo(p=>({...p,label:e.target.value}))}
              style={{ ...s.inp, flex:1, fontSize:12 }} />
            <input type="number" min="1" step="1" placeholder="Prazo (anos)" value={novoTipo.prazoRevisaoAnos}
              onChange={e=>setNovoTipo(p=>({...p,prazoRevisaoAnos:e.target.value}))}
              style={{ ...s.inp, width:80, fontSize:12 }} />
            <button style={s.btnA} onClick={()=>{
              if (!novoTipo.id.trim() || !novoTipo.label.trim()) return;
              if (listaTipos.find(t=>t.id===novoTipo.id)) { toast_("Código já existe.", "red"); return; }
              const prazo = Number(novoTipo.prazoRevisaoAnos);
              const next = [...listaTipos, { id:novoTipo.id.trim(), label:novoTipo.label.trim(), prazoRevisaoAnos:Number.isFinite(prazo)&&prazo>0?prazo:2, semCapa:!!novoTipo.semCapa, semMarcaDagua:!!novoTipo.semMarcaDagua, ativo:true }];
              setListaTipos(next);
              setNovoTipo({ id:"", label:"", prazoRevisaoAnos:"2", semCapa:false, semMarcaDagua:false });
              persistTipos(next);
            }}>+ Adicionar</button>
          </div>
          {/* Flags do modelo */}
          <div style={{ display:"flex", gap:16, marginBottom:14, flexWrap:"wrap", alignItems:"center", paddingLeft:2 }}>
            <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:T.text2, cursor:"pointer" }}>
              <input type="checkbox" checked={!!novoTipo.semCapa} onChange={e=>setNovoTipo(p=>({...p,semCapa:e.target.checked}))} style={{ width:15, height:15, accentColor:T.accent }} />
              Sem capa
            </label>
            <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:T.text2, cursor:"pointer" }}>
              <input type="checkbox" checked={!!novoTipo.semMarcaDagua} onChange={e=>setNovoTipo(p=>({...p,semMarcaDagua:e.target.checked}))} style={{ width:15, height:15, accentColor:T.accent }} />
              Sem marca d'água
            </label>
          </div>
          {/* Lista */}
          <div style={{ display:"flex", flexDirection:"column", gap:4, maxHeight:380, overflowY:"auto" }}>
            {listaTipos.map((t, i)=>(
              <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 10px", background:T.surf, border:`1px solid ${T.border}`, borderRadius:8 }}>
                {editTipoIdx===i ? (<>
                  <input value={editTipoData.id} maxLength={6}
                    onChange={e=>setEditTipoData(p=>({...p,id:e.target.value.toUpperCase()}))}
                    style={{ ...s.inp, width:80, fontSize:12 }} />
                  <input value={editTipoData.label}
                    onChange={e=>setEditTipoData(p=>({...p,label:e.target.value}))}
                    style={{ ...s.inp, flex:1, fontSize:12 }} />
                  <input type="number" min="1" step="1" value={editTipoData.prazoRevisaoAnos}
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
                    const next = listaTipos.map((x,j)=>j===i?{ ...x, id:editTipoData.id.trim(), label:editTipoData.label.trim(), prazoRevisaoAnos:Number.isFinite(prazo)&&prazo>0?prazo:2, semCapa:!!editTipoData.semCapa, semMarcaDagua:!!editTipoData.semMarcaDagua }:x);
                    setListaTipos(next);
                    setEditTipoIdx(null);
                    persistTipos(next);
                  }}>✓</button>
                  <button style={s.btn} onClick={()=>setEditTipoIdx(null)}>✕</button>
                </>) : (<>
                  <span style={{ fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:6, background:T.accentDim, color:T.accent, minWidth:44, textAlign:"center" }}>{t.id}</span>
                  <span style={{ flex:1, fontSize:12, color:T.text }}>{t.label}</span>
                  {(t.semCapa || t.semMarcaDagua) && (
                    <span style={{ fontSize:10, padding:"2px 8px", borderRadius:12, background:"#a78bfa22", color:"#a78bfa", fontWeight:700 }}
                      title={`${t.semCapa?"sem capa":""}${t.semCapa&&t.semMarcaDagua?" + ":""}${t.semMarcaDagua?"sem marca d'água":""}`}>
                      📝 Formulário
                    </span>
                  )}
                  <span style={{ fontSize:11, color:T.text3 }}>{t.prazoRevisaoAnos ?? 2} anos</span>
                  <span style={{ fontSize:10, padding:"2px 8px", borderRadius:12, background:t.ativo?T.accent+"22":"#ff4f6a22", color:t.ativo?T.accent:"#ff4f6a", fontWeight:700 }}>
                    {t.ativo?"Ativo":"Inativo"}
                  </span>
                  <button style={{ ...s.btn, fontSize:11, padding:"4px 10px" }} onClick={()=>{ setEditTipoIdx(i); setEditTipoData({ id:t.id, label:t.label, prazoRevisaoAnos:String(t.prazoRevisaoAnos??2), semCapa:!!t.semCapa, semMarcaDagua:!!t.semMarcaDagua }); }}>✏️</button>
                  <button style={{ ...s.btn, fontSize:11, padding:"4px 10px" }} onClick={()=>{ const next=listaTipos.map((x,j)=>j===i?{...x,ativo:!x.ativo}:x); setListaTipos(next); persistTipos(next); }}>
                    {t.ativo?"🔒 Desativar":"🔓 Ativar"}
                  </button>
                  <button style={{ ...s.btn, fontSize:11, padding:"4px 10px", color:"#ff4f6a" }}
                    title="Excluir tipo do catálogo"
                    onClick={()=>{ if(confirm(`Excluir o tipo "${t.id} — ${t.label}" do catálogo?\n\nDocumentos já criados com este tipo não são afetados, mas perdem o rótulo amigável. Prefira desativar se o tipo já foi usado.`)) { const next=listaTipos.filter((_,j)=>j!==i); setListaTipos(next); persistTipos(next); } }}>🗑️</button>
                </>)}
              </div>
            ))}
          </div>
          <div style={{ textAlign:"right", marginTop:12 }}>
            <button style={{ ...s.btnA, opacity:(!isAdmin||savingTipos)?0.6:1 }} disabled={!isAdmin||savingTipos} onClick={salvarCatTipos}>
              {savingTipos?"Salvando...":"💾 Salvar tipos de documento"}
            </button>
          </div>
        </>)}

        {/* ── ABA TIPOS DE DESVIO ── */}
        {catAba==="desvios" && (<>
          <div style={{ fontSize:11, color:T.text3, marginBottom:10 }}>
            Nomes dos tipos usados ao registrar um desvio (ex: BPF, Processo, Equipamento). Manter uma lista fechada evita
            que o mesmo tipo apareça com grafias diferentes e distorça o Pareto e a matriz Setor × Tipo dos indicadores.
            Apenas tipos ativos aparecem no formulário. <strong>Outros</strong> continua sempre disponível como texto livre.
            As alterações são salvas automaticamente.
          </div>
          {/* Adicionar novo */}
          <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
            <input placeholder="Nome do tipo (ex: Limpeza)" value={novoTd}
              onChange={e=>setNovoTd(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter") document.getElementById("td-add-btn")?.click(); }}
              style={{ ...s.inp, flex:1, fontSize:12 }} />
            <button id="td-add-btn" style={s.btnA} onClick={()=>{
              const nome = novoTd.trim();
              if (!nome) return;
              if (listaTiposDesvio.some(t=>t.nome.toLowerCase()===nome.toLowerCase())) { toast_("Esse tipo já existe.", "red"); return; }
              const next = [...listaTiposDesvio, { nome, ativo:true }];
              setListaTiposDesvio(next);
              setNovoTd("");
              persistTiposDesvio(next);
            }}>+ Adicionar</button>
          </div>
          {/* Lista */}
          <div style={{ display:"flex", flexDirection:"column", gap:4, maxHeight:380, overflowY:"auto" }}>
            {listaTiposDesvio.map((t, i)=>(
              <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 10px", background:T.surf, border:`1px solid ${T.border}`, borderRadius:8 }}>
                {editTdIdx===i ? (<>
                  <input value={editTdNome} autoFocus
                    onChange={e=>setEditTdNome(e.target.value)}
                    style={{ ...s.inp, flex:1, fontSize:12 }} />
                  <button style={s.btnA} onClick={()=>{
                    const nome = editTdNome.trim();
                    if (!nome) return;
                    if (listaTiposDesvio.some((x,j)=>j!==i && x.nome.toLowerCase()===nome.toLowerCase())) { toast_("Esse tipo já existe.", "red"); return; }
                    const next = listaTiposDesvio.map((x,j)=>j===i?{ ...x, nome }:x);
                    setListaTiposDesvio(next);
                    setEditTdIdx(null);
                    persistTiposDesvio(next);
                  }}>✓</button>
                  <button style={s.btn} onClick={()=>setEditTdIdx(null)}>✕</button>
                </>) : (<>
                  <span style={{ flex:1, fontSize:12, color:T.text }}>{t.nome}</span>
                  <span style={{ fontSize:10, padding:"2px 8px", borderRadius:12, background:t.ativo?T.accent+"22":"#ff4f6a22", color:t.ativo?T.accent:"#ff4f6a", fontWeight:700 }}>
                    {t.ativo?"Ativo":"Inativo"}
                  </span>
                  {t.nome!=="Outros" && (
                    <button style={{ ...s.btn, fontSize:11, padding:"4px 10px" }} onClick={()=>{ setEditTdIdx(i); setEditTdNome(t.nome); }}>✏️</button>
                  )}
                  {t.nome!=="Outros" && (
                    <button style={{ ...s.btn, fontSize:11, padding:"4px 10px" }} onClick={()=>{ const next=listaTiposDesvio.map((x,j)=>j===i?{...x,ativo:!x.ativo}:x); setListaTiposDesvio(next); persistTiposDesvio(next); }}>
                      {t.ativo?"🔒 Desativar":"🔓 Ativar"}
                    </button>
                  )}
                  {t.nome!=="Outros" && (
                    <button style={{ ...s.btn, fontSize:11, padding:"4px 10px", color:"#ff4f6a" }}
                      title="Excluir tipo de desvio do catálogo"
                      onClick={()=>{ if(confirm(`Excluir o tipo de desvio "${t.nome}" do catálogo?\n\nDesvios já registrados com este tipo não são afetados. Prefira desativar se o tipo já foi usado.`)) { const next=listaTiposDesvio.filter((_,j)=>j!==i); setListaTiposDesvio(next); persistTiposDesvio(next); } }}>🗑️</button>
                  )}
                  {t.nome==="Outros" && (
                    <span style={{ fontSize:10, color:T.text3, fontStyle:"italic" }}>sempre disponível</span>
                  )}
                </>)}
              </div>
            ))}
          </div>
          <div style={{ textAlign:"right", marginTop:12 }}>
            <button style={{ ...s.btnA, opacity:(!isAdmin||savingTd)?0.6:1 }} disabled={!isAdmin||savingTd} onClick={()=>persistTiposDesvio(listaTiposDesvio)}>
              {savingTd?"Salvando...":"💾 Salvar tipos de desvio"}
            </button>
          </div>
        </>)}

        {/* ── ABA SETORES DE DESVIO ── */}
        {catAba==="setores" && (<>
          <div style={{ fontSize:11, color:T.text3, marginBottom:10 }}>
            Setores/áreas do chão de fábrica usados ao registrar um desvio (ex: Mistura 1, Compressão, Envase 3).
            Manter uma lista fechada evita que o mesmo setor apareça com grafias diferentes e distorça os gráficos
            "Desvios por Setor" e a matriz Setor × Tipo dos indicadores. Apenas setores ativos aparecem no formulário.
            <strong>Outros</strong> continua sempre disponível como texto livre. As alterações são salvas automaticamente.
          </div>
          {/* Adicionar novo */}
          <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
            <input placeholder="Nome do setor (ex: Rotulagem)" value={novoSd}
              onChange={e=>setNovoSd(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter") document.getElementById("sd-add-btn")?.click(); }}
              style={{ ...s.inp, flex:1, fontSize:12 }} />
            <button id="sd-add-btn" style={s.btnA} onClick={()=>{
              const nome = novoSd.trim();
              if (!nome) return;
              if (listaSetoresDesvio.some(sx=>sx.nome.toLowerCase()===nome.toLowerCase())) { toast_("Esse setor já existe.", "red"); return; }
              const next = [...listaSetoresDesvio, { nome, ativo:true }];
              setListaSetoresDesvio(next);
              setNovoSd("");
              persistSetoresDesvio(next);
            }}>+ Adicionar</button>
          </div>
          {/* Lista */}
          <div style={{ display:"flex", flexDirection:"column", gap:4, maxHeight:380, overflowY:"auto" }}>
            {listaSetoresDesvio.map((sx, i)=>(
              <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 10px", background:T.surf, border:`1px solid ${T.border}`, borderRadius:8 }}>
                {editSdIdx===i ? (<>
                  <input value={editSdNome} autoFocus
                    onChange={e=>setEditSdNome(e.target.value)}
                    style={{ ...s.inp, flex:1, fontSize:12 }} />
                  <button style={s.btnA} onClick={()=>{
                    const nome = editSdNome.trim();
                    if (!nome) return;
                    if (listaSetoresDesvio.some((x,j)=>j!==i && x.nome.toLowerCase()===nome.toLowerCase())) { toast_("Esse setor já existe.", "red"); return; }
                    const next = listaSetoresDesvio.map((x,j)=>j===i?{ ...x, nome }:x);
                    setListaSetoresDesvio(next);
                    setEditSdIdx(null);
                    persistSetoresDesvio(next);
                  }}>✓</button>
                  <button style={s.btn} onClick={()=>setEditSdIdx(null)}>✕</button>
                </>) : (<>
                  <span style={{ flex:1, fontSize:12, color:T.text }}>{sx.nome}</span>
                  <span style={{ fontSize:10, padding:"2px 8px", borderRadius:12, background:sx.ativo?T.accent+"22":"#ff4f6a22", color:sx.ativo?T.accent:"#ff4f6a", fontWeight:700 }}>
                    {sx.ativo?"Ativo":"Inativo"}
                  </span>
                  {sx.nome!=="Outros" && (
                    <button style={{ ...s.btn, fontSize:11, padding:"4px 10px" }} onClick={()=>{ setEditSdIdx(i); setEditSdNome(sx.nome); }}>✏️</button>
                  )}
                  {sx.nome!=="Outros" && (
                    <button style={{ ...s.btn, fontSize:11, padding:"4px 10px" }} onClick={()=>{ const next=listaSetoresDesvio.map((x,j)=>j===i?{...x,ativo:!x.ativo}:x); setListaSetoresDesvio(next); persistSetoresDesvio(next); }}>
                      {sx.ativo?"🔒 Desativar":"🔓 Ativar"}
                    </button>
                  )}
                  {sx.nome!=="Outros" && (
                    <button style={{ ...s.btn, fontSize:11, padding:"4px 10px", color:"#ff4f6a" }}
                      title="Excluir setor do catálogo"
                      onClick={()=>{ if(confirm(`Excluir o setor "${sx.nome}" do catálogo?\n\nDesvios já registrados com este setor não são afetados. Prefira desativar se o setor já foi usado.`)) { const next=listaSetoresDesvio.filter((_,j)=>j!==i); setListaSetoresDesvio(next); persistSetoresDesvio(next); } }}>🗑️</button>
                  )}
                  {sx.nome==="Outros" && (
                    <span style={{ fontSize:10, color:T.text3, fontStyle:"italic" }}>sempre disponível</span>
                  )}
                </>)}
              </div>
            ))}
          </div>
          <div style={{ textAlign:"right", marginTop:12 }}>
            <button style={{ ...s.btnA, opacity:(!isAdmin||savingSd)?0.6:1 }} disabled={!isAdmin||savingSd} onClick={()=>persistSetoresDesvio(listaSetoresDesvio)}>
              {savingSd?"Salvando...":"💾 Salvar setores de desvio"}
            </button>
          </div>
        </>)}
      </div>
      </>)}
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { saveUser, createAuthUser, deleteUser as fbDeleteUser, updateUser, saveCollection } from "../../firebase";
import { useTheme } from "../../core/theme";
import { PERMS_GRUPOS, PERMS_PADRAO } from "../permissions/permissions";
import { useS } from "../../shared/styles";
import { usePagination } from "../../shared/ui";
import { deleteUser } from "../../firebase";
import { F, G2, G3, Inp, Pagination, SecTitle, Sel } from "../../shared/ui";
import { TIPOS_DOC_GD, prazoRevisaoTipo } from "../documentos/GestaoDocumentosTab";

export function AdminTab({ users, setUsers, toast_, currentUser, auditLog, config = {}, tiposRevisao = {} }) {
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
  const [nu, setNu] = useState({ name:"", email:"", pw:"Herbamed@2025", role:"user", setor:"", crf:"", cargo:"" });
  const [nuPermissoes, setNuPermissoes] = useState({ ...PERMS_PADRAO["user"] });
  const [editing, setEditing] = useState(null);
  const [editData, setEditData] = useState({});
  const set = (k,v) => setNu(p=>({...p,[k]:v}));
  const setRole = (role) => { set("role", role); setNuPermissoes({ ...PERMS_PADRAO[role] }); };
  const togglePerm = (key) => setNuPermissoes(p => ({ ...p, [key]: !p[key] }));

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
  };

  const saveEdit = async (uid) => {
    try {
    const data = { ...editData };
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

  const {paginated:_usrs,page:_pgU,total:_totU,setPage:_setPgU} = usePagination(users||[], 20);
  return (
    <div>
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
    </div>
  );
}

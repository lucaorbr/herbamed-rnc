import React, { useState, useEffect } from "react";
import { saveUser, createAuthUser, deleteUser as fbDeleteUser, updateUser, saveCollection, adminResetPassword } from "../../firebase";
import { useTheme } from "../../core/theme";
import { PERMS_GRUPOS, PERMS_PADRAO } from "../permissions/permissions";
import { useS } from "../../shared/styles";
import { usePagination } from "../../shared/ui";
import { deleteUser } from "../../firebase";
import { F, G2, G3, Inp, Pagination, SecTitle, Sel } from "../../shared/ui";
import { cargosAtivos, cargoDoUsuario, cargosParaImportar, novoCargoId, pendentesDeMigracao, acharCargoPorNome, usuariosParaVincular } from "./cargos";
import { ColaboradoresTab } from "../colaboradores/ColaboradoresTab";

export function AdminTab({ users, setUsers, toast_, currentUser, auditLog, config = {}, catalogoAreasSetoresDistribuicao = [], catalogoCargos = [], colaboradores = [] }) {
  const T = useTheme(); const s = useS();
  const isAdmin = ["admin","keyuser","rt"].includes(currentUser?.role);

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
  const mkDefaultAreasDistrib = (cat) => (cat || []).map(a => ({
    id:a.id || "", label:a.label || "", ativo:a.ativo !== false,
    setores:(a.setores || []).map(sx => ({ id:sx.id || `setor-${Date.now()}`, nome:sx.nome || "", ativo:sx.ativo !== false })),
  }));

  const [abaAdmin, setAbaAdmin] = useState("usuarios");
  const [catAba, setCatAba] = useState("cargos");
  const [listaCargos, setListaCargos] = useState(() => [...(catalogoCargos || [])]);
  const [editCargoIdx, setEditCargoIdx] = useState(null);
  const [editCargoNome, setEditCargoNome] = useState("");
  const [novoCargo, setNovoCargo] = useState("");
  const [savingCargos, setSavingCargos] = useState(false);
  const [listaAreasDistrib, setListaAreasDistrib] = useState(() => mkDefaultAreasDistrib(catalogoAreasSetoresDistribuicao));
  const [novoAreaDistrib, setNovoAreaDistrib] = useState({ id:"", label:"" });
  const [novoSetorDistrib, setNovoSetorDistrib] = useState({});
  const [savingAreasDistrib, setSavingAreasDistrib] = useState(false);

  useEffect(() => { setListaAreasDistrib(mkDefaultAreasDistrib(catalogoAreasSetoresDistribuicao)); }, [catalogoAreasSetoresDistribuicao.length]);
  useEffect(() => { setListaCargos([...(catalogoCargos || [])]); }, [catalogoCargos.length]);

  // Catálogo de cargos (configuracoes/catalogo_cargos) — { id, nome, ativo }.
  // O `id` é slug estável: renomear o cargo não desvincula quem aponta para ele.
  // Fundação da Matriz de Treinamento — é por cargo que a exigência será herdada.
  const persistCargos = async (lista) => {
    if (!isAdmin) return;
    if (lista.some(c => !c.nome.trim())) { toast_("Todos os cargos precisam de um nome.", "red"); return; }
    setSavingCargos(true);
    try {
      await saveCollection("configuracoes", "catalogo_cargos", { items: lista });
      await auditLog("Atualizou Catálogo de Cargos", "configuracoes", "catalogo_cargos", "Catálogo", null, { total: lista.length });
      toast_("Catálogo de cargos salvo!", "green");
    } catch(e) { toast_("Erro ao salvar catálogo.", "red"); }
    setSavingCargos(false);
  };

  // Importa os cargos que já estão no cadastro dos usuários como texto livre,
  // deduplicando grafias equivalentes, e vincula cada usuário ao cargo criado.
  const importarCargosLegados = async () => {
    if (!isAdmin) return;
    const aImportar = cargosParaImportar(users, listaCargos);
    const aVincular = usuariosParaVincular(users, listaCargos);
    // Duas metades do mesmo problema: cargo que ainda não existe precisa ser criado;
    // cargo que já existe só precisa do vínculo. A ação é re-executável — rodar de
    // novo só pega o que sobrou.
    if (!aImportar.length && !aVincular.length) { toast_("Nada pendente de migração.", "green"); return; }
    const linhas = [
      aImportar.length ? `Criar ${aImportar.length} cargo(s):\n` + aImportar.map(c => `• ${c.nome} (${c.quantidade} usuário${c.quantidade>1?"s":""})`).join("\n") : "",
      aVincular.length ? `Vincular ${aVincular.length} usuário(s) a cargos já existentes:\n` + aVincular.map(x => `• ${x.user.name} → ${x.cargo.nome}`).join("\n") : "",
    ].filter(Boolean).join("\n\n");
    if (!window.confirm(`${linhas}\n\nGrafias equivalentes são agrupadas. Continuar?`)) return;
    setSavingCargos(true);
    try {
      let lista = [...listaCargos];
      for (const c of aImportar) lista = [...lista, { id: novoCargoId(c.nome, lista), nome: c.nome, ativo: true }];
      if (aImportar.length) await saveCollection("configuracoes", "catalogo_cargos", { items: lista });
      setListaCargos(lista);
      // Vincula cada usuário com texto livre ao cargo recém-criado. O rótulo `cargo`
      // é reescrito com a grafia canônica — o snapshot da assinatura depende dele.
      let vinculados = 0;
      for (const u of users || []) {
        if (u?.cargoId || !(u?.cargo || "").trim()) continue;
        const alvo = acharCargoPorNome(u.cargo, lista);
        if (!alvo) continue;
        await updateUser(u.id, { cargoId: alvo.id, cargo: alvo.nome });
        vinculados++;
      }
      setUsers(prev => prev.map(u => {
        if (u?.cargoId || !(u?.cargo || "").trim()) return u;
        const alvo = acharCargoPorNome(u.cargo, lista);
        return alvo ? { ...u, cargoId: alvo.id, cargo: alvo.nome } : u;
      }));
      const restantes = pendentesDeMigracao(users) - vinculados;
      await auditLog("Importou Cargos do Cadastro", "configuracoes", "catalogo_cargos", "Catálogo de Cargos", null, { cargosCriados: aImportar.length, usuariosVinculados: vinculados, naoVinculados: Math.max(0, restantes) });
      toast_(
        `${aImportar.length} cargo(s) criado(s), ${vinculados} usuário(s) vinculado(s).` +
        (restantes > 0 ? ` ${restantes} sem correspondência — verifique o cadastro.` : ""),
        restantes > 0 ? "orange" : "green"
      );
    } catch(e) { toast_("Erro ao importar cargos.", "red"); console.error(e); }
    setSavingCargos(false);
  };

  const persistAreasDistrib = async (lista) => {
    if (!isAdmin) return;
    const ids = lista.map(a => a.id.trim());
    if (lista.some(a => !a.id.trim() || !a.label.trim())) { toast_("Todas as áreas precisam de código e nome.", "red"); return; }
    if (new Set(ids).size !== ids.length) { toast_("Não pode haver códigos de área repetidos.", "red"); return; }
    if (lista.some(a => a.setores.some(sx => !sx.nome.trim()))) { toast_("Todo setor precisa de um nome.", "red"); return; }
    if (lista.some(a => new Set(a.setores.map(sx => sx.nome.trim().toLowerCase())).size !== a.setores.length)) { toast_("Não pode haver setores repetidos na mesma área.", "red"); return; }
    setSavingAreasDistrib(true);
    try {
      await saveCollection("configuracoes", "catalogo_areas_setores_distribuicao", { items: lista });
      await auditLog("Atualizou Catálogo de Áreas e Setores de Distribuição", "configuracoes", "catalogo_areas_setores_distribuicao", "Catálogo", null, { totalAreas:lista.length, totalSetores:lista.reduce((n,a)=>n+a.setores.length,0) });
      toast_("Catálogo de áreas e setores salvo!", "green");
    } catch(e) { toast_("Erro ao salvar catálogo.", "red"); }
    setSavingAreasDistrib(false);
  };

  const [nu, setNu] = useState({ name:"", email:"", pw:"Herbamed@2025", role:"user", setor:"", crf:"", cargo:"", cargoId:"" });
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
      const userData = { name:nu.name, email:nu.email, role:nu.role, setor:nu.setor, crf:nu.crf||"", cargo:nu.cargo||"", cargoId:nu.cargoId||"", permissoes:nuPermissoes };
      const savedUser = await saveUser(cred.user.uid, userData);
      await auditLog("Criou Usuário", "usuarios", cred.user.uid, `${userData.name} (${userData.email})`, null, { name: userData.name, email: userData.email, role: userData.role, setor: userData.setor });
      setUsers([...users, savedUser]);
      setNu({ name:"", email:"", pw:"Herbamed@2025", role:"user", setor:"", crf:"", cargo:"", cargoId:"" });
      setNuPermissoes({ ...PERMS_PADRAO["user"] });
      toast_("Usuário criado com sucesso!", "green");
    } catch(e) { toast_("Erro: "+e.message, "red"); }
  };

  const startEdit = (u) => {
    setEditing(u.id);
    setEditData({ name:u.name, setor:u.setor||"", role:u.role, crf:u.crf||"", cargo:u.cargo||"", cargoId:u.cargoId||"" });
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
        {[["usuarios","👥 Usuários"],["colaboradores","👷 Colaboradores"],["config","⚙️ Configurações"],["catalogos","🏢 Estrutura da empresa"]].map(([k,l])=>(
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
                  <F lbl="Cargo" tip="Vem do catálogo de cargos (Admin → Catálogos → Cargos). O cargo define quais treinamentos a pessoa herda." ch={
                    <Sel value={editData.cargoId||""} onChange={e=>{
                      const alvo = listaCargos.find(c=>c.id===e.target.value);
                      // Grava o id (vínculo) e o rótulo (snapshot da assinatura depende dele).
                      setEditData(p=>({...p, cargoId:e.target.value, cargo: alvo?alvo.nome:""}));
                    }}>
                      <option value="">— sem cargo —</option>
                      {cargosAtivos(listaCargos).map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
                      {editData.cargoId && !listaCargos.some(c=>c.id===editData.cargoId) && (
                        <option value={editData.cargoId}>{editData.cargo||editData.cargoId} (fora do catálogo)</option>
                      )}
                    </Sel>
                  } />
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
                    <div style={{ fontSize:11, color:T.text2 }}>
                      {u.email} · {u.setor||"—"}
                      {(()=>{
                        const c = cargoDoUsuario(u, listaCargos);
                        if (!c) return null;
                        // Cargo em texto livre ainda não herda treinamento — sinaliza a pendência.
                        return <> · {c.nome}{c.origem!=="catalogo" && <span title="Cargo fora do catálogo — não herda treinamento por cargo" style={{ color:"#e8a33d" }}> ⚠</span>}</>;
                      })()}
                    </div>
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
          <F lbl="Cargo" tip="Vem do catálogo de cargos (Admin → Catálogos → Cargos). O cargo define quais treinamentos a pessoa herda." ch={
            <Sel value={nu.cargoId} onChange={e=>{
              const alvo = listaCargos.find(c=>c.id===e.target.value);
              set("cargoId", e.target.value);
              set("cargo", alvo?alvo.nome:"");
            }}>
              <option value="">— sem cargo —</option>
              {cargosAtivos(listaCargos).map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
            </Sel>
          } />
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

      {abaAdmin==="colaboradores" && (
        <ColaboradoresTab
          colaboradores={colaboradores} users={users} catalogoCargos={catalogoCargos} catalogoAreas={catalogoAreasSetoresDistribuicao}
          toast_={toast_} auditLog={auditLog} isAdmin
        />
      )}

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

        <div style={{ marginTop:18, padding:"12px 14px", background:T.surf, border:`1px solid ${T.border}`, borderRadius:10, fontSize:12, color:T.text2 }}>
          📄 O <strong>prazo de revisão por tipo de documento</strong> saiu daqui — agora é um campo
          só, junto do tipo, em <strong>Gestão de Documentos → ⚙️ Configuração</strong>. Antes havia
          dois campos para a mesma coisa e o do catálogo não tinha efeito nenhum.
        </div>
      </div>
      </>)}

      {abaAdmin==="catalogos" && (<>
      {/* ── ESTRUTURA DA EMPRESA + listas ainda não movidas para os módulos ── */}
      <div style={s.card}>
        <SecTitle icon="🏢" ch="Estrutura da empresa" />
        <div style={{ fontSize:11, color:T.text3, marginBottom:14 }}>
          <strong>Quem</strong> (cargos) e <strong>onde</strong> (áreas e setores) — as duas listas que
          atravessam vários módulos: é delas que saem a exigência de treinamento e o destino das
          cópias controladas impressas.
          <br/>Listas de um módulo só ficam dentro do próprio módulo, em <strong>⚙️ Configuração</strong>:
          tipos de documento e departamentos na <strong>Gestão de Documentos</strong>; tipos e setores
          de desvio nos <strong>Desvios</strong>; tipos de revalidação nas <strong>Revalidações</strong>.
        </div>
        {/* Tabs */}
        <div style={{ display:"flex", gap:6, marginBottom:16, flexWrap:"wrap" }}>
          {[["cargos","👔 Cargos"],["distribuicao","🗂️ Áreas e Setores"]].map(([k,l])=>(
            <button key={k} onClick={()=>setCatAba(k)}
              style={{ padding:"6px 16px", borderRadius:8, border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:600,
                background:catAba===k?T.accent:T.surf, color:catAba===k?"#fff":T.text2, transition:"all .15s" }}>
              {l}
            </button>
          ))}
        </div>

        {/* ── ABA TIPOS DE DESVIO ── */}
        {/* ── ABA CARGOS ── */}
        {catAba==="cargos" && (()=>{
          const pendentes = pendentesDeMigracao(users);
          const aImportar = cargosParaImportar(users, listaCargos);
          const aVincular = usuariosParaVincular(users, listaCargos);
          const ocupantes = (id) => (users||[]).filter(u=>u?.cargoId===id).length;
          return (<>
          <div style={{ fontSize:11, color:T.text3, marginBottom:10 }}>
            Cargos/funções dos colaboradores. É por <strong>cargo</strong> que a exigência de treinamento
            será herdada: ao vincular um documento a um cargo, todo mundo que o ocupa passa a ser exigido
            automaticamente — inclusive quem for contratado depois. Manter lista fechada evita que o mesmo
            cargo apareça com grafias diferentes e quebre a matriz. Apenas cargos ativos aparecem no
            cadastro de usuários. As alterações são salvas automaticamente.
          </div>
          {pendentes > 0 && (
            <div style={{ background:"#ffd16618", border:"1px solid #ffd16644", borderRadius:10, padding:"12px 16px", marginBottom:12, display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
              <span style={{ fontSize:22 }}>👔</span>
              <div style={{ flex:1, minWidth:220 }}>
                <div style={{ fontSize:13, fontWeight:700, color:T.text }}>
                  {pendentes} usuário(s) com cargo em texto livre
                </div>
                <div style={{ fontSize:11, color:T.text2 }}>
                  {[
                    aImportar.length ? `${aImportar.length} cargo(s) a criar` : "",
                    aVincular.length ? `${aVincular.length} vínculo(s) a fazer` : "",
                  ].filter(Boolean).join(" · ") || "Nenhuma correspondência automática — ajuste o cadastro de cada usuário."}
                </div>
              </div>
              {(aImportar.length > 0 || aVincular.length > 0) && (
                <button style={{ ...s.btnA, fontSize:12, opacity:savingCargos?0.6:1 }} disabled={savingCargos} onClick={importarCargosLegados}>
                  ⬇️ Importar e vincular
                </button>
              )}
            </div>
          )}
          {/* Adicionar novo */}
          <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
            <input placeholder="Nome do cargo (ex: Analista de Controle de Qualidade)" value={novoCargo}
              onChange={e=>setNovoCargo(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter") document.getElementById("cargo-add-btn")?.click(); }}
              style={{ ...s.inp, flex:1, fontSize:12 }} />
            <button id="cargo-add-btn" style={s.btnA} onClick={()=>{
              const nome = novoCargo.trim();
              if (!nome) return;
              if (acharCargoPorNome(nome, listaCargos)) { toast_("Esse cargo já existe.", "red"); return; }
              const next = [...listaCargos, { id:novoCargoId(nome, listaCargos), nome, ativo:true }];
              setListaCargos(next);
              setNovoCargo("");
              persistCargos(next);
            }}>+ Adicionar</button>
          </div>
          {/* Lista */}
          <div style={{ display:"flex", flexDirection:"column", gap:4, maxHeight:380, overflowY:"auto" }}>
            {listaCargos.length===0 && (
              <div style={{ textAlign:"center", padding:"1.5rem", color:T.text3, fontSize:12 }}>
                Nenhum cargo cadastrado ainda.
              </div>
            )}
            {listaCargos.map((c, i)=>{
              const n = ocupantes(c.id);
              return (
              <div key={c.id||i} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 10px", background:T.surf, border:`1px solid ${T.border}`, borderRadius:8 }}>
                {editCargoIdx===i ? (<>
                  <input value={editCargoNome} autoFocus
                    onChange={e=>setEditCargoNome(e.target.value)}
                    style={{ ...s.inp, flex:1, fontSize:12 }} />
                  <button style={s.btnA} onClick={()=>{
                    const nome = editCargoNome.trim();
                    if (!nome) return;
                    if (listaCargos.some((x,j)=>j!==i && acharCargoPorNome(nome,[x]))) { toast_("Esse cargo já existe.", "red"); return; }
                    // Só o nome muda — o id fica, para não desvincular ninguém.
                    const next = listaCargos.map((x,j)=>j===i?{ ...x, nome }:x);
                    setListaCargos(next);
                    setEditCargoIdx(null);
                    persistCargos(next);
                  }}>✓</button>
                  <button style={s.btn} onClick={()=>setEditCargoIdx(null)}>✕</button>
                </>) : (<>
                  <span style={{ flex:1, fontSize:12, color:T.text }}>{c.nome}</span>
                  <span style={{ fontSize:10, color:T.text3 }} title="Usuários que ocupam este cargo">
                    {n} {n===1?"pessoa":"pessoas"}
                  </span>
                  <span style={{ fontSize:10, padding:"2px 8px", borderRadius:12, background:c.ativo!==false?T.accent+"22":"#ff4f6a22", color:c.ativo!==false?T.accent:"#ff4f6a", fontWeight:700 }}>
                    {c.ativo!==false?"Ativo":"Inativo"}
                  </span>
                  <button style={{ ...s.btn, fontSize:11, padding:"4px 10px" }} onClick={()=>{ setEditCargoIdx(i); setEditCargoNome(c.nome); }}>✏️</button>
                  <button style={{ ...s.btn, fontSize:11, padding:"4px 10px" }} onClick={()=>{ const next=listaCargos.map((x,j)=>j===i?{...x,ativo:x.ativo===false}:x); setListaCargos(next); persistCargos(next); }}>
                    {c.ativo!==false?"🔒 Desativar":"🔓 Ativar"}
                  </button>
                  <button style={{ ...s.btn, fontSize:11, padding:"4px 10px", color:"#ff4f6a" }}
                    title="Excluir cargo do catálogo"
                    onClick={()=>{
                      if (n > 0) { toast_(`"${c.nome}" tem ${n} ocupante(s) — desative em vez de excluir.`, "red"); return; }
                      if(window.confirm(`Excluir o cargo "${c.nome}" do catálogo?\n\nPrefira desativar se o cargo já foi usado.`)) { const next=listaCargos.filter((_,j)=>j!==i); setListaCargos(next); persistCargos(next); }
                    }}>🗑️</button>
                </>)}
              </div>
            );})}
          </div>
          <div style={{ textAlign:"right", marginTop:12 }}>
            <button style={{ ...s.btnA, opacity:(!isAdmin||savingCargos)?0.6:1 }} disabled={!isAdmin||savingCargos} onClick={()=>persistCargos(listaCargos)}>
              {savingCargos?"Salvando...":"💾 Salvar cargos"}
            </button>
          </div>
        </>);})()}

        {/* ── ÁREAS E SETORES — cadastro único do lugar físico ── */}
        {catAba==="distribuicao" && (<>
          <div style={{ fontSize:11, color:T.text3, marginBottom:10 }}>
            <strong>Onde as coisas acontecem</strong>, num cadastro só. Este catálogo alimenta quatro
            usos: destino da <strong>cópia física controlada</strong> (uma área pode receber a cópia
            inteira ou direcioná-la a um setor), <strong>local de trabalho</strong> do colaborador,
            <strong> exigência de treinamento</strong> por setor e o <strong>setor do desvio</strong>.
            <br/>Não confundir com <strong>Departamentos</strong> (em Gestão de Documentos → ⚙️
            Configuração): aquele é posição no organograma e entra no código do documento; este é
            lugar físico.
            <br/>⚠️ Um setor usado por desvios não deve ser excluído — desative. A conferência do que
            os Desvios ainda usam fica em <strong>Desvios → ⚙️ Configuração → 🏭 Setores</strong>.
          </div>
          <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
            <input placeholder="Código (ex: PRO)" maxLength={5} value={novoAreaDistrib.id}
              onChange={e=>setNovoAreaDistrib(p=>({...p,id:e.target.value.toUpperCase()}))} style={{ ...s.inp, width:110, fontSize:12 }} />
            <input placeholder="Nome da área (ex: Produção)" value={novoAreaDistrib.label}
              onChange={e=>setNovoAreaDistrib(p=>({...p,label:e.target.value}))} style={{ ...s.inp, flex:1, fontSize:12 }} />
            <button style={s.btnA} onClick={()=>{
              const area = { id:novoAreaDistrib.id.trim(), label:novoAreaDistrib.label.trim(), ativo:true, setores:[] };
              if (!area.id || !area.label) return;
              if (listaAreasDistrib.some(a=>a.id.toLowerCase()===area.id.toLowerCase())) { toast_("Esse código de área já existe.", "red"); return; }
              const next=[...listaAreasDistrib,area]; setListaAreasDistrib(next); setNovoAreaDistrib({id:"",label:""}); persistAreasDistrib(next);
            }}>+ Adicionar área</button>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10, maxHeight:480, overflowY:"auto" }}>
            {listaAreasDistrib.length===0 && <div style={{fontSize:12,color:T.text3,padding:"12px 0"}}>Nenhuma área cadastrada ainda.</div>}
            {listaAreasDistrib.map((area, ai)=>(
              <div key={area.id||ai} style={{ padding:12, border:`1px solid ${T.border}`, borderRadius:10, background:T.surf }}>
                <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10,flexWrap:"wrap"}}>
                  <input value={area.id} maxLength={5} onChange={e=>setListaAreasDistrib(xs=>xs.map((a,i)=>i===ai?{...a,id:e.target.value.toUpperCase()}:a))} style={{...s.inp,width:90,fontSize:12}} />
                  <input value={area.label} onChange={e=>setListaAreasDistrib(xs=>xs.map((a,i)=>i===ai?{...a,label:e.target.value}:a))} style={{...s.inp,flex:1,fontSize:12}} />
                  <button style={{...s.btn,fontSize:11}} onClick={()=>{ const next=listaAreasDistrib.map((a,i)=>i===ai?{...a,ativo:!a.ativo}:a); setListaAreasDistrib(next); persistAreasDistrib(next); }}>{area.ativo?"Desativar área":"Ativar área"}</button>
                </div>
                <div style={{fontSize:11,fontWeight:700,color:T.text2,marginBottom:6}}>Setores da área</div>
                {area.setores.map((setor,si)=>(
                  <div key={setor.id||si} style={{display:"flex",gap:8,alignItems:"center",marginBottom:5}}>
                    <input value={setor.nome} onChange={e=>setListaAreasDistrib(xs=>xs.map((a,i)=>i===ai?{...a,setores:a.setores.map((sx,j)=>j===si?{...sx,nome:e.target.value}:sx)}:a))} style={{...s.inp,flex:1,fontSize:12}} />
                    <button style={{...s.btn,fontSize:11}} onClick={()=>{ const next=listaAreasDistrib.map((a,i)=>i===ai?{...a,setores:a.setores.map((sx,j)=>j===si?{...sx,ativo:!sx.ativo}:sx)}:a); setListaAreasDistrib(next); persistAreasDistrib(next); }}>{setor.ativo?"Desativar":"Ativar"}</button>
                    <button style={{...s.btn,fontSize:11,color:"#ff4f6a"}} onClick={()=>{ const next=listaAreasDistrib.map((a,i)=>i===ai?{...a,setores:a.setores.filter((_,j)=>j!==si)}:a); setListaAreasDistrib(next); persistAreasDistrib(next); }}>Excluir</button>
                  </div>
                ))}
                <div style={{display:"flex",gap:8,marginTop:8}}>
                  <input placeholder="Novo setor (ex: Encapsulamento 1)" value={novoSetorDistrib[area.id]||""} onChange={e=>setNovoSetorDistrib(p=>({...p,[area.id]:e.target.value}))} style={{...s.inp,flex:1,fontSize:12}} />
                  <button style={{...s.btnA,fontSize:11}} onClick={()=>{ const nome=(novoSetorDistrib[area.id]||"").trim(); if(!nome)return; if(area.setores.some(sx=>sx.nome.toLowerCase()===nome.toLowerCase())){toast_("Esse setor já existe nesta área.","red");return;} const next=listaAreasDistrib.map((a,i)=>i===ai?{...a,setores:[...a.setores,{id:`${a.id}-${Date.now()}`,nome,ativo:true}]}:a); setListaAreasDistrib(next); setNovoSetorDistrib(p=>({...p,[area.id]:""})); persistAreasDistrib(next); }}>+ Setor</button>
                </div>
              </div>
            ))}
          </div>
          <div style={{textAlign:"right",marginTop:12}}><button style={{...s.btnA,opacity:(!isAdmin||savingAreasDistrib)?0.6:1}} disabled={!isAdmin||savingAreasDistrib} onClick={()=>persistAreasDistrib(listaAreasDistrib)}>{savingAreasDistrib?"Salvando...":"Salvar áreas e setores"}</button></div>
        </>)}

      </div>
      </>)}
    </div>
  );
}

import React, { useState, useEffect, useCallback } from "react";
import { auth, logoutUser, getUser, saveUser, updateUser, getAllUsers, saveRNC, updateRNC, deleteRNC as fbDeleteRNC, subscribeRNCs, saveCollection, deleteFromCollection, subscribeCollection, getCollection, onAuthStateChanged, subscribeNotifications, markNotificationsRead } from "../firebase";
import { FormalCtx, useFormalDomScrub, ThemeCtx, THEMES } from "../core/theme";
import { fmt, tod } from "../core/utils";
import { rncAtiva } from "../core/status";
import { AdminTab } from "../features/admin/AdminTab";
import { ArecoRecebimentosTab } from "../features/areco/ArecoRecebimentosTab";
import { AuditLogTab } from "../features/audit/AuditLogTab";
import { AuditoriasTab } from "../features/auditorias/AuditoriasTab";
import { Login } from "../features/auth/Login";
import { CEPTab } from "../features/cep/CEPTab";
import { ClientesTab } from "../features/clientes/ClientesTab";
import { CQAnalisesTab, CQDashboardTab, CQMateriaisTab, CQTab } from "../features/cq/CQTabs";
import { ExecutivoDashboard } from "../features/dashboard/ExecutivoDashboard";
import { GestaoDocumentosTab } from "../features/documentos/GestaoDocumentosTab";
import { EmailModal } from "../features/email/EmailModal";
import { FMEATab } from "../features/fmea/FMEATab";
import { FornecedoresTab } from "../features/fornecedores/FornecedoresTab";
import { IPCProdutosTab, IPCTab } from "../features/ipc/IPCTabs";
import { LaudosTab } from "../features/laudos/LaudosTab";
import { NQATab } from "../features/nqa/NQATab";
import { PERMS_PADRAO } from "../features/permissions/permissions";
import { ProcessosProducaoTab } from "../features/producao/ProcessosProducaoTab";
import { DesviosTab } from "../features/desvios/DesviosTabs";
import { RevalidacaoTab } from "../features/revalidacao/RevalidacaoTabs";
import { CAPATab, DashTab, EficaciaTab, HomeTab, IshikawaTab, ListaTab, NovaTab, RelatoriosTab, W2HTab } from "../features/rnc/RncTabs";
import { ReunioesTab } from "../features/rnc/ReunioesTab";
import { SupplierRNCPage } from "../features/rnc/SupplierRNCPage";
import { SidebarNav } from "../layout/Sidebar";
import { HerbamedLogo, ThemePicker, Toast } from "../shared/ui";
import { AtualizacaoDisponivel } from "../shared/AtualizacaoDisponivel";
import { TrocarSenhaModal } from "../features/profile/TrocarSenhaModal";

// Migração única (por sessão): copia registros da collection legada
// "revalidacoes_grafico" para "revalidacoes", marcando o tipo como
// "Material Gráfico". Idempotente — não sobrescreve o que já foi migrado.
let _revalMigrada = false;
async function migrarRevalidacoesLegado() {
  if (_revalMigrada) return;
  _revalMigrada = true;
  try {
    const [novos, legado] = await Promise.all([
      getCollection("revalidacoes").catch(() => []),
      getCollection("revalidacoes_grafico").catch(() => []),
    ]);
    if (!legado?.length) return;
    const idsNovos = new Set((novos || []).map(r => r.id));
    for (const r of legado) {
      if (idsNovos.has(r.id)) continue;
      await saveCollection("revalidacoes", r.id, { ...r, tipoRevalidacao: r.tipoRevalidacao || "Material Gráfico", migradoDe: "revalidacoes_grafico" });
    }
  } catch (e) { console.error("Migração de revalidações:", e); _revalMigrada = false; }
}

export default function App() {
  const [themeKey, setThemeKey] = useState(() => localStorage.getItem("hm_theme") || "herbamed");
  const [formalMode, setFormalMode] = useState(() => localStorage.getItem("hm_formal") === "true");
  const T = THEMES[themeKey];
  const changeTheme = key => { setThemeKey(key); localStorage.setItem("hm_theme", key); };
  const toggleFormal = () => { const v = !formalMode; setFormalMode(v); localStorage.setItem("hm_formal", String(v)); };
  useFormalDomScrub(formalMode);

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tab, setTab] = useState("home");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [rncs, setRncs] = useState([]);
  const [desvios, setDesvios] = useState([]);
  const [revalidacoes, setRevalidacoes] = useState([]);
  const [docNotifs, setDocNotifs] = useState([]);
  const [users, setUsers] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [config, setConfig] = useState({ aprovadorDiferenteAnalista: false });
  const [tiposRevisao, setTiposRevisao] = useState({});
  const [catalogoDeptos, setCatalogoDeptos] = useState([]);
  const [catalogoTipos,  setCatalogoTipos]  = useState([]);
  const [catalogoTiposDesvio, setCatalogoTiposDesvio] = useState([]);
  const [catalogoSetoresDesvio, setCatalogoSetoresDesvio] = useState([]);
  const [catalogoTiposRevalidacao, setCatalogoTiposRevalidacao] = useState([]);
  const [toast, setToast] = useState(null);
  const [rncPrefill, setRncPrefill] = useState(null);
  const [emailCtx, setEmailCtx] = useState(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);
  const [sessionWarning, setSessionWarning] = useState(false);
  const [sessionCountdown, setSessionCountdown] = useState(120);
  const [pwModalOpen, setPwModalOpen] = useState(false);

  // ── AUTO-LOGOUT POR INATIVIDADE (15 minutos) ──
  useEffect(() => {
    if (!user) return;
    const TIMEOUT = 15 * 60 * 1000; // 15 min
    const WARNING = 13 * 60 * 1000; // aviso aos 13 min (2 min antes)
    let warningTimer, logoutTimer, countdownInterval;

    const resetTimers = () => {
      clearTimeout(warningTimer);
      clearTimeout(logoutTimer);
      clearInterval(countdownInterval);
      setSessionWarning(false);
      setSessionCountdown(120);

      warningTimer = setTimeout(() => {
        setSessionWarning(true);
        let cnt = 120;
        setSessionCountdown(cnt);
        countdownInterval = setInterval(() => {
          cnt -= 1;
          setSessionCountdown(cnt);
          if (cnt <= 0) clearInterval(countdownInterval);
        }, 1000);
      }, WARNING);

      logoutTimer = setTimeout(async () => {
        try { await auditLog("Logout por Inatividade","usuarios",user?.uid||"—",user?.name||"—",null,null); } catch(e){}
        logoutUser();
        setUser(null);
        setSessionWarning(false);
      }, TIMEOUT);
    };

    const events = ["mousemove","mousedown","keypress","scroll","touchstart","click"];
    events.forEach(e => window.addEventListener(e, resetTimers));
    resetTimers();

    return () => {
      clearTimeout(warningTimer);
      clearTimeout(logoutTimer);
      clearInterval(countdownInterval);
      events.forEach(e => window.removeEventListener(e, resetTimers));
    };
  }, [user]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async fbUser => {
      if (fbUser) {
        const ud = await getUser(fbUser.uid);
        if (ud && (ud.name || ud.email)) {
          const agora = new Date().toISOString();
          setUser({ ...ud, uid: fbUser.uid });
          // Grava ultimo acesso silenciosamente
          try { await saveUser(fbUser.uid, { ultimoAcesso: agora, online: true }); } catch(e) {}
          // Audit: registra login
          try {
            await saveCollection("audit_log", String(Date.now()), {
              id: Date.now(), ts: Date.now(), data: agora,
              usuario: ud.name || "—", email: ud.email || "—", userId: fbUser.uid,
              acao: "Login", colecao: "usuarios", docId: fbUser.uid,
              docNome: ud.name || ud.email || "—",
              dadosAntes: null, dadosDepois: null,
            });
          } catch(e) {}
        } else if (ud) {
          // Perfil-lixo (sem nome E sem email): nao loga como usuario vazio.
          // Encerra a sessao e manda pro login, evitando o estado "(sem nome)".
          try { await logoutUser(); } catch(e) {}
          setUser(null);
        } else {
          // Backend não retornou perfil — usa dados da sessão como fallback.
          setUser({ uid: fbUser.uid, name: fbUser.displayName || fbUser.email, email: fbUser.email, role: "user" });
        }
      } else {
        // Marca offline ao sair — updateUser NUNCA cria documento (ao contrario de saveUser/merge),
        // evitando o nascimento de cadastro-lixo sem nome para uid sem perfil.
        if (auth.currentUser) {
          try { await updateUser(auth.currentUser.uid, { online: false }); } catch(e) {}
        }
        setUser(null);
      }
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeRNCs(setRncs);
    const unsubDesvios = subscribeCollection("desvios", setDesvios);
    migrarRevalidacoesLegado();
    const unsubReval = subscribeCollection("revalidacoes", setRevalidacoes);
    const unsubNotifs = subscribeNotifications(setDocNotifs);
    getAllUsers().then(setUsers);
    const unsubForn = subscribeCollection("fornecedores", (list) => {
      setFornecedores(list.sort((a,b) => (a.nome||"").localeCompare(b.nome||"")));
    });
    const unsubCfg = subscribeCollection("configuracoes", (list) => {
      setConfig(list.find(c => c.id === "geral") || { aprovadorDiferenteAnalista: false });
      const tr = list.find(c => c.id === "tipos_revisao");
      if (tr) { const { id, ...rest } = tr; setTiposRevisao(rest); }
      else setTiposRevisao({});
      const cd = list.find(c => c.id === "catalogo_departamentos");
      setCatalogoDeptos(cd?.items || []);
      const ct = list.find(c => c.id === "catalogo_tipos_doc");
      setCatalogoTipos(ct?.items || []);
      const ctd = list.find(c => c.id === "catalogo_tipos_desvio");
      setCatalogoTiposDesvio(ctd?.items || []);
      const csd = list.find(c => c.id === "catalogo_setores_desvio");
      setCatalogoSetoresDesvio(csd?.items || []);
      const ctr = list.find(c => c.id === "catalogo_tipos_revalidacao");
      setCatalogoTiposRevalidacao(ctr?.items || []);
    });
    return () => { unsub(); unsubDesvios(); unsubReval(); unsubNotifs(); unsubForn(); unsubCfg(); };
  }, [user]);

  // Alertas automáticos — verificar RNCs vencendo hoje ou já vencidas
  useEffect(() => {
    if (!user || !rncs.length) return;
    const hoje = tod();
    const amanha = new Date(); amanha.setDate(amanha.getDate() + 1);
    const amanhaStr = amanha.toISOString().split("T")[0];
    const vencendoHoje = rncs.filter(r => r.prazoAC === hoje && rncAtiva(r.status) && r.resp === user.name);
    const vencendoAmanha = rncs.filter(r => r.prazoAC === amanhaStr && rncAtiva(r.status) && r.resp === user.name);
    if (vencendoHoje.length > 0 || vencendoAmanha.length > 0) {
      const lastAlert = localStorage.getItem("hm_last_alert");
      if (lastAlert !== hoje) {
        localStorage.setItem("hm_last_alert", hoje);
        if (vencendoHoje.length > 0) {
          fetch("https://api.emailjs.com/api/v1.0/email/send", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              service_id: "service_gxhicii", template_id: "template_4jl73wq", user_id: "z2VxJ1dYjwrRp8Nh4",
              template_params: {
                to_email: user.email, to_name: user.name,
                from_name: "SGQ Herbamed® · Alertas Automáticos",
                subject: `⚠️ SGQ Herbamed — ${vencendoHoje.length} prazo(s) vencendo HOJE`,
                message: `Olá ${user.name},\n\nAs seguintes RNCs têm prazo de ação corretiva vencendo HOJE:\n\n${vencendoHoje.map(r => `• ${r.num} — ${r.desc?.substring(0, 60)}...\n  Prazo: ${fmt(r.prazoAC)}`).join("\n\n")}\n\n${vencendoAmanha.length > 0 ? `\nVencendo AMANHÃ:\n${vencendoAmanha.map(r => `• ${r.num} — ${r.desc?.substring(0, 60)}...`).join("\n")}\n\n` : ""}Acesse o sistema para tomar as ações necessárias.\n\nHerbamed® · Sistema de Gestão da Qualidade`,
                reply_to: user.email,
              }
            })
          }).catch(() => {});
        }
      }
    }
  }, [rncs, user]);

  // ── Heartbeat — atualiza online status a cada 2 minutos ──────────────────
  useEffect(() => {
    if (!user?.uid) return;
    const update = async () => {
      try { await saveUser(user.uid, { ultimoAcesso: new Date().toISOString(), online: true }); } catch(e) {}
    };
    update();
    const interval = setInterval(update, 2 * 60 * 1000);
    const handleUnload = () => {
      try { updateUser(user.uid, { online: false }); } catch(e) {}
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [user?.uid]);

  const toast_ = useCallback((msg, color = "green") => setToast({ msg, color, key: Date.now() }), []);

  // ── Auditoria ────────────────────────────────────────────────────────────
  const auditLog = useCallback(async (acao, colecao, docId, docNome, dadosAntes = null, dadosDepois = null) => {
    try {
      const entrada = {
        id: Date.now(),
        ts: Date.now(),
        data: new Date().toISOString(),
        usuario: user?.name || "—",
        email: user?.email || "—",
        userId: user?.uid || user?.id || "—",
        acao,
        colecao,
        docId: String(docId),
        docNome: docNome || String(docId),
        dadosAntes: dadosAntes ? JSON.stringify(dadosAntes).slice(0, 2000) : null,
        dadosDepois: dadosDepois ? JSON.stringify(dadosDepois).slice(0, 2000) : null,
      };
      await saveCollection("audit_log", String(entrada.id), entrada);
    } catch(e) {
      console.warn("[AuditLog] falha ao registrar:", e);
    }
  }, [user?.name, user?.email, user?.uid, user?.id]);

  // ── Verificação de permissões customizadas ───────────────────────────
  // Para usuários com permissoes salvas no banco local, usa elas.
  // Para usuários antigos sem permissoes, cai no papel (role) como antes.
  const perm = (key) => {
    if (!user) return false;
    if (user.permissoes && key in user.permissoes) return !!user.permissoes[key];
    // fallback para papel
    const role = user.role;
    return PERMS_PADRAO[role] ? !!(PERMS_PADRAO[role][key]) : false;
  };

  const fbErr = (e) => {
    console.error("[API]", e?.code, e?.message);
    const codes = {
      "unavailable":        "Sem conexao com o servidor. Verifique sua internet.",
      "permission-denied":  "Sem permissao para esta operacao.",
      "not-found":          "Registro nao encontrado.",
      "already-exists":     "Este registro ja existe.",
      "resource-exhausted": "Muitas requisicoes. Aguarde um momento.",
      "unauthenticated":    "Sessao expirada. Faca login novamente.",
      "deadline-exceeded":  "Tempo esgotado. Verifique sua conexao.",
    };
    return codes[e?.code] || "Erro ao salvar. Tente novamente.";
  };
  const openEmail = useCallback((rnc, evento) => setEmailCtx({ rnc, evento }), []);
  const doSaveRNC = useCallback(async (rnc) => {
    try {
      const isNew = !rncs.find(r => r.id === rnc.id);
      await saveRNC(rnc.id, rnc);
      await auditLog(isNew ? "Criou RNC" : "Editou RNC", "rncs", rnc.id, rnc.num || rnc.id, isNew ? null : rncs.find(r=>r.id===rnc.id), rnc);
    } catch(e) { console.error(e); }
  }, []);
  const doUpdateRNC = useCallback(async (id, data) => {
    try {
      const antes = rncs.find(r => r.id === id);
      await updateRNC(id, data);
      const acao = data.status ? `Status: ${data.status}` : data.ishikawa ? "Ishikawa atualizado" : data.w2h ? "5W2H atualizado" : data.eficacia ? "Eficácia registrada" : "Editou RNC";
      await auditLog(acao, "rncs", id, antes?.num || id, antes, data);
    } catch(e) { console.error(e); }
  }, []);
  const doDeleteRNC = useCallback(async (id) => {
    try {
      const antes = rncs.find(r => r.id === id);
      await fbDeleteRNC(id);
      await auditLog("Excluiu RNC", "rncs", id, antes?.num || id, antes, null);
    } catch(e) { console.error(e); }
  }, []);
  const doSaveDesvio = useCallback(async (desvio) => {
    try {
      const isNew = !desvios.find(d => d.id === desvio.id);
      await saveCollection("desvios", desvio.id, desvio);
      await auditLog(isNew ? "Registrou desvio" : `Desvio: ${desvio.status}`, "desvios", desvio.id, desvio.num || desvio.id, isNew ? null : desvios.find(d=>d.id===desvio.id), desvio);
    } catch(e) { console.error(e); }
  }, [desvios]);
  const doDeleteDesvio = useCallback(async (id) => {
    try {
      const antes = desvios.find(d => d.id === id);
      await deleteFromCollection("desvios", id);
      await auditLog("Excluiu desvio", "desvios", id, antes?.num || id, antes, null);
    } catch(e) { console.error(e); }
  }, [desvios]);
  const doSaveRevalidacao = useCallback(async (reg) => {
    try {
      const isNew = !revalidacoes.find(r => r.id === reg.id);
      await saveCollection("revalidacoes", reg.id, reg);
      await auditLog(isNew ? "Registrou revalidação" : `Revalidação: ${reg.status}`, "revalidacoes", reg.id, reg.num || reg.id, isNew ? null : revalidacoes.find(r=>r.id===reg.id), reg);
    } catch(e) { console.error(e); }
  }, [revalidacoes]);
  const doDeleteRevalidacao = useCallback(async (id) => {
    try {
      const antes = revalidacoes.find(r => r.id === id);
      await deleteFromCollection("revalidacoes", id);
      await auditLog("Excluiu revalidação", "revalidacoes", id, antes?.num || id, antes, null);
    } catch(e) { console.error(e); }
  }, [revalidacoes]);

  if (authLoading) return (
    <ThemeCtx.Provider value={T}>
      <div style={{ background: T.bg, color: T.text, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 48, height: 48, border: `3px solid ${T.accent}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 1rem" }} />
          <div style={{ color: T.text2, fontSize: 13 }}>Carregando SGQ Herbamed...</div>
        </div>
        <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      </div>
    </ThemeCtx.Provider>
  );

  // Rota pública: fornecedor responde RNC via link com token
  const supplierToken = new URLSearchParams(window.location.search).get("rnc_token");
  if (supplierToken && /^[a-f0-9]{64}$/.test(supplierToken)) {
    return <ThemeCtx.Provider value={T}><SupplierRNCPage token={supplierToken} /></ThemeCtx.Provider>;
  }

  if (!user) return <ThemeCtx.Provider value={T}><Login onLogin={setUser} /></ThemeCtx.Provider>;

  if (user.role === "exec") return (
    <ThemeCtx.Provider value={T}>
      <ExecutivoDashboard user={user} rncs={rncs} fornecedores={fornecedores} desvios={desvios} />
      <AtualizacaoDisponivel />
    </ThemeCtx.Provider>
  );

  const isViewer = user.role === "viewer";
  const isAdmin = user.role === "admin";

  // Notificações — RNCs com prazo vencido
  const notifs = rncs.filter(r => r.prazoAC && r.prazoAC < tod() && rncAtiva(r.status));
  // Notificações — documentos (rota de assinatura, vigência etc.)
  const docNotifsUnread = docNotifs.filter(n => !n.lida);
  const totalNotifs = notifs.length + docNotifsUnread.length;

  const MENU = [
    { id: "home",        icon: "🏠", label: "Home" },
    { id: "lista",       icon: "📋", label: "Registros", badge: rncs.filter(x => x.status === "Aberta").length },
    ...(!isViewer ? [{ id: "nova",       icon: "➕", label: "Nova RNC" }] : []),
    ...(!isViewer ? [{ id: "ishikawa",   icon: "🐟", label: "Ishikawa / 5 Porquês" }] : []),
    ...(!isViewer ? [{ id: "5w2h",       icon: "📋", label: "CAPA" }] : []),
    ...(!isViewer ? [{ id: "eficacia",   icon: "✅", label: "Eficácia" }] : []),
    ...(!isViewer ? [{ id: "fmea",       icon: "⚠️", label: "FMEA" }] : []),
    { id: "dashboard",   icon: "📊", label: "Dashboard" },
    { id: "relatorios",  icon: "📑", label: "Relatórios" },
    { id: "cep",         icon: "📉", label: "CEP" },
    { id: "fornecedores",icon: "🏭", label: "Fornecedores" },
    { id: "nqa",         icon: "📐", label: "NQA / AQL" },
    { id: "cq-materiais",icon: "🧪", label: "CQ — Materiais" },
    { id: "cq-analises", icon: "📋", label: "CQ — Análises" },
    { id: "auditorias",  icon: "🔍", label: "Auditorias" },
    { id: "ipc",          icon: "🏭", label: "Controle de Processo" },
    { id: "ipc-produtos",   icon: "📦", label: "IPC — Produtos" },
    ...(isAdmin ? [{ id: "admin", icon: "⚙️", label: "Administração" }] : []),
  ];

  const PAGE_TITLES = {
    home: "Home", lista: "Registros de Não Conformidades",
    nova: "Nova Não Conformidade", ishikawa: "Ishikawa / 5 Porquês",
    "5w2h": "CAPA — Ações Corretivas e Preventivas", eficacia: "Verificação de Eficácia",
    reunioes: "Reuniões de Análise Crítica de NCs",
    fmea: "FMEA — Análise de Modo e Efeito de Falha",
    dashboard: "Dashboard", relatorios: "Relatórios",
    cep: "CEP — Controle Estatístico de Processo",
    fornecedores: "Cadastro de Fornecedores",
    nqa: "NQA / AQL — Cálculo de Amostragem ISO 2859-1",
    "recebimentos-areco": "Recebimentos Areco",
    "cq-materiais": "CQ — Cadastro de Materiais",
    "cq-analises": "CQ — Fichas de Análise",
    "cq-dashboard": "CQ — Dashboard de Qualidade",
    "indicadores-desvios": "Desvios — Indicadores",
    revalidacao: "Revalidações",
    "nova-revalidacao": "Nova Revalidação",
    auditorias: "Auditorias Internas",
    laudos: "Laudos Analíticos",
    "gestao-docs": "Gestão de Documentos — Lista Mestra",
    "audit-log": "Trilha de Auditoria — RNCs e Documentos",
    clientes: "Clientes Terceiros",
    ipc: "IPC — Controle de Processo",
    "ipc-produtos": "IPC — Produtos Cadastrados",
    "producao-processos": "Controle de Processos de Produção",
    admin: "Administração",
  };

  return (
    <ThemeCtx.Provider value={T}>
    <FormalCtx.Provider value={formalMode}>
      <div data-formal={formalMode ? "true" : "false"} style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: T.bg, color: T.text, height: "100vh", overflow:"hidden", fontSize: 14, display: "flex", flexDirection: "column" }}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <style>{`
          @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
          @keyframes fadeIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
          @keyframes slideIn{from{transform:translateX(-100%)}to{transform:translateX(0)}}
          .menu-item:hover{background:${T.accentDim}!important;color:${T.accent}!important;}
          ${formalMode ? `
            button .emoji-hide, span.emoji-hide { display: none !important; }
            [data-formal="true"] .btn-emoji { display: none !important; }
          ` : ""}
          .rnc-row:hover{background:${T.card2}!important;}
          .th-sort:hover{color:${T.accent}!important;cursor:pointer;}
          select option{background:${T.surf}!important;color:${T.text}!important;}
          select{background:${T.surf}!important;color:${T.text}!important;}
          .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
          .grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;}
          .home-body{display:grid;grid-template-columns:1fr 340px;gap:1.5rem;}
          .home-kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;}
          .home-actions{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;}
          .kpi-grid{display:grid;}
          @media(max-width:768px){
            .header-kpis{display:none!important;}
            .sidebar-desktop{display:none!important;}
            .header-theme{display:none!important;}
            .sidebar-nav{display:none!important;}
            .grid-2,.grid-3{grid-template-columns:1fr!important;}
            .home-body{grid-template-columns:1fr!important;}
            .home-kpis{grid-template-columns:repeat(2,1fr)!important;}
            .home-actions{grid-template-columns:repeat(2,1fr)!important;}
            .kpi-grid{grid-template-columns:repeat(2,1fr)!important;}
            .sidebar-nav.mobile-open{
              display:flex!important;
              width:270px!important;
              position:fixed!important;
              top:0!important;left:0!important;bottom:0!important;
              height:100vh!important;
              z-index:295!important;
              box-shadow:4px 0 32px rgba(0,0,0,.5)!important;
            }
          }
          @media(min-width:769px){
            .mobile-only{display:none!important;}
          }
          @media print{
            .top-header,.sidebar-nav,.session-warning,.no-print{display:none!important;}
            body{background:#fff!important;}
            *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
          }
        `}</style>

        {/* ── TOP HEADER ── */}
        <div className="top-header" style={{ background: `linear-gradient(135deg,${T.surf},${T.card})`, borderBottom:`1px solid ${T.border2}`, height:60, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 1.5rem", position:"sticky", top:0, zIndex:200, backdropFilter:"blur(12px)", flexShrink:0 }}>

          {/* Left: toggle + logo */}
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            {/* Mobile hamburger */}
            <button className="mobile-only" onClick={() => setMobileMenuOpen(o=>!o)} style={{ background:"none", border:`1px solid ${T.border2}`, borderRadius:8, color:T.text2, cursor:"pointer", width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>
              ☰
            </button>
            {/* Desktop toggle */}
            <button className="sidebar-desktop" onClick={() => setSidebarOpen(o=>!o)} style={{ background:"none", border:`1px solid ${T.border2}`, borderRadius:8, color:T.text2, cursor:"pointer", width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>
              {sidebarOpen ? "◀" : "▶"}
            </button>
            <div onClick={() => setTab("home")} style={{ background:"#fff", borderRadius:9, padding:"4px 12px", boxShadow:`0 0 14px ${T.accentGlow}`, display:"flex", alignItems:"center", cursor:"pointer" }} title="Ir para Home">
              <HerbamedLogo height={24} white={false} />
            </div>
            <div style={{ display:"flex", flexDirection:"column" }}>
              <span style={{ fontSize:13, fontWeight:700, color:T.text, lineHeight:1.2 }}>SGQ Herbamed®</span>
              <span style={{ fontSize:10, color:T.text3 }}>Sistema de Gestão da Qualidade</span>
            </div>
          </div>

          {/* Center: KPI pills */}
          <div className="header-kpis" style={{ display:"flex", gap:8 }}>
            {[
              ["Total RNCs", rncs.length, T.accent],
              ["Abertas", rncs.filter(x=>x.status==="Aberta").length, T.red],
              ["Eficazes", rncs.filter(x=>x.status==="Eficaz").length, T.accent],
              ["Vencidas", notifs.length, notifs.length>0?T.yellow:T.text3],
            ].map(([l,n,c])=>(
              <div key={l} style={{ background:T.surf, border:`1px solid ${T.border}`, borderRadius:20, padding:"4px 14px", display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:16, fontWeight:700, color:c }}>{n}</span>
                <span style={{ fontSize:10, color:T.text3, textTransform:"uppercase", letterSpacing:".04em" }}>{l}</span>
              </div>
            ))}
          </div>

          {/* Right: theme + notif + avatar */}
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div className="header-theme"><ThemePicker current={themeKey} onChange={changeTheme} formal={formalMode} onToggleFormal={toggleFormal} /></div>

            {/* Presentation mode button — admin/keyuser/rt only */}
            {["admin","keyuser","rt"].includes(user.role) && (
              <button onClick={() => setPresentationMode(true)} title="Modo Apresentação" style={{ background: T.accentDim, border: `1px solid ${T.accent}44`, borderRadius: 8, color: T.accent, cursor: "pointer", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                📊
              </button>
            )}
            <div style={{ position:"relative" }}>
              <button onClick={()=>{setNotifOpen(o=>!o);setAvatarOpen(false);}} style={{ background:totalNotifs>0?"#ffd16618":"none", border:`1px solid ${totalNotifs>0?"#ffd16633":T.border}`, borderRadius:8, color:totalNotifs>0?T.yellow:T.text2, cursor:"pointer", width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, position:"relative" }}>
                🔔
                {totalNotifs>0 && <span style={{ position:"absolute", top:2, right:2, width:14, height:14, borderRadius:"50%", background:T.red, color:"#fff", fontSize:8, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", border:`2px solid ${T.bg}` }}>{totalNotifs}</span>}
              </button>
              {notifOpen && (
                <div style={{ position:"absolute", right:0, top:"calc(100%+8px)", width:320, maxHeight:420, overflowY:"auto", background:T.card2, border:`1px solid ${T.border2}`, borderRadius:14, boxShadow:"0 16px 48px #0008", zIndex:500, animation:"fadeIn .15s ease" }}>
                  <div style={{ padding:"12px 16px", borderBottom:`1px solid ${T.border}`, fontSize:12, fontWeight:700, color:T.text, display:"flex", justifyContent:"space-between" }}>
                    🔔 Notificações <span style={{ color:T.text3, fontWeight:400 }}>{totalNotifs} alerta(s)</span>
                  </div>
                  {totalNotifs===0 ? (
                    <div style={{ padding:"1.5rem", textAlign:"center", color:T.text3, fontSize:13 }}>Nenhum alerta no momento ✓</div>
                  ) : (
                    <>
                      {notifs.map(r=>(
                        <div key={`rnc-${r.id}`} onClick={()=>{setTab("lista");setNotifOpen(false);}} style={{ padding:"10px 16px", borderBottom:`1px solid ${T.border}`, cursor:"pointer", transition:"background .15s" }}>
                          <div style={{ fontSize:12, fontWeight:600, color:T.red }}>{r.num} — Prazo vencido</div>
                          <div style={{ fontSize:11, color:T.text2, marginTop:2 }}>{r.desc?.substring(0,50)}...</div>
                          <div style={{ fontSize:10, color:T.text3, marginTop:2 }}>Prazo AC: {fmt(r.prazoAC)}</div>
                        </div>
                      ))}
                      {docNotifsUnread.map(n=>(
                        <div key={`doc-${n.id}`} onClick={async ()=>{
                          setTab("gestao-docs"); setNotifOpen(false);
                          setDocNotifs(prev => prev.map(x => x.id===n.id ? { ...x, lida:true } : x));
                          await markNotificationsRead([n.id]);
                        }} style={{ padding:"10px 16px", borderBottom:`1px solid ${T.border}`, cursor:"pointer", transition:"background .15s" }}>
                          <div style={{ fontSize:12, fontWeight:600, color:T.accent }}>{n.titulo}</div>
                          <div style={{ fontSize:11, color:T.text2, marginTop:2 }}>{n.mensagem}</div>
                          <div style={{ fontSize:10, color:T.text3, marginTop:2 }}>{fmt(n.criada_em)}</div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Avatar dropdown */}
            <div style={{ position:"relative" }}>
              <button onClick={()=>{setAvatarOpen(o=>!o);setNotifOpen(false);}} style={{ display:"flex", alignItems:"center", gap:8, background:T.surf, border:`1px solid ${T.border2}`, borderRadius:10, padding:"5px 10px 5px 5px", cursor:"pointer", fontFamily:"inherit" }}>
                <div style={{ width:28, height:28, borderRadius:"50%", background:`linear-gradient(135deg,${T.accent},${T.accent2})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:"#fff", flexShrink:0 }}>
                  {user.name?.[0]||"?"}
                </div>
                <div style={{ textAlign:"left" }}>
                  <div style={{ fontSize:12, fontWeight:600, color:T.text, lineHeight:1.2 }}>{user.name}</div>
                  <div style={{ fontSize:10, color:T.text3 }}>{user.role==="admin"?"Admin":user.role==="viewer"?"Visualizador":"Usuário"}</div>
                </div>
                <span style={{ color:T.text3, fontSize:10 }}>▾</span>
              </button>
              {avatarOpen && (
                <div style={{ position:"absolute", right:0, top:"calc(100%+8px)", width:220, background:T.card2, border:`1px solid ${T.border2}`, borderRadius:12, boxShadow:"0 16px 48px #0008", zIndex:500, overflow:"hidden", animation:"fadeIn .15s ease" }}>
                  <div style={{ padding:"12px 16px", borderBottom:`1px solid ${T.border}` }}>
                    <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{user.name}</div>
                    <div style={{ fontSize:11, color:T.text2, marginTop:2 }}>{user.email}</div>
                    <div style={{ fontSize:10, color:T.text3, marginTop:2 }}>{user.setor}</div>
                  </div>
                  {isAdmin && (
                    <button onClick={()=>{setTab("admin");setAvatarOpen(false);}} style={{ width:"100%", padding:"10px 16px", background:"none", border:"none", color:T.text2, cursor:"pointer", fontFamily:"inherit", fontSize:12, textAlign:"left", display:"flex", alignItems:"center", gap:8 }}>
                      ⚙️ Administração
                    </button>
                  )}
                  <button onClick={()=>{setPwModalOpen(true);setAvatarOpen(false);}} style={{ width:"100%", padding:"10px 16px", background:"none", border:"none", color:T.text2, cursor:"pointer", fontFamily:"inherit", fontSize:12, textAlign:"left", display:"flex", alignItems:"center", gap:8 }}>
                    🔑 Mudar senha
                  </button>
                  <button onClick={async()=>{ try { await auditLog("Logout Manual","usuarios",user?.uid||"—",user?.name||"—",null,null); } catch(e){} logoutUser();setUser(null);}} style={{ width:"100%", padding:"10px 16px", background:"none", border:"none", color:T.red, cursor:"pointer", fontFamily:"inherit", fontSize:12, textAlign:"left", display:"flex", alignItems:"center", gap:8, borderTop:`1px solid ${T.border}` }}>
                    🚪 Sair do sistema
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── BODY: sidebar + content ── */}
        <div style={{ display:"flex", flex:1, minHeight:0, overflow:"hidden" }} onClick={()=>{setNotifOpen(false);setAvatarOpen(false);}}>

          {/* Mobile overlay */}
          {mobileMenuOpen && (
            <div onClick={()=>setMobileMenuOpen(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.6)", zIndex:290, backdropFilter:"blur(2px)" }} />
          )}

          {/* SIDEBAR */}
          <div className={`sidebar-nav${mobileMenuOpen ? " mobile-open" : ""}`} style={{ width: sidebarOpen ? 220 : 60, flexShrink:0, background:T.surf, borderRight:`1px solid ${T.border}`, display:"flex", flexDirection:"column", transition:"width .25s ease", overflow:"hidden", height:"100%", zIndex:"auto" }}>
            <SidebarNav T={T} tab={tab} setTab={(t)=>{ setTab(t); setMobileMenuOpen(false); }} sidebarOpen={mobileMenuOpen ? true : sidebarOpen} rncs={rncs} desvios={desvios} isViewer={isViewer} isAdmin={isAdmin} />
          </div>

          {/* MAIN CONTENT */}
          <div style={{ flex:1, overflowY:"auto", minWidth:0, height:"100%" }}>
            {/* Page header — hidden on home */}
            {tab !== "home" && (
              <div style={{ padding:"1.25rem 1.5rem .75rem", display:"flex", justifyContent:"space-between", alignItems:"center", borderBottom:`1px solid ${T.border}`, background:T.bg, position:"sticky", top:0, zIndex:50 }}>
                <div>
                  <div style={{ fontSize:18, fontWeight:700, color:T.text }}>{PAGE_TITLES[tab]||tab}</div>
                  <div style={{ fontSize:11, color:T.text3, marginTop:2 }}>
                    SGQ Herbamed® › {PAGE_TITLES[tab]||tab}
                  </div>
                </div>
                {tab==="lista" && !isViewer && (
                  <button style={{ padding:"8px 16px", border:`1px solid ${T.accent}33`, borderRadius:8, background:T.accentDim, color:T.accent, cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:600 }} onClick={()=>setTab("nova")}>
                    + Nova RNC
                  </button>
                )}
              </div>
            )}

            <div style={{ padding: tab==="home" ? "0" : "1.5rem" }}>
              {tab==="home"       && <HomeTab rncs={rncs} user={user} setTab={setTab} />}
              {tab==="lista"      && <ListaTab rncs={rncs} user={user} users={users} toast_={toast_} setTab={setTab} openEmail={openEmail} doUpdateRNC={doUpdateRNC} doDeleteRNC={doDeleteRNC} isViewer={isViewer} isAdmin={isAdmin} perm={perm} />}
              {tab==="nova"       && !isViewer && perm("criarRNC") && <NovaTab rncs={rncs} user={user} toast_={toast_} setTab={setTab} openEmail={openEmail} doSaveRNC={doSaveRNC} doSaveDesvio={doSaveDesvio} fornecedores={fornecedores} rncPrefill={rncPrefill} setRncPrefill={setRncPrefill} />}
              {tab==="desvios"      && perm("verDesvios") && <DesviosTab view="lista" user={user} toast_={toast_} setTab={setTab} desvios={desvios} doSaveDesvio={doSaveDesvio} doDeleteDesvio={doDeleteDesvio} perm={perm} setRncPrefill={setRncPrefill} isAdmin={isAdmin} catalogoTiposDesvio={catalogoTiposDesvio} catalogoSetoresDesvio={catalogoSetoresDesvio} />}
              {tab==="novo-desvio"  && perm("criarDesvio") && <DesviosTab view="novo" user={user} toast_={toast_} setTab={setTab} desvios={desvios} doSaveDesvio={doSaveDesvio} doDeleteDesvio={doDeleteDesvio} perm={perm} setRncPrefill={setRncPrefill} isAdmin={isAdmin} catalogoTiposDesvio={catalogoTiposDesvio} catalogoSetoresDesvio={catalogoSetoresDesvio} />}
              {tab==="indicadores-desvios" && perm("verDesvios") && <DesviosTab view="indicadores" user={user} toast_={toast_} setTab={setTab} desvios={desvios} doSaveDesvio={doSaveDesvio} doDeleteDesvio={doDeleteDesvio} perm={perm} setRncPrefill={setRncPrefill} isAdmin={isAdmin} catalogoTiposDesvio={catalogoTiposDesvio} catalogoSetoresDesvio={catalogoSetoresDesvio} />}
              {tab==="revalidacao"      && perm("verRevalidacao") && <RevalidacaoTab view="lista" user={user} toast_={toast_} setTab={setTab} revalidacoes={revalidacoes} doSaveRevalidacao={doSaveRevalidacao} doDeleteRevalidacao={doDeleteRevalidacao} perm={perm} isAdmin={isAdmin} catalogoTiposRevalidacao={catalogoTiposRevalidacao} />}
              {tab==="nova-revalidacao" && perm("criarRevalidacao") && <RevalidacaoTab view="nova" user={user} toast_={toast_} setTab={setTab} revalidacoes={revalidacoes} doSaveRevalidacao={doSaveRevalidacao} doDeleteRevalidacao={doDeleteRevalidacao} perm={perm} isAdmin={isAdmin} catalogoTiposRevalidacao={catalogoTiposRevalidacao} />}
              {tab==="ishikawa"   && !isViewer && <IshikawaTab rncs={rncs} toast_={toast_} openEmail={openEmail} doUpdateRNC={doUpdateRNC} user={user} isAdmin={isAdmin} />}
              {tab==="5w2h"       && !isViewer && <CAPATab rncs={rncs} user={user} toast_={toast_} openEmail={openEmail} doUpdateRNC={doUpdateRNC} isAdmin={isAdmin} />}
              {tab==="eficacia"   && !isViewer && <EficaciaTab rncs={rncs} toast_={toast_} openEmail={openEmail} doUpdateRNC={doUpdateRNC} user={user} isAdmin={isAdmin} />}
              {tab==="reunioes"   && <ReunioesTab rncs={rncs} user={user} users={users} toast_={toast_} doUpdateRNC={doUpdateRNC} openEmail={openEmail} perm={perm} isAdmin={isAdmin} />}
              {tab==="fmea"       && !isViewer && <FMEATab user={user} toast_={toast_} doSaveRNC={doSaveRNC} auditLog={auditLog} />}
              {tab==="dashboard"  && <DashTab rncs={rncs} />}
              {tab==="relatorios" && <RelatoriosTab rncs={rncs} users={users} user={user} toast_={toast_} />}
              {tab==="cep"        && <CEPTab rncs={rncs} />}
              {tab==="fornecedores"  && <FornecedoresTab rncs={rncs} fornecedores={fornecedores} setFornecedores={setFornecedores} user={user} toast_={toast_} isAdmin={isAdmin} auditLog={auditLog} />}
              {tab==="nqa"          && <NQATab user={user} toast_={toast_} />}
              {tab==="cq"           && <CQTab user={user} toast_={toast_} fornecedores={fornecedores} doSaveRNC={doSaveRNC} setTab={setTab} rncs={rncs} setRncPrefill={setRncPrefill} config={config} />}
              {tab==="recebimentos-areco" && <ArecoRecebimentosTab user={user} toast_={toast_} setTab={setTab} />}
              {tab==="cq-materiais" && <CQMateriaisTab user={user} toast_={toast_} fornecedores={fornecedores} perm={perm} auditLog={auditLog} />}
              {tab==="cq-analises"  && <CQAnalisesTab user={user} toast_={toast_} fornecedores={fornecedores} setTab={setTab} perm={perm} auditLog={auditLog} rncs={rncs} setRncPrefill={setRncPrefill} config={config} />}
              {tab==="cq-dashboard" && <CQDashboardTab />}
              {tab==="auditorias"   && <AuditoriasTab user={user} toast_={toast_} users={users} rncs={rncs} auditLog={auditLog} />}
              {tab==="laudos"       && <LaudosTab user={user} toast_={toast_} users={users} auditLog={auditLog} />}
              {tab==="clientes"     && <ClientesTab user={user} toast_={toast_} />}
              {tab==="gestao-docs"  && <GestaoDocumentosTab user={user} toast_={toast_} users={users} auditLog={auditLog} perm={perm} tiposRevisao={tiposRevisao} catalogoDeptos={catalogoDeptos} catalogoTipos={catalogoTipos} doSaveRNC={doSaveRNC} />}
              {tab==="ipc"          && <IPCTab user={user} toast_={toast_} />}
              {tab==="ipc-produtos"  && <IPCProdutosTab user={user} toast_={toast_} />}
              {tab==="producao-processos" && <ProcessosProducaoTab user={user} toast_={toast_} />}
              {tab==="audit-log"    && isAdmin && <AuditLogTab user={user} />}
              {tab==="admin"        && isAdmin && <AdminTab users={users} setUsers={setUsers} toast_={toast_} currentUser={user} auditLog={auditLog} config={config} tiposRevisao={tiposRevisao} catalogoDeptos={catalogoDeptos} catalogoTipos={catalogoTipos} catalogoTiposDesvio={catalogoTiposDesvio} catalogoSetoresDesvio={catalogoSetoresDesvio} catalogoTiposRevalidacao={catalogoTiposRevalidacao} />}
            </div>
          </div>
        </div>

        {emailCtx && <EmailModal rnc={emailCtx.rnc} users={users} currentUser={user} evento={emailCtx.evento} onClose={() => setEmailCtx(null)} onSent={msg => { toast_(msg, "green"); setEmailCtx(null); }} />}
        {toast && <Toast key={toast.key} msg={toast.msg} color={toast.color} onDone={() => setToast(null)} />}
        <AtualizacaoDisponivel />

        {/* Modal voluntário — "Mudar senha" no avatar */}
        {pwModalOpen && !user?.senhaTemporaria && (
          <TrocarSenhaModal
            forced={false}
            onSuccess={() => { setPwModalOpen(false); toast_("Senha atualizada com sucesso!", "green"); }}
            onClose={() => setPwModalOpen(false)}
          />
        )}

        {/* Modal forçado — senha temporária criada pelo admin */}
        {user?.senhaTemporaria && (
          <TrocarSenhaModal
            forced={true}
            onSuccess={() => { setUser(u => ({ ...u, senhaTemporaria: false })); toast_("Senha atualizada! Bem-vindo.", "green"); }}
            onClose={() => {}}
          />
        )}

        {/* ── MODO APRESENTAÇÃO ── */}
        {presentationMode && (
          <div style={{ position:"fixed", inset:0, zIndex:9999, background:T.bg }}>
            <ExecutivoDashboard user={user} rncs={rncs} fornecedores={fornecedores} desvios={desvios} onClose={() => setPresentationMode(false)} />
          </div>
        )}

        {/* ── AVISO DE SESSÃO EXPIRANDO ── */}
        {sessionWarning && (
          <div style={{ position:"fixed", bottom:24, right:24, zIndex:9999, background:"#1a1a2a", border:"1px solid #ffd16655", borderRadius:14, padding:"16px 20px", boxShadow:"0 8px 32px rgba(0,0,0,.6)", maxWidth:320, animation:"fadeIn .3s ease" }}>
            <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
              <span style={{ fontSize:24, flexShrink:0 }}>⏱️</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, color:"#ffd166", marginBottom:4 }}>Sessão expirando!</div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,.7)", marginBottom:12, lineHeight:1.5 }}>
                  Sua sessão será encerrada por inatividade em{" "}
                  <strong style={{ color:"#ffd166" }}>
                    {Math.floor(sessionCountdown/60)}:{String(sessionCountdown%60).padStart(2,"0")}
                  </strong>
                </div>
                <button
                  onClick={()=>{ setSessionWarning(false); }}
                  style={{ width:"100%", padding:"8px", background:"linear-gradient(135deg,#2ab84a,#1a7a3c)", border:"none", borderRadius:8, color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}
                >
                  Continuar sessão →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </FormalCtx.Provider>
    </ThemeCtx.Provider>
  );
}

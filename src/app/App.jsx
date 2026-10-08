import React, { useState, useEffect, useCallback, useRef, Suspense, lazy } from "react";
import { auth, logoutUser, getUser, saveUser, updateUser, getAllUsers, createRNC, saveRNC, updateRNC, deleteRNC as fbDeleteRNC, subscribeRNCs, saveCollection, deleteFromCollection, subscribeCollection, getCollection, onAuthStateChanged, subscribeNotifications, markNotificationsRead } from "../firebase";
import { FormalCtx, useFormalDomScrub, ThemeCtx, THEMES } from "../core/theme";
import { fmt, tod } from "../core/utils";
import { rncAtiva } from "../core/status";
import { pendentesDoUsuario } from "../features/documentos/treinamento";
import { MATRIZ_TREINAMENTO_ATIVA } from "../config/funcionalidades";
import { AdminTab } from "../features/admin/AdminTab";
import { ArecoRecebimentosTab } from "../features/areco/ArecoRecebimentosTab";
import { AuditLogTab } from "../features/audit/AuditLogTab";
import { AuditoriasTab } from "../features/auditorias/AuditoriasTab";
import { Login } from "../features/auth/Login";
import { CEPTab } from "../features/cep/CEPTab";
import { ClientesTab } from "../features/clientes/ClientesTab";
import { ExecutivoDashboard } from "../features/dashboard/ExecutivoDashboard";
import { EmailModal } from "../features/email/EmailModal";
import { enviarEmail } from "../features/email/enviarEmail";
import { FMEATab } from "../features/fmea/FMEATab";
import { FornecedoresTab } from "../features/fornecedores/FornecedoresTab";
import { IPCProdutosTab, IPCTab } from "../features/ipc/IPCTabs";
import { LaudosTab } from "../features/laudos/LaudosTab";
import { NQATab } from "../features/nqa/NQATab";
import { PERMS_PADRAO } from "../features/permissions/permissions";
import { ProcessosProducaoTab } from "../features/producao/ProcessosProducaoTab";
import { ConfiguracaoDesviosTab } from "../features/desvios/ConfiguracaoDesviosTab";
import { RevalidacaoTab } from "../features/revalidacao/RevalidacaoTabs";
import { ConfiguracaoRevalidacaoTab } from "../features/revalidacao/ConfiguracaoRevalidacaoTab";
import { DashTab, HomeTab, ListaTab, NovaTab, RelatoriosTab } from "../features/rnc/RncTabs";
import { ReunioesTab } from "../features/rnc/ReunioesTab";
import { SupplierRNCPage } from "../features/rnc/SupplierRNCPage";
import { SidebarNav } from "../layout/Sidebar";
import { TopNav } from "../layout/TopNav";
import { PrecisaDeVoce } from "../features/home/PrecisaDeVoce";
import { Toast } from "../shared/ui";
import { IconeSGQ } from "../shared/IconeSGQ";
import { MARCA } from "../shared/marca";
import { abaDaUrl, urlComAba, fichaDaUrl, enderecoCorresponde } from "./abaNaUrl";
import { RncFicha } from "../features/rnc/RncFicha";
import { FilaAnaliseCausa } from "../features/rnc/AnaliseCausa";
import { FilaCapa } from "../features/rnc/PlanoCapa";
import { FilaEficacia } from "../features/rnc/Eficacia";

// Botão sobre a faixa verde do cabeçalho: contorno claro, sem cor de tema.
const faixaBtn = { background:"transparent", border:"1px solid rgba(243,247,241,.22)", borderRadius:8, color:MARCA.claro, cursor:"pointer", width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontFamily:"inherit" };
import { AtualizacaoDisponivel } from "../shared/AtualizacaoDisponivel";
import { AutocorrectNotice } from "../shared/AutocorrectNotice";
import { handleAutocorrectUndo, handleWritingBlur, handleWritingInput, prepareAutocorrectField } from "../services/autocorrect";
import { TrocarSenhaModal } from "../features/profile/TrocarSenhaModal";

// Code-splitting por aba (onda 10) — Desvios, CQ e Gestão de Documentos só
// pesam no bundle de quem realmente abre essas abas. RNC (RncTabs.jsx) fica
// de fora de propósito: HomeTab mora no mesmo arquivo e é a tela padrão da
// casca antiga (tab inicial "home") — colocar esse módulo em lazy atrasaria
// a primeira tela de quem ainda não está na navegação nova.
function lazyNamed(loader, nome) {
  return lazy(() => loader().then(m => ({ default: m[nome] })));
}
const desviosLoader = () => import("../features/desvios/DesviosTabs");
const DesviosTab = lazyNamed(desviosLoader, "DesviosTab");

const cqLoader = () => import("../features/cq/CQTabs");
const CQTab = lazyNamed(cqLoader, "CQTab");
const CQMateriaisTab = lazyNamed(cqLoader, "CQMateriaisTab");
const CQAnalisesTab = lazyNamed(cqLoader, "CQAnalisesTab");
const CQDashboardTab = lazyNamed(cqLoader, "CQDashboardTab");

const GestaoDocumentosTab = lazyNamed(() => import("../features/documentos/GestaoDocumentosTab"), "GestaoDocumentosTab");
const HomologacoesTab = lazyNamed(() => import("../features/homologacoes/HomologacoesTab"), "HomologacoesTab");

function AbaCarregando() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "4rem" }}>
      <div style={{ width: 28, height: 28, border: "3px solid currentColor", opacity: .25, borderTopColor: "transparent", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
    </div>
  );
}

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
  // Padrão "herbamedFolha" (as cores do login). Quem escolheu um tema segue com ele;
  // tema salvo de uma leva antiga, que não existe mais em THEMES, cai no padrão.
  const [themeKey, setThemeKey] = useState(() => {
    const salvo = localStorage.getItem("hm_theme");
    return salvo && THEMES[salvo] ? salvo : "herbamedFolha";
  });
  const [formalMode, setFormalMode] = useState(() => localStorage.getItem("hm_formal") === "true");
  const T = THEMES[themeKey];
  const changeTheme = key => { setThemeKey(key); localStorage.setItem("hm_theme", key); };
  const toggleFormal = () => { const v = !formalMode; setFormalMode(v); localStorage.setItem("hm_formal", String(v)); };
  useFormalDomScrub(formalMode);

  // Captura no documento para cobrir também modais, portais e a rota pública do fornecedor.
  useEffect(() => {
    document.addEventListener("focusin", prepareAutocorrectField, true);
    document.addEventListener("input", handleWritingInput, true);
    document.addEventListener("keydown", handleAutocorrectUndo, true);
    document.addEventListener("focusout", handleWritingBlur, true);
    return () => {
      document.removeEventListener("focusin", prepareAutocorrectField, true);
      document.removeEventListener("input", handleWritingInput, true);
      document.removeEventListener("keydown", handleAutocorrectUndo, true);
      document.removeEventListener("focusout", handleWritingBlur, true);
    };
  }, []);

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  // A tela atual mora no endereço (?aba=...): F5 mantém a tela, link direto abre nela
  // (inclusive depois do login) e o Voltar/Avançar do navegador navega entre telas.
  const [tab, setTab] = useState(() => abaDaUrl(window.location.search));
  // Ficha de uma RNC aberta (?aba=rnc&rnc=<id>&etapa=causa): qual RNC e qual etapa.
  const [ficha, setFicha] = useState(() => fichaDaUrl(window.location.search));
  const primeiraSincronia = useRef(true);
  useEffect(() => {
    // Compara os parâmetros crus: ?aba=nao-existe já abre a Home, mas o endereço precisa ser limpo.
    if (enderecoCorresponde(window.location.search, tab, ficha)) return;
    const url = urlComAba(window.location.href, tab, ficha);
    // Trocar de etapa dentro da mesma RNC não empilha histórico: o Voltar da ficha
    // leva de volta à lista, não etapa por etapa.
    const p = new URLSearchParams(window.location.search);
    const soEtapa = tab === "rnc" && p.get("aba") === "rnc" && p.get("rnc") === ficha.rnc;
    // Na abertura só corrige o endereço (aba inválida → Home) sem criar entrada no histórico.
    if (primeiraSincronia.current || soEtapa) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
    primeiraSincronia.current = false;
  }, [tab, ficha]);
  useEffect(() => { primeiraSincronia.current = false; }, []);
  useEffect(() => {
    const aoVoltar = () => { setTab(abaDaUrl(window.location.search)); setFicha(fichaDaUrl(window.location.search)); };
    window.addEventListener("popstate", aoVoltar);
    return () => window.removeEventListener("popstate", aoVoltar);
  }, []);
  const abrirRnc = useCallback((id, etapa = "resumo") => { setFicha({ rnc: id, etapa }); setTab("rnc"); }, []);
  // Trocar de tela ou de RNC começa no topo: a área de conteúdo é o que rola, e sem
  // isto a ficha abria herdando a rolagem da lista (cabeçalho da RNC fora da vista).
  const areaConteudo = useRef(null);
  useEffect(() => { if (areaConteudo.current) areaConteudo.current.scrollTop = 0; }, [tab, ficha.rnc]);
  const setEtapaFicha = useCallback(etapa => setFicha(p => ({ ...p, etapa })), []);
  // Saiu (manual ou por inatividade) → a próxima entrada começa na Home. A tela de
  // login é desenhada dentro do App, sem recarregar a página, então sem isto a `tab`
  // antiga sobrevivia e o sistema reabria onde a pessoa estava.
  const usuarioAnterior = useRef(null);
  useEffect(() => {
    if (usuarioAnterior.current && !user) {
      window.history.replaceState(null, "", urlComAba(window.location.href, "home"));
      setTab("home");
    }
    usuarioAnterior.current = user;
  }, [user]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Repaginação: navegação em abas no topo x barra lateral. Enquanto a nova casca
  // amadurece, as duas convivem e a escolha fica por navegador — quem não gostar
  // volta para a lateral sem depender de publicação.
  const [navTopo, setNavTopo] = useState(() => localStorage.getItem("sgq_nav") === "topo");
  const alternarNav = () => setNavTopo(v => {
    const novo = !v;
    localStorage.setItem("sgq_nav", novo ? "topo" : "lateral");
    return novo;
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [rncs, setRncs] = useState([]);
  const [desvios, setDesvios] = useState([]);
  const [revalidacoes, setRevalidacoes] = useState([]);
  const [homologacoes, setHomologacoes] = useState([]);
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
  const [catalogoAreasSetoresDistribuicao, setCatalogoAreasSetoresDistribuicao] = useState([]);
  const [catalogoCargos, setCatalogoCargos] = useState([]);
  // Cadastro de pessoas — inclui quem NÃO tem login (operadores). É a fonte da
  // exigência de treinamento desde a Fase 6; `users` é só quem tem credencial.
  const [colaboradores, setColaboradores] = useState([]);
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
    const podeLerHomologacoes = user.permissoes && Object.prototype.hasOwnProperty.call(user.permissoes, "verHomologacoes")
      ? user.permissoes.verHomologacoes === true
      : PERMS_PADRAO[user.role]?.verHomologacoes === true;
    const unsubHomologacoes = podeLerHomologacoes
      ? subscribeCollection("homologacoes", setHomologacoes)
      : () => {};
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
      const casd = list.find(c => c.id === "catalogo_areas_setores_distribuicao");
      setCatalogoAreasSetoresDistribuicao(casd?.items || []);
      const cc = list.find(c => c.id === "catalogo_cargos");
      setCatalogoCargos(cc?.items || []);
    });
    const unsubColab = subscribeCollection("colaboradores", list => setColaboradores(list || []));
    return () => { unsub(); unsubDesvios(); unsubReval(); unsubHomologacoes(); unsubNotifs(); unsubForn(); unsubCfg(); unsubColab && unsubColab(); };
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
          // A falha não é mais engolida em silêncio: o backend registra o
          // insucesso em `email_log` antes de a promessa rejeitar aqui.
          enviarEmail({
            para: [user.email],
            assunto: `⚠️ SGQ Herbamed — ${vencendoHoje.length} prazo(s) vencendo HOJE`,
            corpo: `Olá ${user.name},\n\nAs seguintes RNCs têm prazo de ação corretiva vencendo HOJE:\n\n${vencendoHoje.map(r => `• ${r.num} — ${r.desc?.substring(0, 60)}...\n  Prazo: ${fmt(r.prazoAC)}`).join("\n\n")}\n\n${vencendoAmanha.length > 0 ? `\nVencendo AMANHÃ:\n${vencendoAmanha.map(r => `• ${r.num} — ${r.desc?.substring(0, 60)}...`).join("\n")}\n\n` : ""}Acesse o sistema para tomar as ações necessárias.\n\nHerbamed® · Sistema de Gestão da Qualidade`,
            evento: "alerta_prazo_rnc",
            nomes: { [user.email]: user.name },
          }).catch(e => console.warn("Alerta de prazo de RNC nao enviado:", e.message));
        }
      }
    }
  }, [rncs, user]);

  // ── Alerta de treinamento — atrasado ou com reciclagem vencida ────────────
  // Mesmo desenho do alerta de prazo das RNCs acima: dispara no máximo uma vez
  // por dia (trava em localStorage) e usa a MESMA regra de exigência da matriz,
  // importada de `treinamento.js` — nada de reimplementar a herança por cargo.
  // Busca one-shot (não assina): o alerta não precisa ser tempo real, e assim
  // não duplica o polling que a aba de Documentos já faz.
  useEffect(() => {
    if (!MATRIZ_TREINAMENTO_ATIVA || !user?.uid) return;
    const hoje = tod();
    if (localStorage.getItem("hm_last_alert_treino") === hoje) return;
    let vivo = true;
    (async () => {
      try {
        const [docs, evid] = await Promise.all([
          getCollection("gestao_docs"),
          getCollection("treinamentos"),
        ]);
        if (!vivo) return;
        // O alerta é por e-mail, então só alcança quem tem login — e o `colaborador.id`
        // de quem tem login é o próprio `users.id`, então `user.uid` continua casando.
        const meus = pendentesDoUsuario({
          docs: docs || [], pessoas: colaboradores, evidencias: evid || [],
          catalogoCargos: catalogoCargos, catalogoAreas: catalogoAreasSetoresDistribuicao, userId: String(user.uid), hoje,
        });
        const criticos = meus.filter(m => m.status === "atrasado" || m.status === "vencido");
        if (!criticos.length) return;
        localStorage.setItem("hm_last_alert_treino", hoje);
        const linha = (m) => `• ${m.doc.codigo} — ${m.doc.titulo} (Rev.${m.doc.versao})\n  ${m.status === "vencido" ? `Reciclagem vencida há ${m.dias} dia(s)` : `Sem treinamento há ${m.dias} dia(s)`}`;
        enviarEmail({
          para: [user.email],
          assunto: `📚 SGQ Herbamed — ${criticos.length} treinamento(s) em atraso`,
          corpo: `Olá ${user.name},\n\nVocê tem treinamento obrigatório pendente nos documentos abaixo:\n\n${criticos.map(linha).join("\n\n")}\n\nAcesse Gestão de Documentos → Matriz de Treinamento para regularizar.\n\nHerbamed® · Sistema de Gestão da Qualidade`,
          evento: "alerta_treinamento",
          nomes: { [user.email]: user.name },
        }).catch(e => console.warn("Alerta de treinamento nao enviado:", e.message));
      } catch { /* alerta é best-effort: falha não pode atrapalhar o login */ }
    })();
    return () => { vivo = false; };
  }, [user?.uid, colaboradores, catalogoCargos, catalogoAreasSetoresDistribuicao]);

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

  // extra: { detalhe, acao: { rotulo, onClick } } — ver Toast em shared/ui.jsx.
  const toast_ = useCallback((msg, color = "green", extra = {}) => setToast({ msg, color, ...extra, key: Date.now() }), []);

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
      const anterior = rncs.find(item => item.id === rnc.id);
      const salvo = anterior ? (await saveRNC(rnc.id, rnc), rnc) : await createRNC(rnc);
      await auditLog(anterior ? "Editou RNC" : "Criou RNC", "rncs", salvo.id, salvo.num || salvo.id, anterior || null, salvo);
      return salvo;
    } catch(e) {
      console.error(e);
      throw e;
    }
  }, [rncs, auditLog]);
  // Falha na gravação avisa e INTERROMPE quem chamou: antes o erro ia só para o console
  // e a tela seguia dizendo "salvo!". Falha só na auditoria não desfaz a gravação.
  const doUpdateRNC = useCallback(async (id, data) => {
    const antes = rncs.find(r => r.id === id);
    try {
      await updateRNC(id, data);
    } catch(e) {
      console.error(e);
      toast_(`Não foi possível salvar a RNC ${antes?.num || ""}: ${e?.message || "erro no servidor"}`.replace("  ", " "), "red");
      throw e;
    }
    try {
      const acao = data.status ? `Status: ${data.status}` : data.ishikawa ? "Ishikawa atualizado" : data.w2h ? "5W2H atualizado" : data.eficacia ? "Eficácia registrada" : "Editou RNC";
      await auditLog(acao, "rncs", id, antes?.num || id, antes, data);
    } catch(e) { console.error(e); }
  }, [rncs, auditLog, toast_]);
  const doDeleteRNC = useCallback(async (id) => {
    try {
      const antes = rncs.find(r => r.id === id);
      await fbDeleteRNC(id);
      await auditLog("Excluiu RNC", "rncs", id, antes?.num || id, antes, null);
    } catch(e) { console.error(e); }
  }, [rncs, auditLog]);
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
      <div style={{ background: T.bg, color: T.text, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div className="carregando-icone" style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
            <IconeSGQ size={44} />
          </div>
          <div style={{ color: T.text2, fontSize: 13 }}>Carregando SGQ Herbamed…</div>
        </div>
        <style>{`@keyframes respira{0%,100%{opacity:1}50%{opacity:.55}}
          .carregando-icone{animation:respira 1.6s ease-in-out infinite;}
          @media(prefers-reduced-motion:reduce){.carregando-icone{animation:none;}}`}</style>
      </div>
    </ThemeCtx.Provider>
  );

  // Rota pública: fornecedor responde RNC via link com token
  const supplierToken = new URLSearchParams(window.location.search).get("rnc_token");
  if (supplierToken && /^[a-f0-9]{64}$/.test(supplierToken)) {
    return <ThemeCtx.Provider value={T}><SupplierRNCPage token={supplierToken} /><AutocorrectNotice /></ThemeCtx.Provider>;
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
    ...(!isViewer ? [{ id: "ishikawa",   icon: "🐟", label: "Análise de causa" }] : []),
    ...(!isViewer ? [{ id: "5w2h",       icon: "📋", label: "CAPA" }] : []),
    ...(!isViewer ? [{ id: "eficacia",   icon: "✅", label: "Eficácia" }] : []),
    ...(!isViewer ? [{ id: "fmea",       icon: "⚠️", label: "FMEA" }] : []),
    { id: "dashboard",   icon: "📊", label: "Dashboard" },
    { id: "relatorios",  icon: "📑", label: "Relatórios" },
    { id: "cep",         icon: "📉", label: "CEP" },
    { id: "fornecedores",icon: "🏭", label: "Fornecedores" },
    { id: "homologacoes",icon: "✅", label: "Homologações" },
    { id: "nqa",         icon: "📐", label: "NQA / AQL" },
    { id: "cq-materiais",icon: "🧪", label: "CQ — Materiais" },
    { id: "cq-analises", icon: "📋", label: "CQ — Análises" },
    { id: "auditorias",  icon: "🔍", label: "Auditorias" },
    { id: "ipc",          icon: "🏭", label: "IPC — Análise de Mistura" },
    { id: "ipc-produtos",   icon: "📦", label: "IPC — Produtos" },
    ...(isAdmin ? [{ id: "admin", icon: "⚙️", label: "Administração" }] : []),
  ];

  const PAGE_TITLES = {
    home: "Home", lista: "Registros de Não Conformidades",
    nova: "Nova Não Conformidade", ishikawa: "Análise de causa — RNCs aguardando",
    "5w2h": "CAPA — Ações Corretivas e Preventivas", eficacia: "Verificação de Eficácia",
    reunioes: "Reuniões de Análise Crítica de NCs",
    fmea: "FMEA — Análise de Modo e Efeito de Falha",
    dashboard: "Dashboard", relatorios: "Relatórios",
    cep: "CEP — Controle Estatístico de Processo",
    fornecedores: "Cadastro de Fornecedores",
    homologacoes: "Homologação de Fornecedores e Itens",
    nqa: "NQA / AQL — Cálculo de Amostragem ISO 2859-1",
    "recebimentos-areco": "Recebimentos Areco",
    "cq-materiais": "CQ — Cadastro de Materiais",
    "cq-analises": "CQ — Fichas de Análise",
    "cq-dashboard": "CQ — Dashboard de Qualidade",
    desvios: "Registros de Desvios",
    "novo-desvio": "Novo Desvio",
    "config-desvios": "Desvios — Configuração",
    "indicadores-desvios": "Desvios — Indicadores",
    "config-revalidacao": "Revalidações — Configuração",
    cq: "Controle de Qualidade",
    revalidacao: "Revalidações",
    "nova-revalidacao": "Nova Revalidação",
    auditorias: "Auditorias Internas",
    laudos: "Laudos Analíticos",
    "gestao-docs": "Gestão de Documentos — Lista Mestra",
    "audit-log": "Trilha de Auditoria — RNCs e Documentos",
    clientes: "Clientes Terceiros",
    ipc: "IPC — Análise de Mistura",
    "ipc-produtos": "IPC — Produtos Cadastrados",
    "producao-processos": "Controle de Processos de Produção",
    admin: "Administração",
  };

  return (
    <ThemeCtx.Provider value={T}>
    <FormalCtx.Provider value={formalMode}>
      <div
        data-formal={formalMode ? "true" : "false"}
        style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: T.bg, color: T.text, height: "100vh", overflow:"hidden", fontSize: 14, display: "flex", flexDirection: "column" }}
      >
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <style>{`
          @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
          @keyframes fadeIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
          @keyframes slideIn{from{transform:translateX(-100%)}to{transform:translateX(0)}}
          @keyframes skeletonPulse{0%{opacity:.5}50%{opacity:1}100%{opacity:.5}}
          .skeleton-bar{animation:skeletonPulse 1.4s ease-in-out infinite;}
          @media(prefers-reduced-motion:reduce){.skeleton-bar{animation:none;opacity:.75;}}
          .faixa-btn:hover{background:rgba(255,255,255,.12)!important;}
          .faixa-btn:focus-visible{outline:2px solid ${MARCA.claro};outline-offset:2px;}
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
          @media(max-width:1100px){ .header-kpis{display:none!important;} }
          @media(max-width:900px){ .faixa-sub,.faixa-usuario{display:none!important;} }
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

        {/* ── TOP HEADER — a faixa verde ──
            Mesmo cabeçalho da tela de login e dos PDFs, e não muda com o tema: é a
            assinatura do sistema. O tema escolhido vale do cabeçalho para baixo. */}
        <div className="top-header" style={{ background: MARCA.verde, borderBottom:"1px solid rgba(0,0,0,.18)", height:60, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 1.5rem", position:"sticky", top:0, zIndex:200, flexShrink:0 }}>

          {/* Left: toggle + marca */}
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            {/* Mobile hamburger — só na navegação lateral. Com as abas no topo não há
                gaveta para abrir: o ☰ abria o overlay preto sobre nada. */}
            {!navTopo && (
              <button className="mobile-only faixa-btn" onClick={() => setMobileMenuOpen(o=>!o)} aria-label="Abrir menu" style={{ ...faixaBtn, fontSize:18 }}>
                ☰
              </button>
            )}
            {/* Desktop toggle — sem sentido quando a navegação está no topo */}
            {!navTopo && (
              <button className="sidebar-desktop faixa-btn" onClick={() => setSidebarOpen(o=>!o)} aria-label={sidebarOpen ? "Recolher menu" : "Expandir menu"} style={{ ...faixaBtn, fontSize:12 }}>
                {sidebarOpen ? "◀" : "▶"}
              </button>
            )}
            <button onClick={() => setTab("home")} title="Ir para Home" style={{ display:"flex", alignItems:"center", gap:10, background:"none", border:"none", padding:0, cursor:"pointer", fontFamily:"inherit", textAlign:"left" }}>
              <IconeSGQ size={32} fundo={MARCA.claro} folha={MARCA.verde} />
              <span style={{ display:"flex", flexDirection:"column", whiteSpace:"nowrap" }}>
                <span style={{ fontSize:14, fontWeight:600, color:MARCA.claro, lineHeight:1.2 }}>SGQ Herbamed</span>
                <span className="faixa-sub" style={{ fontSize:11, color:MARCA.verdeTexto }}>Sistema de Gestão da Qualidade</span>
              </span>
            </button>
          </div>

          {/* Center: KPI pills — cores claras sobre a faixa; só o que pede atenção ganha cor */}
          <div className="header-kpis" style={{ display:"flex", gap:8 }}>
            {[
              ["Total RNCs", rncs.length, MARCA.claro],
              ["Abertas", rncs.filter(x=>x.status==="Aberta").length, null, "#ffc9c4"],
              ["Eficazes", rncs.filter(x=>x.status==="Eficaz").length, MARCA.claro],
              ["Vencidas", notifs.length, null, "#ffdc8f"],
            ].map(([l,n,cor,alerta])=>(
              <div key={l} style={{ background:"rgba(255,255,255,.07)", border:"1px solid rgba(255,255,255,.12)", borderRadius:20, padding:"4px 14px", display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:16, fontWeight:700, color: cor || (n>0 ? alerta : MARCA.claro) }}>{n}</span>
                <span style={{ fontSize:10, color:MARCA.verdeTexto, textTransform:"uppercase", letterSpacing:".04em" }}>{l}</span>
              </div>
            ))}
          </div>

          {/* Right: notif + avatar (tema, modo formal e navegação moraram pro menu do avatar) */}
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            {/* Presentation mode button — admin/keyuser/rt only */}
            {["admin","keyuser","rt"].includes(user.role) && (
              <button className="faixa-btn" onClick={() => setPresentationMode(true)} title="Modo Apresentação" style={{ ...faixaBtn, fontSize:16 }}>
                📊
              </button>
            )}
            <div style={{ position:"relative" }}>
              <button className="faixa-btn" onClick={()=>{setNotifOpen(o=>!o);setAvatarOpen(false);}} aria-label={`Notificações (${totalNotifs})`} style={{ ...faixaBtn, fontSize:16, position:"relative", ...(totalNotifs>0 ? { background:"rgba(255,220,143,.14)", borderColor:"rgba(255,220,143,.45)" } : {}) }}>
                🔔
                {totalNotifs>0 && <span style={{ position:"absolute", top:-4, right:-4, minWidth:16, height:16, padding:"0 3px", boxSizing:"border-box", borderRadius:8, background:"#e5484d", color:"#fff", fontSize:9, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", border:`2px solid ${MARCA.verde}` }}>{totalNotifs}</span>}
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
                        <div key={`rnc-${r.id}`} onClick={()=>{abrirRnc(r.id);setNotifOpen(false);}} style={{ padding:"10px 16px", borderBottom:`1px solid ${T.border}`, cursor:"pointer", transition:"background .15s" }}>
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
              <button className="faixa-btn" onClick={()=>{setAvatarOpen(o=>!o);setNotifOpen(false);}} style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(255,255,255,.07)", border:"1px solid rgba(255,255,255,.14)", borderRadius:10, padding:"5px 10px 5px 5px", cursor:"pointer", fontFamily:"inherit" }}>
                <div style={{ width:28, height:28, borderRadius:"50%", background:MARCA.claro, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:MARCA.verde, flexShrink:0 }}>
                  {user.name?.[0]||"?"}
                </div>
                <div className="faixa-usuario" style={{ textAlign:"left", whiteSpace:"nowrap" }}>
                  <div style={{ fontSize:12, fontWeight:600, color:MARCA.claro, lineHeight:1.2 }}>{user.name}</div>
                  <div style={{ fontSize:10, color:MARCA.verdeTexto }}>{user.role==="admin"?"Admin":user.role==="viewer"?"Visualizador":"Usuário"}</div>
                </div>
                <span style={{ color:MARCA.verdeTexto, fontSize:10 }}>▾</span>
              </button>
              {avatarOpen && (
                <div style={{ position:"absolute", right:0, top:"calc(100%+8px)", width:240, maxHeight:"80vh", background:T.card2, border:`1px solid ${T.border2}`, borderRadius:12, boxShadow:"0 16px 48px #0008", zIndex:500, overflowX:"hidden", overflowY:"auto", animation:"fadeIn .15s ease" }}>
                  <div style={{ padding:"12px 16px", borderBottom:`1px solid ${T.border}` }}>
                    <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{user.name}</div>
                    <div style={{ fontSize:11, color:T.text2, marginTop:2 }}>{user.email}</div>
                    <div style={{ fontSize:10, color:T.text3, marginTop:2 }}>{user.setor}</div>
                  </div>

                  {/* Modo Formal */}
                  <button onClick={toggleFormal} style={{ width:"100%", padding:"10px 16px", background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:12, textAlign:"left", display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, borderBottom:`1px solid ${T.border}`, color:T.text2 }}>
                    <span style={{ display:"flex", alignItems:"center", gap:8 }}>📁 Modo Formal</span>
                    <span style={{ flexShrink:0, width:34, height:19, borderRadius:20, background:formalMode?T.accent:T.border, position:"relative", transition:"background .2s" }}>
                      <span style={{ position:"absolute", top:2, left:formalMode?17:2, width:15, height:15, borderRadius:"50%", background:"#fff", transition:"left .2s", boxShadow:"0 1px 3px rgba(0,0,0,.3)" }} />
                    </span>
                  </button>

                  {/* Navegação em abas vs. menu lateral */}
                  <button onClick={()=>{ alternarNav(); setAvatarOpen(false); }} title={navTopo ? "Clique para voltar ao menu lateral" : "Clique para experimentar a navegação em abas"} style={{ width:"100%", padding:"10px 16px", background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:12, textAlign:"left", display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, borderBottom:`1px solid ${T.border}`, color:T.text2 }}>
                    <span style={{ display:"flex", alignItems:"center", gap:8 }}>✨ Navegação em abas</span>
                    <span style={{ flexShrink:0, width:34, height:19, borderRadius:20, background:navTopo?T.accent:T.border, position:"relative", transition:"background .2s" }}>
                      <span style={{ position:"absolute", top:2, left:navTopo?17:2, width:15, height:15, borderRadius:"50%", background:"#fff", transition:"left .2s", boxShadow:"0 1px 3px rgba(0,0,0,.3)" }} />
                    </span>
                  </button>

                  {/* Tema */}
                  <div style={{ padding:"10px 16px 6px", fontSize:10, color:T.text3, textTransform:"uppercase", letterSpacing:".06em", fontWeight:700, borderBottom:`1px solid ${T.border}`, paddingBottom:8 }}>
                    🎨 Tema
                    <div style={{ display:"flex", flexDirection:"column", gap:2, marginTop:8 }}>
                      {Object.entries(THEMES).map(([key, th]) => (
                        <button key={key} onClick={()=>changeTheme(key)} style={{ display:"flex", alignItems:"center", gap:8, width:"100%", padding:"7px 10px", border:"none", background:themeKey===key?T.accentDim:"transparent", color:themeKey===key?T.accent:T.text2, cursor:"pointer", fontFamily:"inherit", fontSize:11.5, borderRadius:8, fontWeight:themeKey===key?600:400, textTransform:"none", letterSpacing:"normal" }}>
                          <span style={{ width:11, height:11, borderRadius:"50%", background:th.accent, display:"inline-block", boxShadow:`0 0 5px ${th.accent}`, flexShrink:0 }} />
                          {th.name}
                        </button>
                      ))}
                    </div>
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

        {/* ── BARRA DE ABAS (repaginação) ── */}
        {navTopo && (
          <TopNav tab={tab==="rnc" ? "lista" : tab} setTab={(t)=>{ setTab(t); setMobileMenuOpen(false); }} rncs={rncs} desvios={desvios} isViewer={isViewer} isAdmin={isAdmin} perm={perm} />
        )}

        {/* ── BODY: sidebar + content ── */}
        <div style={{ display:"flex", flex:1, minHeight:0, overflow:"hidden" }} onClick={()=>{setNotifOpen(false);setAvatarOpen(false);}}>

          {/* Mobile overlay — idem: sem gaveta, sem overlay (rede de segurança caso
              o menu tenha ficado aberto quando a navegação foi trocada). */}
          {mobileMenuOpen && !navTopo && (
            <div onClick={()=>setMobileMenuOpen(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.6)", zIndex:290, backdropFilter:"blur(2px)" }} />
          )}

          {/* SIDEBAR — só na navegação lateral (a de abas dispensa) */}
          {navTopo ? null : (
            <div className={`sidebar-nav${mobileMenuOpen ? " mobile-open" : ""}`} style={{ width: sidebarOpen ? 220 : 60, flexShrink:0, background:T.surf, borderRight:`1px solid ${T.border}`, display:"flex", flexDirection:"column", transition:"width .25s ease", overflow:"hidden", height:"100%", zIndex:"auto" }}>
              <SidebarNav T={T} tab={tab==="rnc" ? "lista" : tab} setTab={(t)=>{ setTab(t); setMobileMenuOpen(false); }} sidebarOpen={mobileMenuOpen ? true : sidebarOpen} rncs={rncs} desvios={desvios} isViewer={isViewer} isAdmin={isAdmin} perm={perm} />
            </div>
          )}

          {/* MAIN CONTENT */}
          <div ref={areaConteudo} style={{ flex:1, overflowY:"auto", minWidth:0, height:"100%" }}>
            {/* Page header — hidden on home */}
            {tab !== "home" && tab !== "rnc" && (
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
              {/* Na navegação nova, a tela inicial responde "o que precisa de mim
                  agora"; na de sempre, segue a Home antiga. Andam juntas de
                  propósito: quem volta para a lateral volta inteiro. */}
              <Suspense fallback={<AbaCarregando />}>
              {tab==="home" && (navTopo
                ? <PrecisaDeVoce rncs={rncs} desvios={desvios} user={user} setTab={setTab} abrirRnc={abrirRnc} perm={perm} docNotifs={docNotifs}
                    colaboradores={colaboradores} catalogoCargos={catalogoCargos} catalogoAreas={catalogoAreasSetoresDistribuicao} />
                : <HomeTab rncs={rncs} user={user} setTab={setTab} />)}
              {tab==="lista"      && <ListaTab rncs={rncs} isViewer={isViewer} abrirRnc={abrirRnc} />}
              {tab==="rnc"        && <RncFicha rncId={ficha.rnc} etapa={ficha.etapa} setEtapa={setEtapaFicha} rncs={rncs} user={user} toast_={toast_} setTab={setTab} openEmail={openEmail} doUpdateRNC={doUpdateRNC} doDeleteRNC={doDeleteRNC} isViewer={isViewer} isAdmin={isAdmin} perm={perm} />}
              {tab==="nova"       && !isViewer && perm("criarRNC") && <NovaTab rncs={rncs} user={user} toast_={toast_} setTab={setTab} openEmail={openEmail} doSaveRNC={doSaveRNC} doSaveDesvio={doSaveDesvio} fornecedores={fornecedores} rncPrefill={rncPrefill} setRncPrefill={setRncPrefill} />}
              {tab==="desvios"      && perm("verDesvios") && <DesviosTab view="lista" user={user} toast_={toast_} setTab={setTab} desvios={desvios} doSaveDesvio={doSaveDesvio} doDeleteDesvio={doDeleteDesvio} perm={perm} setRncPrefill={setRncPrefill} isAdmin={isAdmin} catalogoTiposDesvio={catalogoTiposDesvio} catalogoSetoresDesvio={catalogoSetoresDesvio} catalogoAreasSetoresDistribuicao={catalogoAreasSetoresDistribuicao} />}
              {tab==="novo-desvio"  && perm("criarDesvio") && <DesviosTab view="novo" user={user} toast_={toast_} setTab={setTab} desvios={desvios} doSaveDesvio={doSaveDesvio} doDeleteDesvio={doDeleteDesvio} perm={perm} setRncPrefill={setRncPrefill} isAdmin={isAdmin} catalogoTiposDesvio={catalogoTiposDesvio} catalogoSetoresDesvio={catalogoSetoresDesvio} catalogoAreasSetoresDistribuicao={catalogoAreasSetoresDistribuicao} />}
              {tab==="indicadores-desvios" && perm("verDesvios") && <DesviosTab view="indicadores" user={user} toast_={toast_} setTab={setTab} desvios={desvios} doSaveDesvio={doSaveDesvio} doDeleteDesvio={doDeleteDesvio} perm={perm} setRncPrefill={setRncPrefill} isAdmin={isAdmin} catalogoTiposDesvio={catalogoTiposDesvio} catalogoSetoresDesvio={catalogoSetoresDesvio} catalogoAreasSetoresDistribuicao={catalogoAreasSetoresDistribuicao} />}
              {tab==="revalidacao"      && perm("verRevalidacao") && <RevalidacaoTab view="lista" user={user} toast_={toast_} setTab={setTab} revalidacoes={revalidacoes} doSaveRevalidacao={doSaveRevalidacao} doDeleteRevalidacao={doDeleteRevalidacao} perm={perm} isAdmin={isAdmin} catalogoTiposRevalidacao={catalogoTiposRevalidacao} />}
              {tab==="nova-revalidacao" && perm("criarRevalidacao") && <RevalidacaoTab view="nova" user={user} toast_={toast_} setTab={setTab} revalidacoes={revalidacoes} doSaveRevalidacao={doSaveRevalidacao} doDeleteRevalidacao={doDeleteRevalidacao} perm={perm} isAdmin={isAdmin} catalogoTiposRevalidacao={catalogoTiposRevalidacao} />}
              {tab==="config-desvios" && isAdmin && <ConfiguracaoDesviosTab catalogoTiposDesvio={catalogoTiposDesvio} catalogoSetoresDesvio={catalogoSetoresDesvio} catalogoAreas={catalogoAreasSetoresDistribuicao} desvios={desvios} doSaveDesvio={doSaveDesvio} user={user} isAdmin={isAdmin} toast_={toast_} auditLog={auditLog} setTab={setTab} />}
              {tab==="config-revalidacao" && isAdmin && <ConfiguracaoRevalidacaoTab catalogoTiposRevalidacao={catalogoTiposRevalidacao} isAdmin={isAdmin} toast_={toast_} auditLog={auditLog} setTab={setTab} />}
              {tab==="ishikawa"   && !isViewer && <FilaAnaliseCausa rncs={rncs} abrirRnc={abrirRnc} />}
              {tab==="5w2h"       && !isViewer && <FilaCapa rncs={rncs} abrirRnc={abrirRnc} />}
              {tab==="eficacia"   && !isViewer && <FilaEficacia rncs={rncs} abrirRnc={abrirRnc} />}
              {tab==="reunioes"   && <ReunioesTab rncs={rncs} user={user} users={users} toast_={toast_} doUpdateRNC={doUpdateRNC} openEmail={openEmail} perm={perm} isAdmin={isAdmin} />}
              {tab==="fmea"       && !isViewer && <FMEATab user={user} toast_={toast_} doSaveRNC={doSaveRNC} auditLog={auditLog} />}
              {tab==="dashboard"  && <DashTab rncs={rncs} />}
              {tab==="relatorios" && <RelatoriosTab rncs={rncs} users={users} user={user} toast_={toast_} />}
              {tab==="cep"        && <CEPTab rncs={rncs} />}
              {tab==="fornecedores"  && <FornecedoresTab rncs={rncs} fornecedores={fornecedores} homologacoes={homologacoes} setFornecedores={setFornecedores} user={user} toast_={toast_} isAdmin={isAdmin} auditLog={auditLog} />}
              {tab==="homologacoes" && perm("verHomologacoes") && <HomologacoesTab user={user} users={users} fornecedores={fornecedores} homologacoes={homologacoes} toast_={toast_} auditLog={auditLog} perm={perm} />}
              {tab==="nqa"          && <NQATab user={user} toast_={toast_} />}
              {tab==="cq"           && <CQTab user={user} users={users} toast_={toast_} fornecedores={fornecedores} doSaveRNC={doSaveRNC} setTab={setTab} rncs={rncs} setRncPrefill={setRncPrefill} config={config} />}
              {tab==="recebimentos-areco" && <ArecoRecebimentosTab user={user} toast_={toast_} setTab={setTab} />}
              {tab==="cq-materiais" && <CQMateriaisTab user={user} toast_={toast_} fornecedores={fornecedores} perm={perm} auditLog={auditLog} />}
              {tab==="cq-analises"  && <CQAnalisesTab user={user} users={users} toast_={toast_} fornecedores={fornecedores} setTab={setTab} perm={perm} auditLog={auditLog} rncs={rncs} setRncPrefill={setRncPrefill} config={config} />}
              {tab==="cq-dashboard" && <CQDashboardTab />}
              {tab==="auditorias"   && <AuditoriasTab user={user} toast_={toast_} users={users} rncs={rncs} auditLog={auditLog} />}
              {tab==="laudos"       && perm("verLaudos") && <LaudosTab user={user} toast_={toast_} users={users} auditLog={auditLog} perm={perm} />}
              {tab==="clientes"     && <ClientesTab user={user} toast_={toast_} />}
              {tab==="gestao-docs"  && <GestaoDocumentosTab user={user} toast_={toast_} users={users} auditLog={auditLog} perm={perm} tiposRevisao={tiposRevisao} catalogoDeptos={catalogoDeptos} catalogoTipos={catalogoTipos} catalogoAreasSetoresDistribuicao={catalogoAreasSetoresDistribuicao} catalogoCargos={catalogoCargos} colaboradores={colaboradores} doSaveRNC={doSaveRNC} />}
              {tab==="ipc"          && <IPCTab user={user} toast_={toast_} />}
              {tab==="ipc-produtos"  && <IPCProdutosTab user={user} toast_={toast_} />}
              {tab==="producao-processos" && <ProcessosProducaoTab user={user} toast_={toast_} />}
              {tab==="audit-log"    && isAdmin && <AuditLogTab user={user} />}
              {tab==="admin"        && isAdmin && <AdminTab users={users} setUsers={setUsers} toast_={toast_} currentUser={user} auditLog={auditLog} config={config} catalogoAreasSetoresDistribuicao={catalogoAreasSetoresDistribuicao} catalogoCargos={catalogoCargos} colaboradores={colaboradores} />}
              </Suspense>
            </div>
          </div>
        </div>

        {emailCtx && <EmailModal rnc={emailCtx.rnc} users={users} evento={emailCtx.evento} onClose={() => setEmailCtx(null)} onSent={msg => { toast_(msg, "green"); setEmailCtx(null); }} />}
        {toast && <Toast key={toast.key} msg={toast.msg} color={toast.color} detalhe={toast.detalhe} acao={toast.acao} onDone={() => setToast(null)} />}
        <AtualizacaoDisponivel />
        <AutocorrectNotice />

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

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useFormal, useTheme } from "../core/theme";
import { MENU_SVG_ICONS } from "./menuIcons";
import { abaDaTela, buscarTelas, montarAbas, montarGrupos, telasParaBusca } from "./navegacao";

// Navegação em abas no topo (repaginação — onda 1).
//
// Duas linhas: as 8 abas de assunto e, abaixo, as telas da aba escolhida. Lê a
// mesma estrutura da barra lateral (`navegacao.js`), então as duas cascas nunca
// divergem — o usuário troca de uma para outra e encontra as mesmas telas.
//
// A aba mostrada acompanha a tela aberta: navegar por um link interno (um alerta
// que leva à Gestão de Docs, por exemplo) muda a aba sozinho, sem o usuário
// perceber descompasso entre o que está na tela e o que está marcado no topo.

function Icone({ item, formal }) {
  if (formal && MENU_SVG_ICONS[item.id]) {
    return <span style={{ display:"flex", alignItems:"center", width:16, justifyContent:"center", flexShrink:0 }}
      dangerouslySetInnerHTML={{ __html: MENU_SVG_ICONS[item.id] }} />;
  }
  if (formal) return null;
  return <span style={{ fontSize:13, flexShrink:0 }}>{item.icon}</span>;
}

// Busca "ir para": atalho de teclado para pular direto a qualquer tela, sem
// precisar acertar aba + subaba. Com ~28 telas, digitar é mais rápido que clicar.
function BuscaTelas({ telas, setTab, T }) {
  const [termo, setTermo] = useState("");
  const [aberto, setAberto] = useState(false);
  const [marcado, setMarcado] = useState(0);
  const caixaRef = useRef(null);
  const inputRef = useRef(null);

  const achados = useMemo(() => buscarTelas(telas, termo).slice(0, 8), [telas, termo]);

  useEffect(() => { setMarcado(0); }, [termo]);

  useEffect(() => {
    const fora = (e) => { if (caixaRef.current && !caixaRef.current.contains(e.target)) setAberto(false); };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  // Ctrl+K abre a busca de qualquer lugar do sistema.
  useEffect(() => {
    const atalho = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAberto(true);
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", atalho);
    return () => document.removeEventListener("keydown", atalho);
  }, []);

  const ir = (tela) => { setTab(tela.id); setTermo(""); setAberto(false); inputRef.current?.blur(); };

  const teclado = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setMarcado(i => Math.min(i + 1, achados.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setMarcado(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && achados[marcado]) { e.preventDefault(); ir(achados[marcado]); }
    else if (e.key === "Escape") { setAberto(false); inputRef.current?.blur(); }
  };

  return (
    <div ref={caixaRef} style={{ position:"relative", flex:"0 1 260px", minWidth:150 }}>
      <input
        ref={inputRef}
        value={termo}
        onChange={e => { setTermo(e.target.value); setAberto(true); }}
        onFocus={() => setAberto(true)}
        onKeyDown={teclado}
        placeholder="Ir para… (Ctrl+K)"
        aria-label="Buscar tela"
        style={{ width:"100%", background:T.surf, border:`1px solid ${T.border2}`, borderRadius:8,
          padding:"5px 10px", color:T.text, fontFamily:"inherit", fontSize:12, outline:"none" }}
      />
      {aberto && achados.length > 0 && (
        <div style={{ position:"absolute", left:0, right:0, top:"calc(100% + 6px)", background:T.card2,
          border:`1px solid ${T.border2}`, borderRadius:10, boxShadow:"0 16px 48px #0007", zIndex:400, overflow:"hidden" }}>
          {achados.map((tela, i) => (
            <button key={tela.id} onMouseEnter={() => setMarcado(i)} onClick={() => ir(tela)}
              style={{ width:"100%", display:"flex", alignItems:"center", gap:8, padding:"7px 11px", border:"none",
                background: i === marcado ? T.accentDim : "transparent", color: i === marcado ? T.accent : T.text2,
                cursor:"pointer", fontFamily:"inherit", fontSize:12, textAlign:"left" }}>
              <span style={{ flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{tela.label}</span>
              <span style={{ fontSize:10, color:T.text3, flexShrink:0 }}>{tela.caminho}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TopNav({ tab, setTab, rncs = [], desvios = [], isViewer, isAdmin, perm = () => true }) {
  const T = useTheme();
  const formal = useFormal();

  const grupos = useMemo(
    () => montarGrupos({ rncs, desvios, isViewer, isAdmin, perm }),
    [rncs, desvios, isViewer, isAdmin, perm]
  );
  const abas = useMemo(() => montarAbas(grupos), [grupos]);
  const telasBusca = useMemo(() => telasParaBusca(grupos), [grupos]);

  const abaAtiva = abaDaTela(abas, tab);
  // Aba que o usuário está OLHANDO: normalmente é a da tela aberta, mas ele pode
  // espiar outra aba sem navegar. Clicar numa tela sincroniza tudo de novo.
  const [abaVista, setAbaVista] = useState(abaAtiva);
  useEffect(() => { setAbaVista(abaAtiva); }, [abaAtiva]);

  const aba = abas.find(a => a.id === abaVista) || abas[0];

  const abrirAba = (a) => {
    setAbaVista(a.id);
    if (a.home) setTab("home");
    // Aba de assunto não navega sozinha: mostra as telas dela e espera a escolha.
    // Assim ninguém é jogado numa tela que não pediu só por clicar no topo.
  };

  return (
    <div className="top-nav no-print" style={{ background:T.surf, borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
      {/* Linha 1 — assuntos */}
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"0 1.25rem", borderBottom:`1px solid ${T.border}` }}>
        <div style={{ display:"flex", gap:2, overflowX:"auto", flex:1, scrollbarWidth:"none" }}>
          {abas.map(a => {
            const ativa = a.id === abaVista;
            return (
              <button key={a.id} onClick={() => abrirAba(a)}
                aria-current={a.id === abaAtiva ? "page" : undefined}
                style={{ display:"flex", alignItems:"center", gap:6, padding:"10px 14px", border:"none",
                  borderBottom:`2px solid ${ativa ? T.accent : "transparent"}`, background:"transparent",
                  color: ativa ? T.accent : T.text2, cursor:"pointer", fontFamily:"inherit",
                  fontSize:12.5, fontWeight: ativa ? 700 : 500, whiteSpace:"nowrap", transition:"color .15s" }}>
                {a.label}
                {a.badge > 0 && (
                  <span style={{ background:T.red, color:"#fff", fontSize:9, fontWeight:700, borderRadius:10, padding:"1px 5px" }}>
                    {a.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <BuscaTelas telas={telasBusca} setTab={setTab} T={T} />
      </div>

      {/* Linha 2 — telas da aba escolhida */}
      {aba && aba.telas.length > 0 && (
        <div style={{ display:"flex", gap:4, padding:"6px 1.25rem", overflowX:"auto", background:T.bg, scrollbarWidth:"none" }}>
          {aba.telas.map(tela => {
            const ativa = tela.id === tab;
            return (
              <button key={tela.id} onClick={() => setTab(tela.id)}
                style={{ display:"flex", alignItems:"center", gap:6, padding:"5px 11px",
                  border:`1px solid ${ativa ? `${T.accent}33` : "transparent"}`, borderRadius:7,
                  background: ativa ? T.accentDim : "transparent", color: ativa ? T.accent : T.text2,
                  cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight: ativa ? 600 : 400,
                  whiteSpace:"nowrap", transition:"all .15s" }}>
                <Icone item={tela} formal={formal} />
                {tela.label}
                {(tela.badge || 0) > 0 && (
                  <span style={{ background:T.red, color:"#fff", fontSize:9, fontWeight:700, borderRadius:10, padding:"1px 5px" }}>
                    {tela.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

import React, { useEffect, useMemo, useState } from "react";
import { useTheme } from "../../core/theme";
import { useS } from "../../shared/styles";
import { rncAtiva } from "../../core/status";
import { tod } from "../../core/utils";
import { getCollection, subscribeCollection } from "../../firebase";
import { pendentesDoUsuario } from "../documentos/treinamento";
import { montarPendencias, resumoPendencias, URGENCIA } from "./pendencias";

// Tela inicial da repaginação — onda 2.
//
// A antiga abria com "Ações rápidas" (quatro botões que repetem o menu) e um
// banner de produto no espaço nobre, reservava o maior painel para dizer que a
// fila estava vazia, e escondia numa coluna estreita o que realmente exige ação.
// Esta abre respondendo uma pergunta: o que precisa de mim agora.
//
// Os indicadores não sumiram — desceram para o rodapé, como contexto.

const CORES = (T) => ({
  [URGENCIA.CRITICO]: T.red,
  [URGENCIA.ATENCAO]: T.yellow,
});

const ROTULO_FONTE = {
  rnc: "RNC", desvio: "Desvio", laudo: "Laudo", ipc: "IPC",
  treinamento: "Treinamento", documento: "Documento",
};

function LinhaPendencia({ p, setTab, T }) {
  const cor = CORES(T)[p.urgencia] || T.text3;
  return (
    <button
      onClick={() => setTab(p.tab)}
      style={{ width:"100%", display:"flex", alignItems:"center", gap:12, padding:"11px 14px",
        background:"transparent", border:"none", borderBottom:`1px solid ${T.border}`,
        cursor:"pointer", fontFamily:"inherit", textAlign:"left" }}
    >
      <span style={{ width:3, alignSelf:"stretch", borderRadius:2, background:cor, flexShrink:0, minHeight:28 }} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:600, color:T.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
          {p.titulo}
        </div>
        {p.detalhe && (
          <div style={{ fontSize:11, color:T.text3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {p.detalhe}
          </div>
        )}
      </div>
      {p.minha && (
        <span style={{ fontSize:9, fontWeight:700, color:T.accent, background:T.accentDim,
          border:`1px solid ${T.accent}33`, borderRadius:20, padding:"2px 8px", flexShrink:0 }}>
          VOCÊ
        </span>
      )}
      <span style={{ fontSize:10, color:T.text3, flexShrink:0, minWidth:58, textAlign:"right" }}>
        {ROTULO_FONTE[p.fonte] || p.fonte}
      </span>
      {p.dias > 0 && (
        <span style={{ fontSize:11, fontWeight:700, color:cor, flexShrink:0, minWidth:64, textAlign:"right",
          fontVariantNumeric:"tabular-nums" }}>
          {p.dias}d
        </span>
      )}
    </button>
  );
}

function Indicador({ n, l, cor, T }) {
  return (
    <div style={{ background:T.surf, border:`1px solid ${T.border}`, borderRadius:10, padding:"10px 14px", flex:"1 1 130px" }}>
      <div style={{ fontSize:20, fontWeight:700, color:cor || T.text, fontVariantNumeric:"tabular-nums", lineHeight:1.15 }}>{n}</div>
      <div style={{ fontSize:10, color:T.text3, textTransform:"uppercase", letterSpacing:".06em", fontWeight:600 }}>{l}</div>
    </div>
  );
}

export function PrecisaDeVoce({ rncs = [], desvios = [], user, setTab, perm = () => true, docNotifs = [],
  colaboradores = [], catalogoCargos = [], catalogoAreas = [] }) {
  const T = useTheme(); const s = useS();
  const hoje = tod();

  const [laudos, setLaudos] = useState([]);
  const [ipc, setIpc] = useState([]);
  const [pendentesTreino, setPendentesTreino] = useState([]);

  useEffect(() => {
    const u1 = subscribeCollection("laudos", list => setLaudos(list || []));
    const u2 = subscribeCollection("ipc_registros", list => setIpc(list || []));
    return () => { u1 && u1(); u2 && u2(); };
  }, []);

  // Treinamento: busca one-shot, igual ao alerta do App — a regra de quem deve
  // treinar mora em `treinamento.js` e é reaproveitada, não reimplementada.
  useEffect(() => {
    if (!user?.uid) return;
    let vivo = true;
    (async () => {
      try {
        const [docs, evid] = await Promise.all([getCollection("gestao_docs"), getCollection("treinamentos")]);
        if (!vivo) return;
        setPendentesTreino(pendentesDoUsuario({
          docs: docs || [], pessoas: colaboradores, evidencias: evid || [],
          catalogoCargos, catalogoAreas, userId: String(user.uid), hoje,
        }));
      } catch { /* a tela vive sem isto; não pode quebrar o login */ }
    })();
    return () => { vivo = false; };
  }, [user?.uid, colaboradores, catalogoCargos, catalogoAreas, hoje]);

  const pendencias = useMemo(() => montarPendencias({
    rncs, desvios, laudos, ipc, docNotifs, pendentesTreino,
    userName: user?.name || "", podeAssinar: perm("assinarLaudo") || perm("verLaudos"), hoje,
  }), [rncs, desvios, laudos, ipc, docNotifs, pendentesTreino, user?.name, perm, hoje]);

  const resumo = resumoPendencias(pendencias);
  const [verTudo, setVerTudo] = useState(false);
  const mostradas = verTudo ? pendencias : pendencias.slice(0, 8);

  const eficazes = rncs.filter(x => x.status === "Eficaz").length;
  const taxaEf = rncs.length ? Math.round((eficazes / rncs.length) * 100) : 0;
  const hora = new Date().getHours();
  const saud = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

  return (
    <div style={{ padding:"1.5rem", display:"flex", flexDirection:"column", gap:16 }}>
      <div>
        <div style={{ fontSize:11, color:T.text3, textTransform:"uppercase", letterSpacing:".1em", fontWeight:600 }}>
          {saud}, {user?.name?.split(" ")[0]}
        </div>
        <h1 style={{ fontSize:24, fontWeight:700, color:T.text, margin:"2px 0 4px", letterSpacing:"-.02em" }}>
          Precisa de você
        </h1>
        <div style={{ fontSize:12, color:T.text2 }}>
          {resumo.total === 0
            ? "Nada pendente — tudo em dia."
            : <>{resumo.total} item(ns){resumo.criticas > 0 && <>, <strong style={{ color:T.red }}>{resumo.criticas} em atraso</strong></>}
              {resumo.minhas > 0 && <> · {resumo.minhas} atribuído(s) a você</>}</>}
        </div>
      </div>

      <div style={{ ...s.card, padding:0, overflow:"hidden" }}>
        {pendencias.length === 0 ? (
          <div style={{ display:"flex", alignItems:"center", gap:12, padding:"18px 16px" }}>
            <span style={{ fontSize:22 }}>✅</span>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:T.text }}>Nenhuma pendência</div>
              <div style={{ fontSize:11, color:T.text3 }}>Sem prazo vencido, desvio parado ou treinamento em atraso.</div>
            </div>
          </div>
        ) : (
          <>
            {mostradas.map(p => <LinhaPendencia key={p.id} p={p} setTab={setTab} T={T} />)}
            {pendencias.length > 8 && (
              <button onClick={() => setVerTudo(v => !v)}
                style={{ width:"100%", padding:"9px", background:"transparent", border:"none", color:T.accent,
                  cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:600 }}>
                {verTudo ? "Mostrar menos" : `Ver todas as ${pendencias.length}`}
              </button>
            )}
          </>
        )}
      </div>

      {/* Indicadores viram contexto — deixaram de disputar o topo da tela. */}
      <div>
        <div style={{ fontSize:10, color:T.text3, textTransform:"uppercase", letterSpacing:".1em",
          fontWeight:700, marginBottom:8 }}>Panorama</div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <Indicador T={T} n={rncs.length} l="Total RNCs" />
          <Indicador T={T} n={rncs.filter(x => x.status === "Aberta").length} l="Abertas" />
          <Indicador T={T} n={rncs.filter(x => x.sev === "Crítica" && rncAtiva(x.status)).length} l="Críticas" cor={T.red} />
          <Indicador T={T} n={`${taxaEf}%`} l="Taxa de eficácia" cor={taxaEf < 50 ? T.red : T.accent} />
          <Indicador T={T} n={desvios.filter(d => d.status === "Registrado").length} l="Desvios a triar" />
        </div>
      </div>
    </div>
  );
}

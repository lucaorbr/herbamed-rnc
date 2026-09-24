import React, { useEffect, useState } from "react";
import { useTheme } from "../core/theme";
import { useS } from "./styles";
import { PERSONALIZADO, PRESETS, PRESETS_PAINEL, dataDigitadaCompleta, rotuloPeriodo } from "./periodoLogic";

// Tela do filtro de período dos indicadores. A regra mora em `periodoLogic.js`.
//
// As datas "de/até" ficam SEMPRE visíveis, mostrando o que o atalho escolhido
// significa ("6 meses" = 01/04 a 23/09). Mexer numa delas vira "personalizado"
// mantendo a outra ponta — é assim que se chega ao "de x até y".

/**
 * Campo de data com rascunho próprio. O campo nativo entrega um valor a cada
 * tecla (ano 0002, 0020, 0202…); só a data completa segue para o filtro. Sem o
 * rascunho, o React devolveria ao campo o valor antigo a cada tecla recusada.
 * Fora de foco, o campo mostra o período vigente (inclusive quando um atalho muda).
 */
function CampoData({ valor, onCommit, ...props }) {
  const [rascunho, setRascunho] = useState(valor || "");
  const [foco, setFoco] = useState(false);
  useEffect(() => { if (!foco) setRascunho(valor || ""); }, [valor, foco]);
  return (
    <input type="date" {...props} value={rascunho}
      onFocus={() => setFoco(true)}
      onBlur={() => setFoco(false)}
      onChange={e => {
        const v = e.target.value;
        setRascunho(v);
        if (dataDigitadaCompleta(v) && v !== valor) onCommit(v);
      }} />
  );
}

const chave = tela => `sgq_periodo:${tela}`;

/**
 * Período escolhido numa tela, lembrado por tela no navegador de cada pessoa.
 * O que se guarda é a ESCOLHA (`{ preset, de, ate }`), não as datas calculadas:
 * "Mês atual" escolhido em setembro tem de virar outubro sozinho.
 * localStorage pode falhar (aba anônima, bloqueio) — aí vale o padrão.
 */
export function usePeriodo(tela, presetPadrao = "12m") {
  const [sel, setSel] = useState(() => {
    try {
      const v = JSON.parse(localStorage.getItem(chave(tela)) || "null");
      if (v && (PRESETS[v.preset] || v.preset === PERSONALIZADO)) return v;
    } catch { /* sem armazenamento: usa o padrão */ }
    return { preset: presetPadrao };
  });
  const mudar = v => {
    setSel(v);
    try { localStorage.setItem(chave(tela), JSON.stringify(v)); } catch { /* idem */ }
  };
  return [sel, mudar];
}

/**
 * - `sel` / `onChange`: a escolha, de `usePeriodo`.
 * - `periodo`: o período já resolvido (`resolverPeriodo`) — é o que aparece nas datas.
 * - `presets`: quais atalhos mostrar.
 * - `children`: coisas da própria tela à direita (contador, exportar…).
 */
export function FiltroPeriodo({ sel, onChange, periodo, presets = PRESETS_PAINEL, children }) {
  const T = useTheme(); const s = useS();
  const chip = ativo => ({
    padding: "6px 13px", borderRadius: 20, cursor: "pointer", fontFamily: "inherit", fontSize: 12,
    border: `1px solid ${ativo ? T.accent : T.border}`, background: ativo ? T.accentDim : "transparent",
    color: ativo ? T.accent : T.text2, fontWeight: ativo ? 700 : 400,
  });
  const data = { ...s.inp, width: 142, padding: "6px 10px", fontSize: 12, colorScheme: T.light ? "light" : "dark" };
  const personalizado = sel.preset === PERSONALIZADO;

  const mudarData = (ponta, valor) => onChange({
    preset: PERSONALIZADO,
    de: periodo?.de, ate: periodo?.ate,
    [ponta]: valor,
  });

  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
      {presets.map(id => (
        <button key={id} type="button" onClick={() => onChange({ preset: id })} style={chip(sel.preset === id)}>
          {PRESETS[id].label}
        </button>
      ))}
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", padding: "3px 8px", borderRadius: 10, border: `1px solid ${personalizado ? T.accent : "transparent"}`, background: personalizado ? T.accentDim : "transparent" }}
        title={periodo ? `Período: ${rotuloPeriodo(periodo)}` : undefined}>
        <span style={{ fontSize: 12, color: personalizado ? T.accent : T.text3, fontWeight: personalizado ? 700 : 400 }}>De</span>
        <CampoData aria-label="Início do período" valor={periodo?.de} onCommit={v => mudarData("de", v)} style={data} />
        <span style={{ fontSize: 12, color: personalizado ? T.accent : T.text3, fontWeight: personalizado ? 700 : 400 }}>até</span>
        <CampoData aria-label="Fim do período" valor={periodo?.ate} onCommit={v => mudarData("ate", v)} style={data} />
      </div>
      {children && <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>{children}</div>}
    </div>
  );
}

/** Aviso padrão para bloco que mostra a situação de HOJE e não obedece ao filtro. */
export function SituacaoAtual({ children = "Situação atual — independe do período" }) {
  const T = useTheme();
  return <span style={{ fontSize: 10, color: T.text3, fontStyle: "italic" }}>{children}</span>;
}

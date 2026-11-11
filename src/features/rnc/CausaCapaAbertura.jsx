import React, { useState } from "react";
import { useTheme } from "../../core/theme";
import { useS } from "../../shared/styles";
import { F, Inp, SecTitle, TA } from "../../shared/ui";
import { MIN_PORQUES } from "./ferramentasLogic";
import { IshikawaEspinha, SeletorVistaIshikawa, useVistaIshikawa } from "./IshikawaEspinha";

// Aba "Causa e CAPA" da abertura da RNC interna (v3.30.0). Opcional: quem já sabe a
// causa registra os 5 Porquês e o plano junto com a RNC; senão, faz depois na ficha.
// O estado mora no NovaTab (ishikawa / w2h) e é gravado com a RNC.
// O Ishikawa entra recolhido (opcional), como na ficha.

const CATS = [["mao", "Mão de obra"], ["maquina", "Máquina"], ["metodo", "Método"], ["material", "Material"], ["medicao", "Medição"], ["meioamb", "Meio ambiente"]];
const VAZIO_CAUSAS = { mao: [], maquina: [], metodo: [], material: [], medicao: [], meioamb: [] };
const PERGUNTAS = ["Por que ocorreu?", "Por que isso aconteceu?", "Por que essa causa existe?", "Por que não foi controlado?", "Por que não foi evitado?"];

const novaAcao = autor => ({ id: String(Date.now() + Math.random()), tipo: "Corretiva", what: "", why: "", who: autor || "", where: "", when: "", how: "", howMuch: "", status: "Pendente", evidencias: [] });

export function CausaCapaAbertura({ ishikawa, setIshikawa, w2h, setW2h, autor, erros = [], efeitoPadrao = "" }) {
  const T = useTheme(); const s = useS();
  const whys = [...(ishikawa.whys || []), "", "", "", "", ""].slice(0, 5);
  const nPorques = whys.filter(w => w.trim()).length;
  const completa = nPorques >= MIN_PORQUES && (ishikawa.root || "").trim();

  const setWhy = (i, v) => setIshikawa(p => { const w = [...(p.whys || []), "", "", "", "", ""].slice(0, 5); w[i] = v; return { ...p, whys: w }; });
  const upd = (i, k, v) => setW2h(p => p.map((a, j) => (j === i ? { ...a, [k]: v } : a)));
  const erroGeral = erros.find(e => !/^Ação #\d+:/.test(e));
  const causes = { ...VAZIO_CAUSAS, ...(ishikawa.causes || {}) };
  const nCausas = Object.values(causes).reduce((n, v) => n + (v?.length || 0), 0);
  const [ishiAberto, setIshiAberto] = useState(nCausas > 0);
  const [inps, setInps] = useState({});
  const [vista, setVista] = useVistaIshikawa();
  const comCausas = (p, cat, lista) => ({ ...p, causes: { ...VAZIO_CAUSAS, ...(p.causes || {}), [cat]: lista } });
  const addC = cat => { const v = (inps[cat] || "").trim(); if (!v) return; setIshikawa(p => comCausas(p, cat, [...((p.causes || {})[cat] || []), v])); setInps(p => ({ ...p, [cat]: "" })); };
  const remC = (cat, i) => setIshikawa(p => comCausas(p, cat, ((p.causes || {})[cat] || []).filter((_, j) => j !== i)));
  const aprofundar = c => setIshikawa(p => ({ ...p, whyCausa: p.whyCausa === c ? "" : c }));
  const rot = { fontSize: 10, color: T.text3, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em" };

  return (
    <div>
      <div style={{ fontSize: 12, color: T.text2, background: T.surf, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px", marginBottom: 12 }}>
        <b>Opcional.</b> Se a causa já é conhecida, registre aqui a análise e o plano CAPA junto com a RNC. Se não, deixe em branco e faça depois na ficha (etapas 3 e 4).
      </div>

      <div style={{ ...s.card, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={() => setIshiAberto(o => !o)} aria-expanded={ishiAberto} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
            <SecTitle icon="🐟" ch={`Ishikawa — 6M${nCausas ? ` (${nCausas})` : ""} ${ishiAberto ? "▾" : "▸"}`} />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: T.text3 }}>Opcional · levanta as causas possíveis; clique numa causa para aprofundá-la nos 5 Porquês</span>
            {ishiAberto && <SeletorVistaIshikawa vista={vista} setVista={setVista} />}
          </div>
        </div>
        {ishiAberto && vista === "espinha" && (
          <div style={{ marginTop: 10 }}><IshikawaEspinha ishikawa={{ ...ishikawa, efeito: ishikawa.efeito || efeitoPadrao }} onMarcar={aprofundar} /></div>
        )}
        {ishiAberto && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10, marginTop: 8 }}>
            {CATS.map(([cat, label]) => (
              <div key={cat} style={{ background: T.surf, border: `1px solid ${T.border}`, borderRadius: 8, padding: 10 }}>
                <div style={{ ...rot, marginBottom: 6 }}>{label}</div>
                <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  <Inp placeholder="Adicionar causa…" value={inps[cat] || ""} onChange={e => setInps(p => ({ ...p, [cat]: e.target.value }))} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addC(cat); } }} sx={{ flex: 1, fontSize: 12 }} />
                  <button type="button" style={{ ...s.btnA, padding: "6px 10px" }} onClick={() => addC(cat)} aria-label={`Adicionar causa em ${label}`}>+</button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {causes[cat].map((c, i) => {
                    const sel = ishikawa.whyCausa === c;
                    return (
                      <span key={i} onClick={() => aprofundar(c)} title="Aprofundar nos 5 Porquês"
                        style={{ display: "inline-flex", alignItems: "center", gap: 4, background: sel ? T.accentDim : T.card2, border: `1px solid ${sel ? T.accent + "66" : T.border2}`, borderRadius: 20, padding: "3px 10px", fontSize: 11, color: sel ? T.accent : T.text2, cursor: "pointer" }}>
                        {c}<span onClick={ev => { ev.stopPropagation(); remC(cat, i); }} style={{ color: T.text3, marginLeft: 2 }} aria-label="Remover">✕</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ ...s.card, marginBottom: 14 }}>
        <SecTitle icon="❓" ch="5 Porquês" />
        {ishikawa.whyCausa && <div style={{ fontSize: 12, color: T.text2, marginBottom: 8 }}>Aprofundando: <b style={{ color: T.accent }}>{ishikawa.whyCausa}</b></div>}
        {PERGUNTAS.map((q, i) => (
          <F key={i} lbl={`${i + 1}º porquê`} ch={<Inp value={whys[i]} placeholder={q} onChange={e => setWhy(i, e.target.value)} />} />
        ))}
        <F lbl="🎯 Causa raiz identificada" tip="A causa fundamental que, se eliminada, evita que o problema se repita. É sobre ela que o plano CAPA é montado." ch={<TA rows={2} value={ishikawa.root || ""} onChange={e => setIshikawa(p => ({ ...p, root: e.target.value }))} placeholder="A causa raiz é…" />} />
        <div style={{ fontSize: 12, color: completa ? T.accent : T.text3 }}>
          {completa ? "✓ Análise completa — dá para incluir o plano CAPA abaixo." : `Para incluir ações CAPA: ${nPorques < MIN_PORQUES ? `faltam ${MIN_PORQUES - nPorques} porquê(s)` : ""}${nPorques < MIN_PORQUES && !(ishikawa.root || "").trim() ? " e " : ""}${!(ishikawa.root || "").trim() ? "a causa raiz" : ""}.`}
        </div>
      </div>

      <div style={s.card}>
        <SecTitle icon="📋" ch="Plano CAPA" />
        {erroGeral && <div style={{ fontSize: 12, color: T.red, marginBottom: 8 }}>{erroGeral}</div>}
        {!w2h.length && <div style={{ fontSize: 12, color: T.text3, marginBottom: 10 }}>Nenhuma ação. O prazo da ação corretiva passa a ser o da ação mais tardia.</div>}
        {w2h.map((a, i) => {
          const erro = erros.find(e => e.startsWith(`Ação #${i + 1}:`));
          return (
            <div key={a.id} style={{ background: T.surf, border: `1px solid ${erro ? T.red + "88" : T.border}`, borderRadius: 8, padding: "12px", marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.accent, textTransform: "uppercase" }}>Ação #{i + 1}</span>
                  <select aria-label="Tipo da ação" value={a.tipo} onChange={e => upd(i, "tipo", e.target.value)} style={{ ...s.inp, width: "auto", fontSize: 11, padding: "3px 8px" }}>
                    <option>Corretiva</option><option>Preventiva</option>
                  </select>
                </div>
                <button style={s.btnD} onClick={() => setW2h(p => p.filter((_, j) => j !== i))}>✕ Remover</button>
              </div>
              {erro && <div style={{ fontSize: 12, color: T.red, marginBottom: 8 }}>{erro.replace(/^Ação #\d+: /, "")}</div>}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10 }}>
                <F lbl="O quê? *" ch={<Inp placeholder="Ação a executar" value={a.what} onChange={e => upd(i, "what", e.target.value)} />} />
                <F lbl="Quem? *" tip="Responsável pela execução — nome específico, não setor." ch={<Inp value={a.who} onChange={e => upd(i, "who", e.target.value)} />} />
                <F lbl="Quando? *" ch={<Inp type="date" value={a.when} onChange={e => upd(i, "when", e.target.value)} />} />
              </div>
              <F lbl="Como?" ch={<TA rows={2} value={a.how} onChange={e => upd(i, "how", e.target.value)} />} />
            </div>
          );
        })}
        <button style={{ ...s.btn, width: "100%", borderStyle: "dashed", color: T.text2, opacity: completa ? 1 : .5 }} disabled={!completa}
          title={completa ? "" : "Preencha a análise de causa primeiro"} onClick={() => setW2h(p => [...p, novaAcao(autor)])}>+ Adicionar ação</button>
        <div style={{ fontSize: 11, color: T.text3, marginTop: 8 }}>Onde, custo e evidências de execução ficam na ficha da RNC, na etapa 4.</div>
      </div>
    </div>
  );
}

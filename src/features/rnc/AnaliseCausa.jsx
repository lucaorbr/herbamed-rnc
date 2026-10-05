import React, { useState } from "react";
import { useTheme } from "../../core/theme";
import { fmt, past, tod } from "../../core/utils";
import { useS } from "../../shared/styles";
import { F, Inp, SecTitle, SevB, TA } from "../../shared/ui";
import { Table } from "../../shared/Table";
import { andamentoPatch } from "./RncTabs";
import { ofertaNotificar } from "../email/ofertaNotificar";
import { MIN_PORQUES, filaAnaliseCausa, partirDaRespostaFornecedor, porquesPreenchidos, resumoAnaliseCausa } from "./ferramentasLogic";

// Etapa 3 da ficha da RNC (onda 3): Ishikawa (opcional) + 5 Porquês (obrigatório, mín. 3)
// + causa raiz, editados DENTRO da RNC e salvos juntos. Substitui a antiga tela solta
// "Ishikawa / 5 Porquês", que começava com uma lista de todas as RNCs para escolher.

const CATS = [["mao", "Mão de obra"], ["maquina", "Máquina"], ["metodo", "Método"], ["material", "Material"], ["medicao", "Medição"], ["meioamb", "Meio ambiente"]];
const VAZIO_CAUSAS = { mao: [], maquina: [], metodo: [], material: [], medicao: [], meioamb: [] };
const PERGUNTAS = ["Por que ocorreu?", "Por que isso aconteceu?", "Por que essa causa existe?", "Por que não foi controlado?", "Por que não foi evitado?"];

async function pedirIA(prompt, maxTokens) {
  const res = await fetch("/api/claude", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-5", max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
  });
  const data = await res.json();
  const txt = data.content?.[0]?.text || "";
  return JSON.parse(txt.replace(/```json|```/g, "").trim());
}

/**
 * Editor da análise de causa. `gravar(patch)` vem da ficha (grava e já mostra).
 * O estado nasce da RNC e não é substituído pelas releituras do servidor — o que está
 * sendo digitado não some. A ficha remonta o editor ao trocar de RNC (key).
 */
export function AnaliseCausaEditor({ r, user, toast_, openEmail, gravar }) {
  const T = useTheme(); const s = useS();
  const autor = user?.name || "—";
  const ishi = r.ishikawa || {};
  const [efeito, setEfeito] = useState(ishi.efeito || (r.desc || "").split("\n")[0].substring(0, 120));
  const [causes, setCauses] = useState({ ...VAZIO_CAUSAS, ...(ishi.causes || {}) });
  const [inps, setInps] = useState({});
  const [wCausa, setWCausa] = useState(ishi.whyCausa || "");
  const [whys, setWhys] = useState(ishi.whys?.length ? [...ishi.whys, "", "", "", "", ""].slice(0, 5) : ["", "", "", "", ""]);
  const [root, setRoot] = useState(ishi.root || "");
  const [usouFornecedor, setUsouFornecedor] = useState(false);
  const [carregandoIA, setCarregandoIA] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [ishiAberto, setIshiAberto] = useState(Object.values(ishi.causes || {}).some(v => v?.length));

  const addC = cat => { const v = (inps[cat] || "").trim(); if (!v) return; setCauses(p => ({ ...p, [cat]: [...p[cat], v] })); setInps(p => ({ ...p, [cat]: "" })); };
  const remC = (cat, i) => setCauses(p => ({ ...p, [cat]: p[cat].filter((_, j) => j !== i) }));

  const nPorques = whys.filter(w => w?.trim()).length;
  const completa = nPorques >= MIN_PORQUES && root.trim();
  const temForn = r.respostaFornecedor?.porques?.some(p => p?.trim()) || r.respostaFornecedor?.causaRaiz?.trim();

  const gerarIshikawaIA = async () => {
    if (!efeito.trim()) { alert("Preencha o efeito/problema primeiro."); return; }
    setCarregandoIA("ishikawa");
    try {
      const p = await pedirIA(`Você é especialista em qualidade farmacêutica (BPF, ANVISA). Para o problema abaixo, sugira causas potenciais para o diagrama de Ishikawa em uma indústria nutracêutica.

Problema: ${efeito}
Produto: ${r.produto || ""}
Tipo de NC: ${r.tipo || ""}

Responda APENAS em JSON sem markdown:
{"mao":["causa1","causa2"],"maquina":["causa1","causa2"],"metodo":["causa1","causa2"],"material":["causa1","causa2"],"medicao":["causa1","causa2"],"meioamb":["causa1","causa2"]}`, 1500);
      setCauses(prev => Object.fromEntries(CATS.map(([k]) => [k, [...(prev[k] || []), ...(p[k] || [])]])));
      setIshiAberto(true);
      toast_("Causas sugeridas pela IA. Revise antes de salvar.", "green");
    } catch { toast_("Erro ao gerar com IA.", "red"); }
    setCarregandoIA("");
  };

  const gerarPorquesIA = async () => {
    if (!wCausa.trim()) { alert("Informe a causa a aprofundar primeiro (clique numa causa do Ishikawa ou digite)."); return; }
    setCarregandoIA("porques");
    try {
      const p = await pedirIA(`Você é especialista em qualidade farmacêutica. Gere a análise dos 5 Porquês para a causa abaixo em uma indústria nutracêutica.

Problema: ${r.desc || ""}
Causa a aprofundar: ${wCausa}
Produto: ${r.produto || ""}

Responda APENAS em JSON sem markdown:
{"porques":["Por que 1?","Por que 2?","Por que 3?","Por que 4?","Por que 5?"],"causaRaiz":"causa raiz fundamental identificada"}`, 800);
      if (p.porques?.length) setWhys([...p.porques, "", "", "", "", ""].slice(0, 5));
      if (p.causaRaiz) setRoot(p.causaRaiz);
      toast_("5 Porquês sugeridos pela IA. Revise antes de salvar.", "green");
    } catch { toast_("Erro ao gerar com IA.", "red"); }
    setCarregandoIA("");
  };

  const usarFornecedor = () => {
    const res = partirDaRespostaFornecedor(whys, root, r.respostaFornecedor);
    if (!res.aproveitou) { toast_("Os campos já estão preenchidos — nada foi alterado.", "yellow"); return; }
    setWhys(res.whys); setRoot(res.root); setUsouFornecedor(true);
    toast_("Resposta do fornecedor copiada para os campos vazios. Revise antes de salvar.", "green");
  };

  const salvar = async () => {
    const novo = { ...ishi, efeito, causes, whys, root, whyCausa: wCausa };
    const detalhes = resumoAnaliseCausa(ishi, novo);
    if (efeito !== (ishi.efeito || "")) detalhes.unshift("Efeito analisado atualizado");
    if (!detalhes.length) { toast_("Nada mudou na análise.", "yellow"); return; }
    // Causa raiz trocada depois de montado o plano CAPA: o plano foi feito para a antiga.
    const trocouRaiz = (ishi.root || "").trim() && (ishi.root || "").trim() !== root.trim();
    if (trocouRaiz && (r.w2h || []).length && !window.confirm("Já existe plano CAPA montado sobre a causa raiz anterior. Confirma a troca? Revise as ações na etapa 4 depois.")) return;
    if (usouFornecedor) detalhes.push("Partiu da resposta do fornecedor como ponto de partida");
    let historico = [...(r.historico || []), { data: tod(), hora: new Date().toLocaleTimeString("pt-BR"), acao: "Análise de causa atualizada", detalhes, resp: autor, tipo: "analise" }];
    const patch = { ishikawa: novo };
    const ap = andamentoPatch(r, "análise de causa iniciada", autor);
    if (ap) { patch.status = ap.status; historico = [...historico, ap.hEntry]; }
    patch.historico = historico;
    setSalvando(true);
    try {
      await gravar(patch);
      setUsouFornecedor(false);
      toast_(completa ? "Análise de causa salva — plano CAPA liberado." : "Análise salva como rascunho.", "green", ofertaNotificar({ ...r, ...patch }, "ishikawa", openEmail));
    } catch { /* doUpdateRNC já avisou */ }
    setSalvando(false);
  };

  const rot = { fontSize: 10, color: T.text3, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em" };
  const btnIA = (tipo, rotulo, fn) => (
    <button style={{ ...s.btn, fontSize: 11, padding: "5px 10px", opacity: carregandoIA ? .6 : 1 }} disabled={!!carregandoIA} onClick={fn}>
      {carregandoIA === tipo ? "⟳ Gerando…" : `🤖 ${rotulo}`}
    </button>
  );

  return (
    <div>
      <F lbl="Efeito / problema analisado" tip="O problema que está sendo analisado — normalmente a própria não conformidade, em uma frase." ch={<Inp value={efeito} onChange={e => setEfeito(e.target.value)} />} />

      {/* Ishikawa — opcional */}
      <div style={{ ...s.card, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setIshiAberto(o => !o)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
            <SecTitle icon="🐟" ch={`Ishikawa — 6M ${ishiAberto ? "▾" : "▸"}`} />
          </button>
          <span style={{ fontSize: 11, color: T.text3 }}>Opcional · levanta as causas possíveis; clique numa causa para aprofundar nos 5 Porquês</span>
        </div>
        {ishiAberto && (
          <>
            <div style={{ textAlign: "right", marginBottom: 10 }}>{btnIA("ishikawa", "Sugerir causas com IA", gerarIshikawaIA)}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
              {CATS.map(([cat, label]) => (
                <div key={cat} style={{ background: T.surf, border: `1px solid ${T.border}`, borderRadius: 8, padding: 10 }}>
                  <div style={{ ...rot, marginBottom: 6 }}>{label}</div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                    <Inp placeholder="Adicionar causa…" value={inps[cat] || ""} onChange={e => setInps(p => ({ ...p, [cat]: e.target.value }))} onKeyDown={e => e.key === "Enter" && addC(cat)} sx={{ flex: 1, fontSize: 12 }} />
                    <button style={{ ...s.btnA, padding: "6px 10px" }} onClick={() => addC(cat)} aria-label={`Adicionar causa em ${label}`}>+</button>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {causes[cat].map((c, i) => (
                      <span key={i} onClick={() => setWCausa(c)} title="Aprofundar nos 5 Porquês"
                        style={{ display: "inline-flex", alignItems: "center", gap: 4, background: wCausa === c ? T.accentDim : T.card2, border: `1px solid ${wCausa === c ? T.accent + "66" : T.border2}`, borderRadius: 20, padding: "3px 10px", fontSize: 11, color: wCausa === c ? T.accent : T.text2, cursor: "pointer" }}>
                        {c}<span onClick={ev => { ev.stopPropagation(); remC(cat, i); }} style={{ color: T.text3, marginLeft: 2 }} aria-label="Remover">✕</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 5 Porquês — obrigatório */}
      <div style={{ ...s.card, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <SecTitle icon="🔍" ch={`5 Porquês — ${nPorques} de 5`} />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {temForn && <button style={{ ...s.btn, fontSize: 11, padding: "5px 10px" }} onClick={usarFornecedor} title="Copia a análise enviada pelo fornecedor só para os campos ainda vazios">Usar resposta do fornecedor</button>}
            {btnIA("porques", "Gerar com IA", gerarPorquesIA)}
          </div>
        </div>
        <F lbl="Causa a aprofundar" tip="A causa mais provável — clique numa causa do Ishikawa ou escreva aqui." ch={<Inp value={wCausa} onChange={e => setWCausa(e.target.value)} />} />
        {PERGUNTAS.map((q, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ minWidth: 26, height: 26, borderRadius: "50%", background: whys[i]?.trim() ? T.accent : T.border, color: whys[i]?.trim() ? "#fff" : T.text3, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600 }}>{i + 1}</div>
            <Inp placeholder={q} value={whys[i]} onChange={e => { const n = [...whys]; n[i] = e.target.value; setWhys(n); }} sx={{ flex: 1 }} />
          </div>
        ))}
        <F lbl="🎯 Causa raiz identificada" tip="A causa fundamental que, se eliminada, evita que o problema se repita. Específica e acionável — é sobre ela que o plano CAPA será montado." ch={<TA rows={2} value={root} onChange={e => setRoot(e.target.value)} placeholder="A causa raiz é…" sx={{ borderColor: T.accent }} />} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, color: completa ? T.accent : T.text2 }}>
          {completa ? "✓ Análise completa — o plano CAPA fica liberado ao salvar." : `Para liberar o plano CAPA: ${nPorques < MIN_PORQUES ? `faltam ${MIN_PORQUES - nPorques} porquê(s)` : ""}${nPorques < MIN_PORQUES && !root.trim() ? " e " : ""}${!root.trim() ? "a causa raiz" : ""}. Dá para salvar como rascunho.`}
        </div>
        <button style={{ ...s.btnA, opacity: salvando ? .6 : 1 }} disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar análise de causa"}</button>
      </div>
    </div>
  );
}

/** Antiga tela "Ishikawa / 5 Porquês": agora a fila das RNCs que aguardam análise de causa. */
export function FilaAnaliseCausa({ rncs, abrirRnc }) {
  const T = useTheme();
  const fila = filaAnaliseCausa(rncs);
  const colunas = [
    { key: "num", label: "Nº", render: r => <span style={{ color: T.accent, fontWeight: 700, fontSize: 11 }}>{r.num}</span> },
    { key: "desc", label: "Descrição", maxWidth: 280, nowrap: true, render: r => r.desc },
    { key: "sev", label: "Sev.", render: r => <SevB s={r.sev} /> },
    { key: "resp", label: "Responsável", render: r => r.resp || "—" },
    { key: "prazoCausa", label: "Prazo da análise", render: r => {
      const v = past(r.prazoCausa);
      return <span style={{ color: v ? T.red : T.text2, fontWeight: v ? 600 : 400 }}>{v ? "⚠ " : ""}{r.prazoCausa ? fmt(r.prazoCausa) : "—"}</span>;
    } },
    { key: "porques", label: "Porquês", sortable: false, render: r => `${porquesPreenchidos(r)} de 5` },
    { key: "forn", label: "Fornecedor respondeu", sortable: false, render: r => r.respostaFornecedor ? "Sim" : "—" },
  ];
  return (
    <div>
      <div style={{ fontSize: 13, color: T.text2, marginBottom: 12 }}>
        RNCs em tratamento que ainda não têm análise de causa completa ({MIN_PORQUES}+ porquês e causa raiz). Clique para abrir a RNC direto na etapa de análise.
      </div>
      <Table
        columns={colunas}
        rows={fila}
        rowKey={r => r.id}
        onRowClick={r => abrirRnc(r.id, "causa")}
        rowAccent={r => past(r.prazoCausa) ? T.red : T.accent}
        perPage={20}
        emptyIcon="✓"
        emptyTitle="Nenhuma RNC aguardando análise de causa"
        emptySubtitle="Todas as RNCs em tratamento já têm causa raiz registrada."
      />
    </div>
  );
}

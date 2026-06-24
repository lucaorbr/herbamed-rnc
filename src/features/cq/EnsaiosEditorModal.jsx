import React, { useState, useEffect } from "react";
import { saveCollection, subscribeCollection } from "../../firebase";
import { useTheme } from "../../core/theme";
import { tod } from "../../core/utils";
import { askClaude } from "../../services/aiClient";
import { useS } from "../../shared/styles";
import { Inp, Sel, SecTitle } from "../../shared/ui";
import { ENSAIOS_SUGERIDOS } from "./CQTabs";

// Modal focado em parametrizar os ensaios de um material do CQ.
// Reaproveitado pelo fluxo de Recebimentos Areco para evitar o vai-e-volta
// até a tela de Entrada de Materiais quando o produto ainda não tem ensaios.
export function EnsaiosEditorModal({ material, user, toast_, onClose, onSaved }) {
  const T = useTheme(); const s = useS();
  const tipoInicial = ENSAIOS_SUGERIDOS[material?.tipo] ? material.tipo : Object.keys(ENSAIOS_SUGERIDOS)[0];
  const [tipo, setTipo] = useState(tipoInicial);
  const [ensaios, setEnsaios] = useState((material?.ensaios || []).map((e, i) => ({ tipo:"numero", casas:2, multiplos:false, ...e, id: e.id != null ? e.id : i + 1 })));
  const [templates, setTemplates] = useState([]);
  const [templateSel, setTemplateSel] = useState("");
  const [iaLoading, setIaLoading] = useState(false);
  const [iaConfirmada, setIaConfirmada] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const unsub = subscribeCollection("cq_templates", list => {
      setTemplates(list.sort((a, b) => (a.nome || "").localeCompare(b.nome || "")));
    });
    return () => unsub();
  }, []);

  const aplicarSugestoes = (t) => {
    const sugs = ENSAIOS_SUGERIDOS[t] || [];
    setEnsaios(sugs.map((e, i) => ({ tipo:"numero", casas:2, multiplos:false, ...e, id: i + 1, ref: e.ref || "" })));
  };

  const carregarTemplate = (tplId) => {
    if (!tplId) return;
    const tpl = templates.find(t => String(t.id) === String(tplId));
    if (!tpl) return;
    if (ensaios.length > 0 && !confirm(`Substituir os ensaios atuais pelo template "${tpl.nome}"?`)) return;
    setTipo(tpl.tipo || tipo);
    setEnsaios((tpl.ensaios || []).map((e, i) => ({ tipo:"numero", casas:2, multiplos:false, ...e, id: Date.now() + i })));
    setTemplateSel(tplId);
    toast_(`Template "${tpl.nome}" carregado!`, "green");
  };

  const addEnsaio = () => setEnsaios(p => [...p, { id: Date.now(), nome:"", espec:"", unidade:"", ref:"", tipo:"numero", casas:2, multiplos:false }]);
  const updEnsaio = (id, k, v) => setEnsaios(p => p.map(e => e.id === id ? { ...e, [k]: v } : e));
  const delEnsaio = (id) => setEnsaios(p => p.filter(e => e.id !== id));

  const sugerirEnsaiosIA = async () => {
    const nomeBase = material?.nomeBase || material?.nome || "";
    if (!nomeBase.trim()) { alert("Material sem nome para consultar a IA."); return; }
    setIaLoading(true);
    try {
      const prompt = `Você é especialista em controle de qualidade farmacêutico/nutracêutico (BPF, ANVISA, compêndios oficiais).
Material: "${nomeBase.trim()}"
Tipo: "${tipo}"

Gere um RASCUNHO da ficha de ensaios de controle de qualidade típica para esse material, com base em compêndios aceitos pela ANVISA (Farmacopeia Brasileira, USP, EP/BP, etc.).

REGRAS OBRIGATÓRIAS:
- Inclua apenas ensaios compendiais que você reconhece como usuais para esse material. Se não tiver certeza do material, retorne lista vazia [].
- Os limites são um RASCUNHO de partida e SERÃO verificados por um humano na monografia oficial. NÃO invente números de monografia, página ou edição específicos se não tiver certeza.
- No campo "ref", indique o compêndio provável de forma genérica e SEMPRE com aviso de verificação. Ex: "Farmacopeia Brasileira (verificar monografia e edição vigente)".
- Se um limite for incerto, use o campo "espec" com a faixa usual e mantenha o aviso.

Responda APENAS com um array JSON, sem markdown, sem texto antes ou depois, no formato:
[{"nome":"Doseamento","espec":"90,0 – 110,0","unidade":"%","ref":"USP (verificar monografia vigente)"}]`;
      const txt = await askClaude(prompt);
      const limpo = (txt || "").replace(/```json|```/g, "").trim();
      let arr = [];
      try { arr = JSON.parse(limpo); } catch { arr = []; }
      if (!Array.isArray(arr) || arr.length === 0) {
        alert("A IA não retornou sugestões para este material. Adicione os ensaios manualmente.");
        return;
      }
      const novos = arr.map((e, i) => ({
        id: Date.now() + i,
        nome: e.nome || "", espec: e.espec || "", unidade: e.unidade || "",
        ref: e.ref || "(verificar na fonte)",
        tipo:"numero", casas:2, multiplos:false, _ia:true,
      }));
      setEnsaios(p => [...p, ...novos]);
      setIaConfirmada(false);
    } catch (err) {
      alert("Erro ao consultar a IA: " + err.message);
    } finally {
      setIaLoading(false);
    }
  };

  const salvar = async () => {
    if (ensaios.some(e => e._ia) && !iaConfirmada) { alert("Há ensaios com limites gerados por IA. Confirme que você verificou os limites e referências na fonte oficial antes de salvar."); return; }
    if (ensaios.length === 0) { alert("Adicione ao menos um ensaio."); return; }
    if (ensaios.some(e => !(e.nome || "").trim())) { alert("Todos os ensaios precisam de um nome."); return; }
    setSalvando(true);
    try {
      const ensaiosLimpos = ensaios.map((e, i) => ({
        id: i + 1,
        nome: e.nome || "", espec: e.espec || "", unidade: e.unidade || "", ref: e.ref || "",
        tipo: e.tipo || "numero",
        casas: e.casas !== undefined ? e.casas : 2,
        multiplos: e.multiplos || false,
      }));
      const id = String(material.id);
      const atualizado = {
        ...material, id, tipo,
        ensaios: ensaiosLimpos,
        atualizadoEm: tod(),
        atualizadoPor: user?.name || "",
      };
      await saveCollection("cq_materiais", id, atualizado);
      toast_("Ensaios do material parametrizados!", "green");
      onSaved && onSaved(atualizado);
      onClose && onClose();
    } catch (e) {
      toast_("Erro ao salvar: " + e.message, "red");
      console.error(e);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.82)", backdropFilter:"blur(6px)", zIndex:999, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }} onClick={e => e.target === e.currentTarget && onClose && onClose()}>
      <div style={{ background:T.card2, border:`1px solid ${T.border2}`, borderRadius:18, padding:"1.5rem", maxWidth:880, width:"100%", maxHeight:"90vh", overflowY:"auto", boxShadow:"0 32px 80px #000a" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"1rem" }}>
          <div>
            <div style={{ fontSize:18, fontWeight:700, color:T.text }}>Parametrizar ensaios</div>
            <div style={{ fontSize:12, color:T.text2, marginTop:2 }}>{material?.nome || "Material"}</div>
          </div>
          <button onClick={() => onClose && onClose()} style={{ background:T.border, border:"none", color:T.text2, cursor:"pointer", borderRadius:8, padding:"6px 10px", fontSize:16, fontFamily:"inherit" }}>✕</button>
        </div>

        {/* Tipo + template */}
        <div style={{ ...s.card, margin:0, marginBottom:12, background:T.accentDim, border:`1px solid ${T.accent}33` }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div>
              <div style={{ fontSize:10, color:T.text3, textTransform:"uppercase", fontWeight:700, marginBottom:4 }}>Tipo de material (sugestões)</div>
              <Sel value={tipo} onChange={e => { setTipo(e.target.value); if (ensaios.length === 0 || confirm("Substituir os ensaios atuais pelas sugestões deste tipo?")) aplicarSugestoes(e.target.value); }} sx={{ width:"100%" }}>
                {Object.keys(ENSAIOS_SUGERIDOS).map(t => <option key={t}>{t}</option>)}
              </Sel>
            </div>
            <div>
              <div style={{ fontSize:10, color:T.text3, textTransform:"uppercase", fontWeight:700, marginBottom:4 }}>Carregar template</div>
              <Sel value={templateSel} onChange={e => carregarTemplate(e.target.value)} sx={{ width:"100%" }}>
                <option value="">Selecionar template...</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </Sel>
            </div>
          </div>
        </div>

        {/* Ensaios */}
        <div style={{ ...s.card, margin:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem", gap:8, flexWrap:"wrap" }}>
            <SecTitle icon="🔬" ch={`Ensaios (${ensaios.length})`} />
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              <button style={s.btn} onClick={() => aplicarSugestoes(tipo)}>↺ Recarregar sugestões</button>
              <button style={{ ...s.btn, opacity: iaLoading ? 0.6 : 1, cursor: iaLoading ? "wait" : "pointer" }} disabled={iaLoading} onClick={sugerirEnsaiosIA}>{iaLoading ? "⏳ Gerando rascunho..." : "✨ Rascunho IA"}</button>
              <button style={s.btnA} onClick={addEnsaio}><span className="btn-emoji">+ </span>Adicionar ensaio</button>
            </div>
          </div>

          {ensaios.some(e => e._ia) && (
            <div style={{ marginBottom:12, padding:"10px 12px", background:T.yellow + "18", border:`1px solid ${T.yellow}66`, borderRadius:8 }}>
              <div style={{ fontSize:12, color:T.text, fontWeight:600, marginBottom:6 }}>⚠ Limites e referências gerados por IA — rascunho não verificado</div>
              <div style={{ fontSize:11, color:T.text2, marginBottom:8, lineHeight:1.5 }}>
                A IA pode errar limites e citar referências inexistentes. Confira cada ensaio marcado contra a monografia oficial vigente (Farmacopeia Brasileira, USP, etc.) e corrija a Especificação e a Referência antes de salvar.
              </div>
              <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, color:T.text, cursor:"pointer" }}>
                <input type="checkbox" checked={iaConfirmada} onChange={e => setIaConfirmada(e.target.checked)} />
                Confirmo que verifiquei os limites e referências sugeridos na fonte oficial.
              </label>
            </div>
          )}

          {ensaios.length === 0 ? (
            <div style={{ textAlign:"center", padding:"2rem", color:T.text3, fontSize:13 }}>
              Selecione o tipo acima para carregar sugestões ou adicione manualmente
            </div>
          ) : (
            <div>
              <div style={{ display:"grid", gridTemplateColumns:"2fr 2fr 1fr 1fr 120px 60px 36px", gap:6, padding:"6px 8px", fontSize:10, fontWeight:700, color:T.text3, textTransform:"uppercase", letterSpacing:".06em", marginBottom:4 }}>
                <span>Ensaio *</span><span>Especificação</span><span>Unidade</span><span>Referência</span><span>Tipo de resultado</span><span>Casas dec.</span><span></span>
              </div>
              {ensaios.map(e => (
                <div key={e.id} style={{ marginBottom:8, background:T.surf, borderRadius:8, border:`1px solid ${e._ia ? T.yellow + "88" : T.border}`, borderLeft:e._ia ? `3px solid ${T.yellow}` : `1px solid ${T.border}`, padding:"8px" }}>
                  {e._ia && <div style={{ fontSize:10, color:T.yellow, fontWeight:700, marginBottom:4 }}>⚠ Rascunho IA — verificar na monografia</div>}
                  <div style={{ display:"grid", gridTemplateColumns:"2fr 2fr 1fr 1fr 120px 60px 36px", gap:6, alignItems:"center" }}>
                    <Inp placeholder="Ex: pH, Umidade, Aspecto..." value={e.nome} onChange={ev => updEnsaio(e.id, "nome", ev.target.value)} sx={{ fontSize:12 }} />
                    <Inp placeholder="Ex: 5,0–7,0 ou Conforme padrão" value={e.espec} onChange={ev => updEnsaio(e.id, "espec", ev.target.value)} sx={{ fontSize:12 }} />
                    <Inp placeholder="Ex: %, pH" value={e.unidade} onChange={ev => updEnsaio(e.id, "unidade", ev.target.value)} sx={{ fontSize:12 }} />
                    <Inp placeholder="Ex: EI-001" value={e.ref || ""} onChange={ev => updEnsaio(e.id, "ref", ev.target.value)} sx={{ fontSize:12 }} />
                    <Sel value={e.tipo || "numero"} onChange={ev => updEnsaio(e.id, "tipo", ev.target.value)} sx={{ fontSize:11, padding:"5px 6px" }}>
                      <option value="numero">🔢 Numérico</option>
                      <option value="conforme">✓/✗ Conforme</option>
                      <option value="texto">📝 Texto livre</option>
                    </Sel>
                    <Sel value={String(e.casas !== undefined ? e.casas : 2)} onChange={ev => updEnsaio(e.id, "casas", parseInt(ev.target.value))} disabled={e.tipo !== "numero"} sx={{ fontSize:11, padding:"5px 6px", opacity:e.tipo !== "numero" ? .4 : 1 }}>
                      <option value="0">0</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option>
                    </Sel>
                    <button onClick={() => delEnsaio(e.id)} style={{ background:"#ff4f6a18", border:"1px solid #ff4f6a33", color:"#ff4f6a", borderRadius:6, cursor:"pointer", width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontFamily:"inherit" }}>✕</button>
                  </div>
                  {e.tipo === "numero" && (
                    <div style={{ marginTop:6, display:"flex", alignItems:"center", gap:6, paddingLeft:2 }}>
                      <input type="checkbox" id={`mult-areco-${e.id}`} checked={!!e.multiplos} onChange={ev => updEnsaio(e.id, "multiplos", ev.target.checked)} style={{ accentColor:T.accent, width:14, height:14 }} />
                      <label htmlFor={`mult-areco-${e.id}`} style={{ fontSize:11, color:T.text2, cursor:"pointer" }}>Permite lançamento de múltiplos valores (calcula média automaticamente)</label>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:"1rem" }}>
          <button style={s.btn} onClick={() => onClose && onClose()} disabled={salvando}>Cancelar</button>
          <button style={{ ...s.btnA, opacity: salvando ? .7 : 1 }} onClick={salvar} disabled={salvando}><span className="btn-emoji">💾 </span>{salvando ? "Salvando..." : "Salvar ensaios"}</button>
        </div>
      </div>
    </div>
  );
}

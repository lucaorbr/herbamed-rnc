import React, { useState } from "react";
import { useTheme } from "../../core/theme";
import { fmt, tod } from "../../core/utils";
import { useS } from "../../shared/styles";
import { AnexosUpload } from "../../shared/AnexosUpload";
import { F, Inp, SecTitle, SevB, TA } from "../../shared/ui";
import { Table } from "../../shared/Table";
import { acaoRemovivel, contagemCapa, errosDasAcoesCapa, filaCapa, patchSalvarCapa } from "./ferramentasLogic";

// Etapa 4 da ficha da RNC (onda 4): o plano CAPA editado DENTRO da RNC — ações,
// execução e evidências. Substitui a antiga tela solta "CAPA", que começava com uma
// lista de todas as RNCs para escolher. Evidência em ação concluída é recomendada,
// não obrigatória (decisão do usuário): fica o aviso.

const STATUS = ["Pendente", "Em andamento", "Concluída", "Cancelada"];
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

const novaAcao = autor => ({ id: String(Date.now() + Math.random()), tipo: "Corretiva", what: "", why: "", who: autor, where: "", when: "", how: "", howMuch: "", status: "Pendente", evidencias: [] });

/**
 * Editor do plano CAPA. `gravar(patch)` vem da ficha (grava e já mostra).
 * O estado nasce da RNC e não é substituído pelas releituras do servidor — o que está
 * sendo digitado não some. A ficha remonta o editor ao trocar de RNC (key).
 */
export function PlanoCapaEditor({ r, user, toast_, openEmail, gravar }) {
  const T = useTheme(); const s = useS();
  const autor = user?.name || "—";
  const [acts, setActs] = useState(() => (r.w2h || []).map(a => ({ ...a, tipo: a.tipo || "Corretiva", evidencias: Array.isArray(a.evidencias) ? a.evidencias : [] })));
  const [carregandoIA, setCarregandoIA] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erros, setErros] = useState([]);

  const add = () => setActs(p => [...p, novaAcao(autor)]);
  const upd = (i, k, v) => setActs(p => p.map((a, j) => j === i ? { ...a, [k]: v } : a));
  const del = i => setActs(p => p.filter((_, j) => j !== i));

  const gerarIA = async () => {
    const causaRaiz = r.ishikawa?.root || "";
    setCarregandoIA(true);
    try {
      const res = await fetch("/api/claude", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-5", max_tokens: 2000,
          messages: [{ role: "user", content: `Você é especialista em qualidade farmacêutica (BPF, ANVISA RDC 658/2022). Crie um plano de ação corretiva CAPA (Corrective and Preventive Action) para a não conformidade abaixo.

Problema: ${r.desc || ""}
Causa raiz: ${causaRaiz}
Produto: ${r.produto || ""}
Setor: ${r.setor || ""}
Severidade: ${r.sev || ""}

Gere de 3 a 5 ações. Para cada uma, defina se é "Corretiva" (elimina a causa da NC atual) ou "Preventiva" (evita que NC potencial ocorra).
Responda APENAS em JSON sem markdown:
[{"tipo":"Corretiva","what":"o que fazer","why":"por que","who":"responsável (cargo)","where":"local","when":"prazo ex: 15 dias","how":"como executar passo a passo","howMuch":"esforço estimado"}]` }] }) });
      const data = await res.json();
      const txt = data.content?.[0]?.text || "";
      const parsed = JSON.parse(txt.replace(/```json|```/g, "").trim());
      // A IA devolve prazo como texto ("15 dias"): o campo é data, então fica em branco
      // para a pessoa escolher — e a validação não deixa salvar sem ele.
      setActs(p => [...p, ...parsed.map(a => ({ ...novaAcao(autor), ...a, when: DATA_ISO.test(a.when || "") ? a.when : "", status: "Pendente", evidencias: [] }))]);
      toast_("Plano CAPA sugerido pela IA. Revise responsáveis e prazos antes de salvar.", "green");
    } catch { toast_("Erro ao gerar com IA.", "red"); }
    setCarregandoIA(false);
  };

  // Valida ANTES de gravar e grava num patch só (regras em ferramentasLogic).
  const salvar = async () => {
    const e = errosDasAcoesCapa(acts);
    setErros(e);
    if (e.length) { toast_("Nada foi salvo — corrija as ações indicadas.", "red"); return; }
    if (JSON.stringify(acts) === JSON.stringify(r.w2h || [])) { toast_("Nada mudou no plano.", "yellow"); return; }
    const patch = patchSalvarCapa(r, acts, autor, tod());
    setSalvando(true);
    try {
      await gravar(patch);
      toast_("Plano CAPA salvo.", "green");
      openEmail({ ...r, ...patch }, "5w2h");
    } catch { /* doUpdateRNC já avisou */ }
    setSalvando(false);
  };

  const cor = { "Pendente": T.yellow, "Em andamento": T.blue, "Concluída": T.accent, "Cancelada": T.red };
  const tipoCor = { "Corretiva": T.accent, "Preventiva": T.purple || "#8b5cf6" };
  const hoje = tod();
  const fechadas = acts.filter(a => a.status === "Concluída" || a.status === "Cancelada").length;

  return (
    <div>
      <div style={{ ...s.card, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <SecTitle icon="📋" ch="Plano CAPA — ações corretivas e preventivas" />
          {acts.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 12, color: T.text2 }}>{fechadas}/{acts.length} encerradas</div>
              <div style={{ width: 120, height: 6, background: T.border, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(fechadas / acts.length) * 100}%`, background: fechadas === acts.length ? T.accent : T.blue, borderRadius: 3, transition: "width .3s" }} />
              </div>
            </div>
          )}
        </div>
        {r.ishikawa?.root && <div style={{ fontSize: 12, color: T.text2, marginBottom: 12 }}>🎯 Causa raiz: <b style={{ color: T.text }}>{r.ishikawa.root}</b></div>}

        {acts.length === 0 && <div style={{ textAlign: "center", padding: "1.5rem", color: T.text3, fontSize: 13, border: `1px dashed ${T.border2}`, borderRadius: 10, marginBottom: 10 }}>Nenhuma ação. Clique em "+ Adicionar ação" ou peça uma sugestão à IA.</div>}

        {acts.map((a, i) => {
          const vencida = a.when && a.when < hoje && a.status !== "Concluída" && a.status !== "Cancelada";
          const removivel = acaoRemovivel(r, a);
          const erro = erros.find(e => e.startsWith(`Ação #${i + 1}:`));
          return (
            <div key={a.id ?? `legado-${i}`} style={{ background: T.surf, border: `1px solid ${erro || vencida ? T.red + "88" : T.border}`, borderRadius: 8, padding: "1rem", marginBottom: 10, opacity: a.status === "Cancelada" ? .7 : 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.accent, textTransform: "uppercase" }}>Ação #{i + 1}</span>
                  <select aria-label="Tipo da ação" value={a.tipo || "Corretiva"} onChange={e => upd(i, "tipo", e.target.value)}
                    style={{ ...s.inp, width: "auto", fontSize: 10, padding: "3px 8px", fontWeight: 700, color: tipoCor[a.tipo || "Corretiva"], border: `1px solid ${tipoCor[a.tipo || "Corretiva"]}55` }}>
                    <option>Corretiva</option>
                    <option>Preventiva</option>
                  </select>
                  {vencida && <span style={{ fontSize: 10, color: T.red, fontWeight: 700 }}>PRAZO VENCIDO</span>}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <select aria-label="Situação da ação" value={a.status} onChange={e => upd(i, "status", e.target.value)} style={{ ...s.inp, width: "auto", minWidth: 130, fontSize: 11, padding: "4px 8px", color: cor[a.status] || T.text }}>{STATUS.map(x => <option key={x}>{x}</option>)}</select>
                  {removivel
                    ? <button style={s.btnD} onClick={() => del(i)}>✕ Remover</button>
                    : <span title="Ação já registrada não se apaga — mude a situação para Cancelada." style={{ fontSize: 10, color: T.text3, alignSelf: "center" }}>registrada</span>}
                </div>
              </div>
              {erro && <div style={{ fontSize: 12, color: T.red, marginBottom: 8 }}>{erro.replace(/^Ação #\d+: /, "")}</div>}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
                <F lbl="O quê?" tip="Descreva a ação a executar. Use verbos de ação. Ex: Revisar e atualizar o PO-CQ-003." ch={<Inp placeholder="Ação a executar" value={a.what} onChange={e => upd(i, "what", e.target.value)} />} />
                <F lbl="Por quê?" tip="Justifique conectando com a causa raiz identificada." ch={<Inp placeholder="Justificativa" value={a.why} onChange={e => upd(i, "why", e.target.value)} />} />
                <F lbl="Quem?" tip="Responsável pela execução — nome específico, não setor." ch={<Inp value={a.who} onChange={e => upd(i, "who", e.target.value)} />} />
                <F lbl="Onde?" tip="Local de execução. Ex: Linha de produção 2, Lab. CQ." ch={<Inp value={a.where} onChange={e => upd(i, "where", e.target.value)} />} />
                <F lbl="Quando?" tip="Data limite. O prazo da ação corretiva da RNC passa a ser o mais tardio entre as ações em aberto." ch={<Inp type="date" value={a.when} onChange={e => upd(i, "when", e.target.value)} />} />
                <F lbl="Custo/Esforço" tip="Estimativa de recursos. Ex: 4h de trabalho, R$ 500." ch={<Inp value={a.howMuch} onChange={e => upd(i, "howMuch", e.target.value)} />} />
              </div>
              <F lbl="Como?" tip="Passo a passo de execução." ch={<TA rows={2} value={a.how} onChange={e => upd(i, "how", e.target.value)} />} />
              <F lbl="Evidências de execução" tip="Arquivos que comprovam a execução: foto, relatório, registro de treinamento." ch={
                <div>
                  {typeof a.evidencia === "string" && a.evidencia && !a.evidencias.length && (
                    <div style={{ fontSize: 11, color: T.text2, background: T.card2, border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 10px", marginBottom: 8 }}>Registro anterior: {a.evidencia}</div>
                  )}
                  <AnexosUpload inputId={`capa-ev-${a.id ?? `legado-${i}`}`} anexos={a.evidencias} setAnexos={novos => upd(i, "evidencias", typeof novos === "function" ? novos(a.evidencias) : novos)} />
                  {a.status === "Concluída" && !a.evidencias.length && !a.evidencia && (
                    <div style={{ fontSize: 11, color: T.orange, marginTop: 4 }}>Ação concluída sem evidência anexada — recomendável anexar o comprovante.</div>
                  )}
                </div>
              } />
            </div>
          );
        })}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={{ ...s.btn, flex: 1, borderStyle: "dashed", color: T.text2 }} onClick={add}>+ Adicionar ação</button>
          <button style={{ ...s.btn, opacity: carregandoIA ? .6 : 1 }} disabled={carregandoIA} onClick={gerarIA}>{carregandoIA ? "⟳ Gerando…" : "🤖 Sugerir ações com IA"}</button>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, color: T.text2 }}>Ação já salva não se apaga: se não for mais executar, mude para <b>Cancelada</b>. A verificação de eficácia exige ao menos uma ação concluída e nenhuma em aberto.</div>
        <button style={{ ...s.btnA, opacity: salvando ? .6 : 1 }} disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar plano CAPA"}</button>
      </div>
    </div>
  );
}

/** Antiga tela "CAPA": agora a fila das RNCs com plano CAPA por montar ou ações em aberto. */
export function FilaCapa({ rncs, abrirRnc }) {
  const T = useTheme();
  const hoje = tod();
  const fila = filaCapa(rncs).map(r => ({ ...r, _capa: contagemCapa(r, hoje) }));
  const colunas = [
    { key: "num", label: "Nº", render: r => <span style={{ color: T.accent, fontWeight: 700, fontSize: 11 }}>{r.num}</span> },
    { key: "desc", label: "Descrição", maxWidth: 280, nowrap: true, render: r => r.desc },
    { key: "sev", label: "Sev.", render: r => <SevB s={r.sev} /> },
    { key: "resp", label: "Responsável", render: r => r.resp || "—" },
    { key: "acoes", label: "Ações", sortable: false, render: r => r._capa.total ? `${r._capa.concluidas} de ${r._capa.total} concluída(s)` : <span style={{ color: T.orange, fontWeight: 600 }}>Plano não montado</span> },
    { key: "proximo", label: "Próximo prazo", sortable: false, render: r => {
      const { proximoPrazo, vencidas } = r._capa;
      if (!proximoPrazo) return "—";
      return <span style={{ color: vencidas ? T.red : T.text2, fontWeight: vencidas ? 600 : 400 }}>{vencidas ? `⚠ ${vencidas} vencida(s) · ` : ""}{fmt(proximoPrazo)}</span>;
    } },
  ];
  return (
    <div>
      <div style={{ fontSize: 13, color: T.text2, marginBottom: 12 }}>
        RNCs com análise de causa completa que ainda não têm plano CAPA ou têm ações em aberto. Clique para abrir a RNC direto na etapa do plano.
      </div>
      <Table
        columns={colunas}
        rows={fila}
        rowKey={r => r.id}
        onRowClick={r => abrirRnc(r.id, "capa")}
        rowAccent={r => r._capa.vencidas ? T.red : !r._capa.total ? T.orange : T.accent}
        perPage={20}
        emptyIcon="✓"
        emptyTitle="Nenhum plano CAPA pendente"
        emptySubtitle="Todas as RNCs com causa raiz já têm as ações encerradas."
      />
    </div>
  );
}

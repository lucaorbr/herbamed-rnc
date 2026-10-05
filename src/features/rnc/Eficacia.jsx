import React, { useState } from "react";
import { useTheme } from "../../core/theme";
import { fmt, past, tod } from "../../core/utils";
import { useS } from "../../shared/styles";
import { AnexosUpload } from "../../shared/AnexosUpload";
import { F, G2, Inp, SecTitle, SevB, TA } from "../../shared/ui";
import { Table } from "../../shared/Table";
import { ofertaNotificar } from "../email/ofertaNotificar";
import { filaEficacia, patchEficacia, travaEficacia } from "./ferramentasLogic";

// Etapa 5 da ficha da RNC (onda 5): verificação de eficácia e encerramento editados
// DENTRO da RNC. Substitui a antiga tela solta "Eficácia", que começava com uma lista de
// todas as RNCs para escolher. Sem segregação (decisão do usuário): quem executou as
// ações pode verificar.

const RESULTADOS = [
  ["Eficaz", "accent", "Causa raiz eliminada — encerra a RNC"],
  ["Ineficaz", "red", "NC recorreu — encerra e pede nova RNC"],
  ["Pendente verificação", "yellow", "Agenda a verificação, RNC segue aberta"],
];

/**
 * Editor da eficácia. `gravar(patch)` vem da ficha (grava e já mostra).
 * O estado nasce da RNC e não é substituído pelas releituras do servidor.
 */
export function EficaciaEditor({ r, user, toast_, openEmail, gravar }) {
  const T = useTheme(); const s = useS();
  const autor = user?.name || "—";
  const ef = r.eficacia || {};
  const [f, setF] = useState({ criterio: ef.criterio || "", data: ef.data || "", resp: ef.resp || autor, evidencias: ef.evidencias || "", anexos: ef.anexos || [], resultado: ef.resultado || "", obs: ef.obs || "" });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const [carregandoIA, setCarregandoIA] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState("");

  const travaEficaz = travaEficacia(r, "Eficaz");
  const travaIneficaz = travaEficacia(r, "Ineficaz");

  const gerarIA = async () => {
    setCarregandoIA(true);
    try {
      const res = await fetch("/api/claude", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-5", max_tokens: 800,
          messages: [{ role: "user", content: `Você é especialista em qualidade farmacêutica. Sugira um critério de verificação de eficácia e lições aprendidas para esta NC.

Problema: ${r.desc || ""}
Causa raiz: ${r.ishikawa?.root || r.ishikawa?.whyCausa || ""}
Ações executadas: ${(r.w2h || []).map(a => a.what).join("; ")}
Severidade: ${r.sev || ""}

Responda APENAS em JSON sem markdown:
{"criterio":"critério objetivo e mensurável","obs":"lições aprendidas e recomendações sistêmicas"}` }] }) });
      const data = await res.json();
      const txt = data.content?.[0]?.text || "";
      const p = JSON.parse(txt.replace(/```json|```/g, "").trim());
      setF(prev => ({ ...prev, criterio: prev.criterio || p.criterio || "", obs: prev.obs || p.obs || "" }));
      toast_("Sugestão da IA aplicada aos campos vazios. Revise antes de registrar.", "green");
    } catch { toast_("Erro ao gerar com IA.", "red"); }
    setCarregandoIA(false);
  };

  const salvar = async () => {
    if (!f.resultado) { setAviso("Escolha o resultado da verificação."); return; }
    const trava = travaEficacia(r, f.resultado);
    if (!trava.ok) { setAviso("Ainda não dá para fechar esta RNC: " + trava.motivos.join(" ")); return; }
    const fecha = f.resultado !== "Pendente verificação";
    if (fecha && !window.confirm(`Registrar "${f.resultado}" encerra a RNC ${r.num}. Depois disso ela vira registro fechado, somente leitura. Confirma?`)) return;
    setAviso("");
    const patch = patchEficacia(r, f, autor, new Date().toISOString(), tod(), new Date().toLocaleTimeString("pt-BR"));
    setSalvando(true);
    try {
      await gravar(patch);
      toast_(fecha ? `RNC encerrada como ${f.resultado}.` : "Verificação agendada.", "green", ofertaNotificar({ ...r, ...patch }, "eficacia", openEmail));
    } catch { /* doUpdateRNC já avisou */ }
    setSalvando(false);
  };

  return (
    <div>
      <div style={{ ...s.card, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <SecTitle icon="✅" ch="Verificação de eficácia" />
          <button style={{ ...s.btn, fontSize: 11, padding: "5px 10px", opacity: carregandoIA ? .6 : 1 }} disabled={carregandoIA} onClick={gerarIA}>{carregandoIA ? "⟳ Gerando…" : "🤖 Sugerir critério com IA"}</button>
        </div>
        <F lbl="Critério de verificação" tip="Como será verificado se a ação corretiva resolveu o problema. Ex: ausência de reclamações do mesmo tipo nos próximos 90 dias, ou lote seguinte aprovado em 100% das análises." ch={<TA rows={3} value={f.criterio} onChange={e => set("criterio", e.target.value)} placeholder="Ex: Ausência de telescopia em 3 lotes consecutivos; Cp ≥ 1,33" />} />
        <G2 ch={<>
          <F lbl="Data da verificação" tip="Data em que a verificação foi ou será realizada. Deve coincidir com o prazo de eficácia da RNC." ch={<Inp type="date" value={f.data} onChange={e => set("data", e.target.value)} />} />
          <F lbl="Responsável pela verificação" ch={<Inp value={f.resp} onChange={e => set("resp", e.target.value)} />} />
        </>} />
        <F lbl="Evidências coletadas" tip="O que comprova que a ação foi eficaz. Ex: análise dos lotes seguintes sem desvio, relatório de auditoria interna, registros de treinamento." ch={<TA rows={3} value={f.evidencias} onChange={e => set("evidencias", e.target.value)} />} />
        <F lbl="Anexos da verificação" tip="Arquivos que comprovam a verificação: relatório de análise dos lotes seguintes, registro de auditoria, fotos." ch={
          <AnexosUpload inputId={`eficacia-anexos-${r.id}`} anexos={f.anexos} setAnexos={novos => setF(p => ({ ...p, anexos: typeof novos === "function" ? novos(p.anexos) : novos }))} />
        } />

        {!travaEficaz.ok && (
          <div style={{ background: `${T.red}14`, border: `1px solid ${T.red}44`, borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 12, color: T.red }}>
            Para encerrar como Eficaz, falta:
            <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>{travaEficaz.motivos.map((m, i) => <li key={i}>{m}</li>)}</ul>
            <div style={{ marginTop: 6, color: T.text2 }}>"Pendente verificação" pode ser registrado a qualquer momento.</div>
          </div>
        )}

        <F lbl="Resultado da verificação" tip="Eficaz: o problema não se repetiu e as ações bastaram. Ineficaz: o problema persistiu — abra nova RNC com análise complementar. Pendente: agenda a verificação sem encerrar." ch={
          <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
            {RESULTADOS.map(([v, corKey, desc]) => {
              const cor = T[corKey];
              const travado = (v === "Eficaz" && !travaEficaz.ok) || (v === "Ineficaz" && !travaIneficaz.ok);
              return (
                <label key={v} style={{ display: "flex", alignItems: "center", gap: 8, cursor: travado ? "not-allowed" : "pointer", opacity: travado ? .45 : 1, padding: "10px 16px", background: f.resultado === v ? `${cor}18` : T.surf, border: `1px solid ${f.resultado === v ? cor + "55" : T.border}`, borderRadius: 8, flex: 1, minWidth: 170 }}>
                  <input type="radio" name={`efic-${r.id}`} value={v} checked={f.resultado === v} disabled={travado} onChange={() => set("resultado", v)} style={{ accentColor: cor }} />
                  <div><div style={{ fontWeight: 600, color: cor, fontSize: 12 }}>{v}</div><div style={{ fontSize: 10, color: T.text3 }}>{desc}</div></div>
                </label>
              );
            })}
          </div>
        } />
        <F lbl="Lições aprendidas / observações finais" tip="O aprendizado gerado por esta NC. O que pode ser melhorado no sistema para evitar recorrências?" ch={<TA rows={3} value={f.obs} onChange={e => set("obs", e.target.value)} />} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, color: aviso ? T.red : T.text2 }} aria-live="polite">{aviso || "Eficaz e Ineficaz encerram a RNC; depois ela fica somente leitura."}</div>
        <button style={{ ...s.btnA, opacity: salvando ? .6 : 1 }} disabled={salvando} onClick={salvar}>{salvando ? "Registrando…" : "Registrar verificação"}</button>
      </div>
    </div>
  );
}

/** Antiga tela "Eficácia": agora a fila das RNCs prontas para verificar ou já agendadas. */
export function FilaEficacia({ rncs, abrirRnc }) {
  const T = useTheme();
  const fila = filaEficacia(rncs);
  const colunas = [
    { key: "num", label: "Nº", render: r => <span style={{ color: T.accent, fontWeight: 700, fontSize: 11 }}>{r.num}</span> },
    { key: "desc", label: "Descrição", maxWidth: 280, nowrap: true, render: r => r.desc },
    { key: "sev", label: "Sev.", render: r => <SevB s={r.sev} /> },
    { key: "resp", label: "Responsável", render: r => r.resp || "—" },
    { key: "situacao", label: "Situação", sortable: false, render: r => r.status === "Pendente verificação" ? `Agendada${r.eficacia?.data ? ` p/ ${fmt(r.eficacia.data)}` : ""}` : "CAPA concluída — verificar" },
    { key: "prazoEfic", label: "Prazo eficácia", render: r => {
      const v = past(r.prazoEfic);
      return <span style={{ color: v ? T.red : T.text2, fontWeight: v ? 600 : 400 }}>{v ? "⚠ " : ""}{r.prazoEfic ? fmt(r.prazoEfic) : "—"}</span>;
    } },
  ];
  return (
    <div>
      <div style={{ fontSize: 13, color: T.text2, marginBottom: 12 }}>
        RNCs com o plano CAPA concluído, prontas para a verificação de eficácia, e as que já estão agendadas. Clique para abrir a RNC direto na etapa de eficácia.
      </div>
      <Table
        columns={colunas}
        rows={fila}
        rowKey={r => r.id}
        onRowClick={r => abrirRnc(r.id, "eficacia")}
        rowAccent={r => past(r.prazoEfic) ? T.red : T.accent}
        perPage={20}
        emptyIcon="✓"
        emptyTitle="Nenhuma RNC aguardando verificação de eficácia"
        emptySubtitle="Quando o plano CAPA de uma RNC for concluído, ela aparece aqui."
      />
    </div>
  );
}

import React, { useMemo, useState } from "react";
import { useTheme } from "../../core/theme";
import { useS } from "../../shared/styles";
import { F, G2, G3, Inp, SecTitle, Sel, TA } from "../../shared/ui";
import { fmt, tod } from "../../core/utils";
import { saveCollection, deleteFromCollection } from "../../firebase";
import { AssinaturaModal, exportListaPresencaPDF } from "../pdf/pdfExports";
import { exigidosDoDocumento, indexarEvidencias, statusCelula, documentoExigeTreinamento } from "./treinamento";
import {
  novaSessao, proxNumSessao, presentesDaSessao, podeEncerrar,
  evidenciasDaSessao, sessoesDoDocumento, STATUS_SESSAO,
} from "./sessoes";

// Sessões de treinamento presencial de UM documento. A tela mora em arquivo próprio
// pelo mesmo motivo que a Matriz (Fase 3): o GestaoDocumentosTab já passa de 2,7 mil
// linhas. A sessão é a memória do evento; quem treinou continua sendo a evidência na
// coleção `treinamentos`, gravada no momento em que a lista é assinada.

export function SessoesTreinamentoTab({
  doc, sessoes = [], colaboradores = [], evidencias = [], catalogoCargos = [],
  user, perm, isAdmin, toast_, auditLog, onVoltar,
}) {
  const T = useTheme(); const s = useS();
  const hoje = tod();
  const [sel, setSel] = useState(null);
  const [assinando, setAssinando] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const podeRegistrar = isAdmin || (perm?.("registrarTreinamento") ?? false);
  const vigente = documentoExigeTreinamento(doc);

  const minhas = useMemo(() => sessoesDoDocumento(sessoes, doc?.id), [sessoes, doc?.id]);

  // Quem o documento exige e como cada um está hoje — mesma fonte da matriz.
  const { exigidos, jaTreinados } = useMemo(() => {
    const ex = exigidosDoDocumento(doc, colaboradores, catalogoCargos);
    const indice = indexarEvidencias(evidencias);
    const ok = ex
      .filter(e => statusCelula({ doc, userId: e.userId, indice, hoje }).status === "treinado")
      .map(e => e.userId);
    return { exigidos: ex, jaTreinados: ok };
  }, [doc, colaboradores, catalogoCargos, evidencias, hoje]);

  const criar = () => {
    const nova = novaSessao({
      doc, instrutor: { id: user?.uid || user?.id, name: user?.name, cargo: user?.cargo },
      exigidos, jaTreinados, num: proxNumSessao(sessoes, new Date().getFullYear()), hoje,
    });
    setSel(nova);
  };

  const salvar = async (sessao, msg) => {
    setSalvando(true);
    try {
      await saveCollection("treinamento_sessoes", sessao.id, sessao);
      setSel(sessao);
      if (msg) toast_?.(msg, "green");
    } catch (e) { toast_?.("Erro ao salvar a sessão.", "red"); console.error(e); }
    setSalvando(false);
  };

  const excluir = async (sessao) => {
    if (sessao.status === STATUS_SESSAO.REALIZADA) return;
    if (!window.confirm(`Excluir a sessão ${sessao.num}? Ela ainda não foi assinada, então nenhuma evidência foi gravada.`)) return;
    try {
      await deleteFromCollection("treinamento_sessoes", sessao.id);
      setSel(null);
      toast_?.("Sessão excluída.", "green");
    } catch (e) { toast_?.("Erro ao excluir.", "red"); console.error(e); }
  };

  const togglePresenca = (userId) => {
    setSel(p => ({
      ...p,
      participantes: p.participantes.map(x => (x.userId === userId ? { ...x, presente: !x.presente } : x)),
    }));
  };

  const marcarTodos = (valor) => {
    setSel(p => ({ ...p, participantes: p.participantes.map(x => ({ ...x, presente: valor })) }));
  };

  const pedirAssinatura = () => {
    const check = podeEncerrar(sel);
    if (!check.ok) { toast_?.(check.erro, "red"); return; }
    setAssinando(sel);
  };

  // Encerrar = assinar a lista E gravar as evidências dos presentes. As duas coisas
  // andam juntas de propósito: sem assinatura não há registro de treinamento.
  const encerrar = async (assinatura) => {
    const base = assinando;
    setAssinando(null);
    setSalvando(true);
    try {
      const evs = evidenciasDaSessao({
        sessao: base, doc, evidenciasExistentes: evidencias, registradoPor: user?.name || "",
      });
      for (const ev of evs) await saveCollection("treinamentos", ev.id, ev);

      const encerrada = {
        ...base,
        status: STATUS_SESSAO.REALIZADA,
        assinaturaInstrutor: assinatura,
        encerradaEm: new Date().toISOString(),
        evidenciasGeradas: evs.map(e => e.id),
        historico: [...(base.historico || []), {
          data: new Date().toISOString(), por: user?.name || "",
          acao: `Lista de presença assinada — ${evs.length} evidência(s) de treinamento gravada(s)`,
        }],
      };
      await saveCollection("treinamento_sessoes", encerrada.id, encerrada);
      await auditLog?.("Encerrou Sessão de Treinamento", "treinamento_sessoes", encerrada.id,
        `${encerrada.num} — ${doc.codigo} Rev.${doc.versao}`, null,
        { presentes: presentesDaSessao(encerrada).length, evidencias: evs.length });
      setSel(encerrada);
      toast_?.(`Lista assinada — ${evs.length} treinamento(s) registrado(s).`, "green");
    } catch (e) { toast_?.("Erro ao encerrar a sessão.", "red"); console.error(e); }
    setSalvando(false);
  };

  const Cabecalho = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
      <button style={s.btn} onClick={sel ? () => setSel(null) : onVoltar}>← Voltar</button>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: T.text, margin: 0 }}>📋 Sessões de Treinamento</h2>
        <div style={{ fontSize: 11, color: T.text3 }}>{doc?.codigo} — {doc?.titulo} · Rev.{doc?.versao}</div>
      </div>
      <div style={{ flex: 1 }} />
      {!sel && podeRegistrar && vigente && <button style={s.btnA} onClick={criar}>+ Nova sessão</button>}
    </div>
  );

  // ── Lista de sessões ───────────────────────────────────────────────────────
  if (!sel) {
    return (
      <div>
        <Cabecalho />
        {!vigente && (
          <div style={{ ...s.card, border: `1px solid ${T.border}`, fontSize: 12, color: T.text3 }}>
            A exigência de treinamento só vale com o documento <strong>Vigente</strong> — não se treina em versão não aprovada.
          </div>
        )}
        <div style={s.card}>
          {minhas.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem", color: T.text3, fontSize: 13 }}>
              Nenhuma sessão registrada para este documento.<br />
              <span style={{ fontSize: 11 }}>A sessão gera a lista de presença assinada e grava o treinamento de todos os presentes de uma vez.</span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {minhas.map(x => {
                const presentes = presentesDaSessao(x).length;
                const realizada = x.status === STATUS_SESSAO.REALIZADA;
                const daVersao = String(x.versao) === String(doc?.versao);
                return (
                  <div key={x.id} onClick={() => setSel(x)}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: T.surf, border: `1px solid ${T.border}`, borderRadius: 8, cursor: "pointer", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 18 }}>{realizada ? "🔒" : "📝"}</span>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                        {x.num} · {fmt(x.data)}
                        {!daVersao && <span style={{ fontSize: 10, color: T.text3, fontWeight: 400 }}> · Rev.{x.versao} (revisão anterior)</span>}
                      </div>
                      <div style={{ fontSize: 11, color: T.text2 }}>
                        Instrutor: {x.instrutor?.nome || "—"} · {presentes} presente(s)
                        {x.cargaHoraria ? ` · ${x.cargaHoraria}h` : ""}
                      </div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: realizada ? "#2ab84a22" : "#e8a33d22", color: realizada ? "#2ab84a" : "#e8a33d" }}>
                      {x.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Detalhe / edição da sessão ─────────────────────────────────────────────
  const realizada = sel.status === STATUS_SESSAO.REALIZADA;
  const editavel = podeRegistrar && !realizada;
  const presentes = presentesDaSessao(sel);
  const novaAindaNaoSalva = !sessoes.some(x => x.id === sel.id);

  return (
    <div>
      <Cabecalho />

      <div style={s.card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{sel.num}</div>
            <div style={{ fontSize: 11, color: T.text3 }}>
              {realizada ? `Assinada em ${fmt((sel.encerradaEm || "").split("T")[0])}` : "Rascunho — nenhuma evidência gravada ainda"}
              {" · "}Rev.{sel.versao}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {realizada && <button style={s.btnA} onClick={() => exportListaPresencaPDF(sel, doc)}>📄 Lista de presença (PDF)</button>}
            {editavel && !novaAindaNaoSalva && (
              <button style={{ ...s.btn, color: "#ff4f6a", borderColor: "#ff4f6a33" }} onClick={() => excluir(sel)}>🗑️</button>
            )}
          </div>
        </div>

        {realizada && (
          <div style={{ background: "#2ab84a12", border: "1px solid #2ab84a33", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: T.text2 }}>
            🔒 Lista assinada por <strong style={{ color: T.text }}>{sel.instrutor?.nome}</strong> — {(sel.evidenciasGeradas || []).length} treinamento(s) gravado(s).
            Registro imutável: para corrigir, registre uma nova sessão.
          </div>
        )}

        <SecTitle icon="🗓️" ch="Dados da sessão" />
        <G3 ch={<>
          <F lbl="Data do treinamento" ch={
            <Inp type="date" value={sel.data || ""} disabled={!editavel}
              onChange={e => setSel(p => ({ ...p, data: e.target.value }))} />
          } />
          <F lbl="Carga horária (h)" ch={
            <Inp type="number" min="0" step="0.5" placeholder="Ex: 2" value={sel.cargaHoraria || ""} disabled={!editavel}
              onChange={e => setSel(p => ({ ...p, cargaHoraria: e.target.value }))} />
          } />
          <F lbl="Local" ch={
            <Inp placeholder="Ex: Sala de treinamento" value={sel.local || ""} disabled={!editavel}
              onChange={e => setSel(p => ({ ...p, local: e.target.value }))} />
          } />
        </>} />
        <F lbl="Conteúdo ministrado"
          tip="O que foi efetivamente treinado. Sai na lista de presença — é o que a inspeção lê para saber o escopo do treinamento."
          ch={
            <TA value={sel.conteudo || ""} disabled={!editavel}
              onChange={e => setSel(p => ({ ...p, conteudo: e.target.value }))} />
          } />
        <G2 ch={<>
          <F lbl="Instrutor" ch={<Inp value={sel.instrutor?.nome || "—"} disabled readOnly />} />
          <F lbl="Cargo do instrutor" ch={<Inp value={sel.instrutor?.cargo || "—"} disabled readOnly />} />
        </>} />

        <SecTitle icon="✅" ch={`Presença (${presentes.length} de ${sel.participantes.length})`} />
        {editavel && (
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <button style={{ ...s.btn, fontSize: 11 }} onClick={() => marcarTodos(true)}>Marcar todos</button>
            <button style={{ ...s.btn, fontSize: 11 }} onClick={() => marcarTodos(false)}>Limpar</button>
            <span style={{ fontSize: 11, color: T.text3, alignSelf: "center" }}>
              Participantes vêm de quem o documento exige, pelo cargo.
            </span>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {sel.participantes.length === 0 && (
            <div style={{ textAlign: "center", padding: "1.5rem", color: T.text3, fontSize: 12 }}>
              Ninguém exigido neste documento — vincule cargos à exigência de treinamento.
            </div>
          )}
          {sel.participantes.map(p => (
            <label key={p.userId}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", background: T.surf, border: `1px solid ${p.presente ? T.accent + "55" : T.border}`, borderRadius: 8, cursor: editavel ? "pointer" : "default" }}>
              <input type="checkbox" checked={!!p.presente} disabled={!editavel}
                onChange={() => togglePresenca(p.userId)}
                style={{ width: 16, height: 16, accentColor: T.accent, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{p.userName}</div>
                <div style={{ fontSize: 11, color: T.text2 }}>{p.cargoNome || "—"}{p.setor ? ` · ${p.setor}` : ""}</div>
              </div>
              {p.jaTreinado && (
                <span style={{ fontSize: 10, fontWeight: 700, color: "#2ab84a" }} title="Já tem treinamento válido nesta revisão — pode assistir de novo (reforço/reciclagem).">
                  ✓ já treinado
                </span>
              )}
            </label>
          ))}
        </div>

        {editavel && (
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16, flexWrap: "wrap" }}>
            <button style={{ ...s.btn, opacity: salvando ? 0.6 : 1 }} disabled={salvando}
              onClick={() => salvar(sel, "Rascunho salvo.")}>💾 Salvar rascunho</button>
            <button style={{ ...s.btnA, opacity: salvando ? 0.6 : 1 }} disabled={salvando} onClick={pedirAssinatura}>
              🔒 Encerrar e assinar lista
            </button>
          </div>
        )}
        {editavel && (
          <div style={{ fontSize: 11, color: T.text3, textAlign: "right", marginTop: 8 }}>
            O treinamento dos presentes só é gravado na matriz quando a lista é assinada.
          </div>
        )}
      </div>

      {assinando && (
        <AssinaturaModal
          user={user}
          titulo={`Lista de presença ${assinando.num}`}
          contexto={`Lista de presença ${assinando.num} — ${doc.codigo} Rev.${doc.versao} — ${presentesDaSessao(assinando).length} presente(s)`}
          papel="Instrutor do Treinamento"
          onClose={() => setAssinando(null)}
          onConfirm={encerrar}
        />
      )}
    </div>
  );
}

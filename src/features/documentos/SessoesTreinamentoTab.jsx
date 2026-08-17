import React, { useMemo, useState } from "react";
import { useTheme } from "../../core/theme";
import { useS } from "../../shared/styles";
import { F, G2, G3, Inp, SecTitle, Sel, TA } from "../../shared/ui";
import { fmt, tod } from "../../core/utils";
import { saveCollection, deleteFromCollection } from "../../firebase";
import { AnexosUpload } from "../../shared/AnexosUpload";
import { AssinaturaModal, exportListaPresencaPDF } from "../pdf/pdfExports";
import { exigidosDoDocumento, indexarEvidencias, statusCelula, documentoExigeTreinamento } from "./treinamento";
import {
  novaSessao, proxNumSessao, presentesDaSessao, podeEncerrar,
  evidenciasDaSessao, sessoesDoDocumento, STATUS_SESSAO,
  SITUACAO, SITUACAO_LABEL, MOTIVOS_DISPENSA, situacaoParticipante, definirSituacao,
  contagemSituacoes, motivoEmDia, comAnexos, semAnexo, pendenteDigitalizacao,
} from "./sessoes";

// Sessões de treinamento presencial de UM documento. A tela mora em arquivo próprio
// pelo mesmo motivo que a Matriz (Fase 3): o GestaoDocumentosTab já passa de 2,7 mil
// linhas. A sessão é a memória do evento; quem treinou continua sendo a evidência na
// coleção `treinamentos`, gravada no momento em que a lista é assinada.

const SIT_COR = {
  [SITUACAO.PRESENTE]: "#2ab84a",
  [SITUACAO.AUSENTE]: "#ff4f6a",
  [SITUACAO.DISPENSADO]: "#8a8f98",
};

export function SessoesTreinamentoTab({
  doc, sessoes = [], colaboradores = [], evidencias = [], catalogoCargos = [], catalogoAreas = [],
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
  // `validadeTreino` guarda até quando o treino de quem está em dia vale: é o que
  // entra no motivo da dispensa automática, para a lista dizer POR QUE a pessoa
  // não foi convocada em vez de marcá-la como ausente.
  const { exigidos, jaTreinados, validadeTreino } = useMemo(() => {
    const ex = exigidosDoDocumento(doc, colaboradores, catalogoCargos, catalogoAreas);
    const indice = indexarEvidencias(evidencias);
    const ok = []; const validade = {};
    for (const e of ex) {
      const st = statusCelula({ doc, userId: e.userId, indice, hoje, admissao: e.admissao });
      if (st.status === "treinado") { ok.push(e.userId); validade[e.userId] = st.venceEm || null; }
    }
    return { exigidos: ex, jaTreinados: ok, validadeTreino: validade };
  }, [doc, colaboradores, catalogoCargos, catalogoAreas, evidencias, hoje]);

  const criar = () => {
    const nova = novaSessao({
      doc, instrutor: { id: user?.uid || user?.id, name: user?.name, cargo: user?.cargo },
      exigidos, jaTreinados, validadeTreino, num: proxNumSessao(sessoes, new Date().getFullYear()), hoje,
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

  const mudarSituacao = (userId, situacao) => {
    setSel(p => ({
      ...p,
      participantes: p.participantes.map(x => (x.userId === userId
        ? definirSituacao(x, situacao,
            // Ao dispensar quem já está em dia, o motivo vem pronto com a validade.
            situacao === SITUACAO.DISPENSADO && x.jaTreinado && !x.motivoDispensa
              ? motivoEmDia(validadeTreino[x.userId] || null)
              : x.motivoDispensa)
        : x)),
    }));
  };

  const mudarMotivo = (userId, motivo) => {
    setSel(p => ({
      ...p,
      participantes: p.participantes.map(x => (x.userId === userId ? { ...x, motivoDispensa: motivo } : x)),
    }));
  };

  const marcarTodos = (situacao) => {
    setSel(p => ({ ...p, participantes: p.participantes.map(x => definirSituacao(x, situacao, x.motivoDispensa)) }));
  };

  // Atalho para o caso que motivou a mudança: quem já está treinado e em dia não foi
  // convocado, e não pode sair como ausente na lista.
  const dispensarQuemEstaEmDia = () => {
    setSel(p => ({
      ...p,
      participantes: p.participantes.map(x => (x.jaTreinado && situacaoParticipante(x) !== SITUACAO.PRESENTE
        ? definirSituacao(x, SITUACAO.DISPENSADO, x.motivoDispensa || motivoEmDia(validadeTreino[x.userId] || null))
        : x)),
    }));
  };

  // Anexo da folha assinada. Grava na hora — arquivo já subiu, o registro precisa
  // acompanhar. Em sessão encerrada é acréscimo (nunca remoção), com histórico.
  const setAnexosSessao = async (updater) => {
    const atuais = sel.anexos || [];
    const proximos = typeof updater === "function" ? updater(atuais) : updater;
    let atualizada;
    if (proximos.length > atuais.length) {
      atualizada = comAnexos(sel, proximos.slice(atuais.length), user?.name || "");
    } else {
      if (sel.status === STATUS_SESSAO.REALIZADA) return;
      const removido = atuais.find(a => !proximos.some(b => b.url === a.url));
      if (!removido) return;
      atualizada = semAnexo(sel, atuais.indexOf(removido));
    }
    setSel(atualizada);
    try {
      await saveCollection("treinamento_sessoes", atualizada.id, atualizada);
      if (proximos.length > atuais.length) {
        await auditLog?.("Anexou lista de presença digitalizada", "treinamento_sessoes", atualizada.id,
          `${atualizada.num} — ${doc.codigo}`, null, { anexos: atualizada.anexos.length });
        toast_?.("Lista digitalizada anexada.", "green");
      }
    } catch (e) { toast_?.("Erro ao salvar o anexo.", "red"); console.error(e); }
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
                const semDigitalizada = pendenteDigitalizacao(x);
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
                    {semDigitalizada && (
                      <span title="A folha assinada de próprio punho ainda não foi digitalizada e anexada."
                        style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "#e8a33d22", color: "#e8a33d" }}>
                        ⚠️ lista física não anexada
                      </span>
                    )}
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
  const conta = contagemSituacoes(sel);
  const novaAindaNaoSalva = !sessoes.some(x => x.id === sel.id);
  const anexos = sel.anexos || [];

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
            {!realizada && (
              <button style={s.btnA} onClick={() => exportListaPresencaPDF(sel, doc, { modo: "coleta" })}
                title="Folha para levar à sala: quadradinho de presença e linha de assinatura de próprio punho para cada convocado.">
                🖨️ Folha para assinatura
              </button>
            )}
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

        <SecTitle icon="✅" ch={`Presença (${conta.presente} presente(s) · ${conta.ausente} ausente(s) · ${conta.dispensado} não aplicável)`} />
        {editavel && (
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <button style={{ ...s.btn, fontSize: 11 }} onClick={() => marcarTodos(SITUACAO.PRESENTE)}>Marcar todos presentes</button>
            <button style={{ ...s.btn, fontSize: 11 }} onClick={() => marcarTodos(SITUACAO.AUSENTE)}>Limpar</button>
            <button style={{ ...s.btn, fontSize: 11 }} onClick={dispensarQuemEstaEmDia}
              title="Quem já tem treinamento válido não foi convocado — sai como Não aplicável, não como ausente.">
              Dispensar quem está em dia
            </button>
            <span style={{ fontSize: 11, color: T.text3, alignSelf: "center" }}>
              Participantes vêm de quem o documento exige, pelo cargo e setor.
            </span>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {sel.participantes.length === 0 && (
            <div style={{ textAlign: "center", padding: "1.5rem", color: T.text3, fontSize: 12 }}>
              Ninguém exigido neste documento — vincule cargos à exigência de treinamento.
            </div>
          )}
          {sel.participantes.map(p => {
            const sit = situacaoParticipante(p);
            const cor = SIT_COR[sit];
            return (
              <div key={p.userId}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", background: T.surf, border: `1px solid ${sit === SITUACAO.PRESENTE ? T.accent + "55" : T.border}`, borderRadius: 8, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                    {p.userName}
                    {p.temLogin === false && (
                      <span style={{ fontSize: 10, fontWeight: 400, color: T.text3 }} title="Sem login no sistema — assina a folha impressa de próprio punho."> · sem login</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: T.text2 }}>{p.cargoNome || "—"}{p.setor ? ` · ${p.setor}` : ""}</div>
                  {sit === SITUACAO.DISPENSADO && (
                    editavel ? (
                      <Sel value={MOTIVOS_DISPENSA.includes(p.motivoDispensa) ? p.motivoDispensa : (p.motivoDispensa ? "__livre" : "")}
                        sx={{ marginTop: 6, fontSize: 11, padding: "4px 8px" }}
                        onChange={e => mudarMotivo(p.userId, e.target.value === "__livre" ? (p.motivoDispensa || "") : e.target.value)}>
                        <option value="">Motivo da dispensa…</option>
                        {MOTIVOS_DISPENSA.map(m => <option key={m} value={m}>{m}</option>)}
                        {p.motivoDispensa && !MOTIVOS_DISPENSA.includes(p.motivoDispensa) && (
                          <option value="__livre">{p.motivoDispensa}</option>
                        )}
                      </Sel>
                    ) : (
                      <div style={{ fontSize: 11, color: T.text3, marginTop: 3 }}>{p.motivoDispensa || "sem motivo registrado"}</div>
                    )
                  )}
                </div>
                {p.jaTreinado && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#2ab84a" }} title="Já tem treinamento válido nesta revisão — pode assistir de novo (reforço/reciclagem).">
                    ✓ já treinado
                  </span>
                )}
                {editavel ? (
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    {[SITUACAO.PRESENTE, SITUACAO.AUSENTE, SITUACAO.DISPENSADO].map(op => (
                      <button key={op} onClick={() => mudarSituacao(p.userId, op)}
                        title={op === SITUACAO.DISPENSADO ? "Não convocado para esta sessão — não conta como falta" : ""}
                        style={{
                          fontSize: 10, fontWeight: 700, padding: "5px 9px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
                          background: sit === op ? SIT_COR[op] + "22" : "transparent",
                          color: sit === op ? SIT_COR[op] : T.text3,
                          border: `1px solid ${sit === op ? SIT_COR[op] + "66" : T.border}`,
                        }}>
                        {SITUACAO_LABEL[op]}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: cor + "22", color: cor }}>
                    {SITUACAO_LABEL[sit]}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 20 }}>
          <SecTitle icon="📎" ch="Lista assinada (digitalizada)" />
          <div style={{ fontSize: 11, color: T.text3, marginBottom: 10 }}>
            Anexe aqui a folha de presença assinada de próprio punho. É o registro primário de
            quem não tem login no sistema. Pode ser anexada depois de a sessão ser encerrada —
            {realizada
              ? " em sessão encerrada o anexo é acréscimo, não alteração: entra e não sai."
              : " a folha é digitalizada depois da sala."}
          </div>
          {realizada && pendenteDigitalizacao(sel) && (
            <div style={{ background: "#e8a33d12", border: "1px solid #e8a33d33", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 12, color: T.text2 }}>
              ⚠️ <strong style={{ color: T.text }}>Pendente:</strong> a folha assinada ainda não foi digitalizada e anexada.
              Os treinamentos já estão registrados na matriz; o que falta é arquivar a evidência física.
            </div>
          )}
          {podeRegistrar ? (
            <AnexosUpload
              anexos={anexos} setAnexos={setAnexosSessao}
              inputId={`anexo-sessao-${sel.id}`}
              podeRemover={!realizada}
              accept="image/*,.pdf"
              dica="Digitalização da folha assinada (PDF ou foto) — até 10MB por arquivo"
            />
          ) : anexos.length === 0 ? (
            <div style={{ fontSize: 12, color: T.text3 }}>Nenhuma lista digitalizada anexada.</div>
          ) : (
            <AnexosUpload anexos={anexos} setAnexos={() => {}} inputId={`anexo-sessao-ro-${sel.id}`} podeRemover={false} bloqueado />
          )}
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

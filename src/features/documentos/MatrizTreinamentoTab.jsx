import React, { useMemo, useState } from "react";
import { useTheme } from "../../core/theme";
import { useS } from "../../shared/styles";
import { SecTitle } from "../../shared/ui";
import { tod, fmt } from "../../core/utils";
import { saveCollection, getCollection } from "../../firebase";
import {
  montarMatriz, pendentesDoUsuario, planoMigracaoTreinamento,
  exigidosDoDocumento, novaEvidencia, filaDeReciclagem,
} from "./treinamento";

// Cores do semáforo — as mesmas em toda a tela, para a leitura ser imediata.
// `vencido` tem cor própria (não vermelho) porque a ação é outra: reciclar quem
// já sabia, em vez de treinar quem nunca foi treinado.
const COR = { treinado: "#2ab84a", pendente: "#e8a33d", atrasado: "#ff4f6a", vencido: "#9c6ade" };
const ICONE = { treinado: "✓", pendente: "○", atrasado: "!", vencido: "↻" };
const ROTULO = { treinado: "Treinado", pendente: "Pendente", atrasado: "Atrasado", vencido: "Reciclagem vencida" };

export function MatrizTreinamentoTab({
  docs = [], colaboradores = [], treinamentos = [], catalogoCargos = [],
  user, perm, isAdmin, toast_, auditLog, onAbrirDoc, onVoltar,
}) {
  const T = useTheme(); const s = useS();
  const hoje = tod();
  const [filtroCargo, setFiltroCargo] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [busca, setBusca] = useState("");
  const [migrando, setMigrando] = useState(false);
  const podeGerir = isAdmin || (perm?.("gerenciarTreinamento") ?? false);
  const meuId = String(user?.uid || user?.id || "");

  const matriz = useMemo(
    () => montarMatriz({ docs, pessoas: colaboradores, evidencias: treinamentos, catalogoCargos, hoje }),
    [docs, colaboradores, treinamentos, catalogoCargos, hoje]
  );

  const meusPendentes = useMemo(
    () => pendentesDoUsuario({ docs, pessoas: colaboradores, evidencias: treinamentos, catalogoCargos, userId: meuId, hoje }),
    [docs, colaboradores, treinamentos, catalogoCargos, meuId, hoje]
  );

  // Sem permissão de gestão, a pessoa vê só a própria régua — não o cadastro inteiro.
  const linhasVisiveis = useMemo(() => {
    let ls = podeGerir ? matriz.linhas : matriz.linhas.filter(l => l.userId === meuId);
    if (filtroCargo !== "todos") ls = ls.filter(l => (l.cargoId || "—") === filtroCargo);
    if (filtroStatus !== "todos") ls = ls.filter(l => l[filtroStatus] > 0);
    const q = busca.trim().toLowerCase();
    if (q) ls = ls.filter(l => l.userName.toLowerCase().includes(q) || (l.cargoNome || "").toLowerCase().includes(q));
    return ls;
  }, [matriz.linhas, podeGerir, meuId, filtroCargo, filtroStatus, busca]);

  // Fila de reciclagem — o análogo da revisão periódica dos documentos, aplicado
  // à competência: avisa antes de vencer, em vez de só constatar o vencido.
  const fila = useMemo(
    () => filaDeReciclagem({ docs, pessoas: colaboradores, evidencias: treinamentos, catalogoCargos, hoje, janelaDias: 60 }),
    [docs, colaboradores, treinamentos, catalogoCargos, hoje]
  );
  const filaVisivel = podeGerir ? fila : fila.filter(f => f.userId === meuId);

  const cargosNaMatriz = useMemo(() => {
    const m = new Map();
    for (const l of matriz.linhas) if (l.cargoId) m.set(l.cargoId, l.cargoNome);
    return [...m.entries()];
  }, [matriz.linhas]);

  // ── Confirmar a própria leitura ────────────────────────────────────────────
  const confirmarLeitura = async (doc) => {
    try {
      const ex = exigidosDoDocumento(doc, colaboradores, catalogoCargos).find(e => e.userId === meuId);
      const ev = novaEvidencia({
        doc, user: { id: meuId, name: user?.name }, cargoNome: ex?.cargoNome,
        modo: "leitura", dataRealizacao: hoje, registradoPor: user?.name,
        obs: "Confirmado pelo próprio colaborador",
      });
      await saveCollection("treinamentos", ev.id, ev);
      await auditLog?.("Confirmou Treinamento", "treinamentos", ev.id, `${doc.codigo} Rev.${doc.versao} — ${user?.name}`, null, { docId: doc.id, versao: doc.versao });
      toast_?.("Leitura confirmada!", "green");
    } catch (e) { toast_?.("Erro ao confirmar leitura.", "red"); console.error(e); }
  };

  // ── Migração dos mecanismos antigos ────────────────────────────────────────
  const migrar = async () => {
    if (!isAdmin) return;
    setMigrando(true);
    try {
      // A subcoleção de treinos é por documento — só busca a dos que têm controle antigo.
      const candidatos = docs.filter(d => d.treinamentoObrigatorio || d.leituraObrigatoria?.atribuido);
      const treinosPorDoc = {};
      for (const d of candidatos) {
        try { treinosPorDoc[String(d.id)] = await getCollection(`gestao_docs/${d.id}/treinos`); }
        catch { treinosPorDoc[String(d.id)] = []; }
      }
      const plano = planoMigracaoTreinamento({ docs: candidatos, treinosPorDoc, evidencias: treinamentos });
      if (!plano.evidencias.length && !plano.patches.length) {
        toast_?.(`Nada a migrar. ${plano.jaMigrados} registro(s) já estavam migrados.`, "green");
        setMigrando(false); return;
      }
      if (!window.confirm(
        `Migrar os controles antigos de treinamento?\n\n` +
        `• ${plano.evidencias.length} evidência(s) de treinamento\n` +
        `• ${plano.patches.length} documento(s) ganham exigência de treinamento\n\n` +
        `Registros sem carimbo de versão NÃO são migrados (não se presume que valham para a versão vigente). ` +
        `A ação é segura de repetir.`
      )) { setMigrando(false); return; }

      for (const ev of plano.evidencias) await saveCollection("treinamentos", ev.id, ev);
      for (const p of plano.patches) {
        const doc = docs.find(d => String(d.id) === p.docId);
        if (doc) await saveCollection("gestao_docs", p.docId, { ...doc, treinamento: p.treinamento });
      }
      await auditLog?.("Migrou Controles de Treinamento", "treinamentos", "migracao", "Matriz de Treinamento", null,
        { evidencias: plano.evidencias.length, documentos: plano.patches.length, jaMigrados: plano.jaMigrados });
      toast_?.(`${plano.evidencias.length} evidência(s) e ${plano.patches.length} documento(s) migrados.`, "green");
    } catch (e) { toast_?.("Erro na migração.", "red"); console.error(e); }
    setMigrando(false);
  };

  const exportarCSV = () => {
    const head = ["Colaborador", "Cargo", "Setor", "Documento", "Codigo", "Revisao", "Status", "Dias em aberto", "Data do treinamento", "Vence em"];
    const linhas = [head];
    for (const l of linhasVisiveis) {
      for (const doc of matriz.colunas) {
        const cel = l.celulas.get(String(doc.id));
        if (!cel) continue;
        linhas.push([
          l.userName, l.cargoNome || "—", l.setor || "—",
          doc.titulo || "", doc.codigo || "", `Rev.${doc.versao}`,
          ROTULO[cel.status], cel.status === "treinado" ? "" : cel.dias,
          cel.evidencia?.dataRealizacao || "", cel.venceEm || "",
        ]);
      }
    }
    const csv = linhas.map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `matriz-treinamento-${hoje}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const KPI = ({ label, valor, cor, sub }) => (
    <div style={{ ...s.card, margin: 0, padding: "14px 18px", flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 11, color: T.text3, fontWeight: 700, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: cor || T.text, lineHeight: 1.2 }}>{valor}</div>
      {sub && <div style={{ fontSize: 11, color: T.text3 }}>{sub}</div>}
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <button style={s.btn} onClick={onVoltar}>← Voltar</button>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: T.text, margin: 0 }}>📚 Matriz de Treinamento</h2>
        <div style={{ flex: 1 }} />
        <button style={s.btn} onClick={exportarCSV}>📥 CSV</button>
        {isAdmin && (
          <button style={{ ...s.btn, opacity: migrando ? 0.6 : 1 }} disabled={migrando} onClick={migrar}
            title="Traz para a matriz os controles antigos (leitura obrigatória e treinamentos por documento)">
            {migrando ? "Migrando..." : "🔄 Migrar controles antigos"}
          </button>
        )}
      </div>

      {/* Meus pendentes — a régua da própria pessoa vem primeiro */}
      {meusPendentes.length > 0 && (
        <div style={{ ...s.card, border: `1px solid ${COR.pendente}55` }}>
          <SecTitle icon="📖" ch={`Meus treinamentos pendentes (${meusPendentes.length})`} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {meusPendentes.map(({ doc, status, dias }) => (
              <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: T.surf, border: `1px solid ${T.border}`, borderRadius: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 18 }}>{status === "atrasado" ? "🔴" : status === "vencido" ? "↻" : "📄"}</span>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{doc.codigo} — {doc.titulo}</div>
                  <div style={{ fontSize: 11, color: T.text2 }}>
                    Rev.{doc.versao} · {status === "vencido" ? "reciclagem vencida" : "em aberto"} há {dias} dia(s)
                    {status === "atrasado" && <strong style={{ color: COR.atrasado }}> · prazo vencido</strong>}
                    {status === "vencido" && <strong style={{ color: COR.vencido }}> · precisa reciclar</strong>}
                  </div>
                </div>
                <button style={s.btn} onClick={() => onAbrirDoc?.(doc)}>Abrir documento</button>
                {doc.treinamento?.modo === "leitura" && (
                  <button style={s.btnA} onClick={() => confirmarLeitura(doc)}>✅ Li e entendi</button>
                )}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: T.text3, marginTop: 8 }}>
            Treinamento presencial é registrado pelo instrutor, na tela do documento.
          </div>
        </div>
      )}

      {/* Fila de reciclagem — vence nos próximos 60 dias */}
      {filaVisivel.length > 0 && (
        <div style={{ ...s.card, border: `1px solid ${COR.vencido}55` }}>
          <SecTitle icon="↻" ch={`Reciclagem vencendo nos próximos 60 dias (${filaVisivel.length})`} />
          <div style={{ fontSize: 11, color: T.text3, marginBottom: 10 }}>
            Treinamentos ainda válidos, mas com validade se aproximando. Programar agora evita que virem não conformidade.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {filaVisivel.slice(0, 12).map(f => (
              <div key={`${f.doc.id}-${f.userId}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", background: T.surf, border: `1px solid ${T.border}`, borderRadius: 8, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{f.userName}</div>
                  <div style={{ fontSize: 11, color: T.text2 }}>{f.doc.codigo} — {f.doc.titulo} · {f.cargoNome}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: f.diasParaVencer <= 15 ? COR.atrasado : COR.vencido }}>
                  vence em {f.diasParaVencer}d · {fmt(f.venceEm)}
                </span>
                <button style={s.btn} onClick={() => onAbrirDoc?.(f.doc)}>Abrir</button>
              </div>
            ))}
            {filaVisivel.length > 12 && (
              <div style={{ fontSize: 11, color: T.text3, textAlign: "center", paddingTop: 4 }}>
                e mais {filaVisivel.length - 12} — use o CSV para a lista completa.
              </div>
            )}
          </div>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <KPI label="Conformidade" valor={`${matriz.resumo.conformidade}%`}
          cor={matriz.resumo.conformidade === 100 ? COR.treinado : matriz.resumo.atrasado > 0 ? COR.atrasado : COR.pendente}
          sub={`${matriz.resumo.treinado} de ${matriz.resumo.total} exigências`} />
        <KPI label="Atrasados" valor={matriz.resumo.atrasado} cor={matriz.resumo.atrasado > 0 ? COR.atrasado : T.text3} sub="nunca treinaram" />
        <KPI label="A reciclar" valor={matriz.resumo.vencido} cor={matriz.resumo.vencido > 0 ? COR.vencido : T.text3} sub="validade expirada" />
        <KPI label="Pendentes" valor={matriz.resumo.pendente} cor={COR.pendente} sub="dentro do prazo" />
        <KPI label="Documentos" valor={matriz.colunas.length} sub="vigentes que exigem treinamento" />
        <KPI label="Pessoas" valor={matriz.linhas.length} sub="com alguma exigência" />
      </div>

      {/* Filtros */}
      {podeGerir && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <input placeholder="Buscar pessoa ou cargo..." value={busca} onChange={e => setBusca(e.target.value)}
            style={{ ...s.inp, flex: 1, minWidth: 180, fontSize: 12 }} />
          <select value={filtroCargo} onChange={e => setFiltroCargo(e.target.value)} style={{ ...s.inp, fontSize: 12 }}>
            <option value="todos">Todos os cargos</option>
            {cargosNaMatriz.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
          </select>
          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={{ ...s.inp, fontSize: 12 }}>
            <option value="todos">Qualquer situação</option>
            <option value="atrasado">Com atraso</option>
            <option value="vencido">Com reciclagem vencida</option>
            <option value="pendente">Com pendência</option>
          </select>
        </div>
      )}

      {/* A matriz */}
      <div style={s.card}>
        {matriz.colunas.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem", color: T.text3, fontSize: 13 }}>
            Nenhum documento vigente exige treinamento ainda.<br />
            <span style={{ fontSize: 11 }}>Configure na aba Treinamento de cada documento, vinculando os cargos exigidos.</span>
          </div>
        ) : linhasVisiveis.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem", color: T.text3, fontSize: 13 }}>
            Nenhuma pessoa encontrada com os filtros atuais.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: "100%" }}>
              <thead>
                <tr>
                  <th style={{ position: "sticky", left: 0, zIndex: 2, background: T.surf, padding: "8px 10px", textAlign: "left", color: T.text3, fontSize: 10, textTransform: "uppercase", borderBottom: `1px solid ${T.border}`, minWidth: 190 }}>
                    Colaborador
                  </th>
                  {matriz.colunas.map(doc => (
                    <th key={doc.id} title={`${doc.codigo} — ${doc.titulo} (Rev.${doc.versao})`}
                      style={{ padding: "8px 6px", borderBottom: `1px solid ${T.border}`, background: T.surf, color: T.text3, fontSize: 10, fontWeight: 700, minWidth: 46, maxWidth: 46 }}>
                      <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", whiteSpace: "nowrap", maxHeight: 130, overflow: "hidden", margin: "0 auto", cursor: "pointer" }}
                        onClick={() => onAbrirDoc?.(doc)}>
                        {doc.codigo}
                      </div>
                    </th>
                  ))}
                  <th style={{ padding: "8px 10px", borderBottom: `1px solid ${T.border}`, background: T.surf, color: T.text3, fontSize: 10, textTransform: "uppercase" }}>%</th>
                </tr>
              </thead>
              <tbody>
                {linhasVisiveis.map((l, i) => {
                  const totalLinha = l.celulas.size;
                  const pct = totalLinha ? Math.round((l.treinado / totalLinha) * 100) : 100;
                  return (
                    <tr key={l.userId} style={{ background: i % 2 === 0 ? T.bg : T.surf }}>
                      <td style={{ position: "sticky", left: 0, zIndex: 1, background: i % 2 === 0 ? T.bg : T.surf, padding: "7px 10px", borderBottom: `1px solid ${T.border}` }}>
                        <div style={{ fontWeight: 600, color: T.text }}>{l.userName}</div>
                        <div style={{ fontSize: 10, color: T.text3 }}>{l.cargoNome || "—"}{l.setor ? ` · ${l.setor}` : ""}</div>
                      </td>
                      {matriz.colunas.map(doc => {
                        const cel = l.celulas.get(String(doc.id));
                        if (!cel) return <td key={doc.id} style={{ borderBottom: `1px solid ${T.border}`, textAlign: "center", color: T.border }}>·</td>;
                        return (
                          <td key={doc.id} style={{ borderBottom: `1px solid ${T.border}`, textAlign: "center", padding: "4px 2px" }}
                            title={`${l.userName} — ${doc.codigo} Rev.${doc.versao}\n${ROTULO[cel.status]}${cel.status === "treinado" ? ` em ${fmt(cel.evidencia?.dataRealizacao)}` : ` há ${cel.dias} dia(s)`}`}>
                            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: 6, fontSize: 11, fontWeight: 800, background: COR[cel.status] + "22", color: COR[cel.status] }}>
                              {ICONE[cel.status]}
                            </span>
                          </td>
                        );
                      })}
                      <td style={{ borderBottom: `1px solid ${T.border}`, textAlign: "center", padding: "7px 10px", fontWeight: 700, color: pct === 100 ? COR.treinado : l.atrasado > 0 ? COR.atrasado : COR.pendente }}>
                        {pct}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ display: "flex", gap: 14, marginTop: 12, flexWrap: "wrap", fontSize: 11, color: T.text3 }}>
          {Object.keys(COR).map(k => (
            <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: 5, fontSize: 10, fontWeight: 800, background: COR[k] + "22", color: COR[k] }}>{ICONE[k]}</span>
              {ROTULO[k]}
            </span>
          ))}
          <span>· Coluna vazia (·) = não exigido para a pessoa</span>
        </div>
      </div>
    </div>
  );
}

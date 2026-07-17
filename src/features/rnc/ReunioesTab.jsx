import React, { useEffect, useMemo, useState } from "react";
import { deleteFromCollection, saveCollection, subscribeCollection } from "../../firebase";
import { useTheme } from "../../core/theme";
import { fmt, past, tod } from "../../core/utils";
import { useS } from "../../shared/styles";
import { F, G2, G3, Inp, SecTitle, Sel, SevB, TA, Tooltip } from "../../shared/ui";
import { AssinaturaModal, exportAtaReuniaoPDF } from "../pdf/pdfExports";
import { calcGut } from "./RncTabs";

// Reunião de Análise Crítica (RAC) — o fórum onde a gestão analisa as RNCs em aberto e
// delibera. O que a reunião produz não é um registro paralelo: cada deliberação age na
// própria RNC (doUpdateRNC + entrada no histórico dela). A reunião guarda apenas a
// memória do fórum — quem participou, o que entrou em pauta e o que se decidiu.

// Por que uma RNC entra na pauta. Uma RNC pode entrar por mais de um motivo.
const MOTIVOS = {
  ineficaz:       { label: "Eficácia reprovada",            cor: "#ff4f6a" },
  vencida:        { label: "Prazo de AC vencido",           cor: "#ff4f6a" },
  critica:        { label: "Crítica sem aprovação do RT",   cor: "#ff8c42" },
  pendente_verif: { label: "Pendente de verificação",       cor: "#4fc3f7" },
  aberta:         { label: "Em tratamento",                 cor: "#ffd166" },
};
const motivoLabel = (m) => MOTIVOS[m]?.label || m;

const DELIBERACOES = {
  manter:         { label: "Manter o tratamento", desc: "Registra a análise crítica na RNC, sem alterar prazo ou responsável." },
  reforcar_prazo: { label: "Reforçar prazo",      desc: "Grava um novo prazo de ação corretiva na RNC." },
  cobrar:         { label: "Cobrar responsável",  desc: "Registra a cobrança na RNC e abre o e-mail de notificação." },
  escalar:        { label: "Escalar severidade",  desc: "Eleva a severidade da RNC e notifica o responsável. Afeta GUT, Pareto e a exigência de aprovação do RT." },
  // A gestão aprova o encerramento, mas quem encerra de fato continua sendo a aba
  // Eficácia — que exige critério, evidência e resultado. Segregação preservada.
  aprovar_encerramento: { label: "Aprovar encerramento", desc: "Registra a aprovação da gestão. O encerramento formal continua na aba Eficácia." },
};
const deliberacaoLabel = (d) => DELIBERACOES[d]?.label || d;

const SEV_ORDEM = ["Menor", "Maior", "Crítica"];
// Escalar só faz sentido para cima.
const sevAcimaDe = (sev) => SEV_ORDEM.slice(SEV_ORDEM.indexOf(sev) + 1);
// Aprovar encerramento só cabe em quem está esperando verificação.
const deliberacoesAplicaveis = (rnc) => Object.keys(DELIBERACOES).filter(k => {
  if (k === "aprovar_encerramento") return rnc?.status === "Pendente verificação";
  if (k === "escalar") return sevAcimaDe(rnc?.sev || "Crítica").length > 0;
  return true;
});

function motivosDaRnc(r) {
  const m = [];
  // Ação corretiva que falhou na verificação: o item mais importante para a gestão
  // discutir, independente de severidade — entra na pauta por direito próprio.
  if (r.status === "Ineficaz") m.push("ineficaz");
  if (past(r.prazoAC) && r.status !== "Eficaz" && r.status !== "Ineficaz") m.push("vencida");
  if (r.sev === "Crítica" && !r.assinaturaRT && r.status !== "Eficaz") m.push("critica");
  if (r.status === "Pendente verificação") m.push("pendente_verif");
  if (r.status === "Aberta" || r.status === "Em andamento") m.push("aberta");
  return m;
}

// Pauta automática: toda RNC que pede atenção da gestão, ordenada por GUT (mesma fórmula
// da Matriz GUT do Dashboard — ver calcGut em RncTabs).
export function candidatasPauta(rncs) {
  return rncs
    .map(r => ({ ...calcGut(r), motivos: motivosDaRnc(r) }))
    .filter(r => r.motivos.length > 0)
    .sort((a, b) => b.gut - a.gut);
}

// Uma RNC que a gestão já olhou 3 vezes e continua na pauta não é um item de rotina:
// é um problema que o fluxo normal não está resolvendo.
export const LIMITE_EMPERRADA = 3;

export function vezesNaPauta(rncId, reunioes, exceto = null) {
  return reunioes.filter(r =>
    r.status === "Encerrada" && r.id !== exceto && (r.pauta || []).some(i => i.rncId === rncId)
  ).length;
}

// RNCs que, se entrassem numa reunião agora, já ganhariam o chip de emperrada —
// usado pelos Indicadores e pelo Dashboard Executivo (mesmo critério da tela de reunião).
export function rncsEmperradas(rncs, reunioes) {
  return candidatasPauta(rncs).filter(r => vezesNaPauta(r.id, reunioes) >= LIMITE_EMPERRADA - 1);
}

const dataDaReuniao = (r) => r.realizadaEm || r.data;

// O follow-up semanal: o que mudou desde a última reunião encerrada. Sem isso a reunião
// recomeça do zero toda semana e ninguém enxerga se a fila está andando ou enchendo.
export function calcDelta(rncs, reunioes, reuniaoAtual) {
  const anterior = reunioes
    .filter(r => r.status === "Encerrada" && r.id !== reuniaoAtual?.id)
    .sort((a, b) => String(dataDaReuniao(b)).localeCompare(String(dataDaReuniao(a))))[0];
  if (!anterior) return null;

  const desde = dataDaReuniao(anterior);
  const ate = reuniaoAtual ? dataDaReuniao(reuniaoAtual) : tod();
  const naJanela = (d) => d && d > desde && d <= ate;
  const encerrada = (r) => r.status === "Eficaz" || r.status === "Ineficaz";

  return {
    desde, ate, numAnterior: anterior.num,
    abriram:    rncs.filter(r => naJanela(r.data)),
    encerraram: rncs.filter(r => encerrada(r) && naJanela(r.eficacia?.data)),
    venceram:   rncs.filter(r => naJanela(r.prazoAC) && !encerrada(r)),
  };
}

function proxNum(reunioes) {
  const pref = `RAC-${new Date().getFullYear()}-`;
  const ult = reunioes
    .filter(r => String(r.num || "").startsWith(pref))
    .reduce((max, r) => Math.max(max, parseInt(String(r.num).slice(pref.length), 10) || 0), 0);
  return `${pref}${String(ult + 1).padStart(2, "0")}`;
}

const RSTATUS = {
  "Agendada":     { c: "#4fc3f7", bg: "#4fc3f718" },
  "Em andamento": { c: "#ffd166", bg: "#ffd16618" },
  "Encerrada":    { c: "#2ab84a", bg: "#2ab84a18" },
};

function RBadge({ st }) {
  const m = RSTATUS[st] || RSTATUS["Agendada"];
  return <span style={{ display: "inline-flex", padding: "2px 9px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: m.bg, color: m.c, border: `1px solid ${m.c}22` }}>{st}</span>;
}

function MotivoChip({ m }) {
  const meta = MOTIVOS[m];
  if (!meta) return null;
  return <span style={{ display: "inline-flex", padding: "1px 7px", borderRadius: 20, fontSize: 9, fontWeight: 600, background: `${meta.cor}18`, color: meta.cor, border: `1px solid ${meta.cor}22` }}>{meta.label}</span>;
}

function EmperradaChip({ n }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "1px 7px", borderRadius: 20, fontSize: 9, fontWeight: 700, background: "#ff4f6a18", color: "#ff4f6a", border: "1px solid #ff4f6a33" }}>
      🔁 Emperrada · {n}ª vez
      <Tooltip text={`Esta RNC já esteve na pauta de ${LIMITE_EMPERRADA}+ reuniões encerradas e continua sem sair — sinal de que o tratamento normal não está resolvendo. Vale considerar Escalar ou Cobrar.`} />
    </span>
  );
}

// Um número do delta. `tom` só destaca o que é má notícia (venceram).
function DeltaNum({ n, label, tom }) {
  const T = useTheme();
  const cor = tom === "ruim" ? "#ff4f6a" : tom === "bom" ? "#2ab84a" : T.text;
  return (
    <div style={{ flex: 1, minWidth: 90 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: cor, lineHeight: 1 }}>{n}</div>
      <div style={{ fontSize: 10, color: T.text2, marginTop: 3 }}>{label}</div>
    </div>
  );
}

export function ReunioesTab({ rncs, user, users = [], toast_, doUpdateRNC, openEmail, perm, isAdmin }) {
  const T = useTheme(); const s = useS();
  const [reunioes, setReunioes] = useState([]);
  const [sel, setSel] = useState(null);
  const [nova, setNova] = useState(null);
  const [assinaturaModal, setAssinaturaModal] = useState(null);

  useEffect(() => subscribeCollection("rnc_reunioes", setReunioes), []);

  const podeGerenciar = isAdmin || (perm ? perm("gerenciarReunioesRNC") : false);
  const candidatas = useMemo(() => candidatasPauta(rncs), [rncs]);
  const lista = useMemo(() => [...reunioes].sort((a, b) => String(b.num || "").localeCompare(String(a.num || ""))), [reunioes]);

  const hEntry = (acao) => ({ data: tod(), hora: new Date().toLocaleTimeString("pt-BR"), acao, resp: user.name });

  const salvar = async (reuniao, msg) => {
    try {
      await saveCollection("rnc_reunioes", reuniao.id, reuniao);
      setReunioes(p => p.some(x => x.id === reuniao.id) ? p.map(x => x.id === reuniao.id ? reuniao : x) : [reuniao, ...p]);
      setSel(p => p && p.id === reuniao.id ? reuniao : p);
      if (msg) toast_(msg, "green");
      return true;
    } catch (e) {
      toast_("Erro ao salvar reunião: " + e.message, "red");
      return false;
    }
  };

  // ── Nova reunião ──
  const abrirNova = () => {
    const de = new Date(Date.now() - 7 * 864e5).toISOString().split("T")[0];
    setNova({
      data: tod(), de, ate: tod(),
      participIds: [],
      pautaIds: candidatas.map(r => r.id),
    });
  };

  const criar = async () => {
    const itens = candidatas.filter(r => nova.pautaIds.includes(r.id));
    if (itens.length === 0) { toast_("Selecione ao menos uma RNC para a pauta.", "red"); return; }
    const reuniao = {
      id: String(Date.now()),
      num: proxNum(reunioes),
      data: nova.data,
      realizadaEm: null,
      status: "Agendada",
      facilitador: user.name,
      periodoRef: { de: nova.de, ate: nova.ate },
      participantes: users
        .filter(u => nova.participIds.includes(u.uid || u.id))
        .map(u => ({ id: u.uid || u.id, nome: u.name, cargo: u.cargo || "", presente: false })),
      pauta: montarPauta(itens),
      observacoesGerais: "",
      proximaReuniao: "",
      ata: null,
      criadoPor: user.name,
      createdAt: Date.now(),
      historico: [],
    };
    reuniao.historico = [{ data: tod(), hora: new Date().toLocaleTimeString("pt-BR"), acao: `Reunião ${reuniao.num} agendada para ${fmt(nova.data)} — ${itens.length} item(ns) de pauta`, resp: user.name }];
    if (await salvar(reuniao, `Reunião ${reuniao.num} agendada!`)) { setNova(null); setSel(reuniao); }
  };

  // ── Condução ──
  const iniciar = async () => {
    await salvar({
      ...sel, status: "Em andamento", realizadaEm: tod(),
      historico: [...(sel.historico || []), hEntry("Reunião iniciada")],
    }, "Reunião iniciada — registre a presença e percorra a pauta.");
  };

  const togglePresenca = (idx) => {
    const participantes = sel.participantes.map((p, i) => i === idx ? { ...p, presente: !p.presente } : p);
    salvar({ ...sel, participantes });
  };

  const setItem = (idx, patch) => setSel(p => ({ ...p, pauta: p.pauta.map((x, i) => i === idx ? { ...x, ...patch } : x) }));

  // O ato central: a deliberação age na RNC, não num registro paralelo.
  const deliberar = async (idx) => {
    const it = sel.pauta[idx];
    if (!it.deliberacao) { toast_("Escolha a deliberação do item.", "red"); return; }
    if (it.deliberacao === "reforcar_prazo" && !it.novoPrazo) { toast_("Informe o novo prazo de ação corretiva.", "red"); return; }
    if (it.deliberacao === "escalar" && !it.novaSeveridade) { toast_("Escolha a nova severidade.", "red"); return; }
    const rnc = rncs.find(r => r.id === it.rncId);
    if (!rnc) { toast_(`RNC ${it.rncNum} não encontrada — pode ter sido excluída.`, "red"); return; }
    // A RNC pode ter mudado de estado entre agendar a pauta e deliberar.
    if (it.deliberacao === "aprovar_encerramento" && rnc.status !== "Pendente verificação") {
      toast_(`RNC ${it.rncNum} está em "${rnc.status}" — aprovar encerramento só cabe em Pendente verificação.`, "red"); return;
    }

    const detalhes = [
      it.encaminhamento && `Encaminhamento: ${it.encaminhamento}`,
      it.novoResponsavel && `Responsável indicado: ${it.novoResponsavel}`,
      it.deliberacao === "reforcar_prazo" && `Novo prazo: ${fmt(it.novoPrazo)} (anterior: ${fmt(rnc.prazoAC)})`,
      it.deliberacao === "escalar" && `Severidade: ${rnc.sev} -> ${it.novaSeveridade}`,
      it.deliberacao === "aprovar_encerramento" && "Encerramento aprovado pela gestão — falta registrar a verificação de eficácia.",
    ].filter(Boolean);

    const h = {
      data: tod(), hora: new Date().toLocaleTimeString("pt-BR"),
      acao: `Deliberado na ${sel.num}: ${deliberacaoLabel(it.deliberacao)}`,
      resp: user.name, tipo: "reuniao", detalhes,
    };
    const patch = {
      historico: [...(rnc.historico || []), h],
      ultimaReuniao: { num: sel.num, data: sel.realizadaEm || sel.data },
    };
    if (it.deliberacao === "reforcar_prazo") patch.prazoAC = it.novoPrazo;
    if (it.deliberacao === "escalar") patch.sev = it.novaSeveridade;
    if (it.deliberacao === "aprovar_encerramento") patch.encerramentoAprovado = { reuniao: sel.num, por: user.name, data: tod() };

    try {
      await doUpdateRNC(rnc.id, patch);
    } catch (e) {
      toast_("Erro ao gravar a deliberação na RNC: " + e.message, "red");
      return;
    }
    if (it.deliberacao === "cobrar" || it.deliberacao === "escalar") openEmail({ ...rnc, ...patch }, "manual");

    const pauta = sel.pauta.map((x, i) => i === idx ? { ...x, itemStatus: "deliberado", deliberadoEm: tod(), deliberadoPor: user.name } : x);
    await salvar({
      ...sel, pauta,
      historico: [...(sel.historico || []), hEntry(`RNC ${it.rncNum} — ${deliberacaoLabel(it.deliberacao)}`)],
    }, `Deliberação gravada no histórico da RNC ${it.rncNum}.`);
  };

  const pendentes = sel?.pauta?.filter(i => i.itemStatus !== "deliberado").length || 0;

  const encerrar = () => {
    if (pendentes > 0) { toast_(`Faltam ${pendentes} item(ns) sem deliberação.`, "red"); return; }
    setAssinaturaModal(sel);
  };

  // Monta os itens de pauta a partir das RNCs de agora. Usado ao agendar e ao
  // reatualizar uma reunião ainda Agendada.
  const montarPauta = (candidatas) => candidatas.map(r => ({
    rncId: r.id, rncNum: r.num, sev: r.sev, desc: r.desc, gut: r.gut,
    motivoEntrada: r.motivos, situacao: r.status,
    deliberacao: "", encaminhamento: "", novoResponsavel: "", novoPrazo: "",
    itemStatus: "pendente",
  }));

  // A pauta é uma fotografia do momento em que a reunião foi agendada. Numa reunião
  // recorrente, agendada com dias de antecedência, essa foto envelhece — daí o botão.
  const atualizarPauta = async () => {
    const atual = montarPauta(candidatas);
    const antes = sel.pauta?.length || 0;
    await salvar({
      ...sel, pauta: atual,
      historico: [...(sel.historico || []), hEntry(`Pauta atualizada — ${antes} -> ${atual.length} item(ns)`)],
    }, `Pauta atualizada: ${atual.length} item(ns).`);
  };

  // Recorrência: encerrar uma reunião com "próxima reunião" preenchida já deixa a
  // seguinte agendada, com os mesmos participantes. Sem isso a recorrência depende
  // de alguém lembrar.
  const agendarProxima = async (encerrada) => {
    const itens = montarPauta(candidatas);
    const prox = {
      id: String(Date.now()),
      num: proxNum([...reunioes, encerrada]),
      data: encerrada.proximaReuniao,
      realizadaEm: null,
      status: "Agendada",
      facilitador: encerrada.facilitador,
      periodoRef: { de: dataDaReuniao(encerrada), ate: encerrada.proximaReuniao },
      participantes: (encerrada.participantes || []).map(p => ({ ...p, presente: false })),
      pauta: itens,
      observacoesGerais: "",
      proximaReuniao: "",
      ata: null,
      criadoPor: user.name,
      createdAt: Date.now(),
      historico: [],
      origemRecorrencia: encerrada.num,
    };
    prox.historico = [{ data: tod(), hora: new Date().toLocaleTimeString("pt-BR"), acao: `Agendada automaticamente ao encerrar a ${encerrada.num} — ${itens.length} item(ns) de pauta`, resp: user.name }];
    await saveCollection("rnc_reunioes", prox.id, prox);
    setReunioes(p => [prox, ...p]);
    return prox;
  };

  const excluir = async (r) => {
    if (!window.confirm(`Excluir a reunião ${r.num}? As deliberações já gravadas nas RNCs permanecem no histórico delas.`)) return;
    try {
      await deleteFromCollection("rnc_reunioes", r.id);
      setReunioes(p => p.filter(x => x.id !== r.id));
      setSel(p => p && p.id === r.id ? null : p);
      toast_(`Reunião ${r.num} excluída.`, "green");
    } catch (e) { toast_("Erro ao excluir: " + e.message, "red"); }
  };

  // ── Form de nova reunião ──
  if (nova) {
    return (
      <div>
        <div style={s.card}>
          <SecTitle icon="🗓️" ch="Agendar reunião de análise crítica" />
          <G3 ch={<>
            <F lbl="Data da reunião *" ch={<Inp type="date" value={nova.data} onChange={e => setNova(p => ({ ...p, data: e.target.value }))} />} />
            <F lbl="Período de referência — de" tip="Só informativo, aparece no cabeçalho da reunião e da ata — não filtra a pauta. A pauta é sempre a lista de RNCs que pedem análise crítica agora (vencidas, críticas sem aprovação do RT, etc.), independente desse período." ch={<Inp type="date" value={nova.de} onChange={e => setNova(p => ({ ...p, de: e.target.value }))} />} />
            <F lbl="Período de referência — até" tip="Fim do intervalo mostrado no cabeçalho da reunião e da ata — apenas para dar contexto de qual janela de tempo a reunião cobre." ch={<Inp type="date" value={nova.ate} onChange={e => setNova(p => ({ ...p, ate: e.target.value }))} />} />
          </>} />
          <F lbl="Facilitador" ch={<div style={{ ...s.inp, color: T.text2 }}>{user.name}</div>} />
        </div>

        <div style={s.card}>
          <SecTitle icon="👥" ch={`Participantes (${nova.participIds.length})`} />
          {users.length === 0 ? <div style={{ color: T.text3, fontSize: 13 }}>Nenhum usuário cadastrado.</div> :
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 6 }}>
              {users.map(u => {
                const id = u.uid || u.id;
                const on = nova.participIds.includes(id);
                return (
                  <label key={id} style={{ display: "flex", alignItems: "center", gap: 8, background: T.surf, border: `1px solid ${on ? T.accent + "44" : T.border}`, borderRadius: 8, padding: "8px 10px", cursor: "pointer" }}>
                    <input type="checkbox" checked={on} onChange={() => setNova(p => ({ ...p, participIds: on ? p.participIds.filter(x => x !== id) : [...p.participIds, id] }))} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: T.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</div>
                      {u.cargo && <div style={{ fontSize: 10, color: T.text3 }}>{u.cargo}</div>}
                    </div>
                  </label>
                );
              })}
            </div>}
        </div>

        <div style={s.card}>
          <SecTitle icon="📋" ch={`Pauta sugerida — ${nova.pautaIds.length} de ${candidatas.length} RNC(s)`} />
          <div style={{ fontSize: 11, color: T.text2, marginBottom: 10 }}>
            Sugestão automática: RNCs em tratamento, com prazo vencido, críticas sem aprovação do RT ou pendentes de verificação — ordenadas por GUT. Ajuste antes de agendar.
          </div>
          {candidatas.length === 0 ? <div style={{ color: T.text3, fontSize: 13, textAlign: "center", padding: "1.5rem" }}>Nenhuma RNC pede análise crítica no momento.</div> :
            candidatas.map(r => {
              const on = nova.pautaIds.includes(r.id);
              return (
                <label key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, background: T.surf, border: `1px solid ${on ? T.accent + "44" : T.border}`, borderRadius: 10, padding: "10px 14px", marginBottom: 6, cursor: "pointer" }}>
                  <input type="checkbox" checked={on} onChange={() => setNova(p => ({ ...p, pautaIds: on ? p.pautaIds.filter(x => x !== r.id) : [...p.pautaIds, r.id] }))} />
                  <div style={{ width: 34, textAlign: "center", flexShrink: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: r.gut >= 75 ? "#ff4f6a" : r.gut >= 27 ? "#ff8c42" : "#ffd166", lineHeight: 1 }}>{r.gut}</div>
                    <div style={{ fontSize: 8, color: T.text3 }}>GUT</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: T.accent }}>{r.num}</span>
                      <SevB s={r.sev} />
                      {r.motivos.map(m => <MotivoChip key={m} m={m} />)}
                    </div>
                    <div style={{ fontSize: 12, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.desc || "—"}</div>
                    <div style={{ fontSize: 10, color: T.text2, marginTop: 2 }}>Resp: {r.resp || "—"} · Prazo AC: {fmt(r.prazoAC)}{past(r.prazoAC) ? " ⚠ vencido" : ""}</div>
                  </div>
                </label>
              );
            })}
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button style={s.btn} onClick={() => setNova(null)}>Cancelar</button>
          <button style={s.btnA} onClick={criar}>🗓️ Agendar reunião</button>
        </div>
      </div>
    );
  }

  // ── Reunião aberta ──
  if (sel) {
    const emAndamento = sel.status === "Em andamento";
    const editavel = podeGerenciar && emAndamento;
    const presentes = (sel.participantes || []).filter(p => p.presente).length;
    const delta = calcDelta(rncs, reunioes, sel);

    return (
      <div>
        <div style={{ ...s.card, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button style={s.btn} onClick={() => setSel(null)}>← Voltar</button>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{sel.num}</span>
              <RBadge st={sel.status} />
            </div>
            <div style={{ fontSize: 11, color: T.text2, marginTop: 2 }}>
              {sel.status === "Encerrada" ? `Realizada em ${fmt(sel.realizadaEm)}` : `Agendada para ${fmt(sel.data)}`} · Facilitador: {sel.facilitador}
              {sel.periodoRef?.de && ` · Referência: ${fmt(sel.periodoRef.de)} a ${fmt(sel.periodoRef.ate)}`}
            </div>
          </div>
          {podeGerenciar && sel.status === "Agendada" && <button style={s.btn} onClick={atualizarPauta} title="Recalcula a pauta a partir das RNCs de agora">🔄 Atualizar pauta</button>}
          {podeGerenciar && sel.status === "Agendada" && <button style={s.btnA} onClick={iniciar}>▶️ Iniciar reunião</button>}
          {podeGerenciar && emAndamento && <button style={{ ...s.btnA, color: "#2ab84a", borderColor: "#2ab84a33", background: "#2ab84a12" }} onClick={encerrar}>🔒 Encerrar e assinar ata</button>}
          {sel.status === "Encerrada" && <button style={s.btnA} onClick={() => exportAtaReuniaoPDF(sel, { motivoLabel, deliberacaoLabel, delta })}>📄 Ata em PDF</button>}
          {podeGerenciar && sel.status === "Agendada" && <button style={{ ...s.btn, color: "#ff4f6a", borderColor: "#ff4f6a33" }} onClick={() => excluir(sel)}>🗑️</button>}
        </div>

        {emAndamento && pendentes > 0 && (
          <div style={{ background: "#ffd16618", border: "1px solid #ffd16633", borderRadius: 10, padding: "10px 14px", marginBottom: "1rem", fontSize: 12, color: "#8a6000" }}>
            ⏳ {pendentes} item(ns) da pauta ainda sem deliberação. A ata só pode ser assinada quando todos forem deliberados.
          </div>
        )}

        {delta && (
          <div style={s.card}>
            <SecTitle icon="📈" ch={`Desde a ${delta.numAnterior} — ${fmt(delta.desde)} a ${fmt(delta.ate)}`} />
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <DeltaNum n={delta.abriram.length} label="RNCs abertas" />
              <DeltaNum n={delta.encerraram.length} label="RNCs encerradas" tom="bom" />
              <DeltaNum n={delta.venceram.length} label="Prazos vencidos" tom="ruim" />
              <DeltaNum n={delta.abriram.length - delta.encerraram.length} label="Saldo da fila" tom={delta.abriram.length > delta.encerraram.length ? "ruim" : "bom"} />
            </div>
            {(delta.abriram.length > 0 || delta.venceram.length > 0) && (
              <div style={{ fontSize: 11, color: T.text2, marginTop: 10, borderTop: `1px solid ${T.border}`, paddingTop: 8 }}>
                {delta.abriram.length > 0 && <div>Abertas: {delta.abriram.map(r => r.num).join(", ")}</div>}
                {delta.venceram.length > 0 && <div style={{ color: "#ff4f6a", marginTop: 2 }}>Venceram: {delta.venceram.map(r => r.num).join(", ")}</div>}
              </div>
            )}
          </div>
        )}

        <div style={s.card}>
          <SecTitle icon="👥" ch={`Participantes — ${presentes} presente(s) de ${(sel.participantes || []).length}`} />
          {(sel.participantes || []).length === 0 ? <div style={{ color: T.text3, fontSize: 13 }}>Nenhum participante registrado.</div> :
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 6 }}>
              {sel.participantes.map((p, i) => (
                <label key={p.id || i} style={{ display: "flex", alignItems: "center", gap: 8, background: T.surf, border: `1px solid ${p.presente ? "#2ab84a44" : T.border}`, borderRadius: 8, padding: "8px 10px", cursor: editavel ? "pointer" : "default" }}>
                  <input type="checkbox" checked={!!p.presente} disabled={!editavel} onChange={() => togglePresenca(i)} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: T.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nome}</div>
                    {p.cargo && <div style={{ fontSize: 10, color: T.text3 }}>{p.cargo}</div>}
                  </div>
                </label>
              ))}
            </div>}
        </div>

        <div style={s.card}>
          <SecTitle icon="📋" ch={`Pauta — ${sel.pauta?.length || 0} item(ns)`} />
          {(sel.pauta || []).map((it, i) => {
            const rnc = rncs.find(r => r.id === it.rncId);
            const feito = it.itemStatus === "deliberado";
            const vezes = vezesNaPauta(it.rncId, reunioes, sel.id);
            const emperrada = vezes + 1 >= LIMITE_EMPERRADA;
            return (
              <div key={it.rncId} style={{ background: T.surf, border: `1px solid ${emperrada && !feito ? "#ff4f6a44" : feito ? "#2ab84a33" : T.border}`, borderRadius: 10, padding: "12px 16px", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.accent }}>Item {i + 1} · {it.rncNum}</span>
                  <SevB s={rnc?.sev || it.sev} />
                  {emperrada && <EmperradaChip n={vezes + 1} />}
                  {(it.motivoEntrada || []).map(m => <MotivoChip key={m} m={m} />)}
                  <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, color: feito ? "#2ab84a" : "#8a6000" }}>{feito ? "✓ Deliberado" : "Pendente"}</span>
                </div>
                <div style={{ fontSize: 12, color: T.text, marginBottom: 4 }}>{it.desc || "—"}</div>
                <div style={{ fontSize: 10, color: T.text2, marginBottom: 10 }}>
                  Situação na abertura da pauta: {it.situacao}
                  {rnc && rnc.status !== it.situacao && <span style={{ color: "#4fc3f7" }}> · hoje: {rnc.status}</span>}
                  {rnc && ` · Resp: ${rnc.resp || "—"} · Prazo AC: ${fmt(rnc.prazoAC)}${past(rnc.prazoAC) ? " ⚠ vencido" : ""}`}
                </div>

                {feito ? (
                  <div style={{ background: "#2ab84a12", border: "1px solid #2ab84a22", borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#2ab84a" }}>{deliberacaoLabel(it.deliberacao)}</div>
                    {it.encaminhamento && <div style={{ fontSize: 12, color: T.text, marginTop: 4 }}>{it.encaminhamento}</div>}
                    {it.novoResponsavel && <div style={{ fontSize: 11, color: T.text2, marginTop: 2 }}>Responsável indicado: {it.novoResponsavel}</div>}
                    {it.novoPrazo && <div style={{ fontSize: 11, color: T.text2, marginTop: 2 }}>Novo prazo: {fmt(it.novoPrazo)}</div>}
                    {it.novaSeveridade && <div style={{ fontSize: 11, color: T.text2, marginTop: 2 }}>Severidade elevada para: {it.novaSeveridade}</div>}
                    <div style={{ fontSize: 10, color: T.text3, marginTop: 4 }}>Registrado por {it.deliberadoPor} em {fmt(it.deliberadoEm)} — gravado no histórico da RNC.</div>
                  </div>
                ) : !editavel ? (
                  <div style={{ fontSize: 11, color: T.text3 }}>{sel.status === "Agendada" ? "A deliberação fica disponível quando a reunião for iniciada." : "Sem deliberação registrada."}</div>
                ) : (
                  <div>
                    <G2 ch={<>
                      <F lbl="Deliberação *" tip="Manter: só registra a análise, sem mudar nada na RNC. Reforçar prazo: grava um novo prazo de ação corretiva. Cobrar: registra a cobrança e abre o e-mail de notificação. Escalar: eleva a severidade. Aprovar encerramento: registra o aval da gestão (só aparece quando a RNC está Pendente verificação) — quem encerra de fato continua sendo a aba Eficácia." ch={
                        <Sel value={it.deliberacao} onChange={e => setItem(i, { deliberacao: e.target.value })}>
                          <option value="">Selecione...</option>
                          {deliberacoesAplicaveis(rnc).map(k => <option key={k} value={k}>{DELIBERACOES[k].label}</option>)}
                        </Sel>} />
                      {it.deliberacao === "reforcar_prazo"
                        ? <F lbl="Novo prazo de ação corretiva *" ch={<Inp type="date" value={it.novoPrazo} onChange={e => setItem(i, { novoPrazo: e.target.value })} />} />
                        : it.deliberacao === "escalar"
                        ? <F lbl="Nova severidade *" tip="Só é possível subir a severidade (Menor → Maior → Crítica), nunca descer. Uma RNC Crítica exige aprovação do RT e pesa mais no GUT e no Pareto." ch={
                            <Sel value={it.novaSeveridade || ""} onChange={e => setItem(i, { novaSeveridade: e.target.value })}>
                              <option value="">Selecione...</option>
                              {sevAcimaDe(rnc?.sev || it.sev).map(sv => <option key={sv} value={sv}>{sv}</option>)}
                            </Sel>} />
                        : <F lbl="Responsável indicado" ch={<Inp value={it.novoResponsavel} onChange={e => setItem(i, { novoResponsavel: e.target.value })} placeholder="Opcional" />} />}
                    </>} />
                    {it.deliberacao && <div style={{ fontSize: 11, color: T.text2, marginTop: -6, marginBottom: 10 }}>{DELIBERACOES[it.deliberacao]?.desc}</div>}
                    <F lbl="Encaminhamento" ch={<TA value={it.encaminhamento} onChange={e => setItem(i, { encaminhamento: e.target.value })} placeholder="O que ficou decidido para esta RNC..." />} />
                    <button style={s.btnA} onClick={() => deliberar(i)}>✔️ Registrar deliberação na RNC</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={s.card}>
          <SecTitle icon="📝" ch="Observações gerais" />
          {editavel
            ? <TA value={sel.observacoesGerais || ""} onChange={e => setSel(p => ({ ...p, observacoesGerais: e.target.value }))} onBlur={() => salvar(sel)} placeholder="Pontos gerais discutidos na reunião..." />
            : <div style={{ fontSize: 12, color: sel.observacoesGerais ? T.text : T.text3 }}>{sel.observacoesGerais || "—"}</div>}
          {editavel && <F lbl="Próxima reunião" tip="Preencher esta data já agenda automaticamente a próxima reunião ao encerrar e assinar a ata desta — com os mesmos participantes e a pauta recalculada na hora. Deixar em branco não agenda nada." ch={<Inp type="date" value={sel.proximaReuniao || ""} onChange={e => setSel(p => ({ ...p, proximaReuniao: e.target.value }))} onBlur={() => salvar(sel)} sx={{ maxWidth: 200 }} />} />}
        </div>

        {sel.ata?.assinatura && (
          <div style={{ ...s.card, border: "1px solid #2ab84a33", background: "#2ab84a08" }}>
            <SecTitle icon="✍️" ch="Ata assinada" />
            <div style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{sel.ata.assinatura.nome}</div>
            {sel.ata.assinatura.cargo && <div style={{ fontSize: 11, color: T.text2 }}>{sel.ata.assinatura.cargo}</div>}
            <div style={{ fontSize: 11, color: T.text2, marginTop: 4 }}>✔ Assinada eletronicamente como Facilitador da Análise Crítica em {new Date(sel.ata.geradaEm).toLocaleString("pt-BR")}</div>
          </div>
        )}

        {sel.historico?.length > 0 && (
          <div style={s.card}>
            <SecTitle icon="📜" ch="Histórico da reunião" />
            {[...sel.historico].reverse().map((h, i) => (
              <div key={i} style={{ borderLeft: `2px solid ${T.border2}`, paddingLeft: 10, marginBottom: 8 }}>
                <div style={{ fontSize: 10, color: T.text3 }}>{fmt(h.data)}{h.hora ? ` · ${h.hora}` : ""} · {h.resp}</div>
                <div style={{ fontSize: 12, color: T.text }}>{h.acao}</div>
              </div>
            ))}
          </div>
        )}

        {assinaturaModal && (
          <AssinaturaModal
            user={user}
            titulo={`Ata da reunião ${assinaturaModal.num}`}
            contexto={`Ata de análise crítica ${assinaturaModal.num} — ${assinaturaModal.pauta?.length || 0} item(ns) deliberado(s)`}
            papel="Facilitador da Análise Crítica"
            onClose={() => setAssinaturaModal(null)}
            onConfirm={async (ass) => {
              const encerrada = {
                ...assinaturaModal,
                status: "Encerrada",
                realizadaEm: assinaturaModal.realizadaEm || tod(),
                ata: { assinatura: ass, geradaEm: new Date().toISOString() },
                historico: [...(assinaturaModal.historico || []), hEntry("Reunião encerrada e ata assinada")],
              };
              setAssinaturaModal(null);
              const ok = await salvar(encerrada, `Reunião ${encerrada.num} encerrada — ata assinada.`);
              if (ok && encerrada.proximaReuniao) {
                try {
                  const prox = await agendarProxima(encerrada);
                  toast_(`${prox.num} já agendada para ${fmt(prox.data)}.`, "green");
                } catch (e) { toast_("Reunião encerrada, mas falhou agendar a próxima: " + e.message, "red"); }
              }
            }}
          />
        )}
      </div>
    );
  }

  // ── Lista ──
  return (
    <div>
      <div style={{ ...s.card, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>Reuniões de análise crítica</div>
          <div style={{ fontSize: 11, color: T.text2, marginTop: 2 }}>
            {candidatas.length > 0
              ? `${candidatas.length} RNC(s) pedem análise crítica da gestão neste momento.`
              : "Nenhuma RNC pede análise crítica no momento."}
          </div>
        </div>
        {podeGerenciar && <button style={s.btnA} onClick={abrirNova}>+ Nova reunião</button>}
      </div>

      {lista.length === 0 ? (
        <div style={{ ...s.card, textAlign: "center", padding: "3rem 1rem" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🗓️</div>
          <div style={{ fontSize: 14, color: T.text, fontWeight: 600 }}>Nenhuma reunião registrada</div>
          <div style={{ fontSize: 12, color: T.text2, marginTop: 4 }}>
            A reunião de análise crítica é onde a gestão delibera sobre as RNCs em aberto — e a ata é a evidência de que essa análise aconteceu.
          </div>
        </div>
      ) : lista.map(r => {
        const del = (r.pauta || []).filter(i => i.itemStatus === "deliberado").length;
        return (
          <div key={r.id} onClick={() => setSel(r)} style={{ ...s.card, cursor: "pointer", display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.accent }}>{r.num}</span>
                <RBadge st={r.status} />
                {r.ata?.assinatura && <span style={{ fontSize: 10, color: "#2ab84a" }}>✍️ Ata assinada</span>}
              </div>
              <div style={{ fontSize: 11, color: T.text2 }}>
                {r.status === "Encerrada" ? `Realizada em ${fmt(r.realizadaEm)}` : `Agendada para ${fmt(r.data)}`} · Facilitador: {r.facilitador || "—"}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{del}/{r.pauta?.length || 0}</div>
              <div style={{ fontSize: 9, color: T.text3 }}>DELIBERADOS</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

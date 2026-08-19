import React, { useEffect, useMemo, useState } from "react";
import { useTheme } from "../../core/theme";
import { fmt, genNum, tod } from "../../core/utils";
import { incrementCounter } from "../../firebase";
import { useS } from "../../shared/styles";
import { F, G2, G3, Inp, SecTitle, Sel, SevB, TA } from "../../shared/ui";
import { Table } from "../../shared/Table";
import { AnexosUpload } from "../rnc/RncTabs";
import { DesviosIndicadores } from "./DesviosIndicadores";
import { setoresDaHierarquia, normSetor } from "./fusaoSetores";

// ── Lista-semente de setores (chão de fábrica Herbamed) ──
// A lista efetiva vem do catálogo configurável (configuracoes/catalogo_setores_desvio,
// gerido no Admin); esta é o fallback quando o catálogo ainda não foi configurado.
export const SETORES_DESVIO = [
  "Mistura 1", "Mistura 2",
  "Compressão",
  "Encapsulamento 1", "Encapsulamento 2", "Encapsulamento 3",
  "Escolha de Cápsula 1", "Escolha de Cápsula 2",
  "Envase 1", "Envase 2", "Envase 3", "Envase 4 (Sachê)", "Envase 5 (Líquido)", "Envase 6",
  "Encartuchamento 1", "Encartuchamento 2",
  "PCP", "Qualidade", "Recebimento", "Manutenção", "Almoxarifado",
  "Outros",
];

/**
 * Nomes de setor oferecidos no formulário de desvio.
 *
 * A fonte passou a ser a hierarquia Área › Setor (`catalogo_areas_setores_distribuicao`)
 * — a mesma lista da distribuição de cópias, do cadastro de colaboradores e da
 * exigência de treinamento. É a fusão: um cadastro só para o mesmo lugar físico.
 *
 * ⚠️ Enquanto a fusão não estiver concluída, a lista é a **união** com o catálogo
 * plano antigo. Em produção a hierarquia já tem setores, então trocar de fonte de
 * uma vez faria "Mistura 1" e companhia sumirem do formulário no dia do deploy,
 * antes de o admin migrar — quebrando o registro de desvio de quem trabalha nesses
 * setores. Com a união nada some: conforme o painel de fusão resolve as pendências,
 * o legado deixa de acrescentar nomes e a união vira a hierarquia sozinha.
 *
 * "Outros" é sempre o último item — é a válvula de escape do texto livre.
 */
export function setoresDesvioAtivos(catalogoAreas, catalogoLegado) {
  const daHierarquia = setoresDaHierarquia(catalogoAreas).map(sx => sx.nome);
  const doLegado = (catalogoLegado && catalogoLegado.length)
    ? catalogoLegado.filter(sx => sx.ativo !== false).map(sx => sx.nome).filter(Boolean)
    : (daHierarquia.length ? [] : SETORES_DESVIO);

  const vistos = new Set();
  const base = [];
  for (const nome of [...daHierarquia, ...doLegado]) {
    const chave = normSetor(nome);
    if (!chave || chave === "outros" || vistos.has(chave)) continue;
    vistos.add(chave);
    base.push(nome);
  }
  return [...base, "Outros"];
}

/**
 * Opções do filtro de setor: os ativos **mais** qualquer setor ainda carimbado em
 * desvio antigo. Sem isso, um setor que saiu da lista viraria registro impossível
 * de filtrar — some da tela sem ninguém perceber.
 */
export function setoresParaFiltro(setoresAtivos = [], desvios = []) {
  const vistos = new Set(setoresAtivos.map(normSetor));
  const extras = [];
  for (const d of (desvios || [])) {
    const nome = String(d?.setor || "").trim();
    if (!nome) continue;
    const chave = normSetor(nome);
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    extras.push(nome);
  }
  return [...setoresAtivos, ...extras.sort((a, b) => a.localeCompare(b, "pt-BR"))];
}

// Lista-semente padrão. A lista efetiva vem do catálogo configurável
// (configuracoes/catalogo_tipos_desvio, gerido no Admin); esta é o fallback.
export const TIPOS_DESVIO = ["BPF", "Processo", "Recebimento", "Equipamento", "Documentação", "Fornecedor", "Outros"];

// Nomes de tipo ativos a partir do catálogo (ou o padrão, se ainda não configurado).
// "Outros" é sempre garantido como último item — é a válvula de escape do texto livre.
export function tiposDesvioAtivos(catalogo) {
  const base = (catalogo && catalogo.length)
    ? catalogo.filter(t => t.ativo !== false).map(t => t.nome).filter(Boolean)
    : TIPOS_DESVIO;
  const semOutros = base.filter(t => t !== "Outros");
  return [...semOutros, "Outros"];
}

// Mesma escala de severidade da RNC, para converter sem reclassificar.
export const IMPACTOS_DESVIO = ["Crítica", "Maior", "Menor"];

// Meta de triagem da Qualidade (dias corridos do registro até encerrar/converter).
// Fonte única compartilhada com a aba de Indicadores e com o sinal de atraso na lista.
export const META_TRIAGEM_DIAS = 7;

// Dias entre uma data YYYY-MM-DD e hoje (0 se a data faltar/for futura).
const diasCorridos = (iso) => {
  if (!iso) return 0;
  const ms = new Date(tod() + "T12:00:00") - new Date(iso + "T12:00:00");
  return Math.max(0, Math.round(ms / 86400000));
};

// Situação de triagem de um desvio ainda "Registrado": há quantos dias está aberto
// e se já passou da meta. Retorna null para desvios já triados (encerrados/convertidos).
export function triagemStatus(d) {
  if (d.status !== "Registrado") return null;
  const dias = diasCorridos(d.dataRegistro || d.dataOcorrencia);
  return { dias, atrasado: dias > META_TRIAGEM_DIAS };
}

export const DESVIO_SMETA = {
  "Registrado":        { c: "#4fc3f7", bg: "#4fc3f718", dot: "#4fc3f7" },
  "Encerrado":         { c: "#2ab84a", bg: "#2ab84a18", dot: "#2ab84a" },
  "Convertido em RNC": { c: "#ff8c42", bg: "#ff8c4218", dot: "#ff8c42" },
};

// Filtro pendente vindo dos Indicadores (clique em gráfico → lista já filtrada).
// Consumido uma única vez quando a lista monta.
let _filtroPendente = null;
export const pedirFiltroDesvios = f => { _filtroPendente = f; };
const consumirFiltroDesvios = () => { const f = _filtroPendente; _filtroPendente = null; return f || {}; };

function DesvioBadge({ status }) {
  const m = DESVIO_SMETA[status] || DESVIO_SMETA["Registrado"];
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, textTransform: "uppercase", background: m.bg, color: m.c }}>
    <span style={{ width: 5, height: 5, borderRadius: "50%", background: m.dot, display: "inline-block" }} />{status}
  </span>;
}

// Normaliza texto livre para agrupar grafias equivalentes ("Temperatura",
// "temperatura ", "TEMPERATURA" → mesma chave). Sem acento, minúsculo, espaços colapsados.
const normTipo = (str) => (str || "")
  .toLowerCase()
  .normalize("NFD")
  .replace(/[̀-ͯ]/g, "")
  .replace(/\s+/g, " ")
  .trim();

// Texto do desvio reaproveitado ao pré-popular a RNC.
function descParaRNC(d) {
  const partes = [d.desc?.trim()];
  if (d.acaoImediata === "Sim" && d.acaoDesc?.trim()) partes.push(`\n\nAção imediata adotada: ${d.acaoDesc.trim()}`);
  return partes.filter(Boolean).join("");
}

export function DesviosTab({ view = "lista", user, toast_, setTab, desvios = [], doSaveDesvio, doDeleteDesvio, perm, setRncPrefill, isAdmin, catalogoTiposDesvio = [], catalogoSetoresDesvio = [], catalogoAreasSetoresDistribuicao = [] }) {
  const tiposDesvio = tiposDesvioAtivos(catalogoTiposDesvio);
  const setoresDesvio = setoresDesvioAtivos(catalogoAreasSetoresDistribuicao, catalogoSetoresDesvio);
  if (view === "novo") {
    return <NovoDesvioForm user={user} toast_={toast_} setTab={setTab} doSaveDesvio={doSaveDesvio} tiposDesvio={tiposDesvio} setoresDesvio={setoresDesvio} />;
  }
  if (view === "indicadores") {
    return <DesviosIndicadores desvios={desvios} setTab={setTab} tiposDesvio={tiposDesvio} setoresDesvio={setoresDesvio} />;
  }
  return <DesviosLista user={user} toast_={toast_} setTab={setTab} desvios={desvios} doSaveDesvio={doSaveDesvio} doDeleteDesvio={doDeleteDesvio} perm={perm} setRncPrefill={setRncPrefill} isAdmin={isAdmin} tiposDesvio={tiposDesvio} setoresDesvio={setoresDesvio} />;
}

// ── Lista + triagem ──
function DesviosLista({ user, toast_, setTab, desvios, doSaveDesvio, doDeleteDesvio, perm, setRncPrefill, isAdmin, tiposDesvio = TIPOS_DESVIO, setoresDesvio = SETORES_DESVIO }) {
  const T = useTheme(); const s = useS();
  const [fIni] = useState(consumirFiltroDesvios);
  const [busca, setBusca] = useState(fIni.busca || "");
  const [fStatus, setFStatus] = useState(fIni.status || "");
  const [fSetor, setFSetor] = useState(fIni.setor || "");
  const [fTipo, setFTipo] = useState(fIni.tipo || "");
  const [sel, setSel] = useState(null);
  const [reclassDim, setReclassDim] = useState(null); // "tipo" | "setor" | null
  const [selecionados, setSelecionados] = useState(new Set());
  const [editando, setEditando] = useState(false);
  const [editData, setEditData] = useState({});
  useEffect(() => { setEditando(false); }, [sel?.id]);

  const podeTriar = isAdmin || perm("triarDesvio");

  // Só desvio ABERTO se edita: encerrado ou convertido em RNC é registro fechado, e
  // registro fechado não se corrige — se estiver errado, o caminho é a trilha da RNC.
  // Quem edita: a Qualidade (triagem) ou quem registrou — o operador que digitou o
  // setor errado precisa poder consertar sem depender de alguém com permissão.
  const podeEditar = (d) => !!d && d.status === "Registrado" && (podeTriar || d.registradoPor === user.name);

  const abrirEdicao = (d) => {
    // Descrição e ação imediata NÃO entram aqui: são append-only e chegam na próxima
    // onda com o campo travado. Deixá-las como textarea comum agora seria abrir
    // justamente o buraco que este trabalho veio fechar.
    setEditData({
      dataOcorrencia: d.dataOcorrencia || "", setor: d.setor || "", setorOutro: d.setorOutro || "",
      tipo: d.tipo || "", tipoOutro: d.tipoOutro || "", impacto: d.impacto || "Maior",
      produto: d.produto || "",
    });
    setEditando(true);
  };

  const salvarEdicao = async () => {
    const d = desvios.find(x => x.id === sel.id);
    if (!editData.setor) { alert("Selecione o setor do desvio."); return; }
    if (editData.setor === "Outros" && !editData.setorOutro.trim()) { alert("Especifique o setor do desvio (Outros)."); return; }
    if (editData.tipo === "Outros" && !editData.tipoOutro.trim()) { alert("Especifique o tipo do desvio (Outros)."); return; }

    const campos = { dataOcorrencia: "Data da ocorrência", setor: "Setor", setorOutro: "Setor (Outros)", tipo: "Tipo", tipoOutro: "Tipo (Outros)", impacto: "Impacto", produto: "Produto / Lote" };
    const alterados = Object.entries(campos)
      .filter(([k]) => (d[k] || "") !== (editData[k] || ""))
      .map(([k, label]) => `${label}: "${d[k] || "—"}" → "${editData[k] || "—"}"`);
    if (!alterados.length) { setEditando(false); return; }

    const h = { data: tod(), hora: new Date().toLocaleTimeString("pt-BR"), acao: `Desvio editado — ${alterados.length} campo(s) alterado(s)`, detalhes: alterados, resp: user.name };
    const upd = { ...d, ...editData, historico: [...(d.historico || []), h] };
    await doSaveDesvio(upd);
    setSel(upd);
    setEditando(false);
    toast_(`${d.num} atualizado.`, "green");
  };

  // Quantos desvios ainda estão como "Outros" com texto livre por dimensão (candidatos a reclassificar).
  const pendentesTipo  = desvios.filter(d => d.tipo === "Outros" && (d.tipoOutro || "").trim()).length;
  const pendentesSetor = desvios.filter(d => d.setor === "Outros" && (d.setorOutro || "").trim()).length;

  const filtrados = [...desvios]
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .filter(d => !fStatus || d.status === fStatus)
    .filter(d => !fSetor || d.setor === fSetor)
    .filter(d => !fTipo || d.tipo === fTipo)
    .filter(d => {
      if (!busca.trim()) return true;
      const q = busca.toLowerCase();
      return [d.num, d.desc, d.setor, d.setorOutro, d.tipo, d.produto, d.registradoPor].some(x => (x || "").toLowerCase().includes(q));
    });

  const colunasDesvio = [
    { key: "num", label: "Nº", render: d => <span style={{ fontWeight: 700, color: T.accent }}>{d.num}</span> },
    { key: "dataOcorrencia", label: "Data", render: d => fmt(d.dataOcorrencia) },
    { key: "setor", label: "Setor", accessor: d => d.setor === "Outros" ? (d.setorOutro || "Outros") : (d.setor || "—") },
    { key: "tipo", label: "Tipo", accessor: d => d.tipo === "Outros" ? (d.tipoOutro || "Outros") : d.tipo },
    { key: "impacto", label: "Impacto", render: d => d.impacto ? <SevB s={d.impacto} /> : "—" },
    { key: "desc", label: "Descrição", maxWidth: 280, render: d => d.desc },
    { key: "status", label: "Status", render: d => <DesvioBadge status={d.status} /> },
    { key: "triagem", label: "Triagem", sortable: false, render: d => <TriagemChip d={d} T={T} /> },
  ];

  const abertos = desvios.filter(d => d.status === "Registrado").length;
  const encerrados = desvios.filter(d => d.status === "Encerrado").length;
  const convertidos = desvios.filter(d => d.status === "Convertido em RNC").length;
  const taxaRNC = desvios.length > 0 ? Math.round(convertidos / desvios.length * 100) : 0;

  const encerrar = async (d) => {
    const motivo = window.prompt("Justificativa do encerramento (ação imediata sanou o desvio):", d.acaoDesc || "");
    if (motivo === null) return;
    const upd = { ...d, status: "Encerrado", encerradoPor: user.name, encerradoEm: tod(), encerramentoMotivo: motivo,
      historico: [...(d.historico || []), { data: tod(), acao: "Encerrado — ação imediata", resp: user.name }] };
    await doSaveDesvio(upd);
    setSel(null);
    toast_(`${d.num} encerrado.`, "green");
  };

  // Encerrar em lote — a extensão natural do Table.jsx da onda 9: rotina de
  // triagem tem muito "sim, ação imediata resolveu" repetido um a um. Só os
  // "Registrado" da seleção entram; o resto (já encerrado/convertido/etc.)
  // é ignorado em silêncio — selecionar tudo numa página mista não deve travar.
  const encerrarSelecionados = async () => {
    const alvos = filtrados.filter(d => selecionados.has(d.id) && d.status === "Registrado");
    if (alvos.length === 0) {
      toast_("Nenhum dos selecionados está 'Registrado' — só esses podem ser encerrados em lote.", "red");
      return;
    }
    const motivo = window.prompt(`Justificativa do encerramento em lote (${alvos.length} desvio(s) selecionado(s)):`);
    if (motivo === null) return;
    for (const d of alvos) {
      const upd = { ...d, status: "Encerrado", encerradoPor: user.name, encerradoEm: tod(), encerramentoMotivo: motivo,
        historico: [...(d.historico || []), { data: tod(), acao: "Encerrado — ação imediata (lote)", resp: user.name }] };
      await doSaveDesvio(upd);
    }
    setSelecionados(new Set());
    toast_(`${alvos.length} desvio(s) encerrado(s) em lote.`, "green");
  };

  const converter = (d) => {
    // O desvio só é marcado como "Convertido em RNC" quando a RNC for efetivamente
    // salva (a NovaTab grava o vínculo de volta). Se o usuário cancelar, o desvio
    // permanece "Registrado".
    setRncPrefill({
      produto: d.produto || "",
      lote: d.lote || "",
      detector: d.registradoPor || "",
      setor: d.setor === "Outros" ? (d.setorOutro || "Outros") : (d.setor || ""),
      sev: d.impacto || "Maior",
      desc: descParaRNC(d),
      origemDesvio: d.id,
      origemDesvioNum: d.num,
      origemDesvioDoc: d,
    });
    setSel(null);
    setTab("nova");
    toast_("Abrindo RNC com os dados do desvio...", "green");
  };

  const excluir = async (d) => {
    if (!window.confirm(`Excluir o desvio ${d.num}? Esta ação não pode ser desfeita.`)) return;
    await doDeleteDesvio(d.id);
    setSel(null);
    toast_(`${d.num} excluído.`, "green");
  };

  return (
    <div>
      {/* KPIs */}
      <div className="kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
        {[
          { l: "Total de desvios", n: desvios.length, c: T.accent },
          { l: "Em aberto", n: abertos, c: "#4fc3f7" },
          { l: "Encerrados (ação imediata)", n: encerrados, c: "#2ab84a" },
          { l: "Viraram RNC", n: `${convertidos} (${taxaRNC}%)`, c: "#ff8c42" },
        ].map(({ l, n, c }) => (
          <div key={l} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: c }}>{n}</div>
            <div style={{ fontSize: 11, color: T.text2, fontWeight: 500 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ ...s.card, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "2 1 220px" }}>
            <F lbl="Buscar" ch={<Inp placeholder="Nº, descrição, setor, produto..." value={busca} onChange={e => setBusca(e.target.value)} />} />
          </div>
          <div style={{ flex: "1 1 150px" }}>
            <F lbl="Status" ch={<Sel value={fStatus} onChange={e => setFStatus(e.target.value)}><option value="">Todos</option>{Object.keys(DESVIO_SMETA).map(x => <option key={x}>{x}</option>)}</Sel>} />
          </div>
          <div style={{ flex: "1 1 150px" }}>
            <F lbl="Setor" ch={<Sel value={fSetor} onChange={e => setFSetor(e.target.value)}><option value="">Todos</option>{setoresParaFiltro(setoresDesvio, desvios).map(x => <option key={x}>{x}</option>)}</Sel>} />
          </div>
          <div style={{ flex: "1 1 130px" }}>
            <F lbl="Tipo" ch={<Sel value={fTipo} onChange={e => setFTipo(e.target.value)}><option value="">Todos</option>{tiposDesvio.map(x => <option key={x}>{x}</option>)}</Sel>} />
          </div>
          {isAdmin && pendentesTipo > 0 && (
            <button onClick={() => setReclassDim("tipo")} title="Reclassificar desvios antigos que ficaram como 'Outros' para os tipos do catálogo" style={{ ...s.btn, padding: "9px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
              🏷️ Reclassificar tipos
              <span style={{ background: "#ff8c42", color: "#fff", borderRadius: 20, fontSize: 10, fontWeight: 800, padding: "1px 7px" }}>{pendentesTipo}</span>
            </button>
          )}
          {isAdmin && pendentesSetor > 0 && (
            <button onClick={() => setReclassDim("setor")} title="Reclassificar desvios antigos que ficaram como 'Outros' para os setores do catálogo" style={{ ...s.btn, padding: "9px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
              🏭 Reclassificar setores
              <span style={{ background: "#ff8c42", color: "#fff", borderRadius: 20, fontSize: 10, fontWeight: 800, padding: "1px 7px" }}>{pendentesSetor}</span>
            </button>
          )}
          {isAdmin && (
            <button onClick={() => setTab("config-desvios")} title="Tipos e setores de desvio" style={{ ...s.btn, padding: "9px 16px", marginBottom: 14 }}>⚙️ Configuração</button>
          )}
          {perm("criarDesvio") && (
            <button onClick={() => setTab("novo-desvio")} style={{ ...s.btnA, padding: "9px 16px", marginBottom: 14 }}>+ Novo desvio</button>
          )}
        </div>
      </div>

      {/* Seleção em lote */}
      {podeTriar && selecionados.size > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", marginBottom: 10, background: T.accentDim, border: `1px solid ${T.accent}33`, borderRadius: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{selecionados.size} selecionado(s)</span>
          <button style={s.btnA} onClick={encerrarSelecionados}>✅ Encerrar selecionados</button>
          <button style={s.btn} onClick={() => setSelecionados(new Set())}>Limpar seleção</button>
        </div>
      )}

      {/* Tabela */}
      <Table
        columns={colunasDesvio}
        rows={filtrados}
        rowKey={d => d.id}
        onRowClick={d => setSel(d)}
        sortColDefault="dataOcorrencia"
        sortDirDefault="desc"
        perPage={15}
        emptyTitle="Nenhum desvio registrado ainda."
        selectable={podeTriar}
        selected={selecionados}
        onSelectedChange={setSelecionados}
      />

      {/* Modal de detalhe / triagem */}
      {sel && (
        <div onClick={() => setSel(null)} style={{ position: "fixed", inset: 0, background: "#000a", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: T.bg, border: `1px solid ${T.border2}`, borderRadius: 14, maxWidth: 620, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px #000a" }}>
            <div style={{ padding: "1.2rem 1.5rem", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: T.bg }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: T.accent }}>{sel.num}</span>
                <DesvioBadge status={sel.status} />
                {sel.impacto && <SevB s={sel.impacto} />}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {podeEditar(sel) && !editando && (
                  <button onClick={() => abrirEdicao(sel)} style={{ ...s.btn, fontSize: 11, padding: "6px 12px", color: T.accent, borderColor: T.accent + "33", background: T.accentDim }}><span className="btn-emoji">✏️ </span>Editar</button>
                )}
                <button onClick={() => setSel(null)} style={{ background: "none", border: "none", color: T.text3, cursor: "pointer", fontSize: 22, fontFamily: "inherit" }}>✕</button>
              </div>
            </div>
            <div style={{ padding: "1.5rem" }}>
              {editando ? (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ background: T.accentDim, border: `1px solid ${T.accent}33`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: T.accent }}>
                    ✏️ Modo edição — as alterações ficam registradas no histórico do desvio.
                  </div>
                  <G2 ch={<>
                    <F lbl="Data da ocorrência" ch={<Inp type="date" value={editData.dataOcorrencia} onChange={e => setEditData(p => ({ ...p, dataOcorrencia: e.target.value }))} />} />
                    <F lbl="Impacto" ch={<Sel value={editData.impacto} onChange={e => setEditData(p => ({ ...p, impacto: e.target.value }))}>{IMPACTOS_DESVIO.map(x => <option key={x}>{x}</option>)}</Sel>} />
                  </>} />
                  <F lbl="Setor *" ch={
                    <div>
                      <Sel value={editData.setor} onChange={e => setEditData(p => ({ ...p, setor: e.target.value }))}><option value="">Selecione...</option>{setoresParaFiltro(setoresDesvio, desvios).map(x => <option key={x}>{x}</option>)}</Sel>
                      {editData.setor === "Outros" && <Inp placeholder="Especifique o setor..." value={editData.setorOutro} onChange={e => setEditData(p => ({ ...p, setorOutro: e.target.value }))} sx={{ marginTop: 8 }} />}
                    </div>
                  } />
                  <F lbl="Tipo do desvio" ch={
                    <div>
                      <Sel value={editData.tipo} onChange={e => setEditData(p => ({ ...p, tipo: e.target.value }))}>{[...new Set([...tiposDesvio, editData.tipo].filter(Boolean))].map(x => <option key={x}>{x}</option>)}</Sel>
                      {editData.tipo === "Outros" && <Inp placeholder="Especifique o tipo..." value={editData.tipoOutro} onChange={e => setEditData(p => ({ ...p, tipoOutro: e.target.value }))} sx={{ marginTop: 8 }} />}
                    </div>
                  } />
                  <F lbl="Produto / Lote" ch={<Inp placeholder="Ex: Calcivitam D3 — Lote 2025-001" value={editData.produto} onChange={e => setEditData(p => ({ ...p, produto: e.target.value }))} />} />
                  <div style={{ fontSize: 11, color: T.text3, background: T.surf, borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>
                    A descrição e a ação imediata não são editadas aqui — elas são registro e não podem ser reescritas.
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button style={s.btn} onClick={() => setEditando(false)}>Cancelar edição</button>
                    <button style={s.btnA} onClick={salvarEdicao}>💾 Salvar alterações</button>
                  </div>
                </div>
              ) : (
              <>
              <Campo T={T} l="Data da ocorrência" v={fmt(sel.dataOcorrencia)} />
              <Campo T={T} l="Setor" v={sel.setor === "Outros" ? `Outros — ${sel.setorOutro || ""}` : sel.setor} />
              <Campo T={T} l="Tipo" v={sel.tipo === "Outros" ? `Outros — ${sel.tipoOutro || ""}` : sel.tipo} />
              <Campo T={T} l="Descrição do desvio" v={sel.desc} bloco />
              {sel.produto && <Campo T={T} l="Produto / Lote" v={sel.produto} />}
              <Campo T={T} l="Houve ação imediata?" v={sel.acaoImediata || "—"} />
              {sel.acaoImediata === "Sim" && <Campo T={T} l="Ação imediata adotada" v={sel.acaoDesc} bloco />}
              {sel.anexos?.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 10, color: T.text3, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>📎 Anexos ({sel.anexos.length})</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {sel.anexos.map((a, i) => (
                      <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: T.accent, textDecoration: "none", background: T.surf, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px" }}>📎 {a.name}</a>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.border}`, fontSize: 11, color: T.text3 }}>
                Registrado por <strong style={{ color: T.text2 }}>{sel.registradoPor}</strong> em {fmt(sel.dataRegistro)}
                {(() => { const st = triagemStatus(sel); return st && <div style={{ marginTop: 4, color: st.atrasado ? T.yellow : T.text3, fontWeight: st.atrasado ? 700 : 400 }}>{st.atrasado ? "⚠️ " : ""}Aguardando triagem há {st.dias} dia(s) — meta: {META_TRIAGEM_DIAS} dias{st.atrasado ? " (atrasado)" : ""}</div>; })()}
                {sel.status === "Encerrado" && <div style={{ marginTop: 4 }}>Encerrado por {sel.encerradoPor} em {fmt(sel.encerradoEm)}{sel.encerramentoMotivo ? ` — ${sel.encerramentoMotivo}` : ""}</div>}
                {sel.status === "Convertido em RNC" && <div style={{ marginTop: 4 }}>Convertido por {sel.convertidoPor} em {fmt(sel.convertidoEm)}{sel.rncNum ? ` → ${sel.rncNum}` : ""}</div>}
              </div>
              {/* Histórico — já era gravado desde sempre, mas nunca tinha sido exibido.
                  Com a edição na tela, é ele que prova o que mudou, quem mudou e quando. */}
              {sel.historico?.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 10, color: T.text3, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>🕓 Histórico</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[...sel.historico].reverse().map((h, i) => (
                      <div key={i} style={{ background: T.surf, borderLeft: `3px solid ${T.border2}`, borderRadius: "0 8px 8px 0", padding: "8px 12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 12, color: T.text }}>{h.acao}</span>
                          <span style={{ fontSize: 10, color: T.text3, whiteSpace: "nowrap" }}>{fmt(h.data)}{h.hora ? ` · ${h.hora}` : ""}</span>
                        </div>
                        <div style={{ fontSize: 10, color: T.text3, marginTop: 2 }}>por {h.resp}</div>
                        {h.detalhes?.length > 0 && (
                          <div style={{ marginTop: 6, fontSize: 11, color: T.text2, display: "flex", flexDirection: "column", gap: 2 }}>
                            {h.detalhes.map((dt, j) => <div key={j}>• {dt}</div>)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              </>
              )}
            </div>
            {/* Ações de triagem */}
            {sel.status === "Registrado" && podeTriar && !editando && (
              <div style={{ padding: "1rem 1.5rem", borderTop: `1px solid ${T.border}`, display: "flex", gap: 10, flexWrap: "wrap", position: "sticky", bottom: 0, background: T.bg }}>
                <button onClick={() => encerrar(sel)} style={{ flex: "1 1 200px", padding: "11px", background: "#2ab84a", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700 }}>✓ Encerrar (ação imediata)</button>
                <button onClick={() => converter(sel)} style={{ flex: "1 1 200px", padding: "11px", background: "#ff8c42", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700 }}>↗ Converter em RNC</button>
              </div>
            )}
            {(isAdmin || perm("triarDesvio")) && !editando && (
              <div style={{ padding: "0 1.5rem 1.2rem", textAlign: "right" }}>
                <button onClick={() => excluir(sel)} style={{ background: "none", border: "none", color: "#ff4f6a", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>Excluir desvio</button>
              </div>
            )}
          </div>
        </div>
      )}

      {reclassDim && (
        <ReclassificarModal
          dim={reclassDim}
          desvios={desvios}
          canonicos={(reclassDim === "tipo" ? tiposDesvio : setoresDesvio).filter(x => x !== "Outros")}
          doSaveDesvio={doSaveDesvio}
          user={user}
          toast_={toast_}
          onClose={() => setReclassDim(null)}
        />
      )}
    </div>
  );
}

// Chip de situação de triagem: para desvios "Registrado" mostra há quantos dias está
// aberto, colorindo quando passa da meta; para os já triados, um traço discreto.
function TriagemChip({ d, T }) {
  const st = triagemStatus(d);
  if (!st) return <span style={{ color: T.text3 }}>—</span>;
  const cor = st.dias > 15 ? T.red : st.dias > META_TRIAGEM_DIAS ? T.yellow : T.text2;
  return (
    <span title={`Aberto há ${st.dias} dia(s) — meta de triagem: ${META_TRIAGEM_DIAS} dias`}
      style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: cor, whiteSpace: "nowrap" }}>
      {st.atrasado && "⚠️"}{st.dias}d{st.atrasado ? " · atrasado" : ""}
    </span>
  );
}

// ── Reclassificação de "Outros" históricos (tipo ou setor) ──
// Junta os desvios que ficaram como "Outros" + texto livre (tipoOutro/setorOutro) por
// grafia equivalente e permite mapear cada grupo para um valor canônico do catálogo,
// limpando o texto livre. Objetivo: parar de sujar o Pareto e a matriz Setor×Tipo.
const RECLASS_DIMS = {
  tipo:  { campo: "tipo",  campoOutro: "tipoOutro",  rotulo: "Tipo",  plural: "tipos",   icon: "🏷️", catalogo: "Tipos de Desvio" },
  setor: { campo: "setor", campoOutro: "setorOutro", rotulo: "Setor", plural: "setores", icon: "🏭", catalogo: "Setores de Desvio" },
};

function ReclassificarModal({ dim, desvios, canonicos, doSaveDesvio, user, toast_, onClose }) {
  const T = useTheme(); const s = useS();
  const D = RECLASS_DIMS[dim];
  const [mapa, setMapa] = useState({}); // chave normalizada → valor canônico escolhido
  const [saving, setSaving] = useState(false);

  const grupos = useMemo(() => {
    const map = new Map();
    for (const d of desvios) {
      if (d[D.campo] !== "Outros") continue;
      const raw = (d[D.campoOutro] || "").trim();
      if (!raw) continue;
      const key = normTipo(raw);
      if (!map.has(key)) map.set(key, { key, label: raw, ids: [], count: 0 });
      const g = map.get(key);
      g.ids.push(d.id);
      g.count++;
      if (raw.length > g.label.length) g.label = raw; // grafia mais completa como rótulo
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [desvios, D.campo, D.campoOutro]);

  const selecionados = grupos.filter(g => mapa[g.key]);
  const totalDesvios = selecionados.reduce((acc, g) => acc + g.count, 0);

  const aplicar = async () => {
    if (!selecionados.length) { toast_("Selecione um destino para ao menos um grupo.", "red"); return; }
    if (!window.confirm(`Reclassificar ${totalDesvios} desvio(s) em ${selecionados.length} grupo(s)? O texto livre será substituído pelo ${D.rotulo.toLowerCase()} do catálogo.`)) return;
    setSaving(true);
    let n = 0;
    try {
      for (const g of selecionados) {
        const destino = mapa[g.key];
        for (const id of g.ids) {
          const d = desvios.find(x => x.id === id);
          if (!d) continue;
          await doSaveDesvio({
            ...d,
            [D.campo]: destino,
            [D.campoOutro]: "",
            historico: [...(d.historico || []), { data: tod(), acao: `${D.rotulo} reclassificado: "${d[D.campoOutro] || g.label}" → ${destino}`, resp: user?.name || "—" }],
          });
          n++;
        }
      }
      toast_(`${n} desvio(s) reclassificado(s).`, "green");
      onClose();
    } catch (e) {
      console.error(e);
      toast_("Erro ao reclassificar: " + e.message, "red");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "#000a", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.bg, border: `1px solid ${T.border2}`, borderRadius: 14, maxWidth: 680, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px #000a" }}>
        <div style={{ padding: "1.2rem 1.5rem", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: T.bg }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: T.text }}>{D.icon} Reclassificar {D.plural} "Outros"</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.text3, cursor: "pointer", fontSize: 22, fontFamily: "inherit" }}>✕</button>
        </div>
        <div style={{ padding: "1.5rem" }}>
          <p style={{ fontSize: 12.5, color: T.text2, lineHeight: 1.5, marginTop: 0, marginBottom: 18 }}>
            Estes desvios foram registrados como <strong>“Outros”</strong> com texto livre. Escolha um {D.rotulo.toLowerCase()} do catálogo para cada grupo — os desvios daquele grupo passam a usar o valor canônico e param de aparecer soltos no Pareto e na matriz Setor×Tipo. Grupos sem destino escolhido ficam como estão.
          </p>

          {canonicos.length === 0 ? (
            <div style={{ padding: "1.5rem", textAlign: "center", color: T.text3, fontSize: 13, background: T.surf, borderRadius: 10 }}>
              Nenhum {D.rotulo.toLowerCase()} canônico ativo no catálogo. Cadastre em <strong>Admin → Catálogos → {D.catalogo}</strong> antes de reclassificar.
            </div>
          ) : grupos.length === 0 ? (
            <div style={{ padding: "1.5rem", textAlign: "center", color: T.text3, fontSize: 13, background: T.surf, borderRadius: 10 }}>
              Nenhum desvio pendente — todos os {D.plural} já estão no catálogo. ✓
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {grupos.map(g => (
                <div key={g.key} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: mapa[g.key] ? T.accentDim : T.surf, border: `1px solid ${mapa[g.key] ? T.accent + "44" : T.border}`, borderRadius: 10, padding: "10px 14px" }}>
                  <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.label}</div>
                    <div style={{ fontSize: 11, color: T.text3 }}>{g.count} desvio{g.count > 1 ? "s" : ""}</div>
                  </div>
                  <div style={{ fontSize: 15, color: T.text3 }}>→</div>
                  <div style={{ flex: "0 1 200px" }}>
                    <Sel value={mapa[g.key] || ""} onChange={e => setMapa(m => ({ ...m, [g.key]: e.target.value }))}>
                      <option value="">— manter como Outros —</option>
                      {canonicos.map(c => <option key={c} value={c}>{c}</option>)}
                    </Sel>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ padding: "1rem 1.5rem", borderTop: `1px solid ${T.border}`, display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center", position: "sticky", bottom: 0, background: T.bg }}>
          <div style={{ fontSize: 12, color: T.text2 }}>
            {selecionados.length > 0 ? <><strong style={{ color: T.accent }}>{totalDesvios}</strong> desvio(s) em {selecionados.length} grupo(s) selecionado(s)</> : "Nenhum grupo selecionado"}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{ ...s.btn }}>Cancelar</button>
            <button onClick={aplicar} disabled={saving || !selecionados.length} style={{ ...s.btnA, opacity: saving || !selecionados.length ? 0.5 : 1, cursor: saving || !selecionados.length ? "not-allowed" : "pointer" }}>
              {saving ? "Reclassificando..." : "✓ Reclassificar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Campo({ T, l, v, bloco }) {
  if (!v && v !== 0) return null;
  return (
    <div style={{ marginBottom: bloco ? 12 : 8, display: bloco ? "block" : "flex", gap: 8 }}>
      <div style={{ fontSize: 11, color: T.text3, fontWeight: 600, minWidth: bloco ? "auto" : 150, marginBottom: bloco ? 4 : 0 }}>{l}</div>
      <div style={{ fontSize: 13, color: T.text, whiteSpace: "pre-wrap", flex: 1 }}>{v}</div>
    </div>
  );
}

// ── Formulário de novo desvio ──
function NovoDesvioForm({ user, toast_, setTab, doSaveDesvio, tiposDesvio = TIPOS_DESVIO, setoresDesvio = SETORES_DESVIO }) {
  const s = useS(); const T = useTheme();
  const [f, setF] = useState({
    dataOcorrencia: tod(), setor: "", setorOutro: "", tipo: tiposDesvio[0] || "Outros", tipoOutro: "", impacto: "Maior",
    desc: "", produto: "", acaoImediata: "Não", acaoDesc: "",
  });
  const [anexos, setAnexos] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const salvar = async () => {
    if (!f.setor) { alert("Selecione o setor do desvio."); return; }
    if (f.setor === "Outros" && !f.setorOutro.trim()) { alert("Especifique o setor do desvio (Outros)."); return; }
    if (f.tipo === "Outros" && !f.tipoOutro.trim()) { alert("Especifique o tipo do desvio (Outros)."); return; }
    if (!f.desc.trim()) { alert("Descreva o desvio observado."); return; }
    if (f.acaoImediata === "Sim" && !f.acaoDesc.trim()) { alert("Descreva a ação imediata adotada."); return; }
    setSalvando(true);
    try {
      const n = await incrementCounter();
      const desvio = {
        id: String(Date.now()),
        num: `DEV-${new Date().getFullYear()}-${genNum(n)}`,
        ...f,
        anexos,
        status: "Registrado",
        registradoPor: user.name,
        dataRegistro: tod(),
        createdAt: Date.now(),
        historico: [{ data: tod(), acao: "Desvio registrado", resp: user.name }],
      };
      await doSaveDesvio(desvio);
      toast_(`${desvio.num} registrado!`, "green");
      setTab("desvios");
    } catch (e) {
      toast_("Erro ao registrar o desvio. Tente novamente.", "red");
      console.error(e);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div>
      <div style={{ ...s.card }}>
        <SecTitle icon="📋" ch="Registro de desvio" />
        <div style={{ fontSize: 12, color: T.text3, marginBottom: 16, lineHeight: 1.5 }}>
          Registre o desvio observado em chão de fábrica. Quem registra e a data são preenchidos automaticamente.
          Após o registro, a Qualidade tria: encerra (se a ação imediata já sanou) ou converte em RNC.
        </div>
        <G3 ch={<>
          <F lbl="Data da ocorrência" tip="Quando o desvio aconteceu. Por padrão é hoje, mas pode ajustar se viu hoje algo de ontem." ch={<Inp type="date" value={f.dataOcorrencia} onChange={e => set("dataOcorrencia", e.target.value)} />} />
          <F lbl="Setor *" ch={
            <div>
              <Sel value={f.setor} onChange={e => set("setor", e.target.value)}><option value="">Selecione...</option>{setoresDesvio.map(x => <option key={x}>{x}</option>)}</Sel>
              {f.setor === "Outros" && <Inp placeholder="Especifique o setor..." value={f.setorOutro} onChange={e => set("setorOutro", e.target.value)} sx={{ marginTop: 8 }} />}
            </div>
          } />
          <F lbl="Impacto" tip="Mesma escala da RNC. Crítica: risco ao produto/paciente. Maior: impacto relevante. Menor: desvio leve." ch={<Sel value={f.impacto} onChange={e => set("impacto", e.target.value)}>{IMPACTOS_DESVIO.map(x => <option key={x}>{x}</option>)}</Sel>} />
        </>} />
        <F lbl="Tipo do desvio" ch={
          <div>
            <Sel value={f.tipo} onChange={e => set("tipo", e.target.value)}>{tiposDesvio.map(x => <option key={x}>{x}</option>)}</Sel>
            {f.tipo === "Outros" && <Inp placeholder="Especifique o tipo..." value={f.tipoOutro} onChange={e => set("tipoOutro", e.target.value)} sx={{ marginTop: 8 }} />}
          </div>
        } />
        <F lbl="Descrição do desvio *" tip="O que foi observado fora do padrão: o quê, onde, evidência." ch={<TA rows={4} placeholder="Descreva o desvio observado..." value={f.desc} onChange={e => set("desc", e.target.value)} />} />
        <F lbl="Produto / Lote" tip="Produto e lote envolvidos, se aplicável (nem todo desvio tem lote)." ch={<Inp placeholder="Ex: Calcivitam D3 — Lote 2025-001" value={f.produto} onChange={e => set("produto", e.target.value)} />} />
        <G2 ch={<>
          <F lbl="Houve ação imediata?" tip="Se uma ação no momento já conteve/sanou o desvio." ch={<Sel value={f.acaoImediata} onChange={e => set("acaoImediata", e.target.value)}><option>Não</option><option>Sim</option></Sel>} />
          {f.acaoImediata === "Sim" && <F lbl="Descrição da ação imediata *" ch={<Inp placeholder="O que foi feito na hora..." value={f.acaoDesc} onChange={e => set("acaoDesc", e.target.value)} />} />}
        </>} />
        <F lbl="📎 Anexos de evidências (fotos, documentos)" ch={<AnexosUpload anexos={anexos} setAnexos={setAnexos} inputId="desvio-anexo-input" />} />
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
        <button onClick={() => setTab("desvios")} style={{ ...s.btn, padding: "11px 20px" }}>Cancelar</button>
        <button onClick={salvar} disabled={salvando} style={{ padding: "11px 24px", background: "#2ab84a", color: "#fff", border: "none", borderRadius: 8, cursor: salvando ? "default" : "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, opacity: salvando ? .6 : 1 }}>{salvando ? "Registrando..." : "Registrar desvio"}</button>
      </div>
    </div>
  );
}

import React, { useState } from "react";
import { useTheme } from "../../core/theme";
import { fmt, genNum, tod } from "../../core/utils";
import { incrementCounter } from "../../firebase";
import { useS } from "../../shared/styles";
import { F, G2, G3, Inp, Pagination, SecTitle, Sel, SevB, TA, usePagination } from "../../shared/ui";
import { AnexosUpload } from "../rnc/RncTabs";
import { DesviosIndicadores } from "./DesviosIndicadores";

// ── Listas fixas (chão de fábrica Herbamed) ──
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

// Texto do desvio reaproveitado ao pré-popular a RNC.
function descParaRNC(d) {
  const partes = [d.desc?.trim()];
  if (d.acaoImediata === "Sim" && d.acaoDesc?.trim()) partes.push(`\n\nAção imediata adotada: ${d.acaoDesc.trim()}`);
  return partes.filter(Boolean).join("");
}

export function DesviosTab({ view = "lista", user, toast_, setTab, desvios = [], doSaveDesvio, doDeleteDesvio, perm, setRncPrefill, isAdmin, catalogoTiposDesvio = [] }) {
  const tiposDesvio = tiposDesvioAtivos(catalogoTiposDesvio);
  if (view === "novo") {
    return <NovoDesvioForm user={user} toast_={toast_} setTab={setTab} doSaveDesvio={doSaveDesvio} tiposDesvio={tiposDesvio} />;
  }
  if (view === "indicadores") {
    return <DesviosIndicadores desvios={desvios} setTab={setTab} tiposDesvio={tiposDesvio} />;
  }
  return <DesviosLista user={user} toast_={toast_} setTab={setTab} desvios={desvios} doSaveDesvio={doSaveDesvio} doDeleteDesvio={doDeleteDesvio} perm={perm} setRncPrefill={setRncPrefill} isAdmin={isAdmin} tiposDesvio={tiposDesvio} />;
}

// ── Lista + triagem ──
function DesviosLista({ user, toast_, setTab, desvios, doSaveDesvio, doDeleteDesvio, perm, setRncPrefill, isAdmin, tiposDesvio = TIPOS_DESVIO }) {
  const T = useTheme(); const s = useS();
  const [fIni] = useState(consumirFiltroDesvios);
  const [busca, setBusca] = useState(fIni.busca || "");
  const [fStatus, setFStatus] = useState(fIni.status || "");
  const [fSetor, setFSetor] = useState(fIni.setor || "");
  const [fTipo, setFTipo] = useState(fIni.tipo || "");
  const [sel, setSel] = useState(null);

  const podeTriar = isAdmin || perm("triarDesvio");

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

  const { paginated, page, total, setPage } = usePagination(filtrados, 15);

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
            <F lbl="Setor" ch={<Sel value={fSetor} onChange={e => setFSetor(e.target.value)}><option value="">Todos</option>{SETORES_DESVIO.map(x => <option key={x}>{x}</option>)}</Sel>} />
          </div>
          <div style={{ flex: "1 1 130px" }}>
            <F lbl="Tipo" ch={<Sel value={fTipo} onChange={e => setFTipo(e.target.value)}><option value="">Todos</option>{tiposDesvio.map(x => <option key={x}>{x}</option>)}</Sel>} />
          </div>
          {perm("criarDesvio") && (
            <button onClick={() => setTab("novo-desvio")} style={{ ...s.btnA, padding: "9px 16px", marginBottom: 14 }}>+ Novo desvio</button>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div style={{ ...s.card, padding: 0, overflowX: "auto" }}>
        {filtrados.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", color: T.text3, fontSize: 13 }}>Nenhum desvio registrado ainda.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: T.surf, color: T.text3, fontSize: 10, textTransform: "uppercase", letterSpacing: ".05em" }}>
                {["Nº", "Data", "Setor", "Tipo", "Impacto", "Descrição", "Status", ""].map(h => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, borderBottom: `1px solid ${T.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map(d => (
                <tr key={d.id} onClick={() => setSel(d)} style={{ cursor: "pointer", borderBottom: `1px solid ${T.border}` }}
                  onMouseEnter={e => e.currentTarget.style.background = T.card2}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "10px 12px", fontWeight: 700, color: T.accent, whiteSpace: "nowrap" }}>{d.num}</td>
                  <td style={{ padding: "10px 12px", color: T.text2, whiteSpace: "nowrap" }}>{fmt(d.dataOcorrencia)}</td>
                  <td style={{ padding: "10px 12px", color: T.text2 }}>{d.setor === "Outros" ? d.setorOutro || "Outros" : d.setor || "—"}</td>
                  <td style={{ padding: "10px 12px", color: T.text2 }}>{d.tipo === "Outros" ? d.tipoOutro || "Outros" : d.tipo}</td>
                  <td style={{ padding: "10px 12px" }}>{d.impacto ? <SevB s={d.impacto} /> : "—"}</td>
                  <td style={{ padding: "10px 12px", color: T.text, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.desc}</td>
                  <td style={{ padding: "10px 12px" }}><DesvioBadge status={d.status} /></td>
                  <td style={{ padding: "10px 12px", color: T.text3, fontSize: 16 }}>›</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={page} total={total} setPage={setPage} />
      </div>

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
              <button onClick={() => setSel(null)} style={{ background: "none", border: "none", color: T.text3, cursor: "pointer", fontSize: 22, fontFamily: "inherit" }}>✕</button>
            </div>
            <div style={{ padding: "1.5rem" }}>
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
                {sel.status === "Encerrado" && <div style={{ marginTop: 4 }}>Encerrado por {sel.encerradoPor} em {fmt(sel.encerradoEm)}{sel.encerramentoMotivo ? ` — ${sel.encerramentoMotivo}` : ""}</div>}
                {sel.status === "Convertido em RNC" && <div style={{ marginTop: 4 }}>Convertido por {sel.convertidoPor} em {fmt(sel.convertidoEm)}{sel.rncNum ? ` → ${sel.rncNum}` : ""}</div>}
              </div>
            </div>
            {/* Ações de triagem */}
            {sel.status === "Registrado" && podeTriar && (
              <div style={{ padding: "1rem 1.5rem", borderTop: `1px solid ${T.border}`, display: "flex", gap: 10, flexWrap: "wrap", position: "sticky", bottom: 0, background: T.bg }}>
                <button onClick={() => encerrar(sel)} style={{ flex: "1 1 200px", padding: "11px", background: "#2ab84a", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700 }}>✓ Encerrar (ação imediata)</button>
                <button onClick={() => converter(sel)} style={{ flex: "1 1 200px", padding: "11px", background: "#ff8c42", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700 }}>↗ Converter em RNC</button>
              </div>
            )}
            {(isAdmin || perm("triarDesvio")) && (
              <div style={{ padding: "0 1.5rem 1.2rem", textAlign: "right" }}>
                <button onClick={() => excluir(sel)} style={{ background: "none", border: "none", color: "#ff4f6a", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>Excluir desvio</button>
              </div>
            )}
          </div>
        </div>
      )}
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
function NovoDesvioForm({ user, toast_, setTab, doSaveDesvio, tiposDesvio = TIPOS_DESVIO }) {
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
              <Sel value={f.setor} onChange={e => set("setor", e.target.value)}><option value="">Selecione...</option>{SETORES_DESVIO.map(x => <option key={x}>{x}</option>)}</Sel>
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

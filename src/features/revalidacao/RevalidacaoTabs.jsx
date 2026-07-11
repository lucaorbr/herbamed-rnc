import React, { useState } from "react";
import { useTheme } from "../../core/theme";
import { fmt, genNum, tod } from "../../core/utils";
import { incrementCounter, uploadLocalFile } from "../../firebase";
import { useS } from "../../shared/styles";
import { F, G2, G3, Inp, Pagination, SecTitle, Sel, TA, usePagination } from "../../shared/ui";
import { openPDFWindow } from "../pdf/pdfExports";

// ── Módulo: Revalidação de Material Gráfico (RMG) ──
// Registra a revalidação de materiais gráficos de embalagem (cartuchos, rótulos,
// bulas): compara o material vigente com o proposto, item a item, e dá parecer.
// MVP enxuto — sem assinatura eletrônica (registra quem criou). Espelha a
// estrutura do módulo de Desvios; persistência na collection genérica
// "revalidacoes_grafico".

export const TIPOS_MATERIAL = ["Cartucho", "Rótulo", "Bula", "Etiqueta", "Blister", "Outros"];

// Itens-semente do checklist de diferenças (mesma base do template impresso).
export const ITENS_CHECKLIST = [
  "Dizeres legais (validade, lote, SAC)",
  "Composição / fórmula",
  "Código de barras (EAN) — leitura",
  "Cores (referência Pantone)",
  "Dimensões / layout / dobras",
  "Logotipo, marca e fontes",
  "Braille (quando aplicável)",
  "Símbolos e advertências regulatórias",
  "Textos e ortografia",
];

// Parecer → rótulo/cor do badge. status do registro = parecer (ou "Em análise" sem parecer).
export const PARECER_META = {
  "":          { label: "Em análise",           c: "#4fc3f7", bg: "#4fc3f718" },
  aprovado:    { label: "Aprovado",             c: "#2ab84a", bg: "#2ab84a18" },
  ressalvas:   { label: "Aprovado c/ ressalvas", c: "#ffb300", bg: "#ffb30018" },
  reprovado:   { label: "Reprovado",            c: "#ff4f6a", bg: "#ff4f6a18" },
};

function ParecerBadge({ parecer }) {
  const m = PARECER_META[parecer || ""] || PARECER_META[""];
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, textTransform: "uppercase", background: m.bg, color: m.c }}>
    <span style={{ width: 5, height: 5, borderRadius: "50%", background: m.c, display: "inline-block" }} />{m.label}
  </span>;
}

// Edição pendente (detalhe → editar abre o form já preenchido). Consumida uma vez.
let _edicaoPendente = null;
export const pedirEdicaoRevalidacao = r => { _edicaoPendente = r; };
const consumirEdicao = () => { const r = _edicaoPendente; _edicaoPendente = null; return r; };

export function RevalidacaoTab({ view = "lista", user, toast_, setTab, revalidacoes = [], doSaveRevalidacao, doDeleteRevalidacao, perm, isAdmin }) {
  if (view === "nova") {
    return <NovaRevalidacaoForm user={user} toast_={toast_} setTab={setTab} doSaveRevalidacao={doSaveRevalidacao} />;
  }
  return <RevalidacaoLista user={user} toast_={toast_} setTab={setTab} revalidacoes={revalidacoes} doSaveRevalidacao={doSaveRevalidacao} doDeleteRevalidacao={doDeleteRevalidacao} perm={perm} isAdmin={isAdmin} />;
}

// ── Upload de foto única com preview ──
function FotoUpload({ foto, setFoto, label, cor, inputId }) {
  const T = useTheme();
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.type?.includes("image")) { alert("Selecione uma imagem (JPG/PNG)."); return; }
    if (file.size > 10 * 1024 * 1024) { alert("Imagem maior que 10MB."); return; }
    setUploading(true);
    try {
      const res = await uploadLocalFile(file);
      setFoto({ url: res.url, name: file.name, type: file.type });
    } catch (e) { alert("Erro ao enviar imagem: " + e.message); }
    setUploading(false);
  };

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: cor, marginBottom: 6 }}>{label}</div>
      <div
        onDragOver={e => { e.preventDefault(); }}
        onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
        style={{ border: `1.5px dashed ${T.border2}`, borderRadius: 10, minHeight: 190, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", background: T.surf, overflow: "hidden" }}
      >
        {foto?.url ? (
          <>
            <img src={foto.url} alt={label} style={{ maxWidth: "100%", maxHeight: 220, display: "block" }} />
            <button onClick={() => setFoto(null)} title="Remover" style={{ position: "absolute", top: 6, right: 6, background: "#000a", color: "#fff", border: "none", borderRadius: 6, width: 26, height: 26, cursor: "pointer", fontSize: 14 }}>✕</button>
          </>
        ) : (
          <label htmlFor={inputId} style={{ cursor: "pointer", textAlign: "center", color: T.text3, fontSize: 12, padding: 16 }}>
            {uploading ? "Enviando..." : <>🖼️<br />Clique ou arraste a imagem<br /><span style={{ fontSize: 10 }}>JPG/PNG até 10MB</span></>}
          </label>
        )}
        <input id={inputId} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleFile(e.target.files?.[0])} />
      </div>
    </div>
  );
}

// ── Formulário: nova / editar ──
function NovaRevalidacaoForm({ user, toast_, setTab, doSaveRevalidacao }) {
  const s = useS(); const T = useTheme();
  const [edicao] = useState(consumirEdicao);
  const [f, setF] = useState(() => edicao || {
    sku: "", tipoMaterial: "Cartucho", tipoMaterialOutro: "", fornecedor: "", produto: "", registroMS: "",
    arteAtual: "", arteNova: "", motivo: "",
    fotoAtual: null, fotoNova: null,
    itens: ITENS_CHECKLIST.map(item => ({ item, conforme: "", obs: "" })),
    parecer: "", justificativa: "",
  });
  const [salvando, setSalvando] = useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const setItem = (i, k, v) => setF(p => ({ ...p, itens: p.itens.map((it, j) => j === i ? { ...it, [k]: v } : it) }));

  const salvar = async () => {
    if (!f.sku.trim()) { alert("Informe o código / SKU do material."); return; }
    if (!f.produto.trim()) { alert("Informe o produto / apresentação."); return; }
    if (f.tipoMaterial === "Outros" && !f.tipoMaterialOutro.trim()) { alert("Especifique o tipo de material (Outros)."); return; }
    if (!f.motivo.trim()) { alert("Informe o motivo da revalidação."); return; }
    setSalvando(true);
    try {
      const isNew = !edicao;
      let num = edicao?.num;
      if (isNew) {
        const n = await incrementCounter();
        num = `RMG-${new Date().getFullYear()}-${genNum(n)}`;
      }
      const registro = {
        ...(edicao || {}),
        ...f,
        id: edicao?.id || String(Date.now()),
        num,
        status: PARECER_META[f.parecer || ""].label,
        criadoPor: edicao?.criadoPor || user.name,
        dataRegistro: edicao?.dataRegistro || tod(),
        createdAt: edicao?.createdAt || Date.now(),
        atualizadoEm: tod(),
        historico: [...(edicao?.historico || []), { data: tod(), acao: isNew ? "Revalidação registrada" : `Editada — parecer: ${PARECER_META[f.parecer || ""].label}`, resp: user.name }],
      };
      await doSaveRevalidacao(registro);
      toast_(`${num} ${isNew ? "registrada" : "atualizada"}!`, "green");
      setTab("revalidacao");
    } catch (e) {
      console.error(e);
      toast_("Erro ao salvar a revalidação. Tente novamente.", "red");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div>
      {/* 1. Identificação */}
      <div style={{ ...s.card }}>
        <SecTitle icon="🎨" ch="Identificação do material" />
        <div style={{ fontSize: 12, color: T.text3, marginBottom: 16, lineHeight: 1.5 }}>
          Revalidação de material gráfico de embalagem. Compare o material vigente com o proposto e registre o parecer. Quem registra e a data são preenchidos automaticamente.
        </div>
        <G3 ch={<>
          <F lbl="Código / SKU *" ch={<Inp placeholder="Código interno do material" value={f.sku} onChange={e => set("sku", e.target.value)} />} />
          <F lbl="Tipo de material" ch={
            <div>
              <Sel value={f.tipoMaterial} onChange={e => set("tipoMaterial", e.target.value)}>{TIPOS_MATERIAL.map(x => <option key={x}>{x}</option>)}</Sel>
              {f.tipoMaterial === "Outros" && <Inp placeholder="Especifique..." value={f.tipoMaterialOutro} onChange={e => set("tipoMaterialOutro", e.target.value)} sx={{ marginTop: 8 }} />}
            </div>
          } />
          <F lbl="Fornecedor gráfico" ch={<Inp placeholder="Gráfica / fornecedor" value={f.fornecedor} onChange={e => set("fornecedor", e.target.value)} />} />
        </>} />
        <G2 ch={<>
          <F lbl="Produto / Apresentação *" ch={<Inp placeholder="Ex: Calcivitam D3 60 cáps" value={f.produto} onChange={e => set("produto", e.target.value)} />} />
          <F lbl="Registro MS / ANVISA" ch={<Inp value={f.registroMS} onChange={e => set("registroMS", e.target.value)} />} />
        </>} />
        <G3 ch={<>
          <F lbl="Nº arte atual (vigente)" ch={<Inp value={f.arteAtual} onChange={e => set("arteAtual", e.target.value)} />} />
          <F lbl="Nº arte revalidada (proposta)" ch={<Inp value={f.arteNova} onChange={e => set("arteNova", e.target.value)} />} />
          <F lbl="Motivo da revalidação *" ch={<Inp placeholder="Troca de fornecedor, alteração legal..." value={f.motivo} onChange={e => set("motivo", e.target.value)} />} />
        </>} />
      </div>

      {/* 2. Comparação visual */}
      <div style={{ ...s.card, marginTop: 16 }}>
        <SecTitle icon="🔍" ch="Comparação visual" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <FotoUpload foto={f.fotoAtual} setFoto={v => set("fotoAtual", v)} label="MATERIAL ATUAL (vigente)" cor={T.text2} inputId="rmg-foto-atual" />
          <FotoUpload foto={f.fotoNova} setFoto={v => set("fotoNova", v)} label="MATERIAL REVALIDADO (proposto)" cor={T.accent} inputId="rmg-foto-nova" />
        </div>
      </div>

      {/* 3. Checklist */}
      <div style={{ ...s.card, marginTop: 16 }}>
        <SecTitle icon="✅" ch="Checklist de diferenças (item a item)" />
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: T.surf, color: T.text3, fontSize: 10, textTransform: "uppercase" }}>
                {["Item verificado", "Conforme?", "Observação (se não conforme)"].map(h => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, borderBottom: `1px solid ${T.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {f.itens.map((it, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                  <td style={{ padding: "6px 10px", fontWeight: 600, color: T.text2, minWidth: 200 }}>{it.item}</td>
                  <td style={{ padding: "6px 10px", minWidth: 140 }}>
                    <Sel value={it.conforme} onChange={e => setItem(i, "conforme", e.target.value)}>
                      <option value="">—</option>
                      <option value="sim">Conforme</option>
                      <option value="nao">Não conforme</option>
                      <option value="na">N/A</option>
                    </Sel>
                  </td>
                  <td style={{ padding: "6px 6px" }}><Inp placeholder={it.conforme === "nao" ? "Descreva a diferença..." : ""} value={it.obs} onChange={e => setItem(i, "obs", e.target.value)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Parecer */}
      <div style={{ ...s.card, marginTop: 16 }}>
        <SecTitle icon="📝" ch="Parecer técnico" />
        <F lbl="Parecer" ch={
          <Sel value={f.parecer} onChange={e => set("parecer", e.target.value)}>
            <option value="">Em análise (sem parecer ainda)</option>
            <option value="aprovado">Aprovado</option>
            <option value="ressalvas">Aprovado com ressalvas</option>
            <option value="reprovado">Reprovado</option>
          </Sel>
        } />
        <F lbl="Justificativa / diferenças relevantes / ressalvas" ch={<TA rows={4} placeholder="Descreva as diferenças relevantes e a conclusão..." value={f.justificativa} onChange={e => set("justificativa", e.target.value)} />} />
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
        <button onClick={() => setTab("revalidacao")} style={{ ...s.btn, padding: "11px 20px" }}>Cancelar</button>
        <button onClick={salvar} disabled={salvando} style={{ ...s.btnA, padding: "11px 24px", opacity: salvando ? .6 : 1, cursor: salvando ? "default" : "pointer" }}>{salvando ? "Salvando..." : edicao ? "Salvar alterações" : "Registrar revalidação"}</button>
      </div>
    </div>
  );
}

// ── Detalhe: campo simples ──
function Campo({ T, l, v, bloco }) {
  if (!v && v !== 0) return null;
  return (
    <div style={{ marginBottom: bloco ? 12 : 8, display: bloco ? "block" : "flex", gap: 8 }}>
      <div style={{ fontSize: 11, color: T.text3, fontWeight: 600, minWidth: bloco ? "auto" : 150, marginBottom: bloco ? 4 : 0 }}>{l}</div>
      <div style={{ fontSize: 13, color: T.text, whiteSpace: "pre-wrap", flex: 1 }}>{v}</div>
    </div>
  );
}

const tipoMaterialLabel = r => r.tipoMaterial === "Outros" ? (r.tipoMaterialOutro || "Outros") : r.tipoMaterial;

// ── Lista + detalhe ──
function RevalidacaoLista({ user, toast_, setTab, revalidacoes, doSaveRevalidacao, doDeleteRevalidacao, perm, isAdmin }) {
  const T = useTheme(); const s = useS();
  const [busca, setBusca] = useState("");
  const [fParecer, setFParecer] = useState("");
  const [sel, setSel] = useState(null);

  const podeCriar = isAdmin || perm("criarRevalidacao");

  const filtrados = [...revalidacoes]
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .filter(r => !fParecer || (r.parecer || "") === fParecer)
    .filter(r => {
      if (!busca.trim()) return true;
      const q = busca.toLowerCase();
      return [r.num, r.sku, r.produto, r.fornecedor, r.motivo, r.criadoPor].some(x => (x || "").toLowerCase().includes(q));
    });

  const { paginated, page, total, setPage } = usePagination(filtrados, 15);

  const kAprov = revalidacoes.filter(r => r.parecer === "aprovado" || r.parecer === "ressalvas").length;
  const kReprov = revalidacoes.filter(r => r.parecer === "reprovado").length;
  const kPend = revalidacoes.filter(r => !r.parecer).length;

  const editar = (r) => { pedirEdicaoRevalidacao(r); setSel(null); setTab("nova-revalidacao"); };

  const excluir = async (r) => {
    if (!window.confirm(`Excluir a revalidação ${r.num}? Esta ação não pode ser desfeita.`)) return;
    await doDeleteRevalidacao(r.id);
    setSel(null);
    toast_(`${r.num} excluída.`, "green");
  };

  const exportarPDF = (r) => openPDFWindow(`Revalidação ${r.num}`, buildRevalidacaoHTML(r));

  return (
    <div>
      {/* KPIs */}
      <div className="kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
        {[
          { l: "Total", n: revalidacoes.length, c: T.accent },
          { l: "Aprovadas", n: kAprov, c: "#2ab84a" },
          { l: "Reprovadas", n: kReprov, c: "#ff4f6a" },
          { l: "Em análise", n: kPend, c: "#4fc3f7" },
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
            <F lbl="Buscar" ch={<Inp placeholder="Nº, SKU, produto, fornecedor..." value={busca} onChange={e => setBusca(e.target.value)} />} />
          </div>
          <div style={{ flex: "1 1 160px" }}>
            <F lbl="Parecer" ch={<Sel value={fParecer} onChange={e => setFParecer(e.target.value)}><option value="">Todos</option><option value="">Em análise</option><option value="aprovado">Aprovado</option><option value="ressalvas">Aprovado c/ ressalvas</option><option value="reprovado">Reprovado</option></Sel>} />
          </div>
          {podeCriar && (
            <button onClick={() => setTab("nova-revalidacao")} style={{ ...s.btnA, padding: "9px 16px", marginBottom: 14 }}>+ Nova revalidação</button>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div style={{ ...s.card, padding: 0, overflowX: "auto" }}>
        {filtrados.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", color: T.text3, fontSize: 13 }}>Nenhuma revalidação registrada ainda.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: T.surf, color: T.text3, fontSize: 10, textTransform: "uppercase", letterSpacing: ".05em" }}>
                {["Nº", "Data", "SKU", "Tipo", "Produto", "Parecer", ""].map(h => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, borderBottom: `1px solid ${T.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map(r => (
                <tr key={r.id} onClick={() => setSel(r)} style={{ cursor: "pointer", borderBottom: `1px solid ${T.border}` }}
                  onMouseEnter={e => e.currentTarget.style.background = T.card2}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "10px 12px", fontWeight: 700, color: T.accent, whiteSpace: "nowrap" }}>{r.num}</td>
                  <td style={{ padding: "10px 12px", color: T.text2, whiteSpace: "nowrap" }}>{fmt(r.dataRegistro)}</td>
                  <td style={{ padding: "10px 12px", color: T.text2 }}>{r.sku || "—"}</td>
                  <td style={{ padding: "10px 12px", color: T.text2 }}>{tipoMaterialLabel(r)}</td>
                  <td style={{ padding: "10px 12px", color: T.text, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.produto}</td>
                  <td style={{ padding: "10px 12px" }}><ParecerBadge parecer={r.parecer} /></td>
                  <td style={{ padding: "10px 12px", color: T.text3, fontSize: 16 }}>›</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={page} total={total} setPage={setPage} />
      </div>

      {/* Modal de detalhe */}
      {sel && (
        <div onClick={() => setSel(null)} style={{ position: "fixed", inset: 0, background: "#000a", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: T.bg, border: `1px solid ${T.border2}`, borderRadius: 14, maxWidth: 760, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px #000a" }}>
            <div style={{ padding: "1.2rem 1.5rem", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: T.bg }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: T.accent }}>{sel.num}</span>
                <ParecerBadge parecer={sel.parecer} />
              </div>
              <button onClick={() => setSel(null)} style={{ background: "none", border: "none", color: T.text3, cursor: "pointer", fontSize: 22, fontFamily: "inherit" }}>✕</button>
            </div>
            <div style={{ padding: "1.5rem" }}>
              <G2 ch={<>
                <Campo T={T} l="Código / SKU" v={sel.sku} />
                <Campo T={T} l="Tipo de material" v={tipoMaterialLabel(sel)} />
              </>} />
              <Campo T={T} l="Produto / Apresentação" v={sel.produto} />
              {sel.fornecedor && <Campo T={T} l="Fornecedor gráfico" v={sel.fornecedor} />}
              {sel.registroMS && <Campo T={T} l="Registro MS / ANVISA" v={sel.registroMS} />}
              <G2 ch={<>
                <Campo T={T} l="Nº arte atual" v={sel.arteAtual} />
                <Campo T={T} l="Nº arte revalidada" v={sel.arteNova} />
              </>} />
              <Campo T={T} l="Motivo da revalidação" v={sel.motivo} bloco />

              {/* Fotos */}
              {(sel.fotoAtual?.url || sel.fotoNova?.url) && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, margin: "12px 0" }}>
                  {["fotoAtual", "fotoNova"].map((k, i) => (
                    <div key={k}>
                      <div style={{ fontSize: 10, color: T.text3, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>{i === 0 ? "Material atual" : "Material revalidado"}</div>
                      {sel[k]?.url
                        ? <a href={sel[k].url} target="_blank" rel="noopener noreferrer"><img src={sel[k].url} alt="" style={{ maxWidth: "100%", borderRadius: 8, border: `1px solid ${T.border}` }} /></a>
                        : <div style={{ fontSize: 12, color: T.text3 }}>—</div>}
                    </div>
                  ))}
                </div>
              )}

              {/* Checklist */}
              {sel.itens?.some(it => it.conforme || it.obs) && (
                <div style={{ margin: "14px 0" }}>
                  <div style={{ fontSize: 10, color: T.text3, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Checklist de diferenças</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead><tr style={{ background: T.surf, color: T.text3, fontSize: 10 }}>
                      {["Item", "Conforme", "Observação"].map(h => <th key={h} style={{ padding: "6px 8px", textAlign: "left", borderBottom: `1px solid ${T.border}` }}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {sel.itens.filter(it => it.conforme || it.obs).map((it, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                          <td style={{ padding: "6px 8px", color: T.text2, fontWeight: 600 }}>{it.item}</td>
                          <td style={{ padding: "6px 8px", color: it.conforme === "nao" ? "#ff4f6a" : it.conforme === "sim" ? "#2ab84a" : T.text3, fontWeight: 700, whiteSpace: "nowrap" }}>
                            {it.conforme === "sim" ? "Conforme" : it.conforme === "nao" ? "Não conf." : it.conforme === "na" ? "N/A" : "—"}
                          </td>
                          <td style={{ padding: "6px 8px", color: T.text }}>{it.obs || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {sel.justificativa && <Campo T={T} l="Parecer / Justificativa" v={sel.justificativa} bloco />}

              <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.border}`, fontSize: 11, color: T.text3 }}>
                Registrada por <strong style={{ color: T.text2 }}>{sel.criadoPor}</strong> em {fmt(sel.dataRegistro)}
                {sel.atualizadoEm && sel.atualizadoEm !== sel.dataRegistro && <> · atualizada em {fmt(sel.atualizadoEm)}</>}
              </div>
            </div>

            {/* Ações */}
            <div style={{ padding: "1rem 1.5rem", borderTop: `1px solid ${T.border}`, display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "space-between", position: "sticky", bottom: 0, background: T.bg }}>
              <button onClick={() => exportarPDF(sel)} style={{ ...s.btn, padding: "10px 18px" }}>📄 Exportar PDF</button>
              <div style={{ display: "flex", gap: 10 }}>
                {podeCriar && <button onClick={() => editar(sel)} style={{ ...s.btnA, padding: "10px 18px" }}>✏️ Editar</button>}
                {(isAdmin || perm("criarRevalidacao")) && <button onClick={() => excluir(sel)} style={{ background: "none", border: "none", color: "#ff4f6a", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>Excluir</button>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── HTML do PDF (reusa PDF_CSS via openPDFWindow) ──
function buildRevalidacaoHTML(r) {
  const esc = (x) => String(x ?? "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const m = PARECER_META[r.parecer || ""] || PARECER_META[""];
  const field = (l, v) => `<div class="field"><div class="flabel">${esc(l)}</div><div class="fval">${esc(v) || "—"}</div></div>`;
  const itens = (r.itens || []).filter(it => it.conforme || it.obs);
  const confLabel = c => c === "sim" ? "Conforme" : c === "nao" ? "Não conforme" : c === "na" ? "N/A" : "—";
  return `
    <div class="page">
      <div class="header">
        <div><div class="logo">HERBAMED</div><div class="logo-sub">Revalidação de Material Gráfico</div></div>
        <div><div class="doc-num">${esc(r.num)}</div><div class="doc-date">${fmt(r.dataRegistro)}</div></div>
      </div>

      <div class="section">
        <div class="stitle">Identificação</div>
        <div class="grid3">
          ${field("Código / SKU", r.sku)}
          ${field("Tipo de material", tipoMaterialLabel(r))}
          ${field("Fornecedor gráfico", r.fornecedor)}
        </div>
        <div class="grid2" style="margin-top:8px">
          ${field("Produto / Apresentação", r.produto)}
          ${field("Registro MS / ANVISA", r.registroMS)}
        </div>
        <div class="grid3" style="margin-top:8px">
          ${field("Nº arte atual", r.arteAtual)}
          ${field("Nº arte revalidada", r.arteNova)}
          ${field("Motivo", r.motivo)}
        </div>
      </div>

      ${(r.fotoAtual?.url || r.fotoNova?.url) ? `
      <div class="section">
        <div class="stitle">Comparação visual</div>
        <div class="grid2">
          <div style="text-align:center"><div class="flabel">Material atual</div>${r.fotoAtual?.url ? `<img src="${r.fotoAtual.url}" style="max-width:100%;max-height:240px;border:1px solid #ddd;border-radius:6px"/>` : "—"}</div>
          <div style="text-align:center"><div class="flabel">Material revalidado</div>${r.fotoNova?.url ? `<img src="${r.fotoNova.url}" style="max-width:100%;max-height:240px;border:1px solid #ddd;border-radius:6px"/>` : "—"}</div>
        </div>
      </div>` : ""}

      ${itens.length ? `
      <div class="section">
        <div class="stitle">Checklist de diferenças</div>
        <table>
          <thead><tr><th>Item</th><th>Conforme?</th><th>Observação</th></tr></thead>
          <tbody>${itens.map(it => `<tr><td><strong>${esc(it.item)}</strong></td><td>${confLabel(it.conforme)}</td><td>${esc(it.obs)}</td></tr>`).join("")}</tbody>
        </table>
      </div>` : ""}

      <div class="section">
        <div class="stitle">Parecer técnico</div>
        <div class="box-${r.parecer === "reprovado" ? "red" : r.parecer === "ressalvas" ? "orange" : "green"}">
          <span class="badge" style="background:${m.bg};color:${m.c}">${m.label}</span>
          ${r.justificativa ? `<div style="margin-top:8px;white-space:pre-wrap">${esc(r.justificativa)}</div>` : ""}
        </div>
      </div>

      <div class="sign-row">
        <div class="sign-box"><div class="sign-line">Elaborado por: ${esc(r.criadoPor)}</div></div>
        <div class="sign-box"><div class="sign-line">Aprovado por</div></div>
      </div>

      <div class="footer">
        <span>Herbamed — SGQ · Revalidação de Material Gráfico</span>
        <span>${esc(r.num)} · ${fmt(r.dataRegistro)}</span>
      </div>
    </div>`;
}

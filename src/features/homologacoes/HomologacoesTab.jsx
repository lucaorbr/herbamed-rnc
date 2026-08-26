import React, { useEffect, useMemo, useState } from "react";
import { deleteFromCollection, incrementHomologacaoCounter, saveCollection, subscribeCollection } from "../../firebase";
import { fmt, tod } from "../../core/utils";
import { useTheme } from "../../core/theme";
import { useS } from "../../shared/styles";
import { AnexosUpload } from "../../shared/AnexosUpload";
import { F, Inp, SecTitle, Sel, TA } from "../../shared/ui";
import { AssinaturaModal, buildPDFShell, openPDFWindow } from "../pdf/pdfExports";
import {
  CATEGORIAS_HOMOLOGACAO,
  STATUS_HOMOLOGACAO,
  checklistTecnicoInicial,
  documentosIniciais,
  erroPorChave,
  escapeHtml,
  pendenciasParecer,
  pendenciasSubmissao,
  statusEfetivo,
} from "./homologacaoLogic";

const FINALIZADOS = new Set(["Homologada", "Condicional", "Reprovada"]);

function formVazio() {
  const categoria = CATEGORIAS_HOMOLOGACAO[0];
  return {
    fornecedorId: "", fornecedorNome: "", fabricante: "", unidadeFabricante: "",
    categoria, materialId: "", itemNome: "", codigoItem: "", finalidade: "",
    motivo: "Produto novo", criticidade: "", responsavel: "", prazo: "", observacoes: "",
    documentos: documentosIniciais(categoria), checklistTecnico: checklistTecnicoInicial(categoria), anexos: [],
  };
}

function BadgeStatus({ status }) {
  const efetivo = status || "Rascunho";
  const meta = STATUS_HOMOLOGACAO[efetivo] || (efetivo === "Vencida"
    ? { cor: "#ff4f6a", fundo: "#ff4f6a18" }
    : STATUS_HOMOLOGACAO.Rascunho);
  return <span style={{ display:"inline-flex", padding:"3px 10px", borderRadius:20, fontSize:10, fontWeight:700, color:meta.cor, background:meta.fundo, whiteSpace:"nowrap" }}>{efetivo}</span>;
}

function Campo({ label, value, amplo = false }) {
  const T = useTheme();
  if (!value) return null;
  return <div style={{ gridColumn:amplo?"1/-1":undefined, background:T.surf, border:`1px solid ${T.border}`, borderRadius:8, padding:"9px 11px" }}>
    <div style={{ fontSize:9, fontWeight:700, color:T.text3, textTransform:"uppercase", letterSpacing:".06em", marginBottom:3 }}>{label}</div>
    <div style={{ fontSize:12, color:T.text, whiteSpace:"pre-wrap" }}>{value}</div>
  </div>;
}

// O solicitante não configura o instrumento de avaliação — ele só pede. O que
// será exigido é consequência da categoria, e quem ajusta (marcando "Não
// aplicável" com justificativa) é o parecerista, na análise.
function ChecklistPreview({ itens, vazio, obrigatoriedade = false }) {
  const T = useTheme();
  if (!itens?.length) return <div style={{ fontSize:12, color:T.text3 }}>{vazio}</div>;
  return <div>
    {itens.map((item, i) => (
      <div key={item.id || i} style={{ display:"flex", alignItems:"baseline", gap:8, padding:"7px 0", borderBottom:`1px solid ${T.border}` }}>
        <span style={{ color:T.text3, fontSize:11, minWidth:18 }}>{i + 1}.</span>
        <span style={{ fontSize:12, color:T.text2, flex:1 }}>{item.item}</span>
        {obrigatoriedade && (
          <span style={{ fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:".05em", padding:"2px 8px", borderRadius:20,
            color: item.obrigatorio ? T.red : T.text3, background: item.obrigatorio ? `${T.red}18` : T.surf, whiteSpace:"nowrap" }}>
            {item.obrigatorio ? "Obrigatório" : "Se aplicável"}
          </span>
        )}
      </div>
    ))}
  </div>;
}

function NotaQuemPreenche({ ch }) {
  const T = useTheme();
  return <div style={{ fontSize:11, color:T.text3, background:T.surf, border:`1px solid ${T.border}`, borderRadius:8, padding:"8px 11px", marginBottom:12, lineHeight:1.5 }}>
    {ch}
  </div>;
}

function assinaturaResumo(assinatura) {
  if (!assinatura) return "—";
  return `${assinatura.nome || assinatura.name || "—"} · ${assinatura.dataHora || assinatura.timestamp || "—"} · ${assinatura.codigoVerificacao || "sem código"}`;
}

function htmlTabelaChecklist(itens, documental = false) {
  const linhas = (itens || []).map(item => `<tr>
    <td>${escapeHtml(item.item)}</td>
    <td>${escapeHtml(documental ? item.situacao : item.resultado)}</td>
    <td>${escapeHtml(documental ? item.validade : "")}</td>
    <td>${escapeHtml(item.obs)}</td>
  </tr>`).join("");
  return `<table><thead><tr><th>Item</th><th>Resultado</th>${documental?"<th>Validade</th>":"<th></th>"}<th>Observação</th></tr></thead><tbody>${linhas}</tbody></table>`;
}

function exportarPDF(registro) {
  const parecer = registro.parecerTecnico || {};
  const decisao = registro.decisaoFinal || {};
  const corpo = `
    <div class="section"><div class="stitle">1. Identificação e escopo</div><div class="grid2">
      <div class="field"><div class="flabel">Fornecedor</div><div class="fval">${escapeHtml(registro.fornecedorNome)}</div></div>
      <div class="field"><div class="flabel">Fabricante / unidade</div><div class="fval">${escapeHtml([registro.fabricante, registro.unidadeFabricante].filter(Boolean).join(" · ") || "—")}</div></div>
      <div class="field"><div class="flabel">Item / produto / serviço</div><div class="fval">${escapeHtml(registro.itemNome)}</div></div>
      <div class="field"><div class="flabel">Código / categoria</div><div class="fval">${escapeHtml([registro.codigoItem, registro.categoria].filter(Boolean).join(" · "))}</div></div>
      <div class="field"><div class="flabel">Finalidade</div><div class="fval">${escapeHtml(registro.finalidade)}</div></div>
      <div class="field"><div class="flabel">Criticidade</div><div class="fval">${escapeHtml(registro.criticidade)}</div></div>
    </div></div>
    <div class="section"><div class="stitle">2. Avaliação documental</div>${htmlTabelaChecklist(registro.documentos, true)}</div>
    <div class="section"><div class="stitle">3. Avaliação técnica</div>${htmlTabelaChecklist(registro.checklistTecnico)}</div>
    <div class="section"><div class="stitle">4. Parecer técnico</div>
      <div class="field"><div class="flabel">Recomendação</div><div class="fval">${escapeHtml(parecer.decisao || "—")}</div></div>
      <div class="field" style="margin-top:6px"><div class="flabel">Conclusão</div><div class="fval">${escapeHtml(parecer.conclusao || "—")}</div></div>
      <div class="field" style="margin-top:6px"><div class="flabel">Assinatura</div><div class="fval">${escapeHtml(assinaturaResumo(parecer.assinatura))}</div></div>
    </div>
    <div class="section"><div class="stitle">5. Decisão final</div>
      <div class="${registro.status==="Reprovada"?"box-red":registro.status==="Condicional"?"box-orange":"box-green"}">
        <strong>${escapeHtml(registro.status)}</strong> · Validade: ${escapeHtml(decisao.validade || "não aplicável")}<br/>
        ${decisao.condicoes ? `Condições: ${escapeHtml(decisao.condicoes)}<br/>` : ""}
        ${escapeHtml(decisao.conclusao || "")}<br/><br/>
        Assinatura: ${escapeHtml(assinaturaResumo(decisao.assinatura))}
      </div>
    </div>`;
  openPDFWindow(`Homologação ${registro.num}`, buildPDFShell({
    titulo: "Relatório de Homologação de Fornecedor e Item",
    numero: registro.num,
    meta: `${registro.status} · ${registro.itemNome}`,
    corpo,
  }));
}

export function HomologacoesTab({ user, users = [], fornecedores = [], homologacoes = [], toast_, auditLog, perm }) {
  const T = useTheme(); const s = useS();
  const [materiais, setMateriais] = useState([]);
  const [analises, setAnalises] = useState([]);
  const [view, setView] = useState("lista");
  const [sel, setSel] = useState(null);
  const [form, setForm] = useState(formVazio);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [parecerModal, setParecerModal] = useState(null);
  const [decisaoModal, setDecisaoModal] = useState(null);
  const [assinaturaCtx, setAssinaturaCtx] = useState(null);
  // As pendências só aparecem depois da primeira tentativa de envio — nascer
  // tudo vermelho antes de o usuário digitar é hostil. A partir daí elas se
  // atualizam ao vivo, então ele vê cada uma sumir conforme corrige.
  const [mostrarErros, setMostrarErros] = useState(false);
  const [mostrarErrosParecer, setMostrarErrosParecer] = useState(false);
  const [mostrarErrosDecisao, setMostrarErrosDecisao] = useState(false);

  useEffect(() => {
    const u1 = subscribeCollection("cq_materiais", setMateriais);
    const u2 = subscribeCollection("cq_analises", setAnalises);
    return () => { u1(); u2(); };
  }, []);

  useEffect(() => {
    if (sel) {
      const atual = homologacoes.find(h => String(h.id) === String(sel.id));
      if (atual) setSel(atual);
    }
  }, [homologacoes, sel?.id]);

  const setF = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const trocarCategoria = categoria => setForm(prev => ({
    ...prev, categoria,
    documentos: documentosIniciais(categoria),
    checklistTecnico: checklistTecnicoInicial(categoria),
  }));

  const filtradas = useMemo(() => homologacoes.filter(h => {
    const q = busca.toLowerCase();
    const status = statusEfetivo(h);
    return (!q || [h.num, h.fornecedorNome, h.itemNome, h.codigoItem].some(v => String(v || "").toLowerCase().includes(q)))
      && (!filtroStatus || status === filtroStatus);
  }).sort((a,b) => (b.criadoTs || 0) - (a.criadoTs || 0)), [homologacoes, busca, filtroStatus]);

  const errosForm = useMemo(() => pendenciasSubmissao(form), [form]);
  const errForm = campo => (mostrarErros ? erroPorChave(errosForm, campo) : "");

  const abrirNovo = () => { setSel(null); setForm(formVazio()); setMostrarErros(false); setView("form"); };
  const editar = registro => { setSel(registro); setForm({ ...formVazio(), ...registro }); setMostrarErros(false); setView("form"); };

  const persistir = async (enviar = false) => {
    if (enviar && errosForm.length) {
      setMostrarErros(true);
      document.getElementById("homologacao-topo-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setSalvando(true);
    try {
      const isNew = !sel;
      const id = sel?.id || String(Date.now());
      const num = sel?.num || await incrementHomologacaoCounter();
      const fornecedor = fornecedores.find(f => String(f.id) === String(form.fornecedorId));
      const base = {
        ...(sel || {}), ...form, id, num,
        fornecedorNome: fornecedor?.nome || form.fornecedorNome,
        status: "Rascunho",
        criadoPor: sel?.criadoPor || user.name,
        criadoPorId: sel?.criadoPorId || user.id || user.uid,
        criadoEm: sel?.criadoEm || tod(), criadoTs: sel?.criadoTs || Date.now(),
        atualizadoEm: tod(), atualizadoPor: user.name,
        historico: [...(sel?.historico || []), { data:new Date().toISOString(), acao:isNew?"Solicitação criada":"Rascunho atualizado", por:user.name }],
      };
      await saveCollection("homologacoes", id, base);
      await auditLog(isNew ? "Criou Homologação" : "Editou Homologação", "homologacoes", id, num, sel || null, base);
      let final = base;
      if (enviar) {
        final = {
          ...base, status:"Em análise", submetidoEm:new Date().toISOString(), submetidoPor:user.name,
          historico:[...base.historico, { data:new Date().toISOString(), acao:"Enviada para análise técnica", por:user.name }],
        };
        await saveCollection("homologacoes", id, final);
        await auditLog("Enviou Homologação para Análise", "homologacoes", id, num, base, final);
      }
      toast_(enviar ? `${num} enviada para análise!` : `${num} salva como rascunho.`, "green");
      setSel(final); setView("detalhe");
    } catch (e) {
      toast_(e.message || "Erro ao salvar homologação.", "red");
    } finally { setSalvando(false); }
  };

  const prepararParecer = registro => {
    setMostrarErrosParecer(false);
    setParecerModal({
      documentos:(registro.documentos || []).map(x=>({...x})),
      checklistTecnico:(registro.checklistTecnico || []).map(x=>({...x})),
      anexos:[...(registro.anexos || [])], decisao:"", conclusao:"",
    });
  };

  // Parecer desfavorável não exige o checklist completo: quem reprova não
  // precisa terminar de avaliar o que já foi reprovado.
  const errosParecer = useMemo(
    () => (parecerModal && parecerModal.decisao !== "Desfavorável" ? pendenciasParecer(parecerModal) : []),
    [parecerModal]
  );
  const errParecerLinha = id => (mostrarErrosParecer ? erroPorChave(errosParecer, id) : "");
  const faltaNoParecer = !parecerModal?.decisao || !String(parecerModal?.conclusao || "").trim() || errosParecer.length > 0;

  const solicitarAssinaturaParecer = () => {
    if (faltaNoParecer) { setMostrarErrosParecer(true); return; }
    setAssinaturaCtx({ tipo:"parecer" });
  };

  const confirmarParecer = async assinatura => {
    try {
      const atualizado = {
        ...sel,
        documentos:parecerModal.documentos,
        checklistTecnico:parecerModal.checklistTecnico,
        anexos:parecerModal.anexos,
        parecerTecnico:{ decisao:parecerModal.decisao, conclusao:parecerModal.conclusao, assinatura, data:new Date().toISOString() },
        status:"Aguardando aprovação", atualizadoEm:tod(), atualizadoPor:user.name,
        historico:[...(sel.historico||[]), { data:new Date().toISOString(), acao:`Parecer técnico: ${parecerModal.decisao}`, por:user.name }],
      };
      await saveCollection("homologacoes", String(sel.id), atualizado);
      await auditLog("Emitir Parecer de Homologação", "homologacoes", String(sel.id), sel.num, sel, atualizado);
      setSel(atualizado); setParecerModal(null); setAssinaturaCtx(null);
      toast_("Parecer técnico assinado. Aguardando aprovação final.", "green");
    } catch (e) { toast_(e.message || "Erro ao registrar parecer.", "red"); setAssinaturaCtx(null); }
  };

  const prepararDecisao = registro => {
    const validade = new Date(); validade.setFullYear(validade.getFullYear()+1);
    setMostrarErrosDecisao(false);
    setDecisaoModal({ decisao:registro.parecerTecnico?.decisao==="Desfavorável"?"Reprovada":"Homologada", validade:validade.toISOString().slice(0,10), condicoes:"", conclusao:"" });
  };

  const errosDecisao = useMemo(() => {
    if (!decisaoModal) return [];
    const erros = [];
    if (["Homologada","Condicional"].includes(decisaoModal.decisao) && !decisaoModal.validade) erros.push({ campo:"validade", msg:"Informe até quando esta homologação vale." });
    if (decisaoModal.decisao === "Condicional" && !String(decisaoModal.condicoes||"").trim()) erros.push({ campo:"condicoes", msg:"Descreva as condições que o fornecedor precisa cumprir." });
    if (!String(decisaoModal.conclusao||"").trim()) erros.push({ campo:"conclusao", msg:"Registre a conclusão final." });
    return erros;
  }, [decisaoModal]);
  const errDecisao = campo => (mostrarErrosDecisao ? erroPorChave(errosDecisao, campo) : "");

  const solicitarAssinaturaFinal = () => {
    if (errosDecisao.length) { setMostrarErrosDecisao(true); return; }
    setAssinaturaCtx({ tipo:"final" });
  };

  const confirmarDecisao = async assinatura => {
    try {
      const atualizado = {
        ...sel, status:decisaoModal.decisao,
        decisaoFinal:{ ...decisaoModal, assinatura, data:new Date().toISOString() },
        atualizadoEm:tod(), atualizadoPor:user.name,
        historico:[...(sel.historico||[]), { data:new Date().toISOString(), acao:`Decisão final: ${decisaoModal.decisao}`, por:user.name }],
      };
      await saveCollection("homologacoes", String(sel.id), atualizado);
      await auditLog("Aprovou Homologação", "homologacoes", String(sel.id), sel.num, sel, atualizado);
      setSel(atualizado); setDecisaoModal(null); setAssinaturaCtx(null);
      toast_(`Homologação ${decisaoModal.decisao.toLowerCase()}!`, atualizado.status==="Reprovada"?"red":"green");
    } catch (e) { toast_(e.message || "Erro ao registrar decisão.", "red"); setAssinaturaCtx(null); }
  };

  const excluirRascunho = async registro => {
    if (!window.confirm(`Excluir o rascunho ${registro.num}?`)) return;
    try {
      await deleteFromCollection("homologacoes", String(registro.id));
      await auditLog("Excluiu Homologação", "homologacoes", String(registro.id), registro.num, registro, null);
      setSel(null); setView("lista"); toast_("Rascunho excluído.", "red");
    } catch (e) { toast_(e.message || "Erro ao excluir.", "red"); }
  };

  if (view === "form") return <div id="homologacao-topo-form">
    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}><button style={s.btn} onClick={()=>setView(sel?"detalhe":"lista")}>← Voltar</button><strong>{sel?`Editar ${sel.num}`:"Nova homologação"}</strong></div>
    {mostrarErros && errosForm.length>0 && (
      <div style={{ background:"#ff4f6a14", border:"1px solid #ff4f6a55", borderRadius:10, padding:"11px 14px", marginBottom:14, fontSize:12, color:T.text2 }}>
        <b style={{ color:"#ff4f6a" }}>Faltam {errosForm.length} {errosForm.length===1?"item":"itens"} para enviar.</b> Os campos pendentes estão destacados abaixo.
      </div>
    )}
    <div style={s.card}><SecTitle icon="📋" ch="Identificação e escopo" />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,minmax(0,1fr))", gap:12 }}>
        <F lbl="Fornecedor *" err={errForm("fornecedorId")}
          tip="Empresa que vai fornecer o item. Só aparecem fornecedores já cadastrados e não bloqueados — se não estiver na lista, cadastre-o antes em Fornecedores."
          ch={<Sel value={form.fornecedorId} onChange={e=>{const f=fornecedores.find(x=>String(x.id)===e.target.value);setForm(p=>({...p,fornecedorId:e.target.value,fornecedorNome:f?.nome||""}));}}><option value="">Selecione...</option>{fornecedores.filter(f=>f.status!=="Bloqueado").map(f=><option key={f.id} value={f.id}>{f.nome}</option>)}</Sel>} />
        <F lbl="Categoria *" err={errForm("categoria")}
          tip="Define quais documentos e ensaios serão exigidos do fornecedor. Trocar a categoria refaz os dois checklists mais abaixo, então escolha antes de continuar."
          ch={<Sel value={form.categoria} onChange={e=>trocarCategoria(e.target.value)}>{CATEGORIAS_HOMOLOGACAO.map(c=><option key={c}>{c}</option>)}</Sel>} />
        <F lbl="Criticidade *" err={errForm("criticidade")}
          tip="O quanto este item afeta a qualidade do produto final. Crítica: princípio ativo ou contato direto com o produto. Alta: excipiente ou embalagem primária. Média: embalagem secundária. Baixa: material de apoio, sem contato com o produto."
          ch={<Sel value={form.criticidade} onChange={e=>setF("criticidade",e.target.value)}><option value="">Selecione...</option><option>Baixa</option><option>Média</option><option>Alta</option><option>Crítica</option></Sel>} />
        <F lbl="Item / produto / serviço *" err={errForm("itemNome")}
          tip="Nome do que está sendo homologado, do jeito que a fábrica chama. Ex.: Vitamina C (Ácido Ascórbico), Cartucho Calcivitam 60un, Serviço de calibração."
          ch={<Inp value={form.itemNome} onChange={e=>setF("itemNome",e.target.value)} placeholder="Ex.: Vitamina C / Cartucho / Laboratório" />} />
        <F lbl="Já cadastrado no CQ?"
          tip="Se este material já existe no cadastro do Controle de Qualidade, selecione-o: o nome e o código são preenchidos sozinhos e as análises de CQ daquele material passam a aparecer nesta homologação. Item novo? Deixe como está."
          ch={<Sel value={form.materialId} onChange={e=>{const m=materiais.find(x=>String(x.id)===e.target.value);setForm(p=>({...p,materialId:e.target.value,itemNome:m?.nome||p.itemNome,codigoItem:m?.ref||p.codigoItem}));}}><option value="">Não — item novo ou não cadastrado</option>{materiais.map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}</Sel>} />
        <F lbl="Código / referência"
          tip="Código interno do item, se já houver. Serve para amarrar esta homologação ao que o almoxarifado e o CQ usam no dia a dia."
          ch={<Inp value={form.codigoItem} onChange={e=>setF("codigoItem",e.target.value)} />} />
        <F lbl="Fabricante (se diferente)"
          tip="Preencha só quando quem fabrica não é quem vende. Distribuidores revendem material de terceiros, e o que se homologa tecnicamente é a fábrica de origem."
          ch={<Inp value={form.fabricante} onChange={e=>setF("fabricante",e.target.value)} />} />
        <F lbl="Unidade fabricante"
          tip="Planta/endereço onde o item é produzido. A mesma empresa pode ter unidades com licenças e desempenho diferentes."
          ch={<Inp value={form.unidadeFabricante} onChange={e=>setF("unidadeFabricante",e.target.value)} />} />
        <F lbl="Motivo"
          tip="Por que esta homologação está sendo aberta agora. Ajuda a Qualidade a priorizar: fornecedor alternativo para item que já falta é mais urgente que estudo de produto novo."
          ch={<Sel value={form.motivo} onChange={e=>setF("motivo",e.target.value)}><option>Produto novo</option><option>Novo fornecedor</option><option>Fornecedor alternativo</option><option>Alteração de origem/fabricante</option><option>Outro</option></Sel>} />
        <F lbl="Responsável pelo acompanhamento"
          tip="Quem cobra o fornecedor pelos documentos e acompanha até a decisão. Não é quem aprova — a aprovação é feita por outra pessoa, por segregação de funções."
          ch={<Sel value={form.responsavel} onChange={e=>setF("responsavel",e.target.value)}><option value="">Selecione...</option>{users.filter(u=>u.name).map(u=><option key={u.id||u.uid}>{u.name}</option>)}</Sel>} />
        <F lbl="Prazo desejado"
          tip="Quando você precisa da decisão. É uma expectativa para a Qualidade se organizar, não um compromisso automático."
          ch={<Inp type="date" value={form.prazo} onChange={e=>setF("prazo",e.target.value)} />} />
      </div>
      <F lbl="Finalidade / uso pretendido *" err={errForm("finalidade")}
        tip="Onde este item vai ser usado e em qual produto/processo. É o que permite avaliar o risco: o mesmo insumo pode ser aceitável num produto e não em outro."
        ch={<TA rows={3} value={form.finalidade} onChange={e=>setF("finalidade",e.target.value)} placeholder="Ex.: Matéria-prima para o Calcivitam D3 cápsulas, substituindo o fornecedor atual por falta de entrega." />} />
      <F lbl="Observações iniciais"
        tip="Qualquer contexto que ajude quem vai analisar: histórico com o fornecedor, urgência, amostras já recebidas."
        ch={<TA rows={2} value={form.observacoes} onChange={e=>setF("observacoes",e.target.value)} />} />
    </div>
    <div style={s.card}><SecTitle icon="📄" ch={`O que será exigido do fornecedor (${(form.documentos||[]).length})`} />
      <NotaQuemPreenche ch={<>Esta lista é definida pela categoria <b>{form.categoria}</b> — você não precisa preencher nada aqui. A Qualidade marca cada item como recebido, reprovado ou não aplicável durante a análise.</>} />
      <ChecklistPreview itens={form.documentos} obrigatoriedade vazio="Selecione uma categoria para ver os documentos exigidos." />
    </div>
    <div style={s.card}><SecTitle icon="🔬" ch={`O que será avaliado tecnicamente (${(form.checklistTecnico||[]).length})`} />
      <NotaQuemPreenche ch="Os critérios técnicos também vêm da categoria e são avaliados pela Qualidade no parecer. Se algum ponto específico precisar de atenção, escreva em Observações iniciais." />
      <ChecklistPreview itens={form.checklistTecnico} vazio="Selecione uma categoria para ver os critérios técnicos." />
    </div>
    <div style={s.card}><SecTitle icon="📎" ch="Evidências iniciais (opcional)" />
      <NotaQuemPreenche ch="Se você já tem algo do fornecedor em mãos — ficha técnica, certificado, proposta — anexe aqui para adiantar a análise." />
      <AnexosUpload anexos={form.anexos||[]} setAnexos={v=>setForm(p=>({...p,anexos:typeof v==="function"?v(p.anexos||[]):v}))} inputId="homologacao-anexos-form" />
    </div>
    <div style={{ display:"flex", gap:8, justifyContent:"flex-end", alignItems:"center", paddingBottom:20 }}>
      {mostrarErros && errosForm.length>0 && <span style={{ fontSize:11, color:"#ff4f6a" }}>Faltam {errosForm.length} {errosForm.length===1?"item":"itens"}</span>}
      <button style={s.btn} disabled={salvando} onClick={()=>persistir(false)}>Salvar rascunho</button>
      <button style={s.btnA} disabled={salvando} onClick={()=>persistir(true)}>{salvando?"Salvando...":"Enviar para análise →"}</button>
    </div>
  </div>;

  if (view === "detalhe" && sel) {
    const efetivo = statusEfetivo(sel);
    const analisesLigadas = analises.filter(a => String(a.materialId||"") === String(sel.materialId||""));
    const podeEditar = sel.status==="Rascunho" && (user.role==="admin" || String(sel.criadoPorId)===String(user.id||user.uid));
    return <div>
      <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:16, flexWrap:"wrap" }}><button style={s.btn} onClick={()=>{setView("lista");setSel(null);}}>← Voltar</button><div style={{fontSize:18,fontWeight:700}}>{sel.num} — {sel.itemNome}</div><BadgeStatus status={efetivo}/><div style={{marginLeft:"auto",display:"flex",gap:8}}>
        {podeEditar&&<button style={s.btn} onClick={()=>editar(sel)}>Editar rascunho</button>}
        {sel.status==="Em análise"&&perm("avaliarHomologacao")&&<button style={s.btnA} onClick={()=>prepararParecer(sel)}>Emitir parecer técnico</button>}
        {sel.status==="Aguardando aprovação"&&perm("aprovarHomologacao")&&<button style={s.btnA} onClick={()=>prepararDecisao(sel)}>Registrar decisão final</button>}
        {FINALIZADOS.has(sel.status)&&<button style={s.btnA} onClick={()=>exportarPDF(sel)}>Gerar relatório PDF</button>}
      </div></div>
      <div style={s.card}><SecTitle icon="📋" ch="Identificação" /><div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:10}}>
        <Campo label="Fornecedor" value={sel.fornecedorNome}/><Campo label="Item" value={sel.itemNome}/><Campo label="Código / categoria" value={[sel.codigoItem,sel.categoria].filter(Boolean).join(" · ")}/>
        <Campo label="Fabricante / unidade" value={[sel.fabricante,sel.unidadeFabricante].filter(Boolean).join(" · ")}/><Campo label="Criticidade" value={sel.criticidade}/><Campo label="Solicitante" value={`${sel.criadoPor} · ${fmt(sel.criadoEm)}`}/>
        <Campo label="Finalidade" value={sel.finalidade} amplo/><Campo label="Observações" value={sel.observacoes} amplo/>
      </div></div>
      {analisesLigadas.length>0&&<div style={s.card}><SecTitle icon="🧪" ch={`Análises de CQ vinculáveis (${analisesLigadas.length})`} /><div style={{fontSize:11,color:T.text3,marginBottom:8}}>Encontradas pelo mesmo material cadastrado no CQ.</div>{analisesLigadas.slice(0,8).map(a=><div key={a.id} style={{padding:"7px 10px",borderBottom:`1px solid ${T.border}`,fontSize:12}}><b>{a.num}</b> · Lote {a.lote||"—"} · {a.conclusao||"Em análise"} · {fmt(a.dataAnalise)}</div>)}</div>}
      <div style={s.card}><SecTitle icon="📄" ch="Avaliação documental" />{(sel.documentos||[]).map((d,i)=><div key={i} style={{display:"grid",gridTemplateColumns:"2fr 140px 120px 2fr",gap:8,padding:"7px 0",borderBottom:`1px solid ${T.border}`,fontSize:12}}><span>{d.item}{d.obrigatorio?" *":""}</span><span>{d.situacao}</span><span>{d.validade?fmt(d.validade):"—"}</span><span style={{color:T.text3}}>{d.obs||"—"}</span></div>)}</div>
      <div style={s.card}><SecTitle icon="🔬" ch="Avaliação técnica" />{(sel.checklistTecnico||[]).map((d,i)=><div key={i} style={{display:"grid",gridTemplateColumns:"2fr 140px 2fr",gap:8,padding:"7px 0",borderBottom:`1px solid ${T.border}`,fontSize:12}}><span>{d.item}</span><span>{d.resultado||"Pendente"}</span><span style={{color:T.text3}}>{d.obs||"—"}</span></div>)}</div>
      {(sel.anexos||[]).length>0&&<div style={s.card}><SecTitle icon="📎" ch={`Evidências (${sel.anexos.length})`} /><AnexosUpload anexos={sel.anexos} setAnexos={()=>{}} bloqueado podeRemover={false} inputId="homologacao-anexos-detalhe" /></div>}
      {sel.parecerTecnico&&<div style={s.card}><SecTitle icon="✍️" ch="Parecer técnico assinado" /><Campo label="Recomendação" value={sel.parecerTecnico.decisao}/><Campo label="Conclusão" value={sel.parecerTecnico.conclusao}/><Campo label="Assinatura" value={assinaturaResumo(sel.parecerTecnico.assinatura)}/></div>}
      {sel.decisaoFinal&&<div style={{...s.card,border:`1px solid ${(STATUS_HOMOLOGACAO[sel.status]||{}).cor||T.border}`}}><SecTitle icon="✅" ch="Decisão final" /><Campo label="Decisão" value={sel.status}/><Campo label="Validade" value={sel.decisaoFinal.validade?fmt(sel.decisaoFinal.validade):"Não aplicável"}/><Campo label="Condições" value={sel.decisaoFinal.condicoes}/><Campo label="Conclusão" value={sel.decisaoFinal.conclusao}/><Campo label="Assinatura" value={assinaturaResumo(sel.decisaoFinal.assinatura)}/></div>}
      <div style={s.card}><SecTitle icon="🕘" ch="Histórico" />{[...(sel.historico||[])].reverse().map((h,i)=><div key={i} style={{fontSize:11,padding:"6px 0",borderBottom:`1px solid ${T.border}`,color:T.text2}}>{new Date(h.data).toLocaleString("pt-BR")} · <b>{h.acao}</b> · {h.por}</div>)}</div>
      {user.role==="admin"&&sel.status==="Rascunho"&&<button style={s.btnD} onClick={()=>excluirRascunho(sel)}>Excluir rascunho</button>}

      {parecerModal&&<div style={{position:"fixed",inset:0,zIndex:1200,background:"rgba(0,0,0,.82)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}><div style={{background:T.card2,border:`1px solid ${T.border2}`,borderRadius:16,padding:22,width:"min(1000px,96vw)",maxHeight:"92vh",overflowY:"auto"}}>
        <h3 style={{marginTop:0}}>Parecer técnico — {sel.num}</h3>
        {mostrarErrosParecer && errosParecer.length>0 && (
          <div style={{ background:"#ff4f6a14", border:"1px solid #ff4f6a55", borderRadius:10, padding:"11px 14px", marginBottom:14, fontSize:12, color:T.text2 }}>
            <b style={{ color:"#ff4f6a" }}>Faltam {errosParecer.length} {errosParecer.length===1?"item":"itens"} na avaliação.</b> As linhas pendentes estão destacadas. Para reprovar sem concluir tudo, escolha a recomendação <b>Desfavorável</b>.
          </div>
        )}
        <SecTitle icon="📄" ch="Documentos" />
        <div style={{fontSize:11,color:T.text3,marginBottom:10}}>Marque o que o fornecedor entregou. "Reprovado" e "Não aplicável" precisam de justificativa na observação.</div>
        {parecerModal.documentos.map((d,i)=>{const err=errParecerLinha(d.id);return <div key={d.id||i} style={{marginBottom:7,padding:err?"6px 8px":undefined,borderRadius:8,background:err?"#ff4f6a10":undefined,border:err?"1px solid #ff4f6a55":"1px solid transparent"}}>
          <div style={{display:"grid",gridTemplateColumns:"2fr 150px 140px 2fr",gap:8,alignItems:"center"}}><span style={{fontSize:12}}>{d.item}{d.obrigatorio?<b style={{color:T.red}}> *</b>:""}</span><Sel value={d.situacao} onChange={e=>setParecerModal(p=>({...p,documentos:p.documentos.map((x,j)=>j===i?{...x,situacao:e.target.value}:x)}))}><option>Pendente</option><option>Recebido</option><option>Não aplicável</option><option>Reprovado</option></Sel><Inp type="date" title="Validade do documento, quando houver" value={d.validade||""} onChange={e=>setParecerModal(p=>({...p,documentos:p.documentos.map((x,j)=>j===i?{...x,validade:e.target.value}:x)}))}/><Inp value={d.obs||""} placeholder={["Reprovado","Não aplicável"].includes(d.situacao)?"Justificativa obrigatória":"Observação"} onChange={e=>setParecerModal(p=>({...p,documentos:p.documentos.map((x,j)=>j===i?{...x,obs:e.target.value}:x)}))}/></div>
          {err&&<div style={{fontSize:11,color:"#ff4f6a",marginTop:4}}>⚠ {err}</div>}
        </div>;})}
        <SecTitle icon="🔬" ch="Checklist técnico" />
        <div style={{fontSize:11,color:T.text3,marginBottom:10}}>Todo item precisa de um resultado. "Não conforme" e "Não aplicável" precisam de justificativa.</div>
        {parecerModal.checklistTecnico.map((d,i)=>{const err=errParecerLinha(d.id);return <div key={d.id||i} style={{marginBottom:7,padding:err?"6px 8px":undefined,borderRadius:8,background:err?"#ff4f6a10":undefined,border:err?"1px solid #ff4f6a55":"1px solid transparent"}}>
          <div style={{display:"grid",gridTemplateColumns:"2fr 160px 2fr",gap:8,alignItems:"center"}}><span style={{fontSize:12}}>{d.item}</span><Sel value={d.resultado} onChange={e=>setParecerModal(p=>({...p,checklistTecnico:p.checklistTecnico.map((x,j)=>j===i?{...x,resultado:e.target.value}:x)}))}><option value="">Pendente</option><option>Conforme</option><option>Não conforme</option><option>Não aplicável</option></Sel><Inp value={d.obs||""} placeholder={["Não conforme","Não aplicável"].includes(d.resultado)?"Justificativa obrigatória":"Observação / evidência"} onChange={e=>setParecerModal(p=>({...p,checklistTecnico:p.checklistTecnico.map((x,j)=>j===i?{...x,obs:e.target.value}:x)}))}/></div>
          {err&&<div style={{fontSize:11,color:"#ff4f6a",marginTop:4}}>⚠ {err}</div>}
        </div>;})}
        <SecTitle icon="📎" ch="Evidências adicionais" /><AnexosUpload anexos={parecerModal.anexos} setAnexos={v=>setParecerModal(p=>({...p,anexos:typeof v==="function"?v(p.anexos):v}))} inputId="homologacao-anexos-parecer" />
        <F lbl="Recomendação técnica *" err={mostrarErrosParecer&&!parecerModal.decisao?"Selecione a recomendação técnica.":""}
          tip="Favorável: pode ser homologado. Favorável com ressalvas: pode ser usado, mas com condições que o aprovador vai registrar. Desfavorável: não deve ser homologado — esta opção dispensa concluir o checklist."
          ch={<Sel value={parecerModal.decisao} onChange={e=>setParecerModal(p=>({...p,decisao:e.target.value}))}><option value="">Selecione...</option><option>Favorável</option><option>Favorável com ressalvas</option><option>Desfavorável</option></Sel>}/>
        <F lbl="Conclusão técnica *" err={mostrarErrosParecer&&!String(parecerModal.conclusao||"").trim()?"Registre a conclusão do parecer.":""}
          tip="Resuma o que sustenta a recomendação. É este texto que sai no relatório em PDF e que a inspeção lê."
          ch={<TA rows={4} value={parecerModal.conclusao} onChange={e=>setParecerModal(p=>({...p,conclusao:e.target.value}))}/>} />
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",alignItems:"center"}}>{mostrarErrosParecer&&faltaNoParecer&&<span style={{fontSize:11,color:"#ff4f6a"}}>Revise os itens destacados</span>}<button style={s.btn} onClick={()=>setParecerModal(null)}>Cancelar</button><button style={s.btnA} onClick={solicitarAssinaturaParecer}>Assinar parecer →</button></div>
      </div></div>}

      {decisaoModal&&<div style={{position:"fixed",inset:0,zIndex:1200,background:"rgba(0,0,0,.82)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}><div style={{background:T.card2,border:`1px solid ${T.border2}`,borderRadius:16,padding:22,width:"min(620px,96vw)"}}><h3 style={{marginTop:0}}>Decisão final — {sel.num}</h3>
        <F lbl="Decisão *"
          tip="Homologada: aprovado sem restrição. Condicional: aprovado só enquanto o fornecedor cumprir as condições que você escrever abaixo. Reprovada: não pode ser usado."
          ch={<Sel value={decisaoModal.decisao} onChange={e=>setDecisaoModal(p=>({...p,decisao:e.target.value}))}><option>Homologada</option><option>Condicional</option><option>Reprovada</option></Sel>}/>
        {decisaoModal.decisao!=="Reprovada"&&<F lbl="Validade *" err={errDecisao("validade")}
          tip="Data em que a homologação deixa de valer. Passada essa data o registro aparece como Vencida na lista e precisa de nova avaliação."
          ch={<Inp type="date" value={decisaoModal.validade} onChange={e=>setDecisaoModal(p=>({...p,validade:e.target.value}))}/>}/>}
        <F lbl={decisaoModal.decisao==="Condicional"?"Condições / restrições *":"Condições / restrições"} err={errDecisao("condicoes")}
          tip="O que o fornecedor precisa cumprir para continuar homologado. Ex.: enviar certificado de análise a cada lote; reavaliar após 3 entregas conformes."
          ch={<TA rows={3} value={decisaoModal.condicoes} onChange={e=>setDecisaoModal(p=>({...p,condicoes:e.target.value}))}/>}/>
        <F lbl="Conclusão final *" err={errDecisao("conclusao")}
          tip="A justificativa da decisão. Sai assinada no relatório em PDF — é o registro que comprova que a aprovação foi analisada, não automática."
          ch={<TA rows={4} value={decisaoModal.conclusao} onChange={e=>setDecisaoModal(p=>({...p,conclusao:e.target.value}))}/>}/>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",alignItems:"center"}}>{mostrarErrosDecisao&&errosDecisao.length>0&&<span style={{fontSize:11,color:"#ff4f6a"}}>Faltam {errosDecisao.length} {errosDecisao.length===1?"item":"itens"}</span>}<button style={s.btn} onClick={()=>setDecisaoModal(null)}>Cancelar</button><button style={s.btnA} onClick={solicitarAssinaturaFinal}>Assinar decisão →</button></div>
      </div></div>}
      {assinaturaCtx&&<AssinaturaModal user={user} titulo={assinaturaCtx.tipo==="parecer"?`Parecer técnico — ${sel.num}`:`Decisão final — ${sel.num}`} contexto={`HOMOLOGACAO|${sel.num}|${assinaturaCtx.tipo}`} papel={assinaturaCtx.tipo==="parecer"?"Parecerista técnico":"Aprovador da homologação"} docId={sel.id} onClose={()=>setAssinaturaCtx(null)} onConfirm={assinaturaCtx.tipo==="parecer"?confirmarParecer:confirmarDecisao}/>}
    </div>;
  }

  const contagem = status => homologacoes.filter(h=>statusEfetivo(h)===status).length;
  return <div>
    <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:14,flexWrap:"wrap"}}><Inp value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar número, fornecedor ou item..." sx={{flex:1,minWidth:240}}/><Sel value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)} sx={{width:210}}><option value="">Todos os status</option>{[...Object.keys(STATUS_HOMOLOGACAO),"Vencida"].map(x=><option key={x}>{x}</option>)}</Sel>{perm("criarHomologacao")&&<button style={s.btnA} onClick={abrirNovo}>+ Nova Homologação</button>}</div>
    <div className="kpi-grid" style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:14}}>{[["Total",homologacoes.length,T.text2],["Em análise",contagem("Em análise"),"#4fc3f7"],["Aguardando",contagem("Aguardando aprovação"),"#ffb300"],["Homologadas",contagem("Homologada"),"#2ab84a"],["Vencidas",contagem("Vencida"),"#ff4f6a"]].map(([l,n,c])=><div key={l} style={{...s.card,textAlign:"center",padding:12}}><div style={{fontSize:22,fontWeight:700,color:c}}>{n}</div><div style={{fontSize:10,color:T.text3}}>{l}</div></div>)}</div>
    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr style={{background:T.surf}}>{["Número","Fornecedor","Item / escopo","Categoria","Criticidade","Status","Atualização"].map(h=><th key={h} style={{padding:"10px 12px",fontSize:10,textAlign:"left",color:T.text3,textTransform:"uppercase",borderBottom:`1px solid ${T.border}`}}>{h}</th>)}</tr></thead><tbody>{filtradas.map(h=><tr key={h.id} onClick={()=>{setSel(h);setView("detalhe");}} style={{cursor:"pointer",borderBottom:`1px solid ${T.border}`}}><td style={{padding:"10px 12px",fontSize:12,fontWeight:700,color:T.accent}}>{h.num}</td><td style={{padding:"10px 12px",fontSize:12}}>{h.fornecedorNome}</td><td style={{padding:"10px 12px",fontSize:12}}><b>{h.itemNome}</b><div style={{fontSize:10,color:T.text3,marginTop:2}}>{h.finalidade}</div></td><td style={{padding:"10px 12px",fontSize:11}}>{h.categoria}</td><td style={{padding:"10px 12px",fontSize:11}}>{h.criticidade}</td><td style={{padding:"10px 12px"}}><BadgeStatus status={statusEfetivo(h)}/></td><td style={{padding:"10px 12px",fontSize:11,color:T.text3}}>{fmt(h.atualizadoEm||h.criadoEm)}</td></tr>)}{filtradas.length===0&&<tr><td colSpan={7} style={{padding:"3rem",textAlign:"center",color:T.text3}}>Nenhuma homologação encontrada.</td></tr>}</tbody></table></div>
  </div>;
}

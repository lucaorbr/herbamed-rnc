import React, { useState, useEffect } from "react";
import { saveCollection, deleteFromCollection, subscribeCollection } from "../../firebase";
import { useTheme } from "../../core/theme";
import { fmt, sigCodigo, tod } from "../../core/utils";
import { uploadToCloudinary } from "../rnc/RncTabs";
import { useS } from "../../shared/styles";
import { usePagination } from "../../shared/ui";
import { F, G2, G3, Inp, Pagination, SecTitle, Sel, TA } from "../../shared/ui";
import { AssinaturaModal } from "../pdf/pdfExports";

export function QuillEditor({ value, onChange, placeholder, minHeight = 400 }) {
  const T = useTheme();
  const containerRef = React.useRef(null);
  const quillRef = React.useRef(null);
  const onChangeRef = React.useRef(onChange);
  const imgInputRef = React.useRef(null);
  onChangeRef.current = onChange;
  const [showHtml, setShowHtml] = React.useState(false);
  const [htmlInput, setHtmlInput] = React.useState("");
  const [imgUploading, setImgUploading] = React.useState(false);

  const applyHtml = () => {
    if (!htmlInput.trim()) return;
    if (quillRef.current) { quillRef.current.root.innerHTML = htmlInput; onChangeRef.current(htmlInput); }
    setShowHtml(false); setHtmlInput("");
  };

  const handleImageUpload = async (file) => {
    if (!file) return;
    setImgUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      if (quillRef.current && url) {
        const range = quillRef.current.getSelection(true);
        quillRef.current.insertEmbed(range ? range.index : 0, "image", url);
        const html = quillRef.current.root.innerHTML;
        onChangeRef.current(html);
      }
    } catch(e) { alert("Erro ao enviar imagem. Tente novamente."); }
    setImgUploading(false);
  };

  React.useEffect(() => {
    if (!containerRef.current || quillRef.current) return;
    if (!document.getElementById("quill-css")) {
      const link = document.createElement("link");
      link.id = "quill-css"; link.rel = "stylesheet";
      link.href = "https://cdn.jsdelivr.net/npm/quill@2/dist/quill.snow.css";
      document.head.appendChild(link);
    }
    const loadQuill = () => {
      if (window.Quill) { initQuill(); return; }
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/quill@2/dist/quill.js";
      script.onload = initQuill;
      document.head.appendChild(script);
    };
    const initQuill = () => {
      if (!containerRef.current || quillRef.current) return;
      const q = new window.Quill(containerRef.current, {
        theme: "snow",
        placeholder: placeholder || "Digite aqui...",
        modules: {
          toolbar: {
            container: [
              [{ header: [1, 2, 3, false] }],
              [{ size: ["small", false, "large", "huge"] }],
              ["bold", "italic", "underline", "strike"],
              [{ color: [] }, { background: [] }],
              [{ align: [] }],
              [{ list: "ordered" }, { list: "bullet" }, { indent: "-1" }, { indent: "+1" }],
              ["blockquote", "link", "image", "clean"],
            ],
            handlers: {
              image: () => { if (imgInputRef.current) imgInputRef.current.click(); }
            }
          },
        },
      });
      if (value) {
        const isHtml = value.includes("<") && value.includes(">");
        if (isHtml) { q.root.innerHTML = value; } else { q.setText(value); }
      }
      q.on("text-change", () => {
        const html = q.root.innerHTML;
        const empty = ["<p><br></p>","<p></p>",""].includes(html);
        onChangeRef.current(empty ? "" : html);
      });
      quillRef.current = q;
    };
    loadQuill();
    return () => { quillRef.current = null; };
  }, []);

  React.useEffect(() => {
    const q = quillRef.current;
    if (!q) return;
    const currentHtml = q.root.innerHTML;
    const isEmpty = ["<p><br></p>","<p></p>",""].includes(currentHtml);
    const incomingEmpty = !value || value === "";
    if (isEmpty && incomingEmpty) return;
    if (currentHtml !== value && document.activeElement !== q.root) {
      q.root.innerHTML = value || "";
    }
  }, [value]);

  return (
    <div style={{ border:"1px solid "+T.border, borderRadius:8, overflow:"hidden" }}>
      <input ref={imgInputRef} type="file" accept="image/*" style={{ display:"none" }}
        onChange={e=>{ if(e.target.files?.[0]) handleImageUpload(e.target.files[0]); e.target.value=""; }} />
      {imgUploading && <div style={{ padding:"6px 12px", background:T.accentDim, fontSize:11, color:T.accent }}>⏳ Enviando imagem...</div>}
      <style>{`
        .ql-toolbar.ql-snow { background:${T.surf}!important; border:none!important; border-bottom:1px solid ${T.border}!important; padding:6px 8px!important; flex-wrap:wrap!important; }
        .ql-container.ql-snow { background:${T.card}!important; border:none!important; }
        .ql-editor { color:${T.text}!important; font-family:Arial,sans-serif!important; font-size:13px!important; line-height:1.8!important; min-height:${minHeight}px!important; padding:16px 20px!important; }
        .ql-editor.ql-blank::before { color:${T.text3}!important; font-style:normal!important; }
        .ql-snow .ql-stroke { stroke:${T.text2}!important; }
        .ql-snow .ql-fill { fill:${T.text2}!important; }
        .ql-snow .ql-picker-label { color:${T.text2}!important; }
        .ql-snow .ql-picker-options { background:${T.card}!important; border-color:${T.border}!important; z-index:9999!important; }
        .ql-snow .ql-picker-item { color:${T.text}!important; }
        .ql-snow button:hover .ql-stroke, .ql-snow button.ql-active .ql-stroke { stroke:${T.accent}!important; }
        .ql-snow button:hover .ql-fill, .ql-snow button.ql-active .ql-fill { fill:${T.accent}!important; }
        .ql-editor table { border-collapse:collapse; width:100%; margin:10px 0; }
        .ql-editor td, .ql-editor th { border:1px solid ${T.border}; padding:6px 10px; min-width:60px; }
        .ql-editor th { background:${T.surf}; font-weight:bold; }
        .ql-editor blockquote { border-left:3px solid ${T.accent}; padding-left:12px; color:${T.text2}; margin:8px 0; }
        .ql-editor pre { background:${T.surf}; padding:10px 14px; border-radius:6px; font-size:12px; }
        .ql-editor h1 { font-size:20px; font-weight:700; margin:12px 0 6px; }
        .ql-editor h2 { font-size:16px; font-weight:700; margin:10px 0 4px; }
        .ql-editor h3 { font-size:14px; font-weight:700; margin:8px 0 4px; }
        .ql-editor ul, .ql-editor ol { padding-left:20px; margin:6px 0; }
        .ql-editor p { margin:4px 0; }
        .ql-editor img { max-width:100%; height:auto; border-radius:4px; margin:6px 0; }
      `}</style>
      <div ref={containerRef} />
      <div style={{ borderTop:"1px solid "+T.border, padding:"6px 10px", display:"flex", alignItems:"center", justifyContent:"flex-end", background:T.surf }}>
        <button onClick={()=>setShowHtml(v=>!v)} style={{ padding:"3px 10px", borderRadius:6, border:"1px solid "+T.border, background:showHtml?T.accentDim:"transparent", color:showHtml?T.accent:T.text3, cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:600 }}>
          {"</>"} Inserir HTML
        </button>
      </div>
      {showHtml && (
        <div style={{ borderTop:"1px solid "+T.border, padding:"10px 12px", background:T.surf }}>
          <div style={{ fontSize:11, color:T.text2, marginBottom:6 }}>Cole o HTML gerado (ex: wordtohtml.net). O conteúdo atual será <strong>substituído</strong>.</div>
          <textarea value={htmlInput} onChange={e=>setHtmlInput(e.target.value)} placeholder="<table><tr><td>...</td></tr></table>" style={{ width:"100%", minHeight:100, padding:"8px 10px", borderRadius:6, border:"1px solid "+T.border, background:T.card, color:T.text, fontSize:11, fontFamily:"monospace", resize:"vertical", boxSizing:"border-box" }} />
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:8 }}>
            <button onClick={()=>{setShowHtml(false);setHtmlInput("");}} style={{ padding:"5px 12px", borderRadius:6, border:"1px solid "+T.border, background:"transparent", color:T.text2, cursor:"pointer", fontFamily:"inherit", fontSize:11 }}>Cancelar</button>
            <button onClick={applyHtml} style={{ padding:"5px 14px", borderRadius:6, border:"none", background:T.accent, color:"#fff", cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:600 }}>Aplicar HTML ✓</button>
          </div>
        </div>
      )}
    </div>
  );
}

export const HERBAMED_INFO_GD = {
  nome: "Herbamed Laboratório Nutracêutico LTDA",
  cnpj: "14.829.598/0001-30",
  endereco: "Av Irene Meneghetti Longhini, 500, Água do Ayero",
  cidade: "Assis/SP - Brasil",
  cep: "19816-370",
  logo: "https://res.cloudinary.com/dswsg9w0w/image/upload/484237672_1316151256653106_1151541448837719199_n1_zww2li",
};

export const TIPOS_DOC_GD = [
  { id: "PO",  label: "Procedimento Operacional",  icon: "📋", cor: "#2ab84a" },
  { id: "IT",  label: "Instrução de Trabalho",      icon: "🔧", cor: "#4fc3f7" },
  { id: "MOP", label: "Manual Operacional",         icon: "📖", cor: "#a78bfa" },
  { id: "FO",  label: "Formulário",                icon: "📝", cor: "#ffd166" },
  { id: "ESP", label: "Especificação",              icon: "🧪", cor: "#ff8c42" },
  { id: "MAN", label: "Manual",                    icon: "📚", cor: "#ff4f6a" },
  { id: "ANX", label: "Anexo",                     icon: "📎", cor: "#5dd4b0" },
];

export const DEPARTAMENTOS_GD = [
  { id: "SGQ", label: "Sistema de Gestão da Qualidade", cor: "#2ab84a" },
  { id: "CQ",  label: "Controle de Qualidade",          cor: "#4fc3f7" },
  { id: "PRD", label: "Produção",                       cor: "#ffd166" },
  { id: "LOG", label: "Logística",                      cor: "#ff8c42" },
  { id: "RH",  label: "Recursos Humanos",               cor: "#a78bfa" },
  { id: "COM", label: "Comercial",                      cor: "#ff4f6a" },
  { id: "ADM", label: "Administrativo",                 cor: "#5dd4b0" },
  { id: "P&D", label: "Pesquisa e Desenvolvimento",     cor: "#818cf8" },
];

export const STATUS_DOC_GD = {
  "Rascunho":              { c: "#7a9c7e", bg: "#7a9c7e18", icon: "✏️" },
  "Em Revisão":            { c: "#ffd166", bg: "#ffd16618", icon: "🔄" },
  "Aguardando Aprovação":  { c: "#4fc3f7", bg: "#4fc3f718", icon: "⏳" },
  "Vigente":               { c: "#2ab84a", bg: "#2ab84a18", icon: "✅" },
  "Obsoleto":              { c: "#ff4f6a", bg: "#ff4f6a18", icon: "🗄️" },
};

export const CAPITULOS_GD = [
  { id: "objetivo",         label: "1. Objetivo",                   placeholder: "Descreva o propósito deste documento..." },
  { id: "alcance",          label: "2. Alcance",                    placeholder: "Onde e a quem este documento se aplica..." },
  { id: "responsabilidades",label: "3. Responsabilidades",          placeholder: "Quem é responsável pelo quê..." },
  { id: "definicoes",       label: "4. Definições",                 placeholder: "Termos técnicos e abreviações usados..." },
  { id: "procedimento",     label: "5. Procedimento",               placeholder: "Descrição detalhada do processo..." },
  { id: "infComplementares",label: "6. Informações Complementares", placeholder: "Informações adicionais relevantes..." },
  { id: "referencias",      label: "7. Referências",                placeholder: "Normas, legislações e documentos relacionados..." },
  { id: "registros",        label: "8. Registros",                  placeholder: "Registros gerados por este procedimento..." },
  { id: "anexos",           label: "9. Anexos",                     placeholder: "Lista de anexos vinculados..." },
  { id: "historicoRevisoes", label: "10. Histórico de Revisões",    placeholder: "", special: true },
];

export function gerarCodigoGD(tipo, depto, docs) {
  const prefix = `${tipo}-${depto}`;
  const existentes = docs.filter(d => d.codigo && d.codigo.startsWith(prefix)).length;
  return `${prefix}-${String(existentes + 1).padStart(3, "0")}`;
}

export function calcProximaRevisaoGD(dataBase) {
  if (!dataBase) return null;
  const d = new Date(dataBase + "T12:00:00");
  d.setFullYear(d.getFullYear() + 3);
  return d.toISOString().split("T")[0];
}

export function diasParaRevisaoGD(proximaRevisao) {
  if (!proximaRevisao) return null;
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const rev  = new Date(proximaRevisao + "T12:00:00");
  return Math.ceil((rev - hoje) / 86400000);
}

export function BadgeStatusGD({ status }) {
  const T = useTheme();
  const m = STATUS_DOC_GD[status] || STATUS_DOC_GD["Rascunho"];
  return (
    <span style={{ padding:"3px 10px", borderRadius:20, fontSize:10, fontWeight:700, background:m.bg, color:m.c, whiteSpace:"nowrap" }}>
      {m.icon} {status}
    </span>
  );
}

export function BadgeTipoGD({ tipo }) {
  const m = TIPOS_DOC_GD.find(t => t.id === tipo) || TIPOS_DOC_GD[0];
  return (
    <span style={{ padding:"3px 10px", borderRadius:6, fontSize:10, fontWeight:700, background:m.cor+"20", color:m.cor }}>
      {m.icon} {m.id}
    </span>
  );
}

export function AlertaRevisaoGD({ doc }) {
  const dias = diasParaRevisaoGD(doc.proximaRevisao);
  if (!dias || dias > 90) return null;
  const vencido = dias <= 0;
  return (
    <span style={{ fontSize:10, padding:"2px 8px", borderRadius:12,
      background: vencido ? "#ff4f6a18" : "#ffd16618",
      color: vencido ? "#ff4f6a" : "#ffd166", fontWeight:700 }}>
      {vencido ? `⚠️ Vencido há ${Math.abs(dias)}d` : `⏰ Rev. em ${dias}d`}
    </span>
  );
}

export function GestaoDocumentosTab({ user, toast_, users, auditLog, perm }) {
  const T = useTheme();
  const s = useS();

  const [docs,      setDocs]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [view,      setView]      = useState("lista");
  const [sel,       setSel]       = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [buscaTxt,  setBuscaTxt]  = useState("");
  const [filtroTipo,   setFiltroTipo]   = useState("todos");
  const [filtroDepto,  setFiltroDepto]  = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [treinamentos, setTreinamentos] = useState([]);
  const [novoTreino,   setNovoTreino]   = useState({ userId:"", dataRealizacao:tod(), obs:"" });
  const [capituloAtivo, setCapituloAtivo] = useState("objetivo");
  const [verSnapshot, setVerSnapshot] = useState(null);
  const [assinarGD, setAssinarGD] = useState(null);
  const [novoMat, setNovoMat] = useState("");
  const entradaVazia = { versao:"", data:tod(), motivo:"", descricao:"", responsavel:user?.name||"", aprovador:"" };
  const [novaEntrada, setNovaEntrada] = useState(entradaVazia);
  const [editEntradaIdx, setEditEntradaIdx] = useState(null);
  const setE = (k,v) => setNovaEntrada(p=>({...p,[k]:v}));

  const formVazio = {
    tipo:"PO", depto:"SGQ", titulo:"", versao:"01",
    objetivo:"", alcance:"", responsabilidades:"", definicoes:"",
    procedimento:"", infComplementares:"N/A", referencias:"", registros:"", anexos:"N/A",
    etapas:[], materiais:[], obs:"", treinamentoObrigatorio:false, proximaRevisao:"",
    historicoRevisoes:[],
  };
  const [form, setForm] = useState(formVazio);
  const setF = (k,v) => setForm(p => ({...p,[k]:v}));
  const resetForm = () => { setForm(formVazio); setCapituloAtivo("objetivo"); };

  const isAdmin  = ["admin","keyuser","rt"].includes(user?.role) || (perm && (perm("criarDocumento")||perm("excluirDocumento")));
  const isViewer = user?.role === "viewer" && !(perm && perm("criarDocumento"));

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 3000);
    const unsub = subscribeCollection("gestao_docs", list => {
      clearTimeout(t);
      setDocs(list.sort((a,b) => (b.criadoTs||0)-(a.criadoTs||0)));
      setLoading(false);
    });
    return () => { clearTimeout(t); unsub && unsub(); };
  }, []);

  useEffect(() => {
    if (!sel) return;
    const unsub = subscribeCollection(`gestao_docs/${sel.id}/treinos`, list => {
      setTreinamentos(list.sort((a,b) => (b.ts||0)-(a.ts||0)));
    });
    return () => unsub && unsub();
  }, [sel?.id]);

  const salvar = async () => {
    try {
    if (!form.titulo.trim()) { alert("Informe o título."); return; }
    const id  = sel ? sel.id : Date.now();
    const codigo = sel ? sel.codigo : gerarCodigoGD(form.tipo, form.depto, docs);
    const proximaRevisao = sel?.proximaRevisao || calcProximaRevisaoGD(tod());
    let status = sel?.status || "Rascunho";
    const doc = {
      id, codigo, ...form, status, proximaRevisao,
      criadoEm:  sel?.criadoEm  || tod(),
      criadoTs:  sel?.criadoTs  || Date.now(),
      criadoPor: sel?.criadoPor || user?.name,
      atualizadoEm: tod(), atualizadoTs: Date.now(), atualizadoPor: user?.name,
      assinaturaElaborador: sel?.assinaturaElaborador || null,
      assinaturaRevisor:    sel?.assinaturaRevisor    || null,
      assinaturaAprovador:  sel?.assinaturaAprovador  || null,
      historicoRevisoes:    form.historicoRevisoes?.length ? form.historicoRevisoes : (sel?.historicoRevisoes || []),
    };
    await saveCollection("gestao_docs", String(id), doc);
    await auditLog(sel ? "Editou Documento" : "Criou Documento", "gestao_docs", id, `${codigo} — ${form.titulo}`, sel || null, doc);
    toast_(sel ? `${codigo} atualizado!` : `${codigo} criado!`, "green");
    setSel(doc); setView("detalhe");
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const confirmarAssinatura = async (doc, papel, assin) => {
    try {
    const campo = papel==="elaborador" ? "assinaturaElaborador" : papel==="revisor" ? "assinaturaRevisor" : "assinaturaAprovador";
    // papelLabel é o significado da assinatura (não o cargo do assinante).
    const papelLabel = papel==="elaborador" ? "Elaborador" : papel==="revisor" ? "Revisor" : "Aprovador";
    // Segregação de funções: o mesmo usuário não pode assinar mais de um papel no mesmo documento.
    const conflito = ["assinaturaElaborador","assinaturaRevisor","assinaturaAprovador"].find(k => k!==campo && doc[k] && ((doc[k].email && assin.email && doc[k].email===assin.email) || (!doc[k].email && doc[k].nome===assin.nome)));
    if (conflito) {
      const papelConf = conflito==="assinaturaElaborador"?"Elaborador":conflito==="assinaturaRevisor"?"Revisor":"Aprovador";
      alert(`Segregação de funções: você já assinou este documento como ${papelConf}.\n\nElaboração, revisão e aprovação devem ser feitas por pessoas diferentes.`);
      setAssinarGD(null);
      return;
    }
    const updated = { ...doc, [campo]: { ...assin, cargo:assin.cargo||user?.cargo||"", email:assin.email||user?.email||"", crf:assin.crf||user?.crf||"", dataHora:assin.dataHora||`${assin.data} ${assin.hora}`, timestamp:assin.timestamp } };
    const temE = papel==="elaborador" || !!doc.assinaturaElaborador;
    const temR = papel==="revisor"    || !!doc.assinaturaRevisor;
    const temA = papel==="aprovador"  || !!doc.assinaturaAprovador;
    if (temE && temR && temA) updated.status = "Vigente";
    else if (temE && temR)    updated.status = "Aguardando Aprovação";
    else if (temE)            updated.status = "Em Revisão";
    await saveCollection("gestao_docs", String(doc.id), updated);
    await auditLog(`Assinou como ${papelLabel}`, "gestao_docs", doc.id, `${doc.codigo} — ${doc.titulo}`, null, { status: updated.status, [campo]: updated[campo] });
    toast_(`Assinado como ${papelLabel}!`, "green");
    setSel(updated);
    setAssinarGD(null);
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
      setAssinarGD(null);
    }
  };

  const solicitarRevisao = async (doc) => {
    try {
    if (!window.confirm("Criar nova revisão? A versão atual será arquivada no histórico.")) return;
    const versaoAtual = doc.versao || "01";
    const novaVersao  = String(parseInt(versaoAtual,10)+1).padStart(2,"0");
    const motivo      = window.prompt("Motivo da revisão:", "") || "";
    const descricao   = window.prompt("Descrição das alterações realizadas:", "") || "";
    const aprovador   = window.prompt("Aprovador desta revisão:", "") || "";
    // Snapshot do conteúdo completo da versão que está sendo arquivada (rastreabilidade BPF).
    const snapshotConteudo = { titulo: doc.titulo, etapas: doc.etapas||[], materiais: doc.materiais||[] };
    CAPITULOS_GD.filter(c=>!c.special).forEach(c=>{ snapshotConteudo[c.id] = doc[c.id] ?? ""; });
    const historico   = [...(doc.historicoRevisoes||[]), {
      versao: versaoAtual,
      status: doc.status,
      data:   doc.atualizadoEm||doc.criadoEm,
      responsavel: doc.atualizadoPor||doc.criadoPor,
      motivo,
      descricao,
      aprovador,
      conteudo: snapshotConteudo,
    }];
    const updated = { ...doc, versao:novaVersao, status:"Em Revisão", assinaturaElaborador:null, assinaturaRevisor:null, assinaturaAprovador:null, historicoRevisoes:historico, proximaRevisao:calcProximaRevisaoGD(tod()), atualizadoEm:tod(), atualizadoTs:Date.now(), atualizadoPor:user?.name };
    await saveCollection("gestao_docs", String(doc.id), updated);
    await auditLog(`Nova Revisão — Rev.${novaVersao}`, "gestao_docs", doc.id, `${doc.codigo} — ${doc.titulo}`, { versao: versaoAtual, status: doc.status }, { versao: novaVersao, status: "Em Revisão" });
    toast_(`Revisão ${novaVersao} iniciada!`, "green");
    setSel(updated);
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const tornarObsoleto = async (doc) => {
    try {
    if (!window.confirm("Marcar como Obsoleto?")) return;
    const updated = { ...doc, status:"Obsoleto", atualizadoEm:tod(), atualizadoTs:Date.now(), atualizadoPor:user?.name };
    await saveCollection("gestao_docs", String(doc.id), updated);
    await auditLog("Marcou como Obsoleto", "gestao_docs", doc.id, `${doc.codigo} — ${doc.titulo}`, { status: doc.status }, { status: "Obsoleto" });
    toast_("Documento obsoleto.", "red");
    setSel(updated);
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const deletar = async (id) => {
    try {
    const doc = docs.find(x => String(x.id) === String(id)) || sel;
    // Documento controlado: só rascunho nunca assinado pode ser apagado.
    // Qualquer documento que já teve assinatura ou ficou Vigente é arquivado como Obsoleto, nunca excluído.
    const jaAssinado = !!(doc?.assinaturaElaborador || doc?.assinaturaRevisor || doc?.assinaturaAprovador);
    if (doc?.status !== "Rascunho" || jaAssinado) {
      alert("Documento controlado não pode ser excluído.\n\nDocumentos já assinados ou que entraram em vigência devem ser arquivados como Obsoleto (botão 🗄️), preservando a rastreabilidade exigida em BPF.");
      return;
    }
    if (!window.confirm("Excluir este rascunho permanentemente? Esta ação não pode ser desfeita.")) return;
    await deleteFromCollection("gestao_docs", String(id));
    await auditLog("Excluiu Rascunho", "gestao_docs", id, doc?.codigo ? `${doc.codigo} — ${doc.titulo}` : String(id), doc || null, null);
    toast_("Rascunho excluído.", "red");
    setSel(null); setView("lista");
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const salvarTreino = async () => {
    try {
    if (!novoTreino.userId) { alert("Selecione o colaborador."); return; }
    const u = users?.find(x => x.id===novoTreino.userId);
    const t = { id:Date.now(), userId:novoTreino.userId, userName:u?.name||"—", userSetor:u?.setor||"—", dataRealizacao:novoTreino.dataRealizacao, obs:novoTreino.obs, registradoPor:user?.name, ts:Date.now() };
    await saveCollection(`gestao_docs/${sel.id}/treinos`, String(t.id), t);
    await auditLog("Registrou Treinamento", "gestao_docs", sel.id, `${sel.codigo} — ${sel.titulo}`, null, { colaborador: t.userName, data: t.dataRealizacao });
    toast_("Treinamento registrado!", "green");
    setNovoTreino({ userId:"", dataRealizacao:tod(), obs:"" });
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const gerarComIA = async () => {
    if (!form.titulo || !form.tipo) { alert("Preencha título e tipo antes de usar a IA."); return; }
    setAiLoading(true);
    try {
      const tipoLabel  = TIPOS_DOC_GD.find(t=>t.id===form.tipo)?.label || form.tipo;
      const deptoLabel = DEPARTAMENTOS_GD.find(d=>d.id===form.depto)?.label || form.depto;
      const prompt = `Você é especialista em qualidade farmacêutica (BPF, ANVISA RDC 658/2022, ISO 9001). Crie conteúdo completo para:\nTipo: ${tipoLabel}\nTítulo: ${form.titulo}\nDepartamento: ${deptoLabel}\nEmpresa: Herbamed Laboratório Nutracêutico LTDA\n\nResponda APENAS em JSON válido sem markdown:\n{"objetivo":"","alcance":"","responsabilidades":"","definicoes":"","procedimento":"","infComplementares":"","referencias":"","registros":"","etapas":[{"titulo":"","descricao":""}],"materiais":[""],"treinamentoObrigatorio":true}`;
      const res  = await fetch("/api/claude", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ model:"claude-sonnet-4-5", max_tokens:3000, messages:[{role:"user",content:prompt}] }) });
      const data = await res.json();
      const txt  = data.content?.[0]?.text || "";
      const parsed = JSON.parse(txt.replace(/```json|```/g,"").trim());
      setForm(f => ({ ...f, objetivo:parsed.objetivo||f.objetivo, alcance:parsed.alcance||f.alcance, responsabilidades:parsed.responsabilidades||f.responsabilidades, definicoes:parsed.definicoes||f.definicoes, procedimento:parsed.procedimento||f.procedimento, infComplementares:parsed.infComplementares||f.infComplementares, referencias:parsed.referencias||f.referencias, registros:parsed.registros||f.registros, materiais:parsed.materiais||f.materiais, etapas:(parsed.etapas||[]).map((e,i)=>({id:Date.now()+i,...e})), treinamentoObrigatorio:parsed.treinamentoObrigatorio??f.treinamentoObrigatorio }));
      toast_("Conteúdo gerado pela IA!", "green");
    } catch(e) { toast_("Erro ao gerar com IA.", "red"); }
    setAiLoading(false);
  };

  const exportPDF = (doc) => {
    const tipo  = TIPOS_DOC_GD.find(t=>t.id===doc.tipo);
    const cor   = tipo?.cor || "#2ab84a";
    const assHTML = (ass,label) => ass
      ? `<div style="padding:10px 12px;border:1px solid ${cor}40;border-radius:8px;background:#fafdfb;"><div style="font-size:8px;letter-spacing:.08em;color:${cor};text-transform:uppercase;font-weight:bold;margin-bottom:6px;">${label}</div><div style="font-size:12px;font-weight:bold;color:#1a3a28;">${ass.nome||"—"}</div>${ass.cargo?`<div style="font-size:10px;color:#555;">${ass.cargo}</div>`:""}${ass.setor?`<div style="font-size:9px;color:#777;">Setor: ${ass.setor}</div>`:""}${(ass.registroProfissional||ass.crf)?`<div style="font-size:9px;color:#777;">Registro profissional: ${ass.registroProfissional||ass.crf}</div>`:""}${ass.email?`<div style="font-size:9px;color:#777;">${ass.email}</div>`:""}<div style="margin-top:6px;padding-top:6px;border-top:1px dashed ${cor}40;font-size:9px;color:#555;">✔ Assinado eletronicamente em ${ass.timestamp?new Date(ass.timestamp).toLocaleString("pt-BR"):ass.dataHora||""}</div><div style="font-size:8px;color:#999;margin-top:3px;font-family:monospace;">Cód. verificação: ${sigCodigo(ass, `${doc.codigo}|R${doc.versao}`)}</div>${ass.hash?`<div style="font-size:7px;color:#aaa;margin-top:2px;font-family:monospace;">Hash: ${String(ass.hash).slice(0,24)}...</div>`:""}</div>`
      : `<div style="text-align:center;padding:10px;border:1px dashed #ddd;border-radius:6px;background:#fafafa;"><div style="font-size:9px;color:#888;text-transform:uppercase;">${label}</div><div style="font-size:11px;color:#ccc;padding:8px 0;">Aguardando</div></div>`;
    const caps = CAPITULOS_GD.filter(cap=>!cap.special).map(cap => `<div style="padding:8px 0;border-bottom:1px solid #f0f0f0;"><div style="font-size:9px;color:${cor};text-transform:uppercase;font-weight:bold;margin-bottom:4px;">${cap.label}</div><div style="font-size:11px;color:#333;line-height:1.7;white-space:pre-wrap;">${doc[cap.id]||"N/A"}</div></div>`).join("");
    const html = `<div style="font-family:Arial,sans-serif;max-width:800px;margin:0 auto;background:#fff;"><div style="background:linear-gradient(135deg,#1a4a2e,${cor});padding:14px 22px;display:flex;align-items:center;justify-content:space-between;"><div style="display:flex;align-items:center;gap:12px;"><img src="${HERBAMED_INFO_GD.logo}" style="width:40px;height:40px;border-radius:6px;object-fit:cover;"/><div><div style="color:#fff;font-size:13px;font-weight:bold;">${HERBAMED_INFO_GD.nome}</div><div style="color:#9fd4b2;font-size:10px;">CNPJ: ${HERBAMED_INFO_GD.cnpj}</div></div></div><div style="text-align:right;"><div style="color:#fff;font-size:12px;font-weight:bold;">${tipo?.label||doc.tipo}</div><div style="color:#9fd4b2;font-size:11px;">${doc.codigo} · Rev.${doc.versao}</div></div></div><div style="padding:12px 22px;border-bottom:2px solid ${cor}20;background:#f9fdf9;"><div style="font-size:15px;font-weight:bold;color:#1a4a2e;margin-bottom:4px;">${doc.titulo}</div><div style="font-size:11px;color:#666;">Departamento: ${doc.depto} · Elaborado: ${fmt(doc.criadoEm)} · Próx. revisão: ${fmt(doc.proximaRevisao)}</div></div><div style="padding:0 22px;">${caps}</div><div style="padding:14px 22px;border-top:2px solid ${cor}30;"><div style="font-size:9px;color:${cor};text-transform:uppercase;font-weight:bold;margin-bottom:8px;">Assinaturas</div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">${assHTML(doc.assinaturaElaborador,"Elaborador")}${assHTML(doc.assinaturaRevisor,"Revisor")}${assHTML(doc.assinaturaAprovador,"Aprovador")}</div></div><div style="padding:6px 22px;border-top:1px solid #eee;display:flex;justify-content:space-between;font-size:9px;color:#999;"><span>${HERBAMED_INFO_GD.nome}</span><span>Impresso em ${new Date().toLocaleString("pt-BR")} · CÓPIA NÃO CONTROLADA</span></div></div>`;
    const win = window.open("","_blank");
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${doc.codigo}</title><style>@media print{body{margin:0}}</style></head><body>${html}<script>window.onload=()=>window.print();<\/script></body></html>`);
    win.document.close();
  };

  const filtrados = docs.filter(d => {
    if (filtroTipo   !== "todos" && d.tipo   !== filtroTipo)   return false;
    if (filtroDepto  !== "todos" && d.depto  !== filtroDepto)  return false;
    if (filtroStatus !== "todos" && d.status !== filtroStatus) return false;
    if (buscaTxt && !`${d.codigo||""} ${d.titulo||""}`.toLowerCase().includes(buscaTxt.toLowerCase())) return false;
    return true;
  });
  const {paginated:_gds,page:_pgGD,total:_totGD,setPage:_setPgGD} = usePagination(filtrados, 20);

  const totalVigente  = docs.filter(d=>d.status==="Vigente").length;
  const totalRevisao  = docs.filter(d=>["Em Revisão","Aguardando Aprovação"].includes(d.status)).length;
  const totalVencendo = docs.filter(d=>{ const dias=diasParaRevisaoGD(d.proximaRevisao); return dias!==null&&dias<=90&&d.status==="Vigente"; }).length;
  const totalObsoleto = docs.filter(d=>d.status==="Obsoleto").length;

  /* ── DETALHE ── */
  if (view==="detalhe" && sel) {
    const d = docs.find(x=>x.id===sel.id)||sel;
    const tipo  = TIPOS_DOC_GD.find(t=>t.id===d.tipo);
    const depto = DEPARTAMENTOS_GD.find(x=>x.id===d.depto);
    const diasRev = diasParaRevisaoGD(d.proximaRevisao);
    const mesmoAssinante = (ass) => !!ass && ((ass.email && user?.email && ass.email===user.email) || (!ass.email && ass.nome===user?.name));
    const podeAssElab  = !d.assinaturaElaborador && (isAdmin || d.criadoPor===user?.name);
    const podeAssRev   = d.assinaturaElaborador && !d.assinaturaRevisor && isAdmin && !mesmoAssinante(d.assinaturaElaborador);
    const podeAssAprov = d.assinaturaRevisor && !d.assinaturaAprovador && isAdmin && !mesmoAssinante(d.assinaturaElaborador) && !mesmoAssinante(d.assinaturaRevisor);
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
          <button style={s.btn} onClick={()=>setView("lista")}>← Voltar</button>
          <div style={{flex:1}}>
            <div style={{fontSize:11,color:T.text3}}>{d.codigo} · Rev.{d.versao}</div>
            <div style={{fontSize:16,fontWeight:700,color:T.text}}>{d.titulo}</div>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {podeAssElab  && <button style={{...s.btnA,fontSize:11}} onClick={()=>setAssinarGD({doc:d,papel:"elaborador"})}>✍️ Elaborador</button>}
            {podeAssRev   && <button style={{...s.btnA,fontSize:11,background:T.blue||"#4fc3f7"}} onClick={()=>setAssinarGD({doc:d,papel:"revisor"})}>🔎 Revisor</button>}
            {podeAssAprov && <button style={{...s.btnA,fontSize:11,background:T.orange||"#ff9800"}} onClick={()=>setAssinarGD({doc:d,papel:"aprovador"})}>✅ Aprovador</button>}
            {isAdmin && d.status==="Vigente" && <button style={{...s.btn,fontSize:11}} onClick={()=>solicitarRevisao(d)}>🔄 Nova Revisão</button>}
            {isAdmin && d.status==="Vigente" && <button style={{...s.btnD,fontSize:11}} onClick={()=>tornarObsoleto(d)}>🗄️ Obsoleto</button>}
            <button style={{...s.btn,fontSize:11}} onClick={()=>exportPDF(d)}>🖨️ PDF</button>
            {!isViewer && <button style={{...s.btn,fontSize:11}} onClick={()=>{ setSel(d); setForm({tipo:d.tipo,depto:d.depto,titulo:d.titulo,versao:d.versao,objetivo:d.objetivo||"",alcance:d.alcance||"",responsabilidades:d.responsabilidades||"",definicoes:d.definicoes||"",procedimento:d.procedimento||"",infComplementares:d.infComplementares||"N/A",referencias:d.referencias||"",registros:d.registros||"",anexos:d.anexos||"N/A",etapas:d.etapas||[],materiais:d.materiais||[],obs:d.obs||"",treinamentoObrigatorio:d.treinamentoObrigatorio||false,proximaRevisao:d.proximaRevisao||"",historicoRevisoes:d.historicoRevisoes||[]}); setView("novo"); }}>✏️ Editar</button>}
            {isAdmin && d.status==="Rascunho" && !d.assinaturaElaborador && !d.assinaturaRevisor && !d.assinaturaAprovador && <button style={{...s.btnD,fontSize:11}} onClick={()=>deletar(d.id)}>🗑️ Excluir rascunho</button>}
          </div>
        </div>
        {diasRev!==null && diasRev<=90 && d.status==="Vigente" && (
          <div style={{background:diasRev<=0?"#ff4f6a18":"#ffd16618",border:`1px solid ${diasRev<=0?"#ff4f6a":"#ffd166"}30`,borderRadius:10,padding:"10px 16px",marginBottom:12,fontSize:12,color:diasRev<=0?"#ff4f6a":"#ffd166",fontWeight:600}}>
            {diasRev<=0?`⚠️ Revisão vencida há ${Math.abs(diasRev)} dias!`:`⏰ Revisão necessária em ${diasRev} dias (${fmt(d.proximaRevisao)})`}
          </div>
        )}
        <div style={s.card}>
          <SecTitle icon="🗂️" ch="Identificação" />
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,marginBottom:12}}>
            {[["Código",d.codigo],["Versão",`Rev.${d.versao}`],["Tipo",tipo?.label||d.tipo],["Departamento",depto?.label||d.depto],["Elaborado por",d.criadoPor],["Data",fmt(d.criadoEm)],["Próx. revisão",fmt(d.proximaRevisao)],["Atualizado",fmt(d.atualizadoEm)]].map(([k,v])=>(
              <div key={k} style={{background:T.surf,borderRadius:8,padding:"8px 12px"}}>
                <div style={{fontSize:10,color:T.text3,fontWeight:700,textTransform:"uppercase",marginBottom:2}}>{k}</div>
                <div style={{fontSize:12,color:T.text,fontWeight:600}}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <BadgeTipoGD tipo={d.tipo} />
            <BadgeStatusGD status={d.status} />
            {d.treinamentoObrigatorio && <span style={{fontSize:10,padding:"3px 10px",borderRadius:20,background:(T.blue||"#4fc3f7")+"20",color:T.blue||"#4fc3f7",fontWeight:700}}>📚 Treinamento Obrigatório</span>}
          </div>
        </div>
        {d.materiais?.length>0 && (
          <div style={s.card}>
            <SecTitle icon="🧪" ch="Materiais e Equipamentos" />
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {d.materiais.map((m,i)=><span key={i} style={{fontSize:12,padding:"4px 12px",borderRadius:20,background:T.surf,border:`1px solid ${T.border}`,color:T.text}}>{m}</span>)}
            </div>
          </div>
        )}
        <div style={s.card}>
          <SecTitle icon="📑" ch="Conteúdo do Documento" />
          {CAPITULOS_GD.filter(cap=>!cap.special).map(cap=>(
            <div key={cap.id} style={{marginBottom:14}}>
              <div style={{fontSize:11,color:T.accent,fontWeight:700,textTransform:"uppercase",letterSpacing:".05em",marginBottom:5}}>{cap.label}</div>
              <div style={{padding:"10px 14px",background:T.surf,border:`1px solid ${T.border}`,borderRadius:8,fontSize:13,color:d[cap.id]&&d[cap.id]!=="N/A"?T.text:T.text3,lineHeight:1.7,fontStyle:(!d[cap.id]||d[cap.id]==="N/A")?"italic":"normal"}}
                dangerouslySetInnerHTML={{__html: d[cap.id]||"<em>N/A</em>"}} />
            </div>
          ))}
        </div>
        {d.etapas?.length>0 && (
          <div style={s.card}>
            <SecTitle icon="📋" ch="Etapas Detalhadas" />
            {d.etapas.map((e,i)=>(
              <div key={e.id||i} style={{display:"flex",gap:12,marginBottom:10,alignItems:"flex-start"}}>
                <div style={{width:28,height:28,borderRadius:"50%",background:T.accent,color:"#fff",fontSize:12,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{i+1}</div>
                <div style={{flex:1,background:T.surf,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 12px"}}>
                  {e.titulo&&<div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:3}}>{e.titulo}</div>}
                  <div style={{fontSize:12,color:T.text2,lineHeight:1.6}}>{e.descricao}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={s.card}>
          <SecTitle icon="✍️" ch="Assinaturas" />
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
            {[{campo:d.assinaturaElaborador,label:"Elaborador"},{campo:d.assinaturaRevisor,label:"Revisor"},{campo:d.assinaturaAprovador,label:"Aprovador"}].map(({campo,label})=>(
              <div key={label} style={{textAlign:"center",padding:"1rem",background:T.surf,borderRadius:10,border:`1px solid ${T.border}`}}>
                <div style={{fontSize:10,fontWeight:700,color:T.text3,textTransform:"uppercase",marginBottom:10}}>{label}</div>
                {campo?(<>
                  <div style={{fontSize:13,fontWeight:700,color:T.text}}>{campo.nome}</div>
                  {campo.cargo&&<div style={{fontSize:11,color:T.text2}}>{campo.cargo}</div>}
                  {(campo.registroProfissional||campo.crf)&&<div style={{fontSize:10,color:T.text3}}>Registro profissional: {campo.registroProfissional||campo.crf}</div>}
                  <div style={{fontSize:10,color:T.accent,marginTop:8,paddingTop:8,borderTop:`1px dashed ${T.border}`}}>✔ Assinado eletronicamente</div>
                  <div style={{fontSize:10,color:T.text2}}>{campo.timestamp?new Date(campo.timestamp).toLocaleString("pt-BR"):campo.dataHora}</div>
                  <div style={{fontSize:9,color:T.text3,marginTop:3,fontFamily:"monospace"}}>Cód.: {sigCodigo(campo, `${d.codigo}|R${d.versao}`)}</div>
                </>):(
                  <div style={{fontSize:12,color:T.text3,padding:"1rem 0"}}>Aguardando</div>
                )}
              </div>
            ))}
          </div>
        </div>
        {(d.historicoRevisoes?.length>0) && (
          <div style={s.card}>
            <SecTitle icon="🕐" ch="Histórico de Revisões" />
            <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead><tr style={{background:T.surf}}>
                {["Versão","Data","Motivo","Descrição das alterações","Responsável","Aprovador","Status","Conteúdo"].map(h=><th key={h} style={{padding:"8px 10px",textAlign:"left",color:T.text3,fontWeight:700,fontSize:10,textTransform:"uppercase",borderBottom:`1px solid ${T.border}`,whiteSpace:"nowrap"}}>{h}</th>)}
              </tr></thead>
              <tbody>
                {d.historicoRevisoes.map((h,i)=>(
                  <tr key={i} style={{borderBottom:`1px solid ${T.border}`,background:i%2===0?T.bg:T.surf}}>
                    <td style={{padding:"8px 10px",color:T.text,fontWeight:600,whiteSpace:"nowrap"}}>Rev.{h.versao}</td>
                    <td style={{padding:"8px 10px",color:T.text2,whiteSpace:"nowrap"}}>{fmt(h.data)}</td>
                    <td style={{padding:"8px 10px",color:T.text2,maxWidth:140}}>{h.motivo||"—"}</td>
                    <td style={{padding:"8px 10px",color:T.text,maxWidth:280,lineHeight:1.5}}>{h.descricao||"—"}</td>
                    <td style={{padding:"8px 10px",color:T.text2,whiteSpace:"nowrap"}}>{h.responsavel||"—"}</td>
                    <td style={{padding:"8px 10px",color:T.text2,whiteSpace:"nowrap"}}>{h.aprovador||"—"}</td>
                    <td style={{padding:"8px 10px"}}>{h.status?<BadgeStatusGD status={h.status}/>:<span style={{color:T.text3,fontSize:11}}>—</span>}</td>
                    <td style={{padding:"8px 10px",whiteSpace:"nowrap"}}>{h.conteudo ? <button style={{...s.btn,fontSize:10,padding:"3px 8px"}} onClick={()=>setVerSnapshot(h)}>👁️ Ver conteúdo</button> : <span style={{color:T.text3,fontSize:10}}>indisponível</span>}</td>
                  </tr>
                ))}
                <tr style={{background:T.accentDim}}>
                  <td style={{padding:"8px 10px",color:T.accent,fontWeight:700,whiteSpace:"nowrap"}}>Rev.{d.versao} (atual)</td>
                  <td style={{padding:"8px 10px",color:T.text2,whiteSpace:"nowrap"}}>{fmt(d.atualizadoEm)}</td>
                  <td style={{padding:"8px 10px",color:T.text3}} colSpan={3}>—</td>
                  <td style={{padding:"8px 10px",color:T.text2,whiteSpace:"nowrap"}}>{d.atualizadoPor}</td>
                  <td style={{padding:"8px 10px"}}><BadgeStatusGD status={d.status}/></td>
                  <td style={{padding:"8px 10px",color:T.text3,fontSize:10}}>(versão atual abaixo)</td>
                </tr>
              </tbody>
            </table>
            </div>
          </div>
        )}
        {verSnapshot && (
          <div onClick={()=>setVerSnapshot(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",zIndex:9999,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"40px 16px",overflowY:"auto"}}>
            <div onClick={e=>e.stopPropagation()} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:12,maxWidth:760,width:"100%",padding:"1.5rem",boxShadow:"0 20px 60px rgba(0,0,0,.4)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <div style={{fontSize:15,fontWeight:700,color:T.text}}>📄 Conteúdo arquivado — Rev.{verSnapshot.versao}</div>
                <button style={{...s.btn,fontSize:11}} onClick={()=>setVerSnapshot(null)}>✕ Fechar</button>
              </div>
              <div style={{fontSize:11,color:T.text3,marginBottom:16}}>{fmt(verSnapshot.data)} · {verSnapshot.responsavel||"—"}{verSnapshot.conteudo?.titulo?` · ${verSnapshot.conteudo.titulo}`:""}</div>
              {verSnapshot.conteudo ? (<>
                {CAPITULOS_GD.filter(cap=>!cap.special).map(cap=>(
                  <div key={cap.id} style={{marginBottom:14}}>
                    <div style={{fontSize:11,color:T.accent,fontWeight:700,textTransform:"uppercase",letterSpacing:".05em",marginBottom:5}}>{cap.label}</div>
                    <div style={{padding:"10px 14px",background:T.surf,border:`1px solid ${T.border}`,borderRadius:8,fontSize:13,color:T.text,lineHeight:1.7}}
                      dangerouslySetInnerHTML={{__html: verSnapshot.conteudo[cap.id]||"<em>N/A</em>"}} />
                  </div>
                ))}
                {verSnapshot.conteudo.etapas?.length>0 && (
                  <div style={{marginBottom:14}}>
                    <div style={{fontSize:11,color:T.accent,fontWeight:700,textTransform:"uppercase",letterSpacing:".05em",marginBottom:5}}>Etapas</div>
                    {verSnapshot.conteudo.etapas.map((e,i)=>(
                      <div key={e.id||i} style={{display:"flex",gap:10,marginBottom:8,alignItems:"flex-start"}}>
                        <div style={{width:24,height:24,borderRadius:"50%",background:T.accent,color:"#fff",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{i+1}</div>
                        <div style={{flex:1,background:T.surf,border:`1px solid ${T.border}`,borderRadius:8,padding:"6px 10px"}}>
                          {e.titulo&&<div style={{fontSize:12,fontWeight:600,color:T.text,marginBottom:2}}>{e.titulo}</div>}
                          <div style={{fontSize:12,color:T.text2,lineHeight:1.6}}>{typeof e==="string"?e:e.descricao}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {verSnapshot.conteudo.materiais?.length>0 && (
                  <div style={{marginBottom:4}}>
                    <div style={{fontSize:11,color:T.accent,fontWeight:700,textTransform:"uppercase",letterSpacing:".05em",marginBottom:5}}>Materiais</div>
                    <ul style={{margin:0,paddingLeft:18,fontSize:13,color:T.text,lineHeight:1.7}}>
                      {verSnapshot.conteudo.materiais.map((m,i)=><li key={i}>{typeof m==="string"?m:(m?.nome||m?.descricao||JSON.stringify(m))}</li>)}
                    </ul>
                  </div>
                )}
              </>) : (
                <div style={{padding:"14px",background:T.surf,borderRadius:8,fontSize:13,color:T.text3,lineHeight:1.6}}>
                  Esta revisão foi arquivada antes da atualização que passou a guardar o conteúdo completo. Apenas os metadados (motivo, descrição, responsável) estão disponíveis.
                </div>
              )}
            </div>
          </div>
        )}
        {assinarGD && (
          <AssinaturaModal
            user={user}
            titulo={`${assinarGD.doc.codigo} · Rev.${assinarGD.doc.versao} — assinatura como ${assinarGD.papel==="elaborador"?"Elaborador":assinarGD.papel==="revisor"?"Revisor":"Aprovador"}`}
            contexto={`${assinarGD.doc.codigo}|R${assinarGD.doc.versao}`}
            papel={assinarGD.papel==="elaborador"?"Elaborador":assinarGD.papel==="revisor"?"Revisor":"Aprovador"}
            onClose={()=>setAssinarGD(null)}
            onConfirm={(assin)=>confirmarAssinatura(assinarGD.doc, assinarGD.papel, assin)}
          />
        )}
        {d.treinamentoObrigatorio && (
          <div style={s.card}>
            <SecTitle icon="📚" ch="Controle de Treinamentos" />
            <div style={{background:T.accentDim,border:`1px solid ${T.accent}25`,borderRadius:8,padding:"8px 14px",marginBottom:12,fontSize:12,color:T.accent}}>
              📋 Este documento requer treinamento formal dos colaboradores antes da execução.
            </div>
            {isAdmin && (
              <div style={{background:T.surf,border:`1px solid ${T.border}`,borderRadius:10,padding:"1rem",marginBottom:12}}>
                <div style={{fontSize:12,fontWeight:700,color:T.text,marginBottom:10}}>Registrar novo treinamento</div>
                <G2 ch={<>
                  <F lbl="Colaborador" ch={<Sel value={novoTreino.userId} onChange={e=>setNovoTreino(p=>({...p,userId:e.target.value}))}><option value="">Selecione...</option>{(users||[]).map(u=><option key={u.id} value={u.id}>{u.name} — {u.setor}</option>)}</Sel>} />
                  <F lbl="Data do treinamento" ch={<Inp type="date" value={novoTreino.dataRealizacao} onChange={e=>setNovoTreino(p=>({...p,dataRealizacao:e.target.value}))} />} />
                </>} />
                <F lbl="Observações" ch={<Inp placeholder="Ex: treinamento presencial..." value={novoTreino.obs} onChange={e=>setNovoTreino(p=>({...p,obs:e.target.value}))} />} />
                <div style={{textAlign:"right",marginTop:8}}><button style={s.btnA} onClick={salvarTreino}>Registrar ✓</button></div>
              </div>
            )}
            {treinamentos.length===0 ? (
              <div style={{textAlign:"center",padding:"1.5rem",color:T.text3,fontSize:12}}>Nenhum treinamento registrado.</div>
            ) : treinamentos.map(t=>(
              <div key={t.id} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 12px",background:T.surf,border:`1px solid ${T.border}`,borderRadius:8,marginBottom:6}}>
                <div style={{width:32,height:32,borderRadius:"50%",background:T.accent,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>📚</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600,color:T.text}}>{t.userName}</div>
                  <div style={{fontSize:11,color:T.text2}}>{t.userSetor} · {fmt(t.dataRealizacao)}</div>
                  {t.obs&&<div style={{fontSize:11,color:T.text3,marginTop:2}}>{t.obs}</div>}
                </div>
                <span style={{fontSize:10,color:T.accent,background:T.accentDim,padding:"2px 8px",borderRadius:12,fontWeight:700}}>✓ Treinado</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ── FORMULÁRIO ── */
  if (view==="novo") {
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
          <button style={s.btn} onClick={()=>{ if(sel)setView("detalhe"); else{setView("lista");resetForm();} }}>← Voltar</button>
          <h2 style={{fontSize:18,fontWeight:700,color:T.text,margin:0}}>{sel?`Editar — ${sel.codigo}`:"Novo Documento"}</h2>
        </div>
        <div style={{background:`linear-gradient(135deg,${T.accentDim},${T.card2})`,border:`1px solid ${T.accent}33`,borderRadius:14,padding:"1rem",marginBottom:"1rem",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:36,height:36,borderRadius:8,background:`linear-gradient(135deg,${T.accent},${T.accent2})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🤖</div>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:T.text}}>Assistente IA — Gerador de Documentos</div>
              <div style={{fontSize:11,color:T.text2}}>Gere conteúdo com IA ou importe um arquivo Word existente</div>
            </div>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <label style={{...s.btn,fontSize:11,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6,opacity:aiLoading?.6:1}}>
              📄 Importar Word
              <input type="file" accept=".docx" style={{display:"none"}} disabled={aiLoading}
                onChange={async(e)=>{
                  const file=e.target.files?.[0]; e.target.value="";
                  if(!file) return;
                  if(!form.tipo||!form.depto){alert("Selecione o tipo e departamento antes de importar.");return;}
                  setAiLoading(true);
                  try{
                    if(!window.mammoth){
                      await new Promise((res,rej)=>{
                        const s=document.createElement("script");
                        s.src="https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js";
                        s.onload=res;s.onerror=rej;document.head.appendChild(s);
                      });
                    }
                    const buf=await file.arrayBuffer();
                    const result=await window.mammoth.convertToHtml({arrayBuffer:buf});
                    const docHtml=result.value;
                    const tipoLabel=TIPOS_DOC_GD.find(t=>t.id===form.tipo)?.label||form.tipo;
                    const caps=CAPITULOS_GD.filter(c=>!c.special);
                    const capIds=caps.map(c=>c.id).join(", ");
                    const res=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},
                      body:JSON.stringify({model:"claude-sonnet-4-5",max_tokens:6000,
                        messages:[{role:"user",content:`Você é especialista em qualidade farmacêutica (BPF, ANVISA). O HTML abaixo é um documento Word convertido para ${tipoLabel}.

Distribua o conteúdo pelos capítulos: ${capIds}.
Mantenha a formatação HTML (tabelas, listas, negrito, etc).
Se um capítulo não existir no documento, coloque N/A.

Responda APENAS neste formato com delimitadores exatos (sem texto antes ou depois):
<objetivo>html aqui</objetivo>
<alcance>html aqui</alcance>
<responsabilidades>html aqui</responsabilidades>
<definicoes>html aqui</definicoes>
<procedimento>html aqui</procedimento>
<infComplementares>html aqui</infComplementares>
<referencias>html aqui</referencias>
<registros>html aqui</registros>
<anexos>html aqui</anexos>

Documento:
${docHtml.slice(0,9000)}`}]})
                    });
                    const data=await res.json();
                    const txt=data.content?.[0]?.text||"";
                    // Parse XML-style delimiters — muito mais robusto que JSON com HTML embutido
                    let imported=0;
                    caps.forEach(cap=>{
                      const re=new RegExp(`<${cap.id}>([\\s\\S]*?)<\\/${cap.id}>`,"i");
                      const m=txt.match(re);
                      if(m&&m[1]&&m[1].trim()&&m[1].trim()!=="N/A"){
                        setF(cap.id,m[1].trim());
                        imported++;
                      }
                    });
                    if(imported===0) throw new Error("Nenhum capítulo extraído. Verifique o arquivo.");
                    if(!form.titulo&&file.name) setF("titulo",file.name.replace(".docx","").replace(/_/g," "));
                    toast_(`Documento importado! ${imported} capítulo(s) preenchido(s).`,"green");
                  }catch(e){console.error(e);toast_("Erro ao importar: "+e.message,"red");}
                  setAiLoading(false);
                }}
              />
            </label>
            <button style={{...s.btnA,opacity:aiLoading?.6:1,fontSize:11}} onClick={gerarComIA} disabled={aiLoading}>
              {aiLoading?<><span style={{animation:"spin 1s linear infinite",display:"inline-block"}}>⟳</span> Aguarde...</>:"🤖 Gerar com IA"}
            </button>
          </div>
        </div>
        <div style={s.card}>
          <SecTitle icon="🗂️" ch="Identificação" />
          <G3 ch={<>
            <F lbl="Tipo" ch={<Sel value={form.tipo} onChange={e=>setF("tipo",e.target.value)}>{TIPOS_DOC_GD.map(t=><option key={t.id} value={t.id}>{t.icon} {t.label} ({t.id})</option>)}</Sel>} />
            <F lbl="Departamento" ch={<Sel value={form.depto} onChange={e=>setF("depto",e.target.value)}>{DEPARTAMENTOS_GD.map(d=><option key={d.id} value={d.id}>{d.id} — {d.label}</option>)}</Sel>} />
            <F lbl="Versão" ch={<Inp placeholder="01" value={form.versao} onChange={e=>setF("versao",e.target.value)} />} />
          </>} />
          <F lbl="Título do documento" ch={<Inp placeholder="Ex: Procedimento de Análise Microbiológica" value={form.titulo} onChange={e=>setF("titulo",e.target.value)} />} />
          {!sel && form.tipo && form.depto && <div style={{background:T.accentDim,border:`1px solid ${T.accent}25`,borderRadius:8,padding:"8px 12px",fontSize:12,color:T.accent,marginTop:4}}>💡 Código: <strong>{gerarCodigoGD(form.tipo,form.depto,docs)}</strong></div>}
          <div style={{display:"flex",alignItems:"center",gap:12,marginTop:10,padding:"10px 14px",background:T.surf,border:`1px solid ${T.border}`,borderRadius:8}}>
            <input type="checkbox" id="treino-gd" checked={form.treinamentoObrigatorio} onChange={e=>setF("treinamentoObrigatorio",e.target.checked)} style={{width:16,height:16,accentColor:T.accent}} />
            <label htmlFor="treino-gd" style={{fontSize:13,color:T.text,cursor:"pointer"}}>Treinamento obrigatório antes da execução</label>
          </div>
        </div>
        <div style={s.card}>
          <SecTitle icon="🧪" ch="Materiais e Equipamentos" />
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <Inp placeholder="Ex: Balança analítica, Pipeta..." value={novoMat} onChange={e=>setNovoMat(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();if(novoMat.trim()){setF("materiais",[...form.materiais,novoMat.trim()]);setNovoMat("");}}}} style={{flex:1}} />
            <button style={s.btnA} onClick={()=>{if(novoMat.trim()){setF("materiais",[...form.materiais,novoMat.trim()]);setNovoMat("");}}}>+ Add</button>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {form.materiais.map((m,i)=>(
              <span key={i} style={{fontSize:12,padding:"4px 10px",borderRadius:20,background:T.surf,border:`1px solid ${T.border}`,color:T.text,display:"flex",alignItems:"center",gap:6}}>
                {m}<button onClick={()=>setF("materiais",form.materiais.filter((_,idx)=>idx!==i))} style={{background:"none",border:"none",color:T.text3,cursor:"pointer",fontSize:12,padding:0}}>×</button>
              </span>
            ))}
          </div>
        </div>
        <div style={s.card}>
          <SecTitle icon="📑" ch="Capítulos Obrigatórios" />
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
            {CAPITULOS_GD.map(cap=>(
              <button key={cap.id} onClick={()=>setCapituloAtivo(cap.id)}
                style={{padding:"5px 12px",borderRadius:20,fontSize:11,fontWeight:600,border:`1px solid ${capituloAtivo===cap.id?T.accent:T.border}`,background:capituloAtivo===cap.id?T.accent:T.surf,color:capituloAtivo===cap.id?"#fff":( cap.special ? (form[cap.id]?.length>0?T.text:T.text3) : (form[cap.id]&&form[cap.id]!=="N/A"?T.text:T.text3) ),cursor:"pointer"}}>
                {(cap.special ? form[cap.id]?.length>0 : (form[cap.id]&&form[cap.id]!=="N/A"))?"✓ ":""}{cap.label.replace(/^\d+\.\s/,"")}
              </button>
            ))}
          </div>
          {CAPITULOS_GD.map(cap=>capituloAtivo===cap.id&&(
            <div key={cap.id}>
              <div style={{fontSize:12,fontWeight:700,color:T.accent,marginBottom:8}}>{cap.label}</div>
              {cap.special ? (
                /* ── Histórico de Revisões — UI estruturada ── */
                <div>
                  {/* Formulário de nova entrada */}
                  <div style={{background:T.surf,border:`1px solid ${T.border}`,borderRadius:10,padding:"1rem",marginBottom:14}}>
                    <div style={{fontSize:12,fontWeight:700,color:T.text,marginBottom:10}}>
                      {editEntradaIdx!==null ? "✏️ Editar entrada" : "➕ Nova entrada"}
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10,marginBottom:10}}>
                      <F lbl="Revisão (Rev.)" ch={<Inp placeholder="01" value={novaEntrada.versao} onChange={e=>setE("versao",e.target.value)} />} />
                      <F lbl="Data" ch={<Inp type="date" value={novaEntrada.data} onChange={e=>setE("data",e.target.value)} />} />
                      <F lbl="Responsável" ch={<Inp placeholder="Nome do responsável" value={novaEntrada.responsavel} onChange={e=>setE("responsavel",e.target.value)} />} />
                      <F lbl="Aprovador" ch={<Inp placeholder="Nome do aprovador" value={novaEntrada.aprovador} onChange={e=>setE("aprovador",e.target.value)} />} />
                    </div>
                    <F lbl="Motivo da revisão" ch={<Inp placeholder="Ex: Adequação regulatória, Melhoria de processo, Correção de erro..." value={novaEntrada.motivo} onChange={e=>setE("motivo",e.target.value)} />} />
                    <div style={{marginTop:8}}>
                      <F lbl="Descrição das alterações" ch={<textarea rows={3} placeholder="Descreva detalhadamente o que foi alterado nesta revisão..." value={novaEntrada.descricao} onChange={e=>setE("descricao",e.target.value)} style={{width:"100%",borderRadius:8,border:`1px solid ${T.border}`,padding:"8px 10px",fontSize:12,color:T.text,background:T.bg,resize:"vertical",fontFamily:"inherit",boxSizing:"border-box"}} />} />
                    </div>
                    <div style={{display:"flex",gap:8,marginTop:10}}>
                      <button style={s.btnA} onClick={()=>{
                        if(!novaEntrada.versao.trim()||!novaEntrada.data){alert("Preencha ao menos Revisão e Data.");return;}
                        const entry={...novaEntrada};
                        if(editEntradaIdx!==null){
                          const arr=[...(form.historicoRevisoes||[])];
                          arr[editEntradaIdx]=entry;
                          setF("historicoRevisoes",arr);
                          setEditEntradaIdx(null);
                        } else {
                          setF("historicoRevisoes",[...(form.historicoRevisoes||[]),entry]);
                        }
                        setNovaEntrada(entradaVazia);
                      }}>{editEntradaIdx!==null?"Salvar edição":"Adicionar entrada"}</button>
                      {editEntradaIdx!==null&&<button style={s.btn} onClick={()=>{setEditEntradaIdx(null);setNovaEntrada(entradaVazia);}}>Cancelar</button>}
                    </div>
                  </div>
                  {/* Tabela de entradas */}
                  {(form.historicoRevisoes||[]).length===0 ? (
                    <div style={{fontSize:12,color:T.text3,textAlign:"center",padding:"1rem",background:T.surf,borderRadius:8,border:`1px solid ${T.border}`}}>Nenhuma entrada registrada ainda.</div>
                  ) : (
                    <div style={{overflowX:"auto"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                        <thead><tr style={{background:T.surf}}>
                          {["Rev.","Data","Motivo","Descrição das alterações","Responsável","Aprovador",""].map((h,i)=>(
                            <th key={i} style={{padding:"8px 10px",textAlign:"left",color:T.text3,fontWeight:700,fontSize:10,textTransform:"uppercase",borderBottom:`1px solid ${T.border}`,whiteSpace:"nowrap"}}>{h}</th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {[...(form.historicoRevisoes||[])].map((h,i)=>(
                            <tr key={i} style={{borderBottom:`1px solid ${T.border}`,background:i%2===0?T.bg:T.surf}}>
                              <td style={{padding:"8px 10px",fontWeight:700,color:T.accent,whiteSpace:"nowrap"}}>Rev.{h.versao}</td>
                              <td style={{padding:"8px 10px",color:T.text2,whiteSpace:"nowrap"}}>{fmt(h.data)}</td>
                              <td style={{padding:"8px 10px",color:T.text2,maxWidth:150}}>{h.motivo||"—"}</td>
                              <td style={{padding:"8px 10px",color:T.text,maxWidth:280,lineHeight:1.5}}>{h.descricao||"—"}</td>
                              <td style={{padding:"8px 10px",color:T.text2,whiteSpace:"nowrap"}}>{h.responsavel||"—"}</td>
                              <td style={{padding:"8px 10px",color:T.text2,whiteSpace:"nowrap"}}>{h.aprovador||"—"}</td>
                              <td style={{padding:"8px 10px",whiteSpace:"nowrap"}}>
                                <button style={{...s.btn,fontSize:10,padding:"3px 8px",marginRight:4}} onClick={()=>{setNovaEntrada({...h});setEditEntradaIdx(i);}}>✏️</button>
                                <button style={{...s.btnD,fontSize:10,padding:"3px 8px"}} onClick={()=>{if(confirm("Remover esta entrada?"))setF("historicoRevisoes",(form.historicoRevisoes||[]).filter((_,idx)=>idx!==i));}}>🗑️</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div style={{display:"flex",gap:6,marginTop:12,justifyContent:"flex-end"}}>
                    {CAPITULOS_GD.indexOf(cap)>0&&<button style={{...s.btn,fontSize:11}} onClick={()=>setCapituloAtivo(CAPITULOS_GD[CAPITULOS_GD.indexOf(cap)-1].id)}>← Anterior</button>}
                  </div>
                </div>
              ) : (
              <>
              <QuillEditor value={form[cap.id]||""} onChange={v=>setF(cap.id,v)} placeholder={cap.placeholder} minHeight={400} />
              <div style={{display:"flex",gap:6,marginTop:8,justifyContent:"space-between",flexWrap:"wrap"}}>
                <div style={{display:"flex",gap:6}}>
                  <button style={{...s.btn,fontSize:11,opacity:aiLoading?.6:1}} disabled={aiLoading}
                    onClick={async()=>{
                      const txt=form[cap.id];
                      if(!txt){alert("Escreva algo primeiro.");return;}
                      setAiLoading(true);
                      try{
                        const res=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-5",max_tokens:1500,messages:[{role:"user",content:`Melhore a formatação do texto abaixo para um documento de qualidade farmacêutica (BPF). Use HTML com <p>, <strong>, <ul>, <li>, <ol>. Retorne APENAS o HTML sem markdown ou explicações.

Texto:
${txt}`}]})});
                        const data=await res.json();
                        const html=data.content?.[0]?.text||"";
                        if(html)setF(cap.id,html.replace(/\`\`\`html|\`\`\`/g,"").trim());
                        toast_("Formatação melhorada!","green");
                      }catch(e){toast_("Erro ao formatar.","red");}
                      setAiLoading(false);
                    }}>
                    {aiLoading?"⟳ ...":"✨ Melhorar formatação"}
                  </button>
                  <button style={{...s.btn,fontSize:11,opacity:aiLoading?.6:1}} disabled={aiLoading}
                    onClick={async()=>{
                      if(!form.titulo){alert("Preencha o título do documento.");return;}
                      setAiLoading(true);
                      try{
                        const res=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-5",max_tokens:1500,messages:[{role:"user",content:`Você é especialista em qualidade farmacêutica (BPF, ANVISA). Expanda e aprofunde o seguinte capítulo de um documento:

Documento: ${form.titulo}
Capítulo: ${cap.label}
Conteúdo atual: ${form[cap.id]||"(vazio)"}

Retorne APENAS o HTML expandido com <p>, <strong>, <ul>, <li>, <ol>. Sem markdown.`}]})});
                        const data=await res.json();
                        const html=data.content?.[0]?.text||"";
                        if(html)setF(cap.id,html.replace(/\`\`\`html|\`\`\`/g,"").trim());
                        toast_("Capítulo expandido!","green");
                      }catch(e){toast_("Erro ao expandir.","red");}
                      setAiLoading(false);
                    }}>
                    {aiLoading?"⟳ ...":"🔍 Expandir capítulo"}
                  </button>
                </div>
                <div style={{display:"flex",gap:6}}>
                  {CAPITULOS_GD.indexOf(cap)>0&&<button style={{...s.btn,fontSize:11}} onClick={()=>setCapituloAtivo(CAPITULOS_GD[CAPITULOS_GD.indexOf(cap)-1].id)}>← Anterior</button>}
                  {CAPITULOS_GD.indexOf(cap)<CAPITULOS_GD.length-1&&<button style={{...s.btnA,fontSize:11}} onClick={()=>setCapituloAtivo(CAPITULOS_GD[CAPITULOS_GD.indexOf(cap)+1].id)}>Próximo →</button>}
                </div>
              </div>
              </>
              )}
            </div>
          ))}
        </div>
        <div style={s.card}>
          <SecTitle icon="📋" ch="Etapas Detalhadas (opcional)" />
          {form.etapas.map((e,i)=>(
            <div key={e.id} style={{display:"flex",gap:8,marginBottom:10,alignItems:"flex-start"}}>
              <div style={{width:28,height:28,borderRadius:"50%",background:T.accent,color:"#fff",fontSize:12,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:6}}>{i+1}</div>
              <div style={{flex:1,background:T.surf,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 12px"}}>
                <Inp placeholder="Título da etapa" value={e.titulo} onChange={ev=>setF("etapas",form.etapas.map(x=>x.id===e.id?{...x,titulo:ev.target.value}:x))} style={{marginBottom:6}} />
                <TA rows={2} placeholder="Descrição..." value={e.descricao} onChange={ev=>setF("etapas",form.etapas.map(x=>x.id===e.id?{...x,descricao:ev.target.value}:x))} />
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:4,marginTop:4}}>
                {i>0&&<button style={{...s.btn,padding:"4px 8px",fontSize:11}} onClick={()=>{const arr=[...form.etapas];[arr[i-1],arr[i]]=[arr[i],arr[i-1]];setF("etapas",arr);}}>↑</button>}
                {i<form.etapas.length-1&&<button style={{...s.btn,padding:"4px 8px",fontSize:11}} onClick={()=>{const arr=[...form.etapas];[arr[i],arr[i+1]]=[arr[i+1],arr[i]];setF("etapas",arr);}}>↓</button>}
                <button style={{...s.btnD,padding:"4px 8px",fontSize:11}} onClick={()=>setF("etapas",form.etapas.filter(x=>x.id!==e.id))}>×</button>
              </div>
            </div>
          ))}
          <button style={s.btn} onClick={()=>setF("etapas",[...form.etapas,{id:Date.now(),titulo:"",descricao:""}])}>+ Adicionar etapa</button>
        </div>
        <div style={{textAlign:"right",marginBottom:"2rem"}}>
          <button style={{...s.btn,marginRight:8}} onClick={()=>{if(sel)setView("detalhe");else{setView("lista");resetForm();}}}>Cancelar</button>
          <button style={s.btnA} onClick={salvar}>Salvar documento ✓</button>
        </div>
      </div>
    );
  }

  /* ── ÁRVORE ── */
  if (view==="arvore") {
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
          <button style={s.btn} onClick={()=>setView("lista")}>← Voltar</button>
          <h2 style={{fontSize:18,fontWeight:700,color:T.text,margin:0}}>🌳 Árvore de Documentos</h2>
        </div>
        {DEPARTAMENTOS_GD.map(dep=>{
          const dd = docs.filter(d=>d.depto===dep.id);
          if (!dd.length) return null;
          return (
            <div key={dep.id} style={s.card}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                <div style={{width:10,height:10,borderRadius:"50%",background:dep.cor,flexShrink:0}}/>
                <div style={{fontSize:14,fontWeight:700,color:T.text}}>{dep.id} — {dep.label}</div>
                <span style={{fontSize:11,color:T.text3,background:T.surf,padding:"2px 8px",borderRadius:20,border:`1px solid ${T.border}`}}>{dd.length} doc{dd.length!==1?"s":""}</span>
              </div>
              <div style={{paddingLeft:20,borderLeft:`2px solid ${dep.cor}30`}}>
                {TIPOS_DOC_GD.map(tp=>{
                  const dt = dd.filter(d=>d.tipo===tp.id);
                  if (!dt.length) return null;
                  return (
                    <div key={tp.id} style={{marginBottom:10}}>
                      <div style={{fontSize:12,color:T.text2,fontWeight:600,marginBottom:6}}>{tp.icon} {tp.label}</div>
                      {dt.map(d=>(
                        <div key={d.id} onClick={()=>{setSel(d);setView("detalhe");}} className="rnc-row"
                          style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:T.surf,border:`1px solid ${T.border}`,borderRadius:8,marginBottom:4,cursor:"pointer"}}>
                          <div style={{fontSize:12,fontWeight:700,color:T.accent}}>{d.codigo}</div>
                          <div style={{flex:1,fontSize:12,color:T.text}}>{d.titulo}</div>
                          <BadgeStatusGD status={d.status}/>
                          <AlertaRevisaoGD doc={d}/>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {docs.length===0&&<div style={{textAlign:"center",padding:"3rem",color:T.text3}}><div style={{fontSize:40,marginBottom:12}}>🌳</div><div>Nenhum documento cadastrado.</div></div>}
      </div>
    );
  }

  /* ── LISTA MESTRA ── */
  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10,marginBottom:16}}>
        {[{label:"Vigentes",value:totalVigente,color:T.accent,icon:"✅"},{label:"Em Revisão",value:totalRevisao,color:T.yellow||"#ffd166",icon:"🔄"},{label:"Vencendo (90d)",value:totalVencendo,color:T.orange||"#ff8c42",icon:"⏰"},{label:"Obsoletos",value:totalObsoleto,color:T.red||"#ff4f6a",icon:"🗄️"},{label:"Total",value:docs.length,color:T.text2,icon:"📄"}].map(stat=>(
          <div key={stat.label} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"12px 14px",textAlign:"center"}}>
            <div style={{fontSize:22,marginBottom:4}}>{stat.icon}</div>
            <div style={{fontSize:22,fontWeight:800,color:stat.color}}>{stat.value}</div>
            <div style={{fontSize:10,color:T.text3,fontWeight:600,textTransform:"uppercase"}}>{stat.label}</div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          <div style={{position:"relative"}}>
            <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:T.text3,fontSize:13}}>🔍</span>
            <input placeholder="Buscar código ou título..." value={buscaTxt} onChange={e=>setBuscaTxt(e.target.value)} style={{...s.inp,paddingLeft:30,width:220,fontSize:12}} />
          </div>
          <Sel value={filtroTipo} onChange={e=>setFiltroTipo(e.target.value)}>
            <option value="todos">Todos os tipos</option>
            {TIPOS_DOC_GD.map(t=><option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
          </Sel>
          <Sel value={filtroDepto} onChange={e=>setFiltroDepto(e.target.value)}>
            <option value="todos">Todos os deptos</option>
            {DEPARTAMENTOS_GD.map(d=><option key={d.id} value={d.id}>{d.id}</option>)}
          </Sel>
          <Sel value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)}>
            <option value="todos">Todos os status</option>
            {Object.keys(STATUS_DOC_GD).map(st=><option key={st} value={st}>{STATUS_DOC_GD[st].icon} {st}</option>)}
          </Sel>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button style={s.btn} onClick={()=>setView("arvore")}>🌳 Árvore</button>
          {!isViewer&&<button style={s.btnA} onClick={()=>{setSel(null);resetForm();setView("novo");}}>+ Novo Documento</button>}
        </div>
      </div>
      {loading?(
        <div style={{textAlign:"center",padding:"3rem",color:T.text2}}>Carregando lista mestra...</div>
      ):filtrados.length===0?(
        <div style={{textAlign:"center",padding:"3rem",color:T.text3}}>
          <div style={{fontSize:40,marginBottom:12}}>🗂️</div>
          <div style={{fontSize:14}}>{docs.length===0?"Nenhum documento cadastrado.":"Nenhum resultado para os filtros."}</div>
          {docs.length===0&&<div style={{fontSize:12,marginTop:6}}>Crie o primeiro documento do sistema!</div>}
        </div>
      ):
      (<>
      {_gds.map(d=>{
        const tipo = TIPOS_DOC_GD.find(t=>t.id===d.tipo);
        return (
          <div key={d.id} className="rnc-row" onClick={()=>{setSel(d);setView("detalhe");}}
            style={{background:T.card,border:`1px solid ${T.border}`,borderLeft:`3px solid ${tipo?.cor||T.border}`,borderRadius:10,padding:"10px 14px",marginBottom:8,cursor:"pointer",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
            <div style={{width:38,height:38,borderRadius:8,background:(tipo?.cor||T.accent)+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{tipo?.icon||"📄"}</div>
            <div style={{flex:1,minWidth:150}}>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                <div style={{fontSize:12,fontWeight:700,color:tipo?.cor||T.accent}}>{d.codigo}</div>
                <div style={{fontSize:13,fontWeight:600,color:T.text}}>{d.titulo}</div>
              </div>
              <div style={{fontSize:11,color:T.text2,marginTop:2}}>
                {d.depto} · Rev.{d.versao} · {d.criadoPor} · {fmt(d.criadoEm)}
                {d.treinamentoObrigatorio&&<span style={{marginLeft:8,color:T.blue||"#4fc3f7"}}>📚</span>}
              </div>
            </div>
            <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
              <AlertaRevisaoGD doc={d}/>
              {d.assinaturaElaborador&&<span style={{fontSize:10,padding:"2px 6px",borderRadius:12,background:T.accent+"18",color:T.accent}}>✍️</span>}
              {d.assinaturaRevisor&&<span style={{fontSize:10,padding:"2px 6px",borderRadius:12,background:(T.blue||"#4fc3f7")+"18",color:T.blue||"#4fc3f7"}}>🔎</span>}
              {d.assinaturaAprovador&&<span style={{fontSize:10,padding:"2px 6px",borderRadius:12,background:(T.orange||"#ff9800")+"18",color:T.orange||"#ff9800"}}>✅</span>}
              <BadgeTipoGD tipo={d.tipo}/>
              <BadgeStatusGD status={d.status}/>
            </div>
          </div>
        );
      })
      }<Pagination page={_pgGD} total={_totGD} setPage={_setPgGD}/>
      </>
      )}
    </div>
  );
}

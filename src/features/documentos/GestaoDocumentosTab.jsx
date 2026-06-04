import React, { useState, useEffect } from "react";
import { saveCollection, deleteFromCollection, subscribeCollection, getToken } from "../../firebase";
import { useTheme } from "../../core/theme";
import { fmt, sigCodigo, tod } from "../../core/utils";
import { uploadAttachment } from "../rnc/RncTabs";
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
      const result = await uploadAttachment(file);
      const imageUrl = typeof result === "string" ? result : result?.url;
      if (quillRef.current && imageUrl) {
        const range = quillRef.current.getSelection(true);
        quillRef.current.insertEmbed(range ? range.index : 0, "image", imageUrl);
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
  logo: "/logo.png",
};

export const TIPOS_DOC_GD = [
  { id: "PO",  label: "Procedimento Operacional",  icon: "📋", cor: "#2ab84a", prazoRevisaoAnos: 2, departamentoResponsavel: "SGQ" },
  { id: "IT",  label: "Instrução de Trabalho",      icon: "🔧", cor: "#4fc3f7", prazoRevisaoAnos: 2, departamentoResponsavel: "SGQ" },
  { id: "MOP", label: "Manual Operacional",         icon: "📖", cor: "#a78bfa", prazoRevisaoAnos: 3, departamentoResponsavel: "SGQ" },
  { id: "FO",  label: "Formulário",                icon: "📝", cor: "#ffd166", prazoRevisaoAnos: 3, departamentoResponsavel: "SGQ" },
  { id: "ESP", label: "Especificação",              icon: "🧪", cor: "#ff8c42", prazoRevisaoAnos: 1, departamentoResponsavel: "CQ" },
  { id: "MAN", label: "Manual",                    icon: "📚", cor: "#ff4f6a", prazoRevisaoAnos: 3, departamentoResponsavel: "SGQ" },
  { id: "ANX", label: "Anexo",                     icon: "📎", cor: "#5dd4b0", prazoRevisaoAnos: 3, departamentoResponsavel: "SGQ" },
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

export function calcProximaRevisaoGD(dataBase, prazoAnos = 3) {
  if (!dataBase) return null;
  const anos = Number(prazoAnos);
  const d = new Date(dataBase + "T12:00:00");
  d.setFullYear(d.getFullYear() + (Number.isFinite(anos) && anos > 0 ? anos : 3));
  return d.toISOString().split("T")[0];
}

// Prazo de revisão (anos) efetivo para um tipo: usa o valor configurado no admin
// (configuracoes/tipos_revisao) e, na ausência, o padrão do tipo. Fallback: 3 anos.
export function prazoRevisaoTipo(tipoId, tiposRevisaoCfg) {
  const cfg = tiposRevisaoCfg && tiposRevisaoCfg[tipoId];
  if (cfg !== undefined && cfg !== null && cfg !== "" && Number(cfg) > 0) return Number(cfg);
  const tipo = TIPOS_DOC_GD.find(t => t.id === tipoId);
  return tipo?.prazoRevisaoAnos ?? 3;
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

// Seção 17: trocar o destino do armazenamento aqui (servidor da empresa).
async function uploadDocumentoControlado(file) {
  return uploadAttachment(file);
}

// A rota /api/files/{uuid} exige JWT — busca o arquivo controlado com o mesmo
// token que api() usa, transforma em blob e abre numa aba (Ver) ou força o
// download com o nome correto (Baixar). Libera o object URL depois.
async function abrirArquivoAutenticado(url, download = false, nome = "documento") {
  try {
    const token = getToken();
    const resp = await fetch(url, token ? { headers: { Authorization: `Bearer ${token}` } } : {});
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const blob = await resp.blob();
    const objUrl = URL.createObjectURL(blob);
    if (download) {
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = nome;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      window.open(objUrl, "_blank");
    }
    // Atraso para a aba/download conseguir consumir o blob antes de revogar.
    setTimeout(() => URL.revokeObjectURL(objUrl), 10000);
  } catch(e) {
    window.open(url, "_blank");
  }
}

// Monta o nome de download "{codigo}_Rev{versao}" mantendo a extensão original do arquivo.
function nomeDownloadDoc(codigo, versao, arquivo) {
  const orig = arquivo?.nome || "";
  const dot = orig.lastIndexOf(".");
  const ext = dot >= 0 ? orig.slice(dot) : "";
  return `${codigo || "documento"}_Rev${versao || "01"}${ext}`;
}

// Fase 2/3 — endpoint de renderização controlada (capa + marca d'água no conteúdo).
function renderUrl(docId, modo) {
  return `/api/documents/${docId}/render?modo=${modo}`;
}

// Botões "Ver"/"Baixar" do arquivo oficial vigente, agora pela renderização
// controlada. O modo (e a marca d'água resultante) depende do status do doc.
function BotoesArquivoRender({ d, s, T, podeBaixarCopia }) {
  const codigo = d.codigo || "documento";
  const versao = d.versao || "01";
  if (d.status === "Vigente") {
    return (<>
      <button onClick={()=>abrirArquivoAutenticado(renderUrl(d.id, "controlada"))} style={{...s.btn,fontSize:11,color:T.accent}}>👁️ Ver</button>
      {podeBaixarCopia && <button onClick={()=>abrirArquivoAutenticado(renderUrl(d.id, "nao_controlada"), true, `${codigo}_Rev${versao}_CopiaNaoControlada.pdf`)} style={{...s.btnA,fontSize:11}}>⬇️ Baixar cópia não controlada</button>}
    </>);
  }
  if (d.status === "Obsoleto") {
    return <button onClick={()=>abrirArquivoAutenticado(renderUrl(d.id, "obsoleto"))} style={{...s.btn,fontSize:11,color:T.accent}}>👁️ Ver</button>;
  }
  // Rascunho, Em Revisão, Aguardando Aprovação
  return <button onClick={()=>abrirArquivoAutenticado(renderUrl(d.id, "rascunho"))} style={{...s.btn,fontSize:11,color:T.accent}}>👁️ Ver rascunho</button>;
}

export function GestaoDocumentosTab({ user, toast_, users, auditLog, perm, tiposRevisao = {} }) {
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
  // Fase 6 — modal de designação de leitura obrigatória
  const [modalDesignacao, setModalDesignacao] = useState(null); // { doc }
  const [designados, setDesignados]           = useState([]);
  const [filtroDesigDepto, setFiltroDesigDepto] = useState("todos");
  const [filtroDesigRole, setFiltroDesigRole]   = useState("todos");
  const entradaVazia = { versao:"", data:tod(), motivo:"", descricao:"", responsavel:user?.name||"", aprovador:"" };
  const [novaEntrada, setNovaEntrada] = useState(entradaVazia);
  const [editEntradaIdx, setEditEntradaIdx] = useState(null);
  const setE = (k,v) => setNovaEntrada(p=>({...p,[k]:v}));

  const [docArquivo, setDocArquivo] = useState(null);
  const [docArquivoUploading, setDocArquivoUploading] = useState(false);
  const [docArquivoFonte, setDocArquivoFonte] = useState(null);
  const [docArquivoFonteUploading, setDocArquivoFonteUploading] = useState(false);
  const [capitulosAberto, setCapitulosAberto] = useState(false);

  const formVazio = {
    tipo:"PO", depto:"SGQ", titulo:"", versao:"01",
    objetivo:"", alcance:"", responsabilidades:"", definicoes:"",
    procedimento:"", infComplementares:"N/A", referencias:"", registros:"", anexos:"N/A",
    etapas:[], materiais:[], obs:"", treinamentoObrigatorio:false, proximaRevisao:"",
    historicoRevisoes:[],
  };
  const [form, setForm] = useState(formVazio);
  const setF = (k,v) => setForm(p => ({...p,[k]:v}));
  const resetForm = () => { setForm(formVazio); setCapituloAtivo("objetivo"); setDocArquivo(null); setDocArquivoFonte(null); setCapitulosAberto(false); };

  const handleDocArquivo = async (file) => {
    if (!file) return;
    const ehPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");
    if (!ehPdf) {
      alert("O documento controlado deve estar em PDF. Se você tem um arquivo Word, exporte para PDF antes de anexar — assim o documento fica em formato fixo e não editável, como exige um sistema de qualidade.");
      return;
    }
    setDocArquivoUploading(true);
    try {
      const result = await uploadDocumentoControlado(file);
      const url = typeof result === "string" ? result : result.url;
      setDocArquivo({ url, nome: file.name, tipo: file.type, tamanho: file.size, enviadoPor: user?.name || "", enviadoEm: tod() });
      toast_("Arquivo oficial anexado!", "green");
    } catch(e) { toast_("Erro ao enviar arquivo.", "red"); }
    setDocArquivoUploading(false);
  };

  // Fase 4 — arquivo fonte editável (Word/Excel/PPT) por revisão. NÃO é o documento
  // controlado: serve só para gerar futuras revisões. Não é PDF.
  const handleDocArquivoFonte = async (file) => {
    if (!file) return;
    const ehPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");
    if (ehPdf) {
      alert("O arquivo fonte deve ser o editável (Word/Excel/PPT). O PDF vai no campo 'Documento controlado'.");
      return;
    }
    const ehEditavel = /\.(docx?|xlsx?|pptx?)$/i.test(file.name || "");
    if (!ehEditavel) {
      alert("O arquivo fonte deve ser Word, Excel ou PowerPoint (.doc, .docx, .xls, .xlsx, .ppt, .pptx).");
      return;
    }
    setDocArquivoFonteUploading(true);
    try {
      const result = await uploadAttachment(file);
      const url = typeof result === "string" ? result : result.url;
      setDocArquivoFonte({ url, nome: file.name, tipo: file.type, tamanho: file.size, enviadoPor: user?.name || "", enviadoEm: tod() });
      toast_("Arquivo fonte anexado!", "green");
    } catch(e) { toast_("Erro ao enviar arquivo fonte.", "red"); }
    setDocArquivoFonteUploading(false);
  };

  const isAdmin  = ["admin","keyuser","rt"].includes(user?.role) || (perm && (perm("criarDocumento")||perm("excluirDocumento")));
  const isViewer = user?.role === "viewer" && !(perm && perm("criarDocumento"));
  // Fase 5 — permissões granulares de Gestão de Documentos.
  const podeCriarDoc                 = perm?.("criarDocumento")            ?? false;
  const podeBaixarFonte              = perm?.("baixarArquivoFonte")        ?? false;
  const podeConfigurar               = perm?.("configurarDocumentos")      ?? false;  // reservado para futuro painel de config
  const podeIniciarRevisao           = perm?.("iniciarRevisao")            ?? false;
  const podeTornarObsoleto           = perm?.("tornarObsoleto")            ?? false;
  const podeBaixarCopiaNaoControlada = perm?.("baixarCopiaNaoControlada")  ?? false;
  const podeVerDocumentos            = perm?.("verDocumentos")             ?? false;

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
    // Seção 18 — trava pós-Vigente: documento vigente nunca é editado, só revisado.
    if (sel && sel.status === "Vigente") {
      toast_("Documento Vigente não pode ser editado. Use Nova Revisão.", "red");
      return;
    }
    const id  = sel ? sel.id : Date.now();
    const codigo = sel ? sel.codigo : gerarCodigoGD(form.tipo, form.depto, docs);
    const proximaRevisao = sel?.proximaRevisao || calcProximaRevisaoGD(tod(), prazoRevisaoTipo(form.tipo, tiposRevisao));
    let status = sel?.status || "Rascunho";
    if (!docArquivo && sel && sel.status === "Em Revisão") {
      alert("Anexe o novo arquivo oficial do documento antes de salvar esta revisão.");
      return;
    }
    // Seção 18 — integridade: editar documento já assinado (e não Vigente) invalida as assinaturas.
    const jaAssinado = !!(sel?.assinaturaElaborador || sel?.assinaturaRevisor || sel?.assinaturaAprovador);
    let invalidarAssinaturas = false;
    if (sel && jaAssinado) {
      if (!window.confirm("Este documento já tem assinaturas. Editar vai invalidá-las — elas serão removidas e o documento volta para Rascunho. Continuar?")) return;
      invalidarAssinaturas = true;
      status = "Rascunho";
    }
    const doc = {
      id, codigo, ...form, status, proximaRevisao,
      arquivo: docArquivo || sel?.arquivo || null,
      arquivoFonte: docArquivoFonte || sel?.arquivoFonte || null,
      criadoEm:  sel?.criadoEm  || tod(),
      criadoTs:  sel?.criadoTs  || Date.now(),
      criadoPor: sel?.criadoPor || user?.name,
      atualizadoEm: tod(), atualizadoTs: Date.now(), atualizadoPor: user?.name,
      assinaturaElaborador: invalidarAssinaturas ? null : (sel?.assinaturaElaborador || null),
      assinaturaRevisor:    invalidarAssinaturas ? null : (sel?.assinaturaRevisor    || null),
      assinaturaAprovador:  invalidarAssinaturas ? null : (sel?.assinaturaAprovador  || null),
      historicoRevisoes:    form.historicoRevisoes?.length ? form.historicoRevisoes : (sel?.historicoRevisoes || []),
    };
    await saveCollection("gestao_docs", String(id), doc);
    const acaoLog = !sel ? "Criou Documento" : invalidarAssinaturas ? "Editou Documento (assinaturas invalidadas)" : "Editou Documento";
    await auditLog(acaoLog, "gestao_docs", id, `${codigo} — ${form.titulo}`, sel || null, doc);
    toast_(sel ? (invalidarAssinaturas ? `${codigo} atualizado — assinaturas invalidadas, voltou para Rascunho.` : `${codigo} atualizado!`) : `${codigo} criado!`, "green");
    setSel(doc); setView("detalhe");
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const confirmarAssinatura = async (doc, papel, assin) => {
    try {
    // Fase 1 — não se assina documento sem arquivo oficial (PDF) anexado.
    if (!doc.arquivo) {
      alert("Anexe o arquivo oficial (PDF) do documento antes de assinar. Não é possível assinar um documento sem conteúdo.");
      setAssinarGD(null);
      return;
    }
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
    // Fase 6 — ao ficar Vigente, oferecer designação de leitura obrigatória
    if (updated.status === "Vigente") {
      setDesignados([]);
      setFiltroDesigDepto("todos");
      setFiltroDesigRole("todos");
      setModalDesignacao({ doc: updated });
    }
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
    const snapshotConteudo = { titulo: doc.titulo, etapas: doc.etapas||[], materiais: doc.materiais||[], arquivo: doc.arquivo || null, arquivoFonte: doc.arquivoFonte || null };
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
    // Arquivo controlado (PDF) da versão anterior fica no snapshot; nova revisão exige novo upload.
    // O arquivo fonte é mantido: o elaborador baixa o fonte anterior, edita e substitui.
    const updated = { ...doc, versao:novaVersao, status:"Em Revisão", arquivo:null, arquivoFonte: doc.arquivoFonte || null, assinaturaElaborador:null, assinaturaRevisor:null, assinaturaAprovador:null, historicoRevisoes:historico, proximaRevisao:calcProximaRevisaoGD(tod(), prazoRevisaoTipo(doc.tipo, tiposRevisao)), atualizadoEm:tod(), atualizadoTs:Date.now(), atualizadoPor:user?.name };
    await saveCollection("gestao_docs", String(doc.id), updated);
    await auditLog(`Nova Revisão — Rev.${novaVersao}`, "gestao_docs", doc.id, `${doc.codigo} — ${doc.titulo}`, { versao: versaoAtual, status: doc.status }, { versao: novaVersao, status: "Em Revisão" });
    toast_(`Revisão ${novaVersao} iniciada!`, "green");
    setSel(updated);
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  // Fase 6 — salva designados no documento e fecha o modal
  const salvarDesignacao = async (doc, listaDesignados) => {
    try {
      const leitura = {
        atribuido: true,
        atribuidoEm: tod(),
        atribuidoPor: user?.name || "",
        designados: listaDesignados.map(u => ({ userId: u.id, userName: u.name, setor: u.setor||"", confirmou: false, confirmedoEm: null })),
      };
      const updated = { ...doc, leituraObrigatoria: leitura };
      await saveCollection("gestao_docs", String(doc.id), updated);
      await auditLog("Designou Leitura Obrigatória", "gestao_docs", doc.id, `${doc.codigo} — ${doc.titulo}`, null, { designados: leitura.designados.length });
      toast_(`Leitura obrigatória atribuída a ${leitura.designados.length} pessoa(s).`, "green");
      setSel(updated);
      setModalDesignacao(null);
    } catch(e) { toast_("Erro ao salvar designação.", "red"); console.error(e); }
  };

  // Fase 6 — usuário confirma "Li e entendi"
  const confirmarLeitura = async (doc) => {
    try {
      const leitura = doc.leituraObrigatoria || {};
      const designados = (leitura.designados || []).map(d =>
        d.userId === user?.uid || d.userId === user?.id
          ? { ...d, confirmou: true, confirmedoEm: new Date().toISOString() }
          : d
      );
      const updated = { ...doc, leituraObrigatoria: { ...leitura, designados } };
      await saveCollection("gestao_docs", String(doc.id), updated);
      await auditLog("Confirmou Leitura", "gestao_docs", doc.id, `${doc.codigo} — ${doc.titulo}`, null, { userId: user?.uid||user?.id, userName: user?.name });
      toast_("Leitura confirmada!", "green");
      setSel(updated);
    } catch(e) { toast_("Erro ao confirmar leitura.", "red"); console.error(e); }
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
    // Seção 18 — marca d'água: obsoleto em vermelho, demais "cópia não controlada" em cinza.
    const obsoleto = doc.status === "Obsoleto";
    const wmTexto = obsoleto ? "DOCUMENTO OBSOLETO" : "CÓPIA NÃO CONTROLADA";
    const wmCor   = obsoleto ? "#ff4f6a" : "#888888";
    const wmHTML  = `<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-family:Arial,sans-serif;font-size:72px;font-weight:bold;color:${wmCor};opacity:.13;pointer-events:none;white-space:nowrap;z-index:9999;letter-spacing:.05em;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${wmTexto}</div>`;
    const assHTML = (ass,label) => ass
      ? `<div style="padding:10px 12px;border:1px solid ${cor}40;border-radius:8px;background:#fafdfb;"><div style="font-size:8px;letter-spacing:.08em;color:${cor};text-transform:uppercase;font-weight:bold;margin-bottom:6px;">${label}</div><div style="font-size:12px;font-weight:bold;color:#1a3a28;">${ass.nome||"—"}</div>${ass.cargo?`<div style="font-size:10px;color:#555;">${ass.cargo}</div>`:""}${ass.setor?`<div style="font-size:9px;color:#777;">Setor: ${ass.setor}</div>`:""}${(ass.registroProfissional||ass.crf)?`<div style="font-size:9px;color:#777;">Registro profissional: ${ass.registroProfissional||ass.crf}</div>`:""}${ass.email?`<div style="font-size:9px;color:#777;">${ass.email}</div>`:""}<div style="margin-top:6px;padding-top:6px;border-top:1px dashed ${cor}40;font-size:9px;color:#555;">✔ Assinado eletronicamente em ${ass.timestamp?new Date(ass.timestamp).toLocaleString("pt-BR"):ass.dataHora||""}</div><div style="font-size:8px;color:#999;margin-top:3px;font-family:monospace;">Cód. verificação: ${sigCodigo(ass, `${doc.codigo}|R${doc.versao}`)}</div>${ass.hash?`<div style="font-size:7px;color:#aaa;margin-top:2px;font-family:monospace;">Hash: ${String(ass.hash).slice(0,24)}...</div>`:""}</div>`
      : `<div style="text-align:center;padding:10px;border:1px dashed #ddd;border-radius:6px;background:#fafafa;"><div style="font-size:9px;color:#888;text-transform:uppercase;">${label}</div><div style="font-size:11px;color:#ccc;padding:8px 0;">Aguardando</div></div>`;
    // Folha de rosto controlada: só renderiza capítulos com conteúdo real (docs legados).
    const capsPreenchidos = CAPITULOS_GD.filter(cap => {
      if (cap.special) return false;
      const v = doc[cap.id];
      if (!v || v === "N/A") return false;
      return v.replace(/<[^>]*>/g, "").trim().length > 0;
    });
    const capsHTML = capsPreenchidos.length
      ? `<div style="padding:14px 22px;border-top:2px solid ${cor}30;"><div style="font-size:9px;color:${cor};text-transform:uppercase;font-weight:bold;margin-bottom:8px;">Rascunho / Anotações (não é o documento oficial)</div>${capsPreenchidos.map(cap => `<div style="padding:8px 0;border-bottom:1px solid #f0f0f0;"><div style="font-size:9px;color:${cor};text-transform:uppercase;font-weight:bold;margin-bottom:4px;">${cap.label}</div><div style="font-size:11px;color:#333;line-height:1.7;">${doc[cap.id]}</div></div>`).join("")}</div>`
      : "";
    const arquivoHTML = doc.arquivo
      ? `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border:1px solid ${cor}40;border-radius:8px;background:#fafdfb;"><span style="font-size:22px;">📄</span><div><div style="font-size:12px;font-weight:bold;color:#1a3a28;">${doc.arquivo.nome}</div><div style="font-size:10px;color:#777;">Este é o documento oficial controlado.${doc.arquivo.enviadoPor?` Enviado por ${doc.arquivo.enviadoPor}`:""}${doc.arquivo.enviadoEm?` em ${fmt(doc.arquivo.enviadoEm)}`:""}</div></div></div>`
      : `<div style="padding:10px 14px;border:1px dashed #e0a800;border-radius:8px;background:#fff8e6;font-size:11px;color:#8a6000;">⚠️ Nenhum arquivo oficial anexado a este documento.</div>`;
    const html = `<div style="font-family:Arial,sans-serif;max-width:800px;margin:0 auto;background:#fff;">`
      + `<div style="background:linear-gradient(135deg,#1a4a2e,${cor});padding:14px 22px;display:flex;align-items:center;justify-content:space-between;"><div style="display:flex;align-items:center;gap:12px;"><img src="${window.location.origin}${HERBAMED_INFO_GD.logo}" style="width:40px;height:40px;border-radius:6px;object-fit:cover;"/><div><div style="color:#fff;font-size:13px;font-weight:bold;">${HERBAMED_INFO_GD.nome}</div><div style="color:#9fd4b2;font-size:10px;">CNPJ: ${HERBAMED_INFO_GD.cnpj}</div></div></div><div style="text-align:right;"><div style="color:#fff;font-size:12px;font-weight:bold;">${tipo?.label||doc.tipo}</div><div style="color:#9fd4b2;font-size:11px;">${doc.codigo} · Rev.${doc.versao}</div></div></div>`
      + `<div style="padding:12px 22px;border-bottom:2px solid ${cor}20;background:#f9fdf9;"><div style="font-size:9px;letter-spacing:.1em;color:${cor};text-transform:uppercase;font-weight:bold;margin-bottom:4px;">Folha de Rosto Controlada</div><div style="font-size:15px;font-weight:bold;color:#1a4a2e;margin-bottom:4px;">${doc.titulo}</div><div style="font-size:11px;color:#666;">Departamento: ${doc.depto} · Status: ${doc.status} · Elaborado: ${fmt(doc.criadoEm)} · Próx. revisão: ${fmt(doc.proximaRevisao)}</div></div>`
      + `<div style="padding:14px 22px;"><div style="font-size:9px;color:${cor};text-transform:uppercase;font-weight:bold;margin-bottom:8px;">Documento Oficial (Arquivo Controlado)</div>${arquivoHTML}</div>`
      + `<div style="padding:0 22px 14px;"><div style="font-size:9px;color:${cor};text-transform:uppercase;font-weight:bold;margin-bottom:8px;">Assinaturas</div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">${assHTML(doc.assinaturaElaborador,"Elaborador")}${assHTML(doc.assinaturaRevisor,"Revisor")}${assHTML(doc.assinaturaAprovador,"Aprovador")}</div></div>`
      + capsHTML
      + `<div style="padding:6px 22px;border-top:1px solid #eee;display:flex;justify-content:space-between;font-size:9px;color:#999;"><span>${HERBAMED_INFO_GD.nome}</span><span>Impresso em ${new Date().toLocaleString("pt-BR")} · Rev.${doc.versao} · ${wmTexto}</span></div>`
      + `</div>`;
    const win = window.open("","_blank");
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Folha de Rosto — ${doc.codigo}</title><style>@media print{body{margin:0}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}}</style></head><body>${wmHTML}${html}<script>window.onload=()=>window.print();<\/script></body></html>`);
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

  /* ── GATE: verDocumentos ── */
  if (!podeVerDocumentos) {
    return (
      <div style={{ textAlign:"center", padding:"3rem", color:T.text3 }}>
        <div style={{ fontSize:40, marginBottom:12 }}>🔒</div>
        <div style={{ fontSize:14, fontWeight:600, color:T.text }}>Acesso restrito</div>
        <div style={{ fontSize:12, marginTop:6 }}>Você não tem permissão para acessar a Gestão de Documentos.</div>
      </div>
    );
  }

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
            {podeAssElab  && <button disabled={!d.arquivo} title={!d.arquivo?"Anexe o PDF antes de assinar":undefined} style={{...s.btnA,fontSize:11,...(!d.arquivo?{opacity:0.5,cursor:"not-allowed"}:{})}} onClick={()=>setAssinarGD({doc:d,papel:"elaborador"})}>✍️ Elaborador</button>}
            {podeAssRev   && <button disabled={!d.arquivo} title={!d.arquivo?"Anexe o PDF antes de assinar":undefined} style={{...s.btnA,fontSize:11,background:T.blue||"#4fc3f7",...(!d.arquivo?{opacity:0.5,cursor:"not-allowed"}:{})}} onClick={()=>setAssinarGD({doc:d,papel:"revisor"})}>🔎 Revisor</button>}
            {podeAssAprov && <button disabled={!d.arquivo} title={!d.arquivo?"Anexe o PDF antes de assinar":undefined} style={{...s.btnA,fontSize:11,background:T.orange||"#ff9800",...(!d.arquivo?{opacity:0.5,cursor:"not-allowed"}:{})}} onClick={()=>setAssinarGD({doc:d,papel:"aprovador"})}>✅ Aprovador</button>}
            {podeIniciarRevisao && d.status==="Vigente" && <button style={{...s.btn,fontSize:11}} onClick={()=>solicitarRevisao(d)}>🔄 Nova Revisão</button>}
            {podeTornarObsoleto && d.status==="Vigente" && <button style={{...s.btnD,fontSize:11}} onClick={()=>tornarObsoleto(d)}>🗄️ Obsoleto</button>}
            <button style={{...s.btn,fontSize:11}} onClick={()=>exportPDF(d)}>🖨️ Folha de Rosto</button>
            {!isViewer && d.status!=="Vigente" && <button style={{...s.btn,fontSize:11}} onClick={()=>{ setSel(d); setForm({tipo:d.tipo,depto:d.depto,titulo:d.titulo,versao:d.versao,objetivo:d.objetivo||"",alcance:d.alcance||"",responsabilidades:d.responsabilidades||"",definicoes:d.definicoes||"",procedimento:d.procedimento||"",infComplementares:d.infComplementares||"N/A",referencias:d.referencias||"",registros:d.registros||"",anexos:d.anexos||"N/A",etapas:d.etapas||[],materiais:d.materiais||[],obs:d.obs||"",treinamentoObrigatorio:d.treinamentoObrigatorio||false,proximaRevisao:d.proximaRevisao||"",historicoRevisoes:d.historicoRevisoes||[]}); setDocArquivo(d.arquivo||null); setDocArquivoFonte(d.arquivoFonte||null); setCapitulosAberto(false); setView("novo"); }}>✏️ Editar</button>}
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
        {/* ── ARQUIVO OFICIAL ── */}
        <div style={{ ...s.card, border:`2px solid ${d.arquivo ? T.accent+"33" : "#ff8c4244"}`, background: d.arquivo ? `${T.accent}08` : "#ff8c4208" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
            <SecTitle icon="📎" ch="Documento Oficial (Arquivo Controlado)" />
            {d.arquivo
              ? <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20, background:T.accent+"22", color:T.accent }}>📎 Arquivo anexado</span>
              : <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20, background:"#ff8c4222", color:"#ff8c42" }}>⚠️ Sem arquivo oficial</span>
            }
          </div>
          {d.arquivo ? (
            <div style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", background:T.surf, borderRadius:10, border:`1px solid ${T.border}`, marginTop:8 }}>
              <span style={{ fontSize:28 }}>📄</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{d.arquivo.nome}</div>
                <div style={{ fontSize:11, color:T.text2 }}>
                  {d.arquivo.tamanho ? (d.arquivo.tamanho/1024).toFixed(1)+" KB · " : ""}
                  Enviado por {d.arquivo.enviadoPor}{d.arquivo.enviadoEm ? ` em ${fmt(d.arquivo.enviadoEm)}` : ""}
                </div>
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                <BotoesArquivoRender d={d} s={s} T={T} podeBaixarCopia={podeBaixarCopiaNaoControlada} />
              </div>
            </div>
          ) : (
            <div style={{ padding:"12px 16px", background:T.surf, borderRadius:10, border:`1px solid ${T.border}`, marginTop:8, fontSize:12, color:T.text3, textAlign:"center" }}>
              Nenhum arquivo oficial anexado a este documento. Clique em "Editar" para anexar.
            </div>
          )}
        </div>
        {/* ── ARQUIVO FONTE (não controlado) — Fase 4/5, só para quem pode baixar fonte ── */}
        {podeBaixarFonte && (
          <div style={{ ...s.card, border:`1px dashed ${T.border2}`, background:T.surf }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
              <SecTitle icon="🛠️" ch="Arquivo Fonte (não controlado)" />
              <span style={{ fontSize:10, fontWeight:700, padding:"3px 10px", borderRadius:20, background:T.text3+"22", color:T.text3 }}>ARQUIVO DE TRABALHO</span>
            </div>
            <div style={{ fontSize:11, color:T.text3, marginTop:2, marginBottom:8 }}>
              Arquivo editável (Word/Excel/PPT) usado apenas para gerar futuras revisões. Não é o documento oficial — não é distribuído, assinado nem carimbado.
            </div>
            {d.arquivoFonte ? (
              <div style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", background:T.bg, borderRadius:10, border:`1px solid ${T.border}` }}>
                <span style={{ fontSize:24 }}>🛠️</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:T.text2 }}>{d.arquivoFonte.nome}</div>
                  <div style={{ fontSize:11, color:T.text3 }}>
                    {d.arquivoFonte.tamanho ? (d.arquivoFonte.tamanho/1024).toFixed(1)+" KB · " : ""}
                    Enviado por {d.arquivoFonte.enviadoPor}{d.arquivoFonte.enviadoEm ? ` em ${fmt(d.arquivoFonte.enviadoEm)}` : ""}
                  </div>
                </div>
                <button onClick={()=>abrirArquivoAutenticado(d.arquivoFonte.url, true, d.arquivoFonte.nome)} style={{ ...s.btn, fontSize:11 }}>⬇️ Baixar fonte</button>
              </div>
            ) : (
              <div style={{ padding:"10px 14px", background:T.bg, borderRadius:10, border:`1px solid ${T.border}`, fontSize:12, color:T.text3, textAlign:"center" }}>
                Nenhum arquivo fonte anexado.
              </div>
            )}
          </div>
        )}

        {d.materiais?.length>0 && (
          <div style={s.card}>
            <SecTitle icon="🧪" ch="Materiais e Equipamentos" />
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {d.materiais.map((m,i)=><span key={i} style={{fontSize:12,padding:"4px 12px",borderRadius:20,background:T.surf,border:`1px solid ${T.border}`,color:T.text}}>{m}</span>)}
            </div>
          </div>
        )}
        {/* ── HISTÓRICO DE VERSÕES (elevado) ── */}
        <div style={s.card}>
          <SecTitle icon="🕐" ch="Histórico de Versões" />
          <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:8}}>
            {/* Versão atual — sempre no topo */}
            <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",background:T.accentDim,border:`1px solid ${T.accent}33`,borderRadius:10}}>
              <div style={{width:44,height:44,borderRadius:10,background:T.accent,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,flexShrink:0}}>
                {d.versao}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <span style={{fontSize:13,fontWeight:700,color:T.accent}}>Rev.{d.versao}</span>
                  <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,background:T.accent,color:"#fff"}}>ATUAL</span>
                  <BadgeStatusGD status={d.status}/>
                </div>
                <div style={{fontSize:11,color:T.text2,marginTop:3}}>
                  {fmt(d.atualizadoEm)} · {d.atualizadoPor||d.criadoPor}
                </div>
              </div>
              <div style={{display:"flex",gap:6,flexShrink:0}}>
                {d.arquivo ? (
                  <BotoesArquivoRender d={d} s={s} T={T} podeBaixarCopia={podeBaixarCopiaNaoControlada} />
                ) : (
                  <span style={{fontSize:11,color:T.text3,fontStyle:"italic"}}>Sem arquivo</span>
                )}
              </div>
            </div>
            {/* Revisões anteriores */}
            {(!d.historicoRevisoes||d.historicoRevisoes.length===0) ? (
              <div style={{fontSize:12,color:T.text3,padding:"10px 16px",background:T.surf,borderRadius:8,border:`1px solid ${T.border}`,textAlign:"center"}}>
                Versão {d.versao} — atual. Sem revisões anteriores ainda.
              </div>
            ) : (
              [...d.historicoRevisoes].reverse().map((h,i)=>{
                const arq = h.conteudo?.arquivo;
                return (
                  <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:T.surf,border:`1px solid ${T.border}`,borderRadius:10}}>
                    <div style={{width:44,height:44,borderRadius:10,background:T.border,color:T.text2,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,flexShrink:0}}>
                      {h.versao}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                        <span style={{fontSize:12,fontWeight:700,color:T.text}}>Rev.{h.versao}</span>
                        {h.status&&<BadgeStatusGD status={h.status}/>}
                      </div>
                      <div style={{fontSize:11,color:T.text2,marginTop:2}}>
                        {fmt(h.data)} · {h.responsavel||"—"}{h.aprovador?` · Aprov.: ${h.aprovador}`:""}
                      </div>
                      {h.motivo&&<div style={{fontSize:11,color:T.text3,marginTop:2,fontStyle:"italic"}}>{h.motivo}</div>}
                    </div>
                    <div style={{display:"flex",gap:6,flexShrink:0}}>
                      {arq ? (<>
                        <button onClick={()=>abrirArquivoAutenticado(arq.url)} style={{...s.btn,fontSize:10,color:T.accent}}>👁️ Ver</button>
                        <button onClick={()=>abrirArquivoAutenticado(arq.url, true, nomeDownloadDoc(d.codigo, h.versao, arq))} style={{...s.btn,fontSize:10}}>⬇️ Baixar</button>
                      </>) : h.conteudo ? (
                        <button style={{...s.btn,fontSize:10,padding:"3px 8px"}} onClick={()=>setVerSnapshot(h)}>📄 Ver anotações</button>
                      ) : (
                        <span style={{fontSize:10,color:T.text3,fontStyle:"italic"}}>Sem arquivo</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {(()=>{
          const capsPreenchidos = CAPITULOS_GD.filter(cap=>{
            if(cap.special) return false;
            const v = d[cap.id];
            if(!v || v==="N/A") return false;
            const stripped = v.replace(/<[^>]*>/g,"").trim();
            return stripped.length > 0;
          });
          if(capsPreenchidos.length===0) return null;
          return (
            <div style={s.card}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
                <SecTitle icon="📝" ch="Rascunho / Anotações" />
                <span style={{fontSize:10,color:T.text3,fontStyle:"italic"}}>(não é o documento oficial)</span>
              </div>
              {capsPreenchidos.map(cap=>(
                <div key={cap.id} style={{marginBottom:14}}>
                  <div style={{fontSize:11,color:T.accent,fontWeight:700,textTransform:"uppercase",letterSpacing:".05em",marginBottom:5}}>{cap.label}</div>
                  <div style={{padding:"10px 14px",background:T.surf,border:`1px solid ${T.border}`,borderRadius:8,fontSize:13,color:T.text,lineHeight:1.7}}
                    dangerouslySetInnerHTML={{__html:d[cap.id]}} />
                </div>
              ))}
            </div>
          );
        })()}
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
        {verSnapshot && (
          <div onClick={()=>setVerSnapshot(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",zIndex:9999,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"40px 16px",overflowY:"auto"}}>
            <div onClick={e=>e.stopPropagation()} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:12,maxWidth:760,width:"100%",padding:"1.5rem",boxShadow:"0 20px 60px rgba(0,0,0,.4)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <div style={{fontSize:15,fontWeight:700,color:T.text}}>📄 Conteúdo arquivado — Rev.{verSnapshot.versao}</div>
                <button style={{...s.btn,fontSize:11}} onClick={()=>setVerSnapshot(null)}>✕ Fechar</button>
              </div>
              <div style={{fontSize:11,color:T.text3,marginBottom:16}}>{fmt(verSnapshot.data)} · {verSnapshot.responsavel||"—"}{verSnapshot.conteudo?.titulo?` · ${verSnapshot.conteudo.titulo}`:""}</div>
              {verSnapshot.conteudo?.arquivo && (
                <div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:T.surf,borderRadius:8,border:`1px solid ${T.border}`,marginBottom:14}}>
                  <span style={{fontSize:18}}>📄</span>
                  <div style={{flex:1,fontSize:12,color:T.text}}>{verSnapshot.conteudo.arquivo.nome}</div>
                  <button onClick={()=>abrirArquivoAutenticado(verSnapshot.conteudo.arquivo.url)} style={{...s.btn,fontSize:11,color:T.accent}}>👁️ Ver</button>
                  <button onClick={()=>abrirArquivoAutenticado(verSnapshot.conteudo.arquivo.url, true, nomeDownloadDoc(d.codigo, verSnapshot.versao, verSnapshot.conteudo.arquivo))} style={{...s.btn,fontSize:11}}>⬇️ Baixar</button>
                </div>
              )}
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
        {/* ── FASE 6: MODAL DE DESIGNAÇÃO DE LEITURA ── */}
        {modalDesignacao && (
          <div onClick={()=>setModalDesignacao(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",zIndex:9999,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"40px 16px",overflowY:"auto"}}>
            <div onClick={e=>e.stopPropagation()} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:14,maxWidth:640,width:"100%",padding:"1.5rem",boxShadow:"0 20px 60px rgba(0,0,0,.4)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div>
                  <div style={{fontSize:16,fontWeight:700,color:T.text}}>📖 Designar leitura obrigatória</div>
                  <div style={{fontSize:12,color:T.text2,marginTop:2}}>{modalDesignacao.doc.codigo} — {modalDesignacao.doc.titulo}</div>
                </div>
                <button style={{...s.btn,fontSize:11}} onClick={()=>setModalDesignacao(null)}>✕ Fechar</button>
              </div>
              <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
                <select value={filtroDesigDepto} onChange={e=>setFiltroDesigDepto(e.target.value)} style={{...s.inp,fontSize:12,flex:1}}>
                  <option value="todos">Todos os setores</option>
                  {[...new Set((users||[]).map(u=>u.setor).filter(Boolean))].map(s=><option key={s} value={s}>{s}</option>)}
                </select>
                <select value={filtroDesigRole} onChange={e=>setFiltroDesigRole(e.target.value)} style={{...s.inp,fontSize:12,flex:1}}>
                  <option value="todos">Todos os perfis</option>
                  {["admin","keyuser","rt","user","viewer","exec"].map(r=><option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div style={{maxHeight:300,overflowY:"auto",marginBottom:14,display:"flex",flexDirection:"column",gap:4}}>
                {(users||[]).filter(u=>
                  (filtroDesigDepto==="todos" || u.setor===filtroDesigDepto) &&
                  (filtroDesigRole==="todos"  || u.role===filtroDesigRole)
                ).map(u=>{
                  const sel2 = designados.some(x=>x.id===u.id);
                  return (
                    <label key={u.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:sel2?T.accentDim:T.surf,border:`1px solid ${sel2?T.accent+"44":T.border}`,borderRadius:8,cursor:"pointer",transition:"all .15s"}}>
                      <input type="checkbox" checked={sel2} onChange={()=>setDesignados(p=>sel2?p.filter(x=>x.id!==u.id):[...p,u])} style={{accentColor:T.accent,width:14,height:14,flexShrink:0}}/>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:600,color:T.text}}>{u.name}</div>
                        <div style={{fontSize:11,color:T.text2}}>{u.setor||"—"} · {u.role}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
              <div style={{fontSize:12,color:T.text2,marginBottom:12}}>{designados.length} pessoa(s) selecionada(s)</div>
              <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                <button style={s.btn} onClick={()=>setModalDesignacao(null)}>Pular (sem designar)</button>
                <button style={{...s.btnA,opacity:designados.length===0?0.5:1}} disabled={designados.length===0} onClick={()=>salvarDesignacao(modalDesignacao.doc, designados)}>
                  ✅ Designar leitura ✓
                </button>
              </div>
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
        {/* ── FASE 6: LEITURA OBRIGATÓRIA ── */}
        {(()=>{
          const leit = d.leituraObrigatoria;
          if (!leit?.atribuido) return null;
          const uid = user?.uid || user?.id;
          const euNaLista = leit.designados?.some(x => x.userId === uid);
          const podeVer = (perm?.("gerenciarTreinamento") ?? false) || euNaLista;
          if (!podeVer) return null;
          const total = leit.designados?.length || 0;
          const confirmados = leit.designados?.filter(x=>x.confirmou).length || 0;
          const euJaConfirmei = leit.designados?.find(x => x.userId === uid)?.confirmou;
          const pct = total > 0 ? Math.round((confirmados/total)*100) : 0;
          return (
            <div style={{ ...s.card, border:`1px solid ${T.accent}33` }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
                <SecTitle icon="📖" ch="Leitura Obrigatória" />
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontSize:12, color:T.text2 }}>{confirmados}/{total} confirmações ({pct}%)</span>
                  <div style={{ width:120, height:8, borderRadius:8, background:T.border, overflow:"hidden" }}>
                    <div style={{ width:`${pct}%`, height:"100%", background:pct===100?T.accent:"#ffd166", borderRadius:8, transition:"width .3s" }} />
                  </div>
                </div>
              </div>
              <div style={{ fontSize:11, color:T.text3, marginBottom:10 }}>
                Atribuído por {leit.atribuidoPor} em {fmt(leit.atribuidoEm)}
              </div>
              {euNaLista && !euJaConfirmei && (
                <div style={{ background:"#ffd16618", border:"1px solid #ffd16644", borderRadius:10, padding:"12px 16px", marginBottom:12, display:"flex", alignItems:"center", gap:12 }}>
                  <span style={{ fontSize:22 }}>📖</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:T.text }}>Leitura obrigatória — {d.codigo}</div>
                    <div style={{ fontSize:11, color:T.text2 }}>Você foi designado para ler este documento. Confirme após a leitura.</div>
                  </div>
                  <button style={{ ...s.btnA, fontSize:12 }} onClick={()=>confirmarLeitura(d)}>✅ Li e entendi</button>
                </div>
              )}
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {(leit.designados||[]).map((des,i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"8px 12px", background:T.surf, border:`1px solid ${T.border}`, borderRadius:8 }}>
                    <div style={{ width:28, height:28, borderRadius:"50%", background:des.confirmou?T.accent:T.border, color:des.confirmou?"#fff":T.text3, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, flexShrink:0 }}>
                      {des.confirmou ? "✓" : "✗"}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{des.userName}</div>
                      {des.setor && <div style={{ fontSize:11, color:T.text2 }}>{des.setor}</div>}
                    </div>
                    {des.confirmou
                      ? <span style={{ fontSize:11, color:T.accent, fontWeight:700 }}>✓ Confirmado em {fmt(des.confirmedoEm?.split?.("T")[0] || des.confirmedoEm)}</span>
                      : <span style={{ fontSize:11, color:T.text3 }}>Pendente</span>
                    }
                  </div>
                ))}
              </div>
              {(perm?.("gerenciarTreinamento") ?? false) && (
                <div style={{ textAlign:"right", marginTop:10 }}>
                  <button style={{ ...s.btn, fontSize:11 }} onClick={()=>{ setDesignados([]); setFiltroDesigDepto("todos"); setFiltroDesigRole("todos"); setModalDesignacao({ doc: d }); }}>
                    ✏️ Reatribuir leitura
                  </button>
                </div>
              )}
            </div>
          );
        })()}
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
        {/* ── UPLOAD DO DOCUMENTO OFICIAL ── */}
        <div style={{ border:`2px solid ${docArquivo ? T.accent+"44" : "#ff8c4244"}`, borderRadius:14, padding:"1.25rem", marginBottom:"1rem", background: docArquivo ? `${T.accent}0a` : "#ff8c420a" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
            <span style={{ fontSize:22 }}>📎</span>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:T.text }}>Documento controlado (PDF oficial)</div>
              <div style={{ fontSize:11, color:T.text2 }}>Apenas PDF. Documentos em Word devem ser exportados para PDF antes de anexar.</div>
            </div>
            {docArquivo
              ? <span style={{ marginLeft:"auto", fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20, background:T.accent+"22", color:T.accent }}>📎 Arquivo anexado</span>
              : <span style={{ marginLeft:"auto", fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20, background:"#ff8c4222", color:"#ff8c42" }}>⚠️ Sem arquivo oficial</span>
            }
          </div>
          {docArquivo ? (
            <div style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", background:T.surf, borderRadius:10, border:`1px solid ${T.border}` }}>
              <span style={{ fontSize:24 }}>📄</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{docArquivo.nome}</div>
                <div style={{ fontSize:11, color:T.text2 }}>{docArquivo.tamanho ? (docArquivo.tamanho/1024).toFixed(1)+" KB" : ""}</div>
              </div>
              <button onClick={()=>abrirArquivoAutenticado(docArquivo.url)} style={{ ...s.btn, fontSize:11, color:T.accent }}>👁️ Ver</button>
              <button onClick={()=>abrirArquivoAutenticado(docArquivo.url, true, nomeDownloadDoc(sel?.codigo || gerarCodigoGD(form.tipo, form.depto, docs), form.versao, docArquivo))} style={{ ...s.btn, fontSize:11 }}>⬇️ Baixar</button>
              <label style={{ ...s.btn, fontSize:11, cursor:"pointer", display:"inline-flex", alignItems:"center" }}>
                🔄 Substituir
                <input type="file" accept=".pdf,application/pdf" style={{ display:"none" }} onChange={e=>{ handleDocArquivo(e.target.files[0]); e.target.value=""; }} />
              </label>
              <button style={{ ...s.btnD, fontSize:11 }} onClick={()=>setDocArquivo(null)}>✕</button>
            </div>
          ) : (
            <label style={{ display:"block", border:`2px dashed ${T.border2}`, borderRadius:10, padding:"1.5rem", textAlign:"center", cursor: docArquivoUploading ? "wait" : "pointer", opacity: docArquivoUploading ? 0.6 : 1 }}>
              <div style={{ fontSize:32, marginBottom:6 }}>📂</div>
              <div style={{ fontSize:13, color:T.text2 }}>{docArquivoUploading ? "Enviando arquivo..." : "Clique para anexar o documento oficial"}</div>
              <div style={{ fontSize:11, color:T.text3, marginTop:4 }}>Apenas PDF</div>
              <input type="file" accept=".pdf,application/pdf" style={{ display:"none" }} disabled={docArquivoUploading}
                onChange={e=>{ handleDocArquivo(e.target.files[0]); e.target.value=""; }} />
            </label>
          )}
        </div>

        {/* ── UPLOAD DO ARQUIVO FONTE (editável, não controlado) — Fase 4/5 ── */}
        {podeBaixarFonte && (
          <div style={{ border:`2px dashed ${T.border2}`, borderRadius:14, padding:"1.25rem", marginBottom:"1rem", background:T.surf }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
              <span style={{ fontSize:22 }}>🛠️</span>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:T.text2 }}>Arquivo fonte (editável) — NÃO CONTROLADO</div>
                <div style={{ fontSize:11, color:T.text3 }}>Word, Excel ou PowerPoint. Usado apenas para gerar futuras revisões. Não é distribuído, assinado nem carimbado.</div>
              </div>
              {docArquivoFonte && <span style={{ marginLeft:"auto", fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20, background:T.text3+"22", color:T.text3 }}>🛠️ Fonte anexado</span>}
            </div>
            {docArquivoFonte ? (
              <div style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", background:T.bg, borderRadius:10, border:`1px solid ${T.border}`, flexWrap:"wrap" }}>
                <span style={{ fontSize:24 }}>🛠️</span>
                <div style={{ flex:1, minWidth:120 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:T.text2 }}>{docArquivoFonte.nome}</div>
                  <div style={{ fontSize:11, color:T.text3 }}>{docArquivoFonte.tamanho ? (docArquivoFonte.tamanho/1024).toFixed(1)+" KB" : ""}</div>
                </div>
                <button onClick={()=>abrirArquivoAutenticado(docArquivoFonte.url, true, docArquivoFonte.nome)} style={{ ...s.btn, fontSize:11 }}>⬇️ Baixar</button>
                <label style={{ ...s.btn, fontSize:11, cursor:"pointer", display:"inline-flex", alignItems:"center" }}>
                  🔄 Substituir
                  <input type="file" accept=".doc,.docx,.xls,.xlsx,.ppt,.pptx" style={{ display:"none" }} onChange={e=>{ handleDocArquivoFonte(e.target.files[0]); e.target.value=""; }} />
                </label>
                <button style={{ ...s.btnD, fontSize:11 }} onClick={()=>setDocArquivoFonte(null)}>✕ Remover</button>
              </div>
            ) : (
              <label style={{ display:"block", border:`2px dashed ${T.border2}`, borderRadius:10, padding:"1.25rem", textAlign:"center", cursor: docArquivoFonteUploading ? "wait" : "pointer", opacity: docArquivoFonteUploading ? 0.6 : 1 }}>
                <div style={{ fontSize:28, marginBottom:6 }}>📂</div>
                <div style={{ fontSize:13, color:T.text3 }}>{docArquivoFonteUploading ? "Enviando arquivo fonte..." : "Clique para anexar o arquivo fonte editável"}</div>
                <div style={{ fontSize:11, color:T.text3, marginTop:4 }}>Word, Excel ou PowerPoint (.doc, .docx, .xls, .xlsx, .ppt, .pptx)</div>
                <input type="file" accept=".doc,.docx,.xls,.xlsx,.ppt,.pptx" style={{ display:"none" }} disabled={docArquivoFonteUploading}
                  onChange={e=>{ handleDocArquivoFonte(e.target.files[0]); e.target.value=""; }} />
              </label>
            )}
          </div>
        )}

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
          {form.tipo && (()=>{
            const tp = TIPOS_DOC_GD.find(t=>t.id===form.tipo);
            const anos = prazoRevisaoTipo(form.tipo, tiposRevisao);
            const depResp = DEPARTAMENTOS_GD.find(x=>x.id===tp?.departamentoResponsavel);
            return (
              <div style={{display:"flex",gap:6,flexWrap:"wrap",fontSize:11,color:T.text3,marginTop:-2,marginBottom:2}}>
                <span>📅 Prazo de revisão padrão: <strong style={{color:T.text2}}>{anos} {anos===1?"ano":"anos"}</strong></span>
                <span style={{color:T.border}}>|</span>
                <span>🏛️ Departamento responsável: <strong style={{color:T.text2}}>{depResp?.label||tp?.departamentoResponsavel||"—"}</strong></span>
              </div>
            );
          })()}
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
        {/* ── RASCUNHO / CAPÍTULOS — seção recolhível, não é o documento oficial ── */}
        <div style={{ ...s.card, border:`1px solid ${T.border}`, opacity: 0.92 }}>
          <button
            onClick={()=>setCapitulosAberto(v=>!v)}
            style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", padding:0, marginBottom: capitulosAberto ? 12 : 0 }}
          >
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:16 }}>📝</span>
              <div style={{ textAlign:"left" }}>
                <div style={{ fontSize:13, fontWeight:700, color:T.text2 }}>Rascunho / anotações (opcional — não é o documento oficial)</div>
                <div style={{ fontSize:11, color:T.text3 }}>Editor de capítulos para notas internas. O arquivo anexado acima é o documento controlado.</div>
              </div>
            </div>
            <span style={{ fontSize:14, color:T.text3 }}>{capitulosAberto ? "▲ Recolher" : "▼ Expandir"}</span>
          </button>
          {capitulosAberto && <>
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
          </>}
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
              {d.proximaRevisao && (()=>{
                const dr = diasParaRevisaoGD(d.proximaRevisao);
                const cor = dr<0 ? "#ff4f6a" : dr<=30 ? "#ffd166" : T.text3;
                return <span style={{fontSize:10,fontWeight:dr<=30?700:600,color:cor}} title={dr<0?`Revisão vencida há ${Math.abs(dr)} dias`:dr<=30?`Vence em ${dr} dias`:"Dentro do prazo"}>Próx. revisão: {fmt(d.proximaRevisao)}</span>;
              })()}
              <AlertaRevisaoGD doc={d}/>
              {d.arquivo
                ? <span style={{fontSize:10,padding:"2px 8px",borderRadius:12,background:T.accent+"18",color:T.accent,fontWeight:700}}>📎 Arquivo anexado</span>
                : <span style={{fontSize:10,padding:"2px 8px",borderRadius:12,background:"#ff8c4218",color:"#ff8c42",fontWeight:700}}>⚠️ Sem arquivo</span>
              }
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

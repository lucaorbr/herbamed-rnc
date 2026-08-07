import React, { useState, useEffect } from "react";
import ExcelJS from 'exceljs';
import { saveCollection, deleteFromCollection, subscribeCollection, getToken } from "../../firebase";
import { useTheme } from "../../core/theme";
import { fmt, sigCodigo, tod } from "../../core/utils";
import { uploadAttachment } from "../rnc/RncTabs";
import { useS } from "../../shared/styles";
import { usePagination } from "../../shared/ui";
import { F, G2, G3, Inp, Pagination, SecTitle, Sel, TA } from "../../shared/ui";
import { AssinaturaModal } from "../pdf/pdfExports";
import { userHasPerm } from "../permissions/permissions";
import { reabrirLeitura, exigidosDoDocumento, exigidosSemLogin, indexarEvidencias, statusCelula, novaEvidencia, documentoExigeTreinamento, pendentesDoUsuario, MODOS_TREINAMENTO, PRAZO_TREINAMENTO_PADRAO } from "./treinamento";
import { MatrizTreinamentoTab } from "./MatrizTreinamentoTab";
import { SessoesTreinamentoTab } from "./SessoesTreinamentoTab";
import { opcoesDeLocal } from "../colaboradores/colaboradores";
import { sessoesDoDocumento } from "./sessoes";
import { cargosAtivos } from "../admin/cargos";

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
  logo: "/logo-herbamed.png",
};

export const TIPOS_DOC_GD = [
  { id: "PO",   label: "Procedimento Operacional",       icon: "📋", cor: "#2ab84a", prazoRevisaoAnos: 2, departamentoResponsavel: "SGQ" },
  { id: "IT",   label: "Instrução de Trabalho",           icon: "🔧", cor: "#4fc3f7", prazoRevisaoAnos: 2, departamentoResponsavel: "SGQ" },
  { id: "MOP",  label: "Manual Operacional",              icon: "📖", cor: "#a78bfa", prazoRevisaoAnos: 3, departamentoResponsavel: "SGQ" },
  { id: "FO",   label: "Formulário",                     icon: "📝", cor: "#ffd166", prazoRevisaoAnos: 3, departamentoResponsavel: "SGQ", semCapa: true, semMarcaDagua: true },
  { id: "ESP",  label: "Especificação",                   icon: "🧪", cor: "#ff8c42", prazoRevisaoAnos: 1, departamentoResponsavel: "SGQ" },
  { id: "MAN",  label: "Manual",                         icon: "📚", cor: "#ff4f6a", prazoRevisaoAnos: 3, departamentoResponsavel: "SGQ" },
  { id: "ANX",  label: "Anexo",                          icon: "📎", cor: "#5dd4b0", prazoRevisaoAnos: 3, departamentoResponsavel: "SGQ" },
  { id: "EMP",  label: "Proc. de Embalagem",             icon: "📦", cor: "#64748b", prazoRevisaoAnos: 2, departamentoResponsavel: "PRO" },
  { id: "EME",  label: "Proc. de Emergência",            icon: "🚨", cor: "#ef4444", prazoRevisaoAnos: 2, departamentoResponsavel: "SSM" },
  { id: "EPA",  label: "Esp. de Produto Acabado",        icon: "🧴", cor: "#06b6d4", prazoRevisaoAnos: 1, departamentoResponsavel: "SGQ" },
  { id: "MTA",  label: "Método de Técnica Analítica",    icon: "🔬", cor: "#8b5cf6", prazoRevisaoAnos: 1, departamentoResponsavel: "SGQ" },
  { id: "PCAL", label: "Plano de Calibração",            icon: "📏", cor: "#f59e0b", prazoRevisaoAnos: 1, departamentoResponsavel: "TEC" },
  { id: "EPI",  label: "Controle de EPI",                icon: "🦺", cor: "#f97316", prazoRevisaoAnos: 2, departamentoResponsavel: "SSM" },
];

export const DEPARTAMENTOS_GD = [
  { id: "ADM", label: "Administrativo",                   cor: "#5dd4b0" },
  { id: "ALM", label: "Almoxarifado",                     cor: "#818cf8" },
  { id: "COM", label: "Comercial",                        cor: "#ff4f6a" },
  { id: "DIR", label: "Diretoria",                        cor: "#f59e0b" },
  { id: "EXP", label: "Expedição",                        cor: "#10b981" },
  { id: "FIN", label: "Financeiro",                       cor: "#3b82f6" },
  { id: "LIM", label: "Serviços Gerais / Limpeza",        cor: "#6b7280" },
  { id: "LOG", label: "Logística",                        cor: "#ff8c42" },
  { id: "MAN", label: "Manutenção",                       cor: "#f97316" },
  { id: "MKT", label: "Marketing",                        cor: "#ec4899" },
  { id: "PCP", label: "PCP — Plan. e Controle de Prod.",  cor: "#8b5cf6" },
  { id: "PED", label: "Pedidos / Atendimento ao Cliente", cor: "#06b6d4" },
  { id: "PRO", label: "Produção",                         cor: "#ffd166" },
  { id: "REG", label: "Regulatório / Assuntos Reg.",      cor: "#14b8a6" },
  { id: "REH", label: "Recursos Humanos",                 cor: "#a78bfa" },
  { id: "SGQ", label: "Sistema de Gestão da Qualidade",   cor: "#2ab84a" },
  { id: "SSM", label: "Segurança e Saúde no Trabalho",    cor: "#ef4444" },
  { id: "SUP", label: "Suprimentos / Compras",            cor: "#f59e0b" },
  { id: "TEC", label: "Tecnologia da Informação",         cor: "#60a5fa" },
  { id: "VEN", label: "Vendas",                           cor: "#fb923c" },
];

export const STATUS_DOC_GD = {
  "Rascunho":              { c: "#7a9c7e", bg: "#7a9c7e18", icon: "✏️" },
  "Em Revisão":            { c: "#ffd166", bg: "#ffd16618", icon: "🔄" },
  "Aguardando Aprovação":  { c: "#4fc3f7", bg: "#4fc3f718", icon: "⏳" },
  "Aguardando Vigência":   { c: "#a78bfa", bg: "#a78bfa18", icon: "📅" },
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

export const TIPOS_DOC_CODIFICACAO = {
  "PO":   { prefixo: "PO",   padrao: "PO-ABC-xxx",     descricao: "Procedimento Operacional" },
  "FO":   { prefixo: "FO",   padrao: "FO-ABC-xxx-x",   descricao: "Formulário" },
  "MAN":  { prefixo: "MAN",  padrao: "ABC-Abc-xxx",     descricao: "Manual" },
  "EMP":  { prefixo: "EMP",  padrao: "ABC-Abc-xxx",     descricao: "Especificação Matérias-Primas" },
  "EME":  { prefixo: "EME",  padrao: "ABC-Abc-xxx",     descricao: "Especificação Material Embalagem" },
  "EPA":  { prefixo: "EPA",  padrao: "ABC-Abc-xxx",     descricao: "Especificação Produto Acabado" },
  "MTA":  { prefixo: "MTA",  padrao: "ABC-Abc-xxx",     descricao: "Métodos Analíticos" },
  "PCAL": { prefixo: "PCAL", padrao: "ABC-Abc-xxx",     descricao: "Controle Alergênicos" },
  "EPI":  { prefixo: "EPI",  padrao: "ABC-Abc-xxx",     descricao: "Especificação Produto Intermediário" },
  "ANX":  { prefixo: "ANX",  padrao: "ANX-BCD-xxx",     descricao: "Anexo" },
};

export function gerarCodigoGD(tipo, depto, docs) {
  const cfg = TIPOS_DOC_CODIFICACAO[tipo];
  const prefixo = cfg ? cfg.prefixo : tipo;

  const prefix = `${prefixo}-${depto}-`;
  const nums = docs
    .filter(d => d.codigo && d.codigo.startsWith(prefix))
    .map(d => parseInt(d.codigo.slice(prefix.length).split("-")[0], 10))
    .filter(n => Number.isFinite(n) && n > 0);
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `${prefixo}-${depto}-${String(next).padStart(3, "0")}`;
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
    <span style={{ padding:"3px 10px", borderRadius:20, fontSize:10, fontWeight:700, background:m.bg, color:m.c, whiteSpace:"nowrap" }} data-formal-scrubbable="true">
      {m.icon} {status}
    </span>
  );
}

export function BadgeTipoGD({ tipo, tipos = TIPOS_DOC_GD }) {
  const m = tipos.find(t => t.id === tipo) || TIPOS_DOC_GD.find(t => t.id === tipo) || { id: tipo, label: tipo, icon: "📄", cor: "#2ab84a" };
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
      // Quando o servidor nomeia o arquivo (Content-Disposition), o nome dele
      // vence: é lá que a regra de nomeação vive, e duplicá-la aqui faria o
      // arquivo entregue divergir do que o backend registrou.
      const doServidor = /filename="?([^"]+)"?/i.exec(resp.headers.get("content-disposition") || "")?.[1];
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = doServidor || nome;
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
function renderUrl(docId, modo, userName) {
  const base = `/api/documents/${docId}/render?modo=${modo}`;
  return userName ? `${base}&userName=${encodeURIComponent(userName)}` : base;
}

// Botões "Ver"/"Baixar" do arquivo oficial vigente, agora pela renderização
// controlada. O modo (e a marca d'água resultante) depende do status do doc.
function BotoesArquivoRender({ d, s, T, podeBaixarCopia, userName, acessoRestrito }) {
  const codigo = d.codigo || "documento";
  const versao = d.versao || "01";
  if (d.status === "Vigente") {
    // Acesso restrito: usuário só pode baixar a cópia não controlada, sem ver a versão controlada na tela
    if (acessoRestrito) {
      return <button onClick={()=>abrirArquivoAutenticado(renderUrl(d.id, "nao_controlada", userName), true, `${codigo}_Rev${versao}_CopiaNaoControlada.pdf`)} style={{...s.btnA,fontSize:11}}>⬇️ Baixar cópia não controlada</button>;
    }
    return (<>
      <button onClick={()=>abrirArquivoAutenticado(renderUrl(d.id, "controlada", userName))} style={{...s.btn,fontSize:11,color:T.accent}}>👁️ Ver</button>
      {podeBaixarCopia && <button onClick={()=>abrirArquivoAutenticado(renderUrl(d.id, "nao_controlada", userName), true, `${codigo}_Rev${versao}_CopiaNaoControlada.pdf`)} style={{...s.btnA,fontSize:11}}>⬇️ Baixar cópia não controlada</button>}
    </>);
  }
  if (acessoRestrito) return null; // não vê Obsoleto/Rascunho/etc.
  if (d.status === "Obsoleto") {
    return <button onClick={()=>abrirArquivoAutenticado(renderUrl(d.id, "obsoleto"))} style={{...s.btn,fontSize:11,color:T.accent}}>👁️ Ver</button>;
  }
  // Rascunho, Em Revisão, Aguardando Aprovação
  return <button onClick={()=>abrirArquivoAutenticado(renderUrl(d.id, "rascunho"))} style={{...s.btn,fontSize:11,color:T.accent}}>👁️ Ver rascunho</button>;
}

export function GestaoDocumentosTab({ user, toast_, users, auditLog, perm, tiposRevisao = {}, catalogoDeptos = [], catalogoTipos = [], catalogoAreasSetoresDistribuicao = [], catalogoCargos = [], colaboradores = [], doSaveRNC }) {
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
  const [evidencias, setEvidencias] = useState([]);
  const [sessoes, setSessoes] = useState([]);
  const [editTreino, setEditTreino] = useState(null); // config de exigência em edição
  const [novaEvid, setNovaEvid] = useState({ userId:"", dataRealizacao:tod(), obs:"" });
  const [capituloAtivo, setCapituloAtivo] = useState("objetivo");
  const [verSnapshot, setVerSnapshot] = useState(null);
  const [assinarGD, setAssinarGD] = useState(null);
  // Lista Mestra
  const [lmFiltroStatus, setLmFiltroStatus] = useState("todos");
  const [lmFiltroDepto, setLmFiltroDepto] = useState("todos");
  const [lmBusca, setLmBusca] = useState("");
  const [novoMat, setNovoMat] = useState("");
  // Distribuição física — cópias controladas impressas entregues aos setores.
  const [modalDistribuir, setModalDistribuir] = useState(null); // { doc }
  const [distribForm, setDistribForm] = useState({ areaId:"", tipoDestino:"setor", setorId:"", entreguePor:"" });
  // Rota de assinatura — Elaborador designa Revisor e Aprovador ao assinar.
  const [modalRota, setModalRota]   = useState(null); // { doc } — escolha de revisor/aprovador antes de assinar como Elaborador
  const [rotaForm, setRotaForm]     = useState({ revisorId:"", aprovadorId:"" });
  const [modalTrocarRota, setModalTrocarRota] = useState(null); // { doc } — admin remaneja designados
  // Fase 6 — modal de designação de leitura obrigatória
  // Fase 7 — log de distribuição
  const [distLog,     setDistLog]     = useState([]);
  const [distLogLoading, setDistLogLoading] = useState(false);
  // Fase 8 — data de vigência agendada
  const [modalVigencia, setModalVigencia] = useState(null); // { doc, onConfirm }
  const [dataVigenciaInput, setDataVigenciaInput] = useState("");
  // Recusa de documento (Revisor/Aprovador) — devolve a Rascunho com apontamentos estruturados
  const SECOES_DOC = ["Geral","Objetivo","Alcance","Responsabilidades","Definições","Procedimento","Inf. Complementares","Referências","Registros","Anexos","Arquivo anexado (PDF)"];
  const [rejeicaoModal, setRejeicaoModal] = useState(null); // { doc, papel, show }
  const [apontamentosForm, setApontamentosForm] = useState([{ secao:"Geral", descricao:"" }]);
  const entradaVazia = { versao:"", data:tod(), motivo:"", itemModificado:"", descricao:"", responsavel:user?.name||"", aprovador:"" };
  const [novaEntrada, setNovaEntrada] = useState(entradaVazia);
  const [editEntradaIdx, setEditEntradaIdx] = useState(null);
  const setE = (k,v) => setNovaEntrada(p=>({...p,[k]:v}));

  const [docArquivo, setDocArquivo] = useState(null);
  const [docArquivoUploading, setDocArquivoUploading] = useState(false);
  const [docArquivoFonte, setDocArquivoFonte] = useState(null);
  const [docArquivoFonteUploading, setDocArquivoFonteUploading] = useState(false);
  const [capitulosAberto, setCapitulosAberto] = useState(false);

  const tiposAtivos  = catalogoTipos.length  ? catalogoTipos.filter(t  => t.ativo  !== false) : TIPOS_DOC_GD;
  const deptosAtivos = catalogoDeptos.length ? catalogoDeptos.filter(d => d.ativo !== false) : DEPARTAMENTOS_GD;
  const areasDistribAtivas = catalogoAreasSetoresDistribuicao.filter(a => a.ativo !== false);
  const areaDistribPorId = id => catalogoAreasSetoresDistribuicao.find(a => a.id === id);
  const destinoDistribLabel = destino => {
    if (destino?.areaNome) return destino.tipoDestino === "area" ? `${destino.areaId} — ${destino.areaNome} (área inteira)` : `${destino.areaId} — ${destino.areaNome} / ${destino.setorNome || destino.setorId}`;
    const dep = deptosAtivos.find(x => x.id === destino?.setor);
    return dep ? `${dep.id} — ${dep.label}` : destino?.setor || "—";
  };

  const tipoInicial = tiposAtivos[0]?.id || "PO";
  const deptoInicial = deptosAtivos.find(d => d.id === "SGQ")?.id || deptosAtivos[0]?.id || "SGQ";
  const makeFormVazio = () => ({
    tipo:tipoInicial, depto:deptoInicial, titulo:"", versao:"00",
    objetivo:"", alcance:"", responsabilidades:"", definicoes:"",
    procedimento:"", infComplementares:"N/A", referencias:"", registros:"", anexos:"N/A",
    etapas:[], materiais:[], obs:"", treinamentoObrigatorio:false, proximaRevisao:"",
    historicoRevisoes:[], dataVigencia:"",
  });
  const [form, setForm] = useState(() => makeFormVazio());
  const setF = (k,v) => setForm(p => ({...p,[k]:v}));
  const resetForm = () => { setForm(makeFormVazio()); setCapituloAtivo("objetivo"); setDocArquivo(null); setDocArquivoFonte(null); setCapitulosAberto(false); };
  const tipoInfo = (tipoId) => tiposAtivos.find(t => t.id === tipoId) || TIPOS_DOC_GD.find(t => t.id === tipoId) || { id: tipoId, label: tipoId, cor: T.accent, icon: "📄" };
  const deptoInfo = (deptoId) => deptosAtivos.find(d => d.id === deptoId) || DEPARTAMENTOS_GD.find(d => d.id === deptoId) || { id: deptoId, label: deptoId };

  useEffect(() => {
    if (sel || view !== "novo" || !tiposAtivos.length) return;
    if (!tiposAtivos.some(t => t.id === form.tipo)) {
      setForm(p => ({ ...p, tipo: tiposAtivos[0].id }));
    }
  }, [sel, view, form.tipo, tiposAtivos]);

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
    } catch(e) { toast_(`Erro ao enviar arquivo fonte: ${e.message || "erro desconhecido"}`, "red"); }
    setDocArquivoFonteUploading(false);
  };

  const isAdmin  = ["admin","keyuser","rt"].includes(user?.role) || (perm && (perm("criarDocumento")||perm("excluirDocumento")));
  const isViewer = user?.role === "viewer" && !(perm && perm("criarDocumento"));
  // Só o admin (role estrito) remaneja a rota de assinatura quando o Elaborador erra o designado.
  const isAdminStrict = user?.role === "admin";
  // Usuários elegíveis para Revisor/Aprovador: precisam de permissão de assinar revisor/aprovador.
  const usuariosRevAprov = (users || []).filter(u => userHasPerm(u, "assinarRevisorAprovador"));
  const nomeUsuario = (uid) => (users || []).find(u => String(u.id) === String(uid))?.name || "";
  // Fallback visual de cargo: assinaturas antigas (anteriores ao campo "Cargo" no cadastro)
  // foram gravadas sem cargo. Só nesses casos buscamos o cargo atual do cadastro para exibir.
  // A assinatura em si NUNCA é reescrita — snapshot imutável — e o código de verificação
  // (sigCodigo) continua sendo calculado sobre o objeto gravado, sem este fallback.
  const cargoCadastroAtual = (ass) => {
    if (!ass || ass.cargo) return "";
    const u = (users || []).find(x =>
      (ass.userId && String(x.id) === String(ass.userId)) ||
      (ass.uid    && String(x.id) === String(ass.uid))    ||
      (ass.email  && String(x.email || "").toLowerCase() === String(ass.email).toLowerCase())
    );
    return u?.cargo || "";
  };
  // Fase 5 — permissões granulares de Gestão de Documentos.
  const podeCriarDoc                 = perm?.("criarDocumento")            ?? false;
  const podeBaixarFonte              = perm?.("baixarArquivoFonte")        ?? false;
  const podeConfigurar               = perm?.("configurarDocumentos")      ?? false;  // reservado para futuro painel de config
  const podeIniciarRevisao           = perm?.("iniciarRevisao")            ?? false;
  // Controle de distribuição de cópias físicas: tarefa de controle de documentos.
  const podeDistribuir               = (perm?.("iniciarRevisao") ?? false) || isAdmin;
  const podeTornarObsoleto           = perm?.("tornarObsoleto")            ?? false;
  const podeBaixarCopiaNaoControlada = perm?.("baixarCopiaNaoControlada")  ?? false;
  const podeVerDocumentos            = perm?.("verDocumentos")             ?? false;
  // Acesso restrito: usuário só enxerga documentos Vigentes e só pode baixar cópia não controlada
  const acessoRestritoVigente        = perm?.("acessoRestritoVigente")     ?? false;
  const docsVisiveis = acessoRestritoVigente ? docs.filter(d => d.status === "Vigente") : docs;

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 3000);
    const unsub = subscribeCollection("gestao_docs", list => {
      clearTimeout(t);
      const hoje = tod();
      // Fase 8 — promover documentos "Aguardando Vigência" cuja data chegou
      list.forEach(async doc => {
        if (doc.status === "Aguardando Vigência" && doc.dataVigencia && doc.dataVigencia <= hoje) {
          const promoted = { ...doc, status: "Vigente", atualizadoEm: hoje, atualizadoTs: Date.now(),
            treinamento: doc.treinamento ? { ...doc.treinamento, desdeEm: doc.treinamento.desdeEm || hoje } : doc.treinamento };
          try { await saveCollection("gestao_docs", String(doc.id), promoted); } catch {}
        }
      });
      setDocs(list.sort((a,b) => (b.criadoTs||0)-(a.criadoTs||0)));
      setLoading(false);
    });
    return () => { clearTimeout(t); unsub && unsub(); };
  }, []);


  // Evidências de treinamento — coleção plana, um poll só para a matriz inteira.
  // O mecanismo antigo (subcoleção por documento) só é lido pela migração.
  useEffect(() => {
    const unsub = subscribeCollection("treinamentos", list => setEvidencias(list || []));
    return () => unsub && unsub();
  }, []);

  // Sessões de treinamento presencial (Fase 5). Coleção nova nasce funcionando —
  // `handleCollections` no servidor atende qualquer nome, sem whitelist.
  useEffect(() => {
    const unsub = subscribeCollection("treinamento_sessoes", list => setSessoes(list || []));
    return () => unsub && unsub();
  }, []);

  useEffect(() => {
    if (!sel?.id) { setDistLog([]); return; }
    setDistLogLoading(true);
    fetch(`/api/distribution-log?docId=${sel.id}`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.ok ? r.json() : [])
      .then(rows => setDistLog(rows))
      .catch(() => setDistLog([]))
      .finally(() => setDistLogLoading(false));
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
    const codigo = sel ? sel.codigo : gerarCodigoGD(form.tipo, form.depto, docs, form.versao);
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
      rota:                 invalidarAssinaturas ? null : (sel?.rota || null),
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
    // Rota de assinatura: ao assinar como Elaborador, grava os designados (Revisor e Aprovador).
    if (papel==="elaborador") {
      // Reassinatura após recusa: os apontamentos foram tratados nesta versão corrigida.
      updated.apontamentos = [];
      updated.rota = {
        revisorId:    rotaForm.revisorId,
        revisorNome:  nomeUsuario(rotaForm.revisorId),
        aprovadorId:  rotaForm.aprovadorId,
        aprovadorNome:nomeUsuario(rotaForm.aprovadorId),
        definidaPor:  user?.name,
        definidaEm:   tod(),
      };
    }
    const temE = papel==="elaborador" || !!doc.assinaturaElaborador;
    const temR = papel==="revisor"    || !!doc.assinaturaRevisor;
    const temA = papel==="aprovador"  || !!doc.assinaturaAprovador;
    const todasAssinaturas = temE && temR && temA;
    if (todasAssinaturas) updated.status = "Vigente"; // pode mudar abaixo
    else if (temE && temR) updated.status = "Aguardando Aprovação";
    else if (temE)         updated.status = "Em Revisão";

    // Fase 8 — ao completar as 3 assinaturas, pergunta data de vigência
    if (todasAssinaturas) {
      setAssinarGD(null);
      setDataVigenciaInput("");
      setModalVigencia({
        doc: { ...updated },
        onConfirm: async (dataVig) => {
          const hoje = tod();
          const agendado = dataVig && dataVig > hoje;
          const docFinal = {
            ...updated,
            dataVigencia: dataVig || hoje,
            status: agendado ? "Aguardando Vigência" : "Vigente",
            // O prazo de treinamento começa a correr quando a versão entra em vigor.
            treinamento: updated.treinamento
              ? { ...updated.treinamento, desdeEm: agendado ? (dataVig || hoje) : hoje }
              : updated.treinamento,
          };
          await saveCollection("gestao_docs", String(doc.id), docFinal);
          await auditLog(`Assinou como ${papelLabel}`, "gestao_docs", doc.id, `${doc.codigo} — ${doc.titulo}`, null, { status: docFinal.status, dataVigencia: docFinal.dataVigencia });
          toast_(agendado ? `Documento aprovado — vigência agendada para ${fmt(dataVig)}.` : `Assinado como ${papelLabel}! Documento Vigente.`, "green");
          setSel(docFinal);
          setModalVigencia(null);
          // Antes abria-se aqui a designação nominal de leitura. Agora a exigência
          // vem do cargo e é configurada na seção Treinamento do documento — se
          // ainda não houver cargos vinculados, a seção avisa em vez de exigir
          // que alguém monte uma lista de nomes a cada revisão.
          if (!agendado && !docFinal.treinamento?.exigido) {
            setEditTreino({ exigido:true, modo:"leitura", cargos:[], pessoasExtra:[], prazoDias:PRAZO_TREINAMENTO_PADRAO, reciclagemMeses:"" });
          }
        },
      });
      return;
    }

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

  // Rota de assinatura — valida os designados e segue para a assinatura do Elaborador.
  const confirmarRota = (doc) => {
    const { revisorId, aprovadorId } = rotaForm;
    if (!revisorId || !aprovadorId) { alert("Selecione o Revisor e o Aprovador."); return; }
    if (String(revisorId) === String(aprovadorId)) { alert("Revisor e Aprovador devem ser pessoas diferentes."); return; }
    if (String(revisorId) === String(user?.id) || String(aprovadorId) === String(user?.id)) {
      alert("Segregação de funções: o Elaborador não pode ser também Revisor ou Aprovador.");
      return;
    }
    setModalRota(null);
    setAssinarGD({ doc, papel: "elaborador" });
  };

  // Apenas admin remaneja a rota. Se o papel já foi assinado, a assinatura é invalidada.
  const trocarRota = async (doc, novo) => {
    const rotaAtual = doc.rota || {};
    const mudouRevisor   = String(novo.revisorId)   !== String(rotaAtual.revisorId||"");
    const mudouAprovador = String(novo.aprovadorId) !== String(rotaAtual.aprovadorId||"");
    if (!novo.revisorId || !novo.aprovadorId) { alert("Selecione o Revisor e o Aprovador."); return; }
    if (String(novo.revisorId) === String(novo.aprovadorId)) { alert("Revisor e Aprovador devem ser pessoas diferentes."); return; }
    const elabId = doc.assinaturaElaborador?.uid;
    if (elabId && (String(novo.revisorId) === String(elabId) || String(novo.aprovadorId) === String(elabId))) {
      alert("Segregação de funções: o Elaborador não pode ser também Revisor ou Aprovador."); return;
    }
    const invalidaRev   = mudouRevisor   && !!doc.assinaturaRevisor;
    const invalidaAprov = mudouAprovador && !!doc.assinaturaAprovador;
    if ((invalidaRev || invalidaAprov) && !window.confirm("Trocar o designado vai invalidar a assinatura já feita nesse papel — ela será removida e precisará ser reassinada. Continuar?")) return;
    const updated = {
      ...doc,
      rota: {
        ...rotaAtual,
        revisorId: novo.revisorId,     revisorNome: nomeUsuario(novo.revisorId),
        aprovadorId: novo.aprovadorId, aprovadorNome: nomeUsuario(novo.aprovadorId),
        remanejadaPor: user?.name, remanejadaEm: tod(),
      },
    };
    if (invalidaRev)   updated.assinaturaRevisor = null;
    if (invalidaAprov) updated.assinaturaAprovador = null;
    // Recalcula status se assinaturas foram invalidadas.
    if (invalidaRev || invalidaAprov) {
      updated.status = updated.assinaturaAprovador ? "Vigente"
        : updated.assinaturaRevisor ? "Aguardando Aprovação"
        : updated.assinaturaElaborador ? "Em Revisão" : "Rascunho";
    }
    await saveCollection("gestao_docs", String(doc.id), updated);
    await auditLog("Remanejou rota de assinatura", "gestao_docs", doc.id, `${doc.codigo} — ${doc.titulo}`, { rota: rotaAtual }, { rota: updated.rota, invalidouRevisor: invalidaRev, invalidouAprovador: invalidaAprov });
    toast_("Rota de assinatura atualizada." + (invalidaRev||invalidaAprov ? " Assinatura(s) invalidada(s)." : ""), "green");
    setSel(updated);
    setModalTrocarRota(null);
  };

  // Distribuição física — registra entrega de cópia controlada impressa a um setor.
  const registrarDistribuicao = async (doc) => {
    const area = areaDistribPorId(distribForm.areaId);
    const setor = area?.setores?.find(sx => sx.id === distribForm.setorId && sx.ativo !== false);
    if (!area) { alert("Selecione a área que recebeu a cópia."); return; }
    if (distribForm.tipoDestino === "setor" && !setor) { alert("Selecione o setor que recebeu a cópia."); return; }
    const destinoKey = distribForm.tipoDestino === "area" ? `area:${area.id}` : `setor:${area.id}:${setor.id}`;
    const lista = doc.distribuicaoFisica || [];
    if (lista.some(x => x.destinoKey === destinoKey)) { alert("Este destino já tem cópia controlada registrada."); return; }
    const nova = { destinoKey, tipoDestino:distribForm.tipoDestino, areaId:area.id, areaNome:area.label, setorId:setor?.id || null, setorNome:setor?.nome || null, setor:distribForm.tipoDestino === "area" ? area.id : `${area.id}/${setor.id}`, dataEntrega: tod(), entreguePor: distribForm.entreguePor?.trim() || user?.name || "" };
    const updated = { ...doc, distribuicaoFisica: [...lista, nova] };
    await saveCollection("gestao_docs", String(doc.id), updated);
    await auditLog("Registrou cópia física", "gestao_docs", doc.id, `${doc.codigo} — ${doc.titulo}`, null, { destino:destinoDistribLabel(nova), entreguePor: nova.entreguePor });
    toast_(`Cópia controlada registrada em ${destinoDistribLabel(nova)}.`, "green");
    setSel(updated);
    setModalDistribuir(null);
  };

  // Cópia recolhida/destruída — remove o setor da distribuição vigente.
  const removerDistribuicao = async (doc, destino) => {
    if (!window.confirm(`Confirmar recolha/destruição da cópia controlada de ${destinoDistribLabel(destino)}?`)) return;
    const updated = { ...doc, distribuicaoFisica: (doc.distribuicaoFisica||[]).filter(x => (x.destinoKey || `legado:${x.setor}`) !== (destino.destinoKey || `legado:${destino.setor}`)) };
    await saveCollection("gestao_docs", String(doc.id), updated);
    await auditLog("Recolheu cópia física", "gestao_docs", doc.id, `${doc.codigo} — ${doc.titulo}`, { destino:destinoDistribLabel(destino) }, null);
    toast_(`Cópia de ${destinoDistribLabel(destino)} recolhida.`, "green");
    setSel(updated);
  };

  // Pendência de recolha (após nova revisão) — marca o setor como recolhido.
  const marcarRecolhida = async (doc, destino) => {
    const pend = (doc.recolhaPendente||[]).filter(x => (x.destinoKey || `legado:${x.setor}`) !== (destino.destinoKey || `legado:${destino.setor}`));
    const updated = { ...doc, recolhaPendente: pend.length ? pend : null };
    await saveCollection("gestao_docs", String(doc.id), updated);
    await auditLog("Confirmou recolha de cópia obsoleta", "gestao_docs", doc.id, `${doc.codigo} — ${doc.titulo}`, { destino:destinoDistribLabel(destino) }, null);
    toast_(`Recolha da cópia obsoleta confirmada: ${destinoDistribLabel(destino)}.`, "green");
    setSel(updated);
  };

  const solicitarRevisao = async (doc) => {
    try {
    if (!window.confirm("Criar nova revisão? A versão atual será arquivada no histórico.")) return;
    const versaoAtual = doc.versao || "01";
    const novaVersao  = String(parseInt(versaoAtual,10)+1).padStart(2,"0");
    const motivo      = window.prompt("Motivo da revisão:", "") || "";
    const itemModificadoRaw = window.prompt("Item modificado nesta revisão (ex: Item 5.2, Anexo I, Fluxo de aprovação):", "");
    if (itemModificadoRaw === null) return;
    const itemModificado = itemModificadoRaw.trim();
    if (!itemModificado) {
      alert("Informe o item modificado para iniciar a nova revisão.");
      return;
    }
    const descricaoRaw = window.prompt("Descrição da alteração desta revisão:", "");
    if (descricaoRaw === null) return;
    const descricao = descricaoRaw.trim();
    if (!descricao) {
      alert("Informe a descrição da alteração para iniciar a nova revisão.");
      return;
    }
    const aprovador   = window.prompt("Aprovador desta revisão:", "") || "";
    // Snapshot do conteúdo completo da versão que está sendo arquivada (rastreabilidade BPF).
    const snapshotConteudo = { titulo: doc.titulo, etapas: doc.etapas||[], materiais: doc.materiais||[], arquivo: doc.arquivo || null, arquivoFonte: doc.arquivoFonte || null };
    CAPITULOS_GD.filter(c=>!c.special).forEach(c=>{ snapshotConteudo[c.id] = doc[c.id] ?? ""; });
    // Confirmação de leitura é sempre da versão lida: as confirmações da versão que
    // está sendo arquivada ficam no histórico (evidência BPF de quem leu a Rev. anterior).
    const leituraAnterior = doc.leituraObrigatoria || null;
    const historico   = [...(doc.historicoRevisoes||[]), {
      versao: versaoAtual,
      versaoAlvo: novaVersao,
      status: doc.status,
      data:   doc.atualizadoEm||doc.criadoEm,
      responsavel: doc.atualizadoPor||doc.criadoPor,
      motivo,
      itemModificado,
      descricao,
      aprovador,
      conteudo: snapshotConteudo,
      leituraObrigatoria: leituraAnterior,
    }];
    // ...e a nova revisão reabre a leitura para os mesmos designados. Sem isto, quem
    // confirmou a Rev. anterior seguia exibido como "✓ Confirmado" numa versão que
    // nunca leu — registro de treinamento falso num documento controlado.
    const leituraReaberta = reabrirLeitura(leituraAnterior, { novaVersao, hoje: tod(), por: user?.name });
    // Arquivo controlado (PDF) da versão anterior fica no snapshot; nova revisão exige novo upload.
    // O arquivo fonte é mantido: o elaborador baixa o fonte anterior, edita e substitui.
    // Cópias físicas da versão anterior viram pendência de recolha na nova revisão.
    const copiasAnteriores = doc.distribuicaoFisica || [];
    const recolhaPendente = copiasAnteriores.length
      ? [...(doc.recolhaPendente||[]), ...copiasAnteriores.map(c => ({ ...c, versaoAnterior: versaoAtual }))]
      : (doc.recolhaPendente || null);
    const updated = { ...doc, versao:novaVersao, status:"Em Revisão", arquivo:null, arquivoFonte: doc.arquivoFonte || null, assinaturaElaborador:null, assinaturaRevisor:null, assinaturaAprovador:null, rota:null, distribuicaoFisica:[], recolhaPendente, leituraObrigatoria:leituraReaberta,
      // A exigência de treinamento continua valendo, mas o relógio do prazo só
      // recomeça quando a nova versão entrar em vigor (a evidência já é por versão).
      treinamento: doc.treinamento ? { ...doc.treinamento, desdeEm: null } : doc.treinamento,
      historicoRevisoes:historico, proximaRevisao:calcProximaRevisaoGD(tod(), prazoRevisaoTipo(doc.tipo, tiposRevisao)), atualizadoEm:tod(), atualizadoTs:Date.now(), atualizadoPor:user?.name };
    await saveCollection("gestao_docs", String(doc.id), updated);
    await auditLog(`Nova Revisão — Rev.${novaVersao}`, "gestao_docs", doc.id, `${doc.codigo} — ${doc.titulo}`, { versao: versaoAtual, status: doc.status }, { versao: novaVersao, status: "Em Revisão", leituraReaberta: leituraReaberta?.atribuido ? (leituraReaberta.designados||[]).length : 0 });
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

  // Fase 9 — revisão periódica sem alterações: confirma que o documento foi
  // revisado e continua válido, reagendando a próxima revisão.
  const revisarSemAlteracoes = async (doc) => {
    try {
      const obs = window.prompt("Observações da revisão (opcional):", "") || "";
      const revisaoRegistrada = { data: tod(), responsavel: user?.name || "", obs };
      const novaProxima = calcProximaRevisaoGD(tod(), prazoRevisaoTipo(doc.tipo, tiposRevisao));
      const updated = { ...doc, revisaoRegistrada, proximaRevisao: novaProxima, atualizadoEm: tod(), atualizadoTs: Date.now(), atualizadoPor: user?.name };
      await saveCollection("gestao_docs", String(doc.id), updated);
      await auditLog("Revisão sem alterações", "gestao_docs", doc.id, `${doc.codigo} — ${doc.titulo}`, { proximaRevisao: doc.proximaRevisao }, { proximaRevisao: novaProxima, responsavel: revisaoRegistrada.responsavel });
      toast_(`Revisão registrada. Próxima revisão: ${fmt(novaProxima)}.`, "green");
      setSel(updated);
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  // Recusa de documento pelo Revisor ou Aprovador: registra apontamentos estruturados,
  // invalida as assinaturas da revisão e devolve o documento a "Rascunho" para o elaborador
  // corrigir e reiniciar a rota. Não abre RNC (devolução em rota é retrabalho, não NC formal).
  const recusarDoc = async (doc, papel) => {
    const itens = apontamentosForm
      .map(a => ({ secao: a.secao || "Geral", descricao: (a.descricao || "").trim() }))
      .filter(a => a.descricao);
    if (!itens.length) { toast_("Adicione ao menos um apontamento com a descrição do problema.", "red"); return; }
    try {
      const papelLabel = papel === "aprovador" ? "Aprovador" : "Revisor";
      const apontamentos = itens.map((a, i) => ({
        id: `${Date.now()}-${i}`,
        autor: user?.name || "",
        autorPapel: papel,
        data: new Date().toISOString(),
        secao: a.secao,
        descricao: a.descricao,
        resolvido: false,
      }));
      // Volta a Rascunho; invalida assinaturas; mantém a rota (mesmos designados reiniciam o ciclo).
      const updated = {
        ...doc,
        status: "Rascunho",
        assinaturaElaborador: null,
        assinaturaRevisor: null,
        assinaturaAprovador: null,
        apontamentos,
        atualizadoEm: tod(), atualizadoTs: Date.now(), atualizadoPor: user?.name,
      };
      await saveCollection("gestao_docs", String(doc.id), updated);
      await auditLog(`Recusou Documento (${papelLabel})`, "gestao_docs", doc.id, `${doc.codigo} — ${doc.titulo}`, { status: doc.status }, { status: "Rascunho", apontamentos });
      toast_(`Documento recusado pelo ${papelLabel} — voltou para Rascunho com ${itens.length} apontamento(s).`, "green");
      setRejeicaoModal(null);
      setApontamentosForm([{ secao:"Geral", descricao:"" }]);
      setSel(updated);
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const deletar = async (id) => {
    try {
    const doc = docs.find(x => String(x.id) === String(id)) || sel;
    // Documento controlado: uma vez Vigente (ou Obsoleto), o código fica
    // permanentemente associado a ele e não pode ser excluído (rastreabilidade BPF).
    const jaFoiVigente = doc?.historicoRevisoes?.length > 0 || ["Vigente","Obsoleto"].includes(doc?.status);
    if (jaFoiVigente) {
      alert("Documento controlado não pode ser excluído.\n\nDocumentos que já entraram em vigência devem ser arquivados como Obsoleto (botão 🗄️), preservando a rastreabilidade exigida em BPF.");
      return;
    }
    const jaAssinado = !!(doc?.assinaturaElaborador || doc?.assinaturaRevisor || doc?.assinaturaAprovador);
    const aviso = jaAssinado
      ? `Excluir permanentemente este documento (${doc?.codigo})?\n\nEle já possui assinatura(s), mas nunca chegou a Vigente. A exclusão remove o registro e LIBERA o código "${doc?.codigo}" para uso em um novo documento.\n\nEsta ação não pode ser desfeita.`
      : "Excluir este rascunho permanentemente? Esta ação não pode ser desfeita.";
    if (!window.confirm(aviso)) return;
    await deleteFromCollection("gestao_docs", String(id));
    await auditLog(jaAssinado ? "Excluiu Documento (não vigente)" : "Excluiu Rascunho", "gestao_docs", id, doc?.codigo ? `${doc.codigo} — ${doc.titulo}` : String(id), doc || null, null);
    toast_("Documento excluído.", "red");
    setSel(null); setView("lista");
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  // ── Treinamento por cargo (Fase 2) ────────────────────────────────────────
  // Salva a exigência no documento. `desdeEm` marca desde quando ela vale para a
  // versão vigente — é o relógio do prazo e do atraso na matriz.
  const salvarExigencia = async (doc, cfg) => {
    try {
      const treinamento = {
        exigido: !!cfg.exigido,
        modo: cfg.modo || "leitura",
        cargos: cfg.cargos || [],
        setores: cfg.setores || [],
        pessoasExtra: cfg.pessoasExtra || [],
        prazoDias: Number(cfg.prazoDias) || PRAZO_TREINAMENTO_PADRAO,
        reciclagemMeses: Number(cfg.reciclagemMeses) || null,
        desdeEm: doc.treinamento?.desdeEm || tod(),
        definidoPor: user?.name || "",
        definidoEm: tod(),
      };
      const updated = { ...doc, treinamento };
      await saveCollection("gestao_docs", String(doc.id), updated);
      await auditLog("Configurou Treinamento", "gestao_docs", doc.id, `${doc.codigo} — ${doc.titulo}`, doc.treinamento || null, treinamento);
      toast_(treinamento.exigido ? "Exigência de treinamento salva!" : "Exigência de treinamento removida.", "green");
      setSel(updated); setEditTreino(null);
    } catch(e) { toast_(fbErr(e), "red"); console.error(e); }
  };

  // Registra a evidência — a própria pessoa confirmando leitura, ou o instrutor
  // lançando um presencial. Formato único via `novaEvidencia`.
  const registrarEvidencia = async (doc, alvoUserId, { modo, dataRealizacao, obs }) => {
    try {
      // Busca no cadastro de pessoas, não em `users`: quem é treinado pode não ter login.
      const alvo = (colaboradores || []).find(c => String(c.id) === String(alvoUserId));
      if (!alvo) { toast_("Selecione o colaborador.", "red"); return; }
      const ex = exigidosDoDocumento(doc, colaboradores, catalogoCargos, catalogoAreasSetoresDistribuicao).find(e => e.userId === String(alvoUserId));
      const ev = novaEvidencia({
        doc, user: { id: alvo.id, name: alvo.nome || alvo.name }, cargoNome: ex?.cargoNome || alvo.cargoNome, modo,
        dataRealizacao: dataRealizacao || tod(), obs, registradoPor: user?.name,
      });
      await saveCollection("treinamentos", ev.id, ev);
      await auditLog(modo === "leitura" ? "Confirmou Treinamento" : "Registrou Treinamento", "treinamentos", ev.id,
        `${doc.codigo} Rev.${doc.versao} — ${alvo.nome || alvo.name}`, null, { docId: doc.id, versao: doc.versao, modo });
      toast_("Treinamento registrado!", "green");
      setNovaEvid({ userId:"", dataRealizacao:tod(), obs:"" });
    } catch(e) { toast_(fbErr(e), "red"); console.error(e); }
  };


  const gerarComIA = async () => {
    if (!form.titulo || !form.tipo) { alert("Preencha título e tipo antes de usar a IA."); return; }
    setAiLoading(true);
    try {
      const tipoLabel  = tiposAtivos.find(t=>t.id===form.tipo)?.label || form.tipo;
      const deptoLabel = deptosAtivos.find(d=>d.id===form.depto)?.label || form.depto;
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
    const tipo  = tipoInfo(doc.tipo);
    const cor   = tipo?.cor || "#2ab84a";
    // Seção 18 — marca d'água: obsoleto em vermelho, demais "cópia não controlada" em cinza.
    const obsoleto = doc.status === "Obsoleto";
    const wmTexto = obsoleto ? "DOCUMENTO OBSOLETO" : "CÓPIA NÃO CONTROLADA";
    const wmCor   = obsoleto ? "#ff4f6a" : "#888888";
    const wmHTML  = `<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-family:Arial,sans-serif;font-size:72px;font-weight:bold;color:${wmCor};opacity:.13;pointer-events:none;white-space:nowrap;z-index:9999;letter-spacing:.05em;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${wmTexto}</div>`;
    const assHTML = (ass,label) => ass
      ? `<div style="padding:10px 12px;border:1px solid ${cor}40;border-radius:8px;background:#fafdfb;"><div style="font-size:8px;letter-spacing:.08em;color:${cor};text-transform:uppercase;font-weight:bold;margin-bottom:6px;">${label}</div><div style="font-size:12px;font-weight:bold;color:#1a3a28;">${ass.nome||"—"}</div>${ass.cargo?`<div style="font-size:10px;color:#555;">${ass.cargo}</div>`:""}${ass.setor?`<div style="font-size:9px;color:#777;">Setor: ${ass.setor}</div>`:""}${(ass.registroProfissional||ass.crf)?`<div style="font-size:9px;color:#777;">Registro profissional: ${ass.registroProfissional||ass.crf}</div>`:""}${ass.email?`<div style="font-size:9px;color:#777;">${ass.email}</div>`:""}<div style="margin-top:6px;padding-top:6px;border-top:1px dashed ${cor}40;font-size:9px;color:#555;">✔ Assinado eletronicamente em ${ass.timestamp?new Date(ass.timestamp).toLocaleString("pt-BR"):ass.dataHora||""}</div><div style="font-size:8px;color:#555;margin-top:3px;font-family:monospace;">Cód. verificação: ${sigCodigo(ass, `${doc.codigo}|R${doc.versao}`)}</div>${ass.hash?`<div style="font-size:7px;color:#666;margin-top:2px;font-family:monospace;">Hash: ${String(ass.hash).slice(0,24)}...</div>`:""}</div>`
      : `<div style="text-align:center;padding:10px;border:1px dashed #bbb;border-radius:6px;background:#fafafa;"><div style="font-size:9px;color:#666;text-transform:uppercase;">${label}</div><div style="font-size:11px;color:#888;padding:8px 0;">Aguardando</div></div>`;
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
      + `<div style="background:linear-gradient(135deg,#1a4a2e,${cor});padding:12px 22px;display:flex;align-items:center;justify-content:space-between;gap:18px;"><div style="display:flex;align-items:center;min-width:0;"><img src="${window.location.origin}${HERBAMED_INFO_GD.logo}" alt="Herbamed" style="width:150px;max-height:46px;object-fit:contain;display:block;"/></div><div style="text-align:right;"><div style="color:#fff;font-size:12px;font-weight:bold;">${tipo?.label||doc.tipo}</div><div style="color:#9fd4b2;font-size:11px;">${doc.codigo} · Rev.${doc.versao}</div></div></div>`
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

  const filtrados = docsVisiveis.filter(d => {
    if (filtroTipo   !== "todos" && d.tipo   !== filtroTipo)   return false;
    if (filtroDepto  !== "todos" && d.depto  !== filtroDepto)  return false;
    if (filtroStatus !== "todos" && d.status !== filtroStatus) return false;
    if (buscaTxt && !`${d.codigo||""} ${d.titulo||""}`.toLowerCase().includes(buscaTxt.toLowerCase())) return false;
    return true;
  });

  const listaVigentesObsoletos = docsVisiveis.filter(d => ["Vigente", "Obsoleto"].includes(d.status));
  const lmFiltrados = listaVigentesObsoletos.filter(d => {
    if (lmFiltroStatus !== "todos" && d.status !== lmFiltroStatus) return false;
    if (lmFiltroDepto !== "todos" && d.depto !== lmFiltroDepto) return false;
    if (lmBusca && !`${d.codigo||""} ${d.titulo||""}`.toLowerCase().includes(lmBusca.toLowerCase())) return false;
    return true;
  });

  const exportarListaMestraCSV = () => {
    const linhas = [];
    linhas.push(["Código", "Título", "Versão", "Departamento", "Data Última Revisão", "Próxima Revisão", "Cópias Físicas", "Status"].join(","));
    lmFiltrados.forEach(d => {
      linhas.push([
        `"${d.codigo || ""}"`,
        `"${(d.titulo || "").replace(/"/g, '""')}"`,
        d.versao || "",
        d.depto || "",
        d.atualizadoEm || "",
        d.proximaRevisao || "",
        `"${(d.distribuicaoFisica||[]).map(destinoDistribLabel).join(", ")}"`,
        d.status || "",
      ].join(","));
    });
    const csv = linhas.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `ListaMestra_${tod()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    toast_("Lista Mestra exportada em CSV!", "green");
  };

  const exportarListaMestraXLSX = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Lista Mestra");

      const headers = ["Código", "Título", "Versão", "Depto", "Data Última Revisão", "Próxima Revisão", "Cópias Físicas", "Status"];
      const headerRow = worksheet.addRow(headers);

      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD3D3D3" } };
      headerRow.alignment = { horizontal: "center", vertical: "center" };

      headers.forEach(h => {
        const col = worksheet.getColumn(headers.indexOf(h) + 1);
        col.border = { top: { style: "thin", color: { argb: "FF808080" } }, bottom: { style: "thin", color: { argb: "FF808080" } }, left: { style: "thin", color: { argb: "FF808080" } }, right: { style: "thin", color: { argb: "FF808080" } } };
      });

      lmFiltrados.forEach((d, idx) => {
        const row = worksheet.addRow([
          d.codigo || "",
          d.titulo || "",
          `Rev.${d.versao || ""}`,
          d.depto || "",
          fmt(d.atualizadoEm) || "",
          fmt(d.proximaRevisao) || "",
          (d.distribuicaoFisica||[]).map(destinoDistribLabel).join(", "),
          d.status || "",
        ]);

        if (idx % 2 === 1) {
          row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F0F0" } };
        }

        row.eachCell((cell) => {
          cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
          cell.alignment = { horizontal: "left", vertical: "center" };
        });
      });

      worksheet.views = [{ state: "frozen", ySplit: 1 }];

      const columns = [
        { header: "Código", key: "codigo", width: 15 },
        { header: "Título", key: "titulo", width: 35 },
        { header: "Versão", key: "versao", width: 10 },
        { header: "Depto", key: "depto", width: 12 },
        { header: "Data Última Revisão", key: "atualizadoEm", width: 18 },
        { header: "Próxima Revisão", key: "proximaRevisao", width: 18 },
        { header: "Cópias Físicas", key: "copiasFisicas", width: 22 },
        { header: "Status", key: "status", width: 12 },
      ];

      columns.forEach((col, idx) => {
        worksheet.getColumn(idx + 1).width = col.width;
      });

      const footerRow = worksheet.addRow([]);
      const currentDateTime = new Date().toLocaleString("pt-BR");
      footerRow.getCell(1).value = `Gerado em ${currentDateTime} pelo SGQ Herbamed`;
      footerRow.getCell(1).font = { italic: true, size: 10, color: { argb: "FF888888" } };
      worksheet.mergeCells(`A${footerRow.number}:H${footerRow.number}`);

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `Lista-Mestra-${tod()}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      toast_("Lista Mestra exportada em XLSX!", "green");
    } catch (e) {
      toast_("Erro ao exportar XLSX.", "red");
      console.error(e);
    }
  };
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

  // Modal de recusa (Revisor/Aprovador) — renderizado tanto na lista quanto no detalhe,
  // já que os botões "Recusar" vivem na tela de detalhe (que tem return próprio).
  const recusaModal = rejeicaoModal?.show && (() => {
    const papelLabel = rejeicaoModal.papel === "aprovador" ? "Aprovador" : "Revisor";
    const setItem = (i, campo, val) => setApontamentosForm(arr => arr.map((a,idx)=> idx===i ? { ...a, [campo]: val } : a));
    const addItem = () => setApontamentosForm(arr => [...arr, { secao:"Geral", descricao:"" }]);
    const rmItem  = (i) => setApontamentosForm(arr => arr.length>1 ? arr.filter((_,idx)=>idx!==i) : arr);
    const temItem = apontamentosForm.some(a => (a.descricao||"").trim());
    const fechar  = () => { setRejeicaoModal(null); setApontamentosForm([{ secao:"Geral", descricao:"" }]); };
    return (
      <div onClick={fechar} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:"24px 16px"}}>
        <div onClick={e=>e.stopPropagation()} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:14,maxWidth:560,width:"100%",maxHeight:"90vh",overflowY:"auto",padding:"1.5rem",boxShadow:"0 20px 60px rgba(0,0,0,.4)"}}>
          <div style={{fontSize:16,fontWeight:700,color:T.text,marginBottom:6}}>❌ Recusar documento ({papelLabel})</div>
          <div style={{fontSize:12,color:T.text2,marginBottom:4}}>{rejeicaoModal.doc?.codigo} Rev.{rejeicaoModal.doc?.versao} — {rejeicaoModal.doc?.titulo}</div>
          <div style={{fontSize:11,color:T.text3,marginBottom:16}}>Aponte os erros/mudanças por seção. O documento volta para <strong>Rascunho</strong>, as assinaturas desta revisão são invalidadas e o elaborador corrige antes de reiniciar a rota.</div>
          <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:12}}>
            {apontamentosForm.map((a,i)=>(
              <div key={i} style={{background:T.surf,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 12px"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                  <span style={{fontSize:11,color:T.text3,fontWeight:700}}>#{i+1}</span>
                  <select value={a.secao} onChange={e=>setItem(i,"secao",e.target.value)}
                    style={{...s.inp,flex:1,fontSize:12,padding:"6px 8px",color:T.text,background:T.bg,border:`1px solid ${T.border}`}}>
                    {SECOES_DOC.map(sec=> <option key={sec} value={sec}>{sec}</option>)}
                  </select>
                  {apontamentosForm.length>1 && <button style={{...s.btn,fontSize:11,padding:"4px 8px"}} onClick={()=>rmItem(i)}>🗑️</button>}
                </div>
                <textarea placeholder="Descreva o problema e o que precisa mudar" value={a.descricao} onChange={e=>setItem(i,"descricao",e.target.value)}
                  style={{...s.inp,width:"100%",fontSize:13,padding:"8px 10px",boxSizing:"border-box",minHeight:64,fontFamily:"inherit",color:T.text,background:T.bg,border:`1px solid ${T.border}`}} />
              </div>
            ))}
          </div>
          <button style={{...s.btn,fontSize:12,marginBottom:16}} onClick={addItem}>＋ Adicionar apontamento</button>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <button style={s.btn} onClick={fechar}>Cancelar</button>
            <button style={{...s.btnD,opacity:!temItem?0.5:1,cursor:!temItem?"not-allowed":"pointer"}} disabled={!temItem} onClick={()=>recusarDoc(rejeicaoModal.doc, rejeicaoModal.papel)}>
              ❌ Recusar e devolver
            </button>
          </div>
        </div>
      </div>
    );
  })();

  /* ── DETALHE ── */
  if (view==="detalhe" && sel) {
    const d = docs.find(x=>x.id===sel.id)||sel;
    const tipo  = tipoInfo(d.tipo);
    const depto = deptoInfo(d.depto);
    const diasRev = diasParaRevisaoGD(d.proximaRevisao);
    const mesmoAssinante = (ass) => !!ass && ((ass.email && user?.email && ass.email===user.email) || (!ass.email && ass.nome===user?.name));
    const podeAssElab  = !d.assinaturaElaborador && (isAdmin || d.criadoPor===user?.name);
    // Rota de assinatura: Revisor/Aprovador travados ao designado pelo Elaborador.
    // Admin (estrito) pode assinar como override caso necessário. Segregação sempre vale.
    const souDesignado = (uid) => String(uid||"") === String(user?.id||"");
    const podeAssRev   = d.assinaturaElaborador && !d.assinaturaRevisor && (souDesignado(d.rota?.revisorId) || isAdminStrict) && !mesmoAssinante(d.assinaturaElaborador);
    const podeAssAprov = d.assinaturaRevisor && !d.assinaturaAprovador && (souDesignado(d.rota?.aprovadorId) || isAdminStrict) && !mesmoAssinante(d.assinaturaElaborador) && !mesmoAssinante(d.assinaturaRevisor);
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
          <button style={s.btn} onClick={()=>setView("lista")}>← Voltar</button>
          <div style={{flex:1}}>
            <div style={{fontSize:11,color:T.text3}}>{d.codigo} · Rev.{d.versao}</div>
            <div style={{fontSize:16,fontWeight:700,color:T.text}}>{d.titulo}</div>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {podeAssElab  && <button disabled={!d.arquivo} title={!d.arquivo?"Anexe o PDF antes de assinar":undefined} style={{...s.btnA,fontSize:11,...(!d.arquivo?{opacity:0.5,cursor:"not-allowed"}:{})}} onClick={()=>{ setRotaForm({ revisorId:d.rota?.revisorId||"", aprovadorId:d.rota?.aprovadorId||"" }); setModalRota({ doc:d }); }}>✍️ Elaborador</button>}
            {podeAssRev   && <button disabled={!d.arquivo} title={!d.arquivo?"Anexe o PDF antes de assinar":undefined} style={{...s.btnA,fontSize:11,background:T.blue||"#4fc3f7",...(!d.arquivo?{opacity:0.5,cursor:"not-allowed"}:{})}} onClick={()=>setAssinarGD({doc:d,papel:"revisor"})}>🔎 Revisor</button>}
            {podeAssRev   && <button style={{...s.btnD,fontSize:11}} onClick={()=>{ setApontamentosForm([{secao:"Geral",descricao:""}]); setRejeicaoModal({doc:d,papel:"revisor",show:true}); }}>❌ Recusar</button>}
            {podeAssAprov && <button disabled={!d.arquivo} title={!d.arquivo?"Anexe o PDF antes de assinar":undefined} style={{...s.btnA,fontSize:11,background:T.orange||"#ff9800",...(!d.arquivo?{opacity:0.5,cursor:"not-allowed"}:{})}} onClick={()=>setAssinarGD({doc:d,papel:"aprovador"})}>✅ Aprovador</button>}
            {podeAssAprov && d.status==="Aguardando Aprovação" && <button style={{...s.btnD,fontSize:11}} onClick={()=>{ setApontamentosForm([{secao:"Geral",descricao:""}]); setRejeicaoModal({doc:d,papel:"aprovador",show:true}); }}>❌ Recusar</button>}
            {podeIniciarRevisao && (d.status==="Vigente"||d.status==="Aguardando Vigência") && <button style={{...s.btn,fontSize:11}} onClick={()=>solicitarRevisao(d)}>🔄 Nova Revisão</button>}
            {podeTornarObsoleto && (d.status==="Vigente"||d.status==="Aguardando Vigência") && <button style={{...s.btnD,fontSize:11}} onClick={()=>tornarObsoleto(d)}>🗄️ Obsoleto</button>}
            <button style={{...s.btn,fontSize:11}} onClick={()=>exportPDF(d)}>🖨️ Folha de Rosto</button>
            {!isViewer && d.status!=="Vigente" && <button style={{...s.btn,fontSize:11}} onClick={()=>{ setSel(d); setForm({tipo:d.tipo,depto:d.depto,titulo:d.titulo,versao:d.versao,objetivo:d.objetivo||"",alcance:d.alcance||"",responsabilidades:d.responsabilidades||"",definicoes:d.definicoes||"",procedimento:d.procedimento||"",infComplementares:d.infComplementares||"N/A",referencias:d.referencias||"",registros:d.registros||"",anexos:d.anexos||"N/A",etapas:d.etapas||[],materiais:d.materiais||[],obs:d.obs||"",treinamentoObrigatorio:d.treinamentoObrigatorio||false,proximaRevisao:d.proximaRevisao||"",historicoRevisoes:d.historicoRevisoes||[],dataVigencia:d.dataVigencia||""}); setDocArquivo(d.arquivo||null); setDocArquivoFonte(d.arquivoFonte||null); setCapitulosAberto(false); setView("novo"); }}>✏️ Editar</button>}
            {isAdmin && !["Vigente","Aguardando Vigência","Obsoleto"].includes(d.status) && !(d.historicoRevisoes?.length>0) && <button style={{...s.btnD,fontSize:11}} onClick={()=>deletar(d.id)}>🗑️ Excluir</button>}
          </div>
        </div>
        {d.status==="Aguardando Vigência" && d.dataVigencia && (
          <div style={{background:"#a78bfa18",border:"1px solid #a78bfa44",borderRadius:10,padding:"12px 16px",marginBottom:12,fontSize:13,color:"#a78bfa",fontWeight:700,display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:20}}>📅</span>
            <div>
              <div>Documento aprovado — vigência agendada para <strong>{fmt(d.dataVigencia)}</strong></div>
              <div style={{fontSize:11,fontWeight:400,marginTop:2}}>O documento ficará Vigente automaticamente nesta data.</div>
            </div>
          </div>
        )}
        {d.apontamentos?.length>0 && ["Rascunho","Em Revisão"].includes(d.status) && (
          <div style={{background:"#ff4f6a14",border:"1px solid #ff4f6a44",borderRadius:10,padding:"12px 16px",marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:700,color:"#ff4f6a",display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <span style={{fontSize:18}}>❌</span> Documento recusado — {d.apontamentos.length} apontamento(s) a corrigir
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {d.apontamentos.map((a,i)=>(
                <div key={a.id||i} style={{background:T.surf,borderRadius:8,padding:"8px 12px",borderLeft:"3px solid #ff4f6a"}}>
                  <div style={{fontSize:10,color:T.text3,fontWeight:700,textTransform:"uppercase",marginBottom:3,display:"flex",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}>
                    <span>{a.secao||"Geral"}</span>
                    <span style={{color:T.text3,fontWeight:400,textTransform:"none"}}>{a.autor||"—"} · {a.autorPapel==="aprovador"?"Aprovador":"Revisor"}{a.data?` · ${fmt(a.data)}`:""}</span>
                  </div>
                  <div style={{fontSize:13,color:T.text}}>{a.descricao}</div>
                </div>
              ))}
            </div>
            <div style={{fontSize:11,color:T.text3,marginTop:8}}>Corrija o conteúdo, anexe o PDF revisado e reassine como Elaborador para reiniciar a rota.</div>
          </div>
        )}
        {diasRev!==null && diasRev<=90 && d.status==="Vigente" && (
          <div style={{background:diasRev<=0?"#ff4f6a18":"#ffd16618",border:`1px solid ${diasRev<=0?"#ff4f6a":"#ffd166"}30`,borderRadius:10,padding:"10px 16px",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
            <span style={{fontSize:12,color:diasRev<=0?"#ff4f6a":"#ffd166",fontWeight:600}}>
              {diasRev<=0?`⚠️ Revisão vencida há ${Math.abs(diasRev)} dias!`:`⏰ Revisão necessária em ${diasRev} dias (${fmt(d.proximaRevisao)})`}
            </span>
            {diasRev<=30 && podeIniciarRevisao && (
              <button style={{...s.btnA,fontSize:11}} onClick={()=>revisarSemAlteracoes(d)}>✓ Revisar (sem alterações)</button>
            )}
          </div>
        )}
        {d.revisaoRegistrada && d.status==="Vigente" && (!diasRev || diasRev>30) && (
          <div style={{background:T.accentDim,border:`1px solid ${T.accent}30`,borderRadius:10,padding:"10px 16px",marginBottom:12,fontSize:12,color:T.accent,fontWeight:600}}>
            ✓ Revisão registrada em {fmt(d.revisaoRegistrada.data)}{d.revisaoRegistrada.responsavel?` por ${d.revisaoRegistrada.responsavel}`:""}{d.revisaoRegistrada.obs?` — ${d.revisaoRegistrada.obs}`:""}
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
            <BadgeTipoGD tipo={d.tipo} tipos={tiposAtivos} />
            <BadgeStatusGD status={d.status} />
            {(d.treinamento?.exigido || d.treinamentoObrigatorio) && <span style={{fontSize:10,padding:"3px 10px",borderRadius:20,background:(T.blue||"#4fc3f7")+"20",color:T.blue||"#4fc3f7",fontWeight:700}}>📚 Treinamento Obrigatório</span>}
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
                <BotoesArquivoRender d={d} s={s} T={T} podeBaixarCopia={podeBaixarCopiaNaoControlada} userName={user?.name} acessoRestrito={acessoRestritoVigente} />
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

        {/* ── FORMULÁRIO EM EXCEL PARA O FORNECEDOR ──
            Documento que é formulário precisa ir ao fornecedor em formato
            preenchível. O PDF não serve (não é editável) e o arquivo fonte cru
            sai anônimo — sem código nem revisão, impossível de amarrar ao
            documento controlado. O servidor carimba o fonte e registra quem
            emitiu, no mesmo log das cópias não controladas. */}
        {podeBaixarCopiaNaoControlada && d.status==="Vigente" && /\.xlsx?$/i.test(d.arquivoFonte?.nome || "") && (
          <div style={s.card}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
              <SecTitle icon="📗" ch="Formulário para fornecedor" />
              <span style={{ fontSize:10, fontWeight:700, padding:"3px 10px", borderRadius:20, background:"#8a5a0022", color:"#8a5a00" }}>CÓPIA NÃO CONTROLADA</span>
            </div>
            <div style={{ fontSize:11, color:T.text3, marginTop:2, marginBottom:10 }}>
              Gera o Excel preenchível a partir do arquivo fonte, com a faixa verde de identificação
              no topo (logo, título e código/revisão) e a faixa de rodapé ao final — a mesma
              identidade do formulário em PDF. O formulário em si sai intacto. Anexe ao seu e-mail
              para o fornecedor preencher e devolver. A emissão fica registrada no log de distribuição.
            </div>
            <button
              onClick={()=>abrirArquivoAutenticado(`/api/documents/${encodeURIComponent(d.id)}/formulario.xlsx`, true, `${d.codigo||"Formulario"}_Rev${d.versao||"01"}.xlsx`)}
              style={{ ...s.btnA, fontSize:12 }}>
              📗 Gerar formulário em Excel
            </button>
          </div>
        )}

        {/* ── FASE 7: LOG DE DISTRIBUIÇÃO ── */}
        {(isAdmin || (perm?.("gerenciarTreinamento") ?? false)) && (
          <div style={s.card}>
            <SecTitle icon="📋" ch="Log de distribuição" />
            {distLogLoading ? (
              <div style={{ fontSize:12, color:T.text3, padding:"8px 0" }}>Carregando...</div>
            ) : distLog.length === 0 ? (
              <div style={{ fontSize:12, color:T.text3, textAlign:"center", padding:"1rem 0" }}>Nenhuma cópia distribuída ainda.</div>
            ) : (
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                  <thead>
                    <tr style={{ background:T.surf }}>
                      {["Data/Hora","Usuário","Modo"].map(h=>(
                        <th key={h} style={{ padding:"8px 10px", textAlign:"left", color:T.text3, fontWeight:700, fontSize:10, textTransform:"uppercase", borderBottom:`1px solid ${T.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {distLog.map((row,i)=>(
                      <tr key={row.id||i} style={{ borderBottom:`1px solid ${T.border}`, background:i%2===0?T.bg:T.surf }}>
                        <td style={{ padding:"7px 10px", color:T.text2 }}>{row.data_download ? new Date(row.data_download).toLocaleString("pt-BR") : "—"}</td>
                        <td style={{ padding:"7px 10px", color:T.text }}>{row.usuario_nome || "—"}</td>
                        <td style={{ padding:"7px 10px" }}>
                          <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:12,
                            background:row.modo==="formulario_fornecedor" ? "#8a5a0022" : T.border,
                            color:row.modo==="formulario_fornecedor" ? "#8a5a00" : T.text2 }}>
                            {row.modo==="formulario_fornecedor" ? "📗 formulário p/ fornecedor" : (row.modo || "—")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                  <BotoesArquivoRender d={d} s={s} T={T} podeBaixarCopia={podeBaixarCopiaNaoControlada} userName={user?.name} acessoRestrito={acessoRestritoVigente} />
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
                        <span style={{fontSize:12,fontWeight:700,color:T.text}}>Rev.{h.versaoAlvo||h.versao}</span>
                        {h.status&&<BadgeStatusGD status={h.status}/>}
                      </div>
                      <div style={{fontSize:11,color:T.text2,marginTop:2}}>
                        {fmt(h.data)} · {h.responsavel||"—"}{h.aprovador?` · Aprov.: ${h.aprovador}`:""}
                      </div>
                      {h.itemModificado&&<div style={{fontSize:11,color:T.text2,marginTop:2}}>Item modificado: {h.itemModificado}</div>}
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
          {d.rota && (
            <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",background:T.surf,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 12px",marginBottom:12}}>
              <span style={{fontSize:11,fontWeight:700,color:T.text3,textTransform:"uppercase"}}>🧭 Rota</span>
              <span style={{fontSize:12,color:T.text2}}>Revisor: <strong style={{color:T.text}}>{d.rota.revisorNome||nomeUsuario(d.rota.revisorId)||"—"}</strong></span>
              <span style={{fontSize:12,color:T.text2}}>Aprovador: <strong style={{color:T.text}}>{d.rota.aprovadorNome||nomeUsuario(d.rota.aprovadorId)||"—"}</strong></span>
              {d.rota.definidaPor && <span style={{fontSize:10,color:T.text3}}>definida por {d.rota.definidaPor}</span>}
              {isAdminStrict && d.status!=="Vigente" && d.status!=="Obsoleto" && (
                <button style={{...s.btn,fontSize:10,padding:"3px 8px",marginLeft:"auto"}} onClick={()=>{ setRotaForm({ revisorId:d.rota?.revisorId||"", aprovadorId:d.rota?.aprovadorId||"" }); setModalTrocarRota({ doc:d }); }}>🔧 Trocar designados</button>
              )}
            </div>
          )}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
            {[{campo:d.assinaturaElaborador,label:"Elaborador"},{campo:d.assinaturaRevisor,label:"Revisor"},{campo:d.assinaturaAprovador,label:"Aprovador"}].map(({campo,label})=>(
              <div key={label} style={{textAlign:"center",padding:"1rem",background:T.surf,borderRadius:10,border:`1px solid ${T.border}`}}>
                <div style={{fontSize:10,fontWeight:700,color:T.text3,textTransform:"uppercase",marginBottom:10}}>{label}</div>
                {campo?(<>
                  <div style={{fontSize:13,fontWeight:700,color:T.text}}>{campo.nome}</div>
                  {(campo.cargo||cargoCadastroAtual(campo))&&(
                    <div style={{fontSize:11,color:T.text2}} title={campo.cargo?"Cargo gravado na assinatura":"Cargo atual do cadastro — esta assinatura foi feita antes de o cargo existir no perfil"}>
                      {campo.cargo||cargoCadastroAtual(campo)}
                      {!campo.cargo&&<span style={{fontSize:9,color:T.text3}}> · cadastro atual</span>}
                    </div>
                  )}
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
        {/* ── PENDÊNCIA DE RECOLHA — cópias obsoletas após nova revisão ── */}
        {d.recolhaPendente?.length > 0 && (
          <div style={{...s.card, border:"1px solid #ff4f6a55", background:"#ff4f6a0d"}}>
            <SecTitle icon="⚠️" ch="Cópias obsoletas a recolher" />
            <div style={{fontSize:12,color:T.text2,marginBottom:10}}>
              Estes setores têm cópias impressas de versões anteriores que precisam ser recolhidas e destruídas antes de distribuir a nova versão.
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {d.recolhaPendente.map((p,i)=>{
                return (
                  <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:T.surf,border:`1px solid ${T.border}`,borderRadius:8}}>
                    <span style={{fontSize:18}}>📄</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600,color:T.text}}>{destinoDistribLabel(p)}</div>
                      <div style={{fontSize:11,color:T.text2}}>Cópia da Rev.{p.versaoAnterior} pendente de recolha</div>
                    </div>
                    {podeDistribuir && <button style={{...s.btnA,fontSize:11}} onClick={()=>marcarRecolhida(d,p)}>✓ Recolhida</button>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {/* ── DISTRIBUIÇÃO FÍSICA — cópias controladas impressas (só Vigente) ── */}
        {d.status==="Vigente" && (
          <div style={s.card}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10,marginBottom:4}}>
              <SecTitle icon="🗂️" ch="Distribuição de cópias físicas" />
              {podeDistribuir && <button style={{...s.btnA,fontSize:11}} onClick={()=>{ setDistribForm({ areaId:"", tipoDestino:"setor", setorId:"", entreguePor:user?.name||"" }); setModalDistribuir({ doc:d }); }}>+ Registrar cópia</button>}
            </div>
            <div style={{fontSize:11,color:T.text3,marginBottom:10}}>Setores com cópia controlada impressa da Rev.{d.versao}.</div>
            {(d.distribuicaoFisica||[]).length===0 ? (
              <div style={{fontSize:12,color:T.text3,padding:"0.5rem 0"}}>Nenhuma cópia física registrada.</div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {d.distribuicaoFisica.map((c,i)=>{
                  return (
                    <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:T.surf,border:`1px solid ${T.border}`,borderRadius:8}}>
                      <span style={{fontSize:18}}>🗂️</span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:600,color:T.text}}>{destinoDistribLabel(c)}</div>
                        <div style={{fontSize:11,color:T.text2}}>Entregue em {fmt(c.dataEntrega)} por {c.entreguePor||"—"}</div>
                      </div>
                      {podeDistribuir && <button style={{...s.btnD,fontSize:11}} onClick={()=>removerDistribuicao(d,c)}>🗑️ Recolher</button>}
                    </div>
                  );
                })}
              </div>
            )}
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
        {/* ── FASE 8: MODAL DE DATA DE VIGÊNCIA ── */}
        {modalVigencia && (
          <div onClick={()=>{}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:"24px 16px"}}>
            <div style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:14,maxWidth:420,width:"100%",padding:"1.5rem",boxShadow:"0 20px 60px rgba(0,0,0,.4)"}}>
              <div style={{fontSize:16,fontWeight:700,color:T.text,marginBottom:6}}>📅 Data de vigência</div>
              <div style={{fontSize:12,color:T.text2,marginBottom:16}}>
                Quando este documento deve entrar em vigor? Deixe em branco para vigência imediata.
              </div>
              <input type="date" value={dataVigenciaInput} onChange={e=>setDataVigenciaInput(e.target.value)} min={tod()}
                style={{...s.inp,width:"100%",fontSize:14,marginBottom:16,boxSizing:"border-box"}} />
              {dataVigenciaInput && dataVigenciaInput > tod() && (
                <div style={{background:"#a78bfa18",border:"1px solid #a78bfa44",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#a78bfa",marginBottom:16}}>
                  📅 Documento ficará como "Aguardando Vigência" até {fmt(dataVigenciaInput)}.
                </div>
              )}
              <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                <button style={s.btn} onClick={()=>modalVigencia.onConfirm("")}>Vigência imediata</button>
                <button style={s.btnA} onClick={()=>modalVigencia.onConfirm(dataVigenciaInput)}>
                  {dataVigenciaInput && dataVigenciaInput > tod() ? "📅 Agendar vigência" : "✅ Confirmar"}
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
            docId={assinarGD.doc.id}
            papel={assinarGD.papel==="elaborador"?"Elaborador":assinarGD.papel==="revisor"?"Revisor":"Aprovador"}
            onClose={()=>setAssinarGD(null)}
            onConfirm={(assin)=>confirmarAssinatura(assinarGD.doc, assinarGD.papel, assin)}
          />
        )}
        {/* ── ROTA DE ASSINATURA: Elaborador escolhe Revisor e Aprovador ── */}
        {/* ── REGISTRAR CÓPIA FÍSICA ── */}
        {modalDistribuir && (
          <div onClick={()=>setModalDistribuir(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",zIndex:9999,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"40px 16px",overflowY:"auto"}}>
            <div onClick={e=>e.stopPropagation()} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:14,maxWidth:480,width:"100%",padding:"1.5rem",boxShadow:"0 20px 60px rgba(0,0,0,.4)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <div style={{fontSize:16,fontWeight:700,color:T.text}}>🗂️ Registrar cópia física</div>
                <button style={{...s.btn,fontSize:11}} onClick={()=>setModalDistribuir(null)}>✕ Fechar</button>
              </div>
              <div style={{fontSize:12,color:T.text2,marginBottom:14}}>{modalDistribuir.doc.codigo} · Rev.{modalDistribuir.doc.versao} — registre o setor que recebeu a cópia controlada impressa.</div>
              <div style={{marginBottom:12}}>
                <label style={{fontSize:12,fontWeight:600,color:T.text,display:"block",marginBottom:4}}>Área</label>
                <select value={distribForm.areaId} onChange={e=>setDistribForm(p=>({...p,areaId:e.target.value,setorId:""}))} style={{...s.inp,fontSize:13,width:"100%"}}>
                  <option value="">Selecione a área…</option>
                  {areasDistribAtivas.map(area=><option key={area.id} value={area.id}>{area.id} — {area.label}</option>)}
                </select>
              </div>
              {distribForm.areaId && <div style={{marginBottom:12}}>
                <label style={{fontSize:12,fontWeight:600,color:T.text,display:"block",marginBottom:4}}>Destino</label>
                <select value={distribForm.tipoDestino} onChange={e=>setDistribForm(p=>({...p,tipoDestino:e.target.value,setorId:""}))} style={{...s.inp,fontSize:13,width:"100%"}}>
                  <option value="area">Toda a área</option><option value="setor">Setor específico</option>
                </select>
              </div>}
              {distribForm.areaId && distribForm.tipoDestino==="setor" && <div style={{marginBottom:12}}>
                <label style={{fontSize:12,fontWeight:600,color:T.text,display:"block",marginBottom:4}}>Setor</label>
                <select value={distribForm.setorId} onChange={e=>setDistribForm(p=>({...p,setorId:e.target.value}))} style={{...s.inp,fontSize:13,width:"100%"}}>
                  <option value="">Selecione o setor…</option>
                  {(areaDistribPorId(distribForm.areaId)?.setores||[]).filter(sx=>sx.ativo!==false).map(sx=><option key={sx.id} value={sx.id}>{sx.nome}</option>)}
                </select>
              </div>}
              <div style={{marginBottom:16}}>
                <label style={{fontSize:12,fontWeight:600,color:T.text,display:"block",marginBottom:4}}>Entregue por</label>
                <input value={distribForm.entreguePor} onChange={e=>setDistribForm(p=>({...p,entreguePor:e.target.value}))} style={{...s.inp,fontSize:13,width:"100%"}} placeholder="Responsável pela entrega" />
              </div>
              <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                <button style={s.btn} onClick={()=>setModalDistribuir(null)}>Cancelar</button>
                <button style={s.btnA} onClick={()=>registrarDistribuicao(modalDistribuir.doc)}>Registrar</button>
              </div>
            </div>
          </div>
        )}
        {modalRota && (
          <div onClick={()=>setModalRota(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",zIndex:9999,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"40px 16px",overflowY:"auto"}}>
            <div onClick={e=>e.stopPropagation()} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:14,maxWidth:520,width:"100%",padding:"1.5rem",boxShadow:"0 20px 60px rgba(0,0,0,.4)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <div style={{fontSize:16,fontWeight:700,color:T.text}}>🧭 Rota de assinatura</div>
                <button style={{...s.btn,fontSize:11}} onClick={()=>setModalRota(null)}>✕ Fechar</button>
              </div>
              <div style={{fontSize:12,color:T.text2,marginBottom:14}}>{modalRota.doc.codigo} — {modalRota.doc.titulo}. Defina quem revisa e quem aprova. Só as pessoas escolhidas poderão assinar essas etapas.</div>
              <div style={{marginBottom:12}}>
                <label style={{fontSize:12,fontWeight:600,color:T.text,display:"block",marginBottom:4}}>🔎 Revisor</label>
                <select value={rotaForm.revisorId} onChange={e=>setRotaForm(p=>({...p,revisorId:e.target.value}))} style={{...s.inp,fontSize:13,width:"100%"}}>
                  <option value="">Selecione o revisor…</option>
                  {usuariosRevAprov.filter(u=>String(u.id)!==String(user?.id) && String(u.id)!==String(rotaForm.aprovadorId)).map(u=>(
                    <option key={u.id} value={u.id}>{u.name} · {u.setor||"—"}</option>
                  ))}
                </select>
              </div>
              <div style={{marginBottom:16}}>
                <label style={{fontSize:12,fontWeight:600,color:T.text,display:"block",marginBottom:4}}>✅ Aprovador</label>
                <select value={rotaForm.aprovadorId} onChange={e=>setRotaForm(p=>({...p,aprovadorId:e.target.value}))} style={{...s.inp,fontSize:13,width:"100%"}}>
                  <option value="">Selecione o aprovador…</option>
                  {usuariosRevAprov.filter(u=>String(u.id)!==String(user?.id) && String(u.id)!==String(rotaForm.revisorId)).map(u=>(
                    <option key={u.id} value={u.id}>{u.name} · {u.setor||"—"}</option>
                  ))}
                </select>
              </div>
              {usuariosRevAprov.length<2 && <div style={{fontSize:11,color:"#ff9800",marginBottom:12}}>⚠️ Há poucos usuários com permissão de Revisor/Aprovador. Configure as permissões no Admin.</div>}
              <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                <button style={s.btn} onClick={()=>setModalRota(null)}>Cancelar</button>
                <button style={s.btnA} onClick={()=>confirmarRota(modalRota.doc)}>Continuar para assinatura →</button>
              </div>
            </div>
          </div>
        )}
        {/* ── ROTA DE ASSINATURA: admin remaneja designados ── */}
        {modalTrocarRota && (
          <div onClick={()=>setModalTrocarRota(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",zIndex:9999,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"40px 16px",overflowY:"auto"}}>
            <div onClick={e=>e.stopPropagation()} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:14,maxWidth:520,width:"100%",padding:"1.5rem",boxShadow:"0 20px 60px rgba(0,0,0,.4)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <div style={{fontSize:16,fontWeight:700,color:T.text}}>🔧 Trocar designados (admin)</div>
                <button style={{...s.btn,fontSize:11}} onClick={()=>setModalTrocarRota(null)}>✕ Fechar</button>
              </div>
              <div style={{fontSize:12,color:T.text2,marginBottom:14}}>{modalTrocarRota.doc.codigo} — {modalTrocarRota.doc.titulo}. Trocar um designado que já assinou invalida a assinatura.</div>
              <div style={{marginBottom:12}}>
                <label style={{fontSize:12,fontWeight:600,color:T.text,display:"block",marginBottom:4}}>🔎 Revisor {modalTrocarRota.doc.assinaturaRevisor && <span style={{color:"#ff9800",fontWeight:400}}>(já assinado)</span>}</label>
                <select value={rotaForm.revisorId} onChange={e=>setRotaForm(p=>({...p,revisorId:e.target.value}))} style={{...s.inp,fontSize:13,width:"100%"}}>
                  <option value="">Selecione o revisor…</option>
                  {usuariosRevAprov.filter(u=>String(u.id)!==String(rotaForm.aprovadorId)).map(u=>(
                    <option key={u.id} value={u.id}>{u.name} · {u.setor||"—"}</option>
                  ))}
                </select>
              </div>
              <div style={{marginBottom:16}}>
                <label style={{fontSize:12,fontWeight:600,color:T.text,display:"block",marginBottom:4}}>✅ Aprovador {modalTrocarRota.doc.assinaturaAprovador && <span style={{color:"#ff9800",fontWeight:400}}>(já assinado)</span>}</label>
                <select value={rotaForm.aprovadorId} onChange={e=>setRotaForm(p=>({...p,aprovadorId:e.target.value}))} style={{...s.inp,fontSize:13,width:"100%"}}>
                  <option value="">Selecione o aprovador…</option>
                  {usuariosRevAprov.filter(u=>String(u.id)!==String(rotaForm.revisorId)).map(u=>(
                    <option key={u.id} value={u.id}>{u.name} · {u.setor||"—"}</option>
                  ))}
                </select>
              </div>
              <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                <button style={s.btn} onClick={()=>setModalTrocarRota(null)}>Cancelar</button>
                <button style={s.btnA} onClick={()=>trocarRota(modalTrocarRota.doc, rotaForm)}>Salvar designados</button>
              </div>
            </div>
          </div>
        )}
        {/* ── TREINAMENTO POR CARGO (Fase 2) ──
            Substitui os dois controles paralelos anteriores (leitura obrigatória
            nominal + subcoleção de treinos). A exigência é DERIVADA do cargo; a
            evidência é gravada por versão do documento. */}
        {(()=>{
          const podeGerirTreino = isAdmin || (perm?.("gerenciarTreinamento") ?? false);
          const podeRegistrar   = isAdmin || (perm?.("registrarTreinamento") ?? false);
          const tr = d.treinamento;
          const legado = !tr && (d.leituraObrigatoria?.atribuido || d.treinamentoObrigatorio);
          if (!tr && !legado && !podeGerirTreino) return null;

          const meuId = String(user?.uid || user?.id || "");
          const exigidos = exigidosDoDocumento(d, colaboradores, catalogoCargos, catalogoAreasSetoresDistribuicao);
          const indice = indexarEvidencias(evidencias);
          const vigente = documentoExigeTreinamento(d);
          const linhas = exigidos.map(ex => ({ ...ex, cel: statusCelula({ doc:d, userId:ex.userId, indice, hoje:tod() }) }));
          const treinados = linhas.filter(l => l.cel.status === "treinado").length;
          const pct = linhas.length ? Math.round((treinados/linhas.length)*100) : 0;
          const eu = linhas.find(l => l.userId === meuId);
          const cargosDisp = cargosAtivos(catalogoCargos);
          const locaisDisp = opcoesDeLocal(catalogoAreasSetoresDistribuicao);
          const cfg = editTreino || {
            exigido: tr?.exigido ?? true,
            modo: tr?.modo || "leitura",
            cargos: tr?.cargos || [],
            setores: tr?.setores || [],
            pessoasExtra: tr?.pessoasExtra || [],
            prazoDias: tr?.prazoDias ?? PRAZO_TREINAMENTO_PADRAO,
            reciclagemMeses: tr?.reciclagemMeses ?? "",
          };

          return (
            <div style={{ ...s.card, border:`1px solid ${T.accent}33` }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
                <SecTitle icon="📚" ch="Treinamento" />
                {tr?.exigido && linhas.length > 0 && (
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <span style={{ fontSize:12, color:T.text2 }}>{treinados}/{linhas.length} treinados ({pct}%)</span>
                    <div style={{ width:120, height:8, borderRadius:8, background:T.border, overflow:"hidden" }}>
                      <div style={{ width:`${pct}%`, height:"100%", background:pct===100?T.accent:"#ffd166", borderRadius:8, transition:"width .3s" }} />
                    </div>
                  </div>
                )}
              </div>

              {legado && (
                <div style={{ background:"#ffd16618", border:"1px solid #ffd16644", borderRadius:10, padding:"12px 16px", marginBottom:12, fontSize:12, color:T.text2 }}>
                  <strong style={{ color:T.text }}>Controle antigo neste documento.</strong> Ele ainda usa a designação nominal de leitura
                  {d.treinamentoObrigatorio ? " e o registro de treinamento por documento" : ""}. Um administrador pode trazer tudo para a
                  matriz em <strong>📚 Matriz de Treinamento → 🔄 Migrar controles antigos</strong>, ou configurar a exigência por cargo abaixo.
                </div>
              )}

              {!tr?.exigido && !editTreino && (
                <div style={{ fontSize:12, color:T.text3, padding:"10px 0" }}>
                  Este documento não exige treinamento.
                  {podeGerirTreino && " Configure abaixo para exigir por cargo."}
                </div>
              )}

              {tr?.exigido && !editTreino && (
                <>
                  <div style={{ fontSize:11, color:T.text3, marginBottom:10 }}>
                    {MODOS_TREINAMENTO.find(m=>m.id===tr.modo)?.label || tr.modo}
                    {" · prazo de "}{tr.prazoDias ?? PRAZO_TREINAMENTO_PADRAO} dias
                    {tr.reciclagemMeses ? ` · reciclagem a cada ${tr.reciclagemMeses} meses` : " · sem reciclagem periódica"}
                    {tr.desdeEm ? ` · valendo desde ${fmt(tr.desdeEm)}` : " · começa a valer quando a versão entrar em vigor"}
                    {" · confirmações referentes à Rev."}{d.versao}
                  </div>
                  {!vigente && (
                    <div style={{ background:T.surf, border:`1px solid ${T.border}`, borderRadius:8, padding:"8px 12px", marginBottom:10, fontSize:11, color:T.text3 }}>
                      A exigência só passa a contar quando o documento estiver <strong>Vigente</strong> — não se treina em versão não aprovada.
                    </div>
                  )}
                  {/* Pendência impossível: modo leitura exige confirmar no sistema, e
                      operador não tem login. Sem este aviso a matriz acumularia atraso
                      que ninguém consegue resolver. */}
                  {(()=>{ const semLogin = exigidosSemLogin(d, colaboradores, catalogoCargos, catalogoAreasSetoresDistribuicao); return semLogin.length > 0 && (
                    <div style={{ background:"#ffd16618", border:"1px solid #ffd16644", borderRadius:10, padding:"12px 16px", marginBottom:10, fontSize:12, color:T.text2 }}>
                      <strong style={{ color:T.text }}>{semLogin.length} pessoa(s) exigida(s) não têm login</strong> e este documento está no modo
                      <strong> Leitura e entendimento</strong>, que depende de a própria pessoa confirmar no sistema — elas nunca conseguiriam.
                      <div style={{ fontSize:11, color:T.text3, marginTop:5 }}>
                        {semLogin.slice(0,6).map(p=>p.userName).join(", ")}{semLogin.length>6?` e mais ${semLogin.length-6}`:""}.
                        {" "}Troque o modo para <strong>Treinamento presencial</strong> e registre pela lista de presença.
                      </div>
                    </div>
                  ); })()}
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
                    {(tr.cargos||[]).map(cid => (
                      <span key={cid} style={{ fontSize:11, padding:"3px 10px", borderRadius:20, background:T.accent+"18", color:T.accent, fontWeight:700 }}>
                        👔 {cargosDisp.find(c=>c.id===cid)?.nome || catalogoCargos.find(c=>c.id===cid)?.nome || cid}
                      </span>
                    ))}
                    {(tr.pessoasExtra||[]).length > 0 && (
                      <span style={{ fontSize:11, padding:"3px 10px", borderRadius:20, background:T.border, color:T.text2, fontWeight:700 }}>
                        + {tr.pessoasExtra.length} pessoa(s) nominal(is)
                      </span>
                    )}
                    {!(tr.cargos||[]).length && !(tr.pessoasExtra||[]).length && (
                      <span style={{ fontSize:11, color:"#e8a33d" }}>⚠ Nenhum cargo vinculado — ninguém é exigido ainda.</span>
                    )}
                  </div>

                  {eu && eu.cel.status !== "treinado" && tr.modo === "leitura" && vigente && (
                    <div style={{ background:"#ffd16618", border:"1px solid #ffd16644", borderRadius:10, padding:"12px 16px", marginBottom:12, display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
                      <span style={{ fontSize:22 }}>📖</span>
                      <div style={{ flex:1, minWidth:180 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:T.text }}>Treinamento pendente — {d.codigo} Rev.{d.versao}</div>
                        <div style={{ fontSize:11, color:T.text2 }}>Você é exigido neste documento pelo cargo {eu.cargoNome}. Confirme após a leitura.</div>
                      </div>
                      <button style={{ ...s.btnA, fontSize:12 }} onClick={()=>registrarEvidencia(d, meuId, { modo:"leitura", dataRealizacao:tod(), obs:"Confirmado pelo próprio colaborador" })}>
                        ✅ Li e entendi
                      </button>
                    </div>
                  )}

                  {/* Sessão de treinamento (Fase 5) — o caminho formal do presencial:
                      lista de presença assinada pelo instrutor, que grava o treinamento
                      de todos os presentes de uma vez. O lançamento avulso abaixo
                      continua existindo para o caso pontual de uma pessoa só. */}
                  {tr.modo === "presencial" && (
                    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:T.accent+"10", border:`1px solid ${T.accent}33`, borderRadius:10, marginBottom:12, flexWrap:"wrap" }}>
                      <span style={{ fontSize:18 }}>📋</span>
                      <div style={{ flex:1, minWidth:180 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:T.text }}>Lista de presença</div>
                        <div style={{ fontSize:11, color:T.text2 }}>
                          {(() => {
                            const ss = sessoesDoDocumento(sessoes, d.id);
                            const daVersao = ss.filter(x => String(x.versao) === String(d.versao)).length;
                            return ss.length
                              ? `${ss.length} sessão(ões) registrada(s)${daVersao ? ` · ${daVersao} nesta revisão` : ""}`
                              : "Registre a turma de uma vez, com assinatura do instrutor.";
                          })()}
                        </div>
                      </div>
                      <button style={s.btn} onClick={()=>setView("sessoes")}>Abrir sessões →</button>
                    </div>
                  )}

                  {podeRegistrar && tr.modo === "presencial" && vigente && (
                    <div style={{ background:T.surf, border:`1px solid ${T.border}`, borderRadius:10, padding:"1rem", marginBottom:12 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:4 }}>Registrar treinamento avulso — Rev.{d.versao}</div>
                      <div style={{ fontSize:11, color:T.text3, marginBottom:10 }}>Para uma pessoa só. Turma inteira: use a lista de presença acima.</div>
                      <G2 ch={<>
                        <F lbl="Colaborador" ch={
                          <Sel value={novaEvid.userId} onChange={e=>setNovaEvid(p=>({...p,userId:e.target.value}))}>
                            <option value="">Selecione...</option>
                            {linhas.filter(l=>l.cel.status!=="treinado").map(l=><option key={l.userId} value={l.userId}>{l.userName} — {l.cargoNome}</option>)}
                          </Sel>
                        } />
                        <F lbl="Data do treinamento" ch={<Inp type="date" value={novaEvid.dataRealizacao} onChange={e=>setNovaEvid(p=>({...p,dataRealizacao:e.target.value}))} />} />
                      </>} />
                      <F lbl="Observações" ch={<Inp placeholder="Ex: turma 2, sala de treinamento" value={novaEvid.obs} onChange={e=>setNovaEvid(p=>({...p,obs:e.target.value}))} />} />
                      <div style={{ textAlign:"right", marginTop:8 }}>
                        <button style={s.btnA} onClick={()=>registrarEvidencia(d, novaEvid.userId, { modo:"presencial", dataRealizacao:novaEvid.dataRealizacao, obs:novaEvid.obs })}>Registrar ✓</button>
                      </div>
                    </div>
                  )}

                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    {linhas.length === 0 && (
                      <div style={{ textAlign:"center", padding:"1.5rem", color:T.text3, fontSize:12 }}>
                        Ninguém exigido ainda — vincule cargos à exigência.
                      </div>
                    )}
                    {linhas.map(l => {
                      const cor = l.cel.status === "treinado" ? T.accent : l.cel.status === "atrasado" ? "#ff4f6a" : l.cel.status === "vencido" ? "#9c6ade" : "#e8a33d";
                      return (
                        <div key={l.userId} style={{ display:"flex", alignItems:"center", gap:12, padding:"8px 12px", background:T.surf, border:`1px solid ${T.border}`, borderRadius:8 }}>
                          <div style={{ width:28, height:28, borderRadius:"50%", background:cor+"22", color:cor, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:800, flexShrink:0 }}>
                            {l.cel.status === "treinado" ? "✓" : l.cel.status === "atrasado" ? "!" : l.cel.status === "vencido" ? "↻" : "○"}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{l.userName}</div>
                            <div style={{ fontSize:11, color:T.text2 }}>
                              {l.cargoNome}{l.setor ? ` · ${l.setor}` : ""}
                              {l.origem === "extra" && <span style={{ color:T.text3 }}> · nominal</span>}
                            </div>
                          </div>
                          {l.cel.status === "treinado"
                            ? <span style={{ fontSize:11, color:T.accent, fontWeight:700 }} title={l.cel.venceEm ? `Vence em ${fmt(l.cel.venceEm)}` : "Sem reciclagem periódica"}>
                                ✓ {fmt(l.cel.evidencia?.dataRealizacao)}
                                {l.cel.diasParaVencer != null && l.cel.diasParaVencer <= 60 ? ` · vence em ${l.cel.diasParaVencer}d` : ""}
                              </span>
                            : <span style={{ fontSize:11, color:cor, fontWeight:700 }}>
                                {l.cel.status === "atrasado" ? `Atrasado há ${l.cel.dias}d`
                                  : l.cel.status === "vencido" ? `Reciclar — venceu há ${l.cel.dias}d`
                                  : "Pendente"}
                              </span>
                          }
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Configuração da exigência */}
              {podeGerirTreino && !editTreino && (
                <div style={{ textAlign:"right", marginTop:10 }}>
                  <button style={{ ...s.btn, fontSize:11 }} onClick={()=>setEditTreino(cfg)}>
                    {tr?.exigido ? "✏️ Editar exigência" : "➕ Exigir treinamento"}
                  </button>
                </div>
              )}
              {podeGerirTreino && editTreino && (
                <div style={{ background:T.surf, border:`1px solid ${T.border}`, borderRadius:10, padding:"1rem", marginTop:10 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:10 }}>Exigência de treinamento</div>
                  <label style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12, cursor:"pointer" }}>
                    <input type="checkbox" checked={editTreino.exigido} onChange={e=>setEditTreino(p=>({...p,exigido:e.target.checked}))} style={{ width:16, height:16, accentColor:T.accent }} />
                    <span style={{ fontSize:13, color:T.text }}>Este documento exige treinamento</span>
                  </label>
                  {editTreino.exigido && (<>
                    <G2 ch={<>
                      <F lbl="Modo" ch={
                        <Sel value={editTreino.modo} onChange={e=>setEditTreino(p=>({...p,modo:e.target.value}))}>
                          {MODOS_TREINAMENTO.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}
                        </Sel>
                      } />
                      <F lbl="Prazo (dias)" tip="Depois deste prazo, contado da entrada em vigor da versão, a pendência vira atraso na matriz." ch={
                        <Inp type="number" min="1" value={editTreino.prazoDias} onChange={e=>setEditTreino(p=>({...p,prazoDias:e.target.value}))} />
                      } />
                    </>} />
                    <F lbl="Reciclagem periódica (meses) — deixe em branco para não vencer"
                      tip="Competência não é permanente: em POP crítico, o treinamento se refaz de tempos em tempos mesmo sem revisão do documento. Vencida a validade, a pessoa volta à matriz como 'a reciclar'." ch={
                      <Inp type="number" min="1" placeholder="Ex: 12" value={editTreino.reciclagemMeses ?? ""} onChange={e=>setEditTreino(p=>({...p,reciclagemMeses:e.target.value}))} />
                    } />
                    <div style={{ fontSize:12, fontWeight:600, color:T.text, margin:"10px 0 6px" }}>Cargos exigidos</div>
                    <div style={{ fontSize:11, color:T.text3, marginBottom:8 }}>
                      Quem ocupa estes cargos passa a ser exigido automaticamente — inclusive quem for contratado depois.
                    </div>
                    {cargosDisp.length === 0 ? (
                      <div style={{ fontSize:12, color:"#e8a33d", marginBottom:10 }}>
                        ⚠ Nenhum cargo ativo no catálogo. Cadastre em Admin → Catálogos → 👔 Cargos.
                      </div>
                    ) : (
                      <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>
                        {cargosDisp.map(c => {
                          const on = editTreino.cargos.includes(c.id);
                          const n = (users||[]).filter(u=>u.cargoId===c.id).length;
                          return (
                            <button key={c.id} onClick={()=>setEditTreino(p=>({ ...p, cargos: on ? p.cargos.filter(x=>x!==c.id) : [...p.cargos, c.id] }))}
                              style={{ padding:"6px 12px", borderRadius:20, border:`1px solid ${on?T.accent:T.border}`, cursor:"pointer", fontFamily:"inherit",
                                fontSize:11, fontWeight:600, background:on?T.accent+"22":"transparent", color:on?T.accent:T.text2 }}>
                              {on ? "✓ " : ""}{c.nome} <span style={{ opacity:.7 }}>({n})</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Setores (Fase 7) — a dimensão que hoje realmente separa as
                        pessoas, já que encapsulamento, compressão e envase são todos
                        "Auxiliar de Produção". */}
                    <div style={{ fontSize:12, fontWeight:600, color:T.text, margin:"10px 0 6px" }}>Setores exigidos</div>
                    <div style={{ fontSize:11, color:T.text3, marginBottom:8 }}>
                      Vincular a <strong>área</strong> alcança todos os setores dela; vincular o <strong>setor</strong> alcança só ele.
                      {(editTreino.cargos||[]).length > 0 && (editTreino.setores||[]).length > 0 &&
                        <> Com cargo <em>e</em> setor preenchidos, vale a <strong>interseção</strong>: quem tem aquele cargo <em>naquele</em> setor.</>}
                    </div>
                    {locaisDisp.length === 0 ? (
                      <div style={{ fontSize:12, color:"#e8a33d", marginBottom:10 }}>
                        ⚠ Nenhuma área/setor no catálogo. Cadastre em Admin → Catálogos → Áreas e Setores.
                      </div>
                    ) : (
                      <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>
                        {locaisDisp.map(l => {
                          const on = (editTreino.setores||[]).includes(l.id);
                          const n = (colaboradores||[]).filter(c => c.ativo !== false && (c.setorId === l.id || (l.tipo === "area" && (catalogoAreasSetoresDistribuicao.find(a=>a.id===l.id)?.setores||[]).some(s=>s.id===c.setorId)))).length;
                          return (
                            <button key={l.id} onClick={()=>setEditTreino(p=>({ ...p, setores: on ? (p.setores||[]).filter(x=>x!==l.id) : [...(p.setores||[]), l.id] }))}
                              style={{ padding:"6px 12px", borderRadius:20, border:`1px solid ${on?T.accent:T.border}`, cursor:"pointer", fontFamily:"inherit",
                                fontSize:11, fontWeight:600, background:on?T.accent+"22":"transparent", color:on?T.accent:T.text2 }}>
                              {on ? "✓ " : ""}{l.rotulo} <span style={{ opacity:.7 }}>({n})</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Prévia ao vivo — o que impede errar a configuração: você vê
                        exatamente quem será exigido ANTES de salvar. */}
                    {(()=>{
                      const previa = exigidosDoDocumento({ treinamento: { ...editTreino, exigido: true } }, colaboradores, catalogoCargos, catalogoAreasSetoresDistribuicao);
                      const vazio = previa.length === 0;
                      return (
                        <div style={{ background: vazio ? "#ff4f6a12" : T.accent+"10", border:`1px solid ${vazio ? "#ff4f6a44" : T.accent+"33"}`, borderRadius:10, padding:"12px 16px", marginBottom:12 }}>
                          <div style={{ fontSize:12, fontWeight:700, color: vazio ? "#ff4f6a" : T.text }}>
                            {vazio ? "⚠ Nenhuma pessoa seria exigida com esta configuração" : `${previa.length} pessoa(s) serão exigidas`}
                          </div>
                          {vazio ? (
                            <div style={{ fontSize:11, color:T.text2, marginTop:4 }}>
                              A combinação escolhida não alcança ninguém no cadastro atual. Se você acabou de mudar cargos ou setores,
                              revise — documento que exige treinamento de zero pessoas some da conformidade sem avisar.
                            </div>
                          ) : (
                            <div style={{ fontSize:11, color:T.text2, marginTop:4, maxHeight:70, overflowY:"auto" }}>
                              {previa.slice(0,25).map(p=>p.userName).join(", ")}{previa.length>25?` e mais ${previa.length-25}`:""}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </>)}
                  <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
                    <button style={s.btn} onClick={()=>setEditTreino(null)}>Cancelar</button>
                    <button style={s.btnA} onClick={()=>salvarExigencia(d, editTreino)}>Salvar exigência</button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
        {recusaModal}
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
              <button onClick={()=>abrirArquivoAutenticado(docArquivo.url, true, nomeDownloadDoc(sel?.codigo || gerarCodigoGD(form.tipo, form.depto, docs, form.versao), form.versao, docArquivo))} style={{ ...s.btn, fontSize:11 }}>⬇️ Baixar</button>
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
        {podeCriarDoc && (
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
                {podeBaixarFonte && <button onClick={()=>abrirArquivoAutenticado(docArquivoFonte.url, true, docArquivoFonte.nome)} style={{ ...s.btn, fontSize:11 }}>⬇️ Baixar</button>}
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
                    const tipoLabel=tipoInfo(form.tipo)?.label||form.tipo;
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
            <F lbl="Tipo" ch={<Sel value={form.tipo} onChange={e=>setF("tipo",e.target.value)}>{tiposAtivos.map(t=><option key={t.id} value={t.id}>{t.icon ? `${t.icon} ` : ""}{t.label} ({t.id})</option>)}</Sel>} />
            <F lbl="Departamento" ch={<Sel value={form.depto} onChange={e=>setF("depto",e.target.value)}>{deptosAtivos.map(d=><option key={d.id} value={d.id}>{d.id} — {d.label}</option>)}</Sel>} />
            <F lbl="Versão" ch={<Inp placeholder="01" value={form.versao} onChange={e=>setF("versao",e.target.value)} />} />
          </>} />
          {form.tipo && (()=>{
            const tp = tipoInfo(form.tipo);
            const anos = prazoRevisaoTipo(form.tipo, tiposRevisao);
            const depResp = deptoInfo(tp?.departamentoResponsavel);
            return (
              <div style={{display:"flex",gap:6,flexWrap:"wrap",fontSize:11,color:T.text3,marginTop:-2,marginBottom:2}}>
                <span>📅 Prazo de revisão padrão: <strong style={{color:T.text2}}>{anos} {anos===1?"ano":"anos"}</strong></span>
                <span style={{color:T.border}}>|</span>
                <span>🏛️ Departamento responsável: <strong style={{color:T.text2}}>{depResp?.label||tp?.departamentoResponsavel||"—"}</strong></span>
              </div>
            );
          })()}
          <F lbl="Título do documento" ch={<Inp placeholder="Ex: Procedimento de Análise Microbiológica" value={form.titulo} onChange={e=>setF("titulo",e.target.value)} />} />
          {!sel && form.tipo && form.depto && <div style={{background:T.accentDim,border:`1px solid ${T.accent}25`,borderRadius:8,padding:"8px 12px",fontSize:12,color:T.accent,marginTop:4}}>💡 Código: <strong>{gerarCodigoGD(form.tipo,form.depto,docs,form.versao)}</strong></div>}
          {/* A exigência de treinamento deixou de ser um checkbox aqui: ela é
              configurada por CARGO na seção Treinamento do documento, onde dá
              para escolher modo, cargos e prazo. */}
          <div style={{display:"flex",alignItems:"center",gap:10,marginTop:10,padding:"10px 14px",background:T.surf,border:`1px solid ${T.border}`,borderRadius:8,fontSize:12,color:T.text3}}>
            <span style={{fontSize:16}}>📚</span>
            <span>O treinamento obrigatório é definido por cargo na seção <strong style={{color:T.text2}}>Treinamento</strong>, depois de salvar o documento.</span>
          </div>
          <F lbl="Data de vigência (deixe em branco para entrar em vigor no dia da aprovação)"
            ch={<Inp type="date" value={form.dataVigencia||""} onChange={e=>setF("dataVigencia",e.target.value)} />} />
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
          {/* Navegação por abas (estilo SE Suite) — substitui as pílulas de capítulo */}
          <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:16}}>
            {CAPITULOS_GD.map(cap=>{
              const ativa = capituloAtivo===cap.id;
              const preenchido = cap.special ? form[cap.id]?.length>0 : (form[cap.id]&&form[cap.id]!=="N/A");
              return (
                <button key={cap.id} onClick={()=>setCapituloAtivo(cap.id)}
                  style={{padding:"8px 16px",borderRadius:6,border:"none",background:ativa?T.accent:T.card2,color:ativa?"#fff":T.text2,cursor:"pointer",fontSize:12,fontWeight:ativa?600:400,transition:"all 0.15s"}}>
                  {preenchido?"✓ ":""}{cap.label.replace(/^\d+\.\s/,"")}
                </button>
              );
            })}
          </div>
          {/* Conteúdo da aba ativa — scroll interno (não rola a página inteira) */}
          <div style={{minHeight:300,maxHeight:600,overflowY:"auto",paddingRight:8}}>
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
                      <F lbl="Item modificado" ch={<Inp placeholder="Ex: Item 5.2, Anexo I, Fluxo de aprovação..." value={novaEntrada.itemModificado} onChange={e=>setE("itemModificado",e.target.value)} />} />
                    </div>
                    <div style={{marginTop:8}}>
                      <F lbl="Descrição das alterações" ch={<textarea rows={3} placeholder="Descreva detalhadamente o que foi alterado nesta revisão..." value={novaEntrada.descricao} onChange={e=>setE("descricao",e.target.value)} style={{width:"100%",borderRadius:8,border:`1px solid ${T.border}`,padding:"8px 10px",fontSize:12,color:T.text,background:T.bg,resize:"vertical",fontFamily:"inherit",boxSizing:"border-box"}} />} />
                    </div>
                    <div style={{display:"flex",gap:8,marginTop:10}}>
                      <button style={s.btnA} onClick={()=>{
                        if(!novaEntrada.versao.trim()||!novaEntrada.data){alert("Preencha ao menos Revisão e Data.");return;}
                        if(novaEntrada.versao.trim()!=="00" && !novaEntrada.itemModificado.trim()){alert("Informe o item modificado para revisões 01 ou maiores.");return;}
                        if(novaEntrada.versao.trim()!=="00" && !novaEntrada.descricao.trim()){alert("Informe a descrição da alteração para revisões 01 ou maiores.");return;}
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
                          {["Rev.","Data","Motivo","Item modificado","Descrição das alterações","Responsável","Aprovador",""].map((h,i)=>(
                            <th key={i} style={{padding:"8px 10px",textAlign:"left",color:T.text3,fontWeight:700,fontSize:10,textTransform:"uppercase",borderBottom:`1px solid ${T.border}`,whiteSpace:"nowrap"}}>{h}</th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {[...(form.historicoRevisoes||[])].map((h,i)=>(
                            <tr key={i} style={{borderBottom:`1px solid ${T.border}`,background:i%2===0?T.bg:T.surf}}>
                              <td style={{padding:"8px 10px",fontWeight:700,color:T.accent,whiteSpace:"nowrap"}}>Rev.{h.versao}</td>
                              <td style={{padding:"8px 10px",color:T.text2,whiteSpace:"nowrap"}}>{fmt(h.data)}</td>
                              <td style={{padding:"8px 10px",color:T.text2,maxWidth:150}}>{h.motivo||"—"}</td>
                              <td style={{padding:"8px 10px",color:T.text2,maxWidth:160}}>{h.itemModificado||"—"}</td>
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

  /* ── LISTA MESTRA ── */
  /* ── MATRIZ DE TREINAMENTO ── */
  if (view==="matriz") {
    return (
      <MatrizTreinamentoTab
        docs={docs} colaboradores={colaboradores} treinamentos={evidencias} catalogoCargos={catalogoCargos} catalogoAreas={catalogoAreasSetoresDistribuicao}
        user={user} perm={perm} isAdmin={isAdmin} toast_={toast_} auditLog={auditLog}
        onVoltar={()=>setView("lista")}
        onAbrirDoc={(doc)=>{ setSel(doc); setView("detalhe"); }}
      />
    );
  }

  /* ── SESSÕES DE TREINAMENTO PRESENCIAL (lista de presença assinada) ── */
  if (view==="sessoes" && sel) {
    return (
      <SessoesTreinamentoTab
        doc={sel} sessoes={sessoes} colaboradores={colaboradores} evidencias={evidencias} catalogoCargos={catalogoCargos} catalogoAreas={catalogoAreasSetoresDistribuicao}
        user={user} perm={perm} isAdmin={isAdmin} toast_={toast_} auditLog={auditLog}
        onVoltar={()=>setView("detalhe")}
      />
    );
  }

  if (view==="lista-mestra") {
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
          <button style={s.btn} onClick={()=>setView("lista")}>← Voltar</button>
          <h2 style={{fontSize:18,fontWeight:700,color:T.text,margin:0}}>📋 Lista Mestra</h2>
          <div style={{flex:1}}></div>
          <button style={s.btnA} onClick={exportarListaMestraCSV}>⬇️ Exportar CSV</button>
          <button style={s.btnA} onClick={exportarListaMestraXLSX}>⬇️ Exportar XLSX</button>
        </div>

        <div style={s.card}>
          <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
            <input placeholder="Buscar código ou título..." value={lmBusca} onChange={e=>setLmBusca(e.target.value)}
              style={{...s.inp,flex:1,minWidth:200,fontSize:12}} />
            <select value={lmFiltroStatus} onChange={e=>setLmFiltroStatus(e.target.value)} style={{...s.inp,fontSize:12}}>
              <option value="todos">Todos os status</option>
              <option value="Vigente">Vigente</option>
              <option value="Obsoleto">Obsoleto</option>
            </select>
            <select value={lmFiltroDepto} onChange={e=>setLmFiltroDepto(e.target.value)} style={{...s.inp,fontSize:12}}>
              <option value="todos">Todos os departamentos</option>
              {[...new Set(listaVigentesObsoletos.map(d=>d.depto))].sort().map(d=>(
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <button style={{...s.btn,fontSize:12}} onClick={()=>{setLmBusca("");setLmFiltroStatus("todos");setLmFiltroDepto("todos");}}>🔄 Limpar</button>
          </div>

          <div style={{overflowX:"auto",marginBottom:12}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead>
                <tr style={{background:T.surf,borderBottom:`2px solid ${T.border}`}}>
                  {["Código","Título","Versão","Depto","Data Última Revisão","Próxima Revisão","Cópias Físicas","Status"].map(h=>(
                    <th key={h} style={{padding:"8px 10px",textAlign:"left",color:T.text3,fontWeight:700,fontSize:11,textTransform:"uppercase"}}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lmFiltrados.length===0?(
                  <tr>
                    <td colSpan="8" style={{textAlign:"center",padding:"2rem",color:T.text3,fontSize:12}}>
                      Nenhum documento encontrado.
                    </td>
                  </tr>
                ):(
                  lmFiltrados.map((d,i)=>{
                    const tipo = tipoInfo(d.tipo);
                    const dias = diasParaRevisaoGD(d.proximaRevisao);
                    return (
                      <tr key={d.id} style={{borderBottom:`1px solid ${T.border}`,background:i%2===0?T.bg:T.surf}}>
                        <td style={{padding:"8px 10px",color:tipo?.cor||T.accent,fontWeight:700}}>{d.codigo}</td>
                        <td style={{padding:"8px 10px",color:T.text}}>{d.titulo}</td>
                        <td style={{padding:"8px 10px",color:T.text2}}>Rev.{d.versao}</td>
                        <td style={{padding:"8px 10px",color:T.text2}}>{d.depto}</td>
                        <td style={{padding:"8px 10px",color:T.text2}}>{fmt(d.atualizadoEm)}</td>
                        <td style={{padding:"8px 10px",color:dias&&dias<=90?dias<=0?"#ff4f6a":"#ffd166":T.text2}}>
                          {d.proximaRevisao?fmt(d.proximaRevisao):"—"}
                        </td>
                        <td style={{padding:"8px 10px",color:T.text2}}>
                          {(d.distribuicaoFisica||[]).length>0
                            ? <span title={d.distribuicaoFisica.map(destinoDistribLabel).join(", ")}>🗂️ {d.distribuicaoFisica.length} destino{d.distribuicaoFisica.length!==1?"s":""}</span>
                            : "—"}
                          {d.recolhaPendente?.length>0 && <span title={`${d.recolhaPendente.length} cópia(s) obsoleta(s) a recolher`} style={{color:"#ff4f6a",marginLeft:6}}>⚠️{d.recolhaPendente.length}</span>}
                        </td>
                        <td style={{padding:"8px 10px"}}>
                          <BadgeStatusGD status={d.status}/>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div style={{fontSize:11,color:T.text3,textAlign:"right",paddingTop:8,borderTop:`1px solid ${T.border}`}}>
            Lista Mestra atualizada em {new Date().toLocaleString("pt-BR")}
            {lmFiltrados.length>0&&` · ${lmFiltrados.length} documento${lmFiltrados.length!==1?"s":""}`}
          </div>
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
                {tiposAtivos.map(tp=>{
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
          <div key={stat.label} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"12px 14px",textAlign:"center"}} data-formal-scrubbable="true">
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
            {tiposAtivos.map(t=><option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
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
          <button style={s.btn} onClick={()=>setView("lista-mestra")}>📋 Lista Mestra</button>
          <button style={s.btn} onClick={()=>setView("arvore")}>🌳 Árvore</button>
          {(()=>{
            // Badge com as pendências da própria pessoa — a matriz é acionável, não só relatório.
            const meus = pendentesDoUsuario({ docs, pessoas: colaboradores, evidencias, catalogoCargos, catalogoAreas: catalogoAreasSetoresDistribuicao, userId:String(user?.uid||user?.id||""), hoje:tod() });
            return (
              <button style={s.btn} onClick={()=>setView("matriz")}>
                📚 Matriz de Treinamento
                {meus.length > 0 && (
                  <span style={{ marginLeft:6, fontSize:10, fontWeight:800, padding:"1px 7px", borderRadius:20,
                    background: meus.some(m=>m.status==="atrasado") ? "#ff4f6a" : "#e8a33d", color:"#fff" }}>
                    {meus.length}
                  </span>
                )}
              </button>
            );
          })()}
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
        const tipo = tipoInfo(d.tipo);
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
                {(d.treinamento?.exigido||d.treinamentoObrigatorio)&&<span style={{marginLeft:8,color:T.blue||"#4fc3f7"}}>📚</span>}
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
              <BadgeTipoGD tipo={d.tipo} tipos={tiposAtivos}/>
              <BadgeStatusGD status={d.status}/>
            </div>
          </div>
        );
      })
      }<Pagination page={_pgGD} total={_totGD} setPage={_setPgGD}/>
      </>
      )}
      {recusaModal}
    </div>
  );
}

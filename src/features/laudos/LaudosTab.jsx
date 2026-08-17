import React, { useState, useEffect } from "react";
import { createElectronicSignature, incrementLaudoCounter, saveCollection, deleteFromCollection, subscribeCollection } from "../../firebase";
import { useTheme } from "../../core/theme";
import { fmt, seloAssHTML, sigCodigo, tod } from "../../core/utils";
import { btnCor, useS } from "../../shared/styles";
import { usePagination } from "../../shared/ui";
import { F, G2, G3, Inp, Pagination, SecTitle, Sel, TA } from "../../shared/ui";
import { openPDFWindow, buildPDFShell } from "../pdf/pdfExports";

export const LOGO_HERBAMED = "/logo.png";

export const HERBAMED_INFO = {
  nome: "Herbamed Laboratório Nutracêutico LTDA",
  cnpj: "14.829.598/0001-30",
  endereco: "Av Irene Meneghetti Longhini, 500, Água do Ayero",
  cidade: "Assis/SP - Brasil",
  cep: "19816-370",
};

export const CATEGORIAS_LAUDO = ["Premix", "Encapsulado", "Produto acabado", "Ativo", "Embalagem", "Microbiológico", "Físico-químico", "Geral"];

export const BIBLIOTECA_ENSAIOS = [
  // Premix
  { label:"Densidade aparente",        unidade:"g/cm³", especificacao:"Informativo",                    categoria:"Premix" },
  { label:"Densidade compactada",      unidade:"g/cm³", especificacao:"Informativo",                    categoria:"Premix" },
  { label:"Umidade",                   unidade:"%",     especificacao:"≤ 5,0%",                         categoria:"Premix" },
  { label:"Aspecto",                   unidade:"—",     especificacao:"Pó fino amorfo",                 categoria:"Premix" },
  { label:"Cor",                       unidade:"—",     especificacao:"Conforme padrão",                categoria:"Premix" },
  { label:"Granulometria",             unidade:"%",     especificacao:"Conforme EI",                    categoria:"Premix" },
  { label:"pH (solução 1%)",           unidade:"pH",    especificacao:"5,0 – 7,0",                      categoria:"Premix" },
  // Encapsulado
  { label:"Peso médio",                unidade:"mg",    especificacao:"Conforme EI",                    categoria:"Encapsulado" },
  { label:"Aspecto / Cor",             unidade:"—",     especificacao:"Cápsula sem manchas, amassados ou telescopia", categoria:"Encapsulado" },
  { label:"Desintegração",             unidade:"min",   especificacao:"≤ 30 min",                       categoria:"Encapsulado" },
  { label:"Variação de peso",          unidade:"%",     especificacao:"≤ 5,0%",                         categoria:"Encapsulado" },
  // Produto acabado
  { label:"Impressão lote e validade", unidade:"—",     especificacao:"De acordo com O.F, legível e ausente de manchas", categoria:"Produto acabado" },
  { label:"Lacre de segurança",        unidade:"—",     especificacao:"Lacrado, ausente de aberturas",  categoria:"Produto acabado" },
  { label:"Conteúdo",                  unidade:"un",    especificacao:"Conforme rótulo",                categoria:"Produto acabado" },
  { label:"Aspecto",                   unidade:"—",     especificacao:"Conforme padrão",                categoria:"Produto acabado" },
  // Ativo
  { label:"Identificação (HPLC)",      unidade:"—",     especificacao:"Positivo",                       categoria:"Ativo" },
  { label:"Doseamento (HPLC)",         unidade:"%",     especificacao:"90,0 – 110,0",                   categoria:"Ativo" },
  { label:"Identificação (CCD)",       unidade:"—",     especificacao:"Positivo",                       categoria:"Ativo" },
  // Microbiológico
  { label:"Contagem total bactérias",  unidade:"UFC/g", especificacao:"≤ 10⁴",                          categoria:"Microbiológico" },
  { label:"Bolores e leveduras",       unidade:"UFC/g", especificacao:"≤ 10³",                          categoria:"Microbiológico" },
  { label:"Salmonella sp.",            unidade:"/25g",  especificacao:"Ausência",                       categoria:"Microbiológico" },
  { label:"E. coli",                   unidade:"/g",    especificacao:"Ausência",                       categoria:"Microbiológico" },
  // Embalagem
  { label:"Aspecto visual",            unidade:"—",     especificacao:"Sem defeitos",                   categoria:"Embalagem" },
  { label:"Vedação / fechamento",      unidade:"—",     especificacao:"Sem vazamento",                  categoria:"Embalagem" },
  { label:"Código de barras",          unidade:"—",     especificacao:"Leitura correta",                categoria:"Embalagem" },
];

const DEFAULT_ARMAZENAMENTO = `\u2022 Armazenar em local seco e fresco com temperatura de 15 a 30\u00b0C e umidade relativa de 30% a 80%.
\u2022 Armazenar o produto sobre palete ou paleteira, deixando espa\u00e7o lateral de 15 cm em cada extremidade. Observar a altura m\u00e1xima de empilhamento.`;

const novoFormLaudo = (dados = {}) => ({
  tipo:"produto_acabado", clienteId:"", produto:"", produtoId:"", linha:"", lote:"", op:"",
  data:tod(), obs:"", armazenamento:DEFAULT_ARMAZENAMENTO, ensaios:[], modeloId:"", modeloVersao:null,
  ...dados,
});

const ensaiosComoModelo = (ensaios = []) => ensaios.map((e, ordem) => ({
  categoria:e.categoria||"Geral", label:e.label||e.nome||e.ensaio||"", unidade:e.unidade||"",
  especificacao:e.especificacao||e.espec||"", ordem,
}));

const ensaiosDoModelo = (ensaios = []) => ensaios.slice().sort((a,b)=>(a.ordem||0)-(b.ordem||0)).map(e=>({
  categoria:e.categoria||"Geral", label:e.label||"", unidade:e.unidade||"", especificacao:e.especificacao||"", resultado:"", conforme:null, obs:""
}));

const normalizarProduto = (valor = "") => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
const fbErr = (e) => e?.message || "Erro ao salvar. Tente novamente.";


export function LaudosTab({ user, toast_, users, auditLog, perm = () => true }) {
  const T = useTheme(); const s = useS();
  const [laudos, setLaudos] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [analises, setAnalises] = useState([]);
  const [ipcRegs, setIpcRegs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("lista");
  const [sel, setSel] = useState(null);
  const [modeloSel, setModeloSel] = useState("");

  const [form, setForm] = useState(()=>novoFormLaudo());
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [busca, setBusca] = useState("");
  // Modal biblioteca de ensaios
  const [bibOpen, setBibOpen] = useState(false);
  const [bibBusca, setBibBusca] = useState("");
  const [bibCat, setBibCat] = useState("todas");
  const [bibSel, setBibSel] = useState({});

  const isRT = user?.role === "rt" || user?.role === "admin";
  const podeGerenciar = perm("criarLaudos");
  const rtUsers = users?.filter(u => u.role === "rt") || [];

  const TIPOS = [
    { id:"produto_acabado", label:"Produto Acabado" },
    { id:"materia_prima",   label:"Matéria-Prima" },
    { id:"processo",        label:"Processo (IPC)" },
  ];

  // Capturar prefill vindo do CQ Análises
  useEffect(() => {
    let pf = null;
    try {
      const salvo = sessionStorage.getItem("sgq_laudo_prefill");
      if (salvo) pf = JSON.parse(salvo);
    } catch {}
    if (pf) {
      setForm(novoFormLaudo(pf));
      setView("novo");
      sessionStorage.removeItem("sgq_laudo_prefill");
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 3000);
    const u1 = subscribeCollection("laudos", list => { clearTimeout(t); setLaudos(list.sort((a,b)=>(b.criadoTs||0)-(a.criadoTs||0))); setLoading(false); });
    const u2 = subscribeCollection("clientes_terceiros", list => setClientes(list.sort((a,b)=>(a.nome||"").localeCompare(b.nome||""))));
    const u3 = subscribeCollection("cq_analises", list => setAnalises(list));
    const u4 = subscribeCollection("ipc_registros", list => setIpcRegs(list));
    const u5 = subscribeCollection("laudo_modelos", list => setModelos(list.filter(m=>m.ativo!==false).sort((a,b)=>(a.nome||"").localeCompare(b.nome||""))));
    return () => { clearTimeout(t); u1&&u1(); u2&&u2(); u3&&u3(); u4&&u4(); u5&&u5(); };
  }, []);

  const setF = (k,v) => setForm(p=>({...p,[k]:v}));

  const clienteSel = clientes.find(c=>String(c.id)===String(form.clienteId));

  const inferirCategoria = (nome) => {
    if (!nome) return "Geral";
    const match = BIBLIOTECA_ENSAIOS.find(b => b.label.toLowerCase() === nome.toLowerCase());
    return match?.categoria || "Geral";

  };
  const aplicarModelo = (modeloId, silencioso = false) => {
    if (!modeloId) { setModeloSel(""); return; }
    const modelo = modelos.find(m=>String(m.id)===String(modeloId));
    if (!modelo) return;
    if (!silencioso && form.ensaios?.length && !confirm(`Substituir os ensaios atuais pelo modelo "${modelo.nome}"?`)) return;
    setForm(f=>novoFormLaudo({
      ...f,
      tipo:modelo.tipo||f.tipo,
      clienteId:modelo.clienteId||f.clienteId||"",
      produtoId:modelo.produtoId||"",
      produto:modelo.produto||f.produto,
      linha:modelo.linha||"",
      obs:modelo.observacaoPadrao||"",
      armazenamento:modelo.armazenamento||DEFAULT_ARMAZENAMENTO,
      ensaios:ensaiosDoModelo(modelo.ensaios),
      modeloId:String(modelo.id),
      modeloVersao:modelo.versao||1,
    }));
    setModeloSel(String(modelo.id));
    if (!silencioso) toast_(`Modelo "${modelo.nome}" carregado!`, "green");
  };

  const tentarModeloDoProduto = () => {
    if (!form.produto?.trim() || form.ensaios?.length) return;
    const chave = normalizarProduto(form.produto);
    const modelo = modelos.find(m =>
      (m.produtoChave||normalizarProduto(m.produto))===chave
      && (!m.tipo || m.tipo===form.tipo)
      && (!m.clienteId || String(m.clienteId)===String(form.clienteId||""))
    );
    if (modelo) {
      aplicarModelo(modelo.id, true);
      toast_(`Modelo "${modelo.nome}" aplicado automaticamente.`, "green");
    }
  };

  const salvarModelo = async (origem = form, novo = false) => {
    if (!podeGerenciar) return;
    if (!origem.produto?.trim()) { alert("Informe o produto antes de salvar o modelo."); return; }
    if (!origem.ensaios?.length) { alert("Adicione ao menos um ensaio antes de salvar o modelo."); return; }
    const atual = !novo && modeloSel ? modelos.find(m=>String(m.id)===String(modeloSel)) : null;
    const nome = prompt("Nome do modelo:", atual?.nome || `${origem.produto} - padrao`);
    if (!nome?.trim()) return;
    try {
      const id = atual?.id ? String(atual.id) : String(Date.now());
      const modelo = {
        id,
        nome:nome.trim(),
        produtoId:origem.produtoId||"",
        produto:origem.produto.trim(),
        produtoChave:normalizarProduto(origem.produto),
        clienteId:origem.clienteId||"",
        tipo:origem.tipo||"produto_acabado",
        linha:origem.linha||"",
        armazenamento:origem.armazenamento||"",
        observacaoPadrao:origem.observacaoPadrao||"",
        ensaios:ensaiosComoModelo(origem.ensaios),
        versao:(atual?.versao||0)+1,
        ativo:true,
        criadoPor:atual?.criadoPor||user.name,
        criadoEm:atual?.criadoEm||tod(),
        atualizadoPor:user.name,
        atualizadoEm:tod(),
      };
      await saveCollection("laudo_modelos", id, modelo);
      await auditLog(atual ? "Atualizou Modelo de Laudo" : "Criou Modelo de Laudo", "laudo_modelos", id, modelo.nome, atual||null, { produto:modelo.produto, versao:modelo.versao, ensaios:modelo.ensaios.length });
      setModeloSel(id);
      setForm(f=>({...f,modeloId:id,modeloVersao:modelo.versao}));
      toast_(atual ? "Modelo atualizado!" : "Modelo salvo!", "green");
    } catch(e) {
      toast_(fbErr(e), "red");
    }
  };

  const excluirModelo = async () => {
    const modelo = modelos.find(m=>String(m.id)===String(modeloSel));
    if (!modelo || !confirm(`Excluir o modelo "${modelo.nome}"? Os laudos ja criados nao serao alterados.`)) return;
    try {
      await deleteFromCollection("laudo_modelos", String(modelo.id));
      await auditLog("Excluiu Modelo de Laudo", "laudo_modelos", String(modelo.id), modelo.nome, modelo, null);
      setModeloSel("");
      setForm(f=>({...f,modeloId:"",modeloVersao:null}));
      toast_("Modelo excluido. Laudos historicos foram preservados.", "red");
    } catch(e) { toast_(fbErr(e), "red"); }
  };

  const novoAPartirDoLaudo = (laudo) => {
    setSel(null);
    setModeloSel(laudo.modeloId||"");
    setForm(novoFormLaudo({
      tipo:laudo.tipo, clienteId:laudo.clienteId||"", produtoId:laudo.produtoId||"", produto:laudo.produto,
      linha:laudo.linha||"", obs:"", armazenamento:laudo.armazenamento||DEFAULT_ARMAZENAMENTO,
      ensaios:ensaiosDoModelo(ensaiosComoModelo(laudo.ensaios)), modeloId:laudo.modeloId||"", modeloVersao:laudo.modeloVersao||null,
    }));
    setView("novo");
  };
  const editarLaudo = (laudo) => {
    setSel(laudo);
    setModeloSel(laudo.modeloId||"");
    setForm(novoFormLaudo({ tipo:laudo.tipo, clienteId:laudo.clienteId||"", produtoId:laudo.produtoId||"", produto:laudo.produto, linha:laudo.linha||"", lote:laudo.lote||"", op:laudo.op||"", data:laudo.data||tod(), obs:laudo.obs||"", armazenamento:laudo.armazenamento||DEFAULT_ARMAZENAMENTO, ensaios:laudo.ensaios||[], modeloId:laudo.modeloId||"", modeloVersao:laudo.modeloVersao||null }));
    setView("novo");
  };


  const abrirNovo = () => { setSel(null); setModeloSel(""); setForm(novoFormLaudo()); setView("novo"); };

  const importarEnsaios = () => {
    if (form.tipo === "processo") {
      const reg = ipcRegs.find(r => r.op === form.op || r.produto === form.produto);
      if (reg?.resultados?.length) {
        setF("ensaios", reg.resultados.map(r=>({ label:r.label, categoria: inferirCategoria(r.label), unidade:r.unidade||"", especificacao:"", resultado:r.resultado||"", conforme:r.conforme, obs:r.obs||"" })));
        toast_("Ensaios importados do IPC!", "green");
      } else toast_("Nenhum registro IPC encontrado para essa OP/produto.", "red");
    } else {
      const analise = analises.find(a => a.lote === form.lote || a.op === form.op);
      if (analise?.resultados?.length) {
        setF("ensaios", analise.resultados.map(r=>({ label:r.ensaio||r.label||"", categoria: inferirCategoria(r.ensaio||r.label||""), unidade:r.unidade||"", especificacao:r.especificacao||"", resultado:r.resultado||"", conforme:r.conforme, obs:r.obs||"" })));
        toast_("Ensaios importados do CQ!", "green");
      } else toast_("Nenhuma análise CQ encontrada para esse lote/OP.", "red");
    }
  };

  const addEnsaio = () => setF("ensaios", [...(form.ensaios||[]), { label:"", categoria:"Geral", unidade:"", especificacao:"", resultado:"", conforme:null, obs:"" }]);
  const setEnsaio = (i,k,v) => setF("ensaios", form.ensaios.map((e,idx)=>idx===i?{...e,[k]:v}:e));
  const delEnsaio = (i) => setF("ensaios", form.ensaios.filter((_,idx)=>idx!==i));

  const calcStatus = (ensaios) => {
    if (!ensaios?.length) return "Rascunho";
    if (ensaios.some(e=>e.conforme===false)) return "Reprovado";
    if (ensaios.every(e=>e.resultado)) return "Aprovado";
    return "Rascunho";
  };

  const salvar = async () => {
    try {
    if (!form.clienteId) { alert("Selecione o cliente."); return; }
    if (!form.produto) { alert("Informe o produto."); return; }
    const status = calcStatus(form.ensaios);
    // Gerar número sequencial LA-AAAA-NNN
    // Número sequencial: LA-AAAA-NNN baseado na contagem de laudos
    const numLaudo = sel ? sel.numLaudo : await incrementLaudoCounter();
    const id = sel ? sel.id : Date.now();
    const laudo = { id, numLaudo, ...form, modeloId:form.modeloId||sel?.modeloId||"", modeloVersao:form.modeloVersao||sel?.modeloVersao||null, status, assinaturaAnalista:sel?.assinaturaAnalista||null, assinaturaRT:sel?.assinaturaRT||null, criadoPor:sel?.criadoPor||user.name, criadoEm:sel?.criadoEm||tod(), criadoTs:sel?sel.criadoTs:Date.now(), atualizadoEm:tod() };
    await saveCollection("laudos", String(id), laudo);
    await auditLog(sel ? "Editou Laudo" : "Criou Laudo", "laudos", String(id), `${numLaudo} — ${laudo.produto}`, sel || null, { numLaudo, produto: laudo.produto, status: laudo.status, cliente: laudo.clienteId });
    toast_(sel?"Laudo atualizado!":"Laudo criado!", "green");
    setView("lista"); setSel(null);
    setForm(novoFormLaudo());
    setModeloSel("");
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const assinarAnalista = async (laudo) => {
    try {
    const password = window.prompt("Confirme sua senha para assinar o laudo:");
    if (!password) return;
    const assSig = await createElectronicSignature({ password, contexto:`LAUDO|${laudo.numLaudo||laudo.id||""}`, papel:user.role==="rt"?"Responsavel Tecnico":"Analista de CQ" });
    await saveCollection("laudos", String(laudo.id), { ...laudo, assinaturaAnalista: assSig });
    await auditLog("Assinou Laudo (Analista)", "laudos", String(laudo.id), `${laudo.numLaudo} — ${laudo.produto}`, null, { assinante: user.name, cargo: assSig.cargo });
    toast_("Laudo assinado!", "green");
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const assinarRT = async (laudo) => {
    try {
    const novoStatus = calcStatus(laudo.ensaios) === "Aprovado" ? "Finalizado" : calcStatus(laudo.ensaios);
    const password = window.prompt("Confirme sua senha para assinar como RT:");
    if (!password) return;
    const assRT = await createElectronicSignature({ password, contexto:`LAUDO|${laudo.numLaudo||laudo.id||""}`, papel:"Responsavel Tecnico" });
    await saveCollection("laudos", String(laudo.id), { ...laudo, status: novoStatus, assinaturaRT: assRT });
    await auditLog("Assinou Laudo (RT)", "laudos", String(laudo.id), `${laudo.numLaudo} — ${laudo.produto}`, { status: laudo.status }, { status: novoStatus, assinante: user.name });
    toast_("Laudo assinado como RT!", "green");
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const deletar = async (id) => {
    try {
    if (!confirm("Excluir este laudo?")) return;
    const antesL = laudos.find(l => String(l.id) === String(id));
    await deleteFromCollection("laudos", String(id));
    await auditLog("Excluiu Laudo", "laudos", String(id), antesL?.numLaudo ? `${antesL.numLaudo} — ${antesL.produto}` : String(id), antesL, null);
    setView("lista"); setSel(null);
    toast_("Laudo excluído.", "red");
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const exportPDF = (laudo) => {
    const cliente = clientes.find(c=>String(c.id)===String(laudo.clienteId));
    const tipo = TIPOS.find(t=>t.id===laudo.tipo)?.label||laudo.tipo;
    const statusColor = laudo.status==="Aprovado"||laudo.status==="Finalizado" ? "#3b6d11" : laudo.status==="Reprovado" ? "#b71c1c" : "#666";
    const statusBg = laudo.status==="Aprovado"||laudo.status==="Finalizado" ? "#eaf3de" : laudo.status==="Reprovado" ? "#ffebee" : "#f5f5f5";
    const statusTxt = laudo.status==="Aprovado"||laudo.status==="Finalizado" ? "APROVADO — Produto em conformidade com as especificações" : laudo.status==="Reprovado" ? "REPROVADO — Um ou mais ensaios fora das especificações" : "RASCUNHO — Laudo em elaboração";

    // Agrupar ensaios por categoria
    const grupos = {};
    const ordemCats = [];
    (laudo.ensaios||[]).forEach(e => {
      const cat = e.categoria || "Geral";
      if (!grupos[cat]) { grupos[cat] = []; ordemCats.push(cat); }
      grupos[cat].push(e);
    });
    const ensaiosHTML = ordemCats.map(cat => {
      const linhas = grupos[cat].map((e,i)=>`
        <tr style="background:${i%2===0?"#fff":"#f9f9f9"}">
          <td style="padding:7px 10px;font-weight:600">${e.label||"—"}</td>
          <td style="padding:7px 10px;color:#666">${e.unidade||"—"}</td>
          <td style="padding:7px 10px;color:#666">${e.especificacao||"—"}</td>
          <td style="padding:7px 10px">${e.resultado||"—"}</td>
          <td style="padding:7px 10px;text-align:center"><span style="background:${e.conforme===true?"#eaf3de":e.conforme===false?"#ffebee":"#f5f5f5"};color:${e.conforme===true?"#3b6d11":e.conforme===false?"#b71c1c":"#666"};padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600">${e.conforme===true?"Conforme":e.conforme===false?"Não conforme":"—"}</span></td>
        </tr>`).join("");
      return `
        <tr><td colspan="5" style="background:#2d5016;color:#fff;padding:6px 10px;font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase">${cat}</td></tr>
        ${linhas}`;
    }).join("");

    const assinaturaAnalistaHTML = seloAssHTML(laudo.assinaturaAnalista, "Analista — Controle de Qualidade", "#2d5016", `LAUDO|${laudo.num||laudo.id||""}`);

    const assinaturaRTHTML = seloAssHTML(laudo.assinaturaRT, "Responsável Técnico", "#2d5016", `LAUDO|${laudo.num||laudo.id||""}`);

    const corpo = `
        <div class="section">
          <div class="stitle">Identificação</div>
          <div class="grid3">
            <div class="field"><div class="flabel">Cliente</div><div class="fval">${cliente?.nome||"—"}</div>${cliente?.cnpj?`<div style="font-size:10px;color:#888">CNPJ: ${cliente.cnpj}</div>`:""}</div>
            <div class="field"><div class="flabel">Produto</div><div class="fval">${laudo.produto}</div>${laudo.linha?`<div style="font-size:10px;color:#888">${laudo.linha}</div>`:""}</div>
            <div class="field"><div class="flabel">Identificação</div><div class="fval">${laudo.op||laudo.lote||"—"}</div><div style="font-size:10px;color:#888">Lote: ${laudo.lote||"—"} · ${fmt(laudo.data)}</div></div>
          </div>
          <div style="margin-top:8px"><span style="font-size:11px;padding:3px 10px;border-radius:20px;background:#e1f5ee;color:#0f6e56;font-weight:bold">${tipo}</span></div>
        </div>
        <div class="section">
          <div class="stitle">Resultados dos ensaios</div>
          <table style="font-size:12px">
            <thead><tr><th>Ensaio</th><th>Unidade</th><th>Especificação</th><th>Resultado</th><th style="text-align:center">Situação</th></tr></thead>
            <tbody>${ensaiosHTML}</tbody>
          </table>
        </div>
        <div style="padding:10px 14px;background:${statusBg};border-left:3px solid ${statusColor};border-radius:4px;margin-bottom:16px">
          <div style="font-size:12px;font-weight:bold;color:${statusColor}">${statusTxt}</div>
        </div>
        ${laudo.obs?`<div style="padding:10px 14px;background:#f9f9f9;border-radius:4px;font-size:12px;color:#555;margin-bottom:16px"><strong>Observações:</strong> ${laudo.obs}</div>`:""}
        ${laudo.armazenamento?`<div style="padding:10px 14px;background:#e8f5e9;border-left:3px solid #2e7d32;border-radius:4px;margin-bottom:16px"><div style="font-size:11px;font-weight:bold;color:#2e7d32;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px">Condições de armazenamento</div><div style="font-size:11px;color:#333;white-space:pre-line">${laudo.armazenamento}</div></div>`:""}
        <div style="border-top:1px solid #eee;padding-top:16px;margin-top:8px;display:grid;grid-template-columns:1fr 1fr;gap:24px">
          ${assinaturaAnalistaHTML}
          ${assinaturaRTHTML}
        </div>`;
    openPDFWindow(`Laudo ${laudo.numLaudo}`, buildPDFShell({
      titulo: "Laudo Analítico",
      numero: laudo.numLaudo,
      meta: fmt(laudo.data),
      rodapeEsq: `${HERBAMED_INFO.nome} · CNPJ: ${HERBAMED_INFO.cnpj}`,
      corpo,
    }));
  };

  const statusColor = { "Aprovado":T.accent, "Finalizado":T.accent, "Reprovado":T.red, "Rascunho":T.text3 };
  const statusBg    = { "Aprovado":T.accent+"18", "Finalizado":T.accent+"18", "Reprovado":T.red+"18", "Rascunho":T.border };
  const statusIcon  = { "Aprovado":"✅", "Finalizado":"🏆", "Reprovado":"❌", "Rascunho":"📝" };

  const filtrados = laudos
    .filter(l => filtroStatus==="todos" || l.status===filtroStatus)
    .filter(l => !busca || l.produto?.toLowerCase().includes(busca.toLowerCase()) || l.numLaudo?.toLowerCase().includes(busca.toLowerCase()) || clientes.find(c=>String(c.id)===String(l.clienteId))?.nome?.toLowerCase().includes(busca.toLowerCase()));
  const {paginated:_lds,page:_pgL,total:_totL,setPage:_setPgL} = usePagination(filtrados, 20);

  // ── FORM ──
  if (view === "novo") return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
        <button style={s.btn} onClick={()=>{setView("lista");setSel(null);}}>← Voltar</button>
        <h2 style={{ fontSize:18, fontWeight:700, color:T.text, margin:0 }}>{sel?"Editar Laudo":"Novo Laudo Analítico"}</h2>
      </div>
      {!sel && <div style={{ ...s.card, background:T.accent+"0d", border:`1px solid ${T.accent}33` }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          <div style={{ minWidth:180 }}>
            <div style={{ fontSize:13, fontWeight:700, color:T.accent }}>{"Modelo de laudo"}</div>
            <div style={{ fontSize:10, color:T.text3, marginTop:2 }}>{"Carrega ensaios, especificacoes e textos padrao."}</div>
          </div>
          <Sel value={modeloSel} onChange={e=>aplicarModelo(e.target.value)} sx={{ flex:"1 1 260px", maxWidth:420 }}>
            <option value="">Selecionar modelo salvo...</option>
            {modelos.map(m=><option key={m.id} value={m.id}>{m.nome} {m.versao?`(v${m.versao})`:""}</option>)}
          </Sel>
          <button style={{ ...s.btn, fontSize:11 }} onClick={()=>salvarModelo(form)}>
            {modeloSel ? "Atualizar modelo" : "Salvar como modelo"}
          </button>
          {modeloSel && <button style={{ ...s.btnD, fontSize:11 }} onClick={excluirModelo}>Excluir modelo</button>}
        </div>
        {modelos.length===0 && <div style={{ fontSize:11, color:T.text3, marginTop:8 }}>
          {"Ainda nao ha modelos. Preencha este laudo ou use um laudo antigo para criar o primeiro."}
        </div>}
        {form.modeloId && <div style={{ fontSize:10, color:T.accent, marginTop:8 }}>
          {`Este laudo usara o modelo selecionado na versao ${form.modeloVersao||1}. Resultados, lote, OP e assinaturas permanecem vazios.`}
        </div>}
      </div>}
      <div style={s.card}>

        <SecTitle icon="📋" ch="Identificação" />
        <G2 ch={<>
          <F lbl="Tipo de laudo *" ch={<Sel value={form.tipo} onChange={e=>setF("tipo",e.target.value)}>{TIPOS.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</Sel>} />
          <F lbl="Cliente *" ch={<Sel value={form.clienteId} onChange={e=>setF("clienteId",e.target.value)}><option value="">Selecione o cliente...</option>{clientes.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</Sel>} />
          <F lbl="Produto *" ch={<Inp list="laudo-produtos-modelos" placeholder="Nome do produto" value={form.produto} onChange={e=>setF("produto",e.target.value)} onBlur={tentarModeloDoProduto} />} />
          <datalist id="laudo-produtos-modelos">{modelos.map(m=><option key={m.id} value={m.produto}>{m.nome}</option>)}</datalist>
          <F lbl="Linha" ch={<Inp placeholder="Ex: Supra, Verde..." value={form.linha} onChange={e=>setF("linha",e.target.value)} />} />
          <F lbl="Lote" ch={<Inp placeholder="Número do lote" value={form.lote} onChange={e=>setF("lote",e.target.value)} />} />
          <F lbl="OP" ch={<Inp placeholder="Ordem de produção" value={form.op} onChange={e=>setF("op",e.target.value)} />} />
          <F lbl="Data" ch={<Inp type="date" value={form.data} onChange={e=>setF("data",e.target.value)} />} />
        </>} />
        <F lbl="Observações" ch={<Inp placeholder="Obs gerais do laudo..." value={form.obs} onChange={e=>setF("obs",e.target.value)} />} />
        <F lbl="Condições de armazenamento" ch={<TA rows={3} value={form.armazenamento} onChange={e=>setF("armazenamento",e.target.value)} />} />
      </div>

      <div style={s.card}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <SecTitle icon="🔬" ch="Ensaios" />
          <div style={{ display:"flex", gap:8 }}>
            <button style={{ ...s.btn, fontSize:11 }} onClick={importarEnsaios}>📥 Importar do {form.tipo==="processo"?"IPC":"CQ"}</button>
            <button style={{ ...s.btn, fontSize:11 }} onClick={()=>{ setBibSel({}); setBibBusca(""); setBibCat("todas"); setBibOpen(true); }}>📚 Biblioteca</button>
            <button style={{ ...s.btnA, fontSize:11 }} onClick={addEnsaio}><span className="btn-emoji">+ </span>Adicionar ensaio</button>
          </div>
        </div>
        {(form.ensaios||[]).length === 0 ? (
          <div style={{ textAlign:"center", padding:"1.5rem", color:T.text3, fontSize:12 }}>Nenhum ensaio adicionado. Use "Importar" ou "Adicionar ensaio".</div>
        ) : (
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:T.surf }}>
                  {["Categoria","Ensaio","Unidade","Especificação","Resultado","Conforme?","Obs",""].map(h=>(
                    <th key={h} style={{ padding:"7px 8px", fontSize:10, fontWeight:700, color:T.text3, textTransform:"uppercase", textAlign:"left", borderBottom:`1px solid ${T.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {form.ensaios.map((e,i)=>(
                  <tr key={i} style={{ background:i%2===0?T.card:T.surf, borderLeft:e.conforme===false?`3px solid ${T.red}`:e.conforme===true?`3px solid ${T.accent}`:"3px solid transparent" }}>
                    <td style={{ padding:"6px 8px" }}>
                      <Sel value={e.categoria||"Geral"} onChange={ev=>setEnsaio(i,"categoria",ev.target.value)} sx={{ fontSize:11, padding:"4px 6px", minWidth:120 }}>
                        {CATEGORIAS_LAUDO.map(c=><option key={c} value={c}>{c}</option>)}
                      </Sel>
                    </td>
                    <td style={{ padding:"6px 8px" }}><Inp value={e.label} onChange={ev=>setEnsaio(i,"label",ev.target.value)} placeholder="Nome..." sx={{ fontSize:11, padding:"4px 6px" }} /></td>
                    <td style={{ padding:"6px 8px" }}><Inp value={e.unidade} onChange={ev=>setEnsaio(i,"unidade",ev.target.value)} placeholder="g/mL..." sx={{ fontSize:11, padding:"4px 6px", width:60 }} data-auto-capitalize="off" /></td>
                    <td style={{ padding:"6px 8px" }}><Inp value={e.especificacao} onChange={ev=>setEnsaio(i,"especificacao",ev.target.value)} placeholder="Especificação..." sx={{ fontSize:11, padding:"4px 6px" }} /></td>
                    <td style={{ padding:"6px 8px" }}><Inp value={e.resultado} onChange={ev=>setEnsaio(i,"resultado",ev.target.value)} placeholder="Resultado..." sx={{ fontSize:11, padding:"4px 6px" }} /></td>
                    <td style={{ padding:"6px 8px" }}>
                      <div style={{ display:"flex", gap:3 }}>
                        <button onClick={()=>setEnsaio(i,"conforme",true)} style={{ padding:"3px 7px", borderRadius:5, border:`1px solid ${e.conforme===true?T.accent+"55":T.border}`, background:e.conforme===true?T.accent+"22":"transparent", color:e.conforme===true?T.accent:T.text2, cursor:"pointer", fontFamily:"inherit", fontSize:11 }}>✓</button>
                        <button onClick={()=>setEnsaio(i,"conforme",false)} style={{ padding:"3px 7px", borderRadius:5, border:`1px solid ${e.conforme===false?T.red+"55":T.border}`, background:e.conforme===false?T.red+"22":"transparent", color:e.conforme===false?T.red:T.text2, cursor:"pointer", fontFamily:"inherit", fontSize:11 }}>✗</button>
                        <button onClick={()=>setEnsaio(i,"conforme",null)} style={{ padding:"3px 5px", borderRadius:5, border:`1px solid ${T.border}`, background:"transparent", color:T.text3, cursor:"pointer", fontFamily:"inherit", fontSize:10 }}>—</button>
                      </div>
                    </td>
                    <td style={{ padding:"6px 8px" }}><Inp value={e.obs} onChange={ev=>setEnsaio(i,"obs",ev.target.value)} placeholder="obs..." sx={{ fontSize:11, padding:"4px 6px", width:80 }} /></td>
                    <td style={{ padding:"6px 8px" }}><button onClick={()=>delEnsaio(i)} style={{ ...s.btnD, fontSize:10, padding:"3px 7px" }}>🗑️</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
        <button style={s.btn} onClick={()=>{setView("lista");setSel(null);}}>Cancelar</button>
        <button style={s.btnA} onClick={salvar}>Salvar laudo ✓</button>
      </div>

      {/* ── MODAL BIBLIOTECA DE ENSAIOS ── */}
      {bibOpen && (() => {
        const filtrados = BIBLIOTECA_ENSAIOS.filter(b => {
          const catOK = bibCat === "todas" || b.categoria === bibCat;
          const txtOK = !bibBusca.trim() || (b.label + " " + b.especificacao).toLowerCase().includes(bibBusca.toLowerCase());
          return catOK && txtOK;
        });
        const porCategoria = {};
        filtrados.forEach(b => { (porCategoria[b.categoria] = porCategoria[b.categoria] || []).push(b); });
        const totalSel = Object.values(bibSel).filter(Boolean).length;
        const chave = b => `${b.categoria}|${b.label}`;
        const adicionar = () => {
          const novos = filtrados.filter(b => bibSel[chave(b)]).map(b => ({
            label: b.label, categoria: b.categoria, unidade: b.unidade, especificacao: b.especificacao,
            resultado: "", conforme: null, obs: ""
          }));
          if (novos.length === 0) { toast_("Nenhum ensaio selecionado.", "red"); return; }
          setF("ensaios", [...(form.ensaios||[]), ...novos]);
          setBibOpen(false); setBibSel({});
          toast_(`${novos.length} ensaio(s) adicionado(s) da biblioteca.`, "green");
        };
        return (
          <div onClick={()=>setBibOpen(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
            <div onClick={e=>e.stopPropagation()} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, width:"min(720px, 96vw)", maxHeight:"86vh", display:"flex", flexDirection:"column", boxShadow:"0 24px 64px rgba(0,0,0,0.4)" }}>
              {/* Header */}
              <div style={{ padding:"16px 20px 12px", borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:T.text }}>📚 Biblioteca de Ensaios</div>
                  <div style={{ fontSize:11, color:T.text3, marginTop:2 }}>{filtrados.length} ensaio(s) · {totalSel} selecionado(s)</div>
                </div>
                <button onClick={()=>setBibOpen(false)} style={{ background:"none", border:`1px solid ${T.border}`, borderRadius:8, color:T.text2, cursor:"pointer", fontSize:13, padding:"4px 12px", fontFamily:"inherit" }}>✕</button>
              </div>
              {/* Filtros */}
              <div style={{ padding:"12px 20px", borderBottom:`1px solid ${T.border}`, display:"flex", gap:8, flexWrap:"wrap" }}>
                <Inp placeholder="🔎 Buscar ensaio..." value={bibBusca} onChange={e=>setBibBusca(e.target.value)} sx={{ fontSize:12, padding:"6px 10px", flex:"1 1 200px" }} />
                <Sel value={bibCat} onChange={e=>setBibCat(e.target.value)} sx={{ fontSize:12, padding:"6px 10px", minWidth:160 }}>
                  <option value="todas">Todas as categorias</option>
                  {CATEGORIAS_LAUDO.map(c=><option key={c} value={c}>{c}</option>)}
                </Sel>
              </div>
              {/* Lista */}
              <div style={{ overflowY:"auto", padding:"8px 20px 16px", flex:1 }}>
                {Object.keys(porCategoria).length === 0 ? (
                  <div style={{ textAlign:"center", padding:"2rem", color:T.text3, fontSize:12 }}>Nenhum ensaio encontrado.</div>
                ) : Object.entries(porCategoria).map(([cat, itens]) => (
                  <div key={cat} style={{ marginTop:12 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:T.accent, textTransform:"uppercase", letterSpacing:0.5, marginBottom:6, paddingBottom:4, borderBottom:`1px solid ${T.border}` }}>{cat} · {itens.length}</div>
                    {itens.map(b => {
                      const k = chave(b);
                      const checked = !!bibSel[k];
                      return (
                        <label key={k} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 6px", cursor:"pointer", borderRadius:6, background: checked ? T.accent+"15" : "transparent" }}>
                          <input type="checkbox" checked={checked} onChange={e=>setBibSel(p=>({...p,[k]:e.target.checked}))} style={{ cursor:"pointer", accentColor:T.accent }} />
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:12, fontWeight:600, color:T.text }}>{b.label} {b.unidade && b.unidade!=="—" && <span style={{ fontSize:10, color:T.text3, fontWeight:400 }}>({b.unidade})</span>}</div>
                            <div style={{ fontSize:11, color:T.text2, marginTop:1 }}>{b.especificacao}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                ))}
              </div>
              {/* Footer */}
              <div style={{ padding:"12px 20px", borderTop:`1px solid ${T.border}`, display:"flex", justifyContent:"flex-end", gap:8 }}>
                <button onClick={()=>setBibOpen(false)} style={s.btn}>Cancelar</button>
                <button onClick={adicionar} style={s.btnA}>+ Adicionar {totalSel > 0 ? `(${totalSel})` : ""}</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );

  // ── DETALHE ──
  if (view === "detalhe" && sel) {
    const lSel = laudos.find(l=>l.id===sel.id)||sel;
    const cliente = clientes.find(c=>String(c.id)===String(lSel.clienteId));
    const tipo = TIPOS.find(t=>t.id===lSel.tipo)?.label||lSel.tipo;
    const podeAssinarAnalista = podeGerenciar && !lSel.assinaturaAnalista && (user.role!=="rt");
    const podeAssinarRT = podeGerenciar && !!lSel.assinaturaAnalista && !lSel.assinaturaRT && isRT && String(lSel.assinaturaAnalista.userId||lSel.assinaturaAnalista.uid||"")!==String(user.uid||user.id||"");
    return (
      <div>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20, flexWrap:"wrap" }}>
          <button style={s.btn} onClick={()=>{setView("lista");setSel(null);}}>← Voltar</button>
          <h2 style={{ fontSize:18, fontWeight:700, color:T.text, margin:0 }}>N° {lSel.numLaudo}</h2>
          <span style={{ padding:"3px 12px", borderRadius:20, fontSize:11, fontWeight:700, background:statusBg[lSel.status], color:statusColor[lSel.status] }}>{statusIcon[lSel.status]} {lSel.status}</span>
          <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
            {podeAssinarAnalista && <button style={{ ...s.btnA, fontSize:12 }} onClick={()=>assinarAnalista(lSel)}><span className="btn-emoji">✍️ </span>Assinar como Analista</button>}
            {podeAssinarRT && <button style={{ ...btnCor(T.orange||"#ff9800"), fontSize:12 }} onClick={()=>assinarRT(lSel)}><span className="btn-emoji">🔬 </span>Assinar como RT</button>}
            <button style={{ ...s.btn, fontSize:12 }} onClick={()=>exportPDF(lSel)}><span className="btn-emoji">🖨️ </span>Exportar PDF</button>
            {podeGerenciar && <button style={{ ...s.btn, fontSize:12, color:T.accent }} onClick={()=>novoAPartirDoLaudo(lSel)}>Criar novo com base neste</button>}
            {podeGerenciar && <button style={{ ...s.btn, fontSize:12 }} onClick={()=>salvarModelo(lSel, true)}>Salvar como novo modelo</button>}
            {podeGerenciar && !lSel.assinaturaAnalista && !lSel.assinaturaRT && (<>
            <button style={{ ...s.btn, fontSize:12 }} onClick={()=>editarLaudo(lSel)}><span className="btn-emoji">✏️ </span>Editar</button>
            <button style={{ ...s.btnD, fontSize:12 }} onClick={()=>deletar(lSel.id)}>🗑️</button>
            </>)}
          </div>
        </div>
        {(lSel.assinaturaAnalista||lSel.assinaturaRT) && <div style={{ ...s.card, padding:"10px 14px", borderLeft:`3px solid ${T.accent}`, color:T.text2, fontSize:11 }}>
          Registro assinado e bloqueado para edicao ou exclusao. Para reaproveitar a estrutura, use "Criar novo com base neste".
        </div>}
        <div style={s.card}>
          <SecTitle icon="📋" ch="Identificação" />
          <G3 ch={<>
            <F lbl="Cliente" ch={<div style={{ padding:"8px 10px", background:T.surf, borderRadius:8, fontSize:13 }}>{cliente?.nome||"—"}</div>} />
            <F lbl="Tipo" ch={<div style={{ padding:"8px 10px", background:T.surf, borderRadius:8, fontSize:13 }}>{tipo}</div>} />
            <F lbl="Produto" ch={<div style={{ padding:"8px 10px", background:T.surf, borderRadius:8, fontSize:13 }}>{lSel.produto}{lSel.linha?` — ${lSel.linha}`:""}</div>} />
            <F lbl="Lote" ch={<div style={{ padding:"8px 10px", background:T.surf, borderRadius:8, fontSize:13 }}>{lSel.lote||"—"}</div>} />
            <F lbl="OP" ch={<div style={{ padding:"8px 10px", background:T.surf, borderRadius:8, fontSize:13 }}>{lSel.op||"—"}</div>} />
            <F lbl="Data" ch={<div style={{ padding:"8px 10px", background:T.surf, borderRadius:8, fontSize:13 }}>{fmt(lSel.data)}</div>} />
          </>} />
          {lSel.obs && <F lbl="Observações" ch={<div style={{ padding:"8px 10px", background:T.surf, borderRadius:8, fontSize:13, color:T.text2 }}>{lSel.obs}</div>} />}
          {lSel.armazenamento && <F lbl="Condições de armazenamento" ch={<div style={{ padding:"8px 10px", background:T.surf, borderRadius:8, fontSize:12, color:T.text2, whiteSpace:"pre-line" }}>{lSel.armazenamento}</div>} />}
        </div>
        <div style={s.card}>
          <SecTitle icon="🔬" ch="Ensaios" />
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
              <thead>
                <tr style={{ background:T.surf }}>
                  {["Ensaio","Unidade","Especificação","Resultado","Situação","Obs."].map(h=>(
                    <th key={h} style={{ padding:"7px 10px", textAlign:"left", fontSize:10, fontWeight:700, color:T.text3, textTransform:"uppercase", borderBottom:`1px solid ${T.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const grupos = {};
                  const ordem = [];
                  (lSel.ensaios||[]).forEach(e => {
                    const cat = e.categoria || "Geral";
                    if (!grupos[cat]) { grupos[cat] = []; ordem.push(cat); }
                    grupos[cat].push(e);
                  });
                  return ordem.flatMap(cat => [
                    <tr key={`cat-${cat}`}><td colSpan={6} style={{ background:T.accent+"22", color:T.accent, padding:"6px 10px", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:0.5 }}>{cat}</td></tr>,
                    ...grupos[cat].map((e,i) => (
                      <tr key={`${cat}-${i}`} style={{ background:i%2===0?T.card:T.surf, borderLeft:e.conforme===false?`3px solid ${T.red}`:e.conforme===true?`3px solid ${T.accent}`:"3px solid transparent" }}>
                        <td style={{ padding:"8px 10px", fontWeight:600 }}>{e.label||"—"}</td>
                        <td style={{ padding:"8px 10px", color:T.text3 }}>{e.unidade||"—"}</td>
                        <td style={{ padding:"8px 10px", color:T.text2 }}>{e.especificacao||"—"}</td>
                        <td style={{ padding:"8px 10px" }}>{e.resultado||"—"}</td>
                        <td style={{ padding:"8px 10px" }}>{e.conforme===true?<span style={{ color:T.accent, fontWeight:700 }}>✓ Conforme</span>:e.conforme===false?<span style={{ color:T.red, fontWeight:700 }}>✗ N.C.</span>:<span style={{ color:T.text3 }}>—</span>}</td>
                        <td style={{ padding:"8px 10px", color:T.text2 }}>{e.obs||"—"}</td>
                      </tr>
                    ))
                  ]);
                })()}
              </tbody>
            </table>
          </div>
          <div style={{ padding:"12px 16px", borderRadius:10, textAlign:"center", fontWeight:700, fontSize:14, background:statusBg[lSel.status], color:statusColor[lSel.status], border:`1px solid ${statusColor[lSel.status]}33`, marginTop:12 }}>
            {statusIcon[lSel.status]} {lSel.status==="Aprovado"||lSel.status==="Finalizado"?"APROVADO — Produto em conformidade":lSel.status==="Reprovado"?"REPROVADO — Ensaios fora das especificações":"RASCUNHO — Em elaboração"}
          </div>
        </div>
        <div style={s.card}>
          <SecTitle icon="✍️" ch="Assinaturas" />
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24 }}>
            <div style={{ textAlign:"left", padding:"1rem", background:T.surf, borderRadius:10, border:`1px solid ${T.border}` }}>
              <div style={{ fontSize:11, fontWeight:700, color:T.text3, textTransform:"uppercase", marginBottom:12 }}>Analista de CQ</div>
              {lSel.assinaturaAnalista ? (<>
                <div style={{ fontSize:13, fontWeight:700, color:T.text }}>{lSel.assinaturaAnalista.nome}</div>
                {lSel.assinaturaAnalista.cargo && <div style={{ fontSize:11, color:T.text2 }}>{lSel.assinaturaAnalista.cargo}</div>}
                {(lSel.assinaturaAnalista.registroProfissional||lSel.assinaturaAnalista.crf) && <div style={{ fontSize:10, color:T.text3 }}>Registro profissional: {lSel.assinaturaAnalista.registroProfissional||lSel.assinaturaAnalista.crf}</div>}
                <div style={{ fontSize:10, color:T.accent, marginTop:8, paddingTop:8, borderTop:`1px dashed ${T.border}` }}>✔ Assinado eletronicamente</div>
                <div style={{ fontSize:10, color:T.text2 }}>{lSel.assinaturaAnalista.timestamp?new Date(lSel.assinaturaAnalista.timestamp).toLocaleString("pt-BR"):lSel.assinaturaAnalista.dataHora}</div>
                <div style={{ fontSize:9, color:T.text3, marginTop:3, fontFamily:"monospace" }}>Cód.: {sigCodigo(lSel.assinaturaAnalista, `LAUDO|${lSel.num||lSel.id||""}`)}</div>
              </>) : <div style={{ fontSize:12, color:T.text3, padding:"1rem" }}>Aguardando assinatura</div>}
            </div>
            <div style={{ textAlign:"left", padding:"1rem", background:T.surf, borderRadius:10, border:`1px solid ${T.border}` }}>
              <div style={{ fontSize:11, fontWeight:700, color:T.text3, textTransform:"uppercase", marginBottom:12 }}>Responsável Técnico</div>
              {lSel.assinaturaRT ? (<>
                <div style={{ fontSize:13, fontWeight:700, color:T.text }}>{lSel.assinaturaRT.nome}</div>
                {lSel.assinaturaRT.cargo && <div style={{ fontSize:11, color:T.text2 }}>{lSel.assinaturaRT.cargo}</div>}
                {(lSel.assinaturaRT.registroProfissional||lSel.assinaturaRT.crf) && <div style={{ fontSize:10, color:T.text3 }}>Registro profissional: {lSel.assinaturaRT.registroProfissional||lSel.assinaturaRT.crf}</div>}
                <div style={{ fontSize:10, color:T.accent, marginTop:8, paddingTop:8, borderTop:`1px dashed ${T.border}` }}>✔ Assinado eletronicamente</div>
                <div style={{ fontSize:10, color:T.text2 }}>{lSel.assinaturaRT.timestamp?new Date(lSel.assinaturaRT.timestamp).toLocaleString("pt-BR"):lSel.assinaturaRT.dataHora}</div>
                <div style={{ fontSize:9, color:T.text3, marginTop:3, fontFamily:"monospace" }}>Cód.: {sigCodigo(lSel.assinaturaRT, `LAUDO|${lSel.num||lSel.id||""}`)}</div>
              </>) : <div style={{ fontSize:12, color:T.text3, padding:"1rem" }}>Aguardando assinatura do RT</div>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── LISTA ──
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, flexWrap:"wrap", gap:10 }}>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
          <div style={{ position:"relative" }}>
            <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:T.text3, fontSize:13 }}>🔍</span>
            <input placeholder="Buscar laudo, produto ou cliente..." value={busca} onChange={e=>setBusca(e.target.value)} style={{ ...s.inp, paddingLeft:30, width:220, fontSize:12 }} />
          </div>
          <Sel value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)}>
            <option value="todos">Todos os status</option>
            <option value="Rascunho">📝 Rascunho</option>
            <option value="Aprovado">✅ Aprovado</option>
            <option value="Reprovado">❌ Reprovado</option>
            <option value="Finalizado">🏆 Finalizado</option>
          </Sel>
        </div>
        {podeGerenciar && <button style={s.btnA} onClick={abrirNovo}>
          + Novo Laudo
        </button>}
      </div>

      {loading ? (
        <div style={{ textAlign:"center", padding:"3rem", color:T.text2 }}>Carregando...</div>
      ) : filtrados.length === 0 ? (
        <div style={{ textAlign:"center", padding:"3rem", color:T.text3 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
          <div style={{ fontSize:14 }}>Nenhum laudo encontrado.</div>
          <div style={{ fontSize:12, marginTop:6 }}>Crie o primeiro laudo analítico!</div>
        </div>
      ) : (<>
      {_lds.map(l => {
        const cliente = clientes.find(c=>String(c.id)===String(l.clienteId));
        const tipo = TIPOS.find(t=>t.id===l.tipo)?.label||l.tipo;
        return (
          <div key={l.id} className="rnc-row" onClick={()=>{setSel(l);setView("detalhe");}}
            style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"12px 16px", marginBottom:8, cursor:"pointer", display:"flex", alignItems:"center", gap:12, flexWrap:"wrap", borderLeft:`3px solid ${statusColor[l.status]||T.border}` }}>
            <div style={{ fontSize:22 }}>📋</div>
            <div style={{ flex:1, minWidth:150 }}>
              <div style={{ fontSize:13, fontWeight:700, color:T.text }}>{l.numLaudo} — {l.produto}</div>
              <div style={{ fontSize:11, color:T.text2, marginTop:2 }}>{cliente?.nome||"—"} · {tipo} · {fmt(l.data)}</div>
            </div>
            <div style={{ display:"flex", gap:6, alignItems:"center" }}>
              {l.assinaturaAnalista && <span style={{ fontSize:10, padding:"2px 8px", borderRadius:12, background:T.accent+"18", color:T.accent }}>✍️ Analista</span>}
              {l.assinaturaRT && <span style={{ fontSize:10, padding:"2px 8px", borderRadius:12, background:"#ff980018", color:"#ff9800" }}>🔬 RT</span>}
            </div>
            <span style={{ padding:"4px 12px", borderRadius:20, fontSize:11, fontWeight:700, background:statusBg[l.status], color:statusColor[l.status], flexShrink:0 }}>
              {statusIcon[l.status]} {l.status}
            </span>
          </div>
        );
      })
      }<Pagination page={_pgL} total={_totL} setPage={_setPgL}/>
      </>
      )}
    </div>
  );
}

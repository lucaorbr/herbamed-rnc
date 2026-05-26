import React, { useState, useEffect } from "react";
import { saveCollection, deleteFromCollection, subscribeCollection } from "../../firebase";
import { useTheme } from "../../core/theme";
import { fmt, seloAssHTML, sigCodigo, tod } from "../../core/utils";
import { useS } from "../../shared/styles";
import { usePagination } from "../../shared/ui";
import { F, G2, G3, Inp, Pagination, SecTitle, Sel, TA } from "../../shared/ui";

export const LOGO_HERBAMED = "https://res.cloudinary.com/dswsg9w0w/image/upload/484237672_1316151256653106_1151541448837719199_n1_zww2li";

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

export function LaudosTab({ user, toast_, users, auditLog }) {
  const T = useTheme(); const s = useS();
  const [laudos, setLaudos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [analises, setAnalises] = useState([]);
  const [ipcRegs, setIpcRegs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("lista");
  const [sel, setSel] = useState(null);

  const [form, setForm] = useState({ tipo:"produto_acabado", clienteId:"", produto:"", linha:"", lote:"", op:"", data:tod(), obs:"", armazenamento:`• Armazenar em local seco e fresco com temperatura de 15 a 30°C e umidade relativa de 30% a 80%.
• Armazenar o produto sobre palete ou paleteira, deixando espaço lateral de 15 cm em cada extremidade. Observar a altura máxima de empilhamento.`, ensaios:[] });
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [busca, setBusca] = useState("");
  // Modal biblioteca de ensaios
  const [bibOpen, setBibOpen] = useState(false);
  const [bibBusca, setBibBusca] = useState("");
  const [bibCat, setBibCat] = useState("todas");
  const [bibSel, setBibSel] = useState({});

  const isRT = user?.role === "rt" || user?.role === "admin";
  const rtUsers = users?.filter(u => u.role === "rt") || [];

  const TIPOS = [
    { id:"produto_acabado", label:"Produto Acabado" },
    { id:"materia_prima",   label:"Matéria-Prima" },
    { id:"processo",        label:"Processo (IPC)" },
  ];

  // Capturar prefill vindo do CQ Análises
  useEffect(() => {
    if (window._laudoPreFill) {
      const pf = window._laudoPreFill;
      setForm(f => ({ ...f, ...pf }));
      setView("novo");
      delete window._laudoPreFill;
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 3000);
    const u1 = subscribeCollection("laudos", list => { clearTimeout(t); setLaudos(list.sort((a,b)=>(b.criadoTs||0)-(a.criadoTs||0))); setLoading(false); });
    const u2 = subscribeCollection("clientes_terceiros", list => setClientes(list.sort((a,b)=>(a.nome||"").localeCompare(b.nome||""))));
    const u3 = subscribeCollection("cq_analises", list => setAnalises(list));
    const u4 = subscribeCollection("ipc_registros", list => setIpcRegs(list));
    return () => { clearTimeout(t); u1&&u1(); u2&&u2(); u3&&u3(); u4&&u4(); };
  }, []);

  const setF = (k,v) => setForm(p=>({...p,[k]:v}));

  const clienteSel = clientes.find(c=>String(c.id)===String(form.clienteId));

  const inferirCategoria = (nome) => {
    if (!nome) return "Geral";
    const match = BIBLIOTECA_ENSAIOS.find(b => b.label.toLowerCase() === nome.toLowerCase());
    return match?.categoria || "Geral";
  };

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
    const ano = new Date().getFullYear();
    const numLaudo = sel ? sel.numLaudo : `LA-${ano}-${String(laudos.filter(l=>l.numLaudo?.startsWith(`LA-${ano}`)).length + 1).padStart(3,"0")}`;
    const id = sel ? sel.id : Date.now();
    const laudo = { id, numLaudo, ...form, status, assinaturaAnalista:null, assinaturaRT:null, criadoPor:user.name, criadoEm:tod(), criadoTs:sel?sel.criadoTs:Date.now(), atualizadoEm:tod() };
    await saveCollection("laudos", String(id), laudo);
    await auditLog(sel ? "Editou Laudo" : "Criou Laudo", "laudos", String(id), `${numLaudo} — ${laudo.produto}`, sel || null, { numLaudo, produto: laudo.produto, status: laudo.status, cliente: laudo.clienteId });
    toast_(sel?"Laudo atualizado!":"Laudo criado!", "green");
    setView("lista"); setSel(null);
    setForm({ tipo:"produto_acabado", clienteId:"", produto:"", linha:"", lote:"", op:"", data:tod(), obs:"", armazenamento:`• Armazenar em local seco e fresco com temperatura de 15 a 30°C e umidade relativa de 30% a 80%.
• Armazenar o produto sobre palete ou paleteira, deixando espaço lateral de 15 cm em cada extremidade. Observar a altura máxima de empilhamento.`, ensaios:[] });
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const assinarAnalista = async (laudo) => {
    try {
    if (!user.assinatura) { toast_("Cadastre sua assinatura no perfil primeiro.", "red"); return; }
    const assSig = { nome:user.name, cargo:user.role==="rt"?"Responsável Técnico":"Analista de CQ", img:user.assinatura, dataHora:`${tod()} ${new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}` };
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
    if (!user.assinatura) { toast_("Cadastre sua assinatura no perfil primeiro.", "red"); return; }
    const novoStatus = calcStatus(laudo.ensaios) === "Aprovado" ? "Finalizado" : calcStatus(laudo.ensaios);
    const assRT = { nome:user.name, cargo:"Responsável Técnico", crf:user.crf||"", img:user.assinatura, dataHora:`${tod()} ${new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}` };
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

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:800px;margin:0 auto">
        <div style="background:#1a4a2e;padding:20px 24px;display:flex;justify-content:space-between;align-items:center">
          <div style="display:flex;align-items:center;gap:12px">
            <img src="${LOGO_HERBAMED}" style="width:44px;height:44px;border-radius:6px;object-fit:cover"/>
            <div>
              <div style="color:#fff;font-size:14px;font-weight:bold">${HERBAMED_INFO.nome}</div>
              <div style="color:#9fd4b2;font-size:10px">CNPJ: ${HERBAMED_INFO.cnpj}</div>
            </div>
          </div>
          <div style="text-align:right">
            <div style="color:#fff;font-size:13px;font-weight:bold">Laudo Analítico</div>
            <div style="color:#9fd4b2;font-size:11px">N° ${laudo.numLaudo}</div>
          </div>
        </div>
        <div style="padding:16px 24px;border-bottom:1px solid #eee;display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
          <div><div style="font-size:10px;color:#888;text-transform:uppercase;margin-bottom:3px">Cliente</div><div style="font-size:13px;font-weight:bold">${cliente?.nome||"—"}</div><div style="font-size:11px;color:#888">${cliente?.cnpj?"CNPJ: "+cliente.cnpj:""}</div></div>
          <div><div style="font-size:10px;color:#888;text-transform:uppercase;margin-bottom:3px">Produto</div><div style="font-size:13px;font-weight:bold">${laudo.produto}</div><div style="font-size:11px;color:#888">${laudo.linha||""}</div></div>
          <div><div style="font-size:10px;color:#888;text-transform:uppercase;margin-bottom:3px">Identificação</div><div style="font-size:13px;font-weight:bold">${laudo.op||laudo.lote||"—"}</div><div style="font-size:11px;color:#888">Lote: ${laudo.lote||"—"} · ${fmt(laudo.data)}</div></div>
        </div>
        <div style="padding:12px 24px;border-bottom:1px solid #eee"><span style="font-size:11px;padding:3px 10px;border-radius:20px;background:#e1f5ee;color:#0f6e56;font-weight:bold">${tipo}</span></div>
        <div style="padding:16px 24px">
          <div style="font-size:11px;font-weight:bold;color:#888;text-transform:uppercase;margin-bottom:10px">Resultados dos ensaios</div>
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead><tr style="background:#f5f5f5"><th style="padding:7px 10px;text-align:left;font-size:10px;color:#888;text-transform:uppercase">Ensaio</th><th style="padding:7px 10px;text-align:left;font-size:10px;color:#888;text-transform:uppercase">Unidade</th><th style="padding:7px 10px;text-align:left;font-size:10px;color:#888;text-transform:uppercase">Especificação</th><th style="padding:7px 10px;text-align:left;font-size:10px;color:#888;text-transform:uppercase">Resultado</th><th style="padding:7px 10px;text-align:center;font-size:10px;color:#888;text-transform:uppercase">Situação</th></tr></thead>
            <tbody>${ensaiosHTML}</tbody>
          </table>
        </div>
        <div style="margin:0 24px 16px;padding:10px 14px;background:${statusBg};border-left:3px solid ${statusColor};border-radius:4px">
          <div style="font-size:12px;font-weight:bold;color:${statusColor}">${statusTxt}</div>
        </div>
        ${laudo.obs?`<div style="margin:0 24px 16px;padding:10px 14px;background:#f9f9f9;border-radius:4px;font-size:12px;color:#555"><strong>Observações:</strong> ${laudo.obs}</div>`:""}
        ${laudo.armazenamento?`<div style="margin:0 24px 16px;padding:10px 14px;background:#e8f5e9;border-left:3px solid #2e7d32;border-radius:4px"><div style="font-size:11px;font-weight:bold;color:#2e7d32;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px">Condições de armazenamento</div><div style="font-size:11px;color:#333;white-space:pre-line">${laudo.armazenamento}</div></div>`:""}
        <div style="padding:16px 24px;border-top:1px solid #eee;display:grid;grid-template-columns:1fr 1fr;gap:24px">
          ${assinaturaAnalistaHTML}
          ${assinaturaRTHTML}
        </div>
        <div style="padding:10px 24px;background:#f5f5f5;border-top:1px solid #eee;display:flex;justify-content:space-between;font-size:10px;color:#888">
          <span>${HERBAMED_INFO.nome} · CNPJ: ${HERBAMED_INFO.cnpj}</span>
          <span>${HERBAMED_INFO.endereco} · ${HERBAMED_INFO.cidade} · CEP: ${HERBAMED_INFO.cep}</span>
        </div>
      </div>`;
    const win = window.open("","_blank");
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Laudo ${laudo.numLaudo}</title><style>@media print{body{margin:0}}</style></head><body>${html}<script>window.onload=()=>window.print();<\/script></body></html>`);
    win.document.close();
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
      <div style={s.card}>
        <SecTitle icon="📋" ch="Identificação" />
        <G2 ch={<>
          <F lbl="Tipo de laudo *" ch={<Sel value={form.tipo} onChange={e=>setF("tipo",e.target.value)}>{TIPOS.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</Sel>} />
          <F lbl="Cliente *" ch={<Sel value={form.clienteId} onChange={e=>setF("clienteId",e.target.value)}><option value="">Selecione o cliente...</option>{clientes.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</Sel>} />
          <F lbl="Produto *" ch={<Inp placeholder="Nome do produto" value={form.produto} onChange={e=>setF("produto",e.target.value)} />} />
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
                    <td style={{ padding:"6px 8px" }}><Inp value={e.unidade} onChange={ev=>setEnsaio(i,"unidade",ev.target.value)} placeholder="g/mL..." sx={{ fontSize:11, padding:"4px 6px", width:60 }} /></td>
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
    const podeAssinarAnalista = !lSel.assinaturaAnalista && (user.role!=="rt");
    const podeAssinarRT = !lSel.assinaturaRT && isRT;
    return (
      <div>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20, flexWrap:"wrap" }}>
          <button style={s.btn} onClick={()=>{setView("lista");setSel(null);}}>← Voltar</button>
          <h2 style={{ fontSize:18, fontWeight:700, color:T.text, margin:0 }}>N° {lSel.numLaudo}</h2>
          <span style={{ padding:"3px 12px", borderRadius:20, fontSize:11, fontWeight:700, background:statusBg[lSel.status], color:statusColor[lSel.status] }}>{statusIcon[lSel.status]} {lSel.status}</span>
          <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
            {podeAssinarAnalista && <button style={{ ...s.btnA, fontSize:12 }} onClick={()=>assinarAnalista(lSel)}><span className="btn-emoji">✍️ </span>Assinar como Analista</button>}
            {podeAssinarRT && <button style={{ ...s.btnA, fontSize:12, background:T.orange||"#ff9800" }} onClick={()=>assinarRT(lSel)}><span className="btn-emoji">🔬 </span>Assinar como RT</button>}
            <button style={{ ...s.btn, fontSize:12 }} onClick={()=>exportPDF(lSel)}><span className="btn-emoji">🖨️ </span>Exportar PDF</button>
            <button style={{ ...s.btn, fontSize:12 }} onClick={()=>{setSel(lSel);setForm({tipo:lSel.tipo,clienteId:lSel.clienteId,produto:lSel.produto,linha:lSel.linha||"",lote:lSel.lote||"",op:lSel.op||"",data:lSel.data,obs:lSel.obs||"",armazenamento:lSel.armazenamento||`• Armazenar em local seco e fresco com temperatura de 15 a 30°C e umidade relativa de 30% a 80%.
• Armazenar o produto sobre palete ou paleteira, deixando espaço lateral de 15 cm em cada extremidade. Observar a altura máxima de empilhamento.`,ensaios:lSel.ensaios||[]});setView("novo");}}><span className="btn-emoji">✏️ </span>Editar</button>
            <button style={{ ...s.btnD, fontSize:12 }} onClick={()=>deletar(lSel.id)}>🗑️</button>
          </div>
        </div>
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
                <div style={{ fontSize:11, color:T.text2 }}>{lSel.assinaturaAnalista.cargo}</div>
                {lSel.assinaturaAnalista.email && <div style={{ fontSize:10, color:T.text3 }}>{lSel.assinaturaAnalista.email}</div>}
                <div style={{ fontSize:10, color:T.accent, marginTop:8, paddingTop:8, borderTop:`1px dashed ${T.border}` }}>✔ Assinado eletronicamente</div>
                <div style={{ fontSize:10, color:T.text2 }}>{lSel.assinaturaAnalista.timestamp?new Date(lSel.assinaturaAnalista.timestamp).toLocaleString("pt-BR"):lSel.assinaturaAnalista.dataHora}</div>
                <div style={{ fontSize:9, color:T.text3, marginTop:3, fontFamily:"monospace" }}>Cód.: {sigCodigo(lSel.assinaturaAnalista, `LAUDO|${lSel.num||lSel.id||""}`)}</div>
              </>) : <div style={{ fontSize:12, color:T.text3, padding:"1rem" }}>Aguardando assinatura</div>}
            </div>
            <div style={{ textAlign:"left", padding:"1rem", background:T.surf, borderRadius:10, border:`1px solid ${T.border}` }}>
              <div style={{ fontSize:11, fontWeight:700, color:T.text3, textTransform:"uppercase", marginBottom:12 }}>Responsável Técnico</div>
              {lSel.assinaturaRT ? (<>
                <div style={{ fontSize:13, fontWeight:700, color:T.text }}>{lSel.assinaturaRT.nome}</div>
                <div style={{ fontSize:11, color:T.text2 }}>Responsável Técnico</div>
                {lSel.assinaturaRT.crf && <div style={{ fontSize:10, color:T.text3 }}>{lSel.assinaturaRT.crf}</div>}
                {lSel.assinaturaRT.email && <div style={{ fontSize:10, color:T.text3 }}>{lSel.assinaturaRT.email}</div>}
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
        <button style={s.btnA} onClick={()=>{setSel(null);setForm({tipo:"produto_acabado",clienteId:"",produto:"",linha:"",lote:"",op:"",data:tod(),obs:"",armazenamento:`• Armazenar em local seco e fresco com temperatura de 15 a 30°C e umidade relativa de 30% a 80%.
• Armazenar o produto sobre palete ou paleteira, deixando espaço lateral de 15 cm em cada extremidade. Observar a altura máxima de empilhamento.`,ensaios:[]});setView("novo");}}>
          + Novo Laudo
        </button>
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

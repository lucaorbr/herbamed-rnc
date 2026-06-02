import React, { useState, useEffect } from "react";
import { saveCollection, deleteFromCollection, subscribeCollection } from "../../firebase";
import { useTheme } from "../../core/theme";
import { UNIDADES_RECEBIMENTO, fmt, fmtQtd, parseQtd, seloAssHTML, tod } from "../../core/utils";
import { openCOA } from "../rnc/RncTabs";
import { askClaude } from "../../services/aiClient";
import { uploadStoredFile } from "../../services/localFileStorage";
import { useS } from "../../shared/styles";
import { usePagination } from "../../shared/ui";
import { F, Inp, Pagination, SecTitle, Sel, TA } from "../../shared/ui";

// Selo de assinatura para exibição na tela (versão JSX do seloAssHTML usado no PDF)
function SeloUI({ T, papel, cor, ass, vazioLabel = "Aguardando aprovação" }) {
  if (!ass) {
    return (
      <div style={{ flex:1, minWidth:220, padding:"10px 12px", border:`1px dashed ${T.border2}`, borderRadius:8, background:T.surf, textAlign:"center" }}>
        <div style={{ fontSize:9, letterSpacing:".08em", color:T.text3, textTransform:"uppercase", fontWeight:700, marginBottom:6 }}>{papel}</div>
        <div style={{ fontSize:11, color:T.text3, padding:"8px 0" }}>{vazioLabel}</div>
      </div>
    );
  }
  const quando = ass.dataHora || (ass.timestamp ? new Date(ass.timestamp).toLocaleString("pt-BR") : (ass.data ? fmt(ass.data) : ""));
  return (
    <div style={{ flex:1, minWidth:220, padding:"10px 12px", border:`1px solid ${cor}55`, borderRadius:8, background:`${cor}0d`, textAlign:"left" }}>
      <div style={{ fontSize:9, letterSpacing:".08em", color:cor, textTransform:"uppercase", fontWeight:700, marginBottom:6 }}>{papel}</div>
      <div style={{ fontSize:13, fontWeight:700, color:T.text }}>{ass.nome || "—"}</div>
      {ass.cargo ? <div style={{ fontSize:11, color:T.text2 }}>{ass.cargo}</div> : null}
      {ass.registro ? <div style={{ fontSize:10, color:T.text3 }}>Registro profissional: {ass.registro}</div> : null}
      {ass.conclusao ? <div style={{ fontSize:11, fontWeight:700, marginTop:4, color: ass.conclusao==="Aprovado"?"#2ab84a":ass.conclusao==="Reprovado"?"#ff4f6a":"#ffd166" }}>{ass.conclusao==="Aprovado"?"✅ Aprovado":ass.conclusao==="Reprovado"?"❌ Reprovado":"⏳ "+ass.conclusao}</div> : null}
      <div style={{ marginTop:6, paddingTop:6, borderTop:`1px dashed ${cor}40`, fontSize:9, color:T.text3 }}>Assinado eletronicamente em {quando}</div>
    </div>
  );
}

// Seção "Disposição": selo do analista + selo de aprovação da disposição + botão de aprovar
function DisposicaoSecao({ T, s, registro, onAprovar }) {
  const analista = {
    nome: registro.resp || registro.criadoPor,
    cargo: registro.respCargo,
    registro: registro.respRegistro,
    data: registro.criadoEm || registro.dataAnalise,
  };
  const aprov = registro.aprovacaoDisposicao || null;
  return (
    <div style={{ marginTop:"1rem" }}>
      <div style={{ fontSize:10, color:T.text3, fontWeight:700, textTransform:"uppercase", letterSpacing:".08em", marginBottom:8 }}>Assinaturas / Disposição</div>
      <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
        <SeloUI T={T} papel="Responsável pela análise" cor="#2d5016" ass={analista} />
        <SeloUI T={T} papel="Aprovou a disposição" cor="#1a5fb4" ass={aprov} vazioLabel="Aguardando aprovação" />
      </div>
      {!aprov && (registro.conclusao === "Aprovado" || registro.conclusao === "Reprovado") && (
        <div style={{ marginTop:10, textAlign:"right" }}>
          <button style={s.btnA} onClick={onAprovar}>✅ Aprovar disposição</button>
        </div>
      )}
    </div>
  );
}

// Verifica se o usuário logado é o mesmo analista que executou (campo resp).
// Compara por email quando houver; senão, por nome.
function mesmoAnalista(registro, user) {
  const respEmail = registro?.respEmail || registro?.analistaEmail;
  if (respEmail && user?.email) return respEmail === user.email;
  return !!registro?.resp && registro.resp === user?.name;
}

// Monta o registro de aprovação da disposição com os dados do usuário logado
function montarAprovacaoDisposicao(user, conclusao) {
  const agora = Date.now();
  return {
    nome: user?.name || "",
    cargo: user?.cargo || "",
    registro: user?.crf || "",
    timestamp: agora,
    dataHora: new Date(agora).toLocaleString("pt-BR"),
    data: tod(),
    conclusao: conclusao || "",
  };
}

export const ENSAIOS_PADRAO = {
  "Matéria-prima (pó)": [
    { nome:"Aspecto",              metodo:"Visual",          unidade:"—",   tipo:"texto",    espec:"Conforme padrão" },
    { nome:"Cor",                  metodo:"Visual",          unidade:"—",   tipo:"texto",    espec:"Conforme padrão" },
    { nome:"Odor",                 metodo:"Organoléptico",   unidade:"—",   tipo:"texto",    espec:"Característico" },
    { nome:"pH (solução 1%)",      metodo:"pHmetro",         unidade:"pH",  tipo:"numero",   espec:"5,0 – 7,0",  min:5.0, max:7.0 },
    { nome:"Umidade",              metodo:"Karl Fischer / IV",unidade:"%",  tipo:"numero",   espec:"≤ 5,0%",     min:0,   max:5.0 },
    { nome:"Densidade aparente",   metodo:"Proveta graduada",unidade:"g/mL",tipo:"numero",   espec:"Conforme EI", min:null,max:null },
    { nome:"Densidade compactada", metodo:"Proveta graduada",unidade:"g/mL",tipo:"numero",   espec:"Conforme EI", min:null,max:null },
    { nome:"Granulometria",        metodo:"Tamises",         unidade:"%",   tipo:"numero",   espec:"Conforme EI", min:null,max:null },
    { nome:"Identificação (CCD)",  metodo:"CCD / FTIR",      unidade:"—",   tipo:"conforme", espec:"Positivo" },
    { nome:"Metais pesados",       metodo:"ICP-MS",          unidade:"ppm", tipo:"numero",   espec:"≤ 10 ppm",   min:0,   max:10 },
  ],
  "Embalagem primária": [
    { nome:"Aspecto visual",       metodo:"Visual",          unidade:"—",   tipo:"conforme", espec:"Sem defeitos" },
    { nome:"Dimensões (altura)",   metodo:"Paquímetro",      unidade:"mm",  tipo:"numero",   espec:"Conforme EI", min:null,max:null },
    { nome:"Dimensões (diâmetro)", metodo:"Paquímetro",      unidade:"mm",  tipo:"numero",   espec:"Conforme EI", min:null,max:null },
    { nome:"Vedação / fechamento", metodo:"Teste de torque", unidade:"N.m", tipo:"conforme", espec:"Sem vazamento" },
    { nome:"Impressão / gravação", metodo:"Visual",          unidade:"—",   tipo:"conforme", espec:"Legível e correto" },
  ],
  "Embalagem secundária": [
    { nome:"Aspecto visual",       metodo:"Visual",          unidade:"—",   tipo:"conforme", espec:"Sem defeitos" },
    { nome:"Impressão / texto",    metodo:"Visual",          unidade:"—",   tipo:"conforme", espec:"Conforme aprovado" },
    { nome:"Dimensões",            metodo:"Paquímetro",      unidade:"mm",  tipo:"conforme", espec:"Conforme EI" },
    { nome:"Código de barras",     metodo:"Leitor",          unidade:"—",   tipo:"conforme", espec:"Leitura correta" },
  ],
  "Cápsula vazia": [
    { nome:"Aspecto visual",       metodo:"Visual",          unidade:"—",   tipo:"conforme", espec:"Sem defeitos" },
    { nome:"Peso médio",           metodo:"Balança analítica",unidade:"mg", tipo:"numero",   espec:"Conforme EI", min:null,max:null },
    { nome:"Umidade",              metodo:"Karl Fischer",    unidade:"%",   tipo:"numero",   espec:"12,0 – 16,0", min:12.0,max:16.0 },
    { nome:"Dimensões",            metodo:"Paquímetro",      unidade:"mm",  tipo:"numero",   espec:"Conforme EI", min:null,max:null },
    { nome:"Desintegração",        metodo:"Desintegrador",   unidade:"min", tipo:"numero",   espec:"≤ 15 min",    min:0,   max:15 },
  ],
  "Produto acabado": [
    { nome:"Aspecto",                   metodo:"Visual",          unidade:"—",   tipo:"conforme", espec:"Conforme padrão" },
    { nome:"Peso médio",                metodo:"Balança analítica",unidade:"mg", tipo:"numero",   espec:"Conforme EI", min:null,max:null },
    { nome:"Variação de peso",          metodo:"Balança analítica",unidade:"%",  tipo:"numero",   espec:"≤ 5,0%",      min:0,   max:5.0 },
    { nome:"Desintegração",             metodo:"Desintegrador",   unidade:"min", tipo:"numero",   espec:"≤ 30 min",    min:0,   max:30 },
    { nome:"Dureza",                    metodo:"Durômetro",       unidade:"N",   tipo:"numero",   espec:"Conforme EI", min:null,max:null },
    { nome:"Friabilidade",              metodo:"Friabilômetro",   unidade:"%",   tipo:"numero",   espec:"≤ 1,0%",      min:0,   max:1.0 },
    { nome:"Identificação (HPLC)",      metodo:"HPLC",            unidade:"—",   tipo:"conforme", espec:"Positivo" },
    { nome:"Doseamento (HPLC)",         metodo:"HPLC",            unidade:"%",   tipo:"numero",   espec:"90,0 – 110,0",min:90,  max:110 },
    { nome:"Impressão lote e validade", metodo:"Visual",          unidade:"—",   tipo:"conforme", espec:"De acordo com O.F, legível e ausente de manchas" },
    { nome:"Lacre de segurança",        metodo:"Visual",          unidade:"—",   tipo:"conforme", espec:"Lacrado, ausente de aberturas" },
    { nome:"Conteúdo",                  metodo:"Contagem",        unidade:"un",  tipo:"conforme", espec:"Conforme rótulo" },
  ],
};

export function CQTab({ user, toast_, fornecedores, doSaveRNC, setTab, rncs = [], setRncPrefill, config = {} }) {
  const T = useTheme(); const s = useS();
  const CQ_KEY = "cq_fichas";
  const [fichas, setFichas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("lista");
  const [selFicha, setSelFicha] = useState(null);

  const [form, setForm] = useState({ material:"", tipoPadrao:"Matéria-prima (pó)", fornecedor:"", lote:"", qtdRecebidaValor:"", qtdRecebidaUnidade:"kg", qtdRecebida:"", nf:"", dataRecebimento:tod(), dataAnalise:tod(), resp:user.name });
  const [ensaios, setEnsaios] = useState([]);
  const [coa, setCoa] = useState(null);
  const [coaUploading, setCoaUploading] = useState(false);
  const setF = (k,v) => setForm(p=>({...p,[k]:v}));

  useEffect(()=>{
    const unsub = subscribeCollection(CQ_KEY, (list) => {
      setFichas(list.sort((a,b) => (b.criadoTs||0) - (a.criadoTs||0)));
      setLoading(false);
    });
    const t = setTimeout(() => setLoading(false), 3000);
    return () => { unsub(); clearTimeout(t); };
  },[]);

  const salvarFichaDB = async (ficha) => {
    try {
    await saveCollection(CQ_KEY, String(ficha.id), ficha);
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const delFicha = async (id) => {
    try {
    if(!confirm("Excluir esta ficha?")) return;
    await deleteFromCollection(CQ_KEY, String(id));
    setSelFicha(null); setView("lista");
    toast_("Ficha excluída.", "red");
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const aprovarDisposicaoFicha = async (ficha) => {
    if (ficha.aprovacaoDisposicao) return;
    if (config?.aprovadorDiferenteAnalista && mesmoAnalista(ficha, user)) {
      toast_("A configuração exige que o aprovador seja diferente do analista que executou.", "red");
      return;
    }
    const atualizada = { ...ficha, aprovacaoDisposicao: montarAprovacaoDisposicao(user, ficha.conclusao) };
    await salvarFichaDB(atualizada);
    setSelFicha(atualizada);
    toast_("Disposição aprovada!", "green");
  };

  const aplicarEnsaiosPadrao = (tipo) => {
    const lista = ENSAIOS_PADRAO[tipo] || [];
    setEnsaios(lista.map((e,i)=>({ ...e, id:i, resultado:"", conforme:null, obs:"", tipo:e.tipo||"numero", casas:e.casas!==undefined?e.casas:2, multiplos:e.multiplos||false })));
  };

  const updEnsaio = (id, k, v) => setEnsaios(p=>p.map(e=>e.id===id?{...e,[k]:v}:e));

  // Verificar conformidade automática para numérico
  const checkConf = (ensaio) => {
    if(ensaio.tipo==="conforme") return ensaio.conforme;
    if(ensaio.tipo==="numero") {
      const v = parseFloat(ensaio.resultado);
      if(isNaN(v)) return null;
      if(ensaio.min!==null && v < ensaio.min) return false;
      if(ensaio.max!==null && v > ensaio.max) return false;
      return true;
    }
    return ensaio.conforme;
  };

  const uploadCOA = async (file) => {
    if(!file) return;
    setCoaUploading(true);
    try {
      const result = await uploadStoredFile(file);
      setCoa(result);
      toast_("COA anexado com sucesso!", "green");
    } catch { toast_("Erro ao enviar COA.", "red"); }
    setCoaUploading(false);
  };

  const conclusao = () => {
    if(ensaios.length===0) return null;
    const confs = ensaios.map(checkConf);
    if(confs.some(c=>c===false)) return "Reprovado";
    if(confs.some(c=>c===null)) return "Pendente";
    return "Aprovado";
  };

  const salvarFicha = async () => {
    if(!form.material.trim()) { alert("Informe o material."); return; }
    const conc = conclusao();
    const num = `RA-${new Date().getFullYear()}-${String(fichas.length+1).padStart(3,"0")}`;
    const ficha = { id:Date.now(), num, ...form, qtdRecebida: fmtQtd(form.qtdRecebidaValor, form.qtdRecebidaUnidade), ensaios, coa, conclusao:conc, respCargo: user.cargo || "", respRegistro: user.crf || "", criadoPor:user.name, criadoEm:tod(), criadoTs:Date.now() };
    // Record edit history if editing existing analysis
    if (selFicha?._editando) {
      const hist = selFicha.historicoEdicoes || [];
      ficha.historicoEdicoes = [...hist, { data: tod(), dataHora: new Date().toLocaleString("pt-BR"), editor: user.name, obs: "Análise editada" }];
    }
    await salvarFichaDB(ficha);
    toast_(`${num} salva com sucesso!`, "green");
    if(conc==="Reprovado") {
      if(confirm(`Material REPROVADO! Deseja abrir uma RNC automaticamente?`)) {
        const duplicata = rncs.find(r => r.origemAnalise === num);
        if(duplicata) {
          alert(`Já existe uma RNC para esta análise (${duplicata.num})`);
        } else {
          setRncPrefill({ origemAnalise: num, produto: form.material, fornecedor: form.fornecedor, lote: form.lote, detector: user.name, tipo: "Matéria-prima" });
          setTab("nova");
        }
      }
    }
    setView("lista");
    setForm({ material:"", tipoPadrao:"Matéria-prima (pó)", fornecedor:"", lote:"", qtdRecebidaValor:"", qtdRecebidaUnidade:"kg", qtdRecebida:"", nf:"", dataRecebimento:tod(), dataAnalise:tod(), resp:user.name });
    setEnsaios([]); setCoa(null);
  };

  const exportRA = (ficha) => {
    const conc = ficha.conclusao;
    const concColor = conc==="Aprovado"?"#1a7a3c":conc==="Reprovado"?"#cc2244":"#8a6000";
    const win = window.open("","_blank");
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/>
<title>${ficha.num} — Herbamed®</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#1a1a1a;padding:0;}
  .page{width:210mm;padding:14mm;margin:0 auto;}
  .header{display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;border-bottom:3px solid #1a7a3c;margin-bottom:16px;}
  .logo{font-family:Georgia,serif;font-size:20px;font-weight:700;color:#1a7a3c;}
  .ra-num{font-size:18px;font-weight:700;color:#1a7a3c;text-align:right;}
  .section{margin-bottom:16px;}
  .section-title{font-size:10px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #e0e0e0;display:flex;align-items:center;gap:6px;}
  .section-title::before{content:'';display:inline-block;width:3px;height:11px;background:#1a7a3c;border-radius:2px;}
  .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
  .field{background:#f8f9fa;border:1px solid #e8e8e8;border-radius:5px;padding:7px 9px;}
  .field-label{font-size:9px;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:2px;}
  .field-value{font-size:12px;color:#1a1a1a;}
  table{width:100%;border-collapse:collapse;font-size:11px;}
  th{background:#f0f4f0;color:#333;font-weight:700;padding:7px 8px;text-align:left;border:1px solid #ddd;}
  td{padding:6px 8px;border:1px solid #eee;vertical-align:middle;}
  tr:nth-child(even)td{background:#f9fafb;}
  .conf{color:#1a7a3c;font-weight:700;}
  .nconf{color:#cc2244;font-weight:700;}
  .pend{color:#8a6000;font-weight:700;}
  .conclusao{padding:14px;border-radius:8px;text-align:center;font-size:16px;font-weight:800;background:${concColor}15;border:2px solid ${concColor};color:${concColor};margin:16px 0;}
  .footer{margin-top:20px;padding-top:10px;border-top:2px solid #1a7a3c;display:flex;justify-content:space-between;font-size:10px;color:#666;}
  @media print{body{background:#fff!important;}}
</style></head><body><div class="page">
<div style="background:#1a4a2e;padding:20px 24px;display:flex;justify-content:space-between;align-items:center;">
  <div style="display:flex;align-items:center;gap:12px;">
    <img src="${window.location.origin}/logo.png" style="width:44px;height:44px;border-radius:6px;object-fit:cover;"/>
    <div>
      <div style="color:#fff;font-size:14px;font-weight:bold;">Herbamed Laboratório Nutracêutico LTDA</div>
      <div style="color:#9fd4b2;font-size:10px;">CNPJ: 14.829.598/0001-30</div>
    </div>
  </div>
  <div style="text-align:right;">
    <div style="color:#fff;font-size:13px;font-weight:bold;">Relatório de Análise</div>
    <div style="color:#9fd4b2;font-size:11px;">N° ${ficha.num} · ${fmt(ficha.dataAnalise)}</div>
  </div>
</div>
<div class="section">
  <div class="section-title">Identificação do Material</div>
  <div class="grid3">
    <div class="field"><div class="field-label">Material</div><div class="field-value">${ficha.material}</div></div>
    <div class="field"><div class="field-label">Tipo</div><div class="field-value">${ficha.tipoPadrao}</div></div>
    <div class="field"><div class="field-label">Fornecedor</div><div class="field-value">${ficha.fornecedor||"—"}</div></div>
    <div class="field"><div class="field-label">Nº do Lote</div><div class="field-value">${ficha.lote||"—"}</div></div>
    <div class="field"><div class="field-label">Qtd. Recebida</div><div class="field-value">${ficha.qtdRecebida||"—"}</div></div>
    <div class="field"><div class="field-label">Nota Fiscal</div><div class="field-value">${ficha.nf||"—"}</div></div>
    <div class="field"><div class="field-label">Data Recebimento</div><div class="field-value">${fmt(ficha.dataRecebimento)}</div></div>
    <div class="field"><div class="field-label">Data Análise</div><div class="field-value">${fmt(ficha.dataAnalise)}</div></div>
    <div class="field"><div class="field-label">Analista</div><div class="field-value">${ficha.resp || user?.name || ""}</div></div>
  </div>
</div>
<div class="section">
  <div class="section-title">Resultados das Análises</div>
  <table>
    <thead><tr><th>Ensaio</th><th>Método</th><th>Especificação</th><th>Resultado</th><th>Unidade</th><th>Situação</th><th>Obs.</th></tr></thead>
    <tbody>
      ${ficha.ensaios.map(e=>{
        const c = e.tipo==="numero"?(parseFloat(e.resultado)>=(e.min??-Infinity)&&parseFloat(e.resultado)<=(e.max??Infinity)?true:false):e.conforme;
        const sit = c===true?'<span class="conf">✓ Conforme</span>':c===false?'<span class="nconf">✗ Não conforme</span>':'<span class="pend">— Pendente</span>';
        return `<tr><td><strong>${e.nome}</strong></td><td>${e.metodo}</td><td>${e.espec}</td><td>${e.resultado||"—"}</td><td>${e.unidade}</td><td>${sit}</td><td>${e.obs||""}</td></tr>`;
      }).join("")}
    </tbody>
  </table>
</div>
<div class="conclusao">
  ${conc==="Aprovado"?"✅ APROVADO":conc==="Reprovado"?"❌ REPROVADO":"⏳ ANÁLISE PENDENTE"}
</div>
${ficha.coa?`<div class="section"><div class="section-title">COA do Fornecedor</div><p style="font-size:12px;color:#333;">Laudo do fornecedor disponível em: <a href="${ficha.coa.url}" target="_blank">${ficha.coa.name}</a></p></div>`:""}
<div style="display:flex;gap:40px;margin-top:24px;padding-top:12px;border-top:1px solid #ccc;">
  <div style="flex:1;">
    ${seloAssHTML({ nome: ficha.resp || user?.name || "", cargo: ficha.respCargo || user?.cargo || "", registroProfissional: ficha.respRegistro || user?.crf || "", email: user?.email || "", userId: user?.uid || user?.id || "", data: ficha.criadoEm }, "Responsável pela análise", "#2d5016", `FICHA|${ficha.num||ficha.id||""}`)}
  </div>
  <div style="flex:1;">
    ${ficha.aprovacaoDisposicao ? seloAssHTML({ nome: ficha.aprovacaoDisposicao.nome, cargo: ficha.aprovacaoDisposicao.cargo, registroProfissional: ficha.aprovacaoDisposicao.registro, timestamp: ficha.aprovacaoDisposicao.timestamp }, "Aprovou a disposição", "#1a5fb4", `FICHA-DISP|${ficha.num||ficha.id||""}`) : `<div style="padding:10px 12px;border:1px dashed #ddd;border-radius:8px;background:#fafafa;text-align:center;"><div style="font-size:9px;color:#888;text-transform:uppercase;">Aprovou a disposição</div><div style="font-size:11px;color:#ccc;padding:8px 0;">Aguardando aprovação</div></div>`}
  </div>
  <div style="flex:1;text-align:center;"><div style="border-top:1px solid #333;padding-top:6px;margin-top:30px;font-size:11px;">______________________<br/>Gerente de Qualidade</div></div>
</div>
<div style="padding:10px 24px;background:#f5f5f5;border-top:1px solid #eee;display:flex;justify-content:space-between;font-size:10px;color:#888;">
  <span>Herbamed Laboratório Nutracêutico LTDA · CNPJ: 14.829.598/0001-30</span>
  <span>Av Irene Meneghetti Longhini, 500 · Assis/SP - Brasil · CEP: 19816-370</span>
</div>
</div><script>window.onload=()=>window.print();</script></body></html>`;
    win.document.write(html);
    win.document.close();
  };

  if(loading) return <div style={{ textAlign:"center", padding:"3rem", color:T.text2 }}>Carregando...</div>;

  // ── NOVA FICHA ──
  if(view==="nova") {
    const conc = conclusao();
    return (
      <div>
        <div style={{ display:"flex", gap:10, marginBottom:"1rem", alignItems:"center" }}>
          <button style={s.btn} onClick={()=>setView("lista")}>← Voltar</button>
          <div style={{ fontSize:15, fontWeight:700, color:T.text }}>Nova Ficha de Análise</div>
        </div>

        {/* Dados do recebimento */}
        <div style={s.card}>
          <SecTitle icon="📦" ch="Dados do recebimento" />
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
            <F lbl="Material / Produto *" ch={<Inp placeholder="Ex: Psyllium em pó" value={form.material} onChange={e=>setF("material",e.target.value)} />} />
            <F lbl="Tipo de material" ch={
              <Sel value={form.tipoPadrao} onChange={e=>{ setF("tipoPadrao",e.target.value); aplicarEnsaiosPadrao(e.target.value); }}>
                {Object.keys(ENSAIOS_PADRAO).map(t=><option key={t}>{t}</option>)}
              </Sel>
            }/>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
            <F lbl="Fornecedor" ch={
              <Sel value={form.fornecedor} onChange={e=>setF("fornecedor",e.target.value)}>
                <option value="">Selecionar...</option>
                {fornecedores.filter(x=>x.status==="Ativo").map(f=><option key={f.id} value={f.nome}>{f.nome}</option>)}
                <option value="__outro">Outro (digitar)</option>
              </Sel>
            }/>
            {form.fornecedor==="__outro" && <F lbl="Nome do fornecedor" ch={<Inp value={form.fornecedorManual||""} onChange={e=>setF("fornecedorManual",e.target.value)} />} />}
            <F lbl="Nº do lote" ch={<Inp placeholder="Ex: LOT-2026-001" value={form.lote} onChange={e=>setF("lote",e.target.value)} />} />
            <F lbl="Qtd. recebida" ch={
              <div style={{ display:"flex", gap:6 }}>
                <Inp type="number" step="any" min="0" placeholder="Ex: 25" sx={{ flex:2 }} value={form.qtdRecebidaValor} onChange={e=>setF("qtdRecebidaValor",e.target.value)} />
                <Sel sx={{ flex:1, minWidth:80 }} value={form.qtdRecebidaUnidade} onChange={e=>setF("qtdRecebidaUnidade",e.target.value)}>
                  {UNIDADES_RECEBIMENTO.map(u => <option key={u} value={u}>{u}</option>)}
                </Sel>
              </div>
            } />
            <F lbl="Nota Fiscal" ch={<Inp placeholder="Ex: NF 12345" value={form.nf} onChange={e=>setF("nf",e.target.value)} />} />
            <F lbl="Data recebimento" ch={<Inp type="date" value={form.dataRecebimento} onChange={e=>setF("dataRecebimento",e.target.value)} />} />
            <F lbl="Data análise" ch={<Inp type="date" value={form.dataAnalise} onChange={e=>setF("dataAnalise",e.target.value)} />} />
            <F lbl="Analista responsável" ch={<div style={{ fontSize:13, color:T.text2, padding:"8px 0", fontWeight:500 }}>{user?.name || "—"}{user?.cargo ? ` — ${user.cargo}` : ""}</div>} />
          </div>
        </div>

        {/* Ensaios */}
        <div style={s.card}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
            <SecTitle icon="🔬" ch="Ensaios / Resultados" />
            <button style={s.btn} onClick={()=>aplicarEnsaiosPadrao(form.tipoPadrao)}>↺ Recarregar padrão</button>
          </div>

          {ensaios.length === 0 ? (
            <div style={{ textAlign:"center", padding:"2rem", color:T.text3, fontSize:13 }}>
              Selecione o tipo de material acima para carregar os ensaios padrão
            </div>
          ) : (
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ background:T.surf }}>
                    {["Ensaio","Método","Especificação","Resultado","Un.","Situação","Obs."].map(h=>(
                      <th key={h} style={{ padding:"8px 10px", fontSize:10, fontWeight:700, color:T.text3, textTransform:"uppercase", textAlign:"left", borderBottom:`1px solid ${T.border}`, whiteSpace:"nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ensaios.map((e,i)=>{
                    const c = checkConf(e);
                    return (
                      <tr key={e.id} style={{ background:i%2===0?T.card:T.surf }}>
                        <td style={{ padding:"8px 10px", fontSize:12, fontWeight:600, color:T.text, whiteSpace:"nowrap" }}>{e.nome}</td>
                        <td style={{ padding:"8px 10px", fontSize:11, color:T.text2 }}>{e.metodo}</td>
                        <td style={{ padding:"8px 10px", fontSize:11, color:T.text2 }}>{e.espec}</td>
                        <td style={{ padding:"8px 8px" }}>
                          {e.tipo==="conforme" ? (
                            <div style={{ display:"flex", gap:4 }}>
                              <button onClick={()=>updEnsaio(e.id,"conforme",true)} style={{ flex:1, padding:"5px", borderRadius:6, border:`1px solid ${e.conforme===true?"#2ab84a55":T.border}`, background:e.conforme===true?"#2ab84a22":"transparent", color:e.conforme===true?"#2ab84a":T.text2, cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:600 }}>✓ Conf.</button>
                              <button onClick={()=>updEnsaio(e.id,"conforme",false)} style={{ flex:1, padding:"5px", borderRadius:6, border:`1px solid ${e.conforme===false?"#ff4f6a55":T.border}`, background:e.conforme===false?"#ff4f6a22":"transparent", color:e.conforme===false?"#ff4f6a":T.text2, cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:600 }}>✗ N.C.</button>
                            </div>
                          ) : e.tipo==="texto" ? (
                            <Inp placeholder="Resultado..." value={e.resultado} onChange={ev=>updEnsaio(e.id,"resultado",ev.target.value)} sx={{ padding:"5px 8px", fontSize:12, width:110 }}/>
                          ) : (
                            <div>
                              <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                                <Inp
                                  placeholder={`0,${"0".repeat(e.casas||2)}`}
                                  value={e.resultado}
                                  onChange={ev=>updEnsaio(e.id,"resultado",ev.target.value)}
                                  onBlur={ev=>{ if(ev.target.value) updEnsaio(e.id,"resultado",fmtNum(ev.target.value,e.casas||2)); }}
                                  sx={{ padding:"5px 8px", fontSize:12, width:80 }}
                                />
                                {e.multiplos && (
                                  <button onClick={()=>toggleMultiplos(e.id)}
                                    title="Lançar múltiplos valores"
                                    style={{ padding:"4px 7px", borderRadius:6, border:`1px solid ${multiplosState[e.id]?.aberto?T.accent:T.border}`, background:multiplosState[e.id]?.aberto?T.accentDim:"transparent", color:multiplosState[e.id]?.aberto?T.accent:T.text3, cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:700 }}>
                                    Σ
                                  </button>
                                )}
                              </div>
                              {e.multiplos && multiplosState[e.id]?.aberto && (
                                <div style={{ marginTop:6, padding:"8px", background:T.card, border:`1px solid ${T.accent}33`, borderRadius:8 }}>
                                  <div style={{ fontSize:10, color:T.accent, fontWeight:700, textTransform:"uppercase", marginBottom:6 }}>Múltiplos valores — média automática</div>
                                  <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:6 }}>
                                    {(multiplosState[e.id]?.valores||["","","","",""]).map((v,vi)=>(
                                      <Inp key={vi} type="number" placeholder={`#${vi+1}`} value={v}
                                        onChange={ev=>updValorMultiplo(e.id,vi,ev.target.value)}
                                        sx={{ width:56, padding:"4px 6px", fontSize:11 }}/>
                                    ))}
                                    <button onClick={()=>setMultiplosState(p=>({...p,[e.id]:{...p[e.id],valores:[...(p[e.id]?.valores||[]),""]}}))}
                                      style={{ padding:"4px 8px", borderRadius:6, border:`1px solid ${T.border}`, background:"transparent", color:T.text3, cursor:"pointer", fontFamily:"inherit", fontSize:11 }}>+</button>
                                  </div>
                                  {(() => {
                                    const vals = multiplosState[e.id]?.valores||[];
                                    const nums = vals.map(v=>parseFloat(String(v).replace(",","."))).filter(n=>!isNaN(n));
                                    if (!nums.length) return null;
                                    const media = nums.reduce((a,b)=>a+b,0)/nums.length;
                                    const dp = Math.sqrt(nums.reduce((s,v)=>s+Math.pow(v-media,2),0)/nums.length);
                                    return (
                                      <div style={{ fontSize:11, color:T.text2, marginBottom:6 }}>
                                        <span style={{ fontWeight:700, color:T.accent }}>Média: {media.toFixed(e.casas||2).replace(".",",")} {e.unidade}</span>
                                        {nums.length>1 && <span style={{ color:T.text3, marginLeft:8 }}>DP: ±{dp.toFixed(e.casas||2).replace(".",",")}</span>}
                                        <span style={{ color:T.text3, marginLeft:8 }}>n={nums.length}</span>
                                      </div>
                                    );
                                  })()}
                                  <button onClick={()=>aplicarMedia(e.id,e.casas||2)}
                                    style={{ ...s.btnA, fontSize:11, padding:"4px 12px" }}>
                                    ✓ Aplicar média
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td style={{ padding:"8px 8px", fontSize:11, color:T.text3 }}>{e.unidade}</td>
                        <td style={{ padding:"8px 8px" }}>
                          {c===true?<span style={{ color:"#2ab84a", fontWeight:700, fontSize:11 }}>✓ Conf.</span>:c===false?<span style={{ color:"#ff4f6a", fontWeight:700, fontSize:11 }}>✗ N.C.</span>:<span style={{ color:T.text3, fontSize:11 }}>—</span>}
                        </td>
                        <td style={{ padding:"8px 8px" }}>
                          <Inp placeholder="obs..." value={e.obs||""} onChange={ev=>updEnsaio(e.id,"obs",ev.target.value)} sx={{ padding:"4px 6px", fontSize:11, width:100 }}/>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Conclusão em tempo real */}
          {ensaios.length > 0 && conc && (
            <div style={{ marginTop:"1rem", padding:"12px 16px", borderRadius:10, background:conc==="Aprovado"?"#2ab84a18":conc==="Reprovado"?"#ff4f6a18":"#ffd16618", border:`1px solid ${conc==="Aprovado"?"#2ab84a33":conc==="Reprovado"?"#ff4f6a33":"#ffd16633"}`, fontSize:14, fontWeight:700, color:conc==="Aprovado"?"#2ab84a":conc==="Reprovado"?"#ff4f6a":"#8a6000", textAlign:"center" }}>
              {conc==="Aprovado"?"✅ APROVADO — Todos os ensaios dentro da especificação":conc==="Reprovado"?"❌ REPROVADO — Um ou mais ensaios fora da especificação":"⏳ ANÁLISE PENDENTE — Preencha todos os resultados"}
            </div>
          )}
        </div>

        {/* COA do fornecedor */}
        <div style={s.card}>
          <SecTitle icon="📄" ch="COA do fornecedor (Laudo / Certificado de Análise)" />
          {coa ? (
            <div style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", background:T.surf, border:`1px solid ${T.border}`, borderRadius:8 }}>
              <span style={{ fontSize:24 }}>📄</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{coa.name}</div>
                <div style={{ fontSize:11, color:T.text3 }}>{coa.size ? (coa.size/1024).toFixed(1)+" KB" : ""}</div>
              </div>
              <button onClick={()=>openCOA(coa)} style={{ ...s.btn, fontSize:11, color:T.accent }}>Ver COA</button>
              <button style={s.btnD} onClick={()=>setCoa(null)}>✕</button>
            </div>
          ) : (
            <div style={{ border:`2px dashed ${T.border2}`, borderRadius:10, padding:"1.5rem", textAlign:"center", cursor:"pointer" }} onClick={()=>document.getElementById("coa-input").click()}>
              <div style={{ fontSize:28, marginBottom:6 }}>📎</div>
              <div style={{ fontSize:13, color:T.text2 }}>{coaUploading?"Enviando...":"Clique para anexar o COA do fornecedor"}</div>
              <div style={{ fontSize:11, color:T.text3, marginTop:4 }}>PDF, imagem — até 10MB</div>
              <input id="coa-input" type="file" accept=".pdf,image/*" style={{ display:"none" }} onChange={e=>uploadCOA(e.target.files[0])} />
            </div>
          )}
        </div>

        {/* Botões */}
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end", paddingBottom:"1rem" }}>
          <button style={s.btn} onClick={()=>setView("lista")}>Cancelar</button>
          <button style={s.btnA} onClick={salvarFicha}>💾 Salvar ficha de análise →</button>
        </div>
      </div>
    );
  }

  // ── LISTA ──
  return (
    <div>
      <div style={{ display:"flex", gap:10, marginBottom:"1rem", alignItems:"center" }}>
        <div style={{ fontSize:13, color:T.text2, flex:1 }}>{fichas.length} ficha(s) de análise registrada(s)</div>
        <button style={s.btnA} onClick={()=>{ setForm({ material:"", tipoPadrao:"Matéria-prima (pó)", fornecedor:"", lote:"", qtdRecebidaValor:"", qtdRecebidaUnidade:"kg", qtdRecebida:"", nf:"", dataRecebimento:tod(), dataAnalise:tod(), resp:user.name }); aplicarEnsaiosPadrao("Matéria-prima (pó)"); setView("nova"); }}>+ Nova Ficha de Análise</button>
      </div>

      {fichas.length === 0 ? (
        <div style={{ ...s.card, textAlign:"center", padding:"3rem" }}>
          <div style={{ fontSize:40, marginBottom:"1rem", opacity:.3 }}>🧪</div>
          <div style={{ fontSize:14, color:T.text2, marginBottom:6 }}>Nenhuma ficha de análise registrada</div>
          <div style={{ fontSize:12, color:T.text3 }}>Clique em "+ Nova Ficha de Análise" para começar</div>
        </div>
      ) : (
        <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:T.surf }}>
                {["Nº RA","Material","Fornecedor","Lote","Data Análise","Analista","Conclusão",""].map(h=>(
                  <th key={h} style={{ padding:"10px 12px", fontSize:10, fontWeight:700, color:T.text3, textTransform:"uppercase", textAlign:"left", borderBottom:`1px solid ${T.border}`, whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fichas.map((f,idx)=>{
                const cc = f.conclusao;
                const cColor = cc==="Aprovado"?"#2ab84a":cc==="Reprovado"?"#ff4f6a":"#ffd166";
                return (
                  <tr key={f.id} style={{ background:idx%2===0?T.card:T.surf, cursor:"pointer" }} onClick={()=>setSelFicha(f)}>
                    <td style={{ padding:"10px 12px", fontSize:12, fontWeight:700, color:T.accent }}>{f.num}</td>
                    <td style={{ padding:"10px 12px", fontSize:13, color:T.text }}>{f.material}</td>
                    <td style={{ padding:"10px 12px", fontSize:12, color:T.text2 }}>{f.fornecedor||"—"}</td>
                    <td style={{ padding:"10px 12px", fontSize:12, color:T.text2 }}>{f.lote||"—"}</td>
                    <td style={{ padding:"10px 12px", fontSize:12, color:T.text2 }}>{fmt(f.dataAnalise)}</td>
                    <td style={{ padding:"10px 12px", fontSize:12, color:T.text2 }}>{f.resp}</td>
                    <td style={{ padding:"10px 12px" }}>
                      <span style={{ fontSize:11, fontWeight:700, color:cColor, background:`${cColor}18`, padding:"3px 10px", borderRadius:20 }}>
                        {cc==="Aprovado"?"✅ Aprovado":cc==="Reprovado"?"❌ Reprovado":"⏳ Pendente"}
                      </span>
                    </td>
                    <td style={{ padding:"10px 8px", display:"flex", gap:4 }}>
                      <button style={{ ...s.btn, padding:"4px 8px", fontSize:11 }} onClick={e=>{e.stopPropagation();exportRA(f);}}><span className="btn-emoji">📄 </span>PDF</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal detalhe */}
      {selFicha && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.82)", backdropFilter:"blur(6px)", zIndex:999, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }} onClick={e=>e.target===e.currentTarget&&setSelFicha(null)}>
          <div style={{ background:T.card2, border:`1px solid ${T.border2}`, borderRadius:18, padding:"1.75rem", maxWidth:760, width:"100%", maxHeight:"90vh", overflowY:"auto", boxShadow:"0 32px 80px #000a" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"1rem" }}>
              <div>
                <div style={{ fontSize:20, fontWeight:700 }}>{selFicha.num}</div>
                <div style={{ fontSize:12, color:T.text2, marginTop:2 }}>{selFicha.material} · {selFicha.fornecedor||"—"} · {fmt(selFicha.dataAnalise)}</div>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button style={{ ...s.btn, fontSize:11, color:"#ff8c42", borderColor:"#ff8c4233", background:"#ff8c4212" }} onClick={()=>exportRA(selFicha)}><span className="btn-emoji">📄 </span>Exportar PDF</button>
                <button style={s.btnD} onClick={()=>delFicha(selFicha.id)}>🗑️</button>
                <button onClick={()=>setSelFicha(null)} style={{ background:T.border, border:"none", color:T.text2, cursor:"pointer", borderRadius:8, padding:"6px 10px", fontSize:16, fontFamily:"inherit" }}>✕</button>
              </div>
            </div>
            {/* Ensaios */}
            <div style={{ overflowX:"auto", marginBottom:"1rem" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead><tr style={{ background:T.surf }}>
                  {["Ensaio","Especificação","Resultado","Un.","Situação"].map(h=><th key={h} style={{ padding:"7px 10px", fontSize:10, fontWeight:700, color:T.text3, textTransform:"uppercase", textAlign:"left", borderBottom:`1px solid ${T.border}` }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {selFicha.ensaios.map((e,i)=>{
                    const c=e.tipo==="numero"?(parseFloat(e.resultado)>=(e.min??-Infinity)&&parseFloat(e.resultado)<=(e.max??Infinity)?true:false):e.conforme;
                    return <tr key={i} style={{ background:i%2===0?T.card:T.surf }}>
                      <td style={{ padding:"7px 10px", fontSize:12, fontWeight:600 }}>{e.nome}</td>
                      <td style={{ padding:"7px 10px", fontSize:11, color:T.text2 }}>{e.espec}</td>
                      <td style={{ padding:"7px 10px", fontSize:12 }}>{e.resultado||"—"}</td>
                      <td style={{ padding:"7px 10px", fontSize:11, color:T.text3 }}>{e.unidade}</td>
                      <td style={{ padding:"7px 10px" }}>{c===true?<span style={{ color:"#2ab84a", fontWeight:700 }}>✓ Conforme</span>:c===false?<span style={{ color:"#ff4f6a", fontWeight:700 }}>✗ N.C.</span>:<span style={{ color:T.text3 }}>—</span>}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ marginBottom:"1rem", padding:"10px 14px", background:T.surf, borderRadius:8, display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
              <span style={{ fontSize:20 }}>📄</span>
              {selFicha.coa ? (<>
                <span style={{ fontSize:13, color:T.text, flex:1 }}>COA: {selFicha.coa.name}</span>
                <button onClick={()=>openCOA(selFicha.coa)} style={{ ...s.btn, fontSize:11, color:T.accent }}>Ver COA</button>
                <button onClick={()=>document.getElementById("coa-reattach-ficha").click()} style={{ ...s.btn, fontSize:11 }}><span className="btn-emoji">🔄 </span>Trocar</button>
                <button onClick={async()=>{ if(!confirm("Remover COA desta análise?")) return; await saveCollection(CQ_KEY, String(selFicha.id), {...selFicha, coa:null}); setSelFicha({...selFicha, coa:null}); toast_("COA removido.","red"); }} style={{ ...s.btnD, fontSize:11 }}><span className="btn-emoji">🗑️ </span>Excluir</button>
              </>) : (<>
                <span style={{ fontSize:13, color:T.text3, flex:1 }}>Nenhum COA anexado</span>
                <button onClick={()=>document.getElementById("coa-reattach-ficha").click()} style={{ ...s.btnA, fontSize:11 }}><span className="btn-emoji">📎 </span>Anexar COA</button>
              </>)}
              <input id="coa-reattach-ficha" type="file" accept=".pdf,image/*" style={{ display:"none" }} onChange={async e=>{ const file=e.target.files[0]; if(!file) return; toast_("Enviando COA...","blue"); try { const r=await uploadStoredFile(file); await saveCollection(CQ_KEY, String(selFicha.id), {...selFicha, coa:r}); setSelFicha({...selFicha, coa:r}); toast_("COA atualizado!","green"); } catch { toast_("Erro ao enviar COA.","red"); } }} />
            </div>
            <div style={{ padding:"12px 16px", borderRadius:10, background:selFicha.conclusao==="Aprovado"?"#2ab84a18":"#ff4f6a18", fontSize:14, fontWeight:700, color:selFicha.conclusao==="Aprovado"?"#2ab84a":"#ff4f6a", textAlign:"center" }}>
              {selFicha.conclusao==="Aprovado"?"✅ APROVADO":"❌ REPROVADO"}
            </div>
            <DisposicaoSecao T={T} s={s} registro={selFicha} onAprovar={()=>aprovarDisposicaoFicha(selFicha)} />
          </div>
        </div>
      )}
    </div>
  );
}

export const ENSAIOS_SUGERIDOS = {
  "Matéria-prima (pó/granulado)": [
    { nome:"Aspecto",               espec:"Conforme padrão",      unidade:"—",      tipo:"conforme", casas:0, multiplos:false },
    { nome:"Cor",                   espec:"Conforme padrão",      unidade:"—",      tipo:"conforme", casas:0, multiplos:false },
    { nome:"Odor",                  espec:"Característico",       unidade:"—",      tipo:"conforme", casas:0, multiplos:false },
    { nome:"pH (solução 1%)",       espec:"",                     unidade:"pH",     tipo:"numero",   casas:2, multiplos:false },
    { nome:"Umidade",               espec:"",                     unidade:"%",      tipo:"numero",   casas:1, multiplos:false },
    { nome:"Densidade aparente",    espec:"",                     unidade:"g/mL",   tipo:"numero",   casas:3, multiplos:false },
    { nome:"Densidade compactada",  espec:"",                     unidade:"g/mL",   tipo:"numero",   casas:3, multiplos:false },
    { nome:"Granulometria",         espec:"",                     unidade:"%",      tipo:"numero",   casas:1, multiplos:false },
    { nome:"Identificação",         espec:"Positivo",             unidade:"—",      tipo:"conforme", casas:0, multiplos:false },
    { nome:"Contagem microbiana",   espec:"",                     unidade:"UFC/g",  tipo:"numero",   casas:0, multiplos:false },
  ],
  "Matéria-prima (óleo/líquido)": [
    { nome:"Aspecto",               espec:"Límpido, sem partículas", unidade:"—",       tipo:"conforme", casas:0, multiplos:false },
    { nome:"Cor",                   espec:"Conforme padrão",         unidade:"—",       tipo:"conforme", casas:0, multiplos:false },
    { nome:"Odor",                  espec:"Característico",          unidade:"—",       tipo:"conforme", casas:0, multiplos:false },
    { nome:"Densidade",             espec:"",                        unidade:"g/mL",    tipo:"numero",   casas:3, multiplos:false },
    { nome:"Viscosidade",           espec:"",                        unidade:"cP",      tipo:"numero",   casas:1, multiplos:false },
    { nome:"pH",                    espec:"",                        unidade:"pH",      tipo:"numero",   casas:2, multiplos:false },
    { nome:"Índice de acidez",      espec:"",                        unidade:"mg KOH/g",tipo:"numero",   casas:2, multiplos:false },
    { nome:"Índice de refração",    espec:"",                        unidade:"—",       tipo:"numero",   casas:4, multiplos:false },
    { nome:"Identificação",         espec:"Positivo",                unidade:"—",       tipo:"conforme", casas:0, multiplos:false },
    { nome:"Contagem microbiana",   espec:"",                        unidade:"UFC/mL",  tipo:"numero",   casas:0, multiplos:false },
  ],
  "Cápsula vazia": [
    { nome:"Aspecto visual",        espec:"Sem defeitos, sem deformações", unidade:"—",   tipo:"conforme", casas:0, multiplos:false },
    { nome:"Cor",                   espec:"Conforme padrão",               unidade:"—",   tipo:"conforme", casas:0, multiplos:false },
    { nome:"Comprimento",           espec:"",                              unidade:"mm",  tipo:"numero",   casas:2, multiplos:true  },
    { nome:"Diâmetro",              espec:"",                              unidade:"mm",  tipo:"numero",   casas:2, multiplos:true  },
    { nome:"Peso médio",            espec:"",                              unidade:"mg",  tipo:"numero",   casas:1, multiplos:true  },
    { nome:"Umidade",               espec:"12,0 – 16,0",                  unidade:"%",   tipo:"numero",   casas:1, multiplos:false },
    { nome:"Desintegração",         espec:"≤ 15 min",                     unidade:"min", tipo:"numero",   casas:1, multiplos:false },
  ],
  "Embalagem — Pote (plástico/vidro)": [
    { nome:"Aspecto visual",        espec:"Sem trincas, deformações ou manchas", unidade:"—",   tipo:"conforme", casas:0, multiplos:false },
    { nome:"Cor",                   espec:"Conforme padrão",                     unidade:"—",   tipo:"conforme", casas:0, multiplos:false },
    { nome:"Altura",                espec:"",                                    unidade:"mm",  tipo:"numero",   casas:2, multiplos:true  },
    { nome:"Diâmetro externo",      espec:"",                                    unidade:"mm",  tipo:"numero",   casas:2, multiplos:true  },
    { nome:"Diâmetro da boca",      espec:"",                                    unidade:"mm",  tipo:"numero",   casas:2, multiplos:true  },
    { nome:"Peso",                  espec:"",                                    unidade:"g",   tipo:"numero",   casas:2, multiplos:true  },
    { nome:"Capacidade volumétrica",espec:"",                                    unidade:"mL",  tipo:"numero",   casas:0, multiplos:false },
    { nome:"Vedação / Torque",      espec:"Sem vazamento",                       unidade:"N.m", tipo:"numero",   casas:2, multiplos:false },
    { nome:"Impressão / Gravação",  espec:"Legível e conforme",                  unidade:"—",   tipo:"conforme", casas:0, multiplos:false },
  ],
  "Embalagem — Tampa": [
    { nome:"Aspecto visual",        espec:"Sem defeitos",          unidade:"—",   tipo:"conforme", casas:0, multiplos:false },
    { nome:"Cor",                   espec:"Conforme padrão",       unidade:"—",   tipo:"conforme", casas:0, multiplos:false },
    { nome:"Diâmetro interno",      espec:"",                      unidade:"mm",  tipo:"numero",   casas:2, multiplos:true  },
    { nome:"Altura",                espec:"",                      unidade:"mm",  tipo:"numero",   casas:2, multiplos:true  },
    { nome:"Torque de fechamento",  espec:"",                      unidade:"N.m", tipo:"numero",   casas:2, multiplos:false },
    { nome:"Vedação",               espec:"Sem vazamento",         unidade:"—",   tipo:"conforme", casas:0, multiplos:false },
  ],
  "Embalagem — Caixa de papelão / Cartucho": [
    { nome:"Aspecto visual",        espec:"Sem manchas, rasgos ou defeitos", unidade:"—",    tipo:"conforme", casas:0, multiplos:false },
    { nome:"Impressão / Texto",     espec:"Conforme arte aprovada",          unidade:"—",    tipo:"conforme", casas:0, multiplos:false },
    { nome:"Código de barras",      espec:"Leitura correta",                 unidade:"—",    tipo:"conforme", casas:0, multiplos:false },
    { nome:"Altura",                espec:"",                                unidade:"mm",   tipo:"numero",   casas:2, multiplos:true  },
    { nome:"Largura",               espec:"",                                unidade:"mm",   tipo:"numero",   casas:2, multiplos:true  },
    { nome:"Profundidade",          espec:"",                                unidade:"mm",   tipo:"numero",   casas:2, multiplos:true  },
    { nome:"Gramatura",             espec:"",                                unidade:"g/m²", tipo:"numero",   casas:1, multiplos:false },
    { nome:"Espessura",             espec:"",                                unidade:"mm",   tipo:"numero",   casas:3, multiplos:true  },
    { nome:"Resistência",           espec:"Conforme especificação",          unidade:"—",    tipo:"conforme", casas:0, multiplos:false },
  ],
  "Embalagem — Rótulo": [
    { nome:"Aspecto visual",        espec:"Sem defeitos de impressão",  unidade:"—",    tipo:"conforme", casas:0, multiplos:false },
    { nome:"Impressão / Texto",     espec:"Conforme arte aprovada",     unidade:"—",    tipo:"conforme", casas:0, multiplos:false },
    { nome:"Código de barras",      espec:"Leitura correta",            unidade:"—",    tipo:"conforme", casas:0, multiplos:false },
    { nome:"Altura",                espec:"",                           unidade:"mm",   tipo:"numero",   casas:2, multiplos:true  },
    { nome:"Largura",               espec:"",                           unidade:"mm",   tipo:"numero",   casas:2, multiplos:true  },
    { nome:"Gramatura",             espec:"",                           unidade:"g/m²", tipo:"numero",   casas:1, multiplos:false },
    { nome:"Aderência",             espec:"Sem descolamento",           unidade:"—",    tipo:"conforme", casas:0, multiplos:false },
    { nome:"Cor (CMYK)",            espec:"Conforme aprovado",          unidade:"—",    tipo:"conforme", casas:0, multiplos:false },
  ],
  "Embalagem — Filme de sachê": [
    { nome:"Aspecto visual",        espec:"Sem furos, rasgos ou contaminação", unidade:"—",    tipo:"conforme", casas:0, multiplos:false },
    { nome:"Impressão",             espec:"Conforme arte aprovada",            unidade:"—",    tipo:"conforme", casas:0, multiplos:false },
    { nome:"Largura",               espec:"",                                  unidade:"mm",   tipo:"numero",   casas:2, multiplos:true  },
    { nome:"Espessura",             espec:"",                                  unidade:"µm",   tipo:"numero",   casas:3, multiplos:true  },
    { nome:"Gramatura",             espec:"",                                  unidade:"g/m²", tipo:"numero",   casas:1, multiplos:false },
    { nome:"Resistência ao calor",  espec:"Selagem íntegra",                   unidade:"—",    tipo:"conforme", casas:0, multiplos:false },
    { nome:"Resistência ao rasgo",  espec:"",                                  unidade:"N",    tipo:"numero",   casas:1, multiplos:false },
  ],
  "Produto acabado (cápsula/comprimido)": [
    { nome:"Aspecto",               espec:"Conforme padrão", unidade:"—",   tipo:"conforme", casas:0, multiplos:false },
    { nome:"Cor",                   espec:"Conforme padrão", unidade:"—",   tipo:"conforme", casas:0, multiplos:false },
    { nome:"Peso médio",            espec:"",                unidade:"mg",  tipo:"numero",   casas:1, multiplos:true  },
    { nome:"Variação de peso",      espec:"≤ 5,0%",         unidade:"%",   tipo:"numero",   casas:2, multiplos:false },
    { nome:"Desintegração",         espec:"≤ 30 min",        unidade:"min", tipo:"numero",   casas:1, multiplos:false },
    { nome:"Dureza",                espec:"",                unidade:"N",   tipo:"numero",   casas:1, multiplos:true  },
    { nome:"Friabilidade",          espec:"≤ 1,0%",         unidade:"%",   tipo:"numero",   casas:2, multiplos:false },
    { nome:"Doseamento",            espec:"",                unidade:"%",   tipo:"numero",   casas:1, multiplos:false },
  ],
  "Produto acabado (sachê/pó)": [
    { nome:"Aspecto",               espec:"Conforme padrão",    unidade:"—",   tipo:"conforme", casas:0, multiplos:false },
    { nome:"Cor",                   espec:"Conforme padrão",    unidade:"—",   tipo:"conforme", casas:0, multiplos:false },
    { nome:"Odor",                  espec:"Característico",     unidade:"—",   tipo:"conforme", casas:0, multiplos:false },
    { nome:"Peso médio",            espec:"",                   unidade:"g",   tipo:"numero",   casas:2, multiplos:true  },
    { nome:"Variação de peso",      espec:"≤ 5,0%",            unidade:"%",   tipo:"numero",   casas:2, multiplos:false },
    { nome:"pH",                    espec:"",                   unidade:"pH",  tipo:"numero",   casas:2, multiplos:false },
    { nome:"Umidade",               espec:"",                   unidade:"%",   tipo:"numero",   casas:1, multiplos:false },
    { nome:"Vedação da embalagem",  espec:"Sem vazamento",      unidade:"—",   tipo:"conforme", casas:0, multiplos:false },
  ],
};

const CQ_TIPO_FILTROS = [
  { id: "Todos", label: "Todos" },
  { id: "materia-prima", label: "Matéria-prima" },
  { id: "embalagem", label: "Embalagens" },
  { id: "rotulo", label: "Rótulos" },
];

function normalizeCQText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function materialBucket(material) {
  const text = normalizeCQText([
    material?.tipo,
    material?.nome,
    material?.nomeBase,
    material?.ref,
  ].filter(Boolean).join(" "));

  if (text.includes("rotulo") || text.includes("etiqueta") || text.includes("label")) return "rotulo";
  if (text.includes("embal") || text.includes("frasco") || text.includes("pote") || text.includes("tampa") || text.includes("caixa") || text.includes("cartucho") || text.includes("blister") || text.includes("bisnaga") || text.includes("sache") || text.includes("saco")) return "embalagem";
  if (text.includes("materia-prima") || text.includes("materia prima") || text.includes("extrato") || text.includes("insumo") || text.includes("ativo") || text.includes("oleo")) return "materia-prima";
  return "outros";
}

function matchesMaterialSearch(material, term) {
  const text = normalizeCQText([
    material?.nome,
    material?.nomeBase,
    material?.tipo,
    material?.fornecedorPadrao,
    material?.ref,
    material?.codigoAreco,
    material?.referenciaAreco,
    material?.descricao,
    material?.obs,
  ].filter(Boolean).join(" "));
  return !term || text.includes(normalizeCQText(term));
}

export function CQMateriaisTab({ user, toast_, fornecedores, perm, auditLog }) {
  const T = useTheme(); const s = useS();
  const [materiais, setMateriais] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("lista"); // lista | novo | editar
  const [sel, setSel] = useState(null);
  const [clientes, setClientes] = useState([]);
  const LINHAS = ["Supra","Verde","Beauty","Especial"];
  const EMPTY_MAT = { nome:"", nomeBase:"", apresentacao:"", origem:"", linha:"", clienteId:"", tipo:"Matéria-prima (pó/granulado)", fornecedorPadrao:"", ref:"", obs:"" };
  const [form, setForm] = useState(EMPTY_MAT);
  const [ensaios, setEnsaios] = useState([]);
  const [templateSel, setTemplateSel] = useState("");
  const [iaLoading, setIaLoading] = useState(false);
  const [iaConfirmada, setIaConfirmada] = useState(false);
  const [fichasTecnicas, setFichasTecnicas] = useState([]);
  const [ftUploading, setFtUploading] = useState(null);
  const [filtroTipoLista, setFiltroTipoLista] = useState("Todos");
  const [buscaMatLista, setBuscaMatLista] = useState("");
  const [pgMat, setPgMat] = useState(1);
  const PER_PAGE_MAT = 15;
  const matFiltrados = materiais
    .filter(m => filtroTipoLista==="Todos" || materialBucket(m)===filtroTipoLista)
    .filter(m => matchesMaterialSearch(m, buscaMatLista));
  const totMatPg = Math.ceil(matFiltrados.length / PER_PAGE_MAT) || 1;
  const safePgMat = Math.min(pgMat, totMatPg);
  const matPg = matFiltrados.slice((safePgMat-1)*PER_PAGE_MAT, safePgMat*PER_PAGE_MAT);
  const setF = (k,v) => setForm(p=>({...p,[k]:v}));

  // Monta o nome de exibição a partir dos campos estruturados
  const montarNome = (f) => {
    const base = (f.nomeBase||"").trim();
    if(!base) return "";
    const partes = [base];
    if((f.apresentacao||"").trim()) partes.push(f.apresentacao.trim());
    let sufixo = "";
    if(f.origem==="Própria" && f.linha) sufixo = f.linha;
    else if(f.origem==="Terceiro" && f.clienteId){
      const c = clientes.find(x=>String(x.id)===String(f.clienteId));
      sufixo = c?.nome || "";
    }
    let nome = partes.join(" ");
    if(sufixo) nome += " — " + sufixo;
    return nome;
  };

  useEffect(()=>{
    const unsub = subscribeCollection("cq_materiais", list=>{
      setMateriais(list.sort((a,b)=>(a.nome||"").localeCompare(b.nome||"")));
      setLoading(false);
    });
    const unsubT = subscribeCollection("cq_templates", list=>{
      setTemplates(list.sort((a,b)=>(a.nome||"").localeCompare(b.nome||"")));
    });
    const unsubC = subscribeCollection("clientes_terceiros", list=>{
      setClientes(list.sort((a,b)=>(a.nome||"").localeCompare(b.nome||"")));
    });
    const t = setTimeout(()=>setLoading(false), 3000);
    return ()=>{ unsub(); unsubT(); unsubC(); clearTimeout(t); };
  },[]);

  const carregarTemplate = (tplId) => {
    if(!tplId) return;
    const tpl = templates.find(t=>String(t.id)===String(tplId));
    if(!tpl) return;
    if(ensaios.length > 0 && !confirm(`Substituir os ensaios atuais pelo template "${tpl.nome}"?`)) return;
    setF("tipo", tpl.tipo);
    setEnsaios((tpl.ensaios||[]).map((e,i)=>({ tipo:"numero", casas:2, multiplos:false, ...e, id:Date.now()+i })));
    setTemplateSel(tplId);
    toast_(`Template "${tpl.nome}" carregado!`, "green");
  };

  const salvarTemplate = async () => {
    if(ensaios.length===0) { alert("Adicione ensaios antes de salvar o template."); return; }
    const nomeTemplate = prompt("Nome do template:", `${form.tipo} — padrão`);
    if(!nomeTemplate || !nomeTemplate.trim()) return;
    try {
      const id = String(Date.now());
      await saveCollection("cq_templates", id, {
        id,
        nome: nomeTemplate.trim(),
        tipo: form.tipo,
        ensaios: ensaios.map((e,i)=>({
          id: i+1,
          nome: e.nome||"",
          espec: e.espec||"",
          unidade: e.unidade||"",
          ref: e.ref||"",
          tipo: e.tipo||"numero",
          casas: e.casas!==undefined?e.casas:2,
          multiplos: e.multiplos||false,
        })),
        criadoPor: user.name,
        criadoEm: tod(),
      });
      toast_(`Template "${nomeTemplate.trim()}" salvo!`, "green");
    } catch(e) {
      alert("Erro ao salvar template: " + e.message);
    }
  };

  const delTemplate = async (tpl) => {
    if(!confirm(`Excluir o template "${tpl.nome}"?`)) return;
    try {
      await deleteFromCollection("cq_templates", String(tpl.id));
      toast_("Template excluído.", "red");
    } catch(e) {
      toast_(fbErr(e), "red");
    }
  };

  const aplicarSugestoes = (tipo) => {
    const sugs = ENSAIOS_SUGERIDOS[tipo] || [];
    setEnsaios(sugs.map((e,i)=>({ tipo:"numero", casas:2, multiplos:false, ...e, id:i+1, ref:e.ref||"" })));
  };

  const addEnsaio = () => setEnsaios(p=>[...p, { id:Date.now(), nome:"", espec:"", unidade:"", ref:"", tipo:"numero", casas:2, multiplos:false }]);

  // Rascunho de ensaios + limites via IA — TODOS marcados para verificação na fonte
  const sugerirEnsaiosIA = async () => {
    if(!form.nomeBase.trim()) { alert("Preencha o nome base do material primeiro."); return; }
    setIaLoading(true);
    try {
      const prompt = `Você é especialista em controle de qualidade farmacêutico/nutracêutico (BPF, ANVISA, compêndios oficiais).
Material: "${form.nomeBase.trim()}"
Tipo: "${form.tipo}"

Gere um RASCUNHO da ficha de ensaios de controle de qualidade típica para esse material, com base em compêndios aceitos pela ANVISA (Farmacopeia Brasileira, USP, EP/BP, etc.).

REGRAS OBRIGATÓRIAS:
- Inclua apenas ensaios compendiais que você reconhece como usuais para esse material. Se não tiver certeza do material, retorne lista vazia [].
- Os limites são um RASCUNHO de partida e SERÃO verificados por um humano na monografia oficial. NÃO invente números de monografia, página ou edição específicos se não tiver certeza.
- No campo "ref", indique o compêndio provável de forma genérica e SEMPRE com aviso de verificação. Ex: "Farmacopeia Brasileira (verificar monografia e edição vigente)".
- Se um limite for incerto, use o campo "espec" com a faixa usual e mantenha o aviso.

Responda APENAS com um array JSON, sem markdown, sem texto antes ou depois, no formato:
[{"nome":"Doseamento","espec":"90,0 – 110,0","unidade":"%","ref":"USP (verificar monografia vigente)"}]`;
      const txt = await askClaude(prompt);
      const limpo = (txt||"").replace(/```json|```/g,"").trim();
      let arr = [];
      try { arr = JSON.parse(limpo); } catch { arr = []; }
      if(!Array.isArray(arr) || arr.length===0){
        alert("A IA não retornou sugestões para este material. Adicione os ensaios manualmente.");
        return;
      }
      const novos = arr.map((e,i)=>({
        id: Date.now()+i,
        nome: e.nome||"",
        espec: e.espec||"",
        unidade: e.unidade||"",
        ref: e.ref||"(verificar na fonte)",
        tipo: "numero", casas: 2, multiplos: false,
        _ia: true,
      }));
      setEnsaios(p=>[...p, ...novos]);
      setIaConfirmada(false);
    } catch(err) {
      alert("Erro ao consultar a IA: " + err.message);
    } finally {
      setIaLoading(false);
    }
  };

  const updEnsaio = (id,k,v) => setEnsaios(p=>p.map(e=>e.id===id?{...e,[k]:v}:e));
  const delEnsaio = (id) => setEnsaios(p=>p.filter(e=>e.id!==id));

  const addLinhaFicha = () => setFichasTecnicas(p=>[...p, { id: Date.now(), fornecedorNome:"", url:"", nome:"", size:0, uploadedAt:"" }]);
  const updLinhaFicha = (id, k, v) => setFichasTecnicas(p=>p.map(f=>f.id===id?{...f,[k]:v}:f));
  const delLinhaFicha = (id) => setFichasTecnicas(p=>p.filter(f=>f.id!==id));
  const uploadFicha = async (id, file) => {
    if(!file) return;
    setFtUploading(id);
    try {
      const result = await uploadStoredFile(file);
      updLinhaFicha(id, "url", result.url);
      updLinhaFicha(id, "nome", result.name);
      updLinhaFicha(id, "size", result.size);
      updLinhaFicha(id, "uploadedAt", tod());
      toast_("Ficha técnica anexada!", "green");
    } catch(e) {
      toast_("Erro no upload: " + e.message, "red");
    } finally { setFtUploading(null); }
  };

  const salvar = async () => {
    if(!form.nomeBase.trim()) { alert("Nome base é obrigatório."); return; }
    if(form.origem==="Própria" && !form.linha) { alert("Selecione a linha."); return; }
    if(form.origem==="Terceiro" && !form.clienteId) { alert("Selecione o cliente terceiro."); return; }
    if(ensaios.some(e=>e._ia) && !iaConfirmada) { alert("Há ensaios com limites gerados por IA. Confirme que você verificou os limites e referências na fonte oficial antes de salvar."); return; }
    if(ensaios.length===0) { alert("Adicione ao menos um ensaio."); return; }
    try {
      const id = sel ? String(sel.id) : String(Date.now());
      // Limpar ensaios para manter o payload simples no banco local
      const ensaiosLimpos = ensaios.map((e,i) => ({
        id: i+1,
        nome: e.nome||"",
        espec: e.espec||"",
        unidade: e.unidade||"",
        ref: e.ref||"",
        tipo: e.tipo||"numero",
        casas: e.casas !== undefined ? e.casas : 2,
        multiplos: e.multiplos||false,
      }));
      const material = {
        id,
        nome: montarNome(form) || form.nomeBase.trim(),
        nomeBase: form.nomeBase.trim(),
        apresentacao: form.apresentacao||"",
        origem: form.origem||"",
        linha: form.origem==="Própria" ? (form.linha||"") : "",
        clienteId: form.origem==="Terceiro" ? (form.clienteId||"") : "",
        tipo: form.tipo,
        fornecedorPadrao: form.fornecedorPadrao||"",
        ref: form.ref||"",
        obs: form.obs||"",
        ensaios: ensaiosLimpos,
        fichasTecnicas: fichasTecnicas.filter(f=>f.url||f.fornecedorNome),
        criadoPor: user.name,
        criadoEm: tod(),
        atualizadoEm: tod(),
      };
      await saveCollection("cq_materiais", id, material);
      await auditLog(sel ? "Editou Material CQ" : "Criou Material CQ", "cq_materiais", id, material.nome, sel || null, { nome: material.nome, tipo: material.tipo, fornecedorPadrao: material.fornecedorPadrao });
      toast_(sel?"Material atualizado!":"Material cadastrado!", "green");
      setView("lista"); setSel(null);
      setForm(EMPTY_MAT);
      setEnsaios([]);
      setTemplateSel("");
      setFichasTecnicas([]);
      setIaConfirmada(false);
    } catch(e) {
      alert("Erro ao salvar: " + e.message);
      console.error(e);
    }
  };

  const editarMaterial = (m) => {
    setSel(m);
    setTemplateSel("");
    setForm({ nome:m.nome||"", nomeBase:m.nomeBase||m.nome||"", apresentacao:m.apresentacao||"", origem:m.origem||"", linha:m.linha||"", clienteId:m.clienteId||"", tipo:m.tipo, fornecedorPadrao:m.fornecedorPadrao||"", ref:m.ref||"", obs:m.obs||"" });
    setIaConfirmada(false);
    setEnsaios((m.ensaios||[]).map(e=>({ tipo:"numero", casas:2, multiplos:false, ...e })));
    setFichasTecnicas((m.fichasTecnicas||[]).map(f=>({ id:Date.now()+Math.random(), ...f })));
    setView("editar");
  };

  const delMaterial = async (id) => {
    try {
    if(!confirm("Excluir este material e todos os seus ensaios?")) return;
    const antesM = materiais.find(m => String(m.id) === String(id));
    await deleteFromCollection("cq_materiais", String(id));
    await auditLog("Excluiu Material CQ", "cq_materiais", String(id), antesM?.nome || String(id), antesM, null);
    toast_("Material excluído.", "red");
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  if(loading) return <div style={{ textAlign:"center", padding:"3rem", color:T.text2 }}>Carregando...</div>;

  if(view==="lista") {
    return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
        <div style={{ fontSize:13, color:T.text2 }}>{matFiltrados.length} material(is) encontrado(s)</div>
        <button style={s.btnA} onClick={()=>{ setForm(EMPTY_MAT); setEnsaios([]); setFichasTecnicas([]); setSel(null); setTemplateSel(""); setIaConfirmada(false); setView("novo"); }}>+ Novo Material</button>
      </div>

      {materiais.length===0 ? (
        <div style={{ ...s.card, textAlign:"center", padding:"3rem" }}>
          <div style={{ fontSize:40, marginBottom:"1rem", opacity:.3 }}>🧪</div>
          <div style={{ fontSize:14, color:T.text2, marginBottom:6 }}>Nenhum material cadastrado</div>
          <div style={{ fontSize:12, color:T.text3 }}>Clique em "+ Novo Material" para começar</div>
        </div>
      ) : (
        <>
          <div style={{ position:"relative", marginBottom:12 }}>
            <Inp
              value={buscaMatLista}
              onChange={e=>{ setBuscaMatLista(e.target.value); setPgMat(1); }}
              placeholder={`🔍 Buscar entre ${materiais.length} materiais por nome, referência, fornecedor ou código...`}
              sx={{ width:"100%", paddingRight:buscaMatLista?34:12 }}
            />
            {buscaMatLista && (
              <button onClick={()=>{ setBuscaMatLista(""); setPgMat(1); }} title="Limpar busca" style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"transparent", border:"none", color:T.text3, fontSize:16, cursor:"pointer", lineHeight:1 }}>×</button>
            )}
          </div>

          {/* Filtro por tipo */}
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:12 }}>
            {CQ_TIPO_FILTROS.map(t=>(
              <button key={t.id} onClick={()=>{ setFiltroTipoLista(t.id); setPgMat(1); }} style={{ padding:"4px 14px", fontSize:11, fontWeight:600, borderRadius:20, border:`1px solid ${filtroTipoLista===t.id?T.accent:T.border}`, background:filtroTipoLista===t.id?T.accentDim:"transparent", color:filtroTipoLista===t.id?T.accent:T.text2, cursor:"pointer", transition:"all .15s" }}>{t.label}</button>
            ))}
          </div>

          <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, overflow:"hidden" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead><tr style={{ background:T.surf }}>
                {["Material","Tipo","Fornecedor padrão","Ensaios","Referência",""].map(h=>(
                  <th key={h} style={{ padding:"10px 12px", fontSize:10, fontWeight:700, color:T.text3, textTransform:"uppercase", textAlign:"left", borderBottom:`1px solid ${T.border}`, whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {matPg.length===0 ? (
                  <tr><td colSpan={6} style={{ padding:"2rem", textAlign:"center", color:T.text3, fontSize:13 }}>{buscaMatLista ? `Nenhum material encontrado para "${buscaMatLista}".` : "Nenhum material nesta categoria."}</td></tr>
                ) : matPg.map((m,i)=>(
                  <tr key={m.id} style={{ background:i%2===0?T.card:T.surf }}>
                    <td style={{ padding:"10px 12px", fontSize:13, fontWeight:600, color:T.text }}>{m.nome}</td>
                    <td style={{ padding:"10px 12px", fontSize:12, color:T.text2 }}>{m.tipo}</td>
                    <td style={{ padding:"10px 12px", fontSize:12, color:T.text2 }}>{m.fornecedorPadrao||"—"}</td>
                    <td style={{ padding:"10px 12px", fontSize:12, color:T.accent, fontWeight:700 }}>{m.ensaios?.length||0}</td>
                    <td style={{ padding:"10px 12px", fontSize:12, color:T.text2 }}>{m.ref||"—"}</td>
                    <td style={{ padding:"10px 8px", display:"flex", gap:6 }}>
                      <button style={{ ...s.btn, padding:"4px 10px", fontSize:11, color:T.accent, borderColor:T.accent+"33", background:T.accentDim }} onClick={()=>editarMaterial(m)}><span className="btn-emoji">✏️ </span>Editar</button>
                      <button style={{ ...s.btnD, padding:"4px 10px", fontSize:11 }} onClick={()=>delMaterial(m.id)}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={safePgMat} total={totMatPg} setPage={setPgMat} />
        </>
      )}
    </div>
  );}

  // Formulário novo/editar
  return (
    <div>
      <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:"1rem" }}>
        <button style={s.btn} onClick={()=>{ setView("lista"); setSel(null); }}>← Voltar</button>
        <div style={{ fontSize:15, fontWeight:700, color:T.text }}>{sel?"Editar material":"Novo material"}</div>
      </div>

      {/* Templates */}
      <div style={{ ...s.card, background: T.accentDim, border:`1px solid ${T.accent}33` }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, flex:1, minWidth:240 }}>
            <span style={{ fontSize:16 }}>📋</span>
            <span style={{ fontSize:13, fontWeight:700, color:T.accent }}>Carregar template</span>
            <Sel value={templateSel} onChange={e=>carregarTemplate(e.target.value)} sx={{ flex:1, maxWidth:320 }}>
              <option value="">Selecionar template...</option>
              {templates.map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}
            </Sel>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            {templates.length > 0 && templateSel && (
              <button style={{ ...s.btnD, fontSize:11, padding:"5px 10px" }} onClick={()=>{ const tpl=templates.find(t=>String(t.id)===String(templateSel)); if(tpl) delTemplate(tpl); }}>🗑️ Excluir template</button>
            )}
            <button style={{ ...s.btn, fontSize:11, padding:"5px 12px", color:T.accent, borderColor:T.accent+"44", background:"transparent" }} onClick={salvarTemplate}>💾 Salvar como template</button>
          </div>
        </div>
        {templates.length===0 && (
          <div style={{ fontSize:11, color:T.text3, marginTop:8 }}>Nenhum template salvo. Preencha os ensaios e clique em "Salvar como template" para reaproveitar nas próximas criações.</div>
        )}
      </div>

      {/* Dados gerais */}
      <div style={s.card}>
        <SecTitle icon="📦" ch="Dados do material" />
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <F lbl="Nome base *" tip="Só o que identifica o material, sem linha, quantidade ou fornecedor. Ex: Vitamina C, Celulose Microcristalina." ch={<Inp placeholder="Ex: Vitamina C" value={form.nomeBase} onChange={e=>setF("nomeBase",e.target.value)} />} />
          <F lbl="Apresentação" tip="Quantidade e forma, quando aplicável. Ex: 30 Cápsulas, 60 Comprimidos. Deixe vazio para matéria-prima." ch={<Inp placeholder="Ex: 30 Cápsulas" value={form.apresentacao} onChange={e=>setF("apresentacao",e.target.value)} />} />
          <F lbl="Tipo de material" ch={
            <Sel value={form.tipo} onChange={e=>{ setF("tipo",e.target.value); if(!sel) aplicarSugestoes(e.target.value); }}>
              {Object.keys(ENSAIOS_SUGERIDOS).map(t=><option key={t}>{t}</option>)}
            </Sel>
          }/>
          <F lbl="Origem" tip="Marca própria (Beauty, Verde, etc.) ou produto de cliente terceiro. Deixe em branco para matéria-prima e itens sem linha." ch={
            <Sel value={form.origem} onChange={e=>setF("origem", e.target.value)}>
              <option value="">— (sem linha)</option>
              <option value="Própria">Linha própria</option>
              <option value="Terceiro">Cliente terceiro</option>
            </Sel>
          }/>
          {form.origem==="Própria" && (
            <F lbl="Linha *" ch={
              <Sel value={form.linha} onChange={e=>setF("linha", e.target.value)}>
                <option value="">Selecionar linha...</option>
                {LINHAS.map(l=><option key={l} value={l}>{l}</option>)}
              </Sel>
            }/>
          )}
          {form.origem==="Terceiro" && (
            <F lbl="Cliente terceiro *" ch={
              <Sel value={form.clienteId} onChange={e=>setF("clienteId", e.target.value)}>
                <option value="">Selecionar cliente...</option>
                {clientes.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
              </Sel>
            }/>
          )}
          <F lbl="Fornecedor padrão" ch={
            <Sel value={form.fornecedorPadrao} onChange={e=>setF("fornecedorPadrao",e.target.value)}>
              <option value="">Selecionar...</option>
              {fornecedores.filter(x=>x.status==="Ativo").map(f=><option key={f.id} value={f.nome}>{f.nome}</option>)}
              <option value="Vários">Vários fornecedores</option>
            </Sel>
          }/>
          <F lbl="Referência / Especificação interna" ch={<Inp placeholder="Ex: EI-MP-001, Farmacopeia Brasileira" value={form.ref} onChange={e=>setF("ref",e.target.value)} />} />
        </div>
        {form.nomeBase.trim() && (
          <div style={{ marginTop:10, padding:"8px 12px", background:T.accentDim, border:`1px solid ${T.accent}44`, borderRadius:8, fontSize:12, color:T.text2 }}>
            Nome que será salvo: <strong style={{ color:T.accent }}>{montarNome(form)||form.nomeBase.trim()}</strong>
          </div>
        )}
        <F lbl="Observações" ch={<TA rows={2} value={form.obs} onChange={e=>setF("obs",e.target.value)} placeholder="Informações adicionais sobre o material..." />} />
      </div>

      {/* Ensaios */}
      <div style={s.card}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
          <SecTitle icon="🔬" ch={`Ensaios (${ensaios.length})`} />
          <div style={{ display:"flex", gap:8 }}>
            <button style={s.btn} onClick={()=>aplicarSugestoes(form.tipo)}>↺ Recarregar sugestões</button>
            <button style={{ ...s.btn, opacity: iaLoading?0.6:1, cursor: iaLoading?"wait":"pointer" }} disabled={iaLoading} onClick={sugerirEnsaiosIA}>{iaLoading ? "⏳ Gerando rascunho..." : "✨ Rascunho IA (ensaios + limites)"}</button>
            <button style={s.btnA} onClick={addEnsaio}><span className="btn-emoji">+ </span>Adicionar ensaio</button>
          </div>
        </div>

        {ensaios.some(e=>e._ia) && (
          <div style={{ marginBottom:12, padding:"10px 12px", background:T.yellow+"18", border:`1px solid ${T.yellow}66`, borderRadius:8 }}>
            <div style={{ fontSize:12, color:T.text, fontWeight:600, marginBottom:6 }}>⚠ Limites e referências gerados por IA — rascunho não verificado</div>
            <div style={{ fontSize:11, color:T.text2, marginBottom:8, lineHeight:1.5 }}>
              A IA pode errar limites e citar referências inexistentes. Confira cada ensaio marcado contra a monografia oficial vigente (Farmacopeia Brasileira, USP, etc.) e corrija o campo Especificação e Referência antes de salvar.
            </div>
            <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, color:T.text, cursor:"pointer" }}>
              <input type="checkbox" checked={iaConfirmada} onChange={e=>setIaConfirmada(e.target.checked)} />
              Confirmo que verifiquei os limites e referências sugeridos na fonte oficial.
            </label>
          </div>
        )}

        {ensaios.length===0 ? (
          <div style={{ textAlign:"center", padding:"2rem", color:T.text3, fontSize:13 }}>
            Selecione o tipo acima para carregar sugestões ou adicione manualmente
          </div>
        ) : (
          <div>
            {/* Header */}
            <div style={{ display:"grid", gridTemplateColumns:"2fr 2fr 1fr 1fr 120px 60px 36px", gap:6, padding:"6px 8px", fontSize:10, fontWeight:700, color:T.text3, textTransform:"uppercase", letterSpacing:".06em", marginBottom:4 }}>
              <span>Ensaio *</span><span>Especificação</span><span>Unidade</span><span>Referência</span><span>Tipo de resultado</span><span>Casas dec.</span><span></span>
            </div>
            {ensaios.map((e,i)=>(
              <div key={e.id} style={{ marginBottom:8, background:T.surf, borderRadius:8, border:`1px solid ${e._ia?T.yellow+"88":T.border}`, borderLeft:e._ia?`3px solid ${T.yellow}`:`1px solid ${T.border}`, padding:"8px" }}>
                {e._ia && <div style={{ fontSize:10, color:T.yellow, fontWeight:700, marginBottom:4 }}>⚠ Rascunho IA — verificar na monografia</div>}
                <div style={{ display:"grid", gridTemplateColumns:"2fr 2fr 1fr 1fr 120px 60px 36px", gap:6, alignItems:"center" }}>
                  <Inp placeholder="Ex: pH, Umidade, Aspecto..." value={e.nome} onChange={ev=>updEnsaio(e.id,"nome",ev.target.value)} sx={{ fontSize:12 }}/>
                  <Inp placeholder="Ex: 5,0–7,0 ou Conforme padrão" value={e.espec} onChange={ev=>updEnsaio(e.id,"espec",ev.target.value)} sx={{ fontSize:12 }}/>
                  <Inp placeholder="Ex: %, pH" value={e.unidade} onChange={ev=>updEnsaio(e.id,"unidade",ev.target.value)} sx={{ fontSize:12 }}/>
                  <Inp placeholder="Ex: EI-001" value={e.ref||""} onChange={ev=>updEnsaio(e.id,"ref",ev.target.value)} sx={{ fontSize:12 }}/>
                  <Sel value={e.tipo||"numero"} onChange={ev=>updEnsaio(e.id,"tipo",ev.target.value)} sx={{ fontSize:11, padding:"5px 6px" }}>
                    <option value="numero">🔢 Numérico</option>
                    <option value="conforme">✓/✗ Conforme</option>
                    <option value="texto">📝 Texto livre</option>
                  </Sel>
                  <Sel value={String(e.casas!==undefined?e.casas:2)} onChange={ev=>updEnsaio(e.id,"casas",parseInt(ev.target.value))} disabled={e.tipo!=="numero"} sx={{ fontSize:11, padding:"5px 6px", opacity:e.tipo!=="numero"?.4:1 }}>
                    <option value="0">0</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                  </Sel>
                  <button onClick={()=>delEnsaio(e.id)} style={{ background:"#ff4f6a18", border:"1px solid #ff4f6a33", color:"#ff4f6a", borderRadius:6, cursor:"pointer", width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontFamily:"inherit" }}>✕</button>
                </div>
                {e.tipo==="numero" && (
                  <div style={{ marginTop:6, display:"flex", alignItems:"center", gap:6, paddingLeft:2 }}>
                    <input type="checkbox" id={`mult-${e.id}`} checked={!!e.multiplos} onChange={ev=>updEnsaio(e.id,"multiplos",ev.target.checked)} style={{ accentColor:T.accent, width:14, height:14 }}/>
                    <label htmlFor={`mult-${e.id}`} style={{ fontSize:11, color:T.text2, cursor:"pointer" }}>Permite lançamento de múltiplos valores (calcula média automaticamente)</label>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fichas Técnicas */}
      <div style={s.card}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
          <SecTitle icon="📄" ch={`Fichas Técnicas (${fichasTecnicas.length})`} />
          <button style={s.btnA} onClick={addLinhaFicha}><span className="btn-emoji">+ </span>Adicionar ficha</button>
        </div>
        {fichasTecnicas.length===0 ? (
          <div style={{ textAlign:"center", padding:"1.5rem", color:T.text3, fontSize:13 }}>Nenhuma ficha técnica anexada. Clique em "+ Adicionar ficha" para começar.</div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {fichasTecnicas.map(f=>(
              <div key={f.id} style={{ display:"grid", gridTemplateColumns:"1fr 1fr auto auto", gap:8, alignItems:"center", background:T.surf, border:`1px solid ${T.border}`, borderRadius:8, padding:"8px 10px" }}>
                <Sel value={f.fornecedorNome} onChange={e=>updLinhaFicha(f.id,"fornecedorNome",e.target.value)} sx={{ fontSize:12 }}>
                  <option value="">Selecionar fornecedor...</option>
                  {fornecedores.filter(x=>x.status==="Ativo").map(forn=><option key={forn.id} value={forn.nome}>{forn.nome}</option>)}
                  <option value="Outro">Outro</option>
                </Sel>
                {f.url ? (
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ fontSize:12, color:T.accent, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }} title={f.nome}>📎 {f.nome}</span>
                    <button onClick={()=>window.open(f.url,"_blank","noopener,noreferrer")} style={{ ...s.btn, padding:"3px 8px", fontSize:11, color:T.accent, whiteSpace:"nowrap" }}>👁 Ver</button>
                  </div>
                ) : (
                  <label style={{ ...s.btn, padding:"5px 12px", fontSize:11, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:4 }}>
                    {ftUploading===f.id ? "Enviando..." : "📎 Anexar PDF"}
                    <input type="file" accept=".pdf,image/*" style={{ display:"none" }} disabled={ftUploading===f.id} onChange={e=>uploadFicha(f.id, e.target.files[0])} />
                  </label>
                )}
                {f.url ? (
                  <label style={{ ...s.btn, padding:"5px 10px", fontSize:11, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:4 }}>
                    {ftUploading===f.id ? "..." : "↺ Trocar"}
                    <input type="file" accept=".pdf,image/*" style={{ display:"none" }} disabled={ftUploading===f.id} onChange={e=>uploadFicha(f.id, e.target.files[0])} />
                  </label>
                ) : <div />}
                <button onClick={()=>delLinhaFicha(f.id)} style={{ background:"#ff4f6a18", border:"1px solid #ff4f6a33", color:"#ff4f6a", borderRadius:6, cursor:"pointer", width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontFamily:"inherit" }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display:"flex", gap:10, justifyContent:"flex-end", paddingBottom:"1rem" }}>
        <button style={s.btn} onClick={()=>{ setView("lista"); setSel(null); }}>Cancelar</button>
        <button style={s.btnA} onClick={salvar}><span className="btn-emoji">💾 </span>Salvar material →</button>
      </div>
    </div>
  );
}

export function CQAnalisesTab({ user, toast_, fornecedores, setTab, perm, auditLog, rncs = [], setRncPrefill, config = {} }) {
  const T = useTheme(); const s = useS();
  const [materiais, setMateriais] = useState([]);
  const [analises, setAnalises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("lista");
  const [selAnalise, setSelAnalise] = useState(null);

  // Form
  const [matSel, setMatSel] = useState(null);
  const [form, setForm] = useState({ fornecedor:"", lote:"", qtdRecebidaValor:"", qtdRecebidaUnidade:"kg", qtdRecebida:"", nf:"", dataRecebimento:tod(), dataAnalise:tod(), resp:user.name, obs:"" });
  const [filtroTipo, setFiltroTipo] = useState("Todos");
  const [buscaMat, setBuscaMat] = useState("");
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroConc, setFiltroConc] = useState("Todos");
  const [resultados, setResultados] = useState([]);
  const [coa, setCoa] = useState(null);
  const [coaUploading, setCoaUploading] = useState(false);
  const setF = (k,v) => setForm(p=>({...p,[k]:v}));

  useEffect(()=>{
    const u1 = subscribeCollection("cq_materiais", list=>{ setMateriais(list.sort((a,b)=>(a.nome||"").localeCompare(b.nome||""))); });
    const u2 = subscribeCollection("cq_analises", list=>{ setAnalises(list.sort((a,b)=>(b.criadoTs||0)-(a.criadoTs||0))); setLoading(false); });
    const t = setTimeout(()=>setLoading(false), 3000);
    return ()=>{ u1(); u2(); clearTimeout(t); };
  },[]);

  const selecionarMaterial = (mat) => {
    setMatSel(mat);
    setResultados((mat.ensaios||[]).map(e=>({ tipo:"numero", casas:2, multiplos:false, ...e, resultado:"", conforme:null, obs:"" })));
    if(mat.fornecedorPadrao && mat.fornecedorPadrao!=="Vários") setF("fornecedor", mat.fornecedorPadrao);
  };

  const updRes = (id,k,v) => setResultados(p=>p.map(r=>r.id===id?{...r,[k]:v}:r));

  const [multiplosState, setMultiplosState] = useState({});
  const toggleMultiplos = (id) => setMultiplosState(p=>({...p,[id]:{aberto:!p[id]?.aberto,valores:p[id]?.valores||["","","","",""]}}));
  const updValorMultiplo = (id,idx,val) => setMultiplosState(p=>({...p,[id]:{...p[id],valores:p[id].valores.map((v,i)=>i===idx?val:v)}}));
  const aplicarMedia = (id,casas) => { const vals=multiplosState[id]?.valores||[]; const media=calcMedia(vals,casas); if(media){updRes(id,"resultado",media);setMultiplosState(p=>({...p,[id]:{...p[id],aberto:false}}));} };

  const fmtNum = (val, casas) => {
    const n = parseFloat(String(val).replace(",","."));
    if (isNaN(n)) return val;
    return n.toFixed(casas).replace(".",",");
  };
  const calcMedia = (valores, casas) => {
    const nums = valores.map(v=>parseFloat(String(v).replace(",","."))).filter(n=>!isNaN(n));
    if (!nums.length) return "";
    return (nums.reduce((a,b)=>a+b,0)/nums.length).toFixed(casas).replace(".",",");
  };

  const uploadCOA = async (file) => {
    if(!file) return;
    setCoaUploading(true);
    try {
      const r = await uploadStoredFile(file);
      setCoa(r); toast_("COA anexado!", "green");
    }
    catch { toast_("Erro ao enviar COA.", "red"); }
    setCoaUploading(false);
  };

  const getNCs = () => resultados.filter(r => r.conforme === false);

  const salvar = async () => {
    try {
    if(!matSel) { alert("Selecione o material."); return; }
    const ncs = getNCs();
    if(ncs.length > 0) {
      const confirma = window.confirm(
        `⚠️ ATENÇÃO!\n\n${ncs.length} ensaio(s) estão NÃO CONFORMES:\n${ncs.map(n=>`• ${n.nome}: ${n.resultado}`).join("\n")}\n\nDeseja salvar mesmo assim?`
      );
      if(!confirma) return;
    }
    const reprovado = ncs.length > 0;
    const isEditando = selAnalise?._editando === true;
    const num = isEditando ? (selAnalise.num || `RA-${new Date().getFullYear()}-${String(analises.length+1).padStart(3,"0")}`) : `RA-${new Date().getFullYear()}-${String(analises.length+1).padStart(3,"0")}`;
    const analise = {
      id: isEditando ? selAnalise.id : Date.now(), num,
      materialId: matSel.id, materialNome: matSel.nome, materialTipo: matSel.tipo,
      ...form,
      qtdRecebida: fmtQtd(form.qtdRecebidaValor, form.qtdRecebidaUnidade),
      resultados, coa,
      conclusao: reprovado ? "Reprovado" : resultados.some(r=>r.conforme===null&&r.resultado==="") ? "Pendente" : "Aprovado",
      respCargo: isEditando ? selAnalise.respCargo : (user.cargo || ""), respRegistro: isEditando ? selAnalise.respRegistro : (user.crf || ""),
      criadoPor: isEditando ? selAnalise.criadoPor : user.name, criadoEm: isEditando ? selAnalise.criadoEm : tod(), criadoTs: isEditando ? selAnalise.criadoTs : Date.now(),
      atualizadoPor: isEditando ? user.name : undefined, atualizadoEm: isEditando ? tod() : undefined,
    };
    await saveCollection("cq_analises", String(analise.id), analise);
    await auditLog(isEditando ? "Editou Análise CQ" : "Criou Análise CQ", "cq_analises", String(analise.id), `${num} — ${analise.materialNome}`, isEditando ? selAnalise : null, { num, material: analise.materialNome, conclusao: analise.conclusao, lote: analise.lote, editadoPor: user.name });
    toast_(`${num} salva!`, "green");
    if(reprovado && window.confirm("Material REPROVADO! Deseja abrir uma RNC automaticamente?")) {
      const duplicata = rncs.find(r => r.origemAnalise === num);
      if(duplicata) {
        alert(`Já existe uma RNC para esta análise (${duplicata.num})`);
      } else {
        setRncPrefill({ origemAnalise: num, produto: matSel?.nome || "", fornecedor: form.fornecedor, lote: form.lote, detector: user.name, tipo: "Matéria-prima" });
        setTab("nova");
      }
    }
    setView("lista");
    setMatSel(null);
    setSelAnalise(null);
    setForm({ fornecedor:"", lote:"", qtdRecebidaValor:"", qtdRecebidaUnidade:"kg", qtdRecebida:"", nf:"", dataRecebimento:tod(), dataAnalise:tod(), resp:user.name, obs:"" });
    setResultados([]); setCoa(null);
    } catch(e) {
      toast_(e.message, "red");
      console.error(e);
    }
  };

  const editarAnalise = async (a) => {
    const isOwner = a.resp === user?.name || a.analista === user?.name;
    const canEdit = isOwner || ["admin","keyuser","rt"].includes(user?.role) || (perm && perm("editarAnalise"));
    if (!canEdit) { alert("Você não tem permissão para editar esta análise."); return; }
    // Load the material to get ensaio definitions
    const mat = materiais.find(m => (a.materialId != null && String(m.id) === String(a.materialId)) || m.nome === a.materialNome);
    if (mat) {
      setMatSel(mat);
      const lista = mat.ensaios || [];
      setResultados(lista.map((e,i) => {
        const res = (a.resultados||[]).find(r => r.nome === e.nome || r.id === e.id) || {};
        return { ...e, id:i, resultado:res.resultado||"", conforme:res.conforme!=null?res.conforme:null, obs:res.obs||"", tipo:e.tipo||"numero", casas:e.casas!==undefined?e.casas:2, multiplos:e.multiplos||false };
      }));
    } else {
      // Material não encontrado (ex.: excluído): material sintético para o salvar funcionar.
      setMatSel({ id:a.materialId, nome:a.materialNome, tipo:a.materialTipo });
      setResultados((a.resultados||[]).map((r,i)=>({ ...r, id:i })));
    }
    const _q = parseQtd(a.qtdRecebida);
    setForm({ fornecedor:a.fornecedor||"", lote:a.lote||"", qtdRecebidaValor: a.qtdRecebidaValor || _q.valor, qtdRecebidaUnidade: a.qtdRecebidaUnidade || _q.unidade, qtdRecebida:a.qtdRecebida||"", nf:a.nf||"", dataRecebimento:a.dataRecebimento||tod(), dataAnalise:a.dataAnalise||tod(), resp:a.resp||user.name, obs:a.obs||"" });
    setCoa(a.coa||null);
    setSelAnalise({ ...a, _editando: true });
    setView("nova");
    toast_("Editando análise — salve para registrar as alterações.", "green");
  };

  const aprovarDisposicaoAnalise = async (a) => {
    try {
    if (a.aprovacaoDisposicao) return;
    if (config?.aprovadorDiferenteAnalista && mesmoAnalista(a, user)) {
      toast_("A configuração exige que o aprovador seja diferente do analista que executou.", "red");
      return;
    }
    const aprov = montarAprovacaoDisposicao(user, a.conclusao);
    const atualizada = { ...a, aprovacaoDisposicao: aprov };
    await saveCollection("cq_analises", String(a.id), atualizada);
    await auditLog("Aprovou disposição CQ", "cq_analises", String(a.id), `${a.num} — ${a.materialNome}`, null, { conclusao: aprov.conclusao, aprovadoPor: aprov.nome });
    setSelAnalise(atualizada);
    toast_("Disposição aprovada!", "green");
    } catch(e) {
      toast_(e.message, "red");
      console.error(e);
    }
  };

  const delAnalise = async (id) => {
    try {
    if(!confirm("Excluir esta análise?")) return;
    const antesA = analises.find(a => String(a.id) === String(id));
    await deleteFromCollection("cq_analises", String(id));
    await auditLog("Excluiu Análise CQ", "cq_analises", String(id), antesA?.num || String(id), antesA, null);
    setSelAnalise(null); toast_("Análise excluída.", "red");
    } catch(e) {
      toast_(e.message, "red");
      console.error(e);
    }
  };

  const exportRA = (a) => {
    const concColor = a.conclusao==="Aprovado"?"#1a7a3c":a.conclusao==="Reprovado"?"#cc2244":"#8a6000";
    const win = window.open("","_blank");
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/>
<title>${a.num} — Herbamed®</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#1a1a1a;}
  .page{width:210mm;padding:14mm;margin:0 auto;}
  .header{display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;border-bottom:3px solid #1a7a3c;margin-bottom:16px;}
  .logo{font-family:Georgia,serif;font-size:20px;font-weight:700;color:#1a7a3c;}
  .section{margin-bottom:16px;}
  .stitle{font-size:10px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #e0e0e0;padding-bottom:4px;margin-bottom:8px;}
  .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;}
  .field{background:#f8f9fa;border:1px solid #e8e8e8;border-radius:5px;padding:7px 9px;}
  .flabel{font-size:9px;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:2px;}
  table{width:100%;border-collapse:collapse;font-size:11px;}
  th{background:#f0f4f0;color:#333;font-weight:700;padding:7px 8px;text-align:left;border:1px solid #ddd;}
  td{padding:6px 8px;border:1px solid #eee;vertical-align:middle;}
  .conf{color:#1a7a3c;font-weight:700;} .nconf{color:#cc2244;font-weight:700;} .pend{color:#888;}
  .conclusao{padding:14px;border-radius:8px;text-align:center;font-size:16px;font-weight:800;background:${concColor}15;border:2px solid ${concColor};color:${concColor};margin:16px 0;}
  .footer{margin-top:20px;padding-top:10px;border-top:2px solid #1a7a3c;display:flex;justify-content:space-between;font-size:10px;color:#666;}
  @media print{body{background:#fff!important;}}
</style></head><body><div class="page">
<div style="background:#1a4a2e;padding:20px 24px;display:flex;justify-content:space-between;align-items:center;">
  <div style="display:flex;align-items:center;gap:12px;">
    <img src="${window.location.origin}/logo.png" style="width:44px;height:44px;border-radius:6px;object-fit:cover;"/>
    <div>
      <div style="color:#fff;font-size:14px;font-weight:bold;">Herbamed Laboratório Nutracêutico LTDA</div>
      <div style="color:#9fd4b2;font-size:10px;">CNPJ: 14.829.598/0001-30</div>
    </div>
  </div>
  <div style="text-align:right;">
    <div style="color:#fff;font-size:13px;font-weight:bold;">Relatório de Análise</div>
    <div style="color:#9fd4b2;font-size:11px;">N° ${a.num} · ${fmt(a.dataAnalise)}</div>
  </div>
</div>
<div class="section">
  <div class="stitle">Identificação</div>
  <div class="grid3">
    <div class="field"><div class="flabel">Material</div><div>${a.materialNome}</div></div>
    <div class="field"><div class="flabel">Tipo</div><div>${a.materialTipo}</div></div>
    <div class="field"><div class="flabel">Fornecedor</div><div>${a.fornecedor||"—"}</div></div>
    <div class="field"><div class="flabel">Lote</div><div>${a.lote||"—"}</div></div>
    <div class="field"><div class="flabel">Qtd. Recebida</div><div>${a.qtdRecebida||"—"}</div></div>
    <div class="field"><div class="flabel">Nota Fiscal</div><div>${a.nf||"—"}</div></div>
    <div class="field"><div class="flabel">Data Recebimento</div><div>${fmt(a.dataRecebimento)}</div></div>
    <div class="field"><div class="flabel">Data Análise</div><div>${fmt(a.dataAnalise)}</div></div>
    <div class="field"><div class="flabel">Analista</div><div>${a.resp || user?.name || ""}</div></div>
  </div>
</div>
<div class="section">
  <div class="stitle">Resultados das Análises</div>
  <table>
    <thead><tr><th>Ensaio</th><th>Especificação</th><th>Resultado</th><th>Unidade</th><th>Referência</th><th>Situação</th></tr></thead>
    <tbody>
      ${(a.resultados||[]).map(r=>`<tr>
        <td><strong>${r.nome}</strong></td>
        <td>${r.espec||"—"}</td>
        <td>${r.resultado||"—"}</td>
        <td>${r.unidade||"—"}</td>
        <td>${r.ref||"—"}</td>
        <td>${r.conforme===true?'<span class="conf">✓ Conforme</span>':r.conforme===false?'<span class="nconf">✗ N.C.</span>':'<span class="pend">—</span>'}</td>
      </tr>`).join("")}
    </tbody>
  </table>
</div>
${a.obs?`<div class="section"><div class="stitle">Observações</div><p>${a.obs}</p></div>`:""}
<div class="conclusao">${a.conclusao==="Aprovado"?"✅ APROVADO":a.conclusao==="Reprovado"?"❌ REPROVADO":"⏳ PENDENTE"}</div>
${a.coa?`<div class="section"><div class="stitle">COA do Fornecedor</div><p>Laudo: <a href="${a.coa.url}" target="_blank">${a.coa.name}</a></p></div>`:""}
<div style="display:flex;gap:40px;margin-top:24px;padding-top:12px;border-top:1px solid #ccc;">
  <div style="flex:1;">
    ${seloAssHTML({ nome: a.resp || user?.name || "", cargo: a.respCargo || user?.cargo || "", registroProfissional: a.respRegistro || user?.crf || "", email: user?.email || "", userId: user?.uid || user?.id || "", data: a.dataAnalise }, "Responsável pela análise", "#2d5016", `ANALISE|${a.num||a.id||""}`)}
  </div>
  <div style="flex:1;">
    ${a.aprovacaoDisposicao ? seloAssHTML({ nome: a.aprovacaoDisposicao.nome, cargo: a.aprovacaoDisposicao.cargo, registroProfissional: a.aprovacaoDisposicao.registro, timestamp: a.aprovacaoDisposicao.timestamp }, "Aprovou a disposição", "#1a5fb4", `ANALISE-DISP|${a.num||a.id||""}`) : `<div style="padding:10px 12px;border:1px dashed #ddd;border-radius:8px;background:#fafafa;text-align:center;"><div style="font-size:9px;color:#888;text-transform:uppercase;">Aprovou a disposição</div><div style="font-size:11px;color:#ccc;padding:8px 0;">Aguardando aprovação</div></div>`}
  </div>
  <div style="flex:1;text-align:center;"><div style="border-top:1px solid #333;padding-top:6px;margin-top:30px;font-size:11px;">______________________<br/>Gerente de Qualidade</div></div>
</div>
<div style="padding:10px 24px;background:#f5f5f5;border-top:1px solid #eee;display:flex;justify-content:space-between;font-size:10px;color:#888;">
  <span>Herbamed Laboratório Nutracêutico LTDA · CNPJ: 14.829.598/0001-30</span>
  <span>Av Irene Meneghetti Longhini, 500 · Assis/SP - Brasil · CEP: 19816-370</span>
</div>
</div><script>window.onload=()=>window.print();</script></body></html>`;
    win.document.write(html); win.document.close();
  };

  const analiseFiltradas = analises.filter(a=>{
    const textoOk = !filtroTexto || (a.materialNome||"").toLowerCase().includes(filtroTexto.toLowerCase()) || (a.num||"").toLowerCase().includes(filtroTexto.toLowerCase()) || (a.lote||"").toLowerCase().includes(filtroTexto.toLowerCase());
    const concOk = filtroConc==="Todos" || a.conclusao===filtroConc;
    return textoOk && concOk;
  });
  const { paginated: analisePg, page: pgAn, total: totAn, setPage: setPgAn } = usePagination(analiseFiltradas, 15);

  if(loading) return <div style={{ textAlign:"center", padding:"3rem", color:T.text2 }}>Carregando...</div>;

  // ── NOVA ANÁLISE ──
  if(view==="nova") return (
    <div>
      <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:"1rem" }}>
        <button style={s.btn} onClick={()=>{ setView("lista"); setSelAnalise(null); }}>← Voltar</button>
        <div style={{ fontSize:15, fontWeight:700, color:T.text }}>Nova Ficha de Análise</div>
      </div>

      {/* Seleção do material */}
      <div style={s.card}>
        <SecTitle icon="📦" ch="Selecionar material" />
        {materiais.length===0 ? (
          <div style={{ color:T.text3, fontSize:13, padding:"1rem", textAlign:"center" }}>
            Nenhum material cadastrado. Cadastre um material em <strong>CQ — Materiais</strong> primeiro.
          </div>
        ) : ((() => {
          const termo = buscaMat.trim();
          const matFiltrados = materiais
            .filter(m => filtroTipo==="Todos" || materialBucket(m)===filtroTipo)
            .filter(m => matchesMaterialSearch(m, termo));
          return (
            <>
              <div style={{ position:"relative", marginBottom:12 }}>
                <Inp
                  value={buscaMat}
                  onChange={e=>setBuscaMat(e.target.value)}
                  placeholder={`🔍 Buscar entre ${materiais.length} materiais (digite parte do nome)...`}
                  sx={{ width:"100%", paddingRight:buscaMat?34:12 }}
                />
                {buscaMat && (
                  <button onClick={()=>setBuscaMat("")} title="Limpar" style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"transparent", border:"none", color:T.text3, fontSize:16, cursor:"pointer", lineHeight:1 }}>×</button>
                )}
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:12 }}>
                {CQ_TIPO_FILTROS.map(t=>(
                  <button key={t.id} onClick={()=>setFiltroTipo(t.id)} style={{ padding:"4px 12px", fontSize:11, fontWeight:600, borderRadius:20, border:`1px solid ${filtroTipo===t.id?T.accent:T.border}`, background:filtroTipo===t.id?T.accentDim:"transparent", color:filtroTipo===t.id?T.accent:T.text2, cursor:"pointer", transition:"all .15s" }}>{t.label}</button>
                ))}
              </div>
              {termo && <div style={{ fontSize:11, color:T.text3, marginBottom:8 }}>{matFiltrados.length} resultado{matFiltrados.length!==1?"s":""} para "{buscaMat}"</div>}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
                {matFiltrados.map(m=>(
                  <div key={m.id} onClick={()=>selecionarMaterial(m)} style={{ padding:"12px", background: matSel?.id===m.id?T.accentDim:T.surf, border:`1px solid ${matSel?.id===m.id?T.accent+"55":T.border}`, borderRadius:10, cursor:"pointer", transition:"all .15s" }}>
                    <div style={{ fontSize:13, fontWeight:600, color:matSel?.id===m.id?T.accent:T.text }}>{m.nome}</div>
                    <div style={{ fontSize:11, color:T.text2, marginTop:2 }}>{m.tipo}</div>
                    <div style={{ fontSize:10, color:T.text3, marginTop:2 }}>{m.ensaios?.length||0} ensaios</div>
                  </div>
                ))}
                {matFiltrados.length===0 && <div style={{ gridColumn:"1/-1", textAlign:"center", color:T.text3, fontSize:13, padding:"1rem" }}>{termo ? `Nenhum material encontrado para "${buscaMat}".` : "Nenhum material nesta categoria."}</div>}
              </div>
            </>
          );
        })())}
      </div>

      {matSel && <>
        {/* Dados do recebimento */}
        <div style={s.card}>
          <SecTitle icon="🚚" ch="Dados do recebimento" />
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
            <F lbl="Fornecedor" ch={
              <Sel value={form.fornecedor} onChange={e=>setF("fornecedor",e.target.value)}>
                <option value="">Selecionar...</option>
                {fornecedores.filter(x=>x.status==="Ativo").map(f=><option key={f.id} value={f.nome}>{f.nome}</option>)}
                <option value="Outro">Outro</option>
              </Sel>
            }/>
            <F lbl="Nº do lote" ch={<Inp placeholder="Ex: LOT-2026-001" value={form.lote} onChange={e=>setF("lote",e.target.value)} />} />
            <F lbl="Qtd. recebida" ch={
              <div style={{ display:"flex", gap:6 }}>
                <Inp type="number" step="any" min="0" placeholder="Ex: 25" sx={{ flex:2 }} value={form.qtdRecebidaValor} onChange={e=>setF("qtdRecebidaValor",e.target.value)} />
                <Sel sx={{ flex:1, minWidth:80 }} value={form.qtdRecebidaUnidade} onChange={e=>setF("qtdRecebidaUnidade",e.target.value)}>
                  {UNIDADES_RECEBIMENTO.map(u => <option key={u} value={u}>{u}</option>)}
                </Sel>
              </div>
            } />
            <F lbl="Nota Fiscal" ch={<Inp placeholder="Ex: NF 12345" value={form.nf} onChange={e=>setF("nf",e.target.value)} />} />
            <F lbl="Data recebimento" ch={<Inp type="date" value={form.dataRecebimento} onChange={e=>setF("dataRecebimento",e.target.value)} />} />
            <F lbl="Data análise" ch={<Inp type="date" value={form.dataAnalise} onChange={e=>setF("dataAnalise",e.target.value)} />} />
            <F lbl="Analista" ch={<div style={{ fontSize:13, color:T.text2, padding:"8px 0", fontWeight:500 }}>{user?.name || "—"}{user?.cargo ? ` — ${user.cargo}` : ""}</div>} />
          </div>
        </div>

        {/* Resultados */}
        <div style={s.card}>
          <SecTitle icon="🔬" ch={`Resultados — ${matSel.nome}`} />
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead><tr style={{ background:T.surf }}>
                {["Ensaio","Especificação","Resultado (livre)","Un.","Referência","Conforme?","Obs."].map(h=>(
                  <th key={h} style={{ padding:"8px 10px", fontSize:10, fontWeight:700, color:T.text3, textTransform:"uppercase", textAlign:"left", borderBottom:`1px solid ${T.border}`, whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {resultados.map((r,i)=>(
                  <tr key={r.id} style={{ background:i%2===0?T.card:T.surf, borderLeft: r.conforme===false?"3px solid #ff4f6a":r.conforme===true?"3px solid #2ab84a":"3px solid transparent" }}>
                    <td style={{ padding:"8px 10px", fontSize:12, fontWeight:600, color:T.text, whiteSpace:"nowrap" }}>{r.nome}</td>
                    <td style={{ padding:"8px 10px", fontSize:11, color:T.text2 }}>{r.espec||"—"}</td>
                    <td style={{ padding:"8px 8px" }}>
                      {r.tipo==="conforme" ? (
                        <div style={{ display:"flex", gap:4 }}>
                          <button onClick={()=>updRes(r.id,"conforme",true)} style={{ flex:1, padding:"5px", borderRadius:6, border:`1px solid ${r.conforme===true?"#2ab84a55":T.border}`, background:r.conforme===true?"#2ab84a22":"transparent", color:r.conforme===true?"#2ab84a":T.text2, cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:600 }}>✓ Conf.</button>
                          <button onClick={()=>updRes(r.id,"conforme",false)} style={{ flex:1, padding:"5px", borderRadius:6, border:`1px solid ${r.conforme===false?"#ff4f6a55":T.border}`, background:r.conforme===false?"#ff4f6a22":"transparent", color:r.conforme===false?"#ff4f6a":T.text2, cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:600 }}>✗ N.C.</button>
                        </div>
                      ) : r.tipo==="texto" ? (
                        <Inp placeholder="Resultado..." value={r.resultado} onChange={e=>updRes(r.id,"resultado",e.target.value)} sx={{ padding:"5px 8px", fontSize:12, width:110 }}/>
                      ) : (
                        <div>
                          <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                            <Inp
                              placeholder={`0,${"0".repeat(r.casas||2)}`}
                              value={r.resultado}
                              onChange={e=>updRes(r.id,"resultado",e.target.value)}
                              onBlur={e=>{ if(e.target.value) updRes(r.id,"resultado",fmtNum(e.target.value,r.casas||2)); }}
                              sx={{ padding:"5px 8px", fontSize:12, width:80 }}
                            />
                            {r.multiplos && (
                              <button onClick={()=>toggleMultiplos(r.id)}
                                title="Lançar múltiplos valores"
                                style={{ padding:"4px 7px", borderRadius:6, border:`1px solid ${multiplosState[r.id]?.aberto?T.accent:T.border}`, background:multiplosState[r.id]?.aberto?T.accentDim:"transparent", color:multiplosState[r.id]?.aberto?T.accent:T.text3, cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:700 }}>
                                Σ
                              </button>
                            )}
                          </div>
                          {r.multiplos && multiplosState[r.id]?.aberto && (
                            <div style={{ marginTop:6, padding:"8px", background:T.card, border:`1px solid ${T.accent}33`, borderRadius:8 }}>
                              <div style={{ fontSize:10, color:T.accent, fontWeight:700, textTransform:"uppercase", marginBottom:6 }}>Múltiplos valores — média automática</div>
                              <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:6 }}>
                                {(multiplosState[r.id]?.valores||["","","","",""]).map((v,vi)=>(
                                  <Inp key={vi} type="number" placeholder={`#${vi+1}`} value={v}
                                    onChange={ev=>updValorMultiplo(r.id,vi,ev.target.value)}
                                    sx={{ width:56, padding:"4px 6px", fontSize:11 }}/>
                                ))}
                                <button onClick={()=>setMultiplosState(p=>({...p,[r.id]:{...p[r.id],valores:[...(p[r.id]?.valores||[]),""]}}))
                                } style={{ padding:"4px 8px", borderRadius:6, border:`1px solid ${T.border}`, background:"transparent", color:T.text3, cursor:"pointer", fontFamily:"inherit", fontSize:11 }}>+</button>
                              </div>
                              {(() => {
                                const vals = multiplosState[r.id]?.valores||[];
                                const nums = vals.map(v=>parseFloat(String(v).replace(",","."))).filter(n=>!isNaN(n));
                                if (!nums.length) return null;
                                const media = nums.reduce((a,b)=>a+b,0)/nums.length;
                                const dp = Math.sqrt(nums.reduce((s,v)=>s+Math.pow(v-media,2),0)/nums.length);
                                return (
                                  <div style={{ fontSize:11, color:T.text2, marginBottom:6 }}>
                                    <span style={{ fontWeight:700, color:T.accent }}>Média: {media.toFixed(r.casas||2).replace(".",",")} {r.unidade}</span>
                                    {nums.length>1 && <span style={{ color:T.text3, marginLeft:8 }}>DP: ±{dp.toFixed(r.casas||2).replace(".",",")}</span>}
                                    <span style={{ color:T.text3, marginLeft:8 }}>n={nums.length}</span>
                                  </div>
                                );
                              })()}
                              <button onClick={()=>aplicarMedia(r.id,r.casas||2)}
                                style={{ ...s.btnA, fontSize:11, padding:"4px 12px" }}>
                                ✓ Aplicar média
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={{ padding:"8px 8px", fontSize:11, color:T.text3 }}>{r.unidade||"—"}</td>
                    <td style={{ padding:"8px 8px", fontSize:11, color:T.text3 }}>{r.ref||"—"}</td>
                    <td style={{ padding:"8px 8px" }}>
                      <div style={{ display:"flex", gap:4 }}>
                        <button onClick={()=>updRes(r.id,"conforme",true)} style={{ padding:"4px 8px", borderRadius:6, border:`1px solid ${r.conforme===true?"#2ab84a55":T.border}`, background:r.conforme===true?"#2ab84a22":"transparent", color:r.conforme===true?"#2ab84a":T.text2, cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:600 }}>✓</button>
                        <button onClick={()=>updRes(r.id,"conforme",false)} style={{ padding:"4px 8px", borderRadius:6, border:`1px solid ${r.conforme===false?"#ff4f6a55":T.border}`, background:r.conforme===false?"#ff4f6a22":"transparent", color:r.conforme===false?"#ff4f6a":T.text2, cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:600 }}>✗</button>
                        <button onClick={()=>updRes(r.id,"conforme",null)} style={{ padding:"4px 6px", borderRadius:6, border:`1px solid ${T.border}`, background:"transparent", color:T.text3, cursor:"pointer", fontFamily:"inherit", fontSize:10 }}>—</button>
                      </div>
                    </td>
                    <td style={{ padding:"8px 8px" }}>
                      <Inp placeholder="obs..." value={r.obs||""} onChange={e=>updRes(r.id,"obs",e.target.value)} sx={{ fontSize:11, padding:"4px 6px", width:90 }}/>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Indicador de NCs */}
          {getNCs().length > 0 && (
            <div style={{ marginTop:"1rem", padding:"10px 14px", background:"#ff4f6a18", border:"1px solid #ff4f6a33", borderRadius:8, fontSize:12, color:"#ff4f6a", fontWeight:600 }}>
              ⚠️ {getNCs().length} ensaio(s) marcado(s) como NÃO CONFORME — será solicitada confirmação ao salvar
            </div>
          )}
        </div>

        {/* COA */}
        <div style={s.card}>
          <SecTitle icon="📄" ch="COA do fornecedor" />
          {coa ? (
            <div style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", background:T.surf, border:`1px solid ${T.border}`, borderRadius:8 }}>
              <span style={{ fontSize:24 }}>📄</span>
              <div style={{ flex:1 }}><div style={{ fontSize:13, fontWeight:600 }}>{coa.name}</div></div>
              <button onClick={()=>openCOA(coa)} style={{ ...s.btn, fontSize:11, color:T.accent }}>Ver COA</button>
              <button style={s.btnD} onClick={()=>setCoa(null)}>✕</button>
            </div>
          ) : (
            <div style={{ border:`2px dashed ${T.border2}`, borderRadius:10, padding:"1.5rem", textAlign:"center", cursor:"pointer" }} onClick={()=>document.getElementById("coa-up").click()}>
              <div style={{ fontSize:28, marginBottom:6 }}>📎</div>
              <div style={{ fontSize:13, color:T.text2 }}>{coaUploading?"Enviando...":"Clique para anexar o COA (PDF ou imagem)"}</div>
              <input id="coa-up" type="file" accept=".pdf,image/*" style={{ display:"none" }} onChange={e=>uploadCOA(e.target.files[0])} />
            </div>
          )}
        </div>

        <F lbl="Observações gerais" ch={<TA rows={2} value={form.obs} onChange={e=>setF("obs",e.target.value)} placeholder="Observações sobre o recebimento ou análise..." />} />

        <div style={{ display:"flex", gap:10, justifyContent:"flex-end", paddingBottom:"1rem", marginTop:"1rem" }}>
          <button style={s.btn} onClick={()=>{ setView("lista"); setSelAnalise(null); }}>Cancelar</button>
          <button style={s.btnA} onClick={salvar}>💾 Salvar análise →</button>
        </div>
      </>}
    </div>
  );

  // ── LISTA ──
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
        <div style={{ fontSize:13, color:T.text2 }}>{analiseFiltradas.length} de {analises.length} análise(s)</div>
        <button style={s.btnA} onClick={()=>{ setMatSel(null); setSelAnalise(null); setFiltroTipo("Todos"); setForm({ fornecedor:"", lote:"", qtdRecebidaValor:"", qtdRecebidaUnidade:"kg", qtdRecebida:"", nf:"", dataRecebimento:tod(), dataAnalise:tod(), resp:user.name, obs:"" }); setResultados([]); setCoa(null); setView("nova"); }}>+ Nova Análise</button>
      </div>

      {/* Filtros */}
      <div style={{ display:"flex", gap:10, marginBottom:"1rem", flexWrap:"wrap" }}>
        <input value={filtroTexto} onChange={e=>{ setFiltroTexto(e.target.value); setPgAn(1); }} placeholder="Buscar por material, RA ou lote..." style={{ flex:1, minWidth:200, padding:"7px 12px", fontSize:13, borderRadius:8, border:`1px solid ${T.border}`, background:T.surf, color:T.text, outline:"none" }} />
        {["Todos","Aprovado","Reprovado","Pendente"].map(c=>(
          <button key={c} onClick={()=>{ setFiltroConc(c); setPgAn(1); }} style={{ padding:"6px 14px", fontSize:12, fontWeight:600, borderRadius:20, border:`1px solid ${filtroConc===c?T.accent:T.border}`, background:filtroConc===c?T.accentDim:"transparent", color:filtroConc===c?T.accent:T.text2, cursor:"pointer", transition:"all .15s" }}>{c}</button>
        ))}
      </div>

      {analises.length===0 ? (
        <div style={{ ...s.card, textAlign:"center", padding:"3rem" }}>
          <div style={{ fontSize:40, marginBottom:"1rem", opacity:.3 }}>📋</div>
          <div style={{ fontSize:14, color:T.text2 }}>Nenhuma análise registrada</div>
        </div>
      ) : analiseFiltradas.length===0 ? (
        <div style={{ ...s.card, textAlign:"center", padding:"2rem" }}>
          <div style={{ fontSize:13, color:T.text2 }}>Nenhuma análise encontrada com os filtros aplicados.</div>
        </div>
      ) : (
        <>
        <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr style={{ background:T.surf }}>
              {["Nº RA","Material","Fornecedor","Lote","Data","Analista","Conclusão",""].map(h=>(
                <th key={h} style={{ padding:"10px 12px", fontSize:10, fontWeight:700, color:T.text3, textTransform:"uppercase", textAlign:"left", borderBottom:`1px solid ${T.border}`, whiteSpace:"nowrap" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {analisePg.map((a,i)=>{
                const cc = a.conclusao;
                const c = cc==="Aprovado"?"#2ab84a":cc==="Reprovado"?"#ff4f6a":"#ffd166";
                return (
                  <tr key={a.id} style={{ background:i%2===0?T.card:T.surf, cursor:"pointer" }} onClick={()=>setSelAnalise(a)}>
                    <td style={{ padding:"10px 12px", fontSize:12, fontWeight:700, color:T.accent }}>{a.num}</td>
                    <td style={{ padding:"10px 12px", fontSize:13, color:T.text }}>{a.materialNome}</td>
                    <td style={{ padding:"10px 12px", fontSize:12, color:T.text2 }}>{a.fornecedor||"—"}</td>
                    <td style={{ padding:"10px 12px", fontSize:12, color:T.text2 }}>{a.lote||"—"}</td>
                    <td style={{ padding:"10px 12px", fontSize:12, color:T.text2 }}>{fmt(a.dataAnalise)}</td>
                    <td style={{ padding:"10px 12px", fontSize:12, color:T.text2 }}>{a.resp}</td>
                    <td style={{ padding:"10px 12px" }}>
                      <span style={{ fontSize:11, fontWeight:700, color:c, background:`${c}18`, padding:"3px 10px", borderRadius:20 }}>
                        {cc==="Aprovado"?"✅ Aprovado":cc==="Reprovado"?"❌ Reprovado":"⏳ Pendente"}
                      </span>
                    </td>
                    <td style={{ padding:"10px 8px" }}>
                      <button style={{ ...s.btn, padding:"4px 8px", fontSize:11, color:"#ff8c42", borderColor:"#ff8c4233", background:"#ff8c4212" }} onClick={e=>{e.stopPropagation();exportRA(a);}}><span className="btn-emoji">📄 </span>PDF</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={pgAn} total={totAn} setPage={setPgAn} />
        </>
      )}

      {/* Modal detalhe */}
      {selAnalise && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.82)", backdropFilter:"blur(6px)", zIndex:999, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }} onClick={e=>e.target===e.currentTarget&&setSelAnalise(null)}>
          <div style={{ background:T.card2, border:`1px solid ${T.border2}`, borderRadius:18, padding:"1.75rem", maxWidth:760, width:"100%", maxHeight:"90vh", overflowY:"auto", boxShadow:"0 32px 80px #000a" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"1rem" }}>
              <div>
                <div style={{ fontSize:20, fontWeight:700 }}>{selAnalise.num} — {selAnalise.materialNome}</div>
                <div style={{ fontSize:12, color:T.text2, marginTop:2 }}>{selAnalise.fornecedor||"—"} · Lote: {selAnalise.lote||"—"} · {fmt(selAnalise.dataAnalise)} · {selAnalise.resp}</div>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button style={{ ...s.btn, fontSize:11, color:T.accent, borderColor:T.accent+"33", background:T.accentDim }} onClick={()=>editarAnalise(selAnalise)}><span className="btn-emoji">✏️ </span>Editar</button>
                <button style={{ ...s.btn, fontSize:11, color:"#ff8c42", borderColor:"#ff8c4233", background:"#ff8c4212" }} onClick={()=>exportRA(selAnalise)}><span className="btn-emoji">📄 </span>PDF</button>
                <button style={{ ...s.btnA, fontSize:11 }} onClick={()=>{ setTab("laudos"); setTimeout(()=>{ window._laudoPreFill = { produto:selAnalise.materialNome||"", lote:selAnalise.lote||"", tipo:"materia_prima", ensaios:(selAnalise.resultados||[]).map(r=>({ label:r.nome||r.ensaio||"", unidade:r.unidade||"", especificacao:r.especificacao||"", resultado:r.resultado||"", conforme:r.conforme, obs:r.obs||"" })) }; }, 300); }}><span className="btn-emoji">📋 </span>Gerar Laudo</button>
                <button style={s.btnD} onClick={()=>delAnalise(selAnalise.id)}>🗑️</button>
                <button onClick={()=>setSelAnalise(null)} style={{ background:T.border, border:"none", color:T.text2, cursor:"pointer", borderRadius:8, padding:"6px 10px", fontSize:16, fontFamily:"inherit" }}>✕</button>
              </div>
            </div>
            <div style={{ overflowX:"auto", marginBottom:"1rem" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead><tr style={{ background:T.surf }}>
                  {["Ensaio","Especificação","Resultado","Un.","Situação","Obs."].map(h=>(
                    <th key={h} style={{ padding:"7px 10px", fontSize:10, fontWeight:700, color:T.text3, textTransform:"uppercase", textAlign:"left", borderBottom:`1px solid ${T.border}` }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {(selAnalise.resultados||[]).map((r,i)=>(
                    <tr key={i} style={{ background:i%2===0?T.card:T.surf, borderLeft:r.conforme===false?"3px solid #ff4f6a":r.conforme===true?"3px solid #2ab84a":"3px solid transparent" }}>
                      <td style={{ padding:"7px 10px", fontSize:12, fontWeight:600 }}>{r.nome}</td>
                      <td style={{ padding:"7px 10px", fontSize:11, color:T.text2 }}>{r.espec||"—"}</td>
                      <td style={{ padding:"7px 10px", fontSize:12, fontWeight:500 }}>{r.resultado||"—"}</td>
                      <td style={{ padding:"7px 10px", fontSize:11, color:T.text3 }}>{r.unidade||"—"}</td>
                      <td style={{ padding:"7px 10px" }}>
                        {r.conforme===true?<span style={{ color:"#2ab84a", fontWeight:700 }}>✓ Conf.</span>:r.conforme===false?<span style={{ color:"#ff4f6a", fontWeight:700 }}>✗ N.C.</span>:<span style={{ color:T.text3 }}>—</span>}
                      </td>
                      <td style={{ padding:"7px 10px", fontSize:11, color:T.text2 }}>{r.obs||"—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginBottom:"1rem", padding:"10px 14px", background:T.surf, borderRadius:8, display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
              <span style={{ fontSize:20 }}>📄</span>
              {selAnalise.coa ? (<>
                <span style={{ fontSize:13, color:T.text, flex:1 }}>COA: {selAnalise.coa.name}</span>
                <button onClick={()=>openCOA(selAnalise.coa)} style={{ ...s.btn, fontSize:11, color:T.accent }}>Ver COA</button>
                <button onClick={()=>document.getElementById("coa-reattach-analise").click()} style={{ ...s.btn, fontSize:11 }}><span className="btn-emoji">🔄 </span>Trocar</button>
                <button onClick={async()=>{ if(!confirm("Remover COA desta análise?")) return; await saveCollection("cq_analises", String(selAnalise.id), {...selAnalise, coa:null}); setSelAnalise({...selAnalise, coa:null}); toast_("COA removido.","red"); }} style={{ ...s.btnD, fontSize:11 }}><span className="btn-emoji">🗑️ </span>Excluir</button>
              </>) : (<>
                <span style={{ fontSize:13, color:T.text3, flex:1 }}>Nenhum COA anexado</span>
                <button onClick={()=>document.getElementById("coa-reattach-analise").click()} style={{ ...s.btnA, fontSize:11 }}><span className="btn-emoji">📎 </span>Anexar COA</button>
              </>)}
              <input id="coa-reattach-analise" type="file" accept=".pdf,image/*" style={{ display:"none" }} onChange={async e=>{ const file=e.target.files[0]; if(!file) return; toast_("Enviando COA...","blue"); try { const r=await uploadStoredFile(file); await saveCollection("cq_analises", String(selAnalise.id), {...selAnalise, coa:r}); setSelAnalise({...selAnalise, coa:r}); toast_("COA atualizado!","green"); } catch { toast_("Erro ao enviar COA.","red"); } }} />
            </div>
            {selAnalise.obs && <div style={{ marginBottom:"1rem", padding:"10px 14px", background:T.surf, borderRadius:8, fontSize:12, color:T.text2 }}><b>Obs:</b> {selAnalise.obs}</div>}
            {selAnalise.historicoEdicoes?.length > 0 && (
              <div style={{ marginBottom:"1rem", padding:"10px 14px", background:T.surf, border:`1px solid ${T.border}`, borderRadius:8 }}>
                <div style={{ fontSize:10, color:T.accent, fontWeight:700, textTransform:"uppercase", marginBottom:6 }}>Histórico de edições</div>
                {selAnalise.historicoEdicoes.map((h,i) => (
                  <div key={i} style={{ fontSize:11, color:T.text2, padding:"3px 0", borderBottom:i<selAnalise.historicoEdicoes.length-1?`1px solid ${T.border}`:"none" }}>
                    ✏️ {h.dataHora} — editado por <strong>{h.editor}</strong>
                  </div>
                ))}
              </div>
            )}
            <div style={{ padding:"12px 16px", borderRadius:10, fontSize:14, fontWeight:700, textAlign:"center", background:selAnalise.conclusao==="Aprovado"?"#2ab84a18":"#ff4f6a18", color:selAnalise.conclusao==="Aprovado"?"#2ab84a":"#ff4f6a" }}>
              {selAnalise.conclusao==="Aprovado"?"✅ APROVADO":"❌ REPROVADO"}
            </div>
            <DisposicaoSecao T={T} s={s} registro={selAnalise} onAprovar={()=>aprovarDisposicaoAnalise(selAnalise)} />
          </div>
        </div>
      )}
    </div>
  );
}

export function CQDashboardTab() {
  const T = useTheme(); const s = useS();
  const [analises, setAnalises] = useState([]);
  const [materiais, setMateriais] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodoMeses, setPeriodoMeses] = useState(6);

  useEffect(()=>{
    const u1 = subscribeCollection("cq_analises", list=>{ setAnalises(list); setLoading(false); });
    const u2 = subscribeCollection("cq_materiais", list=>{ setMateriais(list); });
    const t = setTimeout(()=>setLoading(false), 3000);
    return ()=>{ u1(); u2(); clearTimeout(t); };
  },[]);

  if(loading) return <div style={{ textAlign:"center", padding:"3rem", color:T.text2 }}>Carregando...</div>;

  // Filtrar por período
  const dataCorte = new Date();
  dataCorte.setMonth(dataCorte.getMonth() - periodoMeses);
  const cortStr = dataCorte.toISOString().split("T")[0];
  const filtered = analises.filter(a => (a.dataAnalise||a.criadoEm||"") >= cortStr);

  // Stats gerais
  const total = filtered.length;
  const aprovadas = filtered.filter(x=>x.conclusao==="Aprovado").length;
  const reprovadas = filtered.filter(x=>x.conclusao==="Reprovado").length;
  const pendentes = filtered.filter(x=>x.conclusao==="Pendente").length;
  const taxaAprov = total>0 ? Math.round(aprovadas/total*100) : 0;

  // Por material
  const porMaterial = {};
  filtered.forEach(a=>{
    const k = a.materialNome||"Desconhecido";
    if(!porMaterial[k]) porMaterial[k] = { total:0, aprovadas:0, reprovadas:0 };
    porMaterial[k].total++;
    if(a.conclusao==="Aprovado") porMaterial[k].aprovadas++;
    if(a.conclusao==="Reprovado") porMaterial[k].reprovadas++;
  });

  // Por fornecedor
  const porFornecedor = {};
  filtered.forEach(a=>{
    const k = a.fornecedor||"Não informado";
    if(!porFornecedor[k]) porFornecedor[k] = { total:0, aprovadas:0, reprovadas:0 };
    porFornecedor[k].total++;
    if(a.conclusao==="Aprovado") porFornecedor[k].aprovadas++;
    if(a.conclusao==="Reprovado") porFornecedor[k].reprovadas++;
  });

  // Evolução mensal
  const meses = [];
  for(let i=periodoMeses-1; i>=0; i--){
    const d = new Date(); d.setMonth(d.getMonth()-i);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    const label = d.toLocaleDateString("pt-BR",{month:"short",year:"2-digit"});
    const ms = filtered.filter(a=>(a.dataAnalise||"").startsWith(key));
    meses.push({ key, label, total:ms.length, aprov:ms.filter(x=>x.conclusao==="Aprovado").length, reprov:ms.filter(x=>x.conclusao==="Reprovado").length });
  }
  const maxMes = Math.max(...meses.map(m=>m.total), 1);

  return (
    <div>
      {/* Filtro de período */}
      <div style={{ display:"flex", gap:8, marginBottom:"1rem" }}>
        {[3,6,12].map(m=>(
          <button key={m} onClick={()=>setPeriodoMeses(m)} style={{ padding:"6px 16px", borderRadius:20, border:`1px solid ${periodoMeses===m?T.accent+"55":T.border}`, background:periodoMeses===m?T.accentDim:T.surf, color:periodoMeses===m?T.accent:T.text2, cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:periodoMeses===m?600:400 }}>
            Últimos {m} meses
          </button>
        ))}
        <div style={{ marginLeft:"auto", fontSize:12, color:T.text3, alignSelf:"center" }}>{total} análise(s) no período</div>
      </div>

      {/* KPI cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:"1.5rem" }}>
        {[
          { l:"Total de análises",  n:total,      c:T.accent,  icon:"📋", sub:"No período selecionado" },
          { l:"Taxa de aprovação",  n:`${taxaAprov}%`, c:taxaAprov>=80?T.accent:"#ff8c42", icon:"✅", sub:`${aprovadas} aprovadas` },
          { l:"Reprovadas",         n:reprovadas, c:reprovadas>0?"#ff4f6a":T.text3, icon:"❌", sub:"Requerem ação" },
          { l:"Pendentes",          n:pendentes,  c:"#ffd166", icon:"⏳", sub:"Análise incompleta" },
        ].map(({l,n,c,icon,sub})=>(
          <div key={l} style={{ background:T.card, border:`1px solid ${c}22`, borderRadius:14, padding:"1.1rem", position:"relative", overflow:"hidden", boxShadow:`0 0 16px ${c}10` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
              <span style={{ fontSize:22, opacity:.5 }}>{icon}</span>
            </div>
            <div style={{ fontSize:28, fontWeight:800, color:c, lineHeight:1, marginBottom:4 }}>{n}</div>
            <div style={{ fontSize:11, fontWeight:700, color:T.text, marginBottom:2 }}>{l}</div>
            <div style={{ fontSize:10, color:T.text3 }}>{sub}</div>
            <div style={{ position:"absolute", bottom:-12, right:-12, width:55, height:55, borderRadius:"50%", background:c, opacity:.06 }}/>
          </div>
        ))}
      </div>

      {/* Evolução mensal */}
      <div style={{ ...s.card, marginBottom:"1.5rem" }}>
        <SecTitle icon="📈" ch="Evolução mensal de análises" />
        <div style={{ display:"flex", alignItems:"flex-end", gap:8, height:120, paddingTop:8 }}>
          {meses.map((m,i)=>(
            <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
              <div style={{ fontSize:9, color:T.text3, marginBottom:2 }}>{m.total>0?m.total:""}</div>
              <div style={{ width:"100%", display:"flex", flexDirection:"column", justifyContent:"flex-end", height:90, gap:1 }}>
                {m.reprov>0 && <div style={{ width:"100%", height:`${Math.round(m.reprov/maxMes*85)}px`, background:"#ff4f6a", borderRadius:"3px 3px 0 0", minHeight:3 }}/>}
                {m.aprov>0  && <div style={{ width:"100%", height:`${Math.round(m.aprov/maxMes*85)}px`,  background:T.accent,   borderRadius: m.reprov>0?"0":"3px 3px 0 0", minHeight:3 }}/>}
                {m.total===0 && <div style={{ width:"100%", height:3, background:T.border, borderRadius:3 }}/>}
              </div>
              <div style={{ fontSize:9, color:T.text3, textAlign:"center", whiteSpace:"nowrap" }}>{m.label}</div>
            </div>
          ))}
        </div>
        <div style={{ display:"flex", gap:16, marginTop:8 }}>
          {[[T.accent,"Aprovadas"],["#ff4f6a","Reprovadas"]].map(([c,l])=>(
            <div key={l} style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:T.text2 }}>
              <span style={{ width:10, height:10, borderRadius:2, background:c, display:"inline-block" }}/>
              {l}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.5rem" }}>
        {/* Por material */}
        <div style={s.card}>
          <SecTitle icon="📦" ch="Índice de aprovação por material" />
          {Object.keys(porMaterial).length===0 ? (
            <div style={{ color:T.text3, fontSize:13, textAlign:"center", padding:"1.5rem" }}>Sem dados no período.</div>
          ) : Object.entries(porMaterial).sort((a,b)=>b[1].total-a[1].total).map(([mat,d])=>{
            const taxa = Math.round(d.aprovadas/d.total*100);
            const c = taxa>=80?T.accent:taxa>=50?"#ff8c42":"#ff4f6a";
            return (
              <div key={mat} style={{ marginBottom:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                  <span style={{ fontSize:12, color:T.text, fontWeight:500 }}>{mat}</span>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <span style={{ fontSize:10, color:T.text3 }}>{d.total} análise(s)</span>
                    <span style={{ fontSize:13, fontWeight:700, color:c }}>{taxa}%</span>
                  </div>
                </div>
                <div style={{ height:7, background:T.surf, borderRadius:4, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${taxa}%`, background:c, borderRadius:4, transition:"width .6s" }}/>
                </div>
                {d.reprovadas>0 && <div style={{ fontSize:10, color:"#ff4f6a", marginTop:3 }}>⚠ {d.reprovadas} reprovada(s)</div>}
              </div>
            );
          })}
        </div>

        {/* Por fornecedor */}
        <div style={s.card}>
          <SecTitle icon="🏭" ch="Índice de aprovação por fornecedor" />
          {Object.keys(porFornecedor).length===0 ? (
            <div style={{ color:T.text3, fontSize:13, textAlign:"center", padding:"1.5rem" }}>Sem dados no período.</div>
          ) : Object.entries(porFornecedor).sort((a,b)=>b[1].total-a[1].total).map(([forn,d])=>{
            const taxa = Math.round(d.aprovadas/d.total*100);
            const c = taxa>=80?T.accent:taxa>=50?"#ff8c42":"#ff4f6a";
            return (
              <div key={forn} style={{ marginBottom:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                  <span style={{ fontSize:12, color:T.text, fontWeight:500 }}>{forn}</span>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <span style={{ fontSize:10, color:T.text3 }}>{d.total} análise(s)</span>
                    <span style={{ fontSize:13, fontWeight:700, color:c }}>{taxa}%</span>
                  </div>
                </div>
                <div style={{ height:7, background:T.surf, borderRadius:4, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${taxa}%`, background:c, borderRadius:4, transition:"width .6s" }}/>
                </div>
                {d.reprovadas>0 && <div style={{ fontSize:10, color:"#ff4f6a", marginTop:3 }}>⚠ {d.reprovadas} reprovada(s)</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Últimas análises reprovadas */}
      {reprovadas > 0 && (
        <div style={{ ...s.card, marginTop:"1.5rem" }}>
          <SecTitle icon="❌" ch="Análises reprovadas no período" />
          {filtered.filter(x=>x.conclusao==="Reprovado").sort((a,b)=>(b.criadoTs||0)-(a.criadoTs||0)).map(a=>(
            <div key={a.id} style={{ background:"#ff4f6a0a", border:"1px solid #ff4f6a22", borderRadius:10, padding:"10px 14px", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <span style={{ fontSize:11, fontWeight:700, color:T.accent }}>{a.num}</span>
                  <span style={{ fontSize:12, fontWeight:600, color:T.text }}>{a.materialNome}</span>
                </div>
                <span style={{ fontSize:11, color:T.text3 }}>{fmt(a.dataAnalise)}</span>
              </div>
              <div style={{ fontSize:12, color:T.text2 }}>
                Fornecedor: {a.fornecedor||"—"} · Lote: {a.lote||"—"} · Analista: {a.resp}
              </div>
              {a.resultados?.filter(r=>r.conforme===false).length>0 && (
                <div style={{ marginTop:6, fontSize:11, color:"#ff4f6a" }}>
                  Ensaios NC: {a.resultados.filter(r=>r.conforme===false).map(r=>r.nome).join(", ")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

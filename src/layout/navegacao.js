// Estrutura de navegação do sistema — fonte única.
//
// Antes isto morava dentro do `SidebarNav`, o que impedia qualquer outra casca de
// navegação de existir sem duplicar a lista de telas. Com a repaginação (abas no
// topo) passam a existir DUAS cascas lendo a mesma estrutura: se um dia entrar uma
// tela nova, ela aparece nas duas sem ninguém lembrar de mexer em dois lugares.
//
// O `id` de cada folha é o valor de `tab` no App — não inventar id novo aqui.

/**
 * Os grupos do menu, já filtrados pelo perfil de quem está logado.
 * Mesma lista que a barra lateral sempre teve, sem alteração de conteúdo.
 */
export function montarGrupos({ rncs = [], desvios = [], isViewer = false, isAdmin = false, perm = () => true } = {}) {
  const grupos = [
    { id:"principal", icon:"📋", label:"RNCs", items:[
      { id:"lista", icon:"📋", label:"Registros", badge: rncs.filter(x=>x.status==="Aberta").length },
      ...(!isViewer?[{ id:"nova", icon:"➕", label:"Nova RNC" }]:[]),
      { id:"reunioes", icon:"🗓️", label:"Reuniões" },
    ]},
    { id:"desvios-grupo", icon:"⚠️", label:"Desvios", items:[
      { id:"desvios", icon:"📋", label:"Registros de Desvio", badge: desvios.filter(x=>x.status==="Registrado").length },
      ...(!isViewer?[{ id:"novo-desvio", icon:"➕", label:"Novo Desvio" }]:[]),
      { id:"indicadores-desvios", icon:"📊", label:"Indicadores" },
    ]},
    ...(!isViewer?[{ id:"qualidade", icon:"🔬", label:"Ferramentas da Qualidade", items:[
      { id:"ishikawa", icon:"🐟", label:"Ishikawa / 5 Porquês" },
      { id:"5w2h",     icon:"📋", label:"CAPA" },
      { id:"eficacia", icon:"✅", label:"Eficácia" },
      { id:"fmea",     icon:"⚠️", label:"FMEA" },
    ]}]:[]),
    { id:"cq", icon:"🧪", label:"Controle de Qualidade", items:[
      { id:"recebimentos-areco", icon:"IN", label:"Recebimentos Areco" },
      { id:"cq-materiais", icon:"🧪", label:"Entrada de Materiais" },
      { id:"cq-analises",  icon:"📋", label:"Análises" },
      { id:"cq-dashboard", icon:"📈", label:"Dashboard CQ" },
      { id:"nqa",          icon:"📐", label:"NQA / AQL" },
      { id:"revalidacao-sub", icon:"🔁", label:"Revalidações", subItems:[
        { id:"revalidacao", icon:"📋", label:"Registros" },
        ...(!isViewer?[{ id:"nova-revalidacao", icon:"➕", label:"Nova Revalidação" }]:[]),
      ]},
    ]},
    { id:"producao", icon:"🏗️", label:"Produção", items:[
      { id:"producao-processos", icon:"🏗️", label:"Controle de Processos" },
      { id:"ipc",                icon:"🏭", label:"Controle de Processo IPC" },
      { id:"ipc-produtos",       icon:"📦", label:"Produtos IPC" },
    ]},
    { id:"analise", icon:"📊", label:"Indicadores", items:[
      { id:"dashboard",  icon:"📊", label:"Dashboard" },
      { id:"cep",        icon:"📉", label:"CEP" },
      { id:"relatorios", icon:"📑", label:"Relatórios" },
    ]},
    { id:"cadastros", icon:"🏢", label:"Cadastros", items:[
      { id:"fornecedores", icon:"🏭", label:"Fornecedores" },
      ...(perm("verHomologacoes") ? [{ id:"homologacoes", icon:"✅", label:"Homologações" }] : []),
      { id:"clientes",     icon:"🏢", label:"Clientes Terceiros" },
      { id:"laudos",       icon:"📋", label:"Laudos Analíticos" },
    ]},
    { id:"gestao", icon:"🗂️", label:"Documentos & Gestão", items:[
      { id:"gestao-docs",  icon:"🗂️", label:"Gestão de Docs" },
      { id:"auditorias",   icon:"🔍", label:"Auditorias" },
      ...(isAdmin?[{ id:"audit-log", icon:"🛡️", label:"Trilha de Auditoria" }]:[]),
      ...(isAdmin?[{ id:"admin",     icon:"⚙️", label:"Administração" }]:[]),
    ]},
  ];
  // Laudos depende de permissão própria — a barra lateral já filtrava assim.
  return grupos.map(g => ({ ...g, items: g.items.filter(i => i.id !== "laudos" || perm("verLaudos")) }));
}

/**
 * Como os grupos se distribuem nas abas do topo.
 *
 * São 8 grupos e ~28 telas; abas simples não comportam isso, então cada aba tem
 * uma segunda linha com as telas do(s) grupo(s) dela. As Ferramentas da Qualidade
 * (Ishikawa, CAPA, Eficácia, FMEA) entram na aba RNCs por serem usadas a partir
 * dela — sem essa junção seriam 9 abas, que não cabem.
 */
export const ABAS_TOPO = [
  { id:"inicio",      label:"Início",      grupos:[],                        home:true },
  { id:"rncs",        label:"RNCs",        grupos:["principal","qualidade"] },
  { id:"desvios",     label:"Desvios",     grupos:["desvios-grupo"] },
  { id:"qualidade",   label:"Qualidade",   grupos:["cq"] },
  { id:"producao",    label:"Produção",    grupos:["producao"] },
  { id:"documentos",  label:"Documentos",  grupos:["gestao"] },
  { id:"indicadores", label:"Indicadores", grupos:["analise"] },
  { id:"cadastros",   label:"Cadastros",   grupos:["cadastros"] },
];

/**
 * Achata um grupo em telas navegáveis. Subgrupo de 3º nível não existe em barra de
 * abas: "Revalidações › Registros" vira só "Revalidações", e os demais subitens
 * mantêm o próprio rótulo, que já é autoexplicativo ("Nova Revalidação").
 */
export function telasDoGrupo(grupo) {
  const out = [];
  for (const item of grupo?.items || []) {
    if (!item.subItems) { out.push(item); continue; }
    for (const si of item.subItems) {
      out.push({ ...si, label: si.label === "Registros" ? item.label : si.label });
    }
  }
  return out;
}

/** As abas do topo já resolvidas: rótulo, telas e badge somado. */
export function montarAbas(grupos = []) {
  const porId = new Map(grupos.map(g => [g.id, g]));
  return ABAS_TOPO
    .map(aba => {
      const telas = aba.grupos.flatMap(gid => {
        const g = porId.get(gid);
        return g ? telasDoGrupo(g) : [];
      });
      return { ...aba, telas, badge: telas.reduce((s, t) => s + (t.badge || 0), 0) };
    })
    // Aba sem nenhuma tela não aparece — é o caso do viewer, que não vê
    // Ferramentas da Qualidade nem várias telas de cadastro.
    .filter(aba => aba.home || aba.telas.length > 0);
}

/** Em que aba mora a tela aberta. `home` (e telas fora do menu) caem em Início. */
export function abaDaTela(abas = [], tab) {
  const achou = abas.find(a => a.telas.some(t => t.id === tab));
  return achou?.id || "inicio";
}

/** Lista achatada para a busca "ir para" — inclui o caminho, para desambiguar. */
export function telasParaBusca(grupos = []) {
  const out = [];
  for (const aba of montarAbas(grupos)) {
    for (const tela of aba.telas) out.push({ id: tela.id, label: tela.label, icon: tela.icon, caminho: aba.label });
  }
  return out;
}

const semAcento = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Busca por trecho, sem acento e sem caso. Vazio devolve tudo. */
export function buscarTelas(telas = [], termo = "") {
  const q = semAcento(termo);
  if (!q) return telas;
  return telas.filter(t => semAcento(t.label).includes(q) || semAcento(t.caminho).includes(q));
}

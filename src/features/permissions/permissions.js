import { MATRIZ_TREINAMENTO_ATIVA } from "../../config/funcionalidades";

export const PERMS_GRUPOS = [
  { grupo: "RNCs", items: [
    { key: "criarRNC",           label: "Criar nova RNC" },
    { key: "editarRNCpropria",   label: "Editar RNC própria" },
    { key: "editarRNCtodas",     label: "Editar qualquer RNC" },
    { key: "analisarRNC",        label: "Tratar RNC: análise de causa, CAPA, eficácia e disposição" },
    { key: "aprovarRNC",         label: "Aprovar como RT (RNC crítica)" },
    { key: "excluirRNC",         label: "Excluir RNC" },
    { key: "gerenciarReunioesRNC", label: "Conduzir reunião de análise crítica" },
  ]},
  { grupo: "Desvios", items: [
    { key: "verDesvios",   label: "Visualizar registros de desvio" },
    { key: "criarDesvio",  label: "Registrar novo desvio" },
    { key: "triarDesvio",  label: "Triar desvio (encerrar / converter em RNC)" },
  ]},
  { grupo: "Revalidações", items: [
    { key: "verRevalidacao",   label: "Visualizar revalidações" },
    { key: "criarRevalidacao", label: "Criar / editar revalidação" },
  ]},
  { grupo: "Homologações", items: [
    { key: "verHomologacoes",     label: "Visualizar homologações" },
    { key: "criarHomologacao",    label: "Criar / editar solicitação de homologação" },
    { key: "avaliarHomologacao",  label: "Emitir parecer técnico de homologação" },
    { key: "aprovarHomologacao",  label: "Registrar decisão final de homologação" },
  ]},
  { grupo: "Controle de Qualidade", items: [
    { key: "verCQMateriais",     label: "Visualizar CQ Materiais" },
    { key: "criarMaterialCQ",    label: "Criar / editar material CQ" },
    { key: "lancarAnalise",      label: "Lançar ficha de análise" },
    { key: "aprovarAnalise",     label: "Aprovar / reprovar análise" },
    { key: "editarAnalise",      label: "Editar análise aprovada" },
    { key: "verLaudos",          label: "Visualizar laudos" },
    { key: "criarLaudos",        label: "Criar / assinar laudos" },
  ]},
  { grupo: "Gestão de Documentos", items: [
    { key: "criarDocumento",              label: "Criar / editar documento" },
    { key: "assinarElaborador",           label: "Assinar como Elaborador" },
    { key: "assinarRevisorAprovador",     label: "Assinar como Revisor / Aprovador" },
    { key: "excluirDocumento",            label: "Excluir documento" },
    { key: "registrarTreinamento",        label: "Registrar treinamento" },
    { key: "verDocumentos",               label: "Visualizar área de documentos" },
    { key: "iniciarRevisao",              label: "Iniciar nova revisão" },
    { key: "tornarObsoleto",              label: "Arquivar documento como obsoleto" },
    { key: "configurarDocumentos",        label: "Baixar PDF original (sem marca d'água) de documento controlado" },
    { key: "baixarArquivoFonte",          label: "Baixar arquivo fonte editável" },
    { key: "baixarCopiaNaoControlada",    label: "Baixar cópia não controlada" },
    { key: "gerenciarTreinamento",        label: "Ver log de distribuição de cópias" },
    { key: "acessoRestritoVigente",       label: "Acesso restrito: somente documento vigente / cópia não controlada" },
  ]},
  { grupo: "Outras áreas", items: [
    { key: "editarFornecedores",  label: "Criar / editar Fornecedores" },
    { key: "criarAuditorias",     label: "Criar / editar Auditorias" },
    { key: "editarClientes",      label: "Criar / editar Clientes terceiros" },
    { key: "editarIPC",           label: "Lançar IPC — Controle de processo" },
    { key: "editarIPCProdutos",   label: "Gerenciar catálogo IPC Produtos" },
  ]},
];

// Permissões que hoje NÃO controlam nada no sistema: marcar ou desmarcar não muda o
// que a pessoa consegue fazer. Ficam fora da tela do Admin para não dar falsa
// segurança (o admin desmarcava "Criar / editar Fornecedores" e a pessoa seguia
// editando). As chaves continuam em PERMS_PADRAO e no cadastro de cada usuário —
// nada é apagado. Ao ligar uma delas de verdade (na tela E no servidor), tire-a daqui.
export const PERMS_SEM_EFEITO = new Set([
  "editarRNCpropria", "editarRNCtodas", "aprovarRNC",
  "editarFornecedores", "criarAuditorias", "editarClientes", "editarIPC", "editarIPCProdutos",
  // Só tem efeito na Matriz de Treinamento, que está desligada.
  ...(MATRIZ_TREINAMENTO_ATIVA ? [] : ["registrarTreinamento"]),
]);

/** Grupos de permissões que aparecem no Admin: só as que têm efeito; grupo vazio some. */
export function gruposVisiveis(grupos = PERMS_GRUPOS) {
  return grupos
    .map(g => ({ ...g, items: g.items.filter(i => !PERMS_SEM_EFEITO.has(i.key)) }))
    .filter(g => g.items.length > 0);
}

// Resolve uma permissão para um usuário arbitrário (não só o logado).
// Mesma lógica do `perm` do App: usa overrides salvos no usuário, senão cai no papel.
export function userHasPerm(u, key) {
  if (!u) return false;
  if (u.ativo === false) return false; // conta desativada não entra em lista de designação
  if (u.permissoes && key in u.permissoes) return !!u.permissoes[key];
  const role = u.role;
  return PERMS_PADRAO[role] ? !!(PERMS_PADRAO[role][key]) : false;
}

export const PERMS_PADRAO = {
  viewer: {
    criarRNC:false, editarRNCpropria:false, editarRNCtodas:false, analisarRNC:false, aprovarRNC:false, excluirRNC:false, gerenciarReunioesRNC:false,
    verDesvios:true, criarDesvio:false, triarDesvio:false,
    verRevalidacao:true, criarRevalidacao:false,
    verHomologacoes:true, criarHomologacao:false, avaliarHomologacao:false, aprovarHomologacao:false,
    verCQMateriais:true, criarMaterialCQ:false, lancarAnalise:false, aprovarAnalise:false, editarAnalise:false, verLaudos:true, criarLaudos:false,
    criarDocumento:false, assinarElaborador:false, assinarRevisorAprovador:false, excluirDocumento:false, registrarTreinamento:false,
    verDocumentos:true, iniciarRevisao:false, tornarObsoleto:false, configurarDocumentos:false, baixarArquivoFonte:false, baixarCopiaNaoControlada:true, gerenciarTreinamento:false, acessoRestritoVigente:true,
    editarFornecedores:false, criarAuditorias:false, editarClientes:false, editarIPC:false, editarIPCProdutos:false,
  },
  user: {
    criarRNC:true, editarRNCpropria:true, editarRNCtodas:false, analisarRNC:true, aprovarRNC:false, excluirRNC:false, gerenciarReunioesRNC:false,
    verDesvios:true, criarDesvio:true, triarDesvio:false,
    verRevalidacao:true, criarRevalidacao:true,
    verHomologacoes:true, criarHomologacao:true, avaliarHomologacao:false, aprovarHomologacao:false,
    verCQMateriais:true, criarMaterialCQ:false, lancarAnalise:true, aprovarAnalise:false, editarAnalise:false, verLaudos:false, criarLaudos:false,
    criarDocumento:true, assinarElaborador:true, assinarRevisorAprovador:false, excluirDocumento:false, registrarTreinamento:false,
    verDocumentos:true, iniciarRevisao:false, tornarObsoleto:false, configurarDocumentos:false, baixarArquivoFonte:false, baixarCopiaNaoControlada:false, gerenciarTreinamento:false, acessoRestritoVigente:false,
    editarFornecedores:false, criarAuditorias:false, editarClientes:false, editarIPC:true, editarIPCProdutos:false,
  },
  rt: {
    criarRNC:true, editarRNCpropria:true, editarRNCtodas:true, analisarRNC:true, aprovarRNC:true, excluirRNC:true, gerenciarReunioesRNC:true,
    verDesvios:true, criarDesvio:true, triarDesvio:true,
    verRevalidacao:true, criarRevalidacao:true,
    verHomologacoes:true, criarHomologacao:true, avaliarHomologacao:true, aprovarHomologacao:true,
    verCQMateriais:true, criarMaterialCQ:true, lancarAnalise:true, aprovarAnalise:true, editarAnalise:true, verLaudos:true, criarLaudos:true,
    criarDocumento:true, assinarElaborador:true, assinarRevisorAprovador:true, excluirDocumento:false, registrarTreinamento:true,
    verDocumentos:true, iniciarRevisao:true, tornarObsoleto:false, configurarDocumentos:true, baixarArquivoFonte:true, baixarCopiaNaoControlada:true, gerenciarTreinamento:false, acessoRestritoVigente:false,
    editarFornecedores:true, criarAuditorias:true, editarClientes:true, editarIPC:true, editarIPCProdutos:false,
  },
  keyuser: {
    criarRNC:true, editarRNCpropria:true, editarRNCtodas:true, analisarRNC:true, aprovarRNC:true, excluirRNC:true, gerenciarReunioesRNC:true,
    verDesvios:true, criarDesvio:true, triarDesvio:true,
    verRevalidacao:true, criarRevalidacao:true,
    verHomologacoes:true, criarHomologacao:true, avaliarHomologacao:true, aprovarHomologacao:true,
    verCQMateriais:true, criarMaterialCQ:true, lancarAnalise:true, aprovarAnalise:true, editarAnalise:true, verLaudos:true, criarLaudos:true,
    criarDocumento:true, assinarElaborador:true, assinarRevisorAprovador:true, excluirDocumento:true, registrarTreinamento:true,
    verDocumentos:true, iniciarRevisao:true, tornarObsoleto:true, configurarDocumentos:true, baixarArquivoFonte:true, baixarCopiaNaoControlada:true, gerenciarTreinamento:false, acessoRestritoVigente:false,
    editarFornecedores:true, criarAuditorias:true, editarClientes:true, editarIPC:true, editarIPCProdutos:true,
  },
  admin: {
    criarRNC:true, editarRNCpropria:true, editarRNCtodas:true, analisarRNC:true, aprovarRNC:true, excluirRNC:true, gerenciarReunioesRNC:true,
    verDesvios:true, criarDesvio:true, triarDesvio:true,
    verRevalidacao:true, criarRevalidacao:true,
    verHomologacoes:true, criarHomologacao:true, avaliarHomologacao:true, aprovarHomologacao:true,
    verCQMateriais:true, criarMaterialCQ:true, lancarAnalise:true, aprovarAnalise:true, editarAnalise:true, verLaudos:true, criarLaudos:true,
    criarDocumento:true, assinarElaborador:true, assinarRevisorAprovador:true, excluirDocumento:true, registrarTreinamento:true,
    verDocumentos:true, iniciarRevisao:true, tornarObsoleto:true, configurarDocumentos:true, baixarArquivoFonte:true, baixarCopiaNaoControlada:true, gerenciarTreinamento:true, acessoRestritoVigente:false,
    editarFornecedores:true, criarAuditorias:true, editarClientes:true, editarIPC:true, editarIPCProdutos:true,
  },
  exec: {
    criarRNC:false, editarRNCpropria:false, editarRNCtodas:false, analisarRNC:false, aprovarRNC:false, excluirRNC:false, gerenciarReunioesRNC:false,
    verDesvios:true, criarDesvio:false, triarDesvio:false,
    verRevalidacao:true, criarRevalidacao:false,
    verHomologacoes:false, criarHomologacao:false, avaliarHomologacao:false, aprovarHomologacao:false,
    verCQMateriais:false, criarMaterialCQ:false, lancarAnalise:false, aprovarAnalise:false, editarAnalise:false, verLaudos:false, criarLaudos:false,
    criarDocumento:false, assinarElaborador:false, assinarRevisorAprovador:false, excluirDocumento:false, registrarTreinamento:false,
    verDocumentos:false, iniciarRevisao:false, tornarObsoleto:false, configurarDocumentos:false, baixarArquivoFonte:false, baixarCopiaNaoControlada:false, gerenciarTreinamento:false, acessoRestritoVigente:false,
    editarFornecedores:false, criarAuditorias:false, editarClientes:false, editarIPC:false, editarIPCProdutos:false,
  },
};

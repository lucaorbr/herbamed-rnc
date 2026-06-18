export const PERMS_GRUPOS = [
  { grupo: "RNCs", items: [
    { key: "criarRNC",           label: "Criar nova RNC" },
    { key: "editarRNCpropria",   label: "Editar RNC própria" },
    { key: "editarRNCtodas",     label: "Editar qualquer RNC" },
    { key: "analisarRNC",        label: "Ishikawa / 5W2H / Eficácia" },
    { key: "aprovarRNC",         label: "Aprovar como RT (RNC crítica)" },
    { key: "excluirRNC",         label: "Excluir RNC" },
  ]},
  { grupo: "Desvios", items: [
    { key: "verDesvios",   label: "Visualizar registros de desvio" },
    { key: "criarDesvio",  label: "Registrar novo desvio" },
    { key: "triarDesvio",  label: "Triar desvio (encerrar / converter em RNC)" },
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
    { key: "configurarDocumentos",        label: "Configurar tipos e prazos de revisão" },
    { key: "baixarArquivoFonte",          label: "Baixar arquivo fonte editável" },
    { key: "baixarCopiaNaoControlada",    label: "Baixar cópia não controlada" },
    { key: "gerenciarTreinamento",        label: "Atribuir e acompanhar leitura/treinamento (Fase 7)" },
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

// Resolve uma permissão para um usuário arbitrário (não só o logado).
// Mesma lógica do `perm` do App: usa overrides salvos no usuário, senão cai no papel.
export function userHasPerm(u, key) {
  if (!u) return false;
  if (u.permissoes && key in u.permissoes) return !!u.permissoes[key];
  const role = u.role;
  return PERMS_PADRAO[role] ? !!(PERMS_PADRAO[role][key]) : false;
}

export const PERMS_PADRAO = {
  viewer: {
    criarRNC:false, editarRNCpropria:false, editarRNCtodas:false, analisarRNC:false, aprovarRNC:false, excluirRNC:false,
    verDesvios:true, criarDesvio:false, triarDesvio:false,
    verCQMateriais:true, criarMaterialCQ:false, lancarAnalise:false, aprovarAnalise:false, editarAnalise:false, verLaudos:true, criarLaudos:false,
    criarDocumento:false, assinarElaborador:false, assinarRevisorAprovador:false, excluirDocumento:false, registrarTreinamento:false,
    verDocumentos:true, iniciarRevisao:false, tornarObsoleto:false, configurarDocumentos:false, baixarArquivoFonte:false, baixarCopiaNaoControlada:true, gerenciarTreinamento:false, acessoRestritoVigente:true,
    editarFornecedores:false, criarAuditorias:false, editarClientes:false, editarIPC:false, editarIPCProdutos:false,
  },
  user: {
    criarRNC:true, editarRNCpropria:true, editarRNCtodas:false, analisarRNC:true, aprovarRNC:false, excluirRNC:false,
    verDesvios:true, criarDesvio:true, triarDesvio:false,
    verCQMateriais:true, criarMaterialCQ:false, lancarAnalise:true, aprovarAnalise:false, editarAnalise:false, verLaudos:false, criarLaudos:false,
    criarDocumento:true, assinarElaborador:true, assinarRevisorAprovador:false, excluirDocumento:false, registrarTreinamento:false,
    verDocumentos:true, iniciarRevisao:false, tornarObsoleto:false, configurarDocumentos:false, baixarArquivoFonte:false, baixarCopiaNaoControlada:false, gerenciarTreinamento:false, acessoRestritoVigente:false,
    editarFornecedores:false, criarAuditorias:false, editarClientes:false, editarIPC:true, editarIPCProdutos:false,
  },
  rt: {
    criarRNC:true, editarRNCpropria:true, editarRNCtodas:true, analisarRNC:true, aprovarRNC:true, excluirRNC:true,
    verDesvios:true, criarDesvio:true, triarDesvio:true,
    verCQMateriais:true, criarMaterialCQ:true, lancarAnalise:true, aprovarAnalise:true, editarAnalise:true, verLaudos:true, criarLaudos:true,
    criarDocumento:true, assinarElaborador:true, assinarRevisorAprovador:true, excluirDocumento:false, registrarTreinamento:true,
    verDocumentos:true, iniciarRevisao:true, tornarObsoleto:false, configurarDocumentos:true, baixarArquivoFonte:true, baixarCopiaNaoControlada:true, gerenciarTreinamento:false, acessoRestritoVigente:false,
    editarFornecedores:true, criarAuditorias:true, editarClientes:true, editarIPC:true, editarIPCProdutos:false,
  },
  keyuser: {
    criarRNC:true, editarRNCpropria:true, editarRNCtodas:true, analisarRNC:true, aprovarRNC:true, excluirRNC:true,
    verDesvios:true, criarDesvio:true, triarDesvio:true,
    verCQMateriais:true, criarMaterialCQ:true, lancarAnalise:true, aprovarAnalise:true, editarAnalise:true, verLaudos:true, criarLaudos:true,
    criarDocumento:true, assinarElaborador:true, assinarRevisorAprovador:true, excluirDocumento:true, registrarTreinamento:true,
    verDocumentos:true, iniciarRevisao:true, tornarObsoleto:true, configurarDocumentos:true, baixarArquivoFonte:true, baixarCopiaNaoControlada:true, gerenciarTreinamento:false, acessoRestritoVigente:false,
    editarFornecedores:true, criarAuditorias:true, editarClientes:true, editarIPC:true, editarIPCProdutos:true,
  },
  admin: {
    criarRNC:true, editarRNCpropria:true, editarRNCtodas:true, analisarRNC:true, aprovarRNC:true, excluirRNC:true,
    verDesvios:true, criarDesvio:true, triarDesvio:true,
    verCQMateriais:true, criarMaterialCQ:true, lancarAnalise:true, aprovarAnalise:true, editarAnalise:true, verLaudos:true, criarLaudos:true,
    criarDocumento:true, assinarElaborador:true, assinarRevisorAprovador:true, excluirDocumento:true, registrarTreinamento:true,
    verDocumentos:true, iniciarRevisao:true, tornarObsoleto:true, configurarDocumentos:true, baixarArquivoFonte:true, baixarCopiaNaoControlada:true, gerenciarTreinamento:true, acessoRestritoVigente:false,
    editarFornecedores:true, criarAuditorias:true, editarClientes:true, editarIPC:true, editarIPCProdutos:true,
  },
  exec: {
    criarRNC:false, editarRNCpropria:false, editarRNCtodas:false, analisarRNC:false, aprovarRNC:false, excluirRNC:false,
    verDesvios:true, criarDesvio:false, triarDesvio:false,
    verCQMateriais:false, criarMaterialCQ:false, lancarAnalise:false, aprovarAnalise:false, editarAnalise:false, verLaudos:false, criarLaudos:false,
    criarDocumento:false, assinarElaborador:false, assinarRevisorAprovador:false, excluirDocumento:false, registrarTreinamento:false,
    verDocumentos:false, iniciarRevisao:false, tornarObsoleto:false, configurarDocumentos:false, baixarArquivoFonte:false, baixarCopiaNaoControlada:false, gerenciarTreinamento:false, acessoRestritoVigente:false,
    editarFornecedores:false, criarAuditorias:false, editarClientes:false, editarIPC:false, editarIPCProdutos:false,
  },
};

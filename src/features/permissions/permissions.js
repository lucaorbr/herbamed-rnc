export const PERMS_GRUPOS = [
  { grupo: "RNCs", items: [
    { key: "criarRNC",           label: "Criar nova RNC" },
    { key: "editarRNCpropria",   label: "Editar RNC própria" },
    { key: "editarRNCtodas",     label: "Editar qualquer RNC" },
    { key: "analisarRNC",        label: "Ishikawa / 5W2H / Eficácia" },
    { key: "aprovarRNC",         label: "Aprovar como RT (RNC crítica)" },
    { key: "excluirRNC",         label: "Excluir RNC" },
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
    { key: "criarDocumento",          label: "Criar / editar documento" },
    { key: "assinarElaborador",       label: "Assinar como Elaborador" },
    { key: "assinarRevisorAprovador", label: "Assinar como Revisor / Aprovador" },
    { key: "excluirDocumento",        label: "Excluir documento" },
    { key: "registrarTreinamento",    label: "Registrar treinamento" },
  ]},
  { grupo: "Outras áreas", items: [
    { key: "editarFornecedores",  label: "Criar / editar Fornecedores" },
    { key: "criarAuditorias",     label: "Criar / editar Auditorias" },
    { key: "editarClientes",      label: "Criar / editar Clientes terceiros" },
    { key: "editarIPC",           label: "Lançar IPC — Controle de processo" },
    { key: "editarIPCProdutos",   label: "Gerenciar catálogo IPC Produtos" },
  ]},
];

export const PERMS_PADRAO = {
  viewer: {
    criarRNC:false, editarRNCpropria:false, editarRNCtodas:false, analisarRNC:false, aprovarRNC:false, excluirRNC:false,
    verCQMateriais:true, criarMaterialCQ:false, lancarAnalise:false, aprovarAnalise:false, editarAnalise:false, verLaudos:true, criarLaudos:false,
    criarDocumento:false, assinarElaborador:false, assinarRevisorAprovador:false, excluirDocumento:false, registrarTreinamento:false,
    editarFornecedores:false, criarAuditorias:false, editarClientes:false, editarIPC:false, editarIPCProdutos:false,
  },
  user: {
    criarRNC:true, editarRNCpropria:true, editarRNCtodas:false, analisarRNC:true, aprovarRNC:false, excluirRNC:false,
    verCQMateriais:true, criarMaterialCQ:false, lancarAnalise:true, aprovarAnalise:false, editarAnalise:false, verLaudos:false, criarLaudos:false,
    criarDocumento:true, assinarElaborador:true, assinarRevisorAprovador:false, excluirDocumento:false, registrarTreinamento:false,
    editarFornecedores:false, criarAuditorias:false, editarClientes:false, editarIPC:true, editarIPCProdutos:false,
  },
  rt: {
    criarRNC:true, editarRNCpropria:true, editarRNCtodas:true, analisarRNC:true, aprovarRNC:true, excluirRNC:true,
    verCQMateriais:true, criarMaterialCQ:true, lancarAnalise:true, aprovarAnalise:true, editarAnalise:true, verLaudos:true, criarLaudos:true,
    criarDocumento:true, assinarElaborador:true, assinarRevisorAprovador:true, excluirDocumento:false, registrarTreinamento:true,
    editarFornecedores:true, criarAuditorias:true, editarClientes:true, editarIPC:true, editarIPCProdutos:false,
  },
  keyuser: {
    criarRNC:true, editarRNCpropria:true, editarRNCtodas:true, analisarRNC:true, aprovarRNC:true, excluirRNC:true,
    verCQMateriais:true, criarMaterialCQ:true, lancarAnalise:true, aprovarAnalise:true, editarAnalise:true, verLaudos:true, criarLaudos:true,
    criarDocumento:true, assinarElaborador:true, assinarRevisorAprovador:true, excluirDocumento:true, registrarTreinamento:true,
    editarFornecedores:true, criarAuditorias:true, editarClientes:true, editarIPC:true, editarIPCProdutos:true,
  },
  admin: {
    criarRNC:true, editarRNCpropria:true, editarRNCtodas:true, analisarRNC:true, aprovarRNC:true, excluirRNC:true,
    verCQMateriais:true, criarMaterialCQ:true, lancarAnalise:true, aprovarAnalise:true, editarAnalise:true, verLaudos:true, criarLaudos:true,
    criarDocumento:true, assinarElaborador:true, assinarRevisorAprovador:true, excluirDocumento:true, registrarTreinamento:true,
    editarFornecedores:true, criarAuditorias:true, editarClientes:true, editarIPC:true, editarIPCProdutos:true,
  },
  exec: {
    criarRNC:false, editarRNCpropria:false, editarRNCtodas:false, analisarRNC:false, aprovarRNC:false, excluirRNC:false,
    verCQMateriais:false, criarMaterialCQ:false, lancarAnalise:false, aprovarAnalise:false, editarAnalise:false, verLaudos:false, criarLaudos:false,
    criarDocumento:false, assinarElaborador:false, assinarRevisorAprovador:false, excluirDocumento:false, registrarTreinamento:false,
    editarFornecedores:false, criarAuditorias:false, editarClientes:false, editarIPC:false, editarIPCProdutos:false,
  },
};

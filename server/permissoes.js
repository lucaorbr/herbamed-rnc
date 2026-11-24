// Permissões padrão por papel — CÓPIA de `PERMS_PADRAO`
// (src/features/permissions/permissions.js) para o servidor conferir.
//
// A imagem do backend só leva a pasta server/, e o arquivo da tela é ESM, então a
// tabela é duplicada aqui. O teste `src/features/permissions/permissoesServidor.test.js`
// compara as duas e falha se divergirem: mudou lá, copie para cá.
//
// Regra igual à do `perm` da tela: permissão gravada no usuário prevalece; sem ela,
// vale o padrão do papel.

const PERMS_PADRAO = {
  viewer: {
    criarRNC:false, editarRNCpropria:false, editarRNCtodas:false, analisarRNC:false, excluirRNC:false, gerenciarReunioesRNC:false,
    verDesvios:true, criarDesvio:false, triarDesvio:false,
    verRevalidacao:true, criarRevalidacao:false,
    verHomologacoes:true, criarHomologacao:false, avaliarHomologacao:false, aprovarHomologacao:false,
    verCQMateriais:true, criarMaterialCQ:false, lancarAnalise:false, aprovarAnalise:false, editarAnalise:false, verLaudos:true, criarLaudos:false,
    criarDocumento:false, assinarElaborador:false, assinarRevisorAprovador:false, excluirDocumento:false, registrarTreinamento:false,
    verDocumentos:true, iniciarRevisao:false, tornarObsoleto:false, configurarDocumentos:false, baixarArquivoFonte:false, baixarCopiaNaoControlada:true, gerenciarTreinamento:false, acessoRestritoVigente:true,
    editarFornecedores:false, criarAuditorias:false, editarClientes:false, editarIPC:false, editarIPCProdutos:false,
  },
  user: {
    criarRNC:true, editarRNCpropria:true, editarRNCtodas:false, analisarRNC:true, excluirRNC:false, gerenciarReunioesRNC:false,
    verDesvios:true, criarDesvio:true, triarDesvio:false,
    verRevalidacao:true, criarRevalidacao:true,
    verHomologacoes:true, criarHomologacao:true, avaliarHomologacao:false, aprovarHomologacao:false,
    verCQMateriais:true, criarMaterialCQ:false, lancarAnalise:true, aprovarAnalise:false, editarAnalise:false, verLaudos:false, criarLaudos:false,
    criarDocumento:true, assinarElaborador:true, assinarRevisorAprovador:false, excluirDocumento:false, registrarTreinamento:false,
    verDocumentos:true, iniciarRevisao:false, tornarObsoleto:false, configurarDocumentos:false, baixarArquivoFonte:false, baixarCopiaNaoControlada:false, gerenciarTreinamento:false, acessoRestritoVigente:false,
    editarFornecedores:false, criarAuditorias:false, editarClientes:false, editarIPC:true, editarIPCProdutos:false,
  },
  rt: {
    criarRNC:true, editarRNCpropria:true, editarRNCtodas:true, analisarRNC:true, excluirRNC:true, gerenciarReunioesRNC:true,
    verDesvios:true, criarDesvio:true, triarDesvio:true,
    verRevalidacao:true, criarRevalidacao:true,
    verHomologacoes:true, criarHomologacao:true, avaliarHomologacao:true, aprovarHomologacao:true,
    verCQMateriais:true, criarMaterialCQ:true, lancarAnalise:true, aprovarAnalise:true, editarAnalise:true, verLaudos:true, criarLaudos:true,
    criarDocumento:true, assinarElaborador:true, assinarRevisorAprovador:true, excluirDocumento:false, registrarTreinamento:true,
    verDocumentos:true, iniciarRevisao:true, tornarObsoleto:false, configurarDocumentos:true, baixarArquivoFonte:true, baixarCopiaNaoControlada:true, gerenciarTreinamento:false, acessoRestritoVigente:false,
    editarFornecedores:true, criarAuditorias:true, editarClientes:true, editarIPC:true, editarIPCProdutos:false,
  },
  keyuser: {
    criarRNC:true, editarRNCpropria:true, editarRNCtodas:true, analisarRNC:true, excluirRNC:true, gerenciarReunioesRNC:true,
    verDesvios:true, criarDesvio:true, triarDesvio:true,
    verRevalidacao:true, criarRevalidacao:true,
    verHomologacoes:true, criarHomologacao:true, avaliarHomologacao:true, aprovarHomologacao:true,
    verCQMateriais:true, criarMaterialCQ:true, lancarAnalise:true, aprovarAnalise:true, editarAnalise:true, verLaudos:true, criarLaudos:true,
    criarDocumento:true, assinarElaborador:true, assinarRevisorAprovador:true, excluirDocumento:true, registrarTreinamento:true,
    verDocumentos:true, iniciarRevisao:true, tornarObsoleto:true, configurarDocumentos:true, baixarArquivoFonte:true, baixarCopiaNaoControlada:true, gerenciarTreinamento:false, acessoRestritoVigente:false,
    editarFornecedores:true, criarAuditorias:true, editarClientes:true, editarIPC:true, editarIPCProdutos:true,
  },
  admin: {
    criarRNC:true, editarRNCpropria:true, editarRNCtodas:true, analisarRNC:true, excluirRNC:true, gerenciarReunioesRNC:true,
    verDesvios:true, criarDesvio:true, triarDesvio:true,
    verRevalidacao:true, criarRevalidacao:true,
    verHomologacoes:true, criarHomologacao:true, avaliarHomologacao:true, aprovarHomologacao:true,
    verCQMateriais:true, criarMaterialCQ:true, lancarAnalise:true, aprovarAnalise:true, editarAnalise:true, verLaudos:true, criarLaudos:true,
    criarDocumento:true, assinarElaborador:true, assinarRevisorAprovador:true, excluirDocumento:true, registrarTreinamento:true,
    verDocumentos:true, iniciarRevisao:true, tornarObsoleto:true, configurarDocumentos:true, baixarArquivoFonte:true, baixarCopiaNaoControlada:true, gerenciarTreinamento:true, acessoRestritoVigente:false,
    editarFornecedores:true, criarAuditorias:true, editarClientes:true, editarIPC:true, editarIPCProdutos:true,
  },
  exec: {
    criarRNC:false, editarRNCpropria:false, editarRNCtodas:false, analisarRNC:false, excluirRNC:false, gerenciarReunioesRNC:false,
    verDesvios:true, criarDesvio:false, triarDesvio:false,
    verRevalidacao:true, criarRevalidacao:false,
    verHomologacoes:false, criarHomologacao:false, avaliarHomologacao:false, aprovarHomologacao:false,
    verCQMateriais:false, criarMaterialCQ:false, lancarAnalise:false, aprovarAnalise:false, editarAnalise:false, verLaudos:false, criarLaudos:false,
    criarDocumento:false, assinarElaborador:false, assinarRevisorAprovador:false, excluirDocumento:false, registrarTreinamento:false,
    verDocumentos:false, iniciarRevisao:false, tornarObsoleto:false, configurarDocumentos:false, baixarArquivoFonte:false, baixarCopiaNaoControlada:false, gerenciarTreinamento:false, acessoRestritoVigente:false,
    editarFornecedores:false, criarAuditorias:false, editarClientes:false, editarIPC:false, editarIPCProdutos:false,
  },
};


function temPermissao(user, key) {
  if (!user) return false;
  if (user.permissoes && Object.prototype.hasOwnProperty.call(user.permissoes, key)) {
    return user.permissoes[key] === true;
  }
  return PERMS_PADRAO[user.role]?.[key] === true;
}

module.exports = { PERMS_PADRAO, temPermissao };

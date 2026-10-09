// Acesso ao documento controlado — regras validadas no SERVIDOR.
//
// Até a v3.20.0 quem decidia a marca d'água era a tela: o servidor carimbava o modo
// que viesse no endereço (`?modo=controlada`), então um Obsoleto ou Rascunho pedido
// direto saía como "CÓPIA CONTROLADA". As permissões `verDocumentos` e
// `baixarCopiaNaoControlada` só escondiam botão, e o PDF original — sem marca
// nenhuma — saía para qualquer usuário logado, inclusive o das revisões antigas.
//
// Agora:
//   - a marca vem do STATUS do documento; o navegador só diz se quer ver na tela
//     ou baixar;
//   - quem não tem `verDocumentos` não renderiza nada, e cópia não controlada exige
//     `baixarCopiaNaoControlada`;
//   - o PDF original de documento que já vigorou (e o de revisão antiga) só sai
//     para quem administra documentos. Rascunho segue aberto: o elaborador precisa
//     conferir o próprio arquivo, e ainda não é cópia de nada.

// Mesmos padrões de `PERMS_PADRAO` (src/features/permissions/permissions.js) para
// as chaves que o servidor confere. Permissão gravada no usuário prevalece.
const DOC_ROLE_PERMISSIONS = {
  viewer:  { verDocumentos: true,  baixarCopiaNaoControlada: true,  configurarDocumentos: false, acessoRestritoVigente: true },
  user:    { verDocumentos: true,  baixarCopiaNaoControlada: false, configurarDocumentos: false, acessoRestritoVigente: false },
  rt:      { verDocumentos: true,  baixarCopiaNaoControlada: true,  configurarDocumentos: true,  acessoRestritoVigente: false },
  keyuser: { verDocumentos: true,  baixarCopiaNaoControlada: true,  configurarDocumentos: true,  acessoRestritoVigente: false },
  admin:   { verDocumentos: true,  baixarCopiaNaoControlada: true,  configurarDocumentos: true,  acessoRestritoVigente: false },
  exec:    { verDocumentos: false, baixarCopiaNaoControlada: false, configurarDocumentos: false, acessoRestritoVigente: false },
};

function temPermissaoDoc(user, key) {
  if (user?.permissoes && Object.prototype.hasOwnProperty.call(user.permissoes, key)) {
    return user.permissoes[key] === true;
  }
  return DOC_ROLE_PERMISSIONS[user?.role]?.[key] === true;
}

function erro(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

// Status em que o documento já é (ou foi) cópia de referência.
const STATUS_PROTEGIDOS = new Set(["Vigente", "Aguardando Vigência", "Obsoleto"]);

/**
 * Modo de renderização permitido. `pedido` só escolhe entre tela (controlada) e
 * download (não controlada) quando o documento está Vigente; nos demais status a
 * marca é a do status, seja qual for o pedido.
 *
 * `revisaoAntiga`: renderização de uma versão arquivada no histórico — é sempre
 * obsoleta, mesmo que o documento atual esteja Vigente.
 */
function modoDeRenderizacao(user, doc, pedido, { revisaoAntiga = false } = {}) {
  if (!temPermissaoDoc(user, "verDocumentos")) {
    throw erro(403, "Sem permissão para ver documentos.");
  }
  const restrito = temPermissaoDoc(user, "acessoRestritoVigente");
  const status = doc?.status;

  if (restrito && (status !== "Vigente" || revisaoAntiga)) {
    throw erro(403, "Acesso restrito: somente documentos vigentes podem ser visualizados.");
  }

  let modo;
  if (revisaoAntiga || status === "Obsoleto") modo = "obsoleto";
  else if (status === "Vigente") modo = (restrito || pedido === "nao_controlada") ? "nao_controlada" : "controlada";
  else modo = "rascunho";

  if (modo === "nao_controlada" && !temPermissaoDoc(user, "baixarCopiaNaoControlada")) {
    throw erro(403, "Sem permissão para baixar cópia não controlada.");
  }
  return modo;
}

/** Id do arquivo guardado a partir de `{ url: "/api/files/<uuid>" }`. */
function idDoArquivo(ref) {
  const m = String(ref?.url || "").match(/\/api\/files\/([0-9a-f-]{36})/i);
  return m ? m[1].toLowerCase() : "";
}

/**
 * O arquivo é o PDF controlado de um documento que já vigorou, ou de uma revisão
 * arquivada? Só o PDF oficial (`arquivo`) conta — o arquivo fonte (Word/Excel) tem
 * permissão própria e segue como antes.
 */
function arquivoProtegido(fileId, docs = []) {
  const id = String(fileId || "").toLowerCase();
  if (!id) return false;
  return (docs || []).some(doc => {
    if (STATUS_PROTEGIDOS.has(doc?.status) && idDoArquivo(doc.arquivo) === id) return true;
    return (doc?.historicoRevisoes || []).some(h => idDoArquivo(h?.conteudo?.arquivo) === id);
  });
}

/** Original sem marca d'água: só quem administra documentos. */
function podeBaixarOriginal(user) {
  return user?.role === "admin" || temPermissaoDoc(user, "configurarDocumentos");
}

/**
 * Versão arquivada no histórico, pronta para renderizar: o conteúdo da época com o
 * código e a revisão daquela versão. Assinaturas não entram — o snapshot não as
 * guardou, e mostrar as da versão atual numa revisão antiga seria registro falso.
 */
function documentoDaRevisao(doc, versao) {
  const alvo = String(versao || "");
  const h = [...(doc?.historicoRevisoes || [])].reverse().find(x => String(x?.versao) === alvo);
  if (!h?.conteudo?.arquivo) return null;
  return {
    ...doc,
    ...h.conteudo,
    versao: h.versao,
    status: "Obsoleto",
    assinaturaElaborador: null,
    assinaturaRevisor: null,
    assinaturaAprovador: null,
  };
}

module.exports = {
  temPermissaoDoc,
  modoDeRenderizacao,
  arquivoProtegido,
  podeBaixarOriginal,
  documentoDaRevisao,
  idDoArquivo,
};

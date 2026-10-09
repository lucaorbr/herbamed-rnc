const test = require("node:test");
const assert = require("node:assert/strict");
const {
  modoDeRenderizacao, arquivoProtegido, podeBaixarOriginal, documentoDaRevisao,
} = require("./acessoDocumento");

const u = (role, permissoes) => ({ id: "1", role, permissoes });
const status = fn => { try { return fn(); } catch (e) { return e.status; } };
const arq = id => ({ url: `/api/files/${id}` });
const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
const C = "33333333-3333-3333-3333-333333333333";

test("a marca vem do status, não do pedido", () => {
  const rt = u("rt");
  assert.equal(modoDeRenderizacao(rt, { status: "Obsoleto" }, "controlada"), "obsoleto");
  assert.equal(modoDeRenderizacao(rt, { status: "Rascunho" }, "controlada"), "rascunho");
  assert.equal(modoDeRenderizacao(rt, { status: "Aguardando Vigência" }, "controlada"), "rascunho");
  assert.equal(modoDeRenderizacao(rt, { status: "Vigente" }, "obsoleto"), "controlada");
  assert.equal(modoDeRenderizacao(rt, { status: "Vigente" }, "nao_controlada"), "nao_controlada");
});

test("revisão antiga é sempre obsoleta", () => {
  assert.equal(modoDeRenderizacao(u("rt"), { status: "Vigente" }, "controlada", { revisaoAntiga: true }), "obsoleto");
});

test("sem verDocumentos não renderiza", () => {
  assert.equal(status(() => modoDeRenderizacao(u("exec"), { status: "Vigente" }, "controlada")), 403);
  assert.equal(status(() => modoDeRenderizacao(u("rt", { verDocumentos: false }), { status: "Vigente" }, "controlada")), 403);
});

test("cópia não controlada exige baixarCopiaNaoControlada", () => {
  assert.equal(status(() => modoDeRenderizacao(u("user"), { status: "Vigente" }, "nao_controlada")), 403);
  assert.equal(modoDeRenderizacao(u("user"), { status: "Vigente" }, "controlada"), "controlada");
  assert.equal(modoDeRenderizacao(u("user", { baixarCopiaNaoControlada: true }), { status: "Vigente" }, "nao_controlada"), "nao_controlada");
});

test("acesso restrito: só vigente e sempre não controlada (padrão do perfil viewer)", () => {
  assert.equal(modoDeRenderizacao(u("viewer"), { status: "Vigente" }, "controlada"), "nao_controlada");
  assert.equal(status(() => modoDeRenderizacao(u("viewer"), { status: "Rascunho" }, "rascunho")), 403);
  assert.equal(status(() => modoDeRenderizacao(u("viewer"), { status: "Vigente" }, "controlada", { revisaoAntiga: true })), 403);
});

test("original protegido: PDF de documento que vigorou e de revisão antiga", () => {
  const docs = [
    { status: "Vigente", arquivo: arq(A), arquivoFonte: arq(C), historicoRevisoes: [{ conteudo: { arquivo: arq(B) } }] },
  ];
  assert.equal(arquivoProtegido(A, docs), true);
  assert.equal(arquivoProtegido(B.toUpperCase(), docs), true);
  assert.equal(arquivoProtegido(C, docs), false, "arquivo fonte tem permissão própria");
});

test("rascunho não protege o original (o elaborador confere o próprio arquivo)", () => {
  assert.equal(arquivoProtegido(A, [{ status: "Rascunho", arquivo: arq(A) }]), false);
  assert.equal(arquivoProtegido(A, [{ status: "Em Revisão", arquivo: arq(A) }]), false);
  assert.equal(arquivoProtegido(A, [{ status: "Obsoleto", arquivo: arq(A) }]), true);
});

test("original só para quem administra documentos", () => {
  assert.equal(podeBaixarOriginal(u("admin")), true);
  assert.equal(podeBaixarOriginal(u("rt")), true);
  assert.equal(podeBaixarOriginal(u("user")), false);
  assert.equal(podeBaixarOriginal(u("viewer")), false);
  assert.equal(podeBaixarOriginal(u("user", { configurarDocumentos: true })), true);
});

test("documento da revisão antiga usa o conteúdo da época, sem as assinaturas atuais", () => {
  const doc = {
    codigo: "PO-SGQ-001", versao: "02", status: "Vigente", titulo: "Novo",
    assinaturaAprovador: { nome: "Atual" },
    historicoRevisoes: [
      { versao: "00", conteudo: { titulo: "Primeiro", arquivo: arq(A) } },
      { versao: "01", conteudo: { titulo: "Antigo", arquivo: arq(B) } },
    ],
  };
  const r = documentoDaRevisao(doc, "01");
  assert.equal(r.versao, "01");
  assert.equal(r.titulo, "Antigo");
  assert.equal(r.status, "Obsoleto");
  assert.equal(r.arquivo.url, `/api/files/${B}`);
  assert.equal(r.assinaturaAprovador, null);
  assert.equal(documentoDaRevisao(doc, "05"), null);
  assert.equal(documentoDaRevisao({ historicoRevisoes: [{ versao: "00", conteudo: {} }] }, "00"), null);
});

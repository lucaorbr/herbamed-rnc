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

const { identificacaoDaCopia, rodapeDaPagina, registraNoLog } = require("./acessoDocumento");
const quando = new Date("2026-10-09T12:31:00Z"); // 09:31 em Brasília

test("identificação: quem e quando, pela sessão, só em cópia de documento vigente", () => {
  assert.equal(identificacaoDaCopia("controlada", { name: "Ana Lima" }, quando), "vista por Ana Lima em 09/10/2026 09:31");
  assert.equal(identificacaoDaCopia("nao_controlada", { name: "Ana Lima" }, quando), "emitida para Ana Lima em 09/10/2026 09:31");
  assert.equal(identificacaoDaCopia("obsoleto", { name: "Ana" }, quando), "");
  assert.equal(identificacaoDaCopia("rascunho", { name: "Ana" }, quando), "");
  const longo = identificacaoDaCopia("controlada", { name: "X".repeat(60) }, quando);
  assert.ok(longo.includes(`${"X".repeat(39)}…`));
});

test("rodapé: modo + identificação + página; formulário segue só com a página", () => {
  const base = { codigo: "PO-SGQ-001", versao: "02", numPag: 1, total: 3, identificacao: "vista por Ana em 09/10/2026 09:31" };
  assert.equal(rodapeDaPagina({ ...base, modo: "controlada", wmTexto: "CÓPIA CONTROLADA" }),
    "CÓPIA CONTROLADA · vista por Ana em 09/10/2026 09:31 · PO-SGQ-001 Rev. 02 · Página 1 de 3");
  assert.equal(rodapeDaPagina({ ...base, modo: "obsoleto", wmTexto: "DOCUMENTO OBSOLETO", identificacao: "" }),
    "DOCUMENTO OBSOLETO · PO-SGQ-001 Rev. 02 · Página 1 de 3");
  assert.equal(rodapeDaPagina({ ...base, modo: "controlada", wmTexto: "CÓPIA CONTROLADA", semMarcaDagua: true }),
    "PO-SGQ-001 Rev. 02 · Página 1 de 3");
});

test("log: registra tela e download do vigente, não rascunho nem obsoleto", () => {
  assert.equal(registraNoLog("controlada"), true);
  assert.equal(registraNoLog("nao_controlada"), true);
  assert.equal(registraNoLog("obsoleto"), false);
  assert.equal(registraNoLog("rascunho"), false);
});

const { copiaParaEmitir, marcaDaCopia, identificacaoDaCopiaFisica, numeroDaCopia } = require("./acessoDocumento");

test("cópia numerada: só documento vigente e só quem distribui", () => {
  assert.equal(modoDeRenderizacao(u("rt"), { status: "Vigente" }, "copia"), "copia");
  assert.equal(modoDeRenderizacao(u("admin"), { status: "Vigente" }, "copia"), "copia");
  assert.equal(status(() => modoDeRenderizacao(u("user"), { status: "Vigente" }, "copia")), 403);
  assert.equal(status(() => modoDeRenderizacao(u("viewer"), { status: "Vigente" }, "copia")), 403);
  assert.equal(status(() => modoDeRenderizacao(u("rt"), { status: "Obsoleto" }, "copia")), 409);
  assert.equal(modoDeRenderizacao(u("user", { iniciarRevisao: true }), { status: "Vigente" }, "copia"), "copia");
});

test("cópia a emitir: entregue e numerada; recolhida ou sem número não", () => {
  const doc = { distribuicaoFisica: [{ id: "c1", numero: 3 }, { id: "c2" }] };
  assert.equal(copiaParaEmitir(doc, "c1").numero, 3);
  assert.equal(copiaParaEmitir(doc, "c2"), null);
  assert.equal(copiaParaEmitir(doc, "c9"), null);
  assert.equal(copiaParaEmitir(doc, ""), null);
});

test("marca e rodapé da cópia numerada", () => {
  const c = { numero: 3, areaId: "PRO", areaNome: "Produção", setorNome: "Encapsulamento", tipoDestino: "setor" };
  assert.equal(numeroDaCopia(c), "Nº 003");
  assert.equal(marcaDaCopia(c), "CÓPIA CONTROLADA Nº 003");
  const id = identificacaoDaCopiaFisica(c, { name: "Ana" }, quando);
  assert.equal(id, "PRO — Produção / Encapsulamento · emitida em 09/10/2026 09:31 por Ana");
  assert.equal(rodapeDaPagina({ modo: "copia", semMarcaDagua: true, wmTexto: marcaDaCopia(c), codigo: "FO-SGQ-001", versao: "00", numPag: 1, total: 1, identificacao: id }),
    `CÓPIA CONTROLADA Nº 003 · ${id} · FO-SGQ-001 Rev. 00 · Página 1 de 1`);
  assert.equal(registraNoLog("copia"), true);
});

import { prazoRevisaoTipo, TIPOS_DOC_GD, codigoSegueTipo } from "./tiposDoc";

// O prazo de revisão tinha dois campos na tela e só um deles valia. Estes testes
// fixam a precedência agora que o campo é único: `configuracoes/tipos_revisao`
// continua sendo a fonte, o catálogo cobre os tipos que não existem na semente,
// e a semente é o último recurso.

describe("prazoRevisaoTipo — precedência das fontes", () => {
  it("usa o valor de tipos_revisao acima de tudo", () => {
    const catalogo = [{ id: "PO", label: "Procedimento Operacional", prazoRevisaoAnos: 5 }];
    expect(prazoRevisaoTipo("PO", { PO: 4 }, catalogo)).toBe(4);
  });

  it("cai no catálogo quando tipos_revisao não tem o tipo", () => {
    // Este é o furo que existia: tipo criado à mão no catálogo não estava em
    // lugar nenhum que a função consultasse e virava 3 anos, ignorando o que o
    // admin digitou ao criá-lo.
    const catalogo = [{ id: "POP", label: "POP customizado", prazoRevisaoAnos: 5 }];
    expect(prazoRevisaoTipo("POP", {}, catalogo)).toBe(5);
    expect(prazoRevisaoTipo("POP", { PO: 4 }, catalogo)).toBe(5);
  });

  it("cai na semente quando nem tipos_revisao nem catálogo têm o tipo", () => {
    const semente = TIPOS_DOC_GD.find(t => t.id === "ESP");
    expect(prazoRevisaoTipo("ESP", {}, [])).toBe(semente.prazoRevisaoAnos);
  });

  it("usa 3 anos para tipo que não existe em fonte nenhuma", () => {
    expect(prazoRevisaoTipo("INEXISTENTE", {}, [])).toBe(3);
  });

  it("ignora valores inválidos e segue para a próxima fonte", () => {
    const catalogo = [{ id: "PO", label: "PO", prazoRevisaoAnos: 5 }];
    for (const invalido of [0, -1, "", null, undefined, "abc"]) {
      expect(prazoRevisaoTipo("PO", { PO: invalido }, catalogo)).toBe(5);
    }
    // Catálogo inválido também é pulado — sobra a semente.
    const semente = TIPOS_DOC_GD.find(t => t.id === "PO");
    expect(prazoRevisaoTipo("PO", {}, [{ id: "PO", prazoRevisaoAnos: 0 }])).toBe(semente.prazoRevisaoAnos);
  });

  it("aceita string numérica vinda do input", () => {
    expect(prazoRevisaoTipo("PO", { PO: "4" }, [])).toBe(4);
  });

  it("funciona sem o 3º argumento (chamadas antigas)", () => {
    const semente = TIPOS_DOC_GD.find(t => t.id === "MOP");
    expect(prazoRevisaoTipo("MOP", {})).toBe(semente.prazoRevisaoAnos);
    expect(prazoRevisaoTipo("MOP", { MOP: 1 })).toBe(1);
  });
});

describe("codigoSegueTipo — o código só acompanha o tipo em rascunho que nunca vigorou", () => {
  const rascunho = { tipo: "FO", status: "Rascunho", historicoRevisoes: [] };

  it("muda quando o rascunho troca de tipo", () => {
    expect(codigoSegueTipo(rascunho, "ANX")).toBe(true);
  });

  it("não muda quando o tipo é o mesmo", () => {
    expect(codigoSegueTipo(rascunho, "FO")).toBe(false);
  });

  it.each(["Em Revisão", "Aguardando Aprovação", "Vigente", "Obsoleto"])("não muda em %s", (status) => {
    expect(codigoSegueTipo({ ...rascunho, status }, "ANX")).toBe(false);
  });

  it("não muda em rascunho que já teve revisão anterior (recusa devolveu para Rascunho)", () => {
    expect(codigoSegueTipo({ ...rascunho, historicoRevisoes: [{ versao: "00" }] }, "ANX")).toBe(false);
  });

  it("documento novo não passa por aqui", () => {
    expect(codigoSegueTipo(null, "ANX")).toBe(false);
  });
});

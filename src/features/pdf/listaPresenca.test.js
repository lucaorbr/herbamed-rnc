import { buildListaPresencaHTML } from "./pdfExports";
import { novaSessao, definirSituacao, comAnexos, SITUACAO, STATUS_SESSAO } from "../documentos/sessoes";

// A lista de presença é o registro primário do treinamento presencial. Estes testes
// fixam as duas coisas que o PDF tem de garantir: a folha que vai para a sala TEM
// linha de assinatura de próprio punho (é o único caminho de quem não tem login), e
// a lista definitiva NÃO chama de ausente quem não foi convocado.

const doc = {
  id: "d1", codigo: "POP-PRO-002", titulo: "Operação da Encapsuladora", versao: "02", status: "Vigente",
  treinamento: { exigido: true, modo: "presencial", cargos: ["operador"], prazoDias: 30, desdeEm: "2026-01-01" },
};

const exigidos = [
  { userId: "u1", userName: "Ana Souza", cargoNome: "Operadora", setor: "Encapsulamento", temLogin: true },
  { userId: "u2", userName: "Cleber Antunes", cargoNome: "Operador", setor: "Encapsulamento", temLogin: false },
  { userId: "u3", userName: "Larissa Amorim", cargoNome: "Supervisora", setor: "Encapsulamento", temLogin: true },
];

const base = (over = {}) => {
  const s = novaSessao({
    doc, instrutor: { id: "i9", name: "Dra. Elis", cargo: "Coordenadora" },
    exigidos, num: "TRN-2026-05", hoje: "2026-08-17",
    jaTreinados: ["u2"], validadeTreino: { u2: "2027-07-03" },
  });
  return { ...s, cargaHoraria: "2", local: "Sala de treinamento", ...over };
};

describe("folha de coleta (modo coleta)", () => {
  const html = () => buildListaPresencaHTML(base(), doc, { modo: "coleta" });

  it("traz uma célula de assinatura manual por convocado", () => {
    // Duas linhas: o dispensado não vai para a sala assinar.
    expect(html().match(/class="sig-cell"/g)).toHaveLength(2);
  });

  it("traz o quadradinho de presença para marcar à mão", () => {
    expect(html().match(/class="sig-box"/g)).toHaveLength(2);
  });

  it("tem coluna de Assinatura no cabeçalho da tabela", () => {
    expect(html()).toContain("<th style=\"width:34%\">Assinatura</th>");
  });

  it("relaciona quem não foi convocado à parte, com o motivo, sem pedir assinatura", () => {
    const h = html();
    expect(h).toContain("Não convocados (1)");
    expect(h).toContain("Cleber Antunes");
    expect(h).toContain("em dia até 03/07/2027");
  });

  it("tem linha de assinatura de próprio punho do instrutor — a folha é impressa antes de assinar no sistema", () => {
    const h = html();
    expect(h).toContain("class=\"sign-line\"");
    expect(h).toContain("Dra. Elis");
  });

  it("instrui a digitalizar e anexar de volta", () => {
    expect(html()).toContain("digitalize e anexe esta folha");
  });

  it("não estampa selo de assinatura eletrônica — ninguém assinou ainda", () => {
    expect(html()).not.toContain("Instrutor do Treinamento");
  });
});

describe("lista definitiva (modo definitiva)", () => {
  const encerrada = (over = {}) => {
    const s = base({ status: STATUS_SESSAO.REALIZADA, ...over });
    return { ...s, participantes: s.participantes.map(p => (p.userId === "u1" ? definirSituacao(p, SITUACAO.PRESENTE) : p)) };
  };

  it("não chama de ausente quem não foi convocado — sai como Não aplicável, com o motivo", () => {
    const h = buildListaPresencaHTML(encerrada(), doc);
    expect(h).toContain("Não aplicável");
    expect(h).toContain("Treinamento válido, em dia até 03/07/2027");
  });

  it("conta os três estados no título da seção", () => {
    expect(buildListaPresencaHTML(encerrada(), doc))
      .toContain("1 presente(s) · 1 ausente(s) · 1 não aplicável");
  });

  it("explica que Não aplicável não é falta — é o que a inspeção lê", () => {
    expect(buildListaPresencaHTML(encerrada(), doc)).toContain("não caracteriza ausência");
  });

  it("não pede assinatura manual de novo — ela vive no anexo digitalizado", () => {
    expect(buildListaPresencaHTML(encerrada(), doc)).not.toContain("class=\"sig-cell\"");
  });

  it("cobra a folha digitalizada quando ela não foi anexada", () => {
    expect(buildListaPresencaHTML(encerrada(), doc)).toContain("ainda não foi digitalizada");
  });

  it("referencia a folha digitalizada quando existe — fecha o elo papel ↔ sistema", () => {
    const comFolha = comAnexos(encerrada(), [{ name: "TRN-2026-05.pdf", url: "/f/1" }], "Dra. Elis");
    const h = buildListaPresencaHTML(comFolha, doc);
    expect(h).toContain("TRN-2026-05.pdf");
    expect(h).toContain("Dra. Elis");
    expect(h).not.toContain("ainda não foi digitalizada");
  });

  it("mantém o selo de assinatura eletrônica do instrutor", () => {
    expect(buildListaPresencaHTML(encerrada(), doc)).toContain("Instrutor do Treinamento");
  });
});

describe("sessão gravada antes dos três estados", () => {
  it("lê o booleano antigo sem quebrar — registro assinado não se reescreve", () => {
    const antiga = {
      num: "TRN-2025-01", data: "2025-05-10", cargaHoraria: "1", versao: "01",
      docCodigo: "POP-PRO-002", status: STATUS_SESSAO.REALIZADA,
      instrutor: { nome: "Dra. Elis", cargo: "Coordenadora" },
      participantes: [
        { userId: "u1", userName: "Ana Souza", presente: true },
        { userId: "u2", userName: "Cleber Antunes", presente: false },
      ],
    };
    const h = buildListaPresencaHTML(antiga, doc);
    expect(h).toContain("1 presente(s) · 1 ausente(s) · 0 não aplicável");
    expect(h).toContain("Ana Souza");
  });
});

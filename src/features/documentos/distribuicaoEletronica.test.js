import {
  abriuEm, novaAbertura,
  comDestinatarios, evidenciaDeLeitura, leiturasPendentesDoUsuario,
  semDistribuicao, situacaoDaDistribuicao, usuariosPorSetor,
} from "./distribuicaoEletronica";
import { pendenciasDeDistribuicao, pendenciasDeLeitura } from "../home/pendencias";

const users = [
  { id: "u1", name: "Ana Souza", email: "ana@x.com", setor: "Produção" },
  { id: "u2", name: "Bruno Lima", email: "bruno@x.com", setor: "Qualidade" },
  { id: "u3", name: "Carla Dias", email: "", setor: "" },
];
const docBase = { id: 10, codigo: "POP-PRO-001", titulo: "Limpeza", versao: "01", status: "Vigente", dataVigencia: "2026-10-01" };
const comDest = (doc, ids, hoje = "2026-10-02") => comDestinatarios(doc, ids, users, { por: "Gestor GQ", hoje }).doc;

describe("distribuição eletrônica", () => {
  test("define destinatários por pessoa e informa quem entrou e saiu", () => {
    const r1 = comDestinatarios(docBase, ["u1", "u2"], users, { por: "Gestor GQ", hoje: "2026-10-02" });
    expect(r1.doc.distribuicaoEletronica.destinatarios.map(d => d.nome)).toEqual(["Ana Souza", "Bruno Lima"]);
    expect(r1.incluidos).toHaveLength(2);

    const r2 = comDestinatarios(r1.doc, ["u2", "u3"], users, { por: "Outro", hoje: "2026-10-05" });
    expect(r2.incluidos.map(d => d.userId)).toEqual(["u3"]);
    expect(r2.removidos.map(d => d.userId)).toEqual(["u1"]);
    // Quem já estava mantém quando e por quem foi incluído.
    const bruno = r2.doc.distribuicaoEletronica.destinatarios.find(d => d.userId === "u2");
    expect(bruno).toMatchObject({ incluidoEm: "2026-10-02", incluidoPor: "Gestor GQ" });
  });

  test("documento aprovado sem destinatários é pendência; rascunho não", () => {
    expect(semDistribuicao(docBase)).toBe(true);
    expect(semDistribuicao({ ...docBase, status: "Aguardando Vigência" })).toBe(true);
    expect(semDistribuicao({ ...docBase, status: "Rascunho" })).toBe(false);
    expect(semDistribuicao(comDest(docBase, ["u1"]))).toBe(false);
  });

  test("leitura confirmada vale só para a versão em que foi feita", () => {
    const doc = comDest(docBase, ["u1", "u2"]);
    const ev = evidenciaDeLeitura(doc, { uid: "u1", name: "Ana Souza" }, "2026-10-03");
    expect(ev).toMatchObject({ docId: "10", versao: "01", userId: "u1", modo: "leitura", origem: "distribuicao" });

    const sit = situacaoDaDistribuicao(doc, [ev], "2026-10-06");
    expect(sit).toMatchObject({ total: 2, confirmados: 1 });
    expect(sit.linhas.find(l => l.userId === "u2")).toMatchObject({ confirmado: false, dias: 4 });

    // Nova revisão: os mesmos destinatários voltam a ficar pendentes.
    const rev02 = { ...doc, versao: "02", dataVigencia: "2026-12-01" };
    expect(situacaoDaDistribuicao(rev02, [ev], "2026-12-03")).toMatchObject({ confirmados: 0 });
    expect(leiturasPendentesDoUsuario({ docs: [rev02], evidencias: [ev], userId: "u1", hoje: "2026-12-03" })[0].dias).toBe(2);
  });

  test("leitura pendente só aparece em documento vigente e para destinatário", () => {
    const doc = comDest(docBase, ["u1"]);
    expect(leiturasPendentesDoUsuario({ docs: [doc], evidencias: [], userId: "u1", hoje: "2026-10-04" })).toHaveLength(1);
    expect(leiturasPendentesDoUsuario({ docs: [doc], evidencias: [], userId: "u2", hoje: "2026-10-04" })).toHaveLength(0);
    const agendado = { ...doc, status: "Aguardando Vigência" };
    expect(leiturasPendentesDoUsuario({ docs: [agendado], evidencias: [], userId: "u1", hoje: "2026-10-04" })).toHaveLength(0);
  });

  test("agrupa usuários pelo setor do cadastro, com busca sem acento", () => {
    const grupos = usuariosPorSetor(users);
    expect(grupos.map(g => g.setor)).toEqual(["Produção", "Qualidade", "Sem setor informado"]);
    expect(usuariosPorSetor(users, "producao").map(g => g.setor)).toEqual(["Produção"]);
  });

  test("registra a abertura por versão e a leva para a evidência", () => {
    const doc = comDest(docBase, ["u1", "u2"]);
    const ab = novaAbertura(doc, { uid: "u1", name: "Ana Souza" }, new Date("2026-10-03T10:00:00Z"));
    expect(ab).toMatchObject({ id: "10|01|u1", docId: "10", versao: "01", userId: "u1" });
    expect(abriuEm(doc, "u1", [ab])).toBe("2026-10-03T10:00:00.000Z");
    expect(abriuEm(doc, "u2", [ab])).toBeNull();
    // Abertura da Rev.01 não libera a confirmação da Rev.02.
    expect(abriuEm({ ...doc, versao: "02" }, "u1", [ab])).toBeNull();

    const sit = situacaoDaDistribuicao(doc, [], "2026-10-04", [ab]);
    expect(sit.linhas.find(l => l.userId === "u1")).toMatchObject({ abertoEm: ab.abertoEm, confirmado: false });
    expect(sit.linhas.find(l => l.userId === "u2").abertoEm).toBeNull();

    const ev = evidenciaDeLeitura(doc, { uid: "u1", name: "Ana Souza" }, "2026-10-04", ab.abertoEm);
    expect(ev.abertoEm).toBe(ab.abertoEm);
  });

  test("vira pendência na tela inicial", () => {
    const doc = comDest(docBase, ["u1"]);
    const leituras = leiturasPendentesDoUsuario({ docs: [doc], evidencias: [], userId: "u1", hoje: "2026-10-04" });
    expect(pendenciasDeLeitura({ leiturasPendentes: leituras })[0]).toMatchObject({ minha: true, tab: "gestao-docs" });
    expect(pendenciasDeDistribuicao({ docsSemDistribuicao: [docBase] })[0].titulo).toMatch(/1 documento/);
    expect(pendenciasDeDistribuicao({ docsSemDistribuicao: [] })).toEqual([]);
  });
});

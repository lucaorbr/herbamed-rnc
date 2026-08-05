import { reabrirLeitura, treinoAtual, pendentesLeitura } from "./treinamento";

const leituraCom = (designados) => ({
  atribuido: true,
  atribuidoEm: "2026-01-10",
  atribuidoPor: "Fulano",
  designados,
});

const ctx = { novaVersao: "02", hoje: "2026-08-05", por: "Ciclana" };

describe("reabrirLeitura — nova revisão reabre a confirmação", () => {
  it("zera as confirmações de quem já tinha confirmado", () => {
    const leitura = leituraCom([
      { userId: "u1", userName: "Ana", confirmou: true,  confirmedoEm: "2026-02-01T10:00:00Z" },
      { userId: "u2", userName: "Beto", confirmou: false, confirmedoEm: null },
    ]);
    const nova = reabrirLeitura(leitura, ctx);
    expect(nova.designados.map(d => d.confirmou)).toEqual([false, false]);
    expect(nova.designados.map(d => d.confirmedoEm)).toEqual([null, null]);
  });

  it("preserva os mesmos designados e seus dados", () => {
    const leitura = leituraCom([{ userId: "u1", userName: "Ana", setor: "CQ", confirmou: true }]);
    const nova = reabrirLeitura(leitura, ctx);
    expect(nova.designados).toHaveLength(1);
    expect(nova.designados[0]).toMatchObject({ userId: "u1", userName: "Ana", setor: "CQ" });
  });

  it("carimba quem reabriu, quando e em que revisão", () => {
    const nova = reabrirLeitura(leituraCom([]), ctx);
    expect(nova.reabertoEm).toBe("2026-08-05");
    expect(nova.reabertoPor).toBe("Ciclana");
    expect(nova.reabertoNaVersao).toBe("02");
  });

  it("mantém a atribuição original (não desatribui ninguém)", () => {
    const nova = reabrirLeitura(leituraCom([]), ctx);
    expect(nova.atribuido).toBe(true);
    expect(nova.atribuidoPor).toBe("Fulano");
    expect(nova.atribuidoEm).toBe("2026-01-10");
  });

  it("não muta o objeto original — o histórico guarda a evidência da versão anterior", () => {
    const leitura = leituraCom([{ userId: "u1", confirmou: true, confirmedoEm: "2026-02-01T10:00:00Z" }]);
    reabrirLeitura(leitura, ctx);
    expect(leitura.designados[0].confirmou).toBe(true);
    expect(leitura.designados[0].confirmedoEm).toBe("2026-02-01T10:00:00Z");
  });

  it("documento sem leitura obrigatória atribuída passa incólume", () => {
    expect(reabrirLeitura(null, ctx)).toBeNull();
    expect(reabrirLeitura(undefined, ctx)).toBeNull();
    expect(reabrirLeitura({ atribuido: false }, ctx)).toEqual({ atribuido: false });
  });

  it("é idempotente: reabrir de novo não ressuscita confirmação", () => {
    const leitura = leituraCom([{ userId: "u1", confirmou: true }]);
    const uma = reabrirLeitura(leitura, ctx);
    const duas = reabrirLeitura(uma, { ...ctx, novaVersao: "03" });
    expect(duas.designados[0].confirmou).toBe(false);
    expect(duas.reabertoNaVersao).toBe("03");
  });
});

describe("treinoAtual — treinamento vale para a versão em que foi feito", () => {
  it("registro da versão vigente é atual", () => {
    expect(treinoAtual({ versao: "02" }, "02")).toBe(true);
  });
  it("registro de versão anterior está desatualizado", () => {
    expect(treinoAtual({ versao: "01" }, "02")).toBe(false);
  });
  it("registro legado sem versão não é presumido atual", () => {
    expect(treinoAtual({}, "02")).toBe(false);
    expect(treinoAtual({ versao: null }, "01")).toBe(false);
  });
  it("compara como string (01 vs 1 não são a mesma revisão)", () => {
    expect(treinoAtual({ versao: 2 }, "02")).toBe(false);
    expect(treinoAtual({ versao: "02" }, 2)).toBe(false);
  });
});

describe("pendentesLeitura", () => {
  it("conta quem falta confirmar", () => {
    expect(pendentesLeitura(leituraCom([
      { confirmou: true }, { confirmou: false }, { confirmou: false },
    ]))).toBe(3 - 1);
  });
  it("zero quando não há atribuição", () => {
    expect(pendentesLeitura(null)).toBe(0);
  });
  it("após reabrir, todos voltam a pendente", () => {
    const leitura = leituraCom([{ confirmou: true }, { confirmou: true }]);
    expect(pendentesLeitura(leitura)).toBe(0);
    expect(pendentesLeitura(reabrirLeitura(leitura, ctx))).toBe(2);
  });
});
